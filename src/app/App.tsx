import { Routes, Route, NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Home from '../pages/Home';
import Detail from '../pages/Detail';
import Donnees from '../pages/Donnees';
import Moulage from '../pages/Moulage';
import Params from '../pages/Params';
import Profile from '../pages/Profile';
import Support from '../pages/Support';
import Login from '../pages/Login';
import Reset from '../pages/Reset';
import Loading from '../pages/Loading';
import '../app.css';
import { useAuth } from '../features/auth/AuthContext';
import { getUserPrefs, putUserPrefs, apiHealth, ASSET_BASE } from '../services/api';
import { useBarbotineStore } from '../store/barbotineStore';
import { usePrefsStore } from '../store/prefsStore';
import { DebuggerFab } from '../components/DebuggerFab';
import { useTranslation } from '../i18n';

export function App() {
  const t = useTranslation();
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('theme') || 'light');
  const [userMenu, setUserMenu] = useState(false);
  const [showName, setShowName] = useState(false);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    // grabs whatever accent color u picked last time (or defaults to navy)
    const accentColor = localStorage.getItem('accent-color') || '#0e224b';
    const ACCENT_COLORS = [
      { light: '#0e224b', dark: '#9db0df' },
      { light: '#0ea5e9', dark: '#7dd3fc' },
      { light: '#16a34a', dark: '#86efac' },
      { light: '#7c3aed', dark: '#c4b5fd' },
      { light: '#ea580c', dark: '#fdba74' },
    ];
    // finds the matching light/dark pair for the accent u chose
    const pair = ACCENT_COLORS.find(c => c.light === accentColor) || ACCENT_COLORS[0];
    document.documentElement.style.setProperty('--accent', pair.light);
    document.documentElement.style.setProperty('--accent-dark', pair.dark);
    // clicking anywhere on the page closes the user dropdown menu
    const close = () => setUserMenu(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [theme]);

  const { ready, isAuthenticated, user, login, logout } = useAuth();
  const initialDataLoading = useBarbotineStore(s => s.initialDataLoading);
  const refreshInterval = usePrefsStore(s => s.refreshInterval);
  const [loadingDone, setLoadingDone] = useState(false);
  // if u log out, reset the loading screen so it shows again next login
  useEffect(() => {
    if (!isAuthenticated) setLoadingDone(false);
  }, [isAuthenticated]);
  // pulls ur saved theme (light/dark) from the server once u log in
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
  // saves ur theme choice to the server so it sticks across devices
  useEffect(() => {
    (async () => {
      try {
        if (!isAuthenticated || !user?.username) return;
        await putUserPrefs(user.username, { theme });
      } catch { /* ignore */ }
    })();
  }, [theme, isAuthenticated, user?.username]);

  // shows the loading screen for at least 3s, up to 7s if server is being slow
  if (!ready) {
    return <Loading minMs={3000} serverTimeoutMs={7000} />;
  }
  if (isAuthenticated && !loadingDone) {
    return <Loading minMs={3000} serverTimeoutMs={7000} onReady={() => setLoadingDone(true)} />;
  }

  // not logged in? u only get the login page and password reset, nothing else
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

  // this is basically the skeleton of the whole app - sidebar, routes, everything
  return (
    <div className="app">
      <nav className="nav">
        <div className="brand" title="Safran" style={{ cursor: 'pointer' }}>
          <NavLink to="/" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <img src={`${ASSET_BASE}/SAF.PA_BIG.svg`} className="logo" alt="Safran" />
          </NavLink>
        </div>
        <div className="links" style={{ alignItems: 'center' }}>
          <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>{t('nav.accueil')}</NavLink>
          <NavLink to="/moulage" className={({ isActive }) => isActive ? 'active' : ''}>Moulage</NavLink>
          <NavLink to="/donnees" className={({ isActive }) => isActive ? 'active' : ''}>{t('nav.donnees')}</NavLink>
          <button aria-label="Basculer thème" className="icon-btn" title={theme === 'light' ? 'Thème sombre' : 'Thème clair'} onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'light' ? (
              <img key="sun" className="icon-swap enter" src={`${ASSET_BASE}/sun.svg`} alt="sun" style={{ width: 18, height: 18 }} />
            ) : (
              <img key="moon" className="icon-swap enter moon-filter" src={`${ASSET_BASE}/moon.svg`} alt="moon" style={{ width: 18, height: 18 }} />
            )}
          </button>
          <div style={{ position: 'relative' }}>
            {/* stopPropagation so the "click anywhere to close" thing doesnt immediately close it */}
            <button className="user-btn" onClick={(e) => { e.stopPropagation(); setUserMenu(m => !m); }}>
              {(() => {
                // basically turns "first.last@company.com" into "First Last"
                const email = user?.email || '';
                const base = (email.split('@')[0] || '').replace(/[_-]/g, ' ').replace(/\./g, ' ').trim() || 'Utilisateur';
                const parts = base.split(/\s+/).filter(Boolean);
                const display = parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : base;
                // grabs initials like "YK" from ur name for the lil avatar circle
                const initials = parts.length >= 2
                  ? (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
                  : base.charAt(0).toUpperCase();
                // TODO: this is a temp hack lol - hardcoded role for one user, needs real permissions from server
                const roleLabel = (email.toLowerCase() === 'youssef.karim@safrangroup.com') ? 'Editor' : (user?.level === 3 ? 'Editor' : user?.level === 2 ? 'Read & Export' : 'Read-only');
                return (
                  <>
              <div className="user-meta" style={{ textAlign: 'right' }}>
                      <span className="user-name">{display}</span>
                      <span className="user-role">{roleLabel}</span>
              </div>
                    <div className="avatar-initial" aria-hidden="true">{initials || 'U'}</div>
                  </>
                );
              })()}
            </button>
            {userMenu && (
              <div className="dropdown" onClick={e => e.stopPropagation()}>
                <NavLink className="dropdown-item" to="/profile">{t('nav.profile')}</NavLink>
                <NavLink className="dropdown-item" to="/params">{t('nav.params')}</NavLink>
                <NavLink className="dropdown-item" to="/support">{t('nav.support')}</NavLink>
                <button className="dropdown-item logout" onClick={() => { void logout(); }}>{t('nav.logout')}</button>
              </div>
            )}
          </div>
        </div>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/moulage" element={<Moulage />} />
          <Route path="/barbotine/:id" element={<Detail />} />
          <Route path="/donnees" element={<Donnees />} />
          <Route path="/loading" element={<Loading />} />
          <Route path="/params" element={<Params />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/support" element={<Support />} />
          <Route path="/reset" element={<Reset />} />
        </Routes>
      </main>
      {/* lil floating debug button, only shows up in dev basically */}
      <DebuggerFab />
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


