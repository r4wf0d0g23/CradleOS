#!/usr/bin/env python3
"""
extract_for_dapp.py — slice extracted Sanctuary game data into JSON blobs
the CradleOS dApp can fetch directly.

Output layout under <out>/:
  game-data-meta.json           — build version, extraction date, counts
  game-data-strings-index.json  — minified {typeID: shortName} for fast load
  game-data-strings-full.json   — full {typeID: {text, descId?}} entries
  game-data-catalogue.json      — curated typeID groups: structures, turrets,
                                  shells, ascension, kitbash, refuge, etc.
  game-data-eventtypes.json     — Cycle 5 event types (carries forward)
  game-data-cycle-deltas.json   — Sanctuary new/changed items vs Cycle 5

The dApp reads these from public/data/ at runtime.
"""
from __future__ import annotations
import argparse
import json
import pickle
import re
from collections import defaultdict
from pathlib import Path


# Heuristic: a "display name" is a short, single-line string with no markup.
# Long strings (>120 chars) are descriptions or system messages; we keep
# them in the full export but exclude them from the index for byte-sized
# lazy loading on first paint.
NAME_MAX = 120


def is_display_name(text: str) -> bool:
    if not isinstance(text, str):
        return False
    if not (1 <= len(text) <= NAME_MAX):
        return False
    if "\n" in text or "<" in text or "{" in text:
        return False
    return True


def load_localization(pickle_path: Path) -> dict[int, dict]:
    """Returns {typeID: {'text': str, 'desc': str | None, 'meta': str | None}}."""
    with pickle_path.open("rb") as fh:
        _meta, entries = pickle.load(fh)
    out: dict[int, dict] = {}
    for tid, val in entries.items():
        if not isinstance(val, tuple) or not val:
            continue
        text = val[0] if isinstance(val[0], str) else None
        desc = val[1] if len(val) > 1 and isinstance(val[1], str) else None
        meta = val[2] if len(val) > 2 and isinstance(val[2], str) else None
        if text:
            out[int(tid)] = {"text": text, "desc": desc, "meta": meta}
    return out


def build_catalogue(strings: dict[int, dict]) -> dict[str, list[dict]]:
    """Curated buckets of Sanctuary-relevant typeIDs the dApp will showcase."""

    # Sanctuary structure roster (verified from DATAMINE_REPORT.md)
    structure_ids = {
        # Cycle 5 carries (verified unchanged)
        1032744: "Mini Printer",       1032745: "Printer",            1032746: "Heavy Printer",
        1032747: "Refinery",           1032748: "Heavy Refinery",
        1032749: "Mini Berth",         1032750: "Berth",              1032751: "Heavy Berth",
        1032752: "Assembler",
        1032753: "Shelter",            1032754: "Heavy Shelter",
        1032755: "Mini Gate",          1032756: "Heavy Gate",
        1032757: "Mini Storage",       1032758: "Storage",            1032759: "Heavy Storage",
        1032761: "Relay",
        1032762: "Monolith 1",         1032763: "Monolith 2",
        1032764: "Wall 1",             1032765: "Wall 2",
        # Sanctuary new
        1032766: "RAINMAKER I",        1032767: "RAINMAKER II",
        1032768: "HARBINGER I",        1032769: "HARBINGER II",
    }

    turret_ids = {
        1035947: "Mini Turret",        1035955: "Mini Turret (alt)",
        1036365: "Turret",             1036375: "Turret (alt)",
        1036367: "Turret - Autocannon",
        1036369: "Turret - Plasma",
        1037106: "Turret - Howitzer",
        1036371: "Heavy Turret",       1036377: "Heavy Turret (alt)",
    }

    shell_ids = {
        1034901: "Aggressive Shell",
        1034902: "Rugged Shell",
        1034903: "Blank Shell",
        1034926: "Ancient Shell",
        1034928: "Synthetic Mining Shell",
        1034924: "Nursery",
        1036920: "Deployable Nursery Medium",
    }

    refuge_ids = {
        1015358: "Refuge (description)",
    }

    rainmaker_harbinger_ids = {
        1032766: "RAINMAKER I",        1032767: "RAINMAKER II",
        1032768: "HARBINGER I",        1032769: "HARBINGER II",
    }

    ecosystem_ids = {
        1036889: "Transitional Entry Dungeon 1",
        1036890: "Ecosystem 21 Entry Dungeon",
        1036891: "Ecosystem 22 Entry Beacon",
    }

    def populate(ids: dict[int, str], group_label: str) -> list[dict]:
        rows = []
        for tid, label in ids.items():
            s = strings.get(tid)
            text = s["text"] if s else None
            desc = s["desc"] if s else None
            rows.append({
                "typeID": tid,
                "label": label,
                "text": text,
                "desc": desc,
                "group": group_label,
            })
        return rows

    return {
        "structures": populate(structure_ids, "Structures"),
        "turrets": populate(turret_ids, "Turrets"),
        "shells_and_nursery": populate(shell_ids, "Shell System"),
        "refuge": populate(refuge_ids, "Refuge"),
        "ecosystem_dungeons": populate(ecosystem_ids, "Ecosystem"),
        "sanctuary_new_structures": populate(rainmaker_harbinger_ids, "New This Cycle"),
    }


def build_cycle_deltas(diff_dir: Path) -> dict:
    """Summarize the diff vs Cycle 5 for the panel's deltas tab."""
    out: dict = {"added": [], "changed": [], "removed": []}
    for kind in ("added", "changed", "removed"):
        path = diff_dir / f"{kind}.json"
        if not path.is_file():
            continue
        data = json.loads(path.read_text())
        # We only ship the /staticdata/ subset to the panel — it's the
        # interesting bit; the dx9 shader churn is uninteresting at the UI level.
        filtered = [
            entry["path"]
            for entry in data
            if entry.get("path", "").startswith("res:/staticdata/")
        ]
        out[kind] = filtered
    return out


def extract_kitbash_strings(strings: dict[int, dict]) -> list[dict]:
    """Pull anything matching Kitbash patterns for the catalogue."""
    rows = []
    pattern = re.compile(r"^Kitbash\b", re.IGNORECASE)
    for tid, e in strings.items():
        if pattern.search(e["text"]):
            rows.append({"typeID": tid, "text": e["text"], "desc": e["desc"]})
    return rows[:64]  # Cap to keep the JSON slim


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--raw", type=Path, required=True, help="path to datamine/sanctuary/raw/")
    ap.add_argument("--diff", type=Path, required=True, help="path to datamine/sanctuary/diff/")
    ap.add_argument("--out", type=Path, required=True, help="output dir (typically public/data/)")
    ap.add_argument("--cycle-name", default="Sanctuary")
    ap.add_argument("--cycle-version", default="v2026.05")
    ap.add_argument("--cycle-build", default="3388875")
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)

    print("[*] Loading localization pickle…")
    strings = load_localization(args.raw / "localization_fsd_en-us.pickle")
    print(f"    {len(strings):,} entries.")

    # ── strings-index: just the short display names ────────────────────
    index_rows: dict[str, str] = {}
    for tid, e in strings.items():
        if is_display_name(e["text"]):
            index_rows[str(tid)] = e["text"]
    print(f"[*] Index: {len(index_rows):,} short display strings.")

    (args.out / "game-data-strings-index.json").write_text(
        json.dumps(index_rows, separators=(",", ":"))
    )

    # ── strings-full: complete set for advanced search (gzipped on serve) ──
    full_rows = {
        str(tid): {
            "t": e["text"],  # text
            "d": e["desc"],  # desc (may be null)
            "m": e["meta"],  # meta (may be null)
        }
        for tid, e in strings.items()
    }
    (args.out / "game-data-strings-full.json").write_text(
        json.dumps(full_rows, separators=(",", ":"))
    )
    print(f"[*] Full strings written: {len(full_rows):,} entries.")

    # ── catalogue ──────────────────────────────────────────────────────
    catalogue = build_catalogue(strings)
    catalogue["kitbash_strings"] = extract_kitbash_strings(strings)
    (args.out / "game-data-catalogue.json").write_text(
        json.dumps(catalogue, indent=2)
    )
    print(f"[*] Catalogue: {sum(len(v) for v in catalogue.values()):,} curated rows.")

    # ── eventtypes carry-over ──────────────────────────────────────────
    eventtypes_src = Path("frontier/data/eventtypes.json")
    if eventtypes_src.exists():
        (args.out / "game-data-eventtypes.json").write_text(eventtypes_src.read_text())
        print("[*] Event types carried forward.")

    # ── cycle deltas ───────────────────────────────────────────────────
    deltas = build_cycle_deltas(args.diff)
    (args.out / "game-data-cycle-deltas.json").write_text(json.dumps(deltas, indent=2))
    print(f"[*] Cycle deltas: +{len(deltas['added'])} \u0394{len(deltas['changed'])} -{len(deltas['removed'])}")

    # ── meta ───────────────────────────────────────────────────────────
    meta = {
        "cycle": args.cycle_name,
        "version": args.cycle_version,
        "build": args.cycle_build,
        "extracted_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "counts": {
            "strings_total": len(strings),
            "strings_index": len(index_rows),
            "catalogue_rows": sum(len(v) for v in catalogue.values()),
            "deltas_added": len(deltas["added"]),
            "deltas_changed": len(deltas["changed"]),
            "deltas_removed": len(deltas["removed"]),
        },
    }
    (args.out / "game-data-meta.json").write_text(json.dumps(meta, indent=2))
    print(f"[\u2713] Wrote 6 game-data-*.json files to {args.out}/")

    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
