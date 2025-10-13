import { useNavigate } from 'react-router-dom';
import { useAppState } from '../store/appState';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import { useState } from 'react';

function badgeFromViscosity(v: number, low: number, high: number) {
  if (v < low * 0.95 || v > high * 1.05) return { cls: 'err', label: 'Hors borne' };
  if (v < low || v > high) return { cls: 'warn', label: 'Surveillance' };
  return { cls: 'ok', label: 'OK' };
}

export default function Home() {
  const { barbotines, bounds, ambient, ambientHistory, addBarbotine, doseRateLph } = useAppState();
  const navigate = useNavigate();
  const [showTemp, setShowTemp] = useState(false);
  const [showHumid, setShowHumid] = useState(false);

  return (
    <div>
      <h2>Accueil</h2>
      <div className="row" style={{ gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: 12, minWidth: 220, maxWidth: 260, cursor: 'pointer' }} onClick={() => setShowTemp(v => !v)}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Température salle</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{ambient.temperatureRoom.toFixed(1)} °C</div>
          </div>
          {showTemp && (
            <div style={{ height: 120, marginTop: 6 }}>
              <ResponsiveContainer>
                <LineChart data={ambientHistory.map(p => ({ t: p.t, v: p.temp }))} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                  <XAxis dataKey="t" type="number" scale="time" domain={["auto","auto"]} stroke="#6b7280" tickFormatter={(ts:any)=>new Date(Number(ts)).toLocaleTimeString()} />
                  <YAxis stroke="#6b7280" domain={[18,30]} />
                  <Tooltip labelFormatter={(v)=>new Date(Number(v)).toLocaleString()} formatter={(val)=>[`${val} °C`, 'Température']} />
                  <ReferenceArea y1={22.5} y2={24.5} fill="#22c55e" fillOpacity={0.08} />
                  <Line type="monotone" dataKey="v" stroke="#f59e0b" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="card" style={{ padding: 12, minWidth: 220, maxWidth: 260, cursor: 'pointer' }} onClick={() => setShowHumid(v => !v)}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Humidité salle</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{ambient.humidityRoom} %</div>
          </div>
          {showHumid && (
            <div style={{ height: 120, marginTop: 6 }}>
              <ResponsiveContainer>
                <LineChart data={ambientHistory.map(p => ({ t: p.t, v: p.humid }))} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                  <XAxis dataKey="t" type="number" scale="time" domain={["auto","auto"]} stroke="#6b7280" tickFormatter={(ts:any)=>new Date(Number(ts)).toLocaleTimeString()} />
                  <YAxis stroke="#6b7280" domain={[25,90]} />
                  <Tooltip labelFormatter={(v)=>new Date(Number(v)).toLocaleString()} formatter={(val)=>[`${val} %`, 'Humidité']} />
                  <ReferenceArea y1={55} y2={65} fill="#22c55e" fillOpacity={0.08} />
                  <Line type="monotone" dataKey="v" stroke="#60a5fa" dot={false} strokeWidth={2} />
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
          const badgeV = lastV != null ? badgeFromViscosity(lastV, bounds.viscosite.low, bounds.viscosite.high) : null;
          const dens = b.last?.densite ?? null;
          const badgeD = dens != null ? (dens < bounds.densite.low || dens > bounds.densite.high ? { cls: 'err', label: 'Hors borne' } : { cls: 'ok', label: 'OK' }) : null;
          const pc = b.last ? (65 + Math.round(((b.last.viscosite%10)-5)*2)) : null;
          const badgePC = pc != null ? (pc < 60 || pc > 75 ? { cls: 'warn', label: 'Surv.' } : { cls: 'ok', label: 'OK' }) : null;
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
                      <span className={`dot blue`}></span>
                      <div>Débit H₂O: <strong>{doseRateLph.toFixed(3)} L/h</strong></div>
                    </div>
                    <span>📈</span>
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


