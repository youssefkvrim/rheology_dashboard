// Placeholder API client for future backend integration.
// Keep signatures stable so UI can switch to API/SQL without churn.

import type { MetricKey, MetricSample, MetricsSeries } from '../types/domain';

const BASE = (import.meta as any).env?.VITE_API_BASE || '/api';

export async function fetchMetricsSeries(
  barbotineId: string,
  start: number,
  end: number,
  bucketMs?: number
): Promise<MetricsSeries> {
  // Placeholder: return empty structure; to be implemented later.
  void barbotineId; void start; void end; void bucketMs; void BASE;
  return { densite: [], viscosite: [], ph: [], temperature: [] };
}

export async function fetchMetricBetween(
  barbotineId: string,
  metric: MetricKey,
  start: number,
  end: number,
  bucketMs?: number
): Promise<MetricSample[]> {
  // Placeholder: return empty; to be implemented later.
  void barbotineId; void metric; void start; void end; void bucketMs; void BASE;
  return [];
}


