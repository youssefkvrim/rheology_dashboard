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

## Process Supervision

Prefer `pm2` if it can be installed on Jetlab:

```bash
pm2 start server/index.cjs --name safran-dashboard
pm2 save
pm2 startup
```

Use the command printed by `pm2 startup` to register the boot service for the
Jetlab user. Common operating commands:

```bash
pm2 status safran-dashboard
pm2 logs safran-dashboard
pm2 restart safran-dashboard
```

If `pm2` is not installable, use `nohup` plus a reboot cron entry from the repo
folder:

```bash
nohup node server/index.cjs >> server/server.log 2>&1 &
crontab -e
```

Add this line to the crontab, replacing the path with the Jetlab checkout path:

```cron
@reboot cd /path/to/Dashboard\ Safran && nohup node server/index.cjs >> server/server.log 2>&1 &
```

## Environment

When the Express server serves `dist/`, the app is same-origin and
`ALLOWED_ORIGINS` should be left blank. Set it to a comma-separated allowlist
only for cross-origin browser clients.

The current Jetlab SQL Server presents a self-signed certificate. Because the
server now defaults `MSSQL_TRUST_CERT` to `false`, Jetlab must explicitly set:

```bash
MSSQL_TRUST_CERT=true
```

Support and password-reset emails use SMTP when these variables are set:

```bash
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

`SMTP_HOST` and `SMTP_FROM` are required to enable email delivery. Without them,
the support form falls back to a pre-filled `mailto:` link and password reset
requests keep the server-log token fallback.

## Verification

```bash
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/version
```

Then open the application through the Jetlab route and verify that Home shows
the slurry cards with values and last-measure dates using only the Express
process.
