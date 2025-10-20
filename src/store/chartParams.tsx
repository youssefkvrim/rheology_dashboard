import React, { createContext, useContext, useMemo, useState } from 'react';

export type ChartMetricKey = 'densite' | 'viscosite' | 'temperature' | 'ph' | 'pc' | 'h2o' | 'silice' | 'grains';

export type ChartMetricParams = {
  unit: string;
  avgOn: boolean;
  trendOn: boolean;
  deltaY: number; // symmetric error ± delta
  trendWindowMs: number; // 0 = full series
};

type ChartParamsState = Record<ChartMetricKey, ChartMetricParams>;

type ChartParamsContextValue = {
  params: ChartParamsState;
  setParams: (metric: ChartMetricKey, patch: Partial<ChartMetricParams>) => void;
};

const ChartParamsContext = createContext<ChartParamsContextValue | undefined>(undefined);

const defaultParams: ChartParamsState = {
  densite: { unit: 'g/cm³', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0 },
  viscosite: { unit: 'mPa·s', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0 },
  temperature: { unit: '°C', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0 },
  ph: { unit: '(-)', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0 },
  pc: { unit: 'g', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0 },
  h2o: { unit: 'L/h', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0 },
  silice: { unit: '%', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0 },
  grains: { unit: '%', avgOn: true, trendOn: false, deltaY: 0, trendWindowMs: 0 },
};

export const ChartParamsProvider: React.FC<{ children: React.ReactNode }>=({ children }) => {
  const [params, setParamsState] = useState<ChartParamsState>(defaultParams);
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


