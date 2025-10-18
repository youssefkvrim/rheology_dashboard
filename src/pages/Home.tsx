import { useNavigate } from 'react-router-dom';
import { useAppState } from '../store/appState';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import { useMemo, useState } from 'react';

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
  const { barbotines, bounds, ambient, ambientHistory, addBarbotine, doseRateLph, doseRateHistory } = useAppState();
  const navigate = useNavigate();
  const [showTemp, setShowTemp] = useState(false);
  const [showHumid, setShowHumid] = useState(false);

  // Memoized formatters and series for mini-charts
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
      if (last > first + 0.0005) return '/upward.svg';
      if (last < first - 0.0005) return '/downward.svg';
    }
    return '/constant.svg';
  }, [doseRateHistory]);

  return (
    <div>
      <h2>Accueil</h2>
      <div className="grid" style={{ marginTop: 8 }}>
        <div className="card" style={{ padding: 12, cursor: 'pointer' }} onClick={() => setShowTemp(v => !v)}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Température salle</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{ambient.temperatureRoom.toFixed(1)} °C</div>
          </div>
          {showTemp && (
            <div style={{ height: 120, marginTop: 6 }}>
              <ResponsiveContainer>
                  <LineChart data={tempChartData} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                  <XAxis dataKey="t" type="number" scale="time" domain={["auto","auto"]} stroke="#6b7280" tickFormatter={dayTickFormatter} />
                  <YAxis stroke="#6b7280" domain={[15,30]} />
                  <Tooltip labelFormatter={labelDateTime} formatter={tooltipTempFormatter} />
                  <ReferenceArea y1={21} y2={23} fill="#22c55e" fillOpacity={0.08} />
                  <Line type="monotone" dataKey="v" name="Température" stroke="#f59e0b" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="card" style={{ padding: 12, cursor: 'pointer' }} onClick={() => setShowHumid(v => !v)}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Humidité salle</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{ambient.humidityRoom} %</div>
          </div>
          {showHumid && (
            <div style={{ height: 120, marginTop: 6 }}>
              <ResponsiveContainer>
                  <LineChart data={humidChartData} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                  <XAxis dataKey="t" type="number" scale="time" domain={["auto","auto"]} stroke="#6b7280" tickFormatter={dayTickFormatter} />
                  <YAxis stroke="#6b7280" domain={[45,75]} />
                  <Tooltip labelFormatter={labelDateTime} formatter={tooltipHumidFormatter} />
                  <ReferenceArea y1={58} y2={65} fill="#22c55e" fillOpacity={0.08} />
                  <Line type="monotone" dataKey="v" name="Humidité" stroke="#60a5fa" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
      <div className="grid" style={{ marginTop: 12 }}>
        {[...barbotines, { id: '__new__', name: 'Ajouter une barbotine', online: false, last: null } as any].map(b => {
          const clickable = b.online && b.id === 'M7-3 006';
          const lastV = b.last?.viscosite ?? null;
          const badgeV = lastV != null && bounds.viscosite.low != null && bounds.viscosite.high != null
            ? badgeFromViscosity(lastV, bounds.viscosite.low as number, bounds.viscosite.high as number) : null;
          const dens = b.last?.densite ?? null;
          const badgeD = dens != null && bounds.densite.low != null && bounds.densite.high != null
            ? (dens < (bounds.densite.low as number) || dens > (bounds.densite.high as number) ? { cls: 'err', label: 'Warning' } : { cls: 'ok', label: 'OK' })
            : null;
          const pc = b.last ? (65 + Math.round(((b.last.viscosite%10)-5)*2)) : null;
          const badgePC = pc != null ? (pc < 60 || pc > 75 ? { cls: 'warn', label: 'Critical' } : { cls: 'ok', label: 'OK' }) : null;
          return (
            <div key={b.id} className={`card card-bb`} style={{ opacity: b.online ? 1 : 0.6, cursor: 'pointer' }} onClick={() => {
              if (b.id === '__new__') {
                const pwd = prompt('Mot de passe du tableau de bord:');
                if (pwd !== 'pfx') { alert('Mot de passe invalide'); return; }
                const type = prompt('Type (M7-3 / 2CN2 / R55):', 'M7-3');
                if (!type) return;
                const nom = prompt('Nom de la barbotine (ex: M7-3 009):', `${type} `);
                if (!nom || !nom.trim()) return;
                addBarbotine(nom.trim(), false);
                return;
              }
              if (clickable) navigate(`/barbotine/${b.id}`);
            }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3>{b.id === '__new__' ? 'Ajouter une barbotine' : b.name}</h3>
                {b.id !== '__new__' && (
                  <span className="badge" style={{ background: b.online ? 'rgba(34,197,94,0.08)' : 'rgba(148,163,184,0.08)' }}>
                    {b.online ? 'En ligne' : 'Hors ligne'}
                  </span>
                )}
              </div>
              {b.id === '__new__' ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, color: 'var(--muted)' }}>+</div>
              ) : b.online && b.last ? (
                <>
                  {/* Densité */}
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="row">
                      <span className={`dot ${badgeD?.cls === 'ok' ? 'green' : badgeD?.cls === 'warn' ? 'orange' : 'red'}`}></span>
                      <div>Densité: <strong>{b.last.densite.toFixed(3)} g/cm³</strong></div>
                    </div>
                    <span className={`badge ${badgeD?.cls}`}>{badgeD?.label}</span>
                  </div>
                  {/* Viscosité */}
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="row">
                      <span className={`dot ${badgeV?.cls === 'ok' ? 'green' : badgeV?.cls === 'warn' ? 'orange' : 'red'}`}></span>
                      <div>Viscosité: <strong>{Math.round(b.last.viscosite)} mPa·s</strong></div>
                    </div>
                    <span className={`badge ${badgeV?.cls}`}>{badgeV?.label}</span>
                  </div>
                  {/* PC */}
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="row">
                      <span className={`dot ${badgePC?.cls === 'ok' ? 'green' : badgePC?.cls === 'warn' ? 'orange' : 'red'}`}></span>
                      <div>PC: <strong>{pc} g</strong></div>
                    </div>
                    <span className={`badge ${badgePC?.cls}`}>{badgePC?.label}</span>
                  </div>
                  {/* H2O */}
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="row">
                      <span className="dot blue"></span>
                      <div>Débit H₂O: <strong>{doseRateLph.toFixed(3)} L/h</strong></div>
                    </div>
                    <img src={h2oTrendIcon} alt="trend" style={{ width: 16, height: 16 }} />
                  </div>
                </>
              ) : (
                <div className="muted">—</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


