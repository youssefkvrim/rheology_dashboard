import React, { useEffect, useMemo, useState } from 'react';

export type ParamsModalProps = {
  title: string;
  specificStart: string;
  specificEnd: string;
  setSpecificStart: (v: string) => void;
  setSpecificEnd: (v: string) => void;
  onSetRangeSpecific: () => void;
  unit: string;
  unitOptions: string[];
  setUnit: (u: string) => void;
  avgOn: boolean;
  setAvgOn: (v: boolean) => void;
  trendOn: boolean;
  setTrendOn: (v: boolean) => void;
  trendWindowMs?: number;
  setTrendWindowMs?: (ms: number) => void;
  deltaY: number;
  setDeltaY: (n: number) => void;
  low: number | null;
  high: number | null;
  setLow: (n: number | null) => void;
  setHigh: (n: number | null) => void;
  // Optional critical zones controls
  critOn?: boolean;
  setCritOn?: (v: boolean) => void;
  critPct?: number;
  setCritPct?: (n: number) => void;
  onClose: () => void;
};

export function ParamsModal(p: ParamsModalProps) {
  const [draftLow, setDraftLow] = useState<string>('');
  const [draftHigh, setDraftHigh] = useState<string>('');

  useEffect(() => {
    setDraftLow(p.low == null ? '' : String(p.low));
    setDraftHigh(p.high == null ? '' : String(p.high));
  }, [p.low, p.high]);

  const parseLocaleNumber = useMemo(() => (input: string): number | null | typeof NaN => {
    const s = (input ?? '').trim();
    if (!s) return null;
    // accept either comma or dot as decimal separator, but not both
    const dot = (s.match(/\./g) || []).length;
    const comma = (s.match(/,/g) || []).length;
    if (dot + comma > 1) return NaN;
    if (dot === 1 && comma === 1) return NaN;
    const normalized = s.replace(',', '.');
    if (!/^[-+]?\d*(?:\.\d*)?$/.test(normalized)) return NaN;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : NaN;
  }, []);

  return (
    <div className="modal-backdrop" onClick={p.onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{p.title}</h3>
          <button onClick={p.onClose}>Fermer</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gap: 6 }}>
            <label>Période personnalisée:</label>
            <label>Début</label>
            <input type="datetime-local" value={p.specificStart} onChange={(e)=>{ p.setSpecificStart(e.target.value); p.onSetRangeSpecific(); }} />
            <label>Fin</label>
            <input type="datetime-local" value={p.specificEnd} onChange={(e)=>{ p.setSpecificEnd(e.target.value); p.onSetRangeSpecific(); }} />
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <label>Conformité min/max:</label>
            <input type="text" inputMode="decimal" placeholder="min (ex: 1,2)" style={{ width: 110 }} value={draftLow}
              onChange={e => {
                const raw = e.target.value;
                setDraftLow(raw);
                const n = parseLocaleNumber(raw);
                if (n === null) { p.setLow(null); }
                else if (!Number.isNaN(n)) { p.setLow(n as number); }
              }} />
            <input type="text" inputMode="decimal" placeholder="max (ex: 1,2)" style={{ width: 110 }} value={draftHigh}
              onChange={e => {
                const raw = e.target.value;
                setDraftHigh(raw);
                const n = parseLocaleNumber(raw);
                if (n === null) { p.setHigh(null); }
                else if (!Number.isNaN(n)) { p.setHigh(n as number); }
              }} />
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
            <label>Unité:</label>
            <select value={p.unit} onChange={e=>p.setUnit(e.target.value)}>
              {p.unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
            <label>Moyenne</label>
            <input type="checkbox" checked={p.avgOn} onChange={e=>p.setAvgOn(e.target.checked)} />
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
            <label>Ligne de tendance</label>
            <input type="checkbox" checked={p.trendOn} onChange={e=>p.setTrendOn(e.target.checked)} />
          </div>
          {p.setCritOn && p.setCritPct && (
            <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
              <label>Zones critiques (%)</label>
              <input type="checkbox" checked={!!p.critOn} onChange={e=>p.setCritOn!(e.target.checked)} />
              <input type="range" min={0} max={60} step={5} value={p.critPct ?? 30} onChange={e=>p.setCritPct!(Number(e.target.value))} />
              <span className="muted">{p.critPct ?? 30}%</span>
            </div>
          )}
          {p.trendOn && p.setTrendWindowMs && (
            <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
              <label>Fenêtre tendance</label>
              <select value={String(p.trendWindowMs || 0)} onChange={e=>p.setTrendWindowMs!(Number(e.target.value))}>
                <option value={0}>Tout</option>
                <option value={60_000}>1 min</option>
                <option value={3_600_000}>1 h</option>
                <option value={86_400_000}>1 jour</option>
              </select>
            </div>
          )}
          <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
            <label>ΔY (erreur)</label>
            <input type="number" value={p.deltaY} onChange={e=>p.setDeltaY(Number(e.target.value))} style={{ width: 120 }} />
          </div>
        </div>
      </div>
    </div>
  );
}


