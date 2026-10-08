# Slot identities — independent design review

**Design gate: PASS to implement; visual release gate remains pending.** The eight briefs offer a viable response to the user's objection, provided actual stage composition changes—not just names, palettes, symbol arrays, and surrounding lore—survive the 320px layout. This report does not approve unseen implementation or artwork. Native inherited reviewer; no Opus claim. Runtime read-only.

Reviewed `deploy/casino-slot-identities-20261008/PLAN.md`, current `CasinoSlotFleet.tsx`, frozen engine/symbol integration, and `native-symbol-inventory.jpg`.

## Required distinction

The existing renderer has one repeated five-column rectangular cabinet, one common symbol family, one common stop/reveal beat, and common progress/detail placement. Eight CSS accents around that composition will repeat the rejected result.

Shared economic/action controls are useful. Share coordinate mapping and settlement presentation internally, but let the stage's environment, silhouette, spatial organization and feature animation be visibly different. Titles-hidden contact sheets should include both full stage and stage-only crops at 320/390/1440. Also inspect grayscale: recognizing only the red versus blue version is insufficient. Judge real idle and feature states, not eight cherry-picked hero/lobby cards. Distinction may be subtler between two mechanically similar line games, but every pair needs a visible cue beyond different art assets in the same cells.

### Per-stage outcome constraints

- **Scrapyard:** tactile sorting drums/gantry, not the generic sci-fi cabinet with an amber border. Salvage passes must equal actual free spins. Mechanical stops must not add apparent near-misses or change symbols after the recorded stop.
- **Wreckway:** freighter cross-section and cargo bays should dominate the silhouette. Bays retain left-to-right reel semantics; show 243 combinations as a rules property, not a count of currently winning routes. Distinguish this from Scrapyard's mechanical drums.
- **Reactor:** containment/cooling architecture and cascade movement should dominate. A reactor meter may represent the actual chain stage/multiplier, not heat affecting odds or a damage/overheat mechanic. Final stage is final even if winning. Survivors keep their true column order.
- **Feral:** use the actual square orthogonal topology. Draw links only between adjacent cells within the same winning group's symbol, not the union of all winning cells; no diagonal or decorative hex connections that imply payouts. Show separately disconnected wins without falsely merging them.
- **Vault:** a circular armored outer enclosure is appropriate; readable compartments and numeric token values take precedence over physically arranging fifteen tokens on a tiny perimeter. Preserve all fifteen cell identities, persistent values and exactly three actual respin lamps. Full-grid extra is a fixed bonus plus variable collection, not a fixed total jackpot. Do not visually collect coins early or on each respin.
- **Gatecrash:** five independent pylons/corridor, visibly whole-column activation. Original scatter positions/count stay readable before expansion; transformed grid controls payouts. No visually suggested extra jumps/retriggers.
- **Drone:** tactical deployment field/rack organization with persistent hardpoint markers. Sticky wilds only originate in the free feature, never inherited from the paid base board. Mission progress equals actual free-spin position/remaining, not an invented unlock system.
- **Eclipse:** observatory/body/orbit composition, variable-height instrument columns preserved (2–5 cells each). Do not visually fill absent rows or imply cross-gap connections. The actual product of heights controls displayed ways; ornamental orbital paths must not look like additional paylines.

## Symbol-index and provenance contract

Create one typed presentation lookup keyed by game, with exactly seven ordinary symbol entries in immutable numeric order. The engine's `0..6` indexes and weights/payouts stay unchanged. **Board, tooltip/accessibility, win detail, payout legend and any selected-symbol highlight must all use that same lookup.** Do not sort the lookup by name, rarity, asset ID or visual size. Test legacy receipts across all eight games against the new legend.

Keep WILD, SCATTER, COIN and EMPTY as explicit special roles rather than accidentally indexing the seven-entry array. WILD/SCATTER should retain readable labels or unique semantic badges, not become two similar unlabeled native parts. Vault token numbers are payouts, not a newly introduced ordinary symbol index.

Distinct type IDs can alias the same PNG, so require distinct actual asset hashes within a game's seven ordinary symbols. This alone is insufficient: the inspected inventory has several near-identical silhouettes. In particular, reactor1/3/6 and crystal1/4 risk indistinguishable matches at 320px. Do not choose all members of these families without a successful actual-size discrimination check. Dark targeting/navigation/gear parts need local contrast; thin-line fuel/control art must not disappear. Size treatment may account for image transparency/bounding boxes, without distorting proportions.

Use accurate native asset references and retain the existing centralized attribution/provenance. A thematic display alias is not a new official EVE item name. If aliases differ, identify their canonical source in accessible details/credits. Missing-image/metadata fallback must remain distinguishable by short label or ordinal, not seven identical diamonds.

## State, audio and animation boundaries

- Keep engine, sessions, practice accounting, saved entropy, math evidence/data, scales and cursor semantics byte-identical to the reviewed baseline. No presentation label should be written back into a saved receipt or change the replay fingerprint.
- Decorations derive from the currently displayed recorded frame. Covered saved rounds must remain covered: do not reveal final collection/feature indicators while cursor is zero, or leak a later frame through an environmental meter.
- Use actual winning cells only; do not reward audiovisual “almost” events. A zero-return/no-feature stop must not trigger a bonus or collection celebration. Distinguish a positive stage return from a profitable paid round.
- Keep the existing bounded reveal duration and persistence ownership unless explicitly reviewed. Per-reel visual delays must finish before cursor advancement; reload, Reveal all, blur/unmount and reduced motion must not leave a stale cue/animation that overlays another game's receipt.
- Stable identity configuration/effect dependencies avoid restarting sounds or transformations on unrelated renders. Explicit audio opt-in, mute and hidden-tab teardown remain intact. No autoplay ambience or continuous expensive animation.
- Reduced motion should directly present the same recorded state, symbols, feature count and awards—not remove essential information with the effects. Test mid-animation reduced-motion change and muted feature completion.

## Candidate acceptance checklist

1. Eight actual stage contact sheets at phone and desktop, titles hidden, idle plus meaningful feature states; judge whether the architecture—not only palettes/symbols—is independently recognizable. Include comparison with rejected baseline.
2. At 320px and short landscape: all symbols, full Vault numbers, specials, winning relationships and stage/total returns legible; no clipping, sideways scroll or decorative overlap with stake/reveal controls. Check high-value tokens and maximum-height Eclipse.
3. For all eight recorded fixtures: every rendered cell retains the correct coordinate and symbol index; highlighted cells equal receipt wins; payout/win legend names/icons agree. Feral topology and Reactor survivor paths get dedicated checks.
4. Native missing-art fallback and seven-symbol visual discrimination. Do not count hover-only tooltips as a phone solution.
5. Normal-motion and reduced-motion Gate original→expanded, Drone sticky feature, Vault lock/reset/collection, Reactor/Feral cascades and Eclipse changing heights. Test zero-win, final feature stage and maximum-length hold fixture.
6. Reuse existing storage-failure, rapid-click, old receipt reload, skip/pending-mode lock and donation boundary regression; no need to alter economic tests to accommodate a presentation change. Verify frozen-file hashes explicitly.
7. Actual opt-in distinct game cue playback with no false bonus/loss celebration, no hidden-tab late sounds. Preserve same global sound control and focus/keyboard access.

No design blocker to implementation. **Do not use code branch count or a completed screenshot file as evidence that the user's visual-identity requirement has been met; that remains a human visual comparison gate on the built candidate.**
