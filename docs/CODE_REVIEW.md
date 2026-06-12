# Code Review — Post-Refactor Status

> Historical document — superseded by ENGINEERING_DIRECTIVES.md

Scope: status of all findings from the initial audit after the industrial refactoring pass.

## Resolved findings

### Security
- [x] **Server-side auth for write endpoints**: JWT `requireAuth` middleware on POST/PUT endpoints.
- [x] **Hardcoded credentials removed from frontend**: User credentials moved to backend with Argon2id hashing (m=65536, t=3, p=4).
- [x] **Password reset tokens**: Server-side generation via `crypto.randomUUID()` with 15min expiry, replacing client-side `Math.random()` stub.

### Architecture
- [x] **Monolithic state split**: `appState.tsx` replaced by 5 focused Zustand stores (barbotine, bounds, ambient, dose, prefs).
- [x] **Detail.tsx decomposed**: 1,368 lines → ~330 lines via `ChartPanel` component extraction.
- [x] **Debugger widget consolidated**: Single `DebuggerFab` component, removed duplicates from Home.tsx and Login.tsx.
- [x] **Metric key mapping centralized**: `src/shared/metricKeys.ts` provides `FRONTEND_TO_DB`, `DB_TO_FRONTEND`, `toDbKey`, `toFeKey`. Replaced 6+ ad-hoc mappings.

### Backend hardening
- [x] **`toNormKey` deduplicated**: Single module-scope function, used across all endpoints.
- [x] **Input validation**: Zod schemas on all endpoints.
- [x] **CSV parsing**: RFC 4180 compliant (handles quoted commas).
- [x] **CSV import optimized**: Bulk insert + MERGE statement (was row-by-row SELECT/INSERT/UPDATE).
- [x] **Connection pool resilience**: Exponential backoff + circuit breaker.

### Frontend quality
- [x] **i18n wired**: All page components use `t()` for user-facing strings. 4 languages (fr, en, it, es).
- [x] **localStorage scoping**: All preferences use userId-prefixed keys via `prefsStore`.
- [x] **`useState` misuse in Login.tsx**: Corrected to `useEffect`.
- [x] **`refreshInterval` wired**: `DebuggerFab` consumes `prefsStore.refreshInterval` for health checks.
- [x] **Dead code removed**: `Delete/` directory, `server/index.js`, `SimMetricsRepository`, unused API stubs, duplicate assets, excess font weights.
- [x] **`hash-wasm` removed**: Client-side hashing eliminated; all auth server-side.

### Asset cleanup
- [x] Duplicate SVGs removed (kept `public/assets/` as single source).
- [x] Poppins font trimmed to 4 weights (Regular, Medium, SemiBold, Bold).
- [x] Duplicate ML output images removed.

## Remaining items (lower priority)
- [ ] Profile page: connect to backend UTILISATEUR table for persistence.
- [ ] Support form: implement SMTP sending via backend endpoint.
- [ ] Alert notifications: email/SMS channels not yet functional.
- [ ] Silice/Grains: wire real sensor data when available.
- [ ] Accessibility: further audit for keyboard navigation, ARIA labels, contrast.
- [ ] Performance: monitor large history tables in Donnees.tsx at scale.

## Risk notes
- CSV import must validate timestamps strictly (ISO with offset preferred).
- Bounds changes should log actor and timestamp if auditability is required.
- JWT secret is in `vault/secrets.env`; rotate periodically.
- User credentials are hardcoded in `server/index.cjs`; migrate to database when user management is implemented.
