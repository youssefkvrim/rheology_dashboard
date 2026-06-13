import { useEffect, useMemo, useRef, useState } from 'react';
import { CsvImportPanel } from '../components/donnees/CsvImportPanel';
import { HistoryTable } from '../components/donnees/HistoryTable';
import { SqlTemplatePanel } from '../components/donnees/SqlTemplatePanel';
import { useDonneesHistory } from '../components/donnees/useDonneesHistory';
import { useBarbotineStore } from '../store/barbotineStore';
import { apiHealth, exportCsv, importCsv, reportError } from '../services/api';
import type { Barbotine } from '../types/domain';

function sortBarbotines(a: Barbotine, b: Barbotine) {
  const group = (name: string) => name.startsWith('M') ? 0 : name.startsWith('2') ? 1 : 2;
  const ga = group(a.name);
  const gb = group(b.name);
  if (ga !== gb) return ga - gb;
  return a.name.localeCompare(b.name);
}

export default function Donnees() {
  const barbotines = useBarbotineStore(s => s.barbotines);
  const { manual, history } = useDonneesHistory(barbotines);

  const [manualChangedCells, setManualChangedCells] = useState<Record<string, boolean>>({});
  const [changedCells, setChangedCells] = useState<Record<string, boolean>>({});
  const [sqlEdits, setSqlEdits] = useState<string[]>([]);
  const appendSql = (line: string) => setSqlEdits(prev => [...prev, line]);

  const [expStart, setExpStart] = useState('');
  const [expEnd, setExpEnd] = useState('');
  const [expAllData, setExpAllData] = useState(false);
  const defaultExportBb = useMemo(() => {
    const sorted = [...barbotines].sort((a, b) => a.name.localeCompare(b.name));
    const firstM7 = sorted.find(b => b.name.includes('M7-3')) || sorted[0];
    return firstM7?.id || '';
  }, [barbotines]);
  const [expBbSingle, setExpBbSingle] = useState(defaultExportBb);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [hoverBrowse, setHoverBrowse] = useState(false);
  const [activeBrowse, setActiveBrowse] = useState(false);
  const [showFmtTip, setShowFmtTip] = useState(false);
  const [fmtTipPos, setFmtTipPos] = useState({ x: 0, y: 0 });
  const [dbReachable, setDbReachable] = useState(true);

  useEffect(() => {
    apiHealth().then(setDbReachable).catch(() => setDbReachable(false));
  }, []);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    if (!dbReachable) { alert('Base de données indisponible'); return; }
    const accepted = Array.from(files).filter(f => /\.csv$/i.test(f.name) && f.size <= 2 * 1024 * 1024);
    if (!accepted.length) return;
    const text = await accepted[0].text();
    const res = await importCsv(text, false);
    if (!res.ok && res.conflicts && res.conflicts.length) {
      const ask = window.confirm(`Conflits sur ${res.conflicts.length} enregistrements. Écraser les existants ?`);
      if (ask) {
        const res2 = await importCsv(text, true);
        if (res2.ok) alert(`Import OK. Nouveaux: ${(res2.inserted || []).length}, Modifiés: ${(res2.updated || []).length}`);
        else alert('Import échoué.');
      }
    } else if (res.ok) {
      alert(`Import OK. Nouveaux: ${(res.inserted || []).length}, Modifiés: ${(res.updated || []).length}`);
    } else {
      alert('Import échoué.');
    }
  };

  const handleExportCsv = async () => {
    if (!dbReachable) { alert('Base de données indisponible'); return; }
    const b = barbotines.find(bb => bb.id === expBbSingle);
    const sid = b?.slurryId || b?.id;
    if (!sid) return;
    const s = Date.parse(expStart);
    const e = Date.parse(expEnd);
    try {
      const blob = await exportCsv(String(sid), Number.isFinite(s) ? s : undefined, Number.isFinite(e) ? e : undefined);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${String(sid)}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      reportError(`Export CSV failed: ${e instanceof Error ? e.message : 'error'}`);
      alert('Export échoué.');
    }
  };

  return (
    <div>
      <h2>Données</h2>
      <HistoryTable
        variant="manual"
        title="Entrée manuelle"
        description="Sélectionnez une date de début et/ou de fin pour afficher les tables modifiables."
        start={manual.manualStart}
        end={manual.manualEnd}
        onStartChange={manual.setManualStart}
        onEndChange={manual.setManualEnd}
        loading={manual.loadingManual}
        dayList={manual.manualDayList}
        historyMap={manual.manualHistoryMap}
        barbotines={barbotines}
        changedCells={manualChangedCells}
        markCellChanged={(key) => setManualChangedCells(prev => ({ ...prev, [key]: true }))}
        appendSql={appendSql}
      />
      <CsvImportPanel
        fileInputRef={fileInputRef}
        onFiles={onFiles}
        openPicker={() => fileInputRef.current?.click()}
        hoverBrowse={hoverBrowse}
        setHoverBrowse={setHoverBrowse}
        activeBrowse={activeBrowse}
        setActiveBrowse={setActiveBrowse}
        showFmtTip={showFmtTip}
        setShowFmtTip={setShowFmtTip}
        fmtTipPos={fmtTipPos}
        setFmtTipPos={setFmtTipPos}
        dbReachable={dbReachable}
        barbotines={barbotines}
        selectedBarbotine={expBbSingle}
        setSelectedBarbotine={setExpBbSingle}
        start={expStart}
        setStart={setExpStart}
        end={expEnd}
        setEnd={setExpEnd}
        allData={expAllData}
        setAllData={setExpAllData}
        sortBarbotines={sortBarbotines}
        onExportCsv={handleExportCsv}
      />
      <HistoryTable
        variant="history"
        title="Historique"
        start={history.histStart}
        end={history.histEnd}
        onStartChange={(value) => { history.setHistStart(value); history.setHistLoadAll(false); }}
        onEndChange={(value) => { history.setHistEnd(value); history.setHistLoadAll(false); }}
        loading={history.loadingHistory}
        dayList={history.dayList}
        historyMap={history.historyMap}
        barbotines={barbotines}
        changedCells={changedCells}
        markCellChanged={(key) => setChangedCells(prev => ({ ...prev, [key]: true }))}
        appendSql={appendSql}
        onLoadAll={history.handleLoadAllHistory}
      />
      <SqlTemplatePanel sqlEdits={sqlEdits} onClear={() => setSqlEdits([])} />
    </div>
  );
}
