# SQL Schema

Authoritative structure for the rheology data table used by the dashboard (read-only from UI).

## Table Definition
```sql
CREATE TABLE rheology (
  id_rheology VARCHAR(128) PRIMARY KEY,
  id_slurry   VARCHAR(64)  NOT NULL,
  slurry_type VARCHAR(16)  NOT NULL,
  timestamp   VARCHAR(32)  NOT NULL,
  source      VARCHAR(64)  NOT NULL,
  parameter   VARCHAR(32)  NOT NULL,
  value       DECIMAL(12,3) NOT NULL,
  unit        VARCHAR(16)   NULL,
  usl         DECIMAL(12,3) NULL,
  lsl         DECIMAL(12,3) NULL
);
```

### Columns
- `id_rheology`: Unique ID for the row (see encoding below)
- `id_slurry`: Slurry identifier (e.g., `M7-3_006`, `2CN2_005`)
- `slurry_type`: Family prefix (substring of `id_slurry` before `_`, e.g., `M7-3`, `2CN2`, `R55`)
- `timestamp`: ISO local timestamp with timezone offset: `YYYY-MM-DDTHH:MM:SS+ZZ` (e.g., `2024-12-28T14:30:00+01`)
- `source`: Origin user or device (e.g., `youssef.karim`, `capteur rheonics R2304`)
- `parameter`: Metric key (e.g., `viscosity`, `density`, `pH`, `H2O`, `pc`, `temperature`, `silice`, `grain`)
- `value`: Numeric value with 3 decimals
- `unit`: Unit string, when applicable (e.g., `mPa·s`, `g/cm³`, `°C`, `L/h`, `%`)
- `usl`/`lsl`: Optional upper/lower specification limits (3 decimals)

## id_rheology Encoding
`id_rheology = id_slurry + '_' + CODE + YYMMDDHHMMSSZ`

- `id_slurry`: as above (e.g., `M7-3_006`, `2CN2_005`)
- `CODE`: single-letter code for the parameter:
  - `p` = pc (Pouvoir couvrant)
  - `v` = viscosity
  - `d` = density
  - `a` = pH
  - `h` = H2O (débit eau)
  - `t` = temperature
  - `s` = silice
  - `g` = grain
- `YYMMDDHHMMSSZ`:
  - `YY` = last two digits of year
  - `MM` = month
  - `DD` = day
  - `HH` = hour (24h)
  - `MM` = minute
  - `SS` = second
  - `Z` = timezone flag: `1` for `+01`, `2` for `+02` (Europe/Paris)

Example: `M7-3_006_v2510101300002`

## Timestamp Policy
- Store human-readable local time with explicit offset: `YYYY-MM-DDTHH:MM:SS+ZZ` (e.g., `2024-08-14T13:00:00+02`).
- Europe/Paris offset (`+01`/`+02`) should reflect the correct DST for that date.
- Server writes from `POST /api/rheology/point` and CSV import bind timestamps as `VARCHAR(32)` and normalize parseable non-legacy values back to this format.
- Server reads sort through `TRY_CONVERT(datetimeoffset, REPLACE([timestamp],' ','T'))` so legacy and SQL Server DATETIMEOFFSET-stringified rows order consistently.
- Rows with unparseable timestamps are skipped in API time-series responses and counted in server warnings instead of being emitted as `t: 0`.

## Phase 0 Diagnostic Status
- Documented expected type: `timestamp VARCHAR(32)`.
- Local verification on 2026-06-12 was blocked because this workspace could not resolve the configured SQL Server host. The actual Jetlab `sys.columns` and min/max timestamp evidence still needs to be collected on the Jetlab network; see `../EXECUTION_LOG.md`.

## Notes
- The dashboard currently reads from SQL and supports authenticated point writes / CSV import through the backend.
- Migration scripts in `../db/migrations/` are human-applied only.
