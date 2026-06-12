import React, { useMemo, useRef, useState } from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, ErrorBar, ReferenceLine, ReferenceDot } from 'recharts';

// the actual chart that draws the lines, zones, trends etc
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
  trendWindowMs?: number; // only look at recent data for the trend line
  trendSegPct?: number; // how much of the x axis each trend chunk covers
  rangeKey?: '3h' | '1d' | '7d' | '1m' | '3m' | '6m' | '1y' | '3y' | 'all' | 'specific';
  // shows a dot that follows ur mouse along the line
  interpOn?: boolean;
  interpMode?: 'linear' | 'lagrange3';
};

export function MetricPanel(p: MetricPanelProps) {
  const [hoverTs, setHoverTs] = useState<number | null>(null);
  // stores chart geometry so we can convert mouse position to timestamps
  const xRectRef = useRef<{ x:number; width:number } | null>(null);
  const xDomainRef = useRef<[number, number] | null>(null);
  const xScaleRef = useRef<any>(null);

  // picks nice round numbers for Y axis ticks (like 1, 2, 5, 10, 20, 50...)
  function niceStep(span: number): number {
    if (!isFinite(span) || span <= 0) return 1;
    const k = Math.floor(Math.log10(span));
    const base = Math.pow(10, k);
    const n = span / base;
    const f = n >= 5 ? 5 : n >= 2 ? 2 : 1;
    return f * base;
  }

  // makes numbers look clean on the axis (no ugly trailing zeros)
  function formatTick(value: number): string {
    const nearInt = Math.abs(value - Math.round(value)) < 1e-4 ? Math.round(value) : value;
    const s = Number.isFinite(nearInt) ? nearInt.toFixed(4) : String(nearInt);
    return s.replace(/\.0+$/,'').replace(/(\.[0-9]*?[1-9])0+$/,'$1');
  }

  // guesses a value between two data points using a straight line
  function interpolateLinear(ts: number): number | null {
    const arr = p.data;
    if (!arr || arr.length === 0) return null;
    if (arr.length === 1) return typeof arr[0].v === 'number' ? arr[0].v : null;
    if (ts <= arr[0].t) return arr[0].v;
    if (ts >= arr[arr.length - 1].t) return arr[arr.length - 1].v;
    // binary search to find which two points we're between
    let lo = 0, hi = arr.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].t <= ts) lo = mid; else hi = mid;
    }
    const a = arr[lo];
    const b = arr[hi];
    const span = Math.max(1, b.t - a.t);
    const ratio = Math.max(0, Math.min(1, (ts - a.t) / span));
    return a.v + (b.v - a.v) * ratio;
  }

  // fancier interpolation using 3 nearby points (smoother curves basically)
  function interpolateLagrange3(ts: number): number | null {
    const arr = p.data;
    if (!arr || arr.length === 0) return null;
    if (arr.length < 3) return interpolateLinear(ts);
    // find the closest data point to where ur hovering
    let idx = 0; let best = Math.abs(arr[0].t - ts);
    for (let i = 1; i < arr.length; i++) {
      const diff = Math.abs(arr[i].t - ts);
      if (diff < best) { best = diff; idx = i; }
    }
    const i0 = Math.max(0, Math.min(arr.length - 3, idx - 1));
    const pts = [arr[i0], arr[i0 + 1], arr[i0 + 2]];
    const x0 = pts[0].t, y0 = pts[0].v;
    const x1 = pts[1].t, y1 = pts[1].v;
    const x2 = pts[2].t, y2 = pts[2].v;
    // ngl this math is just polynomial interpolation, dont worry about it
    const denom0 = (x0 - x1) * (x0 - x2) || 1;
    const denom1 = (x1 - x0) * (x1 - x2) || 1;
    const denom2 = (x2 - x0) * (x2 - x1) || 1;
    const L0 = ((ts - x1) * (ts - x2)) / denom0;
    const L1 = ((ts - x0) * (ts - x2)) / denom1;
    const L2 = ((ts - x0) * (ts - x1)) / denom2;
    const y = y0 * L0 + y1 * L1 + y2 * L2;
    return Number.isFinite(y) ? y : null;
  }

  // picks which interpolation method to use
  function interpolateAt(ts: number, mode?: 'lagrange3' | 'linear'): number | null {
    if (mode === 'lagrange3') return interpolateLagrange3(ts);
    return interpolateLinear(ts);
  }

  // figures out how to label the X axis depending on the time range
  const xAxisConfig = useMemo(() => {
    if (!p.data.length) {
      return { domain: ['auto','auto'] as any, ticks: undefined as any, segments: 10, format: (ts: number) => '' };
    }
    let tMin = p.data[0].t, tMax = p.data[0].t;
    for (const d of p.data) { if (d.t < tMin) tMin = d.t; if (d.t > tMax) tMax = d.t; }
    if (!(tMax > tMin)) tMax = tMin + 1;
    const spanMs = tMax - tMin;

    const hour = 3600_000; const day = 24*hour; const month30 = 30*day; const year365 = 365*day;

    // decides the format based on how wide the time window is
    const decideBySpan = (ms: number) => {
      if (ms < day) {
        // less than a day? show hours:minutes
        return { segments: 10, format: (ts:number) => {
          const d = new Date(ts); return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        }};
      } else if (ms < month30) {
        // less than a month? show day names
        return { segments: 10, format: (ts:number) => {
          const d = new Date(ts);
          const wd = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d).replace('.', '').toLowerCase();
          const dd = d.getDate().toString().padStart(2,'0');
          return `${wd} ${dd}`;
        }};
      } else if (ms < 11*month30 + 5*day) {
        // less than ~11 months? show dd/mm
        return { segments: 10, format: (ts:number) => {
          const d = new Date(ts);
          const dd = d.getDate().toString().padStart(2,'0');
          const mm = (d.getMonth()+1).toString().padStart(2,'0');
          return `${dd}/${mm}`;
        }};
      } else {
        // over a year? just show month names
        return { segments: 12, format: (ts:number) => {
          const d = new Date(ts);
          const m = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(d).replace('.', '');
          return m.slice(0,3).toUpperCase();
        }};
      }
    };

    let segments = 10;
    let formatter: (ts:number)=>string;

    // if we know which range button was clicked, use that to pick format
    if (p.rangeKey && p.rangeKey !== 'specific') {
      const key = p.rangeKey;
      if (key === '3h' || key === '1d') {
        segments = 10;
        formatter = (ts:number) => { const d = new Date(ts); return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`; };
      } else if (key === '7d' || key === '1m') {
        segments = key === '7d' ? 7 : 10;
        formatter = (ts:number) => {
          const d = new Date(ts);
          const wd = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d).replace('.', '').toLowerCase();
          const dd = d.getDate().toString().padStart(2,'0');
          return `${wd} ${dd}`;
        };
      } else if (key === '3m') {
        segments = 10;
        formatter = (ts:number) => { const d = new Date(ts); const dd = d.getDate().toString().padStart(2,'0'); const mm = (d.getMonth()+1).toString().padStart(2,'0'); return `${dd}/${mm}`; };
      } else if (key === 'all') {
        segments = 12;
        formatter = (ts:number) => { const d = new Date(ts); const m = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(d).replace('.', ''); return m.slice(0,3).toUpperCase(); };
      } else {
        const decided = decideBySpan(spanMs);
        segments = decided.segments; formatter = decided.format;
      }
    } else {
      // custom range or no hint, just guess from the data span
      const decided = decideBySpan(spanMs);
      segments = decided.segments; formatter = decided.format;
    }

    // spread tick marks evenly across the time axis
    const ticksAll: number[] = [];
    const spacing = (tMax - tMin) / segments;
    for (let i = 0; i <= segments; i++) {
      ticksAll.push(Math.round(tMin + spacing * i));
    }
    return { domain: [tMin, tMax] as any, ticks: ticksAll, segments, format: formatter };
  }, [p.data, p.rangeKey]);

  // formats the tooltip text (what shows up when u hover over a point)
  const tooltipFormatter = useMemo(() => {
    return (val: any, name: any) => {
      const v = typeof val === 'number' ? formatTick(val) : String(val);
      if (name === 'Moyenne' || name === 'avg') return [`${v} ${p.unitLabel}`.trim(), 'Moyenne'];
      return [`${v} ${p.unitLabel}`.trim(), p.title];
    };
  }, [p.title, p.unitLabel]);
  const labelFormatter = useMemo(() => (v:any)=> new Date(Number(v)).toLocaleString(), []);

  // calculates the trend line (the dashed black line that shows if things are going up or down)
  const { trendPolyline, trendMeta } = useMemo(() => {
    const empty = { trendPolyline: null as null | Array<{ t:number; trend:number }>, trendMeta: [] as Array<{ start:number; end:number; m:number }> };
    if (!p.trendOn || p.data.length < 2) return empty;
    const nowMax = p.data[p.data.length - 1].t;
    // only look at data within the trend window if one is set
    const windowStart = p.trendWindowMs ? nowMax - p.trendWindowMs : p.data[0].t;
    const series = p.data.filter(d => d.t >= windowStart);
    if (series.length < 2) return empty;
    const t0 = series[0].t; const t1 = series[series.length - 1].t;
    const pct = Math.max(1, Math.min(100, p.trendSegPct ?? 100));
    if (pct >= 100) {
      // one big trend line across everything (least squares regression tbh)
      const n = series.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      for (const d of series) { const x = d.t; const y = d.v; sumX += x; sumY += y; sumXY += x*y; sumXX += x*x; }
      const denom = (n * sumXX - sumX * sumX) || 1;
      const m = (n * sumXY - sumX * sumY) / denom;
      const b = (sumY - m * sumX) / n;
      return { trendPolyline: [ { t: t0, trend: m * t0 + b }, { t: t1, trend: m * t1 + b } ], trendMeta: [{ start: t0, end: t1, m }] };
    }
    // chops the data into segments and draws a mini trend line for each one
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

  // pairs up the trend line points so we can find the trend value at any timestamp
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

  // gets the trend line Y value at wherever ur mouse is
  const trendHoverY = useMemo(() => {
    if (!p.trendOn || hoverTs == null || !trendSegments.length) return null as number | null;
    const ts = hoverTs as number;
    let seg = trendSegments.find(s => ts >= s.start && ts <= s.end);
    if (!seg) seg = ts < trendSegments[0].start ? trendSegments[0] : trendSegments[trendSegments.length - 1];
    const span = Math.max(1, seg.end - seg.start);
    const ratio = Math.max(0, Math.min(1, (ts - seg.start) / span));
    return seg.y0 + (seg.y1 - seg.y0) * ratio;
  }, [p.trendOn, hoverTs, trendSegments]);

  // the interpolated value dot that follows ur cursor
  const valueHoverY = useMemo(() => {
    if (!p.interpOn || hoverTs == null) return null as number | null;
    return interpolateAt(hoverTs as number, p.interpMode || 'linear');
  }, [hoverTs, p.data, p.interpOn, p.interpMode]);

  // only shows error bars at tick marks so the chart doesn't look insanely cluttered
  const errorBarIndexSet = useMemo(() => {
    if (!p.deltaY || !p.data.length) return new Set<number>();
    const ticks: number[] = (xAxisConfig.ticks as number[]) || [];
    const domain = xAxisConfig.domain as [number, number];
    const seg = xAxisConfig.segments || Math.max(1, ticks.length - 1);
    const spacing = (domain[1] - domain[0]) / seg;
    const targets: number[] = [];
    for (let i = 0; i < seg; i++) targets.push(Math.round(domain[0] + spacing * (i + 0.5)));
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

  // attaches the error bar values to only the selected data points
  const withErrors = useMemo(() => {
    if (!p.deltaY) return p.data;
    return p.data.map((d, i) => (
      errorBarIndexSet.has(i) ? { ...d, errorY: [p.deltaY as number, p.deltaY as number] } : { ...d, errorY: undefined as any }
    ));
  }, [p.data, p.deltaY, errorBarIndexSet]);

  // figures out the green/yellow zone boundaries for the chart background
  const effectiveBounds = useMemo(() => {
    if (!p.bounds) return undefined;
    const low = p.bounds.low;
    const high = p.bounds.high;
    if (low == null && high == null) return undefined;
    const dataMin0 = p.data.length ? p.data.reduce((m, d) => (d.v < m ? d.v : m), p.data[0].v) : 0;
    const dataMax = p.data.length ? p.data.reduce((m, d) => (d.v > m ? d.v : m), p.data[0].v) : 1;
    const dataMin = Math.max(0, dataMin0);
    const span = Math.max(1e-12, dataMax - dataMin);
    const step = niceStep(span);
    const baseLo = Math.max(0, Math.floor(dataMin / step) * step - step);
    const baseHi = Math.ceil(dataMax / step) * step + step;
    // use actual bounds if set, otherwise fall back to something reasonable
    const effLow = low != null ? low : baseLo;
    const effHigh = high != null ? high : baseHi;
    if (!(effHigh > effLow)) return undefined;
    return { low: effLow, high: effHigh };
  }, [p.bounds, p.data]);

  // makes sure the Y axis is tall enough to show the bounds zones properly
  const computedYDomain = useMemo(() => {
    const hasData = !!(p.data && p.data.length);
    const rawMin = hasData ? p.data.reduce((m, d) => (d.v < m ? d.v : m), p.data[0].v) : (p.bounds?.low ?? 0);
    const rawMax = hasData ? p.data.reduce((m, d) => (d.v > m ? d.v : m), p.data[0].v) : (p.bounds?.high ?? ((p.bounds?.low ?? 0) + 1));
    let dataMin = rawMin;
    let dataMax = rawMax;
    if (!(dataMax > dataMin)) dataMax = dataMin + 1e-6;

    let loCandidate = dataMin;
    let hiCandidate = dataMax;

    // stretch the axis to always include the full bounds range
    if (p.bounds) {
      if (p.bounds.low != null) {
        loCandidate = Math.min(loCandidate, p.bounds.low as number);
      }
      if (p.bounds.high != null) {
        hiCandidate = Math.max(hiCandidate, p.bounds.high as number);
      }
    }

    const span = Math.max(1e-12, hiCandidate - loCandidate);
    const step = niceStep(span);
    const margin = step * 0.3;
    let lo = Math.floor(loCandidate / step) * step - margin;
    let hi = Math.ceil(hiCandidate / step) * step + margin;
    if (!(hi > lo)) { const eps = Math.max(1e-6, Math.abs(lo) * 1e-6 + 1e-6); hi = lo + eps; }

    // dont go below zero if everything is positive
    const allNonNegative = (
      (hasData ? p.data.every(d => d.v >= 0) : true) &&
      (p.bounds?.low == null || (p.bounds.low as number) >= 0) &&
      (p.bounds?.high == null || (p.bounds.high as number) >= 0)
    );
    if (allNonNegative && lo < 0) lo = 0;

    return [lo, hi] as [number, number];
  }, [p.data, p.bounds]);

  // custom tooltip that shows up when u hover over the chart
  const customTooltip = useMemo(() => {
    return (info: any) => {
      const { active, payload, label } = info || {};
      if (!active || !payload || !payload.length) return null;
      const ts = p.interpOn && hoverTs != null ? (hoverTs as number) : Number(label ?? payload[0]?.payload?.t ?? 0);
      // tells u if the trend is going up, down, or sideways
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
      if (p.interpOn) {
        const vy = interpolateAt(ts, p.interpMode || 'linear');
        const valueStr = vy != null ? `${p.title} : ${formatTick(vy)} ${p.unitLabel}`.trim() : '';
        const avgStr = '';
        return (
          <div className="recharts-default-tooltip" style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: 8 }}>
            <div>{dateStr}</div>
            {valueStr && <div style={{ color: p.color || '#22c55e' }}>{valueStr}</div>}
            {trendLabel && <div style={{ color: '#111827' }}>{trendLabel}</div>}
          </div>
        );
      } else {
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
      }
    };
  }, [p.title, p.unitLabel, p.color, trendMeta, p.avgOn, p.trendOn, p.interpOn, p.interpMode, hoverTs]);

  return (
    <div className="chart" style={{ height: 260 }}>
      <ResponsiveContainer>
        <LineChart data={withErrors} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          onMouseMove={(e:any)=>{
            try {
              const chartX = Number(e?.chartX);
              let ts: number | null = null;
              // converts pixel position to actual timestamp using the chart's scale
              if (Number.isFinite(chartX) && xRectRef.current && xDomainRef.current) {
                const rect = xRectRef.current; const domain = xDomainRef.current; const scale = xScaleRef.current;
                if (scale && typeof (scale as any).invert === 'function') {
                  ts = Number((scale as any).invert(chartX));
                } else {
                  const ratio = Math.max(0, Math.min(1, (chartX - rect.x) / Math.max(1, rect.width)));
                  ts = domain[0] + ratio * (domain[1] - domain[0]);
                }
              }
              if (ts == null || !Number.isFinite(ts)) {
                ts = Number(e?.activeLabel ?? e?.label ?? e?.payload?.[0]?.payload?.t ?? null);
              }
              const tsv = Number.isFinite(ts) ? (ts as number) : null;
              if (tsv == null) { setHoverTs(null); return; }
              requestAnimationFrame(() => setHoverTs(tsv));
            } catch { setHoverTs(null); }
          }}
          onMouseLeave={()=> setHoverTs(null)}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" verticalCoordinatesGenerator={(gp:any)=>{
            try {
              if (!p.data.length) return [] as number[];
              const scale = gp?.xAxis?.scale;
              // sneakily grabs the chart dimensions here so we can use them for hover math
              try {
                xRectRef.current = { x: gp?.x ?? 0, width: gp?.width ?? 1 };
                xDomainRef.current = xAxisConfig.domain as [number, number];
                xScaleRef.current = scale || null;
              } catch {}
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
          <YAxis hide={!p.data.length} stroke="#6b7280" domain={computedYDomain as any} tickFormatter={(v:any)=>formatTick(Number(v))} />
          <Tooltip content={customTooltip as any} trigger="hover" shared={true} />
          {/* the colored background zones: green = safe, yellow = getting close to limits */}
          {effectiveBounds && (
            (() => {
              const y1 = effectiveBounds.low as number; const y2 = effectiveBounds.high as number;
              const singleBound = !!p.bounds && ((p.bounds.low == null) !== (p.bounds.high == null));
              if (singleBound || p.critPct == null) {
                return <ReferenceArea y1={y1} y2={y2} fill="#22c55e" fillOpacity={0.12} />;
              }
              // splits the zone into yellow-green-yellow based on the critical percentage
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
          {/* the main data line */}
          <Line type="monotone" dataKey="v" name={p.title} stroke={p.color || "#22c55e"} dot={false} activeDot={{ r: 4, fill: p.color || "#22c55e", stroke: "#ffffff", strokeWidth: 2 }} strokeWidth={2} isAnimationActive={false}>
            {p.deltaY ? <ErrorBar dataKey="errorY" width={2} stroke="#a8a29e" /> : null}
          </Line>
          {/* red dashed average line */}
          {p.avgOn && p.data.length === 1 && p.data[0].avg != null && (
            <ReferenceLine y={p.data[0].avg} stroke="#ef4444" strokeDasharray="4 4" />
          )}
          {p.avgOn && p.data.length > 1 && <Line type="monotone" dataKey="avg" name="Moyenne" stroke="#ef4444" dot={false} strokeDasharray="4 4" isAnimationActive={false} />}
          {/* black dashed trend line segments */}
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
          {/* dot that follows ur mouse on the trend line */}
          {(p.trendOn && hoverTs != null && trendHoverY != null) ? (
            <ReferenceDot x={hoverTs as any} y={trendHoverY as any} r={4} fill="#111827" stroke="#ffffff" strokeWidth={1} />
          ) : null}
          {/* dot that follows ur mouse on the data line */}
          {(p.interpOn && hoverTs != null && valueHoverY != null) ? (
            <ReferenceDot x={hoverTs as any} y={valueHoverY as any} r={4} fill={p.color || "#22c55e"} stroke="#ffffff" strokeWidth={1} />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
