import React, { useEffect, useMemo, useState } from 'react';

// this is the settings popup for each chart
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
  trendSegPct?: number;
  setTrendSegPct?: (pct: number) => void;
  deltaY: number;
  setDeltaY: (n: number) => void;
  low: number | null;
  high: number | null;
  setLow: (n: number | null) => void;
  setHigh: (n: number | null) => void;
  // the yellow warning zone settings
  critOn?: boolean;
  setCritOn?: (v: boolean) => void;
  critPct?: number;
  setCritPct?: (n: number) => void;
  onClose: () => void;
  // hover interpolation settings
  interpOn?: boolean;
  setInterpOn?: (v: boolean) => void;
  interpMode?: 'linear' | 'lagrange3';
  setInterpMode?: (m: 'linear' | 'lagrange3') => void;
};

export function ParamsModal(p: ParamsModalProps) {
  // draft values so we can type freely without messing up the actual state mid-typing
  const [draftLow, setDraftLow] = useState<string>('');
  const [draftHigh, setDraftHigh] = useState<string>('');

  // syncs draft fields whenever the real bounds change from outside
  useEffect(() => {
    setDraftLow(p.low == null ? '' : String(p.low));
    setDraftHigh(p.high == null ? '' : String(p.high));
  }, [p.low, p.high]);

  // handles both commas and dots as decimal separators bc french ppl use commas
  const parseLocaleNumber = useMemo(() => (input: string): number | null | typeof NaN => {
    const s = (input ?? '').trim();
    if (!s) return null;
    const dot = (s.match(/\./g) || []).length;
    const comma = (s.match(/,/g) || []).length;
    // if theres more than one separator its definitely wrong
    if (dot + comma > 1) return NaN;
    if (dot === 1 && comma === 1) return NaN;
    const normalized = s.replace(',', '.');
    if (!/^[-+]?\d*(?:\.\d*)?$/.test(normalized)) return NaN;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : NaN;
  }, []);

  return (
    // clicking the dark backdrop closes the modal
    <div className="modal-backdrop" onClick={p.onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{p.title}</h3>
          <button onClick={p.onClose}>Fermer</button>
        </div>
        <div className="modal-body">
          {/* custom date range picker */}
          <div style={{ display: 'grid', gap: 6 }}>
            <label>Période personnalisée:</label>
            <label>Début</label>
            <input type="datetime-local" value={p.specificStart} onChange={(e)=>{ p.setSpecificStart(e.target.value); p.onSetRangeSpecific(); }} />
            <label>Fin</label>
            <input type="datetime-local" value={p.specificEnd} onChange={(e)=>{ p.setSpecificEnd(e.target.value); p.onSetRangeSpecific(); }} />
          </div>
          {/* min/max conformity bounds inputs */}
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <label>Conformité min/max:</label>
            <input type="text" inputMode="decimal" placeholder="min" style={{ width: 110 }} value={draftLow}
              onChange={e => {
                const raw = e.target.value;
                setDraftLow(raw);
                const n = parseLocaleNumber(raw);
                if (n === null) { p.setLow && p.setLow(null); }
                else if (!Number.isNaN(n)) { p.setLow && p.setLow(n as number); }
              }} />
            <input type="text" inputMode="decimal" placeholder="max" style={{ width: 110 }} value={draftHigh}
              onChange={e => {
                const raw = e.target.value;
                setDraftHigh(raw);
                const n = parseLocaleNumber(raw);
                if (n === null) { p.setHigh && p.setHigh(null); }
                else if (!Number.isNaN(n)) { p.setHigh && p.setHigh(n as number); }
              }} />
          </div>
          {/* unit selector dropdown */}
          <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
            <label>Unité:</label>
            <select value={p.unit} onChange={e=>p.setUnit(e.target.value)}>
              {p.unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          {/* toggle for the red average line */}
          <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
            <label>Moyenne</label>
            <input type="checkbox" checked={p.avgOn} onChange={e=>p.setAvgOn(e.target.checked)} />
          </div>
          {/* toggle for the black dashed trend line */}
          <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
            <label>Ligne de tendance</label>
            <input type="checkbox" checked={p.trendOn} onChange={e=>p.setTrendOn(e.target.checked)} />
          </div>
          {/* slider to control how many segments the trend line gets chopped into */}
          {p.trendOn && p.setTrendSegPct && (
            <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
              <label>Segmentation tendance (%)</label>
              <input type="range" min={1} max={100} step={1} value={p.trendSegPct ?? 100} onChange={e=>p.setTrendSegPct!(Number(e.target.value))} />
              <span className="muted">{p.trendSegPct ?? 100}%</span>
            </div>
          )}
          {/* critical zone slider - controls how much of the bounds area turns yellow */}
          {p.setCritOn && p.setCritPct && (
            <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
              <label>Zones critiques (%)</label>
              <input type="checkbox" checked={!!p.critOn} onChange={e=>p.setCritOn!(e.target.checked)} />
              <input type="range" min={0} max={60} step={5} value={p.critPct ?? 30} onChange={e=>p.setCritPct!(Number(e.target.value))} />
              <span className="muted">{p.critPct ?? 30}%</span>
            </div>
          )}
          {/* how far back in time the trend line should look */}
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
          {/* error margin on the Y axis */}
          <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
            <label>ΔY (erreur)</label>
            <input type="number" step={1} value={p.deltaY} onChange={e=>p.setDeltaY(Number(e.target.value))} style={{ width: 120 }} />
          </div>
          {/* interpolation mode - makes a dot follow ur cursor between data points */}
          {p.setInterpOn && (
            <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
              <label>Interpolation au survol</label>
              <input type="checkbox" checked={!!p.interpOn} onChange={e=>p.setInterpOn!(e.target.checked)} />
              <select value={p.interpMode || 'linear'} onChange={e=>p.setInterpMode && p.setInterpMode(e.target.value as any)}>
                <option value="linear">Linéaire</option>
                <option value="lagrange3">Lagrange (3 pts)</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

