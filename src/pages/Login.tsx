import { useState } from 'react';
import { authenticateUser, requestPasswordRecovery, ASSET_BASE } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hoverForgot, setHoverForgot] = useState(false);
  const { login: loginSSO } = useAuth();
  const inputBaseStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 40 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Centered login panel */}
      <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        <div className="panel" style={{ width: 360 }}>
          <h2>Connexion requise</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            <input placeholder="Nom d'utilisateur ou email" value={user} onChange={e => setUser(e.target.value)} autoComplete="username" style={inputBaseStyle} />
            <div style={{ position: 'relative' }}>
              {/* Hide browser's native password reveal button via inline style for Edge/Chrome */}
              <style>{`input::-ms-reveal, input::-ms-clear, input::-webkit-credentials-auto-fill-button { display: none !important; }`}</style>
              <input placeholder="Mot de passe" type={showPass ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password" style={{ ...inputBaseStyle, paddingRight: 40 }} />
              <button tabIndex={-1} aria-label={showPass ? 'Masquer mot de passe' : 'Voir mot de passe'} onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
                <img src={`${ASSET_BASE}/password_shown.svg`} alt="toggle" style={{ width: 20, height: 20, opacity: 0.8, display: showPass ? 'block' : 'none' }} />
                <img src={`${ASSET_BASE}/password_hidden.svg`} alt="toggle" style={{ width: 20, height: 20, opacity: 0.8, display: showPass ? 'none' : 'block' }} />
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
            }} style={{ height: 40 }}>Se connecter</button>
            <button onClick={() => { void loginSSO(); }} style={{ height: 40 }}>
              Se connecter avec SSO Safran
            </button>
            <span
              className="link"
              aria-label="Mot de passe oublié"
              onMouseEnter={()=>setHoverForgot(true)}
              onMouseLeave={()=>setHoverForgot(false)}
              onClick={async () => {
              setErr(''); setBusy(true);
              try {
                const r = await requestPasswordRecovery(user || 'youssef.karim@safrangroup.com');
                if (!r.ok) { setErr(r.reason || 'Impossible de lancer la récupération'); return; }
                // TODO: Replace simulation with real SMTP-backed email flow
                // Real implementation requires backend SMTP configuration in vault/secrets.env:
                //   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
                // Backend /api/auth/recover should queue email via nodemailer or similar
                alert(`Un email de réinitialisation a été envoyé à: ${r.to}`);
              } finally {
                setBusy(false);
              }
            }}
              style={{ textAlign: 'center', cursor: 'pointer', fontSize: 13, lineHeight: '40px', opacity: hoverForgot ? 1 : 0.6 }}
            >
              mot de passe oublié
            </span>
          </div>
        </div>
      </div>
      {/* Footer */}
      <footer className="footer" style={{ padding: '12px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid var(--border)', marginBottom: 8 }}></div>
          this dashboard has been developed by an intern at Safran SA PFX - for inquiries, access permissions, or more info contact{' '}
          <a href="mailto:youssef.karim@safrangroup.com?subject=inquiry%20about%20the%20dashboard%20of%20ceramic%20slurries">support</a>
        </div>
      </footer>
    </div>
  );
}
