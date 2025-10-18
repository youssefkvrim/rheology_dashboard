import type { MetricKey, MetricSample, MetricsSeries } from '../types/domain';

export interface MetricsRepository {
  getSeriesForRange(id: string, range: '3h'|'1d'|'7d'|'1m'|'3m'|'all'|'specific', anchorTs?: number): Promise<MetricsSeries>;
  getSeriesBetween(id: string, startTs: number, endTs: number, stepMs?: number): Promise<MetricsSeries>;
  getMetricBetween(id: string, metric: MetricKey, startTs: number, endTs: number, stepMs?: number): Promise<MetricSample[]>;
}

// Wraps existing synchronous generators (simulation) into an async-shaped repository
export class SimMetricsRepository implements MetricsRepository {
  private readonly sync:
    { getSeriesForRange: (range: any, anchorTs?: number) => MetricsSeries;
      getSeriesBetween: (start: number, end: number, step?: number) => MetricsSeries; };

  constructor(sync: { getSeriesForRange: (range: any, anchorTs?: number) => MetricsSeries;
                     getSeriesBetween: (start: number, end: number, step?: number) => MetricsSeries; }) {
    this.sync = sync;
  }

  async getSeriesForRange(id: string, range: any, anchorTs?: number): Promise<MetricsSeries> {
    return this.sync.getSeriesForRange(range, anchorTs);
  }

  async getSeriesBetween(id: string, startTs: number, endTs: number, stepMs?: number): Promise<MetricsSeries> {
    return this.sync.getSeriesBetween(startTs, endTs, stepMs);
  }

  async getMetricBetween(id: string, metric: MetricKey, startTs: number, endTs: number, stepMs?: number): Promise<MetricSample[]> {
    const all = this.sync.getSeriesBetween(startTs, endTs, stepMs);
    return all[metric];
  }
}

// No-op placeholder repo for future wiring to API
export class NoopMetricsRepository implements MetricsRepository {
  async getSeriesForRange(): Promise<MetricsSeries> {
    return { densite: [], viscosite: [], ph: [], temperature: [] };
  }
  async getSeriesBetween(): Promise<MetricsSeries> {
    return { densite: [], viscosite: [], ph: [], temperature: [] };
  }
  async getMetricBetween(): Promise<MetricSample[]> {
    return [];
  }
}


