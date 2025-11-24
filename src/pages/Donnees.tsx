import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// @ts-ignore - Vite raw import for testing-only ASCII art
import asciiArt from '../../loading_page/ascii.txt?raw';
import { useAppState } from '../store/appState';
import type { ChartMetricKey } from '../store/chartParams';
import { fetchRheologyAll, apiHealth, exportCsv, importCsv, reportError } from '../services/api';

type PeriodKey = '1h' | '1d' | '1w' | 'last_month' | 'last_year' | 'all' | 'custom';

// Table metric keys used for the history table (API aligned)
type TableMetricKey = 'pc' | 'viscosity' | 'density' | 'pH' | 'H2O' | 'temperature' | 'silice' | 'grain';
type DayRow = Partial<Record<TableMetricKey, number>>;
type HistoryMap = Record<string /* dayKey */, Record<string /* barbotine name */, DayRow>>;

const metricLabels: Record<ChartMetricKey, string> = {
  densite: 'Densité',
  viscosite: 'Viscosité',
  ph: 'pH',
  temperature: 'Température',
  pc: 'Pouvoir Couvrant',
  h2o: 'H2O',
  silice: 'Silice',
  grains: 'Grain',
};

const unitsByMetric: Record<ChartMetricKey, string[]> = {
  densite: ['g/cm³', 'kg/m³', 'g/L', 'g/mL', 'kg/L', 'mg/mL'],
  viscosite: ['mPa·s', 'Pa·s', 'cP', 'P', 'cSt', 'St', 's'],
  ph: ['(-)'],
  temperature: ['°C', '°F', 'K'],
  pc: ['g', 'g/cm²'],
  h2o: ['L/h', 'L/day', 'mL/min', 'mL/s'],
  silice: ['%'],
  grains: ['%'],
};

function dayKey(ts: number) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function dayKeyToLabel(key: string) {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}
// Compute Europe/Paris offset suffix (e.g., +02 or +01) for a given date
function parisOffsetSuffix(y: number, m: number, d: number) {
  try {
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    // Prefer shortOffset if available; fall back to short (typically GMT+2/UTC+2)
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', timeZoneName: 'short' } as any);
    const parts = (fmt.formatToParts as any)(dt) as Array<{ type:string; value:string }>;
    const tz = parts?.find(p => p.type === 'timeZoneName')?.value || '';
    const mch = tz.match(/([+-])(\d{1,2})/);
    const sign = mch ? mch[1] : '+';
    const hh = mch ? mch[2].padStart(2, '0') : '01';
    return `${sign}${hh}`;
  } catch {
    return '+01';
  }
}
function toLocalDateTimeInput(ts: number) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function Donnees() {
  const { barbotines } = useAppState();
  const navigate = useNavigate();

  // Panel 1: Entrée manuelle (visuel uniquement)
  const [manualBb, setManualBb] = useState<string>(() => (barbotines[0]?.id ?? ''));
  const [manualMetric, setManualMetric] = useState<ChartMetricKey>('viscosite');
  const [manualDateTime, setManualDateTime] = useState<string>(''); // gg/mm/aaaa , HH:MM:SS
  const [manualValue, setManualValue] = useState<string>('');
  const manualUnitOptions = unitsByMetric[manualMetric];
  const [manualUnit, setManualUnit] = useState<string>(() => manualUnitOptions[0]);

  // Keep unit in sync with metric
  useMemo(() => {
    if (!manualUnitOptions.includes(manualUnit)) setManualUnit(manualUnitOptions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualMetric]);

  // Panel 3: Export (visuel seulement)
  const [expStart, setExpStart] = useState<string>('');
  const [expEnd, setExpEnd] = useState<string>('');
  const defaultExportBb = useMemo(() => {
    const sorted = [...barbotines].sort((a,b) => a.name.localeCompare(b.name));
    const firstM7 = sorted.find(b => b.name.includes('M7-3')) || sorted[0];
    return firstM7?.id || '';
  }, [barbotines]);
  const [expBbSingle, setExpBbSingle] = useState<string>(defaultExportBb);
  const [expMetricsMulti, setExpMetricsMulti] = useState<ChartMetricKey[]>(['densite','viscosite','pc']);
  const [metricsOpen, setMetricsOpen] = useState<boolean>(false);

  // Panel 4: Historique - default to last month (same day) from 00:00 to today 23:59
  const now = Date.now();
  const [histStart, setHistStart] = useState<string>('');
  const [histEnd, setHistEnd] = useState<string>('');

  const metricOrder: TableMetricKey[] = ['pc','viscosity','density','pH','H2O','temperature','silice','grain'];
  const headerLabels: Record<TableMetricKey, string> = {
    pc: 'Pouvoir Couvrant',
    viscosity: 'Viscosité',
    density: 'Densité',
    pH: 'pH',
    H2O: 'H2O',
    temperature: 'Temperature',
    silice: 'Silice',
    grain: 'Grain',
  };

  const [historyMap, setHistoryMap] = useState<HistoryMap>({});
  const [dayList, setDayList] = useState<string[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  // Testing-only SQL editor panel state (no DB writes). Keep track of generated SQL lines.
  const [sqlEdits, setSqlEdits] = useState<string[]>([]);
  const appendSql = (line: string) => setSqlEdits(prev => [...prev, line]);
  // Track changed cells to highlight them in red
  const [changedCells, setChangedCells] = useState<Record<string, boolean>>({});
  const markCellChanged = (key: string) => setChangedCells(prev => ({ ...prev, [key]: true }));
  // TESTING ONLY: loading overlay trigger and animation
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
        // Show immediately if bundled string is available
        if (typeof asciiArt === 'string' && asciiArt.trim().length > 0) {
          setAsciiText(asciiArt);
        }
        // Prefer public asset (served by Vite) to avoid bundling edge cases
        let txt: string | null = null;
        try {
          const res = await fetch('/loading_page/ascii.txt', { cache: 'no-store' });
          if (res.ok) txt = await res.text();
        } catch {}
        // Fallback to bundled raw import
        if (!txt && typeof asciiArt === 'string' && asciiArt.trim().length > 0) txt = asciiArt;
        if (!cancelled) setAsciiText(txt || '');
      } catch {
        if (!cancelled) setAsciiText('SAFRAN\nLoading…');
      }
    })();
    return () => { cancelled = true; };
  }, [showLoading]);
  const sortBarbotines = (a: { name: string }, b: { name: string }) => {
    const group = (name: string) => name.startsWith('M') ? 0 : name.startsWith('2') ? 1 : 2;
    const ga = group(a.name); const gb = group(b.name);
    if (ga !== gb) return ga - gb;
    return a.name.localeCompare(b.name);
  };

  // Importer CSV: file picker and tooltip controls
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [hoverBrowse, setHoverBrowse] = useState(false);
  const [activeBrowse, setActiveBrowse] = useState(false);
  const [showFmtTip, setShowFmtTip] = useState(false);
  const [fmtTipPos, setFmtTipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dbReachable, setDbReachable] = useState<boolean>(true);
  const openPicker = () => fileInputRef.current?.click();
  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    if (!dbReachable) { alert('Base de données indisponible'); return; }
    const accepted = Array.from(files).filter(f => /\.csv$/i.test(f.name) && f.size <= 2 * 1024 * 1024);
    if (!accepted.length) return;
    const file = accepted[0];
    const text = await file.text();
    // First attempt without override
    const res = await importCsv(text, false);
    if (!res.ok && res.conflicts && res.conflicts.length) {
      const ask = window.confirm(`Conflits sur ${res.conflicts.length} enregistrements. Écraser les existants ?`);
      if (ask) {
        const res2 = await importCsv(text, true);
        if (res2.ok) alert(`Import OK. Nouveaux: ${(res2.inserted||[]).length}, Modifiés: ${(res2.updated||[]).length}`);
        else alert('Import échoué.');
      }
    } else if (res.ok) {
      alert(`Import OK. Nouveaux: ${(res.inserted||[]).length}, Modifiés: ${(res.updated||[]).length}`);
    } else {
      alert('Import échoué.');
    }
  };

  useEffect(() => {
    // Check backend reachability at entry
    apiHealth().then(setDbReachable).catch(()=>setDbReachable(false));
    let cancelled = false;
    async function load() {
      const s = Date.parse(histStart);
      const e = Date.parse(histEnd);
      let startTs = Number.isFinite(s) ? s : NaN;
      let endTs = Number.isFinite(e) ? e : NaN;
      let globalMin = Number.POSITIVE_INFINITY;
      let globalMax = Number.NEGATIVE_INFINITY;
      setLoadingHistory(true);
      try {
        // Build per-day map
        const nextMap: HistoryMap = {};
        const daysSet = new Set<string>();
        // Order barbotines: M7-3 → 2CN2 → R55 → others
        const ordered = [...barbotines].sort((a,b) => {
          const group = (name: string) => name.includes('M7-3') ? 0 : name.includes('2CN2') ? 1 : name.includes('R55') ? 2 : 3;
          const ga = group(a.name); const gb = group(b.name);
          if (ga !== gb) return ga - gb;
          return a.name.localeCompare(b.name);
        });
        await Promise.all(ordered.map(async (b) => {
          const sid = (b as any).slurryId as string | undefined;
          if (!sid) return;
          try {
            const all = await fetchRheologyAll(sid, ['density','viscosity','pH','temperature','pc','H2O','silice','grain'], false);
            const series = all.series || {} as Record<string, Array<{ t:number; v:number }>>;
            const perMetric: Record<string, Map<string, { t:number; v:number }>> = {};
            for (const k of ['density','viscosity','pH','temperature','pc','H2O','silice','grain'] as const) {
              const allArr = (series[k] || []);
              for (const d of allArr) { if (d.t < globalMin) globalMin = d.t; if (d.t > globalMax) globalMax = d.t; }
              const arr = Number.isFinite(startTs) && Number.isFinite(endTs)
                ? allArr.filter(d => d.t >= startTs && d.t <= endTs)
                : allArr;
              const m = new Map<string, { t:number; v:number }>();
              for (const d of arr) {
                const dk = dayKey(d.t);
                const prev = m.get(dk);
                if (!prev || d.t > prev.t) m.set(dk, d);
              }
              perMetric[k] = m;
            }
            const dkAll = new Set<string>();
            Object.values(perMetric).forEach(m => m.forEach((_, dk) => dkAll.add(dk)));
            dkAll.forEach(dk => {
              daysSet.add(dk);
              if (!nextMap[dk]) nextMap[dk] = {};
              if (!nextMap[dk][b.name]) nextMap[dk][b.name] = {};
              const row = nextMap[dk][b.name]!;
              // Map API keys to table metric keys
              const mapPairs: Array<[keyof typeof perMetric, TableMetricKey]> = [
                ['pc','pc'], ['viscosity','viscosity'], ['density','density'], ['pH','pH'], ['H2O','H2O'], ['temperature','temperature'], ['silice','silice'], ['grain','grain']
              ];
              for (const [src, dst] of mapPairs) {
                const rec = perMetric[src].get(dk);
                if (rec) row[dst] = Number(rec.v);
              }
            });
          } catch {}
        }));
        if (cancelled) return;
        // If no explicit start/end provided, derive from global min/max and update inputs
        if (!(Number.isFinite(s) && Number.isFinite(e)) && Number.isFinite(globalMin) && Number.isFinite(globalMax)) {
          const dStart = new Date(globalMin); dStart.setHours(0,0,0,0);
          const dEnd = new Date(globalMax); dEnd.setHours(23,59,0,0);
          startTs = dStart.getTime(); endTs = dEnd.getTime();
          setHistStart(toLocalDateTimeInput(startTs));
          setHistEnd(toLocalDateTimeInput(endTs));
          // Re-filter the map for the computed range
          const filtered: HistoryMap = {};
          const daysFiltered = new Set<string>();
          Object.entries(nextMap).forEach(([dk, rows]) => {
            const [y,m,d] = dk.split('-').map(Number);
            const at = new Date(y!, (m!-1), d!).getTime();
            if (at >= startTs && at <= endTs) {
              filtered[dk] = rows; daysFiltered.add(dk);
            }
          });
          const sortedDays = Array.from(daysFiltered).sort();
          setHistoryMap(filtered);
          setDayList(sortedDays);
        } else {
          const sortedDays = Array.from(daysSet).sort();
          setHistoryMap(nextMap);
          setDayList(sortedDays);
        }
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [histStart, histEnd, barbotines]);

  return (
    <div>
      <h2>Données</h2>

      {/* Panel 1: Entrée manuelle */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Entrée manuelle</h3>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <label>Barbotine</label>
          <select value={manualBb} onChange={e => setManualBb(e.target.value)}>
            {barbotines.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          <label>Métrique</label>
          <select value={manualMetric} onChange={e => setManualMetric(e.target.value as ChartMetricKey)}>
            {(Object.keys(metricLabels) as ChartMetricKey[]).map(k => (
              <option key={k} value={k}>{metricLabels[k]}</option>
            ))}
          </select>

          <label>Date & heure</label>
          <input type="datetime-local" value={manualDateTime} onChange={e => setManualDateTime(e.target.value)} />

          <label>Valeur</label>
          <input type="text" placeholder="123.456" value={manualValue} onChange={e => setManualValue(e.target.value)} />

          <label>Unité</label>
          <select value={manualUnit} onChange={e => setManualUnit(e.target.value)}>
            {manualUnitOptions.map(u => <option key={u} value={u}>{u}</option>)}
          </select>

          <button disabled title="Bientôt disponible">Enregistrer</button>
        </div>
      </div>

      {/* Panel 2: Import CSV */}
      <div className="panel" style={{ marginTop: 16, border: '2px dashed var(--border)' }}>
        <h3>Importer CSV</h3>
        <div data-slot="card-content" className="p-12" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div role="presentation" tabIndex={0} className="text-center cursor-pointer transition-colors text-muted-foreground" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <input
              ref={fileInputRef}
              accept=".csv,text/csv"
              multiple
              style={{ border: 0, clip: 'rect(0px, 0px, 0px, 0px)', clipPath: 'inset(50%)', height: 1, margin: '0 -1px -1px 0', overflow: 'hidden', padding: 0, position: 'absolute', width: 1, whiteSpace: 'nowrap' }}
              tabIndex={-1}
              type="file"
              onChange={(e) => onFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={openPicker}
              className="mx-auto"
              aria-label="Open file picker"
              style={{ position: 'relative', width: 36, height: 36, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', marginBottom: 12, display: 'block' }}
            >
              <span aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, width: 36, height: 36, borderRadius: '50%', background: '#e5e7eb', zIndex: 0, pointerEvents: 'none' }} />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-upload text-primary"
                aria-hidden="true"
                style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'block', zIndex: 1, color: '#1f2937' }}
              >
                <path d="M12 3v12"></path>
                <path d="m17 8-5-5-5 5"></path>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              </svg>
            </button>
            <h3 className="text-lg font-semibold mb-2">Upload CSV File</h3>
            <div
              className="text-sm text-muted-foreground mb-4"
              onClick={openPicker}
              onMouseEnter={() => setHoverBrowse(true)}
              onMouseLeave={() => { setHoverBrowse(false); setActiveBrowse(false); }}
              onMouseDown={() => setActiveBrowse(true)}
              onMouseUp={() => setActiveBrowse(false)}
              style={{ cursor: 'pointer', transition: 'opacity 120ms ease', opacity: activeBrowse ? 0.7 : hoverBrowse ? 0.85 : 1 }}
            >
              Drag and drop your .csv file here, or click to browse
            </div>
            <button data-slot="button" type="button" onClick={openPicker} className="inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground shadow-xs hover:bg-primary/90" style={{ height: 32, padding: '0 12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file" aria-hidden="true" style={{ display: 'block', marginRight: 8 }}>
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path>
                <path d="M14 2v4a2 2 0 0 0 2 2h4"></path>
              </svg>
              <span style={{ display: 'inline-block' }}>Choose File</span>
            </button>
            <div
              className="mt-4 text-xs text-muted-foreground"
              style={{ fontSize: 11, marginTop: 20 }}
              onMouseEnter={() => setShowFmtTip(true)}
              onMouseLeave={() => setShowFmtTip(false)}
              onMouseMove={(e) => setFmtTipPos({ x: e.clientX + 12, y: e.clientY + 12 })}
            >
              Supported formats: .csv (Max size: 2MB)
            </div>
            {showFmtTip && (
              <div style={{ position: 'fixed', left: fmtTipPos.x, top: fmtTipPos.y, background: 'rgba(17,24,39,0.95)', color: '#f9fafb', padding: '6px 8px', fontSize: 12, borderRadius: 6, pointerEvents: 'none', zIndex: 9999 }}>
                CSV structure: id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel 3: Export */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Télécharger des données</h3>
        <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 240 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Barbotine</div>
            <select value={expBbSingle} onChange={e => setExpBbSingle(e.target.value)}>
              {[...barbotines].sort(sortBarbotines).map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 360, flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Période</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <label>Début</label>
              <input type="datetime-local" value={expStart} onChange={e => setExpStart(e.target.value)} />
              <label>Fin</label>
              <input type="datetime-local" value={expEnd} onChange={e => setExpEnd(e.target.value)} />
              <button
                disabled={!dbReachable}
                onClick={async ()=> {
                  if (!dbReachable) { alert('Base de données indisponible'); return; }
                  const b = barbotines.find(bb => bb.id === expBbSingle);
                  const sid = (b as any)?.slurryId || b?.id;
                  if (!sid) return;
                  const s = Date.parse(expStart); const e = Date.parse(expEnd);
                  const startTs = Number.isFinite(s) ? s : undefined as any;
                  const endTs = Number.isFinite(e) ? e : undefined as any;
                  try {
                    const blob = await exportCsv(String(sid), startTs, endTs);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${String(sid)}_${Date.now()}.csv`;
                    document.body.appendChild(a); a.click(); a.remove();
                    URL.revokeObjectURL(url);
                  } catch (e:any) {
                    reportError(`Export CSV failed: ${e?.message || 'error'}`);
                    alert('Export échoué.');
                  }
                }}
                style={{ marginLeft: 'auto' }}
              >
                Télécharger CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Panel 4: Historique sous forme de tableaux */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Historique (tableau)</h3>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label>Début</label>
          <input type="datetime-local" value={histStart} onChange={e => setHistStart(e.target.value)} />
          <label>Fin</label>
          <input type="datetime-local" value={histEnd} onChange={e => setHistEnd(e.target.value)} />
        </div>

        <div style={{ marginTop: 10 }}>
          <table className="table" style={{ width: '100%' }}>
              <tbody>
              {loadingHistory && (
                <tr><td colSpan={9}>Chargement…</td></tr>
              )}
              {!loadingHistory && dayList.map(dk => (
                <Fragment key={`day-${dk}`}>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ width: 140 }}>{dayKeyToLabel(dk)}</th>
                    {metricOrder.map(mk => <th key={`h-${dk}-${mk}`}>{headerLabels[mk]}</th>)}
                  </tr>
                  {[...barbotines]
                    .sort((a,b) => {
                      const group = (name: string) => name.includes('M7-3') ? 0 : name.includes('2CN2') ? 1 : name.includes('R55') ? 2 : 3;
                      const ga = group(a.name); const gb = group(b.name);
                      if (ga !== gb) return ga - gb; return a.name.localeCompare(b.name);
                    })
                    .map(b => {
                      const row = historyMap[dk]?.[b.name] || {};
                      return (
                        <tr key={`r-${dk}-${b.id}`}>
                          <td>{b.name}</td>
                          {metricOrder.map(mk => {
                            const v = row[mk];
                            const display = (typeof v === 'number' && Number.isFinite(v)) ? Number(v.toFixed(3)) : '—';
                            const editable = true; // testing-only: make cells editable
                            const cellKey = `${dk}|${b.id}|${mk}`;
                            return (
                              <td key={`c-${dk}-${b.id}-${mk}`} style={changedCells[cellKey] ? { border: '2px solid #ef4444' } : undefined}>
                                {editable ? (
                                  <input
                                    type="text"
                                    defaultValue={display as any}
                                    onFocus={(e) => { if (e.target.value === '—') e.target.value = ''; }}
                                    onBlur={(e) => {
                                      const newValRaw = e.target.value.trim();
                                      const hadValue = typeof v === 'number' && Number.isFinite(v);
                                      // Build identifiers
                                      const slurryId = (b as any).slurryId || b.name.replace(/\s+/g,'_');
                                      const slurryType = b.name.split(' ')[0] || 'M7-3';
                                      // Approximate precise timestamp from date key (local noon for unambiguous tz)
                                      const [yy,mm,dd] = dk.split('-').map(Number);
                                      // Build Paris local timestamp string at 13:00 with proper offset suffix
                                      const off = parisOffsetSuffix(yy!, mm!, dd!);
                                      const tsIso = `${String(yy)}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}T13:00:00${off}`;
                                      const idSuffix = `${String(yy).slice(2)}${String(mm).padStart(2,'0')}${String(dd).padStart(2,'0')}1300002`;
                                      const paramCodeMap: Record<TableMetricKey, string> = { pc: 'p', viscosity: 'v', density: 'd', pH: 'a', H2O: 'h', temperature: 't', silice: 's', grain: 'g' };
                                      const code = paramCodeMap[mk] || 'x';
                                      const idRheology = `${slurryId}_${code}${idSuffix}`;
                                      // Deletion: if user cleared a cell that had a value, generate DELETE for that id
                                      if (newValRaw === '') {
                                        if (hadValue) {
                                          const line = `DELETE FROM rheology\nWHERE id_rheology = '${idRheology}';`;
                                          appendSql(line);
                                          markCellChanged(cellKey);
                                        }
                                        return;
                                      }
                                      if (newValRaw === display.toString()) return;
                                      const newVal = Number(newValRaw.replace(',', '.'));
                                      if (!Number.isFinite(newVal)) return;
                                      if (!hadValue) {
                                        // INSERT template (testing-only)
                                        const unit = mk === 'pc' ? 'g' : mk === 'density' ? 'g/cm³' : mk === 'viscosity' ? 'mPa·s' : mk === 'temperature' ? '°C' : mk === 'H2O' ? 'L/h' : mk === 'silice' || mk === 'grain' ? '%' : '(-)';
                                        const line = `INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('${idRheology}', '${slurryId}', '${slurryType}', '${tsIso}', 'youssef.karim', '${mk}', ${newVal.toFixed(3)}, '${unit}', NULL, NULL);`;
                                        appendSql(line);
                                        markCellChanged(cellKey);
                                      } else {
                                        // UPDATE template (testing-only)
                                        const line = `UPDATE rheology\nSET value = ${newVal.toFixed(3)}\nWHERE id_rheology = '${idRheology}';`;
                                        appendSql(line);
                                        markCellChanged(cellKey);
                                      }
                                    }}
                                    style={{ width: '100%', minWidth: 60 }}
                                  />
                                ) : (
                                  display as any
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                </Fragment>
                ))}
              </tbody>
            </table>
          </div>
      </div>

      {/* TESTING ONLY: SQL generation scratch panel (no DB writes) */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>SQL (Testing only — remove before production)</h3>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <textarea readOnly value={sqlEdits.join('\n')}
            placeholder="Generated SQL statements appear here..."
            style={{ width: '100%', minHeight: 160 }} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button onClick={()=> setSqlEdits([])}>Clear</button>
        </div>
      </div>

      {/* TESTING ONLY: trigger ASCII loading overlay (remove before production) */}
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button title="TEST ONLY — remove before production" onClick={()=> navigate('/loading')}>
            Afficher loading (test)
          </button>
        </div>
      </div>

      {showLoading && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={()=> setShowLoading(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            onClick={(e)=> e.stopPropagation()}
            style={{
              width: '70vw',
              height: '70vh',
              maxWidth: 1200,
              maxHeight: '80vh',
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative'
            }}
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
              <button className="icon-btn" onClick={()=> setShowLoading(false)} aria-label="Fermer">×</button>
            </div>
            <div style={{ flex: 1, display: 'grid', gridTemplateRows: '1fr auto', overflow: 'hidden' }}>
              <div style={{ position: 'relative', overflow: 'auto', padding: 12, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                <pre
                  style={{
                    margin: 0,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: 10,
                    lineHeight: 1,
                    whiteSpace: 'pre',
                    color: '#9CA3AF',
                    textShadow: '0 0 1px rgba(0,0,0,0.3)',
                    animation: 'gentlePulse 2.4s ease-in-out infinite'
                  }}
                >{asciiText || asciiArt || 'Loading…'}</pre>
                {/* horizontal shimmer to make animation obvious */}
                <div style={{
                  pointerEvents: 'none',
                  position: 'absolute',
                  top: 0, bottom: 0,
                  left: 0, width: '40%',
                  background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.2), rgba(255,255,255,0))',
                  filter: 'blur(2px)',
                  animation: 'shimmerX 2.2s linear infinite'
                }} />
              </div>
              <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="muted">Prévisualisation — prototype de page de chargement</div>
                <div style={{ fontWeight: 600, color: '#374151' }}>
                  Loading{'.'.repeat(dots)}
                </div>
              </div>
            </div>
            {/* scanline overlay */}
            <div style={{
              pointerEvents: 'none',
              position: 'absolute',
              left: 0, right: 0, top: 0, bottom: 0,
              background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(31,41,55,0.25) 50%, rgba(255,255,255,0) 100%)',
              animation: 'scan 2.4s linear infinite'
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

