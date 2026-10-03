"""Run with the matching client's Windows Python and hash-pinned cFSD loaders.

Place in a prepared extraction directory containing inputs.json, runtime/, data/,
and official-types.json. No live game session, engine initialization, or network
is needed. The Linux publisher verifies the receipt and all inputs again.
"""
import hashlib
import importlib
import json
import math
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def plain(value, depth=0):
    if depth > 16:
        raise ValueError("Unexpected native schema depth")
    if value is None or isinstance(value, (str, int, bool)):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("Non-finite native value")
        return value
    if hasattr(value, "items"):
        return {str(k): plain(v, depth + 1) for k, v in value.items()}
    if type(value).__name__ == "list" or isinstance(value, (list, tuple)):
        return [plain(v, depth + 1) for v in value]
    result = {}
    for name in sorted(n for n in dir(value) if not n.startswith("_")):
        member = getattr(value, name)
        if callable(member):
            raise ValueError("Unexpected schema method: " + name)
        result[name] = plain(member, depth + 1)
    return result


def main():
    proof = json.loads((ROOT / "inputs.json").read_text())
    if proof["build"] != "3573151" or proof["namespace"] != "Stillness/Cycle7":
        raise ValueError("Unreviewed native client build")
    for row in proof["files"]:
        if digest(ROOT / row["file"]) != row["sha256"]:
            raise ValueError("Native input hash mismatch: " + row["file"])
    dll_directory = os.add_dll_directory(str(ROOT / "runtime"))
    sys.path.insert(0, str(ROOT / "runtime"))
    tables = {name: importlib.import_module(module).load(str(ROOT / "data" / (name + ".fsdbinary")))
              for module, name in proof["pairs"].items()}
    # Preserve recipes as named by the native schema, not guessed byte layouts.
    blueprints = plain(tables["industry_blueprints"])
    selected = {x["id"] for x in json.loads((ROOT / "official-types.json").read_text())["data"]}
    for recipe in blueprints.values():
        selected.add(recipe["primaryTypeID"])
        selected.update(x["typeID"] for x in recipe["inputs"] + recipe["outputs"])
    missing = sorted(selected - set(tables["types"].keys()))
    # Retain unresolved references explicitly. Do not synthesize client records
    # from API names or silently discard recipes containing absent type IDs.
    types = {str(k): plain(tables["types"][k]) for k in sorted(selected) if k in tables["types"]}
    graphic_ids = {x["graphicID"] for x in types.values() if x.get("graphicID")}
    group_ids = {x["groupID"] for x in types.values()}
    result = {
        "schemaVersion": 1, "build": proof["build"],
        "inputsSha256": digest(ROOT / "inputs.json"),
        "decoderSha256": digest(Path(__file__)),
        "apiSha256": digest(ROOT / "official-types.json"),
        "tableCounts": {k: len(v) for k, v in tables.items()},
        "types": types,
        "missingTypeIDs": missing,
        "dogma": {str(k): plain(tables["typedogma"][k]) for k in sorted(selected) if k in tables["typedogma"]},
        "graphics": {str(k): plain(tables["graphicids"][k]) for k in sorted(graphic_ids)},
        "groups": {str(k): plain(tables["groups"][k]) for k in sorted(group_ids)},
        "blueprints": blueprints,
        "attributeDefinitions": plain(tables["dogmaattributes"]),
        "unitDefinitions": plain(tables["dogmaunits"]),
    }
    output = ROOT / "native-decoded.json"
    output.write_text(json.dumps(result, sort_keys=True, allow_nan=False), encoding="utf-8")
    # Closing this after native reads retains dependency resolution for the run.
    dll_directory.close()
    print(json.dumps({"decodedSha256": digest(output), "selectedTypes": len(types), "recipes": len(blueprints)}))


if __name__ == "__main__":
    main()
