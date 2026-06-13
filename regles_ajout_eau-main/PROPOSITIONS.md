# PROPOSITIONS.md — Future Enhancements Roadmap

This document outlines concrete proposals to evolve the barbotine water-addition
control system from a rule-based decision engine to an adaptive, self-learning
industrial control platform.

---

## 1. Temperature Integration (Priority: HIGH)

**Current gap:** Temperature affects viscosity and density readings significantly.
A cold barbotine reads denser and more viscous than it actually is at operating
temperature. Without compensation, the system will over-add water in winter and
under-add in summer.

**Proposal:**
- Add `temperature` field to `Measurement` and `RheologyReading`.
- Introduce temperature-compensated classification: normalize readings to a
  reference temperature (e.g., 20 C) before classifying.
- Compensation model: linear correction coefficients per barbotine type,
  calibrated from historical data. Example:
  ```
  density_compensated = density_raw - alpha_d * (T - T_ref)
  viscosity_compensated = viscosity_raw - alpha_v * (T - T_ref)
  ```
- Extend the scenario table: optionally add temperature as a 4th axis
  (3x3x3x3 = 81 scenarios) or keep 27 scenarios on compensated values (simpler,
  recommended as first step).

---

## 2. Action Feedback Loop (Priority: HIGH)

**Current gap:** The system fires decisions but never learns whether they were
effective. There is no feedback on what happened to rheological properties after
an adjustment.

**Proposal:**
- After each adjustment, track subsequent measurements (6h, 12h, 24h post-action).
- Compute the delta in each property between pre-decision average and post-action
  average.
- Store this as an `ActionOutcome` record:
  ```
  ActionOutcome:
    adjustment_id, barbotine_type,
    pre_density, post_density, delta_density,
    pre_viscosity, post_viscosity, delta_viscosity,
    pre_cp, post_cp, delta_cp,
    response_quality: EFFECTIVE | INSUFFICIENT | OVERCORRECTED | NO_EFFECT
  ```
- Expose a `evaluate` CLI command to review outcomes.
- This data becomes the training set for the ML module (section 4).

---

## 3. Weighted / Confidence-Based Scenario Matching (Priority: MEDIUM)

**Current gap:** The 27-scenario table uses hard thresholds. A reading 0.001 above
the conform max triggers the same response as one 0.100 above. This creates
jitter at boundaries.

**Proposal:**
- Replace binary classification with a continuous score per property:
  ```
  score = (value - range_midpoint) / (range_halfwidth)
  ```
  Score in [-1, 1] = conform. Outside = deviation with magnitude.
- Use the magnitude to weight the flow delta continuously rather than in
  discrete 1/3 steps.
- Introduce hysteresis: require a property to exceed the threshold by a
  margin before switching status (prevents oscillation).
  ```
  HYSTERESIS_BAND = 0.02  (2% of range width)
  ```
- Optional: fuzzy logic membership functions for smooth transitions between
  HIGHER/CONFORM/LOWER.

---

## 4. Machine Learning Module (Priority: MEDIUM)

**Current gap:** The 27-scenario table is a fixed expert system. It cannot adapt
to aging equipment, seasonal changes, raw material batch variation, or operator
preferences.

**Proposal — Phase A (Supervised Recommendation):**
- Train a gradient-boosted model (XGBoost or LightGBM) on ActionOutcome data
  once sufficient history exists (minimum ~200 decisions with feedback).
- Features: 72h avg density/viscosity/CP, temperature, current flow rate,
  time-of-day, day-of-week, recent trend (slope over 72h).
- Target: optimal delta (continuous) or decision class (categorical).
- The ML model outputs a recommendation alongside the rule-based decision.
  Operator sees both; rule-based remains authoritative until ML is validated.

**Proposal — Phase B (Online Learning):**
- Once confidence is established, switch to ML-primary with rule-based as
  safety fallback.
- Implement online learning: update model weights incrementally as new
  ActionOutcome data arrives.
- Anomaly detection: flag readings that fall outside the model's training
  distribution (novelty detection) and fall back to rule-based.

**Proposal — Phase C (Reinforcement Learning):**
- Model the system as a Markov Decision Process:
  - State: (rolling avg of properties, current flow rate, temperature, time)
  - Action: flow delta in [-MAX_DELTA, +MAX_DELTA]
  - Reward: conformity score at next measurement window
- Train with Proximal Policy Optimization (PPO) in simulation first,
  then deploy with conservative exploration.
- Guardrails: hard-clip actions to safety bounds regardless of policy output.

---

## 5. REST API Layer (Priority: MEDIUM)

**Current gap:** CLI-only interface. No integration path for SCADA, MES, or
dashboard systems.

**Proposal:**
- FastAPI service wrapping the existing logic.
- Endpoints:
  ```
  POST /measurements          — ingest reading
  POST /decisions/{type}      — trigger decision cycle, return result
  GET  /status                — current flow rates
  GET  /history/{type}        — measurement history
  GET  /adjustments/{type}    — decision log
  GET  /health                — system health check
  ```
- WebSocket endpoint for real-time dashboard push.
- Authentication: API key for sensor systems, JWT for operator UI.
- Rate limiting per barbotine type to prevent runaway automation.

---

## 6. Operator Dashboard (Priority: LOW-MEDIUM)

**Proposal:**
- Web UI (React or HTMX for simplicity) showing:
  - Real-time flow rates per barbotine type with trend sparklines.
  - Last decision with scenario details and confidence.
  - 72h property history charts (density, viscosity, CP) with conform bands.
  - Adjustment log with filtering.
  - Manual override interface with audit trail.
- Alerts: push notification when flow rate hits 0 (couper l'eau) or when
  ML and rule-based disagree.

---

## 7. Multi-Line / Multi-Site Support (Priority: LOW)

**Current gap:** Single-line system. Each barbotine type is treated independently.

**Proposal:**
- Extend data model with `line_id` and `site_id` dimensions.
- Shared config management with per-line profile overrides.
- Cross-line correlation analysis: if M7 on Line A shifts, does R55 on Line A
  follow? This hints at upstream raw material changes.
- Centralized database (PostgreSQL) with per-site SQLite as local cache
  for resilience.

---

## 8. Predictive Maintenance Signal (Priority: LOW)

**Proposal:**
- Track the frequency and magnitude of adjustments over time.
- A barbotine requiring progressively larger corrections may indicate:
  - Pump degradation
  - Valve fouling
  - Raw material quality drift
  - Mixer inefficiency
- Implement trend detection on adjustment history and alert when
  correction magnitude exceeds 2-sigma of historical norm.

---

## 9. Expanded Scenario Table (Priority: ONGOING)

**Current state:** 27 scenarios (3^3 combinatorial).

**Future dimensions:**
- Temperature: HOT / NOMINAL / COLD → 81 scenarios
- Trend direction (rising/stable/falling) per property → 3^6 = 729 scenarios
  (not practical as manual table; motivates ML transition).
- Batch age: FRESH / MID / OLD → accounts for time-dependent thixotropy.

**Recommendation:** Do not expand the manual table beyond 81 entries. Beyond that,
the ML module (section 4) should take over. The manual table serves as the
interpretable safety baseline.

---

## Implementation Priority Order

1. Temperature compensation — immediate accuracy gain, low effort
2. Action feedback loop — prerequisite for everything adaptive
3. Hysteresis / continuous scoring — reduce oscillation, medium effort
4. ML supervised recommendation — once 200+ feedback records exist
5. REST API — when integration with plant systems is needed
6. Dashboard — when operators need real-time visibility
7. Multi-site — when scaling beyond single installation
8. Predictive maintenance — value-add on mature system
9. RL-based control — research-grade, long-term

---

*This document is a living roadmap. Priorities will shift based on field performance
data and operational requirements.*
