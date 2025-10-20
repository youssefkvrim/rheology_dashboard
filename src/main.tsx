import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { AppStateProvider } from './store/appState';
import { ChartParamsProvider } from './store/chartParams';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppStateProvider>
        <ChartParamsProvider>
          <App />
        </ChartParamsProvider>
      </AppStateProvider>
    </BrowserRouter>
  </React.StrictMode>
);


