// all the main types the dashboard uses — shared between UI and data stuff

// one data point: t is the timestamp, v is the value
export type MetricSample = { t: number; v: number };

// a bunch of data points grouped by metric — this is what the charts eat
export type MetricsSeries = {
  densite: MetricSample[];
  viscosite: MetricSample[];
  ph: MetricSample[];
  temperature: MetricSample[];
};

// low and high bounds for alerts — null means "no limit set"
export type Bounds = { low: number | null; high: number | null };

// settings u pick when creating a new barbotine in the dialog
export type BarbotineConfig = {
  type: string; // the barbotine type like M7-3, 2CN2, R55, etc.
  metrics: {
    densite: boolean;
    viscosite: boolean;
    temperature: boolean;
    ph: boolean;
    pc: boolean; // pouvoir couvrant aka covering power
    h2o: boolean;
    silice: boolean;
    grains: boolean;
  };
  // how each metric gets its data — manual input or from a specific sensor
  modes: {
    densite?: 'manuel' | 'x276' | 'x277' | 'x278';
    viscosite?: 'manuel' | 'x276' | 'x277' | 'x278';
    temperature?: 'manuel' | 'x276' | 'x277' | 'x278';
    pc?: 'manuel' | 'a6' | 'a7' | 'a8';
  };
};

// one barbotine — basically a slurry batch with its latest readings
export type Barbotine = {
  id: string;
  name: string;
  online: boolean; // is it currently being monitored
  last: { densite: number; viscosite: number; ph: number; temperature: number } | null;
  config?: BarbotineConfig;
  slurryId?: string; // links to the actual slurry in the db
};

// shortcut type — just the keys of MetricsSeries
export type MetricKey = keyof MetricsSeries;

// time range options for the charts — 'specific' means custom date range
export type RangeKey = 'all' | '3h' | '1d' | '7d' | '1m' | '3m' | 'specific';
