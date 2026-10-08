# Casino play-options audit — 2026-10-08

## Scope and current state

Reviewed all **29 catalog entries**, their practice engine, current UI, transaction builders and Move source. There are **25 playable local practice games**, **23 staged testnet previews**, and **no enabled $EVE wagering**. This audit does not activate games, add autoplay or change contracts. Donation authorization is separate: players may voluntarily seed the paused bank through `house::donate`.

Three distinctions matter:

- **Multi-play:** several independent outcomes, each with its own stake. More volume, not inherently new strategy.
- **Multi-bet:** several selections on one shared outcome (roulette board / Sic Bo spread / Keno tickets). Correlated payouts require one combined exposure calculation.
- **Multi-hand:** independently controlled hands, often sharing a dealer/shoe. Each has state and additional-stake decisions; a split is not the same as starting multiple seats.

The current practice engine is intentionally single-round and locks navigation during a reveal or an open blackjack hand. No game currently offers a user-selectable batch count on the refreshed practice floor. Current testnet UI similarly does not expose general batching.

## Game-by-game inventory and proposals

“Contract” describes source capability, not approval to wager. Priority A = first play-money improvements; B = next diversity pass; C = new rules/security redesign first.

| Game | Play-money options now | Current contract/UI distinction | Useful addition / priority |
|---|---|---|---|
| Blackjack | One hand; hit, stand, initial double; single deck, S17 | Staged live UI supports same-rank split plus double. Contract draws with replacement, no predealt dealer hole card; not practice's shoe. No multi-seat selector | **1–3 starting hands**, split in practice, clear active-hand focus, total/additional stake preview. Define shared-dealer/shoe and ace rules. A |
| Plinko | One ball, fixed low-risk board, 12 rows | `play_multi` accepts **2–10 balls**; single modes Classic/Low/Medium/High. Builder exists, but `plinkoDrops` is stuck at1 and handler only calls single-ball builders | **1/3/5/10 balls** and all four risk profiles; per-ball stake × count visible before drop; every path/result independently shown. A |
| Roulette | Red/black or one exact number, single zero | Contract/staged UI support straight, color, parity, low/high, dozen, column; one bet per spin, no combined board entry | **Multi-selection chip board** on one spin, undo/clear/repeat last selection; combined stake and possible payout. Add splits/streets/corners only with new payout rules. A |
| Keno | One ticket,1–6 unique picks from1–40; ten drawn | Same single-ticket source. Several picks ≠ several tickets | **1–4 saved tickets**, quick-pick/clear, same draw for a ticket batch, individual and total settlement; shared-number correlations accounted. A |
| Slots | One three-reel result; fixed weighted strip/table | Three reels are one result, not three paylines; no real multiline or bonus-round model | Short manual **1/5/10-spin packs**, per-spin receipts; later separate 3×3 multiline game with visible paylines/new audited math. B |
| Coinflip | Heads/tails, one flip | One independent coin per call | Small manual flip pack with explicit individual outcomes and total stake; no escalating-loss strategy. B |
| Dice | Threshold and strict over/under, one die | Source same win-count model | Chance/payout slider, presets, manual roll pack; no “auto-recover losses.” B |
| Wheel | One spin, fixed20-sector table | Single outcome; fixed table | Manual short spin pack; favorite stake/last result. Don't imply selectable volatility already exists (Risk Wheel is separate). B |
| Limbo | Target multiplier chosen before outcome | Single-call target resolution | Target presets and independent launch pack; per-launch payout odds. B |
| Hi-Lo | Not on practice floor | Staged table quarantined: live tie-refund math is player-positive; start/settle is not a multi-round ladder | Correct math and fresh secure lifecycle first; then streak/cash-out game with fresh next draw, no stored future sequence. C |
| Sic Bo | Small, big, single face, specific triple, any triple | Five contract kinds; one selection per roll | **Several bets on the same three dice**; per-selection payouts, full-roll combined exposure. B |
| Mines | Disabled, no practice | New contract starts hard-disabled; stored mine bitmap was readable | Rebuild hidden-state model before wagering; optional isolated local practice mine-count/board sizes. No batch exploit-prone persistent boards. C |
| Crash | Predetermined auto-stop target, not real-time cash-out | Same preset-target contract; animation does not confer a live cash-out choice | **Two separate stake lanes / preset auto-stops sharing one correlated flight outcome** only after joint settlement design. True manual cash-out is a separate timed/networked game. B/C |
| Diamonds | One five-symbol cluster result | Five symbols are one payout, not five plays | Manual batch and readable cluster-paytable highlights; new symbol counts need recalculated probabilities. B |
| Double Dice | Under/over7, seven, any double, exact sum | Two dice resolve one selection; not multi-play | Multiple selections on one roll, favorites, combined payouts. B |
| War | One pair of ranks; automatic resolution; half return on tie | No user “go to war” tie decision | Optional tie decision/surrender variant with published math; multi-duel pack is simpler but less gameplay. B |
| Baccarat | Player/Banker/Tie, corrected practice tableau | Current contract quarantined for Banker stand-sentinel bug; practice correction does not fix deployed bytecode | Outcome history, repeat last bet, manual hand pack. Side bets require separate source-backed payout audit. B/C |
| Three-card Poker | Automatic player/dealer hand comparison with custom highest-card tie-break | No Ante/Play/fold decision or standard Pair Plus; same custom source | Real **Ante → Play/Fold** variant, optional Pair Plus and later multiple hands; first define normal rankings and reprice. C |
| Dragon Tower | Disabled, no practice | New starts hard-disabled; future dragon positions were readable | Fresh-draw per-floor design first, then chosen difficulty and voluntary cash-out; no readable future floors. C |
| Video Poker | Disabled, no practice | New deals hard-disabled; future deck leak | Fresh randomness after held cards are committed. Then **3/5-hand draw** from one initial hand with independent replacement draws; exact strategy/paytable audit. C |
| Dragon Tiger | Dragon/Tiger/Tie, one duel | Tie has very different/high edge; not interchangeable with main sides | Duel pack + outcome history; multi-selection only with explicit stake split and combined payout. B |
| Under/Over7 | Under/seven/over, one two-dice sum | One selection; triple options don't mean three plays | Small roll packs; multi-selection spread with visible total. B |
| Ore Refine | Five refinery intensity profiles | One ore outcome per call, tier-specific payout table | **Batch refining with per-lot risk**, persistent profile presets and lot-by-lot yield reveal; not inventory production or actual game items. B |
| Risk Wheel | Low/Medium/High profiles, one spin | Three distinct tables already exist | Profile comparisons and independent spin pack; clear table change, not cosmetic labels. B |
| Money Wheel | One fixed54-sector spin | No betting on a selected segment/multiplier | Manual batch now; selectable-sector version would be a new game/math model. B |
| Andar Bahar | One side choice, capped52-draw resolution | Current cap defaults to Andar on no match; different odds from uncapped casino rules | Clear outcome history and manual hand pack. Recompute rules if removing cap; do not fake a final matching card. B |
| Scratch Cards | One predetermined ticket, unbiased local tier draw | Contract quarantined for modulo bias. Current reveal is an animation, not user scratch input | **Scratch-to-reveal**, reveal-all accessibility option, **1/3/5-ticket packs**; outcome committed before scratching. A |
| Chuck-a-Luck | Chosen face, three dice, one stake | Matching dice control one payout, not three independent wagers | Several selected faces with individually allocated stakes on one roll; combined worst-case payout. B |
| Red Dog | Automatic three-card spread result | No user raise-between-cards decision | **Raise or stay after spread** with fresh third draw and correctly priced added stake; manual hand pack is lower-complexity. C |

## Recommended delivery order

### Wave A — tangible play-money diversity

1. **Plinko risk modes + batch count.** Reuse reviewed per-ball animation and exact source payout tables. One immutable batch, one total debit, unique ball identities, per-ball reveal and sum payout. Start with count≤10.
2. **Roulette board and Keno tickets.** Both are multi-selection-on-one-draw games, not independent redraws disguised as a common outcome. Stake editor, Undo/Clear and Repeat Selection (does not itself place a bet).
3. **Blackjack seats and splits.** Start with three seats and at most one split per seat; complete state migration/escrow accounting before adding insurance or side bets. Use a documented shoe, same dealer, split-ace restrictions, natural-vs-split21 rules and hand-specific actions.
4. **Scratch interaction + ticket pack.** A meaningful touch interaction, with reveal-all and reduced-motion support; scratching only reveals an already-settled result.

These are recommendations from this audit, not features shipped by the donation release.

### Wave B — shared finite batch infrastructure

For compatible instant practice games, add manual1/3/5/10 result packs; no infinite autoplay, automatic stake increases or automatic refills. Show **unit stake × units = total**, total worst-case loss, remaining results and per-result net/gross. Save whole batch atomically before animation, resume without reroll/debit, and block mode switches while unsettled. If all bets are committed upfront, Stop can stop animation but cannot cancel/undo losing results; do not advertise it otherwise. A sequential mode may stop only unplaced future rounds and must be labeled differently.

### Wave C — different decisions, not just more bets

Ante/Play poker, Red Dog raises, War tie choices, safely redesigned Hi-Lo ladders and Video Poker draws. These deserve separate rule/math review. Actual real-time Crash requires an authoritative shared-round protocol, timing/fairness model and server/chain integration; the current flight animation is not that.

## Required financial/security gates

- **Donations are not game activation.** Keep `casinoFunded:false`, on-chain paused status, existing quarantines and disabled starts. Current donated bank must not be unpaused merely because its balance is positive.
- **No hiding future outcomes in chain objects.** Blackjack history is public; future draws are not precomputed into owned objects. Reuse the same principle for split/multi-hand/video poker/Mines/Tower.
- **Reserve aggregate liabilities.** Current House does not reserve all pending hands; withdraw is not constrained by them. Multi-play must reserve combined worst-case settlement against free bank and release it exactly once. Shared draws require the maximum combined payout for any single outcome, not merely separate per-bet checks.
- **Plinko's current batch exception is explicit, not sufficient.** Source accepts per-ball tier exposure and keeps `total % count` dust. A10-ball transaction can exceed the one-ball exposure budget. Preserve awareness of the earlier operator ruling; choose and document a funded aggregate ceiling rather than silently describing it as enforced today. Prefer exact unit-stake×count construction with no hidden remainder.
- **Additional stake actions count.** Blackjack double/split currently lack a contract-level paused check for extra stake. Pausing new games alone isn't enough; settle existing obligations without opening new ones. Multi-seat shared-dealer correlation and simultaneous hands matter.
- **No upgrade-only security claim.** Old published package functions remain callable against compatible types. A corrected fresh package/type/house or demonstrably enforced version isolation is needed before activating repaired games; define disposition of voluntarily seeded old-house funds explicitly, not automatic/silent migration.
- **Integer units only.** u64/token overflow guards, explicit batch caps, exact remainder handling, rounding policy, owner/house/coin/network checks, fail-closed paginated reads, synchronous submit lock and idempotent receipts.
- **Adversarial tests:** repeated submissions/settlements, refresh mid-batch, disconnect/account switch, storage failure, insufficient total funds, all winners, correlated maximum, many simultaneous hands, withdrawal during obligations, pause mid-hand, abandon/timeout behavior, direct obsolete-package calls and outcome-dependent transaction abort attempts.
- **Do not extrapolate corrected practice math to deployed contracts.** Keep previous Hi-Lo, Baccarat and Scratch blockers, hidden-state quarantines, blackjack-rule differences and per-game source-based odds visible in appropriate rules/status surfaces.

## Evidence map

- `cradleos-dapp/src/lib/casinoCatalog.ts`:29 entries and disabled list.
- `src/lib/casinoPractice.ts`, `casinoExpanded.ts`, `components/CasinoExperience.tsx`, `CasinoExpandedOptions.tsx`:25 practice games, single active round/hand, current controls.
- `src/components/InstantGamePanel.tsx`: `plinkoDrops=1`, no multi setter; single-ball call dispatch; staged Roulette/Sic Bo/risk selectors.
- `src/lib/casinoGames.ts`: orphaned `buildPlinkoMultiTx` helper.
- `cradleos_casino/sources/plinko.move`: `play_multi`,2–10 limit, per-ball exposure and retained remainder.
- `cradleos_casino/sources/blackjack_live.move`: initial hand, double, split, sequential active split hand, current fresh-draw rules.
- Corresponding source modules for all other29 keys; `house.move` pause, payout, exposure and admin withdrawal behavior.
- `deploy/casino-expansion-20261008/ARCHITECTURE-REVIEW.md`, `math-evidence.json`: prior exploit and exact probability findings. Funding HOLD from that historical review is narrowed by the new explicit **seed-only** request; its wager-activation restrictions remain intact.

Confidence: high for listed implementation availability and identified source defects; proposed new variants are design recommendations, not probability-validated implementations or funded-game approvals.

## Post-release audit note

Independent live review also found inherited disabled-Blackjack footer copy in `CasinoPanel.tsx` describing a fixed pre-shuffled deck/full-deck publication. That does **not** describe the current fresh-draw live contract. Correct that footer and stale file-header comment in the next scoped copy pass; do not treat them as security evidence or activate based on those claims. Donation functionality is independent and verified.
