import { useEffect, useMemo, useRef, useState } from 'react';
// Fallback raw bundle (dev-only). Primary source is /public/loading_page/ascii.txt
// @ts-ignore
import asciiRaw from '../../loading_page/ascii.txt?raw';

function useAsciiSource(): string {
  const [text, setText] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let src: string | null = null;
        // Prefer public-served asset
        try {
          const res = await fetch('/loading_page/ascii.txt', { cache: 'no-store' });
          if (res.ok) src = await res.text();
        } catch {}
        // Fallback to bundled raw
        if (!src && typeof asciiRaw === 'string' && asciiRaw.trim().length > 0) {
          src = asciiRaw;
        }
        // Ensure string
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

export default function Loading() {
  const ascii = useAsciiSource();
  const baseLines = useMemo(() => ascii.split('\n'), [ascii]);
  const [frame, setFrame] = useState<number>(0);
  const rafRef = useRef<number | null>(null);
  const lastTs = useRef<number>(0);
  const [dots, setDots] = useState<number>(0);

  // Character groups to cycle through, preserving overall shape
  const nextChar = (ch: string, step: number): string => {
    // Group A: fine lines
    const gA = ['-', '=', '+'];
    // Group B: heavy dots
    const gB = ['*', '#'];
    // Numbers swell lightly
    const gN = ['0','1','2','3','4','5','6','7','8','9'];
    // Spaces and others remain stable
    if (gA.includes(ch)) return gA[(gA.indexOf(ch) + step) % gA.length];
    if (gB.includes(ch)) return gB[(gB.indexOf(ch) + step) % gB.length];
    if (gN.includes(ch)) return gN[(gN.indexOf(ch) + step) % gN.length];
    return ch;
  };

  // Build animated text by diagonally offsetting cycle per position
  const animatedText = useMemo(() => {
    if (!baseLines.length) return '';
    const period = 4; // 4-step small cycles
    const linesOut: string[] = [];
    for (let r = 0; r < baseLines.length; r++) {
      const line = baseLines[r];
      let out = '';
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        // Diagonal wave: offset grows with row and col; frame advances over time
        const offset = (frame + r + Math.floor(c / 2)) % period;
        out += nextChar(ch, offset);
      }
      linesOut.push(out);
    }
    return linesOut.join('\n');
  }, [baseLines, frame]);

  useEffect(() => {
    // rAF-driven timer with ~90ms cadence for smoothness without burning CPU
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


