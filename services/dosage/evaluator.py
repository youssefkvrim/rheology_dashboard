"""
Action feedback evaluator.

Automatically evaluates the effectiveness of confirmed adjustments by comparing
pre-adjustment and post-adjustment rheological averages.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from config import EVALUATION_WINDOW_HOURS, MIN_MEASUREMENTS_FOR_EVAL, PROFILES
from data_store import (
    compute_rolling_average,
    get_last_confirmed_adjustment,
    get_measurements_window,
    insert_outcome,
    outcome_exists,
)
from decision_engine import classify_reading
from models import (
    ActionOutcome,
    AdjustmentRecord,
    BarbotineType,
    Decision,
    OutcomeVerdict,
    PropertyStatus,
    RheologyReading,
)


def evaluate_last_adjustment(btype: BarbotineType) -> ActionOutcome | None:
    """
    Evaluate the most recent confirmed adjustment.
    Returns None if nothing to evaluate or insufficient post-data.
    """
    adj = get_last_confirmed_adjustment(btype)
    if adj is None or adj.id is None:
        return None

    if outcome_exists(adj.id):
        return None

    cutoff = adj.timestamp + timedelta(hours=1)
    post_measurements = get_measurements_window(btype, hours=EVALUATION_WINDOW_HOURS, since=cutoff)

    if len(post_measurements) < MIN_MEASUREMENTS_FOR_EVAL:
        return None

    pre_measurements = get_measurements_window(
        btype, hours=72, since=adj.timestamp - timedelta(hours=72)
    )
    pre_cutoff = [m for m in pre_measurements if m.timestamp <= adj.timestamp]
    pre_avg = compute_rolling_average(pre_cutoff)
    post_avg = compute_rolling_average(post_measurements)

    if pre_avg is None or post_avg is None:
        return None

    verdict, detail = _judge(adj, pre_avg, post_avg)

    outcome = ActionOutcome(
        adjustment_id=adj.id,
        barbotine_type=btype,
        pre_avg=pre_avg,
        post_avg=post_avg,
        verdict=verdict,
        detail=detail,
    )
    insert_outcome(outcome)
    return outcome


def _judge(
    adj: AdjustmentRecord,
    pre: RheologyReading,
    post: RheologyReading,
) -> tuple[OutcomeVerdict, str]:
    """
    Compare pre/post averages relative to the decision taken.
    """
    profile = PROFILES[adj.barbotine_type]
    pre_status = classify_reading(pre, profile)
    post_status = classify_reading(post, profile)

    pre_deviations = pre_status.deviation_count
    post_deviations = post_status.deviation_count

    if adj.decision == Decision.MAINTAIN:
        if post_deviations <= pre_deviations:
            return OutcomeVerdict.EFFECTIVE, "Properties remained stable or improved."
        return OutcomeVerdict.INSUFFICIENT, "Properties drifted despite maintain decision."

    moved_toward = _count_moved_toward_conform(adj.decision, pre_status, post_status)
    moved_past = _count_overshot(adj.decision, pre_status, post_status)

    if moved_past > 0:
        return (
            OutcomeVerdict.OVERCORRECTED,
            f"{moved_past} propert(ies) overshot past conform range.",
        )

    if post_deviations < pre_deviations:
        return OutcomeVerdict.EFFECTIVE, f"Deviations reduced from {pre_deviations} to {post_deviations}."

    if moved_toward > 0 and post_deviations == pre_deviations:
        return OutcomeVerdict.INSUFFICIENT, f"{moved_toward} propert(ies) improved but not enough."

    return OutcomeVerdict.NO_EFFECT, "No measurable change in property classification."


def _count_moved_toward_conform(
    decision: Decision,
    pre: "StatusTriplet",
    post: "StatusTriplet",
) -> int:
    """Count properties that moved closer to CONFORM."""
    count = 0
    for pre_s, post_s in zip(pre.as_tuple(), post.as_tuple()):
        if pre_s == PropertyStatus.CONFORM:
            continue
        if post_s == PropertyStatus.CONFORM:
            count += 1
        elif decision == Decision.INCREASE and pre_s == PropertyStatus.HIGHER and post_s != PropertyStatus.HIGHER:
            count += 1
        elif decision == Decision.DECREASE and pre_s == PropertyStatus.LOWER and post_s != PropertyStatus.LOWER:
            count += 1
    return count


def _count_overshot(
    decision: Decision,
    pre: "StatusTriplet",
    post: "StatusTriplet",
) -> int:
    """Count properties that went from one extreme past conform to the other."""
    count = 0
    for pre_s, post_s in zip(pre.as_tuple(), post.as_tuple()):
        if decision == Decision.INCREASE:
            if pre_s == PropertyStatus.HIGHER and post_s == PropertyStatus.LOWER:
                count += 1
        elif decision == Decision.DECREASE:
            if pre_s == PropertyStatus.LOWER and post_s == PropertyStatus.HIGHER:
                count += 1
    return count
