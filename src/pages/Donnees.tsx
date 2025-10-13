import { useMemo, useState } from 'react';
import { useAppState } from '../store/appState';

type MetricKey = 'densite' | 'viscosite' | 'ph' | 'temperature';

function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

export default function Donnees() {
  const { getSeriesForRange, seriesM7, applyMetricPoints } = useAppState() as any;
  const [metric, setMetric] = useState<MetricKey>('viscosite');
  const [range, setRange] = useState<'3h' | '1d' | '7d' | '1m' | '3m' | 'all'>('3h');
  const data = useMemo(() => {
    const s = getSeriesForRange(range);
    return s[metric];
  }, [range, metric, getSeriesForRange]);

  const [csvPreview, setCsvPreview] = useState<{ t: number; v: number }[] | null>(null);
  const [manualTs, setManualTs] = useState<string>('');
  const [manualVal, setManualVal] = useState<string>('');

  return (
    <div>
      <h2>Données</h2>
      <div className="panel" style={{ marginTop: 8 }}>
        <h3>Télécharger</h3>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <label>Métrique</label>
          <select value={metric} onChange={e => setMetric(e.target.value as MetricKey)}>
            <option value="densite">Densité</option>
            <option value="viscosite">Viscosité</option>
            <option value="ph">pH</option>
            <option value="temperature">Température</option>
          </select>
          <label>Période</label>
          <select value={range} onChange={e => setRange(e.target.value as any)}>
            <option value="3h">3H</option>
            <option value="1d">1D</option>
            <option value="7d">7D</option>
            <option value="1m">1M</option>
            <option value="3m">3M</option>
            <option value="all">ALL</option>
          </select>
          <button onClick={() => {
            const header = 't,v\n';
            const rows = data.map((p: any) => `${p.t},${p.v}`).join('\n');
            const blob = new Blob([header + rows], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `${metric}_${range}_${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
          }}>Exporter CSV</button>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 8 }}>
        <h3>Importer CSV (remplacement par timestamp)</h3>
        <div className="row" style={{ gap: 8 }}>
          <input type="file" accept=".csv,text/csv" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const text = await f.text();
            const lines = text.split(/\r?\n/).filter(Boolean);
            const parsed: { t: number; v: number }[] = [];
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (i === 0 && line.toLowerCase().includes('t') && line.toLowerCase().includes('v')) continue;
              const [ts, val] = line.split(',');
              const t = Number(ts);
              const v = Number(val);
              if (!Number.isFinite(t) || !Number.isFinite(v)) continue;
              parsed.push({ t, v });
            }
            setCsvPreview(parsed);
          }} />
          {csvPreview && <button onClick={() => { applyMetricPoints(metric, csvPreview, 'overwrite'); setCsvPreview(null); }}>Appliquer remplacement</button>}
        </div>
        {csvPreview && (
          <div style={{ marginTop: 8 }}>
            <label>Aperçu ({csvPreview.length} lignes)</label>
            <table className="table">
              <thead><tr><th>Timestamp</th><th>Valeur</th></tr></thead>
              <tbody>
                {csvPreview.slice(0, 10).map((r, i) => (
                  <tr key={i}><td>{formatDate(r.t)}</td><td>{r.v}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 8 }}>
        <h3>Entrée manuelle (remplacement si timestamp identique)</h3>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <label>Métrique</label>
          <select value={metric} onChange={e => setMetric(e.target.value as MetricKey)}>
            <option value="densite">Densité</option>
            <option value="viscosite">Viscosité</option>
            <option value="ph">pH</option>
            <option value="temperature">Température</option>
          </select>
          <label>Date et heure</label>
          <input type="datetime-local" value={manualTs} onChange={e => setManualTs(e.target.value)} />
          <label>Valeur</label>
          <input type="number" value={manualVal} onChange={e => setManualVal(e.target.value)} />
          <button onClick={() => {
            const t = Date.parse(manualTs);
            const v = Number(manualVal);
            if (!Number.isFinite(t) || !Number.isFinite(v)) return;
            applyMetricPoints(metric, [{ t, v }], 'overwrite');
            setManualTs(''); setManualVal('');
          }}>Enregistrer</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Remarque: cette démo ne persiste rien; les changements sont en mémoire uniquement.</div>
      </div>
    </div>
  );
}


