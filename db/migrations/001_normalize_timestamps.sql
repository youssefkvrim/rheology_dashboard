-- 001_normalize_timestamps.sql
-- Human-applied migration only. Do not run from the application.
--
-- Purpose:
--   Preview and normalize rows whose VARCHAR timestamp was stringified from
--   DATETIMEOFFSET as "YYYY-MM-DD HH:MM:SS..." instead of the legacy
--   "YYYY-MM-DDTHH:MM:SS+ZZ" Europe/Paris format.

SELECT COUNT(*) AS rows_to_normalize
FROM dbo.rheology
WHERE [timestamp] LIKE '____-__-__ __:__:__%';

/*
BEGIN TRAN;

UPDATE r
SET [timestamp] = FORMAT(x.dto, 'yyyy-MM-ddTHH:mm:ss') + LEFT(FORMAT(x.dto, 'zzz'), 3)
FROM dbo.rheology AS r
CROSS APPLY (
  SELECT TRY_CONVERT(datetimeoffset, REPLACE(r.[timestamp], ' ', 'T')) AS dto
) AS x
WHERE r.[timestamp] LIKE '____-__-__ __:__:__%'
  AND x.dto IS NOT NULL;

SELECT COUNT(*) AS rows_still_to_normalize
FROM dbo.rheology
WHERE [timestamp] LIKE '____-__-__ __:__:__%';

-- Review the results before changing ROLLBACK to COMMIT.
ROLLBACK;
-- COMMIT;
*/
