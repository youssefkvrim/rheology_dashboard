# Jetlab Operator Checklist

Run this checklist on the Jetlab host or from a network segment that can reach the production SQL Server. Fill each evidence line before considering the deployment verified.

- [ ] 1. Run the T0.1 curl diagnostics:

  ```bash
  curl -s http://localhost:3001/api/health
  curl -s http://localhost:3001/api/slurries
  curl -s "http://localhost:3001/api/rheology/latest-all?slurries=<first id from /slurries>&params=density,viscosity,pH,temperature,pc,H2O"
  ```

  Run the T0.1 read-only SQL diagnostics:

  ```sql
  SELECT COUNT(*) AS total_rows FROM rheology;
  SELECT TOP 5 id_slurry, parameter, [timestamp], value FROM rheology ORDER BY [timestamp] DESC;
  SELECT DISTINCT SQL_VARIANT_PROPERTY(CAST([timestamp] AS sql_variant),'BaseType') FROM (SELECT TOP 1 [timestamp] FROM rheology) x;
  SELECT c.name, t.name AS type_name, c.max_length FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id WHERE c.object_id=OBJECT_ID('rheology');
  SELECT MIN([timestamp]) AS oldest, MAX([timestamp]) AS newest FROM rheology;
  SELECT COUNT(DISTINCT LTRIM(RTRIM([parameter]))) AS distinct_params, STRING_AGG(p,',') FROM (SELECT DISTINCT LTRIM(RTRIM([parameter])) AS p FROM rheology) q;
  ```

  Evidence:

- [ ] 2. Apply `db/migrations/001_normalize_timestamps.sql` and `db/migrations/002_perf_indexes.sql`. For `001_normalize_timestamps.sql`, run the preview `SELECT` first, then use the transaction harness exactly as written.

  Evidence:

- [ ] 3. Restart the server and confirm the startup log contains `[perf] computed columns: present`.

  Evidence:

- [ ] 4. Time `GET /api/rheology/latest-all` for all slurries before and after the index, then record both timings in `EXECUTION_LOG.md`.

  Evidence:

- [ ] 5. Perform the T0.6 deployment switch: stop the Vite process and serve only `node server/index.cjs` per `docs/DEPLOY_JETLAB.md`.

  Evidence:

- [ ] 6. Confirm the deployed package version responds:

  ```bash
  curl -s http://localhost:3001/api/version
  ```

  Evidence:

- [ ] 7. Confirm cold load is under 2 seconds and Home shows cards with last-measure dates.

  Evidence:
