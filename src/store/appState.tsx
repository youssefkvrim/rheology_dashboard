import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Barbotine, Bounds, MetricSample, MetricsSeries, RangeKey, BarbotineConfig } from '../types/domain';
import { MetricsRepository, SimMetricsRepository } from '../repositories/metricsRepo';

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
  live: boolean;
  setLive: (live: boolean) => void;
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

function generateNames(): Array<{ name: string; slurryId: string }>{
  return [
    { name: 'M7-3 005', slurryId: 'M7-3_005' },
    { name: 'M7-3 006', slurryId: 'M7-3_006' },
    { name: 'M7-3 025ITK', slurryId: 'M7-3_025ITK' },
    { name: 'M7-3 1/2ITG', slurryId: 'M7-3_1-2ITG' },
    { name: 'M7-3 1-2PFX', slurryId: 'M7-3_1-2PFX' },
    { name: '2CN2 005', slurryId: '2CN2_005' },
    { name: '2CN2 007', slurryId: '2CN2_007' },
    { name: '2CN2 008', slurryId: '2CN2_008' },
    { name: '2CN2 ITK57U', slurryId: '2CN2_ITK57U' },
    { name: 'R55 010', slurryId: 'R55_010' },
    { name: 'R55 011', slurryId: 'R55_011' },
    { name: 'R55 012ITG', slurryId: 'R55_012ITG' },
    { name: 'R55 ITK57U', slurryId: 'R55_ITK57U' },
  ];
}

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
    const defaults = { densite: { low: 1.25 as number | null, high: 1.45 as number | null }, viscosite: { low: 350 as number | null, high: 550 as number | null }, ph: { low: 7.5 as number | null, high: 9.0 as number | null }, temperature: { low: 18 as number | null, high: 28 as number | null }, pc: { low: null as number | null, high: null as number | null }, h2o: { low: null as number | null, high: null as number | null }, silice: { low: null as number | null, high: null as number | null }, grains: { low: null as number | null, high: null as number | null } };
    try {
      const userId = sessionStorage.getItem('userId') || 'anonymous';
      const raw = localStorage.getItem(`bounds:${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...defaults, ...parsed };
      }
    } catch { /* ignore */ }
    return defaults;
  });

  type AllBounds = { densite: Bounds; viscosite: Bounds; ph: Bounds; temperature: Bounds; pc: Bounds; h2o: Bounds; silice: Bounds; grains: Bounds };
  const [boundsById, setBoundsById] = useState<Record<string, AllBounds>>(() => {
    try {
      const userId = sessionStorage.getItem('userId') || 'anonymous';
      const raw = localStorage.getItem(`boundsById:${userId}`);
      if (raw) return JSON.parse(raw) as Record<string, AllBounds>;
    } catch { /* ignore */ }
    return {} as Record<string, AllBounds>;
  });

  const now = Date.now();
  const [seriesM7, setSeriesM7] = useState<MetricsSeries>(() => ({ densite: [], viscosite: [], ph: [], temperature: [] }));
  const [overrideLog, setOverrideLog] = useState<{ ts: number; action: string; reason: string }[]>([]);
  const [ambient, setAmbient] = useState<{ temperatureRoom: number; humidityRoom: number }>(() => ({ temperatureRoom: 22.0, humidityRoom: 60 }));
  const [ambientHistory, setAmbientHistory] = useState<{ t: number; temp: number; humid: number }[]>(() => {
    const now = Date.now();
    const arr: { t: number; temp: number; humid: number }[] = [];
    // seed last 3 days at 30 min step
    for (let t = now - 3*24*60*60*1000; t <= now; t += 30*60*1000) {
      const temp = 22 + (Math.sin(t/3.6e6) * 0.6) + (Math.random() * 0.2 - 0.1); // ~21.4..22.6
      const humid = 61 + (Math.sin(t/7.2e6) * 3) + (Math.random()*2-1); // ~58..64
      arr.push({ t, temp: Number(temp.toFixed(1)), humid: Math.round(humid) });
    }
    return arr;
  });
  const [live, setLive] = useState<boolean>(() => (localStorage.getItem('live') ?? '1') === '1');
  const [doseRateLph, setDoseRateLph] = useState<number>(0.019);
  const [doseRateHistory, setDoseRateHistory] = useState<MetricSample[]>(() => {
    const now = Date.now();
    const arr: MetricSample[] = [];
    const sim = createMulberry32(seedParam + 555);
    for (let t = now - 3*24*60*60*1000; t <= now; t += 10*60*1000) { // every 10 minutes across 3 days
      const base = 0.025 + (sim() * 0.02 - 0.01); // 0.015..0.035
      arr.push({ t, v: Number(base.toFixed(3)) });
    }
    return arr;
  });
  const [coverPowerHistory, setCoverPowerHistory] = useState<MetricSample[]>(() => {
    const nowTs = Date.now();
    // 20 points sur 10 jours
    const simRng = createMulberry32(seedParam + 987);
    const arr: MetricSample[] = [];
    for (let i = 19; i >= 0; i--) {
      const t = nowTs - i * (12 * 60 * 60 * 1000);
      const base = 65 + (simRng() * 10 - 5);
      arr.push({ t, v: Number(base.toFixed(2)) });
    }
    return arr;
  });
  const [lastPlaqueSrc, setLastPlaqueSrc] = useState<string | null>(null);

  const [barbotines, setBarbotines] = useState<Barbotine[]>(() => {
    const build = () => {
      const items = generateNames();
      return items.map((it) => ({
        id: it.name,
        name: it.name,
        slurryId: it.slurryId,
        online: true,
        last: null
      }));
    };
    try {
      const raw = localStorage.getItem('barbotines');
      if (raw) {
        const parsed = JSON.parse(raw) as Barbotine[];
        // migrate if old shape (missing slurryId or wrong order)
        if (!Array.isArray(parsed) || !parsed.length || !('slurryId' in (parsed[0] as any))) {
          const next = build();
          localStorage.setItem('barbotines', JSON.stringify(next));
          return next;
        }
        return parsed;
      }
    } catch { /* ignore */ }
    const next = build();
    return next;
  });

  // Tick toutes les 5s
  useEffect(() => {
    // disable simulator: ambient still updates, but series remain from DB only (empty otherwise)
    const id = setInterval(() => {
      if (!live) return;
      setAmbient(prev => {
        const t = clamp(prev.temperatureRoom + (Math.random() - 0.5) * 0.08, 21, 23);
        const h = clamp(prev.humidityRoom + (Math.random() - 0.5) * 0.8, 55, 70);
        const nextAmbient = { temperatureRoom: Number(t.toFixed(1)), humidityRoom: Math.round(h) };
        const nowTs = Date.now();
        setAmbientHistory(hist => {
          const next = [...hist, { t: nowTs, temp: nextAmbient.temperatureRoom, humid: nextAmbient.humidityRoom }];
          const windowStart = nowTs - 3*24*60*60*1000;
          return next.filter(p => p.t >= windowStart);
        });
        return nextAmbient;
      });
    }, 5000);
    return () => clearInterval(id);
  }, [live]);
  // Persist barbotines list
  useEffect(() => {
    try {
      localStorage.setItem('barbotines', JSON.stringify(barbotines));
    } catch { /* ignore */ }
  }, [barbotines]);


  useEffect(() => { localStorage.setItem('live', live ? '1' : '0'); }, [live]);

  useEffect(() => {
    try {
      const userId = sessionStorage.getItem('userId') || 'anonymous';
      localStorage.setItem(`bounds:${userId}`, JSON.stringify(bounds));
    } catch { /* ignore */ }
  }, [bounds]);

  useEffect(() => {
    try {
      const userId = sessionStorage.getItem('userId') || 'anonymous';
      localStorage.setItem(`boundsById:${userId}`, JSON.stringify(boundsById));
    } catch { /* ignore */ }
  }, [boundsById]);

  useEffect(() => {
    const onLogin = () => {
      try {
        const userId = sessionStorage.getItem('userId') || 'anonymous';
        const raw = localStorage.getItem(`bounds:${userId}`);
        if (raw) setBoundsState((prev: typeof bounds) => ({ ...prev, ...(JSON.parse(raw) as typeof prev) }));
        const rawMap = localStorage.getItem(`boundsById:${userId}`);
        if (rawMap) setBoundsById(JSON.parse(rawMap) as Record<string, AllBounds>);
      } catch { /* ignore */ }
    };
    window.addEventListener('user-login', onLogin);
    return () => window.removeEventListener('user-login', onLogin);
  }, []);

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

  const repo = useMemo(() => new SimMetricsRepository({
    getSeriesForRange: selectSeriesForRange,
    getSeriesBetween: selectSeriesBetween,
  }), [seriesM7, seedParam]);

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
    setBoundsFor: (id: string, metric, next) => setBoundsById(prev => {
      const base = prev[id] || bounds;
      return { ...prev, [id]: { ...base, [metric]: next } };
    }),
    overrideLog,
    startMassTest,
    addOverride,
    ambient,
    ambientHistory,
    addManualSample,
    live,
    setLive,
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


