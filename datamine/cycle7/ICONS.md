# Current-client icon pack

Build **3573151**, Stillness / Cycle 7 / Vestiges. Extends the native cFSD
extraction described in NATIVE.md with the matching `iconIDsLoader` and
`iconids.fsdbinary`. No engine rendering or game login is needed for these PNGs.

## Scope and mapping

- 566 API/recipe-linked type references; 564 resolved, two explicitly unresolved
  (84556 Smart Turret, 93228 Field Cairn: absent native type records).
- 244 named shared UI symbols from `res:/ui/texture/eveicon/`.
- 571 entries from `res:/ui/texture/icons/frontier/`, a **source-art library**,
  not a claim that every asset is used by currently playable content.
- 862 unique PNGs, 6,118,859 original bytes. Duplicate bytes are shared, type IDs
  are not. No image generation, guessed name joins, upscaling or pixel editing.

Resolution is explicit type.iconID -> icon table -> source resource first.
Otherwise use exact graphic.iconInfo.folder/graphicID_128.png (64 fallback).
Never choose blueprint, copy, ISIS or similarly named variants by prefix.
This documented reference-image policy is not every client UI's compositing
logic. Old and new same-name Reivers retain different graphic/source references;
their shipped thumbnail bytes happen to match and are deduplicated.

API icon URLs and resource filenames resembling type IDs are not silently
substituted for missing native mappings. Unknown items remain readable with
a neutral placeholder. This is not an active/universe-wide item enumeration.

## Reproduce

1. Retain the qualified base native evidence from NATIVE.md unchanged.
2. Stage a separate runtime using the same current-client Python DLLs and
   matching `iconIDsLoader.pyd`, plus manifest-verified `iconids.fsdbinary`.
   Retain copied manifests and inputs.json (pinned
   `8c70511cc992f2fe73b1e00d3b8d962d8d2cb2bf88011d79384ada134a3251a1`).
   Run this directory's `decode_icons.py` through the reviewed private Wine/FEX
   runner. Keep `last-run.json`, input/result hashes and native logs. This is
   profile/process separation, not a security sandbox. Do not alter live cache.
3. Run (Python + Pillow):

   ```sh
   python3 datamine/cycle7/export_icons.py \
     --evidence-root /path/to/qualified/native-evidence \
     --icon-evidence /path/to/qualified/icon-evidence \
     --cache '/path/to/EVE Frontier/ResFiles' \
     --snapshot cradleos-dapp/public/data/game-data-cycle7-3573151/native-v1.json \
     --output cradleos-dapp/public/data/icons-cycle7-3573151
   python3 -m unittest discover -s datamine/cycle7 -p 'test_*.py'
   ```

Exporter checks matching build/manifests, tables/readers, run cleanup/log hashes,
decoded payload, original size/MD5, PNG decode/dimensions, cache confinement,
and SHA256-addressed output. No raw loaders, binary tables or local paths ship.
Output: manifest.json, provenance.json, assets/, NOTICE, README, and a ZIP.
Files preserve original dimensions/transparency. Changed builds require explicit
requalification; never disable input pins to make newer schemas pass.

## Application use

`ItemIcon typeId={88335}` resolves from a coalesced lazy manifest request.
`ClientUIIcon name="gameplay/manufacturing_32px"` uses a named symbol.
`GameIcon asset={entry.asset}` renders a verified local file. The shared helper
respects Vite BASE_URL. Icons are decorative next to visible text; fixed sizes
avoid layout shift. Image failure resets when the source changes. Failed manifest
loads can be retried from Game Data -> ICONS; a later mount retries after 30s.

The gallery searches type IDs/names and resource names and provides the complete
download. Recipes, Game Data and Inventory use the component; no financial,
transaction, fitting or recipe calculation logic changes.

Game artwork remains CCP's, not MIT-licensed project art. See the pack's NOTICE.
