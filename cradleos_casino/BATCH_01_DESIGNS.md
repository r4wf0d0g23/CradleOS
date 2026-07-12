# Batch 01 — Stage 0→1 Game Designs
**Generated:** 2026-07-11 (Stage 0→1 Discovery + Design)
**Sim script:** `scripts/edge_sim_batch01.py` (all math Python-verified, no head-math)
**bps convention:** 10000 bps = 1.00× gross return (stake + net win)

---

## Quick-Reference Edge Table

| # | Game | Primary Edge | MAX_MULT_BPS | Max Bet (90k bank) | Gate-0 |
|---|------|-------------|-------------|-------------------|--------|
| 1 | Under/Over 7 | UO: 3.33% · 7: 5.00% | 57 000 (5.7×) | 473 EVE | **GO** |
| 2 | Dragon Tiger | Main: 2.94% · Tie†: 47% | 90 000 (9×) | 300 EVE | **GO** (tie=side bet) |
| 3 | Risk Wheel | 3.00% all modes | 59 000 (5.9×) | 457 EVE | **GO** |
| 4 | Money Wheel | 3.31–3.61% per bet | 521 100 (52.1×) | 51 EVE | **GO** |
| 5 | Plinko Risk Modes | LOW 3.52% · MED 4.02% · HIGH 3.48% | 5 000 000 (500×) | 5 EVE (HIGH) | **GO** |
| 6 | Scratch Cards | 2.94% (100× on-chain cap) | 1 000 000 (100×) | 27 EVE | **GO** |
| 7 | Andar Bahar | Andar 3.21% · Bahar 2.97% | 20 000 (2×) | 1 350 EVE | **GO** |
| 8 | Ore Refine | 3.00% all tiers (solved) | 200 000 (20×) | 135 EVE | **GO** |
| 9 | Keno Extended | Pick-1: 3.75% · Picks 7-10: >99% | 100 000 000 (10 000×) | <1 EVE | **FLAG-FOR-RAW** |
| 10 | Caribbean Stud [S] | Ante: 6.08% · Total wager: 2.75% | 1 000 000 (100× raise) | 27 EVE | **FLAG-FOR-RAW** |

†Tie side-bet edge 47% is Dragon Tiger industry standard; recommend side-bet-only framing.

---

## Game 1: Under / Over 7

### Psychology Scorecard
| Lever | Score | Notes |
|-------|-------|-------|
| Anticipation window | ★★★ | Dice tumble animation 2-3s inherits from double_dice.move |
| Near-miss potential | ★★☆ | Sum=7 "barely missed" both sides; Exactly-7 animates specially |
| Agency / skill illusion | ★★☆ | Three-outcome choice; feels like a decision |
| Volatility profile | L | Even-money bets — pure grinder |
| Session loop | ★★★ | Fastest possible loop after War; ideal first-bet game |
| Streamable moment | ★★☆ | Back-to-back Exactly-7 hits; pair of sixes = clip |

### Final Payout Table (bps)
| Outcome | Probability | Payout (bps) | Net | Edge |
|---------|------------|--------------|-----|------|
| UNDER 7 (sum 2-6) | 15/36 = 41.67% | 23 200 | +1.32× net | 3.33% |
| EXACTLY 7 | 6/36 = 16.67% | 57 000 | +4.70× net | 5.00% |
| OVER 7 (sum 8-12) | 15/36 = 41.67% | 23 200 | +1.32× net | 3.33% |
| Lose | remainder | 0 | -1× | — |

Note: Existing `double_dice.move` pays 23 000 bps for under/over (4.17% edge). This game uses 23 200 bps (3.33%) plus adds the new Exactly-7 bet type. The double-dice engine is reused wholesale.

### Exposure Guard
- MAX_MULT_BPS: 57 000 (5.7×)
- max_bet = 2700 / 5.7 = **473 EVE** at 90 000-EVE bank

### Abort Codes
- `EInvalidKind`: bet kind not 0 (UNDER), 1 (EXACTLY), or 2 (OVER)
- `EMaxExposure`: amount × 57000 > bank_balance × 300 (standard guard)
- `EZeroWager`: amount == 0

### Animation Spec
- **Reuses:** `CasinoAnimations` double-dice tumble stage exactly.
- **New:** when `exactly_7` wins, a secondary "7" glyph flashes in ACCENT color (#FF4700) with a 0.5s pulse before normal settle.
- Reveal: dice stop → sum display → win/loss flash.

### Move Build Plan
- Engine pattern: **instant**, `double_dice.move` variant.
- Add KIND_UNDER7_V2 (23200 bps), KIND_OVER7_V2 (23200 bps), KIND_EXACTLY7 (57000 bps).
- No new randomness mechanism; reuse 2-die roll.
- Or: extend `double_dice.move` with new constants and `payout_for_v2`.

---

## Game 2: Dragon Tiger

### Psychology Scorecard
| Lever | Score | Notes |
|-------|-------|-------|
| Anticipation window | ★★★ | Two cards flip; the duel reveal is the tightest in the catalog |
| Near-miss potential | ★★☆ | Tie is the "near-miss" — you almost split the bank |
| Agency / skill illusion | ★★☆ | Dragon vs Tiger choice feels decisive |
| Volatility profile | L | Even money; fastest-loop grinder in the catalog |
| Session loop | ★★★★ | Literally the fastest card game in live casinos |
| Streamable moment | ★★☆ | Ace-vs-2 reveal; tie jackpot side bet |

### Final Payout Table (bps)
| Outcome | Probability | Payout (bps) | Edge |
|---------|------------|--------------|------|
| Dragon/Tiger WIN | 8/17 = 47.06% | 20 000 (even money) | — |
| TIE (same rank) | 1/17 = 5.88% | 5 000 (half-stake back) | — |
| LOSE | 8/17 | 0 | — |
| **Main bet combined** | | | **2.94%** |
| Tie side bet | 1/17 = 5.88% | 90 000 (8:1 net = 9× gross) | **47.06%** |

Exact enumeration: 2652 ordered deals from 52-card deck (rank-only comparison, 4 suits × 13 ranks).

### Exposure Guard
- MAX_MULT_BPS: 90 000 (9×) on Tie side bet; main bet max = 20 000 (2×)
- max_bet (Tie) = 2700 / 9 = **300 EVE**; main bet max ~4500 EVE (conservative: use Tie cap)
- FLAG: Tie bet edge is 47% — standard Dragon Tiger, flag for Raw. Recommend: surface as side-bet with disclosure "High edge — thrill only."

### Abort Codes
- `EInvalidBet`: bet type not Dragon (0), Tiger (1), or Tie (2)
- `EMaxExposure`: wager × 90000 > bank × 300
- `EZeroWager`

### Animation Spec
- **Reuses:** `war.move` card-deal animation (flip two cards face-down, then reveal sequentially).
- **New for Dragon Tiger:**
  - Dragon card is labeled "DRAGON" / Tiger card labeled "TIGER" with faction-color highlight.
  - Tie outcome: both cards flash simultaneously with "TIE" glyph (◆), half-stake returned indicator.
  - Cards use EVE asset registry art if available; fallback to styled text glyphs.

### Move Build Plan
- Engine pattern: **instant**. Reuses `war.move` card-deal structure.
- Single 52-card deck; draw 2 distinct cards (Dragon, Tiger); rank comparison.
- `payout_for(amount, bet_type, dragon_rank, tiger_rank)` → pure math, exhaustively testable.
- `MAX_MULT_X = 9` (Tie bet drives exposure guard).

---

## Game 3: Risk Wheel

### Psychology Scorecard
| Lever | Score | Notes |
|-------|-------|-------|
| Anticipation window | ★★★ | Wheel decelerates over 3-4s; same spin animation all modes |
| Near-miss potential | ★★★ | Jackpot segment visible as wheel slows |
| Agency / skill illusion | ★★★★ | Mode selection = perceived skill/control (fills agency gap) |
| Volatility profile | L/M/VH | One game, three player temperaments |
| Session loop | ★★★ | Single spin per bet; tight loop |
| Streamable moment | ★★★ | HIGH mode 4.7× jackpot; visible on-screen during deceleration |

### Final Payout Table (bps)
All modes target 3.00% edge (RTP = 9700 bps). 20-segment wheel.

**LOW mode** (low variance, mostly break-even):
| Count | bps | Gross | Frequency |
|-------|-----|-------|-----------|
| 4 | 0 | lose | 20% |
| 15 | 9 000 | 0.90× | 75% |
| 1 | 59 000 | 5.90× | 5% |

**MED mode**:
| Count | bps | Gross |
|-------|-----|-------|
| 5 | 0 | lose |
| 10 | 6 000 | 0.60× |
| 3 | 30 000 | 3.00× |
| 2 | 22 000 | 2.20× |

**HIGH mode**:
| Count | bps | Gross |
|-------|-----|-------|
| 12 | 0 | lose (bust) |
| 4 | 10 000 | 1.00× (push) |
| 2 | 47 000 | 4.70× |
| 2 | 30 000 | 3.00× |

### Exposure Guard
- MAX_MULT_BPS: 59 000 (LOW's jackpot segment; highest across modes)
- max_bet = 2700 / 5.9 = **457 EVE**

### Abort Codes
- `EInvalidMode`: risk mode not 0 (LOW), 1 (MED), or 2 (HIGH)
- `EMaxExposure`
- `EZeroWager`

### Animation Spec
- **Reuses:** `wheel.move` spin stage wholesale.
- **New:** Mode selector UI (three tabs LOW/MED/HIGH above the wheel). Selected mode changes wheel segment color-coding (LOW: green/gray, MED: amber/gray, HIGH: red/black). EVE-industrial aesthetic.
- No new animation stages needed; segment table is a UI-side config.

### Move Build Plan
- Engine pattern: **instant**. Reuses `wheel.move` random segment selection.
- Mode param (0/1/2) → selects `SEGMENT_TABLE_LOW / MED / HIGH` constant vector.
- `payout_for(amount, segment, mode)` pure.
- Single module: `risk_wheel.move`. MAX_MULT_X = 6.

---

## Game 4: Money Wheel / Big Six

### Psychology Scorecard
| Lever | Score | Notes |
|-------|-------|-------|
| Anticipation window | ★★★★ | Premium deceleration — Big Six has the longest spin on the floor |
| Near-miss potential | ★★★ | Jackpot (45x/Joker) visible for 1-2 seconds at slow speed |
| Agency / skill illusion | ★★★ | Symbol selection feels like picking |
| Volatility profile | M | Spread from 1x-symbol grinder to 52x jackpot chaser |
| Session loop | ★★★ | One spin; medium speed |
| Streamable moment | ★★★★ | Joker/45x landing; 52x win = clip |

### Final Payout Table (bps — uniform 3.5% edge per bet type)
| Symbol | Segs | P(hit) | Payout (bps) | Gross | Edge |
|--------|------|--------|-------------|-------|------|
| 1x | 23 | 42.59% | 22 700 | 2.27× | 3.31% |
| 2x | 15 | 27.78% | 34 700 | 3.47× | 3.61% |
| 5x | 8 | 14.81% | 65 100 | 6.51× | 3.56% |
| 10x | 4 | 7.41% | 130 300 | 13.03× | 3.48% |
| 20x | 2 | 3.70% | 260 600 | 26.06× | 3.48% |
| 45x | 1 | 1.85% | 521 100 | 52.11× | 3.50% |
| Joker | 1 | 1.85% | 521 100 | 52.11× | 3.50% |

Formula: `payout_bps = round(9650 / P(symbol) / 100) × 100`

### Exposure Guard
- MAX_MULT_BPS: 521 100 (52.11×)
- max_bet = 2700 / 52.11 = **51 EVE** (per symbol bet)
- Note: player places one bet on one symbol; exposure is per-symbol, not total wheel.

### Abort Codes
- `EInvalidSymbol`: symbol_id not 0-6
- `EMaxExposure`: wager × 521100 > bank × 300
- `EZeroWager`

### Animation Spec
- **Reuses:** `wheel.move` spin stage.
- **New:** 54-segment wheel instead of 20; segment art uses EVE-themed icons (Ore for 1x, Hull for 2x, Module for 5x, Ship for 10x, Station for 20x, Keepership for 45x, Capsuleer Joker). 
- Player's chosen symbol is highlighted pre-spin. Landing glyph matches chosen symbol → win burst.
- Wheel deceleration: 4-5 seconds, slow-pan across jackpot segments.

### Move Build Plan
- Engine pattern: **instant**. Extend `wheel.move` to 54 segments.
- `SEGMENTS` vector of length 54; each entry = payout_bps for that segment.
- Player passes `symbol_bet` (0-6); win if `segment_symbol(landed_seg) == symbol_bet`.
- Pure `payout_for(amount, symbol_bet, landed_segment)`.
- MAX_MULT_X = 53 (ceiling of 52.11).

---

## Game 5: Plinko Risk Modes

### Psychology Scorecard
| Lever | Score | Notes |
|-------|-------|-------|
| Anticipation window | ★★★★ | Ball travels 12 rows; 2-3s descent, peg bouncing visible |
| Near-miss potential | ★★★★★ | Best near-miss in the catalog — ball stops one peg away from jackpot |
| Agency / skill illusion | ★★★ | Mode selection = player "chooses their destiny"; drop point = control illusion |
| Volatility profile | L/M/VH | LOW = grinder; HIGH = jackpot chaser |
| Session loop | ★★★ | Single drop; medium pace |
| Streamable moment | ★★★★ | HIGH edge jackpot 500× = definitive clip |

### Final Payout Table (bps)
12-row binomial, bucket k = number of right-pegs (0..12). Edge verified exact.

**LOW mode** (edge 3.52%, max 5×):
```
k:  0      1      2      3      4      5      6      5      4      3      2      1      0
   50000  20000  15000  12000  10000  8500   9000   8500  10000  12000  15000  20000  50000
```
(symmetric; k=6 is center = common landing)

**MED mode** (edge 4.02%, max 100×):
```
k:  0       1       2      3      4      5     6     5      4      3      2       1       0
   1000000 100000  30000  15000  11000  8500   0   8500  11000  15000  30000  100000  1000000
```
(center pays 0; edges pay 100× jackpot)

**HIGH mode** (edge 3.48%, max 500×):
```
k:  0        1       2      3     4     5    6   5     4     3      2       1        0
   5000000  500000  50000  10000  5000  1000  0  1000  5000  10000  50000  500000  5000000
```
(center = 0; edge jackpot 500×)

### Exposure Guard
- MAX_MULT_BPS: 5 000 000 (500×) for HIGH mode
- max_bet = 2700 / 500 = **5 EVE** in HIGH mode
- LOW max: 50 000 (5×) → max_bet 540 EVE; MED max: 1 000 000 (100×) → max_bet 27 EVE
- Contract uses single MAX_MULT_X = 500 (for all modes); max_bet applies to HIGH mode cap.

### Abort Codes
- `EInvalidMode`: mode not 0/1/2
- `EMaxExposure`
- `EZeroWager`

### Animation Spec
- **Reuses:** live `plinko.move` 12-row drop animation exactly.
- **New:** Mode selector (LOW/MED/HIGH) changes peg board color theme and multiplier display beside each bucket.
- HIGH mode: edge buckets glow in ACCENT color (#FF4700) during descent for suspense.

### Move Build Plan
- Engine pattern: **instant**. Extend `plinko.move` with mode param.
- Three `BUCKET_BPS` constant vectors indexed by mode.
- `payout_for(amount, bucket, mode)` pure.
- MAX_MULT_X = 500 (HIGH edge jackpot drives guard).

---

## Game 6: Scratch Cards

### Psychology Scorecard
| Lever | Score | Notes |
|-------|-------|-------|
| Anticipation window | ★★★ | Player controls reveal order — manufactured suspense |
| Near-miss potential | ★★★★★ | Two CAPSULE symbols showing = deliberate near-miss manufacture |
| Agency / skill illusion | ★★★★ | Scratch-order choice = strong control illusion |
| Volatility profile | M | 3-match frequent at 2500 bps; CAPSULE 9/9 = 100× cap |
| Session loop | ★★★ | Self-paced reveal; some hands are fast, some slow |
| Streamable moment | ★★★ | WEAPON/CAPSULE 9/9 reveal sequence = high-tension clip |

### Final Payout Table (bps)
9 tiles, 6 symbols, each tile drawn independently. Win = best match (≥3 same symbol).
On-chain MAX cap at 100× = 1 000 000 bps. MC RTP: **9706 bps (2.94% edge)** at 2 000 000 trials.

| Symbol | Weight | 3m | 4m | 5m | 6m | 7m | 8m | 9m (bps) |
|--------|--------|-----|-----|-----|-----|-----|-----|----------|
| ORE | 30% | 2 500 | 6 400 | 19 000 | 80 000 | 260 000 | 960 000 | 4 800 000 |
| HULL | 25% | 1 600 | 4 800 | 14 400 | 57 000 | 192 000 | 640 000 | 2 560 000 |
| MOD | 20% | 1 000 | 2 900 | 9 000 | 35 000 | 112 000 | 352 000 | 1 280 000 |
| SHIELD | 13% | 4 800 | 14 400 | 44 800 | 176 000 | 576 000 | 1 920 000 | 9 600 000 |
| WEAPON | 8% | 8 000 | 25 000 | 80 000 | 320 000 | 1 000 000 | 3 000 000 | 10 000 000 |
| CAPSULE | 4% | 19 000 | 70 000 | 288 000 | 1 000 000 | 4 000 000 | 10 000 000 | 10 000 000 |

On-chain contract caps all payouts at 1 000 000 bps (100×). Rarer CAPSULE hits ≥6 are treated as 100× wins.

### Exposure Guard
- MAX_MULT_BPS: 1 000 000 (100×) — contract-enforced cap
- max_bet = 2700 / 100 = **27 EVE**

### Abort Codes
- `EMaxExposure`
- `EZeroWager`
- (No user-configurable params beyond wager)

### Animation Spec
- **New UI** (light build; reuses Mines' tile-reveal visual system).
- 3×3 grid of face-down tiles; player clicks/taps each in any order to reveal.
- Each reveal: tile flips with 0.2s animation → symbol glyph appears.
- After all 9 revealed: system calculates best match → win announcement.
- Near-miss: if 2× CAPSULE are visible before final tile, the 3rd tile "vibrates" during countdown (hooks attention).
- Win burst: matching symbols highlight + pulse; payout slides in from right.
- EVE symbols use ore/module/ship class glyphs from asset registry.

### Move Build Plan
- Engine pattern: **instant**.
- On-chain: single random u64 seed → deterministic draw of 9 tiles.
- `draw_tiles(g: &RandomGenerator): vector<u8>` draws 9 tile indices; each maps to symbol via weight table.
- `payout_for(amount, tiles: &vector<u8>): u64` pure; counts symbols, selects best match, caps at MAX_MULT.
- Event carries full tile layout for provably-fair replay.

---

## Game 7: Andar Bahar

### Psychology Scorecard
| Lever | Score | Notes |
|-------|-------|-------|
| Anticipation window | ★★★★★ | Variable-length reveal (1–40+ cards); escalating tension unlike any fixed-deal game |
| Near-miss potential | ★★★★ | "It almost went Andar!" on long Bahar runs |
| Agency / skill illusion | ★★★ | Andar vs Bahar choice; joker card seen first adds perceived read |
| Volatility profile | M | Even-money-ish; session volatility moderate |
| Session loop | ★★★ | Variable deal time; avg 13 cards keeps it snappy |
| Streamable moment | ★★★★ | 30-40-card deal before resolution = max suspense clip |

### Final Payout Table (bps)
MC 5 000 000 trials. P(Andar wins) = 0.514847 (deals first, exact math confirmed).

| Bet | P(win) | Payout (bps) | RTP | Edge |
|-----|--------|-------------|-----|------|
| Andar | 51.48% | 18 800 | 96.79% | 3.21% |
| Bahar | 48.52% | 20 000 (even money) | 97.03% | 2.97% |

Avg deal length: 13 rounds. Andar discount priced in via lower payout.

### Exposure Guard
- MAX_MULT_BPS: 20 000 (2×)
- max_bet = 2700 / 2 = **1 350 EVE**

### Abort Codes
- `EInvalidSide`: side not 0 (Andar) or 1 (Bahar)
- `EMaxExposure`
- `EZeroWager`

### Animation Spec
- **New UI** on **reused card-deal engine** (war.move / blackjack_live.move).
- Joker card flips first, center-screen with rank visible.
- Two columns (Andar left, Bahar right) accumulate cards one at a time with 0.3s between each.
- Matching card: slow flip + rank glow → winning side flashes → payout.
- Variable deal = natural suspense ratchet; no artificial timer needed.
- Card art from EVE asset registry; fallback to styled rank/suit glyphs (webview-safe Unicode ◆ ♣).

### Move Build Plan
- Engine pattern: **instant** (all cards dealt in one tx).
- Shuffle 52-card deck; draw joker (deck[0]); scan deck[1..] alternately for rank match.
- `deal_result(g: &RandomGenerator): (u8, u8, vector<u8>)` → (winner_side, joker_rank, full_deal_log).
- `payout_for(amount, bet_side, winner_side)` pure.
- Event emits full deal log for provably-fair client-side replay animation.

---

## Game 8: Ore Refine Gamble

### Psychology Scorecard
| Lever | Score | Notes |
|-------|-------|-------|
| Anticipation window | ★★★★ | Refinery-glow loading bar = EVE-native reveal animation |
| Near-miss potential | ★★★★ | PARTIAL on Tier-5 = "almost BONUS"; slag explosion = strong emotional hit |
| Agency / skill illusion | ★★★★★ | Intensity selection maps to EVE decision loop — feels native, not gambled |
| Volatility profile | H | High bust rate at T5; near-turbo grinder at T1 |
| Session loop | ★★★ | Single outcome; medium pace |
| Streamable moment | ★★★★ | Tier-5 BONUS (20×) = 135 EVE → big clip at max bet |

### Final Payout Table (bps — all tiers solved algebraically to 3.00% edge)

| Tier | SLAG (p) | PARTIAL (p · bps) | YIELD (p · bps) | BONUS (p · bps) | MaxMult |
|------|----------|-------------------|-----------------|-----------------|---------|
| 1 | 3.00% · 0 | 38.40% · 8 000 | 53.60% · 10 500 | 5.00% · 20 000 | 2× |
| 2 | 8.00% · 0 | 45.67% · 5 000 | 38.33% · 11 000 | 8.00% · 40 000 | 4× |
| 3 | 15.00% · 0 | 60.50% · 3 000 | 14.50% · 13 000 | 10.00% · 60 000 | 6× |
| 4 | 25.00% · 0 | 63.85% · 2 000 | 6.15% · 15 000 | 5.00% · 150 000 | 15× |
| 5 | 40.00% · 0 | 49.29% · 1 000 | 6.71% · 18 000 | 4.00% · 200 000 | 20× |

Verification: each tier sum(p_i × payout_i) = 9700 bps exactly.

### Exposure Guard
- MAX_MULT_BPS: 200 000 (20×) — Tier 5 BONUS
- max_bet = 2700 / 20 = **135 EVE**

### Abort Codes
- `EInvalidTier`: tier not 1-5
- `EMaxExposure`
- `EZeroWager`

### Animation Spec
- **New EVE-native UI** (Category J moat design).
- Control: Intensity slider 1-5, labeled BASIC / STANDARD / ADVANCED / INDUSTRIAL / CRITICAL.
- Animation: refinery intake → glowing processing bar (duration scales with tier: T1=1s, T5=3s) → outcome reveal:
  - SLAG: dark explosion, debris particles, "CONTAMINATED ORE" in red
  - PARTIAL: partial glow, small yield bar, amber
  - YIELD: full glow, clean extraction, green
  - BONUS: full glow + secondary "RARE ISOTOPE" flash, gold (GOLD #E8B84B)
- EVE ore-type imagery from asset registry for each tier background.

### Move Build Plan
- Engine pattern: **instant**.
- `roll_outcome(g: &RandomGenerator, tier: u8): u8` → 0=SLAG, 1=PARTIAL, 2=YIELD, 3=BONUS.
- Probabilities encoded as cumulative u16 thresholds (scaled to 10000) per tier.
- `payout_for(amount, outcome, tier)` pure; each tier-outcome pair has exact bps.
- Probabilities stored as on-chain constants (scaled ints, no floats needed in Move).

---

## Game 9: Keno Extended

### Psychology Scorecard
| Lever | Score | Notes |
|-------|-------|-------|
| Anticipation window | ★★★★ | 10 draws with per-number reveal animation; number-call cadence |
| Near-miss potential | ★★★★★ | 9/10 match = strongest catalog near-miss for high-pickers |
| Agency / skill illusion | ★★★★ | Pick-number selection = maximal perceived skill |
| Volatility profile | VH | High-pick = jackpot lottery; Pick-1 = mild |
| Session loop | ★★★ | 10-ball draw; medium pace |
| Streamable moment | ★★★★★ | 10/10 perfect match = definitive clip |

### Final Payout Table (bps)
Pool=40, Draw=10 (confirmed from `keno.move` source: `POOL=40, DRAW=10`). Extends live MAX_PICKS=6 → 10.

**Live picks 1-6 (unchanged):**
| Pick | RTP% | Edge% | Paytable |
|------|------|-------|----------|
| 1 | 96.25% | 3.75% | {1: 38500} |
| 2 | 75.00% | 25.00% | {2: 130000} |
| 3 | 30.36% | 69.64% | {3: 250000} |
| 4 | 19.20% | 80.80% | {3: 5000, 4: 750000} |
| 5 | 14.51% | 85.49% | {3: 2000, 4: 15000, 5: 3000000} |
| 6 | 10.37% | 89.63% | {3: 1500, 4: 5000, 5: 100000, 6: 9700000} |

**Extended picks 7-10 (new — jackpot mode):**
| Pick | RTP% | Edge% | Paytable |
|------|------|-------|----------|
| 7 | 0.38% | 99.62% | {4: 200, 5: 1000, 6: 10000, 7: 3000000} |
| 8 | 0.30% | 99.70% | {4: 100, 5: 500, 6: 5000, 7: 80000, 8: 10000000} |
| 9 | 0.29% | 99.71% | {4: 50, 5: 200, 6: 2000, 7: 30000, 8: 1000000, 9: 50000000} |
| 10 | 0.32% | 99.68% | {4: 30, 5: 100, 6: 1000, 7: 10000, 8: 300000, 9: 10000000, 10: 100000000} |

**Mathematical fact:** P(10/10) = 1.18×10⁻⁹. Even 10 000× jackpot contributes only 0.12 bps RTP. Achieving 3-4% edge for picks 7-10 is **mathematically impossible** within a 10 000× cap. Industry-standard for high-pick Keno.

### Exposure Guard
- MAX_MULT_BPS: 100 000 000 (10 000×) for Pick-10 — requires max_bet < 1 EVE
- max_bet = 2700 / 10000 = **0.27 EVE** (below practical minimum)
- FLAG FOR RAW: Either (a) set pick-10 max bet to minimum denomination, OR (b) cap at 5000× and adjust top prize, OR (c) pick-10 jackpot uses a separate pool accumulator rather than house-bank direct payout.

### Abort Codes
- `EInvalidPickCount`: picks outside 1-10
- `EInvalidPicks`: picks out of range 1-40 or duplicates
- `EMaxExposure`: requires per-pick-count max_bet table
- `EZeroWager`

### Animation Spec
- **Reuses:** live Keno ball-draw animation.
- **New:** pick-count selector extends from 6 to 10 (UI addition only).
- High-pick near-miss: when 9/10 drawn, the last ball drawn slowly reveals with dramatic pause.
- Pick-10 jackpot: full-screen "PERFECT DRAW" reveal sequence.

### Move Build Plan
- Engine pattern: **instant**. Extend `keno.move` MAX_PICKS from 6 → 10.
- Extend `multiplier_bps(n, m)` lookup to cover picks 7-10 paytables.
- Extend `valid_picks` guard to n ≤ 10.
- MAX_MULT_X = 10000 (requires new exposure formula for per-pick-count max bets).
- **FLAG:** exposure guard needs per-pick-count max_bet array, not single constant.

### Gate-0 Verdict: **FLAG-FOR-RAW**
Picks 7-10 edge is 99%+ — mathematically unavoidable. Raw must decide: ship as jackpot lottery with explicit disclosure, cap at pick-6, or implement jackpot-pool accumulator. Pick-1 edge (3.75%) is in range; live picks 1-6 are unchanged.

---

## Game 10: Caribbean Stud Poker [Stateful]

### Psychology Scorecard
| Lever | Score | Notes |
|-------|-------|-------|
| Anticipation window | ★★★★ | Dealer up-card + fold/call decision = richest strategic moment in catalog |
| Near-miss potential | ★★★★ | "Almost had a straight flush" on 4-card draws |
| Agency / skill illusion | ★★★★★ | Fold/call decision with visible info = pure skill illusion peak |
| Volatility profile | M | Frequent pair wins; rare Royal 100× raise = jackpot peak |
| Session loop | ★★★ | 5-card deal + decision + reveal; medium pace |
| Streamable moment | ★★★★★ | Royal flush 100× raise on 2-unit stake = 200× ante return = definitive clip |

### Final Payout Table (bps)
MC 2 000 000 hands. Fold rate: 39.5%. Raise rate: 60.5%.

**Main bet outcomes:**
| Event | Ante result | Raise result |
|-------|-------------|-------------|
| Fold | Lose ante | — |
| Dealer doesn't qualify | Win 1:1 on ante | Raise returned (push) |
| Qualify + player wins | Win 1:1 on ante | Bonus by hand rank |
| Qualify + push | Ante returned | Raise returned |
| Qualify + dealer wins | Lose ante | Lose raise |

**Raise bonus paytable (bps on raise amount):**
| Hand | Raise bonus (bps) | Net |
|------|------------------|-----|
| Royal Flush | 1 000 000 | 100× raise |
| Straight Flush | 500 000 | 50× raise |
| Quads | 200 000 | 20× raise |
| Full House | 70 000 | 7× raise |
| Flush | 50 000 | 5× raise |
| Straight | 40 000 | 4× raise |
| Trips | 30 000 | 3× raise |
| Two Pair | 20 000 | 2× raise |
| Pair | 10 000 | 1× raise |

**Edge results:**
- House profit vs ante only: **6.08%** (standard Caribbean Stud range; ante edge always higher than total-wagered edge)
- **Edge vs total wagered: 2.75%** — the fair comparison; within 2-5% target
- Avg total wagered per hand: 2.21× ante (raise rate × raise size)

**Strategy used (approximate optimal):** Raise with pair+, A-K high, or A/K pairing dealer's up-card. This is ~optimal play.

### Exposure Guard
- MAX_MULT_BPS: 1 000 000 (100× on raise). Raise = 2× ante, so max stake-equivalent = 200× ante.
- For exposure guard: use raise bet as the exposure unit.
  max_raise = 2700 / 100 = 27 EVE (raise). Ante = 13.5 EVE.
- max_bet (ante): **27 EVE** (then raise adds 2× = 54 EVE total exposure).

### Abort Codes
- `EInvalidAction`: action not FOLD or RAISE
- `EMaxExposure`: raise × 1000000 > bank × 300
- `EZeroWager`
- `EGameNotFound`: session object not owned by sender
- `EAlreadySettled`: session already resolved

### Animation Spec
- **Reuses:** `blackjack_live.move` commit-reveal + card-deal animation.
- **New:**
  - 5-card player hand + 1 dealer card (face-up) displayed side-by-side.
  - Fold / Raise button pair (portal-mounted, no native elements). Raise button shows "2× [bet] EVE".
  - After raise: await reveal tx. Dealer flips remaining 4 cards.
  - Qualify check displayed: "DEALER QUALIFIES ✓" or "NO QUALIFY — ANTE WINS".
  - Hand comparison: winning hand highlights with glow + rank label.
  - Royal flush: full-screen "ROYAL FLUSH" reveal with GOLD (#E8B84B) burst.
- Cards use EVE asset registry art; webview-safe Unicode suit glyphs (◆ ♣ ♥ ♠ as fallback).

### Move Build Plan
- Engine pattern: **stateful** (commit-reveal, player-owned session object). Follows `blackjack_live.move` pattern.
- **Phase 1 (deal):** shuffle 52-card deck using `&Random`; store in `GameSession` object. Emit player's 5 cards + dealer's face-up card. Player owns `GameSession`.
- **Phase 2 (action):** player calls `fold(session)` or `raise(session, raise_coin)`. Fold settles immediately. Raise requires raise_coin = 2× original ante (enforced by coin amount check).
- **Phase 3 (resolve, same tx as raise):** deterministic from stored deck; no new randomness. Evaluate hands, apply bonus table, settle payouts.
- `GameSession` auto-expires (or abandoned-settle fallback) per `blackjack_live.move` pattern.
- Video-poker hand evaluator (`hand_category`) shared via a `poker_hand.move` helper module (usable by future poker games).

### Gate-0 Verdict: **FLAG-FOR-RAW**
Ante-edge 6.08% is the standard Caribbean Stud figure. Total-wagered edge 2.75% is within the 2-5% target. Flag for Raw sign-off on: (a) reporting convention (use total-wagered edge in all public materials), (b) stateful build cost confirmation (≥3× instant cost), (c) whether the Royal Flush 100× bonus is acceptable at the 27-EVE max raise.

---

## Batch Shape Summary

| Category | Games | Notes |
|----------|-------|-------|
| Pure engine-reuse (cheap) | 1, 3, 5 | Paytable-only variant of existing module |
| New instant (light UI) | 2, 4, 6, 7, 8 | New module, existing animation stages |
| Extension (extend live game) | 9 | keno.move MAX_PICKS 6→10 + paytable |
| Stateful flagship | 10 | Full commit-reveal, new escrow object |
| EVE-native moat | 8 | Ore Refine — category J anchor |

**Catalog fills:** Low-vol gap (games 1,2,3-LOW,5-LOW), selectable-volatility (3,5), mid-vol (4,6,7), high-vol jackpot (8,9,10).

**9 instant games: GO for Stage 1 → Stage 2 build.**
**1 stateful game: FLAG-FOR-RAW on edge convention + build cost. Likely GO after Raw sign-off.**
