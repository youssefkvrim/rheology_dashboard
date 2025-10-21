import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ChartMetricKey = 'densite' | 'viscosite' | 'temperature' | 'ph' | 'pc' | 'h2o' | 'silice' | 'grains';

export type ChartMetricParams = {
  unit: string;
  avgOn: boolean;
  trendOn: boolean;
  deltaY: number; // symmetric error ± delta
  trendWindowMs: number; // 0 = full series
  trendSegPct?: number; // 10..100 segmentation percent of X window
};

type ChartParamsState = Record<ChartMetricKey, ChartMetricParams>;

type ChartParamsContextValue = {
  params: ChartParamsState;
  setParams: (metric: ChartMetricKey, patch: Partial<ChartMetricParams>) => void;
};

const ChartParamsContext = createContext<ChartParamsContextValue | undefined>(undefined);

const defaultParams: ChartParamsState = {
  densite: { unit: 'g/cm³', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0, trendSegPct: 100 },
  viscosite: { unit: 'mPa·s', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0, trendSegPct: 100 },
  temperature: { unit: '°C', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0, trendSegPct: 100 },
  ph: { unit: '(-)', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0, trendSegPct: 100 },
  pc: { unit: 'g', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0, trendSegPct: 100 },
  h2o: { unit: 'L/h', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0, trendSegPct: 100 },
  silice: { unit: '%', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0, trendSegPct: 100 },
  grains: { unit: '%', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0, trendSegPct: 100 },
};

export const ChartParamsProvider: React.FC<{ children: React.ReactNode }>=({ children }) => {
  const [params, setParamsState] = useState<ChartParamsState>(() => {
    try {
      const userId = sessionStorage.getItem('userId') || 'anonymous';
      const raw = localStorage.getItem(`chartParams:${userId}`);
      if (raw) return { ...defaultParams, ...(JSON.parse(raw) as ChartParamsState) };
    } catch {}
    return defaultParams;
  });

  useEffect(() => {
    try {
      const userId = sessionStorage.getItem('userId') || 'anonymous';
      localStorage.setItem(`chartParams:${userId}`, JSON.stringify(params));
    } catch {}
  }, [params]);

  useEffect(() => {
    const onLogin = () => {
      try {
        const userId = sessionStorage.getItem('userId') || 'anonymous';
        const raw = localStorage.getItem(`chartParams:${userId}`);
        if (raw) setParamsState({ ...defaultParams, ...(JSON.parse(raw) as ChartParamsState) });
      } catch {}
    };
    window.addEventListener('user-login', onLogin);
    return () => window.removeEventListener('user-login', onLogin);
  }, []);
  const value = useMemo<ChartParamsContextValue>(()=>({
    params,
    setParams: (metric, patch) => setParamsState(p => ({ ...p, [metric]: { ...p[metric], ...patch } })),
  }), [params]);
  return <ChartParamsContext.Provider value={value}>{children}</ChartParamsContext.Provider>;
};

export function useChartParams() {
  const ctx = useContext(ChartParamsContext);
  if (!ctx) throw new Error('useChartParams must be used within ChartParamsProvider');
  return ctx;
}


