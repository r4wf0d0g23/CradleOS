# Batch 01 — Stage-0 Game Brief Stubs (2026-07-11)

Selected per the roadmap prioritization heuristic: engine-reuse batches for velocity, variance-gap fill (catalog is thin on L-vol grinders and selectable-volatility), one EVE-native moat game interleaved, all-instant except one high-value stateful. Each stub advances to a full Gate-0 brief before build.

---

## 1. Dragon Tiger (#103) — [I], Var L
Two-card duel: one card to Dragon, one to Tiger, bet the higher (or tie). Reuses the War engine (single-compare card logic) + card-deal animation from CasinoAnimations. Edge ~3.7% on main bets via tie-drain (half-loss on tie, tie pays 8:1 at ~7.4% edge). Psychology hook: the fastest card game in any casino — zero decisions, pure anticipation, tight session loop for grinders.

## 2. Risk Wheel (#38) — [I], Var L–VH (selectable)
Single wheel, three player-selectable segment tables (low/med/high risk) — same spin animation, different payout maps. Reuses the Wheel of Fortune engine and spin stage wholesale; three derived paytables each simmed to 2.5–4% edge. Psychology hook: player-chosen volatility = agency illusion + one game serving three player temperaments (fills our low-vol gap AND jackpot-chaser itch in one module).

## 3. Plinko Risk Modes (#63) — [I], Var L–VH (selectable)
Low/med/high peg-table variants on the existing 12-row Plinko engine — identical drop animation, three payout arrays. Edge derived from binomial distribution per mode, simmed to ~3%. Psychology hook: "low mode" converts Plinko into a near-guaranteed-small-return grinder (fills the L-vol gap); high mode keeps the 130x+ chase; near-miss pegs already the best in catalog.

## 4. Under/Over 7 (#21) — [I], Var L
Two dice, bet under/over/exactly 7. Reuses the Double Dice engine (2-die roll + tumble animation) with a 3-outcome paytable: under/over ~1.92x (edge ~2.8%), exactly-7 at 4.9x (edge ~5%). Psychology hook: the simplest bet in gambling history — instantly legible to a first-time visitor, ideal "first bet" on-ramp game at the top of the lobby.

## 5. Money Wheel / Big Six (#37) — [I], Var M
54-segment wheel with tiered symbols (1x/2x/5x/10x/20x/45x by segment count). Reuses the wheel spin engine; paytable derived directly from segment frequencies, edge tuned to ~3.5% per symbol. Psychology hook: the casino-floor classic — long decelerating spin is a premium anticipation window, and the rare 45x segment gives every spin a visible jackpot seat.

## 6. Scratch Cards (#74) — [I], Var M
3x3 reveal grid, match-3-symbols-to-win, tiered symbol rarities. New light UI (staggered tile-flip animation, reuses Mines' tile-reveal visuals) over a single-tx instant resolve; paytable enumerated over symbol distributions, simmed to ~4% edge. Psychology hook: self-paced reveal — the player controls scratch order, manufacturing near-misses (two jackpot symbols showing) on demand.

## 7. Andar Bahar (#104) — [I], Var M
Draw a joker card, then deal alternately to Andar/Bahar sides until a rank match; bet which side matches first. Reuses card-deal engine with a new alternating-deal cascade animation; first-side bet pays ~1.9x (edge ~3%, side-asymmetry priced in). Psychology hook: variable-length reveal (1 to 40+ cards) = escalating tension unmatched by fixed-deal games; huge in the live-casino market, absent on-chain.

## 8. Ore Refine Gamble (#117) — [I], Var H — EVE-NATIVE
Stake a wager as "raw ore," pick a refine intensity (1–5); higher intensity = higher multiplier ceiling but rising slag/bust chance. Mechanically a themed multi-tier dice roll on the instant-game engine; per-tier tables simmed to ~3% edge. Psychology hook: category-J moat — maps directly onto EVE Frontier's core loop (players already gamble on refining emotionally); refinery-glow reveal animation, slag near-misses.

## 9. Keno Extended (#73) — [I], Var VH
Extend live Keno from pick-1-6 to pick-up-to-10 of 40 with a deepened hit-count paytable (top prize ~10000x on 10/10). Pure paytable + UI extension of the live Keno engine; each pick-count column derived hypergeometrically and simmed, edge held at 3–4%. Psychology hook: 10-pick jackpot chasing plus constant 8/10, 9/10 near-misses — the strongest near-miss generator per bet in the whole catalog.

## 10. Caribbean Stud (#52) — [S], Var M — the batch's one stateful build
Ante, see your 5 cards + dealer up-card, fold or 2x call; dealer qualifies with A-K+. Reuses the video-poker hand-evaluator and blackjack_live commit-reveal escrow pattern (single shuffle, deterministic replay, no mid-round randomness). Edge ~5.2% of ante (standard paytable) — flag at Gate 0: slightly above the 2–5% band, acceptable as % of total wagered (~2.6%). Psychology hook: the fold/call decision vs a visible dealer card is the purest skill-illusion moment we can ship; premium-hand payouts (100x royal) give the streamable peak.

---

**Batch shape:** 9 instant + 1 stateful; 4 pure engine-reuse paytable variants (cheap), 3 light-new-UI instants, 1 EVE-native, 1 flagship stateful. Fills the low-volatility gap (Dragon Tiger, Under/Over 7, Risk Wheel low mode, Plinko low mode) flagged in the catalog review. **Prerequisite per roadmap heuristic #5: NAV_PLAN Phase 1 lobby ships with or before this batch** (catalog will hit 29).
