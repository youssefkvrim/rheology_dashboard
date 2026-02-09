import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { AppStateProvider } from './store/appState';
import { ChartParamsProvider } from './store/chartParams';
import { AuthProvider } from './features/auth/AuthContext';
import { I18nProvider } from './i18n';
import './index.css';

// Detect basename for reverse proxy: if URL contains /proxy/3000, use everything up to and including it
function getBasename(): string {
  const path = window.location.pathname;
  // Match patterns like /studio/.../proxy/3000 or /proxy/3000
  const match = path.match(/^(.*\/proxy\/\d+)/);
  if (match) return match[1];
  // Fallback: use import.meta.env.BASE_URL (set by Vite's base config)
  const base = (import.meta as any).env?.BASE_URL || '/';
  return base === './' ? '' : base.replace(/\/$/, '');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={getBasename()}>
      <I18nProvider>
      <AuthProvider>
        <AppStateProvider>
          <ChartParamsProvider>
            <App />
          </ChartParamsProvider>
        </AppStateProvider>
      </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>
);


