import { useEffect, useState } from 'react';
// @ts-ignore - vite imports this text file directly
import asciiArt from '../../../public/loading_page/ascii.txt?raw';

type SqlTemplatePanelProps = {
  sqlEdits: string[];
  onClear: () => void;
};

export function SqlTemplatePanel({ sqlEdits, onClear }: SqlTemplatePanelProps) {
  const [showLoading, setShowLoading] = useState<boolean>(false);
  const [dots, setDots] = useState<number>(0);
  const [asciiText, setAsciiText] = useState<string>('');

  useEffect(() => {
    if (!showLoading) return;
    const id = setInterval(() => setDots(d => (d + 1) % 4), 400);
    return () => clearInterval(id);
  }, [showLoading]);

  useEffect(() => {
    if (!showLoading) return;
    let cancelled = false;
    (async () => {
      try {
        if (typeof asciiArt === 'string' && asciiArt.trim().length > 0) {
          setAsciiText(asciiArt);
        }
        let txt: string | null = null;
        try {
          const res = await fetch('./loading_page/ascii.txt', { cache: 'no-store' });
          if (res.ok) txt = await res.text();
        } catch {}
        if (!txt && typeof asciiArt === 'string' && asciiArt.trim().length > 0) txt = asciiArt;
        if (!cancelled) setAsciiText(txt || '');
      } catch {
        if (!cancelled) setAsciiText('SAFRAN\nLoading…');
      }
    })();
    return () => { cancelled = true; };
  }, [showLoading]);

  return (
    <>
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>SQL code (to be removed before production)</h3>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <textarea
            readOnly
            value={sqlEdits.join('\n')}
            placeholder="Generated SQL statements appear here..."
            style={{ width: '100%', minHeight: 160 }}
          />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button onClick={onClear}>Clear</button>
        </div>
      </div>

      {showLoading && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowLoading(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '70vw', height: '70vh', maxWidth: 1200, maxHeight: '80vh', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}
          >
            <style>
              {`
              @keyframes scan {
                0% { transform: translateY(-100%); opacity: 0.0; }
                10% { opacity: 0.18; }
                50% { opacity: 0.14; }
                100% { transform: translateY(100%); opacity: 0.0; }
              }
              @keyframes gentlePulse {
                0% { opacity: 1.0; }
                50% { opacity: 0.78; }
                100% { opacity: 1.0; }
              }
              @keyframes shimmerX {
                0% { transform: translateX(-120%); opacity: 0.0; }
                10% { opacity: 0.22; }
                50% { opacity: 0.18; }
                100% { transform: translateX(120%); opacity: 0.0; }
              }
              `}
            </style>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
              <strong>Chargement</strong>
              <button className="icon-btn" onClick={() => setShowLoading(false)} aria-label="Fermer">×</button>
            </div>
            <div style={{ flex: 1, display: 'grid', gridTemplateRows: '1fr auto', overflow: 'hidden' }}>
              <div style={{ position: 'relative', overflow: 'auto', padding: 12, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                <pre style={{ margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 10, lineHeight: 1, whiteSpace: 'pre', color: '#9CA3AF', textShadow: '0 0 1px rgba(0,0,0,0.3)', animation: 'gentlePulse 2.4s ease-in-out infinite' }}>{asciiText || asciiArt || 'Loading…'}</pre>
                <div style={{ pointerEvents: 'none', position: 'absolute', top: 0, bottom: 0, left: 0, width: '40%', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.2), rgba(255,255,255,0))', filter: 'blur(2px)', animation: 'shimmerX 2.2s linear infinite' }} />
              </div>
              <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="muted">Prévisualisation — prototype de page de chargement</div>
                <div style={{ fontWeight: 600, color: '#374151' }}>
                  Loading{'.'.repeat(dots)}
                </div>
              </div>
            </div>
            <div style={{ pointerEvents: 'none', position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(31,41,55,0.25) 50%, rgba(255,255,255,0) 100%)', animation: 'scan 2.4s linear infinite' }} />
          </div>
        </div>
      )}
    </>
  );
}
