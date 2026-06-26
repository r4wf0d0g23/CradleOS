#!/usr/bin/env python3
"""
overlay-solarsystem-names.py — patch solarsystems-<world>.json with the
canonical system names from the EVE Frontier client's `systems.static`
data file.

Why this exists: post-Sanctuary (build 3409470, 2026-06-25 wipe day) the
public world-api returns numeric placeholder strings for the `name` field
of every solar system (e.g. id=30000001 returns name="30089267"). The
in-game client reads the canonical name directly from the bundled
`systems.static` file's per-system `name: string` field. Our snapshot
needs to use the same name source.

(Earlier we hypothesized the names lived in the localization pickle at
offset `825732 + (sys_id - 30000001)`. That theory was wrong — those
typeIDs returned a completely different name set that looked plausible
but didn't match in-game. The canonical source is `systems.static`.)

Usage:
    python3 scripts/overlay-solarsystem-names.py \\
        --systems-static ../datamine/sanctuary-3409470/raw/systems.static \\
        --systems-schema ../datamine/sanctuary-3409470/raw/systems.schema \\
        --snapshot public/data/solarsystems-stillness.json

Run AFTER `node scripts/refresh-solar-systems.mjs` re-pulls the geometry.
Both `systems.static` and `systems.schema` come from pulling
`res:/staticdata/systems.static` and `res:/staticdata/systems.schema`
out of the client's ResFiles. See `frontier/datamine/` for past
extraction runs.
"""
import argparse
import datetime
import json
import sys
import yaml
from pathlib import Path

# fsd_decoder lives at the workspace root
WORKSPACE = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(WORKSPACE / "frontier"))
from fsd_decoder import FSDDecoder  # type: ignore  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--systems-static", type=Path, required=True,
                    help="path to systems.static from the client static-data extract")
    ap.add_argument("--systems-schema", type=Path, required=True,
                    help="path to systems.schema (sidecar YAML schema for systems.static)")
    ap.add_argument("--snapshot", type=Path, required=True,
                    help="path to public/data/solarsystems-<world>.json to patch in-place")
    ap.add_argument("--dry-run", action="store_true",
                    help="report what would change without writing")
    args = ap.parse_args()

    for p in (args.systems_static, args.systems_schema, args.snapshot):
        if not p.exists():
            print(f"FATAL: not found: {p}", file=sys.stderr)
            return 1

    print(f"[*] Loading systems schema: {args.systems_schema}")
    schema = yaml.safe_load(args.systems_schema.read_text())

    print(f"[*] Decoding systems.static: {args.systems_static}")
    d = FSDDecoder()
    raw = args.systems_static.read_bytes()
    sys_data = d.decode_static(raw, external_schema=schema)
    print(f"    {len(sys_data):,} systems decoded.")

    print(f"[*] Loading snapshot: {args.snapshot}")
    with args.snapshot.open() as fh:
        snap = json.load(fh)
    systems = snap.get("systems", {})
    print(f"    {len(systems):,} systems in snapshot.")

    fixed = 0
    already_correct = 0
    no_static_entry = 0
    sample_changes: list[tuple[str, str, str]] = []

    for sid_str, rec in systems.items():
        sid = int(sid_str)
        entry = sys_data.get(sid)
        if not entry:
            no_static_entry += 1
            continue
        canonical_name = entry.get("name")
        if not canonical_name:
            no_static_entry += 1
            continue
        current = rec.get("name")
        if current == canonical_name:
            already_correct += 1
        else:
            if len(sample_changes) < 10:
                sample_changes.append((sid_str, str(current), canonical_name))
            rec["name"] = canonical_name
            fixed += 1

    print()
    print(f"already correct:  {already_correct:,}")
    print(f"renamed:          {fixed:,}")
    print(f"no static entry:  {no_static_entry:,}")
    print(f"total:            {len(systems):,}")
    print()
    if sample_changes:
        print("sample renames:")
        for sid, old, new in sample_changes:
            print(f"  {sid}: \"{old}\" -> \"{new}\"")
        print()

    if args.dry_run:
        print("[dry-run] not writing")
        return 0

    snap["_generated"] = datetime.datetime.now(datetime.UTC).isoformat()
    snap["_source"] = (
        f"world-api geometry + {args.systems_static.name} (canonical name overlay)"
    )
    with args.snapshot.open("w") as fh:
        json.dump(snap, fh, separators=(",", ":"))
    print(f"[\u2713] Wrote {args.snapshot}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
