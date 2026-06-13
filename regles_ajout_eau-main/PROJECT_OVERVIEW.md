# PROJECT_OVERVIEW.md — Barbotine Water-Addition Control System v2

## Purpose

Industrial process control system for regulating water addition to ceramic barbotine.
Decisions are made from rheological property classification against a 27-scenario
decision table, with confidence-based scoring, hysteresis anti-oscillation,
doser hardware awareness, action feedback evaluation, and full audit logging.

Dual interface: CLI for terminal operation + REST API for dashboard integration.

## Barbotine Types

| Code | Name                    | Base Flow | Doser Step |
|------|-------------------------|-----------|------------|
| M7   | Barbotine de contact    | 0.019 L/h | 0.002 L/h |
| 2CN2 | Barbotine intermediaire | 0.022 L/h | 0.002 L/h |
| R55  | Barbotine de renfort    | 0.034 L/h | 0.003 L/h |

## Architecture

```
main.py                CLI: init, add-measurement, decide, confirm, status, history, analytics, import-csv
api.py                 FastAPI REST: /measurements, /decisions, /confirm, /status, /history, /adjustments, /analytics, /health
  |
  +-- decision_engine.py    Confidence scoring + hysteresis classification + 27-scenario lookup
  +-- flow_controller.py    Safety-bounded delta + doser hardware snapping
  +-- evaluator.py          Auto-evaluates previous adjustment effectiveness
  +-- analytics.py          Adjustment frequency/magnitude tracking + drift detection
  +-- data_store.py         SQLite persistence (4 tables)
  +-- config.py             Constants, profiles, doser configs, safety limits
  +-- models.py             Enums + dataclasses (13 types)
tests/
  +-- test_decision_engine.py   26 unit tests
```

## File Responsibilities

### models.py
- `BarbotineType` — M7, 2CN2, R55
- `PropertyStatus` — HIGHER, CONFORM, LOWER
- `Decision` — INCREASE, MAINTAIN, DECREASE
- `OutcomeVerdict` — EFFECTIVE, INSUFFICIENT, OVERCORRECTED, NO_EFFECT, PENDING
- `RheologyReading` — density, viscosity, covering_power, temperature (nullable)
- `ConfidenceScore` — continuous deviation scores per property + severity
- `StatusTriplet` — classified status + deviation_count
- `DoserConfig` — min_rate, increment (0.002 or 0.003)
- `Measurement` — timestamped reading
- `AdjustmentRecord` — full decision context: proposed_rate, actual_rate, user_confirmed
- `ActionOutcome` — pre/post averages + effectiveness verdict

### config.py
- `PropertyRange` — (min, max) + midpoint + halfwidth
- `BarbotineProfile` — base_flow_rate + 3 property ranges
- `PROFILES` — per-type profiles (calibrate before production)
- `DOSER_CONFIGS` — per-type hardware constraints
- Safety: MAX_DELTA=0.002 L/h, MAX_DAILY=0.048 L/day, WINDOW=72h
- Scoring: HYSTERESIS_BAND=0.05, MIN_STEP=0.0005
- Evaluation: EVALUATION_WINDOW=24h, MIN_MEASUREMENTS=3

### decision_engine.py
- `SCENARIO_TABLE` — 27-entry lookup: status triplet -> (scenario_id, decision)
- `compute_score()` — continuous normalized deviation from range center
- `compute_confidence()` — full ConfidenceScore from reading + profile
- `classify_value()` — with optional hysteresis from previous status
- `classify_reading()` — full reading classification with hysteresis
- `resolve_scenario()` — triplet -> (id, decision)

### flow_controller.py
- `compute_raw_delta()` — severity-weighted proportional adjustment
- `cumulative_delta_today()` / `apply_daily_cap()` — 24h budget enforcement
- `snap_to_doser()` — nearest valid hardware rates for a proposed value
- `compute_proposed_rate()` — full pipeline: raw -> capped -> snapped with options

### evaluator.py
- `evaluate_last_adjustment()` — auto-evaluates most recent confirmed adjustment
- Compares pre/post 72h averages, classifies outcome as EFFECTIVE/INSUFFICIENT/OVERCORRECTED/NO_EFFECT
- Runs automatically at the start of each `decide` cycle

### analytics.py
- `AdjustmentStats` — frequency, magnitude, trend, drift alert dataclass
- `compute_stats()` — aggregate statistics over configurable window
- `_detect_trend()` — split-half magnitude comparison for drift detection

### data_store.py
- SQLite with WAL, 4 tables: measurements, adjustments, flow_state, action_outcomes
- Measurements: CRUD + rolling average (handles nullable temperature)
- Adjustments: insert, confirm, get pending/last confirmed/window/all
- Flow state: rate + last classification status (for hysteresis)
- Outcomes: insert + existence check

### main.py (CLI)
- `init` — bootstrap DB + baseline flow rates
- `add-measurement` — record reading with optional --temp
- `decide` — full pipeline: evaluate previous -> 72h avg -> classify (with hysteresis) -> confidence score -> scenario -> propose rate -> doser options -> interactive confirm
- `confirm` — finalize pending adjustment with actual doser rate
- `status` — flow rates + doser step + last classification
- `history` — tabular measurement dump with temperature
- `analytics` — frequency/magnitude/drift analysis
- `import-csv` — bulk import (columns: type, density, viscosity, covering_power, temperature, timestamp)

### api.py (REST)
- FastAPI with CORS enabled for React dashboard
- `POST /measurements` — ingest reading
- `POST /decisions/{type}` — full decision cycle, returns proposal + doser options
- `POST /decisions/{type}/confirm` — finalize with actual rate
- `GET /status` — all types or single type
- `GET /history/{type}?hours=N` — measurement history
- `GET /adjustments/{type}?hours=N` — decision log
- `GET /analytics/{type}?hours=N` — frequency/drift stats
- `GET /health` — heartbeat

## Decision Flow

1. Auto-evaluate previous confirmed adjustment (if exists and not yet evaluated)
2. Compute 72h rolling average of (density, viscosity, covering_power, temperature)
3. Load previous classification status for hysteresis
4. Classify each property with hysteresis-aware thresholds
5. Compute continuous confidence scores (normalized deviation from range center)
6. Look up scenario in 27-entry table
7. Compute severity-weighted proportional delta
8. Apply 24h cumulative cap
9. Snap proposed rate to valid doser hardware values
10. Present proposal + doser options to user/dashboard
11. User confirms actual rate set on doser
12. Log everything (proposed, actual, confidence, scenario, outcome)

## Safety

- Per-adjustment: +/-0.002 L/h
- Daily cumulative: +/-0.048 L/day
- Flow floor: 0 L/h minimum
- Hysteresis: 5% band prevents oscillation at classification boundaries
- All adjustments require explicit user confirmation
- Full audit trail in SQLite

## Database Schema

```sql
measurements(id, barbotine_type, density, viscosity, covering_power, temperature, timestamp)
adjustments(id, barbotine_type, scenario_id, *_status, conf_*, decision, current_rate, proposed_rate, actual_rate, user_confirmed, timestamp)
flow_state(barbotine_type, current_rate, last_*_status, updated_at)
action_outcomes(id, adjustment_id, barbotine_type, pre_*, post_*, verdict, detail, evaluated_at)
```

## Documentation

- `PROPOSITIONS.md` — 9-section future enhancement roadmap
- `REINFORCEMENT_LEARNING.md` — Detailed RL implementation plan (SAC, TorchRL/SB3, 12-month timeline)
- `MANUAL.md` — Expanded scenario table convergence strategy (temperature, age, trend)
