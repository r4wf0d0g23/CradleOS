#!/usr/bin/env python3
"""
overlay-solarsystem-names.py — patch solarsystems-<world>.json with names
read from the EVE Frontier client's localization pickle.

Why this exists: post-Sanctuary (build 3409470, 2026-06-25 wipe day), the
public world-api returns numeric placeholder strings for the `name` field
of every solar system (e.g. id=30000001 returns name="30089267"). The
in-game client resolves the human-readable name (e.g. "A 2560") via a
separate lookup against the bundled localization pickle. Our snapshot
needs the human-readable name to match what users see in the game.

The localization indexing model (verified against build 3409470):
    typeID = 825732 + (solarSystemID - 30000001)

Of 24,502 systems, ~22,700 follow this model. The remaining ~1,800 are
special regions (VC- / ADC- constellations and beyond) that use a
different scheme — we leave those alone with whatever name was already
in the snapshot.

Usage:
    python3 scripts/overlay-solarsystem-names.py \\
        --pickle ../datamine/sanctuary-3409470/raw/localization_fsd_en-us.pickle \\
        --snapshot public/data/solarsystems-stillness.json

Run AFTER `node scripts/refresh-solar-systems.mjs` re-pulls the geometry.
"""
import argparse
import json
import pickle
import sys
import datetime
from pathlib import Path


BASE_SYSTEM_ID = 30000001
BASE_TYPE_ID = 825732


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pickle", type=Path, required=True,
                    help="path to localization_fsd_en-us.pickle from the client static-data extract")
    ap.add_argument("--snapshot", type=Path, required=True,
                    help="path to public/data/solarsystems-<world>.json to patch in-place")
    ap.add_argument("--dry-run", action="store_true",
                    help="report what would change without writing")
    args = ap.parse_args()

    if not args.pickle.exists():
        print(f"FATAL: pickle not found: {args.pickle}", file=sys.stderr)
        return 1
    if not args.snapshot.exists():
        print(f"FATAL: snapshot not found: {args.snapshot}", file=sys.stderr)
        return 1

    print(f"[*] Loading localization pickle: {args.pickle}")
    with args.pickle.open("rb") as fh:
        _, entries = pickle.load(fh)
    print(f"    {len(entries):,} localization entries.")

    print(f"[*] Loading snapshot: {args.snapshot}")
    with args.snapshot.open() as fh:
        snap = json.load(fh)
    systems = snap.get("systems", {})
    print(f"    {len(systems):,} systems in snapshot.")

    fixed = 0
    already_correct = 0
    no_pickle_entry = 0
    sample_changes: list[tuple[str, str, str]] = []

    for sid_str, rec in systems.items():
        sid = int(sid_str)
        expected_tid = BASE_TYPE_ID + (sid - BASE_SYSTEM_ID)
        val = entries.get(expected_tid)
        if not val or not isinstance(val, tuple) or not val[0]:
            no_pickle_entry += 1
            continue
        correct_name = val[0]
        current_name = rec.get("name")
        if current_name == correct_name:
            already_correct += 1
        else:
            if len(sample_changes) < 10:
                sample_changes.append((sid_str, str(current_name), correct_name))
            rec["name"] = correct_name
            fixed += 1

    print()
    print(f"already correct:  {already_correct:,}")
    print(f"renamed:          {fixed:,}")
    print(f"no pickle entry:  {no_pickle_entry:,}")
    print(f"total:            {len(systems):,}")
    print()
    if sample_changes:
        print("sample renames:")
        for sid, old, new in sample_changes:
            print(f"  {sid}: \"{old}\" → \"{new}\"")
        print()

    if args.dry_run:
        print("[dry-run] not writing")
        return 0

    snap["_generated"] = datetime.datetime.now(datetime.UTC).isoformat()
    snap["_source"] = (
        f"world-api geometry + {args.pickle.name} (localization overlay)"
    )
    with args.snapshot.open("w") as fh:
        json.dump(snap, fh, separators=(",", ":"))
    print(f"[\u2713] Wrote {args.snapshot}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
