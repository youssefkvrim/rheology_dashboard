INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_h2408191300002', 'M7-3_005', 'M7-3', '2024-08-19T13:00:00+01', 'youssef.karim', 'H2O', 0.012, 'L/h', NULL, NULL);
UPDATE rheology
SET value = 5.092
WHERE id_rheology = '2CN2_007_p2408191300002';
UPDATE rheology
SET value = 2.385
WHERE id_rheology = '2CN2_007_d2408191300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_d2408201300002', 'M7-3_005', 'M7-3', '2024-08-20T13:00:00+01', 'youssef.karim', 'density', 2.457, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_h2408201300002', 'M7-3_005', 'M7-3', '2024-08-20T13:00:00+01', 'youssef.karim', 'H2O', 0.012, 'L/h', NULL, NULL);
UPDATE rheology
SET value = 0.072
WHERE id_rheology = 'R55_011_h2408201300002';
UPDATE rheology
SET value = 0.104
WHERE id_rheology = 'R55_ITK57U_h2408201300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('R55_ITK57U_d2408201300002', 'R55_ITK57U', 'R55', '2024-08-20T13:00:00+01', 'youssef.karim', 'density', 2.272, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_a2408211300002', 'M7-3_005', 'M7-3', '2024-08-21T13:00:00+01', 'youssef.karim', 'pH', 8.422, '(-)', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_006_a2408211300002', 'M7-3_006', 'M7-3', '2024-08-21T13:00:00+01', 'youssef.karim', 'pH', 8.491, '(-)', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_005_a2408211300002', '2CN2_005', '2CN2', '2024-08-21T13:00:00+01', 'youssef.karim', 'pH', 9.175, '(-)', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_007_a2408211300002', '2CN2_007', '2CN2', '2024-08-21T13:00:00+01', 'youssef.karim', 'pH', 9.530, '(-)', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('R55_010_a2408211300002', 'R55_010', 'R55', '2024-08-21T13:00:00+01', 'youssef.karim', 'pH', 8.850, '(-)', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('R55_011_a2408211300002', 'R55_011', 'R55', '2024-08-21T13:00:00+01', 'youssef.karim', 'pH', 9.401, '(-)', NULL, NULL);
UPDATE rheology
SET value = 2.465
WHERE id_rheology = 'M7-3_006_d2408211300002';
UPDATE rheology
SET value = 2.386
WHERE id_rheology = '2CN2_007_d2408211300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_v2408271300002', 'M7-3_005', 'M7-3', '2024-08-27T13:00:00+01', 'youssef.karim', 'viscosity', 13.530, 'mPa·s', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_006_v2408271300002', 'M7-3_006', 'M7-3', '2024-08-27T13:00:00+01', 'youssef.karim', 'viscosity', 14.800, 'mPa·s', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_d2408271300002', 'M7-3_005', 'M7-3', '2024-08-27T13:00:00+01', 'youssef.karim', 'density', 2.460, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_007_v2408271300002', '2CN2_007', '2CN2', '2024-08-27T13:00:00+01', 'youssef.karim', 'viscosity', 9.051, 'mPa·s', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('R55_010_v2408271300002', 'R55_010', 'R55', '2024-08-27T13:00:00+01', 'youssef.karim', 'viscosity', 8.100, 'mPa·s', NULL, NULL);
UPDATE rheology
SET value = 2.256
WHERE id_rheology = 'R55_011_d2408271300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_d2408271300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2408271300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_h2408271300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_010_h2408271300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2408271300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_h2408271300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_h2408271300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_d2408271300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_p2408281300002', 'M7-3_005', 'M7-3', '2024-08-28T13:00:00+01', 'youssef.karim', 'pc', 6.703, 'g', NULL, NULL);
UPDATE rheology
SET value = 8.887
WHERE id_rheology = 'M7-3_006_p2408281300002';
UPDATE rheology
SET value = 5.097
WHERE id_rheology = '2CN2_007_p2408281300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_v2408281300002', 'M7-3_005', 'M7-3', '2024-08-28T13:00:00+01', 'youssef.karim', 'viscosity', 13.700, 'mPa·s', NULL, NULL);
UPDATE rheology
SET value = 14.350
WHERE id_rheology = 'M7-3_006_v2408281300002';
UPDATE rheology
SET value = 9.790
WHERE id_rheology = '2CN2_007_v2408281300002';
UPDATE rheology
SET value = 7.990
WHERE id_rheology = 'R55_010_v2408281300002';
UPDATE rheology
SET value = 8.600
WHERE id_rheology = 'R55_011_v2408281300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_v2408281300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_v2408281300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_d2408281300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_d2408281300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2408281300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2408281300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_d2408281300002', 'M7-3_005', 'M7-3', '2024-08-28T13:00:00+01', 'youssef.karim', 'density', 2.470, 'g/cm³', NULL, NULL);
UPDATE rheology
SET value = 2.401
WHERE id_rheology = '2CN2_007_d2408281300002';
UPDATE rheology
SET value = 2.260
WHERE id_rheology = 'R55_010_d2408281300002';
UPDATE rheology
SET value = 2.252
WHERE id_rheology = 'R55_011_d2408281300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_h2408281300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_010_h2408281300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_h2408281300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_h2408281300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_h2408281300002', 'M7-3_005', 'M7-3', '2024-08-28T13:00:00+01', 'youssef.karim', 'H2O', 0.037, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_d2408291300002', 'M7-3_005', 'M7-3', '2024-08-29T13:00:00+01', 'youssef.karim', 'density', 2.471, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_006_d2408291300002', 'M7-3_006', 'M7-3', '2024-08-29T13:00:00+01', 'youssef.karim', 'density', 2.460, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_006_d2408291300002', 'M7-3_006', 'M7-3', '2024-08-29T13:00:00+01', 'youssef.karim', 'density', 2.460, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_006_d2408291300002', 'M7-3_006', 'M7-3', '2024-08-29T13:00:00+01', 'youssef.karim', 'density', 2.460, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_006_d2408291300002', 'M7-3_006', 'M7-3', '2024-08-29T13:00:00+01', 'youssef.karim', 'density', 2.468, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('R55_010_d2408291300002', 'R55_010', 'R55', '2024-08-29T13:00:00+01', 'youssef.karim', 'density', 2.257, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('R55_011_d2408291300002', 'R55_011', 'R55', '2024-08-29T13:00:00+01', 'youssef.karim', 'density', 2.251, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_h2408291300002', 'M7-3_005', 'M7-3', '2024-08-29T13:00:00+01', 'youssef.karim', 'H2O', 0.019, 'L/h', NULL, NULL);
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2408291300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_h2408291300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2408291300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_p2408301300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_p2408301300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_p2408301300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_v2408301300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_d2408301300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_h2408301300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_v2408301300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_d2408301300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2408301300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_v2408301300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_d2408301300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2408301300002';
UPDATE rheology
SET value = 7.970
WHERE id_rheology = 'R55_010_v2408301300002';
UPDATE rheology
SET value = 2.244
WHERE id_rheology = 'R55_010_d2408301300002';
UPDATE rheology
SET value = 9.400
WHERE id_rheology = '2CN2_007_v2408301300002';
UPDATE rheology
SET value = 14.890
WHERE id_rheology = 'M7-3_006_v2408301300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_v2408301300002', 'M7-3_005', 'M7-3', '2024-08-30T13:00:00+01', 'youssef.karim', 'viscosity', 14.160, 'mPa·s', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_d2408301300002', 'M7-3_005', 'M7-3', '2024-08-30T13:00:00+01', 'youssef.karim', 'density', 2.463, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_h2408301300002', 'M7-3_005', 'M7-3', '2024-08-30T13:00:00+01', 'youssef.karim', 'H2O', 0.019, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_p2409021300002', 'M7-3_005', 'M7-3', '2024-09-02T13:00:00+01', 'youssef.karim', 'pc', 7.231, 'g', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_v2409021300002', 'M7-3_005', 'M7-3', '2024-09-02T13:00:00+01', 'youssef.karim', 'viscosity', 15.460, 'mPa·s', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_d2409021300002', 'M7-3_005', 'M7-3', '2024-09-02T13:00:00+01', 'youssef.karim', 'density', 2.458, 'g/cm³', NULL, NULL);
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_h2409021300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_h2409021300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2409021300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_010_h2409021300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_h2409021300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2409021300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_p2409031300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_v2409031300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_d2409031300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2409031300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_v2409031300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_d2409031300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2409031300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_h2409031300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_010_h2409031300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_h2409031300002', 'M7-3_005', 'M7-3', '2024-09-03T13:00:00+01', 'youssef.karim', 'H2O', 0.017, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_p2409031300002', 'M7-3_005', 'M7-3', '2024-09-03T13:00:00+01', 'youssef.karim', 'pc', 7.304, 'g', NULL, NULL);
UPDATE rheology
SET value = 7.497
WHERE id_rheology = 'M7-3_006_p2409031300002';
UPDATE rheology
SET value = 4.800
WHERE id_rheology = '2CN2_007_p2409031300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_v2409031300002', 'M7-3_005', 'M7-3', '2024-09-03T13:00:00+01', 'youssef.karim', 'viscosity', 15.330, 'mPa·s', NULL, NULL);
UPDATE rheology
SET value = 12.660
WHERE id_rheology = 'M7-3_006_v2409031300002';
UPDATE rheology
SET value = 9.830
WHERE id_rheology = '2CN2_007_v2409031300002';
UPDATE rheology
SET value = 8.120
WHERE id_rheology = 'R55_010_v2409031300002';
UPDATE rheology
SET value = 8.300
WHERE id_rheology = 'R55_011_v2409031300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_d2409031300002', 'M7-3_005', 'M7-3', '2024-09-03T13:00:00+01', 'youssef.karim', 'density', 2.459, 'g/cm³', NULL, NULL);
UPDATE rheology
SET value = 2.458
WHERE id_rheology = 'M7-3_006_d2409031300002';
UPDATE rheology
SET value = 2.401
WHERE id_rheology = '2CN2_007_d2409031300002';
UPDATE rheology
SET value = 2.197
WHERE id_rheology = 'R55_010_d2409031300002';
UPDATE rheology
SET value = 2.212
WHERE id_rheology = 'R55_011_d2409031300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_p2409051300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_v2409051300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_d2409051300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2409051300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2409051300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_d2409051300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_v2409051300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_p2409051300002', 'M7-3_005', 'M7-3', '2024-09-05T13:00:00+01', 'youssef.karim', 'pc', 7.153, 'g', NULL, NULL);
UPDATE rheology
SET value = 7.303
WHERE id_rheology = 'M7-3_006_p2409051300002';
UPDATE rheology
SET value = 4.756
WHERE id_rheology = '2CN2_007_p2409051300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_v2409051300002', 'M7-3_005', 'M7-3', '2024-09-05T13:00:00+01', 'youssef.karim', 'viscosity', 14.640, 'mPa·s', NULL, NULL);
UPDATE rheology
SET value = 12.090
WHERE id_rheology = 'M7-3_006_v2409051300002';
UPDATE rheology
SET value = 9.330
WHERE id_rheology = '2CN2_007_v2409051300002';
UPDATE rheology
SET value = 7.850
WHERE id_rheology = 'R55_010_v2409051300002';
UPDATE rheology
SET value = 8.450
WHERE id_rheology = 'R55_011_v2409051300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_d2409051300002', 'M7-3_005', 'M7-3', '2024-09-05T13:00:00+01', 'youssef.karim', 'density', 2.462, 'g/cm³', NULL, NULL);
UPDATE rheology
SET value = 2.224
WHERE id_rheology = 'R55_010_d2409051300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_h2409051300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_h2409051300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_010_h2409051300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_h2409051300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_p2409061300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_v2409061300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_d2409061300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2409061300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_d2409061300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_v2409061300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2409061300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_p2409061300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_v2409061300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_v2409061300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_p2409061300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_010_v2409061300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_v2409061300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_d2409061300002', 'M7-3_005', 'M7-3', '2024-09-06T13:00:00+01', 'youssef.karim', 'density', 2.461, 'g/cm³', NULL, NULL);
UPDATE rheology
SET value = 2.213
WHERE id_rheology = 'R55_010_d2409061300002';
UPDATE rheology
SET value = 2.255
WHERE id_rheology = 'R55_011_d2409061300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_h2409061300002', 'M7-3_005', 'M7-3', '2024-09-06T13:00:00+01', 'youssef.karim', 'H2O', 0.017, 'L/h', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_p2409091300002', 'M7-3_005', 'M7-3', '2024-09-09T13:00:00+01', 'youssef.karim', 'pc', 7.178, 'g', NULL, NULL);
UPDATE rheology
SET value = 7.300
WHERE id_rheology = 'M7-3_006_p2409091300002';
UPDATE rheology
SET value = 4.830
WHERE id_rheology = '2CN2_007_p2409091300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_p2409091300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_v2409091300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_d2409091300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2409091300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2409091300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_d2409091300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_v2409091300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_v2409091300002', 'M7-3_005', 'M7-3', '2024-09-09T13:00:00+01', 'youssef.karim', 'viscosity', 14.800, 'mPa·s', NULL, NULL);
UPDATE rheology
SET value = 12.100
WHERE id_rheology = 'M7-3_006_v2409091300002';
UPDATE rheology
SET value = 9.270
WHERE id_rheology = '2CN2_007_v2409091300002';
UPDATE rheology
SET value = 7.800
WHERE id_rheology = 'R55_010_v2409091300002';
UPDATE rheology
SET value = 8.390
WHERE id_rheology = 'R55_011_v2409091300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_d2409091300002', 'M7-3_005', 'M7-3', '2024-09-09T13:00:00+01', 'youssef.karim', 'density', 2.461, 'g/cm³', NULL, NULL);
UPDATE rheology
SET value = 2.463
WHERE id_rheology = 'M7-3_006_d2409091300002';
UPDATE rheology
SET value = 2.399
WHERE id_rheology = '2CN2_007_d2409091300002';
UPDATE rheology
SET value = 2.257
WHERE id_rheology = 'R55_010_d2409091300002';
UPDATE rheology
SET value = 2.260
WHERE id_rheology = 'R55_011_d2409091300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_h2409091300002', 'M7-3_005', 'M7-3', '2024-09-09T13:00:00+01', 'youssef.karim', 'H2O', 0.017, 'L/h', NULL, NULL);
UPDATE rheology
SET value = 0.022
WHERE id_rheology = 'M7-3_006_h2409091300002';
UPDATE rheology
SET value = 0.000
WHERE id_rheology = 'R55_010_h2409091300002';
UPDATE rheology
SET value = 0.019
WHERE id_rheology = 'R55_011_h2409091300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_h2409101300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_h2409101300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2409101300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_010_h2409101300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_h2409101300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_007_v2409101300002', '2CN2_007', '2CN2', '2024-09-10T13:00:00+01', 'youssef.karim', 'viscosity', 9.330, 'mPa·s', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('R55_010_v2409101300002', 'R55_010', 'R55', '2024-09-10T13:00:00+01', 'youssef.karim', 'viscosity', 7.970, 'mPa·s', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('R55_011_v2409101300002', 'R55_011', 'R55', '2024-09-10T13:00:00+01', 'youssef.karim', 'viscosity', 8.440, 'mPa·s', NULL, NULL);
UPDATE rheology
SET value = 2.258
WHERE id_rheology = 'R55_010_d2409101300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_p2409121300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_p2409121300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_p2409121300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_v2409121300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_d2409121300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2409121300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2409121300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_d2409121300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_v2409121300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_v2409121300002', 'M7-3_005', 'M7-3', '2024-09-12T13:00:00+01', 'youssef.karim', 'viscosity', 15.490, 'mPa·s', NULL, NULL);
UPDATE rheology
SET value = 12.990
WHERE id_rheology = 'M7-3_006_v2409121300002';
UPDATE rheology
SET value = 9.220
WHERE id_rheology = '2CN2_007_v2409121300002';
UPDATE rheology
SET value = 7.830
WHERE id_rheology = 'R55_010_v2409121300002';
UPDATE rheology
SET value = 8.420
WHERE id_rheology = 'R55_011_v2409121300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_d2409121300002', 'M7-3_005', 'M7-3', '2024-09-12T13:00:00+01', 'youssef.karim', 'density', 2.470, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_h2409121300002', 'M7-3_005', 'M7-3', '2024-09-12T13:00:00+01', 'youssef.karim', 'H2O', 0.014, 'L/h', NULL, NULL);
UPDATE rheology
SET value = 2.240
WHERE id_rheology = 'R55_010_d2409121300002';
UPDATE rheology
SET value = 2.255
WHERE id_rheology = 'R55_011_d2409121300002';
UPDATE rheology
SET value = 0.024
WHERE id_rheology = 'R55_011_h2409121300002';
UPDATE rheology
SET value = 0.017
WHERE id_rheology = 'M7-3_006_h2409121300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_006_p2409131300002', 'M7-3_006', 'M7-3', '2024-09-13T13:00:00+01', 'youssef.karim', 'pc', 7.297, 'g', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_007_p2409131300002', '2CN2_007', '2CN2', '2024-09-13T13:00:00+01', 'youssef.karim', 'pc', 4.990, 'g', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_v2409131300002', 'M7-3_005', 'M7-3', '2024-09-13T13:00:00+01', 'youssef.karim', 'viscosity', 15.530, 'mPa·s', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_006_v2409131300002', 'M7-3_006', 'M7-3', '2024-09-13T13:00:00+01', 'youssef.karim', 'viscosity', 13.030, 'mPa·s', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_007_v2409131300002', '2CN2_007', '2CN2', '2024-09-13T13:00:00+01', 'youssef.karim', 'viscosity', 9.280, 'mPa·s', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('R55_010_v2409131300002', 'R55_010', 'R55', '2024-09-13T13:00:00+01', 'youssef.karim', 'viscosity', 7.900, 'mPa·s', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('R55_011_v2409131300002', 'R55_011', 'R55', '2024-09-13T13:00:00+01', 'youssef.karim', 'viscosity', 8.510, 'mPa·s', NULL, NULL);
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_h2409131300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_h2409131300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2409131300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_010_h2409131300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_h2409131300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2409131300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_d2409131300002', 'M7-3_005', 'M7-3', '2024-09-13T13:00:00+01', 'youssef.karim', 'density', 2.468, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_006_d2409131300002', 'M7-3_006', 'M7-3', '2024-09-13T13:00:00+01', 'youssef.karim', 'density', 2.466, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_007_d2409131300002', '2CN2_007', '2CN2', '2024-09-13T13:00:00+01', 'youssef.karim', 'density', 2.402, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('R55_010_d2409131300002', 'R55_010', 'R55', '2024-09-13T13:00:00+01', 'youssef.karim', 'density', 2.245, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('R55_011_d2409131300002', 'R55_011', 'R55', '2024-09-13T13:00:00+01', 'youssef.karim', 'density', 2.257, 'g/cm³', NULL, NULL);
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_p2409161300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_p2409161300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_p2409161300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_v2409161300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_d2409161300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2409161300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_v2409161300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_d2409161300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2409161300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_h2409161300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_h2409161300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_010_h2409161300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_h2409161300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_v2409161300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_v2409161300002';
UPDATE rheology
SET value = 7.760
WHERE id_rheology = 'R55_010_v2409161300002';
UPDATE rheology
SET value = 8.630
WHERE id_rheology = 'R55_011_v2409161300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_d2409161300002', 'M7-3_005', 'M7-3', '2024-09-16T13:00:00+01', 'youssef.karim', 'density', 2.469, 'g/cm³', NULL, NULL);
UPDATE rheology
SET value = 2.467
WHERE id_rheology = 'M7-3_006_d2409161300002';
UPDATE rheology
SET value = 2.406
WHERE id_rheology = '2CN2_007_d2409161300002';
UPDATE rheology
SET value = 2.179
WHERE id_rheology = 'R55_010_d2409161300002';
UPDATE rheology
SET value = 2.265
WHERE id_rheology = 'R55_011_d2409161300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_h2409171300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_h2409171300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2409171300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_010_h2409171300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_h2409171300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2409171300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_d2409171300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_v2409171300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_p2409171300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_v2409171300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_d2409171300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_p2409171300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_p2409171300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_v2409171300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_v2409171300002';
UPDATE rheology
SET value = 7.680
WHERE id_rheology = 'R55_010_v2409171300002';
UPDATE rheology
SET value = 8.710
WHERE id_rheology = 'R55_011_v2409171300002';
UPDATE rheology
SET value = 2.464
WHERE id_rheology = 'M7-3_006_d2409171300002';
UPDATE rheology
SET value = 2.406
WHERE id_rheology = '2CN2_007_d2409171300002';
UPDATE rheology
SET value = 2.202
WHERE id_rheology = 'R55_010_d2409171300002';
UPDATE rheology
SET value = 2.263
WHERE id_rheology = 'R55_011_d2409171300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_h2409181300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_h2409181300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2409181300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_010_h2409181300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_h2409181300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2409181300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_d2409181300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_d2409181300002';
UPDATE rheology
SET value = 2.473
WHERE id_rheology = 'M7-3_006_d2409181300002';
UPDATE rheology
SET value = 2.259
WHERE id_rheology = 'R55_010_d2409181300002';
UPDATE rheology
SET value = 2.262
WHERE id_rheology = 'R55_011_d2409181300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_h2409191300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_h2409191300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2409191300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_010_h2409191300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_h2409191300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2409191300002';
UPDATE rheology
SET value = 2.403
WHERE id_rheology = '2CN2_007_d2409191300002';
UPDATE rheology
SET value = 2.261
WHERE id_rheology = 'R55_011_d2409191300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_h2409231300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_h2409231300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2409231300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_010_h2409231300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_h2409231300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2409231300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_p2409241300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_v2409241300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_d2409241300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2409241300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2409241300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_d2409241300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_v2409241300002';
UPDATE rheology
SET value = 7.480
WHERE id_rheology = 'M7-3_006_p2409241300002';
UPDATE rheology
SET value = 5.101
WHERE id_rheology = '2CN2_007_p2409241300002';
UPDATE rheology
SET value = 13.200
WHERE id_rheology = 'M7-3_006_v2409241300002';
UPDATE rheology
SET value = 9.330
WHERE id_rheology = '2CN2_007_v2409241300002';
UPDATE rheology
SET value = 7.960
WHERE id_rheology = 'R55_010_v2409241300002';
UPDATE rheology
SET value = 8.620
WHERE id_rheology = 'R55_011_v2409241300002';
UPDATE rheology
SET value = 2.402
WHERE id_rheology = '2CN2_007_d2409241300002';
UPDATE rheology
SET value = 2.467
WHERE id_rheology = 'M7-3_006_d2409241300002';
UPDATE rheology
SET value = 2.277
WHERE id_rheology = 'R55_011_d2409241300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_h2409241300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_h2409241300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_010_h2409241300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_h2409241300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_h2409251300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_h2409251300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2409251300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_010_h2409251300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_h2409251300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2409251300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_d2409251300002', 'M7-3_005', 'M7-3', '2024-09-25T13:00:00+01', 'youssef.karim', 'density', 2.470, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_006_d2409251300002', 'M7-3_006', 'M7-3', '2024-09-25T13:00:00+01', 'youssef.karim', 'density', 2.468, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_007_d2409251300002', '2CN2_007', '2CN2', '2024-09-25T13:00:00+01', 'youssef.karim', 'density', 2.402, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('R55_010_d2409251300002', 'R55_010', 'R55', '2024-09-25T13:00:00+01', 'youssef.karim', 'density', 2.261, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('R55_011_d2409251300002', 'R55_011', 'R55', '2024-09-25T13:00:00+01', 'youssef.karim', 'density', 2.274, 'g/cm³', NULL, NULL);
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_p2409261300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_p2409261300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_p2409261300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_v2409261300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_v2409261300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_v2409261300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_010_v2409261300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_v2409261300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_v2409261300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_h2409261300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_h2409261300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2409261300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_010_h2409261300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_h2409261300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2409261300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_d2409261300002', 'M7-3_005', 'M7-3', '2024-09-26T13:00:00+01', 'youssef.karim', 'density', 2.470, 'g/cm³', NULL, NULL);
UPDATE rheology
SET value = 2.465
WHERE id_rheology = 'M7-3_006_d2409261300002';
UPDATE rheology
SET value = 2.401
WHERE id_rheology = '2CN2_007_d2409261300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_d2409261300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_d2409261300002';
UPDATE rheology
SET value = 2.262
WHERE id_rheology = 'R55_010_d2409261300002';
UPDATE rheology
SET value = 2.271
WHERE id_rheology = 'R55_011_d2409261300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_p2410011300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_p2410011300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_p2410011300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_v2410011300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_d2410011300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2410011300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2410011300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_d2410011300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_v2410011300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_v2410011300002', 'M7-3_005', 'M7-3', '2024-10-01T13:00:00+01', 'youssef.karim', 'viscosity', 15.350, 'mPa·s', NULL, NULL);
UPDATE rheology
SET value = 13.120
WHERE id_rheology = 'M7-3_006_v2410011300002';
UPDATE rheology
SET value = 9.440
WHERE id_rheology = '2CN2_007_v2410011300002';
UPDATE rheology
SET value = 8.090
WHERE id_rheology = 'R55_010_v2410011300002';
UPDATE rheology
SET value = 8.600
WHERE id_rheology = 'R55_011_v2410011300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_d2410011300002', 'M7-3_005', 'M7-3', '2024-10-01T13:00:00+01', 'youssef.karim', 'density', 2.467, 'g/cm³', NULL, NULL);
UPDATE rheology
SET value = 2.466
WHERE id_rheology = 'M7-3_006_d2410011300002';
UPDATE rheology
SET value = 2.413
WHERE id_rheology = '2CN2_007_d2410011300002';
UPDATE rheology
SET value = 2.258
WHERE id_rheology = 'R55_010_d2410011300002';
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_h2410011300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_h2410011300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_010_h2410011300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_h2410011300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_p2410041300002', 'M7-3_005', 'M7-3', '2024-10-04T13:00:00+01', 'youssef.karim', 'pc', 6.928, 'g', NULL, NULL);
UPDATE rheology
SET value = 7.133
WHERE id_rheology = 'M7-3_006_p2410041300002';
UPDATE rheology
SET value = 4.808
WHERE id_rheology = '2CN2_007_p2410041300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_p2410041300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_v2410041300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_d2410041300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2410041300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_v2410041300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_d2410041300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2410041300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_v2410041300002', 'M7-3_005', 'M7-3', '2024-10-04T13:00:00+01', 'youssef.karim', 'viscosity', 15.320, 'mPa·s', NULL, NULL);
UPDATE rheology
SET value = 12.180
WHERE id_rheology = 'M7-3_006_v2410041300002';
UPDATE rheology
SET value = 9.215
WHERE id_rheology = '2CN2_007_v2410041300002';
UPDATE rheology
SET value = 8.010
WHERE id_rheology = 'R55_010_v2410041300002';
UPDATE rheology
SET value = 8.230
WHERE id_rheology = 'R55_011_v2410041300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_d2410041300002', 'M7-3_005', 'M7-3', '2024-10-04T13:00:00+01', 'youssef.karim', 'density', 2.464, 'g/cm³', NULL, NULL);
UPDATE rheology
SET value = 2.406
WHERE id_rheology = '2CN2_007_d2410041300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_h2410041300002', 'M7-3_005', 'M7-3', '2024-10-04T13:00:00+01', 'youssef.karim', 'H2O', 0.017, 'L/h', NULL, NULL);
DELETE FROM rheology
WHERE id_rheology = 'M7-3_006_h2410071300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_007_h2410071300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2410071300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_010_h2410071300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_011_h2410071300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_v2410071300002', 'M7-3_005', 'M7-3', '2024-10-07T13:00:00+01', 'youssef.karim', 'viscosity', 15.180, 'mPa·s', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_006_v2410071300002', 'M7-3_006', 'M7-3', '2024-10-07T13:00:00+01', 'youssef.karim', 'viscosity', 12.100, 'mPa·s', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_007_v2410071300002', '2CN2_007', '2CN2', '2024-10-07T13:00:00+01', 'youssef.karim', 'viscosity', 9.200, 'mPa·s', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('R55_010_v2410071300002', 'R55_010', 'R55', '2024-10-07T13:00:00+01', 'youssef.karim', 'viscosity', 8.040, 'mPa·s', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('R55_011_v2410071300002', 'R55_011', 'R55', '2024-10-07T13:00:00+01', 'youssef.karim', 'viscosity', 8.270, 'mPa·s', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_d2410071300002', 'M7-3_005', 'M7-3', '2024-10-07T13:00:00+01', 'youssef.karim', 'density', 2.461, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_006_d2410071300002', 'M7-3_006', 'M7-3', '2024-10-07T13:00:00+01', 'youssef.karim', 'density', 2.465, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('2CN2_007_d2410071300002', '2CN2_007', '2CN2', '2024-10-07T13:00:00+01', 'youssef.karim', 'density', 2.410, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('R55_010_d2410071300002', 'R55_010', 'R55', '2024-10-07T13:00:00+01', 'youssef.karim', 'density', 2.258, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('R55_011_d2410071300002', 'R55_011', 'R55', '2024-10-07T13:00:00+01', 'youssef.karim', 'density', 2.261, 'g/cm³', NULL, NULL);
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_p2410081300002', 'M7-3_005', 'M7-3', '2024-10-08T13:00:00+01', 'youssef.karim', 'pc', 7.380, 'g', NULL, NULL);
UPDATE rheology
SET value = 7.600
WHERE id_rheology = 'M7-3_006_p2410081300002';
UPDATE rheology
SET value = 4.998
WHERE id_rheology = '2CN2_007_p2410081300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_p2410081300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_v2410081300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_d2410081300002';
DELETE FROM rheology
WHERE id_rheology = '2CN2_ITK57U_h2410081300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_v2410081300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_d2410081300002';
DELETE FROM rheology
WHERE id_rheology = 'R55_ITK57U_h2410081300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_v2410081300002', 'M7-3_005', 'M7-3', '2024-10-08T13:00:00+01', 'youssef.karim', 'viscosity', 16.630, 'mPa·s', NULL, NULL);
UPDATE rheology
SET value = 13.540
WHERE id_rheology = 'M7-3_006_v2410081300002';
UPDATE rheology
SET value = 8.070
WHERE id_rheology = 'R55_010_v2410081300002';
UPDATE rheology
SET value = 8.280
WHERE id_rheology = 'R55_011_v2410081300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_d2410081300002', 'M7-3_005', 'M7-3', '2024-10-08T13:00:00+01', 'youssef.karim', 'density', 2.466, 'g/cm³', NULL, NULL);
UPDATE rheology
SET value = 2.463
WHERE id_rheology = 'M7-3_006_d2410081300002';
UPDATE rheology
SET value = 2.412
WHERE id_rheology = '2CN2_007_d2410081300002';
UPDATE rheology
SET value = 2.242
WHERE id_rheology = 'R55_011_d2410081300002';
INSERT INTO rheology (id_rheology, id_slurry, slurry_type, timestamp, source, parameter, value, unit, usl, lsl) VALUES ('M7-3_005_h2410081300002', 'M7-3_005', 'M7-3', '2024-10-08T13:00:00+01', 'youssef.karim', 'H2O', 0.019, 'L/h', NULL, NULL);