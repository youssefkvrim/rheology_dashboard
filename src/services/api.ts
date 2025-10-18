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

// -------------------- Auth & Users (demo-local placeholders) --------------------

type UserRecord = { email: string; username: string; password: string; role: 'admin' | 'user' };

function readJson<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function writeJson<T>(key: string, value: T): void { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } }

function ensureDemoAdmin(): void {
  const users = readJson<Record<string, UserRecord>>('auth_users', {});
  if (!users['admin@safrangroup.com']) {
    users['admin@safrangroup.com'] = { email: 'admin@safrangroup.com', username: 'admin', password: 'demo123!', role: 'admin' };
    writeJson('auth_users', users);
  }
}

export async function authenticate(email: string, password: string): Promise<{ ok: boolean; user?: UserRecord }> {
  ensureDemoAdmin();
  const users = readJson<Record<string, UserRecord>>('auth_users', {});
  const rec = users[email.toLowerCase()];
  if (!rec) return { ok: false };
  if (rec.password !== password) return { ok: false };
  return { ok: true, user: rec };
}

export async function requestPasswordReset(email: string): Promise<{ ok: boolean; token?: string; to?: string; reason?: string }> {
  const lower = email.trim().toLowerCase();
  if (!lower.endsWith('@safrangroup.com')) return { ok: false, reason: 'Invalid domain' };
  ensureDemoAdmin();
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const tokens = readJson<Record<string, string>>('auth_reset_tokens', {});
  tokens[token] = lower;
  writeJson('auth_reset_tokens', tokens);
  const to = lower || 'youssef.karim@safrangroup.com';
  return { ok: true, token, to };
}

export async function setPasswordWithToken(token: string, newPassword: string): Promise<{ ok: boolean; email?: string; reason?: string }> {
  const resetTokens = readJson<Record<string, string>>('auth_reset_tokens', {});
  const inviteTokens = readJson<Record<string, string>>('auth_invite_tokens', {});
  const email = resetTokens[token] || inviteTokens[token];
  if (!email) return { ok: false, reason: 'Invalid or expired token' };
  const users = readJson<Record<string, UserRecord>>('auth_users', {});
  const username = email.split('@')[0];
  const role = users[email]?.role || 'user';
  users[email] = { email, username, password: newPassword, role };
  writeJson('auth_users', users);
  delete resetTokens[token];
  delete inviteTokens[token];
  writeJson('auth_reset_tokens', resetTokens);
  writeJson('auth_invite_tokens', inviteTokens);
  return { ok: true, email };
}

export async function inviteUser(email: string): Promise<{ ok: boolean; token?: string; to?: string; username?: string; reason?: string }> {
  const lower = email.trim().toLowerCase();
  if (!lower.endsWith('@safrangroup.com')) return { ok: false, reason: 'Invalid domain' };
  ensureDemoAdmin();
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const tokens = readJson<Record<string, string>>('auth_invite_tokens', {});
  tokens[token] = lower;
  writeJson('auth_invite_tokens', tokens);
  const users = readJson<Record<string, UserRecord>>('auth_users', {});
  const username = lower.split('@')[0];
  if (!users[lower]) {
    users[lower] = { email: lower, username, password: '', role: 'user' };
    writeJson('auth_users', users);
  }
  return { ok: true, token, to: lower || 'youssef.karim@safrangroup.com', username };
}



