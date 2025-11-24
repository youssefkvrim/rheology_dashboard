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

// API-backed repository using server /api/rheology/* endpoints
import { fetchRheologyAll } from '../services/api';

export class ApiMetricsRepository implements MetricsRepository {
  // Compute [start,end] for a given range relative to anchorTs or now
  private computeWindow(range: RangeKey, anchorTs?: number): [number, number] {
    const nowTs = Date.now();
    let end = Math.min(anchorTs ?? nowTs, nowTs);
    let start = end - 3 * 60 * 60 * 1000;
    if (range === '1d') start = end - 24 * 60 * 60 * 1000;
    else if (range === '7d') start = end - 7 * 24 * 60 * 60 * 1000;
    else if (range === '1m') start = end - 30 * 24 * 60 * 60 * 1000;
    else if (range === '3m') start = end - 90 * 24 * 60 * 60 * 1000;
    else if (range === '3h') start = end - 3 * 60 * 60 * 1000;
    else if (range === 'all') { start = 0; end = nowTs; }
    return [start, end];
  }

  async getSeriesForRange(id: string, range: RangeKey, anchorTs?: number): Promise<MetricsSeries> {
    const [start, end] = this.computeWindow(range, anchorTs);
    return this.getSeriesBetween(id, start, end);
  }

  async getSeriesBetween(id: string, startTs: number, endTs: number, _stepMs?: number): Promise<MetricsSeries> {
    const { series } = await fetchRheologyAll(id, ['density','viscosity','pH','temperature'], false);
    // Normalize to MetricsSeries shape expected by UI
    return {
      densite: (series['density'] || []).map((d: any) => ({ t: Number(d.t), v: Number(d.v) })),
      viscosite: (series['viscosity'] || []).map((d: any) => ({ t: Number(d.t), v: Number(d.v) })),
      ph: (series['pH'] || []).map((d: any) => ({ t: Number(d.t), v: Number(d.v) })),
      temperature: (series['temperature'] || []).map((d: any) => ({ t: Number(d.t), v: Number(d.v) })),
    };
  }

  async getMetricBetween(id: string, metric: MetricKey, startTs: number, endTs: number, _stepMs?: number): Promise<MetricSample[]> {
    const map: Record<MetricKey, string> = {
      densite: 'density',
      viscosite: 'viscosity',
      ph: 'pH',
      temperature: 'temperature',
    };
    const key = map[metric];
    const { series } = await fetchRheologyAll(id, [key], false);
    return (series[key] || []).map((d: any) => ({ t: Number(d.t), v: Number(d.v) }));
  }
}


