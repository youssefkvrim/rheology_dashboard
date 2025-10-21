import React, { useMemo, useState } from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, ErrorBar, ReferenceLine, ReferenceDot } from 'recharts';

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
  trendSegPct?: number; // 10..100 segmentation percentage across X axis
};

export function MetricPanel(p: MetricPanelProps) {
  const [hoverTs, setHoverTs] = useState<number | null>(null);
  function niceStep(span: number): number {
    if (!isFinite(span) || span <= 0) return 1;
    const k = Math.floor(Math.log10(span));
    const base = Math.pow(10, k);
    const n = span / base;
    const f = n >= 5 ? 5 : n >= 2 ? 2 : 1; // 1–2–5 progression
    return f * base;
  }

  function formatTick(value: number): string {
    const nearInt = Math.abs(value - Math.round(value)) < 1e-4 ? Math.round(value) : value;
    const s = Number.isFinite(nearInt) ? nearInt.toFixed(4) : String(nearInt);
    return s.replace(/\.0+$/,'').replace(/(\.[0-9]*?[1-9])0+$/,'$1');
  }

  // Compute X domain, ticks count and label formatter based on time span
  const xAxisConfig = useMemo(() => {
    if (!p.data.length) {
      return { domain: ['auto','auto'] as any, ticks: undefined as any, segments: 10, format: (ts: number) => '' };
    }
    let tMin = p.data[0].t, tMax = p.data[0].t;
    for (const d of p.data) { if (d.t < tMin) tMin = d.t; if (d.t > tMax) tMax = d.t; }
    if (!(tMax > tMin)) tMax = tMin + 1;
    const spanMs = tMax - tMin;
    const hour = 3600_000; const day = 24*hour; const month30 = 30*day; const month90 = 90*day; const year365 = 365*day;
    let segments = 10;
    let formatter: (ts:number)=>string;
    if (spanMs <= 48*hour) {
      // 3H / 1D / <2D custom
      segments = 10;
      formatter = (ts:number) => {
        const d = new Date(ts);
        return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
      };
    } else if (spanMs <= 8*day) {
      // 7D
      segments = 7;
      formatter = (ts:number) => {
        const d = new Date(ts);
        const wd = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d).replace('.', '').toLowerCase();
        const dd = d.getDate().toString().padStart(2,'0');
        return `${wd} ${dd}`;
      };
    } else if (spanMs <= 45*day) {
      // 1M
      segments = 10;
      formatter = (ts:number) => {
        const d = new Date(ts);
        const wd = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d).replace('.', '').toLowerCase();
        const dd = d.getDate().toString().padStart(2,'0');
        return `${wd} ${dd}`;
      };
    } else if (spanMs <= month90) {
      // 3M
      segments = 10;
      formatter = (ts:number) => {
        const d = new Date(ts);
        const dd = d.getDate().toString().padStart(2,'0');
        const mm = (d.getMonth()+1).toString().padStart(2,'0');
        return `${dd}/${mm}`;
      };
    } else if (spanMs <= year365) {
      // 1Y
      segments = 12;
      formatter = (ts:number) => {
        const d = new Date(ts);
        const m = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(d).replace('.', '').toUpperCase();
        return m;
      };
    } else {
      // ALL or >1Y
      segments = 10;
      formatter = (ts:number) => {
        const d = new Date(ts);
        const m = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(d).replace('.', '').toUpperCase();
        const y = d.getFullYear();
        return `${m} ${y}`;
      };
    }
    // Ticks: exactly `segments+1` equally spaced labels including start and end
    const ticksAll: number[] = [];
    const spacing = (tMax - tMin) / segments;
    for (let i = 0; i <= segments; i++) {
      ticksAll.push(Math.round(tMin + spacing * i));
    }
    return { domain: [tMin, tMax] as any, ticks: ticksAll, segments, format: formatter };
  }, [p.data]);
  // Tooltip: enforce order Date -> Moyenne -> Valeur by configuring names and relying on Recharts order
  // Order: Date -> Valeur -> Moyenne; ensure value series is rendered BEFORE avg series so tooltip lists value first
  const tooltipFormatter = useMemo(() => {
    return (val: any, name: any) => {
      const v = typeof val === 'number' ? formatTick(val) : String(val);
      if (name === 'Moyenne' || name === 'avg') return [`${v} ${p.unitLabel}`.trim(), 'Moyenne'];
      return [`${v} ${p.unitLabel}`.trim(), p.title];
    };
  }, [p.title, p.unitLabel]);
  const labelFormatter = useMemo(() => (v:any)=> new Date(Number(v)).toLocaleString(), []);

  // Segmented trend line (black dashed), segment width as percentage of X range
  const { trendPolyline, trendMeta } = useMemo(() => {
    const empty = { trendPolyline: null as null | Array<{ t:number; trend:number }>, trendMeta: [] as Array<{ start:number; end:number; m:number }> };
    if (!p.trendOn || p.data.length < 2) return empty;
    const nowMax = p.data[p.data.length - 1].t;
    const windowStart = p.trendWindowMs ? nowMax - p.trendWindowMs : p.data[0].t;
    const series = p.data.filter(d => d.t >= windowStart);
    if (series.length < 2) return empty;
    const t0 = series[0].t; const t1 = series[series.length - 1].t;
    const pct = Math.max(1, Math.min(100, p.trendSegPct ?? 100));
    if (pct >= 100) {
      // Single regression across window
      const n = series.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      for (const d of series) { const x = d.t; const y = d.v; sumX += x; sumY += y; sumXY += x*y; sumXX += x*x; }
      const denom = (n * sumXX - sumX * sumX) || 1;
      const m = (n * sumXY - sumX * sumY) / denom;
      const b = (sumY - m * sumX) / n;
      return { trendPolyline: [ { t: t0, trend: m * t0 + b }, { t: t1, trend: m * t1 + b } ], trendMeta: [{ start: t0, end: t1, m }] };
    }
    const total = Math.max(1, t1 - t0);
    const segWidth = Math.max(1, Math.floor((pct / 100) * total));
    const poly: Array<{ t:number; trend:number }> = [];
    const meta: Array<{ start:number; end:number; m:number }> = [];
    for (let s = t0; s < t1; s += segWidth) {
      const e = Math.min(t1, s + segWidth);
      const part = series.filter(d => d.t >= s && d.t <= e);
      if (part.length < 2) continue;
      const n = part.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      for (const d of part) { const x = d.t; const y = d.v; sumX += x; sumY += y; sumXY += x*y; sumXX += x*x; }
      const denom = (n * sumXX - sumX * sumX) || 1;
      const m = (n * sumXY - sumX * sumY) / denom;
      const b = (sumY - m * sumX) / n;
      poly.push({ t: s, trend: m * s + b }, { t: e, trend: m * e + b });
      meta.push({ start: s, end: e, m });
    }
    return { trendPolyline: poly.length ? poly : null, trendMeta: meta };
  }, [p.trendOn, p.data, p.trendWindowMs, p.trendSegPct]);

  // Trend segments for interpolation at hover timestamp
  const trendSegments = useMemo(() => {
    if (!trendPolyline || !(trendPolyline as any[]).length) return [] as Array<{ start:number; end:number; y0:number; y1:number }>;
    const arr = trendPolyline as Array<{ t:number; trend:number }>;
    const segs: Array<{ start:number; end:number; y0:number; y1:number }> = [];
    for (let i = 1; i < arr.length; i += 2) {
      const a = arr[i-1]; const b = arr[i];
      if (a && b && b.t !== a.t) segs.push({ start: a.t, end: b.t, y0: a.trend, y1: b.trend });
    }
    return segs;
  }, [trendPolyline]);

  const trendHoverY = useMemo(() => {
    if (!p.trendOn || hoverTs == null || !trendSegments.length) return null as number | null;
    const ts = hoverTs as number;
    let seg = trendSegments.find(s => ts >= s.start && ts <= s.end);
    if (!seg) seg = ts < trendSegments[0].start ? trendSegments[0] : trendSegments[trendSegments.length - 1];
    const span = Math.max(1, seg.end - seg.start);
    const ratio = Math.max(0, Math.min(1, (ts - seg.start) / span));
    return seg.y0 + (seg.y1 - seg.y0) * ratio;
  }, [p.trendOn, hoverTs, trendSegments]);

  // Downsample indices for error bars: ticks + midpoints mapped to nearest data indices
  const errorBarIndexSet = useMemo(() => {
    if (!p.deltaY || !p.data.length) return new Set<number>();
    const ticks: number[] = (xAxisConfig.ticks as number[]) || [];
    const domain = xAxisConfig.domain as [number, number];
    const seg = xAxisConfig.segments || Math.max(1, ticks.length - 1);
    const spacing = (domain[1] - domain[0]) / seg;
    const targets: number[] = [];
    // midpoints between tick i and i+1 (there are seg midpoints)
    for (let i = 0; i < seg; i++) targets.push(Math.round(domain[0] + spacing * (i + 0.5)));
    // include all tick positions (there are seg+1 ticks)
    targets.push(...ticks);
    const times = p.data.map(d => d.t);
    const indexSet = new Set<number>();
    const pickClosestIndex = (ts:number) => {
      let bestIdx = 0; let bestDiff = Math.abs(times[0] - ts);
      for (let i = 1; i < times.length; i++) { const diff = Math.abs(times[i] - ts); if (diff < bestDiff) { bestDiff = diff; bestIdx = i; } }
      return bestIdx;
    };
    for (const ts of targets) { const idx = pickClosestIndex(ts); indexSet.add(idx); }
    return indexSet;
  }, [p.deltaY, p.data, xAxisConfig]);

  const withErrors = useMemo(() => {
    if (!p.deltaY) return p.data;
    return p.data.map((d, i) => (
      errorBarIndexSet.has(i) ? { ...d, errorY: [p.deltaY as number, p.deltaY as number] } : { ...d, errorY: undefined as any }
    ));
  }, [p.data, p.deltaY, errorBarIndexSet]);

  // Compute effective bounds for rendering without mutating inputs: if only one side provided, fill missing side virtually
  const effectiveBounds = useMemo(() => {
    if (!p.bounds) return undefined;
    const low = p.bounds.low;
    const high = p.bounds.high;
    if (low == null && high == null) return undefined;
    const dataMin0 = p.data.length ? p.data.reduce((m, d) => (d.v < m ? d.v : m), p.data[0].v) : 0;
    const dataMax = p.data.length ? p.data.reduce((m, d) => (d.v > m ? d.v : m), p.data[0].v) : 1;
    const dataMin = Math.max(0, dataMin0); // clamp negatives to 0
    const span = Math.max(1e-12, dataMax - dataMin);
    const step = niceStep(span);
    const baseLo = Math.max(0, Math.floor(dataMin / step) * step - step);
    const baseHi = Math.ceil(dataMax / step) * step + step;
    const effLow = low == null ? baseLo : Math.max(Math.max(0, low), baseLo);
    const effHigh = high == null ? baseHi : Math.min(high, baseHi);
    if (!(effHigh > effLow)) return undefined;
    return { low: effLow, high: effHigh };
  }, [p.bounds, p.data]);

  // Ensure the Y axis domain includes any user-provided bound(s)
  const computedYDomain = useMemo(() => {
    const dataMin0 = p.data.length ? p.data.reduce((m, d) => (d.v < m ? d.v : m), p.data[0].v) : 0;
    const dataMax = p.data.length ? p.data.reduce((m, d) => (d.v > m ? d.v : m), p.data[0].v) : 1;
    const dataMin = Math.max(0, dataMin0); // clamp negatives to 0
    const span = Math.max(1e-12, dataMax - dataMin);
    const step = niceStep(span);
    let lo = Math.max(0, Math.floor(dataMin / step) * step - step);
    let hi = Math.ceil(dataMax / step) * step + step;
    if (!(hi > lo)) { const eps = Math.max(1e-6, Math.abs(lo) * 1e-6 + 1e-6); hi = lo + eps; }
    return [lo, hi] as [number, number];
  }, [p.data]);

  // Custom tooltip: ensure we show the primary value point, not the trend point
  const customTooltip = useMemo(() => {
    return (info: any) => {
      const { active, payload, label } = info || {};
      if (!active || !payload || !payload.length) return null;
      const ts = Number(label ?? payload[0]?.payload?.t ?? 0);
      let trendLabel = '';
      if (p.trendOn && trendMeta && trendMeta.length) {
        const seg = trendMeta.find(s => ts >= s.start && ts <= s.end) || trendMeta[trendMeta.length - 1];
        if (seg) {
          if (seg.m > 0) trendLabel = 'Tendance : Haussière';
          else if (seg.m < 0) trendLabel = 'Tendance : Baissière';
          else trendLabel = 'Tendance : Horizontale';
        }
      }
      const dateStr = new Date(ts).toLocaleString();
      const valueEntry = payload.find((e:any)=> e && e.dataKey === 'v');
      const p0 = valueEntry?.payload || payload[0]?.payload;
      const valueStr = p0 && typeof p0.v === 'number' ? `${p.title} : ${formatTick(p0.v)} ${p.unitLabel}`.trim() : '';
      const avgStr = (p.avgOn && p0 && typeof p0.avg === 'number') ? `Moyenne : ${formatTick(p0.avg)} ${p.unitLabel}`.trim() : '';
      return (
        <div className="recharts-default-tooltip" style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: 8 }}>
          <div>{dateStr}</div>
          {valueStr && <div style={{ color: p.color || '#22c55e' }}>{valueStr}</div>}
          {avgStr && <div style={{ color: '#ef4444' }}>{avgStr}</div>}
          {trendLabel && <div style={{ color: '#111827' }}>{trendLabel}</div>}
        </div>
      );
    };
  }, [p.title, p.unitLabel, p.color, trendMeta, p.avgOn, p.trendOn]);

  return (
    <div className="chart" style={{ height: 260 }}>
      <ResponsiveContainer>
        <LineChart data={withErrors} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} onMouseMove={(e:any)=>{
          try {
            const ts = Number(e?.activeLabel ?? e?.label ?? e?.payload?.[0]?.payload?.t ?? null);
            setHoverTs(Number.isFinite(ts) ? ts : null);
          } catch { setHoverTs(null); }
        }} onMouseLeave={()=> setHoverTs(null)}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" verticalCoordinatesGenerator={(gp:any)=>{
            try {
              if (!p.data.length) return [] as number[];
              const scale = gp?.xAxis?.scale;
              const xs: number[] = [];
              for (const ts of (xAxisConfig.ticks as number[])) {
                const ratio = (ts - (xAxisConfig.domain as any)[0]) / Math.max(1, (xAxisConfig.domain as any)[1] - (xAxisConfig.domain as any)[0]);
                const x = typeof scale === 'function' ? scale(ts) : (gp?.x ?? 0) + ((gp?.width ?? 0) * ratio);
                xs.push(x);
              }
              return xs;
            } catch { return [] as number[]; }
          }} />
          <XAxis dataKey="t" type="number" scale="time" domain={xAxisConfig.domain} allowDataOverflow={false} interval={0} ticks={xAxisConfig.ticks as any} stroke="#6b7280" tickFormatter={(ts:any)=> xAxisConfig.format(Number(ts))} />
          <YAxis stroke="#6b7280" domain={computedYDomain as any} tickFormatter={(v:any)=>formatTick(Number(v))} />
          <Tooltip content={customTooltip as any} trigger="hover" shared={true} />
          {effectiveBounds && (
            (() => {
              const y1 = effectiveBounds.low as number; const y2 = effectiveBounds.high as number;
              const singleBound = !!p.bounds && ((p.bounds.low == null) !== (p.bounds.high == null));
              if (singleBound || p.critPct == null) {
                return <ReferenceArea y1={y1} y2={y2} fill="#22c55e" fillOpacity={0.12} />;
              }
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
          <Line type="monotone" dataKey="v" name={p.title} stroke={p.color || "#22c55e"} dot={false} activeDot={{ r: 4, fill: p.color || "#22c55e", stroke: "#ffffff", strokeWidth: 2 }} strokeWidth={2}>
            {p.deltaY ? <ErrorBar dataKey="errorY" width={2} stroke="#a8a29e" /> : null}
          </Line>
          {p.avgOn && <Line type="monotone" dataKey="avg" name="Moyenne" stroke="#ef4444" dot={false} strokeDasharray="4 4" isAnimationActive={false} />}
          {trendPolyline && (
            (trendPolyline as any[]).map((pt:any, idx:number, arr:any[]) => (
              idx % 2 === 1 ? (
                <ReferenceLine
                  key={`trend-${idx}`}
                  segment={[{ x: arr[idx-1].t, y: arr[idx-1].trend }, { x: pt.t, y: pt.trend }]}
                  stroke="#111827"
                  strokeDasharray="10 6"
                />
              ) : null
            ))
          )}
          {(p.trendOn && hoverTs != null && trendHoverY != null) ? (
            <ReferenceDot x={hoverTs as any} y={trendHoverY as any} r={4} fill="#111827" stroke="#ffffff" strokeWidth={1} />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}


