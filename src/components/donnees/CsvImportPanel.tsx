import type { RefObject } from 'react';
import type { Barbotine } from '../../types/domain';

type CsvImportPanelProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFiles: (files: FileList | null) => void | Promise<void>;
  openPicker: () => void;
  hoverBrowse: boolean;
  setHoverBrowse: (value: boolean) => void;
  activeBrowse: boolean;
  setActiveBrowse: (value: boolean) => void;
  showFmtTip: boolean;
  setShowFmtTip: (value: boolean) => void;
  fmtTipPos: { x: number; y: number };
  setFmtTipPos: (value: { x: number; y: number }) => void;
  dbReachable: boolean;
  barbotines: Barbotine[];
  selectedBarbotine: string;
  setSelectedBarbotine: (value: string) => void;
  start: string;
  setStart: (value: string) => void;
  end: string;
  setEnd: (value: string) => void;
  allData: boolean;
  setAllData: (value: boolean) => void;
  sortBarbotines: (a: Barbotine, b: Barbotine) => number;
  onExportCsv: () => void | Promise<void>;
};

export function CsvImportPanel({
  fileInputRef,
  onFiles,
  openPicker,
  hoverBrowse,
  setHoverBrowse,
  activeBrowse,
  setActiveBrowse,
  showFmtTip,
  setShowFmtTip,
  fmtTipPos,
  setFmtTipPos,
  dbReachable,
  barbotines,
  selectedBarbotine,
  setSelectedBarbotine,
  start,
  setStart,
  end,
  setEnd,
  allData,
  setAllData,
  sortBarbotines,
  onExportCsv,
}: CsvImportPanelProps) {
  return (
    <>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-upload text-primary" aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'block', zIndex: 1, color: '#1f2937' }}>
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

      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Télécharger des données</h3>
        <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 240 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Barbotine</div>
            <select value={selectedBarbotine} onChange={e => setSelectedBarbotine(e.target.value)}>
              {[...barbotines].sort(sortBarbotines).map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 360, flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Période</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <label>Début</label>
              <input type="datetime-local" placeholder="jj/mm/aaaa --:--" value={start} onChange={e => { setStart(e.target.value); setAllData(false); }} />
              <label>Fin</label>
              <input type="datetime-local" placeholder="jj/mm/aaaa --:--" value={end} onChange={e => { setEnd(e.target.value); setAllData(false); }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allData}
                  onChange={(e) => {
                    setAllData(e.target.checked);
                    if (e.target.checked) {
                      setStart('');
                      setEnd('');
                    }
                  }}
                />
                Tout
              </label>
              <button disabled={!dbReachable} onClick={onExportCsv} style={{ marginLeft: 'auto' }}>
                Télécharger CSV
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
