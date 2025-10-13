import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppState } from '../store/appState';
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';

function formatTime(ts: number) {
  const d = new Date(ts); return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}
function formatDateTime(ts: number) {
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

export default function Detail() {
  const { id } = useParams();
  const { seriesM7, bounds, setBounds, startMassTest, overrideLog, addOverride, addManualSample, live, setLive, getSeriesForRange, getSeriesBetween, doseRateLph, setDoseRateLph, coverPowerHistory, addCoverPowerResult, setLastPlaqueSrc, doseRateHistory } = useAppState();
  const [massSeries, setMassSeries] = useState<{ t: number; v: number }[] | null>(null);
  const [testState, setTestState] = useState<'idle' | 'trempe' | 'egouttage' | 'mesure' | 'termine'>('idle');
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
  const [pcRange, setPcRange] = useState<'7d' | '1m' | '3m' | 'all'>('7d');
  const [specificTs, setSpecificTs] = useState<string>('');
  const [showMenu, setShowMenu] = useState<string | null>(null);

  const densSource = densRange === 'all' ? seriesM7.densite : getSeriesForRange(densRange, densAnchor ?? (specificTs ? Date.parse(specificTs) : undefined)).densite;
  const viscSource = viscRange === 'all' ? seriesM7.viscosite : getSeriesForRange(viscRange, viscAnchor ?? (specificTs ? Date.parse(specificTs) : undefined)).viscosite;
  const tempSource = tempRange === 'all' ? seriesM7.temperature : getSeriesForRange(tempRange, tempAnchor ?? (specificTs ? Date.parse(specificTs) : undefined)).temperature;
  const phSource = phRange === 'all' ? seriesM7.ph : getSeriesForRange(phRange, phAnchor ?? (specificTs ? Date.parse(specificTs) : undefined)).ph;
  const densiteData = useMemo(() => densSource.map(p => ({ time: p.t, value: Number(p.v.toFixed(3)) })), [densSource]);
  const viscositeData = useMemo(() => viscSource.map(p => ({ time: p.t, value: Math.round(p.v) })), [viscSource]);
  const phData = useMemo(() => phSource.map(p => ({ time: p.t, value: Number(p.v.toFixed(2)) })), [phSource]);
  const tempData = useMemo(() => tempSource.map(p => ({ time: p.t, value: Number(p.v.toFixed(2)) })), [tempSource]);
  const pcHistData = useMemo(() => {
    const now = Date.now();
    const ms = pcRange === '7d' ? 7*24*60*60*1000 : pcRange === '1m' ? 30*24*60*60*1000 : pcRange === '3m' ? 90*24*60*60*1000 : 365*24*60*60*1000;
    const start = now - ms;
    return coverPowerHistory.filter(p => p.t >= start);
  }, [coverPowerHistory, pcRange]);

  const reco = viscositeData.length ? (viscositeData[viscositeData.length - 1].value > bounds.viscosite.high ? 'Ajouter eau' : 'Ne rien faire') : '—';

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
                <button className="seg-btn" title="Plus" onClick={() => setShowMenu('densite')}>…</button>
              </div>
            </div>
          </div>
          {showMenu==='densite' && (
            <div className="modal-backdrop" onClick={() => setShowMenu(null)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3 style={{ margin: 0 }}>Options Densité</h3>
                  <button onClick={() => setShowMenu(null)}>Fermer</button>
                </div>
                <div className="modal-body">
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <label>Période personnalisée:</label>
                    <input type="datetime-local" onChange={e => { setSpecificTs(e.target.value); setDensRange('specific'); }} />
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <label>Conformité min/max:</label>
                    <input style={{ width: 90 }} value={bounds.densite.low} onChange={e => setBounds('densite', { ...bounds.densite, low: Number(e.target.value) })} />
                    <input style={{ width: 90 }} value={bounds.densite.high} onChange={e => setBounds('densite', { ...bounds.densite, high: Number(e.target.value) })} />
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <label>Unité:</label>
                    <select value={'g/cm3'} onChange={()=>{}}><option value="g/cm3">g/cm³</option></select>
                  </div>
                </div>
              </div>
            </div>
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
            />
            <ResponsiveContainer>
              <LineChart data={densiteData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                <XAxis dataKey="time" type="number" scale="time" domain={["auto","auto"]} tickFormatter={formatTime} stroke="#6b7280" />
                <YAxis domain={densY as any} stroke="#6b7280" />
                <Tooltip labelFormatter={v => formatDateTime(Number(v))} formatter={(val) => [`${val} g/cm³`, 'Densité']} />
                <ReferenceArea y1={bounds.densite.low} y2={bounds.densite.high} fill="#22c55e" fillOpacity={0.08} />
                <Line type="monotone" dataKey="value" stroke="#60a5fa" dot={false} strokeWidth={2} />
              </LineChart>
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
              <button className="seg-btn" title="Plus" onClick={() => setShowMenu('visco')}>…</button>
            </div>
          </div>
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
            />
            <ResponsiveContainer>
              <LineChart data={viscositeData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                <XAxis dataKey="time" type="number" scale="time" domain={["auto","auto"]} tickFormatter={formatTime} stroke="#6b7280" />
                <YAxis domain={viscY as any} stroke="#6b7280" />
                <Tooltip labelFormatter={v => formatDateTime(Number(v))} formatter={(val) => [`${val} mPa·s`, 'Viscosité']} />
                <ReferenceArea y1={bounds.viscosite.low} y2={bounds.viscosite.high} fill="#22c55e" fillOpacity={0.08} />
                <Line type="monotone" dataKey="value" stroke="#34d399" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
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
            </div>
          </div>
          <div className="chart" style={{ height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={pcHistData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                <XAxis dataKey="t" type="number" scale="time" domain={["auto","auto"]} tickFormatter={formatTime} stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip labelFormatter={v => formatDateTime(Number(v))} formatter={(value) => [`${value} g`, 'Pouvoir couvrant']} />
                <ReferenceArea y1={50} y2={70} fill="#22c55e" fillOpacity={0.08} />
                <Line type="monotone" dataKey="v" stroke="#38bdf8" dot={true} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Row 2 right: Pouvoir couvrant - Essai */}
        <div className="panel">
          <h3>Pouvoir couvrant - Essai (g)</h3>
          <div className="actions">
            <button onClick={() => {
              setTestState('trempe');
              setRemaining(130);
              setMassSeries(null);
              const startedAt = Date.now();
              let localSeries: { t: number; v: number }[] = [];
              const totalDurationMs = 130000;
              const interval = setInterval(() => {
                const elapsed = Date.now() - startedAt;
                const left = Math.max(0, Math.ceil((totalDurationMs - elapsed) / 1000));
                setRemaining(left);
                if (elapsed < 10000) {
                  setTestState('trempe');
                } else if (elapsed < 130000) {
                  if (testState !== 'mesure') setTestState('mesure');
                  const t = startedAt + elapsed;
                  const tSec = (elapsed - 10000) / 1000;
                  const m0 = 120; const tau = 45;
                  const value = Math.max(0, m0 * Math.exp(-tSec / tau) + (Math.random() * 2 - 1) * 0.6);
                  localSeries.push({ t, v: Number(value.toFixed(2)) });
                  if (localSeries.length % 3 === 0) setMassSeries([...localSeries]);
                }
                if (elapsed >= 130000) {
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
            {testState !== 'idle' && <span className="muted">{testState === 'trempe' ? 'Trempé 10 s' : testState === 'mesure' ? 'Mesure en cours' : testState === 'termine' ? 'Terminé' : 'Égouttage'} — reste {remaining}s</span>}
          </div>
          <div className="chart" style={{ height: 340 }}>
            <ResponsiveContainer>
              <LineChart data={(massSeries ?? []).map(p => ({ time: p.t, value: Number(p.v.toFixed(2)) }))} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                <XAxis dataKey="time" type="number" scale="time" domain={["auto","auto"]} tickFormatter={formatTime} stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip labelFormatter={v => formatDateTime(Number(v))} formatter={(value) => [`${value} g`, 'Masse']} />
                <Line type="monotone" dataKey="value" stroke="#38bdf8" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Row 4: Température (left) */}
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Température (°C)</h3>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <div className="segmented">
                {(['3h','1d','7d','1m','3m','all'] as const).map(r => (
                  <button key={r} className={`seg-btn ${tempRange===r?'active':''}`} onClick={() => setTempRange(r)}>{r==='3h'?'3H':r==='1d'?'1D':r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
                ))}
                <button className="seg-btn" title="Plus" onClick={() => setShowMenu('temp')}>…</button>
              </div>
            </div>
          </div>
          {showMenu==='temp' && (
            <div className="modal-backdrop" onClick={() => setShowMenu(null)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3 style={{ margin: 0 }}>Options Température</h3>
                  <button onClick={() => setShowMenu(null)}>Fermer</button>
                </div>
                <div className="modal-body">
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <label>Période personnalisée:</label>
                    <input type="datetime-local" onChange={e => { setSpecificTs(e.target.value); setTempRange('specific'); }} />
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <label>Conformité min/max:</label>
                    <input style={{ width: 90 }} value={bounds.temperature.low} onChange={e => setBounds('temperature', { ...bounds.temperature, low: Number(e.target.value) })} />
                    <input style={{ width: 90 }} value={bounds.temperature.high} onChange={e => setBounds('temperature', { ...bounds.temperature, high: Number(e.target.value) })} />
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <label>Unité:</label>
                    <select value={'°C'} onChange={()=>{}}><option value="°C">°C</option></select>
                  </div>
                </div>
              </div>
            </div>
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
            />
            <ResponsiveContainer>
              <LineChart data={tempData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                <XAxis dataKey="time" type="number" scale="time" domain={["auto","auto"]} tickFormatter={formatTime} stroke="#6b7280" />
                <YAxis domain={tempY as any} stroke="#6b7280" />
                <Tooltip labelFormatter={v => formatDateTime(Number(v))} />
                <ReferenceArea y1={bounds.temperature.low} y2={bounds.temperature.high} fill="#22c55e" fillOpacity={0.08} />
                <Line type="monotone" dataKey="value" stroke="#f59e0b" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Row 4 right: pH */}
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>pH</h3>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <div className="segmented">
                {(['3h','1d','7d','1m','3m','all'] as const).map(r => (
                  <button key={r} className={`seg-btn ${phRange===r?'active':''}`} onClick={() => setPhRange(r)}>{r==='3h'?'3H':r==='1d'?'1D':r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
                ))}
                <button className="seg-btn" title="Plus" onClick={() => setShowMenu('ph')}>…</button>
              </div>
            </div>
          </div>
          {showMenu==='ph' && (
            <div className="modal-backdrop" onClick={() => setShowMenu(null)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3 style={{ margin: 0 }}>Options pH</h3>
                  <button onClick={() => setShowMenu(null)}>Fermer</button>
                </div>
                <div className="modal-body">
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <label>Période personnalisée:</label>
                    <input type="datetime-local" onChange={e => { setSpecificTs(e.target.value); setPhRange('specific'); }} />
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <label>Conformité min/max:</label>
                    <input style={{ width: 90 }} value={bounds.ph.low} onChange={e => setBounds('ph', { ...bounds.ph, low: Number(e.target.value) })} />
                    <input style={{ width: 90 }} value={bounds.ph.high} onChange={e => setBounds('ph', { ...bounds.ph, high: Number(e.target.value) })} />
                  </div>
                </div>
              </div>
            </div>
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
            />
            <ResponsiveContainer>
              <LineChart data={phData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                <XAxis dataKey="time" type="number" scale="time" domain={["auto","auto"]} tickFormatter={formatTime} stroke="#6b7280" />
                <YAxis domain={phY as any} stroke="#6b7280" />
                <Tooltip labelFormatter={v => formatDateTime(Number(v))} formatter={(v)=>[`${v}`, 'pH']} />
                <ReferenceArea y1={bounds.ph.low} y2={bounds.ph.high} fill="#22c55e" fillOpacity={0.08} />
                <Line type="monotone" dataKey="value" stroke="#f472b6" dot={false} strokeWidth={2} />
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
            <div style={{ marginTop: 6 }}>
              <img src="/plaque-pickup.jpg" alt="Plaque essai" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
            </div>
          </div>
          <div className="panel">
            <h3>Analyse IA</h3>
            <div className="muted">Résultats simulés: couverture homogène, porosité dans l'intervalle attendu. (Module démo)</div>
          </div>
        </div>
      )}
      {/* Row 5: H2O dosage history and control */}
      <div className="section" style={{ marginTop: 12 }}>
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Débit H₂O — Historique (L/h)</h3>
          </div>
          <div className="chart" style={{ height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={doseRateHistory.map(p => ({ t: p.t, v: Number(p.v.toFixed(3)) }))} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                <XAxis dataKey="t" type="number" scale="time" domain={["auto","auto"]} tickFormatter={formatTime} stroke="#6b7280" />
                <YAxis stroke="#6b7280" domain={[0, Math.max(0.1, Number((doseRateLph*2).toFixed(3)))]} />
                <Tooltip labelFormatter={v => formatDateTime(Number(v))} formatter={(value) => [`${value} L/h`, 'Débit H₂O']} />
                <Line type="monotone" dataKey="v" stroke="#3b82f6" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <h3>Contrôle doseuse H₂O</h3>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <label>Débit (L/h)</label>
            <input style={{ width: 120 }} type="number" step="0.001" value={doseRateLph} onChange={(e)=> setDoseRateLph(Number(e.target.value))} />
            <span className="muted">Actuel: {doseRateLph.toFixed(3)} L/h</span>
          </div>
        </div>
      </div>
    </div>
  );
}


