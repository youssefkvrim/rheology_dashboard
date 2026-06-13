// the backend brain - talks to SQL Server and handles all the data stuff
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const sql = require('mssql');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { lttb } = require('./lib/lttb.cjs');
// pure-JS password hashing via Node built-in scrypt (no native deps)
const { scrypt, randomBytes, timingSafeEqual } = crypto;
const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = { N: 16384, r: 8, p: 1, maxmem: 128 * 16384 * 8 * 2 };
function scryptHash(password) {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString('hex');
    scrypt(password, salt, SCRYPT_KEYLEN, SCRYPT_COST, (err, dk) => {
      if (err) return reject(err);
      resolve(`scrypt:${salt}:${dk.toString('hex')}`);
    });
  });
}
function scryptVerify(stored, password) {
  return new Promise((resolve, reject) => {
    const [, salt, hash] = stored.split(':');
    if (!salt || !hash) return resolve(false);
    scrypt(password, salt, SCRYPT_KEYLEN, SCRYPT_COST, (err, dk) => {
      if (err) return reject(err);
      resolve(timingSafeEqual(Buffer.from(hash, 'hex'), dk));
    });
  });
}
const { z } = require('zod');

// grabs secret keys from a hidden vault file that git doesn't know about
dotenv.config({ path: path.resolve(process.cwd(), 'vault/secrets.env') });

const app = express();
// lets any frontend talk to us and caps how much data u can send
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.text({ type: ['text/*', 'application/csv', 'text/csv'], limit: '10mb' }));

const PORT = Number(process.env.BACKEND_PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION';
const JWT_EXPIRY = '8h';
const LEGACY_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+\d{2}(?::?\d{2})?$/;
let HAS_COMPUTED_COLS = false;

function tsExpr() {
  return HAS_COMPUTED_COLS ? '[ts_dto]' : "TRY_CONVERT(datetimeoffset, REPLACE([timestamp],' ','T'))";
}

function paramExpr() {
  return HAS_COMPUTED_COLS ? '[param_norm]' : 'UPPER(LTRIM(RTRIM([parameter])))';
}

// ──────────── helpful lil utility functions ────────────

// takes messy parameter names from the DB and makes them consistent
function toNormKey(raw) {
  const u = String(raw || '').trim().toUpperCase();
  if (u === 'PH') return 'pH';
  if (u === 'H2O') return 'H2O';
  if (u === 'PC') return 'pc';
  if (u === 'DENSITY') return 'density';
  if (u === 'VISCOSITY') return 'viscosity';
  if (u === 'TEMPERATURE') return 'temperature';
  if (u === 'SILICE') return 'silice';
  if (u === 'GRAIN' || u === 'GRAINS') return 'grain';
  return String(raw || '').trim();
}

// flips DB keys into the french names the frontend expects
function toFrontendKey(dbKey) {
  const map = { density: 'densite', viscosity: 'viscosite', pH: 'ph', temperature: 'temperature', pc: 'pc', H2O: 'h2o', silice: 'silice', grain: 'grains' };
  return map[dbKey] || String(dbKey).toLowerCase();
}

// turns any timestamp format into milliseconds so we can compare them easily
function toMs(ts) {
  try {
    if (!ts) return NaN;
    if (ts instanceof Date && !isNaN(ts.getTime())) return Number(ts.getTime());
    let s = String(ts).trim();
    if (!s) return NaN;
    if (s.indexOf(' ') !== -1) s = s.replace(' ', 'T');
    // these regexes fix weird timezone formats so Date.parse doesn't freak out
    const m = s.match(/([+-])(\d{2})(?!:)(?!\d)/);
    if (m) s = s + ':00';
    const m2 = s.match(/([+-])(\d{2})(\d{2})$/);
    if (m2) s = s.replace(/([+-])(\d{2})(\d{2})$/, `${m2[1]}${m2[2]}:${m2[3]}`);
    const ms = Date.parse(s);
    return Number.isFinite(ms) ? ms : NaN;
  } catch {
    return NaN;
  }
}

// formats a Date to the legacy local-time format: YYYY-MM-DDTHH:MM:SS+ZZ (Europe/Paris)
function toLegacyTs(d) {
  const p = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d).reduce((a, x) => (a[x.type] = x.value, a), {});
  const utc = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
  const paris = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const off = Math.round((paris - utc) / 3600000);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+${String(off).padStart(2, '0')}`;
}

function warnSkippedTimestamps(n) {
  if (n > 0) console.warn('[rheology] skipped %d rows with unparseable timestamps', n);
}

function parseMaxPoints(raw) {
  const n = Number(raw || 2000);
  if (!Number.isFinite(n) || n <= 0) return 2000;
  return Math.min(10000, Math.floor(n));
}

function parseEpoch(raw) {
  const n = Number(raw || 0);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function downsampleSeries(points, maxPoints) {
  return points.length > maxPoints ? lttb(points, maxPoints) : points;
}

// rips apart a CSV line properly - handles quotes and commas inside fields and all that mess
function parseCsvLine(line) {
  const fields = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) { fields.push(''); break; }
    if (line[i] === '"') {
      // quoted field - gotta handle escaped quotes (double "") inside
      let j = i + 1;
      let val = '';
      while (j < line.length) {
        if (line[j] === '"') {
          if (j + 1 < line.length && line[j + 1] === '"') { val += '"'; j += 2; }
          else { j++; break; }
        } else { val += line[j]; j++; }
      }
      fields.push(val);
      if (j < line.length && line[j] === ',') j++;
      i = j;
    } else {
      const next = line.indexOf(',', i);
      if (next === -1) { fields.push(line.slice(i)); break; }
      fields.push(line.slice(i, next));
      i = next + 1;
    }
  }
  return fields;
}

// ──────────── database connection w/ circuit breaker ────────────

const poolConfig = {
  server: process.env.MSSQL_SERVER,
  database: process.env.MSSQL_DATABASE,
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  port: Number(process.env.MSSQL_PORT || 1433),
  options: {
    encrypt: String(process.env.MSSQL_ENCRYPT || 'true') === 'true',
    trustServerCertificate: String(process.env.MSSQL_TRUST_CERT || 'true') === 'true',
    instanceName: process.env.MSSQL_INSTANCE,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  connectionTimeout: 15000,
  requestTimeout: 30000,
};

let poolPromise;
let poolRetryCount = 0;
let poolLastFailure = 0;
const POOL_MAX_RETRIES = 5;
const POOL_CIRCUIT_OPEN_MS = 60000; // chill for 60s before trying the DB again

function isDbCircuitOpen() {
  return poolRetryCount >= POOL_MAX_RETRIES && (Date.now() - poolLastFailure) < POOL_CIRCUIT_OPEN_MS;
}

function getPool() {
  // circuit breaker - if the DB keeps failing we stop hammering it for a bit
  if (poolRetryCount >= POOL_MAX_RETRIES) {
    const elapsed = Date.now() - poolLastFailure;
    if (elapsed < POOL_CIRCUIT_OPEN_MS) {
      return Promise.reject(new Error(`Circuit breaker open: DB unavailable (retry in ${Math.ceil((POOL_CIRCUIT_OPEN_MS - elapsed) / 1000)}s)`));
    }
    // cooldown's over, let's try again
    poolRetryCount = 0;
  }

  if (!poolPromise) {
    // waits longer between each retry so we don't spam the DB (2s, 4s, 8s...)
    const delay = poolRetryCount > 0 ? Math.min(Math.pow(2, poolRetryCount) * 1000, 32000) : 0;
    const attempt = () => sql.connect(poolConfig).then(pool => {
      poolRetryCount = 0; // we're in, reset the fail counter
      return pool;
    }).catch((err) => {
      poolPromise = undefined;
      poolRetryCount++;
      poolLastFailure = Date.now();
      throw err;
    });
    poolPromise = delay > 0 ? new Promise(resolve => setTimeout(resolve, delay)).then(attempt) : attempt();
  }
  return poolPromise;
}

async function probeComputedColumns() {
  try {
    const pool = await getPool();
    const { recordset } = await pool.request().query(`
      SELECT
        COL_LENGTH('rheology','ts_dto') AS ts_col,
        COL_LENGTH('rheology','param_norm') AS param_col
    `);
    HAS_COMPUTED_COLS = recordset[0]?.ts_col != null && recordset[0]?.param_col != null;
  } catch (e) {
    HAS_COMPUTED_COLS = false;
    console.warn('[perf] computed columns probe failed: %s', e?.message || 'error');
  }
  console.log(`[perf] computed columns: ${HAS_COMPUTED_COLS ? 'present' : 'absent'}`);
}

// ──────────── user accounts ────────────

// keeps track of password reset links so ppl can change their password
const resetTokens = new Map();

// finds a user by their username or email, not case sensitive
async function findUser(identifier) {
  const id = identifier.trim().toLowerCase();
  const pool = await getPool();
  const { recordset } = await pool.request()
    .input('id', sql.NVarChar(256), id)
    .query(`
      SELECT TOP 1 user_id, email, role, pwd_hash, must_reset
      FROM app_users
      WHERE LOWER(user_id)=@id OR LOWER(email)=@id
    `);
  const row = recordset[0];
  if (!row) return null;
  return {
    userId: row.user_id,
    email: row.email,
    role: row.role,
    hash: row.pwd_hash,
    mustReset: !!row.must_reset,
  };
}

// ──────────── input validation schemas ────────────

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

const rheologyPointSchema = z.object({
  id_slurry: z.string().min(1),
  parameter: z.string().min(1),
  id_rheology: z.string().optional(),
  timestamp: z.string().or(z.number()).optional(),
  slurry_type: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  value: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  usl: z.number().nullable().optional(),
  lsl: z.number().nullable().optional(),
});

const querySlurryId = z.object({
  slurryId: z.string().min(1),
});

// middleware that checks if the request data is valid before it hits the route
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body || req.query);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.flatten().fieldErrors });
    }
    req.validated = result.data;
    next();
  };
}

// ──────────── login token checker ────────────

// checks if u have a valid login token before letting u do stuff
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { userId: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ──────────── auth endpoints (login, reset password, etc) ────────────

// login - checks ur password against the hash and gives u a token if it's right
app.post('/api/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'identifier and password required' });
  const { identifier, password } = parsed.data;
  let user;
  try {
    user = await findUser(identifier);
  } catch (e) {
    console.warn('[auth] login unavailable: %s', e?.message || 'error');
    return res.status(503).json({ error: 'auth unavailable' });
  }
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  try {
    const valid = await scryptVerify(user.hash, password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  } catch {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (user.mustReset) {
    return res.json({ ok: true, mustReset: true, user: { userId: user.userId, email: user.email, role: user.role } });
  }
  // password checks out - make a token that expires in 8 hours
  const token = jwt.sign({ sub: user.userId, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  res.json({ ok: true, token, user: { userId: user.userId, email: user.email, role: user.role } });
});

// step 1 of password reset - makes a one-time link that expires in 15 min
app.post('/api/auth/reset-request', async (req, res) => {
  const identifier = String(req.body?.identifier || '').trim();
  const token = crypto.randomUUID();
  let user = null;
  try {
    user = identifier ? await findUser(identifier) : null;
  } catch (e) {
    console.warn('[auth] reset lookup failed: %s', e?.message || 'error');
  }
  if (user) {
    resetTokens.set(token, { userId: user.userId, email: user.email, expiresAt: Date.now() + 15 * 60 * 1000 });
    console.log('[auth] password reset token for %s: %s (valid 15min)', user.userId, token);
  }
  res.json({ ok: true });
});

// step 2 of password reset - actually changes ur password if the token is still valid
app.post('/api/auth/reset-confirm', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) return res.status(400).json({ error: 'token and newPassword required' });
  const entry = resetTokens.get(token);
  if (!entry) return res.status(400).json({ error: 'Invalid or expired token' });
  if (Date.now() > entry.expiresAt) {
    resetTokens.delete(token);
    return res.status(400).json({ error: 'Token expired' });
  }
  const hash = await scryptHash(newPassword);
  try {
    const pool = await getPool();
    const { rowsAffected } = await pool.request()
      .input('user_id', sql.NVarChar(64), entry.userId)
      .input('pwd_hash', sql.NVarChar(512), hash)
      .query(`
        UPDATE app_users
        SET pwd_hash=@pwd_hash, must_reset=0, updated_at=SYSDATETIMEOFFSET()
        WHERE user_id=@user_id
      `);
    if (!rowsAffected[0]) return res.status(400).json({ error: 'User not found' });
  } catch (e) {
    console.warn('[auth] reset-confirm unavailable: %s', e?.message || 'error');
    return res.status(503).json({ error: 'auth unavailable' });
  }
  resetTokens.delete(token);
  res.json({ ok: true });
});

// ──────────── read endpoints (anyone can hit these) ────────────

// quick health check - just pings the DB to see if it's alive
app.get('/api/health', async (_req, res) => {
  if (isDbCircuitOpen()) return res.json({ ok: false, circuit: 'open' });
  try {
    await getPool();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'error' });
  }
});

// gets all the slurry IDs with their last measurement timestamp
app.get('/api/slurries', async (_req, res) => {
  try {
    const pool = await getPool();
    const { recordset: rows } = await pool.request().query(
      `SELECT [id_slurry], MAX(${tsExpr()}) as ts
       FROM [rheology]
       GROUP BY [id_slurry]
       ORDER BY [id_slurry]`
    );
    let skipped = 0;
    const out = [];
    for (const r of rows) {
      const ms = toMs(r.ts);
      const item = { id: String(r.id_slurry) };
      if (Number.isFinite(ms)) item.last = ms;
      else skipped++;
      out.push(item);
    }
    warnSkippedTimestamps(skipped);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

// gets the latest + previous value for multiple slurries at once (for the dashboard cards)
app.get('/api/rheology/latest-all', async (req, res) => {
  try {
    const slurriesCsv = String(req.query.slurries || '');
    const paramsCsv = String(req.query.params || 'density,viscosity,pH,temperature,pc,H2O');
    const slurries = slurriesCsv.split(',').map(s => s.trim()).filter(Boolean);
    const params = paramsCsv.split(',').map(s => s.trim()).filter(Boolean);
    if (!slurries.length || !params.length) return res.json({});
    const normParams = params.map(p => p.trim().toUpperCase());
    const pool = await getPool();
    // builds safe SQL placeholders so we don't get sql-injected lol
    const slurryPlaceholders = slurries.map((_, i) => `@s${i}`).join(',');
    const paramPlaceholders = normParams.map((_, i) => `@p${i}`).join(',');
    const q = `
      WITH ranked AS (
        SELECT [id_slurry], [parameter], [timestamp], [value], [unit],
               ROW_NUMBER() OVER (
                 PARTITION BY [id_slurry], ${paramExpr()}
                 ORDER BY ${tsExpr()} DESC
               ) AS rn
        FROM [rheology]
        WHERE [id_slurry] IN (${slurryPlaceholders})
          AND ${paramExpr()} IN (${paramPlaceholders})
      )
      SELECT [id_slurry], [parameter], [timestamp], [value], [unit], rn
      FROM ranked
      WHERE rn <= 2
      ORDER BY [id_slurry], [parameter], rn`;
    const request = pool.request();
    slurries.forEach((v, i) => request.input(`s${i}`, sql.VarChar(64), v));
    normParams.forEach((v, i) => request.input(`p${i}`, sql.VarChar(32), v));
    const { recordset: rows } = await request.query(q);
    const out = {};
    let skipped = 0;
    for (const r of rows) {
      const sid = String(r.id_slurry);
      const p = toNormKey(r.parameter);
      const ms = toMs(r.timestamp);
      if (!Number.isFinite(ms)) { skipped++; continue; }
      out[sid] = out[sid] || {};
      if (Number(r.rn) === 1 || !out[sid][p]) {
        out[sid][p] = { t: ms, v: Number(r.value), unit: r.unit || undefined };
      } else if (Number(r.rn) === 2 && out[sid][p] && out[sid][p].prevV == null) {
        out[sid][p].prevV = Number(r.value);
        out[sid][p].prevT = ms;
      }
    }
    warnSkippedTimestamps(skipped);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

// gets the full history of measurements for one slurry (for charts basically)
app.get('/api/rheology/all', async (req, res) => {
  try {
    const slurryId = String(req.query.slurryId || '');
    const paramsCsv = String(req.query.params || 'density,viscosity,pH,temperature,pc,H2O');
    const params = paramsCsv.split(',').map(s => s.trim()).filter(Boolean);
    const includeBounds = String(req.query.includeBounds || '') === '1';
    const start = parseEpoch(req.query.start);
    const end = parseEpoch(req.query.end);
    const maxPoints = parseMaxPoints(req.query.maxPoints);
    if (!slurryId || !params.length) return res.json({});
    const normParams = params.map(p => p.trim().toUpperCase());
    const pool = await getPool();
    const placeholders = normParams.map((_, i) => `@p${i}`).join(',');
    let whereTime = '';
    if (start != null) whereTime += ` AND ${tsExpr()} >= @start`;
    if (end != null) whereTime += ` AND ${tsExpr()} <= @end`;
    const q = `
      SELECT [timestamp], [value], [unit], [parameter]
      FROM [rheology]
      WHERE [id_slurry]=@slurryId AND ${paramExpr()} IN (${placeholders})${whereTime}
      ORDER BY ${tsExpr()} ASC`;
    const request = pool.request();
    request.input('slurryId', sql.VarChar(64), slurryId);
    if (start != null) request.input('start', sql.DateTimeOffset, new Date(start));
    if (end != null) request.input('end', sql.DateTimeOffset, new Date(end));
    normParams.forEach((v, i) => request.input(`p${i}`, sql.VarChar(32), v));
    const { recordset: rows } = await request.query(q);
    const map = {};
    let skipped = 0;
    for (const r of rows) {
      const key = toNormKey(r.parameter);
      const ms = toMs(r.timestamp);
      if (!Number.isFinite(ms)) { skipped++; continue; }
      if (!map[key]) map[key] = [];
      map[key].push({ t: ms, v: Number(r.value), unit: r.unit || undefined });
    }
    for (const key of Object.keys(map)) {
      map[key] = downsampleSeries(map[key], maxPoints);
    }
    warnSkippedTimestamps(skipped);
    if (includeBounds) {
      // grabs the most recent upper/lower limits for each parameter
      const rq = pool.request();
      rq.input('slurryId', sql.VarChar(64), slurryId);
      const { recordset: brows } = await rq.query(
        `WITH ranked AS (
           SELECT [parameter], [usl], [lsl], [timestamp],
                  ROW_NUMBER() OVER (PARTITION BY ${paramExpr()} ORDER BY ${tsExpr()} DESC) as rn
           FROM [rheology] WHERE [id_slurry]=@slurryId AND ([usl] IS NOT NULL OR [lsl] IS NOT NULL)
         )
         SELECT [parameter], [usl], [lsl] FROM ranked WHERE rn=1`
      );
      const bounds = brows.map(r => ({ key: r.parameter, low: r.lsl ?? null, high: r.usl ?? null }));
      return res.json({ series: map, bounds });
    }
    res.json({ series: map });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

// just gets the upper/lower limits for a slurry's params
app.get('/api/rheology/bounds', async (req, res) => {
  try {
    const slurryId = String(req.query.slurryId || '');
    if (!slurryId) return res.json([]);
    const pool = await getPool();
    const rq = pool.request();
    rq.input('slurryId', sql.VarChar(64), slurryId);
    // uses a window function to grab only the latest bounds per parameter
    const { recordset: rows } = await rq.query(
      `WITH ranked AS (
         SELECT [parameter], [usl], [lsl], [timestamp],
                ROW_NUMBER() OVER (PARTITION BY ${paramExpr()} ORDER BY ${tsExpr()} DESC) as rn
         FROM [rheology] WHERE [id_slurry]=@slurryId AND ([usl] IS NOT NULL OR [lsl] IS NOT NULL)
       )
       SELECT [parameter], [usl], [lsl] FROM ranked WHERE rn=1`
    );
    const out = rows.map(r => ({ key: toFrontendKey(r.parameter), low: r.lsl ?? null, high: r.usl ?? null }));
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

// gets measurement history for one specific slurry + parameter combo
app.get('/api/rheology', async (req, res) => {
  try {
    const slurryId = String(req.query.slurryId || '');
    const parameter = String(req.query.parameter || '');
    const start = parseEpoch(req.query.start);
    const end = parseEpoch(req.query.end);
    const maxPoints = parseMaxPoints(req.query.maxPoints);
    if (!slurryId || !parameter) return res.json([]);
    const pool = await getPool();
    const rq = pool.request();
    rq.input('slurryId', sql.VarChar(64), slurryId);
    rq.input('parameter', sql.VarChar(32), parameter.trim().toUpperCase());
    let whereTime = '';
    if (start != null) { rq.input('start', sql.DateTimeOffset, new Date(start)); whereTime += ` AND ${tsExpr()} >= @start`; }
    if (end != null) { rq.input('end', sql.DateTimeOffset, new Date(end)); whereTime += ` AND ${tsExpr()} <= @end`; }
    const { recordset: rows } = await rq.query(
      `SELECT [timestamp], [value], [unit]
       FROM [rheology]
       WHERE [id_slurry]=@slurryId AND ${paramExpr()}=@parameter${whereTime}
       ORDER BY ${tsExpr()} ASC`
    );
    let skipped = 0;
    const out = [];
    for (const r of rows) {
      const ms = toMs(r.timestamp);
      if (!Number.isFinite(ms)) { skipped++; continue; }
      out.push({ t: ms, v: Number(r.value), unit: r.unit || undefined });
    }
    warnSkippedTimestamps(skipped);
    res.json(downsampleSeries(out, maxPoints));
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

// figures out which slurries have values outside their safe range (alerts!)
app.get('/api/alerts/latest', async (req, res) => {
  try {
    const slurriesCsv = String(req.query.slurries || req.query.slurryId || '').trim();
    const slurries = slurriesCsv.split(',').map(s => s.trim()).filter(Boolean);
    if (!slurries.length) return res.json({});
    const pool = await getPool();
    const slurryPlaceholders = slurries.map((_, i) => `@s${i}`).join(',');
    const rq = pool.request();
    slurries.forEach((v, i) => rq.input(`s${i}`, sql.VarChar(64), v));
    // grabs the most recent value for each slurry + parameter
    const { recordset: latestRows } = await rq.query(`
      WITH cte AS (
        SELECT [id_slurry],[parameter],[timestamp],[value],[unit],
               ROW_NUMBER() OVER (PARTITION BY [id_slurry],${paramExpr()} ORDER BY ${tsExpr()} DESC) AS rn
        FROM [rheology]
        WHERE [id_slurry] IN (${slurryPlaceholders})
      )
      SELECT [id_slurry],[parameter],[timestamp],[value],[unit]
      FROM cte WHERE rn = 1
    `);
    const rq2 = pool.request();
    slurries.forEach((v, i) => rq2.input(`s${i}`, sql.VarChar(64), v));
    // grabs the latest upper/lower bounds too
    const { recordset: boundRows } = await rq2.query(`
      WITH b AS (
        SELECT [id_slurry],[parameter],[usl],[lsl],
               ROW_NUMBER() OVER (PARTITION BY [id_slurry],${paramExpr()} ORDER BY ${tsExpr()} DESC) AS rn
        FROM [rheology]
        WHERE [id_slurry] IN (${slurryPlaceholders})
      )
      SELECT [id_slurry],[parameter],[usl],[lsl]
      FROM b WHERE rn = 1
    `);
    const boundsMap = new Map();
    for (const r of boundRows) {
      const sid = String(r.id_slurry);
      const p = toNormKey(r.parameter);
      boundsMap.set(`${sid}|${p}`, { low: r.lsl ?? null, high: r.usl ?? null });
    }
    const out = {};
    for (const r of latestRows) {
      const sid = String(r.id_slurry);
      const p = toNormKey(r.parameter);
      const val = Number(r.value);
      const b = boundsMap.get(`${sid}|${p}`) || { low: null, high: null };
      let status = 'ok';
      // out of bounds = error, within 15% of the edge = warning
      if (b.low != null && val < b.low) status = 'err';
      if (b.high != null && val > b.high) status = 'err';
      if (b.low != null && b.high != null && status === 'ok') {
        const span = (b.high - b.low);
        if (span > 0) {
          const edge = span * 0.15;
          if (val <= (b.low + edge) || val >= (b.high - edge)) status = 'warn';
        }
      }
      out[sid] = out[sid] || {};
      out[sid][p] = { v: val, unit: r.unit || undefined, status };
    }
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

// ──────────── user preferences (saved per user) ────────────

// makes the prefs table if it doesn't exist yet - runs every time just in case
async function ensureUserPrefsTable() {
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_prefs' AND xtype='U')
    CREATE TABLE [user_prefs] (
      [user_id] NVARCHAR(128) NOT NULL PRIMARY KEY,
      [data] NVARCHAR(MAX) NULL,
      [updated_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
    );
  `);
}

// gets a user's saved preferences (like theme, language, etc)
app.get('/api/user-prefs', async (req, res) => {
  try {
    const userId = String(req.query.userId || req.headers['x-user-id'] || '').trim();
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const pool = await getPool();
    const rq = pool.request();
    rq.input('u', sql.NVarChar(128), userId);
    const { recordset: rows } = await rq.query(`SELECT [data] FROM [user_prefs] WHERE [user_id]=@u`);
    const data = rows[0]?.data || null;
    try {
      return res.json({ ok: true, prefs: data ? JSON.parse(data) : null });
    } catch {
      return res.json({ ok: true, prefs: null });
    }
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

// saves user prefs - uses MERGE so it creates or updates in one shot
app.put('/api/user-prefs', requireAuth, async (req, res) => {
  try {
    const userId = String(req.query.userId || req.headers['x-user-id'] || '').trim();
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const prefs = req.body?.prefs ?? null;
    const pool = await getPool();
    const rq = pool.request();
    rq.input('u', sql.NVarChar(128), userId);
    rq.input('d', sql.NVarChar(sql.MAX), JSON.stringify(prefs ?? null));
    // upsert - if the row exists update it, if not create it
    await rq.query(`
      MERGE [user_prefs] AS t
      USING (SELECT @u AS user_id, @d AS data) AS s
      ON (t.user_id = s.user_id)
      WHEN MATCHED THEN UPDATE SET t.data = s.data, t.updated_at = SYSDATETIMEOFFSET()
      WHEN NOT MATCHED THEN INSERT (user_id, data) VALUES (s.user_id, s.data);`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

// ──────────── write endpoints (u gotta be logged in for these) ────────────

// adds or updates a single data point - checks if it already exists first
app.post('/api/rheology/point', requireAuth, async (req, res) => {
  const parsed = rheologyPointSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
  try {
    const b = parsed.data;
    const id_slurry = b.id_slurry.trim();
    const parameter = b.parameter.trim().toUpperCase();
    const tsMs = b.timestamp != null ? toMs(b.timestamp) : Date.now();
    if (!Number.isFinite(tsMs)) return res.status(400).json({ error: 'Invalid timestamp' });
    const ts = toLegacyTs(new Date(tsMs));
    // builds a unique ID if one wasn't provided
    const id_rheology = b.id_rheology || `${id_slurry}|${parameter}|${ts}`;
    const slurry_type = b.slurry_type ?? null;
    const source = b.source ?? null;
    const value = b.value ?? null;
    const unit = b.unit ?? null;
    const usl = b.usl ?? null;
    const lsl = b.lsl ?? null;
    const pool = await getPool();
    // check if this data point already exists
    const exRq = pool.request();
    exRq.input('id', sql.VarChar(128), id_rheology);
    const { recordset: ex } = await exRq.query(`SELECT 1 as x FROM [rheology] WHERE [id_rheology]=@id`);
    const rq = pool.request();
    rq.input('id', sql.VarChar(128), id_rheology);
    rq.input('slurry', sql.VarChar(64), id_slurry);
    rq.input('stype', sql.VarChar(32), slurry_type);
    rq.input('ts', sql.VarChar(32), ts);
    rq.input('src', sql.VarChar(128), source);
    rq.input('param', sql.VarChar(32), parameter);
    rq.input('val', sql.Float, value);
    rq.input('unit', sql.VarChar(16), unit);
    rq.input('usl', sql.Float, usl);
    rq.input('lsl', sql.Float, lsl);
    if (ex.length) {
      // already exists so we update it
      await rq.query(`
        UPDATE [rheology]
        SET [id_slurry]=@slurry, [slurry_type]=@stype, [timestamp]=@ts, [source]=@src,
            [parameter]=@param, [value]=@val, [unit]=@unit, [usl]=@usl, [lsl]=@lsl
        WHERE [id_rheology]=@id`);
      return res.json({ ok: true, updated: id_rheology });
    } else {
      // new point, insert it
      await rq.query(`
        INSERT INTO [rheology] ([id_rheology],[id_slurry],[slurry_type],[timestamp],[source],[parameter],[value],[unit],[usl],[lsl])
        VALUES (@id,@slurry,@stype,@ts,@src,@param,@val,@unit,@usl,@lsl)`);
      return res.json({ ok: true, inserted: id_rheology });
    }
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

// ──────────── csv export & import ────────────

// dumps all data for a slurry as a downloadable CSV file
app.get('/api/rheology/export-csv', async (req, res) => {
  try {
    const slurryId = String(req.query.slurryId || '').trim();
    if (!slurryId) return res.status(400).json({ error: 'slurryId required' });
    const start = Number(req.query.start || 0);
    const end = Number(req.query.end || 0);
    const pool = await getPool();
    const rq = pool.request();
    rq.input('slurryId', sql.VarChar(64), slurryId);
    // optionally filter by time range if start/end are given
    let whereTime = '';
    if (Number.isFinite(start) && start > 0) { rq.input('start', sql.DateTimeOffset, new Date(start)); whereTime += ` AND ${tsExpr()} >= @start`; }
    if (Number.isFinite(end) && end > 0) { rq.input('end', sql.DateTimeOffset, new Date(end)); whereTime += ` AND ${tsExpr()} <= @end`; }
    const q = `
      SELECT [id_rheology], [id_slurry], [slurry_type], [timestamp], [source], [parameter], [value], [unit], [usl], [lsl]
      FROM [rheology]
      WHERE [id_slurry]=@slurryId${whereTime}
      ORDER BY ${tsExpr()} ASC`;
    const { recordset: rows } = await rq.query(q);
    const hdr = 'id_rheology,id_slurry,slurry_type,timestamp,source,parameter,value,unit,usl,lsl';

    // wraps values in quotes if they contain commas or quotes (csv spec stuff)
    function csvEscape(val) {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }

    const csv = [hdr].concat(rows.map(r => {
      const ms = toMs(r.timestamp);
      const timestamp = Number.isFinite(ms) ? toLegacyTs(new Date(ms)) : String(r.timestamp || '');
      const id = r.id_rheology != null ? String(r.id_rheology) : `${r.id_slurry}|${r.parameter}|${timestamp}`;
      return [id, r.id_slurry, r.slurry_type || '', timestamp, r.source || '',
        r.parameter || '', r.value != null ? Number(r.value) : '', r.unit || '',
        r.usl != null ? Number(r.usl) : '', r.lsl != null ? Number(r.lsl) : ''].map(csvEscape).join(',');
    })).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${slurryId}_export.csv"`);
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

// takes a csv file apart line by line and shoves it into the database
app.post('/api/rheology/import-csv', requireAuth, async (req, res) => {
  try {
    const override = String(req.query.override || '0') === '1';
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    const body = (typeof req.body === 'string') ? req.body : (contentType.includes('json') ? String(req.body?.csv || '') : '');
    if (!body || typeof body !== 'string') return res.status(400).json({ error: 'CSV body required as text' });
    const lines = body.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!lines.length) return res.status(400).json({ error: 'Empty CSV' });

    // makes sure the csv header matches what we expect
    const headerFields = parseCsvLine(lines[0]).map(s => s.toLowerCase().replace(/\s+/g, ''));
    const expected = ['id_rheology','id_slurry','slurry_type','timestamp','source','parameter','value','unit','usl','lsl'];
    if (headerFields.join(',') !== expected.join(',')) return res.status(400).json({ error: 'Invalid header', expected: expected.join(',') });

    // parse every data row from the csv
    const dataRows = [];
    let skipped = 0;
    for (let i = 1; i < lines.length; i++) {
      const parts = parseCsvLine(lines[i]);
      if (parts.length !== 10) continue;
      const row = parts.map(s => s.trim());
      if (!LEGACY_TS_RE.test(row[3])) {
        const ms = toMs(row[3]);
        if (!Number.isFinite(ms)) { skipped++; continue; }
        row[3] = toLegacyTs(new Date(ms));
      }
      dataRows.push(row);
    }
    if (!dataRows.length) return res.status(400).json({ error: 'No valid data rows' });

    const pool = await getPool();
    // wraps everything in a transaction so if something fails it all rolls back
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      // makes a temp table to stage the csv data before merging it
      await new sql.Request(tx).query(`
        CREATE TABLE #csv_import (
          [id_rheology] VARCHAR(128),
          [id_slurry] VARCHAR(64),
          [slurry_type] VARCHAR(32) NULL,
          [timestamp] VARCHAR(32),
          [source] VARCHAR(128) NULL,
          [parameter] VARCHAR(32),
          [value] FLOAT NULL,
          [unit] VARCHAR(16) NULL,
          [usl] FLOAT NULL,
          [lsl] FLOAT NULL
        )`);

      // shoves rows into the temp table in batches of 500 so it doesn't choke
      const BATCH_SIZE = 500;
      for (let b = 0; b < dataRows.length; b += BATCH_SIZE) {
        const batch = dataRows.slice(b, b + BATCH_SIZE);
        const table = new sql.Table('#csv_import');
        table.create = false;
        table.columns.add('id_rheology', sql.VarChar(128));
        table.columns.add('id_slurry', sql.VarChar(64));
        table.columns.add('slurry_type', sql.VarChar(32), { nullable: true });
        table.columns.add('timestamp', sql.VarChar(32));
        table.columns.add('source', sql.VarChar(128), { nullable: true });
        table.columns.add('parameter', sql.VarChar(32));
        table.columns.add('value', sql.Float, { nullable: true });
        table.columns.add('unit', sql.VarChar(16), { nullable: true });
        table.columns.add('usl', sql.Float, { nullable: true });
        table.columns.add('lsl', sql.Float, { nullable: true });
        for (const [id_rh, id_sl, s_type, ts, src, param, val, unt, uslV, lslV] of batch) {
          table.rows.add(
            id_rh, id_sl, s_type || null, ts, src || null,
            param.toUpperCase(), val ? Number(val) : null, unt || null,
            uslV ? Number(uslV) : null, lslV ? Number(lslV) : null
          );
        }
        const bulkReq = new sql.Request(tx);
        await bulkReq.bulk(table);
      }

      if (override) {
        // override mode - updates existing rows and inserts new ones in one go
        const { recordset: mergeResult } = await new sql.Request(tx).query(`
          MERGE [rheology] AS target
          USING #csv_import AS source
          ON target.[id_rheology] = source.[id_rheology]
          WHEN MATCHED THEN
            UPDATE SET
              target.[id_slurry] = source.[id_slurry],
              target.[slurry_type] = source.[slurry_type],
              target.[timestamp] = source.[timestamp],
              target.[source] = source.[source],
              target.[parameter] = source.[parameter],
              target.[value] = source.[value],
              target.[unit] = source.[unit],
              target.[usl] = source.[usl],
              target.[lsl] = source.[lsl]
          WHEN NOT MATCHED THEN
            INSERT ([id_rheology],[id_slurry],[slurry_type],[timestamp],[source],[parameter],[value],[unit],[usl],[lsl])
            VALUES (source.[id_rheology], source.[id_slurry], source.[slurry_type], source.[timestamp],
                    source.[source], source.[parameter], source.[value], source.[unit], source.[usl], source.[lsl])
          OUTPUT $action, inserted.[id_rheology];`);

        const inserted = [];
        const updated = [];
        for (const r of mergeResult) {
          if (r['$action'] === 'INSERT') inserted.push(r.id_rheology);
          else updated.push(r.id_rheology);
        }
        await tx.commit();
        return res.json({ ok: true, inserted, updated, skipped });
      } else {
        // safe mode - only inserts new rows, tells u about duplicates
        const { recordset: existing } = await new sql.Request(tx).query(`
          SELECT source.[id_rheology]
          FROM #csv_import source
          INNER JOIN [rheology] target ON target.[id_rheology] = source.[id_rheology]`);
        const conflicts = existing.map(r => r.id_rheology);

        const { rowsAffected } = await new sql.Request(tx).query(`
          INSERT INTO [rheology] ([id_rheology],[id_slurry],[slurry_type],[timestamp],[source],[parameter],[value],[unit],[usl],[lsl])
          SELECT source.[id_rheology], source.[id_slurry], source.[slurry_type], source.[timestamp],
                 source.[source], source.[parameter], source.[value], source.[unit], source.[usl], source.[lsl]
          FROM #csv_import source
          WHERE NOT EXISTS (SELECT 1 FROM [rheology] target WHERE target.[id_rheology] = source.[id_rheology])`);

        const insertedCount = rowsAffected[0] || 0;
        await tx.commit();

        if (conflicts.length) return res.status(409).json({ ok: false, conflicts, insertedCount, skipped });
        return res.json({ ok: true, insertedCount, skipped });
      }
    } catch (inner) {
      try { await tx.rollback(); } catch { /* rollback failed too, nothing we can do lol */ }
      throw inner;
    }
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

// ──────────── serves the frontend app ────────────

const distDir = path.join(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { maxAge: '30d', immutable: true, index: false }));
  // any route that's not /api/* gets the frontend - classic SPA trick
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// ──────────── let's gooo ────────────

(async () => {
  await probeComputedColumns();
  try {
    await ensureUserPrefsTable();
  } catch (e) {
    console.warn('[prefs] user_prefs bootstrap skipped: %s', e?.message || 'error');
  }
  app.listen(PORT, () => {
    console.log(`[server] SQL Server API listening on ${PORT}`);
  });
})();
