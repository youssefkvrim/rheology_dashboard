import { useMemo, useState } from 'react';
import { inviteUser } from '../services/api';

export default function Params() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const username = useMemo(() => (email.includes('@') ? email.split('@')[0] : ''), [email]);

  return (
    <div>
      <h2>Paramètres</h2>
      <p className="muted">Paramètres de démonstration. Rien de persistant ici.</p>
      <ul>
        <li>Rafraîchissement: 5 secondes</li>
        <li>Seed: via ?seed=123</li>
        <li>Bornes: définies dans le code</li>
      </ul>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3>Utilisateurs</h3>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label>Inviter un utilisateur (@safrangroup.com)</label>
          <input type="email" placeholder="prenom.nom@safrangroup.com" value={email} onChange={e => { setEmail(e.target.value); setMsg(''); setErr(''); }} />
          <button onClick={async () => {
            setErr(''); setMsg('');
            const res = await inviteUser(email.trim().toLowerCase());
            if (!res.ok) { setErr('Email invalide (domaine @safrangroup.com requis)'); return; }
            setMsg(`Invitation envoyée (demo) à ${res.to}. Nom d'utilisateur: ${res.username}.`);
          }}>Envoyer invitation</button>
        </div>
        {username && <div className="muted">Nom d'utilisateur proposé: <strong>{username}</strong></div>}
        {msg && <div className="badge ok" style={{ marginTop: 8 }}>{msg}</div>}
        {err && <div className="badge err" style={{ marginTop: 8 }}>{err}</div>}
      </div>
    </div>
  );
}


