/**
 * casinoVideoPoker.ts — Video Poker stateful game helpers.
 *
 * Game flow:
 *   1. Player calls `video_poker::deal` → creates player-owned VideoPokerHand object.
 *      Event: VideoPokerDealt { hand_id, player, wager, cards: vector<u8>(5) }
 *   2. Player selects which cards to hold (bits 0-4 of hold_mask) → calls `video_poker::draw`.
 *      Event: VideoPokerSettled { hand_id, player, wager, final_cards, hand_rank, multiplier_bps, payout }
 *
 * Card encoding: 0-51, rank = index % 13 (0=Ace..12=King), suit = floor(index / 13).
 *
 * Resolution discipline: resolve every tx by ITS OWN digest.
 */
import { Transaction } from "@mysten/sui/transactions";
import {
  CASINO_PKG,
  CASINO_V7,
  CASINO_HOUSE,
  EVE_COIN_TYPE,
  RANDOM_OBJECT,
  SUI_TESTNET_RPC,
  SUI_TESTNET_RPC_DIRECT,
} from "../constants";
import { withGas, fetchEveCoins, fetchOwnedRefDirect } from "./casino";

export { withGas, fetchEveCoins };

// ── RPC ───────────────────────────────────────────────────────────────────────
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

async function rpcDirect(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(SUI_TESTNET_RPC_DIRECT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message ?? "RPC error");
  return j.result;
}

// ── Hand rank definitions ─────────────────────────────────────────────────────
export interface HandRankDef {
  rank: number;
  label: string;
  mult: number;
}

export const POKER_HAND_RANKS: HandRankDef[] = [
  { rank: 0, label: "LOSS",          mult: 0   },
  { rank: 1, label: "JACKS OR BETTER", mult: 1 },
  { rank: 2, label: "TWO PAIR",      mult: 2   },
  { rank: 3, label: "THREE OF A KIND", mult: 3 },
  { rank: 4, label: "STRAIGHT",      mult: 4   },
  { rank: 5, label: "FLUSH",         mult: 5   },
  { rank: 6, label: "FULL HOUSE",    mult: 7   },
  { rank: 7, label: "FOUR OF A KIND", mult: 20 },
  { rank: 8, label: "STRAIGHT FLUSH", mult: 50 },
  { rank: 9, label: "ROYAL FLUSH",   mult: 250 },
];

// Card decoding helpers
export const VP_RANK_LABELS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
// Monospace-safe suit glyphs
export const VP_SUIT_GLYPHS = ["\u25C6", "\u25A3", "\u2756", "\u25EF"]; // ◆ ▣ ❖ ◯
export const VP_SUIT_COLORS = ["#FF4700", "#FF4700", "#7FC8FF", "#7FC8FF"];

export function decodeVPCard(index: number): { rank: number; suit: number; rankLabel: string; suitGlyph: string; suitColor: string } {
  const rank = index % 13;
  const suit = Math.floor(index / 13);
  return {
    rank, suit,
    rankLabel: VP_RANK_LABELS[rank] ?? "?",
    suitGlyph: VP_SUIT_GLYPHS[suit] ?? "?",
    suitColor: VP_SUIT_COLORS[suit] ?? "#888",
  };
}

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface VideoPokerDealResult {
  handId: string;
  player: string;
  wager: number;   // EVE display units
  cards: number[]; // 5 card indices
}

export interface VideoPokerSettleResult {
  handId: string;
  wager: number;
  finalCards: number[];
  handRank: number;
  multiplierBps: number;
  payout: number;  // EVE display units
}

export interface VideoPokerHandState {
  handId: string;
  wager: number;
  cards: number[];
}

// ── Tx builders ───────────────────────────────────────────────────────────────

export function buildVideoPokerDealTx(coins: string[], wagerRaw: bigint): Transaction {
  const tx = new Transaction();
  const primary = tx.object(coins[0]);
  if (coins.length > 1) tx.mergeCoins(primary, coins.slice(1).map((id) => tx.object(id)));
  const [wager] = tx.splitCoins(primary, [tx.pure.u64(wagerRaw)]);
  tx.moveCall({
    target: `${CASINO_PKG}::video_poker::deal`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), wager],
  });
  return tx;
}

export async function buildVideoPokerDrawTx(handId: string, holdMask: number): Promise<Transaction> {
  const ref = await fetchOwnedRefDirect(handId); // fresh ref — proxy-cached versions equivocate
  const tx = new Transaction();
  tx.moveCall({
    target: `${CASINO_PKG}::video_poker::draw`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.objectRef(ref), tx.pure.u8(holdMask)],
  });
  return tx;
}

// ── Resolution by digest ──────────────────────────────────────────────────────

export async function resolveVideoPokerDealByDigest(digest: string): Promise<VideoPokerDealResult | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await rpc("sui_getTransactionBlock", [digest, { showEvents: true }]);
      for (const e of res?.events ?? []) {
        if (typeof e.type === "string" && e.type.endsWith("::video_poker::VideoPokerDealt")) {
          const f = e.parsedJson ?? {};
          return {
            handId: String(f.hand_id ?? ""),
            player: String(f.player ?? ""),
            wager: Number(f.wager ?? 0) / 1e9,
            cards: Array.isArray(f.cards) ? (f.cards as any[]).map(Number) : [],
          };
        }
      }
    } catch { /* fullnode lag — retry */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

export async function resolveVideoPokerDrawByDigest(digest: string): Promise<VideoPokerSettleResult | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await rpc("sui_getTransactionBlock", [digest, { showEvents: true }]);
      for (const e of res?.events ?? []) {
        if (typeof e.type === "string" && e.type.endsWith("::video_poker::VideoPokerSettled")) {
          const f = e.parsedJson ?? {};
          return {
            handId: String(f.hand_id ?? ""),
            wager: Number(f.wager ?? 0) / 1e9,
            finalCards: Array.isArray(f.final_cards) ? (f.final_cards as any[]).map(Number) : [],
            handRank: Number(f.hand_rank ?? 0),
            multiplierBps: Number(f.multiplier_bps ?? 0),
            payout: Number(f.payout ?? 0) / 1e9,
          };
        }
      }
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

// ── Active hand fetch ─────────────────────────────────────────────────────────

export async function fetchActiveVideoPokerHand(addr: string): Promise<VideoPokerHandState | null> {
  if (!CASINO_PKG || !addr) return null;
  try {
    const result = await rpcDirect("suix_getOwnedObjects", [
      addr,
      {
        filter: { StructType: `${CASINO_V7}::video_poker::VideoPokerHand<${EVE_COIN_TYPE}>` },
        options: { showContent: true, showType: true },
      },
      null,
      1,
    ]);
    const obj = result?.data?.[0];
    if (!obj?.data) return null;
    const f = obj.data?.content?.fields ?? {};
    const handId = obj.data.objectId ?? "";
    if (!handId) return null;

    let wagerRaw = 0n;
    try {
      if (f.wager?.fields?.balance?.fields?.value !== undefined) {
        wagerRaw = BigInt(f.wager.fields.balance.fields.value);
      } else if (f.wager?.fields?.value !== undefined) {
        wagerRaw = BigInt(f.wager.fields.value);
      } else if (f.wager !== undefined && f.wager !== null) {
        wagerRaw = BigInt(f.wager);
      }
    } catch { /* unable to parse wager */ }

    const cards = Array.isArray(f.cards) ? (f.cards as any[]).map(Number) : [];
    return { handId, wager: Number(wagerRaw) / 1e9, cards };
  } catch {
    return null;
  }
}
