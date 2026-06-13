"""
Conflict triplet coverage for the scenario resolver.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from decision_engine import resolve_scenario
from models import PropertyStatus, StatusTriplet

H = PropertyStatus.HIGHER
C = PropertyStatus.CONFORM
L = PropertyStatus.LOWER


class TestConflictTriplets(unittest.TestCase):
    def _assert_conflict(self, statuses):
        _, _, conflict = resolve_scenario(StatusTriplet(*statuses))
        self.assertTrue(conflict)

    def test_higher_lower_lower_conflicts(self):
        self._assert_conflict((H, L, L))

    def test_higher_lower_conform_conflicts(self):
        self._assert_conflict((H, L, C))

    def test_higher_conform_lower_conflicts(self):
        self._assert_conflict((H, C, L))

    def test_lower_higher_higher_conflicts(self):
        self._assert_conflict((L, H, H))

    def test_lower_higher_conform_conflicts(self):
        self._assert_conflict((L, H, C))

    def test_lower_conform_higher_conflicts(self):
        self._assert_conflict((L, C, H))

    def test_conform_higher_lower_conflicts(self):
        self._assert_conflict((C, H, L))

    def test_conform_lower_higher_conflicts(self):
        self._assert_conflict((C, L, H))

    def test_conform_conform_conform_is_not_conflict(self):
        _, _, conflict = resolve_scenario(StatusTriplet(C, C, C))
        self.assertFalse(conflict)


if __name__ == "__main__":
    unittest.main()
