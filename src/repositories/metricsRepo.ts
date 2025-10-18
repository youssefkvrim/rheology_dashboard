import type { MetricKey, MetricSample, MetricsSeries, RangeKey } from '../types/domain';

export interface MetricsRepository {
  getSeriesForRange(id: string, range: RangeKey, anchorTs?: number): Promise<MetricsSeries>;
  getSeriesBetween(id: string, startTs: number, endTs: number, stepMs?: number): Promise<MetricsSeries>;
  getMetricBetween(id: string, metric: MetricKey, startTs: number, endTs: number, stepMs?: number): Promise<MetricSample[]>;
}

// Wraps the current simulation logic provided by the app state selectors
export class SimMetricsRepository implements MetricsRepository {
  constructor(private readonly simFns: {
    getSeriesForRange: (range: RangeKey, anchorTs?: number) => MetricsSeries,
    getSeriesBetween: (start: number, end: number, step?: number) => MetricsSeries,
  }) {}

  async getSeriesForRange(id: string, range: RangeKey, anchorTs?: number): Promise<MetricsSeries> {
    return this.simFns.getSeriesForRange(range, anchorTs);
  }

  async getSeriesBetween(id: string, startTs: number, endTs: number, stepMs?: number): Promise<MetricsSeries> {
    return this.simFns.getSeriesBetween(startTs, endTs, stepMs);
  }

  async getMetricBetween(id: string, metric: MetricKey, startTs: number, endTs: number, stepMs?: number): Promise<MetricSample[]> {
    const all = this.simFns.getSeriesBetween(startTs, endTs, stepMs);
    return all[metric];
  }
}


