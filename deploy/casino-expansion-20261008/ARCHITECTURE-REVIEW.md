# Independent casino math/security architecture review

2026-10-08. Inherited native reviewer, not Opus. Read-only inspection of the current `cradleos_casino/sources` and frontend integration. No contract execution, signing, funding or deployment.

**Verdict: isolated, explicitly corrected practice expansion is a reasonable architecture. HOLD on activating/funding the current contract package.** This is not an implementation approval; the expanded engine and UI require their own gate.

## Confirmed material math defects

### 1. Live Hi-Lo overpays ties — funding blocker

`hilo.move:59` refunds ties but separately allocates 98% expected return to wins. For any feasible direction with c winning ranks:

`RTP = (c/13) × (127400/c)/10000 +1/13 ≈105.6923077%`.

Integer floors slightly lower this, not enough to cure it at normal stakes. Live `start/settle` reveals the base first, so the caller can always choose a feasible direction. The legacy blind `play` is different: its impossible direction occurs for one base, producing aggregate RTP≈98.1538462%, not 105.69%.

For 98% *unconditional* RTP while retaining full tie refunds, a winning payout must be `floor(amount ×117400 / (10000 ×c))`; ties still return amount. The corrected largest gross multiplier is 11.74×. Computing one final floor avoids the extra loss from flooring bps before multiplying. Reject infeasible calls or specify their loss behavior explicitly. Update frontend multipliers, exposure ceilings, tests and claims together. Using 117600 instead would target 98% only among non-ties and yield 98.153846% overall.

Quarantine live Hi-Lo now; frontend hiding alone is not a contract fix.

### 2. Baccarat drawing rule produces a positive Player edge — funding blocker

`baccarat.move:61` uses 255 for “Player did not draw” but fails to draw Banker 4/5 in that case. Canonical rules require Banker to draw on 0–5 when Player stands. Tests must assert `banker_draws(4,255)` and `(5,255)` are true.

Independent exact enumeration of all weighted single-deck value prefixes, using common denominator 52 P 6=14,658,134,400:

- Current Player/Banker/Tie counts:6,691,512,320 /6,636,013,440 /1,330,608,640.
- Current gross RTP: **100.378621716% /97.357784139% /81.698512466%**.
- With the sentinel correction: **98.713627513% /98.988251711% /84.253873071%**.

The displayed 1.24%/1.06%/4.85% edge claims do not describe this code. In particular 9× gross on a single-deck tie is about 15.7461% house edge even after the rule correction. Quarantine the current contract table; label corrected practice separately.

### 3. Scratch Cards modulo bias — significant fairness/claim defect

`scratch_cards.move:172` maps a uniform 16-bit value through `%10000`. Values 0–5535 occur seven times; later values occur six times. Every winning tier starts at 7000, so:

`actual RTP =0.97 ×60000/65536 =88.80615234375%`, not 97%.

Actual win rate is 18000/65536≈27.4658%, not 30%. Corrected practice may use an unbiased bounded draw 0–9999, but must not claim to mirror the existing contract RNG. Symbol/grid display is cosmetic; its visual payout implication must agree with the selected tier.

### 4. Andar Bahar truncation changes both advertised edges

The 52-draw cap defaults to Andar after no match, instead of following the infinite geometric model quoted in the header. Let `q=(12/13)^52≈0.01557293513`:

- P(Andar)=0.52+0.48 q; RTP at 1.88×=**99.165301666%**.
- P(Bahar)=0.48(1−q); RTP at 2×=**94.504998228%**.

Thus current edges are 0.834698334% and 5.495001772%, not 2.24% and 4%. Preserve/disclose the exact capped variant or deliberately redesign/recompute it. Include an all 52-nonmatching fixture; do not invent a matching final card in its animation.

### 5. Three-card poker is a custom ranking variant

The 1.75× non-qualifying-dealer win correction is present. Exact inclusion-exclusion across 407,170,400 disjoint three-card hand pairs gives:

- Current RTP **96.983118861%** (edge 3.016881139%).
- Reverting to 2× gives **103.300397082%** RTP: do not revert it.

The current comparator uses category then only the highest rank, not standard poker tie-breaking. Examples: pair of Twos plus Ace beats pair of Kings plus Four; A-2-3 beats K-Q-J. Equal top ranks can push despite differing pairs/kickers. Document the custom rule explicitly if practice mirrors it. A ranking correction requires a fresh payout audit, not reuse of these numbers.

### 6. Remaining payout claims

Parsed table-weight/hypergeometric calculations are in `math-evidence.json`. No additional player-positive fixed table was found in this bounded pass. Important smaller corrections:

- Diamonds RTP is **96.543107039%**, not the quoted≈95.7%.
- Ore tiers are very close to 97%, but not all exactly 97%:96.998%,96.995%,97.007% appear in the integer tables.
- Classic Plinko uses 4851 center bps, not the 4850 shown in its header; RTP 96.0017676%. Low/Medium/High:96.484375%,95.9814453%,96.5185547%.
- Crash/Limbo’s finite uniform sample means `RTP = floor(9800000000/target_bps) ×target_bps /10000000000` before payout-unit flooring: at most 98%, not exactly 98% at every target.
- Coinflip, legal Dice lines, Roulette, Slots, Wheel/Risk/Money Wheel, Keno, War, Double Dice, Under/Over 7, Dragon Tiger, Chuck-a-Luck, Sic Bo and Red Dog match their source distributions within stated rounding. Side bets can have much larger edges: Dragon Tiger Tie≈47.06%, Sic Bo triples≈16.67%, etc.; never give a blanket 2–5% promise.

## Hidden-state and blackjack safety

- Mines, Dragon Tower and Video Poker really are disabled in current Move start/deal via `assert!(false,EGameDisabled)`, not only the frontend. Keep those guards. Their stored mine bitmap, dragon positions and future deck remain readable from chain; hiding fields from a UI is not secrecy. Existing objects require controlled settlement treatment, not renewed availability.
- Current `blackjack_live` fixes the historical future-deck leak: it stores only already-dealt cards, keeps only the dealer upcard until settlement, and draws new cards through non-public `entry` functions using `&Random`. This is a meaningful mitigation, not a complete economic/security approval.
- It is a with-replacement, no-predealt-hole-card variant, not the single-deck practice game or the old threshold simulator. Compute its own optimal-strategy edge. Split settlement also compares plain totals: a split 21 pushes against a dealer natural, unlike standard blackjack; make that rule explicit or fix and reprice.
- Private entry functions reduce composition-based outcome inspection, but do not justify claiming universal immunity to gas/resource-dependent aborts. Test actual PTB restrictions and gas-budget boundary behavior on the intended Sui version before funding.

## Mandatory future activation requirements

1. **Keep the present house paused/unfunded.** UI quarantine protects navigation, not direct Move calls. Preserve settlement access for valid previously escrowed games where appropriate.
2. **Do not rely on an upgrade alone to disable old code.** Existing Sui package versions remain callable against compatible type-origin objects. Current `House` has no version/per-game guard. A newly edited guard cannot force already-published unguarded functions to check it. Use a corrected fresh package/type/house (or another design that demonstrably excludes every old entry path), leaving the old house closed. Test old package calls against the intended funded object.
3. **Reserve aggregate pending liabilities.** `house.move:392` only reads `&House` to check one hand; it reserves nothing. Arbitrarily many pending Hi-Lo/blackjack hands can pass against the same bank. Admin withdraw can also remove the bank despite pending games. `pay_winnings` aborting on insufficient balance prevents negative balances but does not guarantee successful settlement. Track/release reservations atomically and gate withdrawals, new hands and other games against free bankroll. Conservative gross-payout reservations are simpler than optimistic escrow accounting.
4. **Define abandonment and pause behavior.** Reservations must not be lockable forever. A simple post-reveal timeout refund would grant a free adverse-selection option; use a disclosed forced-settlement/forfeit policy with fair timing. If pause means no additional stakes, contract double/split—not only frontend buttons—must enforce it while still allowing hit/stand settlement.
5. **Audit batch liability honestly.** Plinko multi intentionally limits each ball, not aggregate transaction payout, and keeps division dust. That existing policy can exceed one-ball tier exposure; test and disclose the combined budget and remainder behavior rather than calling it a single-bet guarantee.
6. **Pin deployed bytecode and rules.** Contract source inspection is not proof that any future package has these bytes. Reverify package identity, current world/coin type, owner gates, house status and complete publication build before separate funding authorization.

## Exact regression gates

- Hi-Lo: every base 0–12, direction, drawn rank 0–12; include push and impossible calls; several stake sizes. Corrected feasible conditional RTP must be≤98%, with the exact integer-floor bound; every payout≤the reserved ceiling.
- Baccarat: all Banker totals with no-third sentinel; complete tableau for third values 0–9; natural short-circuit; exact weighted single-deck counts above. Verify labels from that same rules version.
- Scratch: enumerate all 65536 current byte pairs to reproduce bias; corrected 0–9999 mapping must have exact tier counts 7000/2000/700/250/30/20. Loss grids contain no winning triple; every shown win/tier/multiplier agrees.
- Andar: exact truncated geometric distribution and 52-miss fallback; no post-reveal choice; animation ends even without a matching card.
- Poker:1.75× regression; explicit pair/kicker/straight examples above; full ranking/payout aggregate recalculation whenever ranking changes.
- All tables: valid/invalid options, raw integer boundaries, exact maximum-payout dominance, payout floors, and atomic rejection without mutation. Preserve source arrays rather than unchecked comments.
- Multi-step contracts: multiple simultaneous hands to the reservation limit, admin withdrawal while hands are open, settle order permutations, duplicate settle, wrong owner/house, disabled new-game paths, timeout policy, and direct old-version calls.
- Practice UI: wallet/network isolation; atomic save-before-reveal; reload mid-hand; corrected-rule labels; outcome-dependent rendering/replay must consume committed state and never redraw RNG.

## Evidence and confidence

`math-audit.py` is a reproducible read-only audit. `math-evidence.json` stores exact Baccarat counts, exact three-card aggregates, source-table computations and identified formulas. Values are before wager-unit rounding unless stated. High confidence in the reported mathematical defects and absence of stored future cards in current blackjack; this is not a full formal contract audit or funded-game approval.
