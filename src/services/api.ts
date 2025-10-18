// Placeholder API client functions for future SQL-backed endpoints
// These functions currently throw to make accidental usage explicit.
// Replace with real fetch calls when the backend is available.

import type { MetricKey, MetricSample, MetricsSeries } from '../types/domain';

const BASE = (import.meta as any)?.env?.VITE_API_BASE || '/api';

export async function fetchMetricsSeries(
  barbotineId: string,
  startTs: number,
  endTs: number,
  bucketMs?: number
): Promise<MetricsSeries> {
  void barbotineId; void startTs; void endTs; void bucketMs; void BASE;
  throw new Error('API not implemented: fetchMetricsSeries');
}

export async function fetchMetricBetween(
  barbotineId: string,
  metric: MetricKey,
  startTs: number,
  endTs: number,
  bucketMs?: number
): Promise<MetricSample[]> {
  void barbotineId; void metric; void startTs; void endTs; void bucketMs; void BASE;
  throw new Error('API not implemented: fetchMetricBetween');
}


