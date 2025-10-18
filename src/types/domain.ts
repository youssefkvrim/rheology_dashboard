export type MetricSample = { t: number; v: number };

export type MetricsSeries = {
  densite: MetricSample[];
  viscosite: MetricSample[];
  ph: MetricSample[];
  temperature: MetricSample[];
};

export type Bounds = { low: number | null; high: number | null };

export type Barbotine = {
  id: string;
  name: string;
  online: boolean;
  last: { densite: number; viscosite: number; ph: number; temperature: number } | null;
};

export type MetricKey = keyof MetricsSeries;

export type RangeKey = 'all' | '3h' | '1d' | '7d' | '1m' | '3m' | 'specific';


