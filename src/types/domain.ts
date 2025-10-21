// Centralized domain types used across the dashboard UI and data layer

export type MetricSample = { t: number; v: number };

export type MetricsSeries = {
  densite: MetricSample[];
  viscosite: MetricSample[];
  ph: MetricSample[];
  temperature: MetricSample[];
};

export type Bounds = { low: number | null; high: number | null };

// Optional configuration saved when creating a barbotine via the UI dialog
export type BarbotineConfig = {
  type: string; // ex: M7-3, 2CN2, R55, Custom
  metrics: {
    densite: boolean;
    viscosite: boolean;
    temperature: boolean;
    ph: boolean;
    pc: boolean; // pouvoir couvrant
  };
  modes: {
    densite?: 'manuel' | 'x276' | 'x277' | 'x278';
    viscosite?: 'manuel' | 'x276' | 'x277' | 'x278';
    temperature?: 'manuel' | 'x276' | 'x277' | 'x278';
    pc?: 'manuel' | 'a6' | 'a7' | 'a8';
  };
};

export type Barbotine = {
  id: string;
  name: string;
  online: boolean;
  last: { densite: number; viscosite: number; ph: number; temperature: number } | null;
  config?: BarbotineConfig;
};

export type MetricKey = keyof MetricsSeries;

export type RangeKey = 'all' | '3h' | '1d' | '7d' | '1m' | '3m' | 'specific';


