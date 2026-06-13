"""
Evaluator verdict and confounder tests.
"""

import sys
import unittest
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

import evaluator
from clock import now_utc
from models import (
    AdjustmentRecord,
    BarbotineType,
    ConfidenceScore,
    Decision,
    Measurement,
    OutcomeVerdict,
    PropertyStatus,
    RheologyReading,
    StatusTriplet,
)


def _reading(density: float, viscosity: float = 20.0, cp: float = 50.0) -> RheologyReading:
    return RheologyReading(density, viscosity, cp)


def _adj(decision: Decision, timestamp=None, adj_id: int = 1) -> AdjustmentRecord:
    return AdjustmentRecord(
        id=adj_id,
        barbotine_type=BarbotineType.M7,
        scenario_id=1,
        status=StatusTriplet(
            PropertyStatus.HIGHER,
            PropertyStatus.CONFORM,
            PropertyStatus.CONFORM,
        ),
        confidence=ConfidenceScore(2.0, 0.0, 0.0),
        decision=decision,
        current_rate=0.019,
        proposed_rate=0.021,
        actual_rate=0.021,
        user_confirmed=True,
        timestamp=timestamp or now_utc(),
    )


class TestEvaluatorVerdicts(unittest.TestCase):
    def test_maintain_effective_when_stable(self):
        verdict, _ = evaluator._judge(_adj(Decision.MAINTAIN), _reading(1.84), _reading(1.84))
        self.assertEqual(verdict, OutcomeVerdict.EFFECTIVE)

    def test_maintain_insufficient_when_drift_worsens(self):
        verdict, _ = evaluator._judge(_adj(Decision.MAINTAIN), _reading(1.80), _reading(1.84))
        self.assertEqual(verdict, OutcomeVerdict.INSUFFICIENT)

    def test_increase_effective_when_deviations_drop(self):
        verdict, _ = evaluator._judge(
            _adj(Decision.INCREASE),
            _reading(1.84, 23.0),
            _reading(1.80, 23.0),
        )
        self.assertEqual(verdict, OutcomeVerdict.EFFECTIVE)

    def test_increase_insufficient_when_one_property_improves_but_another_drifts(self):
        verdict, _ = evaluator._judge(
            _adj(Decision.INCREASE),
            _reading(1.84, 20.0),
            _reading(1.80, 23.0),
        )
        self.assertEqual(verdict, OutcomeVerdict.INSUFFICIENT)

    def test_increase_overcorrected_when_high_goes_low(self):
        verdict, _ = evaluator._judge(_adj(Decision.INCREASE), _reading(1.84), _reading(1.76))
        self.assertEqual(verdict, OutcomeVerdict.OVERCORRECTED)

    def test_increase_no_effect_when_classification_stays_high(self):
        verdict, _ = evaluator._judge(_adj(Decision.INCREASE), _reading(1.84), _reading(1.84))
        self.assertEqual(verdict, OutcomeVerdict.NO_EFFECT)

    def test_decrease_effective_when_low_deviations_drop(self):
        verdict, _ = evaluator._judge(
            _adj(Decision.DECREASE),
            _reading(1.76, 17.0),
            _reading(1.80, 17.0),
        )
        self.assertEqual(verdict, OutcomeVerdict.EFFECTIVE)

    def test_decrease_overcorrected_when_low_goes_high(self):
        verdict, _ = evaluator._judge(_adj(Decision.DECREASE), _reading(1.76), _reading(1.84))
        self.assertEqual(verdict, OutcomeVerdict.OVERCORRECTED)

    def test_confounder_records_pending_outcome(self):
        base_ts = now_utc() - timedelta(hours=5)
        adj = _adj(Decision.INCREASE, timestamp=base_ts, adj_id=1)
        confounder = _adj(Decision.DECREASE, timestamp=base_ts + timedelta(hours=2), adj_id=2)
        post = [
            Measurement(BarbotineType.M7, _reading(1.80), base_ts + timedelta(hours=2)),
            Measurement(BarbotineType.M7, _reading(1.80), base_ts + timedelta(hours=3)),
            Measurement(BarbotineType.M7, _reading(1.80), base_ts + timedelta(hours=4)),
        ]
        pre = [
            Measurement(BarbotineType.M7, _reading(1.84), base_ts - timedelta(hours=2)),
            Measurement(BarbotineType.M7, _reading(1.84), base_ts),
        ]

        with (
            patch("evaluator.get_last_confirmed_adjustment", return_value=adj),
            patch("evaluator.outcome_exists", return_value=False),
            patch("evaluator.get_measurements_window", side_effect=[post, pre]),
            patch("evaluator.get_confirmed_adjustments_between", return_value=[confounder]),
            patch("evaluator.insert_outcome") as insert_outcome,
        ):
            outcome = evaluator.evaluate_last_adjustment(BarbotineType.M7)

        self.assertIsNotNone(outcome)
        self.assertEqual(outcome.verdict, OutcomeVerdict.PENDING)
        self.assertEqual(outcome.detail, "confounded by adjustment #2")
        insert_outcome.assert_called_once()


if __name__ == "__main__":
    unittest.main()
