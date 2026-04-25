#!/usr/bin/env python3
"""
Crop all 14 ship UI panels to clean 'ship art only' thumbnails.

Most ship UI panels are 473×1009. CHUMAQ is uniquely 517×654.
Crop coordinates were validated per layout via vision audit:

    Standard 473×1009 layout: x=5-138, y=45-170 (from validated LAI test)
    CHUMAQ 517×654 layout:    x=8-130, y=55-155 (from CHUMAQ-specific vision audit)

This excludes title bar, ship name label, tab bar, and the right-side
UI chrome. Output: 14 PNG cards in crops/ subdirectory.
"""

from pathlib import Path
from PIL import Image

SRC_DIR = Path(__file__).parent
OUT_DIR = SRC_DIR / "crops"
OUT_DIR.mkdir(exist_ok=True)

# Layout-specific crop regions
STANDARD_LAYOUT = (5, 45, 138, 158)  # for 473×1009 (y_end tightened from 170 → 158 to remove tab bar)
CHUMAQ_LAYOUT = (8, 55, 130, 155)    # for 517×654

LAYOUT_BY_SHIP = {
    "chumaq": CHUMAQ_LAYOUT,
}
DEFAULT_LAYOUT = STANDARD_LAYOUT

SHIPS = [
    "carom", "chumaq", "haf", "lai", "lorha", "maul", "mcf",
    "recurve", "reflex", "reiver", "stride", "tades", "usv", "wend",
]


def main():
    for ship in SHIPS:
        src = SRC_DIR / f"{ship}.png"
        dst = OUT_DIR / f"{ship}_card.png"
        if not src.exists():
            print(f"  ! missing source: {src}")
            continue
        im = Image.open(src)
        region = LAYOUT_BY_SHIP.get(ship, DEFAULT_LAYOUT)
        crop = im.crop(region)
        crop.save(dst, optimize=True)
        size_kb = dst.stat().st_size / 1024
        print(f"  ✓ {ship}: {im.size} → crop {region} → {crop.size} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
