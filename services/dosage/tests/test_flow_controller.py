"""
Focused tests for flow-controller safety behavior.
"""

import sys
import unittest
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from clock import now_utc
from config import MAX_DELTA_PER_ADJUSTMENT, MAX_DELTA_PER_DAY
from flow_controller import (
    apply_daily_cap,
    compute_proposed_rate,
    compute_raw_delta,
    cumulative_delta_today,
    snap_to_doser,
)
from models import (
    AdjustmentRecord,
    BarbotineType,
    ConfidenceScore,
    Decision,
    DoserConfig,
    PropertyStatus,
    StatusTriplet,
)

H = PropertyStatus.HIGHER
C = PropertyStatus.CONFORM
L = PropertyStatus.LOWER


def _status(d=H, v=C, cp=C):
    return StatusTriplet(d, v, cp)


def _confirmed(delta: float, *, proposed_delta: float | None = None) -> AdjustmentRecord:
    current = 0.020
    actual = current + delta
    proposed = current + (proposed_delta if proposed_delta is not None else delta)
    return AdjustmentRecord(
        barbotine_type=BarbotineType.M7,
        scenario_id=1,
        status=_status(),
        confidence=ConfidenceScore(2.0, 0.0, 0.0),
        decision=Decision.INCREASE if delta >= 0 else Decision.DECREASE,
        current_rate=current,
        proposed_rate=proposed,
        actual_rate=actual,
        user_confirmed=True,
        timestamp=now_utc() - timedelta(hours=1),
    )


class TestFlowControllerD2(unittest.TestCase):
    def test_severity_near_zero_uses_deviation_count(self):
        delta = compute_raw_delta(
            Decision.INCREASE,
            _status(H, H, C),
            ConfidenceScore(0.0, 0.0, 0.0),
        )
        self.assertAlmostEqual(delta, (2 / 3) * MAX_DELTA_PER_ADJUSTMENT)

    def test_daily_cap_exactly_exhausted_returns_zero(self):
        history = [_confirmed(MAX_DELTA_PER_DAY)]
        self.assertEqual(apply_daily_cap(0.001, history, now_utc()), 0.0)

    def test_daily_cap_uses_actual_not_proposed_delta(self):
        history = [_confirmed(0.001, proposed_delta=0.040)]
        self.assertAlmostEqual(cumulative_delta_today(history, now_utc()), 0.001)

    def test_unconfirmed_record_does_not_spend_cap(self):
        record = _confirmed(0.040)
        record.user_confirmed = False
        self.assertEqual(cumulative_delta_today([record], now_utc()), 0.0)

    def test_snap_zero_returns_off(self):
        self.assertEqual(snap_to_doser(0.0, DoserConfig()), [0.0])

    def test_snap_positive_below_min_returns_min_and_off(self):
        self.assertEqual(snap_to_doser(0.005, DoserConfig()), [0.010, 0.0])

    def test_snap_exact_min_returns_min_only(self):
        self.assertEqual(snap_to_doser(0.010, DoserConfig()), [0.010])

    def test_snap_exact_step_float_edge(self):
        options = snap_to_doser(0.010 + 0.002 * 3, DoserConfig())
        self.assertEqual(options, [0.016])

    def test_compute_proposed_under_min_exposes_off_option(self):
        proposed, _, options = compute_proposed_rate(
            0.011,
            Decision.DECREASE,
            StatusTriplet(L, L, L),
            ConfidenceScore(-2.0, -2.0, -2.0),
            [],
            DoserConfig(min_rate=0.010, increment=0.002),
        )
        self.assertGreater(proposed, 0.0)
        self.assertLess(proposed, 0.010)
        self.assertEqual(options, [0.010, 0.0])


if __name__ == "__main__":
    unittest.main()
