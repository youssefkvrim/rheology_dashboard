import { ReferenceArea } from 'recharts';

type CriticalZonesProps = {
  effectiveBounds?: { low: number; high: number };
  bounds?: { low: number | null; high: number | null };
  critPct?: number;
};

export function CriticalZones({ effectiveBounds, bounds, critPct }: CriticalZonesProps) {
  if (!effectiveBounds) return null;

  const y1 = effectiveBounds.low;
  const y2 = effectiveBounds.high;
  const singleBound = !!bounds && ((bounds.low == null) !== (bounds.high == null));
  if (singleBound || critPct == null) {
    return <ReferenceArea y1={y1} y2={y2} fill="#22c55e" fillOpacity={0.12} />;
  }

  const h = y2 - y1;
  const m = Math.max(0, Math.min(100, critPct)) / 100;
  const lowH = h * (m / 2);
  const midH = h * (1 - m);
  const topH = h * (m / 2);

  return (
    <>
      <ReferenceArea y1={y1} y2={y1 + lowH} fill="#fbbf24" fillOpacity={0.12} />
      <ReferenceArea y1={y1 + lowH} y2={y1 + lowH + midH} fill="#22c55e" fillOpacity={0.12} />
      <ReferenceArea y1={y2 - topH} y2={y2} fill="#fbbf24" fillOpacity={0.12} />
    </>
  );
}
