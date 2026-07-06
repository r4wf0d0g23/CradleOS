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
  CASINO_HOUSE,
  EVE_COIN_TYPE,
  RANDOM_OBJECT,
  SUI_TESTNET_RPC,
} from "../constants";

export type InstantGameKey = "coinflip" | "dice" | "roulette" | "slots" | "wheel";

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
  describe: (f: Record<string, any>) => string;
}

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

const GAMES: Record<InstantGameKey, GameDef> = {
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
};

// ── Tx builders ───────────────────────────────────────────────────────────────
function baseTx(eveCoinIds: string[], wagerRaw: bigint): { tx: Transaction; wager: any } {
  const tx = new Transaction();
  const primary = tx.object(eveCoinIds[0]);
  if (eveCoinIds.length > 1) tx.mergeCoins(primary, eveCoinIds.slice(1).map((id) => tx.object(id)));
  const [wager] = tx.splitCoins(primary, [tx.pure.u64(wagerRaw)]);
  return { tx, wager };
}

export function buildCoinflipTx(coins: string[], wagerRaw: bigint, choice: 0 | 1): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::coinflip::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), wager, tx.pure.u8(choice)],
  });
  return tx;
}

export function buildDiceTx(coins: string[], wagerRaw: bigint, target: number, over: boolean): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::dice::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), wager, tx.pure.u8(target), tx.pure.bool(over)],
  });
  return tx;
}

export function buildRouletteTx(coins: string[], wagerRaw: bigint, kind: number, target: number): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::roulette::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), wager, tx.pure.u8(kind), tx.pure.u8(target)],
  });
  return tx;
}

export function buildSlotsTx(coins: string[], wagerRaw: bigint): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::slots::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), wager],
  });
  return tx;
}

export function buildWheelTx(coins: string[], wagerRaw: bigint): Transaction {
  const { tx, wager } = baseTx(coins, wagerRaw);
  tx.moveCall({
    target: `${CASINO_PKG}::wheel::play`, typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), wager],
  });
  return tx;
}

// ── Resolution by digest ─────────────────────────────────────────────────────
export async function resolveInstantByDigest(game: InstantGameKey, digest: string): Promise<InstantResult | null> {
  const def = GAMES[game];
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await rpc("sui_getTransactionBlock", [digest, { showEvents: true }]);
      for (const e of res?.events ?? []) {
        if (typeof e.type === "string" && e.type.endsWith(`::${def.module}::${def.event}`)) {
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
export interface InstantFeedRow extends InstantResult { player: string; ts: number; }

export async function fetchRecentInstantPlays(limit = 20): Promise<InstantFeedRow[]> {
  if (!CASINO_PKG) return [];
  const keys = Object.keys(GAMES) as InstantGameKey[];
  const results = await Promise.all(keys.map((k) =>
    rpc("suix_queryEvents", [
      { MoveEventType: `${CASINO_PKG}::${GAMES[k].module}::${GAMES[k].event}` },
      null, limit, true,
    ]).then((r) => ({ k, data: r.data ?? [] })).catch(() => ({ k, data: [] }))
  ));
  const rows: InstantFeedRow[] = [];
  for (const { k, data } of results) {
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
  rows.sort((a, b) => b.ts - a.ts);
  return rows.slice(0, limit);
}
