import { Routes, Route, NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Home from '../pages/Home';
import Detail from '../pages/Detail';
import Donnees from '../pages/Donnees';
import Params from '../pages/Params';
import Profile from '../pages/Profile';
import Support from '../pages/Support';
import Login from '../pages/Login';
import Reset from '../pages/Reset';
import Loading from '../pages/Loading';
import '../app.css';
import { useAuth } from '../features/auth/AuthContext';
import { getUserPrefs, putUserPrefs } from '../services/api';
import { apiHealth } from '../services/api';

export function App() {
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('theme') || 'light');
  const [userMenu, setUserMenu] = useState(false);
  const [showName, setShowName] = useState(false);
  const [dbgOpen, setDbgOpen] = useState(false);
  const [dbReachable, setDbReachable] = useState(true);
  const [errors, setErrors] = useState<Array<{ ts:number; msg:string }>>([]);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const close = () => setUserMenu(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [theme]);
  useEffect(() => {
    const onError = (e: ErrorEvent) => setErrors(prev => [{ ts: Date.now(), msg: String(e?.message || 'Error') }, ...prev].slice(0,50));
    const onRej = (e: PromiseRejectionEvent) => setErrors(prev => [{ ts: Date.now(), msg: String((e?.reason && e.reason.message) || 'Promise rejection') }, ...prev].slice(0,50));
    const onAppErr = (e: any) => setErrors(prev => [{ ts: Date.now(), msg: String(e?.detail?.message || 'App error') }, ...prev].slice(0,50));
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRej);
    window.addEventListener('app-error', onAppErr as any);
    const id = setInterval(async () => {
      try { const ok = await apiHealth(); setDbReachable(ok); } catch { setDbReachable(false); }
    }, 10000);
    return () => { clearInterval(id); window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRej); window.removeEventListener('app-error', onAppErr as any); };
  }, []);

  const { ready, isAuthenticated, user, login, logout } = useAuth();
  // Load theme from backend prefs when authenticated
  useEffect(() => {
    (async () => {
      try {
        if (!isAuthenticated || !user?.username) return;
        const prefs = await getUserPrefs(user.username);
        const remoteTheme = prefs?.theme;
        if (remoteTheme && (remoteTheme === 'light' || remoteTheme === 'dark')) {
          setTheme(remoteTheme);
        }
      } catch { /* ignore */ }
    })();
  }, [isAuthenticated, user?.username]);
  // Persist theme to backend
  useEffect(() => {
    (async () => {
      try {
        if (!isAuthenticated || !user?.username) return;
        await putUserPrefs(user.username, { theme });
      } catch { /* ignore */ }
    })();
  }, [theme, isAuthenticated, user?.username]);

  if (!ready) {
    return (
      <div className="app">
        <main className="content" style={{ maxWidth: 640, margin: '0 auto' }}>
          <div className="panel" style={{ padding: 24, marginTop: 80, textAlign: 'center' }}>Chargement…</div>
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="app">
        <main className="content" style={{ maxWidth: 640, margin: '0 auto' }}>
          <Routes>
            <Route path="/reset" element={<Reset />} />
            <Route path="*" element={<Login onLogin={() => { void login(); }} />} />
          </Routes>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand" title="Safran" style={{ cursor: 'pointer' }}>
          <NavLink to="/" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <img src="/assets/SAF.PA_BIG.svg" className="logo" alt="Safran" />
          </NavLink>
        </div>
        <div className="links" style={{ alignItems: 'center' }}>
          <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>Accueil</NavLink>
          <NavLink to="/donnees" className={({ isActive }) => isActive ? 'active' : ''}>Données</NavLink>
          <button aria-label="Basculer thème" className="icon-btn" title={theme === 'light' ? 'Thème sombre' : 'Thème clair'} onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'light' ? (
              <img key="sun" className="icon-swap enter" src="/assets/sun.svg" alt="sun" style={{ width: 18, height: 18 }} />
            ) : (
              <img key="moon" className="icon-swap enter moon-filter" src="/assets/moon.svg" alt="moon" style={{ width: 18, height: 18 }} />
            )}
          </button>
          <div style={{ position: 'relative' }}>
            <button className="user-btn" onClick={(e) => { e.stopPropagation(); setUserMenu(m => !m); }}>
              {(() => {
                const email = user?.email || '';
                const base = (email.split('@')[0] || '').replace(/[_-]/g, ' ').replace(/\./g, ' ').trim() || 'Utilisateur';
                const parts = base.split(/\s+/);
                const display = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : base;
                const initial = display.charAt(0).toUpperCase();
                // TEMP: hardcode 'Editor' for youssef.karim — replace with server RBAC mapping
                const roleLabel = (email.toLowerCase() === 'youssef.karim@safrangroup.com') ? 'Editor' : (user?.level === 3 ? 'Editor' : user?.level === 2 ? 'Read & Export' : 'Read-only');
                return (
                  <>
              <div className="user-meta" style={{ textAlign: 'right' }}>
                      <span className="user-name">{display}</span>
                      <span className="user-role">{roleLabel}</span>
              </div>
                    <div className="avatar-initial" aria-hidden="true">{initial || 'U'}</div>
                  </>
                );
              })()}
            </button>
            {userMenu && (
              <div className="dropdown" onClick={e => e.stopPropagation()}>
                <NavLink className="dropdown-item" to="/profile">Profil</NavLink>
                <NavLink className="dropdown-item" to="/params">Paramètres</NavLink>
                <NavLink className="dropdown-item" to="/support">Support</NavLink>
                <button className="dropdown-item logout" onClick={() => { void logout(); }}>Déconnexion</button>
              </div>
            )}
          </div>
        </div>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/barbotine/:id" element={<Detail />} />
          <Route path="/donnees" element={<Donnees />} />
          <Route path="/loading" element={<Loading />} />
          <Route path="/params" element={<Params />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/support" element={<Support />} />
          <Route path="/reset" element={<Reset />} />
        </Routes>
      </main>
      {/* Global debugger widget */}
      <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 60 }}>
        {!dbgOpen ? (
          <button
            onClick={() => setDbgOpen(true)}
            title="Debugger"
            className="icon-btn"
            style={{ width: 48, height: 48, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb' }}
          >
            <img src="/assets/bug.svg" alt="bug" style={{ width: 22, height: 22 }} />
          </button>
        ) : (
          <div className="panel" style={{ width: 280, padding: 10, maxHeight: '60vh', overflowY: 'auto' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>Debugger</strong>
              <button className="icon-btn" onClick={() => setDbgOpen(false)} aria-label="Toggle debugger">–</button>
            </div>
            <div style={{ marginTop: 6, fontSize: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Server</span>
                <span className={`badge ${dbReachable ? 'ok' : 'err'}`}>{dbReachable ? 'OK' : 'DOWN'}</span>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Errors</span>
                <span>{errors.length}</span>
              </div>
              <div className="log" style={{ marginTop: 6 }}>
                {errors.slice(0,5).map((e,i)=> (
                  <div key={i} className="log-item">{new Date(e.ts).toLocaleTimeString()} — {e.msg}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <footer className="footer">
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ borderTop: '1px solid var(--border)', marginBottom: 8 }}></div>
          this dashboard has been developed by{' '}
          <span
            onMouseEnter={() => setShowName(true)}
            onMouseLeave={() => setShowName(false)}
            style={{ display: 'inline-block', transition: 'color 150ms ease' }}
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


