import type { MetricKey, MetricSample, MetricsSeries, RangeKey } from '../types/domain';
import { FRONTEND_TO_DB, toFeKey } from '../shared/metricKeys';

// the shape of anything that can give us metric data
export interface MetricsRepository {
  getSeriesForRange(id: string, range: RangeKey, anchorTs?: number): Promise<MetricsSeries>;
  getSeriesBetween(id: string, startTs: number, endTs: number, stepMs?: number): Promise<MetricsSeries>;
  getMetricBetween(id: string, metric: MetricKey, startTs: number, endTs: number, stepMs?: number): Promise<MetricSample[]>;
}

// this one talks to the real server to get slurry data
import { fetchRheologyAll } from '../services/api';

// takes raw server data and makes sure t and v are actual numbers
const toSample = (d: any) => ({ t: Number(d.t), v: Number(d.v) });

export class ApiMetricsRepository implements MetricsRepository {
  // figures out what time window we need based on the range u picked
  private computeWindow(range: RangeKey, anchorTs?: number): [number, number] {
    const nowTs = Date.now();
    // don't let the end go past "now" even if anchor is in the future
    let end = Math.min(anchorTs ?? nowTs, nowTs);
    let start = end - 3 * 60 * 60 * 1000;
    // each range is basically just "how far back do we go"
    if (range === '1d') start = end - 24 * 60 * 60 * 1000;
    else if (range === '7d') start = end - 7 * 24 * 60 * 60 * 1000;
    else if (range === '1m') start = end - 30 * 24 * 60 * 60 * 1000;
    else if (range === '3m') start = end - 90 * 24 * 60 * 60 * 1000;
    else if (range === '3h') start = end - 3 * 60 * 60 * 1000;
    // "all" literally means give me everything lol
    else if (range === 'all') { start = 0; end = nowTs; }
    return [start, end];
  }

  // just a shortcut that converts a range like "7d" into actual timestamps then fetches
  async getSeriesForRange(id: string, range: RangeKey, anchorTs?: number): Promise<MetricsSeries> {
    const [start, end] = this.computeWindow(range, anchorTs);
    return this.getSeriesBetween(id, start, end);
  }

  // grabs all 4 main metrics from the server and maps em to our frontend keys
  async getSeriesBetween(id: string, startTs: number, endTs: number, _stepMs?: number): Promise<MetricsSeries> {
    const dbKeys = [FRONTEND_TO_DB.densite, FRONTEND_TO_DB.viscosite, FRONTEND_TO_DB.ph, FRONTEND_TO_DB.temperature];
    const { series } = await fetchRheologyAll(id, dbKeys, false);
    return {
      densite: (series[FRONTEND_TO_DB.densite] || []).map(toSample),
      viscosite: (series[FRONTEND_TO_DB.viscosite] || []).map(toSample),
      ph: (series[FRONTEND_TO_DB.ph] || []).map(toSample),
      temperature: (series[FRONTEND_TO_DB.temperature] || []).map(toSample),
    };
  }

  // same but for just one metric instead of all of them
  async getMetricBetween(id: string, metric: MetricKey, startTs: number, endTs: number, _stepMs?: number): Promise<MetricSample[]> {
    // translates our frontend metric name to what the db actually calls it
    const dbKey = FRONTEND_TO_DB[metric];
    const { series } = await fetchRheologyAll(id, [dbKey], false);
    return (series[dbKey] || []).map(toSample);
  }
}
