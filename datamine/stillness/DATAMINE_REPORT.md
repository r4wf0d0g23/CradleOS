# EVE Frontier Cycle 5 (Stillness 0.5.1) Datamine Report
## Extracted: 2026-03-11

---

## Complete Assembly Rename Table (Cycle 5)

All typeIDs confirmed from `localization_fsd_en-us.pickle`. Entries 1032744-1032766 appear to be the new canonical Cycle 5 display aliases.

| New Name | typeID (primary) | typeID (alt) | Notes |
|---|---|---|---|
| Mini Gate | 1011240 | 1032755 | was Small Gate |
| Heavy Gate | 726403 | 1032756 | was Smart Gate |
| Mini Printer | 896454 | 1032744 | was Printer S |
| Printer | — | 1032745 | |
| Heavy Printer | 896455 | 1032746 | |
| Refinery | — | 1032747 | |
| Heavy Refinery | — | 1032748 | |
| Mini Berth | 1011188 | 1032749 | was Shipyard S |
| Berth | — | 1032750 | |
| Heavy Berth | 1011192 | 1032751 | |
| Assembler | — | 1032752 | |
| Shelter | 1011261 | 1032753 | |
| Heavy Shelter | 1032754 | — | |
| Mini Storage | — | 1032757 | |
| Storage | — | 1032758 | |
| Heavy Storage | — | 1032759 | |
| Relay | — | 1032761 | |
| Monolith 1 | 1011272 | 1032762 | |
| Monolith 2 | 1011274 | 1032763 | |
| Wall 1 | — | 1032764 | |
| Wall 2 | — | 1032765 | |

---

## New Cycle 5 Assemblies

| Name | typeID | Description |
|---|---|---|
| Nursery | 1034924 / 1035670 | "A facility for growing synthetic Shells." |
| Nest | 1034363 / 1035672 | "A facility for storing Shells and transferring between them." |
| Mini Turret | 1035947 / 1035955 | "A small base defence turret. Especially effective against smaller targets." |
| Turret | 1036365 / 1036375 | "A medium base defence turret." |
| Heavy Turret | 1036371 / 1036377 | "A large base defence turret. Especially effective against larger ships." |
| Turret - Autocannon | 1036367 | New variant |
| Turret - Plasma | 1036369 | New variant |
| Turret - Howitzer | 1037106 | New variant |
| Crown | 1036566 / 1036568 / 1036616 | Memory implant: "Crowns are woven from memories allowing a Shell to carry experiences from its ancestors." |

---

## Game Rules (from localization)

| Rule | typeID | Text |
|---|---|---|
| Gate limit near Network Node | 1035470 | "Only 1 Gate is allowed within range of this Network Node" |
| Smart Assembly limit | 727635 | "Only {limit} {typeName}s allowed within range of this Smart Assembly" |
| Shell awakening | 1035381 | "Shells can only be awaken in Nest assemblies" |
| Gate activation limit | — | Unlimited gates now (from patch notes) |

---

## CradleOS Impact

1. **gate_control module**: Reference Heavy Gate as typeID `726403`. Gate limit rule means one gate per Network Node — corp gate policies must account for this.
2. **contributions module**: Construction Site (typeID 1032209) is new Cycle 5 content — collaborative base building. Our contribution tracking is directly relevant.
3. **Shell/Nursery system**: New Cycle 5 mechanic — out of scope for CradleOS MVP but interesting future extension (corp-managed shell facilities).
4. **Turret management**: New variety of turrets (mini/medium/heavy/autocannon/plasma/howitzer) — gate defenders. Could extend gate_control to include turret allowlists.

---

## Event Types (from eventtypes.static)

Key gate-related:
- eventType 1: `Activate Gate`
- eventType 2135: `Deactivate Gate`
- eventType 63: `Open Abyss Gate`
- eventType 2143: `OpenVoidSpaceExit`

No JumpEvent in this file — JumpEvent is a Sui on-chain event, not a client-side event type.

---

## Files Decoded

- `localization_fsd_en-us.pickle` (22MB) — 625+ new Cycle 5 string IDs
- `eventtypes.static` (3.2KB) — 63 event types
- `wrecks.static` (15KB) — 294 wreck type mappings
- `resfileindex.txt` (47k lines) — full file manifest

## Files Not Present This Patch

- `items.static` — embedded in `_pyfsd.pyd` binary (not extractable via sftp)
- `blueprints.static` — embedded in `industry_blueprintsLoader.pyd`

---
*Datamined by Reality Anchor — 2026-03-11*
