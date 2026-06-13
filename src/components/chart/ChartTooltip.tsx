export type TrendMeta = { start: number; end: number; m: number };

type TooltipPayload = {
  dataKey?: string;
  payload?: { t?: number; v?: number; avg?: number };
};

export type ChartTooltipInfo = {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: number | string;
};

type ChartTooltipProps = ChartTooltipInfo & {
  title: string;
  unitLabel: string;
  color?: string;
  avgOn?: boolean;
  trendOn?: boolean;
  interpOn?: boolean;
  interpMode?: 'linear' | 'lagrange3';
  hoverTs: number | null;
  trendMeta: TrendMeta[];
  formatTick: (value: number) => string;
  interpolateAt: (ts: number, mode?: 'lagrange3' | 'linear') => number | null;
};

export function ChartTooltip({
  active,
  payload,
  label,
  title,
  unitLabel,
  color,
  avgOn,
  trendOn,
  interpOn,
  interpMode,
  hoverTs,
  trendMeta,
  formatTick,
  interpolateAt,
}: ChartTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const ts = interpOn && hoverTs != null ? hoverTs : Number(label ?? payload[0]?.payload?.t ?? 0);
  let trendLabel = '';
  if (trendOn && trendMeta.length) {
    const seg = trendMeta.find(s => ts >= s.start && ts <= s.end) || trendMeta[trendMeta.length - 1];
    if (seg) {
      if (seg.m > 0) trendLabel = 'Tendance : Haussière';
      else if (seg.m < 0) trendLabel = 'Tendance : Baissière';
      else trendLabel = 'Tendance : Horizontale';
    }
  }

  const dateStr = new Date(ts).toLocaleString();
  if (interpOn) {
    const vy = interpolateAt(ts, interpMode || 'linear');
    const valueStr = vy != null ? `${title} : ${formatTick(vy)} ${unitLabel}`.trim() : '';
    return (
      <div className="recharts-default-tooltip" style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: 8 }}>
        <div>{dateStr}</div>
        {valueStr && <div style={{ color: color || '#22c55e' }}>{valueStr}</div>}
        {trendLabel && <div style={{ color: '#111827' }}>{trendLabel}</div>}
      </div>
    );
  }

  const valueEntry = payload.find(e => e && e.dataKey === 'v');
  const p0 = valueEntry?.payload || payload[0]?.payload;
  const valueStr = p0 && typeof p0.v === 'number' ? `${title} : ${formatTick(p0.v)} ${unitLabel}`.trim() : '';
  const avgStr = (avgOn && p0 && typeof p0.avg === 'number') ? `Moyenne : ${formatTick(p0.avg)} ${unitLabel}`.trim() : '';
  return (
    <div className="recharts-default-tooltip" style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: 8 }}>
      <div>{dateStr}</div>
      {valueStr && <div style={{ color: color || '#22c55e' }}>{valueStr}</div>}
      {avgStr && <div style={{ color: '#ef4444' }}>{avgStr}</div>}
      {trendLabel && <div style={{ color: '#111827' }}>{trendLabel}</div>}
    </div>
  );
}
