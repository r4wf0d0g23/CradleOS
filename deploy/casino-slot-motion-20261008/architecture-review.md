# Fluid slot motion — independent architecture review

**PASS to implement, with explicit lifecycle/timing contracts below.** The proposal is suitable for presentation-only work on the eight approved identities. No runtime modifications made. Inherited native reviewer, not Opus. Reviewed `deploy/casino-slot-motion-20261008/PLAN.md` against the current parent reveal callbacks and board renderer.

## 1. One run, one clock, one completion owner

The existing round's entire outcome and economic settlement are already persisted before animation. Animation only explains that immutable receipt; the parent alone calls the existing guarded cursor advancement. Do not move settlement, RNG, persistence or `revealSlot` into animation/sound callbacks.

A shared pure duration is necessary but not sufficient: a delayed React effect can begin its full animation after the parent deadline has already elapsed. Give the run a monotonic start/phase clock shared with the board, or have the board catch up to the parent's elapsed time rather than starting at zero on late mount. If the deadline is already past, show the final recorded frame directly. Completion includes the last reel's braking/settle, Gate provenance pause/expansion and a modest buffer.

Use a fresh monotonic local run token or immutable receipt identity plus cursor. Numeric round ID/cursor alone can be reused after refill (id1/cursor0) and must not accept a stale cue or animation. Preserve the parent’s latest-state round/cursor checks and storage-before-state commit.

**Cancellation cannot remove the only completion path.** On resize/hidden/reduced-motion, cancel/snap owned visual work but retain one bounded guarded parent deadline, or route through one explicitly idempotent parent finish operation. Never clear a timer and leave `busy`/`busyRef` true. Unmount must cancel all owned work and leave the saved cursor unchanged so reload can resume it normally. Visual cleanup must not pay, save or roll.

Storage failure at cursor completion must restore a usable pending-reveal state with the previous saved cursor, not leave overlays, instruments or actions claiming a committed reveal. Reveal-all remains a cosmetic cursor change and cannot replay the sequence or credit it again.

## 2. Continuous reels without invented outcomes

- Build finite deterministic decorative strips from presentation inputs; never consume casino RNG or modify saved tape. Weighted independent cells remain the actual rule—do not describe this as changing to physical reel-strip odds.
- Decorative ordinary symbols must remain visibly in motion, unhighlighted and excluded from payout/instrument calculations. No inserted wild/scatter near-misses, deliberate almost-jackpot stopping neighbors, or fake prize displays. Exact original saved rows must occupy the final visible window with no next-frame replacement flicker.
- Use a meaningful travel distance and continuous acceleration/cruise/braking; avoid presenting another one-cell translate animation as continuous reels. Stagger actual stop times, not only opacity delays.
- At a new paid spin, begin from the last visible board where practical (or obscure the change under continuous motion), so mounting a strip does not visibly teleport to a different stationary board before movement.
- Reserve/clip enough strip content before and after the final window for damping. The overshoot must not expose fabricated neighboring specials or an empty track. Final position is exact, not an approximate spring resting position.
- Freeze feature/payout instruments at neutral or the last revealed state while the moving overlay is active. Decorative rows must be aria-hidden; the semantic board should say that a reveal is in progress rather than narrating temporary strip cells or prematurely announcing a win.

## 3. Distinct mechanics keep their invariants

**Gate:** complete every raw reel stop first, expose original scatter provenance for a readable beat, then expand only columns containing actual saved wilds. Lit pylon state and final win highlights follow their visible phase. No expansion or bonus cue from a non-feature loss.

**Reactor/Feral cascades:** hold prior winners as ghosts at their actual former coordinates, clear them, then move survivors in retained old-row order. Refills enter from above and follow actual distance; two cells must not swap identity mid-flight. Measure effective row height plus actual gap (currently Reactor6px, Feral0px), padding and borders. Ghosts may not obscure a final win after completion. Feral's links remain within the same evaluated orthogonal winning group, never the union of adjacent different groups.

**Vault:** every previously held coin and value is stationary throughout a respin. Empty compartments may search, but misses cannot briefly show invented value tokens or sound like collection. Only actual additions get new-token arrival effects. A full initial board shows collection—not three fictional respins—and the final amount/bonus is displayed once. Retain large-token exact-digit readability.

**Drone:** stationary locks are only previous free-frame wilds; base-spin wilds never become persistent by animation. New wilds latch when their real result lands. Existing socket labels/locks may not move with a full-reel overlay.

**Eclipse:** reserve a stable maximum playfield footprint, but retain actual2–5-cell window heights and final count per reel. Window resizing may not expose a nonexistent sixth row or decorative symbols as extra winning ways. Avoid layout shifts that move the reveal controls under a held/clicking pointer.

## 4. Measured geometry and lifecycle

Measure stable row/cell geometry once at run setup; use transforms/opacity for frames. Avoid React-per-frame state and repeated layout reads. If a resize/font/layout change invalidates it, cancel safely to the correct recorded frame rather than using obsolete coordinates.

ResizeObserver's initial callback and self-induced layout changes must not cancel every fresh run or create a restart loop. Observe the relevant measured box, compare meaningful changes with the prior size and ignore compositor-only motion. Width/height changes within the same responsive breakpoint still count.

Document-hidden, reduced-motion changes, app unmount and route/mode changes need generation-guarded cleanup. Returning to visibility must not restart the same strip or burst all missed sounds. Browser-throttled parent timers remain safe: on resume, settle once or resume the saved pending cursor; never create a new paid spin.

Reduced motion presents the exact same saved outcome without reels, flips, flashes or shake. Keep short parent cursor safety; suppress intermediate stop cascades rather than emitting five simultaneous stop sounds. If preference changes during a normal run, snap visuals and retain a valid single completion path.

## 5. Sound and resource limits

One actual stop cue per completed reel/phase, feature/collection sounds only from the corresponding saved event. Do not retain the old generic900ms stop effect alongside the new timed stop schedule. All cues remain gated by explicit opt-in, mute, visibility and current generation. Do not defer a sound that can outlive its run and play after a later game or after unmute.

Bound strip rows, ghost count, timers/WAAPI instances and total run duration from known receipt/board limits. Loaded or failed native images use the already-reviewed visible ordinal fallback; slow image decoding must not delay the only completion timer or cause a jump to an unrelated symbol. No new assets/dependencies or ambient loops are needed.

## Candidate acceptance

- Byte-compare frozen engine/session/practice, math data/public evidence, assets and donation/wager boundaries to baseline `db23db8`.
- Pure tests: final strip window exactly equals original grid; deterministic decoration uses ordinary symbols only; bounded sizes and finite positions/times; maximum stop/expansion before completion; survivor bijection and exact old→new row mapping; stationary held coins/wilds; same-frame/new-round token isolation; initial full-Vault collection.
- Temporal browser samples at320/390/1440—not merely start/end screenshots—show actual travel, intermediate velocity/braking, staggered final stops, clear-before-fall and exact endpoints. Include consecutive cascades, unequal Eclipse heights, all/partly locked Drone/Vault, misses, Gate original-scatter expansion and a zero-return spin.
- Lifecycle: rapid input; skip between stages; reload mid-run; failed initial/cursor persistence; resize before first frame and during braking; same-breakpoint resize; hide/return; reduced-motion initially and mid-run; unmount/remount; native image failure; deliberately delayed animation setup. Assert no stale overlays/cues, no stuck controls and no extra ledger change.
- Actual audio instrumentation verifies opt-in, one schedule per run, mute/hidden cleanup and no queued sound burst on return. Keep physical listening/real-phone smoothness claims distinct from browser instrumentation.

No new economic design is required. The architectural decision is approved; source/motion-frame fidelity and lifecycle behavior still need their own implementation gate before release.
