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

INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_p2408141300002', '2CN2_005', '2CN2', '2024-08-14T13:00:00+02', 'benoit.marie', 'pc', 4.416, 'g', 5.400, 4.900);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_p2408191300002', '2CN2_005', '2CN2', '2024-08-19T13:00:00+02', 'benoit.marie', 'pc', 4.873, 'g', 5.400, 4.900);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_p2408201300002', '2CN2_005', '2CN2', '2024-08-20T13:00:00+02', 'benoit.marie', 'pc', 4.614, 'g', 5.400, 4.900);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_p2408211300002', '2CN2_005', '2CN2', '2024-08-21T13:00:00+02', 'benoit.marie', 'pc', 4.371, 'g', 5.400, 4.900);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_p2408221300002', '2CN2_005', '2CN2', '2024-08-22T13:00:00+02', 'benoit.marie', 'pc', 4.625, 'g', 5.400, 4.900);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_p2408231300002', '2CN2_005', '2CN2', '2024-08-23T13:00:00+02', 'benoit.marie', 'pc', 4.211, 'g', 5.400, 4.900);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_d2408141300002', '2CN2_005', '2CN2', '2024-08-14T13:00:00+02', 'benoit.marie', 'density', 2.382, 'g', 242.000, 236.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_d2408191300002', '2CN2_005', '2CN2', '2024-08-19T13:00:00+02', 'benoit.marie', 'density', 2.385, 'g', 242.000, 236.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_d2408201300002', '2CN2_005', '2CN2', '2024-08-20T13:00:00+02', 'benoit.marie', 'density', 2.385, 'g', 242.000, 236.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_d2408211300002', '2CN2_005', '2CN2', '2024-08-21T13:00:00+02', 'benoit.marie', 'density', 2.382, 'g', 242.000, 236.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_d2408221300002', '2CN2_005', '2CN2', '2024-08-22T13:00:00+02', 'benoit.marie', 'density', 2.390, 'g', 242.000, 236.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_d2408231300002', '2CN2_005', '2CN2', '2024-08-23T13:00:00+02', 'benoit.marie', 'density', 2.394, 'g', 242.000, 236.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_h2408141300002', '2CN2_005', '2CN2', '2024-08-14T13:00:00+02', 'benoit.marie', 'H2O', 0.014, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_h2408191300002', '2CN2_005', '2CN2', '2024-08-19T13:00:00+02', 'benoit.marie', 'H2O', 0.012, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_h2408201300002', '2CN2_005', '2CN2', '2024-08-20T13:00:00+02', 'benoit.marie', 'H2O', 0.012, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_h2408211300002', '2CN2_005', '2CN2', '2024-08-21T13:00:00+02', 'benoit.marie', 'H2O', 0.000, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_h2408221300002', '2CN2_005', '2CN2', '2024-08-22T13:00:00+02', 'benoit.marie', 'H2O', 0.000, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_h2408231300002', '2CN2_005', '2CN2', '2024-08-23T13:00:00+02', 'benoit.marie', 'H2O', 0.012, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_v2408141300002', '2CN2_005', '2CN2', '2024-08-14T13:00:00+02', 'benoit.marie', 'viscosity', 7.850, 's', 14.000, 8.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_v2408191300002', '2CN2_005', '2CN2', '2024-08-19T13:00:00+02', 'benoit.marie', 'viscosity', 7.695, 's', 14.000, 8.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_v2408201300002', '2CN2_005', '2CN2', '2024-08-20T13:00:00+02', 'benoit.marie', 'viscosity', 7.895, 's', 14.000, 8.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_v2408211300002', '2CN2_005', '2CN2', '2024-08-21T13:00:00+02', 'benoit.marie', 'viscosity', 7.870, 's', 14.000, 8.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_v2408221300002', '2CN2_005', '2CN2', '2024-08-22T13:00:00+02', 'benoit.marie', 'viscosity', 7.540, 's', 14.000, 8.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_v2408231300002', '2CN2_005', '2CN2', '2024-08-23T13:00:00+02', 'benoit.marie', 'viscosity', 7.905, 's', 14.000, 8.000);