import { Routes, Route, NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Home from './pages/Home';
import Detail from './pages/Detail';
import Donnees from './pages/Donnees';
import Params from './pages/Params';
import Login from './pages/Login';
import './app.css';

export function App() {
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('theme') || 'light');
  const [userMenu, setUserMenu] = useState(false);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const close = () => setUserMenu(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [theme]);

  const [authed, setAuthed] = useState<boolean>(false);
  const onLogin = () => { setAuthed(true); sessionStorage.setItem('authed', '1'); };
  const onLogout = () => { setAuthed(false); sessionStorage.removeItem('authed'); };

  if (!authed) {
    return <Login onLogin={onLogin} />;
  }

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand" title="Safran">
          <img src="/SAF.PA_BIG.svg" className="logo" alt="Safran" />
        </div>
        <div className="links" style={{ alignItems: 'center' }}>
          <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>Accueil</NavLink>
          <NavLink to="/donnees" className={({ isActive }) => isActive ? 'active' : ''}>Données</NavLink>
          <button aria-label="Basculer thème" className="icon-btn" title={theme === 'light' ? 'Thème sombre' : 'Thème clair'} onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'light' ? (
              <img key="sun" className="icon-swap enter" src="/sun.svg" alt="sun" style={{ width: 18, height: 18 }} />
            ) : (
              <img key="moon" className="icon-swap enter moon-filter" src="/moon.svg" alt="moon" style={{ width: 18, height: 18 }} />
            )}
          </button>
          <div style={{ position: 'relative' }}>
            <button className="user-btn" onClick={(e) => { e.stopPropagation(); setUserMenu(m => !m); }}>
              <div className="user-meta" style={{ textAlign: 'right' }}>
                <span className="user-name">PFX - Safran Tech</span>
                <span className="user-role">admin</span>
              </div>
              <img className="avatar" src="/SAF.PA.svg" alt="user" />
            </button>
            {userMenu && (
              <div className="dropdown" onClick={e => e.stopPropagation()}>
                <a className="dropdown-item" href="#">Profil</a>
                <NavLink className="dropdown-item" to="/params">Paramètres</NavLink>
                <a className="dropdown-item" href="#">Support</a>
                <button className="dropdown-item borderline" onClick={onLogout}>Se déconnecter</button>
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
          <Route path="/params" element={<Params />} />
        </Routes>
      </main>
      <footer className="footer">
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ borderTop: '1px solid var(--border)', marginBottom: 8 }}></div>
          this dashboard has been developed by an intern at SafranTech PFX - for inquiries, access permissions, or more info contact <a href="mailto:youssef.karim@safrangroup.com?subject=inquiry%20about%20the%20dashboard%20of%20ceramic%20slurries">youssef.karim@safrangroup.com</a>
        </div>
      </footer>
    </div>
  );
}


