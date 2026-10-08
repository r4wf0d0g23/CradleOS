# Slot fleet — independent candidate review

**Verdict: PASS for the bounded Play Money release.** No unresolved accounting, replay, mathematical-claim, or financial-boundary blocker found. This is an inherited native-model review, not an Opus review. No runtime source was edited, no deployment performed, and no wallet or chain transaction requested by this reviewer.

## Scope and independently exercised evidence

Reviewed the eight-engine implementation, session integration, strict receipt replay, rendering/reveal state, rules/math publication and audio. Classic slots and the staged on-chain catalogue remain distinct. The fleet adds eight practice games (33 total practice choices), not eight deployable financial contracts.

- Independently ran **57 focused tests**: 23 slot-fleet, 24 session/options, 10 donation tests; all passed. `git diff --check` also passed. Parent reports the broader 252-test/build and four-width/eight-game browser runs separately; those are not represented as independently rerun here.
- Independent line/ways enumeration and a separate finite-state Vault recursion agree with the analytical anchors. Evidence: `architecture-probes.cjs/json`, `hold-expectation.py/json` and `architecture-review.md`.
- Fresh isolated **320px touch / normal-motion** browser probe passed: `cursor-probe.mjs/json`, `cursor-320.png`. It uses an explicitly constructed local practice receipt and isolated tab storage, not a public writable QA hook or financial mock.
- Gatecrash displayed the three original triggering scatters before wild expansion, then the expanded payout grid; cursor advanced once. Forced storage failure preserved the prior cursor. Reload during reveal, subsequent Reveal all and waiting past stale timers preserved the committed balance/history/sequence exactly. Pending reveal disabled donation/mode escape. No page exceptions occurred.
- A separate no-feature, zero-return Gatecrash fixture emitted spin/neutral-stop/loss tones, **not bonus audio**, verified by actual AudioContext oscillator instrumentation. No claim of physical-device listening is made.
- Screenshot reviewed: the 320px board, award/cumulative return, controls and rules remain readable without horizontal overflow. Local development toolbar seen in that development screenshot is not evidence about production; its absence must be checked after publication.

## Accounting, replay and limits

The entire bounded entropy tape and payout are generated once, one stake is debited and one aggregate return credited, then the exact state is persisted before React state changes. Reveal actions only change the saved cursor. Latest-pack ID plus cursor guards, synchronous busy ownership, timer cleanup and storage-first commits prevent duplicate credits or stale cursor advancement. The progressive displayed balance withholds unrevealed returns cosmetically; it is not a second ledger.

Receipt replay recomputes the original game from the tape and requires exact consumption and equality, including transformed/original boards and awards. Raw save size is bounded at 300KB, draws at 4,000 and frames at 32; board/win/coin shape bounds precede replay. Legitimate worst-case Vault is 28 frames (27 respins), within that ceiling. Existing legacy hands and older packs remain on their own validation paths; active blackjack and pending slots cannot be interleaved.

Integer BigInt cumulative settlement carries fractional hundredths across stages, with a single 2,500× total cap. Stage awards are differences of capped cumulative totals, not independently rounded line sums. Base-only free triggers, no retriggers, original Gate scatter counting, free-only Drone sticky wilds, and one final Vault collection are consistent with the published rules.

The new survivor animation mapping preserves prior-row ordering and is presentation-only. The initial keyframe used a 5px gap despite the mobile 3px reel gap; the final inspected source fixes this with the matching mobile gap variable. This was a presentation-only discrepancy, not a state defect. Line-rule wording was also clarified from “highest longest” to “highest-paying eligible match”; engine selection is correct.

## Math claims and publication

Five analytical expected-point anchors and three pre-release simulation calibrations are distinguished. The frozen source coefficients match held-out validation metadata, and the replay fingerprint makes accidental version-1 changes detectable. Future economic changes must retain old replay rules or introduce a new version.

The 1,000,000-full-paid-spin held-out runs at 100 chips use a separate seed from calibration. All eight approximate 95% return intervals contain the 96% calibration target; this is **not proof of exact 96% RTP, certification, or individual-return guarantees**. The public notes correctly state these limits.

Two additional 250,000-spin seed batches per game derive 1/25/1,000-chip cumulative payouts with BigInt, report tail/stage counts and give a one-sided bound for zero observed cap adjustments. Zero observed caps are not presented as impossible events. The normal intervals can still underrepresent extremely rare tails, which the methodology explicitly acknowledges.

Independently compared every compact UI statistic to the source evidence: return, confidence interval, positive-return and net-profit rates match the million-spin validation; cascade continuation uses the correctly labelled separate 500,000-spin evidence. Public JSON's measurement is identical to `validation.json`. The public export retains sample size, seed, stake, methods, tail batches and analytical anchors.

## Resolved findings / release limits

- False bonus cue on ordinary losing Gatecrash: **fixed and browser-verified**.
- Original scatter provenance under expanding wilds: **fixed and browser-verified**.
- Save/shape bounds, minimum-stake tail reporting and public measured-odds context: **present**.
- Donation remains a separate seed-only path. Existing wagering HOLD/quarantines are not lifted by this review. Local editable practice state is not a secure financial ledger.

Final public delivery/hash and fresh anonymous production interaction checks remain a separate post-deployment gate. Sampled source/data hashes are recorded in `source-hashes.json`; parent should retain final rebuilt artifact hashes where last presentation-only refinements change those files.
