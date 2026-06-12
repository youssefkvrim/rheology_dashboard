import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useBarbotineStore } from '../store/barbotineStore';
import { useBoundsStore } from '../store/boundsStore';
import { useDoseStore } from '../store/doseStore';
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useChartParams } from '../store/chartParams';
import { ChartPanel } from '../components/ChartPanel';
import { densConverters, viscConverters, tempConverters, h2oConverters, pcConverters } from '../utils/units';
import { fetchRheologyAll, ASSET_BASE } from '../services/api';
import { FRONTEND_TO_DB, toFeKey } from '../shared/metricKeys';

// all the time range options u can pick for zooming into charts
type RangeKey = '3h' | '1d' | '7d' | '1m' | '3m' | '6m' | '1y' | '3y' | 'all' | 'specific';
const RANGE_MS: Record<RangeKey, number> = {
  '3h': 3 * 3600e3, '1d': 24 * 3600e3, '7d': 7 * 24 * 3600e3, '1m': 30 * 24 * 3600e3,
  '3m': 90 * 24 * 3600e3, '6m': 180 * 24 * 3600e3, '1y': 365 * 24 * 3600e3, '3y': 3 * 365 * 24 * 3600e3,
  'all': Infinity, 'specific': 0,
};
const ALL_RANGES: RangeKey[] = ['3h', '1d', '7d', '1m', '3m', '6m', '1y', '3y', 'all'];
const RANGE_LABELS: Record<RangeKey, string> = {
  '3h': '3H', '1d': '1D', '7d': '7D', '1m': '1M', '3m': '3M', '6m': '6M', '1y': '1Y', '3y': '3Y', 'all': 'ALL', 'specific': 'Custom'
};

// where the AI analysis images live on the server
const ML_BASE = `${ASSET_BASE}/Plaque%20ML/output/2CN2_007_2_03-11-2025T100656+1`;

// this component shows all the AI stuff - the analyzed plate images + summary table
function AiAnalysis() {
  const [summary, setSummary] = useState<Record<string, string> | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // fetches the csv summary from the ML pipeline and parses it into a key-value object
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${ML_BASE}/summary.csv`, { cache: 'no-store' });
        if (!res.ok) return;
        const text = await res.text();
        const lines = text.trim().split(/\r?\n/);
        if (!lines.length) return;
        const headers = (lines[0] || '').split(',').map(s => s.trim());
        const vals = (lines[1] || '').split(',').map(s => s.trim());
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
        if (!cancelled) setSummary(obj);
      } catch { /* ngl dont care if this fails */ }
    })();
    return () => { cancelled = true; };
  }, []);
  // all the AI output images we wanna show in the grid
  const items = [
    { file: 'plate.png', title: 'Plaque (crop)', info: 'Image recadrée de la plaque' },
    { file: 'histogram.png', title: 'Histogramme', info: 'Histogramme des intensités' },
    { file: 'aggregates_overlay.png', title: 'Agrégats (overlay)', info: 'Superposition des zones agrégées' },
    { file: 'aggregates_mask.png', title: 'Agrégats (mask)', info: 'Masque binaire des agrégats' },
    { file: 'tears_overlay.png', title: 'Larmes (overlay)', info: 'Superposition des larmes' },
    { file: 'tears_mask.png', title: 'Larmes (mask)', info: 'Masque binaire des larmes' },
    { file: 'tears_heatmap.png', title: 'Larmes (heatmap)', info: 'Carte de chaleur des larmes' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0 }}>Détails IA</h4>
        <span className="muted">Prévisualisation test</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        {items.map((it, idx) => (
          <div key={it.file} className="panel" style={{ padding: 8, position: 'relative' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{it.title}</strong>
              <span onMouseEnter={() => setHoverIdx(idx)} onMouseLeave={() => setHoverIdx(v => (v === idx ? null : v))}
                style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 999, width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--muted)', cursor: 'default' }}>i
                {hoverIdx === idx && <div style={{ position: 'absolute', top: 22, right: 0, background: 'rgba(17,24,39,0.95)', color: '#f9fafb', padding: '6px 8px', fontSize: 12, borderRadius: 6, maxWidth: 260, zIndex: 30 }}>{it.info}</div>}
              </span>
            </div>
            <div style={{ marginTop: 8 }}>
              <img src={`${ML_BASE}/${it.file}`} alt={it.title} style={{ width: '100%', height: 'auto', borderRadius: 6, border: '1px solid var(--border)' }} />
            </div>
          </div>
        ))}
      </div>
      <div className="panel" style={{ padding: 8 }}>
        <strong>Résumé</strong>
        <div style={{ overflowX: 'auto', marginTop: 6 }}>
          <table className="table" style={{ width: '100%', fontSize: 12 }}>
            <tbody>
              {summary ? Object.entries(summary).map(([k, v]) => (
                <tr key={k}><td style={{ width: 260, color: 'var(--muted)' }}>{k}</td><td>{v}</td></tr>
              )) : <tr><td colSpan={2} className="muted">Résumé indisponible</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// turns a timestamp into just hours:minutes
function formatTime(ts: number) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}
function formatDateTime(ts: number) {
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

// the detail page for one specific slurry - all charts and controls live here
export default function Detail() {
  const { id } = useParams();
  const barbotines = useBarbotineStore(s => s.barbotines);
  const { bounds, getBoundsFor, setBoundsFor } = useBoundsStore();
  const { doseRateLph, setDoseRateLph, addCoverPowerResult, lastPlaqueSrc, setLastPlaqueSrc } = useDoseStore();
  const { getParamsFor, setParamsFor, params: globalParams } = useChartParams();

  // which time range each chart is zoomed to (saved in localstorage so it persists)
  const [densRange, setDensRange] = useState<RangeKey>(() => (localStorage.getItem(`range:${id}:densite`) as RangeKey) || 'all');
  const [viscRange, setViscRange] = useState<RangeKey>(() => (localStorage.getItem(`range:${id}:viscosite`) as RangeKey) || 'all');
  const [tempRange, setTempRange] = useState<RangeKey>(() => (localStorage.getItem(`range:${id}:temperature`) as RangeKey) || 'all');
  const [phRange, setPhRange] = useState<RangeKey>(() => (localStorage.getItem(`range:${id}:ph`) as RangeKey) || 'all');
  const [pcRange, setPcRange] = useState<RangeKey>(() => (localStorage.getItem(`range:${id}:pc`) as RangeKey) || 'all');
  const [h2oRange, setH2oRange] = useState<RangeKey>(() => (localStorage.getItem(`range:${id}:h2o`) as RangeKey) || 'all');
  const [siliceRange, setSiliceRange] = useState<RangeKey>(() => (localStorage.getItem(`range:${id}:silice`) as RangeKey) || '3m');
  const [grainsRange, setGrainsRange] = useState<RangeKey>(() => (localStorage.getItem(`range:${id}:grains`) as RangeKey) || '3m');

  // toggles for showing the yellow "warning zone" bands on each chart
  const [densCritOn, setDensCritOn] = useState(true); const [densCritPct, setDensCritPct] = useState(30);
  const [viscCritOn, setViscCritOn] = useState(true); const [viscCritPct, setViscCritPct] = useState(30);
  const [tempCritOn, setTempCritOn] = useState(true); const [tempCritPct, setTempCritPct] = useState(30);
  const [phCritOn, setPhCritOn] = useState(true); const [phCritPct, setPhCritPct] = useState(30);
  const [pcCritOn, setPcCritOn] = useState(true); const [pcCritPct, setPcCritPct] = useState(30);
  const [h2oCritOn, setH2oCritOn] = useState(true); const [h2oCritPct, setH2oCritPct] = useState(30);
  const [siliceCritOn, setSiliceCritOn] = useState(true); const [siliceCritPct, setSiliceCritPct] = useState(30);
  const [grainsCritOn, setGrainsCritOn] = useState(true); const [grainsCritPct, setGrainsCritPct] = useState(30);

  // custom date range that all charts share when u pick "specific"
  const [specificStart, setSpecificStart] = useState('');
  const [specificEnd, setSpecificEnd] = useState('');

  // all the state for the cover power test (the one with calibration, dipping, measuring)
  const [massSeries, setMassSeries] = useState<{ t: number; v: number }[] | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'calib' | 'trempe' | 'egouttage' | 'mesure' | 'termine'>('idle');
  const [remaining, setRemaining] = useState(0);
  const [imageModal, setImageModal] = useState<'photo' | 'ai' | null>(null);

  // water pump connection stuff
  const [pumpConnected] = useState(false);
  const [flowUnit, setFlowUnit] = useState<'L/h' | 'L/day'>('L/h');

  // all the data we pulled from the database for each metric
  const [dbSeries, setDbSeries] = useState<null | { densite: { t: number; v: number }[]; viscosite: { t: number; v: number }[]; ph: { t: number; v: number }[]; temperature: { t: number; v: number }[] }>(null);
  const [pcDb, setPcDb] = useState<null | { t: number; v: number }[]>(null);
  const [h2oDb, setH2oDb] = useState<null | { t: number; v: number }[]>(null);
  const [siliceDb, setSiliceDb] = useState<null | { t: number; v: number }[]>(null);
  const [grainsDb, setGrainsDb] = useState<null | { t: number; v: number }[]>(null);

  const current = useMemo(() => barbotines.find(b => b.id === id) || null, [barbotines, id]);
  const sid = (current && (current as any).slurryId) as string | undefined;
  const isOnline = !!current?.online;
  const scopedBounds = useMemo(() => getBoundsFor(id || ''), [getBoundsFor, id]);
  const scopedParams = useMemo(() => getParamsFor(id || ''), [getParamsFor, id]);
  const setScoped = (metric: any, patch: any) => setParamsFor(id || '', metric, patch);

  // grabs ALL data from the server for this slurry + updates bounds
  useEffect(() => {
    if (!sid) return;
    let cancelled = false;
    (async () => {
      try {
        const allDbKeys = Object.values(FRONTEND_TO_DB);
        const ranges = [densRange, viscRange, tempRange, phRange, pcRange, h2oRange, siliceRange, grainsRange];
        let startTs: number | undefined;
        let endTs: number | undefined;
        if (ranges.every(r => r !== 'all')) {
          const now = Date.now();
          const parsedStart = Date.parse(specificStart);
          const parsedEnd = Date.parse(specificEnd);
          const starts = ranges.map(r => {
            if (r === 'specific') return Number.isFinite(parsedStart) ? parsedStart : now - 3600e3;
            return now - (RANGE_MS[r] || 3600e3);
          });
          startTs = Math.min(...starts);
          endTs = ranges.includes('specific') && Number.isFinite(parsedEnd) ? parsedEnd : now;
        }
        const { series, bounds: fetchedBounds } = await fetchRheologyAll(sid, allDbKeys, true, startTs, endTs, 2000);
        if (cancelled) return;
        const toS = (d: any) => ({ t: Number(d.t), v: Number(d.v) });
        setDbSeries({
          densite: (series[FRONTEND_TO_DB.densite] || []).map(toS),
          viscosite: (series[FRONTEND_TO_DB.viscosite] || []).map(toS),
          ph: (series[FRONTEND_TO_DB.ph] || []).map(toS),
          temperature: (series[FRONTEND_TO_DB.temperature] || []).map(toS),
        });
        setPcDb((series[FRONTEND_TO_DB.pc] || []).map(toS));
        setH2oDb((series[FRONTEND_TO_DB.h2o] || []).map(toS));
        setSiliceDb((series[FRONTEND_TO_DB.silice] || []).map(toS));
        setGrainsDb((series[FRONTEND_TO_DB.grains] || []).map(toS));
        if (Array.isArray(fetchedBounds)) {
          fetchedBounds.forEach((b: any) => {
            const k = toFeKey(b.key);
            setBoundsFor(id || '', k as any, { low: (b.lsl ?? b.low) ?? null, high: (b.usl ?? b.high) ?? null });
          });
        }
      } catch { /* db probably down, oh well */ }
    })();
    return () => { cancelled = true; };
  }, [sid, id, densRange, viscRange, tempRange, phRange, pcRange, h2oRange, siliceRange, grainsRange, specificStart, specificEnd]);

  // parses the custom date inputs into timestamps
  const specStart = useMemo(() => { const s = Date.parse(specificStart); return Number.isFinite(s) ? s : Date.now() - 3600e3; }, [specificStart]);
  const specEnd = useMemo(() => { const e = Date.parse(specificEnd); return Number.isFinite(e) ? e : Date.now(); }, [specificEnd]);

  // filters data points to only show whats in the selected time range
  function filterByRange(arr: { t: number; v: number }[], range: RangeKey) {
    if (!arr || !arr.length) return [];
    const now = Date.now();
    if (range === 'all') return arr;
    if (range === 'specific') return arr.filter(p => p.t >= specStart && p.t <= specEnd);
    const ms = RANGE_MS[range] || 3600e3;
    const start = now - ms;
    return arr.filter(p => p.t >= start);
  }

  // takes raw data, filters by range, converts units, and adds an avg line
  function buildPanelData(source: { t: number; v: number }[] | null, range: RangeKey, conv?: { to: (v: number) => number }) {
    const raw = source ? filterByRange(source, range) : [];
    if (!raw.length) return [];
    const avg = raw.reduce((s, d) => s + d.v, 0) / raw.length;
    const to = conv?.to || ((v: number) => v);
    return raw.map(d => ({ t: d.t, v: to(d.v), avg: to(avg) }));
  }

  // converts values between units (like kg/m³ to g/cm³ etc)
  const densConv = useMemo(() => densConverters(scopedParams.densite.unit), [scopedParams.densite.unit]);
  const viscConv = useMemo(() => viscConverters(scopedParams.viscosite.unit), [scopedParams.viscosite.unit]);
  const tempConv = useMemo(() => tempConverters(scopedParams.temperature.unit), [scopedParams.temperature.unit]);
  const h2oConv = useMemo(() => h2oConverters(scopedParams.h2o.unit), [scopedParams.h2o.unit]);
  const pcConv = useMemo(() => pcConverters(scopedParams.pc.unit), [scopedParams.pc.unit]);

  // the actual processed data that gets fed into each chart
  const densPanelData = useMemo(() => buildPanelData(dbSeries?.densite || null, densRange, densConv), [dbSeries, densRange, densConv, specStart, specEnd]);
  const viscPanelData = useMemo(() => buildPanelData(dbSeries?.viscosite || null, viscRange, viscConv), [dbSeries, viscRange, viscConv, specStart, specEnd]);
  const tempPanelData = useMemo(() => buildPanelData(dbSeries?.temperature || null, tempRange, tempConv), [dbSeries, tempRange, tempConv, specStart, specEnd]);
  const phPanelData = useMemo(() => buildPanelData(dbSeries?.ph || null, phRange), [dbSeries, phRange, specStart, specEnd]);
  const pcPanelData = useMemo(() => buildPanelData(pcDb, pcRange, pcConv), [pcDb, pcRange, pcConv, specStart, specEnd]);
  const h2oPanelData = useMemo(() => buildPanelData(h2oDb, h2oRange, h2oConv), [h2oDb, h2oRange, h2oConv, specStart, specEnd]);
  const silicePanelData = useMemo(() => buildPanelData(siliceDb, siliceRange), [siliceDb, siliceRange, specStart, specEnd]);
  const grainsPanelData = useMemo(() => buildPanelData(grainsDb, grainsRange), [grainsDb, grainsRange, specStart, specEnd]);

  // converts the min/max limits to whatever unit the user picked
  const convBounds = (b: { low: number | null; high: number | null }, conv?: { to: (v: number) => number }) => {
    const to = conv?.to || ((v: number) => v);
    return { low: b.low == null ? null : to(b.low), high: b.high == null ? null : to(b.high) };
  };

  // figures out if we should recommend adjusting the water flow based on viscosity
  const viscositeData = useMemo(() => dbSeries ? filterByRange(dbSeries.viscosite, viscRange) : [], [dbSeries, viscRange, specStart, specEnd]);
  const proposedFlowLph = useMemo(() => {
    const lastV = viscositeData[viscositeData.length - 1]?.v;
    const b = scopedBounds.viscosite;
    if (lastV == null || (b.low == null && b.high == null)) return doseRateLph;
    if (b.high != null && lastV > (b.high as number)) return Number((doseRateLph + 0.005).toFixed(3));
    if (b.low != null && lastV < (b.low as number)) return Number((Math.max(0, doseRateLph - 0.005)).toFixed(3));
    return doseRateLph;
  }, [viscositeData, scopedBounds.viscosite, doseRateLph]);
  // quick helper to switch between liters/hour and liters/day
  const toUnit = (lph: number, unit: 'L/h' | 'L/day') => unit === 'L/h' ? lph : Number((lph * 24).toFixed(3));

  function mkTooltip(unit: string, label: string) {
    return (val: any, name: any) => [`${val} ${unit}`.trim(), name === 'Average' ? 'Average' : label];
  }

  // bundling up the custom date range stuff so we dont repeat it 8 times
  const specProps = { specificStart, specificEnd, setSpecificStart, setSpecificEnd };

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Barbotine {id}</h2>
      </div>

      {/* density + viscosity charts */}
      <div className="section" style={{ marginTop: 12 }}>
        <ChartPanel
          storageKey={`${id}:densite`} title="Densité" color="#60a5fa"
          unitLabel={scopedParams.densite.unit} unitOptions={["kg/m³", "g/cm³", "g/mL", "kg/L", "g/L", "mg/mL"]}
          setUnit={u => setScoped('densite', { unit: u })}
          data={densPanelData} bounds={convBounds(scopedBounds.densite, densConv)}
          setBoundsLow={n => setBoundsFor(id || '', 'densite', { ...scopedBounds.densite, low: n })}
          setBoundsHigh={n => setBoundsFor(id || '', 'densite', { ...scopedBounds.densite, high: n })}
          avgOn={scopedParams.densite.avgOn} setAvgOn={v => setScoped('densite', { avgOn: v })}
          trendOn={scopedParams.densite.trendOn} setTrendOn={v => setScoped('densite', { trendOn: v })}
          trendSegPct={scopedParams.densite.trendSegPct} setTrendSegPct={n => setScoped('densite', { trendSegPct: n })}
          deltaY={scopedParams.densite.deltaY} setDeltaY={n => setScoped('densite', { deltaY: n })}
          trendWindowMs={scopedParams.densite.trendWindowMs}
          critOn={densCritOn} setCritOn={setDensCritOn} critPct={densCritPct} setCritPct={setDensCritPct}
          panZoom yDomainDefault={[1.2, 1.5]}
          rangeKey={densRange} setRangeKey={setDensRange} {...specProps}
        />
        <ChartPanel
          storageKey={`${id}:viscosite`} title="Viscosité" color="#34d399"
          unitLabel={scopedParams.viscosite.unit} unitOptions={["Pa·s", "mPa·s", "cP", "P", "St", "cSt", "s"]}
          setUnit={u => setScoped('viscosite', { unit: u })}
          data={viscPanelData} bounds={convBounds(scopedBounds.viscosite, viscConv)}
          setBoundsLow={n => setBoundsFor(id || '', 'viscosite', { ...scopedBounds.viscosite, low: n })}
          setBoundsHigh={n => setBoundsFor(id || '', 'viscosite', { ...scopedBounds.viscosite, high: n })}
          avgOn={scopedParams.viscosite.avgOn} setAvgOn={v => setScoped('viscosite', { avgOn: v })}
          trendOn={scopedParams.viscosite.trendOn} setTrendOn={v => setScoped('viscosite', { trendOn: v })}
          trendSegPct={scopedParams.viscosite.trendSegPct} setTrendSegPct={n => setScoped('viscosite', { trendSegPct: n })}
          deltaY={scopedParams.viscosite.deltaY} setDeltaY={n => setScoped('viscosite', { deltaY: n })}
          trendWindowMs={scopedParams.viscosite.trendWindowMs}
          critOn={viscCritOn} setCritOn={setViscCritOn} critPct={viscCritPct} setCritPct={setViscCritPct}
          panZoom yDomainDefault={[250, 700]}
          rangeKey={viscRange} setRangeKey={setViscRange} {...specProps}
        />
      </div>

      {/* cover power history chart + the live test panel */}
      <div className="section" style={{ marginTop: 12 }}>
        <ChartPanel
          storageKey={`${id}:pc`} title="Pouvoir couvrant - Historique" color="#38bdf8"
          unitLabel={scopedParams.pc.unit} unitOptions={["g", "g/cm²"]}
          setUnit={u => setScoped('pc', { unit: u })}
          data={pcPanelData} bounds={convBounds(scopedBounds.pc ?? { low: null, high: null }, pcConv)}
          setBoundsLow={n => setBoundsFor(id || '', 'pc', { ...(scopedBounds.pc ?? { low: null, high: null }), low: n })}
          setBoundsHigh={n => setBoundsFor(id || '', 'pc', { ...(scopedBounds.pc ?? { low: null, high: null }), high: n })}
          avgOn={scopedParams.pc.avgOn} setAvgOn={v => setScoped('pc', { avgOn: v })}
          trendOn={scopedParams.pc.trendOn} setTrendOn={v => setScoped('pc', { trendOn: v })}
          trendSegPct={scopedParams.pc.trendSegPct} setTrendSegPct={n => setScoped('pc', { trendSegPct: n })}
          deltaY={scopedParams.pc.deltaY} setDeltaY={n => setScoped('pc', { deltaY: n })}
          trendWindowMs={scopedParams.pc.trendWindowMs}
          critOn={pcCritOn} setCritOn={setPcCritOn} critPct={pcCritPct} setCritPct={setPcCritPct}
          rangeKey={pcRange} setRangeKey={setPcRange} {...specProps}
        />
        {/* the panel where u actually run a cover power test */}
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Pouvoir couvrant - Essai (g)</h3>
            <div className="segmented">
              {(testState === 'idle' || testState === 'termine') ? (
                <button className="seg-btn primary" style={{ height: 29 }} onClick={() => {
                  setCheckingBalance(true);
                  setTimeout(() => {
                    setCheckingBalance(false);
                    // timing for each phase: 5s calibrate, 10s dip, 120s measure
                    const tCalib = 5000; const tTrempe = 10000; const tMesure = 120000;
                    const totalMs = tCalib + tTrempe + tMesure;
                    setTestState('calib'); setRemaining(Math.ceil(totalMs / 1000)); setMassSeries(null);
                    const startedAt = Date.now();
                    let localSeries: { t: number; v: number }[] = [];
                    const interval = setInterval(() => {
                      const elapsed = Date.now() - startedAt;
                      setRemaining(Math.max(0, Math.ceil((totalMs - elapsed) / 1000)));
                      if (elapsed < tCalib) setTestState('calib');
                      else if (elapsed < tCalib + tTrempe) setTestState('trempe');
                      else if (elapsed < totalMs) {
                        setTestState('mesure');
                        const tSec = (elapsed - (tCalib + tTrempe)) / 1000;
                        // fake weight data - exponential decay with some noise to look realistic
                        const value = Math.max(0, 120 * Math.exp(-tSec / 45) + (Math.random() * 2 - 1) * 0.6);
                        localSeries.push({ t: startedAt + elapsed, v: Number(value.toFixed(2)) });
                        if (localSeries.length % 3 === 0) setMassSeries([...localSeries]);
                      }
                      if (elapsed >= totalMs) {
                        clearInterval(interval); setTestState('termine'); setMassSeries([...localSeries]);
                        if (localSeries.length) { addCoverPowerResult(localSeries[localSeries.length - 1].v); setLastPlaqueSrc(`${ASSET_BASE}/plaque-pickup.jpg`); }
                      }
                    }, 500);
                  }, 2000);
                }}>
                  {checkingBalance ? 'Vérification balance…' : 'Lancer essai'}
                </button>
              ) : (
                <span className="seg-btn" style={{ cursor: 'default', height: 29, display: 'inline-flex', alignItems: 'center' }}>
                  {testState === 'calib' ? `Calibration - ${remaining}s` : testState === 'trempe' ? `Trempé - ${remaining}s` : `Mesure - ${remaining}s`}
                </span>
              )}
            </div>
          </div>
          <div className="chart">
            <ResponsiveContainer>
              <LineChart data={(() => {
                const arr = (massSeries ?? []).map(p => ({ time: p.t, value: p.v }));
                const avg = arr.length ? Number((arr.reduce((s, d) => s + d.value, 0) / arr.length).toFixed(2)) : null;
                return arr.map(d => ({ ...d, avg: avg ?? undefined }));
              })()} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                <XAxis dataKey="time" type="number" scale="time" domain={["auto", "auto"]} tickFormatter={formatTime} stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip labelFormatter={v => formatDateTime(Number(v))} formatter={mkTooltip('g', 'Masse')} />
                <Line type="monotone" dataKey="value" name="Masse" stroke="#38bdf8" dot={false} strokeWidth={2} isAnimationActive={false} />
                {(massSeries ?? []).length > 0 && <Line type="monotone" dataKey="avg" name="Average" stroke="#ef4444" dot={false} strokeDasharray="5 5" strokeWidth={1} isAnimationActive={false} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* shows the plate photo and AI analysis after the test is done */}
      {testState === 'termine' && (
        <div className="section" style={{ marginTop: 12 }}>
          <div className="panel">
            <h3>Photo de plaque</h3>
            <div className="chart" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 320, height: 320, cursor: 'zoom-in' }} onClick={() => setImageModal('photo')}>
                <img src={lastPlaqueSrc || `${ASSET_BASE}/plaque-pickup.jpg`} alt="Plaque essai" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
              </div>
            </div>
          </div>
          <div className="panel">
            <h3>Analyse IA</h3>
            <div className="chart" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 320, height: 320, cursor: 'zoom-in' }} onClick={() => setImageModal('ai')}>
                <img src={`${ASSET_BASE}/plaque-pickup_analysed.webp`} alt="Plaque analysée" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
              </div>
            </div>
          </div>
        </div>
      )}
      {imageModal && (
        <div className="modal-backdrop" onClick={() => setImageModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '70vw', height: '70vh', maxWidth: 1400, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{imageModal === 'photo' ? 'Photo de plaque' : 'Analyse IA'}</h3>
              <button onClick={() => setImageModal(null)}>Fermer</button>
            </div>
            {imageModal === 'photo' ? (
              <div className="modal-body" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
                <img src={lastPlaqueSrc || `${ASSET_BASE}/plaque-pickup.jpg`} alt="Plaque" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
              </div>
            ) : (
              <div className="modal-body" style={{ flex: 1, overflow: 'auto' }}><AiAnalysis /></div>
            )}
          </div>
        </div>
      )}

      {/* temperature + pH charts */}
      <div className="section" style={{ marginTop: 12 }}>
        <ChartPanel
          storageKey={`${id}:temperature`} title="Température" color="#f59e0b"
          unitLabel={scopedParams.temperature.unit} unitOptions={["°C", "°F", "K"]}
          setUnit={u => setScoped('temperature', { unit: u })}
          data={tempPanelData} bounds={convBounds(scopedBounds.temperature, tempConv)}
          setBoundsLow={n => setBoundsFor(id || '', 'temperature', { ...scopedBounds.temperature, low: n })}
          setBoundsHigh={n => setBoundsFor(id || '', 'temperature', { ...scopedBounds.temperature, high: n })}
          avgOn={scopedParams.temperature.avgOn} setAvgOn={v => setScoped('temperature', { avgOn: v })}
          trendOn={scopedParams.temperature.trendOn} setTrendOn={v => setScoped('temperature', { trendOn: v })}
          trendSegPct={scopedParams.temperature.trendSegPct} setTrendSegPct={n => setScoped('temperature', { trendSegPct: n })}
          deltaY={scopedParams.temperature.deltaY} setDeltaY={n => setScoped('temperature', { deltaY: n })}
          trendWindowMs={scopedParams.temperature.trendWindowMs}
          critOn={tempCritOn} setCritOn={setTempCritOn} critPct={tempCritPct} setCritPct={setTempCritPct}
          panZoom yDomainDefault={[15, 35]}
          rangeKey={tempRange} setRangeKey={setTempRange} {...specProps}
        />
        <ChartPanel
          storageKey={`${id}:ph`} title="pH" color="#8b5cf6"
          unitLabel={scopedParams.ph.unit} unitOptions={["(-)"]}
          setUnit={u => setScoped('ph', { unit: u })}
          data={phPanelData} bounds={{ low: scopedBounds.ph.low, high: scopedBounds.ph.high }}
          setBoundsLow={n => setBoundsFor(id || '', 'ph', { ...scopedBounds.ph, low: n })}
          setBoundsHigh={n => setBoundsFor(id || '', 'ph', { ...scopedBounds.ph, high: n })}
          avgOn={scopedParams.ph.avgOn} setAvgOn={v => setScoped('ph', { avgOn: v })}
          trendOn={scopedParams.ph.trendOn} setTrendOn={v => setScoped('ph', { trendOn: v })}
          trendSegPct={scopedParams.ph.trendSegPct} setTrendSegPct={n => setScoped('ph', { trendSegPct: n })}
          deltaY={scopedParams.ph.deltaY} setDeltaY={n => setScoped('ph', { deltaY: n })}
          trendWindowMs={scopedParams.ph.trendWindowMs}
          critOn={phCritOn} setCritOn={setPhCritOn} critPct={phCritPct} setCritPct={setPhCritPct}
          panZoom yDomainDefault={[6.5, 9.8]}
          rangeKey={phRange} setRangeKey={setPhRange} {...specProps}
        />
      </div>

      {/* water flow history + pump control panel */}
      <div className="section" style={{ marginTop: 12 }}>
        <ChartPanel
          storageKey={`${id}:h2o`} title="Débit H₂O — Historique" color="#3b82f6"
          unitLabel={scopedParams.h2o.unit} unitOptions={["L/h", "L/day", "mL/min", "mL/s"]}
          setUnit={u => setScoped('h2o', { unit: u })}
          data={h2oPanelData} bounds={convBounds(scopedBounds.h2o, h2oConv)}
          setBoundsLow={n => setBoundsFor(id || '', 'h2o', { ...scopedBounds.h2o, low: n })}
          setBoundsHigh={n => setBoundsFor(id || '', 'h2o', { ...scopedBounds.h2o, high: n })}
          avgOn={scopedParams.h2o.avgOn} setAvgOn={v => setScoped('h2o', { avgOn: v })}
          trendOn={scopedParams.h2o.trendOn} setTrendOn={v => setScoped('h2o', { trendOn: v })}
          trendSegPct={scopedParams.h2o.trendSegPct} setTrendSegPct={n => setScoped('h2o', { trendSegPct: n })}
          deltaY={scopedParams.h2o.deltaY} setDeltaY={n => setScoped('h2o', { deltaY: n })}
          trendWindowMs={scopedParams.h2o.trendWindowMs}
          critOn={h2oCritOn} setCritOn={setH2oCritOn} critPct={h2oCritPct} setCritPct={setH2oCritPct}
          rangeKey={h2oRange} setRangeKey={setH2oRange} {...specProps}
        />
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Contrôle doseuse H₂O</h3>
            <span className={`badge ${pumpConnected ? 'ok' : 'err'}`}>{pumpConnected ? 'Connectée' : 'Non connectée'}</span>
          </div>
          <div className="chart" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'grid', gap: 12, minWidth: 420, textAlign: 'center' }}>
              <div className="row" style={{ justifyContent: 'space-around' }}>
                <div>
                  <div className="muted">Débit actuel</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{toUnit(doseRateLph, flowUnit).toFixed(3)} <span style={{ cursor: 'pointer' }} onClick={() => setFlowUnit(u => u === 'L/h' ? 'L/day' : 'L/h')}>{flowUnit}</span></div>
                </div>
                <div>
                  <div className="muted">Débit proposé</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{toUnit(proposedFlowLph, flowUnit).toFixed(3)} <span style={{ cursor: 'pointer' }} onClick={() => setFlowUnit(u => u === 'L/h' ? 'L/day' : 'L/h')}>{flowUnit}</span></div>
                </div>
              </div>
              <div className="row" style={{ justifyContent: 'center', gap: 8, alignItems: 'center' }}>
                <label>Commande manuelle</label>
                <input style={{ width: 160 }} type="number" step="0.001" value={doseRateLph} onChange={e => setDoseRateLph(Math.max(0, Number(e.target.value)))} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* silica + grain charts */}
      <div className="section" style={{ marginTop: 12 }}>
        <ChartPanel
          storageKey={`${id}:silice`} title="Silice" color="#a78bfa"
          unitLabel={scopedParams.silice.unit} unitOptions={["%"]}
          setUnit={u => setScoped('silice', { unit: u })}
          data={silicePanelData} bounds={{ low: scopedBounds.silice?.low ?? null, high: scopedBounds.silice?.high ?? null }}
          setBoundsLow={n => setBoundsFor(id || '', 'silice', { ...scopedBounds.silice, low: n })}
          setBoundsHigh={n => setBoundsFor(id || '', 'silice', { ...scopedBounds.silice, high: n })}
          avgOn={scopedParams.silice.avgOn} setAvgOn={v => setScoped('silice', { avgOn: v })}
          trendOn={scopedParams.silice.trendOn} setTrendOn={v => setScoped('silice', { trendOn: v })}
          deltaY={scopedParams.silice.deltaY} setDeltaY={n => setScoped('silice', { deltaY: n })}
          trendWindowMs={scopedParams.silice.trendWindowMs}
          critOn={siliceCritOn} setCritOn={setSiliceCritOn} critPct={siliceCritPct} setCritPct={setSiliceCritPct}
          rangeKey={siliceRange} setRangeKey={setSiliceRange} {...specProps}
        />
        <ChartPanel
          storageKey={`${id}:grains`} title="Grains" color="#60a5fa"
          unitLabel={scopedParams.grains.unit} unitOptions={["%"]}
          setUnit={u => setScoped('grains', { unit: u })}
          data={grainsPanelData} bounds={{ low: scopedBounds.grains?.low ?? null, high: scopedBounds.grains?.high ?? null }}
          setBoundsLow={n => setBoundsFor(id || '', 'grains', { ...scopedBounds.grains, low: n })}
          setBoundsHigh={n => setBoundsFor(id || '', 'grains', { ...scopedBounds.grains, high: n })}
          avgOn={scopedParams.grains.avgOn} setAvgOn={v => setScoped('grains', { avgOn: v })}
          trendOn={scopedParams.grains.trendOn} setTrendOn={v => setScoped('grains', { trendOn: v })}
          deltaY={scopedParams.grains.deltaY} setDeltaY={n => setScoped('grains', { deltaY: n })}
          trendWindowMs={scopedParams.grains.trendWindowMs}
          critOn={grainsCritOn} setCritOn={setGrainsCritOn} critPct={grainsCritPct} setCritPct={setGrainsCritPct}
          rangeKey={grainsRange} setRangeKey={setGrainsRange} {...specProps}
        />
      </div>
    </div>
  );
}
