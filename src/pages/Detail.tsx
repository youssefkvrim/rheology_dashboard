import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppState } from '../store/appState';
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine } from 'recharts';
import { useChartParams } from '../store/chartParams';
import { ParamsModal } from '../components/ParamsModal';
import { MetricPanel } from '../components/MetricPanel';
import { densConverters, viscConverters, tempConverters, h2oConverters, pcConverters } from '../utils/units';

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
  const { seriesM7, bounds, setBounds, startMassTest, overrideLog, addOverride, addManualSample, live, setLive, getSeriesForRange, getSeriesBetween, doseRateLph, setDoseRateLph, coverPowerHistory, addCoverPowerResult, lastPlaqueSrc, setLastPlaqueSrc, doseRateHistory } = useAppState();
  const { params, setParams } = useChartParams();
  const [massSeries, setMassSeries] = useState<{ t: number; v: number }[] | null>(null);
  const [testState, setTestState] = useState<'idle' | 'calib' | 'trempe' | 'egouttage' | 'mesure' | 'termine'>('idle');
  const [remaining, setRemaining] = useState<number>(0);
  const [overrideText, setOverrideText] = useState('');
  const [overrideJustif, setOverrideJustif] = useState('');
  const [manual, setManual] = useState<{ densite?: string; viscosite?: string; ph?: string; temperature?: string }>({});
  const [densRange, setDensRange] = useState<'all' | '3h' | '1d' | '7d' | '1m' | '3m' | 'specific'>('3h');
  const [viscRange, setViscRange] = useState<'all' | '3h' | '1d' | '7d' | '1m' | '3m' | 'specific'>('3h');
  const [tempRange, setTempRange] = useState<'all' | '3h' | '1d' | '7d' | '1m' | '3m' | 'specific'>('3h');
  const [phRange, setPhRange] = useState<'all' | '3h' | '1d' | '7d' | '1m' | '3m' | 'specific'>('3h');
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
  const [pcRange, setPcRange] = useState<'7d' | '1m' | '3m' | 'all' | 'specific'>('7d');
  const [pcBounds, setPcBounds] = useState<{ low: number | null; high: number | null }>({ low: null, high: null });
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
  const [h2oRange, setH2oRange] = useState<'3h'|'7d'|'3m'|'all'>('3h');
  const [h2oBounds, setH2oBounds] = useState<{ low: number | null; high: number | null }>({ low: null, high: null });
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
  const [siliceRange, setSiliceRange] = useState<'all'|'3h'|'1d'|'7d'|'1m'|'3m'|'specific'>('3h');
  const [grainsRange, setGrainsRange] = useState<'all'|'3h'|'1d'|'7d'|'1m'|'3m'|'specific'>('3h');
  const [siliceBounds, setSiliceBounds] = useState<{ low: number | null; high: number | null }>({ low: null, high: null });
  const [grainsBounds, setGrainsBounds] = useState<{ low: number | null; high: number | null }>({ low: null, high: null });
  const [siliceAvgOn, setSiliceAvgOn] = useState<boolean>(true);
  const [grainsAvgOn, setGrainsAvgOn] = useState<boolean>(true);
  const [siliceCritOn, setSiliceCritOn] = useState<boolean>(true);
  const [siliceCritPct, setSiliceCritPct] = useState<number>(30);
  const [grainsCritOn, setGrainsCritOn] = useState<boolean>(true);
  const [grainsCritPct, setGrainsCritPct] = useState<number>(30);

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
  const densSource = densRange === 'all' ? seriesM7.densite : densRange === 'specific' ? getSeriesBetween(specStart, specEnd).densite : getSeriesForRange(densRange, densAnchor).densite;
  const viscSource = viscRange === 'all' ? seriesM7.viscosite : viscRange === 'specific' ? getSeriesBetween(specStart, specEnd).viscosite : getSeriesForRange(viscRange, viscAnchor).viscosite;
  const tempSource = tempRange === 'all' ? seriesM7.temperature : tempRange === 'specific' ? getSeriesBetween(specStart, specEnd).temperature : getSeriesForRange(tempRange, tempAnchor).temperature;
  const phSource = phRange === 'all' ? seriesM7.ph : phRange === 'specific' ? getSeriesBetween(specStart, specEnd).ph : getSeriesForRange(phRange, phAnchor).ph;
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
  const densConv = useMemo(() => densConverters(params.densite.unit), [params.densite.unit]);
  const densPanelData = useMemo(() => densSeries.map(d => ({ t: d.time, v: densConv.to(d.value), avg: d.avg != null ? densConv.to(d.avg) : undefined })), [densSeries, densConv]);
  const densYConv = useMemo(() => [densConv.to(densY[0]), densConv.to(densY[1])] as [number, number], [densY, densConv]);
  const densBoundsConv = useMemo(() => ({ low: bounds.densite.low==null?null:densConv.to(bounds.densite.low as number), high: bounds.densite.high==null?null:densConv.to(bounds.densite.high as number) }), [bounds.densite, densConv]);

  const viscConv = useMemo(() => viscConverters(params.viscosite.unit), [params.viscosite.unit]);
  const viscPanelData = useMemo(() => viscSeries.map(d => ({ t: d.time, v: viscConv.to(d.value), avg: d.avg != null ? viscConv.to(d.avg) : undefined })), [viscSeries, viscConv]);
  const viscYConv = useMemo(() => [viscConv.to(viscY[0]), viscConv.to(viscY[1])] as [number, number], [viscY, viscConv]);
  const viscBoundsConv = useMemo(() => ({ low: bounds.viscosite.low==null?null:viscConv.to(bounds.viscosite.low as number), high: bounds.viscosite.high==null?null:viscConv.to(bounds.viscosite.high as number) }), [bounds.viscosite, viscConv]);

  const tempConv = useMemo(() => tempConverters(params.temperature.unit), [params.temperature.unit]);
  const tempPanelData = useMemo(() => tempSeries.map(d => ({ t: d.time, v: tempConv.to(d.value), avg: d.avg != null ? tempConv.to(d.avg) : undefined })), [tempSeries, tempConv]);
  const tempYConv = useMemo(() => [tempConv.to(tempY[0]), tempConv.to(tempY[1])] as [number, number], [tempY, tempConv]);
  const tempBoundsConv = useMemo(() => ({ low: bounds.temperature.low==null?null:tempConv.to(bounds.temperature.low as number), high: bounds.temperature.high==null?null:tempConv.to(bounds.temperature.high as number) }), [bounds.temperature, tempConv]);

  const phPanelData = useMemo(() => phSeries.map(d => ({ t: d.time, v: d.value, avg: d.avg })), [phSeries]);
  const h2oConv = useMemo(() => h2oConverters(params.h2o.unit), [params.h2o.unit]);
  const h2oPanelData = useMemo(() => {
    const now = Date.now();
    let start = now - 3*60*60*1000;
    if (h2oRange==='7d') start = now - 7*24*60*60*1000; else if (h2oRange==='3m') start = now - 90*24*60*60*1000; else if (h2oRange==='all') start = 0;
    const data = doseRateHistory.filter(p=>p.t>=start).map(p => ({ t: p.t, v: Number(p.v.toFixed(3)) }));
    const avg = data.length ? Number((data.reduce((s,d)=>s+d.v,0)/data.length).toFixed(3)) : null;
    return data.map(d => ({ t: d.t, v: h2oConv.to(d.v), avg: avg != null ? h2oConv.to(avg) : undefined }));
  }, [doseRateHistory, h2oRange, h2oConv]);
  const h2oYConv = useMemo(() => [h2oConv.to(0), h2oConv.to(0.05)] as [number, number], [h2oConv]);
  const h2oBoundsConv = useMemo(() => ({ low: h2oBounds.low==null?null:h2oConv.to(h2oBounds.low as number), high: h2oBounds.high==null?null:h2oConv.to(h2oBounds.high as number) }), [h2oBounds, h2oConv]);

  const pcConv = useMemo(() => pcConverters(params.pc.unit), [params.pc.unit]);
  const pcHistData = useMemo(() => {
    const now = Date.now();
    if (pcRange === 'specific') {
      return coverPowerHistory.filter(p => p.t >= specStart && p.t <= specEnd);
    }
    const ms = pcRange === '7d' ? 7*24*60*60*1000 : pcRange === '1m' ? 30*24*60*60*1000 : pcRange === '3m' ? 90*24*60*60*1000 : 365*24*60*60*1000;
    const start = now - ms;
    return coverPowerHistory.filter(p => p.t >= start);
  }, [coverPowerHistory, pcRange, specStart, specEnd]);
  const pcPanelData = useMemo(() => {
    const avg = pcHistData.length ? Number((pcHistData.reduce((s,d)=>s+d.v,0)/pcHistData.length).toFixed(3)) : null;
    return pcHistData.map(d => ({ t: d.t, v: pcConv.to(d.v), avg: avg != null ? pcConv.to(avg) : undefined }));
  }, [pcHistData, pcConv]);

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
          <span className="muted">Mise à jour en direct</span>
          <button className="switch" data-on={live} aria-label="Live" onClick={() => setLive(!live)}>
            <span className="knob" />
          </button>
        </div>
        {showMenu==='h2o' && renderParamsModal('h2o', 'Paramètres Débit H₂O', {
          onClose: () => setShowMenu(null),
          onSetRangeSpecific: () => setH2oRange('3h'),
          unit: 'L/h',
          avgOn: h2oAvgOn,
          setAvgOn: setH2oAvgOn,
          critOn: h2oCritOn,
          setCritOn: setH2oCritOn,
          critPct: h2oCritPct,
          setCritPct: setH2oCritPct,
          low: h2oBounds.low,
          high: h2oBounds.high,
          setLow: (n) => setH2oBounds(prev=>({ ...prev, low: n })),
          setHigh: (n) => setH2oBounds(prev=>({ ...prev, high: n })),
          draftKey: 'h2o'
        })}
      </div>
      <div className="section" style={{ marginTop: 12 }}>
        {/* Row 1: Densité (left) */}
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Densité (g/cm³)</h3>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <div className="segmented">
              {(['3h','1d','7d','1m','3m','all'] as const).map(r => (
                  <button key={r} className={`seg-btn ${densRange===r?'active':''}`} onClick={() => setDensRange(r)}>{r==='3h'?'3H':r==='1d'?'1D':r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
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
              onSetRangeSpecific={() => setDensRange('specific')}
              unit={params.densite.unit}
              unitOptions={["kg/m³","g/cm³","g/mL","kg/L","g/L","mg/mL"]}
              setUnit={(u)=> setParams('densite', { unit: u })}
              avgOn={params.densite.avgOn}
              setAvgOn={(v)=> setParams('densite', { avgOn: v })}
              trendOn={params.densite.trendOn}
              setTrendOn={(v)=> setParams('densite', { trendOn: v })}
              deltaY={params.densite.deltaY}
              setDeltaY={(n)=> setParams('densite', { deltaY: n })}
              low={bounds.densite.low}
              high={bounds.densite.high}
              setLow={(n)=> setBounds('densite', { ...bounds.densite, low: n })}
              setHigh={(n)=> setBounds('densite', { ...bounds.densite, high: n })}
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
                unitLabel={params.densite.unit}
                data={densPanelData}
                yDomain={densYConv as any}
                avgOn={params.densite.avgOn}
                trendOn={params.densite.trendOn}
                deltaY={params.densite.deltaY}
                bounds={densBoundsConv as any}
                critPct={densCritOn ? densCritPct : undefined}
                color="#60a5fa"
                trendWindowMs={params.densite.trendWindowMs}
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
                <button key={r} className={`seg-btn ${viscRange===r?'active':''}`} onClick={() => setViscRange(r)}>{r==='3h'?'3H':r==='1d'?'1D':r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
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
              onSetRangeSpecific={()=> setViscRange('specific')}
              unit={params.viscosite.unit}
              unitOptions={["Pa·s","mPa·s","cP","P","St","cSt","s"]}
              setUnit={(u)=> setParams('viscosite', { unit: u })}
              avgOn={params.viscosite.avgOn}
              setAvgOn={(v)=> setParams('viscosite', { avgOn: v })}
              trendOn={params.viscosite.trendOn}
              setTrendOn={(v)=> setParams('viscosite', { trendOn: v })}
              deltaY={params.viscosite.deltaY}
              setDeltaY={(n)=> setParams('viscosite', { deltaY: n })}
              low={bounds.viscosite.low}
              high={bounds.viscosite.high}
              setLow={(n)=> setBounds('viscosite', { ...bounds.viscosite, low: n })}
              setHigh={(n)=> setBounds('viscosite', { ...bounds.viscosite, high: n })}
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
              unitLabel={params.viscosite.unit}
              data={viscPanelData}
              yDomain={viscYConv as any}
              avgOn={params.viscosite.avgOn}
              trendOn={params.viscosite.trendOn}
              deltaY={params.viscosite.deltaY}
              bounds={viscBoundsConv as any}
              critPct={viscCritOn ? viscCritPct : undefined}
              color="#34d399"
              trendWindowMs={params.viscosite.trendWindowMs}
            />
          </div>
        </div>
        {/* Row 2 left: Pouvoir couvrant - Historique */}
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Pouvoir couvrant - Historique (g)</h3>
            <div className="segmented">
              {(['7d','1m','3m','all'] as const).map(r => (
                <button key={r} className={`seg-btn ${pcRange===r?'active':''}`} onClick={() => setPcRange(r)}>{r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
              ))}
              <button className="seg-btn" title="Paramètres" onClick={() => setShowMenu('pc-hist')}>…</button>
            </div>
          </div>
          <div className="chart">
            <ResponsiveContainer>
              <MetricPanel
                title="Pouvoir couvrant"
                unitLabel={params.pc.unit}
                data={pcPanelData}
                avgOn={params.pc.avgOn}
                trendOn={params.pc.trendOn}
                deltaY={params.pc.deltaY}
                bounds={{ low: pcBounds.low, high: pcBounds.high } as any}
              critPct={pcCritOn ? pcCritPct : undefined}
                color="#38bdf8"
                trendWindowMs={params.pc.trendWindowMs}
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
             onSetRangeSpecific={()=> setPcRange('specific')}
             unit={params.pc.unit}
             unitOptions={["g","g/cm²"]}
             setUnit={(u)=> setParams('pc', { unit: u })}
             avgOn={params.pc.avgOn}
             setAvgOn={(v)=> setParams('pc', { avgOn: v })}
             trendOn={params.pc.trendOn}
             setTrendOn={(v)=> setParams('pc', { trendOn: v })}
             deltaY={params.pc.deltaY}
             setDeltaY={(n)=> setParams('pc', { deltaY: n })}
             low={pcBounds.low}
             high={pcBounds.high}
             setLow={(n)=> setPcBounds(prev => ({ ...prev, low: n }))}
             setHigh={(n)=> setPcBounds(prev => ({ ...prev, high: n }))}
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
                    setLastPlaqueSrc('/plaque-pickup.jpg');
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
              <a style={{ width: 320, height: 320, cursor: 'pointer' }} href={(lastPlaqueSrc || '/plaque-pickup.jpg')} target="_blank" rel="noreferrer">
                <picture>
                  <source srcSet={(lastPlaqueSrc || '/plaque-pickup.webp').replace('.jpg', '.webp')} type="image/webp" />
                  <img src={lastPlaqueSrc || '/plaque-pickup.jpg'} alt="Plaque essai" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                </picture>
              </a>
            </div>
          </div>
          <div className="panel">
            <h3>Analyse IA</h3>
            <div className="chart" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <a style={{ width: 320, height: 320, cursor: 'pointer', position: 'relative' }} href={'/plaque-pickup_analysed.webp'} target="_blank" rel="noreferrer">
                <picture>
                  <source srcSet={'/plaque-pickup_analysed.webp'} type="image/webp" />
                  <img src={'/plaque-pickup_analysed.webp'} alt="Plaque analysée" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                </picture>
                <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(16,22,83,0.9)', color: '#e5e7eb', padding: '6px 8px', borderRadius: 6, fontSize: 12, lineHeight: 1.2 }}>
                  <div><strong>Count :</strong> 209</div>
                  <div><strong>Avg diameter :</strong> 1.2 mm</div>
                </div>
                <div style={{ position: 'absolute', bottom: 8, right: 8, color: '#e5e7eb', textAlign: 'center' }}>
                  <div style={{ width: 64, height: 6, background: '#ffffff', borderRadius: 3, marginLeft: 'auto' }} />
                  <div style={{ fontSize: 12, marginTop: 4 }}>0.8 cm</div>
                </div>
              </a>
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
                <a className="dropdown-item" href={imageModal === 'ai' ? '/plaque-pickup_analysed.webp' : (lastPlaqueSrc || '/plaque-pickup.jpg')} target="_blank" rel="noreferrer">Ouvrir dans un nouvel onglet</a>
                <button onClick={() => setImageModal(null)}>Fermer</button>
              </div>
            </div>
            <div className="modal-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <picture>
                {imageModal === 'ai' ? (
                  <source srcSet={'/plaque-pickup_analysed.webp'} type="image/webp" />
                ) : (
                  <source srcSet={(lastPlaqueSrc || '/plaque-pickup.webp').replace('.jpg', '.webp')} type="image/webp" />
                )}
                <img src={imageModal === 'ai' ? '/plaque-pickup_analysed.webp' : (lastPlaqueSrc || '/plaque-pickup.jpg')} alt={imageModal === 'ai' ? 'Plaque analysée' : 'Plaque essai'} style={{ maxWidth: '95vw', maxHeight: '80vh', borderRadius: 8, border: '1px solid var(--border)' }} />
              </picture>
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
                  <button key={r} className={`seg-btn ${tempRange===r?'active':''}`} onClick={() => setTempRange(r)}>{r==='3h'?'3H':r==='1d'?'1D':r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
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
              onSetRangeSpecific={()=> setTempRange('specific')}
              unit={params.temperature.unit}
              unitOptions={["°C","°F","K"]}
              setUnit={(u)=> setParams('temperature', { unit: u })}
              avgOn={params.temperature.avgOn}
              setAvgOn={(v)=> setParams('temperature', { avgOn: v })}
              trendOn={params.temperature.trendOn}
              setTrendOn={(v)=> setParams('temperature', { trendOn: v })}
              deltaY={params.temperature.deltaY}
              setDeltaY={(n)=> setParams('temperature', { deltaY: n })}
              low={bounds.temperature.low}
              high={bounds.temperature.high}
              setLow={(n)=> setBounds('temperature', { ...bounds.temperature, low: n })}
              setHigh={(n)=> setBounds('temperature', { ...bounds.temperature, high: n })}
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
              unitLabel={params.temperature.unit}
              data={tempPanelData}
              yDomain={tempYConv as any}
              avgOn={params.temperature.avgOn}
              trendOn={params.temperature.trendOn}
              deltaY={params.temperature.deltaY}
              bounds={tempBoundsConv as any}
              critPct={tempCritOn ? tempCritPct : undefined}
              color="#f59e0b"
              trendWindowMs={params.temperature.trendWindowMs}
            />
          </div>
        </div>
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>pH</h3>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <div className="segmented">
                {(['3h','1d','7d','1m','3m','all'] as const).map(r => (
                  <button key={r} className={`seg-btn ${phRange===r?'active':''}`} onClick={() => setPhRange(r)}>{r==='3h'?'3H':r==='1d'?'1D':r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
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
              onSetRangeSpecific={()=> setPhRange('specific')}
              unit={params.ph.unit}
              unitOptions={["(-)"]}
              setUnit={(u)=> setParams('ph', { unit: u })}
              avgOn={params.ph.avgOn}
              setAvgOn={(v)=> setParams('ph', { avgOn: v })}
              trendOn={params.ph.trendOn}
              setTrendOn={(v)=> setParams('ph', { trendOn: v })}
              deltaY={params.ph.deltaY}
              setDeltaY={(n)=> setParams('ph', { deltaY: n })}
              low={bounds.ph.low}
              high={bounds.ph.high}
              setLow={(n)=> setBounds('ph', { ...bounds.ph, low: n })}
              setHigh={(n)=> setBounds('ph', { ...bounds.ph, high: n })}
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
              unitLabel={params.ph.unit}
              data={phSeries.map(d=>({ t: d.time, v: d.value, avg: d.avg }))}
              yDomain={phY as any}
              avgOn={params.ph.avgOn}
              trendOn={params.ph.trendOn}
              deltaY={params.ph.deltaY}
              bounds={{ low: bounds.ph.low, high: bounds.ph.high } as any}
              critPct={phCritOn ? phCritPct : undefined}
              color="#8b5cf6"
              trendWindowMs={params.ph.trendWindowMs}
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
              {(['3h','7d','3m','all'] as const).map(r => (
                <button key={r} className={`seg-btn ${h2oRange===r?'active':''}`} onClick={() => setH2oRange(r)}>{r.toUpperCase()}</button>
              ))}
              <button className="seg-btn" title="Paramètres" onClick={() => setShowMenu('h2o')}>…</button>
            </div>
          </div>
          <div className="chart">
            <ResponsiveContainer>
              <MetricPanel
                title="Débit H₂O"
                unitLabel={params.h2o.unit}
                data={h2oPanelData}
                yDomain={h2oYConv as any}
                avgOn={params.h2o.avgOn}
                trendOn={params.h2o.trendOn}
                deltaY={params.h2o.deltaY}
                bounds={h2oBoundsConv as any}
                critPct={h2oCritOn ? h2oCritPct : undefined}
                color="#3b82f6"
                trendWindowMs={params.h2o.trendWindowMs}
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
                <button key={r} className={`seg-btn ${siliceRange===r?'active':''}`} onClick={() => setSiliceRange(r)}>{r==='3h'?'3H':r==='1d'?'1D':r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
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
              onSetRangeSpecific={()=> setSiliceRange('specific')}
              unit={params.silice.unit}
              unitOptions={["%"]}
              setUnit={(u)=> setParams('silice', { unit: u })}
              avgOn={params.silice.avgOn}
              setAvgOn={(v)=> setParams('silice', { avgOn: v })}
              trendOn={params.silice.trendOn}
              setTrendOn={(v)=> setParams('silice', { trendOn: v })}
              deltaY={params.silice.deltaY}
              setDeltaY={(n)=> setParams('silice', { deltaY: n })}
              low={siliceBounds.low}
              high={siliceBounds.high}
              setLow={(n)=> setSiliceBounds(prev => ({ ...prev, low: n }))}
              setHigh={(n)=> setSiliceBounds(prev => ({ ...prev, high: n }))}
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
                unitLabel={params.silice.unit}
                data={[]}
                avgOn={params.silice.avgOn}
                trendOn={params.silice.trendOn}
                deltaY={params.silice.deltaY}
                color="#a78bfa"
                trendWindowMs={params.silice.trendWindowMs}
              />
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Grains (%)</h3>
            <div className="segmented">
              {(['3h','1d','7d','1m','3m','all'] as const).map(r => (
                <button key={r} className={`seg-btn ${grainsRange===r?'active':''}`} onClick={() => setGrainsRange(r)}>{r==='3h'?'3H':r==='1d'?'1D':r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
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
              onSetRangeSpecific={()=> setGrainsRange('specific')}
              unit={params.grains.unit}
              unitOptions={["%"]}
              setUnit={(u)=> setParams('grains', { unit: u })}
              avgOn={params.grains.avgOn}
              setAvgOn={(v)=> setParams('grains', { avgOn: v })}
              trendOn={params.grains.trendOn}
              setTrendOn={(v)=> setParams('grains', { trendOn: v })}
              deltaY={params.grains.deltaY}
              setDeltaY={(n)=> setParams('grains', { deltaY: n })}
              low={grainsBounds.low}
              high={grainsBounds.high}
              setLow={(n)=> setGrainsBounds(prev => ({ ...prev, low: n }))}
              setHigh={(n)=> setGrainsBounds(prev => ({ ...prev, high: n }))}
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
                unitLabel={params.grains.unit}
                data={[]}
                avgOn={params.grains.avgOn}
                trendOn={params.grains.trendOn}
                deltaY={params.grains.deltaY}
                color="#60a5fa"
                trendWindowMs={params.grains.trendWindowMs}
              />
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}


