import copy
import json
from pathlib import Path
import tempfile
import unittest

from export_native import build_snapshot, load_verified


class NativeExportTests(unittest.TestCase):
    def setUp(self):
        self.strings = {"1": "D1 Fuel", "2": "Hydrocarbon Residue", "3": "Water Ice", "4": "Material", "5": "m/sec"}
        self.raw = {
            "types": {str(k): {"typeNameID": mid, "groupID": 18, "mass": 1, "volume": 1, "radius": 1, "portionSize": 1}
                      for k, mid in [(88335, 1), (89258, 2), (78423, 3)]},
            "dogma": {"88335": {"dogmaAttributes": [{"attributeID": 37, "value": 0}]}},
            "groups": {"18": {"groupNameID": 4}}, "graphics": {},
            "attributeDefinitions": {"37": {"name": "maxVelocity", "unitID": 11}},
            "unitDefinitions": {"11": {"name": "Acceleration", "displayNameID": 5}},
            "blueprints": {
                "1627": {"primaryTypeID": 88335, "runTime": 14, "inputs": [{"typeID": 89258, "quantity": 21}], "outputs": [{"typeID": 88335, "quantity": 75}]},
                "1181": {"primaryTypeID": 88335, "runTime": 14, "inputs": [{"typeID": 78423, "quantity": 208}], "outputs": [{"typeID": 88335, "quantity": 75}]},
            },
            "tableCounts": {"industry_blueprints": 2}, "missingTypeIDs": [84556],
        }
        self.api = [{"id": 84556, "name": "Smart Turret", "groupName": "Defense"},
                    {"id": 88335, "name": "D1 Fuel", "groupName": "Fuel", "mass": 1, "volume": 1, "radius": 1, "portionSize": 1}]

    def export(self):
        return build_snapshot(self.raw, self.api, self.strings)

    def test_raw_zero_and_conflicting_unit_name_are_not_converted(self):
        result = self.export()
        self.assertEqual(result["types"]["88335"]["attributes"], [{"id": 37, "value": 0}])
        self.assertEqual(result["units"]["11"]["label"], "m/sec")
        self.assertEqual(result["units"]["11"]["name"], "Acceleration")
        self.assertEqual(result["recipes"][0]["runTime"], 14)

    def test_missing_api_type_does_not_gain_fabricated_native_data(self):
        result = self.export()
        self.assertFalse(result["types"]["84556"]["clientRecord"])
        self.assertEqual(result["types"]["84556"]["attributes"], [])
        self.assertFalse(result["types"]["89258"]["apiPublished"])

    def test_source_disagreement_is_preserved(self):
        self.api[1]["radius"] = 2
        result = self.export()
        self.assertEqual(result["apiDifferences"], [{"typeID": 88335, "field": "radius", "api": 2, "client": 1}])

    def test_unknown_recipe_type_fails(self):
        self.raw["blueprints"]["1627"]["inputs"][0]["typeID"] = 84556
        with self.assertRaisesRegex(ValueError, "Unresolved recipe type"):
            self.export()

    def test_invalid_quantities_are_not_published(self):
        for value in [0, -1, 0.5, True, float("nan"), float("inf")]:
            with self.subTest(value=value):
                self.raw["blueprints"]["1627"]["inputs"][0]["quantity"] = value
                with self.assertRaisesRegex(ValueError, "Invalid recipe line"):
                    self.export()

    def test_wrong_patch_quantity_fails(self):
        self.raw["blueprints"]["1627"]["outputs"][0]["quantity"] = 74
        with self.assertRaisesRegex(ValueError, "Fuel patch mismatch"):
            self.export()

    def test_duplicate_attributes_fail(self):
        self.raw["dogma"]["88335"]["dogmaAttributes"] *= 2
        with self.assertRaisesRegex(ValueError, "duplicate native attribute"):
            self.export()

    def test_missing_attribute_or_unit_definition_fails(self):
        for section in ["attributeDefinitions", "unitDefinitions"]:
            previous = self.raw[section]
            self.raw[section] = {}
            with self.subTest(section=section), self.assertRaisesRegex(ValueError, "Missing"):
                self.export()
            self.raw[section] = previous

    def test_multi_output_is_preserved_not_collapsed_to_primary_type(self):
        r = copy.deepcopy(self.raw["blueprints"]["1181"])
        r["primaryTypeID"] = 78423
        r["outputs"].append({"typeID": 89258, "quantity": 8})
        self.raw["blueprints"]["1500"] = r
        self.raw["tableCounts"]["industry_blueprints"] = 3
        result = self.export()
        recipe = next(x for x in result["recipes"] if x["id"] == 1500)
        self.assertEqual(len(recipe["outputs"]), 2)
        self.assertEqual(recipe["primaryTypeID"], 78423)

    def test_tampered_inputs_rejected_before_native_files_are_read(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "inputs.json").write_text(json.dumps({"build": "3573151", "files": []}))
            with self.assertRaisesRegex(ValueError, "Unreviewed input manifest"):
                load_verified(root)


if __name__ == "__main__":
    unittest.main()
