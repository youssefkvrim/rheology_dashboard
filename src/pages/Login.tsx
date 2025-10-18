import { useState } from 'react';
import { authenticate, requestPasswordReset } from '../services/api';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '70vh' }}>
      <div className="panel" style={{ width: 360 }}>
        <h2>Connexion requise</h2>
        <p className="muted">Veuillez saisir vos identifiants Safran.</p>
        <div style={{ display: 'grid', gap: 8 }}>
          <input placeholder="Email professionnel" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <div className="row" style={{ gap: 8 }}>
            <input placeholder="Mot de passe" type={show ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} style={{ flex: 1 }} />
            <button className="icon-btn" title={show ? 'Masquer' : 'Afficher'} onClick={() => setShow(v => !v)}>{show ? '🙈' : '👁️'}</button>
          </div>
          {err && <div className="badge err">{err}</div>}
          {info && <div className="badge ok">{info}</div>}
          <button onClick={async () => {
            setErr(''); setInfo('');
            const res = await authenticate(email.trim().toLowerCase(), pass);
            if (!res.ok) { setErr('Identifiants invalides'); return; }
            sessionStorage.setItem('authed', '1');
            sessionStorage.setItem('auth_email', email.trim().toLowerCase());
            onLogin();
          }}>Se connecter</button>
          <button className="link" onClick={async () => {
            setErr(''); setInfo('');
            const res = await requestPasswordReset(email.trim().toLowerCase());
            if (!res.ok) { setErr('Email invalide (domaine @safrangroup.com requis)'); return; }
            setInfo('Email de réinitialisation envoyé (demo). Vérifiez votre boite.');
          }}>Mot de passe oublié ?</button>
        </div>
      </div>
    </div>
  );
}


