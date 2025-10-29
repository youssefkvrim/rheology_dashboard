import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function sqlProxyPlugin() {
  return {
    name: 'sql-proxy',
    configureServer(server: any) {
      const dynImport = new Function('m', 'return import(m)');
      const poolPromise = (dynImport as any)('mysql2/promise').then((m: any) => m.createPool({
        host: 'sql7.freesqldatabase.com',
        user: 'sql7804097',
        password: '7pYgJpj8Cu',
        database: 'sql7804097',
        waitForConnections: true,
        connectionLimit: 1,
      }));
      server.middlewares.use('/api/rheology', async (req: any, res: any) => {
        try {
          const url = new URL(req.url || '', 'http://localhost');
          res.setHeader('Cache-Control', 'no-store');
          const pool = await poolPromise;
          const pathname = url.pathname;
          if (pathname.endsWith('/latest-all')) {
            const slurriesCsv = url.searchParams.get('slurries') || '';
            const paramsCsv = url.searchParams.get('params') || 'density,viscosity,pH,temperature,pc,H2O';
            const slurries = slurriesCsv.split(',').map(s=>s.trim()).filter(Boolean);
            const params = paramsCsv.split(',').map(s=>s.trim()).filter(Boolean);
            if (!slurries.length || !params.length) { res.setHeader('Content-Type','application/json'); res.end('{}'); return; }
            const slurryPlace = slurries.map(()=> '?').join(',');
            const paramPlace = params.map(()=> '?').join(',');
            const sql = `SELECT id_slurry, parameter, timestamp, value, unit FROM rheology WHERE id_slurry IN (${slurryPlace}) AND parameter IN (${paramPlace}) ORDER BY timestamp DESC`;
            const [rows] = await pool.query(sql, [...slurries, ...params]);
            const toMs = (ts:any) => {
              try {
                if (ts && typeof ts.getTime === 'function') return Number(ts.getTime());
                let s = String(ts || '').trim(); if (!s) return NaN; if (s.indexOf(' ') !== -1) s = s.replace(' ', 'T');
                const m = s.match(/([+-])(\d{2})(?!:)(?!\d)/); if (m) s = s + ':00';
                const m2 = s.match(/([+-])(\d{2})(\d{2})$/); if (m2) s = s.replace(/([+-])(\d{2})(\d{2})$/, `${m2[1]}${m2[2]}:${m2[3]}`);
                const ms = Date.parse(s); return Number.isFinite(ms) ? ms : NaN;
              } catch { return NaN; }
            };
            const out: Record<string, Record<string, { t:number; v:number; unit?: string; prevV?: number; prevT?: number }>> = {};
            for (const r of rows as any[]) {
              const sid = String(r.id_slurry);
              const p = String(r.parameter);
              const ms = toMs(r.timestamp);
              out[sid] = out[sid] || {};
              if (!out[sid][p]) out[sid][p] = { t: Number.isFinite(ms)?ms:0, v: Number(r.value), unit: r.unit || undefined };
              else if (!out[sid][p].prevV) out[sid][p].prevV = Number(r.value), out[sid][p].prevT = Number.isFinite(ms)?ms:0;
            }
            res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(out)); return;
          }
          if (pathname.endsWith('/all')) {
            const slurryId = url.searchParams.get('slurryId') || '';
            const paramsCsv = url.searchParams.get('params') || 'density,viscosity,pH,temperature,pc,H2O';
            const params = paramsCsv.split(',').map(s=>s.trim()).filter(Boolean);
            if (!slurryId || !params.length) { res.setHeader('Content-Type','application/json'); res.end('{}'); return; }
            const placeholders = params.map(()=> '?').join(',');
            const sql = `SELECT timestamp, value, unit, parameter FROM rheology WHERE id_slurry=? AND parameter IN (${placeholders}) ORDER BY timestamp ASC`;
            const args = [slurryId, ...params];
            const [rows] = await pool.query(sql, args);
            const toMs = (ts:any) => {
              try {
                if (ts && typeof ts.getTime === 'function') return Number(ts.getTime());
                let s = String(ts || '').trim(); if (!s) return NaN; if (s.indexOf(' ') !== -1) s = s.replace(' ', 'T');
                const m = s.match(/([+-])(\d{2})(?!:)(?!\d)/); if (m) s = s + ':00';
                const m2 = s.match(/([+-])(\d{2})(\d{2})$/); if (m2) s = s.replace(/([+-])(\d{2})(\d{2})$/, `${m2[1]}${m2[2]}:${m2[3]}`);
                const ms = Date.parse(s); return Number.isFinite(ms) ? ms : NaN;
              } catch { return NaN; }
            };
            const map: Record<string, Array<{ t:number; v:number; unit?: string }>> = {};
            (rows as any[]).forEach((r:any) => {
              const key = String(r.parameter);
              const ms = toMs(r.timestamp);
              if (!map[key]) map[key] = [];
              map[key].push({ t: Number.isFinite(ms) ? ms : 0, v: Number(r.value), unit: r.unit || undefined });
            });
            // optionally include latest bounds
            if (url.searchParams.get('includeBounds') === '1') {
              const [brows] = await pool.query(
                "SELECT parameter, usl, lsl, MAX(timestamp) as ts FROM rheology WHERE id_slurry=? GROUP BY parameter",
                [slurryId]
              );
              const bounds = (brows as any[]).map((r:any)=> ({ key: r.parameter, low: r.lsl ?? null, high: r.usl ?? null }));
              res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ series: map, bounds })); return;
            }
            res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ series: map })); return;
          }
          if (pathname.endsWith('/bounds')) {
            const slurryId = url.searchParams.get('slurryId') || '';
            const [rows] = await pool.query(
              "SELECT parameter, usl, lsl, MAX(timestamp) as ts FROM rheology WHERE id_slurry=? GROUP BY parameter",
              [slurryId]
            );
            const mapKey = (p:string)=> p==='density'?'densite': p==='viscosity'?'viscosite': p==='pH'?'ph': (p.toLowerCase() as any);
            const out = (rows as any[]).map((r:any) => ({ key: mapKey(r.parameter), low: r.lsl ?? null, high: r.usl ?? null }));
            res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(out)); return;
          }
          const slurryId = url.searchParams.get('slurryId') || '';
          const parameter = url.searchParams.get('parameter') || '';
          // Return full series (client filters by range). Timestamps are ISO strings; convert to epoch.
          const [rows] = await pool.query(
            "SELECT timestamp, value, unit FROM rheology WHERE id_slurry=? AND parameter=? ORDER BY timestamp ASC",
            [slurryId, parameter]
          );
          const toMs = (ts:any) => {
            try {
              if (ts && typeof ts.getTime === 'function') return Number(ts.getTime());
              let s = String(ts || '').trim();
              if (!s) return NaN;
              // normalize space to 'T'
              if (s.indexOf(' ') !== -1) s = s.replace(' ', 'T');
              // ensure timezone has minutes (e.g., +02 -> +02:00)
              const m = s.match(/([+-])(\d{2})(?!:)(?!\d)/);
              if (m) s = s + ':00';
              // also fix cases like +0200 -> +02:00
              const m2 = s.match(/([+-])(\d{2})(\d{2})$/);
              if (m2) s = s.replace(/([+-])(\d{2})(\d{2})$/, `${m2[1]}${m2[2]}:${m2[3]}`);
              const ms = Date.parse(s);
              return Number.isFinite(ms) ? ms : NaN;
            } catch { return NaN; }
          };
          const out = (rows as any[]).map((r:any) => {
            const ms = toMs(r.timestamp);
            return { t: Number.isFinite(ms) ? ms : 0, v: Number(r.value), unit: r.unit || undefined };
          });
          res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(out)); return;
        } catch (e:any) {
          res.statusCode = 500; res.end(JSON.stringify({ error: e?.message || 'error' }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), sqlProxyPlugin()],
  server: { port: 3000, host: true },
  preview: { port: 3000, host: true },
});


