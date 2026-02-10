import { useEffect, useState } from 'react';
import { loginApi, requestPasswordReset, ASSET_BASE, apiHealth, setAuthToken } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';
import { useTranslation } from '../i18n';

// the login page - u gotta get past this before seeing anything else
export default function Login({ onLogin }: { onLogin: () => void }) {
  const t = useTranslation();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hoverForgot, setHoverForgot] = useState(false);
  const [showName, setShowName] = useState(false);
  const [dbReachable, setDbReachable] = useState<boolean | null>(null);
  const { login: loginSSO } = useAuth();
  const inputBaseStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 40 };

  // checks if the server is alive so we can warn the user if its down
  useEffect(() => {
    apiHealth().then(ok => setDbReachable(ok)).catch(() => setDbReachable(false));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* hides those annoying browser-default password reveal buttons */}
      <style>{`input::-ms-reveal, input::-ms-clear, input::-webkit-credentials-auto-fill-button { display: none !important; }`}</style>
      
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="panel" style={{ width: 360 }}>
        <h2>{t('login.loginRequired')}</h2>
        <div style={{ display: 'grid', gap: 8 }}>
            <input placeholder={t('login.usernamePlaceholder')} value={user} onChange={e => setUser(e.target.value)} autoComplete="username" style={inputBaseStyle} />
          <div style={{ position: 'relative' }}>
              <input placeholder={t('login.password')} type={showPass ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password" style={{ ...inputBaseStyle, paddingRight: 40 }} />
              <button tabIndex={-1} aria-label={showPass ? t('login.hidePassword') : t('login.showPassword')} onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={showPass ? `${ASSET_BASE}/password_shown.svg` : `${ASSET_BASE}/password_hidden.svg`} alt="toggle" style={{ width: 20, height: 20, opacity: 0.8 }} />
            </button>
          </div>
          {err && <div className="badge err">{err}</div>}
          {/* the actual login button - sends creds to server, saves token if it works */}
          <button disabled={busy} onClick={async () => {
            setErr(''); setBusy(true);
            try {
              const res = await loginApi(user, pass);
              if (!res.ok || !res.token || !res.user) { setErr(t('login.invalidCredentials')); return; }
              setAuthToken(res.token);
              // stash user info so we can use it across the app
              sessionStorage.setItem('userId', res.user.userId);
              sessionStorage.setItem('email', res.user.email);
              sessionStorage.setItem('role', res.user.role);
              window.dispatchEvent(new Event('user-login'));
              onLogin();
            } catch {
              setErr(t('login.serverError'));
            } finally {
              setBusy(false);
            }
            }} style={{ height: 40 }}>{t('login.submit')}</button>
            <button onClick={() => { void loginSSO(); }} style={{ height: 40 }}>
              {t('login.sso')}
            </button>
            {/* forgot password link - sends a reset email */}
            <span
              className="link"
              aria-label={t('login.forgotPassword')}
              onMouseEnter={() => setHoverForgot(true)}
              onMouseLeave={() => setHoverForgot(false)}
              onClick={async () => {
            setErr(''); setBusy(true);
            try {
              const r = await requestPasswordReset(user || '');
              if (!r.ok) { setErr(r.reason || t('login.resetFailed')); return; }
              alert(`${t('login.resetEmailSent')} ${r.to}`);
            } catch {
              setErr(t('login.serverError'));
            } finally {
              setBusy(false);
            }
              }}
              style={{ textAlign: 'center', cursor: 'pointer', fontSize: 13, lineHeight: '40px', opacity: hoverForgot ? 1 : 0.6 }}
            >
              {t('login.forgotPassword')}
            </span>
          </div>
        </div>
      </div>

      {/* footer with server status + credits */}
      <footer className="footer" style={{ padding: 0 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 16px' }}>
          <div style={{ borderTop: '1px solid var(--border)', marginBottom: 8 }}></div>
          {dbReachable === false && <div className="badge err" style={{ marginBottom: 4 }}>{t('login.serverUnreachable')}</div>}
          {t('login.footer')}{' '}
          {/* hover to reveal who made this lol */}
          <span
            onMouseEnter={() => setShowName(true)}
            onMouseLeave={() => setShowName(false)}
            style={{ display: 'inline-block', transition: 'color 150ms ease', cursor: 'pointer' }}
            title="contact me at karim21youssef@gmail.com"
          >
            {showName ? 'youssef karim' : t('login.footerIntern')}
          </span>{' '}{t('login.footerAt')}{' '}
          <a href="mailto:youssef.karim@safrangroup.com?subject=inquiry%20about%20the%20dashboard%20of%20ceramic%20slurries">{t('login.support')}</a>
        </div>
      </footer>
    </div>
  );
}
