import React, { useMemo } from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, ErrorBar } from 'recharts';

export type MetricPanelProps = {
  title: string;
  unitLabel: string;
  data: Array<{ t: number; v: number; avg?: number }>;
  yDomain?: [number, number];
  avgOn?: boolean;
  trendOn?: boolean;
  deltaY?: number;
  bounds?: { low: number | null; high: number | null };
  critPct?: number;
  color?: string;
  trendWindowMs?: number; // compute trend using only last window
};

export function MetricPanel(p: MetricPanelProps) {
  // Tooltip: enforce order Date -> Moyenne -> Valeur by configuring names and relying on Recharts order
  // Order: Date -> Valeur -> Moyenne; ensure value series is rendered BEFORE avg series so tooltip lists value first
  const tooltipFormatter = useMemo(() => {
    return (val: any, name: any) => {
      if (name === 'Moyenne' || name === 'avg') return [`${val} ${p.unitLabel}`.trim(), 'Moyenne'];
      return [`${val} ${p.unitLabel}`.trim(), p.title];
    };
  }, [p.title, p.unitLabel]);
  const labelFormatter = useMemo(() => (v:any)=> new Date(Number(v)).toLocaleString(), []);

  // Linear regression trend on the last trendWindowMs data (fallback: full data)
  const trendSeries = useMemo(() => {
    if (!p.trendOn || p.data.length < 2) return null;
    const nowMax = p.data[p.data.length - 1].t;
    const windowStart = p.trendWindowMs ? nowMax - p.trendWindowMs : p.data[0].t;
    const series = p.data.filter(d => d.t >= windowStart);
    if (series.length < 2) return null;
    const n = series.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (const d of series) { const x = d.t; const y = d.v; sumX += x; sumY += y; sumXY += x*y; sumXX += x*x; }
    const denom = (n * sumXX - sumX * sumX) || 1;
    const m = (n * sumXY - sumX * sumY) / denom;
    const b = (sumY - m * sumX) / n;
    const t0 = series[0].t; const t1 = series[series.length - 1].t;
    return [ { t: t0, v: m * t0 + b }, { t: t1, v: m * t1 + b } ];
  }, [p.trendOn, p.data, p.trendWindowMs]);

  const withErrors = useMemo(() => {
    if (!p.deltaY) return p.data;
    return p.data.map(d => ({ ...d, errorY: [p.deltaY, p.deltaY] }));
  }, [p.data, p.deltaY]);

  // Compute effective bounds for rendering without mutating inputs: if only one side provided, fill missing side virtually
  const effectiveBounds = useMemo(() => {
    if (!p.bounds) return undefined;
    const low = p.bounds.low;
    const high = p.bounds.high;
    if (low == null && high == null) return undefined;
    const effLow = low == null ? 0 : low;
    const effHigh = high == null ? 999.999 : high;
    return { low: effLow, high: effHigh };
  }, [p.bounds]);

  return (
    <div className="chart" style={{ height: 260 }}>
      <ResponsiveContainer>
        <LineChart data={withErrors} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
          <XAxis dataKey="t" type="number" scale="time" domain={['auto','auto']} stroke="#6b7280" tickFormatter={(ts:any)=>{
            const d = new Date(Number(ts)); return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
          }} />
          <YAxis stroke="#6b7280" domain={p.yDomain as any} />
          <Tooltip labelFormatter={labelFormatter} formatter={tooltipFormatter as any} />
          {effectiveBounds && p.critPct != null && (
            (() => {
              const y1 = effectiveBounds.low as number; const y2 = effectiveBounds.high as number;
              const h = y2 - y1; const m = Math.max(0, Math.min(100, p.critPct)) / 100;
              const lowH = h * (m/2); const midH = h * (1 - m); const topH = h * (m/2);
              return (
                <>
                  <ReferenceArea y1={y1} y2={y1 + lowH} fill="#fbbf24" fillOpacity={0.12} />
                  <ReferenceArea y1={y1 + lowH} y2={y1 + lowH + midH} fill="#22c55e" fillOpacity={0.12} />
                  <ReferenceArea y1={y2 - topH} y2={y2} fill="#fbbf24" fillOpacity={0.12} />
                </>
              );
            })()
          )}
          <Line type="monotone" dataKey="v" name={p.title} stroke={p.color || "#22c55e"} dot={false} strokeWidth={2}>
            {p.deltaY ? <ErrorBar dataKey="errorY" width={2} stroke="#a8a29e" /> : null}
          </Line>
          {p.avgOn && <Line type="monotone" dataKey="avg" name="Moyenne" stroke="#ef4444" dot={false} strokeDasharray="4 4" isAnimationActive={false} />}
          {trendSeries && <Line data={trendSeries as any} type="monotone" dataKey="v" name="Ligne de tendance" stroke="#ef4444" dot={false} strokeDasharray="10 6" isAnimationActive={false} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}


