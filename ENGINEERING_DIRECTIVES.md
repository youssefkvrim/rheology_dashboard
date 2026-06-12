# ENGINEERING DIRECTIVES — Dashboard Safran (Barbotines)

**Document owner:** Orchestrator (Claude)
**Date:** 2026-06-12
**Audience:** Software engineering agents. Follow these directives **to the letter**. Where a choice could exist, the decision has already been made and is written here. Do not substitute alternatives. If a directive is impossible to execute (e.g., missing DB permission), STOP that task, record the blocker in `EXECUTION_LOG.md`, and continue with the next independent task.

---

## 0. Project context (read first, do not skip)

- **What it is:** Single-page dashboard supervising ceramic slurry ("barbotine") rheology measurements (density, viscosity, pH, temperature, covering power `pc`, H2O flow, silice, grains) read from a SQL Server table `rheology` in database `PFX_MOULAGE_prod`.
- **Stack:** Vite 7 + React 18 + TypeScript + Recharts 2 + Zustand 5 (frontend, `src/`), Express 4 + `mssql` (backend, single file `server/index.cjs`, port 3001). Secrets in `vault/secrets.env` (gitignored, confirmed NOT in git history).
- **Deployment:** Hosted on Safran "Jetlab". `npm run build`/`preview` reportedly fail there; vite is invoked via `node ./node_modules/vite/bin/vite.js`. The vite dev/preview server (port 3000) proxies `/api` → `localhost:3001`. The Express server also serves `dist/` if present.
- **Users:** 4 hardcoded users in `server/index.cjs` (lines ~174–179) with plaintext passwords in source. Keycloak SSO is wired but optional (dev-mode fallback via sessionStorage).
- **Reported problems:** (1) values suddenly stopped displaying; (2) app is very laggy; (3) messy repo, dead code, junk files; (4) zero attention paid to security; (5) outdated deps; (6) wants complementary features afterward.

### Root-cause analysis already performed (treat as established facts)

**RC-1 (primary cause of "values disappeared"): client-side data-freshness filters expired.**
`src/pages/Home.tsx` lines ~160–190:
- A card is rendered **only if** at least one parameter has a timestamp within **210 days** (`showAny`, line ~167).
- A card is "online" only if data is within 210 days (`onlineByData`, line ~187); offline cards render `—` instead of values.
- Individual values display only if within **365 days** (`showD/showV/showPC/showH2O`, line ~186).
The newest production data was imported around **October 2025** (see `data/data csv/10-2025/`). 210 days after autumn 2025 lands in **spring 2026** — the filters silently expired, hiding everything. This matches "stopped all of a sudden."

**RC-2 (secondary, fragile timestamps):** `docs/SQL.md` documents the `timestamp` column as `VARCHAR(32)` holding `YYYY-MM-DDTHH:MM:SS+ZZ`, but the server (a) sorts/aggregates it as a string (`ORDER BY [timestamp]`, `MAX([timestamp])`), and (b) **writes** it as `sql.DateTimeOffset` (POST `/api/rheology/point`, CSV import), which SQL Server stringifies into a *different* format (`YYYY-MM-DD HH:MM:SS.0000000 +TZ:00`). Mixed formats corrupt string ordering and make `toMs()` parsing inconsistent. Server falls back to `t: 0` when parsing fails, which the frontend then treats as "older than any window" → hidden.

**RC-3 (lag):**
1. Production runs the **vite dev/preview server** instead of the static build served by Express.
2. Artificial **3-second minimum** full-screen loading gate on every app start, 7 s when health check fails (`src/app/App.tsx` lines ~80–85).
3. ASCII loader recomputes an O(all characters) animation every 90 ms (`src/pages/Loading.tsx`).
4. `GET /api/rheology/latest-all` fetches **every row** for the requested slurries and discards all but 2 per (slurry, parameter) in JS. Full table scan + huge transfer.
5. `WHERE UPPER(LTRIM(RTRIM([parameter])))` in every query is non-sargable; no supporting index documented.
6. `GET /api/rheology/all` returns unbounded full history; Recharts renders all points with animations.
7. `ensureUserPrefsTable()` executes DDL on **every** `/api/user-prefs` request.
8. No HTTP compression, every fetch is `cache: 'no-store'`.
9. `DebuggerFab` polls `/api/health` every 10 s forever, each ping touching the DB pool.

**RC-4 (security, severity-ordered):**
1. **CRITICAL — account takeover:** `POST /api/auth/reset-request` returns the reset token **in the HTTP response** to any unauthenticated caller. Anyone who knows a username can reset that user's password.
2. **CRITICAL:** plaintext passwords (`pfx`, `safranpfx`, `pfxpfxpfx`) hardcoded in `server/index.cjs`, committed to git history. Treat all 4 as compromised.
3. **HIGH:** `JWT_SECRET` falls back to the literal `'CHANGE_ME_IN_PRODUCTION'` if env is missing.
4. **HIGH:** all read endpoints (`/api/slurries`, `/api/rheology*`, `/api/alerts/latest`, `GET /api/user-prefs`) are unauthenticated → industrial production data readable by anyone with network access.
5. **HIGH:** `PUT /api/user-prefs` authenticates the caller but takes `userId` from the query string → any logged-in user can overwrite any other user's prefs/bounds (bounds drive the Critical/Warning alarms → integrity issue).
6. **MEDIUM:** `cors()` wide open; raw DB error messages returned to clients (`e?.message`); no rate limiting on login; user-enumeration on reset (`404 User not found`); `trustServerCertificate` defaults true; `VITE_SSO_CLIENT_SECRET` present in env template (frontend bundles are public — client secret must never exist frontend-side); dead client-side `hashPassword()` (SHA-256) in `src/services/api.ts`.

---

## 1. Ground rules for ALL agents

1. **Git discipline.** Work on branches: `phase-0/restore`, `phase-1/hygiene`, `phase-2/performance`, `phase-3/deps`, `phase-4/security`, `phase-5/features`. Merge each into `main` only after its verification checklist (section 9) passes. Commit messages: `fix(scope): ...`, `perf(scope): ...`, `chore(scope): ...`, `sec(scope): ...`, `feat(scope): ...`. One logical change per commit.
2. **Before any other work:** commit the currently uncommitted working-tree changes exactly as they are with message `chore: snapshot pre-overhaul working tree (scrypt swap, reset fix)` and tag `v0.4.1-pre-overhaul`.
3. **Never** commit `vault/`, `.env*`, or any credential. Never print secret values into logs or `EXECUTION_LOG.md`.
4. **Never** run destructive SQL (`DROP`, `DELETE`, `TRUNCATE`, `UPDATE` without a reviewed migration script) against `PFX_MOULAGE_prod`. All schema changes go into versioned scripts under `db/migrations/` and are applied manually by a human.
5. Maintain `EXECUTION_LOG.md` at repo root: one dated entry per task ID (e.g., `T0.3 — done — notes`), including blockers and deviations. This is the orchestrator's audit trail.
6. Keep the existing UI design, layout, French-first labels, and i18n keys intact unless a task says otherwise. Every new user-facing string must be added to **all 4 languages** in `src/i18n/translations.ts` (fr, en, it, es).
7. TypeScript: no new `any` unless the task explicitly allows it. Build must pass `npx tsc --noEmit` and `npm run build` after every task.
8. Do not rename the `rheology` table, its columns, the API routes, or the CSV schema (`id_rheology,id_slurry,slurry_type,timestamp,source,parameter,value,unit,usl,lsl`) — external tooling depends on them.

---

## 2. PHASE 0 — Restore the dashboard (do this first, branch `phase-0/restore`)

### T0.1 — Live diagnostic (information gathering, no code changes)
On the Jetlab host (or wherever the server runs), execute and record outputs in `EXECUTION_LOG.md`:
```bash
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/slurries
curl -s "http://localhost:3001/api/rheology/latest-all?slurries=<first id from /slurries>&params=density,viscosity,pH,temperature,pc,H2O"
```
Then run (read-only) against the DB and record:
```sql
SELECT COUNT(*) AS total_rows FROM rheology;
SELECT TOP 5 id_slurry, parameter, [timestamp], value FROM rheology ORDER BY [timestamp] DESC;
SELECT DISTINCT SQL_VARIANT_PROPERTY(CAST([timestamp] AS sql_variant),'BaseType') FROM (SELECT TOP 1 [timestamp] FROM rheology) x; -- actual column type
SELECT c.name, t.name AS type_name, c.max_length FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id WHERE c.object_id=OBJECT_ID('rheology');
SELECT MIN([timestamp]) AS oldest, MAX([timestamp]) AS newest FROM rheology;
SELECT COUNT(DISTINCT LTRIM(RTRIM([parameter]))) AS distinct_params, STRING_AGG(p,',') FROM (SELECT DISTINCT LTRIM(RTRIM([parameter])) AS p FROM rheology) q;
```
Outcome decides nothing — T0.2–T0.5 are executed regardless. This is evidence for the log and for T2.4 index design.

### T0.2 — Remove the expiring freshness filters (the actual fix)
File: `src/pages/Home.tsx`.
1. **Delete** the `withData` filter (the block computing `showAny` with `210*24*60*60*1000`). Every barbotine returned by the store is rendered as a card (plus the `__new__` card), still sorted by the existing M/2/R grouping.
2. Replace the per-value windows: define at top of the component `const STALE_MS = 30*24*60*60*1000;` (30 days). A value is **always displayed** if it exists (`lastD`, `lastV`, `lastPC`, `lastH2O` non-null and `t > 0`), regardless of age. Delete `oneYear`, `threeMonths`, `sevenMonths` constants.
3. Redefine `isOnline = dbReachable && newestTs != null && (Date.now() - newestTs) <= STALE_MS`, where `newestTs` is the max `t` across the card's parameters. Offline/stale cards keep **full opacity for values** but show the badge text `t('home.stale')` (new i18n key, fr: `Données anciennes`, en: `Stale data`, it: `Dati datati`, es: `Datos antiguos`) instead of `Hors ligne` when data exists but is old. Keep `t('home.offline')` only for cards with no data at all or `dbReachable === false`.
4. Under the card title, add a line `t('home.lastMeasure')` (fr: `Dernière mesure`, en: `Last measurement`, it: `Ultima misura`, es: `Última medida`) + formatted date `new Date(newestTs).toLocaleDateString('fr-FR')` when `newestTs` exists. Style: `fontSize: 12, color: 'var(--muted)'`.
5. Bounds badges (`Critical/Warning/OK`) keep working exactly as today, applied to any displayed value.

### T0.3 — Stop coercing unparseable timestamps to `t: 0`
File: `server/index.cjs`. In `/api/slurries`, `/api/rheology`, `/api/rheology/all`, `/api/rheology/latest-all`: where the code currently does `Number.isFinite(ms) ? ms : 0` (or `undefined` → kept), **skip the row entirely** when `toMs()` returns NaN (`continue`/filter), and increment a counter; after the loop, if counter > 0, `console.warn('[rheology] skipped %d rows with unparseable timestamps', n)`. Never emit `t: 0` to the frontend.

### T0.4 — Make timestamp writes consistent with the legacy string format
File: `server/index.cjs`. Applies **only if** T0.1 confirms the column is `VARCHAR` (docs say it is). In `POST /api/rheology/point` and the CSV-import bulk table:
1. Change the `timestamp` binding from `sql.DateTimeOffset` to `sql.VarChar(32)`.
2. Serialize with a new helper placed next to `toMs()`:
```js
// formats a Date to the legacy local-time format: YYYY-MM-DDTHH:MM:SS+ZZ (Europe/Paris)
function toLegacyTs(d) {
  const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).formatToParts(d)
    .reduce((a, x) => (a[x.type] = x.value, a), {});
  const utc = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
  const paris = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const off = Math.round((paris - utc) / 3600000);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+${String(off).padStart(2,'0')}`;
}
```
3. In the CSV import, when the incoming `timestamp` cell already matches `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+\d{2}(:?\d{2})?$/`, store it **verbatim**; otherwise parse with `toMs()` and re-serialize via `toLegacyTs(new Date(ms))`. Reject the row (count it in the response as `skipped`) if unparseable.
4. Add to `db/migrations/001_normalize_timestamps.sql` (script only — DO NOT run): an `UPDATE` that rewrites any rows in DATETIMEOFFSET-stringified format (`LIKE '____-__-__ __:__:__%'` with a space) back to the legacy `T` format using `CONVERT`/`FORMAT`, with a `SELECT COUNT(*)` preview at the top and the whole thing wrapped in a commented-out `BEGIN TRAN/ROLLBACK` harness. A human runs it.

### T0.5 — Sane ordering even with mixed string formats
File: `server/index.cjs`. In every query that has `ORDER BY [timestamp]` or `ROW_NUMBER() OVER (... ORDER BY [timestamp] DESC)`, replace the sort key with `TRY_CONVERT(datetimeoffset, REPLACE([timestamp],' ','T'))` — alias it once per query as needed. In `/api/slurries`, replace `MAX([timestamp])` with `MAX(TRY_CONVERT(datetimeoffset, REPLACE([timestamp],' ','T')))`. (Performance impact is accepted until T2.4 adds the computed column; correctness wins.)

### T0.6 — Restore reachable deployment
1. Verify locally: `npm run build` then `node server/index.cjs` and confirm the SPA is served from `dist/` on `:3001` and `/api/health` responds.
2. Write `docs/DEPLOY_JETLAB.md` with the exact production procedure (this replaces running vite on Jetlab):
```bash
node ./node_modules/vite/bin/vite.js build
node server/index.cjs   # serves dist/ AND /api on BACKEND_PORT (3001)
```
   plus the note: the vite dev server (port 3000) is for development only and must not be the user-facing process. Document that the Jetlab proxy/route must point to port 3001.
3. Acceptance: opening the app cold shows the slurry cards with values (given T0.2) using only the Express process.

**Phase 0 done when:** all T0.x acceptance criteria pass, `npm run build` and `npx tsc --noEmit` are clean, branch merged to `main`, tagged `v0.5.0-restored`.

---

## 3. PHASE 1 — Repo hygiene & restructure (branch `phase-1/hygiene`)

### T1.1 — Purge junk and dead artifacts
1. `git rm -r --cached` then delete from working tree: `data/` (entire folder — production CSVs do not belong in the repo; move the files into a sibling folder OUTSIDE the repo named `../Dashboard-Safran-archive/data/` before deleting), `assets/AI image analyse.jpeg`, `assets/data screen.jpeg`, `assets/home.jpeg`, `assets/graphs page barbotine.jpeg`, `assets/login screen.jpeg`, `assets/banner_github.png`, `assets/demo-dashboard.gif` → move these screenshots to `docs/assets/` (they're referenced by README — update the README paths).
2. Delete untracked local junk: every `.DS_Store`, `._*`, and the root `.vite/` directory.
3. Move `assets/FONT-Poppins/` → `public/fonts/Poppins/` and update `@font-face` declarations in `src/app.css`/`index.html` accordingly. Delete the now-empty root `assets/`.
4. Delete root `loading_page/` after confirming `public/loading_page/ascii.txt` is identical (`diff`); update the import in `src/pages/Loading.tsx` from `../../loading_page/ascii.txt?raw` to `../../public/loading_page/ascii.txt?raw`.
5. Remove from `package.json` dependencies: `argon2` (replaced by scrypt, now unused). Run `npm install` to refresh the lockfile. Verify `node server/index.cjs` still boots.
6. Delete the dead `hashPassword()` function from `src/services/api.ts` (it is exported but used nowhere; client-side SHA-256 adds nothing).

### T1.2 — Fix `.gitignore`
Replace the whole file with this exact content (it currently contains duplicated blocks):
```
node_modules/
dist/
build/
.vite/
vault/
.env
.env.*
server/*.log
.DS_Store
._*
.idea/
.vscode/
```

### T1.3 — Restructure folders
Target tree for `src/` (move files with `git mv`; update all imports; nothing else changes):
```
src/
  main.tsx
  app/App.tsx
  assets/            (empty for now; future inline assets)
  components/        (ChartPanel, MetricPanel, ParamsModal, DebuggerFab, BarbotineCreateDialog)
  features/auth/     (AuthContext.tsx, keycloak.ts)
  i18n/
  pages/
  repositories/
  services/
  shared/
  store/
  styles/app.css     (move src/app.css and src/index.css here; keep two files)
  types/
  utils/
```
Root additions: `db/migrations/` (from T0.4), `docs/assets/`, `EXECUTION_LOG.md`.
Documentation consolidation: move `PROJECT_OVERVIEW.md`, `CODE_REVIEW.md`, `CODE_TODO.md`, `CHANGELOG.md`, `CONTRIBUTING.md` into `docs/` (keep `README.md` and `ENGINEERING_DIRECTIVES.md` at root). Update intra-doc links.

### T1.4 — Documentation truth pass
Update `docs/PROJECT_OVERVIEW.md` and `README.md` to match reality after Phases 0–1: scrypt (not Argon2), actual folder tree, the Phase 0 deployment model (Express serves `dist/`), and delete claims that are no longer true. Update `docs/SQL.md` with the T0.1 findings (actual column types). Mark `CODE_REVIEW.md` as historical (add a banner line at top: `> Historical document — superseded by ENGINEERING_DIRECTIVES.md`).

**Phase 1 done when:** tree matches the target, app builds and runs, README screenshots render on the repo host, tag `v0.5.1`.

---

## 4. PHASE 2 — Performance (branch `phase-2/performance`)

### T2.1 — Kill the artificial loading delay
File: `src/app/App.tsx`. Change `<Loading minMs={3000} serverTimeoutMs={7000} ...>` (both occurrences) to `minMs={400}` and `serverTimeoutMs={4000}`. File `src/pages/Loading.tsx`: change the defaults to match (`minMs = 400`, `serverTimeoutMs = 4000`).

### T2.2 — Cheapen the ASCII animation
File: `src/pages/Loading.tsx`. The animation has period 4. Precompute **4 frames once** in a `useMemo` keyed on `baseLines` (loop `step = 0..3`, build the full string for each), then render `frames[frame % 4]`. Delete the per-render character recomputation. Keep the 90 ms tick. Additionally, pause the rAF loop when `document.hidden` (listen to `visibilitychange`).

### T2.3 — Fix the `latest-all` query
File: `server/index.cjs`, `GET /api/rheology/latest-all`. Replace the "fetch everything, keep 2 in JS" approach with:
```sql
WITH ranked AS (
  SELECT [id_slurry],[parameter],[timestamp],[value],[unit],
         ROW_NUMBER() OVER (PARTITION BY [id_slurry], UPPER(LTRIM(RTRIM([parameter])))
                            ORDER BY TRY_CONVERT(datetimeoffset, REPLACE([timestamp],' ','T')) DESC) AS rn
  FROM [rheology]
  WHERE [id_slurry] IN (<placeholders>)
    AND UPPER(LTRIM(RTRIM([parameter]))) IN (<placeholders>)
)
SELECT * FROM ranked WHERE rn <= 2 ORDER BY [id_slurry], [parameter], rn;
```
Keep the existing JS shaping (`rn=1` → latest, `rn=2` → `prevV/prevT`).

### T2.4 — Index + computed column migration (script only)
Create `db/migrations/002_perf_indexes.sql` (human-applied):
```sql
-- 1) persisted computed columns for sargable queries
ALTER TABLE rheology ADD ts_dto AS TRY_CONVERT(datetimeoffset, REPLACE([timestamp],' ','T')) PERSISTED;
ALTER TABLE rheology ADD param_norm AS UPPER(LTRIM(RTRIM([parameter]))) PERSISTED;
-- 2) covering index for all dashboard reads
CREATE NONCLUSTERED INDEX IX_rheology_slurry_param_ts
  ON rheology (id_slurry, param_norm, ts_dto DESC)
  INCLUDE ([value], [unit], [usl], [lsl], [timestamp], [parameter]);
```
Then add to `server/index.cjs` a startup probe: `SELECT COL_LENGTH('rheology','ts_dto')`; if non-null, set a module flag `HAS_COMPUTED_COLS = true` and switch all queries to filter on `param_norm = @p` and order by `ts_dto`; otherwise keep the T0.5 expressions. Both code paths must exist and be selected at startup, logged once: `[perf] computed columns: present|absent`.

### T2.5 — Bound and downsample series payloads
File: `server/index.cjs`, `GET /api/rheology` and `GET /api/rheology/all`:
1. Accept `start`, `end` (ms epoch) query params; when present, add `AND ts >= @start AND ts <= @end` (using the T2.4-selected sort expression with `TRY_CONVERT` on the bound parameters as `datetimeoffset`).
2. Accept `maxPoints` (default **2000**, hard cap 10000). After fetching, if a series exceeds `maxPoints`, downsample server-side with **LTTB** (Largest-Triangle-Three-Buckets). Implement LTTB as a pure function in a new file `server/lib/lttb.cjs` (export `lttb(points, threshold)` operating on `{t, v}`), `require` it from `index.cjs`. Response shape unchanged.
3. File `src/services/api.ts`: pass the chart's current visible range as `start`/`end` from `fetchRheologyAll`/`fetchRheologySeries` when the caller provides one (extend signatures with optional `startTs`, `endTs`, `maxPoints` — `fetchRheologySeries` already has them; wire them into the URL, and add them to `fetchRheologyAll`). File `src/pages/Detail.tsx`: when the selected range is not `all`, pass `start = Date.now() - RANGE_MS[range]`, `end = Date.now()`.

### T2.6 — Recharts rendering costs
Files: `src/components/MetricPanel.tsx`, `src/components/ChartPanel.tsx`, `src/pages/Home.tsx`. Add `isAnimationActive={false}` to every `<Line>` (and `<Area>` if present). Ensure `dot={false}` on all series lines (already true on Home; verify Detail/MetricPanel).

### T2.7 — Server middleware & one-time DDL
File: `server/index.cjs`:
1. `npm i compression` and `app.use(compression())` immediately after `cors()`.
2. Serve static with caching: `express.static(distDir, { maxAge: '30d', immutable: true, index: false })` and keep the SPA fallback sending `index.html` with `Cache-Control: no-cache` (set header explicitly in the fallback handler). Vite emits hashed filenames so long cache is safe.
3. Move `ensureUserPrefsTable()` out of the request handlers: call it once inside the startup IIFE (after `initUserHashes()`), wrapped in try/catch that logs and continues (DB may be down at boot). Remove both per-request calls.

### T2.8 — Calm the health polling
File: `src/components/DebuggerFab.tsx`: poll interval 10 s → **60 s**, and skip the ping when `document.hidden`. File `server/index.cjs` `GET /api/health`: short-circuit — if the circuit breaker is currently open, respond `200 {ok:false, circuit:'open'}` **without** calling `getPool()` (export the breaker state via a small helper).

**Phase 2 done when:** cold load (built app, warm server) shows Home with data in < 2 s on the Jetlab network; `latest-all` response time logged before/after in `EXECUTION_LOG.md`; tag `v0.6.0`.

---

## 5. PHASE 3 — Dependency modernization (branch `phase-3/deps`)

Perform in this exact order, committing and smoke-testing (login → Home cards → Detail charts → Données table → CSV export) after **each** step:

1. **Add engines** to `package.json`: `"engines": { "node": ">=20" }`.
2. Patch/minor updates first: `npm update` (stays within semver ranges), commit.
3. `react` + `react-dom` 18 → **19** (`npm i react@19 react-dom@19 @types/react@19 @types/react-dom@19`). Fixes required: none expected for this codebase (no legacy context, no `ReactDOM.render`); verify `createRoot` path only. Run full smoke test.
4. `react-router-dom` 6 → **7** (`npm i react-router-dom@7`). This codebase uses only `BrowserRouter`, `Routes`, `Route`, `NavLink`, `useNavigate`, `useParams` — all unchanged in v7. Verify the proxy `basename` logic in `src/main.tsx` still works.
5. `recharts` 2 → **3** (`npm i recharts@3`). Check each chart renders; v3 removed some defaults — explicitly verify `ReferenceArea`, `ReferenceLine`, and Tooltip `formatter` signatures in `MetricPanel.tsx`, `ChartPanel.tsx`, `Home.tsx`.
6. `express` 4 → **5** (`npm i express@5`). Required code changes in `server/index.cjs`: the SPA fallback regex route `app.get(/^(?!\/api\/).*/)` keeps working (regex routes are still supported); confirm `req.query` immutability does not break (we only read). Run all endpoint smoke tests with `curl`.
7. `mssql` 10 → **11** (`npm i mssql@11`). Verify pool config keys unchanged and bulk import still works against a test table.
8. `keycloak-js` 23 → **26** (`npm i keycloak-js@26`). The only usage is `init/login/logout/tokenParsed` in `features/auth/` — verify signatures.
9. Remove `@types/node` pin mismatch: `npm i -D @types/node@22`.
10. Record the final `npm audit --omit=dev` output in `EXECUTION_LOG.md`; fix remaining criticals if autofixable (`npm audit fix` only, never `--force`).

**Phase 3 done when:** all smoke tests pass on Node 20+, `npm run build` clean, tag `v0.7.0`.

---

## 6. PHASE 4 — Security hardening (branch `phase-4/security`)

> Order matters: T4.1 and T4.2 close the two critical holes and ship first.

### T4.1 — Fix the password-reset takeover (CRITICAL)
File: `server/index.cjs`, `POST /api/auth/reset-request`:
1. **Never return the token in the response.** New behavior: always respond `200 {ok:true}` after constant work, whether or not the user exists (kills user enumeration too).
2. When the user exists: generate the token as today, store it, and `console.log('[auth] password reset token for %s: %s (valid 15min)', user.userId, token)` — admin-mediated reset: the operator reads the server log and communicates the link `https://<host>/reset?token=...` to the requester out-of-band. (SMTP comes in Phase 5; until then this is the decided mechanism.)
3. File `src/pages/Login.tsx`: change the forgot-password success alert to the i18n key `login.resetRequested` (fr: `Si le compte existe, un lien de réinitialisation a été généré. Contactez l'administrateur.`, plus en/it/es translations).

### T4.2 — Remove hardcoded credentials; users table (CRITICAL)
1. Create `db/migrations/003_users.sql`:
```sql
CREATE TABLE app_users (
  user_id    NVARCHAR(64)  NOT NULL PRIMARY KEY,
  email      NVARCHAR(256) NOT NULL UNIQUE,
  role       NVARCHAR(16)  NOT NULL DEFAULT 'user',  -- 'admin' | 'user'
  pwd_hash   NVARCHAR(512) NOT NULL,                  -- scrypt:<salt>:<hash>
  must_reset BIT           NOT NULL DEFAULT 1,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);
```
2. Create `server/scripts/seed-users.cjs`: reads `vault/secrets.env`, inserts the 4 known users with **freshly generated random 16-char passwords** (`crypto.randomBytes(12).toString('base64url')`), scrypt-hashes them, sets `must_reset=1`, and prints each `userId: tempPassword` **once** to stdout. Run manually by the operator.
3. `server/index.cjs`: delete the `USERS` array and `initUserHashes()`. `findUser` becomes an async DB lookup (`SELECT ... FROM app_users WHERE LOWER(user_id)=@id OR LOWER(email)=@id`). Login flow unchanged otherwise. `reset-confirm` updates `pwd_hash` and sets `must_reset=0` in the DB. If the DB is unreachable, login returns `503 {error:'auth unavailable'}` — no fallback users.
4. When a user with `must_reset=1` logs in, include `mustReset: true` in the login response; `src/pages/Login.tsx` then routes to `/reset` flow (reuse reset-request immediately for that user and show the standard message).
5. The old passwords are burned: note in `EXECUTION_LOG.md` that operators must run the seed script and distribute new temp passwords.

### T4.3 — Authenticate all data endpoints
File: `server/index.cjs`. Apply `requireAuth` to: `/api/slurries`, `/api/rheology`, `/api/rheology/all`, `/api/rheology/bounds`, `/api/rheology/latest-all`, `/api/rheology/export-csv`, `/api/alerts/latest`, and `GET /api/user-prefs`. Leave public: `/api/health`, `/api/auth/*`, static files. Frontend already attaches `Authorization` headers via `authHeaders()` everywhere except `apiHealth` (fine) and `exportCsv`/`getUserPrefs` (already covered). Verify `src/services/api.ts` sends the header on every authenticated call; add it where missing. Role gating: `POST /api/rheology/point` and `POST /api/rheology/import-csv` additionally require `req.user.role === 'admin'` → else `403`.

### T4.4 — Fix user-prefs ownership
File: `server/index.cjs`. Both `GET` and `PUT /api/user-prefs`: derive `userId` **exclusively** from `req.user.userId` (JWT). Delete the `req.query.userId` / `x-user-id` header reads. File `src/services/api.ts`: drop the `userId` query param from both calls (keep the function parameters for signature stability but ignore them, or remove them and update the 3 call sites in `App.tsx`, `boundsStore.ts` — removal is the decided option).

### T4.5 — Server hardening middleware
File: `server/index.cjs`:
1. `npm i helmet express-rate-limit`. Add `app.use(helmet({ contentSecurityPolicy: false }))` (CSP off because the SPA inlines styles; revisit later).
2. CORS: replace `app.use(cors())` with an allowlist from env `ALLOWED_ORIGINS` (comma-separated). When unset **and** `dist/` is served (same-origin), do not register CORS at all. Add `ALLOWED_ORIGINS=` to the secrets template documentation.
3. Rate limits: `/api/auth/login` and `/api/auth/reset-request` → 5 requests/min/IP (`standardHeaders: true`); all `/api/*` → 300 requests/min/IP.
4. JWT: at startup, if `!process.env.JWT_SECRET || process.env.JWT_SECRET === 'CHANGE_ME_IN_PRODUCTION'`, `console.error` and `process.exit(1)`. Sign with `{ issuer: 'safran-dashboard', audience: 'safran-dashboard' }` and verify the same.
5. Error responses: add a helper `fail(res, e)` that logs the full error server-side (`console.error`) and returns `500 {error:'internal error'}` — replace every `res.status(500).json({ error: e?.message ... })` with it. Validation errors (400/401/403/409) keep their specific messages.
6. `MSSQL_TRUST_CERT`: change the default from `'true'` to `'false'` (env can still opt in). Document in `docs/DEPLOY_JETLAB.md` that the current server uses a self-signed cert and therefore needs `MSSQL_TRUST_CERT=true` explicitly set — explicit, not silent.
7. Audit log: create `db/migrations/004_audit.sql` (`audit_log(id BIGINT IDENTITY PK, user_id NVARCHAR(64), action NVARCHAR(32), detail NVARCHAR(MAX), at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET())`). In `index.cjs`, after successful `point` insert/update, CSV import, prefs write, login, and password reset: `INSERT` a row (action ∈ `login`, `reset`, `point.write`, `csv.import`, `prefs.write`; detail = JSON summary, no secrets). Failures to audit must not fail the request (try/catch + warn). Skip silently when table absent.

### T4.6 — Frontend/secrets hygiene
1. Remove `VITE_SSO_CLIENT_SECRET` from `vault/secrets.env` template text, `README.md`, and any code reference (Keycloak public clients use PKCE only — already configured with `pkceMethod: 'S256'`). Tell the operator (via `EXECUTION_LOG.md`) to rotate that client secret in Keycloak since it sat in an env file.
2. Operator actions to record as required in `EXECUTION_LOG.md`: rotate `MSSQL_PASSWORD`, set a fresh 64-byte random `JWT_SECRET` (`openssl rand -base64 64`), run seed-users.
3. `src/app/App.tsx` line ~135: delete the hardcoded `youssef.karim@safrangroup.com → 'Editor'` role hack; derive the label purely from `user.level`/JWT role.
4. Move the Jetlab hostnames in `vite.config.ts` `allowedHosts` to env: `VITE_ALLOWED_HOSTS` (comma-separated, parsed in the config via `process.env`), defaulting to `[]`. Dev-only file but internal hostnames don't belong in a repo.

**Phase 4 done when:** unauthenticated `curl` to every data endpooint returns 401; reset-request leaks nothing; no plaintext credentials in the codebase (`git grep -iE "pfx'|safranpfx"` returns nothing); tag `v0.8.0`.

---

## 7. PHASE 5 — Complementary features (branch `phase-5/features`)

Implement in this order; each is independent and individually committed.

1. **T5.1 Auto-refresh:** wire `prefsStore.refreshInterval` (already exists) into Home and Detail: `setInterval` re-fetching `latest-all` (Home) / visible series (Detail) at the chosen interval; pause when `document.hidden`; minimum interval 30 s.
2. **T5.2 Alerts surface:** Home header gets a bell icon with a badge counting `err` statuses from `GET /api/alerts/latest` (called for all slurries, same refresh cadence). Clicking opens a dropdown listing `slurry — parameter — value unit — status`, each row navigating to the Detail page. New i18n keys under `alerts.*` in all 4 languages.
3. **T5.3 SMTP:** `npm i nodemailer`. Env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. New endpoint `POST /api/support` (auth required, Zod-validated `{category, subject, message}`) sending to `youssef.karim@safrangroup.com`; wire `src/pages/Support.tsx` to it, keeping the mailto fallback when the endpoint returns 503 (no SMTP configured). Also switch `reset-request` to email the reset link when SMTP is configured (keep console fallback).
4. **T5.4 Tests:** `npm i -D vitest supertest`. (a) Unit tests for `server/lib/lttb.cjs`, `toMs`, `toLegacyTs`, `parseCsvLine`, `shared/metricKeys.ts`. (b) API tests with `supertest` against the express app (export `app` from `index.cjs` without auto-listening when `require.main !== module`) using a mocked `mssql` layer: auth 401s, login flow, validation 400s, reset-request opacity. Add `"test": "vitest run"` script. Target: ≥ 25 assertions; all green.
5. **T5.5 Process supervision:** add `docs/DEPLOY_JETLAB.md` section for keeping the server alive: prefer `pm2` (`pm2 start server/index.cjs --name safran-dashboard`) if installable on Jetlab; otherwise provide a `nohup` + cron `@reboot` recipe. Add `GET /api/version` returning `{version}` read from `package.json` for deploy verification.
6. **T5.6 Donnees refactor:** split `src/pages/Donnees.tsx` (849 lines) into `pages/Donnees.tsx` (layout + state, ≤ 250 lines) and components `components/donnees/HistoryTable.tsx`, `components/donnees/CsvImportPanel.tsx`, `components/donnees/SqlTemplatePanel.tsx`. Pure extraction — zero behavior change. Same for `MetricPanel.tsx` (507 lines): extract `components/chart/CriticalZones.tsx` and `components/chart/ChartTooltip.tsx`.

**Phase 5 done when:** all six tasks pass their own descriptions, `npm test` green, tag `v0.9.0`.

---

## 8. Explicit non-goals (do NOT do these)

- Do not migrate to Next.js, Tailwind, Redux, Prisma, or any ORM.
- Do not redesign the UI or change the visual theme.
- Do not convert `server/index.cjs` to TypeScript or ESM in this effort (acceptable later; out of scope now). Splitting it into `server/lib/*.cjs` modules IS allowed where tasks say so.
- Do not enable Express 5's async error magic as an excuse to remove try/catch blocks.
- Do not run any migration SQL against production yourselves.
- Do not touch the Keycloak realm/server configuration.

---

## 9. Verification protocol (run at the end of every phase)

```bash
npx tsc --noEmit                 # zero errors
npm run build                    # zero errors/warnings of severity error
node server/index.cjs &          # boots without crash, logs port
curl -s localhost:3001/api/health                          # 200
curl -s localhost:3001/api/slurries                        # Phase ≥4: 401 without token; 200 with
# UI smoke (manual or scripted): login → Home shows cards with values and last-measure dates
#   → click card → Detail charts render with range buttons → Données loads table → CSV export downloads
git status --porcelain           # clean
```
Log results per phase in `EXECUTION_LOG.md` with date and commit hash.

## 10. Final state summary (what "done" looks like)

- Values visible again regardless of data age, with explicit staleness labeling (Phase 0).
- Repo contains only source, docs, public assets, and migration scripts (Phase 1).
- Sub-2-second loads, bounded payloads, indexed queries, compressed responses (Phase 2).
- React 19 / Router 7 / Recharts 3 / Express 5 / mssql 11, Node ≥ 20 (Phase 3).
- No secrets or passwords in code, all data behind JWT auth, reset flow safe, rate-limited, audited (Phase 4).
- Auto-refresh, alert bell, SMTP support/reset emails, tests, supervised deployment (Phase 5).
- Version `v0.9.0`, every phase tagged, every action logged in `EXECUTION_LOG.md`.
