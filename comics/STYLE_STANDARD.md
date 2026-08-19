# Echoes of Stillness — Visual Style Standard v1.2

**Status:** ACTIVE. Raw approved the look 2026-08-19 (one hard correction —
Rule 6: Shells are unsuited), settled **flat over layered**, and greenlit theme
art. First four theme plates are live in production.

**The six rules:** 1 warm monochrome · 2 dusty hostile space · 3 monumental
backlit silhouette · 4 brutalist modular · 5 epic scale + degraded texture ·
**6 Shells are unsuited humanoid forms**.

**Derivation:** Every rule below is reverse-engineered from **canonical EVE
Frontier / Fenris Creations key art already on disk in this repo**, plus the
official CCP/Fenris design-system tokens received 2026-04-25. Nothing here is
invented art direction. Sources are cited per rule.

## Reference corpus (canonical, verified on disk)

| Asset | Role in the standard |
|---|---|
| `public/lineagewar-corridor.jpg` | Suspended-bodies / mass-death language. **Direct match for Ch3 "halls lined with motionless figures."** |
| `public/banner-citadel.png` | Megastructure + debris field + brutalist greeble. Primary reference for **The Cradle**. |
| `public/banner-battle.png` | Monumental backlit silhouette, swarm-as-scale-cue. |
| `public/banner-nebula.png` | Rift / plasma / stellar-wound atmosphere. Primary reference for **the young Crude Rift**. |
| `public/bg-orbital.png` | Degraded sensor/HUD overlay language. Reference for **log-fragment and terminal framing**. |
| `src/styles/ccp-tokens.css` | Official palette + type tokens (Martian Red `#FF2800`, Neutral `#FAFAE5`, Crude `#050505`). |

## The five rules (franchise-defining, consistent across all reference)

### 1. Warm monochrome restraint — burnt orange, umber, black
Cool colors are **essentially absent** from the franchise palette. Do not
introduce teal/cyan sci-fi contrast.

| Band | Range |
|---|---|
| Base shadow | `#100604` → `#2A0C04` |
| Midtone | `#4A1605` → `#7A2A07` |
| Main glow | `#C34E0A` → `#F07A12` |
| Peak emissive | `#FFD37A` → `#FFF0C0` |

Official token anchors: **Martian Red `#FF2800`** (accent/danger), **Crude
`#050505`** (background), **Neutral `#FAFAE5`** (foreground/text).
Note the franchise accent is `#FF2800`, *not* the `#FF4700` orange that drifted
into legacy `main.css`.

### 2. Space is dusty, volumetric, hostile — never clean vacuum
Every reference behaves as if shot through smoke, plasma, or nebular dust.
Clean black starfields are **wrong**. Add orange-brown haze layers, backlit
particulate, and let distant forms get swallowed by atmosphere.

### 3. Monumental silhouette + hot backlight
The signature read is a large near-black mass against orange glow. Mass,
outline and scale beat surface detail. Key light goes **behind or inside** the
subject; preserve only limited amber rim/seam detail. Bloom the emissive cores.
Contrast in reference measures **8:1 to 15:1+** on major silhouettes.

### 4. Brutalist, industrial, modular megastructure — not sleek aerospace
Slab forms, thick beams, lattice rings, layered armor plate, docking spines,
trusses, antennae. Functional greeble. **Avoid** glossy metals, luxury curves,
hero-ship polish, clean neon.

### 5. Epic scale + degraded sensor/film texture
Wide compositions. Tiny scale references (ship swarms, orbital curves, grid
ticks, stars). Film grain, smoky gradients, sensor speckle, faint display
artifacts. **Avoid pristine digital cleanliness.**

### 6. Shells are unsuited humanoid forms — never spacesuited crew
**Added v1.1 (2026-08-19) on Raw's direction. This is a hard rule.**

The suspended figures in the Cradle are **Shells** — grown bodies, not dead
crew. Rendering them in spacesuits reads as "disaster victims" and destroys the
meaning of the scene: these were *manufactured*, not killed.

**"Shell" is CANON, not authored.** Verified in the extracted Sanctuary client
data — `public/data/game-data-catalogue.json` ships a dedicated
`shells_and_nursery` group:

| typeID | Name |
|---|---|
| 1034901 | Aggressive Shell |
| 1034902 | Rugged Shell |
| 1034903 | **Blank Shell** |
| 1034926 | Ancient Shell |
| 1034928 | Synthetic Mining Shell |
| 1034924 | Nursery |
| 1036920 | Deployable Nursery Medium |

Canon `Nursery` description (client string, verbatim): *"A nursery pod where a
rogue drone will be assembled in a process that bears an eerie resemblance to
growth."* — assembly-as-growth is already the game's own language. The Cradle
sits directly on top of established lore.

**Depiction rules:**
- **Bare humanoid form.** Smooth, sculptural, anatomically simplified. Read the
  body through silhouette and rim light, not surface texture.
- **No helmets, no visors, no EVA hardware, no life-support rigs, no backpacks,
  no ribbed suit joints, no boots or gloves.** A helmet silhouette is an instant
  reject.
- **Featureless or near-featureless heads.** No individuality — these are
  blanks. Faces stay unrendered/obscured; anonymity is the point.
- **Unfinished, not wounded.** No gore, no decay, no injury. If they read as
  anything, they read as *incomplete*.
- **Skin like matte material**, not cloth or plate — faint waxy/synthetic sheen
  under rim light is correct.
- Suspended limp in zero-g: slack limbs, no bracing, no intent.

**Why it matters narratively:** "The place where Crude Matter isn't just
harvested — it's grown." A suited corpse is a victim of the Cradle. An unsuited
Shell is a *product* of it. The horror is manufacture, not death.

## Shadow / highlight discipline

- Shadows crush to near-black at frame edges; blacks are **veiled warm brown**,
  not pure digital black.
- Detail survives in the *central* haze volume, collapses at the periphery.
- Highlights bloom **atmospherically**, not as optical lens flare. Restrained
  artifacts only — no anamorphic streak spam.

## Series-specific bindings (Echoes of Stillness)

| Story element | Visual treatment | Canon status |
|---|---|---|
| Young Crude Rift | `banner-nebula` language — stellar wound, self-emissive core, turbulent gas bands, no hard key | Crude Matter **canon** |
| Crude Matter lattice | Iridescent veins are the ONE sanctioned cool-ish note (per Raw's "iridescent blue veins"); keep low-saturation, subordinate to the orange field | Authored detail |
| The Cradle station | `banner-citadel` brutalist megastructure + non-Euclidean shifting geometry | **Authored** (also the CradleOS namesake) |
| Suspended figures = **Shells** | `lineagewar-corridor` directly — anonymous mass bodies, rim-lit, zero-g tumble. **NO SPACESUITS** — see Rule 6 | **Shell is CANON** (see below) |
| Keepers / spider-limbed watchers | Silhouette-first, bone-and-steel, smiles implied not rendered | Keeper **canon** |
| Terminal / log fragments | `bg-orbital` degraded-HUD language, Disket Mono, low-power amber | — |

## Aspect + delivery spec

- **Panel/page:** 3:4 or 2:3 portrait for the page reader; **21:9 for
  establishing splashes** (matches the franchise's panoramic key art).
- **Format:** `.webp`, width 1400–2000px, target <500 KB/page.
- **Naming:** `page-01.webp` zero-padded, under
  `public/comics/echoes-of-stillness/ch<N>/`.
- Drop art in and run `node scripts/refresh-comics.mjs` — chapters auto-switch
  from script to the image reader.

## Reusable generation prompt skeleton

> `<subject/action>`, EVE Frontier style, burnt orange and umber monochrome
> palette, near-black brutalist silhouette against hot amber backlight,
> heavy volumetric nebular dust and backlit particulate, modular industrial
> megastructure greeble — slab forms, trusses, docking spines, no sleek
> aerospace, atmospheric bloom not lens flare, crushed warm-brown blacks,
> film grain and sensor speckle, ultra-wide cinematic composition, tiny
> ship silhouettes for scale, ominous and monumental, no clean neon,
> no cyan, no teal

## Negative list (hard rejects)

Cyan/teal accents · clean black vacuum starfield · glossy hero ships · neon
holographic UI · pristine digital render · optical lens-flare spam · bright
even frontal lighting · cartoon/anime rendering · visible watermark or
signature · **color-emoji glyphs anywhere in the reader UI** (webview renders
them as empty boxes — TOOLS.md) · **spacesuits / helmets / visors / EVA rigs on
Shells** (Rule 6 — they are grown, not crew) · gore or visible injury on Shells.

## SETTLED: flat, not layered (Raw, 2026-08-19 — do not re-litigate)

Tested rather than argued. Same scene generated two ways: one flat image vs
three keyed plates composited (background haze / station / foreground), plus a
haze-over-subject and unified-grain pass to give layering its best shot.

**Flat won. Raw: "flat looks better", "it's a go for flat art".**

Why layering failed on OUR look specifically:

| | Flat | Layered |
|---|---|---|
| Atmosphere | dust penetrates the structure — **embedded** | **pasted on top** |
| Edges | none | dark fringe, too-clean spire tips |
| Lighting | rim bloom on edges facing the glow | **no rim light — physically wrong** |

The decisive defect is rim light. Rule 3 requires hot backlight raking a
near-black silhouette; a cut-out subject cannot receive edge bloom from a
background it was never lit by. It reads wrong even to a non-expert.

**Animation is not foreclosed — it is just a separate production.** If an
animated series ever happens it gets built layered from scratch, NOT retrofitted
from comic pages. Do not compromise page quality today to hedge that maybe.

### Generation constraints discovered (2026-08-19)

Two *independent* walls, both hit while testing:

1. Requesting `background: transparent` silently re-routes to `gpt-image-1.5`,
   which this project has **no access to** → HTTP 403.
2. That model also only accepts `1024x1024 / 1024x1536 / 1536x1024`, so
   `2048x1152` → HTTP 400.

**Working method for any cutout asset:** generate on a pure-white matte with
`gpt-image-2`, then key to alpha. Measured separation was clean (corners
254,254,255 vs body 2,2,1). Diagnose these two failures separately — fixing
only the model does not fix the size.

## Theme plates — art is keyed to MOTIF, not to chapter

Raw, 2026-08-19: *"we can art for theme not just for chapter titles"*. This is
the better architecture, because motifs **recur**: the Rift opens Part I, the
Cradle appears in both Part II and Part III, the Shells appear in II and III.

Art therefore lives in a **theme registry** (`series.themes` in `comics.json`)
and blocks reference it by key:

```jsonc
"themes": {
  "cradle": { "title": "The Cradle",
              "image": "comics/echoes-of-stillness/themes/cradle.webp",
              "alt": "..." }
},
"script": [ { "heading": "The Rift's Cradle", "body": "...", "theme": "cradle" } ]
```

Consequences — all of them good:

- **Consistency by construction.** The Cradle looks like the Cradle every time.
- **Author once, reuse anywhere.** One plate serves any number of blocks.
- **One re-render updates every appearance.** Replace `cradle.webp` and all
  chapters update together.
- **Fails soft.** A missing registry entry or broken file renders nothing; the
  chapter stays readable as prose. Never an alt-text box.

### Plate delivery spec

- `.webp`, longest edge ~1600px, **target <200 KB** (current set: 32–129 KB).
- Live under `public/comics/<seriesId>/themes/<key>.webp`.
- Manifest paths are relative with no leading slash — `BASE_URL` is prefixed at
  render time, so the same manifest works on `cradleos.io/` and `/CradleOS/`.
- Theme plates are **independent of** the per-page `pages[]` image reader. A
  chapter can carry theme art while still being a script chapter.

## Forward note — animation viability (Raw, 2026-08-19)

Raw raised a possible animated series later. Recording it now because it
**changes nothing about this standard — it validates it**: silhouette-first,
backlit, haze-heavy compositions with low surface-detail dependence are
cheap to animate and hide inconsistency well. Limited-animation techniques
(parallax haze layers, drifting particulate, slow rim-light shifts, held
silhouettes) suit this look natively.

If animation becomes real, the assets to build first are **layered** rather than
flat: separate background haze / midground structure / foreground silhouette
plates. Flat single-layer stills cannot be parallaxed later. No action now —
flagged so we don't paint ourselves into flat-only assets.

## Change log

| Date | Change |
|---|---|
| 2026-08-19 | v1.0 drafted from 5 canonical Fenris assets + official CCP tokens. Awaiting Raw approval. |
| 2026-08-19 | **v1.2** — Raw: *"flat looks better"*, *"it's a go for flat art"*, *"we can art for theme not just for chapter titles"*. Recorded the flat-vs-layered A/B verdict as SETTLED (rim-light defect is the decisive reason) so it is not re-litigated. Documented the two independent image-gen walls (transparent→gpt-image-1.5 403; that model's size allowlist→400) and the white-matte keying workaround. Added the theme-plate architecture: art keyed to recurring MOTIF via `series.themes`, not to chapter. Status DRAFT→ACTIVE. |
| 2026-08-19 | **v1.1** — Raw art-direction correction. Added **Rule 6: Shells are unsuited humanoid forms**, after the first hall sample rendered them in spacesuits. Verified `shells_and_nursery` (7 typeIDs incl. **Blank Shell**) + canon Nursery "assembled… eerie resemblance to growth" string — confirming **Shell is canon, not authored**. Added spacesuit/gore hard rejects. Recorded animated-series consideration + layered-asset implication. |
