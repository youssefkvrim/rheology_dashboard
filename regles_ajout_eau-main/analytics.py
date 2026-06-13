"""
Analytics module: adjustment frequency/magnitude tracking and drift detection.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from models import AdjustmentRecord, Decision


@dataclass
class AdjustmentStats:
    window_hours: int
    total: int
    increases: int
    maintains: int
    decreases: int
    confirmed: int
    unconfirmed: int
    avg_proposed_magnitude: float
    max_proposed_magnitude: float
    avg_actual_magnitude: float | None
    adjustments_per_day: float
    magnitude_trend: str          # "stable", "increasing", "decreasing"
    drift_alert: bool
    drift_detail: str


def compute_stats(
    adjustments: list[AdjustmentRecord],
    window_hours: int = 168,
) -> AdjustmentStats:
    if not adjustments:
        return AdjustmentStats(
            window_hours=window_hours, total=0, increases=0, maintains=0,
            decreases=0, confirmed=0, unconfirmed=0,
            avg_proposed_magnitude=0.0, max_proposed_magnitude=0.0,
            avg_actual_magnitude=None, adjustments_per_day=0.0,
            magnitude_trend="stable", drift_alert=False, drift_detail="",
        )

    total = len(adjustments)
    increases = sum(1 for a in adjustments if a.decision == Decision.INCREASE)
    decreases = sum(1 for a in adjustments if a.decision == Decision.DECREASE)
    maintains = sum(1 for a in adjustments if a.decision == Decision.MAINTAIN)
    confirmed = sum(1 for a in adjustments if a.user_confirmed)
    unconfirmed = total - confirmed

    proposed_mags = [abs(a.proposed_delta) for a in adjustments]
    avg_proposed = sum(proposed_mags) / total if total else 0.0
    max_proposed = max(proposed_mags) if proposed_mags else 0.0

    actual_deltas = [a.actual_delta for a in adjustments if a.actual_delta is not None]
    avg_actual = (
        sum(abs(d) for d in actual_deltas) / len(actual_deltas)
        if actual_deltas else None
    )

    days = window_hours / 24.0
    per_day = total / days if days > 0 else 0.0

    trend, drift, detail = _detect_trend(adjustments)

    return AdjustmentStats(
        window_hours=window_hours,
        total=total,
        increases=increases,
        maintains=maintains,
        decreases=decreases,
        confirmed=confirmed,
        unconfirmed=unconfirmed,
        avg_proposed_magnitude=round(avg_proposed, 6),
        max_proposed_magnitude=round(max_proposed, 6),
        avg_actual_magnitude=round(avg_actual, 6) if avg_actual is not None else None,
        adjustments_per_day=round(per_day, 2),
        magnitude_trend=trend,
        drift_alert=drift,
        drift_detail=detail,
    )


def _detect_trend(
    adjustments: list[AdjustmentRecord],
) -> tuple[str, bool, str]:
    """
    Split adjustments into two halves, compare average magnitude.
    If second half is significantly larger, flag drift.
    """
    if len(adjustments) < 6:
        return "stable", False, "insufficient data for trend detection"

    mid = len(adjustments) // 2
    first_half = adjustments[:mid]
    second_half = adjustments[mid:]

    avg_first = sum(abs(a.proposed_delta) for a in first_half) / len(first_half)
    avg_second = sum(abs(a.proposed_delta) for a in second_half) / len(second_half)

    if avg_first == 0:
        if avg_second == 0:
            return "stable", False, ""
        return "increasing", True, f"magnitude rose from 0 to {avg_second:.6f}"

    ratio = avg_second / avg_first

    if ratio > 1.5:
        return (
            "increasing",
            True,
            f"magnitude grew {ratio:.1f}x (first half avg={avg_first:.6f}, "
            f"second half avg={avg_second:.6f}). Possible equipment degradation.",
        )
    elif ratio < 0.67:
        return (
            "decreasing",
            False,
            f"magnitude dropped to {ratio:.1f}x — system converging.",
        )
    return "stable", False, ""
