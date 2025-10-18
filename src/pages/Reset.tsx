import { useState } from 'react';
import { setPasswordWithToken } from '../services/api';

export default function Reset() {
  const [token, setToken] = useState<string>('');
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '70vh' }}>
      <div className="panel" style={{ width: 360 }}>
        <h2>Réinitialiser le mot de passe</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          <input placeholder="Token" value={token} onChange={e => { setToken(e.target.value); setMsg(''); setErr(''); }} />
          <input placeholder="Nouveau mot de passe" type="password" value={pass1} onChange={e => setPass1(e.target.value)} />
          <input placeholder="Confirmer le mot de passe" type="password" value={pass2} onChange={e => setPass2(e.target.value)} />
          {msg && <div className="badge ok">{msg}</div>}
          {err && <div className="badge err">{err}</div>}
          <button onClick={async () => {
            setMsg(''); setErr('');
            if (!token.trim()) { setErr('Token requis'); return; }
            if (pass1.length < 6) { setErr('Mot de passe trop court'); return; }
            if (pass1 !== pass2) { setErr('Les mots de passe ne correspondent pas'); return; }
            const res = await setPasswordWithToken(token.trim(), pass1);
            if (!res.ok) { setErr(res.reason || 'Token invalide'); return; }
            setMsg('Mot de passe mis à jour. Vous pouvez vous connecter.');
          }}>Mettre à jour</button>
        </div>
      </div>
    </div>
  );
}


