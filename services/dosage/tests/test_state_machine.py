"""
Tests for the propose/confirm/reject state machine.
"""

import sys
import argparse
import tempfile
import unittest
from pathlib import Path
from datetime import timedelta
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import HTTPException

import api
import main as cli
from clock import now_utc
from config import PENDING_TTL_HOURS
from data_store import (
    confirm_adjustment,
    get_all_adjustments,
    get_confirmed_adjustments_window,
    get_current_flow_rate,
    get_pending_adjustment,
    init_db,
    insert_adjustment,
    reject_pending_adjustment,
    set_flow_state,
    supersede_pending_adjustments,
)
from flow_controller import apply_daily_cap, cumulative_delta_today
from models import (
    AdjustmentRecord,
    BarbotineType,
    ConfidenceScore,
    Decision,
    Measurement,
    PropertyStatus,
    RheologyReading,
    StatusTriplet,
)


class StateMachinePersistenceTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmp.name) / "barbotine.db"
        init_db(self.db_path)
        self.bt = BarbotineType.M7
        self.status = StatusTriplet(
            PropertyStatus.HIGHER,
            PropertyStatus.HIGHER,
            PropertyStatus.HIGHER,
        )
        self.confidence = ConfidenceScore(2.0, 2.0, 2.0)
        set_flow_state(self.bt, 0.019, path=self.db_path)

    def tearDown(self):
        self.tmp.cleanup()

    def _proposal(self, proposed_rate: float, *, confirmed: bool = False) -> int:
        supersede_pending_adjustments(self.bt, path=self.db_path)
        record = AdjustmentRecord(
            barbotine_type=self.bt,
            scenario_id=1,
            status=self.status,
            confidence=self.confidence,
            decision=Decision.INCREASE,
            current_rate=0.019,
            proposed_rate=proposed_rate,
            actual_rate=proposed_rate if confirmed else None,
            user_confirmed=confirmed,
        )
        return insert_adjustment(record, path=self.db_path)

    def test_decide_twice_supersedes_previous_pending_without_flow_change(self):
        first_id = self._proposal(0.021)
        second_id = self._proposal(0.023)

        all_records = get_all_adjustments(self.bt, hours=24, path=self.db_path)
        by_id = {record.id: record for record in all_records}
        pending = get_pending_adjustment(self.bt, path=self.db_path)

        self.assertEqual(len(all_records), 2)
        self.assertTrue(by_id[first_id].superseded)
        self.assertFalse(by_id[second_id].superseded)
        self.assertIsNotNone(pending)
        self.assertEqual(pending.id, second_id)
        self.assertAlmostEqual(get_current_flow_rate(self.bt, path=self.db_path), 0.019)

    def test_confirm_updates_flow_to_operator_actual_rate(self):
        proposal_id = self._proposal(0.021)
        pending = get_pending_adjustment(self.bt, path=self.db_path)
        self.assertIsNotNone(pending)

        confirm_adjustment(proposal_id, 0.020, path=self.db_path)
        set_flow_state(self.bt, 0.020, pending.status, path=self.db_path)

        confirmed = get_confirmed_adjustments_window(self.bt, hours=24, path=self.db_path)
        self.assertAlmostEqual(get_current_flow_rate(self.bt, path=self.db_path), 0.020)
        self.assertIsNone(get_pending_adjustment(self.bt, path=self.db_path))
        self.assertEqual(len(confirmed), 1)
        self.assertTrue(confirmed[0].user_confirmed)
        self.assertAlmostEqual(confirmed[0].actual_rate, 0.020)

    def test_reject_supersedes_pending_without_flow_change(self):
        proposal_id = self._proposal(0.021)

        rejected = reject_pending_adjustment(self.bt, path=self.db_path)
        all_records = get_all_adjustments(self.bt, hours=24, path=self.db_path)

        self.assertIsNotNone(rejected)
        self.assertEqual(rejected.id, proposal_id)
        self.assertIsNone(get_pending_adjustment(self.bt, path=self.db_path))
        self.assertTrue(all_records[0].superseded)
        self.assertAlmostEqual(get_current_flow_rate(self.bt, path=self.db_path), 0.019)

    def test_daily_cap_ignores_unconfirmed_proposals(self):
        self._proposal(0.080)
        confirmed_id = self._proposal(0.066, confirmed=True)

        confirmed = get_confirmed_adjustments_window(self.bt, hours=24, path=self.db_path)
        all_records = get_all_adjustments(self.bt, hours=24, path=self.db_path)
        capped = apply_daily_cap(0.002, confirmed, now_utc())

        self.assertEqual(len(all_records), 2)
        self.assertEqual(len(confirmed), 1)
        self.assertEqual(confirmed[0].id, confirmed_id)
        self.assertAlmostEqual(cumulative_delta_today(all_records, now_utc()), 0.047, places=6)
        self.assertAlmostEqual(capped, 0.001, places=6)


class ApiStateMachineTest(unittest.TestCase):
    def _stale_pending(self) -> AdjustmentRecord:
        return AdjustmentRecord(
            id=99,
            barbotine_type=BarbotineType.M7,
            scenario_id=1,
            status=StatusTriplet(
                PropertyStatus.HIGHER,
                PropertyStatus.HIGHER,
                PropertyStatus.HIGHER,
            ),
            confidence=ConfidenceScore(2.0, 2.0, 2.0),
            decision=Decision.INCREASE,
            current_rate=0.019,
            proposed_rate=0.021,
            timestamp=now_utc() - timedelta(hours=PENDING_TTL_HOURS, minutes=1),
        )

    def test_api_decide_does_not_write_flow_state(self):
        measurement = Measurement(
            barbotine_type=BarbotineType.M7,
            reading=RheologyReading(1.84, 23.0, 56.0),
        )

        with (
            patch("api.evaluate_last_adjustment", return_value=None),
            patch("api.get_measurements_window", return_value=[measurement]),
            patch("api.get_last_confirmed_adjustment", return_value=None),
            patch("api.get_last_status", return_value=None),
            patch("api.get_current_flow_rate", return_value=0.019),
            patch("api.get_confirmed_adjustments_window", return_value=[]),
            patch("api.supersede_pending_adjustments", return_value=1) as supersede,
            patch("api.insert_adjustment", return_value=42) as insert,
            patch("api.set_flow_state") as set_flow,
        ):
            response = api.make_decision("M7")

        self.assertEqual(response.adjustment_id, 42)
        self.assertAlmostEqual(response.current_rate, 0.019)
        self.assertGreater(response.proposed_rate, response.current_rate)
        supersede.assert_called_once_with(BarbotineType.M7)
        insert.assert_called_once()
        set_flow.assert_not_called()

    def test_cli_decide_does_not_write_flow_state(self):
        measurement = Measurement(
            barbotine_type=BarbotineType.M7,
            reading=RheologyReading(1.84, 23.0, 56.0),
        )

        with (
            patch("main.evaluate_last_adjustment", return_value=None),
            patch("main.get_measurements_window", return_value=[measurement]),
            patch("main.get_last_confirmed_adjustment", return_value=None),
            patch("main.get_last_status", return_value=None),
            patch("main.get_current_flow_rate", return_value=0.019),
            patch("main.get_confirmed_adjustments_window", return_value=[]),
            patch("main.supersede_pending_adjustments", return_value=1) as supersede,
            patch("main.insert_adjustment", return_value=42) as insert,
            patch("main.set_flow_state") as set_flow,
        ):
            cli.cmd_decide(argparse.Namespace(type="M7"))

        supersede.assert_called_once_with(BarbotineType.M7)
        insert.assert_called_once()
        set_flow.assert_not_called()

    def test_stale_confirm_returns_409_without_state_change(self):
        with (
            patch("api.get_pending_adjustment", return_value=self._stale_pending()),
            patch("api.confirm_adjustment") as confirm,
            patch("api.set_flow_state") as set_flow,
        ):
            with self.assertRaises(HTTPException) as ctx:
                api.confirm_decision("M7", api.ConfirmInput(actual_rate=0.020))

        self.assertEqual(ctx.exception.status_code, 409)
        confirm.assert_not_called()
        set_flow.assert_not_called()


if __name__ == "__main__":
    unittest.main()
