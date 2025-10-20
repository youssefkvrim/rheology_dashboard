import { useEffect, useState } from 'react';
import { resetPasswordWithToken } from '../services/api';

export default function Reset() {
  const [token, setToken] = useState('');
  const [pwd, setPwd] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get('token');
    if (t) setToken(t);
  }, []);
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '70vh' }}>
      <div className="panel" style={{ width: 360 }}>
        <h2>Réinitialiser le mot de passe</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          <input placeholder="Token" value={token} onChange={e => setToken(e.target.value)} />
          <input placeholder="Nouveau mot de passe" type="password" value={pwd} onChange={e => setPwd(e.target.value)} />
          {err && <div className="badge err">{err}</div>}
          {msg && <div className="badge ok">{msg}</div>}
          <button disabled={busy} onClick={async () => {
            setErr(null); setMsg(null); setBusy(true);
            try {
              const r = await resetPasswordWithToken(token, pwd);
              if (!r.ok) { setErr(r.reason || 'Échec de réinitialisation'); return; }
              setMsg('Mot de passe réinitialisé');
            } finally {
              setBusy(false);
            }
          }}>Réinitialiser</button>
        </div>
      </div>
    </div>
  );
}


