# Backtest Report - M7-3006

- CSV: `../../../Dashboard-Safran-archive/data/data csv/M7-3_006.csv`
- Type: `M7`
- Ranges source: `csv_bounds`
- Decision days: `122`
- Direction matches: `37/120` (30.8%)
- Conflict triplets: `18`
- Daily-cap saturation days: `0`

## Timeline

| Date | Scenario | Decision | Conflict | Current H2O | Proposed | Delta | Actual H2O | Engine Dir | Actual Dir | Match | Saturated |
| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| 2024-08-14 | 13 | increase_water_flow | no | 0.0220 | 0.0228 | +0.0008 | 0.0220 | INC | n/a | n/a | no |
| 2024-08-19 | 4 | increase_water_flow | no | 0.0220 | 0.0231 | +0.0011 | 0.0220 | INC | MNT | no | no |
| 2024-08-20 | 5 | increase_water_flow | no | 0.0170 | 0.0178 | +0.0008 | 0.0170 | INC | DEC | no | no |
| 2024-08-21 | 14 | maintain_water_flow | no | 0.0170 | 0.0170 | +0.0000 | 0.0170 | MNT | MNT | yes | no |
| 2024-08-22 | 14 | maintain_water_flow | no | 0.0240 | 0.0240 | +0.0000 | 0.0240 | MNT | INC | no | no |
| 2024-08-23 | 14 | maintain_water_flow | no | 0.0260 | 0.0260 | +0.0000 | 0.0260 | MNT | INC | no | no |
| 2024-08-26 | 14 | maintain_water_flow | no | 0.0220 | 0.0220 | +0.0000 | 0.0220 | MNT | DEC | no | no |
| 2024-08-28 | 13 | increase_water_flow | no | 0.0240 | 0.0247 | +0.0007 | 0.0240 | INC | MNT | no | no |
| 2024-08-30 | 13 | increase_water_flow | no | 0.0240 | 0.0252 | +0.0012 | 0.0240 | INC | MNT | no | no |
| 2024-09-02 | 14 | maintain_water_flow | no | 0.0220 | 0.0220 | +0.0000 | 0.0220 | MNT | DEC | no | no |
| 2024-09-03 | 15 | decrease_water_flow | no | 0.0220 | 0.0208 | -0.0012 | 0.0220 | DEC | MNT | no | no |
| 2024-09-04 | 15 | decrease_water_flow | no | 0.0220 | 0.0207 | -0.0013 | 0.0220 | DEC | MNT | no | no |
| 2024-09-05 | 15 | decrease_water_flow | no | 0.0220 | 0.0207 | -0.0013 | 0.0220 | DEC | MNT | no | no |
| 2024-09-06 | 15 | decrease_water_flow | no | 0.0220 | 0.0205 | -0.0015 | 0.0220 | DEC | MNT | no | no |
| 2024-09-09 | 15 | decrease_water_flow | no | 0.0170 | 0.0154 | -0.0016 | 0.0170 | DEC | DEC | yes | no |
| 2024-09-11 | 15 | decrease_water_flow | no | 0.0170 | 0.0154 | -0.0016 | 0.0170 | DEC | MNT | no | no |
| 2024-09-12 | 15 | decrease_water_flow | no | 0.0190 | 0.0172 | -0.0018 | 0.0190 | DEC | INC | no | no |
| 2024-09-16 | 6 | increase_water_flow | yes | 0.0190 | 0.0210 | +0.0020 | 0.0190 | INC | MNT | no | no |
| 2024-09-17 | 6 | increase_water_flow | yes | 0.0220 | 0.0240 | +0.0020 | 0.0220 | INC | INC | yes | no |
| 2024-09-20 | 6 | increase_water_flow | yes | 0.0260 | 0.0280 | +0.0020 | 0.0260 | INC | MNT | no | no |
| 2024-09-24 | 6 | increase_water_flow | yes | 0.0240 | 0.0260 | +0.0020 | 0.0240 | INC | DEC | no | no |
| 2024-09-26 | 15 | decrease_water_flow | no | 0.0190 | 0.0173 | -0.0017 | 0.0190 | DEC | DEC | yes | no |
| 2024-10-01 | 15 | decrease_water_flow | no | 0.0190 | 0.0174 | -0.0016 | 0.0190 | DEC | MNT | no | no |
| 2024-10-04 | 15 | decrease_water_flow | no | 0.0190 | 0.0173 | -0.0017 | 0.0190 | DEC | MNT | no | no |
| 2024-10-08 | 15 | decrease_water_flow | no | 0.0190 | 0.0177 | -0.0013 | 0.0190 | DEC | INC | no | no |
| 2024-10-10 | 15 | decrease_water_flow | no | 0.0190 | 0.0176 | -0.0014 | 0.0190 | DEC | MNT | no | no |
| 2024-10-14 | 15 | decrease_water_flow | no | 0.0170 | 0.0154 | -0.0016 | 0.0170 | DEC | DEC | yes | no |
| 2024-10-16 | 15 | decrease_water_flow | no | 0.0190 | 0.0174 | -0.0016 | 0.0190 | DEC | INC | no | no |
| 2024-10-21 | 15 | decrease_water_flow | no | 0.0190 | 0.0173 | -0.0017 | 0.0190 | DEC | MNT | no | no |
| 2024-10-25 | 15 | decrease_water_flow | no | 0.0240 | 0.0226 | -0.0014 | 0.0240 | DEC | MNT | no | no |
| 2024-10-28 | 15 | decrease_water_flow | no | 0.0190 | 0.0176 | -0.0014 | 0.0190 | DEC | DEC | yes | no |
| 2024-11-05 | 15 | decrease_water_flow | no | 0.0190 | 0.0175 | -0.0015 | 0.0190 | DEC | MNT | no | no |
| 2024-11-12 | 15 | decrease_water_flow | no | 0.0170 | 0.0150 | -0.0020 | 0.0170 | DEC | DEC | yes | no |
| 2024-11-14 | 24 | decrease_water_flow | no | 0.0170 | 0.0150 | -0.0020 | 0.0170 | DEC | MNT | no | no |
| 2024-11-18 | 24 | decrease_water_flow | no | 0.0170 | 0.0153 | -0.0017 | 0.0170 | DEC | MNT | no | no |
| 2024-11-25 | 15 | decrease_water_flow | no | 0.0220 | 0.0203 | -0.0017 | 0.0220 | DEC | INC | no | no |
| 2024-11-28 | 15 | decrease_water_flow | no | 0.0190 | 0.0176 | -0.0014 | 0.0190 | DEC | DEC | yes | no |
| 2024-12-02 | 15 | decrease_water_flow | no | 0.0220 | 0.0206 | -0.0014 | 0.0220 | DEC | INC | no | no |
| 2024-12-04 | 15 | decrease_water_flow | no | 0.0220 | 0.0207 | -0.0013 | 0.0220 | DEC | MNT | no | no |
| 2024-12-06 | 15 | decrease_water_flow | no | 0.0220 | 0.0209 | -0.0011 | 0.0220 | DEC | MNT | no | no |
| 2024-12-09 | 15 | decrease_water_flow | no | 0.0220 | 0.0205 | -0.0015 | 0.0220 | DEC | MNT | no | no |
| 2024-12-11 | 15 | decrease_water_flow | no | 0.0220 | 0.0204 | -0.0016 | 0.0220 | DEC | MNT | no | no |
| 2024-12-16 | 15 | decrease_water_flow | no | 0.0220 | 0.0203 | -0.0017 | 0.0220 | DEC | MNT | no | no |
| 2024-12-18 | 15 | decrease_water_flow | no | 0.0220 | 0.0202 | -0.0018 | 0.0220 | DEC | MNT | no | no |
| 2024-12-19 | 15 | decrease_water_flow | no | 0.0190 | 0.0171 | -0.0019 | 0.0190 | DEC | DEC | yes | no |
| 2024-12-24 | 15 | decrease_water_flow | no | 0.0220 | 0.0202 | -0.0018 | 0.0220 | DEC | INC | no | no |
| 2024-12-30 | 15 | decrease_water_flow | no | 0.0000 | 0.0000 | +0.0000 | 0.0000 | MNT | DEC | no | no |
| 2025-01-06 | 24 | decrease_water_flow | no | 0.0220 | 0.0200 | -0.0020 | 0.0220 | DEC | MNT | no | no |
| 2025-01-10 | 24 | decrease_water_flow | no | 0.0190 | 0.0170 | -0.0020 | 0.0190 | DEC | DEC | yes | no |
| 2025-01-15 | 15 | decrease_water_flow | no | 0.0190 | 0.0178 | -0.0012 | 0.0190 | DEC | MNT | no | no |
| 2025-01-17 | 15 | decrease_water_flow | no | 0.0190 | 0.0178 | -0.0012 | 0.0190 | DEC | MNT | no | no |
| 2025-01-22 | 15 | decrease_water_flow | no | 0.0190 | 0.0175 | -0.0015 | n/a | DEC | n/a | n/a | no |
| 2025-01-24 | 15 | decrease_water_flow | no | 0.0190 | 0.0175 | -0.0015 | 0.0190 | DEC | MNT | no | no |
| 2025-01-27 | 24 | decrease_water_flow | no | 0.0170 | 0.0152 | -0.0018 | 0.0170 | DEC | DEC | yes | no |
| 2025-01-28 | 15 | decrease_water_flow | no | 0.0220 | 0.0203 | -0.0017 | 0.0220 | DEC | INC | no | no |
| 2025-01-29 | 15 | decrease_water_flow | no | 0.0190 | 0.0174 | -0.0016 | 0.0190 | DEC | DEC | yes | no |
| 2025-01-31 | 15 | decrease_water_flow | no | 0.0170 | 0.0154 | -0.0016 | 0.0170 | DEC | DEC | yes | no |
| 2025-02-10 | 24 | decrease_water_flow | no | 0.0190 | 0.0170 | -0.0020 | 0.0190 | DEC | INC | no | no |
| 2025-02-12 | 24 | decrease_water_flow | no | 0.0190 | 0.0170 | -0.0020 | 0.0190 | DEC | MNT | no | no |
| 2025-02-14 | 24 | decrease_water_flow | no | 0.0170 | 0.0150 | -0.0020 | 0.0170 | DEC | DEC | yes | no |
| 2025-02-17 | 24 | decrease_water_flow | no | 0.0170 | 0.0150 | -0.0020 | 0.0170 | DEC | MNT | no | no |
| 2025-02-19 | 15 | decrease_water_flow | no | 0.0170 | 0.0150 | -0.0020 | 0.0170 | DEC | MNT | no | no |
| 2025-02-21 | 15 | decrease_water_flow | no | 0.0170 | 0.0151 | -0.0019 | 0.0170 | DEC | MNT | no | no |
| 2025-02-24 | 15 | decrease_water_flow | no | 0.0170 | 0.0153 | -0.0017 | 0.0170 | DEC | MNT | no | no |
| 2025-02-26 | 15 | decrease_water_flow | no | 0.0190 | 0.0175 | -0.0015 | 0.0190 | DEC | INC | no | no |
| 2025-02-28 | 15 | decrease_water_flow | no | 0.0220 | 0.0205 | -0.0015 | 0.0220 | DEC | INC | no | no |
| 2025-03-03 | 15 | decrease_water_flow | no | 0.0220 | 0.0206 | -0.0014 | 0.0220 | DEC | MNT | no | no |
| 2025-03-05 | 15 | decrease_water_flow | no | 0.0220 | 0.0204 | -0.0016 | 0.0220 | DEC | MNT | no | no |
| 2025-03-07 | 15 | decrease_water_flow | no | 0.0220 | 0.0204 | -0.0016 | 0.0220 | DEC | MNT | no | no |
| 2025-03-11 | 15 | decrease_water_flow | no | 0.0220 | 0.0203 | -0.0017 | 0.0220 | DEC | MNT | no | no |
| 2025-03-14 | 15 | decrease_water_flow | no | 0.0190 | 0.0173 | -0.0017 | 0.0190 | DEC | DEC | yes | no |
| 2025-03-18 | 15 | decrease_water_flow | no | 0.0170 | 0.0151 | -0.0019 | 0.0170 | DEC | DEC | yes | no |
| 2025-03-21 | 15 | decrease_water_flow | no | 0.0170 | 0.0153 | -0.0017 | 0.0170 | DEC | MNT | no | no |
| 2025-03-24 | 15 | decrease_water_flow | no | 0.0190 | 0.0177 | -0.0013 | 0.0190 | DEC | INC | no | no |
| 2025-03-26 | 15 | decrease_water_flow | no | 0.0170 | 0.0159 | -0.0011 | 0.0170 | DEC | DEC | yes | no |
| 2025-03-28 | 6 | increase_water_flow | yes | 0.0190 | 0.0207 | +0.0017 | 0.0190 | INC | INC | yes | no |
| 2025-04-04 | 6 | increase_water_flow | yes | 0.0220 | 0.0239 | +0.0019 | 0.0220 | INC | INC | yes | no |
| 2025-04-07 | 6 | increase_water_flow | yes | 0.0240 | 0.0259 | +0.0019 | 0.0240 | INC | INC | yes | no |
| 2025-04-09 | 6 | increase_water_flow | yes | 0.0240 | 0.0259 | +0.0019 | 0.0240 | INC | MNT | no | no |
| 2025-04-11 | 6 | increase_water_flow | yes | 0.0260 | 0.0279 | +0.0019 | 0.0260 | INC | INC | yes | no |
| 2025-04-14 | 6 | increase_water_flow | yes | 0.0290 | 0.0309 | +0.0019 | 0.0290 | INC | INC | yes | no |
| 2025-04-16 | 6 | increase_water_flow | yes | 0.0290 | 0.0308 | +0.0018 | 0.0290 | INC | MNT | no | no |
| 2025-04-18 | 15 | decrease_water_flow | no | 0.0260 | 0.0244 | -0.0016 | 0.0260 | DEC | DEC | yes | no |
| 2025-04-22 | 15 | decrease_water_flow | no | 0.0240 | 0.0226 | -0.0014 | 0.0240 | DEC | DEC | yes | no |
| 2025-04-24 | 15 | decrease_water_flow | no | 0.0240 | 0.0226 | -0.0014 | 0.0240 | DEC | MNT | no | no |
| 2025-04-25 | 15 | decrease_water_flow | no | 0.0240 | 0.0226 | -0.0014 | 0.0240 | DEC | MNT | no | no |
| 2025-04-28 | 15 | decrease_water_flow | no | 0.0240 | 0.0224 | -0.0016 | 0.0240 | DEC | MNT | no | no |
| 2025-04-30 | 15 | decrease_water_flow | no | 0.0240 | 0.0224 | -0.0016 | 0.0240 | DEC | MNT | no | no |
| 2025-05-05 | 15 | decrease_water_flow | no | 0.0190 | 0.0172 | -0.0018 | 0.0190 | DEC | DEC | yes | no |
| 2025-05-08 | 15 | decrease_water_flow | no | 0.0170 | 0.0152 | -0.0018 | 0.0170 | DEC | DEC | yes | no |
| 2025-05-12 | 15 | decrease_water_flow | no | 0.0170 | 0.0155 | -0.0015 | 0.0170 | DEC | MNT | no | no |
| 2025-05-14 | 15 | decrease_water_flow | no | 0.0190 | 0.0174 | -0.0016 | 0.0190 | DEC | INC | no | no |
| 2025-05-16 | 6 | increase_water_flow | yes | 0.0220 | 0.0237 | +0.0017 | 0.0220 | INC | INC | yes | no |
| 2025-05-19 | 6 | increase_water_flow | yes | 0.0260 | 0.0277 | +0.0017 | 0.0260 | INC | INC | yes | no |
| 2025-05-21 | 6 | increase_water_flow | yes | 0.0310 | 0.0327 | +0.0017 | 0.0310 | INC | INC | yes | no |
| 2025-05-22 | 6 | increase_water_flow | yes | 0.0310 | 0.0327 | +0.0017 | 0.0310 | INC | MNT | no | no |
| 2025-05-26 | 6 | increase_water_flow | yes | 0.0310 | 0.0326 | +0.0016 | 0.0310 | INC | INC | yes | no |
| 2025-05-29 | 15 | decrease_water_flow | no | 0.0290 | 0.0275 | -0.0015 | 0.0290 | DEC | DEC | yes | no |
| 2025-06-02 | 15 | decrease_water_flow | no | 0.0260 | 0.0242 | -0.0018 | 0.0260 | DEC | DEC | yes | no |
| 2025-06-04 | 15 | decrease_water_flow | no | 0.0000 | 0.0000 | +0.0000 | 0.0000 | MNT | DEC | no | no |
| 2025-06-06 | 15 | decrease_water_flow | no | 0.0240 | 0.0229 | -0.0011 | 0.0240 | DEC | INC | no | no |
| 2025-06-10 | 15 | decrease_water_flow | no | 0.0240 | 0.0228 | -0.0012 | 0.0240 | DEC | MNT | no | no |
| 2025-06-13 | 15 | decrease_water_flow | no | 0.0240 | 0.0228 | -0.0012 | 0.0240 | DEC | MNT | no | no |
| 2025-06-17 | 15 | decrease_water_flow | no | 0.0240 | 0.0229 | -0.0011 | 0.0240 | DEC | MNT | no | no |
| 2025-06-19 | 15 | decrease_water_flow | no | 0.0240 | 0.0230 | -0.0010 | 0.0240 | DEC | MNT | no | no |
| 2025-06-24 | 15 | decrease_water_flow | no | 0.0240 | 0.0230 | -0.0010 | 0.0240 | DEC | MNT | no | no |
| 2025-06-30 | 24 | decrease_water_flow | no | 0.0220 | 0.0203 | -0.0017 | 0.0220 | DEC | DEC | yes | no |
| 2025-07-02 | 24 | decrease_water_flow | no | 0.0170 | 0.0153 | -0.0017 | 0.0170 | DEC | DEC | yes | no |
| 2025-07-04 | 24 | decrease_water_flow | no | 0.0170 | 0.0154 | -0.0016 | 0.0170 | DEC | MNT | no | no |
| 2025-07-08 | 15 | decrease_water_flow | no | 0.0190 | 0.0180 | -0.0010 | 0.0190 | DEC | INC | no | no |
| 2025-07-11 | 15 | decrease_water_flow | no | 0.0220 | 0.0211 | -0.0009 | 0.0220 | DEC | INC | no | no |
| 2025-07-15 | 6 | increase_water_flow | yes | 0.0240 | 0.0250 | +0.0010 | 0.0240 | INC | INC | yes | no |
| 2025-07-18 | 6 | increase_water_flow | yes | 0.0240 | 0.0249 | +0.0009 | 0.0240 | INC | MNT | no | no |
| 2025-07-21 | 15 | decrease_water_flow | no | 0.0240 | 0.0232 | -0.0008 | 0.0240 | DEC | MNT | no | no |
| 2025-07-23 | 15 | decrease_water_flow | no | 0.0240 | 0.0232 | -0.0008 | 0.0240 | DEC | MNT | no | no |
| 2025-07-25 | 15 | decrease_water_flow | no | 0.0240 | 0.0233 | -0.0007 | 0.0240 | DEC | MNT | no | no |
| 2025-07-30 | 15 | decrease_water_flow | no | 0.0240 | 0.0226 | -0.0014 | 0.0240 | DEC | MNT | no | no |
| 2025-08-04 | 15 | decrease_water_flow | no | 0.0190 | 0.0178 | -0.0012 | 0.0190 | DEC | DEC | yes | no |
| 2025-08-11 | 15 | decrease_water_flow | no | 0.0220 | 0.0213 | -0.0007 | 0.0220 | DEC | INC | no | no |
| 2025-08-14 | 15 | decrease_water_flow | no | 0.0240 | 0.0233 | -0.0007 | 0.0240 | DEC | INC | no | no |
| 2025-08-18 | 15 | decrease_water_flow | no | 0.0240 | 0.0234 | -0.0006 | 0.0240 | DEC | MNT | no | no |
| 2025-08-25 | 15 | decrease_water_flow | no | 0.0220 | 0.0208 | -0.0012 | 0.0220 | DEC | DEC | yes | no |
