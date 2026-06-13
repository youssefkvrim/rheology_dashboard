# MANUAL.md — Expanded Scenario Table: Convergence Strategy

This document addresses how to systematically expand the 27-scenario decision table
to incorporate **temperature**, **batch age**, and **trend direction** as additional
decision axes, without the table becoming unmanageable.

---

## 1. Current State

The existing system uses a 3^3 = 27 scenario table:

```
Axes:     density (H/C/L) x viscosity (H/C/L) x covering_power (H/C/L)
Outputs:  INCREASE / MAINTAIN / DECREASE water flow
```

This is a clean, interpretable system. The problem: it treats all situations
identically regardless of temperature, batch freshness, or whether properties
are trending toward or away from conformity.

---

## 2. New Axes Under Consideration

### 2.1 Temperature (T)

**Levels**: COLD / NOMINAL / HOT (3 levels)

**Why it matters**: Cold barbotine has artificially elevated density and viscosity
readings. Without compensation, the system will add water unnecessarily.

**Current data status**: Being collected but not yet sufficient for rule extraction.

**Action plan**:
1. **Months 1-3**: Collect temperature alongside every measurement. Store it.
   The system already does this.
2. **Months 3-6**: Accumulate enough data to compute correlation coefficients:
   - `corr(temperature, density)` per barbotine type
   - `corr(temperature, viscosity)` per barbotine type
   - `corr(temperature, covering_power)` per barbotine type
3. **Month 6**: If |correlation| > 0.3 for any property, fit linear compensation:
   ```
   property_compensated = property_raw - alpha * (T - T_ref)
   ```
   Where `T_ref = 20.0 C` (or your plant's nominal).
4. **Month 6-9**: Run compensated classification in shadow mode alongside raw.
   Compare which produces better outcomes.
5. **Decision point**: If compensation improves outcomes by >10%, switch to
   compensated values. The 27-scenario table stays at 27 entries but operates
   on compensated inputs. This is the recommended first approach.
6. **If compensation is insufficient**: Expand to 3x3x3x3 = 81 scenarios with
   explicit temperature axis. Only do this if the linear compensation model
   fails to capture the relationship (e.g., non-linear or interaction effects).

### 2.2 Batch Age (A)

**Levels**: FRESH / MID / OLD (3 levels)

**Why it matters**: Barbotine properties drift with age due to:
- Water evaporation (density increases over time)
- Thixotropic recovery (viscosity changes non-linearly)
- Particle settling (covering power drops)

**How to track**:
- Add `batch_id` and `batch_start_date` fields to the system.
- Age = (current_time - batch_start_date) in hours.
- Classification: FRESH (0-48h), MID (48-120h), OLD (>120h).
  These thresholds are barbotine-type dependent. Calibrate from data.

**Action plan**:
1. **Start now**: Add batch tracking to the measurement workflow.
   When a new batch is prepared, record it. When measuring, associate
   the reading with the active batch.
2. **After 3 months**: Analyze how property averages shift with age:
   ```
   For each barbotine type:
     Group measurements by age bracket (FRESH/MID/OLD).
     Compute mean and std of each property per bracket.
     If means differ by >1 std across brackets, age is significant.
   ```
3. **If significant**: Two options:
   - **Age-compensated values** (same approach as temperature): subtract
     the expected drift. Keep 27 scenarios.
   - **Explicit age axis**: expand to 81 scenarios (27 x 3 age levels).

**Recommendation**: Start with age-compensation. Only expand the table if
compensation is inadequate.

### 2.3 Trend Direction (TD)

**Levels**: RISING / STABLE / FALLING (3 levels) per property

**Why it matters**: A density that is currently 1.82 (at the top of conform)
and rising is very different from one that is 1.82 and falling. The current
system treats them identically.

**How to compute**:
- Linear regression slope over the 72h measurement window.
- Classification:
  ```
  slope = linregress(timestamps, property_values).slope
  threshold = 0.001 * property_range_width / 72  # 0.1% of range per hour

  if slope > threshold:  RISING
  elif slope < -threshold: FALLING
  else: STABLE
  ```

**Impact on scenario table**:
- Adding trend for all 3 properties: 3^3 trend combinations = 27
- Combined with existing 27: 27 x 27 = 729 scenarios.
- This is unmanageable as a manual table.

**Action plan**:
1. Compute trend slopes and store them with each decision (add to adjustment log).
2. Do NOT expand the scenario table for trends.
3. Instead, use trends to **modulate the adjustment magnitude**:
   ```python
   def trend_modifier(trend_slopes, decision):
       """
       If properties are trending in the direction of the decision,
       reduce the adjustment (the system is self-correcting).
       If trending against, amplify.
       """
       # ... returns a multiplier in [0.5, 1.5]
   ```
4. This keeps 27 scenarios but adds trend-awareness to the flow delta.

---

## 3. Expansion Strategy: The Compensation-First Principle

**Core rule: Never expand the scenario table if a compensation model can
handle the new axis.**

The decision hierarchy:

```
Level 1: Compensate inputs (keep 27 scenarios)
  → Linear correction for temperature
  → Age-drift subtraction
  → Trend-based magnitude modulation

Level 2: Expand table for the most impactful axis (81 scenarios)
  → Only if compensation fails for that axis
  → Most likely candidate: temperature (if non-linear effects)

Level 3: ML takes over (no fixed table)
  → When axes > 2 extra, the table is too large for manual management
  → The 27-scenario table becomes the safety fallback only
```

---

## 4. Statistical Tests for When to Add Rules

Before expanding the table, run these tests on accumulated data:

### 4.1 Is the new axis significant?

**Test**: Two-way ANOVA or Kruskal-Wallis on adjustment outcomes grouped by the
new axis levels.

```python
from scipy.stats import kruskal

# Group outcomes by temperature bracket
cold_outcomes = [o.verdict_score for o in outcomes if o.temperature_bracket == "COLD"]
nominal_outcomes = [o.verdict_score for o in outcomes if o.temperature_bracket == "NOMINAL"]
hot_outcomes = [o.verdict_score for o in outcomes if o.temperature_bracket == "HOT"]

stat, p_value = kruskal(cold_outcomes, nominal_outcomes, hot_outcomes)
if p_value < 0.05:
    print("Temperature significantly affects outcomes. Consider expansion.")
```

### 4.2 Does compensation work?

**Test**: Compare outcome quality (% EFFECTIVE verdicts) between raw and
compensated classification over the same data.

```
compensated_effective_rate = count(EFFECTIVE in compensated) / total
raw_effective_rate = count(EFFECTIVE in raw) / total

if compensated_effective_rate > raw_effective_rate + 0.10:
    # Compensation adds >10% effectiveness. Use it.
    adopt_compensation()
else:
    # Compensation doesn't help enough. Consider table expansion.
    consider_expansion()
```

### 4.3 Minimum data requirements

| Action | Minimum data |
|--------|-------------|
| Correlation analysis | 100 measurements with the new variable |
| Compensation model fitting | 200 measurements spanning the full range |
| Statistical significance test | 50 outcomes per bracket |
| Table expansion validation | 20 outcomes per new scenario cell |

For an 81-scenario table, that's 81 x 20 = 1,620 outcomes minimum. At 1-3
adjustments per day per barbotine type, that's 1.5-4.5 years of data. This is
why compensation-first is strongly preferred.

---

## 5. Implementation Sequence

### Now (Month 0)
- [x] Store temperature with every measurement
- [ ] Add `batch_id` tracking to the measurement workflow
- [ ] Compute and log trend slopes at each decision

### Month 3
- [ ] Run correlation analysis: temperature vs each property
- [ ] Run age-bracket analysis if batch tracking is in place
- [ ] Generate report: "Is temperature/age significant?"

### Month 6
- [ ] If temperature correlation > 0.3: implement linear compensation
- [ ] Run compensated vs raw in shadow mode for 1 month

### Month 9
- [ ] Evaluate shadow mode results
- [ ] If compensation effective: adopt as default
- [ ] If not: design 81-scenario table with temperature axis

### Month 12
- [ ] Evaluate age compensation
- [ ] Implement trend-based magnitude modulation
- [ ] Begin RL data collection in earnest (see REINFORCEMENT_LEARNING.md)

---

## 6. Trend Slope Computation (Ready to Implement)

Add to `analytics.py`:

```python
import numpy as np

def compute_trend_slopes(measurements: list[Measurement]) -> dict[str, float]:
    """
    Compute linear regression slopes for each property over the measurement window.
    Returns slopes in property-units per hour.
    """
    if len(measurements) < 3:
        return {"density": 0.0, "viscosity": 0.0, "covering_power": 0.0}

    t0 = measurements[0].timestamp
    hours = [(m.timestamp - t0).total_seconds() / 3600.0 for m in measurements]
    x = np.array(hours)

    slopes = {}
    for prop in ("density", "viscosity", "covering_power"):
        y = np.array([getattr(m.reading, prop) for m in measurements])
        if x.std() == 0:
            slopes[prop] = 0.0
        else:
            slope = np.polyfit(x, y, 1)[0]
            slopes[prop] = round(float(slope), 8)
    return slopes
```

This can be integrated immediately. Store slopes in the adjustment log.
After 3 months, analyze whether trend direction correlates with outcome quality.

---

## 7. Batch Age Tracking (Schema Addition)

Add to `data_store.py` when ready:

```sql
CREATE TABLE IF NOT EXISTS batches (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    barbotine_type  TEXT NOT NULL,
    started_at      TEXT NOT NULL,
    ended_at        TEXT,
    notes           TEXT
);

ALTER TABLE measurements ADD COLUMN batch_id INTEGER REFERENCES batches(id);
```

CLI command: `python main.py new-batch M7 [--notes "..."]`

Age classification:
```python
def classify_age(hours_since_start: float, barbotine_type: BarbotineType) -> str:
    thresholds = {
        BarbotineType.M7:  (48, 120),
        BarbotineType.CN2: (36, 96),
        BarbotineType.R55: (60, 144),
    }
    fresh_limit, old_limit = thresholds[barbotine_type]
    if hours_since_start < fresh_limit:
        return "FRESH"
    elif hours_since_start < old_limit:
        return "MID"
    return "OLD"
```

---

## 8. Decision Tree for Operators

```
Q: Should I expand the scenario table?
│
├── Do I have 100+ measurements with the new variable?
│   ├── No  → Keep collecting. Do nothing yet.
│   └── Yes → Run correlation analysis.
│
├── Is the correlation significant (|r| > 0.3 or p < 0.05)?
│   ├── No  → The variable doesn't matter. Don't expand.
│   └── Yes → Try compensation model.
│
├── Does compensation improve outcomes by >10%?
│   ├── Yes → Use compensation. Keep 27 scenarios.
│   └── No  → The relationship is non-linear or has interactions.
│
├── Do I have 20+ outcomes per new scenario cell?
│   ├── No  → Not enough data. Continue with compensation + collect more.
│   └── Yes → Expand the table. Validate with held-out data.
│
└── Is the expanded table > 81 entries?
    ├── No  → Manual table is manageable. Proceed.
    └── Yes → Switch to ML. Table becomes safety fallback only.
```

---

*This strategy ensures the system grows in complexity only when data justifies it.
Premature expansion without data leads to undertested scenarios and false confidence.*
