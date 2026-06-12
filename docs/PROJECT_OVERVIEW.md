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
- 12. Authentication
- 13. Internationalization (i18n)
- 14. Known limitations
- Appendix: CSV and SQL

## 1. Vision
Industrial-grade single-page dashboard to supervise ceramic slurry barbotines using real SQL Server data. No simulation, no demo mode. If the database is unavailable, the UI shows empty states. Focus on clarity, security, fast iteration, and consistent UX.

## 2. Tech Stack
- Vite + React + TypeScript
- React Router
- Recharts
- Zustand (state management)
- CSS variables (themes)
- Node.js + Express + `mssql` (SQL Server)
- Keycloak OIDC (frontend SSO)
- JWT + Node crypto.scrypt (backend local auth, no native deps)
- Zod (backend input validation)
- i18n (4 languages: fr, en, it, es)

## 3. Structure
```
src/
  main.tsx              # App bootstrap, StoreInitializer
  app/
    App.tsx             # Shell, routing, theme, nav (uses t())
  components/
    ChartPanel.tsx      # Reusable chart panel (range, params, pan/zoom)
    DebuggerFab.tsx     # Single debugger FAB (server status, errors)
    MetricPanel.tsx     # Low-level Recharts wrapper
    ParamsModal.tsx     # Chart parameters modal
    BarbotineCreateDialog.tsx
  features/
    auth/               # Keycloak and auth context
  i18n/
    translations.ts     # Translation keys (fr, en, it, es)
    I18nContext.tsx      # I18nProvider, useI18n, useTranslation
    index.ts            # Re-exports
  repositories/
    metricsRepo.ts      # MetricsRepository interface + API impl (uses FRONTEND_TO_DB)
  services/
    api.ts              # HTTP client for /api endpoints (JWT bearer headers where required)
  shared/
    metricKeys.ts       # Single source of truth: FRONTEND_TO_DB, DB_TO_FRONTEND, toDbKey, toFeKey
  store/
    barbotineStore.ts   # Zustand: barbotine list + loading
    boundsStore.ts      # Zustand: global & per-barbotine bounds, stripLegacyBounds
    ambientStore.ts     # Zustand: ambient conditions placeholder
    doseStore.ts        # Zustand: dose rate, cover power, plaque source
    prefsStore.ts       # Zustand: theme, accent, notifs, refresh, language (userId-prefixed)
    chartParams.tsx     # Per-chart UI params (per-barbotine)
  types/
    domain.ts           # Domain models and shared types
  utils/
    units.ts            # Unit conversion utilities
  pages/                # Page components (Home, Detail, Donnees, etc.)
  styles/
    app.css             # Main styles and Poppins @font-face declarations
    index.css           # Minimal global entry styles
server/
  index.cjs             # Express API: JWT auth, Zod validation, circuit breaker, MERGE import
db/
  migrations/           # Human-applied SQL migration scripts
docs/
  assets/               # Documentation screenshots and demo media
public/
  fonts/Poppins/        # Runtime Poppins fonts
vault/
  secrets.env           # DB credentials, JWT_SECRET (gitignored)
```

## 4. Routing
Defined in `app/App.tsx`:
  - `/` → `Home`
  - `/barbotine/:id` → `Detail`
  - `/donnees` → `Donnees`
  - `/moulage` → `Moulage` (placeholder)
  - `/loading` → `Loading` (full-page ASCII loader)
  - `/params` → `Params`
  - `/profile` → `Profile`
  - `/support` → `Support`
  - `/reset` → `Reset`

## 5. State Management (Zustand)
Monolithic `appState.tsx` was replaced by 5 focused Zustand stores:

- **barbotineStore**: `barbotines[]`, `initialDataLoading`, `loadBarbotines()`, `addBarbotine()`
- **boundsStore**: `bounds` (global), `boundsById` (per-barbotine), `stripLegacyBounds()`, debounced backend sync
- **ambientStore**: `ambient`, `ambientHistory` (placeholder for real room sensors)
- **doseStore**: `doseRateLph`, `doseRateHistory`, `coverPowerHistory`, `lastPlaqueSrc`
- **prefsStore**: `theme`, `accentColor`, `notifChannel`, `notifTypes`, `refreshInterval`, `language` — all userId-prefixed in localStorage

`StoreInitializer` in `main.tsx` coordinates initial loading and login-triggered reloads.

## 6. UI Shell (`src/app/App.tsx`)
- Theme toggle; persisted to backend for authenticated users, fallback to local.
- Auth via Keycloak; `AuthProvider` exposes `ready`, `isAuthenticated`, `user`, `login`, `logout`.
- Navigation labels use `t()` for i18n.
- Single `DebuggerFab` component (FAB in bottom-right) tracks server health, fetch stats, and JS errors.
- Full-screen ASCII loader gates post-login navigation until SQL barbotine list loads.

## 7. Pages
### Home (`src/pages/Home.tsx`)
- Ambient mini-cards; barbotine cards with latest values and trend.
- Cards remain visible when data is old. Values display when present with a valid timestamp; measurements older than 30 days are labeled as stale.
- Create barbotine dialog. All text uses `t()`.

### Detail (`src/pages/Detail.tsx`)
- ~330 lines (down from 1,368). Uses `ChartPanel` for all metric displays.
- Panels: Density, Viscosity, Temperature, pH, Cover Power, H₂O flow, Silice, Grains, Dose Rate.
- Uses `FRONTEND_TO_DB` for data mapping. Unit conversions via `utils/units.ts`.

### Données (`src/pages/Donnees.tsx`)
- History table per day; editable cells generate SQL templates.
- CSV Import/Export wired to backend. Uses `ALL_DB_KEYS` from shared metric keys.

### Profile (`src/pages/Profile.tsx`)
- Avatar upload (local preview), editable name/email/phone. All text uses `t()`.
- Access rights request dialog.

### Params (`src/pages/Params.tsx`)
- Notification channel, accent color, language selector, refresh interval, default chart settings.
- All text uses `t()`. Language synced with `prefsStore` via `I18nProvider`.

### Support (`src/pages/Support.tsx`)
- Contact form with categories, FAQ section. All text uses `t()`.

## 8. Charts conventions
- `ChartPanel` encapsulates: range selection, ParamsModal trigger, optional drag/pan/zoom, MetricPanel rendering.
- Recharts; primary series first, average second; dashed red for averages.
- X axis is time; tooltips show local date/time.
- Critical zones (%) shade near bounds; single-bound cases supported.

## 9. Styling (`src/styles/app.css`)
- CSS variables for theme palette. Poppins font (Regular, Medium, SemiBold, Bold only).
- Layout primitives: `.grid`, `.row`, `.panel`, `.card`, `.badge`, `.chart`, `.segmented`.
- Modal: `.modal-backdrop`, `.modal`, `.modal-header`, `.modal-body`.

## 10. Data layer
- `MetricsRepository` abstracts read access using `FRONTEND_TO_DB` from `src/shared/metricKeys.ts`.
- Centralized bilingual key mapping eliminates ad-hoc conversions.
- API-backed implementation consumes `services/api.ts` to call:
  - `/api/rheology` (single metric series)
  - `/api/rheology/all` (multiple metrics + bounds option)
  - `/api/rheology/latest-all` (latest snapshots)
  - `/api/rheology/bounds` (latest bounds per metric)

## 11. Backend API (`server/index.cjs`)
- Database: `PFX_MOULAGE_prod` on SQL Server.
- **Connection pool**: exponential backoff + circuit breaker for resilience.
- **Input validation**: Zod schemas on all endpoints.
- **CSV parsing**: RFC 4180 compliant (handles quoted fields with commas).
- **CSV import**: Bulk insert into temp table + single MERGE statement (not row-by-row).
- **Timestamps**: Read queries order with `TRY_CONVERT(datetimeoffset, REPLACE([timestamp],' ','T'))`; API responses skip unparseable timestamps rather than emitting `t: 0`.
- **`toNormKey`**: Single module-scope utility for parameter normalization.
- **`toFrontendKey`**: Reverse mapping DB → frontend French keys.

### Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/health | — | Server health check |
| GET | /api/slurries | — | Distinct slurry IDs |
| GET | /api/rheology | — | Single parameter series |
| GET | /api/rheology/all | — | Multi-parameter series (+bounds) |
| GET | /api/rheology/bounds | — | Latest bounds per metric |
| GET | /api/rheology/latest-all | — | Latest snapshots across slurries |
| GET | /api/rheology/export-csv | — | CSV download |
| POST | /api/rheology/import-csv | JWT | CSV import (MERGE) |
| POST | /api/rheology/point | JWT | Insert/update single point |
| GET | /api/alerts/latest | — | Server-side alert evaluation |
| GET | /api/user-prefs | — | Get user preferences |
| PUT | /api/user-prefs | JWT | Update user preferences |
| POST | /api/auth/login | — | Local auth (returns JWT) |
| POST | /api/auth/reset-request | — | Request password reset |
| POST | /api/auth/reset-confirm | — | Confirm password reset |

## 12. Authentication
- **Frontend SSO**: Keycloak OIDC via `features/auth/AuthContext.tsx`.
- **Local auth**: Backend `POST /api/auth/login` validates credentials with Node built-in `crypto.scrypt` (N=16384, r=8, p=1, keylen=64), returns JWT. No native dependencies.
- **JWT**: `Authorization: Bearer <token>` header sent on all API requests via `api.ts`. Backend `requireAuth` middleware protects write endpoints.
- **Password reset**: Server-side tokens via `crypto.randomUUID()`, stored in memory with 15min expiry. Phase 4 still needs to remove token leakage from reset-request responses.
- **Users**: Hardcoded in `server/index.cjs` (youssef.karim, wala.gloulou, benoit.marie, aliz.pinto-mora). Passwords hashed at server startup.
- **Secrets**: `JWT_SECRET` in `vault/secrets.env`.

## 13. Internationalization (i18n)
- 4 languages: French (default), English, Italian, Spanish.
- `src/i18n/translations.ts`: ~170+ keys per language.
- `I18nProvider` reads language from `prefsStore` (userId-prefixed localStorage).
- `useTranslation()` hook returns `t(key)` function.
- All page components wire `t()` for user-facing strings.
- Params page has language selector that updates globally.

## 14. Known limitations
- Silice/Grains panels display when data is present; empty otherwise.
- Profile page not yet connected to a backend UTILISATEUR table.
- Support form uses mailto fallback; SMTP integration pending.
- Alert notifications (email/SMS) not yet implemented.

## Appendix
### CSV Import
See `CSV.md` for format and validation rules.

### SQL Schema
See `SQL.md` for table definition, `id_rheology` encoding, and timestamp policy.
