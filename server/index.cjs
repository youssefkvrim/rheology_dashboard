/* Minimal read-only backend for SQL Server to serve rheology endpoints (CommonJS) */
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
app.use(express.json({ limit: '2mb' }));
app.use(express.text({ type: ['text/*', 'application/csv', 'text/csv'], limit: '10mb' }));

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

// List available slurries (distinct id_slurry) with last timestamp
app.get('/api/slurries', async (_req, res) => {
  try {
    const pool = await getPool();
    const { recordset: rows } = await pool.request().query(
      `SELECT [id_slurry], MAX([timestamp]) as ts
       FROM [rheology]
       GROUP BY [id_slurry]
       ORDER BY [id_slurry]`
    );
    const out = rows.map(r => {
      const ms = toMs(r.ts);
      return { id: String(r.id_slurry), last: Number.isFinite(ms) ? ms : undefined };
    });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

app.get('/api/rheology/latest-all', async (req, res) => {
  try {
    const slurriesCsv = String(req.query.slurries || '');
    const paramsCsv = String(req.query.params || 'density,viscosity,pH,temperature,pc,H2O');
    const slurries = slurriesCsv.split(',').map(s => s.trim()).filter(Boolean);
    const params = paramsCsv.split(',').map(s => s.trim()).filter(Boolean);
    if (!slurries.length || !params.length) return res.json({});

    // Normalize for SQL comparison (UPPER + TRIM)
    const normParams = params.map((p) => p.trim().toUpperCase());

    const pool = await getPool();
    const slurryPlaceholders = slurries.map((_, i) => `@s${i}`).join(',');
    const paramPlaceholders = normParams.map((_, i) => `@p${i}`).join(',');
    const q = `
      SELECT [id_slurry], [parameter], [timestamp], [value], [unit]
      FROM [rheology]
      WHERE [id_slurry] IN (${slurryPlaceholders})
        AND UPPER(LTRIM(RTRIM([parameter]))) IN (${paramPlaceholders})
      ORDER BY [timestamp] DESC`;
    const request = pool.request();
    slurries.forEach((v, i) => request.input(`s${i}`, sql.VarChar(64), v));
    normParams.forEach((v, i) => request.input(`p${i}`, sql.VarChar(32), v));
    const { recordset: rows } = await request.query(q);

    const toNormKey = (raw) => {
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
    };

    const out = {};
    for (const r of rows) {
      const sid = String(r.id_slurry);
      const p = toNormKey(r.parameter);
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

    const normParams = params.map((p) => p.trim().toUpperCase());

    const pool = await getPool();
    const placeholders = normParams.map((_, i) => `@p${i}`).join(',');
    const q = `
      SELECT [timestamp], [value], [unit], [parameter]
      FROM [rheology]
      WHERE [id_slurry]=@slurryId AND UPPER(LTRIM(RTRIM([parameter]))) IN (${placeholders})
      ORDER BY [timestamp] ASC`;
    const request = pool.request();
    request.input('slurryId', sql.VarChar(64), slurryId);
    normParams.forEach((v, i) => request.input(`p${i}`, sql.VarChar(32), v));
    const { recordset: rows } = await request.query(q);

    const toNormKey = (raw) => {
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
    };

    const map = {};
    rows.forEach((r) => {
      const key = toNormKey(r.parameter);
      const ms = toMs(r.timestamp);
      if (!map[key]) map[key] = [];
      map[key].push({ t: Number.isFinite(ms) ? ms : 0, v: Number(r.value), unit: r.unit || undefined });
    });

    if (includeBounds) {
      const rq = pool.request();
      rq.input('slurryId', sql.VarChar(64), slurryId);
      // Get latest bounds per parameter using ROW_NUMBER
      const { recordset: brows } = await rq.query(
        `WITH ranked AS (
           SELECT [parameter], [usl], [lsl], [timestamp],
                  ROW_NUMBER() OVER (PARTITION BY [parameter] ORDER BY [timestamp] DESC) as rn
           FROM [rheology] WHERE [id_slurry]=@slurryId AND ([usl] IS NOT NULL OR [lsl] IS NOT NULL)
         )
         SELECT [parameter], [usl], [lsl] FROM ranked WHERE rn=1`
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
    // Get latest bounds per parameter using ROW_NUMBER to pick most recent row
    const { recordset: rows } = await rq.query(
      `WITH ranked AS (
         SELECT [parameter], [usl], [lsl], [timestamp],
                ROW_NUMBER() OVER (PARTITION BY [parameter] ORDER BY [timestamp] DESC) as rn
         FROM [rheology] WHERE [id_slurry]=@slurryId AND ([usl] IS NOT NULL OR [lsl] IS NOT NULL)
       )
       SELECT [parameter], [usl], [lsl] FROM ranked WHERE rn=1`
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
    rq.input('parameter', sql.VarChar(32), parameter.trim().toUpperCase());
    const { recordset: rows } = await rq.query(
      `SELECT [timestamp], [value], [unit]
       FROM [rheology]
       WHERE [id_slurry]=@slurryId AND UPPER(LTRIM(RTRIM([parameter])))=@parameter
       ORDER BY [timestamp] ASC`
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

// Server-side alert evaluation for latest values vs bounds
app.get('/api/alerts/latest', async (req, res) => {
  try {
    const slurriesCsv = String(req.query.slurries || req.query.slurryId || '').trim();
    const slurries = slurriesCsv.split(',').map(s => s.trim()).filter(Boolean);
    if (!slurries.length) return res.json({});
    const pool = await getPool();
    // Latest values per parameter
    const slurryPlaceholders = slurries.map((_, i) => `@s${i}`).join(',');
    const rq = pool.request();
    slurries.forEach((v, i) => rq.input(`s${i}`, sql.VarChar(64), v));
    const { recordset: latestRows } = await rq.query(`
      WITH cte AS (
        SELECT [id_slurry],[parameter],[timestamp],[value],[unit],
               ROW_NUMBER() OVER (PARTITION BY [id_slurry],[parameter] ORDER BY [timestamp] DESC) AS rn
        FROM [rheology]
        WHERE [id_slurry] IN (${slurryPlaceholders})
      )
      SELECT [id_slurry],[parameter],[timestamp],[value],[unit]
      FROM cte WHERE rn = 1
    `);
    // Latest bounds per parameter
    const rq2 = pool.request();
    slurries.forEach((v, i) => rq2.input(`s${i}`, sql.VarChar(64), v));
    const { recordset: boundRows } = await rq2.query(`
      WITH b AS (
        SELECT [id_slurry],[parameter],[usl],[lsl],
               ROW_NUMBER() OVER (PARTITION BY [id_slurry],[parameter] ORDER BY [timestamp] DESC) AS rn
        FROM [rheology]
        WHERE [id_slurry] IN (${slurryPlaceholders})
      )
      SELECT [id_slurry],[parameter],[usl],[lsl]
      FROM b WHERE rn = 1
    `);
    const keyNorm = (raw) => {
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
    };
    const boundsMap = new Map(); // key: sid|param => {low,high}
    for (const r of boundRows) {
      const sid = String(r.id_slurry);
      const p = keyNorm(r.parameter);
      boundsMap.set(`${sid}|${p}`, { low: r.lsl ?? null, high: r.usl ?? null });
    }
    const out = {};
    for (const r of latestRows) {
      const sid = String(r.id_slurry);
      const p = keyNorm(r.parameter);
      const val = Number(r.value);
      const b = boundsMap.get(`${sid}|${p}`) || { low: null, high: null };
      const hasLow = b.low != null;
      const hasHigh = b.high != null;
      let status = 'ok';
      if (hasLow && val < b.low) status = 'err';
      if (hasHigh && val > b.high) status = 'err';
      if (hasLow && hasHigh && status === 'ok') {
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

// Insert/Update a single rheology point
app.post('/api/rheology/point', async (req, res) => {
  try {
    const b = (req.body || {});
    const id_slurry = String(b.id_slurry || '').trim();
    const parameter = String(b.parameter || '').trim().toUpperCase();
    const ts = b.timestamp ? new Date(b.timestamp) : new Date();
    if (!id_slurry || !parameter) return res.status(400).json({ error: 'id_slurry and parameter required' });
    const id_rheology = String(b.id_rheology || `${id_slurry}|${parameter}|${ts.toISOString()}`);
    const slurry_type = b.slurry_type != null ? String(b.slurry_type) : null;
    const source = b.source != null ? String(b.source) : null;
    const value = (b.value != null) ? Number(b.value) : null;
    const unit = b.unit != null ? String(b.unit) : null;
    const usl = (b.usl != null) ? Number(b.usl) : null;
    const lsl = (b.lsl != null) ? Number(b.lsl) : null;
    const pool = await getPool();
    const exRq = pool.request();
    exRq.input('id', sql.VarChar(128), id_rheology);
    const { recordset: ex } = await exRq.query(`SELECT 1 as x FROM [rheology] WHERE [id_rheology]=@id`);
    const rq = pool.request();
    rq.input('id', sql.VarChar(128), id_rheology);
    rq.input('slurry', sql.VarChar(64), id_slurry);
    rq.input('stype', sql.VarChar(32), slurry_type);
    rq.input('ts', sql.DateTimeOffset, ts);
    rq.input('src', sql.VarChar(128), source);
    rq.input('param', sql.VarChar(32), parameter);
    rq.input('val', sql.Float, value);
    rq.input('unit', sql.VarChar(16), unit);
    rq.input('usl', sql.Float, usl);
    rq.input('lsl', sql.Float, lsl);
    if (ex.length) {
      await rq.query(`
        UPDATE [rheology]
        SET [id_slurry]=@slurry, [slurry_type]=@stype, [timestamp]=@ts, [source]=@src,
            [parameter]=@param, [value]=@val, [unit]=@unit, [usl]=@usl, [lsl]=@lsl
        WHERE [id_rheology]=@id`);
      return res.json({ ok: true, updated: id_rheology });
    } else {
      await rq.query(`
        INSERT INTO [rheology] ([id_rheology],[id_slurry],[slurry_type],[timestamp],[source],[parameter],[value],[unit],[usl],[lsl])
        VALUES (@id,@slurry,@stype,@ts,@src,@param,@val,@unit,@usl,@lsl)`);
      return res.json({ ok: true, inserted: id_rheology });
    }
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

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

app.get('/api/user-prefs', async (req, res) => {
  try {
    const userId = String(req.query.userId || req.headers['x-user-id'] || '').trim();
    if (!userId) return res.status(400).json({ error: 'userId required' });
    await ensureUserPrefsTable();
    const pool = await getPool();
    const rq = pool.request();
    rq.input('u', sql.NVarChar(128), userId);
    const { recordset: rows } = await rq.query(`SELECT [data] FROM [user_prefs] WHERE [user_id]=@u`);
    const data = rows[0]?.data || null;
    try {
      const parsed = data ? JSON.parse(data) : null;
      return res.json({ ok: true, prefs: parsed });
    } catch {
      return res.json({ ok: true, prefs: null });
    }
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

app.put('/api/user-prefs', async (req, res) => {
  try {
    const userId = String(req.query.userId || req.headers['x-user-id'] || '').trim();
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const prefs = req.body?.prefs ?? null;
    await ensureUserPrefsTable();
    const pool = await getPool();
    const rq = pool.request();
    rq.input('u', sql.NVarChar(128), userId);
    rq.input('d', sql.NVarChar(sql.MAX), JSON.stringify(prefs ?? null));
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

// ---------------- CSV Export/Import ----------------
app.get('/api/rheology/export-csv', async (req, res) => {
  try {
    const slurryId = String(req.query.slurryId || '').trim();
    if (!slurryId) return res.status(400).json({ error: 'slurryId required' });
    const start = Number(req.query.start || 0);
    const end = Number(req.query.end || 0);
    const pool = await getPool();
    const rq = pool.request();
    rq.input('slurryId', sql.VarChar(64), slurryId);
    let whereTime = '';
    if (Number.isFinite(start) && start > 0) { rq.input('start', sql.DateTimeOffset, new Date(start)); whereTime += ' AND [timestamp] >= @start'; }
    if (Number.isFinite(end) && end > 0) { rq.input('end', sql.DateTimeOffset, new Date(end)); whereTime += ' AND [timestamp] <= @end'; }
    const q = `
      SELECT [id_rheology], [id_slurry], [slurry_type], [timestamp], [source], [parameter], [value], [unit], [usl], [lsl]
      FROM [rheology]
      WHERE [id_slurry]=@slurryId${whereTime}
      ORDER BY [timestamp] ASC`;
    const { recordset: rows } = await rq.query(q);
    const hdr = 'id_rheology,id_slurry,slurry_type,timestamp,source,parameter,value,unit,usl,lsl';
    const csv = [hdr].concat(rows.map((r) => {
      const id = (r.id_rheology != null) ? String(r.id_rheology) : `${r.id_slurry}|${r.parameter}|${new Date(r.timestamp).toISOString()}`;
      const st = (r.slurry_type != null) ? String(r.slurry_type) : (String(r.id_slurry || '').split('_')[0] || '');
      const ts = new Date(r.timestamp).toISOString();
      const source = r.source != null ? String(r.source) : '';
      const param = String(r.parameter || '');
      const val = (r.value != null) ? String(Number(r.value)) : '';
      const unit = r.unit != null ? String(r.unit) : '';
      const usl = (r.usl != null) ? String(Number(r.usl)) : '';
      const lsl = (r.lsl != null) ? String(Number(r.lsl)) : '';
      return [id, r.id_slurry, st, ts, source, param, val, unit, usl, lsl].join(',');
    })).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${slurryId}_export.csv"`);
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

app.post('/api/rheology/import-csv', async (req, res) => {
  try {
    const override = String(req.query.override || '0') === '1';
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    const body = (typeof req.body === 'string') ? req.body : (contentType.includes('json') ? String(req.body?.csv || '') : '');
    if (!body || typeof body !== 'string') return res.status(400).json({ error: 'CSV body required as text' });
    const lines = body.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!lines.length) return res.status(400).json({ error: 'Empty CSV' });
    const header = lines[0].toLowerCase().replace(/\s+/g, '');
    const expected = 'id_rheology,id_slurry,slurry_type,timestamp,source,parameter,value,unit,usl,lsl';
    if (header !== expected) return res.status(400).json({ error: 'Invalid header', expected });
    const rows = lines.slice(1).map(line => line.split(','));
    const conflicts = [];
    const inserted = [];
    const updated = [];
    const pool = await getPool();
    const tx = new sql.Transaction(await pool);
    await tx.begin();
    try {
      for (const parts of rows) {
        if (parts.length !== 10) continue;
        const [id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl] = parts.map(s => s.trim());
        const rq = new sql.Request(tx);
        rq.input('id', sql.VarChar(128), id_rheology);
        const { recordset: ex } = await rq.query(`SELECT 1 as x FROM [rheology] WHERE [id_rheology]=@id`);
        if (ex.length && !override) {
          conflicts.push(id_rheology);
          continue;
        }
        const rq2 = new sql.Request(tx);
        rq2.input('id', sql.VarChar(128), id_rheology);
        rq2.input('slurry', sql.VarChar(64), id_slurry);
        rq2.input('stype', sql.VarChar(32), slurry_type || null);
        rq2.input('ts', sql.DateTimeOffset, new Date(timestamp));
        rq2.input('src', sql.VarChar(128), source || null);
        rq2.input('param', sql.VarChar(32), String(parameter || '').trim().toUpperCase());
        rq2.input('val', sql.Float, value ? Number(value) : null);
        rq2.input('unit', sql.VarChar(16), unit || null);
        rq2.input('usl', sql.Float, usl ? Number(usl) : null);
        rq2.input('lsl', sql.Float, lsl ? Number(lsl) : null);
        if (ex.length && override) {
          await rq2.query(`
            UPDATE [rheology]
            SET [id_slurry]=@slurry, [slurry_type]=@stype, [timestamp]=@ts, [source]=@src,
                [parameter]=@param, [value]=@val, [unit]=@unit, [usl]=@usl, [lsl]=@lsl
            WHERE [id_rheology]=@id`);
          updated.push(id_rheology);
        } else {
          await rq2.query(`
            INSERT INTO [rheology] ([id_rheology],[id_slurry],[slurry_type],[timestamp],[source],[parameter],[value],[unit],[usl],[lsl])
            VALUES (@id,@slurry,@stype,@ts,@src,@param,@val,@unit,@usl,@lsl)`);
          inserted.push(id_rheology);
        }
      }
      await tx.commit();
    } catch (inner) {
      await tx.rollback();
      throw inner;
    }
    if (conflicts.length) return res.status(409).json({ ok: false, conflicts, inserted, updated });
    res.json({ ok: true, inserted, updated });
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


