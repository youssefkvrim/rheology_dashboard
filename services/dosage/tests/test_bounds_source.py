"""
Tests for dashboard bounds adapter.
"""

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

from bounds_source import fetch_ranges


class BoundsSourceTest(unittest.TestCase):
    def test_fetch_ranges_maps_dashboard_bounds(self):
        def stub(url, headers, timeout):
            self.assertEqual(url, "http://dash/api/rheology/bounds?slurryId=M73006")
            self.assertEqual(headers, {"X-Internal-Token": "secret"})
            self.assertEqual(timeout, 3.0)
            return [
                {"key": "densite", "low": 1.78, "high": 1.82},
                {"key": "viscosite", "low": 18.0, "high": 22.0},
                {"key": "pc", "low": 45.0, "high": 55.0},
            ]

        with patch.dict(
            os.environ,
            {"DASHBOARD_API_BASE": "http://dash", "INTERNAL_TOKEN": "secret"},
        ):
            ranges = fetch_ranges("M73006", stub)

        self.assertIsNotNone(ranges)
        assert ranges is not None
        self.assertEqual(ranges["density"].min, 1.78)
        self.assertEqual(ranges["viscosity"].max, 22.0)
        self.assertEqual(ranges["covering_power"].min, 45.0)

    def test_fetch_ranges_falls_back_without_token(self):
        def stub(_url, _headers, _timeout):
            self.fail("HTTP layer should not be called without INTERNAL_TOKEN")

        with patch.dict(os.environ, {"INTERNAL_TOKEN": ""}):
            self.assertIsNone(fetch_ranges("M73006", stub))

    def test_fetch_ranges_falls_back_when_any_required_bound_missing(self):
        def stub(_url, _headers, _timeout):
            return [
                {"key": "density", "low": 1.78, "high": 1.82},
                {"key": "viscosity", "low": 18.0, "high": 22.0},
            ]

        with patch.dict(os.environ, {"INTERNAL_TOKEN": "secret"}):
            self.assertIsNone(fetch_ranges("M73006", stub))


if __name__ == "__main__":
    unittest.main()
