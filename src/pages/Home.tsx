import { useNavigate } from 'react-router-dom';
import { useBarbotineStore } from '../store/barbotineStore';
import { useBoundsStore } from '../store/boundsStore';
import { useAmbientStore } from '../store/ambientStore';
import { useDoseStore } from '../store/doseStore';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import { useEffect, useMemo, useState, useRef } from 'react';
import { BarbotineCreateDialog } from '../components/BarbotineCreateDialog';
import { fetchRheologyLatestAll, fetchLatestBounds, ASSET_BASE } from '../services/api';
import { FRONTEND_TO_DB } from '../shared/metricKeys';
import { useTranslation } from '../i18n';

// builds a lil formatter so chart tooltips show the right unit + label
function mkTooltip(unit: string, metricLabel: string) {
  return (val: any, name: any) => {
    const valueStr = `${val} ${unit}`.trim();
    const label = name === 'Average' ? 'Average' : metricLabel;
    return [valueStr, label];
  };
}

// the main page where u see all ur slurries at a glance
export default function Home() {
  const t = useTranslation();
  const { barbotines, addBarbotine } = useBarbotineStore();
  const { bounds, getBoundsFor, setBoundsFor } = useBoundsStore();
  const { ambient, ambientHistory } = useAmbientStore();
  const { doseRateLph, doseRateHistory } = useDoseStore();
  const navigate = useNavigate();
  const [ambientOpen, setAmbientOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [latest, setLatest] = useState<Record<string, Record<string, { t:number; v:number; unit?: string; prevV?: number; prevT?: number }>> | null>(null);
  const [dbReachable, setDbReachable] = useState<boolean>(true);

  // grabs the latest data for every slurry from the server when the page loads
  useEffect(() => {
    const slurries = barbotines.map(b => (b as any).slurryId).filter(Boolean) as string[];
    if (!slurries.length) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchRheologyLatestAll(slurries);
        if (!cancelled) { setLatest(data || {}); setDbReachable(true); }
      } catch {
        if (!cancelled) { setLatest({}); setDbReachable(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [barbotines.length]);

  // loads the min/max limits for each slurry so we know whats ok and whats not
  const boundsFetchedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const sidToId = new Map<string, string>();
    barbotines.forEach(b => {
      const sid = (b as any).slurryId as string | undefined;
      if (sid) sidToId.set(sid, b.id);
    });
    // skip slurries we already got bounds for
    const slurries = Array.from(sidToId.keys()).filter(sid => !boundsFetchedRef.current.has(sid));
    if (!slurries.length) return;
    // mark em right away so we dont fetch twice
    slurries.forEach(sid => boundsFetchedRef.current.add(sid));
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
          } catch { /* eh one slurry failed, no biggie */ }
        }));
      } catch { /* whatever */ }
    })();
    return () => { cancelled = true; };
  }, [barbotines, setBoundsFor]);

  // all the chart formatting stuff - cached so it doesnt recalc every render
  const dayTickFormatter = useMemo(() => (ts: any) => new Date(Number(ts)).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), []);
  const labelDateTime = useMemo(() => (v: any) => new Date(Number(v)).toLocaleString(), []);
  // last 3 days of room temp data + its average
  const tempChartData = useMemo(() => {
    const now = Date.now();
    const data = ambientHistory.filter(p => p.t >= now - 3 * 24 * 60 * 60 * 1000).map(p => ({ t: p.t, v: p.temp }));
    const avg = data.length ? Number((data.reduce((s, d) => s + d.v, 0) / data.length).toFixed(2)) : null;
    return data.map(d => ({ ...d, avg: avg ?? undefined }));
  }, [ambientHistory]);
  // same thing but for humidity
  const humidChartData = useMemo(() => {
    const now = Date.now();
    const data = ambientHistory.filter(p => p.t >= now - 3 * 24 * 60 * 60 * 1000).map(p => ({ t: p.t, v: p.humid }));
    const avg = data.length ? Math.round(data.reduce((s, d) => s + d.v, 0) / data.length) : null;
    return data.map(d => ({ ...d, avg: avg ?? undefined }));
  }, [ambientHistory]);
  const tooltipTempFormatter = useMemo(() => mkTooltip('°C', t('home.temperature')), [t]);
  const tooltipHumidFormatter = useMemo(() => mkTooltip('%', t('home.humidity')), [t]);
  // figures out if water flow is going up, down, or staying the same over the last 12h
  const h2oTrendIcon = useMemo(() => {
    const now = Date.now();
    const last12 = doseRateHistory.filter(p => p.t >= now - 12 * 60 * 60 * 1000);
    if (last12.length >= 2) {
      const first = last12[0].v; const last = last12[last12.length - 1].v;
      if (last > first + 0.0005) return `${ASSET_BASE}/upward.svg`;
      if (last < first - 0.0005) return `${ASSET_BASE}/downward.svg`;
    }
    return `${ASSET_BASE}/constant.svg`;
  }, [doseRateHistory]);


  return (
    <div>
      <h2>{t('home.title')}</h2>
      {/* room temp and humidity cards - shows dashes if no sensor data */}
      <div className="grid" style={{ marginTop: 8 }}>
        <div className="card" style={{ padding: 12, cursor: 'pointer' }} onClick={() => setAmbientOpen(v => !v)}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('home.roomTemp')}</div>
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
                  <Line type="monotone" dataKey="v" name={t('home.temperature')} stroke="#f59e0b" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="card" style={{ padding: 12, cursor: 'pointer' }} onClick={() => setAmbientOpen(v => !v)}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('home.roomHumidity')}</div>
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
                  <Line type="monotone" dataKey="v" name={t('home.humidity')} stroke="#60a5fa" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
      <div className="grid" style={{ marginTop: 12 }}>
        {(() => {
          // only show slurries that actually have recent data, sorted by type
          const withData = barbotines.filter((b) => {
            const sid = (b as any).slurryId as string | undefined;
            const rec = (sid && latest && latest[sid]) || {} as any;
            const now = Date.now();
            const within = (ms:number|undefined, windowMs:number) => (ms!=null && ms>0 && (now - ms) <= windowMs);
            const showAny = Object.values(rec).some((r:any)=> within((r as any)?.t, 210*24*60*60*1000));
            return dbReachable && showAny;
          });
          // sorts M-types first, then 2CN2, then R-types, then everything else
          const sorted = [...withData].sort((a,b) => {
            const group = (name: string) => name.startsWith('M') ? 0 : name.startsWith('2') ? 1 : name.startsWith('R') ? 2 : 3;
            const ga = group(a.name); const gb = group(b.name);
            if (ga !== gb) return ga - gb;
            return a.name.localeCompare(b.name);
          });
          const finalList = [...sorted, { id: '__new__', name: t('home.addSlurry'), online: false, last: null } as any];
          return finalList.map(b => {
          const sid = (b as any).slurryId as string | undefined;
          const rec = (sid && latest && latest[sid]) || {} as any;
          const now = Date.now();
          const within = (ms:number|undefined, windowMs:number) => (ms!=null && ms>0 && (now - ms) <= windowMs);
          // time windows in ms - basically how old data can be before we ignore it
          const threeMonths = 90*24*60*60*1000; const sevenMonths = 210*24*60*60*1000; const oneYear = 365*24*60*60*1000;
          const lastD = rec[FRONTEND_TO_DB.densite] as any; const lastV = rec[FRONTEND_TO_DB.viscosite] as any; const lastPC = rec[FRONTEND_TO_DB.pc] as any; const lastH2O = rec[FRONTEND_TO_DB.h2o] as any;
          const showD = lastD && within(lastD.t, oneYear); const showV = lastV && within(lastV.t, oneYear); const showPC = lastPC && within(lastPC.t, oneYear); const showH2O = lastH2O && within(lastH2O.t, oneYear);
          const onlineByData = (!!rec && Object.values(rec).some((r:any)=> within((r as any)?.t, sevenMonths)));
          const isOnline = dbReachable && onlineByData;
          const bnds = getBoundsFor(b.id);
          // checks if a value is out of bounds so we can color it red/orange/green
          function statusFromBounds(val:number|null|undefined, key:'densite'|'viscosite'|'pc'|'h2o'|'temperature'|'ph'){
            if (val==null) return null;
            const bb:any = (bnds as any)[key];
            if (!bb) return null;
            const hasLow = bb.low != null; const hasHigh = bb.high != null;
            // outside the limits = bad
            if (hasLow && val < (bb.low as number)) return { cls: 'err', label: 'Critical' };
            if (hasHigh && val > (bb.high as number)) return { cls: 'err', label: 'Critical' };
            // only one limit set and we're inside it = chill
            if (hasLow && !hasHigh) return { cls: 'ok', label: 'OK' };
            if (!hasLow && hasHigh) return { cls: 'ok', label: 'OK' };
            // both limits = check if its too close to the edge (warning zone is 30% from edges)
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
          // picks the right arrow icon for water flow trend
          const trendIcon = (()=>{
            if (!showH2O || lastH2O?.prevV==null) return `${ASSET_BASE}/constant.svg`;
            const lv = Number(lastH2O.v); const pv = Number(lastH2O.prevV);
            if (lv > pv) return `${ASSET_BASE}/upward.svg`; if (lv < pv) return `${ASSET_BASE}/downward.svg`; return `${ASSET_BASE}/constant.svg`;
          })();
          return (
            <div key={b.id} className={`card card-bb`} style={{ opacity: isOnline ? 1 : 0.6, cursor: 'pointer' }} onClick={() => {
              if (b.id === '__new__') { setCreateOpen(true); return; }
              // clicking any card takes u to its detail page
              navigate(`/barbotine/${encodeURIComponent(b.id)}`);
            }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3>{b.id === '__new__' ? t('home.addSlurry') : b.name}</h3>
                {b.id !== '__new__' && (
                  <span className="badge" style={{ background: isOnline ? 'rgba(34,197,94,0.08)' : 'rgba(148,163,184,0.08)' }}>
                    {isOnline ? t('home.online') : t('home.offline')}
                  </span>
                )}
              </div>
              {b.id === '__new__' ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, color: 'var(--muted)' }}>+</div>
              ) : isOnline ? (
                <>
                  {/* density row */}
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="row">
                      {showD ? (
                        <span className={`dot ${badgeD?.cls === 'ok' ? 'green' : badgeD?.cls === 'warn' ? 'orange' : 'red'}`}></span>
                      ) : (
                        <span className="dot" style={{ background: 'var(--muted)' }}></span>
                      )}
                      <div>{t('home.density')}: <span style={{ fontWeight: 500, fontSize: '0.95em' }}>{showD ? Number(lastD.v).toFixed(3)+' g/cm³' : '—'}</span></div>
                    </div>
                    {badgeD && <span className={`badge ${badgeD.cls}`}>{badgeD.label}</span>}
                  </div>
                  {/* viscosity row */}
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="row">
                      {showV ? (
                        <span className={`dot ${badgeV?.cls === 'ok' ? 'green' : badgeV?.cls === 'warn' ? 'orange' : 'red'}`}></span>
                      ) : (
                        <span className="dot" style={{ background: 'var(--muted)' }}></span>
                      )}
                      <div>{t('home.viscosity')}: <span style={{ fontWeight: 500, fontSize: '0.95em' }}>{showV ? Math.round(Number(lastV.v))+' mPa·s' : '—'}</span></div>
                    </div>
                    {badgeV && <span className={`badge ${badgeV.cls}`}>{badgeV.label}</span>}
                  </div>
                  {/* cover power row */}
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="row">
                      {showPC ? (
                        <span className={`dot ${badgePC?.cls === 'ok' ? 'green' : badgePC?.cls === 'warn' ? 'orange' : 'red'}`}></span>
                      ) : (
                        <span className="dot" style={{ background: 'var(--muted)' }}></span>
                      )}
                      <div>{t('home.pc')}: <span style={{ fontWeight: 500, fontSize: '0.95em' }}>{showPC ? Number(lastPC.v).toFixed(2)+' g' : '—'}</span></div>
                    </div>
                    {badgePC && <span className={`badge ${badgePC.cls}`}>{badgePC.label}</span>}
                  </div>
                  {/* water flow row */}
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="row">
                      {showH2O ? (
                        <span className="dot blue"></span>
                      ) : (
                        <span className="dot" style={{ background: 'var(--muted)' }}></span>
                      )}
                      <div>{t('home.h2oFlow')}: <span style={{ fontWeight: 500, fontSize: '0.95em' }}>{showH2O ? Number(lastH2O.v).toFixed(3)+' L/h' : '—'}</span></div>
                    </div>
                    <img src={trendIcon} alt="trend" style={{ width: 16, height: 16 }} />
                  </div>
                </>
              ) : (
                // basically just the "add new" card fallback
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
    </div>
  );
}


