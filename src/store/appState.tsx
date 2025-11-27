import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Barbotine, Bounds, MetricSample, MetricsSeries, RangeKey, BarbotineConfig } from '../types/domain';
import { MetricsRepository, SimMetricsRepository, ApiMetricsRepository } from '../repositories/metricsRepo';

type AppState = {
  seed: number;
  barbotines: Barbotine[];
  seriesM7: MetricsSeries;
  bounds: { densite: Bounds; viscosite: Bounds; ph: Bounds; temperature: Bounds; pc: Bounds; h2o: Bounds; silice: Bounds; grains: Bounds };
  setBounds: (metric: keyof AppState['bounds'], next: Bounds) => void;
  getBoundsFor: (id: string) => { densite: Bounds; viscosite: Bounds; ph: Bounds; temperature: Bounds; pc: Bounds; h2o: Bounds; silice: Bounds; grains: Bounds };
  setBoundsFor: (id: string, metric: keyof AppState['bounds'], next: Bounds) => void;
  overrideLog: { ts: number; action: string; reason: string }[];
  startMassTest: () => MetricSample[];
  addOverride: (action: string, reason: string) => void;
  ambient: { temperatureRoom: number; humidityRoom: number };
  ambientHistory: { t: number; temp: number; humid: number }[];
  addManualSample: (sample: Partial<{ densite: number; viscosite: number; ph: number; temperature: number }>) => void;
  getSeriesForRange: (range: RangeKey, anchorTs?: number) => MetricsSeries;
  getSeriesBetween: (startTs: number, endTs: number, stepMs?: number) => MetricsSeries;
  repo: MetricsRepository;
  doseRateLph: number;
  setDoseRateLph: (rate: number) => void;
  doseRateHistory: MetricSample[];
  coverPowerHistory: MetricSample[];
  addCoverPowerResult: (value: number) => void;
  lastPlaqueSrc: string | null;
  setLastPlaqueSrc: (src: string | null) => void;
  addBarbotine: (label: string, online?: boolean, config?: BarbotineConfig) => void;
  applyMetricPoints: (key: 'densite'|'viscosite'|'ph'|'temperature', points: { t:number; v:number }[], mode: 'overwrite') => void;
  initialDataLoading: boolean;
};

const AppStateContext = createContext<AppState | undefined>(undefined);

// Mulberry32 PRNG pour seed stable
function createMulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }

import { fetchSlurries, getUserPrefs, putUserPrefs } from '../services/api';

function initialSeries(now: number, base: { densite: number; viscosite: number; ph: number; temperature: number }, rng: () => number): MetricsSeries {
  const make = (baseValue: number, jitter: number) => Array.from({ length: 24 }, (_, i) => ({ t: now - (23 - i) * 5000, v: baseValue + (rng() * 2 - 1) * jitter }));
  return {
    densite: make(base.densite, 0.02),
    viscosite: make(base.viscosite, 30),
    ph: make(base.ph, 0.1),
    temperature: make(base.temperature, 0.5),
  };
}

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const seedParam = Number(new URLSearchParams(window.location.search).get('seed')) || 12345;
  const rng = useMemo(() => createMulberry32(seedParam), [seedParam]);

  const [bounds, setBoundsState] = useState(() => {
    // Default: no prefilled bounds. Only DB-backed values should populate these.
    const defaults = {
      densite: { low: null as number | null, high: null as number | null },
      viscosite: { low: null as number | null, high: null as number | null },
      ph: { low: null as number | null, high: null as number | null },
      temperature: { low: null as number | null, high: null as number | null },
      pc: { low: null as number | null, high: null as number | null },
      h2o: { low: null as number | null, high: null as number | null },
      silice: { low: null as number | null, high: null as number | null },
      grains: { low: null as number | null, high: null as number | null }
    };
    // Strip legacy hardcoded defaults if found in persisted storage
    const stripLegacy = (obj: any) => {
      const copy = { ...(obj || {}) };
      if (copy?.densite && copy.densite.low === 1.25 && copy.densite.high === 1.45) copy.densite = { low: null, high: null };
      if (copy?.viscosite && copy.viscosite.low === 350 && copy.viscosite.high === 550) copy.viscosite = { low: null, high: null };
      if (copy?.ph && copy.ph.low === 7.5 && copy.ph.high === 9.0) copy.ph = { low: null, high: null };
      if (copy?.temperature && copy.temperature.low === 18 && copy.temperature.high === 28) copy.temperature = { low: null, high: null };
      return copy;
    };
    try {
      const userId = sessionStorage.getItem('userId') || 'anonymous';
      const raw = localStorage.getItem(`bounds:${userId}`);
      if (raw) {
        const parsed = stripLegacy(JSON.parse(raw));
        return { ...defaults, ...parsed };
      }
    } catch { /* ignore */ }
    return defaults;
  });

  type AllBounds = { densite: Bounds; viscosite: Bounds; ph: Bounds; temperature: Bounds; pc: Bounds; h2o: Bounds; silice: Bounds; grains: Bounds };
  const [boundsById, setBoundsById] = useState<Record<string, AllBounds>>(() => {
    const stripLegacy = (obj: any) => {
      const next: Record<string, AllBounds> = {};
      for (const [id, b] of Object.entries(obj || {})) {
        const copy: any = { ...(b || {}) };
        if (copy?.densite && copy.densite.low === 1.25 && copy.densite.high === 1.45) copy.densite = { low: null, high: null };
        if (copy?.viscosite && copy.viscosite.low === 350 && copy.viscosite.high === 550) copy.viscosite = { low: null, high: null };
        if (copy?.ph && copy.ph.low === 7.5 && copy.ph.high === 9.0) copy.ph = { low: null, high: null };
        if (copy?.temperature && copy.temperature.low === 18 && copy.temperature.high === 28) copy.temperature = { low: null, high: null };
        next[id] = copy as AllBounds;
      }
      return next;
    };
    try {
      const userId = sessionStorage.getItem('userId') || 'anonymous';
      const raw = localStorage.getItem(`boundsById:${userId}`);
      if (raw) return stripLegacy(JSON.parse(raw)) as Record<string, AllBounds>;
    } catch { /* ignore */ }
    return {} as Record<string, AllBounds>;
  });

  const now = Date.now();
  const [seriesM7, setSeriesM7] = useState<MetricsSeries>(() => ({ densite: [], viscosite: [], ph: [], temperature: [] }));
  const [overrideLog, setOverrideLog] = useState<{ ts: number; action: string; reason: string }[]>([]);
  const [ambient, setAmbient] = useState<{ temperatureRoom: number; humidityRoom: number }>(() => ({ temperatureRoom: 0, humidityRoom: 0 }));
  const [ambientHistory, setAmbientHistory] = useState<{ t: number; temp: number; humid: number }[]>(() => []);
  const [doseRateLph, setDoseRateLph] = useState<number>(0.019);
  const [doseRateHistory, setDoseRateHistory] = useState<MetricSample[]>(() => []);
  const [coverPowerHistory, setCoverPowerHistory] = useState<MetricSample[]>(() => []);
  const [lastPlaqueSrc, setLastPlaqueSrc] = useState<string | null>(null);

  const [barbotines, setBarbotines] = useState<Barbotine[]>(() => {
    try {
      const raw = localStorage.getItem('barbotines');
      if (raw) {
        const parsed = JSON.parse(raw) as Barbotine[];
        return parsed;
      }
    } catch { /* ignore */ }
    return [];
  });
  const [initialDataLoading, setInitialDataLoading] = useState<boolean>(true);
  const slurriesFetchCount = useRef(0);
  const loadBarbotines = useCallback(async () => {
    slurriesFetchCount.current += 1;
    setInitialDataLoading(true);
    try {
      const list = await fetchSlurries();
      const next: Barbotine[] = list.map(it => ({
        id: it.id,
        name: it.id.replace(/_/g, ' '),
        slurryId: it.id,
        online: true,
        last: null,
      }));
      setBarbotines(next);
    } catch {
      // keep previous list; UI will show offline states
    } finally {
      slurriesFetchCount.current = Math.max(0, slurriesFetchCount.current - 1);
      if (slurriesFetchCount.current === 0) {
        setInitialDataLoading(false);
      }
    }
  }, []);

  // Load barbotines from backend (distinct id_slurry)
  useEffect(() => {
    void loadBarbotines();
  }, [loadBarbotines]);

  // No ambient simulator; waiting for real data source
  // Persist barbotines list
  useEffect(() => {
    try {
      localStorage.setItem('barbotines', JSON.stringify(barbotines));
    } catch { /* ignore */ }
  }, [barbotines]);


  useEffect(() => {
    try {
      const userId = sessionStorage.getItem('userId') || 'anonymous';
      localStorage.setItem(`bounds:${userId}`, JSON.stringify(bounds));
    } catch { /* ignore */ }
    (async () => {
      try {
        const userId = sessionStorage.getItem('userId') || '';
        if (!userId) return;
        await putUserPrefs(userId, { bounds });
      } catch { /* ignore */ }
    })();
  }, [bounds]);

  // Debounced save of boundsById to prevent excessive API calls
  const boundsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    try {
      const userId = sessionStorage.getItem('userId') || 'anonymous';
      localStorage.setItem(`boundsById:${userId}`, JSON.stringify(boundsById));
    } catch { /* ignore */ }
    // Debounce the API call - wait 2s after last change
    if (boundsDebounceRef.current) clearTimeout(boundsDebounceRef.current);
    boundsDebounceRef.current = setTimeout(async () => {
      try {
        const userId = sessionStorage.getItem('userId') || '';
        if (!userId) return;
        await putUserPrefs(userId, { boundsById });
      } catch { /* ignore */ }
    }, 2000);
    return () => { if (boundsDebounceRef.current) clearTimeout(boundsDebounceRef.current); };
  }, [boundsById]);

  useEffect(() => {
    const onLogin = () => {
      void loadBarbotines();
      try {
        const userId = sessionStorage.getItem('userId') || 'anonymous';
        const raw = localStorage.getItem(`bounds:${userId}`);
        if (raw) {
          const parsed = JSON.parse(raw) as typeof bounds;
          const strip = (obj: any) => {
          const copy = { ...(obj || {}) };
            if (copy?.densite && copy.densite.low === 1.25 && copy.densite.high === 1.45) copy.densite = { low: null, high: null };
            if (copy?.viscosite && copy.viscosite.low === 350 && copy.viscosite.high === 550) copy.viscosite = { low: null, high: null };
            if (copy?.ph && copy.ph.low === 7.5 && copy.ph.high === 9.0) copy.ph = { low: null, high: null };
            if (copy?.temperature && copy.temperature.low === 18 && copy.temperature.high === 28) copy.temperature = { low: null, high: null };
            return copy;
          };
          setBoundsState((prev: typeof bounds) => ({ ...prev, ...(strip(parsed) as typeof prev) }));
        }
        const rawMap = localStorage.getItem(`boundsById:${userId}`);
        if (rawMap) {
          const obj = JSON.parse(rawMap) as Record<string, AllBounds>;
          const stripAll = (o: Record<string, AllBounds>) => {
            const next: Record<string, AllBounds> = {};
            for (const [id, b] of Object.entries(o || {})) {
          const copy: any = { ...(b || {}) };
              if (copy?.densite && copy.densite.low === 1.25 && copy.densite.high === 1.45) copy.densite = { low: null, high: null };
              if (copy?.viscosite && copy.viscosite.low === 350 && copy.viscosite.high === 550) copy.viscosite = { low: null, high: null };
              if (copy?.ph && copy.ph.low === 7.5 && copy.ph.high === 9.0) copy.ph = { low: null, high: null };
              if (copy?.temperature && copy.temperature.low === 18 && copy.temperature.high === 28) copy.temperature = { low: null, high: null };
              next[id] = copy as AllBounds;
            }
            return next;
          };
          setBoundsById(stripAll(obj));
        }
      } catch { /* ignore */ }
      (async () => {
        try {
          const userId = sessionStorage.getItem('userId') || '';
          if (!userId) return;
          const prefs = await getUserPrefs(userId);
          if (prefs?.bounds) {
            const strip = (obj: any) => {
              const copy = { ...obj };
              if (copy?.densite && copy.densite.low === 1.25 && copy.densite.high === 1.45) copy.densite = { low: null, high: null };
              if (copy?.viscosite && copy.viscosite.low === 350 && copy.viscosite.high === 550) copy.viscosite = { low: null, high: null };
              if (copy?.ph && copy.ph.low === 7.5 && copy.ph.high === 9.0) copy.ph = { low: null, high: null };
              if (copy?.temperature && copy.temperature.low === 18 && copy.temperature.high === 28) copy.temperature = { low: null, high: null };
              return copy;
            };
            setBoundsState((prev: typeof bounds) => ({ ...prev, ...(strip(prefs.bounds) as typeof prev) }));
          }
          if (prefs?.boundsById) {
            const stripAll = (o: Record<string, AllBounds>) => {
              const next: Record<string, AllBounds> = {};
              for (const [id, b] of Object.entries(o || {})) {
                const copy: any = { ...(b || {}) };
                if (copy?.densite && copy.densite.low === 1.25 && copy.densite.high === 1.45) copy.densite = { low: null, high: null };
                if (copy?.viscosite && copy.viscosite.low === 350 && copy.viscosite.high === 550) copy.viscosite = { low: null, high: null };
                if (copy?.ph && copy.ph.low === 7.5 && copy.ph.high === 9.0) copy.ph = { low: null, high: null };
                if (copy?.temperature && copy.temperature.low === 18 && copy.temperature.high === 28) copy.temperature = { low: null, high: null };
                next[id] = copy as AllBounds;
              }
              return next;
            };
            setBoundsById(stripAll(prefs.boundsById as Record<string, AllBounds>));
          }
        } catch { /* ignore */ }
      })();
    };
    window.addEventListener('user-login', onLogin);
    return () => window.removeEventListener('user-login', onLogin);
  }, [loadBarbotines]);

  const startMassTest = () => {
    const start = Date.now();
    const points: MetricSample[] = [];
    const m0 = 0;
    const mMax = 100;
    for (let t = 0; t <= 30; t++) {
      const progress = t / 30;
      const value = m0 + mMax * (1 - Math.exp(-4 * progress)) + (rng() * 2 - 1) * 2;
      points.push({ t: start + t * 1000, v: Math.max(0, value) });
    }
    return points;
  };

  const addOverride = (action: string, reason: string) => {
    setOverrideLog(log => [{ ts: Date.now(), action, reason }, ...log].slice(0, 50));
  };

  const addManualSample = (sample: Partial<{ densite: number; viscosite: number; ph: number; temperature: number }>) => {
    const nowTs = Date.now();
    setSeriesM7(prev => {
      const next = {
        densite: [...prev.densite.slice(-47), { t: nowTs, v: sample.densite ?? prev.densite[prev.densite.length - 1].v }],
        viscosite: [...prev.viscosite.slice(-47), { t: nowTs, v: sample.viscosite ?? prev.viscosite[prev.viscosite.length - 1].v }],
        ph: [...prev.ph.slice(-47), { t: nowTs, v: sample.ph ?? prev.ph[prev.ph.length - 1].v }],
        temperature: [...prev.temperature.slice(-47), { t: nowTs, v: sample.temperature ?? prev.temperature[prev.temperature.length - 1].v }],
      };
      setBarbotines(bs => bs.map(b => b.id === 'M7' ? {
        ...b,
        last: {
          densite: next.densite[next.densite.length - 1].v,
          viscosite: next.viscosite[next.viscosite.length - 1].v,
          ph: next.ph[next.ph.length - 1].v,
          temperature: next.temperature[next.temperature.length - 1].v,
        }
      } : b));
      return next;
    });
  };

  // Shared simulated selectors to be used by both UI and the repository seam
  const selectSeriesForRange = (range: RangeKey, anchorTs?: number): MetricsSeries => {
    if (range === 'all') return seriesM7;
    const nowTs = Date.now();
    let end = Math.min(anchorTs ?? nowTs, nowTs);
    let start = end - 3 * 60 * 60 * 1000;
    let step = 30 * 1000;
    if (range === '1d') { start = end - 24 * 60 * 60 * 1000; step = 10 * 60 * 1000; }
    else if (range === '7d') { start = end - 7 * 24 * 60 * 60 * 1000; step = 60 * 60 * 1000; }
    else if (range === '1m') { start = end - 30 * 24 * 60 * 60 * 1000; step = 6 * 60 * 60 * 1000; }
    else if (range === '3m') { start = end - 90 * 24 * 60 * 60 * 1000; step = 12 * 60 * 60 * 1000; }
    else if (range === '3h') { start = end - 3 * 60 * 60 * 1000; step = 30 * 1000; }
    else if (range === 'specific' && anchorTs) { start = anchorTs; end = anchorTs + 60 * 60 * 1000; step = 60 * 1000; }

    const simRng = createMulberry32(seedParam + Math.floor(start / step));
    const generateBetween = (base: number, jitter: number, drift: number, min: number, max: number): MetricSample[] => {
      const arr: MetricSample[] = [];
      let current = base;
      for (let t = start; t <= end; t += step) {
        current = clamp(current + (simRng() - 0.5) * drift + (simRng() * 2 - 1) * jitter, min, max);
        arr.push({ t, v: current });
      }
      return arr;
    };

    return {
      densite: generateBetween(1.35, 0.02, 0.01, 1.2, 1.5),
      viscosite: generateBetween(420, 20, 6, 250, 700),
      ph: generateBetween(8.2, 0.05, 0.02, 6.5, 9.8),
      temperature: generateBetween(22, 0.3, 0.1, 15, 35),
    };
  };

  const selectSeriesBetween = (startTs: number, endTs: number, stepMs?: number): MetricsSeries => {
    const start = Math.min(startTs, endTs);
    const end = Math.max(startTs, endTs);
    const desiredPoints = 240;
    const step = stepMs || Math.max(1000, Math.floor((end - start) / desiredPoints));
    const simRng = createMulberry32(seedParam + Math.floor(start / step));
    const generateBetween = (base: number, jitter: number, drift: number, min: number, max: number): MetricSample[] => {
      const arr: MetricSample[] = [];
      let current = base;
      for (let t = start; t <= end; t += step) {
        current = clamp(current + (simRng() - 0.5) * drift + (simRng() * 2 - 1) * jitter, min, max);
        arr.push({ t, v: current });
      }
      return arr;
    };
    return {
      densite: generateBetween(1.35, 0.02, 0.01, 1.2, 1.5),
      viscosite: generateBetween(420, 20, 6, 250, 700),
      ph: generateBetween(8.2, 0.05, 0.02, 6.5, 9.8),
      temperature: generateBetween(22, 0.3, 0.1, 15, 35),
    };
  };

  const repo = useMemo<MetricsRepository>(() => new ApiMetricsRepository(), []);

  // Stable callback to prevent infinite re-renders in consumers
  const setBoundsForStable = useCallback((id: string, metric: keyof AppState['bounds'], next: Bounds) => {
    setBoundsById(prev => {
      const base = prev[id] || bounds;
      return { ...prev, [id]: { ...base, [metric]: next } };
    });
  }, [bounds]);

  const value: AppState = {
    seed: seedParam,
    barbotines,
    seriesM7,
    bounds,
    setBounds: (metric, next) => setBoundsState((prev: any) => ({ ...prev, [metric]: next })),
    getBoundsFor: (id: string) => {
      const b = boundsById[id];
      return b ? b : bounds;
    },
    setBoundsFor: setBoundsForStable,
    overrideLog,
    startMassTest,
    addOverride,
    ambient,
    ambientHistory,
    addManualSample,
    doseRateHistory,
    getSeriesForRange: selectSeriesForRange,
    getSeriesBetween: selectSeriesBetween,
    doseRateLph,
    setDoseRateLph: (r: number) => setDoseRateLph(Math.max(0, Number(r.toFixed(3)))),
    coverPowerHistory,
    addCoverPowerResult: (value: number) => setCoverPowerHistory(prev => [...prev, { t: Date.now(), v: Number(value.toFixed(2)) }].slice(-200)),
    lastPlaqueSrc,
    setLastPlaqueSrc,
    addBarbotine: (label: string, online?: boolean, config?: BarbotineConfig) => setBarbotines(prev => [...prev, { id: label, name: label, online: !!online, last: null, config }]),
    applyMetricPoints: (key, points) => {
      setSeriesM7(prev => {
        const map = new Map<number, number>();
        prev[key].forEach(p => map.set(p.t, p.v));
        points.forEach(p => map.set(p.t, p.v));
        const merged = Array.from(map.entries()).sort((a,b)=>a[0]-b[0]).map(([t,v]) => ({ t, v }));
        return { ...prev, [key]: merged } as MetricsSeries;
      });
    },
    repo,
    initialDataLoading,
  };

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
};

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}


