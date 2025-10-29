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

INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_p2507181300002', '2CN2_008', '2CN2', '2025-07-18T13:00:00+02', 'benoit.marie', 'pc', 4.650, 'g', 5.400, 4.900);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_d2507181300002', '2CN2_008', '2CN2', '2025-07-18T13:00:00+02', 'benoit.marie', 'density', 2.394, 'g', 242.000, 236.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_h2507181300002', '2CN2_008', '2CN2', '2025-07-18T13:00:00+02', 'benoit.marie', 'H2O', 0.000, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_p2507211300002', '2CN2_008', '2CN2', '2025-07-21T13:00:00+02', 'benoit.marie', 'pc', 4.500, 'g', 5.400, 4.900);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_d2507211300002', '2CN2_008', '2CN2', '2025-07-21T13:00:00+02', 'benoit.marie', 'density', 2.404, 'g', 242.000, 236.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_h2507211300002', '2CN2_008', '2CN2', '2025-07-21T13:00:00+02', 'benoit.marie', 'H2O', 0.000, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_p2507231300002', '2CN2_008', '2CN2', '2025-07-23T13:00:00+02', 'benoit.marie', 'pc', 4.650, 'g', 5.400, 4.900);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_d2507231300002', '2CN2_008', '2CN2', '2025-07-23T13:00:00+02', 'benoit.marie', 'density', 2.412, 'g', 242.000, 236.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_h2507231300002', '2CN2_008', '2CN2', '2025-07-23T13:00:00+02', 'benoit.marie', 'H2O', 0.000, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_p2507251300002', '2CN2_008', '2CN2', '2025-07-25T13:00:00+02', 'benoit.marie', 'pc', 4.730, 'g', 5.400, 4.900);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_d2507251300002', '2CN2_008', '2CN2', '2025-07-25T13:00:00+02', 'benoit.marie', 'density', 2.419, 'g', 242.000, 236.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_h2507251300002', '2CN2_008', '2CN2', '2025-07-25T13:00:00+02', 'benoit.marie', 'H2O', 0.014, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_p2507301300002', '2CN2_008', '2CN2', '2025-07-30T13:00:00+02', 'benoit.marie', 'pc', 4.768, 'g', 5.400, 4.900);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_d2507301300002', '2CN2_008', '2CN2', '2025-07-30T13:00:00+02', 'benoit.marie', 'density', 2.424, 'g', 242.000, 236.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_h2507301300002', '2CN2_008', '2CN2', '2025-07-30T13:00:00+02', 'benoit.marie', 'H2O', 0.022, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_p2507301300002', '2CN2_008', '2CN2', '2025-07-30T13:00:00+02', 'benoit.marie', 'pc', 4.768, 'g', 5.400, 4.900);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_d2507301300002', '2CN2_008', '2CN2', '2025-07-30T13:00:00+02', 'benoit.marie', 'density', 2.424, 'g', 242.000, 236.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_h2507301300002', '2CN2_008', '2CN2', '2025-07-30T13:00:00+02', 'benoit.marie', 'H2O', 0.022, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_p2508041300002', '2CN2_008', '2CN2', '2025-08-04T13:00:00+02', 'benoit.marie', 'pc', 4.736, 'g', 5.400, 4.900);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_d2508041300002', '2CN2_008', '2CN2', '2025-08-04T13:00:00+02', 'benoit.marie', 'density', 2.422, 'g', 242.000, 236.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_h2508041300002', '2CN2_008', '2CN2', '2025-08-04T13:00:00+02', 'benoit.marie', 'H2O', 0.024, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_p2508111300002', '2CN2_008', '2CN2', '2025-08-11T13:00:00+02', 'benoit.marie', 'pc', 4.150, 'g', 5.400, 4.900);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_d2508111300002', '2CN2_008', '2CN2', '2025-08-11T13:00:00+02', 'benoit.marie', 'density', 2.403, 'g', 242.000, 236.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_h2508111300002', '2CN2_008', '2CN2', '2025-08-11T13:00:00+02', 'benoit.marie', 'H2O', 0.024, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_p2508141300002', '2CN2_008', '2CN2', '2025-08-14T13:00:00+02', 'aliz.pinto-mora', 'pc', 4.325, 'g', 5.400, 4.900);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_d2508141300002', '2CN2_008', '2CN2', '2025-08-14T13:00:00+02', 'aliz.pinto-mora', 'density', 2.397, 'g', 242.000, 236.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_h2508141300002', '2CN2_008', '2CN2', '2025-08-14T13:00:00+02', 'aliz.pinto-mora', 'H2O', 0.024, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_p2508181300002', '2CN2_008', '2CN2', '2025-08-18T13:00:00+02', 'aliz.pinto-mora', 'pc', 3.978, 'g', 5.400, 4.900);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_d2508181300002', '2CN2_008', '2CN2', '2025-08-18T13:00:00+02', 'aliz.pinto-mora', 'density', 2.383, 'g', 242.000, 236.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_h2508181300002', '2CN2_008', '2CN2', '2025-08-18T13:00:00+02', 'aliz.pinto-mora', 'H2O', 0.017, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_v2507181300002', '2CN2_008', '2CN2', '2025-07-18T13:00:00+02', 'benoit.marie', 'viscosity', 9.660, 's', 14.000, 8.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_v2507211300002', '2CN2_008', '2CN2', '2025-07-21T13:00:00+02', 'benoit.marie', 'viscosity', 10.100, 's', 14.000, 8.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_v2507231300002', '2CN2_008', '2CN2', '2025-07-23T13:00:00+02', 'benoit.marie', 'viscosity', 10.890, 's', 14.000, 8.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_v2507251300002', '2CN2_008', '2CN2', '2025-07-25T13:00:00+02', 'benoit.marie', 'viscosity', 11.710, 's', 14.000, 8.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_v2507301300002', '2CN2_008', '2CN2', '2025-07-30T13:00:00+02', 'benoit.marie', 'viscosity', 10.910, 's', 14.000, 8.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_v2507301400002', '2CN2_008', '2CN2', '2025-07-30T14:00:00+02', 'benoit.marie', 'viscosity', 10.910, 's', 14.000, 8.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_v2508041300002', '2CN2_008', '2CN2', '2025-08-04T13:00:00+02', 'benoit.marie', 'viscosity', 10.295, 's', 14.000, 8.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_v2508111300002', '2CN2_008', '2CN2', '2025-08-11T13:00:00+02', 'benoit.marie', 'viscosity', 9.465, 's', 14.000, 8.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_v2508141300002', '2CN2_008', '2CN2', '2025-08-14T13:00:00+02', 'aliz.pinto-mora', 'viscosity', 8.950, 's', 14.000, 8.000);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_008_v2508181300002', '2CN2_008', '2CN2', '2025-08-18T13:00:00+02', 'aliz.pinto-mora', 'viscosity', 9.400, 's', 14.000, 8.000);