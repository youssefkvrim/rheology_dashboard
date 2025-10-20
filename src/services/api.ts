// Placeholder API client functions for future SQL-backed endpoints
// These functions currently throw to make accidental usage explicit.
// Replace with real fetch calls when the backend is available.

import type { MetricKey, MetricSample, MetricsSeries } from '../types/domain';
import { argon2Verify } from 'hash-wasm';

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
  const ok = await verifyPassword(user.passwordHash, password);
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


