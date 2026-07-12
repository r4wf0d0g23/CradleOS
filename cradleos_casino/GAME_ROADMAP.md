# CradleOS Casino — Game Roadmap (Directive)

**Status:** ACTIVE DIRECTIVE (v1, 2026-07-11) — per Raw
**Mandate:** Build out **no fewer than 100 games**, each shipped through the 5-stage `GAME_DEV_PROTOCOL.md` (Discovery → Design → Build → Polish → Launch). Long-horizon development. Navigation must scale to hold the full catalog.
**Doctrine:** Quality > MVP. Versatility = product. First-choice EVE Frontier casino platform. No game skips a protocol gate; every game ships with cutting-edge animated UI.

> This is a living directive. Games move from PLANNED → IN-PROGRESS → LIVE as they clear Gate 4. Add/re-prioritize freely; never drop the ≥100 target without Raw sign-off.

---

## Status legend
- ✅ LIVE — through Gate 4, playable on cradleos.io
- 🔨 BUILD — in Stages 1-3
- 📋 PLANNED — awaiting Stage 0 greenlight
- Build class: **[I]** instant single-tx · **[S]** stateful commit-reveal · **[M]** multiplayer/shared-round (future infra)
- Variance: L(low) / M(med) / H(high) / VH(very high)

---

## LIVE TODAY (23 games)
Original 6 + three 2026-07-11 batches + three_card_poker (was live, not listed) + 2026-07-12 batch (3 new games).
These retroactively define the catalog baseline; several predate the protocol and will get a Stage-3 polish pass.

| # | Game | Class | Var | Notes |
|---|------|-------|-----|-------|
| 1 | Blackjack (interactive) | S | M | flagship, hit/stand/double/split |
| 2 | Coinflip | I | M | 1.96x |
| 3 | Dice (over/under) | I | L-VH | scalable line |
| 4 | Roulette (European) | I | L-VH | straight→36x |
| 5 | Slots (3-reel) | I | H | 60x |
| 6 | Wheel of Fortune | I | M | 10x |
| 7 | Limbo | I | VH | 1000x cap |
| 8 | Hi-Lo | I | M | next-card |
| 9 | Plinko | I | H | 12-row, 130x |
| 10 | Keno | I | H | pick 1-6 of 40 |
| 11 | Sic Bo | I | M-H | 3-dice |
| 12 | Mines | S | H | 5x5, cash-out |
| 13 | Crash | I | VH | rocket climb |
| 14 | Diamonds | I | H | 5-gem sets, 500x |
| 15 | Double Dice | I | M | 2-dice bets |
| 16 | War | I | L | high card |
| 17 | Baccarat | I | L | P/B/T |
| 18 | Dragon Tower | S | H | climb 9 rows |
| 19 | Video Poker (Jacks+) | S | M-H | draw/hold |
| 20 | Three Card Poker | I | H | ante + bonus payouts up to 6x |
| 21 | Dragon Tiger | I | L | two-card duel, 2.94% edge, 2× win / 9× tie |
| 22 | Under/Over 7 | I | L | two dice, UNDER/7/OVER, 3.33%/5.0% edge |
| 23 | Ore Refine Gamble | I | H | EVE-native, 5 tiers, 3.0% edge, 20× max |

---

## PLANNED CATALOG (targets to reach 100+)

### A. DICE & NUMBER (target ~15)
| # | Game | Class | Var | Mechanic hook |
|---|------|-------|-----|---------------|
| 20 | Chuck-a-Luck | I | M | 3-dice birdcage, single-number |
| 21 | Under/Over 7 | I | L | classic street dice |
| 22 | Craps (Pass/Don't) | S | M | come-out + point rounds |
| 23 | Craps (Field/Prop bets) | I | H | single-roll props |
| 24 | Banca Francesa | I | L | Portuguese 3-dice |
| 25 | Grand Hazard | I | H | 3-dice combos |
| 26 | Klondike (dice) | I | M | player vs banker 5-dice |
| 27 | Yahtzee-style Poker Dice | S | H | 5 dice, hold/reroll |
| 28 | Threes | I | M | drop-low 5-dice |
| 29 | Ricochet (rapid dice) | I | L | fast-loop grinder |
| 30 | Number Range Roll | I | L-VH | pick a d100 range |
| 31 | Odd/Even streak | I | H | parlay chain |
| 32 | Lucky Number (d1000) | I | VH | 1-in-1000 jackpot |
| 33 | Balut | S | H | poker-dice variant |
| 34 | Pig (press-your-luck dice) | S | H | bank-or-roll |

### B. WHEELS & SPINNERS (target ~10)
| # | Game | Class | Var | Mechanic hook |
|---|------|-------|-----|---------------|
| 35 | American Roulette (00) | I | L-VH | double-zero variant |
| 36 | Mini Roulette (13-pocket) | I | M | faster, higher edge |
| 37 | Money Wheel (Big Six) | I | M | 54-segment |
| 38 | Risk Wheel (low/med/high) | I | L-VH | selectable volatility |
| 39 | Bonus Wheel (multipliers) | I | H | streak-triggered |
| 40 | Dreamcatcher-style | I | H | segment + multiplier spins |
| 41 | Spin-the-Bottle range | I | M | arc-target |
| 42 | Fortune Spinner (jackpot) | I | VH | progressive-feel top seat |
| 43 | Color Wheel | I | L | RGB simple bet |
| 44 | Zodiac Wheel | I | H | 12-sign themed |

### C. CARDS — house-banked (target ~18)
| # | Game | Class | Var | Mechanic hook |
|---|------|-------|-----|---------------|
| 45 | Baccarat (side bets) | I | H | pairs/perfect-pair |
| 46 | Blackjack (multi-hand) | S | M | play 3 hands |
| 47 | Blackjack Switch | S | M | swap top cards |
| 48 | Spanish 21 | S | M | no-tens variant |
| 49 | Pontoon | S | M | UK blackjack |
| 50 | Three Card Poker (pair-plus) | I | H | ante + pair-plus side bet |
| 51 | Four Card Poker | S | H | ante/aces-up |
| 52 | Caribbean Stud | S | M | ante/call vs dealer |
| 53 | Casino Hold'em | S | M | community cards |
| 54 | Ultimate Texas Hold'em | S | H | escalating raises |
| 55 | Let It Ride | S | M | pull-back bets |
| 56 | Red Dog (Acey-Deucey) | I | M | spread bet |
| 57 | Casino War (with tie war) | S | L | tie-goes-to-war |
| 58 | Deuces Wild (video poker) | S | H | wild-card VP |
| 59 | Joker Poker (video poker) | S | H | 53-card VP |
| 60 | Double Bonus Poker | S | H | VP paytable variant |
| 61 | Tens or Better | S | M | easier VP |
| 62 | Mississippi Stud | S | H | escalating 3-street raises |

### D. PACHINKO / DROP / PHYSICS (target ~8)
| # | Game | Class | Var | Mechanic hook |
|---|------|-------|-----|---------------|
| 63 | Plinko (risk modes) | I | L-VH | low/med/high peg tables |
| 64 | Plinko (16-row) | I | VH | deeper board, bigger edges |
| 65 | Pachinko | I | H | multi-path ball |
| 66 | Ball Drop Grid | I | M | choose a column |
| 67 | Marble Race (pick lane) | I | M | first-past-post |
| 68 | Bounce (physics multiplier) | I | H | ricochet target |
| 69 | Peg Cascade | I | H | chained multipliers |
| 70 | Gravity Wells | I | VH | rare-slot drop |

### E. GRID / REVEAL / PICK (target ~12)
| # | Game | Class | Var | Mechanic hook |
|---|------|-------|-----|---------------|
| 71 | Mines (variable grid 3x3–7x7) | S | L-VH | selectable size |
| 72 | Towers (Dragon Tower variants) | S | H | more difficulty tiers |
| 73 | Keno (pick up to 10/40) | I | VH | extended picks |
| 74 | Scratch Cards | I | M | reveal-to-match |
| 75 | Treasure Map (path pick) | S | H | branching cash-out |
| 76 | Minefield Sweeper | S | VH | flag-and-reveal |
| 77 | Hi-Lo Ladder | S | VH | consecutive climbs |
| 78 | Pick-a-Box (Monty) | I | M | 3-door + switch |
| 79 | Gem Miner (dig depth) | S | H | depth = multiplier |
| 80 | Bombs & Gold | S | H | reveal grid, cash-out |
| 81 | Lucky Panels | I | M | match-3 reveal |
| 82 | Vault Cracker | S | VH | sequential digit pick |

### F. CRASH / MULTIPLIER / TIMING (target ~8)
| # | Game | Class | Var | Mechanic hook |
|---|------|-------|-----|---------------|
| 83 | Crash (live climb, manual cashout) | S | VH | real-time hold |
| 84 | Slide | I | VH | shared-seed multiplier slide |
| 85 | Rocket Rush | I | VH | crash re-theme, faster |
| 86 | Multiplier Ladder | S | VH | step-up cash-out |
| 87 | Cash or Crash | S | H | 3-choice hold |
| 88 | Hot Potato (timing) | I | M | cash before bust tick |
| 89 | Elevator | S | VH | floor-by-floor climb |
| 90 | Meteor Dodge | S | H | survive-N multiplier |

### G. SLOTS & REELS (target ~12)
| # | Game | Class | Var | Mechanic hook |
|---|------|-------|-----|---------------|
| 91 | Slots (5-reel, paylines) | I | H | multi-line |
| 92 | Slots (megaways-style) | I | VH | variable reel heights |
| 93 | Slots (cluster-pays) | I | H | match-adjacency |
| 94 | Fruit Machine (classic) | I | M | nudge/hold feel |
| 95 | EVE-themed reel (ships/ore) | I | H | lore skin |
| 96 | Jackpot Slots (progressive-feel) | I | VH | top-prize chase |
| 97 | Hold-and-Spin slots | S | H | lock symbols, respin |
| 98 | Scatter Hunt | I | H | scatter-triggered bonus |
| 99 | Wild Lines | I | H | expanding wilds |
| 100 | Free-Spin Bonus reel | S | VH | trigger + bonus round |
| 101 | 3x3 Grid Slot | I | M | simple modern reel |
| 102 | Reactor Reels (EVE) | I | H | cascading wins |

### H. DUELS & HEAD-TO-HEAD (target ~8)
| # | Game | Class | Var | Mechanic hook |
|---|------|-------|-----|---------------|
| 103 | Dragon Tiger | I | L | two-card duel |
| 104 | Andar Bahar | I | M | match-the-card sides |
| 105 | Teen Patti | S | H | Indian 3-card |
| 106 | Top Card | I | L | single-draw duel |
| 107 | Rock-Paper-Scissors (vs house) | I | L | 3-way with edge |
| 108 | Higher Hand (5-card duel) | I | M | poker-rank vs house |
| 109 | Fast Duel (rapid) | I | L | speed grinder |
| 110 | Card Clash (best-of-3) | S | M | series duel |

### I. LOTTERY & JACKPOT (target ~6)
| # | Game | Class | Var | Mechanic hook |
|---|------|-------|-----|---------------|
| 111 | Instant Lottery (pick 6) | I | VH | draw-match |
| 112 | Raffle Draw (ticket pool) | M | VH | shared-round (future) |
| 113 | Number Bingo (auto) | I | H | line-completion |
| 114 | Wheel Jackpot (progressive) | I | VH | pooled top prize |
| 115 | Golden Ticket | I | VH | rare instant-win |
| 116 | Lucky Draw (daily) | M | VH | scheduled shared draw |

### J. EVE-FRONTIER NATIVE / NOVELTY (target ~8) — our differentiator
Games themed to EVE Frontier lore/mechanics — nobody else can build these. Strong catalog moat.
| # | Game | Class | Var | Mechanic hook |
|---|------|-------|-----|---------------|
| 117 | Ore Refine Gamble | I | H | risk raw ore → refined multiplier |
| 118 | Jump Gate Roulette | I | M | pick a destination system |
| 119 | Smartgate Heist (Mines-skin) | S | H | avoid turrets, grab loot |
| 120 | Killmail Bounty Spin | I | H | wheel of ship-kill payouts |
| 121 | Fuel Gamble (jump-range) | I | M | over/under on jump distance |
| 122 | Tribe Wars Duel | I | M | tribe-vs-tribe card clash |
| 123 | Anomaly Dive (crash-skin) | S | VH | descend into an anomaly |
| 124 | Keeper's Vault (jackpot) | S | VH | lore-gated progressive |

---

## Totals
- **Live now:** 23 (updated 2026-07-12: +three_card_poker retroactive + dragon_tiger + under_over_7 + ore_refine)
- **Planned:** 105 distinct games across 10 categories (A–J), IDs 20–124 above (de-duplicated 2026-07-11: Dragon Tiger consolidated at #103; #84 placeholder replaced with Slide).
- **Grand total (live + planned): 124 distinct games** — 24 games of margin above the 100 floor for Gate-0 cuts.
- **Grand target:** 100+ concurrently live. Runway sits well above the floor so we can cut weak candidates at Gate 0 and still clear 100.

## Prioritization heuristic (which to build next)
1. **Variance-gap fill** — build into under-served volatility niches first (protocol Stage 0 catalog-fit).
2. **Reuse leverage** — games that reuse an existing engine (roulette/slots/plinko/crash/mines variants) are cheap; batch them.
3. **EVE-native moat** — category J games are the differentiator; interleave them to keep the catalog unique.
4. **Instant before stateful** — [I] games are ~1/3 the build cost; front-load them for catalog-count velocity, reserve [S] builds for high-engagement mechanics.
5. **Foundations before flood** — the NAV_PLAN lobby (Phase 1) and Stage-3 polish passes on the pre-protocol live games ship before the catalog crosses ~25; retention on the first 19 beats raw count.
6. **Bank-aware sequencing** — don't stack multiple new VH-variance launches in the same window; model combined risk-of-ruin against the current house bank before each batch.

## Navigation (must scale to 100+) — see NAV_PLAN below
Current flat tab bar (19 tabs) does NOT scale. Redesign required before catalog crosses ~25 games.

---

## Continuous
Every game clears `GAME_DEV_PROTOCOL.md`. Post-launch retros feed both the protocol and this roadmap. Re-rank quarterly. This directive stands until 100+ are live and healthy.

---

## Progress Log

### 2026-07-12 — Batch run (casino-roadmap-builder cron)

**Games advanced to LIVE:**
- **Dragon Tiger (#103)** — [I], Var L — v16 pkg `0x771ecec5`, smoke Digest `GaCfLgNipsoH5vKwuQvRPVct68HtcA8Mt8m2zsaTEi2M`. Dragon 9 > Tiger 3, payout 2x ✓
- **Under/Over 7 (#21)** — [I], Var L — v16 pkg, smoke Digest `8ojVZdfpM2L2wfycJAcU6VQkFmLc1wcZm3m312zvDeYG`. d1+d2=7, bet UNDER → LOSS ✓
- **Ore Refine Gamble (#117)** — [I], Var H, Category J — v16 pkg, smoke Digest `7CttzfKfDy92qvmX5kGzAdUA4tnSNEXiR27TtR59svFR`. Tier 3 PARTIAL, payout match exact ✓

**On-chain:** v16 = `0x771ecec58588d78ac75da040ae58cde42bbedab433d698970098eb2525e53b92` (type-introducing) / v17 = `0x24500dde39bf459e88341ee68427dea72a883bad6149c8a86096ba506f91702c` (CASINO_PKG, double-publish)

**Fixed:** plinko.move EBadCount missing constant (103/103 tests green).

**Fixed pre-existing:** casino3d/controls.ts + hud.tsx stubs (TSC 0 errors, unblocked build).

**Deployed:** CF Pages `index-BH18SsdV.js` (v17 id verified) + gh-pages `index-C6ZFgavC.js` (v17 id verified). Both live.

**Catalog:** 23 live games. Total (live + planned): 124.

**NEXT RUN SHOULD PICK:**
1. Risk Wheel (#38) — engine reuse (wheel.move), 3 mode tables, pure paytable, Gate-1 spec done
2. Money Wheel / Big Six (#37) — wheel engine, 54-segment, Gate-1 spec done
3. Andar Bahar (#104) — card deal engine, variable-length reveal, Gate-1 spec done
Priority: all three are instant, all have Gate-1 designs in BATCH_01_DESIGNS.md.
