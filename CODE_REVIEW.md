# Code Review and Recommendations

Scope: audit of current repository to identify legacy artifacts, risky areas, improvements, and pending functional work. Source of truth is the code.

## High-signal findings
- Legacy simulation path still present:
  - `src/store/appState.tsx`: simulated selectors (`getSeriesForRange`, `getSeriesBetween`), `seriesM7`, `addManualSample`. These should be removed or isolated behind a dev-only guard. Live toggle reliance must be removed.
  - `src/repositories/metricsRepo.ts`: `SimMetricsRepository` only. Introduce an API-backed implementation and remove simulation.
  - `src/services/api.ts`: two placeholder functions (`fetchMetricsSeries`, `fetchMetricBetween`) throw. Either implement or delete and route calls through the repository.
- Hardcoded barbotine list:
  - `generateNames()` in `src/store/appState.tsx` seeds a static list. Replace with backend-provided list (`GET /api/slurries`) and cache only for UX continuity.
- Duplicate/overlapping files:
  - `src/app/App.tsx` is the real entry shell. `src/App.tsx` exists but is unused; remove to avoid confusion.
  - Backend files `server/index.cjs` and `server/index.js` are near duplicates. Keep a single CommonJS entry (`index.cjs`) as referenced by `package.json`, delete the ESM copy after verifying there is no external reference.
- Persistence:
  - Bounds and theme persisted to `localStorage` (`App.tsx`, `appState.tsx`). For multiuser cross-device persistence, add `/api/user-prefs` endpoints and store per-user settings in SQL. Keep local fallback.
- CSV import/export:
  - `src/pages/Donnees.tsx` UI is present but actions are disabled. Implement `GET /api/rheology/export-csv` and `POST /api/rheology/import-csv` and wire them. Import must validate schema and handle conflicts via `override` flag.
- Alerts:
  - Currently computed in frontend (Home bounding status). For reliable notifications and history, add `GET /api/alerts/latest` server-side evaluation (using latest bounds) and optionally expose `/api/alerts/history`.
- UX toggles:
  - “Live” toggle in `src/pages/Detail.tsx` should be removed (testing-only). Page still indicates online/offline from DB reachability.

## Improvements (high priority)
1) Replace simulation with API-backed repository (`ApiMetricsRepository`), update `AppStateProvider` to expose it, and stop exposing simulated selectors.
2) Fetch barbotines from backend; remove `generateNames()`.
3) Implement CSV endpoints in backend and wire frontend actions.
4) Add write endpoints (`/api/rheology/point`) and user preferences endpoints (`/api/user-prefs`).
5) Remove duplicate backend file (`server/index.js`) and unused `src/App.tsx`.

## Improvements (secondary)
- Types:
  - Consolidate metric keys mapping (e.g., `density` ↔ `densite`, `viscosity` ↔ `viscosite`) in a single utility to avoid ad-hoc conversions per endpoint.
  - Merge overlapping domain types in `src/types/domain.ts` if duplicates exist between UI and API layers.
- Error handling:
  - Wrap `fetch` responses in `services/api.ts` with user-friendly messages and structured error shapes (status code, message).
  - Use narrow try/catch around IO only; avoid swallowing errors.
- Comments:
  - Add brief, high-value comments where rationale is non-obvious (e.g., timestamp normalization, bounds single-side policy).
- Accessibility:
  - Ensure buttons with icons have `aria-label`s; check contrast in dark mode; verify keyboard focus in modals.
- Performance:
  - Memoize expensive computations already mostly handled; keep an eye on large history tables in `Donnees.tsx`.

## Pending functional work
- Server-side auth for write endpoints (bearer token validation).
- Silice/Grains real data wiring once available in DB.
- Alert history and notification channel (email/teams) if required.

## Proposed removals
- `src/App.tsx` (unused).
- Simulation series and `SimMetricsRepository` once API repo is in place.
- `server/index.js` (keep `server/index.cjs`).
- Any feature-flag code in `src/app/flags.ts` if not used.

## Risk notes
- CSV import must validate timestamps strictly (ISO with offset preferred) and normalize to epoch consistently to avoid timezone drift.
- Conflict detection must use `id_rheology` as authoritative; do not attempt fuzzy matches.
- Bounds changes should log actor and timestamp if auditability is required later.


