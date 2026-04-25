#!/usr/bin/env python3
"""
Build corrected RAG corpus entries from vision-extracted ground truth.

Output two artifacts:
  1. corrected_ships.jsonl — one JSON object per ship with id/text/image_path/metadata
  2. reindex_ships.py — script to upsert into chroma collection

The 'text' field is what the RAG returns to the keeper. We make it dense
and authoritative — including class, all stats, and a brief tactical note —
so the model has enough context to weave a Keeper-voice response without
hallucinating.
"""

import json
from pathlib import Path

GT_PATH = Path(__file__).parent / "ground_truth.json"
OUT_JSONL = Path(__file__).parent / "corrected_ships.jsonl"

# Tactical character notes per ship — short, factual, woven from the stats.
# Each line should sound like an in-universe data fragment, not a prose summary.
TACTICAL_NOTES = {
    "lai":     "Standard light frigate. Solo capable. Jump-equipped. Mid signature.",
    "lorha":   "Industrial frigate variant. ~6× LAI cargo capacity. Slow turning. Logistics role.",
    "haf":     "Heavy assault frigate. Largest mass in the frigate class. Higher capacitor.",
    "carom":   "Lightweight corvette. Low fuel cost. Restricted slot layout.",
    "maul":    "Heavy cruiser. Largest combat hull commonly fielded. High mass — slow to align.",
    "tades":   "Destroyer hull. Mid-tier engagement profile. Higher warp speed than larger ships.",
    "recurve": "Mining/utility corvette. Low fuel capacity. Short engagement endurance.",
    "reiver":  "Combat corvette variant. Higher inertia modifier — turns sharper than fleet corvettes.",
    "wend":    "Civilian shuttle. Minimal mass. No combat role. Personal transit only.",
    "usv":     "Industrial frigate (USV). Mid cargo capacity. Slow sublight velocity.",
    "stride":  "Industrial corvette. Largest fuel capacity in the corvette class.",
    "reflex":  "Fast corvette. Mid-tier velocity, low signature. Light combat profile.",
    "mcf":     "Heavy frigate (MCF). Highest fuel capacity in the frigate class.",
    "chumaq":  "Combat battlecruiser. Capital-tier mass. ~2.3M m³ volume — assembly-class hull.",
}


def fmt_int(n):
    if n is None:
        return "n/a"
    return f"{int(n):,}"


def fmt_float(n, places=2):
    if n is None:
        return "n/a"
    return f"{n:.{places}f}"


def build_text(ship_key: str, gt: dict) -> str:
    """Build the dense RAG text for a single ship from ground-truth stats."""
    name = gt["title_bar_name"]
    cls = gt["title_bar_class"]
    note = TACTICAL_NOTES.get(ship_key, "")

    parts = [f"Ship: {name}. Class: {cls}."]
    if note:
        parts.append(note)
    parts.append(
        f"Hull integrity {fmt_int(gt['structure_hp'])} HP. "
        f"Cargo capacity {fmt_int(gt['capacity_m3'])} m³. "
        f"Fuel capacity {fmt_int(gt['fuel_capacity'])} units. "
        f"Mass {fmt_int(gt['mass_kg'])} kg. "
        f"Volume {fmt_int(gt['volume_m3'])} m³. "
        f"Inertia modifier {fmt_float(gt['inertia_modifier'], 2)}x. "
        f"Capacitor {fmt_float(gt['capacitor_gj'], 1)} GJ. "
        f"Max velocity {fmt_int(gt['max_velocity_ms'])} m/s. "
        f"Warp speed {fmt_float(gt['ship_warp_speed_kc'], 2)} kc. "
        f"Signature radius {fmt_int(gt['signature_radius_m'])} m. "
        f"Targeting range {fmt_int(gt['max_targeting_range_km'])} km. "
        f"Scan resolution {fmt_int(gt['scan_resolution_mm'])} mm."
    )
    parts.append(f"Visual signature: {gt['ship_art_description']}.")
    return " ".join(parts)


def main():
    with open(GT_PATH) as f:
        gt = json.load(f)

    rows = []
    for ship_key, ship_gt in gt["ships"].items():
        text = build_text(ship_key, ship_gt)
        row = {
            "id": f"ship_{ship_key}",
            "text": text,
            "image_path": f"images/{ship_key}_card.png",  # NEW cropped card path
            "metadata": {
                "source": "ship",
                "type": "ship",
                "name": ship_gt["title_bar_name"],
                "class": ship_gt["title_bar_class"].lower(),
                "image_path": f"images/{ship_key}_card.png",
                "ground_truth_extracted_by": gt["extracted_by"],
            },
        }
        rows.append(row)

    with open(OUT_JSONL, "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")

    print(f"wrote {len(rows)} corrected entries to {OUT_JSONL}")
    print()
    print("--- sample (lai) ---")
    sample = next(r for r in rows if r["id"] == "ship_lai")
    print(sample["text"])


if __name__ == "__main__":
    main()
