import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppState } from '../store/appState';
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine } from 'recharts';
import { useChartParams } from '../store/chartParams';
import { ParamsModal } from '../components/ParamsModal';
import { MetricPanel } from '../components/MetricPanel';
import { densConverters, viscConverters, tempConverters, h2oConverters, pcConverters } from '../utils/units';
import { fetchRheologyAll } from '../services/api';

function formatTime(ts: number) {
  const d = new Date(ts); return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}
function formatDateTime(ts: number) {
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

function parseLocaleNumber(input: string): number | null | typeof NaN {
  const s = (input ?? '').trim();
  if (!s) return null;
  const dot = (s.match(/\./g) || []).length;
  const comma = (s.match(/,/g) || []).length;
  if (dot + comma > 1) return NaN; // multiple separators
  if (dot === 1 && comma === 1) return NaN; // both used
  const normalized = s.replace(',', '.');
  if (!/^[-+]?\d*(?:\.\d*)?$/.test(normalized)) return NaN;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function niceCeilMax(maxVal: number, step: number): number {
  if (!Number.isFinite(maxVal)) return step;
  return Math.ceil(maxVal / step) * step;
}

export default function Detail() {
  const { id } = useParams();
  const { seriesM7, bounds, setBounds, startMassTest, overrideLog, addOverride, addManualSample, live, setLive, getSeriesForRange, getSeriesBetween, doseRateLph, setDoseRateLph, coverPowerHistory, addCoverPowerResult, lastPlaqueSrc, setLastPlaqueSrc, doseRateHistory, barbotines, getBoundsFor, setBoundsFor } = useAppState();
  const { params, setParams, getParamsFor, setParamsFor } = useChartParams();
  const [massSeries, setMassSeries] = useState<{ t: number; v: number }[] | null>(null);
  const [testState, setTestState] = useState<'idle' | 'calib' | 'trempe' | 'egouttage' | 'mesure' | 'termine'>('idle');
  const [remaining, setRemaining] = useState<number>(0);
  const [overrideText, setOverrideText] = useState('');
  const [overrideJustif, setOverrideJustif] = useState('');
  const [manual, setManual] = useState<{ densite?: string; viscosite?: string; ph?: string; temperature?: string }>({});
  const [densRange, setDensRange] = useState<'all' | '3h' | '1d' | '7d' | '1m' | '3m' | 'specific'>(()=> (localStorage.getItem(`range:${id}:densite`) as any) || 'all');
  const [viscRange, setViscRange] = useState<'all' | '3h' | '1d' | '7d' | '1m' | '3m' | 'specific'>(()=> (localStorage.getItem(`range:${id}:viscosite`) as any) || 'all');
  const [tempRange, setTempRange] = useState<'all' | '3h' | '1d' | '7d' | '1m' | '3m' | 'specific'>(()=> (localStorage.getItem(`range:${id}:temperature`) as any) || 'all');
  const [phRange, setPhRange] = useState<'all' | '3h' | '1d' | '7d' | '1m' | '3m' | 'specific'>(()=> (localStorage.getItem(`range:${id}:ph`) as any) || 'all');
  // anchors for horizontal pan per chart
  const [densAnchor, setDensAnchor] = useState<number | undefined>(undefined);
  const [viscAnchor, setViscAnchor] = useState<number | undefined>(undefined);
  const [tempAnchor, setTempAnchor] = useState<number | undefined>(undefined);
  const [phAnchor, setPhAnchor] = useState<number | undefined>(undefined);
  // vertical y domains adjustable by drag on Y axis area
  const [densY, setDensY] = useState<[number, number]>([1.2, 1.5]);
  const [viscY, setViscY] = useState<[number, number]>([250, 700]);
  const [tempY, setTempY] = useState<[number, number]>([15, 35]);
  const [phY, setPhY] = useState<[number, number]>([6.5, 9.8]);
  // drag state
  const dragRef = useRef<{ startX: number; startY: number; startAnchor: number; startYMin: number; startYMax: number; mode: 'x' | 'y' | null } | null>(null);
  const [pcRange, setPcRange] = useState<'7d' | '1m' | '3m' | 'all' | 'specific'>(()=> (localStorage.getItem(`range:${id}:pc`) as any) || 'all');
  const [pcBounds, setPcBounds] = useState<{ low: number | null; high: number | null }>(() => ({ low: bounds.pc?.low ?? null, high: bounds.pc?.high ?? null }));
  const [imageModal, setImageModal] = useState<'photo' | 'ai' | null>(null);
  const [imgScale, setImgScale] = useState<number>(1);
  const imgWrapRef = useRef<HTMLDivElement | null>(null);
  const [specificStart, setSpecificStart] = useState<string>('');
  const [specificEnd, setSpecificEnd] = useState<string>('');
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [densAvgOn, setDensAvgOn] = useState<boolean>(true);
  const [viscAvgOn, setViscAvgOn] = useState<boolean>(true);
  const [tempAvgOn, setTempAvgOn] = useState<boolean>(true);
  const [phAvgOn, setPhAvgOn] = useState<boolean>(true);
  const [pcAvgOn, setPcAvgOn] = useState<boolean>(true);
  const [h2oAvgOn, setH2oAvgOn] = useState<boolean>(true);
  const [h2oCritOn, setH2oCritOn] = useState<boolean>(true);
  const [h2oCritPct, setH2oCritPct] = useState<number>(30);
  const [h2oRange, setH2oRange] = useState<'3h'|'1d'|'7d'|'1m'|'3m'|'all'|'specific'>(()=> (localStorage.getItem(`range:${id}:h2o`) as any) || 'all');
  const [h2oBounds, setH2oBounds] = useState<{ low: number | null; high: number | null }>(() => ({ low: bounds.h2o.low, high: bounds.h2o.high }));
  // critical zones settings (pre-activated at 30%)
  const [densCritOn, setDensCritOn] = useState<boolean>(true);
  const [densCritPct, setDensCritPct] = useState<number>(30);
  const [viscCritOn, setViscCritOn] = useState<boolean>(true);
  const [viscCritPct, setViscCritPct] = useState<number>(30);
  const [tempCritOn, setTempCritOn] = useState<boolean>(true);
  const [tempCritPct, setTempCritPct] = useState<number>(30);
  const [phCritOn, setPhCritOn] = useState<boolean>(true);
  const [phCritPct, setPhCritPct] = useState<number>(30);
  const [pcCritOn, setPcCritOn] = useState<boolean>(true);
  const [pcCritPct, setPcCritPct] = useState<number>(30);

  // Extra panels: Silice and Grains
  const [siliceRange, setSiliceRange] = useState<'all'|'3h'|'1d'|'7d'|'1m'|'3m'|'specific'>(()=> (localStorage.getItem(`range:${id}:silice`) as any) || '3m');
  const [grainsRange, setGrainsRange] = useState<'all'|'3h'|'1d'|'7d'|'1m'|'3m'|'specific'>(()=> (localStorage.getItem(`range:${id}:grains`) as any) || '3m');
  const [siliceBounds, setSiliceBounds] = useState<{ low: number | null; high: number | null }>(() => ({ low: bounds.silice.low, high: bounds.silice.high }));
  const [grainsBounds, setGrainsBounds] = useState<{ low: number | null; high: number | null }>(() => ({ low: bounds.grains.low, high: bounds.grains.high }));
  const [siliceAvgOn, setSiliceAvgOn] = useState<boolean>(true);
  const [grainsAvgOn, setGrainsAvgOn] = useState<boolean>(true);
  const [siliceCritOn, setSiliceCritOn] = useState<boolean>(true);
  const [siliceCritPct, setSiliceCritPct] = useState<number>(30);
  const [grainsCritOn, setGrainsCritOn] = useState<boolean>(true);
  const [grainsCritPct, setGrainsCritPct] = useState<number>(30);

  // Optional DB-backed series (overrides simulated series when present)
  const [dbSeries, setDbSeries] = useState<null | { densite: { t:number; v:number }[]; viscosite: { t:number; v:number }[]; ph: { t:number; v:number }[]; temperature: { t:number; v:number }[] }>(null);
  const [pcDb, setPcDb] = useState<null | { t:number; v:number }[]>(null);
  const [h2oDb, setH2oDb] = useState<null | { t:number; v:number }[]>(null);

  const current = useMemo(()=> barbotines.find(b => b.id === id) || null, [barbotines, id]);
  const sid = (current && (current as any).slurryId) as string | undefined;
  useEffect(() => {
    if (!sid) return;
    let cancelled = false;
    (async () => {
      try {
        const { series, bounds } = await fetchRheologyAll(sid, ['density','viscosity','pH','temperature','pc','H2O'], true);
        if (cancelled) return;
        setDbSeries({
          densite: (series['density']||[]).map((d:any)=>({ t:Number(d.t), v:Number(d.v) })),
          viscosite: (series['viscosity']||[]).map((d:any)=>({ t:Number(d.t), v:Number(d.v) })),
          ph: (series['pH']||[]).map((d:any)=>({ t:Number(d.t), v:Number(d.v) })),
          temperature: (series['temperature']||[]).map((d:any)=>({ t:Number(d.t), v:Number(d.v) })),
        });
        setPcDb((series['pc']||[]).map((d:any)=>({ t:Number(d.t), v:Number(d.v) })));
        setH2oDb((series['H2O']||[]).map((d:any)=>({ t:Number(d.t), v:Number(d.v) })));
        // Apply latest bounds (USL/LSL)
        const keyMap: Record<string, any> = { density: 'densite', viscosity: 'viscosite', pH: 'ph', temperature: 'temperature', H2O: 'h2o', pc: 'pc', silice: 'silice', grain: 'grains' };
        if (Array.isArray(bounds)) {
          bounds.forEach((b:any) => {
            const k = keyMap[b.key] || b.key;
            setBoundsFor(id || '', k as any, { low: (b.lsl ?? b.low) ?? null, high: (b.usl ?? b.high) ?? null });
          });
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [sid, id]);

  function getSpecificRange(): [number, number] {
    const now = Date.now();
    const s = Date.parse(specificStart);
    const e = Date.parse(specificEnd);
    let start = Number.isFinite(s) ? s : now - 3600e3;
    let end = Number.isFinite(e) ? e : now;
    if (end <= start) end = start + 3600e3;
    return [start, end];
  }
  const [specStart, specEnd] = getSpecificRange();
  const isOnline = !!current?.online;
  const scopedBounds = useMemo(()=> getBoundsFor(id || ''), [getBoundsFor, id]);
  function filterByRange(arr: { t:number; v:number }[], range: typeof densRange, anchor?: number) {
    if (!arr || !arr.length) return [] as { t:number; v:number }[];
    const now = Date.now();
    let end = Math.min(anchor ?? now, now);
    let start = end - 3*60*60*1000;
    if (range==='1d') start = end - 24*60*60*1000;
    else if (range==='7d') start = end - 7*24*60*60*1000;
    else if (range==='1m') start = end - 30*24*60*60*1000;
    else if (range==='3m') start = end - 90*24*60*60*1000;
    else if (range==='all') { start = 0; }
    else if (range==='specific') { start = specStart; end = specEnd; }
    return arr.filter(p => p.t >= start && p.t <= end);
  }
  const densSource = dbSeries ? filterByRange(dbSeries.densite, densRange, densAnchor) : [];
  const viscSource = dbSeries ? filterByRange(dbSeries.viscosite, viscRange, viscAnchor) : [];
  const tempSource = dbSeries ? filterByRange(dbSeries.temperature, tempRange, tempAnchor) : [];
  const phSource = dbSeries ? filterByRange(dbSeries.ph, phRange, phAnchor) : [];
  const densiteData = useMemo(() => densSource.map(p => ({ time: p.t, value: Number(p.v.toFixed(3)) })), [densSource]);
  const viscositeData = useMemo(() => viscSource.map(p => ({ time: p.t, value: Math.round(p.v) })), [viscSource]);
  const phData = useMemo(() => phSource.map(p => ({ time: p.t, value: Number(p.v.toFixed(2)) })), [phSource]);
  const tempData = useMemo(() => tempSource.map(p => ({ time: p.t, value: Number(p.v.toFixed(2)) })), [tempSource]);
  const densAvg = useMemo(() => densiteData.length ? Number((densiteData.reduce((s,d)=>s+d.value,0)/densiteData.length).toFixed(3)) : null, [densiteData]);
  const densSeries = useMemo(()=> densiteData.map(d=>({ ...d, avg: densAvg ?? undefined })), [densiteData, densAvg]);
  const viscAvg = useMemo(() => viscositeData.length ? Number((viscositeData.reduce((s,d)=>s+d.value,0)/viscositeData.length).toFixed(0)) : null, [viscositeData]);
  const viscSeries = useMemo(()=> viscositeData.map(d=>({ ...d, avg: viscAvg ?? undefined })), [viscositeData, viscAvg]);
  const tempAvg = useMemo(() => tempData.length ? Number((tempData.reduce((s,d)=>s+d.value,0)/tempData.length).toFixed(2)) : null, [tempData]);
  const tempSeries = useMemo(()=> tempData.map(d=>({ ...d, avg: tempAvg ?? undefined })), [tempData, tempAvg]);
  const phAvg = useMemo(() => phData.length ? Number((phData.reduce((s,d)=>s+d.value,0)/phData.length).toFixed(2)) : null, [phData]);
  const phSeries = useMemo(()=> phData.map(d=>({ ...d, avg: phAvg ?? undefined })), [phData, phAvg]);

  // Unit conversions for panels (target units come from chart params context)
  const scopedParams = useMemo(() => getParamsFor(id || ''), [getParamsFor, id]);
  const setScoped = (metric: any, patch: any) => setParamsFor(id || '', metric, patch);
  const densConv = useMemo(() => densConverters(scopedParams.densite.unit), [scopedParams.densite.unit]);
  const densPanelData = useMemo(() => densSeries.map(d => ({ t: d.time, v: densConv.to(d.value), avg: d.avg != null ? densConv.to(d.avg) : undefined })), [densSeries, densConv]);
  const densYConv = useMemo(() => [densConv.to(densY[0]), densConv.to(densY[1])] as [number, number], [densY, densConv]);
  const densBoundsConv = useMemo(() => ({ low: scopedBounds.densite.low==null?null:densConv.to(scopedBounds.densite.low as number), high: scopedBounds.densite.high==null?null:densConv.to(scopedBounds.densite.high as number) }), [scopedBounds.densite, densConv]);

  const viscConv = useMemo(() => viscConverters(scopedParams.viscosite.unit), [scopedParams.viscosite.unit]);
  const viscPanelData = useMemo(() => viscSeries.map(d => ({ t: d.time, v: viscConv.to(d.value), avg: d.avg != null ? viscConv.to(d.avg) : undefined })), [viscSeries, viscConv]);
  const viscYConv = useMemo(() => [viscConv.to(viscY[0]), viscConv.to(viscY[1])] as [number, number], [viscY, viscConv]);
  const viscBoundsConv = useMemo(() => ({ low: scopedBounds.viscosite.low==null?null:viscConv.to(scopedBounds.viscosite.low as number), high: scopedBounds.viscosite.high==null?null:viscConv.to(scopedBounds.viscosite.high as number) }), [scopedBounds.viscosite, viscConv]);

  const tempConv = useMemo(() => tempConverters(scopedParams.temperature.unit), [scopedParams.temperature.unit]);
  const tempPanelData = useMemo(() => tempSeries.map(d => ({ t: d.time, v: tempConv.to(d.value), avg: d.avg != null ? tempConv.to(d.avg) : undefined })), [tempSeries, tempConv]);
  const tempYConv = useMemo(() => [tempConv.to(tempY[0]), tempConv.to(tempY[1])] as [number, number], [tempY, tempConv]);
  const tempBoundsConv = useMemo(() => ({ low: scopedBounds.temperature.low==null?null:tempConv.to(scopedBounds.temperature.low as number), high: scopedBounds.temperature.high==null?null:tempConv.to(scopedBounds.temperature.high as number) }), [scopedBounds.temperature, tempConv]);

  const phPanelData = useMemo(() => phSeries.map(d => ({ t: d.time, v: d.value, avg: d.avg })), [phSeries]);
  const h2oConv = useMemo(() => h2oConverters(scopedParams.h2o.unit), [scopedParams.h2o.unit]);
  const h2oPanelData = useMemo(() => {
    const src = (h2oDb || []).map(p => ({ t: Number(p.t), v: Number(p.v) }));
    const data = filterByRange(src, h2oRange);
    if (!data.length) return [] as { t:number; v:number; avg?: number }[];
    const avg = Number((data.reduce((s,d)=>s+d.v,0)/data.length).toFixed(3));
    return data.map(d => ({ t: d.t, v: h2oConv.to(d.v), avg: h2oConv.to(avg) }));
  }, [h2oDb, h2oRange, h2oConv, specStart, specEnd, densRange, viscRange, tempRange, phRange]);
  const h2oYConv = useMemo(() => [h2oConv.to(0), h2oConv.to(0.05)] as [number, number], [h2oConv]);
  const h2oBoundsConv = useMemo(() => ({ low: scopedBounds.h2o.low==null?null:h2oConv.to(scopedBounds.h2o.low as number), high: scopedBounds.h2o.high==null?null:h2oConv.to(scopedBounds.h2o.high as number) }), [scopedBounds.h2o, h2oConv]);

  const pcConv = useMemo(() => pcConverters(scopedParams.pc.unit), [scopedParams.pc.unit]);
  const pcHistData = useMemo(() => {
    const source = pcDb || [];
    if (!source.length) return [] as any[];
    const now = Date.now();
    if (pcRange === 'specific') {
      return (source as any[]).filter((p:any) => p.t >= specStart && p.t <= specEnd);
    }
    const ms = pcRange === '7d' ? 7*24*60*60*1000 : pcRange === '1m' ? 30*24*60*60*1000 : pcRange === '3m' ? 90*24*60*60*1000 : 365*24*60*60*1000;
    const start = now - ms;
    return (source as any[]).filter((p:any) => p.t >= start);
  }, [pcDb, pcRange, specStart, specEnd]);
  const pcPanelData = useMemo(() => {
    const avg = pcHistData.length ? Number((pcHistData.reduce((s,d)=>s+d.v,0)/pcHistData.length).toFixed(3)) : null;
    return pcHistData.map(d => ({ t: d.t, v: pcConv.to(d.v), avg: avg != null ? pcConv.to(avg) : undefined }));
  }, [pcHistData, pcConv]);
  const pcBoundsConv = useMemo(() => ({ low: (scopedBounds.pc?.low==null)?null:pcConv.to(scopedBounds.pc.low as number), high: (scopedBounds.pc?.high==null)?null:pcConv.to(scopedBounds.pc.high as number) }), [scopedBounds.pc, pcConv]);

  const pcYStats = useMemo(() => {
    if (!pcHistData.length) return { min: 0, max: 0 };
    let min = pcHistData[0].v, max = pcHistData[0].v;
    for (const p of pcHistData) { if (p.v < min) min = p.v; if (p.v > max) max = p.v; }
    return { min, max };
  }, [pcHistData]);

  const reco = useMemo(() => {
    if (!viscositeData.length) return '—';
    const latest = viscositeData[viscositeData.length - 1].value;
    if (bounds.viscosite.high == null) return '—';
    return latest > (bounds.viscosite.high as number) ? 'Ajouter eau' : 'Ne rien faire';
  }, [viscositeData, bounds.viscosite.high]);

  function mkTooltip(unit: string, metricLabel: string) {
    return (val: any, name: any, props: any) => {
      const valueStr = `${val} ${unit}`.trim();
      const label = name === 'Average' ? 'Average' : metricLabel;
      return [valueStr, label];
    };
  }

  function renderParamsModal(
    menuKey: string,
    title: string,
    cfg: {
      onClose: () => void;
      onSetRangeSpecific: () => void;
      unit: string;
      showAvg?: boolean;
      avgOn?: boolean;
      setAvgOn?: (v: boolean) => void;
      critOn?: boolean;
      setCritOn?: (v: boolean) => void;
      critPct?: number;
      setCritPct?: (n: number) => void;
      low: number | null;
      high: number | null;
      setLow: (n: number | null) => void;
      setHigh: (n: number | null) => void;
      draftKey: string;
    }
  ) {
    return (
      <div className="modal-backdrop" onClick={() => cfg.onClose()}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3 style={{ margin: 0 }}>{title}</h3>
            <button onClick={() => cfg.onClose()}>Fermer</button>
          </div>
          <div className="modal-body">
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <label>Période personnalisée:</label>
              <label>Début</label>
              <input type="datetime-local" value={specificStart} onChange={(e) => { setSpecificStart(e.target.value); cfg.onSetRangeSpecific(); }} />
              <label>Fin</label>
              <input type="datetime-local" value={specificEnd} onChange={(e) => { setSpecificEnd(e.target.value); cfg.onSetRangeSpecific(); }} />
            </div>
            {(specificStart && specificEnd && Date.parse(specificEnd) <= Date.parse(specificStart)) && (
              <div className="muted">Fin doit être supérieure au Début</div>
            )}
            <div className="row" style={{ gap: 8 }}>
              <label>Conformité min/max:</label>
              <input type="text" inputMode="decimal" placeholder="min" style={{ width: 90 }} value={draft[`${cfg.draftKey}.low`] ?? (cfg.low ?? '')}
                onChange={e => { setDraft(prev => ({ ...prev, [`${cfg.draftKey}.low`]: e.target.value })); const v = parseLocaleNumber(e.target.value); if (v === null) { cfg.setLow(null); } else if (!Number.isNaN(v)) { cfg.setLow(v as number); } }} />
              <input type="text" inputMode="decimal" placeholder="max" style={{ width: 90 }} value={draft[`${cfg.draftKey}.high`] ?? (cfg.high ?? '')}
                onChange={e => { setDraft(prev => ({ ...prev, [`${cfg.draftKey}.high`]: e.target.value })); const v = parseLocaleNumber(e.target.value); if (v === null) { cfg.setHigh(null); } else if (!Number.isNaN(v)) { cfg.setHigh(v as number); } }} />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <label>Unité:</label>
              <select value={cfg.unit} onChange={()=>{}}><option value={cfg.unit}>{cfg.unit}</option></select>
            </div>
            {cfg.setAvgOn && (
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <label>Moyenne</label>
                <input type="checkbox" checked={!!cfg.avgOn} onChange={e=>cfg.setAvgOn!(e.target.checked)} />
              </div>
            )}
            {cfg.setCritOn && cfg.setCritPct && (
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <label>Zones critiques (%)</label>
                <input type="checkbox" checked={!!cfg.critOn} onChange={e=>cfg.setCritOn!(e.target.checked)} />
                <input type="range" min={0} max={60} step={5} value={cfg.critPct} onChange={e=>cfg.setCritPct!(Number(e.target.value))} />
                <span className="muted">{cfg.critPct}%</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Barbotine {id}</h2>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="muted">{isOnline ? 'Mise à jour en direct' : 'Hors ligne (lecture seule)'}</span>
          <button className="switch" data-on={isOnline && live} aria-label="Live" disabled={!isOnline} onClick={() => isOnline && setLive(!live)}>
            <span className="knob" />
          </button>
        </div>
        {showMenu==='h2o' && (
          <ParamsModal
            title="Paramètres Débit H₂O"
            specificStart={specificStart}
            specificEnd={specificEnd}
            setSpecificStart={setSpecificStart}
            setSpecificEnd={setSpecificEnd}
            onSetRangeSpecific={() => { setH2oRange('specific'); localStorage.setItem(`range:${id}:h2o`, 'specific'); }}
            unit={scopedParams.h2o.unit}
            unitOptions={["L/h","L/day","mL/min","mL/s"]}
            setUnit={(u)=> setScoped('h2o', { unit: u })}
            avgOn={scopedParams.h2o.avgOn}
            setAvgOn={(v)=> setScoped('h2o', { avgOn: v })}
            trendOn={scopedParams.h2o.trendOn}
            setTrendOn={(v)=> setScoped('h2o', { trendOn: v })}
              trendSegPct={scopedParams.h2o.trendSegPct}
              setTrendSegPct={(n)=> setScoped('h2o', { trendSegPct: n })}
            deltaY={scopedParams.h2o.deltaY}
            setDeltaY={(n)=> setScoped('h2o', { deltaY: n })}
            low={scopedBounds.h2o.low}
            high={scopedBounds.h2o.high}
            setLow={(n)=> setBoundsFor(id || '', 'h2o', { ...scopedBounds.h2o, low: n })}
            setHigh={(n)=> setBoundsFor(id || '', 'h2o', { ...scopedBounds.h2o, high: n })}
            critOn={h2oCritOn}
            setCritOn={setH2oCritOn}
            critPct={h2oCritPct}
            setCritPct={setH2oCritPct}
            onClose={() => setShowMenu(null)}
          />
        )}
      </div>
      <div className="section" style={{ marginTop: 12 }}>
        {/* Row 1: Densité (left) */}
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Densité (g/cm³)</h3>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <div className="segmented">
              {(['3h','1d','7d','1m','3m','all'] as const).map(r => (
                  <button key={r} className={`seg-btn ${densRange===r?'active':''}`} onClick={() => { setDensRange(r); localStorage.setItem(`range:${id}:densite`, r); }}>{r==='3h'?'3H':r==='1d'?'1D':r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
              ))}
                <button className="seg-btn" title="Paramètres" onClick={() => setShowMenu('densite')}>…</button>
              </div>
            </div>
          </div>
          {showMenu==='densite' && (
            <ParamsModal
              title="Paramètres Densité"
              specificStart={specificStart}
              specificEnd={specificEnd}
              setSpecificStart={setSpecificStart}
              setSpecificEnd={setSpecificEnd}
              onSetRangeSpecific={() => { setDensRange('specific'); localStorage.setItem(`range:${id}:densite`, 'specific'); }}
              unit={scopedParams.densite.unit}
              unitOptions={["kg/m³","g/cm³","g/mL","kg/L","g/L","mg/mL"]}
              setUnit={(u)=> setScoped('densite', { unit: u })}
              avgOn={scopedParams.densite.avgOn}
              setAvgOn={(v)=> setScoped('densite', { avgOn: v })}
              trendOn={scopedParams.densite.trendOn}
              setTrendOn={(v)=> setScoped('densite', { trendOn: v })}
              trendSegPct={scopedParams.densite.trendSegPct}
              setTrendSegPct={(n)=> setScoped('densite', { trendSegPct: n })}
              deltaY={scopedParams.densite.deltaY}
              setDeltaY={(n)=> setScoped('densite', { deltaY: n })}
              low={scopedBounds.densite.low}
              high={scopedBounds.densite.high}
              setLow={(n)=> setBoundsFor(id || '', 'densite', { ...scopedBounds.densite, low: n })}
              setHigh={(n)=> setBoundsFor(id || '', 'densite', { ...scopedBounds.densite, high: n })}
              critOn={densCritOn}
              setCritOn={setDensCritOn}
              critPct={densCritPct}
              setCritPct={setDensCritPct}
              onClose={()=> setShowMenu(null)}
            />
          )}
          <div className="chart">
            <div
              className="pan-layer"
              onMouseDown={(e) => {
                const lastT = densiteData[densiteData.length-1]?.time ?? Date.now();
                dragRef.current = { startX: e.clientX, startY: e.clientY, startAnchor: densAnchor ?? lastT, startYMin: densY[0], startYMax: densY[1], mode: null };
                (e.currentTarget as HTMLDivElement).classList.add('dragging');
              }}
              onMouseMove={(e) => {
                if (!dragRef.current) return;
                const dx = e.clientX - dragRef.current.startX;
                const dy = e.clientY - dragRef.current.startY;
                if (!dragRef.current.mode) {
                  dragRef.current.mode = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
                }
                if (dragRef.current.mode === 'x') {
                  const windowMs = densRange==='3h'?3*3600e3:densRange==='1d'?24*3600e3:densRange==='7d'?7*24*3600e3:densRange==='1m'?30*24*3600e3:densRange==='3m'?90*24*3600e3:3600e3;
                  const scale = windowMs / (e.currentTarget.clientWidth || 1);
                  setDensAnchor(dragRef.current.startAnchor + dx * scale);
                } else {
                  const [min0,max0]=[dragRef.current.startYMin, dragRef.current.startYMax];
                  const range = max0 - min0;
                  const perPx = range / (e.currentTarget.clientHeight || 1);
                  setDensY([Number((min0+dy*perPx).toFixed(3)), Number((max0+dy*perPx).toFixed(3))]);
                }
              }}
              onMouseUp={(e)=>{ dragRef.current=null; (e.currentTarget as HTMLDivElement).classList.remove('dragging'); }}
              onMouseLeave={(e)=>{ dragRef.current=null; (e.currentTarget as HTMLDivElement).classList.remove('dragging'); }}
              onTouchStart={(e) => {
                const t = e.touches[0];
                const lastT = densiteData[densiteData.length-1]?.time ?? Date.now();
                dragRef.current = { startX: t.clientX, startY: t.clientY, startAnchor: densAnchor ?? lastT, startYMin: densY[0], startYMax: densY[1], mode: null };
                (e.currentTarget as HTMLDivElement).classList.add('dragging');
              }}
              onTouchMove={(e) => {
                if (!dragRef.current) return;
                const t = e.touches[0];
                const dx = t.clientX - dragRef.current.startX;
                const dy = t.clientY - dragRef.current.startY;
                if (!dragRef.current.mode) dragRef.current.mode = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
                if (dragRef.current.mode === 'x') {
                  const windowMs = densRange==='3h'?3*3600e3:densRange==='1d'?24*3600e3:densRange==='7d'?7*24*3600e3:densRange==='1m'?30*24*3600e3:densRange==='3m'?90*24*3600e3:3600e3;
                  const scale = windowMs / ((e.currentTarget as HTMLDivElement).clientWidth || 1);
                  setDensAnchor(dragRef.current.startAnchor + dx * scale);
                } else {
                  const [min0,max0]=[dragRef.current.startYMin, dragRef.current.startYMax];
                  const range = max0 - min0;
                  const perPx = range / ((e.currentTarget as HTMLDivElement).clientHeight || 1);
                  setDensY([Number((min0+dy*perPx).toFixed(3)), Number((max0+dy*perPx).toFixed(3))]);
                }
              }}
              onTouchEnd={(e)=>{ dragRef.current=null; (e.currentTarget as HTMLDivElement).classList.remove('dragging'); }}
            />
            <ResponsiveContainer>
              <MetricPanel
                title="Densité"
                unitLabel={scopedParams.densite.unit}
                data={densPanelData}
                yDomain={densYConv as any}
                avgOn={scopedParams.densite.avgOn}
                trendOn={scopedParams.densite.trendOn}
                trendSegPct={scopedParams.densite.trendSegPct}
                deltaY={scopedParams.densite.deltaY}
                bounds={densBoundsConv as any}
                critPct={densCritOn ? densCritPct : undefined}
                color="#60a5fa"
                trendWindowMs={scopedParams.densite.trendWindowMs}
                rangeKey={densRange}
              />
            </ResponsiveContainer>
          </div>
        </div>
        {/* Row 1 right: Viscosité */}
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Viscosité (mPa·s)</h3>
            <div className="segmented">
              {(['3h','1d','7d','1m','3m','all'] as const).map(r => (
                <button key={r} className={`seg-btn ${viscRange===r?'active':''}`} onClick={() => { setViscRange(r); localStorage.setItem(`range:${id}:viscosite`, r); }}>{r==='3h'?'3H':r==='1d'?'1D':r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
              ))}
              <button className="seg-btn" title="Paramètres" onClick={() => setShowMenu('visco')}>…</button>
            </div>
          </div>
          {showMenu==='visco' && (
            <ParamsModal
              title="Paramètres Viscosité"
              specificStart={specificStart}
              specificEnd={specificEnd}
              setSpecificStart={setSpecificStart}
              setSpecificEnd={setSpecificEnd}
              onSetRangeSpecific={()=> { setViscRange('specific'); localStorage.setItem(`range:${id}:viscosite`, 'specific'); }}
              unit={scopedParams.viscosite.unit}
              unitOptions={["Pa·s","mPa·s","cP","P","St","cSt","s"]}
              setUnit={(u)=> setScoped('viscosite', { unit: u })}
              avgOn={scopedParams.viscosite.avgOn}
              setAvgOn={(v)=> setScoped('viscosite', { avgOn: v })}
              trendOn={scopedParams.viscosite.trendOn}
              setTrendOn={(v)=> setScoped('viscosite', { trendOn: v })}
              trendSegPct={scopedParams.viscosite.trendSegPct}
              setTrendSegPct={(n)=> setScoped('viscosite', { trendSegPct: n })}
              deltaY={scopedParams.viscosite.deltaY}
              setDeltaY={(n)=> setScoped('viscosite', { deltaY: n })}
              low={scopedBounds.viscosite.low}
              high={scopedBounds.viscosite.high}
              setLow={(n)=> setBoundsFor(id || '', 'viscosite', { ...scopedBounds.viscosite, low: n })}
              setHigh={(n)=> setBoundsFor(id || '', 'viscosite', { ...scopedBounds.viscosite, high: n })}
              critOn={viscCritOn}
              setCritOn={setViscCritOn}
              critPct={viscCritPct}
              setCritPct={setViscCritPct}
              onClose={()=> setShowMenu(null)}
            />
          )}
          <div className="chart">
            <div
              className="pan-layer"
              onMouseDown={(e) => {
                const lastT = viscositeData[viscositeData.length-1]?.time ?? Date.now();
                dragRef.current = { startX: e.clientX, startY: e.clientY, startAnchor: viscAnchor ?? lastT, startYMin: viscY[0], startYMax: viscY[1], mode: null };
                (e.currentTarget as HTMLDivElement).classList.add('dragging');
              }}
              onMouseMove={(e) => {
                if (!dragRef.current) return;
                const dx = e.clientX - dragRef.current.startX;
                const dy = e.clientY - dragRef.current.startY;
                if (!dragRef.current.mode) dragRef.current.mode = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
                if (dragRef.current.mode === 'x') {
                  const windowMs = viscRange==='3h'?3*3600e3:viscRange==='1d'?24*3600e3:viscRange==='7d'?7*24*3600e3:viscRange==='1m'?30*24*3600e3:viscRange==='3m'?90*24*3600e3:3600e3;
                  const scale = windowMs / (e.currentTarget.clientWidth || 1);
                  setViscAnchor(dragRef.current.startAnchor + dx * scale);
                } else {
                  const [min0,max0]=[dragRef.current.startYMin, dragRef.current.startYMax];
                  const range = max0 - min0;
                  const perPx = range / (e.currentTarget.clientHeight || 1);
                  setViscY([Math.round(min0+dy*perPx), Math.round(max0+dy*perPx)] as any);
                }
              }}
              onMouseUp={(e)=>{ dragRef.current=null; (e.currentTarget as HTMLDivElement).classList.remove('dragging'); }}
              onMouseLeave={(e)=>{ dragRef.current=null; (e.currentTarget as HTMLDivElement).classList.remove('dragging'); }}
              onTouchStart={(e) => {
                const t = e.touches[0];
                const lastT = viscositeData[viscositeData.length-1]?.time ?? Date.now();
                dragRef.current = { startX: t.clientX, startY: t.clientY, startAnchor: viscAnchor ?? lastT, startYMin: viscY[0], startYMax: viscY[1], mode: null };
                (e.currentTarget as HTMLDivElement).classList.add('dragging');
              }}
              onTouchMove={(e) => {
                if (!dragRef.current) return;
                const t = e.touches[0];
                const dx = t.clientX - dragRef.current.startX;
                const dy = t.clientY - dragRef.current.startY;
                if (!dragRef.current.mode) dragRef.current.mode = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
                if (dragRef.current.mode === 'x') {
                  const windowMs = viscRange==='3h'?3*3600e3:viscRange==='1d'?24*3600e3:viscRange==='7d'?7*24*3600e3:viscRange==='1m'?30*24*3600e3:viscRange==='3m'?90*24*3600e3:3600e3;
                  const scale = windowMs / ((e.currentTarget as HTMLDivElement).clientWidth || 1);
                  setViscAnchor(dragRef.current.startAnchor + dx * scale);
                } else {
                  const [min0,max0]=[dragRef.current.startYMin, dragRef.current.startYMax];
                  const range = max0 - min0;
                  const perPx = range / ((e.currentTarget as HTMLDivElement).clientHeight || 1);
                  setViscY([Math.round(min0+dy*perPx), Math.round(max0+dy*perPx)] as any);
                }
              }}
              onTouchEnd={(e)=>{ dragRef.current=null; (e.currentTarget as HTMLDivElement).classList.remove('dragging'); }}
            />
            <MetricPanel
              title="Viscosité"
              unitLabel={scopedParams.viscosite.unit}
              data={viscPanelData}
              yDomain={viscYConv as any}
              avgOn={scopedParams.viscosite.avgOn}
              trendOn={scopedParams.viscosite.trendOn}
              trendSegPct={scopedParams.viscosite.trendSegPct}
              deltaY={scopedParams.viscosite.deltaY}
              bounds={viscBoundsConv as any}
              critPct={viscCritOn ? viscCritPct : undefined}
              color="#34d399"
              trendWindowMs={scopedParams.viscosite.trendWindowMs}
              rangeKey={viscRange}
            />
          </div>
        </div>
        {/* Row 2 left: Pouvoir couvrant - Historique */}
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Pouvoir couvrant - Historique (g)</h3>
            <div className="segmented">
              {(['7d','1m','3m','all'] as const).map(r => (
                <button key={r} className={`seg-btn ${pcRange===r?'active':''}`} onClick={() => { setPcRange(r); localStorage.setItem(`range:${id}:pc`, r); }}>{r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
              ))}
              <button className="seg-btn" title="Paramètres" onClick={() => setShowMenu('pc-hist')}>…</button>
            </div>
          </div>
          <div className="chart">
            <ResponsiveContainer>
              <MetricPanel
                title="Pouvoir couvrant"
                unitLabel={scopedParams.pc.unit}
                data={pcPanelData}
                avgOn={isOnline ? scopedParams.pc.avgOn : false}
                trendOn={isOnline ? scopedParams.pc.trendOn : false}
              trendSegPct={scopedParams.pc.trendSegPct}
                deltaY={scopedParams.pc.deltaY}
                bounds={pcBoundsConv as any}
              critPct={pcCritOn ? pcCritPct : undefined}
                color="#38bdf8"
                trendWindowMs={scopedParams.pc.trendWindowMs}
                rangeKey={pcRange}
              />
            </ResponsiveContainer>
          </div>
        </div>
         {showMenu==='pc-hist' && (
           <ParamsModal
             title="Paramètres Pouvoir couvrant (historique)"
             specificStart={specificStart}
             specificEnd={specificEnd}
             setSpecificStart={setSpecificStart}
             setSpecificEnd={setSpecificEnd}
             onSetRangeSpecific={()=> { setPcRange('specific'); localStorage.setItem(`range:${id}:pc`, 'specific'); }}
             unit={scopedParams.pc.unit}
             unitOptions={["g","g/cm²"]}
             setUnit={(u)=> setScoped('pc', { unit: u })}
             avgOn={scopedParams.pc.avgOn}
             setAvgOn={(v)=> setScoped('pc', { avgOn: v })}
             trendOn={scopedParams.pc.trendOn}
             setTrendOn={(v)=> setScoped('pc', { trendOn: v })}
             trendSegPct={scopedParams.pc.trendSegPct}
             setTrendSegPct={(n)=> setScoped('pc', { trendSegPct: n })}
             deltaY={scopedParams.pc.deltaY}
             setDeltaY={(n)=> setScoped('pc', { deltaY: n })}
             low={scopedBounds.pc?.low ?? null}
             high={scopedBounds.pc?.high ?? null}
             setLow={(n)=> setBoundsFor(id || '', 'pc', { ...(scopedBounds.pc ?? { low: null, high: null }), low: n })}
             setHigh={(n)=> setBoundsFor(id || '', 'pc', { ...(scopedBounds.pc ?? { low: null, high: null }), high: n })}
             critOn={pcCritOn}
             setCritOn={setPcCritOn}
             critPct={pcCritPct}
             setCritPct={setPcCritPct}
             onClose={()=> setShowMenu(null)}
           />
         )}
        {/* Row 2 right: Pouvoir couvrant - Essai */}
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Pouvoir couvrant - Essai (g)</h3>
            <div className="segmented">
              {(testState === 'idle' || testState === 'termine') ? (
                <button className="seg-btn primary" onClick={() => {
              // Phases: calib 5s, trempe 10s, mesure 120s
              const tCalib = 5000; const tTrempe = 10000; const tMesure = 120000; const totalDurationMs = tCalib + tTrempe + tMesure;
              setTestState('calib');
              setRemaining(Math.ceil(totalDurationMs / 1000));
              setMassSeries(null);
              const startedAt = Date.now();
              let localSeries: { t: number; v: number }[] = [];
              const interval = setInterval(() => {
                const elapsed = Date.now() - startedAt;
                const left = Math.max(0, Math.ceil((totalDurationMs - elapsed) / 1000));
                setRemaining(left);
                if (elapsed < tCalib) {
                  setTestState('calib');
                } else if (elapsed < tCalib + tTrempe) {
                  setTestState('trempe');
                } else if (elapsed < totalDurationMs) {
                  setTestState('mesure');
                  const t = startedAt + elapsed;
                  const tSec = (elapsed - (tCalib + tTrempe)) / 1000;
                  const m0 = 120; const tau = 45;
                  const value = Math.max(0, m0 * Math.exp(-tSec / tau) + (Math.random() * 2 - 1) * 0.6);
                  localSeries.push({ t, v: Number(value.toFixed(2)) });
                  if (localSeries.length % 3 === 0) setMassSeries([...localSeries]);
                }
                if (elapsed >= totalDurationMs) {
                  clearInterval(interval);
                  setTestState('termine');
                  setMassSeries([...localSeries]);
                  if (localSeries.length) {
                    const last = localSeries[localSeries.length - 1].v;
                    addCoverPowerResult(last);
                    setLastPlaqueSrc('/assets/plaque-pickup.jpg');
                  }
                }
              }, 500);
            }}>Lancer essai</button>
              ) : (
                <span className="seg-btn" style={{ cursor: 'default' }}>
                  {testState === 'calib' ? `Calibration balance - ${remaining}s` : testState === 'trempe' ? `Trempé 10s - ${remaining}s` : testState === 'mesure' ? `Mesure en cours - ${remaining}s` : ''}
                </span>
              )}
            </div>
          </div>
          <div className="chart">
            <ResponsiveContainer>
              <LineChart data={(() => {
                const arr = (massSeries ?? []).map(p => ({ time: p.t, value: Number(p.v.toFixed(2)) }));
                const avg = arr.length ? Number((arr.reduce((s,d)=>s+d.value,0)/arr.length).toFixed(2)) : null;
                return arr.map(d => ({ ...d, avg: avg ?? undefined }));
              })()} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                <XAxis dataKey="time" type="number" scale="time" domain={["auto","auto"]} tickFormatter={formatTime} stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip labelFormatter={v => formatDateTime(Number(v))} formatter={mkTooltip('g', 'Masse')} />
                <Line type="monotone" dataKey="value" name="Masse" stroke="#38bdf8" dot={false} strokeWidth={2} />
                {(massSeries ?? []).length>0 && (
                  <Line type="monotone" dataKey="avg" name="Average" stroke="#ef4444" dot={false} strokeDasharray="5 5" strokeWidth={1} isAnimationActive={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      {testState === 'termine' && (
        <div className="section" style={{ marginTop: 12 }}>
          {/* Row 3: photo + analyse, each same panel size */}
          <div className="panel">
            <h3>Photo de plaque</h3>
            <div className="chart" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 320, height: 320, cursor: 'zoom-in' }} onClick={()=> setImageModal('photo')}>
                <picture>
                  <source srcSet={(lastPlaqueSrc || '/assets/plaque-pickup.webp').replace('.jpg', '.webp')} type="image/webp" />
                  <img src={lastPlaqueSrc || '/assets/plaque-pickup.jpg'} alt="Plaque essai" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                </picture>
              </div>
            </div>
          </div>
          <div className="panel">
            <h3>Analyse IA</h3>
            <div className="chart" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 320, height: 320, cursor: 'zoom-in', position: 'relative' }} onClick={()=> setImageModal('ai')}>
                <picture>
                  <source srcSet={'/assets/plaque-pickup_analysed.webp'} type="image/webp" />
                  <img src={'/assets/plaque-pickup_analysed.webp'} alt="Plaque analysée" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                </picture>
                <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(16,22,83,0.9)', color: '#e5e7eb', padding: '6px 8px', borderRadius: 6, fontSize: 12, lineHeight: 1.2 }}>
                  <div><strong>Count :</strong> 209</div>
                  <div><strong>Avg diameter :</strong> 1.2 mm</div>
                </div>
                <div style={{ position: 'absolute', bottom: 8, right: 8, color: '#e5e7eb', textAlign: 'center' }}>
                  <div style={{ width: 64, height: 6, background: '#ffffff', borderRadius: 3, marginLeft: 'auto' }} />
                  <div style={{ fontSize: 12, marginTop: 4 }}>0.8 cm</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Image overlay modal for quick view with click-outside to close */}
      {imageModal && (
        <div className="modal-backdrop" onClick={() => setImageModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{imageModal === 'photo' ? 'Photo de plaque' : 'Analyse IA'}</h3>
              <div className="row" style={{ gap: 8 }}>
                <button onClick={() => setImageModal(null)}>Fermer</button>
              </div>
            </div>
            <div className="modal-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', overflow: 'hidden' }}>
                <img
                  src={imageModal === 'ai' ? '/assets/plaque-pickup_analysed.webp' : (lastPlaqueSrc || '/assets/plaque-pickup.jpg')}
                  alt={imageModal === 'ai' ? 'Plaque analysée' : 'Plaque essai'}
                  style={{ maxWidth: '95vw', maxHeight: '80vh', borderRadius: 8, border: '1px solid var(--border)', cursor: 'zoom-in' }}
                  onClick={(e)=>{
                    const el = e.currentTarget as HTMLImageElement;
                    const isZoomed = el.style.transform && el.style.transform !== '';
                    if (!isZoomed) {
                      el.style.transformOrigin = `${e.nativeEvent.offsetX}px ${e.nativeEvent.offsetY}px`;
                      el.style.transform = 'scale(1.8)';
                    } else {
                      el.style.transform = '';
                    }
                    el.style.transition = 'transform 180ms ease';
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Row 4: Température (left) and pH (right) */}
      <div className="section" style={{ marginTop: 12 }}>
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Température (°C)</h3>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <div className="segmented">
              {(['3h','1d','7d','1m','3m','all'] as const).map(r => (
                  <button key={r} className={`seg-btn ${tempRange===r?'active':''}`} onClick={() => { setTempRange(r); localStorage.setItem(`range:${id}:temperature`, r); }}>{r==='3h'?'3H':r==='1d'?'1D':r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
              ))}
                <button className="seg-btn" title="Paramètres" onClick={() => setShowMenu('temp')}>…</button>
              </div>
            </div>
          </div>
          {showMenu==='temp' && (
            <ParamsModal
              title="Paramètres Température"
              specificStart={specificStart}
              specificEnd={specificEnd}
              setSpecificStart={setSpecificStart}
              setSpecificEnd={setSpecificEnd}
              onSetRangeSpecific={()=> { setTempRange('specific'); localStorage.setItem(`range:${id}:temperature`, 'specific'); }}
              unit={scopedParams.temperature.unit}
              unitOptions={["°C","°F","K"]}
              setUnit={(u)=> setScoped('temperature', { unit: u })}
              avgOn={scopedParams.temperature.avgOn}
              setAvgOn={(v)=> setScoped('temperature', { avgOn: v })}
              trendOn={scopedParams.temperature.trendOn}
              setTrendOn={(v)=> setScoped('temperature', { trendOn: v })}
              trendSegPct={scopedParams.temperature.trendSegPct}
              setTrendSegPct={(n)=> setScoped('temperature', { trendSegPct: n })}
              deltaY={scopedParams.temperature.deltaY}
              setDeltaY={(n)=> setScoped('temperature', { deltaY: n })}
              low={scopedBounds.temperature.low}
              high={scopedBounds.temperature.high}
              setLow={(n)=> setBoundsFor(id || '', 'temperature', { ...scopedBounds.temperature, low: n })}
              setHigh={(n)=> setBoundsFor(id || '', 'temperature', { ...scopedBounds.temperature, high: n })}
              critOn={tempCritOn}
              setCritOn={setTempCritOn}
              critPct={tempCritPct}
              setCritPct={setTempCritPct}
              onClose={()=> setShowMenu(null)}
            />
          )}
          <div className="chart">
            <div
              className="pan-layer"
              onMouseDown={(e) => {
                const lastT = tempData[tempData.length-1]?.time ?? Date.now();
                dragRef.current = { startX: e.clientX, startY: e.clientY, startAnchor: tempAnchor ?? lastT, startYMin: tempY[0], startYMax: tempY[1], mode: null };
                (e.currentTarget as HTMLDivElement).classList.add('dragging');
              }}
              onMouseMove={(e) => {
                if (!dragRef.current) return;
                const dx = e.clientX - dragRef.current.startX;
                const dy = e.clientY - dragRef.current.startY;
                if (!dragRef.current.mode) dragRef.current.mode = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
                if (dragRef.current.mode === 'x') {
                  const windowMs = tempRange==='3h'?3*3600e3:tempRange==='1d'?24*3600e3:tempRange==='7d'?7*24*3600e3:tempRange==='1m'?30*24*3600e3:tempRange==='3m'?90*24*3600e3:3600e3;
                  const scale = windowMs / (e.currentTarget.clientWidth || 1);
                  setTempAnchor(dragRef.current.startAnchor + dx * scale);
                } else {
                  const [min0,max0]=[dragRef.current.startYMin, dragRef.current.startYMax];
                  const range = max0 - min0;
                  const perPx = range / (e.currentTarget.clientHeight || 1);
                  setTempY([Number((min0+dy*perPx).toFixed(2)), Number((max0+dy*perPx).toFixed(2))]);
                }
              }}
              onMouseUp={(e)=>{ dragRef.current=null; (e.currentTarget as HTMLDivElement).classList.remove('dragging'); }}
              onMouseLeave={(e)=>{ dragRef.current=null; (e.currentTarget as HTMLDivElement).classList.remove('dragging'); }}
              onTouchStart={(e) => {
                const t = e.touches[0];
                const lastT = tempData[tempData.length-1]?.time ?? Date.now();
                dragRef.current = { startX: t.clientX, startY: t.clientY, startAnchor: tempAnchor ?? lastT, startYMin: tempY[0], startYMax: tempY[1], mode: null };
                (e.currentTarget as HTMLDivElement).classList.add('dragging');
              }}
              onTouchMove={(e) => {
                if (!dragRef.current) return;
                const t = e.touches[0];
                const dx = t.clientX - dragRef.current.startX;
                const dy = t.clientY - dragRef.current.startY;
                if (!dragRef.current.mode) dragRef.current.mode = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
                if (dragRef.current.mode === 'x') {
                  const windowMs = tempRange==='3h'?3*3600e3:tempRange==='1d'?24*3600e3:tempRange==='7d'?7*24*3600e3:tempRange==='1m'?30*24*3600e3:tempRange==='3m'?90*24*3600e3:3600e3;
                  const scale = windowMs / ((e.currentTarget as HTMLDivElement).clientWidth || 1);
                  setTempAnchor(dragRef.current.startAnchor + dx * scale);
                } else {
                  const [min0,max0]=[dragRef.current.startYMin, dragRef.current.startYMax];
                  const range = max0 - min0;
                  const perPx = range / ((e.currentTarget as HTMLDivElement).clientHeight || 1);
                  setTempY([Number((min0+dy*perPx).toFixed(2)), Number((max0+dy*perPx).toFixed(2))]);
                }
              }}
              onTouchEnd={(e)=>{ dragRef.current=null; (e.currentTarget as HTMLDivElement).classList.remove('dragging'); }}
            />
            <MetricPanel
              title="Température"
              unitLabel={scopedParams.temperature.unit}
              data={tempPanelData}
              yDomain={tempYConv as any}
              avgOn={scopedParams.temperature.avgOn}
              trendOn={scopedParams.temperature.trendOn}
              trendSegPct={scopedParams.temperature.trendSegPct}
              deltaY={scopedParams.temperature.deltaY}
              bounds={tempBoundsConv as any}
              critPct={tempCritOn ? tempCritPct : undefined}
              color="#f59e0b"
              trendWindowMs={scopedParams.temperature.trendWindowMs}
              rangeKey={tempRange}
            />
          </div>
        </div>
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>pH</h3>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <div className="segmented">
                {(['3h','1d','7d','1m','3m','all'] as const).map(r => (
                  <button key={r} className={`seg-btn ${phRange===r?'active':''}`} onClick={() => { setPhRange(r); localStorage.setItem(`range:${id}:ph`, r); }}>{r==='3h'?'3H':r==='1d'?'1D':r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
                ))}
                <button className="seg-btn" title="Paramètres" onClick={() => setShowMenu('ph')}>…</button>
              </div>
            </div>
          </div>
          {showMenu==='ph' && (
            <ParamsModal
              title="Paramètres pH"
              specificStart={specificStart}
              specificEnd={specificEnd}
              setSpecificStart={setSpecificStart}
              setSpecificEnd={setSpecificEnd}
              onSetRangeSpecific={()=> { setPhRange('specific'); localStorage.setItem(`range:${id}:ph`, 'specific'); }}
              unit={scopedParams.ph.unit}
              unitOptions={["(-)"]}
              setUnit={(u)=> setScoped('ph', { unit: u })}
              avgOn={scopedParams.ph.avgOn}
              setAvgOn={(v)=> setScoped('ph', { avgOn: v })}
              trendOn={scopedParams.ph.trendOn}
              setTrendOn={(v)=> setScoped('ph', { trendOn: v })}
              trendSegPct={scopedParams.ph.trendSegPct}
              setTrendSegPct={(n)=> setScoped('ph', { trendSegPct: n })}
              deltaY={scopedParams.ph.deltaY}
              setDeltaY={(n)=> setScoped('ph', { deltaY: n })}
              low={scopedBounds.ph.low}
              high={scopedBounds.ph.high}
              setLow={(n)=> setBoundsFor(id || '', 'ph', { ...scopedBounds.ph, low: n })}
              setHigh={(n)=> setBoundsFor(id || '', 'ph', { ...scopedBounds.ph, high: n })}
              critOn={phCritOn}
              setCritOn={setPhCritOn}
              critPct={phCritPct}
              setCritPct={setPhCritPct}
              onClose={()=> setShowMenu(null)}
            />
          )}
          <div className="chart">
            <div
              className="pan-layer"
              onMouseDown={(e) => {
                const lastT = phData[phData.length-1]?.time ?? Date.now();
                dragRef.current = { startX: e.clientX, startY: e.clientY, startAnchor: phAnchor ?? lastT, startYMin: phY[0], startYMax: phY[1], mode: null };
                (e.currentTarget as HTMLDivElement).classList.add('dragging');
              }}
              onMouseMove={(e) => {
                if (!dragRef.current) return;
                const dx = e.clientX - dragRef.current.startX;
                const dy = e.clientY - dragRef.current.startY;
                if (!dragRef.current.mode) dragRef.current.mode = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
                if (dragRef.current.mode === 'x') {
                  const windowMs = phRange==='3h'?3*3600e3:phRange==='1d'?24*3600e3:phRange==='7d'?7*24*3600e3:phRange==='1m'?30*24*3600e3:phRange==='3m'?90*24*3600e3:3600e3;
                  const scale = windowMs / (e.currentTarget.clientWidth || 1);
                  setPhAnchor(dragRef.current.startAnchor + dx * scale);
                } else {
                  const [min0,max0]=[dragRef.current.startYMin, dragRef.current.startYMax];
                  const range = max0 - min0;
                  const perPx = range / (e.currentTarget.clientHeight || 1);
                  setPhY([Number((min0+dy*perPx).toFixed(2)), Number((max0+dy*perPx).toFixed(2))]);
                }
              }}
              onMouseUp={(e)=>{ dragRef.current=null; (e.currentTarget as HTMLDivElement).classList.remove('dragging'); }}
              onMouseLeave={(e)=>{ dragRef.current=null; (e.currentTarget as HTMLDivElement).classList.remove('dragging'); }}
              onTouchStart={(e) => {
                const t = e.touches[0];
                const lastT = phData[phData.length-1]?.time ?? Date.now();
                dragRef.current = { startX: t.clientX, startY: t.clientY, startAnchor: phAnchor ?? lastT, startYMin: phY[0], startYMax: phY[1], mode: null };
                (e.currentTarget as HTMLDivElement).classList.add('dragging');
              }}
              onTouchMove={(e) => {
                if (!dragRef.current) return;
                const t = e.touches[0];
                const dx = t.clientX - dragRef.current.startX;
                const dy = t.clientY - dragRef.current.startY;
                if (!dragRef.current.mode) dragRef.current.mode = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
                if (dragRef.current.mode === 'x') {
                  const windowMs = phRange==='3h'?3*3600e3:phRange==='1d'?24*3600e3:phRange==='7d'?7*24*3600e3:phRange==='1m'?30*24*3600e3:phRange==='3m'?90*24*3600e3:3600e3;
                  const scale = windowMs / ((e.currentTarget as HTMLDivElement).clientWidth || 1);
                  setPhAnchor(dragRef.current.startAnchor + dx * scale);
                } else {
                  const [min0,max0]=[dragRef.current.startYMin, dragRef.current.startYMax];
                  const range = max0 - min0;
                  const perPx = range / ((e.currentTarget as HTMLDivElement).clientHeight || 1);
                  setPhY([Number((min0+dy*perPx).toFixed(2)), Number((max0+dy*perPx).toFixed(2))]);
                }
              }}
              onTouchEnd={(e)=>{ dragRef.current=null; (e.currentTarget as HTMLDivElement).classList.remove('dragging'); }}
            />
            <MetricPanel
              title="pH"
              unitLabel={scopedParams.ph.unit}
              data={phSeries.map(d=>({ t: d.time, v: d.value, avg: d.avg }))}
              yDomain={phY as any}
              avgOn={scopedParams.ph.avgOn}
              trendOn={scopedParams.ph.trendOn}
              trendSegPct={scopedParams.ph.trendSegPct}
              deltaY={scopedParams.ph.deltaY}
              bounds={{ low: scopedBounds.ph.low, high: scopedBounds.ph.high } as any}
              critPct={phCritOn ? phCritPct : undefined}
              color="#8b5cf6"
              trendWindowMs={scopedParams.ph.trendWindowMs}
              rangeKey={phRange}
            />
          </div>
        </div>
      </div>
      {/* Row 5: H2O dosage history and control */}
      <div className="section" style={{ marginTop: 12 }}>
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Débit H₂O — Historique (L/h)</h3>
            <div className="segmented">
              {(['3h','1d','7d','1m','3m','all'] as const).map(r => (
                <button key={r} className={`seg-btn ${h2oRange===r?'active':''}`} onClick={() => { setH2oRange(r); localStorage.setItem(`range:${id}:h2o`, r); }}>{r==='3h'?'3H':r==='1d'?'1D':r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
              ))}
              <button className="seg-btn" title="Paramètres" onClick={() => setShowMenu('h2o')}>…</button>
            </div>
          </div>
          <div className="chart">
            <ResponsiveContainer>
              <MetricPanel
                title="Débit H₂O"
              unitLabel={scopedParams.h2o.unit}
                data={h2oPanelData}
                yDomain={h2oYConv as any}
                avgOn={isOnline ? scopedParams.h2o.avgOn : false}
                trendOn={isOnline ? scopedParams.h2o.trendOn : false}
                trendSegPct={scopedParams.h2o.trendSegPct}
                deltaY={scopedParams.h2o.deltaY}
                bounds={isOnline ? (h2oBoundsConv as any) : undefined}
                critPct={isOnline && h2oCritOn ? h2oCritPct : undefined}
                color="#3b82f6"
                trendWindowMs={scopedParams.h2o.trendWindowMs}
                rangeKey={h2oRange}
              />
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <h3>Contrôle doseuse H₂O</h3>
          <div className="chart" style={{ display: 'flex', alignItems: 'center' }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <label>Débit (L/h)</label>
              <input style={{ width: 120 }} type="number" step="0.001" value={doseRateLph} onChange={(e)=> setDoseRateLph(Number(e.target.value))} />
            <span className="muted">Actuel: {doseRateLph.toFixed(3)} L/h</span>
            </div>
          </div>
        </div>
      </div>
      {/* Row 6: Silice (%) and Grains (%) */}
      <div className="section" style={{ marginTop: 12 }}>
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Silice (%)</h3>
            <div className="segmented">
              {(['3h','1d','7d','1m','3m','all'] as const).map(r => (
                <button key={r} className={`seg-btn ${siliceRange===r?'active':''}`} onClick={() => { setSiliceRange(r); localStorage.setItem(`range:${id}:silice`, r); }}>{r==='3h'?'3H':r==='1d'?'1D':r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
              ))}
              <button className="seg-btn" title="Paramètres" onClick={() => setShowMenu('silice')}>…</button>
            </div>
          </div>
          {showMenu==='silice' && (
            <ParamsModal
              title="Paramètres Silice"
              specificStart={specificStart}
              specificEnd={specificEnd}
              setSpecificStart={setSpecificStart}
              setSpecificEnd={setSpecificEnd}
              onSetRangeSpecific={()=> { setSiliceRange('specific'); localStorage.setItem(`range:${id}:silice`, 'specific'); }}
              unit={scopedParams.silice.unit}
              unitOptions={["%"]}
              setUnit={(u)=> setParams('silice', { unit: u })}
              avgOn={scopedParams.silice.avgOn}
              setAvgOn={(v)=> setParams('silice', { avgOn: v })}
              trendOn={scopedParams.silice.trendOn}
              setTrendOn={(v)=> setParams('silice', { trendOn: v })}
              deltaY={scopedParams.silice.deltaY}
              setDeltaY={(n)=> setParams('silice', { deltaY: n })}
              low={scopedBounds.silice.low}
              high={scopedBounds.silice.high}
              setLow={(n)=> setBoundsFor(id || '', 'silice', { ...scopedBounds.silice, low: n })}
              setHigh={(n)=> setBoundsFor(id || '', 'silice', { ...scopedBounds.silice, high: n })}
              critOn={siliceCritOn}
              setCritOn={setSiliceCritOn}
              critPct={siliceCritPct}
              setCritPct={setSiliceCritPct}
              onClose={()=> setShowMenu(null)}
            />
          )}
          <div className="chart">
            <ResponsiveContainer>
              <MetricPanel
                title="Silice"
                unitLabel={scopedParams.silice.unit}
                data={[]}
                avgOn={scopedParams.silice.avgOn}
                trendOn={scopedParams.silice.trendOn}
                deltaY={scopedParams.silice.deltaY}
                color="#a78bfa"
                trendWindowMs={scopedParams.silice.trendWindowMs}
                rangeKey={siliceRange}
              />
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Grains (%)</h3>
            <div className="segmented">
              {(['3h','1d','7d','1m','3m','all'] as const).map(r => (
                <button key={r} className={`seg-btn ${grainsRange===r?'active':''}`} onClick={() => { setGrainsRange(r); localStorage.setItem(`range:${id}:grains`, r); }}>{r==='3h'?'3H':r==='1d'?'1D':r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
              ))}
              <button className="seg-btn" title="Paramètres" onClick={() => setShowMenu('grains')}>…</button>
            </div>
          </div>
          {showMenu==='grains' && (
            <ParamsModal
              title="Paramètres Grains"
              specificStart={specificStart}
              specificEnd={specificEnd}
              setSpecificStart={setSpecificStart}
              setSpecificEnd={setSpecificEnd}
              onSetRangeSpecific={()=> { setGrainsRange('specific'); localStorage.setItem(`range:${id}:grains`, 'specific'); }}
              unit={scopedParams.grains.unit}
              unitOptions={["%"]}
              setUnit={(u)=> setParams('grains', { unit: u })}
              avgOn={scopedParams.grains.avgOn}
              setAvgOn={(v)=> setParams('grains', { avgOn: v })}
              trendOn={scopedParams.grains.trendOn}
              setTrendOn={(v)=> setParams('grains', { trendOn: v })}
              deltaY={scopedParams.grains.deltaY}
              setDeltaY={(n)=> setParams('grains', { deltaY: n })}
              low={scopedBounds.grains.low}
              high={scopedBounds.grains.high}
              setLow={(n)=> setBoundsFor(id || '', 'grains', { ...scopedBounds.grains, low: n })}
              setHigh={(n)=> setBoundsFor(id || '', 'grains', { ...scopedBounds.grains, high: n })}
              critOn={grainsCritOn}
              setCritOn={setGrainsCritOn}
              critPct={grainsCritPct}
              setCritPct={setGrainsCritPct}
              onClose={()=> setShowMenu(null)}
            />
          )}
          <div className="chart">
            <ResponsiveContainer>
              <MetricPanel
                title="Grains"
                unitLabel={scopedParams.grains.unit}
                data={[]}
                avgOn={scopedParams.grains.avgOn}
                trendOn={scopedParams.grains.trendOn}
                deltaY={scopedParams.grains.deltaY}
                color="#60a5fa"
                trendWindowMs={scopedParams.grains.trendWindowMs}
                rangeKey={grainsRange}
              />
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}


