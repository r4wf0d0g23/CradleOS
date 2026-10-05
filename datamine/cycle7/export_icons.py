"""Export original current-client PNG icons, joined by IDs, never by item name.

Uses independently recorded native runs; never modifies the launcher cache.
PNG bytes are preserved. Content-addressing deduplicates files, not item IDs.
"""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
from pathlib import Path
import re
import zipfile

from PIL import Image
from export_native import load_verified, require, sha
from extract_game_data import BUILD, WORLD

ICON_INPUTS_SHA = "8c70511cc992f2fe73b1e00d3b8d962d8d2cb2bf88011d79384ada134a3251a1"
PREFIXES = ("res:/ui/texture/eveicon/", "res:/ui/texture/icons/frontier/")
NOTICE = """EVE Frontier client artwork © CCP hf. All rights reserved.
Extracted from Stillness / Cycle 7 / client build 3573151 for CradleOS companion UI use.
These original game assets are not covered by CradleOS's MIT code license.
This pack does not grant a license to third-party artwork or imply CCP endorsement.
No raw executables, credentials, or client databases are distributed here.
"""


def confined(root, relative):
    path = (root / relative).resolve()
    require(path.is_relative_to(root.resolve()), "Resource path escapes cache")
    return path


def resolve_icon(item, icons, graphics, rows):
    """Explicit iconID wins; exact shipped graphic thumbnail is fallback.

    This is a documented reference-image policy, not a reconstruction of every
    client UI's category-specific rendering/compositing behavior.
    """
    icon_id, graphic_id = item.get("iconID"), item.get("graphicID")
    source = icons.get(str(icon_id), {}).get("iconFile", "").lower()
    if source in rows:
        return source, {"method": "type-iconID", "iconID": icon_id}
    folder = graphics.get(str(graphic_id), {}).get("iconInfo", {}).get("folder", "").lower()
    for size in (128, 64):
        source = f"{folder}/{graphic_id}_{size}.png"
        if source in rows:
            return source, {"method": "graphic-thumbnail", "graphicID": graphic_id}
    return None, {"reason": "No exact iconID or graphic-thumbnail resource"}


def verify_png(payload, row):
    require(len(payload) == int(row[3]), "Resource size mismatch")
    require(hashlib.md5(payload).hexdigest() == row[2], "Resource manifest hash mismatch")
    with Image.open(BytesIO(payload)) as image:
        require(image.format == "PNG", "Not a PNG resource")
        width, height = image.size
        require(0 < width <= 2048 and 0 < height <= 2048, "Invalid icon dimensions")
        image.verify()
    with Image.open(BytesIO(payload)) as image:
        image.load()
        require(image.convert("RGBA").getchannel("A").getbbox() is not None, "Empty icon")
    return width, height


def load_icon_table(root, manifests):
    require(sha(root / "inputs.json") == ICON_INPUTS_SHA, "Unreviewed icon inputs")
    inputs = json.loads((root / "inputs.json").read_text())
    require(inputs["manifests"] == manifests and inputs["build"] == BUILD, "Different icon build")
    rows = {}
    for name, digest in manifests.items():
        p = root / "manifests" / name
        require(sha(p) == digest, "Changed icon source manifest")
        if name.endswith(".txt"):
            rows.update({r[0].lower(): r for r in csv.reader(p.read_text().splitlines()) if len(r) >= 4})
    for item in inputs["files"]:
        b = (root / item["file"]).read_bytes()
        row = rows[item["virtual"].lower()]
        require(len(b) == int(row[3]) == item["bytes"] and hashlib.md5(b).hexdigest() == row[2] == item["md5"]
                and hashlib.sha256(b).hexdigest() == item["sha256"], "Icon reader/table mismatch")
    run = json.loads((root / "last-run.json").read_text())
    require(run.get("exit") == 0 and run.get("cleaned") is True and run.get("inputsUnchanged") is True, "Incomplete icon run")
    require(run["inputsSha256"] == ICON_INPUTS_SHA and run["scriptSha256"] == sha(Path(__file__).with_name("decode_icons.py")), "Wrong icon decoder")
    for file, digest in run["logs"].items():
        require(sha(root / file) == digest, "Changed icon run log")
    result_sha = sha(root / "icons-decoded.json")
    receipt = json.loads((root / "native-stdout.log").read_text())
    require(receipt["sha256"] == result_sha, "Changed decoded icons")
    table = json.loads((root / "icons-decoded.json").read_text())
    require(receipt["count"] == len(table), "Incomplete icon table")
    require(all(re.fullmatch(r"\d+", key) and set(value) <= {"iconFile", "iconType", "obsolete"} and isinstance(value.get("iconFile"), str)
                for key, value in table.items()), "Unexpected icon schema")
    return table, rows, inputs, result_sha


def export(args):
    raw, inputs, api, api_proof, raw_sha = load_verified(args.evidence_root)
    icons, rows, icon_inputs, icon_sha = load_icon_table(args.icon_evidence, inputs["manifests"])
    native = json.loads(args.snapshot.read_text())
    require(native["build"] == BUILD and native["world"] == WORLD and native["provenance"]["decodedSha256"] == raw_sha, "Wrong type snapshot")
    api_ids = {str(x["id"]) for x in api}
    require(set(native["types"]) == set(raw["types"]) | api_ids, "Incomplete type membership")
    require(all(x["apiPublished"] == (key in api_ids) for key, x in native["types"].items()), "Wrong API membership")
    source_records, files, types = {}, {}, {}
    def asset(source):
        if source in source_records:
            return source_records[source]["asset"]
        row = rows[source]
        payload = confined(args.cache, row[1]).read_bytes()
        width, height = verify_png(payload, row)
        digest = hashlib.sha256(payload).hexdigest()
        file = f"assets/{digest}.png"
        files[file] = payload
        source_records[source] = {"asset": file, "bytes": len(payload), "md5": row[2], "sha256": digest, "width": width, "height": height}
        return file
    for id, item in native["types"].items():
        source, resolution = resolve_icon(raw["types"][id], icons, raw["graphics"], rows) if id in raw["types"] else (None, {"reason": "No native type record"})
        types[id] = {"name": item["name"], "apiPublished": item["apiPublished"], "asset": asset(source) if source else None,
                     "source": source, **resolution}
    ui = {}
    library = {}
    for source in sorted(rows):
        if not source.endswith(".png"):
            continue
        if source.startswith(PREFIXES[0]):
            key = source.removeprefix(PREFIXES[0]).removesuffix(".png")
            ui[key] = {"asset": asset(source), "source": source}
        elif source.startswith(PREFIXES[1]):
            key = source.removeprefix(PREFIXES[1]).removesuffix(".png")
            library[key] = {"asset": asset(source), "source": source}
    result = {"schemaVersion": 1, "build": BUILD, "cycle": 7, "world": WORLD, "server": "Stillness", "name": "Vestiges",
              "types": types, "ui": ui, "library": library,
              "counts": {"types": len(types), "resolved": sum(x["asset"] is not None for x in types.values()),
                         "ui": len(ui), "library": len(library), "assets": len(files), "assetBytes": sum(map(len, files.values()))}}
    provenance = {"extractedAt": datetime.now(timezone.utc).isoformat(), "build": BUILD, "world": WORLD,
                  "manifests": inputs["manifests"], "nativeDecodedSha256": raw_sha, "nativeSnapshotSha256": sha(args.snapshot),
                  "iconInputsSha256": ICON_INPUTS_SHA, "iconDecodedSha256": icon_sha,
                  "iconDecoderSha256": sha(Path(__file__).with_name("decode_icons.py")), "exporterSha256": sha(Path(__file__)),
                  "iconFiles": [{k: v for k, v in x.items() if k != "file"} for x in icon_inputs["files"]],
                  "sources": source_records,
                  "scope": "Source PNGs, not re-renders. Item coverage is API plus recipe-linked definitions. Library/UI entries are shipped assets, not proof of current gameplay availability.",
                  "resolution": "Explicit type.iconID first; otherwise exact graphic iconInfo folder / graphicID_128.png, then _64.png. No name joins, filename type-ID guesses, API downloads, or old-world fallback."}
    files["manifest.json"] = (json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
    provenance["manifestSha256"] = hashlib.sha256(files["manifest.json"]).hexdigest()
    files["provenance.json"] = (json.dumps(provenance, separators=(",", ":")) + "\n").encode()
    files["NOTICE.txt"] = NOTICE.encode()
    files["README.txt"] = ("CradleOS current-client icon pack — build " + BUILD + "\n\n"
        "manifest.json: types[typeID].asset maps item IDs to local PNG paths. Null means unresolved.\n"
        "ui: named shared UI symbols. library: Frontier-specific source-art library, not a live-item catalog.\n"
        "Use separate type IDs even when image bytes are shared. Names are labels, never lookup keys.\n"
        "Original pixels/dimensions retained; no fake upscaling. Load only needed PNGs.\n"
        "provenance.json records exact source paths, hashes, dimensions and extraction inputs.\n"
        "See NOTICE.txt for artwork attribution. No executables or credentials are included.\n").encode()
    # All validation succeeds before output is touched. Dedicated versioned directory only.
    args.output.mkdir(parents=True, exist_ok=True)
    for file, payload in files.items():
        path = args.output / file
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)
    with zipfile.ZipFile(args.output / "cradleos-icons-cycle7-3573151.zip", "w", zipfile.ZIP_DEFLATED) as z:
        for file, payload in sorted(files.items()):
            info = zipfile.ZipInfo(file, (2026, 10, 5, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, payload)
    print(json.dumps(result["counts"]))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--evidence-root", type=Path, required=True)
    parser.add_argument("--icon-evidence", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    export(parser.parse_args())
