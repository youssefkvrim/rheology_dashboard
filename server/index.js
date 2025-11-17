/* Minimal read-only backend for SQL Server to serve rheology endpoints */
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const dotenv = require('dotenv');

// Load secrets from vault (not tracked by git)
dotenv.config({ path: path.resolve(process.cwd(), 'vault/secrets.env') });

const app = express();
app.use(cors());

const PORT = Number(process.env.BACKEND_PORT || 3001);

const poolConfig = {
  server: process.env.MSSQL_SERVER, // e.g., Y005N8C.rd1.rf1
  database: process.env.MSSQL_DATABASE, // e.g., PFX_suivi_barbotine
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  port: Number(process.env.MSSQL_PORT || 1433),
  options: {
    encrypt: String(process.env.MSSQL_ENCRYPT || 'true') === 'true',
    trustServerCertificate: String(process.env.MSSQL_TRUST_CERT || 'true') === 'true',
    instanceName: process.env.MSSQL_INSTANCE, // e.g., DATATECH_PFX
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  connectionTimeout: 15000,
  requestTimeout: 30000,
};

let poolPromise;
function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(poolConfig).catch((err) => {
      poolPromise = undefined;
      throw err;
    });
  }
  return poolPromise;
}

function toMs(ts) {
  try {
    if (!ts) return NaN;
    if (ts instanceof Date && !isNaN(ts.getTime())) return Number(ts.getTime());
    let s = String(ts).trim();
    if (!s) return NaN;
    if (s.indexOf(' ') !== -1) s = s.replace(' ', 'T');
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

app.get('/api/health', async (_req, res) => {
  try {
    await getPool();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'error' });
  }
});

app.get('/api/rheology/latest-all', async (req, res) => {
  try {
    const slurriesCsv = String(req.query.slurries || '');
    const paramsCsv = String(req.query.params || 'density,viscosity,pH,temperature,pc,H2O');
    const slurries = slurriesCsv.split(',').map(s => s.trim()).filter(Boolean);
    const params = paramsCsv.split(',').map(s => s.trim()).filter(Boolean);
    if (!slurries.length || !params.length) return res.json({});

    const pool = await getPool();
    const slurryPlaceholders = slurries.map((_, i) => `@s${i}`).join(',');
    const paramPlaceholders = params.map((_, i) => `@p${i}`).join(',');
    const q = `
      SELECT id_slurry, parameter, timestamp, value, unit
      FROM rheology
      WHERE id_slurry IN (${slurryPlaceholders})
        AND parameter IN (${paramPlaceholders})
      ORDER BY timestamp DESC`;
    const request = pool.request();
    slurries.forEach((v, i) => request.input(`s${i}`, sql.VarChar(64), v));
    params.forEach((v, i) => request.input(`p${i}`, sql.VarChar(32), v));
    const { recordset: rows } = await request.query(q);

    const out = {};
    for (const r of rows) {
      const sid = String(r.id_slurry);
      const p = String(r.parameter);
      const ms = toMs(r.timestamp);
      out[sid] = out[sid] || {};
      if (!out[sid][p]) out[sid][p] = { t: Number.isFinite(ms) ? ms : 0, v: Number(r.value), unit: r.unit || undefined };
      else if (out[sid][p] && out[sid][p].prevV == null) {
        out[sid][p].prevV = Number(r.value);
        out[sid][p].prevT = Number.isFinite(ms) ? ms : 0;
      }
    }
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

app.get('/api/rheology/all', async (req, res) => {
  try {
    const slurryId = String(req.query.slurryId || '');
    const paramsCsv = String(req.query.params || 'density,viscosity,pH,temperature,pc,H2O');
    const params = paramsCsv.split(',').map(s => s.trim()).filter(Boolean);
    const includeBounds = String(req.query.includeBounds || '') === '1';
    if (!slurryId || !params.length) return res.json({});

    const pool = await getPool();
    const placeholders = params.map((_, i) => `@p${i}`).join(',');
    const q = `
      SELECT timestamp, value, unit, parameter
      FROM rheology
      WHERE id_slurry=@slurryId AND parameter IN (${placeholders})
      ORDER BY timestamp ASC`;
    const request = pool.request();
    request.input('slurryId', sql.VarChar(64), slurryId);
    params.forEach((v, i) => request.input(`p${i}`, sql.VarChar(32), v));
    const { recordset: rows } = await request.query(q);

    const map = {};
    rows.forEach((r) => {
      const key = String(r.parameter);
      const ms = toMs(r.timestamp);
      if (!map[key]) map[key] = [];
      map[key].push({ t: Number.isFinite(ms) ? ms : 0, v: Number(r.value), unit: r.unit || undefined });
    });

    if (includeBounds) {
      const rq = pool.request();
      rq.input('slurryId', sql.VarChar(64), slurryId);
      const { recordset: brows } = await rq.query(
        `SELECT parameter, usl, lsl, MAX(timestamp) as ts
         FROM rheology WHERE id_slurry=@slurryId GROUP BY parameter`
      );
      const bounds = brows.map((r) => ({ key: r.parameter, low: r.lsl ?? null, high: r.usl ?? null }));
      return res.json({ series: map, bounds });
    }
    res.json({ series: map });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

app.get('/api/rheology/bounds', async (req, res) => {
  try {
    const slurryId = String(req.query.slurryId || '');
    if (!slurryId) return res.json([]);
    const pool = await getPool();
    const rq = pool.request();
    rq.input('slurryId', sql.VarChar(64), slurryId);
    const { recordset: rows } = await rq.query(
      `SELECT parameter, usl, lsl, MAX(timestamp) as ts
       FROM rheology WHERE id_slurry=@slurryId GROUP BY parameter`
    );
    const mapKey = (p) => p === 'density' ? 'densite'
      : p === 'viscosity' ? 'viscosite'
      : p === 'pH' ? 'ph'
      : String(p).toLowerCase();
    const out = rows.map((r) => ({ key: mapKey(r.parameter), low: r.lsl ?? null, high: r.usl ?? null }));
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

app.get('/api/rheology', async (req, res) => {
  try {
    const slurryId = String(req.query.slurryId || '');
    const parameter = String(req.query.parameter || '');
    if (!slurryId || !parameter) return res.json([]);
    const pool = await getPool();
    const rq = pool.request();
    rq.input('slurryId', sql.VarChar(64), slurryId);
    rq.input('parameter', sql.VarChar(32), parameter);
    const { recordset: rows } = await rq.query(
      `SELECT timestamp, value, unit
       FROM rheology
       WHERE id_slurry=@slurryId AND parameter=@parameter
       ORDER BY timestamp ASC`
    );
    const out = rows.map((r) => {
      const ms = toMs(r.timestamp);
      return { t: Number.isFinite(ms) ? ms : 0, v: Number(r.value), unit: r.unit || undefined };
    });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

// ----------- Static SPA hosting + history fallback (excludes /api) -----------
const distDir = path.join(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] SQL Server API listening on ${PORT}`);
});


