"""Publish derived reference data from a pinned, successfully decoded cFSD run.

No binary guessing, inherited type enumeration, or effective-stat conversion.
Run after native_decode.py using the documented prepared-host transport.
"""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import struct

from extract_game_data import BUILD, WORLD, API

INPUTS_SHA = "95ded19b5f875f708cdf6cf9a8af8b2d9ce4da11c2d6190cf99388f04d01a7b0"
STRINGS_SHA = "2b08db1921a8272a4faa62e03220288dc0746f2fa1618191f62f8c2e841ccd50"
PATCH = "https://evefrontier.com/en/news/patch-notes-founder-access-0-7-0-1-vestiges"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(value, message):
    if not value:
        raise ValueError(message)


def integer(value, minimum=1):
    return type(value) is int and value >= minimum


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def load_verified(root):
    inputs = json.loads((root / "inputs.json").read_text())
    require(sha(root / "inputs.json") == INPUTS_SHA, "Unreviewed input manifest")
    require(inputs["build"] == BUILD and inputs["namespace"] == "Stillness/Cycle7", "Wrong client build")
    manifest_rows = {}
    for path, digest in inputs["manifests"].items():
        file = root / "manifests" / path
        require(sha(file) == digest, "Changed source manifest")
        if path.endswith(".txt"):
            for row in csv.reader(file.read_text().splitlines()):
                if len(row) >= 4:
                    manifest_rows[row[0].lower()] = row
    for row in inputs["files"]:
        path = root / row["file"]
        payload = path.read_bytes()
        source = manifest_rows[row["virtual"].lower()]
        require(len(payload) == row["bytes"] == int(source[3]), "Client size mismatch")
        require(hashlib.md5(payload).hexdigest() == row["md5"] == source[2], "Client manifest mismatch")
        require(sha(path) == row["sha256"], "Client hash mismatch")
    run = json.loads((root / "last-run.json").read_text())
    require(run.get("exit") == 0 and run.get("cleaned") is True and run.get("inputsUnchanged") is True, "Incomplete native run")
    require(run["inputsSha256"] == INPUTS_SHA, "Run inputs mismatch")
    decoder_sha = sha(Path(__file__).with_name("native_decode.py"))
    require(run["scriptSha256"] == decoder_sha, "Native decoder/source mismatch")
    for file, digest in run["logs"].items():
        require(sha(root / file) == digest, "Changed native log")
    decoded_sha = sha(root / "native-decoded.json")
    receipt = json.loads((root / "native-stdout.log").read_text())
    require(receipt["decodedSha256"] == decoded_sha, "Decoded result mismatch")
    raw = json.loads((root / "native-decoded.json").read_text())
    require(raw["schemaVersion"] == 1 and raw["build"] == BUILD and raw["inputsSha256"] == INPUTS_SHA, "Invalid decoded namespace")
    require(raw["decoderSha256"] == decoder_sha, "Wrong native decoder")
    api_proof = json.loads((root / "official-types-proof.json").read_text())
    require(api_proof["url"] == API and api_proof["status"] == 200, "Wrong API source")
    require(raw["apiSha256"] == api_proof["sha256"] == sha(root / "official-types.json"), "Wrong API bytes")
    api = json.loads((root / "official-types.json").read_text())
    require(api["metadata"]["total"] == len(api["data"]) == 538, "Incomplete API catalog")
    require(len({x["id"] for x in api["data"]}) == len(api["data"]), "Duplicate API type")
    return raw, inputs, api["data"], api_proof, decoded_sha


def build_snapshot(raw, api_rows, strings):
    api = {str(x["id"]): x for x in api_rows}
    local = lambda key: re.sub(r"<[^>]*>", "", strings.get(str(key), "")).strip() or None
    ids = set(api) | set(raw["types"])
    types, differences = {}, []
    for key in sorted(ids, key=int):
        native = raw["types"].get(key)
        official = api.get(key)
        client_name = local(native.get("typeNameID")) if native else None
        types[key] = {
            "id": int(key), "name": (official or {}).get("name") or client_name or f"Unnamed type #{key}",
            "apiPublished": official is not None, "clientRecord": native is not None,
            "clientName": client_name,
            "group": (official or {}).get("groupName") or (local(raw["groups"][str(native["groupID"])]["groupNameID"]) if native else None),
            "category": (official or {}).get("categoryName"),
            "graphicID": native.get("graphicID") if native else None,
            "attributes": [],
        }
        if official and native:
            if official["name"] and client_name != official["name"]:
                differences.append({"typeID": int(key), "field": "name", "api": official["name"], "client": client_name})
            for field in ("mass", "volume", "radius", "portionSize"):
                n, a = native[field], official[field]
                require(finite(n) and finite(a), "Non-finite item field")
                if not (n == a or struct.unpack("<f", struct.pack("<f", n))[0] == a):
                    differences.append({"typeID": int(key), "field": field, "api": a, "client": n})
        attrs = raw["dogma"].get(key, {}).get("dogmaAttributes", [])
        seen = set()
        for attr in attrs:
            aid, value = attr["attributeID"], attr["value"]
            require(integer(aid) and aid not in seen and finite(value), "Invalid/duplicate native attribute")
            seen.add(aid)
            require(str(aid) in raw["attributeDefinitions"], "Missing attribute definition")
            types[key]["attributes"].append({"id": aid, "value": value})
        types[key]["attributes"].sort(key=lambda x: x["id"])
    used_attrs = {str(a["id"]) for t in types.values() for a in t["attributes"]}
    attrs = {}
    units = {}
    for key in sorted(used_attrs, key=int):
        source = raw["attributeDefinitions"][key]
        uid = source.get("unitID")
        attrs[key] = {"id": int(key), "name": source["name"], "label": local(source.get("displayNameID")), "unitID": uid}
        if uid is not None:
            require(str(uid) in raw["unitDefinitions"], "Missing native unit")
            u = raw["unitDefinitions"][str(uid)]
            units[str(uid)] = {"id": uid, "name": u["name"], "label": local(u.get("displayNameID")), "description": local(u.get("descriptionID"))}
    recipes = []
    for key, r in sorted(raw["blueprints"].items(), key=lambda x: int(x[0])):
        require(integer(int(key)) and set(r) == {"inputs", "outputs", "primaryTypeID", "runTime"}, "Unexpected recipe schema")
        require(integer(r["primaryTypeID"]) and str(r["primaryTypeID"]) in types, "Missing primary type")
        require(finite(r["runTime"]) and r["runTime"] >= 0, "Invalid raw runtime")
        for side in ("inputs", "outputs"):
            require(isinstance(r[side], list) and r[side], "Empty recipe side")
            seen = set()
            for line in r[side]:
                require(set(line) == {"typeID", "quantity"} and integer(line["typeID"]) and integer(line["quantity"]), "Invalid recipe line")
                require(str(line["typeID"]) in types and types[str(line["typeID"])]["clientRecord"], "Unresolved recipe type")
                require(line["typeID"] not in seen, "Duplicate recipe type")
                seen.add(line["typeID"])
        recipes.append({"id": int(key), **r})
    # Independent documented quantities: do not infer the Water Ice output from the patch.
    by_id = {x["id"]: x for x in recipes}
    require(by_id[1627]["inputs"] == [{"quantity": 21, "typeID": 89258}] and by_id[1627]["outputs"] == [{"quantity": 75, "typeID": 88335}], "Fuel patch mismatch")
    require(by_id[1181]["inputs"] == [{"quantity": 208, "typeID": 78423}], "Water Ice patch mismatch")
    require(len(recipes) == raw["tableCounts"]["industry_blueprints"], "Recipe count mismatch")
    return {"types": types, "attributes": attrs, "units": units, "graphics": raw["graphics"], "recipes": recipes,
            "apiDifferences": differences,
            "counts": {"recipes": len(recipes), "linkedTypes": len(types), "apiTypes": len(api), "nativeTypes": len(raw["types"]),
                       "typesWithAttributes": sum(bool(t["attributes"]) for t in types.values()), "attributeDefinitions": len(attrs)},
            "missingClientTypeIDs": raw["missingTypeIDs"],
            "patchChecks": [{"recipeID": 1627, "fields": "input and output quantities", "url": PATCH},
                            {"recipeID": 1181, "fields": "input quantity only; output is client evidence", "url": PATCH}]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--evidence-root", type=Path, required=True)
    parser.add_argument("--snapshot", type=Path, required=True)
    args = parser.parse_args()
    raw, inputs, api, api_proof, decoded_sha = load_verified(args.evidence_root)
    require(sha(args.snapshot / "strings.json") == STRINGS_SHA, "Unreviewed localization snapshot")
    meta = json.loads((args.snapshot / "meta.json").read_text())
    require(meta["world"] == WORLD and meta["build"] == BUILD and meta["cycle"] == 7, "Wrong output namespace")
    require(meta["manifestSha256"] == inputs["manifests"]["stillness/resfileindex.txt"], "Different resource manifests")
    result = build_snapshot(raw, api, json.loads((args.snapshot / "strings.json").read_text()))
    result.update(schemaVersion=1, cycle=7, name="Vestiges", server="Stillness", world=WORLD, build=BUILD,
                  extractedAt=datetime.now(timezone.utc).isoformat(),
                  scope="Client reference definitions; not live facility availability, effective fitted statistics, or a production calculator.")
    result["provenance"] = {"inputsSha256": INPUTS_SHA, "decodedSha256": decoded_sha,
        "decoderSha256": sha(Path(__file__).with_name("native_decode.py")), "exporterSha256": sha(Path(__file__)),
        "stringsSha256": STRINGS_SHA, "api": api_proof, "manifests": inputs["manifests"],
        "files": [{k: v for k, v in row.items() if k != "file"} for row in inputs["files"]]}
    output = args.snapshot / "native-v1.json"
    payload = json.dumps(result, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
    temp = output.with_suffix(".tmp")
    temp.write_text(payload, encoding="utf-8")
    temp.replace(output)
    meta["native"] = {"file": output.name, "sha256": sha(output), "extractedAt": result["extractedAt"], **result["counts"]}
    for row in meta["clientFiles"]:
        if row["resource"] in {x["virtual"] for x in inputs["files"]}:
            row["decodeStatus"] = "Decoded using matching native cFSD reader; bounded reference export in native-v1.json."
    meta["coverage"] = [x for x in meta["coverage"] if not x.startswith("Client binary recipes")]
    native_note = "Native client recipes and raw base attributes are available as reference data. Facility rules, timing units, effective fitted statistics and complete 3D models are not verified. Industry and fitting calculators remain historical."
    if native_note not in meta["coverage"]:
        meta["coverage"].append(native_note)
    (args.snapshot / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(json.dumps({"file": str(output), "bytes": output.stat().st_size, **result["counts"], "apiDifferences": len(result["apiDifferences"])}))


if __name__ == "__main__":
    main()
