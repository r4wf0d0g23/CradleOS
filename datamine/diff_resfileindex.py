#!/usr/bin/env python3
"""
diff_resfileindex.py — diff two resfileindex.txt files (or any cycle indexes).

Resfileindex format (one line per resource):
  res:/<path>,<bucket-hash>_<full-hash>,<full-hash>,<size>,<compressed-size>

Outputs three lists to stdout (and optionally three JSON files):
  ADDED    — paths present in NEW but not OLD
  REMOVED  — paths present in OLD but not NEW
  CHANGED  — paths in both but with a different full-hash (content rotated)

Usage:
  ./diff_resfileindex.py <old.txt> <new.txt>              # human summary
  ./diff_resfileindex.py --json out/ <old.txt> <new.txt>  # also dump JSON
  ./diff_resfileindex.py --filter '^res:/staticdata/' ... # only paths matching regex
"""
from __future__ import annotations
import argparse
import json
import os
import re
import sys
from pathlib import Path


def parse_index(path: Path, path_filter: re.Pattern | None) -> dict[str, str]:
    """Return {res_path: full_hash} for one resfileindex."""
    out: dict[str, str] = {}
    with path.open("r", encoding="utf-8", errors="replace") as fh:
        for line_no, line in enumerate(fh, 1):
            line = line.rstrip("\n").rstrip("\r")
            if not line:
                continue
            parts = line.split(",")
            if len(parts) < 3:
                print(f"  skip line {line_no} (parts={len(parts)}): {line[:80]}", file=sys.stderr)
                continue
            res_path = parts[0]
            full_hash = parts[2]
            if path_filter and not path_filter.search(res_path):
                continue
            out[res_path] = full_hash
    return out


def group_by_dir(paths: list[str]) -> dict[str, int]:
    """Group paths by their top-level directory under res:/ for quick read."""
    groups: dict[str, int] = {}
    for p in paths:
        # res:/staticdata/foo/bar.static → 'staticdata'
        body = p[len("res:/"):] if p.startswith("res:/") else p
        top = body.split("/", 1)[0] if "/" in body else body
        groups[top] = groups.get(top, 0) + 1
    return dict(sorted(groups.items(), key=lambda kv: -kv[1]))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("old", type=Path, help="old resfileindex.txt")
    ap.add_argument("new", type=Path, help="new resfileindex.txt")
    ap.add_argument("--filter", help="regex; only consider paths matching this", default=None)
    ap.add_argument("--json", type=Path, help="dump added/removed/changed as JSON in this dir", default=None)
    ap.add_argument("--show", type=int, default=30, help="max lines to print per section (default 30)")
    args = ap.parse_args()

    if not args.old.is_file():
        print(f"FATAL: old index not found: {args.old}", file=sys.stderr)
        return 1
    if not args.new.is_file():
        print(f"FATAL: new index not found: {args.new}", file=sys.stderr)
        return 1

    path_filter = re.compile(args.filter) if args.filter else None

    print(f"Reading OLD: {args.old}", file=sys.stderr)
    old = parse_index(args.old, path_filter)
    print(f"Reading NEW: {args.new}", file=sys.stderr)
    new = parse_index(args.new, path_filter)
    print(f"  old: {len(old)} entries  new: {len(new)} entries", file=sys.stderr)

    added = sorted(set(new) - set(old))
    removed = sorted(set(old) - set(new))
    changed = sorted(p for p in (set(old) & set(new)) if old[p] != new[p])

    # ── Summary ─────────────────────────────────────────────────────────
    print(f"\n=== RESFILEINDEX DIFF: {args.old.name} → {args.new.name} ===")
    print(f"  added   : {len(added)}")
    print(f"  removed : {len(removed)}")
    print(f"  changed : {len(changed)}")
    print(f"  total Δ : {len(added) + len(removed) + len(changed)}")

    print(f"\n--- top dirs of ADDED ({min(len(added), 20)} of {len(added)}) ---")
    for d, n in list(group_by_dir(added).items())[:20]:
        print(f"  {n:>6} {d}/")
    print(f"\n--- top dirs of CHANGED ({min(len(changed), 20)} of {len(changed)}) ---")
    for d, n in list(group_by_dir(changed).items())[:20]:
        print(f"  {n:>6} {d}/")
    print(f"\n--- top dirs of REMOVED ({min(len(removed), 20)} of {len(removed)}) ---")
    for d, n in list(group_by_dir(removed).items())[:20]:
        print(f"  {n:>6} {d}/")

    # ── Spotlight on /staticdata/ if not already filtered ──────────────
    if not path_filter:
        sd_re = re.compile(r"^res:/staticdata/")
        sd_added = [p for p in added if sd_re.search(p)]
        sd_changed = [p for p in changed if sd_re.search(p)]
        sd_removed = [p for p in removed if sd_re.search(p)]
        print(f"\n--- /staticdata/ subset: +{len(sd_added)}  Δ{len(sd_changed)}  -{len(sd_removed)} ---")
        for p in sd_added[:args.show]:
            print(f"  +  {p}")
        for p in sd_changed[:args.show]:
            print(f"  Δ  {p}  (new hash {new[p][:12]}\u2026)")
        for p in sd_removed[:args.show]:
            print(f"  -  {p}")

    # ── JSON dump ───────────────────────────────────────────────────────
    if args.json:
        args.json.mkdir(parents=True, exist_ok=True)
        for name, lst in (("added", added), ("removed", removed), ("changed", changed)):
            out_path = args.json / f"{name}.json"
            data = (
                [{"path": p, "hash": new[p]} for p in lst] if name == "added" else
                [{"path": p, "hash": old[p]} for p in lst] if name == "removed" else
                [{"path": p, "old_hash": old[p], "new_hash": new[p]} for p in lst]
            )
            out_path.write_text(json.dumps(data, indent=2))
            print(f"  wrote {out_path}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
