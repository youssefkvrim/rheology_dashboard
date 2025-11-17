# Safran Slurries Dashboard (Demo)

![status-badge](https://img.shields.io/badge/docs-unified-brightgreen)

Lightweight, front-only dashboard (Vite + React + TypeScript) to visualize simulated slurries data with Recharts and React Router. English documentation; UI labels may appear in French.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Scripts](#scripts)
- [Browser Support](#browser-support)
- [Screenshots](#screenshots)
- [Deeper Docs](#deeper-docs)
- [License & Contributing](#license--contributing)

## Overview
Front-only UI with optional SQL proxy (under `/api`) for real data when available; otherwise deterministic simulated data. No server writes from the UI.

### Deployment (Safran Jetlab)
- Host: `https://js-806cdd3e-6896-40f7-8d07-5d82cb2bafdd.apps.dev.dc1.cloud.safran/`
- To allow the app to run behind the Jetlab reverse proxy, `vite.config.ts` includes `allowedHosts` entries for dev/preview:

```137:143:/Users/youssefkarim/Desktop/Dashboard Safran/vite.config.ts
export default defineConfig({
  plugins: [react(), sqlProxyPlugin()],
  server: { port: 3000, host: true, allowedHosts:[
    'js-806cdd3e-6896-40f7-8d07-5d82cb2bafdd.apps.dev.dc1.cloud.safran' ] },
  preview: { port: 3000, host: true, allowedHosts:[
    'js-806cdd3e-6896-40f7-8d07-5d82cb2bafdd.apps.dev.dc1.cloud.safran' ]  },
});
```

If your deployment host changes, update those entries accordingly.

#### Rebuild on each new Jetlab release
After pushing a new version to Jetlab, rebuild the app in the Jetlab runtime:

```bash
# set project registry to npm-group
cat > .npmrc <<'EOF'
registry=https://artifacts.cloud.one.ad/repository/npm-group/
@vite:registry=https://artifacts.cloud.one.ad/repository/npm-group/
@types:registry=https://artifacts.cloud.one.ad/repository/npm-group/
strict-ssl=false
EOF

# clean slate only if needed
rm -rf node_modules package-lock.json

# pin versions compatible with your Node v20.8
npm pkg set devDependencies.vite="^6.0.11"
npm pkg set devDependencies.@vitejs/plugin-react="^4.3.1"

# OPTIONAL: if @types/* still 404, drop them (not needed to run/build)
npm pkg delete devDependencies.@types/node devDependencies.@types/react devDependencies.@types/react-dom || true

# install
npm install

# build
npm run build

# configure backend secrets (SQL Server) if not done yet
mkdir -p vault
cat > vault/secrets.env <<'EOF'
# Backend port (serve both UI and API)
BACKEND_PORT=3000
# SQL Server connection
MSSQL_SERVER=Y005N8C.rd1.rf1
MSSQL_INSTANCE=DATATECH_PFX
MSSQL_DATABASE=PFX_suivi_barbotine
MSSQL_USER=admin_pfx
MSSQL_PASSWORD=REPLACE_ME
MSSQL_ENCRYPT=true
MSSQL_TRUST_CERT=true
EOF

# start unified backend (serves dist/ + /api + SPA fallback)
npm run server
```

- This unified server fixes both issues:
  - `/api/*` requests are handled by the Node backend (no 404).
  - Deep links (e.g., `/donnees`) fall back to `index.html` (no 404 on reload).
- If you must keep a separate reverse proxy, route `/api/*` to this backend and serve `index.html` for any non‑file, non‑/api path.

### Data Source (Dev backend)
During development, the Node backend (server/index.js) exposes read-only SQL endpoints under `/api/rheology/*` and Vite proxies `/api` to `http://localhost:3001` (see `vite.config.ts`).

The UI only reads from these endpoints; no write operations are performed. See [docs/SQL.md](docs/SQL.md) for schema and ID encoding.

### Production Data (SQL Server backend)
- A small Node.js backend under `server/` connects to the production SQL Server and exposes the same read-only endpoints under `/api/rheology/*`.
- Secrets are stored in `vault/secrets.env` (ignored by git). Copy and edit:
  1) `cp vault/secrets.example.env vault/secrets.env`
  2) Fill `MSSQL_*` with your production values.
- Run locally:
  - `npm run server` (starts on `http://localhost:3001`)
  - Vite will proxy `/api` to the backend by default (unless `VITE_SQL_PROXY=1` is set).
- Environment variables:
  - Client: `VITE_SQL_PROXY=1` to use the dev MySQL proxy; otherwise the backend is used via `/api`.
  - Server: `BACKEND_PORT`, `MSSQL_SERVER`, `MSSQL_INSTANCE`, `MSSQL_DATABASE`, `MSSQL_USER`, `MSSQL_PASSWORD`, `MSSQL_PORT`, `MSSQL_ENCRYPT`, `MSSQL_TRUST_CERT`.
  - Mapping from ODBC connection string:
    - `DRIVER={ODBC Driver 18 for SQL Server};SERVER=tcp:Y005N8C.rd1.rf1\DATATECH_PFX;DATABASE=PFX_suivi_barbotine;ENCRYPT=yes;UID=admin_pfx;PWD=***;TrustServerCertificate=true`
    - Set: `MSSQL_SERVER=Y005N8C.rd1.rf1`, `MSSQL_INSTANCE=DATATECH_PFX`, `MSSQL_DATABASE=PFX_suivi_barbotine`, `MSSQL_USER=admin_pfx`, `MSSQL_PASSWORD=***`, `MSSQL_ENCRYPT=true`, `MSSQL_TRUST_CERT=true`

## Features
- Home: barbotine cards (online/offline), latest values, status badges; Ambient cards (Room Temperature, Room Humidity) with mini-charts.
- Detail: real‑time charts (Density, Viscosity, Temperature, pH), Covering Power history, Mass test, H₂O Flow, plus Silica and Grains panels (axes only if no data).
- Unified chart parameters modal: Custom Period (Start/End), Compliance min/max, Unit, Average toggle, Critical zones (%).
- Données: SQL-backed history table per day, CSV import UI (visual), CSV export controls; testing-only SQL generator panel (no DB writes).
- Alerts: threshold breaches table + basic CSV import (temporary).

## Quick Start
Prerequisites: Node.js ≥ 18

```bash
npm install
npm run dev
```
Open `http://localhost:5173`.

Build and local preview:
```bash
npm run build && npm run preview
```

## Scripts
| Script | Description |
|-------:|-------------|
| `dev` | Run Vite in development mode |
| `build` | Production build |
| `preview` | Serve the local production build |

## Browser Support
Modern evergreen browsers (Chromium, Firefox, Safari). Mobile not optimized. Time handling relies on the browser `Date` implementation.

## Demo
![Dashboard Demo](assets/demo-dashboard.gif)

## Deeper Docs
- Architecture, state, routing, chart conventions: see [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md#1-vision)
- CSV import format and rules: see [docs/CSV.md](docs/CSV.md)
- SQL schema (DDL, id encoding, timestamp policy): see [docs/SQL.md](docs/SQL.md)
- Glossary and units: see [docs/Glossary.md](docs/Glossary.md)
- Accessibility targets: see [docs/A11y.md](docs/A11y.md)
- Performance guidance: see [docs/Performance.md](docs/Performance.md)
- Contribution guidelines: see [CONTRIBUTING.md](CONTRIBUTING.md)

## License & Contributing
Proprietary. See [LICENSE](LICENSE). Contributions welcome via PRs; read [CONTRIBUTING.md](CONTRIBUTING.md).