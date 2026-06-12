import { useEffect, useState } from 'react';
import { useTranslation } from '../i18n';
// @ts-ignore
import asciiRaw from '../../public/loading_page/ascii.txt?raw';

// tries to load the ascii art from the server, if that fails uses the bundled one, worst case just shows "SAFRAN"
function useAsciiSource(): string {
  const [text, setText] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let src: string | null = null;
        // first try fetching it live
        try {
          const res = await fetch('./loading_page/ascii.txt', { cache: 'no-store' });
          if (res.ok) src = await res.text();
        } catch {}
        // fallback to the bundled import if fetch didnt work
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

// placeholder page for the moulage feature - just shows ascii art and "in development"
export default function Moulage() {
  const t = useTranslation();
  const ascii = useAsciiSource();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 24 }}>
      {/* the big ascii art logo thing */}
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
        {t('moulage.inDevelopment')}
      </div>
    </div>
  );
}
