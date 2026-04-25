# RAG Ship Corpus Audit — 2026-04-25

## Why This Existed

Phase 1 fixed the cite UX (relevance gate, dedup, click-to-maximize, labels).
But the underlying data was bad:
- **11 of 14 ships** had wrong class fields (LORHA labeled "Hauler" but actually
  FRIGATE; MAUL labeled "Battlecruiser" but actually CRUISER; etc.)
- Cite images were full 473×1009 UI panel screenshots; the actual ship art
  occupied <2% of the image area.
- Stats came from scraped/guessed data, not the in-game UI.

## Method

1. Pulled all 14 ship images from DGX1 (`/home/rawdata/rag/images/*.png`)
2. Vision-modeled each panel via `claude-sonnet-4-6` in 4-image batches to
   extract authoritative ground truth from the in-game UI panels (title bar,
   class field, all 13 stats).
3. Cropped ship art out of each panel:
   - Standard 473×1009 layout: crop (5, 45, 138, 158) → 133×113 card
   - CHUMAQ unique 517×654 layout: crop (8, 55, 130, 155) → 122×100 card
4. Built corrected RAG entries from ground truth (`build_corrected_corpus.py`):
   dense text with class + all 13 stats + visual signature, woven for Keeper voice.
5. Re-embedded with nemotron-embed-1b-v2 (2048 dim) and upserted into
   `eve_frontier_types` chroma collection on DGX1.
6. Patched metadata.image_path to canonical `images/<name>.png` paths.
7. Backed up original images to `/home/rawdata/rag/images.bak.2026-04-25-1843`.
8. Replaced `images/<name>.png` with cropped cards (proxy serves these now).

## Class Mismatches Found (11 of 14 wrong)

| Ship    | Was (RAG)                | Now (ground truth)    |
|---------|--------------------------|-----------------------|
| CAROM   | Frigate, light variant   | CORVETTE              |
| HAF     | Heavy Assault Frigate    | FRIGATE               |
| LORHA   | Hauler                   | FRIGATE               |
| MAUL    | Battlecruiser            | CRUISER               |
| MCF     | Cruiser                  | FRIGATE               |
| RECURVE | Destroyer                | CORVETTE              |
| REFLEX  | Frigate, fast-response   | CORVETTE              |
| REIVER  | Destroyer, combat var.   | CORVETTE              |
| STRIDE  | Cruiser                  | CORVETTE              |
| USV     | Shuttle                  | FRIGATE               |
| CHUMAQ  | Battlecruiser            | COMBAT BATTLECRUISER  |

Already correct: LAI, TADES, WEND.

## Files

- `ground_truth.json` — full vision-extracted stats (14 ships, 13 stats each)
- `corrected_ships.jsonl` — corpus rows ready for upsert (id/text/metadata)
- `crops/*.png` — cropped ship-card thumbnails (133×113 px, ~15-22 KB each)
- `crop_all_ships.py` — crop script (re-runnable)
- `build_corrected_corpus.py` — corpus builder (re-runnable)
- `reindex_ships.py` — chroma upsert script (run on DGX1)
- `fix_metadata_paths.py` — metadata path patcher (run on DGX1)

## DGX1 State After Audit

- `/home/rawdata/rag/images/*.png` — REPLACED with 133×113 cropped cards
- `/home/rawdata/rag/images.bak.2026-04-25-1843/` — original UI panels backed up
- `/home/rawdata/rag/corpus_v2/corrected_ships.jsonl` — corpus master (14 rows)
- `/home/rawdata/rag/reindex_ships.py` + `fix_metadata_paths.py` — re-runnable
- chroma collection `eve_frontier_types` — 14 ship rows updated; 27,829 other
  rows untouched

## To Add New Ships Later

1. Add the new ship's UI panel screenshot to `tmp/rag-image-audit/<name>.png`
2. Add it to `SHIPS` list in `crop_all_ships.py`
3. Vision-extract its stats; add to `ground_truth.json` under `ships`
4. Add tactical note to `TACTICAL_NOTES` in `build_corrected_corpus.py`
5. Run `crop_all_ships.py` then `build_corrected_corpus.py`
6. Ship the new card + corrected_ships.jsonl to DGX1
7. Run `reindex_ships.py` to upsert
8. Run `fix_metadata_paths.py` to patch paths

## Out of Scope (deferred)

- Audit of other entity types (structures, modules, blueprints) — they don't
  currently have reference images in the RAG, so cites won't show for them.
  When images are added, repeat this audit method.
- 3D model comparison — the in-game UI panel screenshots are CCP's authoritative
  rendering of each ship, so they ARE ground truth. Going one layer deeper to
  .blueprint files is unnecessary unless we suspect specific screenshots are
  themselves wrong (no evidence).
