"""
FastAPI contract tests on a temporary SQLite database.
"""

import os
import sys
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

_TMP = tempfile.TemporaryDirectory()
os.environ["DOSAGE_DB_PATH"] = str(Path(_TMP.name) / "api-test.db")
os.environ["DOSAGE_STANDALONE"] = "1"

from fastapi.testclient import TestClient

import api
from clock import now_utc
from config import CONFLICT_NOTE, DECREASE_NOTE, PENDING_TTL_HOURS, PROFILES
from data_store import (
    get_current_flow_rate,
    get_pending_adjustment,
    init_db,
    insert_adjustment,
    insert_measurement,
    set_flow_state,
)
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


class TestDosageApi(unittest.TestCase):
    def setUp(self):
        self.db_path = Path(os.environ["DOSAGE_DB_PATH"])
        for suffix in ("", "-wal", "-shm"):
            path = Path(str(self.db_path) + suffix)
            if path.exists():
                path.unlink()
        init_db()
        for bt, profile in PROFILES.items():
            set_flow_state(bt, profile.base_flow_rate)

    def _add_measurements(
        self,
        density: float = 1.84,
        viscosity: float = 23.0,
        covering_power: float = 56.0,
        count: int = 3,
    ) -> None:
        for idx in range(count):
            insert_measurement(
                Measurement(
                    barbotine_type=BarbotineType.M7,
                    reading=RheologyReading(density, viscosity, covering_power),
                    timestamp=now_utc() - timedelta(minutes=idx),
                )
            )

    def _pending_adjustment(self, timestamp) -> AdjustmentRecord:
        return AdjustmentRecord(
            barbotine_type=BarbotineType.M7,
            scenario_id=1,
            status=StatusTriplet(
                PropertyStatus.HIGHER,
                PropertyStatus.CONFORM,
                PropertyStatus.CONFORM,
            ),
            confidence=ConfidenceScore(2.0, 0.0, 0.0),
            decision=Decision.INCREASE,
            current_rate=0.019,
            proposed_rate=0.021,
            timestamp=timestamp,
        )

    def test_decide_confirm_cycle_updates_flow_only_on_confirm(self):
        self._add_measurements()
        with TestClient(api.app) as client:
            decision = client.post("/decisions/M7")
            self.assertEqual(decision.status_code, 200)
            body = decision.json()
            self.assertEqual(body["adjustment_id"], 1)
            self.assertFalse(body["conflict"])
            self.assertFalse(body["window_degraded"])
            self.assertAlmostEqual(get_current_flow_rate(BarbotineType.M7), 0.019)

            confirmed = client.post("/decisions/M7/confirm", json={"actual_rate": 0.020})
            self.assertEqual(confirmed.status_code, 200)
            self.assertAlmostEqual(get_current_flow_rate(BarbotineType.M7), 0.020)

    def test_decide_returns_404_without_measurements(self):
        with TestClient(api.app) as client:
            response = client.post("/decisions/M7")
        self.assertEqual(response.status_code, 404)

    def test_bad_type_returns_400(self):
        with TestClient(api.app) as client:
            response = client.post("/decisions/BAD")
        self.assertEqual(response.status_code, 400)

    def test_decide_requires_mapping_outside_standalone_mode(self):
        with (
            patch.dict(os.environ, {"DOSAGE_STANDALONE": ""}),
            TestClient(api.app) as client,
        ):
            response = client.post("/decisions/M7")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["detail"], "no slurry mapped for M7")

    def test_mapping_endpoints_set_and_list_slurry_ids(self):
        with TestClient(api.app) as client:
            updated = client.put("/mapping/M7", json={"slurry_id": "M73006"})
            listed = client.get("/mapping")

        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["barbotine_type"], "M7")
        self.assertEqual(updated.json()["slurry_id"], "M73006")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json()[0]["slurry_id"], "M73006")

    def test_reject_supersedes_pending_without_flow_change(self):
        self._add_measurements()
        with TestClient(api.app) as client:
            decision = client.post("/decisions/M7")
            self.assertEqual(decision.status_code, 200)
            rejected = client.post("/decisions/M7/reject")
            self.assertEqual(rejected.status_code, 200)

        self.assertIsNone(get_pending_adjustment(BarbotineType.M7))
        self.assertAlmostEqual(get_current_flow_rate(BarbotineType.M7), 0.019)

    def test_stale_confirm_returns_409(self):
        insert_adjustment(
            self._pending_adjustment(
                now_utc() - timedelta(hours=PENDING_TTL_HOURS, minutes=1)
            )
        )
        with TestClient(api.app) as client:
            response = client.post("/decisions/M7/confirm", json={"actual_rate": 0.020})
        self.assertEqual(response.status_code, 409)
        self.assertAlmostEqual(get_current_flow_rate(BarbotineType.M7), 0.019)

    def test_conflict_response_includes_note(self):
        self._add_measurements(density=1.84, viscosity=17.0, covering_power=44.0)
        with TestClient(api.app) as client:
            response = client.post("/decisions/M7")
        body = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(body["conflict"])
        self.assertEqual(body["conflict_note"], CONFLICT_NOTE)

    def test_decrease_response_includes_semantics_note(self):
        self._add_measurements(density=1.76, viscosity=20.0, covering_power=50.0)
        with TestClient(api.app) as client:
            response = client.post("/decisions/M7")
        body = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["decision"], Decision.DECREASE.value)
        self.assertEqual(body["note"], DECREASE_NOTE)

    def test_recent_confirm_uses_short_window(self):
        insert_adjustment(
            AdjustmentRecord(
                barbotine_type=BarbotineType.M7,
                scenario_id=1,
                status=StatusTriplet(
                    PropertyStatus.HIGHER,
                    PropertyStatus.CONFORM,
                    PropertyStatus.CONFORM,
                ),
                confidence=ConfidenceScore(2.0, 0.0, 0.0),
                decision=Decision.INCREASE,
                current_rate=0.019,
                proposed_rate=0.021,
                actual_rate=0.020,
                user_confirmed=True,
                timestamp=now_utc() - timedelta(hours=2),
            )
        )
        self._add_measurements(count=3)
        with TestClient(api.app) as client:
            response = client.post("/decisions/M7")
        body = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertAlmostEqual(body["window_hours"], 6.0)
        self.assertFalse(body["window_degraded"])


if __name__ == "__main__":
    unittest.main()
