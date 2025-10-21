import React, { useMemo, useState } from 'react';
import type { BarbotineConfig } from '../types/domain';

export type BarbotineCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string, config: BarbotineConfig) => void;
};

export function BarbotineCreateDialog(p: BarbotineCreateDialogProps) {
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<string>('M7-3');
  const [metrics, setMetrics] = useState<{ densite: boolean; viscosite: boolean; temperature: boolean; ph: boolean; pc: boolean }>(() => ({
    densite: true,
    viscosite: true,
    temperature: true,
    ph: true,
    pc: true,
  }));
  const [modes, setModes] = useState<BarbotineConfig['modes']>({
    densite: 'manuel',
    viscosite: 'manuel',
    temperature: 'manuel',
    pc: 'manuel',
  });

  const valid = useMemo(() => {
    const hasName = !!name.trim();
    const anyMetric = Object.values(metrics).some(Boolean);
    return hasName && anyMetric;
  }, [name, metrics]);

  if (!p.open) return null;

  function renderForm() {
    return (
      <div className="modal-body">
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label>Nom de la barbotine</label>
          <input style={{ minWidth: 260 }} type="text" placeholder="Ex: M7-3 009" value={name} onChange={e=> setName(e.target.value)} />
        </div>
        <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <label>Type</label>
          <select value={type} onChange={e=> setType(e.target.value)}>
            <option value="M7-3">M7-3</option>
            <option value="2CN2">2CN2</option>
            <option value="R55">R55</option>
            <option value="Custom">Custom</option>
          </select>
        </div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Métriques</div>
          <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
            {(['densite','viscosite','temperature','ph','pc'] as const).map(key => (
              <label key={key} className="row" style={{ gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={(metrics as any)[key]} onChange={e=> setMetrics(prev => ({ ...prev, [key]: e.target.checked }))} />
                <span style={{ textTransform: 'capitalize' }}>{key === 'pc' ? 'pouvoir couvrant' : key}</span>
              </label>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Modes de saisie</div>
          {(metrics.densite || metrics.viscosite || metrics.temperature) && (
            <div style={{ marginBottom: 8 }}>
              <div className="muted" style={{ marginBottom: 4 }}>Densité / Viscosité / Température</div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {(['manuel','x276','x277','x278'] as const).map(opt => (
                  <label key={opt} className="row" style={{ gap: 6, alignItems: 'center' }}>
                    <input type="radio" name="rheonics" checked={modes.densite===opt && modes.viscosite===opt && modes.temperature===opt}
                      onChange={()=> setModes(prev => ({ ...prev, densite: opt, viscosite: opt, temperature: opt }))} />
                    <span>{opt==='manuel'?'manuel':`Rheonics ${opt.toUpperCase()}`}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {metrics.pc && (
            <div>
              <div className="muted" style={{ marginBottom: 4 }}>Pouvoir couvrant</div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {(['manuel','a6','a7','a8'] as const).map(opt => (
                  <label key={opt} className="row" style={{ gap: 6, alignItems: 'center' }}>
                    <input type="radio" name="pc" checked={modes.pc===opt}
                      onChange={()=> setModes(prev => ({ ...prev, pc: opt }))} />
                    <span>{opt==='manuel'?'manuel':`BRET ${opt.toUpperCase()}`}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="borderline" onClick={p.onClose}>Annuler</button>
          <button className="primary" disabled={!valid} onClick={()=> setStep('confirm')}>Continuer</button>
        </div>
      </div>
    );
  }

  function renderConfirm() {
    const cfg: BarbotineConfig = { type, metrics, modes };
    return (
      <div className="modal-body">
        <div style={{ marginBottom: 8 }}>
          <div className="muted">Nom</div>
          <div><strong>{name.trim()}</strong></div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div className="muted">Type</div>
          <div>{type}</div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div className="muted">Métriques</div>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            {Object.entries(metrics).filter(([,on])=>on).map(([k])=> (
              <span key={k} className="badge">{k==='pc'?'pouvoir couvrant':k}</span>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div className="muted">Modes</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', rowGap: 4, columnGap: 8 }}>
            {metrics.densite && <><div>Densité</div><div>{modes.densite==='manuel'?'manuel':`Rheonics ${String(modes.densite).toUpperCase()}`}</div></>}
            {metrics.viscosite && <><div>Viscosité</div><div>{modes.viscosite==='manuel'?'manuel':`Rheonics ${String(modes.viscosite).toUpperCase()}`}</div></>}
            {metrics.temperature && <><div>Température</div><div>{modes.temperature==='manuel'?'manuel':`Rheonics ${String(modes.temperature).toUpperCase()}`}</div></>}
            {metrics.pc && <><div>Pouvoir couvrant</div><div>{modes.pc==='manuel'?'manuel':`BRET ${String(modes.pc).toUpperCase()}`}</div></>}
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={()=> setStep('form')}>Modifier</button>
          <button className="primary" onClick={()=> { p.onConfirm(name.trim(), cfg); p.onClose(); }}>Confirmer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={p.onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Ajouter une barbotine</h3>
          <button onClick={p.onClose}>Fermer</button>
        </div>
        {step==='form' ? renderForm() : renderConfirm()}
      </div>
    </div>
  );
}


