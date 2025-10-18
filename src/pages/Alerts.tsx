// Placeholder: this file will be replaced by Donnees.tsx soon per plan
import { useMemo, useState } from 'react';
import { useAppState } from '../store/appState';
import { Scatter, ScatterChart, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

type CsvPoint = { time: number; value: number };

function parseCsv(text: string): CsvPoint[] {
  // format attendu: timestamp,value (ou ISO,value)
  const lines = text.split(/\r?\n/).filter(Boolean);
  const pts: CsvPoint[] = [];
  for (const line of lines) {
    const [tStr, vStr] = line.split(',');
    const t = Number(tStr) || Date.parse(tStr);
    const v = Number(vStr);
    if (!Number.isNaN(t) && !Number.isNaN(v)) pts.push({ time: t, value: v });
  }
  return pts;
}

function formatTime(ts: number) {
  const d = new Date(ts); return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

export default function Alerts() {
  const { seriesM7, bounds } = useAppState();
  const [csvPoints, setCsvPoints] = useState<CsvPoint[]>([]);

  const last = useMemo(() => ({
    densite: seriesM7.densite[seriesM7.densite.length - 1]?.v ?? NaN,
    viscosite: seriesM7.viscosite[seriesM7.viscosite.length - 1]?.v ?? NaN,
    ph: seriesM7.ph[seriesM7.ph.length - 1]?.v ?? NaN,
    temperature: seriesM7.temperature[seriesM7.temperature.length - 1]?.v ?? NaN,
  }), [seriesM7]);

  const alerts = useMemo(() => {
    const arr: { metric: string; value: number; limit: string; time: string }[] = [];
    const now = new Date().toLocaleTimeString();
    const inLowHigh = (v: number, low: number | null, high: number | null) => {
      if (low == null && high == null) return true;
      if (low == null) return v <= (high as number);
      if (high == null) return v >= (low as number);
      return v >= low && v <= high;
    };
    const fmtRange = (low: number | null, high: number | null) => {
      if (low == null && high == null) return '—';
      if (low == null) return `≤${high}`;
      if (high == null) return `≥${low}`;
      return `${low}–${high}`;
    };
    if (!inLowHigh(last.viscosite, bounds.viscosite.low, bounds.viscosite.high)) arr.push({ metric: 'Viscosité', value: Math.round(last.viscosite), limit: fmtRange(bounds.viscosite.low, bounds.viscosite.high), time: now });
    if (!inLowHigh(last.densite, bounds.densite.low, bounds.densite.high)) arr.push({ metric: 'Densité', value: Number(last.densite.toFixed(3)), limit: fmtRange(bounds.densite.low, bounds.densite.high), time: now });
    if (!inLowHigh(last.ph, bounds.ph.low, bounds.ph.high)) arr.push({ metric: 'pH', value: Number(last.ph.toFixed(2)), limit: fmtRange(bounds.ph.low, bounds.ph.high), time: now });
    if (!inLowHigh(last.temperature, bounds.temperature.low, bounds.temperature.high)) arr.push({ metric: 'Température', value: Number(last.temperature.toFixed(1)), limit: fmtRange(bounds.temperature.low, bounds.temperature.high), time: now });
    return arr;
  }, [last, bounds]);

  return (
    <div>
      <h2>Alertes</h2>
      <p className="muted">Affichage des dépassements sur la dernière mesure simulée.</p>
      <table className="table" style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th>Métrique</th>
            <th>Valeur</th>
            <th>Limite</th>
            <th>Heure</th>
          </tr>
        </thead>
        <tbody>
          {alerts.length === 0 && (
            <tr><td colSpan={4} className="muted">Aucune alerte.</td></tr>
          )}
          {alerts.map((a, i) => (
            <tr key={i}>
              <td>{a.metric}</td>
              <td>{a.value}</td>
              <td>{a.limit}</td>
              <td>{a.time}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3>Importer CSV</h3>
        <p className="muted">Accepte un fichier CSV simple « temps,valeur ». Aucune sauvegarde, juste un tracé temporaire.</p>
        <div className="uploader">
          <input type="file" accept=".csv,text/csv" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const text = await f.text();
            const pts = parseCsv(text);
            setCsvPoints(pts);
          }} />
          <span className="muted">{csvPoints.length ? `${csvPoints.length} points chargés` : 'Aucun fichier chargé'}</span>
        </div>
        <div className="chart" style={{ height: 260, marginTop: 8 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" tickFormatter={formatTime} stroke="#6b7280" type="number" domain={['auto', 'auto']} />
              <YAxis dataKey="value" stroke="#6b7280" />
              <Tooltip labelFormatter={(v) => formatTime(Number(v))} />
              <Scatter data={csvPoints} fill="#a78bfa" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}


