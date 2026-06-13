# Jetlab Deployment

The production-facing process must be the Express server on `BACKEND_PORT`
(default `3001`). The Vite dev/preview server is for development only and must
not be the user-facing Jetlab process.

## Build

```bash
node ./node_modules/vite/bin/vite.js build
```

## Start

```bash
node server/index.cjs
```

The Express process serves both:

- `dist/` for the single-page app.
- `/api/*` for the backend routes.

Configure the Jetlab proxy or route to point users to port `3001`, not the Vite
dev server on port `3000` or the Vite preview server.

## Environment

When the Express server serves `dist/`, the app is same-origin and
`ALLOWED_ORIGINS` should be left blank. Set it to a comma-separated allowlist
only for cross-origin browser clients.

The current Jetlab SQL Server presents a self-signed certificate. Because the
server now defaults `MSSQL_TRUST_CERT` to `false`, Jetlab must explicitly set:

```bash
MSSQL_TRUST_CERT=true
```

## Verification

```bash
curl -s http://localhost:3001/api/health
```

Then open the application through the Jetlab route and verify that Home shows
the slurry cards with values and last-measure dates using only the Express
process.
