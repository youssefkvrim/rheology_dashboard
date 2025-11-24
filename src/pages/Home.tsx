import { useNavigate } from 'react-router-dom';
import { useAppState } from '../store/appState';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import { useEffect, useMemo, useState } from 'react';
import { BarbotineCreateDialog } from '../components/BarbotineCreateDialog';
import { fetchRheologyLatestAll, fetchLatestBounds, apiHealth } from '../services/api';

function badgeFromViscosity(v: number, low: number, high: number) {
  if (v < low * 0.95 || v > high * 1.05) return { cls: 'err', label: 'Warning' };
  if (v < low || v > high) return { cls: 'warn', label: 'Critical' };
  return { cls: 'ok', label: 'OK' };
}

function mkTooltip(unit: string, metricLabel: string) {
  return (val: any, name: any) => {
    const valueStr = `${val} ${unit}`.trim();
    const label = name === 'Average' ? 'Average' : metricLabel;
    return [valueStr, label];
  };
}

export default function Home() {
  const { barbotines, bounds, ambient, ambientHistory, addBarbotine, doseRateLph, doseRateHistory, getBoundsFor, setBoundsFor } = useAppState();
  const navigate = useNavigate();
  const [ambientOpen, setAmbientOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [latest, setLatest] = useState<Record<string, Record<string, { t:number; v:number; unit?: string; prevV?: number; prevT?: number }>> | null>(null);
  const [dbReachable, setDbReachable] = useState<boolean>(true);
  const [errors, setErrors] = useState<Array<{ ts:number; msg:string }>>([]);
  const [fetchOk, setFetchOk] = useState<number>(0);
  const [fetchErr, setFetchErr] = useState<number>(0);
  const [dbgOpen, setDbgOpen] = useState<boolean>(false);

  useEffect(() => {
    const slurries = barbotines.map(b => (b as any).slurryId).filter(Boolean) as string[];
    if (!slurries.length) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchRheologyLatestAll(slurries);
        if (!cancelled) { setLatest(data || {}); setDbReachable(true); setFetchOk(x => x+1); }
      } catch {
        if (!cancelled) { setLatest({}); setDbReachable(false); setFetchErr(x => x+1); }
      }
    })();
    return () => { cancelled = true; };
  }, [barbotines.length]);

  // Proactively load latest bounds from DB for each slurry and store per-barbotine
  useEffect(() => {
    const sidToId = new Map<string, string>();
    barbotines.forEach(b => {
      const sid = (b as any).slurryId as string | undefined;
      if (sid) sidToId.set(sid, b.id);
    });
    const slurries = Array.from(sidToId.keys());
    if (!slurries.length) return;
    let cancelled = false;
    (async () => {
      try {
        await Promise.all(slurries.map(async (sid) => {
          try {
            const bArr = await fetchLatestBounds(sid);
            if (cancelled || !Array.isArray(bArr)) return;
            const bid = sidToId.get(sid) || '';
            bArr.forEach((b:any) => {
              const metric = b.key as 'densite'|'viscosite'|'pc'|'h2o'|'temperature'|'ph'|'silice'|'grains';
              setBoundsFor(bid, metric, { low: (b.low ?? null), high: (b.high ?? null) });
            });
          } catch { /* ignore one slurry */ }
        }));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [barbotines, setBoundsFor]);

  // Memoized formatters and mini-charts
  const dayTickFormatter = useMemo(() => (ts: any) => new Date(Number(ts)).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), []);
  const labelDateTime = useMemo(() => (v: any) => new Date(Number(v)).toLocaleString(), []);
  const tempChartData = useMemo(() => {
    const now = Date.now();
    const data = ambientHistory.filter(p => p.t >= now - 3 * 24 * 60 * 60 * 1000).map(p => ({ t: p.t, v: p.temp }));
    const avg = data.length ? Number((data.reduce((s, d) => s + d.v, 0) / data.length).toFixed(2)) : null;
    return data.map(d => ({ ...d, avg: avg ?? undefined }));
  }, [ambientHistory]);
  const humidChartData = useMemo(() => {
    const now = Date.now();
    const data = ambientHistory.filter(p => p.t >= now - 3 * 24 * 60 * 60 * 1000).map(p => ({ t: p.t, v: p.humid }));
    const avg = data.length ? Math.round(data.reduce((s, d) => s + d.v, 0) / data.length) : null;
    return data.map(d => ({ ...d, avg: avg ?? undefined }));
  }, [ambientHistory]);
  const tooltipTempFormatter = useMemo(() => mkTooltip('°C', 'Température'), []);
  const tooltipHumidFormatter = useMemo(() => mkTooltip('%', 'Humidité'), []);
  const h2oTrendIcon = useMemo(() => {
    const now = Date.now();
    const last12 = doseRateHistory.filter(p => p.t >= now - 12 * 60 * 60 * 1000);
    if (last12.length >= 2) {
      const first = last12[0].v; const last = last12[last12.length - 1].v;
      if (last > first + 0.0005) return '/assets/upward.svg';
      if (last < first - 0.0005) return '/assets/downward.svg';
    }
    return '/assets/constant.svg';
  }, [doseRateHistory]);

  // Debugger: server status + website errors + fetch counters
  useEffect(() => {
    let cancelled = false;
    const onError = (e: ErrorEvent) => setErrors(prev => [{ ts: Date.now(), msg: String(e?.message || 'Error') }, ...prev].slice(0,50));
    const onRej = (e: PromiseRejectionEvent) => setErrors(prev => [{ ts: Date.now(), msg: String((e?.reason && e.reason.message) || 'Promise rejection') }, ...prev].slice(0,50));
    const onAppErr = (e: any) => setErrors(prev => [{ ts: Date.now(), msg: String(e?.detail?.message || 'App error') }, ...prev].slice(0,50));
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRej);
    window.addEventListener('app-error', onAppErr as any);
    const id = setInterval(async () => {
      try {
        const ok = await apiHealth();
        if (!cancelled) setDbReachable(ok);
      } catch { if (!cancelled) setDbReachable(false); }
    }, 10000);
    return () => { cancelled = true; clearInterval(id); window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRej); window.removeEventListener('app-error', onAppErr as any); };
  }, []);

  return (
    <div>
      <h2>Accueil</h2>
      {/* Ambient cards: show with placeholder values when no real source */}
      <div className="grid" style={{ marginTop: 8 }}>
        <div className="card" style={{ padding: 12, cursor: 'pointer' }} onClick={() => setAmbientOpen(v => !v)}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Température salle</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--muted)' }}>—</div>
          </div>
          {ambientOpen && (
            <div style={{ height: 120, marginTop: 6 }}>
              <ResponsiveContainer>
                  <LineChart data={tempChartData} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                  <XAxis dataKey="t" type="number" scale="time" domain={["auto","auto"]} stroke="#6b7280" tickFormatter={dayTickFormatter} />
                  <YAxis stroke="#6b7280" domain={[15,30]} />
                  <Tooltip labelFormatter={labelDateTime} formatter={tooltipTempFormatter} />
                  <Line type="monotone" dataKey="v" name="Température" stroke="#f59e0b" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="card" style={{ padding: 12, cursor: 'pointer' }} onClick={() => setAmbientOpen(v => !v)}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Humidité salle</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--muted)' }}>—</div>
          </div>
          {ambientOpen && (
            <div style={{ height: 120, marginTop: 6 }}>
              <ResponsiveContainer>
                  <LineChart data={humidChartData} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                  <XAxis dataKey="t" type="number" scale="time" domain={["auto","auto"]} stroke="#6b7280" tickFormatter={dayTickFormatter} />
                  <YAxis stroke="#6b7280" domain={[45,75]} />
                  <Tooltip labelFormatter={labelDateTime} formatter={tooltipHumidFormatter} />
                  <Line type="monotone" dataKey="v" name="Humidité" stroke="#60a5fa" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
      <div className="grid" style={{ marginTop: 12 }}>
        {(() => {
          // Build a sorted list of only barbotines that have data in DB
          const withData = barbotines.filter((b) => {
            const sid = (b as any).slurryId as string | undefined;
            const rec = (sid && latest && latest[sid]) || {} as any;
            const now = Date.now();
            const within = (ms:number|undefined, windowMs:number) => (ms!=null && ms>0 && (now - ms) <= windowMs);
            const showAny = Object.values(rec).some((r:any)=> within((r as any)?.t, 210*24*60*60*1000));
            return dbReachable && showAny;
          });
          const sorted = [...withData].sort((a,b) => {
            const group = (name: string) => name.startsWith('M') ? 0 : name.startsWith('2') ? 1 : name.startsWith('R') ? 2 : 3;
            const ga = group(a.name); const gb = group(b.name);
            if (ga !== gb) return ga - gb;
            return a.name.localeCompare(b.name);
          });
          // TEST ONLY: manual test card - remove in production
          const testCard = { id: 'test', name: 'test', online: false, last: null } as any;
          const finalList = [...sorted, testCard, { id: '__new__', name: 'Ajouter une barbotine', online: false, last: null } as any];
          return finalList.map(b => {
          const sid = (b as any).slurryId as string | undefined;
          const rec = (sid && latest && latest[sid]) || {} as any;
          const now = Date.now();
          const within = (ms:number|undefined, windowMs:number) => (ms!=null && ms>0 && (now - ms) <= windowMs);
          const threeMonths = 90*24*60*60*1000; const sevenMonths = 210*24*60*60*1000; const oneYear = 365*24*60*60*1000;
          const lastD = rec['density'] as any; const lastV = rec['viscosity'] as any; const lastPC = rec['pc'] as any; const lastH2O = rec['H2O'] as any;
          const showD = lastD && within(lastD.t, oneYear); const showV = lastV && within(lastV.t, oneYear); const showPC = lastPC && within(lastPC.t, oneYear); const showH2O = lastH2O && within(lastH2O.t, oneYear);
          const onlineByData = (!!rec && Object.values(rec).some((r:any)=> within((r as any)?.t, sevenMonths)));
          const isOnline = dbReachable && onlineByData;
          const bnds = getBoundsFor(b.id);
          function statusFromBounds(val:number|null|undefined, key:'densite'|'viscosite'|'pc'|'h2o'|'temperature'|'ph'){
            if (val==null) return null;
            const bb:any = (bnds as any)[key];
            if (!bb) return null;
            const hasLow = bb.low != null; const hasHigh = bb.high != null;
            // Outside any defined bound -> Critical
            if (hasLow && val < (bb.low as number)) return { cls: 'err', label: 'Critical' };
            if (hasHigh && val > (bb.high as number)) return { cls: 'err', label: 'Critical' };
            // Single-side bound -> OK if inside
            if (hasLow && !hasHigh) return { cls: 'ok', label: 'OK' };
            if (!hasLow && hasHigh) return { cls: 'ok', label: 'OK' };
            // Both bounds -> Critical band near edges, else OK
            if (hasLow && hasHigh) {
              const y1 = bb.low as number; const y2 = bb.high as number; if (!(y2>y1)) return { cls: 'ok', label: 'OK' };
              const span = y2 - y1; const crit = 0.30; const edge = span * (crit/2);
              if (val <= y1 + edge || val >= y2 - edge) return { cls: 'warn', label: 'Warning' };
              return { cls: 'ok', label: 'OK' };
            }
            return null;
          }
          const badgeD = statusFromBounds(showD? Number(lastD.v): null, 'densite');
          const badgeV = statusFromBounds(showV? Number(lastV.v): null, 'viscosite');
          const badgePC = statusFromBounds(showPC? Number(lastPC.v): null, 'pc');
          const trendIcon = (()=>{
            if (!showH2O || lastH2O?.prevV==null) return '/assets/constant.svg';
            const lv = Number(lastH2O.v); const pv = Number(lastH2O.prevV);
            if (lv > pv) return '/assets/upward.svg'; if (lv < pv) return '/assets/downward.svg'; return '/assets/constant.svg';
          })();
          return (
            <div key={b.id} className={`card card-bb`} style={{ opacity: isOnline ? 1 : 0.6, cursor: 'pointer' }} onClick={() => {
              if (b.id === '__new__') { setCreateOpen(true); return; }
              // Open detail for both online and offline; offline shows empty charts there
              navigate(`/barbotine/${encodeURIComponent(b.id)}`);
            }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3>{b.id === '__new__' ? 'Ajouter une barbotine' : b.name}</h3>
                {b.id !== '__new__' && (
                  <span className="badge" style={{ background: isOnline ? 'rgba(34,197,94,0.08)' : 'rgba(148,163,184,0.08)' }}>
                    {isOnline ? 'En ligne' : 'Hors ligne'}
                  </span>
                )}
              </div>
              {b.id === '__new__' ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, color: 'var(--muted)' }}>+</div>
              ) : isOnline ? (
                <>
                  {/* Densité */}
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="row">
                      {showD ? (
                        <span className={`dot ${badgeD?.cls === 'ok' ? 'green' : badgeD?.cls === 'warn' ? 'orange' : 'red'}`}></span>
                      ) : (
                        <span className="dot" style={{ background: 'var(--muted)' }}></span>
                      )}
                      <div>Densité: <strong>{showD ? Number(lastD.v).toFixed(3)+' g/cm³' : '—'}</strong></div>
                    </div>
                    {badgeD && <span className={`badge ${badgeD.cls}`}>{badgeD.label}</span>}
                  </div>
                  {/* Viscosité */}
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="row">
                      {showV ? (
                        <span className={`dot ${badgeV?.cls === 'ok' ? 'green' : badgeV?.cls === 'warn' ? 'orange' : 'red'}`}></span>
                      ) : (
                        <span className="dot" style={{ background: 'var(--muted)' }}></span>
                      )}
                      <div>Viscosité: <strong>{showV ? Math.round(Number(lastV.v))+' mPa·s' : '—'}</strong></div>
                    </div>
                    {badgeV && <span className={`badge ${badgeV.cls}`}>{badgeV.label}</span>}
                  </div>
                  {/* PC */}
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="row">
                      {showPC ? (
                        <span className={`dot ${badgePC?.cls === 'ok' ? 'green' : badgePC?.cls === 'warn' ? 'orange' : 'red'}`}></span>
                      ) : (
                        <span className="dot" style={{ background: 'var(--muted)' }}></span>
                      )}
                      <div>PC: <strong>{showPC ? Number(lastPC.v).toFixed(2)+' g' : '—'}</strong></div>
                    </div>
                    {badgePC && <span className={`badge ${badgePC.cls}`}>{badgePC.label}</span>}
                  </div>
                  {/* H2O */}
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="row">
                      {showH2O ? (
                        <span className="dot blue"></span>
                      ) : (
                        <span className="dot" style={{ background: 'var(--muted)' }}></span>
                      )}
                      <div>Débit H₂O: <strong>{showH2O ? Number(lastH2O.v).toFixed(3)+' L/h' : '—'}</strong></div>
                    </div>
                    <img src={trendIcon} alt="trend" style={{ width: 16, height: 16 }} />
                  </div>
                </>
              ) : (
                // No data: hide card via filtering above; this branch only appears for the add-card
                <div className="muted">—</div>
              )}
            </div>
          );
          });
        })()}
      </div>
      {createOpen && (
        <BarbotineCreateDialog
          open={createOpen}
          onClose={()=> setCreateOpen(false)}
          onConfirm={(nom, config) => {
            addBarbotine(nom, false, config);
          }}
        />
      )}
      {/* Debugger widget */}
      <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 60 }}>
        {!dbgOpen ? (
          <button
            onClick={() => setDbgOpen(true)}
            title="Debugger"
            className="icon-btn"
            style={{ width: 48, height: 48, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb' }}
          >
            <img src="/assets/bug.svg" alt="bug" style={{ width: 22, height: 22 }} />
          </button>
        ) : (
          <div className="panel" style={{ width: 280, padding: 10, maxHeight: '60vh', overflowY: 'auto' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>Debugger</strong>
              <button className="icon-btn" onClick={() => setDbgOpen(false)} aria-label="Toggle debugger">–</button>
            </div>
            <div style={{ marginTop: 6, fontSize: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Server</span>
                <span className={`badge ${dbReachable ? 'ok' : 'err'}`}>{dbReachable ? 'OK' : 'DOWN'}</span>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Fetch</span>
                <span>{fetchOk} ok / {fetchErr} err</span>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Errors</span>
                <span>{errors.length}</span>
              </div>
              <div className="log" style={{ marginTop: 6 }}>
                {errors.slice(0,5).map((e,i)=> (
                  <div key={i} className="log-item">{new Date(e.ts).toLocaleTimeString()} — {e.msg}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


