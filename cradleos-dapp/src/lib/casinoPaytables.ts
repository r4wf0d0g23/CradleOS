/**
 * CradleOS Casino — centralized paytables (single source of truth for the UI).
 *
 * Every entry MIRRORS the on-chain Move contract in
 * `frontier/cradleos_casino/sources/<game>.move`. Multipliers are the GROSS
 * return on the player's bet (2x = wager doubled). Probabilities and RTP were
 * verified against the exact contract math (see memory/2026-07-12.md — slots,
 * and code_execution enumerations for the rest).
 *
 * If a contract's payout constants change, update the matching entry here.
 * Games with player-chosen odds (dice, limbo, crash, keno, roulette-straight)
 * describe the rule instead of a fixed row table.
 *
 * SLOT_SYMBOLS lives in casinoGames.ts; slots keeps its own richer renderer in
 * InstantGamePanel (glyph triples). Everything else uses PAYTABLES here.
 */

export interface PaytableRow {
  label: string;      // what the player matched / bet
  mult: string;       // gross multiplier text, e.g. "2x", "1.95x", "36x"
  prob?: string;      // probability text, e.g. "48.6%", "1/37" (optional)
  top?: boolean;      // highlight (jackpot / best outcome)
}

export interface Paytable {
  rows: PaytableRow[];
  rtp: string;        // e.g. "98.0%"
  edge: string;       // e.g. "2.0%"
  note?: string;      // extra rule text (variable-odds games, ties, etc.)
}

// ── Fixed-table games ─────────────────────────────────────────────────────────
export const PAYTABLES: Partial<Record<string, Paytable>> = {
  coinflip: {
    rows: [{ label: "correct call (heads / tails)", mult: "1.96x", prob: "50%" }],
    rtp: "98.0%", edge: "2.0%",
    note: "Pick heads or tails. Even-money game shaved 2% — win pays 1.96x.",
  },

  roulette: {
    rows: [
      { label: "straight (single number)", mult: "36x", prob: "1/37", top: true },
      { label: "dozen / column", mult: "3x", prob: "12/37" },
      { label: "red-black / odd-even / 1-18·19-36", mult: "2x", prob: "18/37" },
    ],
    rtp: "97.3%", edge: "2.7%",
    note: "European single-zero wheel (0-36). Zero loses all even-money/outside bets — the house edge.",
  },

  wheel: {
    rows: [
      { label: "10x segment", mult: "10x", prob: "1/20 (5%)", top: true },
      { label: "1.6x segment", mult: "1.6x", prob: "2/20 (10%)" },
      { label: "1.2x segment", mult: "1.2x", prob: "5/20 (25%)" },
      { label: "0x segment", mult: "0x", prob: "12/20 (60%)" },
    ],
    rtp: "96.0%", edge: "4.0%",
    note: "20-segment wheel. One 10x, two 1.6x, five 1.2x, twelve blanks.",
  },

  war: {
    rows: [
      { label: "your card higher", mult: "2x", prob: "46.15%" },
      { label: "tie (equal rank)", mult: "0.5x", prob: "7.69%", top: true },
      { label: "dealer higher", mult: "0x", prob: "46.15%" },
    ],
    rtp: "96.15%", edge: "3.85%",
    note: "One card each (rank only, 13 ranks), high card wins. A tie returns half your stake (classic Casino War).",
  },

  baccarat: {
    rows: [
      { label: "TIE bet — hands equal", mult: "9x", prob: "9.5%", top: true },
      { label: "PLAYER bet — player wins", mult: "2x", prob: "44.6%" },
      { label: "BANKER bet — banker wins", mult: "1.95x", prob: "45.9%" },
    ],
    rtp: "≈98.8%", edge: "Player 1.24% · Banker 1.06% · Tie 4.85%",
    note: "Banker pays 1.95x (5% commission). On a tie, Player/Banker bets push (stake returned).",
  },

  diamonds: {
    rows: [
      { label: "5 of a kind", mult: "500x", prob: "0.04%", top: true },
      { label: "4 of a kind", mult: "30x", prob: "1.25%" },
      { label: "3 of a kind", mult: "2.55x", prob: "15.0%" },
      { label: "2 or fewer (no pay)", mult: "0x", prob: "83.7%" },
    ],
    rtp: "≈95.7%", edge: "≈4.3%",
    note: "Five gems drawn (7 gem types); paid on your best matching set.",
  },

  double_dice: {
    rows: [
      { label: "SEVEN — sum = 7", mult: "5.5x", prob: "6/36 (16.7%)", top: true },
      { label: "ANY DOUBLE — both dice equal", mult: "5.5x", prob: "6/36 (16.7%)" },
      { label: "UNDER 7 — sum 2-6", mult: "2.30x", prob: "15/36 (41.7%)" },
      { label: "OVER 7 — sum 8-12", mult: "2.30x", prob: "15/36 (41.7%)" },
      { label: "EXACT sum (2-12)", mult: "up to 34x", prob: "varies" },
    ],
    rtp: "≈95.8%", edge: "Under/Over 4.17% · Seven/Double 8.33% · Exact 5%",
    note: "Two dice. EXACT pays (36/ways)×0.95 — snake-eyes/boxcars (2 or 12) pay the most.",
  },

  under_over_7: {
    rows: [
      { label: "EXACTLY 7 — sum = 7", mult: "5.70x", prob: "6/36 (16.7%)", top: true },
      { label: "UNDER — sum 2-6", mult: "2.32x", prob: "15/36 (41.7%)" },
      { label: "OVER — sum 8-12", mult: "2.32x", prob: "15/36 (41.7%)" },
    ],
    rtp: "≈96.4%", edge: "Under/Over 3.33% · Exactly-7 5.0%",
    note: "Two d6. Bet whether the sum lands under, on, or over 7.",
  },

  dragon_tiger: {
    rows: [
      { label: "TIE side bet — ranks equal", mult: "9x", prob: "1/17 (5.9%)", top: true },
      { label: "DRAGON — dragon rank higher", mult: "2x", prob: "8/17 (47%)" },
      { label: "TIGER — tiger rank higher", mult: "2x", prob: "8/17 (47%)" },
      { label: "tie (on Dragon/Tiger bet)", mult: "0.5x", prob: "1/17" },
    ],
    rtp: "Main 97.06% · Tie 52.94%", edge: "Dragon/Tiger 2.94% · Tie 47%",
    note: "Two cards duel. On a tie, Dragon/Tiger bets return half. The TIE side bet is a high-edge thrill wager (47% edge — disclosed).",
  },

  sicbo: {
    rows: [
      { label: "SPECIFIC TRIPLE — pick 1-6, all three match", mult: "180x", prob: "1/216", top: true },
      { label: "ANY TRIPLE — all three dice equal", mult: "30x", prob: "6/216 (2.8%)" },
      { label: "SINGLE — one die shows target", mult: "2x", prob: "≈34.7%" },
      { label: "SINGLE — two dice show target", mult: "3x", prob: "≈6.9%" },
      { label: "SINGLE — three dice show target", mult: "4x", prob: "1/216" },
      { label: "SMALL (4-10) / BIG (11-17)", mult: "2x", prob: "≈48.6%" },
    ],
    rtp: "varies by bet", edge: "Small/Big 2.78% · Single 7.87% · Triples 16.7%",
    note: "Three dice. SMALL/BIG lose on any triple. Higher-edge triples pay big.",
  },
};

// ── Variable-odds games (player picks their own multiplier / risk) ────────────
export const VARIABLE_PAYTABLES: Partial<Record<string, Paytable>> = {
  dice: {
    rows: [],
    rtp: "98.0%", edge: "2.0%",
    note: "Roll 1-100. Pick a target + over/under; payout = 98 ÷ win-chance. Tighter odds → bigger multiplier (up to ~49x). Flat 2% edge at every line.",
  },
  limbo: {
    rows: [],
    rtp: "98.0%", edge: "2.0%",
    note: "Pick a target multiplier (1.01x–1000x). Win if the rolled crash point ≥ your target. Win-chance = 0.98 ÷ target. Flat 2% edge at every target.",
  },
  crash: {
    rows: [],
    rtp: "98.0%", edge: "2.0%",
    note: "Set an auto-cashout target (1.01x–1000x). The rocket crashes at a random point; you win your target if it climbs past it first. Flat 2% edge.",
  },
  keno: {
    rows: [],
    rtp: "≈96%", edge: "≈3.3%–4.1% by pick count",
    note: "Pick 1-6 numbers; 10 are drawn from 40. More picks & more hits pay more — up to 970x for all 6 (p=6). Pays scale hypergeometrically.",
  },
  plinko: {
    rows: [
      { label: "edge buckets (default)", mult: "up to 130x", prob: "2·C(12,0)/4096", top: true },
      { label: "center bucket (default)", mult: "0.485x", prob: "C(12,6)/4096 (22.6%)" },
    ],
    rtp: "≈96%", edge: "≈3.5%–4.0% by risk mode",
    note: "12-row board, binomial landing. Risk modes: LOW (max 5x, every bucket pays), MED (100x edges), HIGH (500x edges, center 0). Default max 130x.",
  },
  ore_refine: {
    rows: [
      { label: "BONUS — jackpot yield", mult: "up to 20x", prob: "rare", top: true },
      { label: "YIELD — clean extraction", mult: "above stake", prob: "common" },
      { label: "PARTIAL — sub-stake return", mult: "< 1x", prob: "common" },
      { label: "SLAG — refine failed", mult: "0x", prob: "3%–40% by tier" },
    ],
    rtp: "97.0%", edge: "3.0% (all tiers)",
    note: "Pick a refine tier 1-5. Higher tiers = bigger max yield but higher slag (failure) chance. Flat 3% edge across all tiers.",
  },
  three_card_poker: {
    rows: [
      { label: "win w/ STRAIGHT FLUSH", mult: "6x", prob: "0.2%", top: true },
      { label: "win w/ THREE OF A KIND", mult: "5x", prob: "0.24%" },
      { label: "win w/ STRAIGHT", mult: "3x", prob: "3.3%" },
      { label: "win w/ high card / pair / flush", mult: "2x", prob: "—" },
      { label: "dealer doesn't qualify (Q-high)", mult: "2x", prob: "—" },
      { label: "tie", mult: "1x (ante back)", prob: "—" },
    ],
    rtp: "≈96.6%", edge: "≈3.4%",
    note: "Ante only. Beat the dealer; dealer qualifies with Queen-high. Note: in 3-card poker a STRAIGHT beats a FLUSH.",
  },
  risk_wheel: {
    rows: [
      { label: "LOW mode — jackpot 3.0x", mult: "3.0x",   prob: "5.0%", top: true },
      { label: "LOW mode — mid win 1.4x", mult: "1.4x",   prob: "20.0%" },
      { label: "LOW mode — small win 1.2x", mult: "1.2x",  prob: "45.0%" },
      { label: "MED mode — jackpot 10x",   mult: "10x",   prob: "5.0%", top: true },
      { label: "MED mode — win 1.6x",       mult: "1.6x",  prob: "10.0%" },
      { label: "MED mode — win 1.2x",       mult: "1.2x",  prob: "25.0%" },
      { label: "HIGH mode — jackpot 13.5x", mult: "13.5x", prob: "5.0%", top: true },
      { label: "HIGH mode — win 1.3x",       mult: "1.3x",  prob: "5.0%" },
      { label: "HIGH mode — win 1.1x",       mult: "1.1x",  prob: "20.0%" },
    ],
    rtp: "97.0% (LOW) / 96.0% (MED/HIGH)", edge: "3.0% (LOW) / 4.0% (MED/HIGH)",
    note: "Select LOW, MED, or HIGH risk mode before spinning. All modes use 20 segments. Choose your volatility.",
  },
  money_wheel: {
    rows: [
      { label: "Jackpot — 18x",       mult: "18x",  prob: "1.85%", top: true },
      { label: "Gold tier — 1.6x",    mult: "1.6x", prob: "5.56%" },
      { label: "Blue tier — 1.2x",    mult: "1.2x", prob: "14.81%" },
      { label: "Green tier — 1.1x",   mult: "1.1x", prob: "33.33%" },
      { label: "Bust — 0x",           mult: "0x",   prob: "44.44%" },
    ],
    rtp: "96.67%", edge: "3.33%",
    note: "54-segment wheel. One jackpot segment glows every spin. Long deceleration for premium anticipation.",
  },
};

/** Lookup a paytable for any game (fixed or variable). */
export function getPaytable(game: string): Paytable | undefined {
  return PAYTABLES[game] ?? VARIABLE_PAYTABLES[game];
}
