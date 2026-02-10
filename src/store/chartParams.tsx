import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ChartMetricKey = 'densite' | 'viscosite' | 'temperature' | 'ph' | 'pc' | 'h2o' | 'silice' | 'grains';

export type ChartMetricParams = {
  unit: string;
  avgOn: boolean;
  trendOn: boolean;
  deltaY: number; // the +/- error margin around data points
  trendWindowMs: number; // 0 means use the whole series
  trendSegPct?: number; // how chunky the trend line segments are (10-100%)
  interpOn?: boolean;
  interpMode?: 'linear' | 'lagrange3';
};

type ChartParamsState = Record<ChartMetricKey, ChartMetricParams>;
type ChartParamsById = Record<string, ChartParamsState>;

type ChartParamsContextValue = {
  // global params for screens that dont care about specific slurry id
  params: ChartParamsState;
  setParams: (metric: ChartMetricKey, patch: Partial<ChartMetricParams>) => void;
  // per-slurry chart settings so each one can be tweaked independently
  getParamsFor: (id: string) => ChartParamsState;
  setParamsFor: (id: string, metric: ChartMetricKey, patch: Partial<ChartMetricParams>) => void;
};

const ChartParamsContext = createContext<ChartParamsContextValue | undefined>(undefined);

// sensible defaults for every metric, nothing fancy
const defaultParams: ChartParamsState = {
  densite: { unit: 'g/cm³', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0, trendSegPct: 100, interpOn: false, interpMode: 'linear' },
  viscosite: { unit: 'mPa·s', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0, trendSegPct: 100, interpOn: false, interpMode: 'linear' },
  temperature: { unit: '°C', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0, trendSegPct: 100, interpOn: false, interpMode: 'linear' },
  ph: { unit: '(-)', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0, trendSegPct: 100, interpOn: false, interpMode: 'linear' },
  pc: { unit: 'g', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0, trendSegPct: 100, interpOn: false, interpMode: 'linear' },
  h2o: { unit: 'L/h', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0, trendSegPct: 100, interpOn: false, interpMode: 'linear' },
  silice: { unit: '%', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0, trendSegPct: 100, interpOn: false, interpMode: 'linear' },
  grains: { unit: '%', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0, trendSegPct: 100, interpOn: false, interpMode: 'linear' },
};

export const ChartParamsProvider: React.FC<{ children: React.ReactNode }>=({ children }) => {
  // try to restore chart settings from last session
  const [params, setParamsState] = useState<ChartParamsState>(() => {
    try {
      const userId = sessionStorage.getItem('userId') || 'anonymous';
      const raw = localStorage.getItem(`chartParams:${userId}`);
      if (raw) return { ...defaultParams, ...(JSON.parse(raw) as ChartParamsState) };
    } catch {}
    return defaultParams;
  });
  // same but for the per-slurry overrides
  const [paramsById, setParamsById] = useState<ChartParamsById>(() => {
    try {
      const userId = sessionStorage.getItem('userId') || 'anonymous';
      const raw = localStorage.getItem(`chartParamsById:${userId}`);
      if (raw) return JSON.parse(raw) as ChartParamsById;
    } catch {}
    return {} as ChartParamsById;
  });

  // auto-save global params whenever they change
  useEffect(() => {
    try {
      const userId = sessionStorage.getItem('userId') || 'anonymous';
      localStorage.setItem(`chartParams:${userId}`, JSON.stringify(params));
    } catch {}
  }, [params]);
  // auto-save per-slurry params too
  useEffect(() => {
    try {
      const userId = sessionStorage.getItem('userId') || 'anonymous';
      localStorage.setItem(`chartParamsById:${userId}`, JSON.stringify(paramsById));
    } catch {}
  }, [paramsById]);

  // when someone logs in, reload their saved chart settings
  useEffect(() => {
    const onLogin = () => {
      try {
        const userId = sessionStorage.getItem('userId') || 'anonymous';
        const raw = localStorage.getItem(`chartParams:${userId}`);
        if (raw) setParamsState({ ...defaultParams, ...(JSON.parse(raw) as ChartParamsState) });
        const rawById = localStorage.getItem(`chartParamsById:${userId}`);
        if (rawById) setParamsById(JSON.parse(rawById) as ChartParamsById);
      } catch {}
    };
    window.addEventListener('user-login', onLogin);
    return () => window.removeEventListener('user-login', onLogin);
  }, []);
  const value = useMemo<ChartParamsContextValue>(()=>({
    params,
    setParams: (metric, patch) => setParamsState(p => ({ ...p, [metric]: { ...p[metric], ...patch } })),
    getParamsFor: (id: string) => {
      const scoped = paramsById[id];
      // if this slurry has custom params use those, otherwise just use the global defaults
      return scoped ? ({ ...defaultParams, ...scoped }) : defaultParams;
    },
    setParamsFor: (id: string, metric, patch) => setParamsById(prev => {
      const current = prev[id] ? ({ ...defaultParams, ...prev[id] }) : defaultParams;
      const nextForId: ChartParamsState = { ...current, [metric]: { ...current[metric], ...patch } };
      return { ...prev, [id]: nextForId };
    }),
  }), [params, paramsById]);
  return <ChartParamsContext.Provider value={value}>{children}</ChartParamsContext.Provider>;
};

// hook to use chart params anywhere, will yell at u if u forget the provider lol
export function useChartParams() {
  const ctx = useContext(ChartParamsContext);
  if (!ctx) throw new Error('useChartParams must be used within ChartParamsProvider');
  return ctx;
}
