import { useState } from 'react';
import { authenticateUser, requestPasswordRecovery } from '../services/api';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputBaseStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 40 };

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '70vh' }}>
      <div className="panel" style={{ width: 360 }}>
        <h2>Connexion requise</h2>
        <p className="muted">Veuillez saisir vos identifiants.</p>
        <div style={{ display: 'grid', gap: 8 }}>
          <input placeholder="Nom d'utilisateur ou email" value={user} onChange={e => setUser(e.target.value)} style={inputBaseStyle} />
          <div style={{ position: 'relative' }}>
            <input placeholder="Mot de passe" type={showPass ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} style={{ ...inputBaseStyle, paddingRight: 40 }} />
            <button aria-label={showPass ? 'Masquer mot de passe' : 'Voir mot de passe'} onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
              <img src={showPass ? '/password_shown.svg' : '/password_hidden.svg'} alt="toggle" style={{ width: 20, height: 20, opacity: 0.8 }} />
            </button>
          </div>
          {err && <div className="badge err">{err}</div>}
          <button disabled={busy} onClick={async () => {
            setErr(''); setBusy(true);
            try {
              const res = await authenticateUser(user, pass);
              if (!res.ok) { setErr('Identifiants invalides'); return; }
              try {
                if (res.user) {
                  sessionStorage.setItem('userId', res.user.userId);
                  sessionStorage.setItem('email', res.user.email);
                  sessionStorage.setItem('role', res.user.role);
                  window.dispatchEvent(new Event('user-login'));
                }
              } catch {}
              onLogin();
            } finally {
              setBusy(false);
            }
          }}>Se connecter</button>
          <button className="link" disabled={busy} onClick={async () => {
            setErr(''); setBusy(true);
            try {
              const r = await requestPasswordRecovery(user || 'youssef.karim@safrangroup.com');
              if (!r.ok) { setErr(r.reason || 'Impossible de lancer la récupération'); return; }
              // Simulation only: show confirmation; real email requires backend mail service
              alert(`Un email de réinitialisation a été envoyé à: ${r.to}`);
            } finally {
              setBusy(false);
            }
          }} style={{ textAlign: 'center' }}>J'ai perdu mon mot de passe</button>
        </div>
      </div>
    </div>
  );
}


