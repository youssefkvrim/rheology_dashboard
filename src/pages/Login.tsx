import { useState } from 'react';
import { authenticateUser, requestPasswordRecovery, ASSET_BASE, apiHealth } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hoverForgot, setHoverForgot] = useState(false);
  const [showName, setShowName] = useState(false);
  const [dbgOpen, setDbgOpen] = useState(false);
  const [dbReachable, setDbReachable] = useState<boolean | null>(null);
  const { login: loginSSO } = useAuth();
  const inputBaseStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 40 };

  // Check server health on mount
  useState(() => {
    apiHealth().then(ok => setDbReachable(ok)).catch(() => setDbReachable(false));
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Hide browser's native password reveal button */}
      <style>{`input::-ms-reveal, input::-ms-clear, input::-webkit-credentials-auto-fill-button { display: none !important; }`}</style>
      
      {/* Centered login panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="panel" style={{ width: 360 }}>
        <h2>Connexion requise</h2>
        <div style={{ display: 'grid', gap: 8 }}>
            <input placeholder="Nom d'utilisateur ou email" value={user} onChange={e => setUser(e.target.value)} autoComplete="username" style={inputBaseStyle} />
          <div style={{ position: 'relative' }}>
              <input placeholder="Mot de passe" type={showPass ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password" style={{ ...inputBaseStyle, paddingRight: 40 }} />
              <button tabIndex={-1} aria-label={showPass ? 'Masquer mot de passe' : 'Voir mot de passe'} onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={showPass ? `${ASSET_BASE}/password_shown.svg` : `${ASSET_BASE}/password_hidden.svg`} alt="toggle" style={{ width: 20, height: 20, opacity: 0.8 }} />
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
              onMouseEnter={() => setHoverForgot(true)}
              onMouseLeave={() => setHoverForgot(false)}
              onClick={async () => {
            setErr(''); setBusy(true);
            try {
              const r = await requestPasswordRecovery(user || 'youssef.karim@safrangroup.com');
              if (!r.ok) { setErr(r.reason || 'Impossible de lancer la récupération'); return; }
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

      {/* Debug button - same as other pages */}
      {dbgOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 59 }} onClick={() => setDbgOpen(false)} />}
      <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 60 }}>
        {!dbgOpen ? (
          <button
            onClick={() => setDbgOpen(true)}
            title="Debugger"
            className="icon-btn"
            style={{ width: 48, height: 48, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', background: 'var(--panel)' }}
          >
            <img src={`${ASSET_BASE}/bug.svg`} alt="bug" style={{ width: 22, height: 22, opacity: 0.6 }} />
          </button>
        ) : (
          <div className="panel" style={{ width: 280, padding: 10 }} onClick={e => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>Debugger</strong>
              <button className="icon-btn" onClick={() => setDbgOpen(false)} aria-label="Toggle debugger">–</button>
            </div>
            <div style={{ marginTop: 6, fontSize: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Server</span>
                <span className={`badge ${dbReachable ? 'ok' : 'err'}`}>{dbReachable ? 'OK' : 'DOWN'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer - same style as other pages, no padding */}
      <footer className="footer" style={{ padding: 0 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 16px' }}>
          <div style={{ borderTop: '1px solid var(--border)', marginBottom: 8 }}></div>
          this dashboard has been developed by{' '}
          <span
            onMouseEnter={() => setShowName(true)}
            onMouseLeave={() => setShowName(false)}
            style={{ display: 'inline-block', transition: 'color 150ms ease', cursor: 'pointer' }}
            title="contact me at karim21youssef@gmail.com"
          >
            {showName ? 'youssef karim' : 'an intern'}
          </span>{' '}at Safran SA PFX - for inquiries, access permissions, or more info contact{' '}
          <a href="mailto:youssef.karim@safrangroup.com?subject=inquiry%20about%20the%20dashboard%20of%20ceramic%20slurries">support</a>
        </div>
      </footer>
    </div>
  );
}
