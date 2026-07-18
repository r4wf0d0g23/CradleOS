/**
 * casinoCatalog.ts — canonical game registry for CradleOS Casino.
 *
 * Single source of truth consumed by the lobby grid, category rail, and router.
 * Adding a new game: one registry entry here + its panel component. No nav rework.
 *
 * buildClass:
 *   "I" = InstantGamePanel (single-tx settle, no persistent live state)
 *   "S" = dedicated structured panel (multi-tx / commit-reveal / live state)
 *
 * variance:
 *   "L"   = low    (near-even odds, small swings)
 *   "M"   = medium
 *   "H"   = high   (large multipliers possible)
 *   "VH"  = very high (rare huge payouts)
 *   "M-H" = spans medium to high depending on choices made
 *
 * Glyphs: Monaco / EVE Vault webview-safe geometric Unicode only — no emoji.
 */

export type CasinoCategory =
  | "dice"
  | "wheels"
  | "cards"
  | "drop"
  | "grid"
  | "crash"
  | "slots"
  | "duels"
  | "lottery"
  | "eve-native";

export type Variance = "L" | "M" | "H" | "VH" | "M-H" | "L-VH";

export type BuildClass = "I" | "S";

export interface GameEntry {
  /** Matches InstantGameKey or one of "blackjack" | "mines" | "dragon_tower" | "video_poker" */
  key: string;
  name: string;
  category: CasinoCategory;
  variance: Variance;
  buildClass: BuildClass;
  /** Webview-safe geometric Unicode glyph. No emoji. */
  glyph: string;
  /** One-line pitch shown on the lobby card. */
  hook: string;
  status: "live" | "disabled";
  /** When true, the game is hidden from the lobby + 3D floor and cannot be opened.
   *  Used to pull a game offline without a redeploy of the Move package. */
  disabled?: boolean;
}

/** Games hidden from the lobby/floor and blocked from opening.
 *  dragon_tower: disabled 2026-07-12 — solution-leak exploit (pre-drawn dragon
 *  positions readable from the player-owned game object). Re-enable only after
 *  the v22 commit-reveal fix ships. */
export const CASINO_DISABLED_KEYS = new Set<string>(["dragon_tower", "mines", "video_poker"]);

export const CASINO_CATALOG: GameEntry[] = [
  {
    key: "blackjack",
    name: "BLACKJACK",
    category: "cards",
    variance: "M-H",
    buildClass: "S",
    glyph: "\u2726",   // ✦  BLACK FOUR POINTED STAR
    hook: "Beat the dealer to 21 — provably fair commit-reveal on-chain",
    status: "live",
  },
  {
    key: "coinflip",
    name: "COINFLIP",
    category: "dice",
    variance: "L",
    buildClass: "I",
    glyph: "\u25C9",   // ◉  FISHEYE
    hook: "Call heads or tails — settle in one transaction",
    status: "live",
  },
  {
    key: "dice",
    name: "DICE",
    category: "dice",
    variance: "M",
    buildClass: "I",
    glyph: "\u25A3",   // ▣  WHITE SQUARE CONTAINING BLACK SMALL SQUARE
    hook: "Pick your target number, roll over or under to win",
    status: "live",
  },
  {
    key: "roulette",
    name: "ROULETTE",
    category: "wheels",
    variance: "M",
    buildClass: "I",
    glyph: "\u25CE",   // ◎  BULLSEYE
    hook: "Straight-up 36x to even-money bets — one spin decides",
    status: "live",
  },
  {
    key: "slots",
    name: "SLOTS",
    category: "slots",
    variance: "M",
    buildClass: "I",
    glyph: "\u25A6",   // ▦  SQUARE WITH ORTHOGONAL CROSSHATCH FILL
    hook: "Three-reel EVE-themed slots — spin and match",
    status: "live",
  },
  {
    key: "wheel",
    name: "WHEEL",
    category: "wheels",
    variance: "M",
    buildClass: "I",
    glyph: "\u25EF",   // ◯  LARGE CIRCLE
    hook: "Spin the multiplier wheel and pocket the segment payout",
    status: "live",
  },
  {
    key: "limbo",
    name: "LIMBO",
    category: "crash",
    variance: "H",
    buildClass: "I",
    glyph: "\u25B2",   // ▲  BLACK UP-POINTING TRIANGLE
    hook: "Set your target multiplier — beat the crash point to win",
    status: "live",
  },
  {
    key: "hilo",
    name: "HI-LO",
    category: "cards",
    variance: "M",
    buildClass: "I",
    glyph: "\u25A5",   // ▥  SQUARE WITH VERTICAL FILL
    hook: "Predict whether the next card is higher or lower",
    status: "live",
  },
  {
    key: "plinko",
    name: "PLINKO",
    category: "drop",
    variance: "M",
    buildClass: "I",
    glyph: "\u2B22",   // ⬢  BLACK HEXAGON
    hook: "Drop the ball and pocket whichever bucket it lands in",
    status: "live",
  },
  {
    key: "keno",
    name: "KENO",
    category: "lottery",
    variance: "M",
    buildClass: "I",
    glyph: "\u25A4",   // ▤  SQUARE WITH HORIZONTAL FILL
    hook: "Pick up to 6 numbers — more matches means a bigger prize",
    status: "live",
  },
  {
    key: "sicbo",
    name: "SIC BO",
    category: "dice",
    variance: "H",
    buildClass: "I",
    glyph: "\u2261",   // ≡  IDENTICAL TO (three bars)
    hook: "Three dice, five bet types — specific triple pays 180x",
    status: "live",
  },
  {
    key: "mines",
    name: "MINES",
    category: "grid",
    variance: "H",
    buildClass: "S",
    glyph: "\u229E",   // ⊞  SQUARED PLUS
    hook: "Reveal tiles and watch the multiplier climb — cash out before you hit a mine",
    status: "disabled",
    disabled: true,
  },
  {
    key: "crash",
    name: "CRASH",
    category: "crash",
    variance: "H",
    buildClass: "I",
    glyph: "\u2295",   // ⊕  CIRCLED PLUS
    hook: "Lock in your target multiplier before the rocket crashes out",
    status: "live",
  },
  {
    key: "diamonds",
    name: "DIAMONDS",
    category: "grid",
    variance: "M",
    buildClass: "I",
    glyph: "\u25C6",   // ◆  BLACK DIAMOND
    hook: "Draw five gems and match the pattern for a multiplier prize",
    status: "live",
  },
  {
    key: "double_dice",
    name: "DBL DICE",
    category: "dice",
    variance: "M",
    buildClass: "I",
    glyph: "\u2756",   // ❖  BLACK DIAMOND MINUS WHITE X
    hook: "Two dice — bet the sum, any double, or exact pair for 34x",
    status: "live",
  },
  {
    key: "war",
    name: "WAR",
    category: "duels",
    variance: "L",
    buildClass: "I",
    glyph: "\u2694",   // ⚔  CROSSED SWORDS
    hook: "One card draw vs the house — highest card takes the pot",
    status: "live",
  },
  {
    key: "baccarat",
    name: "BACCARAT",
    category: "cards",
    variance: "M",
    buildClass: "I",
    glyph: "\u25C8",   // ◈  DIAMOND WITH LEFT HALF BLACK
    hook: "Bet Player, Banker, or Tie — classic baccarat in one tx",
    status: "live",
  },
  {
    key: "three_card_poker",
    name: "THREE CARD",
    category: "cards",
    variance: "H",
    buildClass: "I",
    glyph: "\u25C7",   // ◇  WHITE DIAMOND
    hook: "Three-card showdown vs the dealer. Straights 3x, trips 5x, straight flush 6x when the dealer qualifies.",
    status: "live",
  },
  {
    key: "dragon_tower",
    name: "DRAGON TOWER",
    category: "drop",
    variance: "H",
    buildClass: "S",
    glyph: "\u25AD",   // ▭  WHITE RECTANGLE
    hook: "Climb the tower one safe tile at a time — higher floors, bigger rewards",
    status: "disabled",
    disabled: true,
  },
  {
    key: "video_poker",
    name: "VIDEO POKER",
    category: "cards",
    variance: "H",
    buildClass: "S",
    glyph: "\u2263",   // ≣  STRICTLY EQUIVALENT TO (four-line bar)
    hook: "Jacks or Better — hold your best cards and draw to win",
    status: "disabled",
    disabled: true,
  },
  {
    key: "dragon_tiger",
    name: "DRAGON TIGER",
    category: "duels",
    variance: "L",
    buildClass: "I",
    glyph: "\u25CE",   // ◎  BULLSEYE
    hook: "One card each. Dragon vs Tiger — highest rank wins. Fastest card game on-chain.",
    status: "live",
  },
  {
    key: "under_over_7",
    name: "UNDER/OVER 7",
    category: "dice",
    variance: "L",
    buildClass: "I",
    glyph: "\u25A3",   // \u25A3  WHITE SQUARE CONTAINING BLACK SMALL SQUARE
    hook: "Two dice — bet the sum falls under 7, over 7, or exactly 7.",
    status: "live",
  },
  {
    key: "ore_refine",
    name: "ORE REFINE",
    category: "eve-native",
    variance: "H",
    buildClass: "I",
    glyph: "\u229E",   // ⊞  SQUARED PLUS
    hook: "Risk your ore through 5 refine intensities. BASIC to CRITICAL — BONUS yields up to 20x.",
    status: "live",
  },
  {
    key: "risk_wheel",
    name: "RISK WHEEL",
    category: "wheels",
    variance: "L-VH",
    buildClass: "I",
    glyph: "\u25c9",
    hook: "Choose your volatility: LOW (3x cap, 3% edge), MED (10x, 4%), HIGH (13.5x jackpot, 4%). One wheel, three profiles.",
    status: "live",
  },
  {
    key: "money_wheel",
    name: "MONEY WHEEL",
    category: "wheels",
    variance: "M",
    buildClass: "I",
    glyph: "\u2726",
    hook: "54-segment Big Six-style wheel. The 18x jackpot segment glows on every spin. Edge 3.33%.",
    status: "live",
  },
  {
    key: "andar_bahar",
    name: "ANDAR BAHAR",
    category: "cards",
    variance: "M",
    buildClass: "I",
    glyph: "\u25C6",   // ◆  BLACK DIAMOND
    hook: "Joker revealed, then cards deal alternately to Andar / Bahar until the rank matches. Pick the side. Andar 2.24% \u00b7 Bahar 4.00% edge.",
    status: "live",
  },
  {
    key: "scratch_cards",
    name: "SCRATCH PLEX",
    category: "grid",
    variance: "M",
    buildClass: "I",
    glyph: "\u25C8",   // ◈  WHITE DIAMOND WITH CENTRED DOT
    hook: "Nine EVE ore tiles revealed one-by-one. Match three of a kind to win. From 1.5\xd7 Veldspar to 100\xd7 Zydrine jackpot. 3% house edge.",
    status: "live",
  },
  {
    key: "chuck_a_luck",
    name: "CHUCK-A-LUCK",
    category: "dice",
    variance: "M",
    buildClass: "I",
    glyph: "\u25A6",   // ▦  SQUARE WITH ORTHOGONAL CROSSHATCH FILL (birdcage)
    hook: "Pick a number 1\u20136 and roll three dice. Match 1 = 1.9\xd7, Match 2 = 3.7\xd7, Triple = 12\xd7. Classic birdcage. 2.78% edge.",
    status: "live",
  },
  {
    key: "red_dog",
    name: "RED DOG",
    category: "cards",
    variance: "M",
    buildClass: "I",
    glyph: "\u25C6",   // ◆  BLACK DIAMOND (card suit feel)
    hook: "Two anchor cards deal face up — bet on whether the third falls between them. Spread 1 pays 5:1, spread 5+ pays 1:1, pair match pays 11:1. 2.23% edge.",
    status: "live",
  },
];

/** Display labels for the category rail buttons. */
export const CATEGORY_LABELS: Record<CasinoCategory, string> = {
  dice:         "DICE",
  wheels:       "WHEELS",
  cards:        "CARDS",
  drop:         "DROP",
  grid:         "GRID",
  crash:        "CRASH",
  slots:        "SLOTS",
  duels:        "DUELS",
  lottery:      "LOTTERY",
  "eve-native": "EVE-NATIVE",
};

/** Protocol category order for the nav rail. */
export const CATEGORY_ORDER: CasinoCategory[] = [
  "dice", "wheels", "cards", "drop", "grid", "crash", "slots", "duels", "lottery", "eve-native",
];

/** Returns only the categories that have at least one live game, in protocol order. */
export function activeCategoriesFromCatalog(): CasinoCategory[] {
  const present = new Set(
    CASINO_CATALOG.filter((g) => g.status === "live").map((g) => g.category),
  );
  return CATEGORY_ORDER.filter((c) => present.has(c));
}
