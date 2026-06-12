import { useRef, useState } from 'react';
import { ResponsiveContainer } from 'recharts';
import { MetricPanel } from './MetricPanel';
import { ParamsModal } from './ParamsModal';

// all the time range options u can pick from on a chart
type RangeKey = '3h' | '1d' | '7d' | '1m' | '3m' | '6m' | '1y' | '3y' | 'all' | 'specific';
const ALL_RANGES: RangeKey[] = ['3h', '1d', '7d', '1m', '3m', '6m', '1y', '3y', 'all'];
// what shows up on the buttons
const RANGE_LABELS: Record<RangeKey, string> = {
  '3h': '3H', '1d': '1D', '7d': '7D', '1m': '1M', '3m': '3M', '6m': '6M', '1y': '1Y', '3y': '3Y', 'all': 'ALL', 'specific': 'Custom'
};
// how many milliseconds each range actually covers
const RANGE_MS: Record<RangeKey, number> = {
  '3h': 3 * 3600e3, '1d': 24 * 3600e3, '7d': 7 * 24 * 3600e3, '1m': 30 * 24 * 3600e3,
  '3m': 90 * 24 * 3600e3, '6m': 180 * 24 * 3600e3, '1y': 365 * 24 * 3600e3, '3y': 3 * 365 * 24 * 3600e3,
  'all': Infinity, 'specific': 0,
};

// basically everything a chart panel needs to work
export interface ChartPanelProps {
  // saves which time range u picked so it stays after refresh
  storageKey: string;
  title: string;
  color: string;
  unitLabel: string;
  unitOptions: string[];
  setUnit: (u: string) => void;
  data: { t: number; v: number; avg?: number }[];
  bounds?: { low: number | null; high: number | null };
  setBoundsLow: (n: number | null) => void;
  setBoundsHigh: (n: number | null) => void;
  // chart overlay stuff (average line, trend line, etc)
  avgOn: boolean;
  setAvgOn: (v: boolean) => void;
  trendOn: boolean;
  setTrendOn: (v: boolean) => void;
  trendSegPct?: number;
  setTrendSegPct?: (n: number) => void;
  deltaY?: number;
  setDeltaY?: (n: number) => void;
  trendWindowMs?: number;
  // the yellow warning zones near the edges of bounds
  critOn: boolean;
  setCritOn: (v: boolean) => void;
  critPct: number;
  setCritPct: (n: number) => void;
  // lets u drag and scroll the chart around
  panZoom?: boolean;
  yDomainDefault?: [number, number];
  // custom date range picker state
  specificStart: string;
  specificEnd: string;
  setSpecificStart: (v: string) => void;
  setSpecificEnd: (v: string) => void;
  // which time range button is active rn
  rangeKey: RangeKey;
  setRangeKey: (r: RangeKey) => void;
}

export function ChartPanel(props: ChartPanelProps) {
  const {
    storageKey, title, color, unitLabel, unitOptions, setUnit,
    data, bounds, setBoundsLow, setBoundsHigh,
    avgOn, setAvgOn, trendOn, setTrendOn, trendSegPct, setTrendSegPct,
    deltaY, setDeltaY, trendWindowMs,
    critOn, setCritOn, critPct, setCritPct,
    panZoom, yDomainDefault,
    specificStart, specificEnd, setSpecificStart, setSpecificEnd,
    rangeKey, setRangeKey,
  } = props;

  const [showMenu, setShowMenu] = useState(false);
  // drag-to-pan stuff, only matters when panZoom is on
  const [anchor, setAnchor] = useState<number | undefined>(undefined);
  const [yDomain, setYDomain] = useState<[number, number]>(yDomainDefault || [0, 100]);
  // keeps track of where u started dragging from
  const dragRef = useRef<{ startX: number; startY: number; startAnchor: number; startYMin: number; startYMax: number; mode: 'x' | 'y' | null } | null>(null);

  const chart = (
    <MetricPanel
      title={title}
      unitLabel={unitLabel}
      data={data}
      yDomain={panZoom ? yDomain : undefined}
      avgOn={avgOn}
      trendOn={trendOn}
      trendSegPct={trendSegPct}
      deltaY={deltaY}
      bounds={data.length ? bounds : undefined}
      critPct={critOn ? critPct : undefined}
      color={color}
      trendWindowMs={trendWindowMs}
      rangeKey={rangeKey}
    />
  );

  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>{title} ({unitLabel})</h3>
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <div className="segmented">
            {ALL_RANGES.map(r => (
              <button key={r} className={`seg-btn ${rangeKey === r ? 'active' : ''}`} onClick={() => {
                setRangeKey(r);
                localStorage.setItem(`range:${storageKey}`, r);
              }}>{RANGE_LABELS[r]}</button>
            ))}
            {/* the "..." button that opens chart settings */}
          <button className="seg-btn" title="Paramètres" onClick={() => setShowMenu(true)}>…</button>
          </div>
        </div>
      </div>
      {showMenu && (
        <ParamsModal
          title={`Paramètres ${title}`}
          specificStart={specificStart}
          specificEnd={specificEnd}
          setSpecificStart={setSpecificStart}
          setSpecificEnd={setSpecificEnd}
          onSetRangeSpecific={() => { setRangeKey('specific'); localStorage.setItem(`range:${storageKey}`, 'specific'); }}
          unit={unitLabel}
          unitOptions={unitOptions}
          setUnit={setUnit}
          avgOn={avgOn}
          setAvgOn={setAvgOn}
          trendOn={trendOn}
          setTrendOn={setTrendOn}
          trendSegPct={trendSegPct}
          setTrendSegPct={setTrendSegPct}
          deltaY={deltaY ?? 0}
          setDeltaY={setDeltaY ?? (() => {})}
          low={bounds?.low ?? null}
          high={bounds?.high ?? null}
          setLow={setBoundsLow}
          setHigh={setBoundsHigh}
          critOn={critOn}
          setCritOn={setCritOn}
          critPct={critPct}
          setCritPct={setCritPct}
          onClose={() => setShowMenu(false)}
        />
      )}
      <div className="chart">
        {panZoom ? (
          <>
            {/* invisible layer on top of the chart that catches all ur drags and scrolls */}
            <div
              className="pan-layer"
              onMouseDown={(e) => {
                const lastT = data[data.length - 1]?.t ?? Date.now();
                dragRef.current = { startX: e.clientX, startY: e.clientY, startAnchor: anchor ?? lastT, startYMin: yDomain[0], startYMax: yDomain[1], mode: null };
                (e.currentTarget as HTMLDivElement).classList.add('dragging');
              }}
              onMouseMove={(e) => {
                if (!dragRef.current) return;
                const dx = e.clientX - dragRef.current.startX;
                const dy = e.clientY - dragRef.current.startY;
                // figures out if ur dragging sideways (time) or up/down (value)
                if (!dragRef.current.mode) dragRef.current.mode = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
                if (dragRef.current.mode === 'x') {
                  const windowMs = RANGE_MS[rangeKey] || 3600e3;
                  const scale = windowMs / (e.currentTarget.clientWidth || 1);
                  setAnchor(dragRef.current.startAnchor + dx * scale);
                } else {
                  const [min0, max0] = [dragRef.current.startYMin, dragRef.current.startYMax];
                  const range = max0 - min0;
                  const perPx = range / (e.currentTarget.clientHeight || 1);
                  setYDomain([Number((min0 + dy * perPx).toFixed(3)), Number((max0 + dy * perPx).toFixed(3))]);
                }
              }}
              onMouseUp={(e) => { dragRef.current = null; (e.currentTarget as HTMLDivElement).classList.remove('dragging'); }}
              onMouseLeave={(e) => { dragRef.current = null; (e.currentTarget as HTMLDivElement).classList.remove('dragging'); }}
              onWheel={(e) => {
                // scroll up = zoom in, scroll down = zoom out on the Y axis
                const factor = e.deltaY > 0 ? 1.15 : 0.87;
                const [min0, max0] = yDomain;
                const mid = (min0 + max0) / 2;
                const halfRange = ((max0 - min0) / 2) * factor;
                setYDomain([Number((mid - halfRange).toFixed(3)), Number((mid + halfRange).toFixed(3))]);
                e.preventDefault();
              }}
              // same drag logic but for phones/tablets
              onTouchStart={(e) => {
                const t = e.touches[0];
                const lastT = data[data.length - 1]?.t ?? Date.now();
                dragRef.current = { startX: t.clientX, startY: t.clientY, startAnchor: anchor ?? lastT, startYMin: yDomain[0], startYMax: yDomain[1], mode: null };
                (e.currentTarget as HTMLDivElement).classList.add('dragging');
              }}
              onTouchMove={(e) => {
                if (!dragRef.current) return;
                const t = e.touches[0];
                const dx = t.clientX - dragRef.current.startX;
                const dy = t.clientY - dragRef.current.startY;
                if (!dragRef.current.mode) dragRef.current.mode = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
                if (dragRef.current.mode === 'x') {
                  const windowMs = RANGE_MS[rangeKey] || 3600e3;
                  const scale = windowMs / ((e.currentTarget as HTMLDivElement).clientWidth || 1);
                  setAnchor(dragRef.current.startAnchor + dx * scale);
                } else {
                  const [min0, max0] = [dragRef.current.startYMin, dragRef.current.startYMax];
                  const range = max0 - min0;
                  const perPx = range / ((e.currentTarget as HTMLDivElement).clientHeight || 1);
                  setYDomain([Number((min0 + dy * perPx).toFixed(3)), Number((max0 + dy * perPx).toFixed(3))]);
                }
              }}
              onTouchEnd={(e) => { dragRef.current = null; (e.currentTarget as HTMLDivElement).classList.remove('dragging'); }}
            />
            {chart}
          </>
        ) : (
          <ResponsiveContainer>
            {chart}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
