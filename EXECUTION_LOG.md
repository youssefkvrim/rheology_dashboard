# Execution Log

## 2026-06-12

- Pre-overhaul snapshot — done — committed existing working-tree state exactly as found with `chore: snapshot pre-overhaul working tree (scrypt swap, reset fix)` and tagged it `v0.4.1-pre-overhaul`.
- T0.1 Live diagnostic — blocked locally — Jetlab host and production DB are not directly available from this workspace. Local `/api/health` reached the Express server but returned `500` because the configured SQL Server host `y005n8c.rd1.rf1` could not resolve from this environment (`getaddrinfo ENOTFOUND`). The read-only curl/SQL evidence still needs to be collected on Jetlab or a network segment that can resolve and reach SQL Server.
- T0.2 Remove expiring freshness filters — done — Home now renders every barbotine from the store, always displays available values with valid timestamps, marks data stale after 30 days, and shows the last-measure date.
- T0.3 Stop `t: 0` timestamp coercion — done — `/api/slurries`, `/api/rheology`, `/api/rheology/all`, and `/api/rheology/latest-all` now skip rows whose timestamps cannot be parsed and log skipped-row counts.
- T0.4 Legacy timestamp writes — done with documented assumption — `docs/SQL.md` documents `rheology.timestamp` as `VARCHAR(32)`, so point writes and CSV import now bind timestamps as `sql.VarChar(32)`. CSV import preserves legacy timestamps verbatim, normalizes parseable non-legacy timestamps, and counts unparseable rows as `skipped`. Added script-only migration `db/migrations/001_normalize_timestamps.sql`; it has not been run.
- T0.5 Mixed-format ordering — done — dashboard queries now order or aggregate timestamps through `TRY_CONVERT(datetimeoffset, REPLACE([timestamp],' ','T'))` instead of raw string order.
- T0.6 Restore reachable deployment — partially verified — `npx tsc --noEmit` passed, `npm run build` passed, `node server/index.cjs` booted on port 3001 outside the sandbox, `/` served the built SPA from `dist/`, and a background browser smoke check rendered the login screen. `/api/health` responded but was not healthy because SQL Server DNS is unavailable from this workspace. Added `docs/DEPLOY_JETLAB.md`.
