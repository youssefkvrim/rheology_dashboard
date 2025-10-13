import { useState } from 'react';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '70vh' }}>
      <div className="panel" style={{ width: 360 }}>
        <h2>Connexion requise</h2>
        <p className="muted">Veuillez saisir vos identifiants.</p>
        <div style={{ display: 'grid', gap: 8 }}>
          <input placeholder="Nom d'utilisateur" value={user} onChange={e => setUser(e.target.value)} />
          <input placeholder="Mot de passe" type="password" value={pass} onChange={e => setPass(e.target.value)} />
          {err && <div className="badge err">{err}</div>}
          <button onClick={() => {
            if (user.trim() === 'pfx' && pass === 'pfx') { onLogin(); }
            else { setErr('Identifiants invalides'); }
          }}>Se connecter</button>
        </div>
      </div>
    </div>
  );
}


