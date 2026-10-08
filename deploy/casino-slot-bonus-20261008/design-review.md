# Earned slot bonus presentation — independent architecture review

**Architecture verdict: PASS with the concrete implementation gates below.** No design-level need to change the frozen economy, receipt or save schema. This is a read-only design/source audit against runtime12886d2 / Pagesd589ed26, not an implementation approval. Native inherited reviewer; no Opus claim.

Reviewed `deploy/casino-slot-bonus-20261008/PLAN.md`, the current FleetBoard/SlotBonusPanel, `CasinoExperience` reveal/commit handlers, `casinoSessions.revealSlot`, frozen slot generation and opt-in audio lifecycle.

## 1. Derive an explicit truthful view, not a future-frame projection

The existing engine prepays and validates the complete tape before animation. Treat `frames.slice(0,cursor)` as the only revealed facts:

- Covered cursor0, including the initial paid spin while busy: no earned-bonus announcement, award count, completion status or future return. `frames.length` is not evidence that the player has visibly triggered a feature.
- The five free-spin games become eligible only after their revealed base `kind=spin` frame has `remaining>0` and the game definition has `free>0`. Reactor/Feral `free=0` remain cascades, even when the base frame wins.
- Ready before the first free spin: awarded total,0 completed. During free spin1: display1/total but retain0 completed pips and no newly revealed return. After it settles:1 completed. During the last free spin: do not show completion until the cursor commit succeeds.
- The rail may derive an upcoming spin index from completed progress. It must not consume the upcoming frame's payout, winners, sticky-wild count, Vault coins or remaining-respin result. Those stay at the last completed prefix until reveal.
- Compute **revealed free-spin return** as the sum of revealed free-frame `award` values, or the equivalent revealed cumulative total minus revealed base total. Do not recompute points/multipliers: frame awards already include integer carry and the round cap. Exclude the base-spin return and do not call gross return profit.
- Actual perks: Wreckway, Gate and Eclipse have2× free spins; Scrapyard and Drone do not. Drone wilds become sticky during free spins: base-spin wilds are not carried forward by the engine. No retriggers are implemented.

A compact pure view object with separate `phase`, `completed`, `current`, `awarded`, `revealedReturn`, and Vault-specific fields will make these boundaries reviewable. Prefer an explicit feature-kind union over a generic `remaining>0` banner.

## 2. Vault is a distinct state machine

- A revealed base with6–14 tokens starts3 respins; fewer than6 does not unlock the feature. A full initial15-token board is **collection ready**, never3 playable respins.
- During a respin, show the prior known locked count and attempts with a clear RESPINNING label. A3-attempt reset is announced only after an actual revealed token addition. Do not announce the precomputed reset as the next animation launches.
- Terminal full/empty-attempt outcomes show collection/completion, not “next free spin.” The initial-full special remains compatible with the existing `slotAwaitingCollection` helper.
- Vault return is not the sum of displayed token values during intermediate frames: the engine awards collection only at its terminal frame. Label known token values/locked state separately from collected return.

## 3. Keep event ownership in the existing parent

`nextSlot` already synchronously claims `busyRef`; `slotDone` verifies pending receipt, round ID and cursor, persists before updating visible session and advances only the cursor. Keep those as the sole authorities.

- Both overlay Start and existing Next invoke the same guarded callback. Overlay clicks, animation end, sound completion, scrolling and dismissal must never independently commit or advance.
- Test mixed rapid activation: Start twice, Start+Next, Start+Reveal all, keyboard Enter/Space, and pointer release while rerendering. Exactly one reveal/commit; no extra stake, reroll or parallel timer.
- A storage-write failure leaves cursor unchanged and remains recoverable with visible error; do not emit unlock/completion effects as though commit succeeded.
- Local View reels dismissal must survive ordinary cursor/parent rerenders and clear on a genuinely new paid round. Whole-receipt object identity is unsuitable because `revealSlot` clones the receipt on every cursor step. A stable validated frames/draws reference or explicit paid-round identity can distinguish rounds; round ID alone is insufficient after refill resets to ID1.
- Reveal all produces the final correct completed state, not a staged live unlock/scroll/launch sequence. Preserve its existing one-step accounting semantics.

## 4. Excitement must remain event-driven and accessible

- Distinguish static derived **ready** state from a newly earned **entry event**. Reload/remount may show the ready panel but must not replay a burst, scroll or fanfare merely because the cursor is1. Emit entry effects only following a successful user-driven reveal transition; mark the generation once.
- Existing opt-in audio closes all notes on mute/hidden/unmount. Preserve that ownership. New fanfare/launch voices must have bounded note count, gain and lifetime; avoid layering both the old generic spin/bonus cue and a new cue accidentally. Test mute during scheduled fanfare and hidden→visible; no delayed replay. Do not auto-enable sound when the player presses Start.
- Reduced motion keeps the strong static bonus state/count but removes burst, zoom, flashing, smooth scrolling and launch accents. A media reversal must not restart an already-cancelled event; retain the motion patch's sticky cancellation contract.
- Keep the rail geometry stable while a reel run is active. No insertion/removal that clips masks, disturbs measured row sizes or causes a ResizeObserver cancellation loop. Do not use continuous glow/shake/flashing to make the state noticeable.
- The cabinet overlay needs real accessible buttons, a readable title,44px targets and visible keyboard focus. View reels dismisses only the announcement and leaves a clear Start/Continue path. If treated as a dialog, supply coherent focus/escape/return handling rather than a visual overlay with hidden or unreachable underlying controls.
- Scroll only once for a newly earned offscreen feature, never on reload, each render, hidden-tab completion or every free spin. Check fixed app-header clearance and320px/short-landscape layouts; both Start and View reels must remain reachable without blocking mute/error access.

## Required candidate evidence

1. Pure truth-table tests at cursor0/entry/first-busy/middle/last-busy/completed/reveal-all for all five free games; no-feature and Reactor/Feral exclusions. Assert no return/lock/reset changes when only unrevealed frame data varies.
2. Zero-return and below-stake complete features: excitement acknowledges earned spins without falsely announcing profit; cap-reached receipt uses actual capped `award` values.
3. Vault fixtures: fewer than6,6+ unlock, miss→2, added-token→3, last miss, fills all15, and full initial collection.
4. All entry actions plus duplicate-click/storage-failure paths preserve balance/history/sequence and advance only the permitted cursor. Reload at entry, mid-feature and complete is exact; new round after refill gets a fresh local entry state.
5. Real320/390/1440 and short-landscape browser checks: announcement visibility, touch/keyboard access, above-reel rail during movement, last-spin completion, dismissal/reopen path, exact reel endpoints and no horizontal clipping. At least one screenshot of each major phase, not only presence assertions.
6. Opted-in fanfare and launch cues, initially-muted launch, mute/hidden cancellation, silent reload/remount and reduced→normal reversal. No infinite animation or autoplay.
7. Frozen engine/session/practice/math, saved schema, assets and donation/wager gates remain byte-identical. Existing motion/receipt regressions pass before publication, followed by a bounded independent public-byte/feature check.

No runtime files were changed by this review. The design is sufficient to make earned features conspicuous without altering odds or introducing a second financial state machine; the tests above are the implementation acceptance gate.
