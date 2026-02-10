import React, { useMemo, useState } from 'react';
import type { BarbotineConfig } from '../types/domain';

// the popup for creating a new barbotine (its a 2-step form: fill in -> confirm)
export type BarbotineCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string, config: BarbotineConfig) => void;
};

export function BarbotineCreateDialog(p: BarbotineCreateDialogProps) {
  // which step of the form ur on: filling it out or reviewing before submit
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<string>('M7-3');
  const [customType, setCustomType] = useState<string>('');
  // which metrics are enabled (checkboxes)
  const [metrics, setMetrics] = useState<{ densite: boolean; viscosite: boolean; temperature: boolean; ph: boolean; pc: boolean; h2o: boolean; silice: boolean; grains: boolean }>(() => ({
    densite: true,
    viscosite: true,
    pc: true,
    h2o: true,
    ph: true,
    temperature: true,
    silice: true,
    grains: true,
  }));
  // whether each metric is entered manually or comes from a sensor
  const [modes, setModes] = useState<BarbotineConfig['modes']>({
    densite: 'manuel',
    viscosite: 'manuel',
    temperature: 'manuel',
    pc: 'manuel',
  });

  // u need at least a name to continue
  const valid = useMemo(() => {
    const hasName = !!name.trim();
    return hasName;
  }, [name]);

  if (!p.open) return null;

  function renderForm() {
    return (
      <form className="modal-body" style={{ display: 'grid', gap: 12 }} onSubmit={(e)=> { e.preventDefault(); setStep('confirm'); }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label>Nom de la barbotine</label>
          <input style={{ minWidth: 260 }} type="text" placeholder="Ex: M7-3 009" value={name} onChange={e=> setName(e.target.value)} />
        </div>
        {/* type dropdown, with a text field that appears if u pick "Custom" */}
        <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <label>Type</label>
          <select value={type} onChange={e=> setType(e.target.value)}>
            <option value="M7-3">M7-3</option>
            <option value="2CN2">2CN2</option>
            <option value="R55">R55</option>
            <option value="Custom">Custom</option>
          </select>
          {type === 'Custom' && (
            <input style={{ minWidth: 180 }} type="text" placeholder="Type personnalisé" value={customType} onChange={e=> setCustomType(e.target.value)} />
          )}
        </div>
        {/* checkboxes for all the metrics u wanna track */}
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Métriques</div>
          <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
            {(['densite','viscosite','pc','h2o','ph','temperature','silice','grains'] as const).map(key => (
              <label key={key} className="row" style={{ gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={(metrics as any)[key]} onChange={e=> setMetrics(prev => ({ ...prev, [key]: e.target.checked }))} />
                <span style={{ textTransform: 'capitalize' }}>
                  {key==='pc'?'pouvoir couvrant': key==='h2o'?'H2O': key}
                </span>
              </label>
            ))}
          </div>
        </div>
        {/* pick how each metric gets its data: manual typing or from a sensor */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Modes de saisie</div>
          {/* density/viscosity/temp all share the same sensor (Rheonics) */}
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
          {/* covering power has its own sensor (BRET) */}
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
          <button type="submit" className="primary" disabled={!valid}>Continuer</button>
        </div>
      </form>
    );
  }

  // the "are u sure?" screen before actually creating it
  function renderConfirm() {
    const cfg: BarbotineConfig = { type: (type==='Custom' ? (customType.trim() || 'Custom') : type), metrics, modes };
    return (
      <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
        <div>
          <div className="muted">Nom</div>
          <div><strong>{name.trim()}</strong></div>
        </div>
        <div>
          <div className="muted">Type</div>
          <div>{cfg.type}</div>
        </div>
        <div>
          <div className="muted">Métriques</div>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            {Object.entries(metrics).filter(([,on])=>on).map(([k])=> (
              <span key={k} className="badge">{k==='pc'?'pouvoir couvrant':k}</span>
            ))}
          </div>
        </div>
        <div>
          <div className="muted">Modes</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', rowGap: 4, columnGap: 8 }}>
            {metrics.densite && <><div>Densité</div><div>{modes.densite==='manuel'?'manuel':`Rheonics ${String(modes.densite).toUpperCase()}`}</div></>}
            {metrics.viscosite && <><div>Viscosité</div><div>{modes.viscosite==='manuel'?'manuel':`Rheonics ${String(modes.viscosite).toUpperCase()}`}</div></>}
            {metrics.temperature && <><div>Température</div><div>{modes.temperature==='manuel'?'manuel':`Rheonics ${String(modes.temperature).toUpperCase()}`}</div></>}
            {metrics.pc && <><div>Pouvoir couvrant</div><div>{modes.pc==='manuel'?'manuel':`BRET ${String(modes.pc).toUpperCase()}`}</div></>}
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={()=> setStep('form')}>Modifier</button>
          <button type="button" className="primary" onClick={()=> { p.onConfirm(name.trim(), cfg); p.onClose(); }}>Confirmer</button>
        </div>
      </div>
    );
  }

  return (
    // clicking outside closes it, clicking inside doesnt
    <div className="modal-backdrop" onClick={p.onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 560, maxWidth: '95vw' }}>
        <div className="modal-header" style={{ alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Ajouter une barbotine</h3>
          <button onClick={p.onClose} aria-label="Fermer" title="Fermer" className="icon-btn" style={{ width: 36, height: 36, lineHeight: 0, fontSize: 22, fontWeight: 600, cursor: 'pointer' }}>
            ×
          </button>
        </div>
        {step==='form' ? renderForm() : renderConfirm()}
      </div>
    </div>
  );
}

