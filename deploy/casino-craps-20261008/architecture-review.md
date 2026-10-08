# Frontier Craps — independent architecture review

**Verdict: architecture viable; proceed with the constraints below as implementation gates.** No source/runtime implementation approval is implied. Native inherited reviewer, not Opus. Read-only review of PLAN.md and the current Session/Experience integration (baseline HEAD266b551). No runtime edits, wallet actions or deployment.

## Required clarifications / invariants

1. **No new line bets at an established point.** Explicitly prohibit adding or increasing either Pass or Don't Pass after come-out. Pass remains locked; simplest Don't removal is whole line plus its dependent odds in one refund. Allow correctly capped odds edits only when that same line exists. Otherwise a newly placed Don't bet receives a known-point advantage. Don't/Pass may both be supported on come-out if intended, but their stake, odds, settlement and removal must remain separate.
2. **Evaluate all bets against the immutable before-phase.** Point-changing results must not switch working/off status partway through evaluation. Come-out 7 leaves OFF Place/Hardways untouched; established-point 7 loses them even though the resulting puck is OFF. Making a point also resolves any working Place/Hardway on that number on the same roll. Field always works, independent of puck phase. A Don't 12 push returns its stake and removes that bet.
3. **Separate pending reveal from parked escrow.** `activeSession` should block on a pending craps roll, not all parked craps bets. Every craps monetary operation must nevertheless reject while another game has an active hand/receipt/run. Refill needs an independent escrow guard in both button state and synchronous handler; don't reuse the narrower navigation lock. Ordinary games may spend only available balance, never the parked escrow.
4. **Preserve ownership across every wrapper/restore.** Most current `settle` paths spread Session, but `wrap`, the legacy-hand `actSession` path and `restoreSession` reconstruct it. Explicitly preserve craps or reject unreachable conflicting legacy combinations; do not silently drop escrow. Leaving/re-entering the table, another game, donation mode and reload must not create a fresh craps table over the saved one. At boot, pending craps takes focus; nonpending parked craps must not hide another game's active hand/bonus.
5. **Choose a separate craps roll counter.** Its own compact history/local sequence is the simpler safe design. Updating root `Session.sequence` without a corresponding legacy Round breaks existing pack/run identity checks. Do not fabricate generic Round entries with zero resolved stake or reuse generic instant-round accounting. If root sequence is shared instead, reconcile all old pack/run/history references atomically and test those transitions explicitly.
6. **Reveal the before-state, not only masked dice.** Once the result has been saved, current balance, puck, escrow chips/removals, return totals, result classes, labels, history and accessible names must not prematurely display the committed after-state. Render the receipt's before-point/bets while pending; conceal numeric return and final result until reveal. The roll's exact after-state is committed only once before animation; reveal, reduced motion, hiding and reload never credit or reroll. Restore offers one explicit reveal path, with no replay fanfare.
7. **Validate post-state only when the receipt still owns it.** Recompute every receipt from checked before-point/bets plus two faces; reject forged resolved stake/payout/after-state. The *pending* receipt must match current craps after-state. Once revealed, later legal placement/removal and other games can legitimately change current state/balance, so don't require an old revealed receipt's after-state to equal today's edited table. Bound history count and object keys; reject arrays, unknown fields, unsafe integers, duplicate/replayed IDs, invalid faces, impossible points, odds without line and off-point odds.
8. **Exact amounts and safe capacity.** Ratios below are profit odds; gross returns include the resolved stake once. Atomic addition checks cash, exact increment, aggregate cap and odds cap before debit; removal refunds once. UI must preview the actual allowed amount/increment and never silently round an incompatible chip amount. Reserve arithmetic headroom for returning parked escrow: at the session's maximum balance, another game's win must not strand otherwise refundable bets or silently clip the refund. Reject an over-limit transition atomically.

## Accounting contracts

Let B be spendable balance, E current escrow, A a placement, R a removal/refund, G the gross returns from resolved bets, and S their original stake:

- Place: B'=B−A, E'=E+A.
- Remove: B'=B+R, E'=E−R.
- Roll: B'=B+G, E'=E−S; therefore total assets change by G−S. Unresolved bets are neither re-debited nor returned.
- Reveal / navigation / reload: B and E unchanged.

A roll can resolve zero stake while establishing a point or moving the dice; it is not a zero-value instant Round. Decide whether rolls with no bets are allowed (reasonable as free table progression); neither choice should charge a stake or allow a locked Pass contract to be bypassed by resetting the shooter. A point may remain after every removable bet is withdrawn; do not require a line bet as proof that a point can exist.

## Rules/math sanity

Pinned payout rules are coherent, including 3/4/5× Pass risk caps and 6× Don't risk caps (the latter yields 3/4/5× line winnings at the three point groups). With exact payouts:

- Pass expected loss per initial line bet: 7/495 ≈ 1.41414%.
- Don't (bar 12): 3/220 ≈ 1.36364% per initial bet including pushes; do not mix this with 27/1925 ≈ 1.40260% per resolved non-push decision.
- Odds fair conditional on the point: zero expected loss, absent rounding/caps that alter payouts.
- Field double-2/triple-12: expected loss 1/36 ≈ 2.77778% per roll.
- Place 4/10: 1/15 ≈ 6.66667%; 5/9: 1/25 = 4%; 6/8: 1/66 ≈ 1.51515% per resolved bet.
- Hard 4/10: 1/9 ≈ 11.11111%; Hard 6/8: 1/11 ≈ 9.09091% per resolved bet.

These are mathematical checks of the stated variant, not claims of a regulated implementation. Winning bets being returned instead of rebet must remain plainly visible. No Come/Don't Come, Buy/Lay or testnet entry should appear as supported.

## Minimum targeted acceptance

- All 36 ordered dice pairs for every point and bet family, including mixed simultaneous bets. Two independently checked uniform faces, not a uniformly chosen sum.
- Explicit edge fixtures: come-out 7 with OFF side bets; come-out hard 4 setting a point plus Field payout; established hard point made with line+odds+Place+Hardway+Field; seven-out; Don't12 push; neutral rolls retaining escrow; Don't removal+odds atomic refund; no line add/increase after point.
- Exact ratios/increments, cap boundary, affordable/unaffordable aggregate, invalid RNG, arithmetic ceiling, and atomic failure with input unchanged.
- Park escrow → play/settle each generic, pack, Blackjack and slot-run route → reload → return/remove or resolve craps. Assert exact preserved escrow/roll history and root metadata validity. Attempt refill from another game while escrow remains.
- Placement, removal, roll-save and reveal-write failures; rapid double-roll; reload during animation; hidden/reduced reversal; stale completion after navigation. No second debit, refund or payout.
- Pending before/after DOM and accessible-text probe: dice, ON/OFF puck, chips, balance, result/history/receipt and win styling; stopped/hidden animation still has an explicit recovery action.
- Real 320px touch: placed spot versus selected chip clearly distinct; exact per-spot stake, working/OFF labels, line/odds dependence, total escrow and available chips readable. Roll must not look like a second stake debit; remove actions must clearly distinguish locked Pass from removable bets.

**Bottom line:** good bounded practice-only addition. The ownership split and before-state reveal are the important integration gates; no testnet/funding/security activation is authorized by this review.
