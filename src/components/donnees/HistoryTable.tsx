import { Fragment } from 'react';
import type { Barbotine } from '../../types/domain';
import type { DbMetricKey } from '../../shared/metricKeys';

export type TableMetricKey = DbMetricKey;
export type DayRow = Partial<Record<TableMetricKey, number>>;
export type HistoryMap = Record<string, Record<string, DayRow>>;

const metricOrder: TableMetricKey[] = ['pc', 'viscosity', 'density', 'pH', 'H2O', 'temperature', 'silice', 'grain'];
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
const paramCodeMap: Record<TableMetricKey, string> = {
  pc: 'p',
  viscosity: 'v',
  density: 'd',
  pH: 'a',
  H2O: 'h',
  temperature: 't',
  silice: 's',
  grain: 'g',
};

function dayKeyToLabel(key: string) {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

function sortDataBarbotines(a: Barbotine, b: Barbotine) {
  const group = (name: string) => name.includes('M7-3') ? 0 : name.includes('2CN2') ? 1 : name.includes('R55') ? 2 : 3;
  const ga = group(a.name);
  const gb = group(b.name);
  if (ga !== gb) return ga - gb;
  return a.name.localeCompare(b.name);
}

function unitForMetric(mk: TableMetricKey) {
  if (mk === 'pc') return 'g';
  if (mk === 'density') return 'g/cm³';
  if (mk === 'viscosity') return 'mPa·s';
  if (mk === 'temperature') return '°C';
  if (mk === 'H2O') return 'L/h';
  if (mk === 'silice' || mk === 'grain') return '%';
  return '(-)';
}

function rheologyIdParts(dayKey: string, barbotine: Barbotine, metric: TableMetricKey, variant: 'manual' | 'history') {
  const [yy, mm, dd] = dayKey.split('-').map(Number);
  const parisDate = new Date(Date.UTC(yy, mm - 1, dd, 12, 0, 0));
  const tsIso = parisDate.toISOString().replace(/\.\d{3}Z$/, '.000Z');
  const idSuffix = `${String(yy).slice(2)}${String(mm).padStart(2, '0')}${String(dd).padStart(2, '0')}1300002`;
  const slurryId = variant === 'manual'
    ? barbotine.slurryId || barbotine.id
    : barbotine.slurryId || barbotine.name.replace(/\s+/g, '_');
  const slurryType = barbotine.name.split(' ')[0] || 'M7-3';
  return {
    slurryId,
    slurryType,
    tsIso,
    idRheology: `${slurryId}_${paramCodeMap[metric] || 'x'}${idSuffix}`,
  };
}

type HistoryTableProps = {
  variant: 'manual' | 'history';
  title: string;
  description?: string;
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  loading: boolean;
  dayList: string[];
  historyMap: HistoryMap;
  barbotines: Barbotine[];
  changedCells: Record<string, boolean>;
  markCellChanged: (key: string) => void;
  appendSql: (line: string) => void;
  onLoadAll?: () => void;
};

export function HistoryTable({
  variant,
  title,
  description,
  start,
  end,
  onStartChange,
  onEndChange,
  loading,
  dayList,
  historyMap,
  barbotines,
  changedCells,
  markCellChanged,
  appendSql,
  onLoadAll,
}: HistoryTableProps) {
  const isManual = variant === 'manual';

  const renderCell = (dk: string, barbotine: Barbotine, metric: TableMetricKey, value: number | undefined) => {
    const hasValue = typeof value === 'number' && Number.isFinite(value);
    const display = hasValue ? Number(value.toFixed(3)) : isManual ? '' : '—';
    const cellKey = isManual ? `manual|${dk}|${barbotine.id}|${metric}` : `${dk}|${barbotine.id}|${metric}`;

    return (
      <td key={`${isManual ? 'mc' : 'c'}-${dk}-${barbotine.id}-${metric}`}>
        <input
          type="text"
          defaultValue={display}
          placeholder={isManual ? '—' : undefined}
          onFocus={isManual ? undefined : (e) => { if (e.target.value === '—') e.target.value = ''; }}
          onBlur={(ev) => {
            const newValRaw = ev.target.value.trim();
            if (isManual && newValRaw === String(display)) return;
            const { slurryId, slurryType, tsIso, idRheology } = rheologyIdParts(dk, barbotine, metric, variant);
            if (isManual) markCellChanged(cellKey);

            if (newValRaw === '') {
              if (hasValue) {
                const line = isManual
                  ? `DELETE FROM rheology WHERE id_rheology = '${idRheology}';`
                  : `DELETE FROM rheology\nWHERE id_rheology = '${idRheology}';`;
                appendSql(line);
                if (!isManual) markCellChanged(cellKey);
              }
              return;
            }
            if (!isManual && newValRaw === display.toString()) return;
            const newVal = Number(newValRaw.replace(',', '.'));
            if (!Number.isFinite(newVal)) return;
            if (!hasValue) {
              const source = isManual ? 'manual' : 'youssef.karim';
              appendSql(`INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('${idRheology}', '${slurryId}', '${slurryType}', '${tsIso}', '${source}', '${metric}', ${newVal.toFixed(3)}, '${unitForMetric(metric)}', NULL, NULL);`);
            } else {
              const line = isManual
                ? `UPDATE rheology SET value = ${newVal.toFixed(3)} WHERE id_rheology = '${idRheology}';`
                : `UPDATE rheology\nSET value = ${newVal.toFixed(3)}\nWHERE id_rheology = '${idRheology}';`;
              appendSql(line);
            }
            if (!isManual) markCellChanged(cellKey);
          }}
          style={{ width: '100%', minWidth: 60, ...(changedCells[cellKey] ? { border: '2px solid #ef4444' } : {}) }}
        />
      </td>
    );
  };

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h3>{title}</h3>
      {description && <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>{description}</p>}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label>Début</label>
        <input type="datetime-local" placeholder={isManual ? undefined : 'jj/mm/aaaa --:--'} value={start} onChange={e => onStartChange(e.target.value)} />
        <label>Fin</label>
        <input type="datetime-local" placeholder={isManual ? undefined : 'jj/mm/aaaa --:--'} value={end} onChange={e => onEndChange(e.target.value)} />
        {onLoadAll && <button onClick={onLoadAll} style={{ marginLeft: 8 }}>Tout</button>}
      </div>

      {loading && (isManual ? <p className="muted" style={{ marginTop: 12 }}>Chargement…</p> : null)}

      {isManual ? (
        <>
          {!loading && dayList.length > 0 && (
            <div style={{ marginTop: 16 }}>
              {dayList.map(dk => (
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
                      {[...barbotines].sort(sortDataBarbotines).map(b => {
                        const row = historyMap[dk]?.[b.name] || {};
                        return (
                          <tr key={`mr-${dk}-${b.id}`}>
                            <td>{b.name}</td>
                            {metricOrder.map(mk => renderCell(dk, b, mk, row[mk]))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
          {!loading && dayList.length === 0 && (start || end) && (
            <p className="muted" style={{ marginTop: 12 }}>Aucune donnée trouvée pour cette période.</p>
          )}
        </>
      ) : (
        <div style={{ marginTop: 10 }}>
          <table className="table" style={{ width: '100%' }}>
            <tbody>
              {loading && <tr><td colSpan={9}>Chargement…</td></tr>}
              {!loading && dayList.map(dk => (
                <Fragment key={`day-${dk}`}>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ width: 140 }}>{dayKeyToLabel(dk)}</th>
                    {metricOrder.map(mk => <th key={`h-${dk}-${mk}`}>{headerLabels[mk]}</th>)}
                  </tr>
                  {[...barbotines].sort(sortDataBarbotines).map(b => {
                    const row = historyMap[dk]?.[b.name] || {};
                    return (
                      <tr key={`r-${dk}-${b.id}`}>
                        <td>{b.name}</td>
                        {metricOrder.map(mk => renderCell(dk, b, mk, row[mk]))}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
