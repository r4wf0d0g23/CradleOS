# Echoes of Stillness — Canon Ledger & Open Threads

Two jobs:

1. **Canon ledger** — which proper nouns are real EVE Frontier / Fenris lore vs
   Raw's invention. Verified by whole-word regex against the extracted client
   strings (`public/data/game-data-strings-index.json`) and the solar-system
   catalog (`public/data/solarsystems-stillness.json`). Substring matching is
   NOT acceptable evidence — see the VANCE/ADVANCE incident below.
2. **Open authorial threads** — deliberate unresolved elements. **Do not "fix"
   anything in this section.**

---

## ⚠ DO NOT CORRECT — deliberate unresolved elements

### `Alord of Stillness` (Part II, Ch2 → "Designation" block)

The archive authority string reads:

```
Authority: Fabricators' Keep Archive 0x416C6F7264206F66205374696C6C6E657373
```

That hex is valid ASCII and decodes to **`Alord of Stillness`** — "Alord" as one
word, no space.

**Status: INTENTIONALLY UNRESOLVED (Raw, 2026-08-19 14:30 CDT).** Raw's
direction, verbatim: *"Let's leave 'alord' for now and figure out why later.
We'll make it interesting."*

**This is a live plot hook, not a typo.** Any future session, subagent, spell
check, lint pass, or "cleanup" that silently normalises this to `A lord` /
`Warlord` / `Lord` is **destroying story material**. Do not touch the hex, and
do not touch the decoded string.

If Raw later decides to resolve it, the pre-computed alternatives are:

| Intended reading | Hex |
|---|---|
| `A lord of Stillness` | `41206C6F7264206F66205374696C6C6E657373` |
| `Warlord of Stillness` | `5761726C6F7264206F66205374696C6C6E657373` |
| `Lord of Stillness` | `4C6F7264206F66205374696C6C6E657373` |

Directions it could be made interesting (unprompted options, Raw decides):
- A corrupted archive record — the Keep's index is degrading, and "Alord" is
  what survived. Fits the established decay language.
- A **name**, not a title. "Alord" is simply who/what the authority is.
- A merge artifact — two records ("A" + "lord") collapsed by the Weave, which
  is thematically consistent with minds being merged into archives.
- Deliberate obfuscation by whoever sealed the Keep.

---

## Canon ledger

### CONFIRMED CANON (verified in live game data)

| Term | Evidence |
|---|---|
| **Crude Matter** | client strings |
| **Stillness** | client strings, incl. `Stillness Keep Database Fragment` |
| **Keeper** | 18 whole-word hits |
| **Fabricator** | 10 hits (`Fabricator Tech`) — grounds "The First Fabricator" |
| **Shell** | `shells_and_nursery` catalogue group, 7 typeIDs: Aggressive / Rugged / **Blank** / Ancient / Synthetic Mining Shell, Nursery, Deployable Nursery Medium |
| **Nursery** | canon description: *"a process that bears an eerie resemblance to growth"* |
| **Feral** | 76 hits (`Feral Data Buyer`). Singular only — see below |
| **Armature** | 2 hits, exact |
| **Archive / Archives** | 25 / 4 hits — grounds Raw reframing graves as "Archives" |
| **Refuge** | 8 hits |
| **Foundry** | 6 hits (`Ducia Foundry`) — makes *Foundry Grace* plausible |
| **Eschaton** | REAL system, id `30019854`, exact name match |
| **"frontier standard"** | 1 hit (alloy) — gives *Frontier Standard Time* footing |

### AUTHORED (no game-data match — Raw's invention)

| Term | Note |
|---|---|
| **The Cradle** | 0 hits. Also the **CradleOS namesake** — the fiction names the dApp it is published inside |
| **the Weave** (network) | `Weave` exists ONLY inside the module `Nanitic Armor Weave Sequencer`. The cognitive-network meaning is authored |
| **Ferals** (plural) | 0 hits; only singular `Feral` is attested |
| **Starsong** | 0 hits |
| **H-SN21 I** | no catalog match. Load-bearing across all three parts, used consistently — authored but stable |
| **Kira Vance** | 0 hits |
| **Elias Thorne**, **Mara Soren** | 0 hits |
| **Solstice Whisper**, **Argent Seeker**, **Peregrine**, **Morrow's End**, **Foundry Grace** | authored ship names |
| Key lines | "THE THREAD HAS BEEN DRAWN", "You are too loud", "THE CYCLE IS CULLED" |

---

## Method note — substring matching is not evidence

**2026-08-19:** A substring scan reported `VANCE` as present in client strings.
Whole-word regex returned **zero** hits — the "match" was inside **ADVANCE**.

Any future canon check must use word-boundary matching (`\bTERM\b`) before
claiming a term is canon. Reporting authored material as canon (or vice versa)
corrupts the ledger, and the ledger is what future sessions trust.

---

## Structural note — Part ↔ chapter mapping

Parts map 1:1 to chapters. This was briefly violated: the "Cradle" prose was
mislabeled Part III when it is a direct continuation of Part II (Part II ends
describing the station; the Cradle text opens with Vance ordering a visual on
that same station). Merged into Ch2, seam headed "Designation", 2026-08-19.

| Chapter | Part | Title |
|---|---|---|
| 1 | — | The Young Rift |
| 2 | Part II | The Returned Vessel *(incl. the Cradle sequence)* |
| 3 | Part III | The First Fabricator |

**Series status: `ongoing`** — Raw, 2026-08-19: *"Not complete, this will be
ongoing as I muse."* Do not flip to `complete`.

## Change log

| Date | Change |
|---|---|
| 2026-08-19 | Created. Consolidated canon findings that previously lived only in commit messages + handoff receipts (fragile). Recorded `Alord` as intentionally unresolved per Raw. |
