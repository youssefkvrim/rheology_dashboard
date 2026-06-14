"""
Tests for dashboard measurement adapter and bucket alignment.
"""

import os
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

from measurements_source import MeasurementSourceError, bucket_readings, fetch_measurements
from models import BarbotineType


def _ms(dt: datetime) -> int:
    return int(dt.timestamp() * 1000)


class MeasurementSourceTest(unittest.TestCase):
    def test_bucket_readings_joins_nearest_hour_and_drops_incomplete_buckets(self):
        base = datetime(2026, 1, 1, 10, 0, tzinfo=timezone.utc)
        series = {
            "density": [
                {"t": _ms(base.replace(minute=20)), "v": 1.84},
                {"t": _ms(base.replace(hour=11, minute=5)), "v": 1.83},
            ],
            "viscosity": [{"t": _ms(base.replace(minute=24)), "v": 23.0}],
            "pc": [{"t": _ms(base.replace(minute=28)), "v": 56.0}],
        }

        readings = bucket_readings(series, BarbotineType.M7)

        self.assertEqual(len(readings), 1)
        self.assertEqual(readings[0].timestamp, base)
        self.assertEqual(readings[0].reading.density, 1.84)
        self.assertEqual(readings[0].reading.viscosity, 23.0)
        self.assertEqual(readings[0].reading.covering_power, 56.0)

    def test_fetch_measurements_calls_dashboard_with_internal_token(self):
        base = datetime(2026, 1, 1, 10, 0, tzinfo=timezone.utc)

        def stub(url, headers, timeout):
            parsed = urlparse(url)
            query = parse_qs(parsed.query)
            self.assertEqual(parsed.scheme, "http")
            self.assertEqual(parsed.netloc, "dash")
            self.assertEqual(parsed.path, "/api/rheology/all")
            self.assertEqual(query["slurryId"], ["M73006"])
            self.assertEqual(query["params"], ["density,viscosity,pc"])
            self.assertEqual(query["includeBounds"], ["0"])
            self.assertIn("start", query)
            self.assertEqual(query["maxPoints"], ["10000"])
            self.assertEqual(headers, {"X-Internal-Token": "secret"})
            self.assertEqual(timeout, 3.0)
            return {
                "series": {
                    "density": [{"t": _ms(base), "v": 1.84}],
                    "viscosity": [{"t": _ms(base), "v": 23.0}],
                    "pc": [{"t": _ms(base), "v": 56.0}],
                }
            }

        with patch.dict(
            os.environ,
            {
                "DASHBOARD_API_BASE": "http://dash",
                "DOSAGE_STANDALONE": "",
                "INTERNAL_TOKEN": "secret",
            },
        ):
            readings = fetch_measurements(BarbotineType.M7, 72, "M73006", stub)

        self.assertEqual(len(readings), 1)
        self.assertEqual(readings[0].timestamp, base)

    def test_fetch_measurements_requires_token_in_production_mode(self):
        with patch.dict(os.environ, {"DOSAGE_STANDALONE": "", "INTERNAL_TOKEN": ""}):
            with self.assertRaises(MeasurementSourceError):
                fetch_measurements(BarbotineType.M7, 72, "M73006")


if __name__ == "__main__":
    unittest.main()
