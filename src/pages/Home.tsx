import { useNavigate } from 'react-router-dom';
import { useBarbotineStore } from '../store/barbotineStore';
import { useBoundsStore } from '../store/boundsStore';
import { useAmbientStore } from '../store/ambientStore';
import { useDoseStore } from '../store/doseStore';
import { toRefreshIntervalMs, usePrefsStore } from '../store/prefsStore';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import { useEffect, useMemo, useState, useRef } from 'react';
import { BarbotineCreateDialog } from '../components/BarbotineCreateDialog';
import { fetchRheologyLatestAll, fetchLatestBounds, fetchAlertsLatest, ASSET_BASE, AlertStatus } from '../services/api';
import { FRONTEND_TO_DB, toFeKey } from '../shared/metricKeys';
import { useTranslation } from '../i18n';

type AlertRow = {
  slurryId: string;
  routeId: string;
  slurryName: string;
  parameter: string;
  value: number;
  unit?: string;
  status: AlertStatus;
};

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
  const STALE_MS = 30 * 24 * 60 * 60 * 1000;
  const { barbotines, addBarbotine } = useBarbotineStore();
  const { bounds, getBoundsFor, setBoundsFor } = useBoundsStore();
  const { ambient, ambientHistory } = useAmbientStore();
  const { doseRateLph, doseRateHistory } = useDoseStore();
  const refreshInterval = usePrefsStore(s => s.refreshInterval);
  const navigate = useNavigate();
  const [ambientOpen, setAmbientOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [latest, setLatest] = useState<Record<string, Record<string, { t:number; v:number; unit?: string; prevV?: number; prevT?: number }>> | null>(null);
  const [dbReachable, setDbReachable] = useState<boolean>(true);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertRows, setAlertRows] = useState<AlertRow[]>([]);
  const refreshMs = useMemo(() => toRefreshIntervalMs(refreshInterval), [refreshInterval]);
  const criticalAlertCount = useMemo(() => alertRows.filter(row => row.status === 'err').length, [alertRows]);

  // grabs the latest data for every slurry, then refreshes it while the tab is visible
  useEffect(() => {
    const slurries = barbotines.map(b => (b as any).slurryId).filter(Boolean) as string[];
    if (!slurries.length) { setLatest({}); setAlertRows([]); return; }
    const slurryMeta = new Map<string, { id: string; name: string }>();
    barbotines.forEach(b => {
      const sid = (b as any).slurryId as string | undefined;
      if (sid) slurryMeta.set(sid, { id: b.id, name: b.name });
    });
    let cancelled = false;
    let inFlight = false;
    const load = async () => {
      if (cancelled || inFlight || document.hidden) return;
      inFlight = true;
      try {
        const [latestResult, alertsResult] = await Promise.allSettled([
          fetchRheologyLatestAll(slurries),
          fetchAlertsLatest(slurries),
        ]);
        if (cancelled) return;
        if (latestResult.status === 'fulfilled') {
          setLatest(latestResult.value || {});
          setDbReachable(true);
        } else {
          setLatest({});
          setDbReachable(false);
        }
        if (alertsResult.status === 'fulfilled') {
          const rows: AlertRow[] = [];
          Object.entries(alertsResult.value || {}).forEach(([sid, metrics]) => {
            Object.entries(metrics || {}).forEach(([parameter, alert]) => {
              if (!alert || alert.status === 'ok') return;
              const meta = slurryMeta.get(sid);
              rows.push({
                slurryId: sid,
                routeId: meta?.id || sid,
                slurryName: meta?.name || sid,
                parameter,
                value: Number(alert.v),
                unit: alert.unit,
                status: alert.status,
              });
            });
          });
          rows.sort((a, b) => (a.status === b.status ? a.slurryName.localeCompare(b.slurryName) : a.status === 'err' ? -1 : 1));
          setAlertRows(rows);
        } else {
          setAlertRows([]);
        }
      } finally {
        inFlight = false;
      }
    };
    void load();
    const interval = window.setInterval(() => { void load(); }, refreshMs);
    const onVisibilityChange = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [barbotines, refreshMs]);

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

  function alertStatusLabel(status: AlertStatus) {
    if (status === 'err') return t('alerts.critical');
    if (status === 'warn') return t('alerts.warning');
    return t('alerts.ok');
  }

  function alertParameterLabel(parameter: string) {
    const key = toFeKey(parameter);
    const labels: Record<string, string> = {
      densite: t('home.density'),
      viscosite: t('home.viscosity'),
      ph: t('home.ph'),
      temperature: t('home.temperature'),
      pc: t('home.pc'),
      h2o: t('home.h2oFlow'),
      silice: 'Silice',
      grains: 'Grains',
    };
    return labels[key] || parameter;
  }

  function alertValue(row: AlertRow) {
    const value = Number.isFinite(row.value) ? Number(row.value.toFixed(3)).toString() : '—';
    return `${value}${row.unit ? ` ${row.unit}` : ''}`;
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t('home.title')}</h2>
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button
            className="icon-btn"
            aria-label={t('alerts.title')}
            title={t('alerts.title')}
            onClick={() => setAlertsOpen(open => !open)}
            style={{ position: 'relative' }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {criticalAlertCount > 0 && (
              <span
                aria-label={`${criticalAlertCount} ${t('alerts.critical')}`}
                style={{ position: 'absolute', top: -6, right: -6, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: '#dc2626', color: '#fff', fontSize: 10, lineHeight: '16px', textAlign: 'center', fontWeight: 700 }}
              >
                {criticalAlertCount}
              </span>
            )}
          </button>
          {alertsOpen && (
            <div className="dropdown" style={{ right: 0, top: 34, width: 360, maxWidth: 'calc(100vw - 32px)', padding: 6 }}>
              <div style={{ padding: '6px 8px', fontSize: 12, color: 'var(--muted)' }}>{t('alerts.title')}</div>
              {alertRows.length ? alertRows.map(row => (
                <button
                  key={`${row.slurryId}:${row.parameter}`}
                  className="dropdown-item"
                  style={{ display: 'block', width: '100%', textAlign: 'left', whiteSpace: 'normal', lineHeight: 1.35 }}
                  onClick={() => {
                    setAlertsOpen(false);
                    navigate(`/barbotine/${encodeURIComponent(row.routeId)}`);
                  }}
                >
                  {row.slurryName} — {alertParameterLabel(row.parameter)} — {alertValue(row)} — {alertStatusLabel(row.status)}
                </button>
              )) : (
                <div className="dropdown-item muted" style={{ cursor: 'default' }}>{t('alerts.empty')}</div>
              )}
            </div>
          )}
        </div>
      </div>
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
                  <Line type="monotone" dataKey="v" name={t('home.temperature')} stroke="#f59e0b" dot={false} strokeWidth={2} isAnimationActive={false} />
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
                  <Line type="monotone" dataKey="v" name={t('home.humidity')} stroke="#60a5fa" dot={false} strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
      <div className="grid" style={{ marginTop: 12 }}>
        {(() => {
          // sorts M-types first, then 2CN2, then R-types, then everything else
          const sorted = [...barbotines].sort((a,b) => {
            const group = (name: string) => name.startsWith('M') ? 0 : name.startsWith('2') ? 1 : name.startsWith('R') ? 2 : 3;
            const ga = group(a.name); const gb = group(b.name);
            if (ga !== gb) return ga - gb;
            return a.name.localeCompare(b.name);
          });
          const finalList = [...sorted, { id: '__new__', name: t('home.addSlurry'), online: false, last: null } as any];
          return finalList.map(b => {
          const sid = (b as any).slurryId as string | undefined;
          const rec = ((sid && latest && latest[sid]) || {}) as Record<string, { t:number; v:number; unit?: string; prevV?: number; prevT?: number }>;
          const now = Date.now();
          const lastD = rec[FRONTEND_TO_DB.densite] as any; const lastV = rec[FRONTEND_TO_DB.viscosite] as any; const lastPC = rec[FRONTEND_TO_DB.pc] as any; const lastH2O = rec[FRONTEND_TO_DB.h2o] as any;
          const hasValue = (r:any) => r != null && Number.isFinite(Number(r.t)) && Number(r.t) > 0;
          const showD = hasValue(lastD); const showV = hasValue(lastV); const showPC = hasValue(lastPC); const showH2O = hasValue(lastH2O);
          const newestTs = Object.values(rec).reduce<number | null>((max, r:any) => {
            const tValue = Number(r?.t);
            if (!Number.isFinite(tValue) || tValue <= 0) return max;
            return max == null || tValue > max ? tValue : max;
          }, null);
          const hasData = newestTs != null;
          const isOnline = dbReachable && newestTs != null && (now - newestTs) <= STALE_MS;
          const badgeText = isOnline ? t('home.online') : (hasData && dbReachable ? t('home.stale') : t('home.offline'));
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
            <div key={b.id} className={`card card-bb`} style={{ opacity: 1, cursor: 'pointer' }} onClick={() => {
              if (b.id === '__new__') { setCreateOpen(true); return; }
              // clicking any card takes u to its detail page
              navigate(`/barbotine/${encodeURIComponent(b.id)}`);
            }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3>{b.id === '__new__' ? t('home.addSlurry') : b.name}</h3>
                {b.id !== '__new__' && (
                  <span className="badge" style={{ background: isOnline ? 'rgba(34,197,94,0.08)' : 'rgba(148,163,184,0.08)' }}>
                    {badgeText}
                  </span>
                )}
              </div>
              {b.id !== '__new__' && newestTs != null && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4, marginBottom: 8 }}>
                  {t('home.lastMeasure')} {new Date(newestTs).toLocaleDateString('fr-FR')}
                </div>
              )}
              {b.id === '__new__' ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, color: 'var(--muted)' }}>+</div>
              ) : hasData ? (
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
