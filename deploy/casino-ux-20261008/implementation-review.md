# Casino payout-first UX — independent implementation review

**PASS for the scoped local-practice presentation release.** No blocking source or production-preview finding. Native inherited reviewer, not Opus. Read-only runtime audit; only isolated browser session storage and research evidence were written. No wallet connection, signature, donation or chain mutation.

## Source correctness

- Primary result now says Payout with exact settled Total bet and truthful Win / Bet returned / Partial return / No payout. Signed balance change and outcome detail remain available through native Round details; prominent Net and competing signed recent-result tiles are removed.
- Result amounts come from the settled round/pack, not the mutable next-stake field. Multi-play totals and completed blackjack hands include their actual per-hand stakes, including doubles/splits as represented in the frozen ledger.
- Pending slots suppress the current payout summary, whole pack receipt and current history row at render time. There is no merely-collapsed future receipt left in the DOM; earlier completed history remains available. Other busy rounds suppress history as before.
- History is one native top-level disclosure with per-result details. Single-round history does not add a redundant individual-plays receipt. Multi-play receipt preserves aggregate and individual bet/payout accounting; recent rows retain signed changes.
- Completed slot per-stage return/collected rows are omitted, while pending revealed stage values and bonus controls/counters remain. “Payout above bet” accurately relabels the unchanged measured profit-frequency metric.
- Seventeen economic/session/feedback/sound/bonus/motion/donation/testnet/math boundary files are byte-identical to runtimebd3156ca. Five reviewed source/test/style hashes are recorded in `reviewed-source-hashes.json`.

## Independent verification

**36 tests passed** across new summary/history tests, sessions and bonus state. `git diff --check` passed.

Production preview `http://127.0.0.1:5200/#/casino`,320px touch and1440px desktop,12 independently exercised cases:

- Zero, partial, returned-bet, multi-play batch and completed doubled blackjack fixtures from frozen engines. Example partial:12.5 payout /25 total bet; batch66.25 /75; doubled table200 /100. Editing next stake to777 leaves all prior result numbers and the saved ledger unchanged.
- Native Round details opens/closes by Enter, preserves focus and visible outline, and exposes the exact signed balance change. History entries open by actual touch/mouse. No horizontal overflow, and single-result history remains one row without a duplicate pack receipt.
- Generated and validated an additional frozen-engine Gate receipt whose base return is **69.11**, free-spin subtotal **20.47**, total payout **89.58**. This is stronger than the supplied free-feature fixtures, whose base totals were all0. At pending cursors0,1,3 and the last unrevealed step, current outcome is absent from raw DOM and accessibility snapshot while previous history remains reachable. Reveal all displays20.47 in the completed free-spin feature rail versus89.58 in the primary payout, omits the redundant stage row, and reload preserves exact state.
- Visually inspected partial-return320, completed nonzero-base feature320 and doubled-table1440 screenshots. Primary amounts/status are legible; the feature subtotal is scoped by FREE SPINS COMPLETE while the round payout is separately labeled Payout. No misleading green/profit label on the partial return.
- Zero page exceptions in independent preview probes. No empty-console claim.

Evidence: `ux-probe.mjs/json`, `nonzero-base-fixture.json`, `preview-320-partial.png`, `preview-320-nonzero-base.png`, `preview-1440-table.png` and corresponding desktop/mobile screenshots.

## Research framing / scope

The saved source extracts support the plan's narrow claims: NN/G describes progressive disclosure; the940-participant LDW study reports3.02 versus2.14 estimated genuine wins, d=.44, not a retention or satisfaction improvement; UKGC14F and2E are correctly treated as regulated-product benchmarks, not a compliance claim for this free practice interface. No product disclaimer was added unnecessarily.

Parent's broader277-test and multi-game bonus/accounting matrices are complementary evidence, not independently rerun here. Legacy staged InstantGamePanel still has payout>0 green/“win” conventions; it is byte-identical and remains a **pre-activation audit item**, not newly approved for paid wagering by this release. Existing security HOLD is unchanged.

The nonblocking closed-disclosure comment nit was corrected before publication: it now accurately says a closed disclosure retains DOM content. Confirmed the recorded source hash already contains the corrected comment and rechecked all five hashes. The implemented omission and independently tested DOM/AX behavior remain correct.

A separate bounded public-byte/UX verification should follow publication. No financial activation is implied.
