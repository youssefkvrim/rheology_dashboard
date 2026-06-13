# Barbotine Dosage Service Overview

## Purpose

`services/dosage/` is the standalone water-dosage proposal service for the
Safran barbotine dashboard. It evaluates rheology readings for M7, 2CN2, and
R55 families, classifies density, viscosity, and covering power against target
ranges, maps the triplet to the 27-scenario table, and proposes a bounded doser
flow-rate change.

The service does not actuate equipment. It records proposals as pending
adjustments and updates `flow_state` only after an operator confirms the
actually-set doser rate.

## Runtime

- CLI: `python main.py ...`
- API: `uvicorn api:app --host 127.0.0.1 --port 8100`
- SQLite: `DOSAGE_DB_PATH`, defaulting to `services/dosage/barbotine.db`
- Network posture: no CORS; bind to `127.0.0.1` only until the dashboard proxy
  is added in Phase D4.

## Barbotine Types

| Code | Role | Base Flow | Doser Step |
| --- | --- | ---: | ---: |
| M7 | Contact slurry | 0.019 L/h | 0.002 L/h |
| 2CN2 | Intermediate slurry | 0.022 L/h | 0.002 L/h |
| R55 | Reinforcement slurry | 0.034 L/h | 0.003 L/h |

## Module Map

```text
services/dosage/
  main.py                 CLI commands
  api.py                  FastAPI endpoints and lifespan startup
  clock.py                UTC-aware injectable clock helper
  config.py               Profiles, doser configs, safety limits
  models.py               Domain enums and dataclasses
  decision_engine.py      Confidence scoring, hysteresis, scenario lookup
  flow_controller.py      Delta caps and doser snapping
  evaluator.py            Post-adjustment outcome evaluation
  analytics.py            Adjustment frequency and drift statistics
  data_store.py           SQLite persistence
  tests/                  unittest coverage
```

## D0 State Machine

The D0 fix made proposal and commit separate states.

1. `decide` / `POST /decisions/{type}` computes a proposal from the current
   flow state and confirmed adjustment history.
2. Before inserting the new proposal, any prior pending adjustment for the same
   type is marked `superseded=1`.
3. The new adjustment is inserted with `user_confirmed=0` and
   `superseded=0`.
4. `decide` never calls `set_flow_state`.
5. `confirm` / `POST /decisions/{type}/confirm` validates that the pending
   adjustment is not older than `PENDING_TTL_HOURS` and writes the operator's
   `actual_rate` to both the adjustment row and `flow_state`.
6. `reject` / `POST /decisions/{type}/reject` marks the pending row
   `superseded=1` and leaves `flow_state` unchanged.

This preserves the non-negotiable principle: the software proposes; a human
disposes.

## Decision Flow

1. Auto-evaluate the most recent confirmed adjustment when enough post-data
   exists.
2. Compute a rolling average of the recent readings.
3. Classify density, viscosity, and covering power with hysteresis.
4. Compute continuous confidence scores.
5. Resolve the 27-scenario decision table.
6. Compute a severity-weighted raw delta.
7. Apply the 24-hour daily cap from confirmed operator deltas only:
   `abs(actual_rate - current_rate)` for `user_confirmed=1` rows.
8. Snap the proposal to nearby valid doser rates.
9. Insert a pending adjustment.
10. Wait for explicit operator confirmation or rejection.

## Safety Limits

- Per adjustment: `+/-0.002 L/h`
- Per 24 hours: `+/-0.048 L/day`, confirmed physical deltas only
- Pending confirmation TTL: `4 h`
- Hysteresis band: `5%`
- Flow floor: `0 L/h`

## SQLite Tables

```sql
measurements(
  id, barbotine_type, density, viscosity, covering_power, temperature, timestamp
)

adjustments(
  id, barbotine_type, scenario_id,
  density_status, viscosity_status, cp_status,
  conf_density, conf_viscosity, conf_cp,
  decision, current_rate, proposed_rate, actual_rate,
  user_confirmed, superseded, timestamp
)

flow_state(
  barbotine_type, current_rate,
  last_density_status, last_visc_status, last_cp_status, updated_at
)

action_outcomes(
  id, adjustment_id, barbotine_type,
  pre_density, pre_viscosity, pre_cp, pre_temperature,
  post_density, post_viscosity, post_cp, post_temperature,
  verdict, detail, evaluated_at
)
```

## API Surface

- `GET /health`
- `POST /measurements`
- `POST /decisions/{type}`
- `POST /decisions/{type}/confirm`
- `POST /decisions/{type}/reject`
- `GET /status`
- `GET /status/{type}`
- `GET /history/{type}`
- `GET /adjustments/{type}`
- `GET /analytics/{type}`

## CLI Surface

- `init`
- `add-measurement`
- `decide`
- `confirm`
- `reject`
- `status`
- `history`
- `analytics`
- `import-csv`

## Tests

The current unittest suite covers decision classification, flow-controller caps
and snapping, API/CLI decide side-effect isolation, pending supersession,
confirm, reject, stale-confirm `409`, and the confirmed-only daily cap.
