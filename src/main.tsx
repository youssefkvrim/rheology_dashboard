import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { ChartParamsProvider } from './store/chartParams';
import { AuthProvider } from './features/auth/AuthContext';
import { I18nProvider } from './i18n';
import { useBarbotineStore } from './store/barbotineStore';
import { useBoundsStore } from './store/boundsStore';
import './styles/index.css';

// figures out the base url path, needed when the app runs behind a proxy
function getBasename(): string {
  const path = window.location.pathname;
  // checks if we're behind a reverse proxy like /proxy/3000 and uses that as base
  const match = path.match(/^(.*\/proxy\/\d+)/);
  if (match) return match[1];
  const base = (import.meta as any).env?.BASE_URL || '/';
  return base === './' ? '' : base.replace(/\/$/, '');
}

// loads all the data the app needs when it first opens or when u log in
function StoreInitializer({ children }: { children: React.ReactNode }) {
  const loadBarbotines = useBarbotineStore(s => s.loadBarbotines);
  const reloadBoundsFromStorage = useBoundsStore(s => s.reloadFromStorage);
  const reloadBoundsFromBackend = useBoundsStore(s => s.reloadFromBackend);

  // fetch all the barbotine data right away on first render
  useEffect(() => {
    void loadBarbotines();
  }, [loadBarbotines]);

  // when someone logs in, refetch everything so the data is fresh
  useEffect(() => {
    const onLogin = () => {
      void loadBarbotines();
      reloadBoundsFromStorage();
      void reloadBoundsFromBackend();
    };
    window.addEventListener('user-login', onLogin);
    return () => window.removeEventListener('user-login', onLogin);
  }, [loadBarbotines, reloadBoundsFromStorage, reloadBoundsFromBackend]);

  return <>{children}</>;
}

// wraps the whole app with all the providers it needs to work
// ngl the nesting looks crazy but each layer adds something (auth, i18n, data, etc)
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={getBasename()}>
      <I18nProvider>
      <AuthProvider>
        <StoreInitializer>
          <ChartParamsProvider>
            <App />
          </ChartParamsProvider>
        </StoreInitializer>
      </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>
);
