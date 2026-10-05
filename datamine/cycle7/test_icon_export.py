import hashlib
from io import BytesIO
from pathlib import Path
import tempfile
import unittest

from PIL import Image
from export_icons import confined, resolve_icon, verify_png


class IconExportTests(unittest.TestCase):
    def test_exact_graphic_not_blueprint_or_similar_name(self):
        graphics = {"34876": {"iconInfo": {"folder": "res:/Current/Reiver"}}}
        rows = {"res:/current/reiver/34876_64_bp.png": [], "res:/current/reiver/26977_128.png": []}
        self.assertIsNone(resolve_icon({"graphicID": 34876}, {}, graphics, rows)[0])
        rows["res:/current/reiver/34876_64.png"] = []
        self.assertEqual(resolve_icon({"graphicID": 34876}, {}, graphics, rows)[0], "res:/current/reiver/34876_64.png")
        rows["res:/current/reiver/34876_128.png"] = []
        self.assertEqual(resolve_icon({"graphicID": 34876}, {}, graphics, rows)[0], "res:/current/reiver/34876_128.png")

    def test_explicit_type_reference_precedes_graphic(self):
        source = "res:/icons/fuel.png"
        result = resolve_icon({"iconID": 55, "graphicID": 1}, {"55": {"iconFile": source}},
                              {"1": {"iconInfo": {"folder": "res:/ship"}}}, {source: [], "res:/ship/1_128.png": []})
        self.assertEqual(result, (source, {"method": "type-iconID", "iconID": 55}))
        self.assertIsNone(resolve_icon({}, {"0": {"iconFile": source}}, {}, {source: []})[0])

    def test_resource_paths_cannot_escape_cache(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(confined(Path(d), "ab/file").parent.name, "ab")
            with self.assertRaises(ValueError):
                confined(Path(d), "../elsewhere")

    def test_integrity_and_format_validation(self):
        f = BytesIO(); Image.new("RGBA", (32, 32), (255, 0, 0, 255)).save(f, format="PNG")
        payload = f.getvalue(); row = ["res:/icon.png", "ab/file", hashlib.md5(payload).hexdigest(), str(len(payload))]
        self.assertEqual(verify_png(payload, row), (32, 32))
        with self.assertRaises(ValueError): verify_png(payload + b"x", row)
        bad = b"not a PNG"; badrow = ["res:/icon.png", "ab/file", hashlib.md5(bad).hexdigest(), str(len(bad))]
        with self.assertRaises(Exception): verify_png(bad, badrow)


if __name__ == "__main__":
    unittest.main()
