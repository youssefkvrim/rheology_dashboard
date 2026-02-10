import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiHealth } from '../services/api';
// backup ascii art in case the server one doesnt load
// @ts-ignore
import asciiRaw from '../../loading_page/ascii.txt?raw';

// tries to load the ascii art text - server first, bundled file as backup
function useAsciiSource(): string {
  const [text, setText] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let src: string | null = null;
        try {
          const res = await fetch('./loading_page/ascii.txt', { cache: 'no-store' });
          if (res.ok) src = await res.text();
        } catch {}
        // server didnt work? use the bundled one
        if (!src && typeof asciiRaw === 'string' && asciiRaw.trim().length > 0) {
          src = asciiRaw;
        }
        if (!src) src = 'SAFRAN\nLoading…';
        if (!cancelled) setText(src);
      } catch {
        if (!cancelled) setText('SAFRAN\nLoading…');
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return text;
}

export type LoadingProps = {
  minMs?: number;           // how long to show this screen at minimum (3s default)
  serverTimeoutMs?: number; // how long to wait if server is down (7s default)
  onReady?: () => void;     // runs when the loading screen is done
  autoNavigate?: boolean;   // go to home page automatically when done?
};

// the cool loading screen with animated ascii art - shows while the app boots up
export default function Loading({ minMs = 3000, serverTimeoutMs = 7000, onReady, autoNavigate = false }: LoadingProps) {
  const navigate = useNavigate();
  const ascii = useAsciiSource();
  const baseLines = useMemo(() => ascii.split('\n'), [ascii]);
  const [frame, setFrame] = useState<number>(0);
  const rafRef = useRef<number | null>(null);
  const lastTs = useRef<number>(0);
  const [dots, setDots] = useState<number>(0);
  const startRef = useRef<number>(Date.now());
  const [serverOk, setServerOk] = useState<boolean | null>(null); // null = still checking
  const [done, setDone] = useState<boolean>(false);

  // pings the server once to see if its up
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ok = await apiHealth();
        if (!cancelled) setServerOk(ok);
      } catch {
        if (!cancelled) setServerOk(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // decides when to move on - 3s if server is fine, 7s if its not responding
  useEffect(() => {
    if (done) return;
    const elapsed = () => Date.now() - startRef.current;
    const check = () => {
      if (serverOk === null) return; // still waiting on the ping
      const required = serverOk ? minMs : serverTimeoutMs;
      if (elapsed() >= required) {
        setDone(true);
        if (onReady) onReady();
        else if (autoNavigate) navigate('/');
      }
    };
    check();
    const id = setInterval(check, 200);
    return () => clearInterval(id);
  }, [serverOk, minMs, serverTimeoutMs, done, onReady, navigate, autoNavigate]);

  // swaps characters within their group to make the ascii art look animated
  const nextChar = (ch: string, step: number): string => {
    const gA = ['-', '=', '+'];
    const gB = ['*', '#'];
    const gN = ['0','1','2','3','4','5','6','7','8','9'];
    if (gA.includes(ch)) return gA[(gA.indexOf(ch) + step) % gA.length];
    if (gB.includes(ch)) return gB[(gB.indexOf(ch) + step) % gB.length];
    if (gN.includes(ch)) return gN[(gN.indexOf(ch) + step) % gN.length];
    return ch;
  };

  // creates the animated frame - each character cycles with a diagonal wave effect
  const animatedText = useMemo(() => {
    if (!baseLines.length) return '';
    const period = 4;
    const linesOut: string[] = [];
    for (let r = 0; r < baseLines.length; r++) {
      const line = baseLines[r];
      let out = '';
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        const offset = (frame + r + Math.floor(c / 2)) % period;
        out += nextChar(ch, offset);
      }
      linesOut.push(out);
    }
    return linesOut.join('\n');
  }, [baseLines, frame]);

  // animation loop - runs ~11fps to keep the ascii art shifting around
  useEffect(() => {
    const loop = (t: number) => {
      if (!lastTs.current) lastTs.current = t;
      const dt = t - lastTs.current;
      if (dt >= 90) {
        lastTs.current = t;
        setFrame(f => (f + 1) % 4096);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // the "Loading..." dots animation
  useEffect(() => {
    const id = setInterval(() => setDots(d => (d + 1) % 4), 420);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      role="document"
      style={{
        position: 'fixed',
        inset: 0,
        background: '#ffffff',
        color: '#9CA3AF',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <pre
          style={{
            margin: 0,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 8,
            lineHeight: 1,
            whiteSpace: 'pre',
            textAlign: 'left',
            color: '#9CA3AF',
            maxWidth: '90vw',
            maxHeight: '70vh',
            overflow: 'auto'
          }}
        >{animatedText}</pre>
        <div style={{ alignSelf: 'center', fontSize: 18, fontWeight: 600, color: '#9CA3AF' }}>
          <span style={{ display: 'inline-block', textAlign: 'left', minWidth: 120 }}>
            {`Loading${'.'.repeat(dots)}`}
          </span>
        </div>
      </div>
    </div>
  );
}
