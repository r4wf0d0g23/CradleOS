# EVE Frontier Cycle 6 — Sanctuary Datamine Report

**Extracted:** 2026-06-24 (pre-wipe, build live on raw-gtr at 22:44 CT)
**Source build:** `v2026.05` / build 3388875 / branch `//frontier/v2026.05`
**Carbon stack (from `carbon.json`):** carbon_components 0.5.0, carbon_audio 5.3.5, carbon_destiny (frontier-destiny) 2.2.2, carbon_fsd 2.0.1, carbon_trinity 3.8.0, carbon_imagetools 2.0.1, carbon_videoplayer 2.0.0, carbon_webbrowser 1.3.2.

> Note: file headers in extracted assets still carry `© CCP Games` strings. Per Fenris rebrand, treat as Fenris-owned and use Fenris in all derived writing.

---

## Format Migration: `.static` → `.fsdbinary`

Sanctuary migrates the universe data layer from the legacy `*.static` FSD format (decoded by `frontier/fsd_decoder.py`) to **`*.fsdbinary`** (Carbon `carbon_fsd v2.0.1`). The full list of new-or-migrated `.fsdbinary` files in `staticdata/`:

| File | Notes |
|---|---|
| `constellations.fsdbinary` | new — universe topology |
| `regions.fsdbinary` | new |
| `solarsystems.fsdbinary` (8.6 MB) | new — single source of truth for system data |
| `stargates.fsdbinary` | new — connections layer |
| `moons.fsdbinary` (43 MB) | new — celestial bodies |
| `planets.fsdbinary` (37 MB) | new — celestial bodies |
| `npcstations.fsdbinary` | new — NPC station roster |
| `landscape.fsdbinary` (17 MB) | new — planet surfaces / terrain |
| `ecosystem.fsdbinary` | new — biosphere/PvE layer (matches "Ecosystem 21/22 Entry Beacon" strings in localization) |
| `systemstate.fsdbinary` | new — pre-computed universe metadata |
| `universe_distances.fsdbinary` | new — distance LUT (3.8 MB) |
| `creation_hardpoint_types.fsdbinary` | new — for the Kitbash/creation system (see new types) |
| `creation_modules.fsdbinary` | new |
| `creation_parts.fsdbinary` | new |
| `creation_templates.fsdbinary` | new |

**Decoder work needed:** existing `fsd_decoder.py` (496 lines, written 2026-03-08, all .static edge cases resolved) handles the legacy text-schema-based FSD format. The `.fsdbinary` format from `carbon_fsd v2.0.1` is a different binary serialization — we already have a partial decoder for it at `frontier/data/fsdbinary_decoder.py` from Cycle 5 work on `requiredskillsfortypes.fsdbinary` + `industry_blueprints.fsdbinary`. Needs validation against the 15 new files. Carbon repos at `github.com/carbonengine` do not include `carbon-fsd` yet — watch for it.

---

## Build / Version

```ini
[main]
version = 20.04
build = 3388875
codename = v2026.05
branch = //frontier/v2026.05
appname = FRONTIER
edition = premium
server = Tranquility   # (legacy branding — still routes to Sanctuary world)
port = 26000
```

Launcher app: `1.12.6-c121-cfb1ca2` (replaces `1.12.2-c114-42e8d7b`).

---

## Resfileindex Diff Summary

| Category | Count |
|---|---|
| Added paths | 276 |
| Removed paths | 60 |
| Changed paths (content hash rotation) | 2,089 |
| **Total delta** | **2,425** |

**Where the change is concentrated:**
- `dx9/` — 2,023 changed shaders (engine version bump from `carbon_trinity` 3.8.0)
- `staticdata/` — 27 changed + 15 added (the high-signal data)
- `localizationfsd/` — 10 changed (all language pickles rotated)
- `characters/` — 30 added + 60 removed (model asset churn)
- `audio/` — 9 changed
- `graphics/` — 6 changed
- `ui/` — 8 added + 2 changed

Full per-category lists at `frontier/datamine/sanctuary/diff/{added,changed,removed}.json`.

---

## High-Value Sanctuary Strings (from `localization_fsd_en-us.pickle`, 251,884 entries — up from Cycle 5)

### "Sanctuary" — it's an in-world place
- `505881`: **Sanctuary**
- `130877`: "You're the mayor of **Pioneer's Sanctuary**, aren't you {agent.name}?"
- `128758`: "I work for the Sanctuary, one of the universe's foremost research institutions. We've recently managed to unearth what we believe could be …"

This recasts the cycle name: Sanctuary isn't a server label; it's a **lore organization / settlement type** newly introduced in the build.

### Ecosystem (NEW PvE content layer)
- `1036890`: **Ecosystem 21 Entry Dungeon**
- `1036891`: **Ecosystem 22 Entry Beacon**
- Plus 31 "**Landscape Pattern N**" / **Landscape Dungeon N** strings — templated/procedural dungeons keyed off the new `landscape.fsdbinary`.

### Refuge (NEW structure / personal base)
- `1015358`: "The **Refuge** serves as your field base. It stores your ships, and within its range, you can manage your **Shell** [Alt + C] and **Ascend**…"
- `1015536`: "Manufacture a ship capable of powering interstellar travel and deliver it to your Refuge."
- `1015538`: "Go to your Refuge to board and fit your newly manufactured ship to prepare for your first jump."
- `1031957`: "You must be near a Refuge or a Hangar to **Ascend**."

→ **Refuge is the new player home structure.** The current dApp structure roster needs a Refuge entry.

### Shell / Nest / Crown / Ascension (Cycle 5 system, deeply expanded)
- `1034901`: Aggressive Shell · `1034902`: Rugged Shell · `1034903`: Blank Shell · `1034926`: Ancient Shell · `1034928`: Synthetic Mining Shell
- `1034924`: **Nursery** ("A facility for growing synthetic Shells.") · `1034925`: same
- `1035381`: "Shells can only be awaken in **Nest** assemblies"
- `1037890`: **Memory Gained** · `1038317`: Crown Memories · `1036605`: "This is a collection of your memories from the Frontier. Weaving a Crown will allow you to equip the memories on a Shell."
- `1039318`: "You are about to **Ascend** with memories left on the Shell. These will be lost forever when completing Ascension! Are you ready?"
- `1037806`: "Are you sure you want to delete this memory?"

→ **Ascension is the new big-gameplay loop**: leave the current Shell, transfer Crown memories, awaken in another Shell at a Nest, lose what's left behind. The Crown ↔ Shell ↔ Nest ↔ Ascension cycle is the core mechanic Sanctuary ships with.

### Turrets — back, with hierarchy
- `1035947`/`1035955`: **Mini Turret** ("A small base defence turret. Especially effective against smaller targets.")
- `1036365`/`1036375`: **Turret** (medium) — `1036367`: Turret - Autocannon — `1036369`: Turret - Plasma
- `1036371`/`1036377`: **Heavy Turret** (large, "Especially effective against larger ships")
- `666278`: **Sub-Turret** · `666279`: **Primary Turret` — new turret subordination model

→ **Defense tab can be re-enabled** in CradleOS (one-line revert at `App.tsx:1229` + `~924`). Turret variant types (Autocannon, Plasma, etc.) are first-class typeIDs now.

### Kitbash (NEW ship/module construction system)
- Block `1037952-1037967+`: **Kitbash Frame Antenna** (16+ entries) — implies a parts-assembly fitting system
- This pairs with the four new `creation_*.fsdbinary` files (hardpoint_types, modules, parts, templates) — **the "creation" word in the staticdata file names refers to ship/module construction, not character creation.**

### Pre-existing Cycle 5 structure typeIDs (verified unchanged at 1032744–1032766)
| typeID | Name | Status |
|---|---|---|
| 1032744 | Mini Printer | unchanged |
| 1032745 | Printer | unchanged |
| 1032746 | Heavy Printer | unchanged |
| 1032747 | Refinery | unchanged |
| 1032748 | Heavy Refinery | unchanged |
| 1032749 | Mini Berth | unchanged |
| 1032750 | Berth | unchanged |
| 1032751 | Heavy Berth | unchanged |
| 1032752 | Assembler | unchanged |
| 1032753 | Shelter | unchanged |
| 1032754 | Heavy Shelter | unchanged |
| 1032755 | Mini Gate | unchanged |
| 1032756 | Heavy Gate | unchanged |
| 1032757 | Mini Storage | unchanged |
| 1032758 | Storage | unchanged |
| 1032759 | Heavy Storage | unchanged |
| 1032761 | Relay | unchanged |
| 1032762 | Monolith 1 | unchanged |
| 1032763 | Monolith 2 | unchanged |
| 1032764 | Wall 1 | unchanged |
| 1032765 | Wall 2 | unchanged |
| 1032766 | **RAINMAKER I** | **new this cycle** |
| 1032767 | **RAINMAKER II** | **new this cycle** |
| 1032768 | **HARBINGER I** | **new this cycle** |
| 1032769 | **HARBINGER II** | **new this cycle** |

RAINMAKER and HARBINGER are new tiered structures — name suggests weapons / heavy-defense roles. Confirm category once `types.fsdbinary` is decoded.

---

## CradleOS Action Items

### High priority (do tomorrow morning before 14:00 UTC)
1. **Decode the 15 new `.fsdbinary` files** using `fsdbinary_decoder.py` (validate it still works on Carbon FSD 2.0.1 format).
2. **Update CradleOS `tenantConfig.ts`** with the new Stillness world-pkg id after Fenris publishes (watch `evefrontier` GitHub or check on-chain at 14:00 UTC).
3. **Update DGX2 `~/character-index/indexer.js TENANTS.stillness.active`** with the new pkg + re-run backfill.

### Add to CradleOS structure roster
- **Refuge** — new player home structure, primary base for Shell/Ascend operations.
- **Nursery** — Shell growth facility.
- **RAINMAKER I/II, HARBINGER I/II** — new structure tiers (typeIDs 1032766–1032769).
- Re-enable Turret/Heavy Turret/Mini Turret + Autocannon/Plasma variants (see Defense tab revert path).

### New panel candidates
- **Ascension Panel** — manage Shell, Crown memories, Ascend/Awaken flow. Reads on-chain Shell objects (already exists in Cycle 5 schema), Nest position, Refuge proximity.
- **Ecosystem Panel** — list discovered Ecosystem dungeons + Entry Beacons (consume `ecosystem.fsdbinary` once decoded).
- **Kitbash Fitting tab** — once `creation_*.fsdbinary` is decoded, expose the parts/templates/modules so players can plan kitbashed loadouts in CradleOS.

### Unblocks
- **TribeVault tokenomics** — `industry_blueprints.fsdbinary` rotated; pull blueprint costs once decoded for the long-standing tokenomics anchor.
- **Defense tab** — turrets confirmed back; revert the 2026-06-24 nav hide commit.

### Carbon × Sanctuary pairings ready to execute
- `solarsystems.fsdbinary` + carbonengine/pathfinder TS port → native MapPanel routing.
- `dogmaattributes.fsdbinary` + carbonengine/parser TS port → exact ship attribute math in Fitting panel.
- `localization_fsd_en-us.pickle` + carbonengine/localization TS port → byte-accurate EVE markup rendering throughout CradleOS.
- All static IDs + carbonengine/core (`CcpHashFNV1`, `CcpTime`) → byte-accurate cross-reference between static data and on-chain events.

---

## Raw Files

All raw extracts are in `frontier/datamine/sanctuary/raw/` (44 files, 186 MB):
- 15 new `.fsdbinary` (creation_*, ecosystem, landscape, moons, planets, npcstations, regions, solarsystems, stargates, systemstate, universe_distances, constellations)
- 27 changed staticdata
- 2 localization pickles (en-us, main)

Metadata in `frontier/datamine/sanctuary/`:
- `resfileindex.txt` (8 MB — full file index)
- `manifest.dat` (19 KB — binary)
- `carbon.json`, `start.ini` (build identifiers)
- `launcher_index_stillness.txt` (33 KB)
- `diff/{added,changed,removed}.json` (per-category diff)
- `priority_paths.txt` (the 44-path priority list used)
