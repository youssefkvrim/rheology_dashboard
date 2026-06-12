# Code TODO — Post-Refactor

Legend: [x] done · [ ] pending

## Completed in industrial refactor

### Phase 1: Cleanup
- [x] Delete dead files: `Delete/`, `server/index.js`, duplicate assets
- [x] Remove dead simulation code from appState, api.ts, metricsRepo, Detail, Home
- [x] Trim Poppins to used weights (Regular, Medium, SemiBold, Bold)

### Phase 2: Backend hardening
- [x] JWT auth: `POST /api/auth/login`, `requireAuth` middleware on write endpoints
- [x] Move user credentials to backend with Argon2id hashing
- [x] Server-side password reset tokens (crypto.randomUUID, 15min expiry)
- [x] Deduplicate `toNormKey` into single module-scope function
- [x] Add Zod input validation + RFC 4180 CSV parsing
- [x] Exponential backoff + circuit breaker on SQL connection pool
- [x] Bulk MERGE for CSV import (replaces row-by-row)

### Phase 3: State management
- [x] Migrate `appState.tsx` → 5 Zustand stores (barbotine, bounds, ambient, dose, prefs)
- [x] Consolidate bounds: single `stripLegacyBounds`, clear source-of-truth flow
- [x] All localStorage keys userId-prefixed

### Phase 4: Frontend refactoring
- [x] Extract `ChartPanel` component, reduce Detail.tsx (~1,368 → ~330 lines)
- [x] Consolidate debugger widget into single `DebuggerFab` component
- [x] Fix `useState` misuse in Login.tsx → `useEffect`
- [x] Wire `refreshInterval` from prefsStore into DebuggerFab health check
- [x] Create `src/shared/metricKeys.ts` — single METRIC_KEY_MAP, replace all ad-hoc mappings

### Phase 5: Internationalization
- [x] Wire `t()` into all pages: Home, Detail, Donnees, Login, Profile, Params, Support, Moulage
- [x] Add missing translation keys for all 4 languages (fr, en, it, es)
- [x] Sync I18nProvider with prefsStore language setting

### Phase 6: Documentation
- [x] Update PROJECT_OVERVIEW.md
- [x] Update CODE_REVIEW.md
- [x] Update CODE_TODO.md

## Remaining work

### Backend
- [ ] Migrate hardcoded users to database table
- [ ] Implement SMTP email sending for support form (`POST /api/support`)
- [ ] Implement alert notification channels (email/SMS)
- [ ] Wire Silice/Grains real sensor data when available

### Frontend
- [ ] Connect Profile page to backend UTILISATEUR table
- [ ] Accessibility audit (keyboard nav, ARIA, contrast)
- [ ] Performance monitoring for large history tables

### Operations
- [ ] Rotate JWT_SECRET periodically
- [ ] Add audit logging for bounds changes
- [ ] Set up CI/CD pipeline
