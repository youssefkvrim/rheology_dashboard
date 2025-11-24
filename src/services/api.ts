// Placeholder API client functions for future SQL-backed endpoints
// These functions currently throw to make accidental usage explicit.
// Replace with real fetch calls when the backend is available.

import type { MetricKey, MetricSample, MetricsSeries } from '../types/domain';
import { argon2Verify } from 'hash-wasm';

const BASE = (import.meta as any)?.env?.VITE_API_BASE || '/api';

// Global error reporter for debugger widget
export function reportError(message: string) {
  try {
    const evt = new CustomEvent('app-error', { detail: { ts: Date.now(), message } });
    window.dispatchEvent(evt);
  } catch { /* ignore */ }
}

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

// --------------------- Rheology (SQL proxy) ---------------------
export async function fetchRheologySeries(
  slurryId: string,
  parameter: 'density'|'viscosity'|'pc'|'H2O'|'temperature'|'pH'|'silice'|'grain',
  startTs?: number,
  endTs?: number
): Promise<{ t:number; v:number; unit?: string }[]> {
  const params = new URLSearchParams({ slurryId, parameter });
  if (startTs != null) params.set('start', String(startTs));
  if (endTs != null) params.set('end', String(endTs));
  const res = await fetch(`${BASE}/rheology?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) { reportError(`GET /rheology ${res.status}`); throw new Error(`HTTP ${res.status}`); }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchLatestBounds(
  slurryId: string
): Promise<{ key: 'densite'|'viscosite'|'pc'|'h2o'|'temperature'|'ph'|'silice'|'grains'; low: number|null; high: number|null }[]> {
  const res = await fetch(`${BASE}/rheology/bounds?slurryId=${encodeURIComponent(slurryId)}`, { cache: 'no-store' });
  if (!res.ok) { reportError(`GET /rheology/bounds ${res.status}`); throw new Error(`HTTP ${res.status}`); }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchRheologyAll(
  slurryId: string,
  params: string[] = ['density','viscosity','pH','temperature','pc','H2O'],
  includeBounds = true
): Promise<{ series: Record<string, { t:number; v:number; unit?: string }[]>; bounds?: { key:string; low:number|null; high:number|null }[] }>{
  const q = new URLSearchParams({ slurryId, params: params.join(','), includeBounds: includeBounds ? '1' : '0' });
  const res = await fetch(`${BASE}/rheology/all?${q.toString()}`, { cache: 'no-store' });
  if (!res.ok) { reportError(`GET /rheology/all ${res.status}`); throw new Error(`HTTP ${res.status}`); }
  const data = await res.json();
  return data;
}

export async function fetchRheologyLatestAll(
  slurryIds: string[],
  params: string[] = ['density','viscosity','pH','temperature','pc','H2O']
): Promise<Record<string, Record<string, { t:number; v:number; unit?: string; prevV?: number; prevT?: number }>>> {
  const q = new URLSearchParams({ slurries: slurryIds.join(','), params: params.join(',') });
  const res = await fetch(`${BASE}/rheology/latest-all?${q.toString()}`, { cache: 'no-store' });
  if (!res.ok) { reportError(`GET /rheology/latest-all ${res.status}`); throw new Error(`HTTP ${res.status}`); }
  const data = await res.json();
  return data || {};
}

export async function fetchSlurries(): Promise<Array<{ id: string; last?: number }>> {
  const res = await fetch(`${BASE}/slurries`, { cache: 'no-store' });
  if (!res.ok) { reportError(`GET /slurries ${res.status}`); throw new Error(`HTTP ${res.status}`); }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((x: any) => ({ id: String(x.id), last: x.last != null ? Number(x.last) : undefined }));
}

export async function apiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`, { cache: 'no-store' });
    if (!res.ok) { reportError(`GET /health ${res.status}`); return false; }
    const j = await res.json();
    return !!j?.ok;
  } catch {
    reportError('GET /health network error');
    return false;
  }
}

export async function exportCsv(slurryId: string, start?: number, end?: number): Promise<Blob> {
  const q = new URLSearchParams({ slurryId });
  if (start != null) q.set('start', String(start));
  if (end != null) q.set('end', String(end));
  const res = await fetch(`${BASE}/rheology/export-csv?${q.toString()}`, { cache: 'no-store' });
  if (!res.ok) { reportError(`GET /rheology/export-csv ${res.status}`); throw new Error(`HTTP ${res.status}`); }
  const text = await res.text();
  return new Blob([text], { type: 'text/csv;charset=utf-8' });
}

export async function importCsv(csvText: string, override = false): Promise<{ ok: boolean; inserted?: string[]; updated?: string[]; conflicts?: string[] }> {
  const res = await fetch(`${BASE}/rheology/import-csv?override=${override ? '1' : '0'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/csv' },
    body: csvText,
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 409) { reportError('POST /rheology/import-csv conflict'); return { ok: false, conflicts: data?.conflicts || [] }; }
    reportError(`POST /rheology/import-csv ${res.status}`);
    throw new Error(`HTTP ${res.status}: ${data?.error || 'error'}`);
  }
  return { ok: true, inserted: data?.inserted || [], updated: data?.updated || [] };
}

// -------------------- User preferences --------------------
export async function getUserPrefs(userId: string): Promise<any | null> {
  const q = new URLSearchParams({ userId });
  const res = await fetch(`${BASE}/user-prefs?${q.toString()}`, { cache: 'no-store' });
  if (!res.ok) { reportError(`GET /user-prefs ${res.status}`); return null; }
  const j = await res.json();
  return j?.prefs ?? null;
}

export async function putUserPrefs(userId: string, prefs: any): Promise<boolean> {
  const q = new URLSearchParams({ userId });
  const res = await fetch(`${BASE}/user-prefs?${q.toString()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefs }),
  });
  if (!res.ok) { reportError(`PUT /user-prefs ${res.status}`); }
  return res.ok;
}

// -------------------- Auth (structure for future SQL) --------------------

export type AuthUser = { userId: string; email: string; role: 'admin' | 'user'; passwordHash: string };

// Temporary in-memory source for testing before SQL integration
const TEMP_USER: AuthUser = {
  userId: 'youssef.karim',
  email: 'youssef.karim@safrangroup.com',
  role: 'admin',
  passwordHash: '$argon2id$v=19$m=16,t=2,p=1$eGRORHRoajk3TnhGZ3lnRg$eDzjxcx0pYNtij29XUankg',
};

export async function findUser(identifier: string): Promise<AuthUser | null> {
  const id = identifier.trim().toLowerCase();
  // Future: query SQL `user` table by `user_id` or `user_mail`
  if (id === TEMP_USER.email.toLowerCase() || id === TEMP_USER.userId.toLowerCase()) return TEMP_USER;
  return null;
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    // hash-wasm validates argon2id hash string (PHC format). Salt and params are embedded.
    return await argon2Verify({ password, hash });
  } catch {
    return false;
  }
}

export async function authenticateUser(identifier: string, password: string): Promise<{ ok: boolean; user?: Pick<AuthUser, 'userId'|'email'|'role'> }>
{
  const user = await findUser(identifier);
  if (!user) return { ok: false };
  // Dev fallback: accept 'pfx' for the temp user
  const ok = password === 'pfx' || await verifyPassword(user.passwordHash, password);
  if (!ok) return { ok: false };
  return { ok: true, user: { userId: user.userId, email: user.email, role: user.role } };
}

export async function requestPasswordRecovery(identifier: string): Promise<{ ok: boolean; to?: string; reason?: string; token?: string }>
{
  const user = await findUser(identifier);
  if (!user) return { ok: false, reason: 'User not found' };
  if (!user.email.toLowerCase().endsWith('@safrangroup.com')) return { ok: false, reason: 'Invalid domain' };
  // Future: write token to SQL; email via SMTP service
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessionStorage.setItem('reset_token', token);
  sessionStorage.setItem('reset_user', user.email);
  return { ok: true, to: user.email, token };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<{ ok: boolean; reason?: string }>
{
  const t = sessionStorage.getItem('reset_token');
  const email = sessionStorage.getItem('reset_user');
  if (!t || !email || t !== token) return { ok: false, reason: 'Invalid or expired token' };
  // Future: update SQL with new argon2id hash
  sessionStorage.removeItem('reset_token');
  sessionStorage.removeItem('reset_user');
  return { ok: true };
}


