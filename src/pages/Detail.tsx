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
  const [pcRange, setPcRange] = useState<'7d' | '1m' | '3m' | 'all'>('7d');
  const [specificTs, setSpecificTs] = useState<string>('');
  const [showMenu, setShowMenu] = useState<string | null>(null);

  // Pan/zoom support with fixed-duration windows
  function rangeToMs(r: '3h' | '1d' | '7d' | '1m' | '3m' | 'all' | 'specific'): number {
    if (r === '3h') return 3 * 60 * 60 * 1000;
    if (r === '1d') return 24 * 60 * 60 * 1000;
    if (r === '7d') return 7 * 24 * 60 * 60 * 1000;
    if (r === '1m') return 30 * 24 * 60 * 60 * 1000;
    if (r === '3m') return 90 * 24 * 60 * 60 * 1000;
    // Treat 'all' as a long window for panning; 'specific' uses explicit anchor
    return 365 * 24 * 60 * 60 * 1000;
  }

  // Per-chart window end anchors (keeps window size constant when panning)
  const [densEndTs, setDensEndTs] = useState<number>(() => Date.now());
  const [viscEndTs, setViscEndTs] = useState<number>(() => Date.now());
  const [tempEndTs, setTempEndTs] = useState<number>(() => Date.now());
  const [phEndTs, setPhEndTs] = useState<number>(() => Date.now());
  const [doseRange, setDoseRange] = useState<'3h' | '1d' | '7d' | '1m' | '3m' | 'all'>('3h');
  const [doseEndTs, setDoseEndTs] = useState<number>(() => Date.now());
  const [pcEndTs, setPcEndTs] = useState<number>(() => Date.now());

  // Reset anchors on range change to snap to "now"
  const resetAnchorNow = () => Date.now();

  // Y domains with pan support
  const [densY, setDensY] = useState<[number, number]>([1.2, 1.5]);
  const [viscY, setViscY] = useState<[number, number]>([250, 700]);
  const [tempY, setTempY] = useState<[number, number]>([15, 35]);
  const [phY, setPhY] = useState<[number, number]>([6.5, 9.8]);
  const [doseY, setDoseY] = useState<[number, number]>([0, 0.1]);
  const [pcY, setPcY] = useState<[number, number]>([40, 80]);

  // Chart refs for measuring size during pan
  const densRef = useRef<HTMLDivElement | null>(null);
  const viscRef = useRef<HTMLDivElement | null>(null);
  const tempRef = useRef<HTMLDivElement | null>(null);
  const phRef = useRef<HTMLDivElement | null>(null);
  const doseRef = useRef<HTMLDivElement | null>(null);
  const pcRef = useRef<HTMLDivElement | null>(null);

  const densiteData = useMemo(() => {
    const ms = densRange === 'specific' && specificTs ? 60 * 60 * 1000 : rangeToMs(densRange);
    const end = densRange === 'specific' && specificTs ? Date.parse(specificTs) + ms : densEndTs;
    const start = end - ms;
    return getSeriesBetween(start, end).densite.map(p => ({ time: p.t, value: Number(p.v.toFixed(3)) }));
  }, [densRange, specificTs, densEndTs, getSeriesBetween]);
  const viscositeData = useMemo(() => {
    const ms = viscRange === 'specific' && specificTs ? 60 * 60 * 1000 : rangeToMs(viscRange);
    const end = viscRange === 'specific' && specificTs ? Date.parse(specificTs) + ms : viscEndTs;
    const start = end - ms;
    return getSeriesBetween(start, end).viscosite.map(p => ({ time: p.t, value: Math.round(p.v) }));
  }, [viscRange, specificTs, viscEndTs, getSeriesBetween]);
  const tempData = useMemo(() => {
    const ms = tempRange === 'specific' && specificTs ? 60 * 60 * 1000 : rangeToMs(tempRange);
    const end = tempRange === 'specific' && specificTs ? Date.parse(specificTs) + ms : tempEndTs;
    const start = end - ms;
    return getSeriesBetween(start, end).temperature.map(p => ({ time: p.t, value: Number(p.v.toFixed(2)) }));
  }, [tempRange, specificTs, tempEndTs, getSeriesBetween]);
  const phData = useMemo(() => {
    const ms = phRange === 'specific' && specificTs ? 60 * 60 * 1000 : rangeToMs(phRange);
    const end = phRange === 'specific' && specificTs ? Date.parse(specificTs) + ms : phEndTs;
    const start = end - ms;
    return getSeriesBetween(start, end).ph.map(p => ({ time: p.t, value: Number(p.v.toFixed(2)) }));
  }, [phRange, specificTs, phEndTs, getSeriesBetween]);
  const pcHistData = useMemo(() => {
    const ms = pcRange === '7d' ? 7*24*60*60*1000 : pcRange === '1m' ? 30*24*60*60*1000 : pcRange === '3m' ? 90*24*60*60*1000 : 365*24*60*60*1000;
    const end = pcEndTs; const start = end - ms;
    return coverPowerHistory.filter(p => p.t >= start && p.t <= end);
  }, [coverPowerHistory, pcRange, pcEndTs]);

  const doseHistData = useMemo(() => {
    const ms = rangeToMs(doseRange);
    const end = doseEndTs;
    const start = end - ms;
    return doseRateHistory.filter(p => p.t >= start && p.t <= end);
  }, [doseRateHistory, doseRange, doseEndTs]);

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
            <div className="segmented">
              {(['3h','1d','7d','1m','3m','all'] as const).map(r => (
                <button key={r} className={`seg-btn ${densRange===r?'active':''}`} onClick={() => { setDensRange(r); setDensEndTs(resetAnchorNow()); }}>{r==='3h'?'3H':r==='1d'?'1D':r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
              ))}
              <span className="seg-sep"></span>
              <button className="seg-btn ellipsis" title="Plus" onClick={() => setShowMenu('densite')}>…</button>
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
          <div className="chart" ref={densRef} style={{ position: 'relative' }}>
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
            <div
              style={{ position: 'absolute', inset: 0, cursor: 'grab' }}
              onPointerDown={(e) => {
                const el = densRef.current; if (!el) return;
                const rect = el.getBoundingClientRect();
                const startX = e.clientX; const startY = e.clientY;
                const width = rect.width; const height = rect.height;
                const startEnd = densEndTs; const ms = (densRange === 'specific' && specificTs) ? (60 * 60 * 1000) : rangeToMs(densRange);
                const startYDom = densY;
                const onMove = (ev: PointerEvent) => {
                  const dx = ev.clientX - startX; const dy = ev.clientY - startY;
                  const deltaMs = Math.round(dx * ms / width);
                  setDensEndTs(startEnd - deltaMs);
                  if ((ev.clientX - rect.left) < 56) {
                    const [yMin,yMax] = startYDom; const valPerPixel = (yMax - yMin) / height; const dVal = dy * valPerPixel;
                    setDensY([yMin - dVal, yMax - dVal]);
                  }
                };
                const onUp = () => { window.removeEventListener('pointermove', onMove); };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp, { once: true });
              }}
            />
          </div>
        </div>
        {/* Row 1: Viscosité (right) */}
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Viscosité (mPa·s)</h3>
            <div className="segmented">
              {(['3h','1d','7d','1m','3m','all'] as const).map(r => (
                <button key={r} className={`seg-btn ${viscRange===r?'active':''}`} onClick={() => { setViscRange(r); setViscEndTs(resetAnchorNow()); }}>{r==='3h'?'3H':r==='1d'?'1D':r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
              ))}
              <span className="seg-sep"></span>
              <button className="seg-btn ellipsis" title="Plus" onClick={() => setShowMenu('visco')}>…</button>
            </div>
          </div>
          {showMenu==='visco' && (
            <div className="modal-backdrop" onClick={() => setShowMenu(null)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3 style={{ margin: 0 }}>Options Viscosité</h3>
                  <button onClick={() => setShowMenu(null)}>Fermer</button>
                </div>
                <div className="modal-body">
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <label>Période personnalisée:</label>
                    <input type="datetime-local" onChange={e => { setSpecificTs(e.target.value); setViscRange('specific'); }} />
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <label>Conformité min/max:</label>
                    <input style={{ width: 90 }} value={bounds.viscosite.low} onChange={e => setBounds('viscosite', { ...bounds.viscosite, low: Number(e.target.value) })} />
                    <input style={{ width: 90 }} value={bounds.viscosite.high} onChange={e => setBounds('viscosite', { ...bounds.viscosite, high: Number(e.target.value) })} />
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <label>Unité:</label>
                    <select value={'mPa·s'} onChange={()=>{}}><option value="mPa·s">mPa·s</option></select>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="chart" ref={viscRef} style={{ position: 'relative' }}>
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
            <div
              style={{ position: 'absolute', inset: 0, cursor: 'grab' }}
              onPointerDown={(e) => {
                const el = viscRef.current; if (!el) return;
                const rect = el.getBoundingClientRect();
                const startX = e.clientX; const startY = e.clientY;
                const width = rect.width; const height = rect.height;
                const startEnd = viscEndTs; const ms = (viscRange === 'specific' && specificTs) ? (60 * 60 * 1000) : rangeToMs(viscRange);
                const startYDom = viscY;
                const onMove = (ev: PointerEvent) => {
                  const dx = ev.clientX - startX; const dy = ev.clientY - startY;
                  const deltaMs = Math.round(dx * ms / width);
                  setViscEndTs(startEnd - deltaMs);
                  if ((ev.clientX - rect.left) < 56) {
                    const [yMin,yMax] = startYDom; const valPerPixel = (yMax - yMin) / height; const dVal = dy * valPerPixel;
                    setViscY([yMin - dVal, yMax - dVal]);
                  }
                };
                const onUp = () => { window.removeEventListener('pointermove', onMove); };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp, { once: true });
              }}
            />
          </div>
        </div>

        {/* Row 2: Pouvoir couvrant - Historique */}
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Pouvoir couvrant - Historique (g)</h3>
            <div className="segmented">
              {(['7d','1m','3m','all'] as const).map(r => (
                <button key={r} className={`seg-btn ${pcRange===r?'active':''}`} onClick={() => { setPcRange(r); setPcEndTs(resetAnchorNow()); }}>{r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
              ))}
            </div>
          </div>
          <div className="chart" ref={pcRef} style={{ height: 220, position: 'relative' }}>
            <ResponsiveContainer>
              <LineChart data={pcHistData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                <XAxis dataKey="t" type="number" scale="time" domain={["auto","auto"]} tickFormatter={formatTime} stroke="#6b7280" />
                <YAxis domain={pcY as any} stroke="#6b7280" />
                <Tooltip labelFormatter={v => formatDateTime(Number(v))} formatter={(value) => [`${value} g`, 'Pouvoir couvrant']} />
                <ReferenceArea y1={50} y2={70} fill="#22c55e" fillOpacity={0.08} />
                <Line type="monotone" dataKey="v" stroke="#38bdf8" dot={true} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
            <div
              style={{ position: 'absolute', inset: 0, cursor: 'grab' }}
              onPointerDown={(e) => {
                const el = pcRef.current; if (!el) return;
                const rect = el.getBoundingClientRect();
                const startX = e.clientX; const startY = e.clientY;
                const width = rect.width; const height = rect.height;
                const startEnd = pcEndTs; const ms = pcRange === '7d' ? 7*24*60*60*1000 : pcRange === '1m' ? 30*24*60*60*1000 : pcRange === '3m' ? 90*24*60*60*1000 : 365*24*60*60*1000;
                const startYDom = pcY;
                const onMove = (ev: PointerEvent) => {
                  const dx = ev.clientX - startX; const dy = ev.clientY - startY;
                  const deltaMs = Math.round(dx * ms / width);
                  setPcEndTs(startEnd - deltaMs);
                  if ((ev.clientX - rect.left) < 56) {
                    const [yMin,yMax] = startYDom; const valPerPixel = (yMax - yMin) / height; const dVal = dy * valPerPixel;
                    setPcY([yMin - dVal, yMax - dVal]);
                  }
                };
                const onUp = () => { window.removeEventListener('pointermove', onMove); };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp, { once: true });
              }}
            />
          </div>
        </div>
        {/* Row 2: Pouvoir couvrant - Essai */}
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
      </div>

      {testState === 'termine' && (
        <div className="section" style={{ marginTop: 12 }}>
          {/* Row 3: Photo plaque (left) */}
          <div className="panel">
            <h3>Photo de plaque</h3>
            <div style={{ marginTop: 6 }}>
              <img src="/plaque-pickup.jpg" alt="Plaque essai" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
            </div>
          </div>
          {/* Row 3: Analyse IA (right) */}
          <div className="panel">
            <h3>Analyse IA</h3>
            <div className="muted">Résultats simulés: couverture homogène, porosité dans l'intervalle attendu. (Module démo)</div>
          </div>
        </div>
      )}

      {/* Row 5: Dosage H2O historique + Contrôle doseuse H2O */}
      <div className="section" style={{ marginTop: 12 }}>
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Dosage H2O — Historique (L/h)</h3>
            <div className="segmented">
              {(['3h','1d','7d','1m','3m','all'] as const).map(r => (
                <button key={r} className={`seg-btn ${doseRange===r?'active':''}`} onClick={() => { setDoseRange(r); setDoseEndTs(resetAnchorNow()); }}>{r==='3h'?'3H':r==='1d'?'1D':r==='7d'?'7D':r==='1m'?'1M':r==='3m'?'3M':'ALL'}</button>
              ))}
            </div>
          </div>
          <div className="chart" ref={doseRef} style={{ position: 'relative' }}>
            <ResponsiveContainer>
              <LineChart data={doseHistData.map(p => ({ time: p.t, value: p.v }))} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                <XAxis dataKey="time" type="number" scale="time" domain={["auto","auto"]} tickFormatter={formatTime} stroke="#6b7280" />
                <YAxis domain={doseY as any} stroke="#6b7280" />
                <Tooltip labelFormatter={v => formatDateTime(Number(v))} formatter={(v)=>[`${v} L/h`, 'Débit']} />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
            <div
              style={{ position: 'absolute', inset: 0, cursor: 'grab' }}
              onPointerDown={(e) => {
                const el = doseRef.current; if (!el) return;
                const rect = el.getBoundingClientRect();
                const startX = e.clientX; const startY = e.clientY;
                const width = rect.width; const height = rect.height;
                const startEnd = doseEndTs; const ms = rangeToMs(doseRange);
                const startYDom = doseY;
                const onMove = (ev: PointerEvent) => {
                  const dx = ev.clientX - startX; const dy = ev.clientY - startY;
                  const deltaMs = Math.round(dx * ms / width);
                  setDoseEndTs(startEnd - deltaMs);
                  if ((ev.clientX - rect.left) < 56) {
                    const [yMin,yMax] = startYDom; const valPerPixel = (yMax - yMin) / height; const dVal = dy * valPerPixel;
                    setDoseY([yMin - dVal, yMax - dVal]);
                  }
                };
                const onUp = () => { window.removeEventListener('pointermove', onMove); };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp, { once: true });
              }}
            />
          </div>
        </div>
        <div className="panel">
          <h3>Contrôle doseuse H2O</h3>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label>Débit (L/h)</label>
            <input style={{ width: 100 }} type="number" step="0.001" value={doseRateLph} onChange={e => setDoseRateLph(Number(e.target.value))} />
            <span className="muted">Actuel: {doseRateLph.toFixed(3)} L/h</span>
          </div>
        </div>
      </div>
    </div>
  );
}


