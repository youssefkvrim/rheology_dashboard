# PROJECT_OVERVIEW

Authoritative technical documentation for architecture, state, routing, data flow, and chart conventions.

## Contents
- 1. Vision
- 2. Tech Stack
- 3. Structure
- 4. Routing
- 5. State Management
- 6. UI Shell
- 7. Pages
- 8. Charts conventions
- 9. Styling
- 10. Data layer
- 11. Backend API
- 12. Known limitations
- Appendix: CSV and SQL

## 1. Vision
Single-page dashboard to supervise barbotines using real SQL data only. If the database is unavailable, the UI shows empty states instead of simulated data. Focus on clarity, fast iteration, and consistent UX.

## 2. Tech Stack
- Vite + React + TypeScript
- React Router
- Recharts
- CSS variables (themes)
- Node.js + Express + `mssql` (SQL Server)
- Keycloak OIDC (frontend)

## 3. Structure
```
src/
  main.tsx            # App bootstrap
  app/
    App.tsx           # shell, routing, theme
    flags.ts          # legacy flags (to be removed if unused)
  components/         # ParamsModal, MetricPanel, dialogs
  features/
    auth/             # Keycloak and auth context
  repositories/
    metricsRepo.ts    # MetricsRepository interface (+ API impl)
  services/
    api.ts            # HTTP client for /api endpoints
  store/
    appState.tsx      # Global state (bounds, ambient, UI), repository seam
    chartParams.tsx   # Per-chart UI params
  types/
    domain.ts         # Domain models and shared types
  app.css             # Styles
server/
  index.cjs           # Express API for SQL Server (read/write)
```

## 4. Routing
Defined in `app/App.tsx`:
  - `/` → `Home`
  - `/barbotine/:id` → `Detail`
  - `/donnees` → `Donnees`
- `/loading` → `Loading` (full-page ASCII loader test)
  - `/params` → `Params`
- `/reset` → `Reset`

## 5. State Management (`src/store/appState.tsx`)
- Context: `AppStateProvider` → `useAppState()`.
- AppState surface (selected):
  - `barbotines`: list loaded from backend (`/api/slurries`); persisted only for UX convenience.
  - `bounds` and `boundsById`: defaults locally; persisted to backend for authenticated users.
  - `ambient`, `ambientHistory`: room telemetry for mini-charts (local).
  - `doseRateLph`, `doseRateHistory`, `coverPowerHistory`: local panels.
  - Actions: `setBounds`, `setBoundsFor`, `addBarbotine`, `applyMetricPoints`, etc.
  - Repository seam: `repo` implements `MetricsRepository` backed by API.
- No simulated metric series remain. Charts render real data if available; otherwise, empty datasets.
- Bounds and Validation:
  - Nullable bounds (`low`/`high`); comparisons account for missing sides.
  - Decimal inputs accept comma or dot.
  - UI tolerates single-bound entry and visually completes the opposite bound for ranges only.
- Time policy:
  - Charts in browser local time.
  - CSV accepts epoch or ISO with offset (server normalizes).

## 6. UI Shell (`src/app/App.tsx`)
- Theme toggle; persisted to backend for authenticated users, fallback to local.
- Auth via Keycloak; `AuthProvider` exposes `ready`, `isAuthenticated`, `user`, `login`, `logout`.
- Footer with attribution.
- Full-screen ASCII loader gates post-login navigation until SQL barbotine list loads (auto timeouts after 5s for resiliency).

## 7. Pages
### Home (`src/pages/Home.tsx`)
- Ambient mini-cards; barbotine cards with latest values and trend; online derived from recency and DB reachability.
- Create barbotine dialog adds entries for client-side navigation; real-time data always comes from DB.

### Detail (`src/pages/Detail.tsx`)
- Density, Viscosity, Temperature, pH; Covering Power history; H₂O flow; Silice/Grains panels.
- Panning, adjustable Y ranges, unified Params modal, averages and critical zones.
- Live toggle removed. Page reflects online/offline state; no simulation fallback.

### Données (`src/pages/Donnees.tsx`)
- History table per day with per-family ordering; editable cells generate SQL templates (testing-only panel).
- CSV Import/Export wired to backend. Import requires schema:
  `id_rheology,id_slurry,slurry_type,timestamp,source,parameter,value,unit,usl,lsl`.
  Conflicts on existing `id_rheology` return 409 unless override is requested.
- Testing-only loading overlay uses ASCII served from `public/loading_page/ascii.txt` (fetched first), with fallback to bundled `loading_page/ascii.txt?raw`.

## 8. Charts conventions
- Recharts; primary series first, average second; dashed red line for averages.
- X axis is time; tooltips show local date/time; trend is visual only.
- Critical zones (%) shade near bounds; single-bound cases supported.

## 9. Styling (`src/app.css`)
- CSS variables for theme palette.
- Layout primitives: `.grid`, `.row`, `.panel`, `.card`, `.badge`, `.chart`, `.segmented`.
- Modal: `.modal-backdrop`, `.modal`, `.modal-header`, `.modal-body`.

## 10. Data layer
- `MetricsRepository` abstracts read access.
- API-backed implementation consumes `services/api.ts` to call:
  - `/api/rheology` (single metric series),
  - `/api/rheology/all` (multiple metrics + bounds option),
  - `/api/rheology/latest-all` (latest snapshots),
  - `/api/rheology/bounds` (latest bounds per metric).
- All pages should prefer the repository seam for consistency.

## 11. Backend API (Node + SQL Server)
- `server/index.cjs` exposes:
  - `GET /api/health`
  - `GET /api/slurries` — distinct `id_slurry`
  - `GET /api/rheology` — single parameter series
  - `GET /api/rheology/all` — multi-parameter series (+bounds)
  - `GET /api/rheology/bounds` — latest bounds per metric
  - `GET /api/rheology/latest-all` — latest snapshots across slurries/params
  - `GET /api/rheology/export-csv` — CSV download within a time window
  - `POST /api/rheology/import-csv?override=0|1` — CSV import with conflict handling
  - `POST /api/rheology/point` — insert/update a single point
  - `GET /api/alerts/latest` — evaluate alerts server-side
  - `GET /api/user-prefs` / `PUT /api/user-prefs` — persist bounds/theme per user
- Secrets in `vault/secrets.env`. Vite proxies `/api` to `http://localhost:3001` in dev.

## 12. Known limitations
- Server-side auth/authorization enforcement for write endpoints is not yet wired.
- Silice/Grains panels display when data is present; empty otherwise.
- Some legacy simulation scaffolding may remain; do not use for data.

## Appendix
### CSV Import
See `docs/CSV.md` for format and validation rules.

### SQL Schema
See `docs/SQL.md` for table definition, `id_rheology` encoding, and timestamp policy.

