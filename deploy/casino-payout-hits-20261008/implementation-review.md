# Paying-hit feedback — independent candidate gate

**PASS for the corrected practice-only candidate.** No remaining blocking source or production-preview finding. Native inherited reviewer, not Opus. Runtime read-only; isolated browser fixtures/probes only. No wallet connection, signature, donation or chain mutation.

## Source and ownership

- Terminal classification uses settled aggregate amounts: payout>total bet retains the existing win cue;0<payout<=bet gets the new payout acknowledgement;0 keeps loss. Batch/multi-hand stakes and payouts are summed from the committed pack, not current editable controls.
- The payout branch has exactly two sine notes in every themed/default voice, with225ms note-envelope span, no inherited echo, and gain<=0.023. Existing win/loss/bonus voices are otherwise unchanged.
- Nonterminal free-spin acknowledgement uses actual `frame.award>0`, so no cue for zero integer/capped award. Terminal frames enter aggregate classification first and do not also emit a per-frame payout cue. Reveal-all acknowledges the final result once rather than replaying skipped frame sounds.
- `presentRound` is parent-owned and called after successful commit/guarded reveal. The monotonically identified visual event is ephemeral and never serialized. New act, navigation, mode and successful refill clear it; result ID/game matching prevents attaching it to another receipt.
- The summary checks event freshness, positive payout, visibility and reduced preference at mount. It expires against the original monotonic deadline; hidden/reduced cancellation is sticky. The final direct matchMedia listener closes the parent-prop timing gap. There is no event-derivation effect based merely on an existing payout value.
- Exact amount is always shown. Partial return/Bet returned/Total bet labels and details remain intact. `result-win`/`round-won` remain restricted to payout above stake; the brief halo does not relabel a partial return as a whole-round win.
- Six reviewed source/test/style hashes and16 frozen economy/session/feedback/bonus/motion/custody/math boundaries are recorded in `reviewed-source-hashes.json` against9361269.

## Independent verification

**33 focused tests pass** across result feedback, result/history and sessions after the direct-media fix; `git diff --check` passes.

Production preview5200,320px touch:

- Valid precomputed Scrapyard partial fixture18.77/25: actual reveal ends with the exact two scheduled payout pitches428.5125/572Hz, no Win classes, readable truthful amounts. Editing next stake and opening details does not restart the same pulse animation.
- Reduced preference cancels before the900ms expiry; reversing preference does not restart the pulse.
- Actual app Refill resets sequence, then an explicitly test-controlled valid frozen-engine draw tape reproduces the partial outcome. New round ID1 gets a fresh effect rather than being mistaken for the prior ID1. This is deterministic browser test instrumentation, not claimed natural RNG play; the crypto hook is restored afterward.
- Reload shows the exact saved result without a pulse or AudioContext.
- Controlled document-hidden fixture before late terminal completion: no pulse appears; audio contexts close; visibility restoration adds neither a pulse nor scheduled notes.
- Simulated terminal cursor storage failure: the entire saved state remains unchanged, no payout summary/halo or payout cue is emitted, and the unchanged-round error remains visible.

Production preview5200,390px touch, valid Gate receipt:

- Nonterminal free frame award0: stop cue, zero payout acknowledgements.
- Nonterminal free frame award2047: exactly one two-note payout acknowledgement.
- Terminal free frame award0 with aggregate profitable round: only the existing three-note win ending, not an extra payout cue.
- Every reveal advances exactly one cursor and preserves the already-settled balance. Nonterminal frames do not pulse a hidden full-round payout.

Zero page exceptions in these independent probes. Sound evidence records actual Web Audio scheduling/pitches, not a claim of manual acoustic listening.

## Visual and scope notes

Inspected parent-produced320/1440 partial-hit screenshots: the finite light halo is restrained, digits remain readable and unchanged, and Partial return / Total bet remain explicit. No count-up, altered odds, autoplay or added loss-chasing prompt is introduced.

Parent's280-test/full mobile matrix is complementary, not independently rerun here. Existing regulated-product/security activation review remains separate; no compliance or paid-wager activation is approved by this practice-feedback gate.

Evidence: `payout-lifecycle.mjs/json`, `partial-slot-fixture.json`, `free-cues.mjs/json`, `reviewed-source-hashes.json`; source plan `deploy/casino-payout-hits-20261008/PLAN.md`. A separate delivered-byte/bounded live gate should follow publication.
