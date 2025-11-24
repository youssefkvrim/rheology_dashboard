# Code TODO (derived from CODE_REVIEW.md)

Legend: [x] done · [ ] pending · [~] partial

## High-signal items
- [x] Replace simulation with API-backed repository
  - Implemented `ApiMetricsRepository` and wired in `AppStateProvider`
  - Removed fake graph generation for ambient, dose history, and cover history
- [x] Fetch barbotines from backend
  - `GET /api/slurries` implemented and used on Home
- [x] CSV export/import endpoints and wiring
  - Backend: `GET /api/rheology/export-csv`, `POST /api/rheology/import-csv?override=0|1`
  - Frontend wired in `Donnees.tsx` with conflict handling
- [x] Write endpoints + user prefs
  - `POST /api/rheology/point`, `GET/PUT /api/user-prefs`
  - Theme and bounds persisted per-user (with local fallback)
- [ ] Remove duplicate backend file
  - Keep `server/index.cjs` and delete `server/index.js` after verifying no external reference
- [ ] Remove unused `src/App.tsx`
  - The app uses `src/app/App.tsx`; delete legacy `src/App.tsx` after verification

## Secondary improvements
- [~] Types consolidation (metric key mapping)
  - Pending: centralize density/densite, viscosity/viscosite, etc.
- [~] Error handling polish
  - Frontend API shows clean messages; continue to standardize
- [~] Comments (critical rationale)
  - Added around bounds usage and AI modal; continue selectively
- [~] Accessibility
  - Tooltips/aria-labels added in places; further audit recommended
- [~] Performance
  - No hotspots observed; keep an eye on large history tables

## Pending functional work
- [ ] Server-side auth for write endpoints (bearer validation/RBAC)
- [ ] Silice/Grains: wire real data when available
- [ ] Alerts: history and notifications if needed

## Proposed removals (cleanup)
- [ ] `src/App.tsx` (legacy)
- [ ] Simulation scaffolding once fully unused
- [ ] `server/index.js` (keep `index.cjs`)
- [ ] Unused feature flags in `src/app/flags.ts`

## Notes
- CSV: strict timestamp validation and epoch normalization are enforced on import; conflict detection by `id_rheology`.
- Bounds: only displayed when data exists; empty charts hide Y axis by default.


