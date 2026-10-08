# Finite slot runs and non-slot motion — implementation review

**Verdict: PASS for the reviewed implementation candidate. No remaining blocking finding identified.**

Independent native inherited reviewer; not an Opus review. Reviewed current uncommitted source against `deploy/casino-motion-batches-20261008/PLAN.md`. Exact source snapshot: `reviewed-source-hashes.json`. This is a source/candidate gate, not a public-deployment or wagering-activation approval.

## Resolved findings

1. **Restored classic-spin outcome leakage:** a paid/unrevealed classic spin formerly received the actual round with an idle timeline. The current board receives no round until explicit reveal. Independent 320px browser checks confirm no symbol cells or payout summary on restored pending state; no automatic restart.
2. **Crash target marker leaked outcome:** the marker formerly depended on whether the committed endpoint crossed it. It is now unconditional at fixed y=105; trajectory and crossing follow the selected target. Outcome-dependent win styling waits for actual crossing or completion.
3. **Blackjack split re-dealt unrelated seats:** prior state is now matched by seat and split ordinal, with stable corresponding React keys. Both unaffected seats stay fully visible. Initial dealer hole-card deal and subsequent flip are separate events.
4. **Roulette ball co-rotated:** corrected counter-rotation retains the exact pocket endpoint. The angular-sign regression passes.
5. **Two-dice games emitted three early impacts:** cues now number two or three and occur at their physical settle thresholds (0.80/0.87/0.94).

The final source also retains fresh-ticket-only Scratch result feedback, avoiding a prior winning ticket turning the last losing ticket into a win cue. Keno ticket views share one reveal clock; switching views does not reroll the draw.

## Independent verification

- **39 focused tests / 4 files passed:** `casinoSpinRun.test.ts`, `casinoSessions.test.ts`, `casinoTableMotion.test.ts`, `casinoResultFeedback.test.ts` (final source recheck).
- **36 independent engine/count cases passed:** all nine slot engines at 1, 3, 5 and 10 spins. Each transition checks paid/shown counters, restore validity, exact per-spin debit/payout, and final balance. Completing or stopping a run then playing another game removes stale run metadata.
- **22 malformed-run mutations rejected:** invalid counts, bounds, sequences, slot identity, stake and stopped types. See `review-recheck.json` and its source probe.
- **Independent 320px touch browser passed:** pending classic restore masked and paused; explicit reveal/Resume; Stop during the second paid animation prevents a third spin; stopped reload exact; Scratch ticket index survives reload and preference reversal; blocked session write changes neither durable state nor visible reveal; retry succeeds without a second debit; actual three-seat Split leaves unaffected cards at progress 1. No page exceptions or horizontal overflow in these exercised flows. See `review-browser.json` / `.mjs`.
- **13 frozen boundary files unchanged** versus the pre-task baseline: practice/expanded/fleet/Blackjack engines, existing slot/Plinko motion and bonus math, payout feedback policy, donation boundary, and dormant legacy game panels. SHA evidence: `review-frozen-boundaries.json`.

## Invariant assessment

- A run requires affordability for its initial maximum selected cost but commits one paid spin at a time. Each durable transition precedes UI reveal or feedback; there is no hidden upfront debit or future RNG batch.
- Scheduler uses synchronous ownership, generation and sequence/cursor guards. Pause, Stop, visibility loss and unmount invalidate continuation; reload does not resume automatically. The current paid receipt remains recoverable, including earned manual bonus stages. Stop is not a refund or cancellation of a committed spin.
- Revealed totals exclude paid-but-unrevealed outcomes. Classic receipt/history gates and durable Scratch indices prevent premature numeric receipts; covered ticket cells are excluded from accessibility presentation. Precomputed client outcome data is not claimed to be cryptographically secret.
- Motion is a presentation of committed outcomes. Timeline cancellation is sticky for its generation; hidden/reduced state snaps presentation without changing the ledger or replaying missed cues. Restoration is static unless the user explicitly reveals a saved pending stage.
- Testnet, quarantines, house funding, donation custody and contract source are not activated or modified by this work.

## Scope and limits

This reviewer did not independently rerun every game at every viewport. Parent reports the wider 40-case table matrix, lifecycle suite and nine-game real runs separately; those are not represented as independent coverage here. The independent browser used ordinary valid saved fixtures in isolated local session storage, not a wallet or a public financial transaction. The development screenshot includes host/developer UI and is not a clean public-release screenshot. No browser audio recording, exhaustive assistive-technology audit or real on-chain behavior is claimed. Runtime source was not edited by this reviewer; only research evidence/report files were written.

The separate Origins eight-check guard is `node scripts/check-comics-canon.mjs` from `cradleos-dapp`; it is distinct from the Vitest Origins test count.
