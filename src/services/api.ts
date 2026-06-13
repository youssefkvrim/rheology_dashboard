// talks to the backend and handles login tokens n stuff

// checks if we're behind a proxy so urls don't break
function getProxyBase(): string {
  const path = window.location.pathname;
  const match = path.match(/^(.*\/proxy\/\d+)/);
  if (match) return match[1];
  return '';
}
const PROXY_BASE = getProxyBase();
// builds the base url for all api calls depending on proxy situation
const BASE = PROXY_BASE ? `${PROXY_BASE}/api` : '/api';
export const ASSET_BASE = PROXY_BASE ? `${PROXY_BASE}/assets` : '/assets';

// --- login token stuff ---

// grabs the token from session storage if u already logged in before
let _token: string | null = sessionStorage.getItem('auth_token');

export function getAuthToken(): string | null { return _token; }

// saves or yeets the token from storage
export function setAuthToken(token: string | null) {
  _token = token;
  if (token) sessionStorage.setItem('auth_token', token);
  else sessionStorage.removeItem('auth_token');
}

// if we have a login token, slap it onto every request so the server knows who we are
function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (_token) h['Authorization'] = `Bearer ${_token}`;
  return h;
}

// --- error reporting ---

// fires a custom event so the rest of the app can catch errors and show em
export function reportError(message: string) {
  try {
    const evt = new CustomEvent('app-error', { detail: { ts: Date.now(), message } });
    window.dispatchEvent(evt);
  } catch { /* nah we don't care if this fails */ }
}

// --- auth endpoints (login, password reset etc) ---

export type AuthUser = { userId: string; email: string; role: 'admin' | 'user' };

// sends ur login info to the server and gets back a token if it works
export async function loginApi(identifier: string, password: string): Promise<{ ok: boolean; token?: string; user?: AuthUser; mustReset?: boolean; reason?: string }> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, reason: data?.error || 'Unknown error' };
  return { ok: true, token: data.token, user: data.user, mustReset: !!data.mustReset };
}

// asks the server to send a password reset email
export async function requestPasswordReset(identifier: string): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(`${BASE}/auth/reset-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, reason: data?.error || 'Unknown error' };
  return { ok: true };
}

// actually changes ur password using the reset token from the email
export async function confirmPasswordReset(token: string, newPassword: string): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(`${BASE}/auth/reset-confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, reason: data?.error || 'Unknown error' };
  return { ok: true };
}

// --- rheology data (the actual slurry measurements from the database) ---

// grabs time-series data for one slurry param (like density, viscosity etc)
export async function fetchRheologySeries(
  slurryId: string,
  parameter: 'density'|'viscosity'|'pc'|'H2O'|'temperature'|'pH'|'silice'|'grain',
  startTs?: number,
  endTs?: number,
  maxPoints?: number
): Promise<{ t:number; v:number; unit?: string }[]> {
  const params = new URLSearchParams({ slurryId, parameter });
  if (startTs != null) params.set('start', String(startTs));
  if (endTs != null) params.set('end', String(endTs));
  if (maxPoints != null) params.set('maxPoints', String(maxPoints));
  const res = await fetch(`${BASE}/rheology?${params.toString()}`, { cache: 'no-store', headers: authHeaders() });
  if (!res.ok) { reportError(`GET /rheology ${res.status}`); throw new Error(`HTTP ${res.status}`); }
  const data = await res.json();
  // server might return weird stuff so we make sure it's actually an array
  return Array.isArray(data) ? data : [];
}

// gets the min/max limits for a slurry (the red lines on the charts basically)
export async function fetchLatestBounds(
  slurryId: string
): Promise<{ key: string; low: number|null; high: number|null }[]> {
  const res = await fetch(`${BASE}/rheology/bounds?slurryId=${encodeURIComponent(slurryId)}`, { cache: 'no-store', headers: authHeaders() });
  if (!res.ok) { reportError(`GET /rheology/bounds ${res.status}`); throw new Error(`HTTP ${res.status}`); }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// fetches ALL params + bounds for a slurry in one shot instead of spamming the server
export async function fetchRheologyAll(
  slurryId: string,
  params: string[] = ['density','viscosity','pH','temperature','pc','H2O'],
  includeBounds = true,
  startTs?: number,
  endTs?: number,
  maxPoints?: number
): Promise<{ series: Record<string, { t:number; v:number; unit?: string }[]>; bounds?: { key:string; low:number|null; high:number|null }[] }> {
  const q = new URLSearchParams({ slurryId, params: params.join(','), includeBounds: includeBounds ? '1' : '0' });
  if (startTs != null) q.set('start', String(startTs));
  if (endTs != null) q.set('end', String(endTs));
  if (maxPoints != null) q.set('maxPoints', String(maxPoints));
  const res = await fetch(`${BASE}/rheology/all?${q.toString()}`, { cache: 'no-store', headers: authHeaders() });
  if (!res.ok) { reportError(`GET /rheology/all ${res.status}`); throw new Error(`HTTP ${res.status}`); }
  return await res.json();
}

// gets the latest reading + previous reading for multiple slurries at once (for the overview cards)
export async function fetchRheologyLatestAll(
  slurryIds: string[],
  params: string[] = ['density','viscosity','pH','temperature','pc','H2O']
): Promise<Record<string, Record<string, { t:number; v:number; unit?: string; prevV?: number; prevT?: number }>>> {
  const q = new URLSearchParams({ slurries: slurryIds.join(','), params: params.join(',') });
  const res = await fetch(`${BASE}/rheology/latest-all?${q.toString()}`, { cache: 'no-store', headers: authHeaders() });
  if (!res.ok) { reportError(`GET /rheology/latest-all ${res.status}`); throw new Error(`HTTP ${res.status}`); }
  return (await res.json()) || {};
}

export type AlertStatus = 'ok' | 'warn' | 'err';
export type LatestAlertMap = Record<string, Record<string, { v: number; unit?: string; status: AlertStatus }>>;

export async function fetchAlertsLatest(slurryIds: string[]): Promise<LatestAlertMap> {
  if (!slurryIds.length) return {};
  const q = new URLSearchParams({ slurries: slurryIds.join(',') });
  const res = await fetch(`${BASE}/alerts/latest?${q.toString()}`, { cache: 'no-store', headers: authHeaders() });
  if (!res.ok) { reportError(`GET /alerts/latest ${res.status}`); throw new Error(`HTTP ${res.status}`); }
  return (await res.json()) || {};
}

// gets the list of all slurries the server knows about
export async function fetchSlurries(): Promise<Array<{ id: string; last?: number }>> {
  const res = await fetch(`${BASE}/slurries`, { cache: 'no-store', headers: authHeaders() });
  if (!res.ok) { reportError(`GET /slurries ${res.status}`); throw new Error(`HTTP ${res.status}`); }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  // makes sure every id is a string and last timestamp is a number (server can be weird sometimes)
  return data.map((x: any) => ({ id: String(x.id), last: x.last != null ? Number(x.last) : undefined }));
}

// quick ping to see if the server is alive
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

// downloads all slurry data as a csv file so u can open it in excel or whatever
export async function exportCsv(slurryId: string, start?: number, end?: number): Promise<Blob> {
  const q = new URLSearchParams({ slurryId });
  if (start != null) q.set('start', String(start));
  if (end != null) q.set('end', String(end));
  const res = await fetch(`${BASE}/rheology/export-csv?${q.toString()}`, { cache: 'no-store', headers: authHeaders() });
  if (!res.ok) { reportError(`GET /rheology/export-csv ${res.status}`); throw new Error(`HTTP ${res.status}`); }
  const text = await res.text();
  // wraps the raw text into a blob so the browser can download it as a file
  return new Blob([text], { type: 'text/csv;charset=utf-8' });
}

// uploads csv data to the server, can override existing data if u want
export async function importCsv(csvText: string, override = false): Promise<{ ok: boolean; inserted?: string[]; updated?: string[]; conflicts?: string[]; insertedCount?: number }> {
  const res = await fetch(`${BASE}/rheology/import-csv?override=${override ? '1' : '0'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/csv', ...authHeaders() },
    body: csvText,
  });
  const data = await res.json();
  if (!res.ok) {
    // 409 means there's already data there and u didn't say to override it
    if (res.status === 409) { reportError('POST /rheology/import-csv conflict'); return { ok: false, conflicts: data?.conflicts || [] }; }
    reportError(`POST /rheology/import-csv ${res.status}`);
    throw new Error(`HTTP ${res.status}: ${data?.error || 'error'}`);
  }
  return { ok: true, inserted: data?.inserted || [], updated: data?.updated || [], insertedCount: data?.insertedCount };
}

// --- user preferences (theme, language, whatever they saved) ---

// grabs saved prefs for a user from the server
export async function getUserPrefs(): Promise<any | null> {
  const res = await fetch(`${BASE}/user-prefs`, { cache: 'no-store', headers: authHeaders() });
  if (!res.ok) { reportError(`GET /user-prefs ${res.status}`); return null; }
  const j = await res.json();
  return j?.prefs ?? null;
}

// saves user prefs to the server so they persist across sessions
export async function putUserPrefs(prefs: any): Promise<boolean> {
  const res = await fetch(`${BASE}/user-prefs`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ prefs }),
  });
  if (!res.ok) { reportError(`PUT /user-prefs ${res.status}`); }
  return res.ok;
}
