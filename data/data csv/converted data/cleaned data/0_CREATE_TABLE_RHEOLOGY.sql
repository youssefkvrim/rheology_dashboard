CREATE TABLE IF NOT EXISTS rheology (
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