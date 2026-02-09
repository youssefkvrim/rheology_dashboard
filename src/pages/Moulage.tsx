import { useEffect, useState } from 'react';
// @ts-ignore
import asciiRaw from '../../loading_page/ascii.txt?raw';

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
        if (!src && typeof asciiRaw === 'string' && asciiRaw.trim().length > 0) {
          src = asciiRaw;
        }
        if (!src) src = 'SAFRAN';
        if (!cancelled) setText(src);
      } catch {
        if (!cancelled) setText('SAFRAN');
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return text;
}

export default function Moulage() {
  const ascii = useAsciiSource();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 24 }}>
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
          overflow: 'auto'
        }}
      >{ascii}</pre>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#9CA3AF' }}>
        Cette page est encore en cours de développement.
      </div>
    </div>
  );
}
