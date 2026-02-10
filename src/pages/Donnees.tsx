import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// @ts-ignore - vite does a lil magic to import this text file directly
import asciiArt from '../../loading_page/ascii.txt?raw';
import { useBarbotineStore } from '../store/barbotineStore';
import type { ChartMetricKey } from '../store/chartParams';
import { fetchRheologyAll, apiHealth, exportCsv, importCsv, reportError } from '../services/api';
import { ALL_DB_KEYS, FRONTEND_TO_DB, type DbMetricKey } from '../shared/metricKeys';

type PeriodKey = '1h' | '1d' | '1w' | 'last_month' | 'last_year' | 'all' | 'custom';

// basically the same keys the database uses for each measurement type
type TableMetricKey = DbMetricKey;
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

// turns a timestamp into a nice YYYY-MM-DD string
function dayKey(ts: number) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
// flips YYYY-MM-DD to DD/MM/YYYY for display
function dayKeyToLabel(key: string) {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}
// figures out if paris is in +01 or +02 timezone for a given date (dst is annoying tbh)
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
// converts timestamp to the format that datetime-local inputs need
function toLocalDateTimeInput(ts: number) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

// the data page - manual entry, csv import/export, and history tables all in one
export default function Donnees() {
  const barbotines = useBarbotineStore(s => s.barbotines);
  const navigate = useNavigate();

  // manual entry section - u pick dates and edit values directly in the table
  const [manualStart, setManualStart] = useState<string>('');
  const [manualEnd, setManualEnd] = useState<string>('');
  const [manualHistoryMap, setManualHistoryMap] = useState<HistoryMap>({});
  const [manualDayList, setManualDayList] = useState<string[]>([]);
  const [loadingManual, setLoadingManual] = useState<boolean>(false);
  const [manualChangedCells, setManualChangedCells] = useState<Record<string, boolean>>({});
  const markManualCellChanged = (key: string) => setManualChangedCells(prev => ({ ...prev, [key]: true }));

  // export section - lets u download data as csv
  const [expStart, setExpStart] = useState<string>('');
  const [expEnd, setExpEnd] = useState<string>('');
  const [expAllData, setExpAllData] = useState<boolean>(false);
  const defaultExportBb = useMemo(() => {
    const sorted = [...barbotines].sort((a,b) => a.name.localeCompare(b.name));
    const firstM7 = sorted.find(b => b.name.includes('M7-3')) || sorted[0];
    return firstM7?.id || '';
  }, [barbotines]);
  const [expBbSingle, setExpBbSingle] = useState<string>(defaultExportBb);
  const [expMetricsMulti, setExpMetricsMulti] = useState<ChartMetricKey[]>(['densite','viscosite','pc']);
  const [metricsOpen, setMetricsOpen] = useState<boolean>(false);

  // history section - starts empty, shows data after u pick dates or hit "all"
  const now = Date.now();
  const [histStart, setHistStart] = useState<string>('');
  const [histEnd, setHistEnd] = useState<string>('');
  // when true we load literally everything from the db
  const [histLoadAll, setHistLoadAll] = useState<boolean>(false);

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
  // dev-only sql preview - shows what queries would run when u edit cells
  const [sqlEdits, setSqlEdits] = useState<string[]>([]);
  const appendSql = (line: string) => setSqlEdits(prev => [...prev, line]);
  // keeps track of which cells got edited so we can highlight them red
  const [changedCells, setChangedCells] = useState<Record<string, boolean>>({});
  const markCellChanged = (key: string) => setChangedCells(prev => ({ ...prev, [key]: true }));
  // dev-only: the cool loading screen overlay
  const [showLoading, setShowLoading] = useState<boolean>(false);
  const [dots, setDots] = useState<number>(0);
  const [asciiText, setAsciiText] = useState<string>('');
  useEffect(() => {
    if (!showLoading) return;
    const id = setInterval(() => setDots(d => (d + 1) % 4), 400);
    return () => clearInterval(id);
  }, [showLoading]);
  // loads the ascii art for the loading screen - tries the server first then falls back to bundled
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
        // Fallback to bundled raw import
        // fallback to the bundled version if fetch didnt work
        if (!txt && typeof asciiArt === 'string' && asciiArt.trim().length > 0) txt = asciiArt;
        if (!cancelled) setAsciiText(txt || '');
      } catch {
        if (!cancelled) setAsciiText('SAFRAN\nLoading…');
      }
    })();
    return () => { cancelled = true; };
  }, [showLoading]);
  // sorts slurries: M-types first, then 2CN2, then everything else
  const sortBarbotines = (a: { name: string }, b: { name: string }) => {
    const group = (name: string) => name.startsWith('M') ? 0 : name.startsWith('2') ? 1 : 2;
    const ga = group(a.name); const gb = group(b.name);
    if (ga !== gb) return ga - gb;
    return a.name.localeCompare(b.name);
  };

  // csv import stuff - the hidden file input + hover states for the browse button
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [hoverBrowse, setHoverBrowse] = useState(false);
  const [activeBrowse, setActiveBrowse] = useState(false);
  const [showFmtTip, setShowFmtTip] = useState(false);
  const [fmtTipPos, setFmtTipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dbReachable, setDbReachable] = useState<boolean>(true);
  const openPicker = () => fileInputRef.current?.click();
  // handles when someone drops or picks a csv file - validates, uploads, handles conflicts
  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    if (!dbReachable) { alert('Base de données indisponible'); return; }
    // only csv files under 2MB pls
    const accepted = Array.from(files).filter(f => /\.csv$/i.test(f.name) && f.size <= 2 * 1024 * 1024);
    if (!accepted.length) return;
    const file = accepted[0];
    const text = await file.text();
    // try importing normally first, if theres conflicts ask the user what to do
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

  // pings the server to see if its alive when u open this page
  useEffect(() => {
    apiHealth().then(setDbReachable).catch(()=>setDbReachable(false));
  }, []);

  // loads history data - only runs when u set dates or check "load all"
  useEffect(() => {
    const s = Date.parse(histStart);
    const e = Date.parse(histEnd);
    const hasDates = Number.isFinite(s) && Number.isFinite(e);
    // no dates and not loading all? just show nothing
    if (!hasDates && !histLoadAll) {
      setHistoryMap({});
      setDayList([]);
      return;
    }
    let cancelled = false;
    async function load() {
      let startTs = Number.isFinite(s) ? s : NaN;
      let endTs = Number.isFinite(e) ? e : NaN;
      let globalMin = Number.POSITIVE_INFINITY;
      let globalMax = Number.NEGATIVE_INFINITY;
      setLoadingHistory(true);
      try {
        // groups all values by day so each row in the table = one day
        const nextMap: HistoryMap = {};
        const daysSet = new Set<string>();
        // same sorting as everywhere else - M7-3 first, then 2CN2, R55, etc
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
            const all = await fetchRheologyAll(sid, ALL_DB_KEYS as string[], false);
            const series = all.series || {} as Record<string, Array<{ t:number; v:number }>>;
            const perMetric: Record<string, Map<string, { t:number; v:number }>> = {};
            for (const k of ALL_DB_KEYS) {
              const allArr = (series[k] || []);
              for (const d of allArr) { if (d.t < globalMin) globalMin = d.t; if (d.t > globalMax) globalMax = d.t; }
              const arr = Number.isFinite(startTs) && Number.isFinite(endTs)
                ? allArr.filter(d => d.t >= startTs && d.t <= endTs)
                : allArr;
              const m = new Map<string, { t:number; v:number }>();
              for (const d of arr) {
                const dk = dayKey(d.t);
                // if theres multiple readings in one day, keep the latest one
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
              for (const src of ALL_DB_KEYS) {
                const dst = src;
                const rec = perMetric[src].get(dk);
                if (rec) row[dst] = Number(rec.v);
              }
            });
          } catch {}
        }));
        if (cancelled) return;
        // if u hit "all" and didnt set dates, we figure out the range from the data itself
        if (histLoadAll && !(Number.isFinite(s) && Number.isFinite(e)) && Number.isFinite(globalMin) && Number.isFinite(globalMax)) {
          const dStart = new Date(globalMin); dStart.setHours(0,0,0,0);
          const dEnd = new Date(globalMax); dEnd.setHours(23,59,0,0);
          startTs = dStart.getTime(); endTs = dEnd.getTime();
          setHistStart(toLocalDateTimeInput(startTs));
          setHistEnd(toLocalDateTimeInput(endTs));
        }
          const sortedDays = (Number.isFinite(startTs) && Number.isFinite(endTs))
  ? (() => {
      const days: string[] = [];
      const d = new Date(startTs); d.setHours(0, 0, 0, 0);
      const end = new Date(endTs); end.setHours(0, 0, 0, 0);
      for (let t = d.getTime(); t <= end.getTime(); t += 24 * 60 * 60 * 1000) {
        const dk = dayKey(t);
        days.push(dk);
        if (!nextMap[dk]) nextMap[dk] = {}; // empty row still needs to exist for the table
      }
      return days;
    })()
  : Array.from(daysSet).sort();
setHistoryMap(nextMap);
setDayList(sortedDays);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [histStart, histEnd, barbotines, histLoadAll]);

  // fetches data for the manual entry table based on whatever dates u picked
  useEffect(() => {
    let cancelled = false;
    const s = Date.parse(manualStart);
    const e = Date.parse(manualEnd);
    // need at least one date to do anything
    if (!Number.isFinite(s) && !Number.isFinite(e)) {
      setManualHistoryMap({});
      setManualDayList([]);
      return;
    }
    async function loadManual() {
      setLoadingManual(true);
      try {
        const map: HistoryMap = {};
        for (const b of barbotines) {
          const sid = (b as any).slurryId as string | undefined;
          if (!sid) continue;
          const { series } = await fetchRheologyAll(sid, ALL_DB_KEYS as string[], false);
          for (const [param, pts] of Object.entries(series) as [string, any[]][]) {
            const mk = param as TableMetricKey;
            for (const p of pts) {
              const t = Number(p.t);
              // skip points outside the date range
              if (Number.isFinite(s) && t < s) continue;
              if (Number.isFinite(e) && t > e) continue;
              const dk = dayKey(t);
              if (!map[dk]) map[dk] = {};
              if (!map[dk][b.name]) map[dk][b.name] = {};
              map[dk][b.name][mk] = Number(p.v);
            }
          }
        }
        if (cancelled) return;
        const days = Object.keys(map).sort((a,b) => a.localeCompare(b));
        setManualHistoryMap(map);
        setManualDayList(days);
      } catch {}
      if (!cancelled) setLoadingManual(false);
    }
    loadManual();
    return () => { cancelled = true; };
  }, [manualStart, manualEnd, barbotines]);

  return (
    <div>
      <h2>Données</h2>

      {/* manual data entry - pick dates then edit cells directly */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Entrée manuelle</h3>
        <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
          Sélectionnez une date de début et/ou de fin pour afficher les tables modifiables.
        </p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label>Début</label>
          <input type="datetime-local" value={manualStart} onChange={e => setManualStart(e.target.value)} />
          <label>Fin</label>
          <input type="datetime-local" value={manualEnd} onChange={e => setManualEnd(e.target.value)} />
        </div>

        {loadingManual && <p className="muted" style={{ marginTop: 12 }}>Chargement…</p>}
        
        {!loadingManual && manualDayList.length > 0 && (
          <div style={{ marginTop: 16 }}>
            {manualDayList.map(dk => (
              <div key={`manual-day-${dk}`} style={{ marginBottom: 16 }}>
                <h4 style={{ margin: '8px 0' }}>{dayKeyToLabel(dk)}</h4>
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6' }}>
                      <th style={{ width: 140 }}>Barbotine</th>
                      {metricOrder.map(mk => <th key={`mh-${dk}-${mk}`}>{headerLabels[mk]}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[...barbotines]
                      .sort((a,b) => {
                        const group = (name: string) => name.includes('M7-3') ? 0 : name.includes('2CN2') ? 1 : name.includes('R55') ? 2 : 3;
                        const ga = group(a.name); const gb = group(b.name);
                        if (ga !== gb) return ga - gb; return a.name.localeCompare(b.name);
                      })
                      .map(b => {
                        const row = manualHistoryMap[dk]?.[b.name] || {};
                        return (
                          <tr key={`mr-${dk}-${b.id}`}>
                            <td>{b.name}</td>
                            {metricOrder.map(mk => {
                              const v = row[mk];
                              const display = (typeof v === 'number' && Number.isFinite(v)) ? Number(v.toFixed(3)) : '';
                              const cellKey = `manual|${dk}|${b.id}|${mk}`;
                              return (
                                <td key={`mc-${dk}-${b.id}-${mk}`}>
                                  <input
                                    type="text"
                                    defaultValue={display}
                                    placeholder="—"
                                    onBlur={(ev) => {
                                      const newVal = ev.target.value.trim();
                                      if (newVal === String(display)) return;
                                      markManualCellChanged(cellKey);
                                      // builds the sql that would run for this edit
                                      const slurryId = (b as any).slurryId || b.id;
                                      const slurryType = b.name.split(' ')[0] || 'M7-3';
                                      const [yy,mm,dd] = dk.split('-').map(Number);
                                      const parisDate = new Date(Date.UTC(yy!, mm! - 1, dd!, 12, 0, 0));
                                      const tsIso = parisDate.toISOString().replace(/\.\d{3}Z$/, '.000Z');
                                      const idSuffix = `${String(yy).slice(2)}${String(mm).padStart(2,'0')}${String(dd).padStart(2,'0')}1300002`;
                                      const paramCodeMap: Record<TableMetricKey, string> = { pc: 'p', viscosity: 'v', density: 'd', pH: 'a', H2O: 'h', temperature: 't', silice: 's', grain: 'g' };
                                      const code = paramCodeMap[mk] || 'x';
                                      const idRheology = `${slurryId}_${code}${idSuffix}`;
                                      const hadValue = typeof v === 'number' && Number.isFinite(v);
                                      if (newVal === '') {
                                        if (hadValue) {
                                          appendSql(`DELETE FROM rheology WHERE id_rheology = '${idRheology}';`);
                                        }
                                        return;
                                      }
                                      const numVal = Number(newVal.replace(',', '.'));
                                      if (!Number.isFinite(numVal)) return;
                                      const unit = mk === 'pc' ? 'g' : mk === 'density' ? 'g/cm³' : mk === 'viscosity' ? 'mPa·s' : mk === 'temperature' ? '°C' : mk === 'H2O' ? 'L/h' : mk === 'silice' || mk === 'grain' ? '%' : '(-)';
                                      if (!hadValue) {
                                        appendSql(`INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('${idRheology}', '${slurryId}', '${slurryType}', '${tsIso}', 'manual', '${mk}', ${numVal.toFixed(3)}, '${unit}', NULL, NULL);`);
                                      } else {
                                        appendSql(`UPDATE rheology SET value = ${numVal.toFixed(3)} WHERE id_rheology = '${idRheology}';`);
                                      }
                                    }}
                                    style={{ width: '100%', minWidth: 60, ...(manualChangedCells[cellKey] ? { border: '2px solid #ef4444' } : {}) }}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
        
        {!loadingManual && manualDayList.length === 0 && (manualStart || manualEnd) && (
          <p className="muted" style={{ marginTop: 12 }}>Aucune donnée trouvée pour cette période.</p>
        )}
      </div>

      {/* csv upload section - drag n drop or click to browse */}
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

      {/* export section - download ur data as csv */}
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
              <input type="datetime-local" placeholder="jj/mm/aaaa --:--" value={expStart} onChange={e => { setExpStart(e.target.value); setExpAllData(false); }} />
              <label>Fin</label>
              <input type="datetime-local" placeholder="jj/mm/aaaa --:--" value={expEnd} onChange={e => { setExpEnd(e.target.value); setExpAllData(false); }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={expAllData}
                  onChange={(e) => {
                    setExpAllData(e.target.checked);
                    if (e.target.checked) {
                      // clears dates so the server knows we want everything
                      setExpStart('');
                      setExpEnd('');
                    }
                  }}
                />
                Tout
              </label>
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

      {/* history tables - all the raw data organized by day */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Historique</h3>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label>Début</label>
          <input type="datetime-local" placeholder="jj/mm/aaaa --:--" value={histStart} onChange={e => { setHistStart(e.target.value); setHistLoadAll(false); }} />
          <label>Fin</label>
          <input type="datetime-local" placeholder="jj/mm/aaaa --:--" value={histEnd} onChange={e => { setHistEnd(e.target.value); setHistLoadAll(false); }} />
          <button
            onClick={async () => {
              // grabs the earliest and latest timestamps across all slurries
              setLoadingHistory(true);
              try {
                let minTs = Infinity;
                let maxTs = -Infinity;
                for (const b of barbotines) {
                  const sid = (b as any).slurryId as string | undefined;
                  if (!sid) continue;
                  const { series } = await fetchRheologyAll(sid, [FRONTEND_TO_DB.densite], false);
                  const pts = series[FRONTEND_TO_DB.densite] || [];
                  for (const p of pts) {
                    const t = Number(p.t);
                    if (t < minTs) minTs = t;
                    if (t > maxTs) maxTs = t;
                  }
                }
                if (Number.isFinite(minTs) && Number.isFinite(maxTs)) {
                  setHistStart(toLocalDateTimeInput(minTs));
                  setHistEnd(toLocalDateTimeInput(maxTs));
                  setHistLoadAll(true);
                }
              } catch {}
              setLoadingHistory(false);
            }}
            style={{ marginLeft: 8 }}
          >
            Tout
          </button>
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
                            const editable = true; // dev-only: all cells are editable rn
                            const cellKey = `${dk}|${b.id}|${mk}`;
                            return (
                              <td key={`c-${dk}-${b.id}-${mk}`}>
                                {editable ? (
                                  <input
                                    type="text"
                                    defaultValue={display as any}
                                    onFocus={(e) => { if (e.target.value === '—') e.target.value = ''; }}
                                    onBlur={(e) => {
                                      const newValRaw = e.target.value.trim();
                                      const hadValue = typeof v === 'number' && Number.isFinite(v);
                                      const slurryId = (b as any).slurryId || b.name.replace(/\s+/g,'_');
                                      const slurryType = b.name.split(' ')[0] || 'M7-3';
                                      // picks noon UTC as the timestamp for the day (close enough)
                                      const [yy,mm,dd] = dk.split('-').map(Number);
                                      const parisDate = new Date(Date.UTC(yy!, mm! - 1, dd!, 12, 0, 0));
                                      const tsIso = parisDate.toISOString().replace(/\.\d{3}Z$/, '.000Z');
                                      const idSuffix = `${String(yy).slice(2)}${String(mm).padStart(2,'0')}${String(dd).padStart(2,'0')}1300002`;
                                      const paramCodeMap: Record<TableMetricKey, string> = { pc: 'p', viscosity: 'v', density: 'd', pH: 'a', H2O: 'h', temperature: 't', silice: 's', grain: 'g' };
                                      const code = paramCodeMap[mk] || 'x';
                                      const idRheology = `${slurryId}_${code}${idSuffix}`;
                                      // user cleared the cell = delete that record
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
                                        // new value = insert row
                                        const unit = mk === 'pc' ? 'g' : mk === 'density' ? 'g/cm³' : mk === 'viscosity' ? 'mPa·s' : mk === 'temperature' ? '°C' : mk === 'H2O' ? 'L/h' : mk === 'silice' || mk === 'grain' ? '%' : '(-)';
                                        const line = `INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('${idRheology}', '${slurryId}', '${slurryType}', '${tsIso}', 'youssef.karim', '${mk}', ${newVal.toFixed(3)}, '${unit}', NULL, NULL);`;
                                        appendSql(line);
                                        markCellChanged(cellKey);
                                      } else {
                                        // already existed = just update the value
                                        const line = `UPDATE rheology\nSET value = ${newVal.toFixed(3)}\nWHERE id_rheology = '${idRheology}';`;
                                        appendSql(line);
                                        markCellChanged(cellKey);
                                      }
                                    }}
                                    style={{ width: '100%', minWidth: 60, ...(changedCells[cellKey] ? { border: '2px solid #ef4444' } : {}) }}
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

      {/* dev-only: shows the sql that would get executed (remove before prod lol) */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>SQL code (to be removed before production)</h3>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <textarea readOnly value={sqlEdits.join('\n')}
            placeholder="Generated SQL statements appear here..."
            style={{ width: '100%', minHeight: 160 }} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button onClick={()=> setSqlEdits([])}>Clear</button>
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
            {/* shiny sliding effect over the ascii art */}
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
            {/* that retro scanline effect that slides down */}
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

