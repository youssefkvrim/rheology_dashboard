"""
Flow controller: computes safe, bounded water-flow adjustments.

Enforces:
  - Per-adjustment cap  (MAX_DELTA_PER_ADJUSTMENT)
  - Per-day cumulative cap (MAX_DELTA_PER_DAY)
  - Proportional stepping weighted by confidence severity
  - Doser hardware constraints (min rate, valid increments)
"""

from __future__ import annotations

from datetime import datetime, timedelta

from clock import now_utc
from config import MAX_DELTA_PER_ADJUSTMENT, MAX_DELTA_PER_DAY, MIN_STEP
from models import (
    AdjustmentRecord,
    ConfidenceScore,
    Decision,
    DoserConfig,
    StatusTriplet,
)


def compute_raw_delta(
    decision: Decision,
    status: StatusTriplet,
    confidence: ConfidenceScore,
) -> float:
    """
    Compute adjustment magnitude using confidence severity for smooth scaling.
    Falls back to discrete deviation count if severity is near zero.
    """
    if decision == Decision.MAINTAIN:
        return 0.0

    severity = confidence.severity
    if severity < 0.01:
        fraction = status.deviation_count / 3.0
    else:
        fraction = min(severity / 2.0, 1.0)

    magnitude = max(MIN_STEP, fraction * MAX_DELTA_PER_ADJUSTMENT)
    magnitude = min(magnitude, MAX_DELTA_PER_ADJUSTMENT)

    return magnitude if decision == Decision.INCREASE else -magnitude


def cumulative_delta_today(
    history: list[AdjustmentRecord], now: datetime | None = None
) -> float:
    now = now or now_utc()
    cutoff = now - timedelta(hours=24)
    total = 0.0
    for record in history:
        ts = record.timestamp
        if ts.tzinfo is None and cutoff.tzinfo is not None:
            ts = ts.replace(tzinfo=cutoff.tzinfo)
        if ts < cutoff or not record.user_confirmed or record.actual_rate is None:
            continue
        total += abs(record.actual_rate - record.current_rate)
    return total


def apply_daily_cap(
    raw_delta: float,
    history: list[AdjustmentRecord],
    now: datetime | None = None,
) -> float:
    spent = cumulative_delta_today(history, now)
    remaining = MAX_DELTA_PER_DAY - spent
    if remaining <= 0:
        return 0.0
    if abs(raw_delta) > remaining:
        return remaining if raw_delta > 0 else -remaining
    return raw_delta


# ---------------------------------------------------------------------------
# Doser hardware snapping
# ---------------------------------------------------------------------------

def snap_to_doser(proposed: float, doser: DoserConfig) -> list[float]:
    """
    Return valid doser rates nearest to the proposed value, sorted by proximity.
    Accounts for min_rate and hardware increment.
    Positive proposals below min_rate return min_rate and OFF as operator options.
    """
    if proposed <= 0.0:
        return [0.0]
    if proposed < doser.min_rate:
        return [doser.min_rate, 0.0]
    if proposed == doser.min_rate:
        return [doser.min_rate]

    steps = (proposed - doser.min_rate) / doser.increment
    lower_steps = int(steps)
    lower_rate = doser.min_rate + lower_steps * doser.increment
    upper_rate = lower_rate + doser.increment

    if abs(steps - round(steps)) < 1e-9:
        return [round(doser.min_rate + round(steps) * doser.increment, 6)]

    candidates = sorted(
        [round(lower_rate, 6), round(upper_rate, 6)],
        key=lambda x: abs(x - proposed),
    )
    return candidates


def compute_proposed_rate(
    current_rate: float,
    decision: Decision,
    status: StatusTriplet,
    confidence: ConfidenceScore,
    history: list[AdjustmentRecord],
    doser: DoserConfig,
    now: datetime | None = None,
) -> tuple[float, float, list[float]]:
    """
    Returns (proposed_rate, proposed_delta, doser_options).
    proposed_rate is the system's ideal target (may not be a valid doser value).
    doser_options are the nearest valid hardware values.
    """
    raw = compute_raw_delta(decision, status, confidence)
    capped = apply_daily_cap(raw, history, now)
    ideal_rate = max(0.0, current_rate + capped)
    actual_delta = round(ideal_rate - current_rate, 6)
    proposed = round(ideal_rate, 6)

    if proposed <= 0.0:
        return 0.0, actual_delta, [0.0]

    options = snap_to_doser(proposed, doser)
    return proposed, actual_delta, options
