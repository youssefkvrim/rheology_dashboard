-- 002_perf_indexes.sql
-- Human-applied migration only. Do not run from the application.

-- 1) persisted computed columns for sargable queries
ALTER TABLE rheology ADD ts_dto AS TRY_CONVERT(datetimeoffset, REPLACE([timestamp],' ','T')) PERSISTED;
ALTER TABLE rheology ADD param_norm AS UPPER(LTRIM(RTRIM([parameter]))) PERSISTED;

-- 2) covering index for all dashboard reads
CREATE NONCLUSTERED INDEX IX_rheology_slurry_param_ts
  ON rheology (id_slurry, param_norm, ts_dto DESC)
  INCLUDE ([value], [unit], [usl], [lsl], [timestamp], [parameter]);
