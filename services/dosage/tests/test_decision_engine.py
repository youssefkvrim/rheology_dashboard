"""
Tests for the decision engine, flow controller, and doser snapping.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import unittest
from datetime import datetime, timedelta

from config import MAX_DELTA_PER_ADJUSTMENT, PropertyRange
from decision_engine import (
    SCENARIO_TABLE,
    classify_reading,
    classify_value,
    compute_confidence,
    compute_score,
    resolve_scenario,
)
from flow_controller import compute_raw_delta, apply_daily_cap, snap_to_doser
from models import (
    AdjustmentRecord,
    BarbotineType,
    ConfidenceScore,
    Decision,
    DoserConfig,
    PropertyStatus,
    RheologyReading,
    StatusTriplet,
)

H = PropertyStatus.HIGHER
C = PropertyStatus.CONFORM
L = PropertyStatus.LOWER
INC = Decision.INCREASE
MNT = Decision.MAINTAIN
DEC = Decision.DECREASE


class TestClassification(unittest.TestCase):
    def test_higher(self):
        self.assertEqual(classify_value(2.0, PropertyRange(1.0, 1.5)), H)

    def test_lower(self):
        self.assertEqual(classify_value(0.5, PropertyRange(1.0, 1.5)), L)

    def test_conform_at_min(self):
        self.assertEqual(classify_value(1.0, PropertyRange(1.0, 1.5)), C)

    def test_conform_at_max(self):
        self.assertEqual(classify_value(1.5, PropertyRange(1.0, 1.5)), C)

    def test_conform_mid(self):
        self.assertEqual(classify_value(1.25, PropertyRange(1.0, 1.5)), C)


class TestHysteresis(unittest.TestCase):
    def test_no_switch_within_band(self):
        r = PropertyRange(1.0, 1.5)
        # Value just barely above max: score slightly > 1 but within hysteresis
        val = 1.505
        result = classify_value(val, r, previous_status=C)
        self.assertEqual(result, C, "Should stay CONFORM within hysteresis band")

    def test_switch_beyond_band(self):
        r = PropertyRange(1.0, 1.5)
        val = 1.6  # clearly above max + band
        result = classify_value(val, r, previous_status=C)
        self.assertEqual(result, H)

    def test_sticky_higher(self):
        r = PropertyRange(1.0, 1.5)
        # When already HIGHER, stay HIGHER until clearly back in range
        val = 1.52  # just above max, within band for returning
        result = classify_value(val, r, previous_status=H)
        self.assertEqual(result, H, "Should remain HIGHER due to hysteresis")


class TestConfidenceScoring(unittest.TestCase):
    def test_center_is_zero(self):
        score = compute_score(1.25, PropertyRange(1.0, 1.5))
        self.assertAlmostEqual(score, 0.0, places=4)

    def test_at_max_is_one(self):
        score = compute_score(1.5, PropertyRange(1.0, 1.5))
        self.assertAlmostEqual(score, 1.0, places=4)

    def test_above_max_gt_one(self):
        score = compute_score(1.75, PropertyRange(1.0, 1.5))
        self.assertGreater(score, 1.0)

    def test_below_min_lt_neg_one(self):
        score = compute_score(0.5, PropertyRange(1.0, 1.5))
        self.assertLess(score, -1.0)


class TestScenarioTableCompleteness(unittest.TestCase):
    def test_all_27_present(self):
        self.assertEqual(len(SCENARIO_TABLE), 27)

    def test_scenario_ids_1_to_27(self):
        ids = sorted(sid for sid, _ in SCENARIO_TABLE.values())
        self.assertEqual(ids, list(range(1, 28)))


class TestScenarioDecisions(unittest.TestCase):
    def test_density_higher_always_increase(self):
        for visc in (H, C, L):
            for cp in (H, C, L):
                _, dec = resolve_scenario(StatusTriplet(H, visc, cp))
                self.assertEqual(dec, INC, f"Failed for H/{visc}/{cp}")

    def test_density_lower_always_decrease(self):
        for visc in (H, C, L):
            for cp in (H, C, L):
                _, dec = resolve_scenario(StatusTriplet(L, visc, cp))
                self.assertEqual(dec, DEC, f"Failed for L/{visc}/{cp}")

    def test_conform_density_specific(self):
        cases = [
            ((C, H, H), INC), ((C, H, C), INC), ((C, H, L), MNT),
            ((C, C, H), INC), ((C, C, C), MNT), ((C, C, L), DEC),
            ((C, L, H), MNT), ((C, L, C), MNT), ((C, L, L), MNT),
        ]
        for (d, v, cp), expected in cases:
            _, dec = resolve_scenario(StatusTriplet(d, v, cp))
            self.assertEqual(dec, expected, f"Failed for {d}/{v}/{cp}")


class TestFlowController(unittest.TestCase):
    def _score(self, d=0.0, v=0.0, cp=0.0):
        return ConfidenceScore(d, v, cp)

    def test_maintain_returns_zero(self):
        delta = compute_raw_delta(MNT, StatusTriplet(C, C, C), self._score())
        self.assertEqual(delta, 0.0)

    def test_increase_positive(self):
        delta = compute_raw_delta(INC, StatusTriplet(H, H, H), self._score(2.0, 2.0, 2.0))
        self.assertGreater(delta, 0)
        self.assertLessEqual(delta, MAX_DELTA_PER_ADJUSTMENT)

    def test_decrease_negative(self):
        delta = compute_raw_delta(DEC, StatusTriplet(L, L, L), self._score(-2.0, -2.0, -2.0))
        self.assertLess(delta, 0)
        self.assertGreaterEqual(delta, -MAX_DELTA_PER_ADJUSTMENT)

    def test_daily_cap_enforcement(self):
        now = datetime.now()
        history = [
            AdjustmentRecord(
                barbotine_type=BarbotineType.M7,
                scenario_id=1,
                status=StatusTriplet(H, H, H),
                confidence=self._score(2.0, 2.0, 2.0),
                decision=INC,
                current_rate=0.019,
                proposed_rate=0.066,
                actual_rate=0.066,
                user_confirmed=True,
                timestamp=now - timedelta(hours=1),
            )
        ]
        capped = apply_daily_cap(0.002, history, now)
        self.assertAlmostEqual(abs(capped), 0.001, places=4)


class TestDoserSnapping(unittest.TestCase):
    def test_exact_match(self):
        doser = DoserConfig(min_rate=0.010, increment=0.002)
        options = snap_to_doser(0.020, doser)
        self.assertEqual(options, [0.020])

    def test_between_steps_002(self):
        doser = DoserConfig(min_rate=0.010, increment=0.002)
        options = snap_to_doser(0.019, doser)
        self.assertEqual(len(options), 2)
        self.assertIn(0.018, options)
        self.assertIn(0.020, options)

    def test_between_steps_003(self):
        doser = DoserConfig(min_rate=0.010, increment=0.003)
        options = snap_to_doser(0.020, doser)
        self.assertEqual(len(options), 2)
        self.assertIn(0.019, options)
        self.assertIn(0.022, options)

    def test_below_minimum(self):
        doser = DoserConfig(min_rate=0.010, increment=0.002)
        options = snap_to_doser(0.005, doser)
        self.assertEqual(options, [0.010])

    def test_sorted_by_proximity(self):
        doser = DoserConfig(min_rate=0.010, increment=0.002)
        options = snap_to_doser(0.0195, doser)
        self.assertEqual(options[0], 0.020)  # closer to 0.0195 than 0.018


if __name__ == "__main__":
    unittest.main()
