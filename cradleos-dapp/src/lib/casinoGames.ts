/**
 * casinoGames.ts — instant-settle casino games (Phase 1): coinflip, dice,
 * roulette, slots, wheel. All settle in ONE tx: entry play() consumes the
 * randomness beacon, computes payout, pays, and emits a result event.
 *
 * Resolution discipline (standing rules):
 *  - Resolve every play by ITS OWN tx digest via sui_getTransactionBlock —
 *    never "latest event of type X".
 *  - Event types for these modules tag under the package version that
 *    introduced them (CASINO_PKG = current published-at).
 */
import { Transaction } from "@mysten/sui/transactions";
import {
  CASINO_PKG,
  CASINO_V2,
  CASINO_V3,
  CASINO_V5,
  CASINO_V7,
  CASINO_V10,
  CASINO_PLINKO_MULTI,
  CASINO_ORIGINAL,
  CASINO_V16,
  CASINO_V18,
  CASINO_V19,
  CASINO_V20,
  CASINO_V21,
  CASINO_V24,
  CASINO_HOUSE,
  EVE_COIN_TYPE,
  RANDOM_OBJECT,
  SUI_TESTNET_RPC,
} from "../constants";
import { POKER_HAND_RANKS } from "./casinoVideoPoker";

export type InstantGameKey = "coinflip" | "dice" | "roulette" | "slots" | "wheel" | "limbo" | "hilo" | "plinko" | "keno" | "sicbo" | "crash" | "diamonds" | "double_dice" | "war" | "baccarat" | "three_card_poker" | "dragon_tiger" | "under_over_7" | "ore_refine" | "risk_wheel" | "money_wheel" | "andar_bahar" | "scratch_cards" | "chuck_a_luck" | "red_dog";

export interface InstantResult {
  game: InstantGameKey;
  wager: number;        // EVE
  payout: number;       // EVE gross (0 = loss)
  detail: string;       // human-readable outcome line
  fields: Record<string, unknown>;
  txDigest: string;
}

// ── RPC (proxy is fine here: getTransactionBlock is not cached) ──────────────
async function rpc(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message ?? "RPC error");
  return j.result;
}

// ── Game registry ─────────────────────────────────────────────────────────────
interface GameDef {
  module: string;
  event: string;   // event struct name
  altEvents?: string[]; // additional event structs that settle this game (e.g. mode variants)
  describe: (f: Record<string, any>) => string;
}

/** Plinko risk modes (v10). mode -1 = classic 130x table via legacy `play`. */
export const PLINKO_MODES = [
  { mode: -1, label: "CLASSIC", maxMult: 130, mults: [130, 6, 3, 1.6, 1.2, 0.5, 0.4851, 0.5, 1.2, 1.6, 3, 6, 130] },
  { mode: 0,  label: "LOW",     maxMult: 5,   mults: [5, 2, 1.5, 1.2, 1, 0.85, 0.9, 0.85, 1, 1.2, 1.5, 2, 5] },
  { mode: 1,  label: "MED",     maxMult: 100, mults: [100, 10, 3, 1.5, 1.1, 0.85, 0, 0.85, 1.1, 1.5, 3, 10, 100] },
  { mode: 2,  label: "HIGH",    maxMult: 500, mults: [500, 50, 5, 1, 0.5, 0.1, 0, 0.1, 0.5, 1, 5, 50, 500] },
] as const;
const PLINKO_MODE_LABEL = ["LOW", "MED", "HIGH"];

export const ROULETTE_KINDS = [
  { kind: 0, label: "STRAIGHT", targets: 37, pays: "36x" },
  { kind: 1, label: "RED / BLACK", targets: 2, pays: "2x" },
  { kind: 2, label: "EVEN / ODD", targets: 2, pays: "2x" },
  { kind: 3, label: "LOW / HIGH", targets: 2, pays: "2x" },
  { kind: 4, label: "DOZEN", targets: 3, pays: "3x" },
  { kind: 5, label: "COLUMN", targets: 3, pays: "3x" },
] as const;

const RED_SET = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const rouletteColor = (n: number) => (n === 0 ? "ZERO" : RED_SET.has(n) ? "RED" : "BLACK");

export const SLOT_SYMBOLS = ["◇", "◆", "✦", "⬢", "⚙", "⛨", "◉"]; // idx 0..6, webview-safe

// HiLo card rank labels (0=A..12=K)
export const HILO_RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

export const SICBO_KINDS = [
  { kind: 0, label: "SMALL (4-10)",   mult: 2   },
  { kind: 1, label: "BIG (11-17)",    mult: 2   },
  { kind: 2, label: "SINGLE",         mult: 4   },
  { kind: 3, label: "SPEC TRIP",      mult: 180 },
  { kind: 4, label: "ANY TRIP",       mult: 30  },
] as const;

// Keno max payout by pick count (used for exposure guard)
export const KENO_MAX_MULT: Record<number, number> = {
  1: 3.85, 2: 13, 3: 25, 4: 47, 5: 295, 6: 970,
};

// Gems for Diamonds game (7 types, indices 0-6, monospace-safe glyphs)
export const DIAMOND_GEMS = ["◆", "◇", "◈", "❖", "⬢", "⬡", "⚙"];

// Rank labels for war/baccarat/three_card_poker (0=Two..12=Ace)
export const WAR_RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

// Double dice kind definitions
export const DOUBLE_DICE_KINDS = [
  { kind: 0, label: "UNDER 7",  grossMult: 2.3 },
  { kind: 1, label: "OVER 7",   grossMult: 2.3 },
  { kind: 2, label: "SEVEN",    grossMult: 5.5 },
  { kind: 3, label: "ANY DBL",  grossMult: 5.5 },
  { kind: 4, label: "EXACT",    grossMult: 34.2 },
] as const;

/** Client-side exact-sum multiplier for double dice EXACT bets (mirrors Move math). */
export function doubleDiceExactMult(target: number): number {
  const count = target <= 7 ? target - 1 : 13 - target;
  return Math.round((36 / Math.max(1, count)) * 0.95 * 100) / 100;
}

// Baccarat kind definitions
export const BACCARAT_KINDS = [
  { kind: 0, label: "PLAYER",  mult: 2,   grossMult: 2 },
  { kind: 1, label: "BANKER",  mult: 1.95, grossMult: 2 },
  { kind: 2, label: "TIE",     mult: 9,   grossMult: 9 },
] as const;

// Three-card poker rank labels
export const THREE_CARD_RANKS = ["HIGH","PAIR","FLUSH","STRAIGHT","THREE KIND","STR FLUSH"];

// Dragon Tiger constants
export const DRAGON_TIGER_BET_LABELS = ["DRAGON", "TIGER", "TIE"];
export const WAR_RANKS_13 = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"]; // 0-12

// Under/Over 7 constants
export const UNDER_OVER_7_KIND_LABELS = ["UNDER", "EXACTLY 7", "OVER"];

// Ore Refine constants
export const ORE_REFINE_TIER_LABELS = ["BASIC","STANDARD","ADVANCED","INDUSTRIAL","CRITICAL"];
export const ORE_REFINE_OUTCOME_LABELS = ["SLAG","PARTIAL","YIELD","BONUS"];

// Card rank labels for war/baccarat/three_card_poker (0-12 = 0=Ace..12=K for standard; 
// war uses 0=Two..12=Ace which maps to WAR_RANKS above)

// Scratch Plex symbol labels (0-5 = EVE ores)
export const SCRATCH_CARD_SYMBOLS = ["VELDSPAR", "SCORDITE", "PYROXERES", "ARKONOR", "BISTOT", "ZYDRINE"];
export const SCRATCH_CARD_GLYPHS  = ["\u25C7", "\u25A3", "\u25C8", "\u2B22", "\u25C6", "\u2699"]; // ◇▣◈⬢◆⚙
export const SCRATCH_TIER_LABELS  = ["LOSS", "1.5\xd7", "3\xd7", "8\xd7", "20\xd7", "100\xd7"];

const GAMES: Record<InstantGameKey, GameDef> = {
  limbo: {
    module: "limbo", event: "LimboRolled",
    describe: (f) => `target ${(Number(f.target_bps) / 10000).toFixed(2)}x · crashed at ${(Number(f.crash_bps) / 10000).toFixed(2)}x`,
  },
  hilo: {
    module: "hilo", event: "HiLoDrawn",
    describe: (f) => `base ${HILO_RANKS[Number(f.base)] ?? "?"} → drew ${HILO_RANKS[Number(f.drawn)] ?? "?"}${f.push ? " (PUSH)" : ""}`,
  },
  plinko: {
    module: "plinko", event: "PlinkoDropped", altEvents: ["PlinkoModeDropped"],
    describe: (f) => `${f.mode !== undefined ? `${PLINKO_MODE_LABEL[Number(f.mode)] ?? "?"} · ` : ""}bucket ${f.bucket} · ${(Number(f.multiplier_bps) / 10000).toFixed(2)}x`,
  },
  keno: {
    module: "keno", event: "KenoDrawn",
    describe: (f) => `${f.matches}/${Array.isArray(f.picks) ? f.picks.length : 0} match · ${(Number(f.multiplier_bps) / 10000).toFixed(2)}x`,
  },
  sicbo: {
    module: "sicbo", event: "SicBoRolled",
    describe: (f) => `${f.d1}+${f.d2}+${f.d3}=${Number(f.d1)+Number(f.d2)+Number(f.d3)} · ${f.payout > 0 ? "WIN" : "LOSS"}`,
  },
  coinflip: {
    module: "coinflip", event: "FlipResult",
    describe: (f) => `${Number(f.choice) === 0 ? "HEADS" : "TAILS"} called · landed ${Number(f.result) === 0 ? "HEADS" : "TAILS"}`,
  },
  dice: {
    module: "dice", event: "DiceRolled",
    describe: (f) => `rolled ${f.roll} · needed ${f.over ? "over" : "under"} ${f.target}`,
  },
  roulette: {
    module: "roulette", event: "RouletteSpun",
    describe: (f) => `spun ${f.spin} (${rouletteColor(Number(f.spin))})`,
  },
  slots: {
    module: "slots", event: "SlotsSpun",
    describe: (f) => `${SLOT_SYMBOLS[Number(f.s1)] ?? "?"} ${SLOT_SYMBOLS[Number(f.s2)] ?? "?"} ${SLOT_SYMBOLS[Number(f.s3)] ?? "?"}`,
  },
  wheel: {
    module: "wheel", event: "WheelSpun",
    describe: (f) => `segment ${f.segment} · ${(Number(f.multiplier_bps) / 10000).toFixed(1)}x`,
  },
  crash: {
    module: "crash", event: "CrashRoundPlayed",
    describe: (f) => `target ${(Number(f.target_bps) / 10000).toFixed(2)}x · crashed at ${(Number(f.crash_bps) / 10000).toFixed(2)}x`,
  },
  diamonds: {
    module: "diamonds", event: "DiamondsDrawn",
    describe: (f) => {
      const gems = Array.isArray(f.gems) ? (f.gems as number[]).map((g) => DIAMOND_GEMS[g] ?? "?").join(" ") : "?????";
      return `${gems} · ${(Number(f.multiplier_bps) / 10000).toFixed(2)}x`;
    },
  },
  double_dice: {
    module: "double_dice", event: "DoubleDiceRolled",
    describe: (f) => `${f.d1}+${f.d2}=${Number(f.d1)+Number(f.d2)} · ${Number(f.payout) > 0 ? "WIN" : "LOSS"}`,
  },
  war: {
    module: "war", event: "WarPlayed",
    describe: (f) => `player ${WAR_RANKS[Number(f.player_card)] ?? "?"} vs dealer ${WAR_RANKS[Number(f.dealer_card)] ?? "?"}`,
  },
  baccarat: {
    module: "baccarat", event: "BaccaratPlayed",
    describe: (f) => {
      const kindLabel = ["PLAYER","BANKER","TIE"][Number(f.kind)] ?? "?";
      // Contract baccarat.move result enum: 0=player win, 1=banker win, 2=tie.
      const resultLabel = Number(f.result) === 0 ? "PLAYER WIN" : Number(f.result) === 1 ? "BANK WIN" : "TIE";
      return `bet ${kindLabel} · ${resultLabel} · P${f.player_score} B${f.banker_score}`;
    },
  },
  three_card_poker: {
    module: "three_card_poker", event: "ThreeCardPlayed",
    describe: (f) => {
      const res = Number(f.result);
      const resLabel = res === 0 ? "LOSS" : res === 1 ? "PUSH" : "WIN";
      return `${resLabel} · P:${THREE_CARD_RANKS[Number(f.player_rank)] ?? "?"} D:${THREE_CARD_RANKS[Number(f.dealer_rank)] ?? "?"}`;
    },
  },
  dragon_tiger: {
    module: "dragon_tiger", event: "DragonTigerPlayed",
    describe: (f) => {
      const bet = DRAGON_TIGER_BET_LABELS[Number(f.bet_type)] ?? "?";
      const dr = WAR_RANKS_13[Number(f.dragon_rank)] ?? "?";
      const tr = WAR_RANKS_13[Number(f.tiger_rank)] ?? "?";
      return `${bet} · Dragon ${dr} vs Tiger ${tr} · ${Number(f.payout) > 0 ? "WIN" : "LOSS"}`;
    },
  },
  under_over_7: {
    module: "under_over_7", event: "UnderOver7Rolled",
    describe: (f) => {
      const kind = UNDER_OVER_7_KIND_LABELS[Number(f.kind)] ?? "?";
      return `${kind} · ${f.d1}+${f.d2}=${Number(f.sum)} · ${Number(f.payout) > 0 ? "WIN" : "LOSS"}`;
    },
  },
  ore_refine: {
    module: "ore_refine", event: "OreRefined",
    describe: (f) => {
      const tier = ORE_REFINE_TIER_LABELS[Number(f.tier) - 1] ?? "?";
      const outcome = ORE_REFINE_OUTCOME_LABELS[Number(f.outcome)] ?? "?";
      return `${tier} · ${outcome} · ${Number(f.payout) > 0 ? (Number(f.payout) / 1e9).toFixed(1) + " EVE" : "SLAG"}`;
    },
  },
  // ── v18 games ──────────────────────────────────────────────────────────────
  risk_wheel: {
    module: "risk_wheel", event: "RiskWheelSpun",
    describe: (f) => {
      const modeLabel = (["LOW", "MED", "HIGH"] as const)[Number(f.mode)] ?? "?";
      return `${modeLabel} · seg ${f.segment} · ${(Number(f.multiplier_bps) / 10000).toFixed(2)}x`;
    },
  },
  money_wheel: {
    module: "money_wheel", event: "MoneyWheelSpun",
    describe: (f) => `seg ${f.segment} · ${(Number(f.multiplier_bps) / 10000).toFixed(2)}x`,
  },
  // ── v19 games ──────────────────────────────────────────────────────────────
  andar_bahar: {
    module: "andar_bahar", event: "AndarBaharPlayed",
    describe: (f) => {
      const side = Number(f.bet_side) === 0 ? "ANDAR" : "BAHAR";
      const winner = Number(f.winner_side) === 0 ? "ANDAR" : "BAHAR";
      const jokerRank = WAR_RANKS_13[Number(f.joker_rank)] ?? "?";
      const dealt = Number(f.cards_dealt);
      return `${side} bet \u00b7 Joker ${jokerRank} \u00b7 ${dealt} cards \u00b7 ${winner} wins \u00b7 ${Number(f.payout) > 0 ? "WIN" : "LOSS"}`;
    },
  },
  // ── v20 games ──────────────────────────────────────────────────────────────
  scratch_cards: {
    module: "scratch_cards", event: "ScratchCardPlayed",
    describe: (f) => {
      const tier = Number(f.outcome_tier);
      const winSym = Number(f.winning_symbol);
      const tierLabel = SCRATCH_TIER_LABELS[tier] ?? "LOSS";
      const symLabel  = winSym < 6 ? SCRATCH_CARD_SYMBOLS[winSym] : "-";
      if (tier === 0) return "SCRATCHED \u00b7 No match \u00b7 LOSS";
      return `${symLabel} \u00d73 \u2192 ${tierLabel} \u00b7 ${Number(f.payout) > 0 ? "WIN" : "LOSS"}`;
    },
  },
  // ── v21: chuck_a_luck ───────────────────────────────────────────────────────────────────────────
  chuck_a_luck: {
    module: "chuck_a_luck", event: "ChuckALuckRolled",
    describe: (f) => {
      const m = Number(f.matches);
      const mult = m === 0 ? 0 : m === 1 ? 1.9 : m === 2 ? 3.7 : 12;
      return `target ${f.target} \u00b7 ${f.d1}/${f.d2}/${f.d3} \u00b7 ${m} match${m !== 1 ? "es" : ""} \u00b7 ${m > 0 ? mult + "x" : "LOSS"}`;
    },
  },
  // ── v24: red_dog ─────────────────────────────────────────────────────────────────────────────────
  red_dog: {
    module: "red_dog", event: "RedDogPlayed",
    describe: (f) => {
      const result = Number(f.result);
      const s = Number(f.spread);
      const c1 = Number(f.card1), c2 = Number(f.card2), c3 = Number(f.card3);
      const rank = (r: number) => r === 1 ? "A" : r === 11 ? "J" : r === 12 ? "Q" : r === 13 ? "K" : String(r);
      const outcomeStr = result === 0 ? "PAIR MATCH 11:1" : result === 1 ? "PAIR PUSH" : result === 2 ? "CONSECUTIVE PUSH" : result === 3 ? `WIN (spread ${s})` : "LOSS";
      return `${rank(c1)}/${rank(c2)} · post: ${rank(c3)} · spread ${s} · ${outcomeStr}`;
    },
  },
};

// ── Tx builders ───────────────────────────────────────────────────────────────
function baseTx(eveCoinIds: string[], wagerRaw: bigint): { tx: Transaction; wager: any } {
  const tx = new Transaction();
  const primary = tx.object(eveCoinIds[0]);
  if (eveCoinIds.length > 1) tx.mergeCoins(primary, eveCoinIds.slice(1).map((id) => tx.object(id)));
  const [wager] = tx.splitCoins(primary, [tx.pure.u64(wagerRaw)]);
  return { tx, wager };
}

export function buildCoinflipTx(coins: string[], wagerRaw: bigint, characterId: string, choice: 0 | 1): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::coinflip::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager, tx.pure.u8(choice)],
  });
  return tx;
}

export function buildDiceTx(coins: string[], wagerRaw: bigint, characterId: string, target: number, over: boolean): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::dice::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager, tx.pure.u8(target), tx.pure.bool(over)],
  });
  return tx;
}

export function buildRouletteTx(coins: string[], wagerRaw: bigint, characterId: string, kind: number, target: number): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::roulette::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager, tx.pure.u8(kind), tx.pure.u8(target)],
  });
  return tx;
}

export function buildSlotsTx(coins: string[], wagerRaw: bigint, characterId: string): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::slots::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager],
  });
  return tx;
}

export function buildWheelTx(coins: string[], wagerRaw: bigint, characterId: string): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::wheel::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager],
  });
  return tx;
}

export function buildLimboTx(coins: string[], wagerRaw: bigint, characterId: string, targetBps: bigint): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::limbo::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager, tx.pure.u64(targetBps)],
  });
  return tx;
}

export function buildHiLoTx(coins: string[], wagerRaw: bigint, characterId: string, higher: boolean): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::hilo::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager, tx.pure.bool(higher)],
  });
  return tx;
}

// ── Live two-step Hi-Lo (v8) ────────────────────────────────────────────
// start deals the base card VISIBLY (HiLoStarted event) and escrows the wager
// in a player-owned HiLoGame object; settle draws the second card after the
// player has seen the base and chosen a direction. HiLoDrawn (V5) still fires
// at settle, so the provably-fair feed is unchanged.

export interface HiLoLiveGame {
  gameId: string;   // owned HiLoGame<EVE> object id
  base: number;     // rank 0..12 (0=A, 12=K)
  wager: number;    // EVE
}

export function buildHiLoStartTx(coins: string[], wagerRaw: bigint, characterId: string): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::hilo::start`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager],
  });
  return tx;
}

export async function buildHiLoSettleTx(gameId: string, higher: boolean): Promise<Transaction> {
  const { fetchOwnedRefDirect } = await import("./casino");
  const ref = await fetchOwnedRefDirect(gameId); // fresh ref — proxy-cached versions equivocate
  const tx = new Transaction();
  tx.moveCall({
    target: `${CASINO_PKG}::hilo::settle`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.objectRef(ref), tx.pure.bool(higher)],
  });
  return tx;
}

/** Read the dealt base card from a start tx. Retries on fullnode lag. */
export async function resolveHiLoStartByDigest(digest: string): Promise<HiLoLiveGame | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await rpc("sui_getTransactionBlock", [digest, { showEvents: true }]);
      for (const e of res?.events ?? []) {
        if (typeof e.type === "string" && e.type.endsWith("::hilo::HiLoStarted")) {
          const f = e.parsedJson ?? {};
          return {
            gameId: String(f.game_id ?? ""),
            base: Number(f.base ?? 0),
            wager: Number(f.wager ?? 0) / 1e9,
          };
        }
      }
    } catch { /* fullnode lag — retry */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

/** Find an abandoned live hi-lo game (escrowed stake) owned by `owner`, if any. */
export async function fetchOpenHiLoGame(owner: string): Promise<HiLoLiveGame | null> {
  if (!CASINO_PKG) return null;
  try {
    const res = await rpc("suix_getOwnedObjects", [owner, {
      filter: { StructType: `${CASINO_PKG}::hilo::HiLoGame<${EVE_COIN_TYPE}>` },
      options: { showContent: true },
    }, null, 5]);
    const d = res?.data?.[0]?.data;
    if (!d?.objectId) return null;
    const f = d.content?.fields ?? {};
    return {
      gameId: d.objectId,
      base: Number(f.base ?? 0),
      wager: Number(f.wager ?? 0) / 1e9,
    };
  } catch { return null; }
}

/** Gross multiplier (x) for a hi-lo call given the visible base. 0 = impossible side. */
export function hiloCallMultiplier(base: number, higher: boolean): number {
  const count = higher ? 12 - base : base;
  if (count <= 0) return 0;
  return (9800 * 13) / count / 10000;
}

export function buildPlinkoTx(coins: string[], wagerRaw: bigint, characterId: string): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::plinko::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager],
  });
  return tx;
}

/** Plinko risk-mode play (v10): mode 0=LOW 1=MED 2=HIGH. */
export function buildPlinkoModeTx(coins: string[], wagerRaw: bigint, characterId: string, mode: number): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::plinko::play_mode`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager, tx.pure.u8(mode)],
  });
  return tx;
}

/**
 * Plinko multi-drop (v12): N balls (2..=10) in one tx, one signature.
 * mode: 0=LOW 1=MED 2=HIGH 3=CLASSIC. wagerRaw = TOTAL across all drops.
 */
export function buildPlinkoMultiTx(coins: string[], wagerRaw: bigint, characterId: string, mode: number, count: number): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  // map UI mode: -1=CLASSIC → contract mode 3
  const contractMode = mode < 0 ? 3 : mode;
  tx.moveCall({
    target: `${CASINO_PKG}::plinko::play_multi`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager, tx.pure.u8(contractMode), tx.pure.u8(count)],
  });
  return tx;
}

export interface PlinkoMultiResult {
  wager: number;        // EVE total
  totalPayout: number;  // EVE gross
  mode: number;         // 0-3
  count: number;
  paths: number[];
  buckets: number[];
  payouts: number[];    // EVE gross per drop
  txDigest: string;
}

/** Resolve a play_multi tx by digest — returns null if not found within retry window. */
export async function resolvePlinkoMultiByDigest(digest: string): Promise<PlinkoMultiResult | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await rpc("sui_getTransactionBlock", [digest, { showEvents: true }]);
      for (const e of res?.events ?? []) {
        if (typeof e.type === "string" && e.type.endsWith("::plinko::PlinkoMultiDropped")) {
          const f = e.parsedJson ?? {};
          // paths/buckets come back as base64 bytes; decode them
          const decodePaths = (raw: unknown): number[] => {
            if (Array.isArray(raw)) return raw.map(Number);
            if (typeof raw === "string") {
              const bin = atob(raw);
              const result: number[] = [];
              for (let i = 0; i < bin.length; i += 2) {
                result.push(bin.charCodeAt(i) | (bin.charCodeAt(i + 1) << 8));
              }
              return result;
            }
            return [];
          };
          const decodeBytes = (raw: unknown): number[] => {
            if (Array.isArray(raw)) return raw.map(Number);
            if (typeof raw === "string") {
              const bin = atob(raw);
              return Array.from(bin).map((c) => c.charCodeAt(0));
            }
            return [];
          };
          return {
            wager: Number(f.wager ?? 0) / 1e9,
            totalPayout: Number(f.total_payout ?? 0) / 1e9,
            mode: Number(f.mode ?? 0),
            count: Number(f.count ?? 0),
            paths: decodePaths(f.paths),
            buckets: decodeBytes(f.buckets),
            payouts: (f.payouts as string[] ?? []).map((p) => Number(p) / 1e9),
            txDigest: digest,
          };
        }
      }
    } catch { /* fullnode lag — retry */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

export function buildKenoTx(coins: string[], wagerRaw: bigint, characterId: string, picks: number[]): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::keno::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager, tx.pure.vector("u8", picks)],
  });
  return tx;
}

export function buildSicBoTx(coins: string[], wagerRaw: bigint, characterId: string, kind: number, target: number): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::sicbo::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager, tx.pure.u8(kind), tx.pure.u8(target)],
  });
  return tx;
}

// ── v7 instant game builders ───────────────────────────────────────────────────

export function buildCrashTx(coins: string[], wagerRaw: bigint, characterId: string, targetBps: bigint): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::crash::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager, tx.pure.u64(targetBps)],
  });
  return tx;
}

export function buildDiamondsTx(coins: string[], wagerRaw: bigint, characterId: string): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::diamonds::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager],
  });
  return tx;
}

export function buildDoubleDiceTx(coins: string[], wagerRaw: bigint, characterId: string, kind: number, target: number): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::double_dice::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager, tx.pure.u8(kind), tx.pure.u8(target)],
  });
  return tx;
}

export function buildWarTx(coins: string[], wagerRaw: bigint, characterId: string): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::war::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager],
  });
  return tx;
}

export function buildBaccaratTx(coins: string[], wagerRaw: bigint, characterId: string, kind: number): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::baccarat::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager, tx.pure.u8(kind)],
  });
  return tx;
}

export function buildThreeCardTx(coins: string[], wagerRaw: bigint, characterId: string): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::three_card_poker::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager],
  });
  return tx;
}

export function buildDragonTigerTx(coins: string[], wagerRaw: bigint, characterId: string, betType: 0 | 1 | 2): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::dragon_tiger::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager, tx.pure.u8(betType)],
  });
  return tx;
}

export function buildUnderOver7Tx(coins: string[], wagerRaw: bigint, characterId: string, kind: 0 | 1 | 2): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::under_over_7::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager, tx.pure.u8(kind)],
  });
  return tx;
}

export function buildOreRefineTx(coins: string[], wagerRaw: bigint, characterId: string, tier: 1 | 2 | 3 | 4 | 5): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::ore_refine::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager, tx.pure.u8(tier)],
  });
  return tx;
}

// ── v18 tx builders ──────────────────────────────────────────────────────────────

export function buildRiskWheelTx(coins: string[], wagerRaw: bigint, characterId: string, mode: 0 | 1 | 2): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::risk_wheel::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager, tx.pure.u8(mode)],
  });
  return tx;
}

export function buildAndarBaharTx(coins: string[], wagerRaw: bigint, characterId: string, betSide: 0 | 1): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::andar_bahar::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager, tx.pure.u8(betSide)],
  });
  return tx;
}

export function buildScratchCardsTx(coins: string[], wagerRaw: bigint, characterId: string): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::scratch_cards::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager],
  });
  return tx;
}

export function buildChuckALuckTx(coins: string[], wagerRaw: bigint, characterId: string, target: number): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::chuck_a_luck::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager, tx.pure.u8(target)],
  });
  return tx;
}

export function buildRedDogTx(coins: string[], wagerRaw: bigint, characterId: string): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::red_dog::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager],
  });
  return tx;
}

export function buildMoneyWheelTx(coins: string[], wagerRaw: bigint, characterId: string): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::money_wheel::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager],
  });
  return tx;
}

// ── Resolution by digest ─────────────────────────────────────────────────────
export async function resolveInstantByDigest(game: InstantGameKey, digest: string): Promise<InstantResult | null> {
  const def = GAMES[game];
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await rpc("sui_getTransactionBlock", [digest, { showEvents: true }]);
      const eventNames = [def.event, ...(def.altEvents ?? [])];
      for (const e of res?.events ?? []) {
        if (typeof e.type === "string" && eventNames.some((ev) => e.type.endsWith(`::${def.module}::${ev}`))) {
          const f = e.parsedJson ?? {};
          return {
            game,
            wager: Number(f.wager ?? 0) / 1e9,
            payout: Number(f.payout ?? 0) / 1e9,
            detail: def.describe(f),
            fields: f,
            txDigest: digest,
          };
        }
      }
    } catch { /* fullnode lag — retry */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

// ── Feed: recent plays across all instant games ──────────────────────────────
// Feed rows cover BOTH instant games and stateful settles — `game` is a free
// label (instant keys plus "mines", "blackjack", "tower", "video poker").
export interface InstantFeedRow extends Omit<InstantResult, "game"> { game: string; player: string; ts: number; }

// Event pkg routing: events tag under the package version where the module was FIRST introduced.
// v1–v4 instant games (coinflip/dice/roulette/slots/wheel) tag under CASINO_V3.
// v5 new games (limbo/hilo/plinko/keno/sicbo) tag under CASINO_V5.
// v7 new games (crash/diamonds/double_dice/war/baccarat/three_card_poker) tag under CASINO_V7.
const EVENT_PKG: Record<InstantGameKey, string> = {
  coinflip: CASINO_V3, dice: CASINO_V3, roulette: CASINO_V3, slots: CASINO_V3, wheel: CASINO_V3,
  limbo: CASINO_V5, hilo: CASINO_V5, plinko: CASINO_V5, keno: CASINO_V5, sicbo: CASINO_V5,
  crash: CASINO_V7, diamonds: CASINO_V7, double_dice: CASINO_V7, war: CASINO_V7,
  baccarat: CASINO_V7, three_card_poker: CASINO_V7,
  // v16 new games: DragonTigerPlayed, UnderOver7Rolled, OreRefined introduced in v16.
  dragon_tiger: CASINO_V16, under_over_7: CASINO_V16, ore_refine: CASINO_V16,
  // v18 new games: RiskWheelSpun, MoneyWheelSpun introduced in v18.
  risk_wheel: CASINO_V18, money_wheel: CASINO_V18,
  // v19 new games: AndarBaharPlayed introduced in v19.
  andar_bahar: CASINO_V19,
  // v20 new games: ScratchCardPlayed introduced in v20.
  scratch_cards: CASINO_V20,
  // v21 new games: ChuckALuckRolled introduced in v21.
  chuck_a_luck: CASINO_V21,
  // v24 new games: RedDogPlayed introduced in v24.
  red_dog: CASINO_V24,
};

function eventPackages(historicalPkg: string): string[] {
  return Array.from(new Set([historicalPkg, CASINO_PKG].filter(Boolean)));
}

// Stateful games' settle events — merged into the all-games feed. Each event
// carries wager/payout/player like the instant events; pkg = version that
// INTRODUCED the event type (never CASINO_PKG).
const BJ_OUTCOME = (o: number) => (o === 3 ? "BLACKJACK" : o === 2 ? "win" : o === 1 ? "push" : "loss");
const STATEFUL_FEED: { label: string; pkg: string; module: string; event: string; describe: (f: any) => string }[] = [
  {
    label: "mines", pkg: CASINO_V5, module: "mines", event: "MinesSettled",
    describe: (f) => f.busted
      ? `hit a mine after ${Number(f.safe_revealed ?? 0)} safe`
      : `cashed out ${Number(f.safe_revealed ?? 0)} tiles @ ${(Number(f.multiplier_bps ?? 0) / 10000).toFixed(2)}x`,
  },
  {
    label: "blackjack", pkg: CASINO_ORIGINAL, module: "blackjack_live", event: "HandSettled",
    describe: (f) => `${Number(f.player_total ?? 0)} vs ${Number(f.dealer_total ?? 0)}${f.doubled ? " (doubled)" : ""} — ${BJ_OUTCOME(Number(f.outcome ?? 0))}`,
  },
  {
    label: "blackjack", pkg: CASINO_V2, module: "blackjack_live", event: "SplitSettled",
    describe: (f) => `split ${Number(f.total_a ?? 0)}/${Number(f.total_b ?? 0)} vs ${Number(f.dealer_total ?? 0)}`,
  },
  {
    label: "tower", pkg: CASINO_V7, module: "dragon_tower", event: "TowerSettled",
    describe: (f) => f.busted
      ? `dragon at row ${Number(f.rows_climbed ?? 0) + 1}`
      : `climbed ${Number(f.rows_climbed ?? 0)} rows @ ${(Number(f.multiplier_bps ?? 0) / 10000).toFixed(2)}x`,
  },
  {
    label: "video poker", pkg: CASINO_V7, module: "video_poker", event: "VideoPokerSettled",
    describe: (f) => POKER_HAND_RANKS[Number(f.hand_rank ?? 0)]?.label?.toLowerCase() ?? "—",
  },
  {
    label: "plinko", pkg: CASINO_V10, module: "plinko", event: "PlinkoModeDropped",
    describe: (f) => `${PLINKO_MODE_LABEL[Number(f.mode ?? 0)] ?? "?"} · bucket ${f.bucket} · ${(Number(f.multiplier_bps) / 10000).toFixed(2)}x`,
  },
  {
    // v12 multi-drop: total_payout covers all N drops in one tx
    label: "plinko", pkg: CASINO_PLINKO_MULTI, module: "plinko", event: "PlinkoMultiDropped",
    describe: (f) => {
      const modeLabel = Number(f.mode ?? 0) === 3 ? "CLASSIC" : (PLINKO_MODE_LABEL[Number(f.mode ?? 0)] ?? "?");
      const count = Number(f.count ?? 1);
      const wagerMist = Number(f.wager ?? 0);
      const perDropWager = count > 0 ? wagerMist / count : 0;
      if (Array.isArray(f.payouts) && perDropWager > 0) {
        const mults = (f.payouts as any[]).map((p) => {
          const mult = Number(p) / perDropWager;
          const s = mult.toFixed(2).replace(/\.?0+$/, "");
          return `${s}x`;
        });
        return `${modeLabel} ×${count} · ${mults.join("·")}`;
      }
      // fallback to aggregate if payouts array unavailable
      const totalPayout = Number(f.total_payout ?? 0) / 1e9;
      const wagerSui = wagerMist / 1e9;
      const totalX = wagerSui > 0 ? (totalPayout / wagerSui).toFixed(2) : "0.00";
      return `${modeLabel} ×${count} drops · ${totalX}x total`;
    },
  },
];

export async function fetchRecentInstantPlays(limit = 20): Promise<InstantFeedRow[]> {
  if (!CASINO_PKG) return [];
  // Query historical event packages plus the current fresh-publish package.
  // v27 is a fresh lineage, so new events tag under CASINO_PKG instead of the
  // older introduction packages used for pre-v27 feed history.
  const keys = (Object.keys(GAMES) as InstantGameKey[]).filter((k) => EVENT_PKG[k]);
  const instantQ = keys.flatMap((k) =>
    eventPackages(EVENT_PKG[k]).map((pkg) =>
      rpc("suix_queryEvents", [
        { MoveEventType: `${pkg}::${GAMES[k].module}::${GAMES[k].event}` },
        null, limit, true,
      ]).then((r) => ({ k, data: r.data ?? [] })).catch(() => ({ k, data: [] }))
    )
  );
  const statefulQ = STATEFUL_FEED.filter((d) => d.pkg).map((d) =>
    eventPackages(d.pkg).map((pkg) =>
      rpc("suix_queryEvents", [
        { MoveEventType: `${pkg}::${d.module}::${d.event}` },
        null, limit, true,
      ]).then((r) => ({ d, data: r.data ?? [] })).catch(() => ({ d, data: [] }))
    )
  ).flat();
  const [instantRes, statefulRes] = await Promise.all([Promise.all(instantQ), Promise.all(statefulQ)]);
  const rows: InstantFeedRow[] = [];
  for (const { k, data } of instantRes) {
    for (const e of data) {
      const f = e.parsedJson ?? {};
      rows.push({
        game: k,
        wager: Number(f.wager ?? 0) / 1e9,
        payout: Number(f.payout ?? 0) / 1e9,
        detail: GAMES[k].describe(f),
        fields: f,
        txDigest: e.id?.txDigest ?? "",
        player: f.player ?? "",
        ts: Number(e.timestampMs ?? 0),
      });
    }
  }
  for (const { d, data } of statefulRes) {
    for (const e of data) {
      const f = e.parsedJson ?? {};
      rows.push({
        game: d.label,
        wager: Number(f.wager ?? 0) / 1e9,
        payout: Number(f.payout ?? f.total_payout ?? 0) / 1e9,
        detail: d.describe(f),
        fields: f,
        txDigest: e.id?.txDigest ?? "",
        player: f.player ?? "",
        ts: Number(e.timestampMs ?? 0),
      });
    }
  }
  rows.sort((a, b) => b.ts - a.ts);
  return rows.slice(0, limit);
}
