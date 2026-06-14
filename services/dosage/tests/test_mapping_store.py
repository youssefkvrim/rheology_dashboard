"""
Tests for type-to-slurry mapping persistence.
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from data_store import get_all_mappings, get_mapping, init_db, set_mapping
from models import BarbotineType


class MappingStoreTest(unittest.TestCase):
    def test_set_get_and_update_mapping(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "mapping.db"
            init_db(db_path)

            created = set_mapping(BarbotineType.M7, "M73006", db_path)
            updated = set_mapping(BarbotineType.M7, "M73007", db_path)
            fetched = get_mapping(BarbotineType.M7, db_path)
            all_records = get_all_mappings(db_path)

        self.assertEqual(created.slurry_id, "M73006")
        self.assertEqual(updated.slurry_id, "M73007")
        self.assertIsNotNone(fetched)
        assert fetched is not None
        self.assertEqual(fetched.slurry_id, "M73007")
        self.assertEqual(len(all_records), 1)
        self.assertEqual(all_records[0].barbotine_type, BarbotineType.M7)


if __name__ == "__main__":
    unittest.main()
