import { useEffect, useState } from 'react';
import { apiHealth, ASSET_BASE } from '../services/api';

// the little floating bug icon in the bottom right corner
export function DebuggerFab() {
  const [dbgOpen, setDbgOpen] = useState(false);
  const [dbReachable, setDbReachable] = useState(true);
  const [errors, setErrors] = useState<Array<{ ts: number; msg: string }>>([]);
  // tracks how many api calls worked vs failed
  const [fetchOk, setFetchOk] = useState(0);
  const [fetchErr, setFetchErr] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // catches any random errors that happen anywhere in the app
    const onError = (e: ErrorEvent) => setErrors(prev => [{ ts: Date.now(), msg: String(e?.message || 'Error') }, ...prev].slice(0, 50));
    const onRej = (e: PromiseRejectionEvent) => setErrors(prev => [{ ts: Date.now(), msg: String((e?.reason && e.reason.message) || 'Promise rejection') }, ...prev].slice(0, 50));
    // when an api call specifically fails
    const onAppErr = (e: any) => {
      setErrors(prev => [{ ts: Date.now(), msg: String(e?.detail?.message || 'App error') }, ...prev].slice(0, 50));
      setFetchErr(x => x + 1);
    };
    const onFetchOk = () => setFetchOk(x => x + 1);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRej);
    window.addEventListener('app-error', onAppErr as any);
    window.addEventListener('fetch-ok', onFetchOk as any);
    // pings the server every 10s to see if its still alive
    const id = setInterval(async () => {
      try { const ok = await apiHealth(); if (!cancelled) setDbReachable(ok); } catch { if (!cancelled) setDbReachable(false); }
    }, 10000);
    // cleanup so we dont leak event listeners when component unmounts
    return () => { cancelled = true; clearInterval(id); window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRej); window.removeEventListener('app-error', onAppErr as any); window.removeEventListener('fetch-ok', onFetchOk as any); };
  }, []);

  return (
    <>
      {/* clicking outside the panel closes it */}
      {dbgOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 59 }} onClick={() => setDbgOpen(false)} />}
      <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 60 }}>
        {!dbgOpen ? (
          <button onClick={() => setDbgOpen(true)} title="Debugger" className="icon-btn"
            style={{ width: 48, height: 48, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', background: 'var(--panel)' }}>
            <img src={`${ASSET_BASE}/bug.svg`} alt="bug" style={{ width: 22, height: 22, opacity: 0.6 }} />
          </button>
        ) : (
          // the expanded debug panel with all the juicy info
          <div className="panel" style={{ width: 280, padding: 10, maxHeight: '60vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>Debugger</strong>
              <button className="icon-btn" onClick={() => setDbgOpen(false)} aria-label="Close">–</button>
            </div>
            <div style={{ marginTop: 6, fontSize: 12 }}>
              {/* green = server is vibing, red = server is down */}
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Server</span>
                <span className={`badge ${dbReachable ? 'ok' : 'err'}`}>{dbReachable ? 'OK' : 'DOWN'}</span>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Fetch</span>
                <span>{fetchOk} ok / {fetchErr} err</span>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Errors</span>
                <span>{errors.length}</span>
              </div>
              {/* shows the last 5 errors with timestamps */}
              <div className="log" style={{ marginTop: 6 }}>
                {errors.slice(0, 5).map((e, i) => (
                  <div key={i} className="log-item">{new Date(e.ts).toLocaleTimeString()} — {e.msg}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
