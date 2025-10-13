import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

type MetricSample = { t: number; v: number };
type MetricsSeries = {
  densite: MetricSample[];
  viscosite: MetricSample[];
  ph: MetricSample[];
  temperature: MetricSample[];
};

export type Barbotine = {
  id: string;
  name: string;
  online: boolean;
  last: { densite: number; viscosite: number; ph: number; temperature: number } | null;
};

type Bounds = { low: number; high: number };

type AppState = {
  seed: number;
  barbotines: Barbotine[];
  seriesM7: MetricsSeries;
  bounds: { densite: Bounds; viscosite: Bounds; ph: Bounds; temperature: Bounds };
  setBounds: (metric: keyof AppState['bounds'], next: Bounds) => void;
  overrideLog: { ts: number; action: string; reason: string }[];
  startMassTest: () => MetricSample[];
  addOverride: (action: string, reason: string) => void;
  ambient: { temperatureRoom: number; humidityRoom: number };
  ambientHistory: { t: number; temp: number; humid: number }[];
  addManualSample: (sample: Partial<{ densite: number; viscosite: number; ph: number; temperature: number }>) => void;
  live: boolean;
  setLive: (live: boolean) => void;
  getSeriesForRange: (range: 'all' | '3h' | '1d' | '7d' | '1m' | '3m' | 'specific', anchorTs?: number) => MetricsSeries;
  getSeriesBetween: (startTs: number, endTs: number, stepMs?: number) => MetricsSeries;
  doseRateLph: number;
  setDoseRateLph: (rate: number) => void;
  doseRateHistory: MetricSample[];
  coverPowerHistory: MetricSample[];
  addCoverPowerResult: (value: number) => void;
  lastPlaqueSrc: string | null;
  setLastPlaqueSrc: (src: string | null) => void;
  addBarbotine: (label: string, online?: boolean) => void;
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

function generateNames(): string[] {
  return ['M7-3 006', 'M7-3 ITK', 'M7-3 ½ ITG', '2CN2 ITK', '2CN2 007', '2CN2 008', 'R55 ITK', 'R55 012', 'R55 011'];
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
    const defaults = { densite: { low: 1.25, high: 1.45 }, viscosite: { low: 350, high: 550 }, ph: { low: 7.5, high: 9.0 }, temperature: { low: 18, high: 28 } };
    try {
      const raw = localStorage.getItem('bounds');
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...defaults, ...parsed };
      }
    } catch { /* ignore */ }
    return defaults;
  });

  const now = Date.now();
  const [seriesM7, setSeriesM7] = useState<MetricsSeries>(() => initialSeries(now, { densite: 1.35, viscosite: 420, ph: 8.2, temperature: 22 }, rng));
  const [overrideLog, setOverrideLog] = useState<{ ts: number; action: string; reason: string }[]>([]);
  const [ambient, setAmbient] = useState<{ temperatureRoom: number; humidityRoom: number }>(() => ({ temperatureRoom: 22.0, humidityRoom: 45 }));
  const [ambientHistory, setAmbientHistory] = useState<{ t: number; temp: number; humid: number }[]>([]);
  const [live, setLive] = useState<boolean>(() => (localStorage.getItem('live') ?? '1') === '1');
  const [doseRateLph, setDoseRateLph] = useState<number>(0.019);
  const [doseRateHistory, setDoseRateHistory] = useState<MetricSample[]>([]);
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
    const names = generateNames();
    return names.map((name, idx) => ({
      id: name,
      name,
      online: name === 'M7-3 006',
      last: name === 'M7-3 006' ? {
        densite: seriesM7.densite[seriesM7.densite.length - 1].v,
        viscosite: seriesM7.viscosite[seriesM7.viscosite.length - 1].v,
        ph: seriesM7.ph[seriesM7.ph.length - 1].v,
        temperature: seriesM7.temperature[seriesM7.temperature.length - 1].v,
      } : null
    }));
  });

  // Tick toutes les 5s
  useEffect(() => {
    const id = setInterval(() => {
      if (!live) return; // en pause
      setSeriesM7(prev => {
        const nextPoint = (arr: MetricSample[], baseDrift: number, jitter: number, min: number, max: number) => {
          const last = arr[arr.length - 1];
          const drift = (rng() - 0.5) * baseDrift;
          const noise = (rng() * 2 - 1) * jitter;
          const v = clamp(last.v + drift + noise, min, max);
          return [...arr.slice(-47), { t: Date.now(), v }];
        };
        const next = {
          densite: nextPoint(prev.densite, 0.005, 0.01, 1.2, 1.5),
          viscosite: nextPoint(prev.viscosite, 4, 12, 250, 700),
          ph: nextPoint(prev.ph, 0.02, 0.05, 6.5, 9.8),
          temperature: nextPoint(prev.temperature, 0.05, 0.2, 15, 35),
        };
        setBarbotines(bs => bs.map(b => b.id === 'M7-3 006' ? {
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
      setAmbient(prev => {
        const t = clamp(prev.temperatureRoom + (rng() - 0.5) * 0.2, 18, 28);
        const h = clamp(prev.humidityRoom + (rng() - 0.5) * 1.0, 25, 70);
        const nextAmbient = { temperatureRoom: Number(t.toFixed(1)), humidityRoom: Math.round(h) };
        setAmbientHistory(hist => [...hist.slice(-239), { t: Date.now(), temp: nextAmbient.temperatureRoom, humid: nextAmbient.humidityRoom }]);
        return nextAmbient;
      });
      setDoseRateHistory(hist => [...hist.slice(-239), { t: Date.now(), v: doseRateLph }]);
    }, 5000);
    return () => clearInterval(id);
  }, [rng, live]);

  useEffect(() => {
    localStorage.setItem('live', live ? '1' : '0');
  }, [live]);

  useEffect(() => {
    try { localStorage.setItem('bounds', JSON.stringify(bounds)); } catch { /* ignore */ }
  }, [bounds]);

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

  const value: AppState = {
    seed: seedParam,
    barbotines,
    seriesM7,
    bounds,
    setBounds: (metric, next) => setBoundsState((prev: any) => ({ ...prev, [metric]: next })),
    overrideLog,
    startMassTest,
    addOverride,
    ambient,
    ambientHistory,
    addManualSample,
    live,
    setLive,
    doseRateHistory,
    getSeriesForRange: (range, anchorTs) => {
      if (range === 'all') return seriesM7;
      // génère une série simulée déterministe pour la période, ancrée sur anchorTs (ou maintenant)
      const nowTs = Date.now();
      let end = Math.min(anchorTs ?? nowTs, nowTs);
      let start = end - 3 * 60 * 60 * 1000; // 3h par défaut
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
    },
    getSeriesBetween: (startTs, endTs, stepMs) => {
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
    },
    doseRateLph,
    setDoseRateLph: (r: number) => setDoseRateLph(Math.max(0, Number(r.toFixed(3)))),
    coverPowerHistory,
    addCoverPowerResult: (value: number) => setCoverPowerHistory(prev => [...prev, { t: Date.now(), v: Number(value.toFixed(2)) }].slice(-200)),
    lastPlaqueSrc,
    setLastPlaqueSrc,
    addBarbotine: (label: string, online?: boolean) => setBarbotines(prev => [...prev, { id: label, name: label, online: !!online, last: null }]),
    applyMetricPoints: (key, points) => {
      setSeriesM7(prev => {
        const map = new Map<number, number>();
        prev[key].forEach(p => map.set(p.t, p.v));
        points.forEach(p => map.set(p.t, p.v));
        const merged = Array.from(map.entries()).sort((a,b)=>a[0]-b[0]).map(([t,v]) => ({ t, v }));
        return { ...prev, [key]: merged } as MetricsSeries;
      });
    }
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


