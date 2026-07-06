// CradleOS Casino — on-chain helpers (house + blackjack)
//
// Wired directly to $EVE (9 decimals) on Stillness. All house-edge figures shown
// in the UI come from scripts/edge_sim.py (measured), never invented.

import { Transaction } from "@mysten/sui/transactions";
import {
  CASINO_PKG,
  CASINO_HOUSE,
  EVE_COIN_TYPE,
  RANDOM_OBJECT,
  SUI_TESTNET_RPC,
  SUI_TESTNET_RPC_DIRECT,
} from "../constants";

export const EVE_DECIMALS = 9;
export const EVE_UNIT = 1_000_000_000n; // 1 EVE in raw units

// Outcome codes mirrored from blackjack.move
export const OUT_LOSS = 0;
export const OUT_PUSH = 1;
export const OUT_WIN = 2;
export const OUT_BLACKJACK = 3;

export function outcomeLabel(o: number): string {
  switch (o) {
    case OUT_BLACKJACK: return "BLACKJACK";
    case OUT_WIN: return "WIN";
    case OUT_PUSH: return "PUSH";
    default: return "LOSS";
  }
}

// ── Card helpers (index 0..51; rank = i%13, suit = i/13) ────────────────────
// rank: 0=Ace,1..8 => 2..9, 9=10,10=J,11=Q,12=K
export const RANK_LABELS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
// Suits are themed to EVE Frontier deployable "Shell" types (see asset recon).
export const SUIT_KEYS = ["aggressive", "rugged", "ancient", "blank"] as const;
export const SUIT_LABELS = ["AGGRESSIVE", "RUGGED", "ANCIENT", "BLANK"];
// Monospace-safe glyphs (EVE Vault webview lacks color emoji — see MEMORY.md).
export const SUIT_GLYPHS = ["\u25C6", "\u25A3", "\u2756", "\u25EF"]; // ◆ ▣ ❖ ◯

export interface Card {
  index: number;
  rank: number;   // 0..12
  suit: number;   // 0..3
  rankLabel: string;
  suitGlyph: string;
  suitKey: string;
  value: number;  // blackjack value (Ace shown as 11)
}

export function decodeCard(index: number): Card {
  const rank = index % 13;
  const suit = Math.floor(index / 13);
  const value = rank === 0 ? 11 : rank >= 9 ? 10 : rank + 1;
  return {
    index, rank, suit,
    rankLabel: RANK_LABELS[rank],
    suitGlyph: SUIT_GLYPHS[suit],
    suitKey: SUIT_KEYS[suit],
    value,
  };
}

export interface HandRecord {
  txDigest: string;
  player: string;
  wager: number;        // in EVE (display units)
  standOn: number;
  playerCards: number[];
  dealerCards: number[];
  playerTotal: number;
  dealerTotal: number;
  outcome: number;
  payout: number;       // in EVE (display units)
  timestampMs: number | null;
}

export interface HouseState {
  bankBalance: number;   // EVE display units
  maxBet: number;        // EVE
  minBet: number;        // EVE
  paused: boolean;
  totalWagered: number;
  totalPaidOut: number;
  betsSettled: number;
}

// ── RPC ──────────────────────────────────────────────────────────────────────
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

/**
 * Direct-fullnode RPC — bypasses the DGX1 caching proxy.
 *
 * The proxy caches `sui_getObject` for 30s, which breaks the HIT
 * poll-until-changed loop in CasinoPanel: every 500ms poll returns the SAME
 * cached 2-card hand, the card count never grows, and the UI times out with
 * "card is taking a moment to appear". Live-hand reads are single-object,
 * low-volume, user-interactive — exactly the critical-path case
 * SUI_TESTNET_RPC_DIRECT exists for (see rpcGetObjectDirect in lib.ts).
 */
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

/** All EVE coin object ids owned by `owner`, with total balance (raw). */
export async function fetchEveCoins(owner: string): Promise<{ ids: string[]; totalRaw: bigint }> {
  const ids: string[] = [];
  let totalRaw = 0n;
  let cursor: string | null = null;
  // paginate — suix_getCoins caps at 50 (see MEMORY.md pagination rule)
  for (let guard = 0; guard < 25; guard++) {
    const result = await rpc("suix_getCoins", [owner, EVE_COIN_TYPE, cursor, 50]);
    for (const c of result.data ?? []) {
      ids.push(c.coinObjectId);
      totalRaw += BigInt(c.balance);
    }
    if (!result.hasNextPage) break;
    cursor = result.nextCursor;
  }
  return { ids, totalRaw };
}

/** Read live House shared-object state. */
export async function fetchHouseState(houseId: string): Promise<HouseState | null> {
  if (!houseId) return null;
  const res = await rpc("sui_getObject", [houseId, { showContent: true }]);
  const fields = res?.data?.content?.fields;
  if (!fields) return null;
  const n = (v: unknown) => Number(v ?? 0);
  return {
    bankBalance: n(fields.bank) / 1e9,
    maxBet: n(fields.max_bet) / 1e9,
    minBet: n(fields.min_bet) / 1e9,
    paused: Boolean(fields.paused),
    totalWagered: n(fields.total_wagered) / 1e9,
    totalPaidOut: n(fields.total_paid_out) / 1e9,
    betsSettled: n(fields.bets_settled),
  };
}

/** Recent blackjack hands (provably-fair feed), newest first. */
export async function fetchRecentHands(houseId: string, limit = 30): Promise<HandRecord[]> {
  if (!CASINO_PKG) return [];
  const result = await rpc("suix_queryEvents", [
    { MoveEventType: `${CASINO_PKG}::blackjack::HandPlayed` },
    null, limit, true, // descending = newest first
  ]);
  const out: HandRecord[] = [];
  for (const e of result.data ?? []) {
    const pj = e.parsedJson ?? {};
    if (houseId && pj.house_id !== houseId) continue;
    out.push({
      txDigest: e.id?.txDigest ?? "",
      player: pj.player ?? "",
      wager: Number(pj.wager ?? 0) / 1e9,
      standOn: Number(pj.stand_on ?? 0),
      playerCards: (pj.player_cards ?? []).map((x: any) => Number(x)),
      dealerCards: (pj.dealer_cards ?? []).map((x: any) => Number(x)),
      playerTotal: Number(pj.player_total ?? 0),
      dealerTotal: Number(pj.dealer_total ?? 0),
      outcome: Number(pj.outcome ?? 0),
      payout: Number(pj.payout ?? 0) / 1e9,
      timestampMs: e.timestampMs ? Number(e.timestampMs) : null,
    });
  }
  return out;
}

// ── Transactions ──────────────────────────────────────────────────────────────

/** Create + fund the House from the caller's EVE, sharing it and returning the
 *  admin cap to the caller. seedRaw/maxBetRaw/minBetRaw are raw EVE units. */
export function buildCreateHouseTx(
  eveCoinIds: string[],
  seedRaw: bigint,
  maxBetRaw: bigint,
  minBetRaw: bigint,
): Transaction {
  const tx = new Transaction();
  const primary = tx.object(eveCoinIds[0]);
  if (eveCoinIds.length > 1) {
    tx.mergeCoins(primary, eveCoinIds.slice(1).map((id) => tx.object(id)));
  }
  const [seed] = tx.splitCoins(primary, [tx.pure.u64(seedRaw)]);
  tx.moveCall({
    target: `${CASINO_PKG}::house::create_and_share`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [seed, tx.pure.u64(maxBetRaw), tx.pure.u64(minBetRaw)],
  });
  return tx;
}

/** Top up the House bankroll (admin only). */
export function buildFundHouseTx(
  houseId: string,
  adminCapId: string,
  eveCoinIds: string[],
  amountRaw: bigint,
): Transaction {
  const tx = new Transaction();
  const primary = tx.object(eveCoinIds[0]);
  if (eveCoinIds.length > 1) {
    tx.mergeCoins(primary, eveCoinIds.slice(1).map((id) => tx.object(id)));
  }
  const [funds] = tx.splitCoins(primary, [tx.pure.u64(amountRaw)]);
  tx.moveCall({
    target: `${CASINO_PKG}::house::deposit`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(houseId), tx.object(adminCapId), funds],
  });
  return tx;
}

/** Play a blackjack hand. wagerRaw is raw EVE units; standOn in [12,21]. */
export function buildPlayBlackjackTx(
  houseId: string,
  eveCoinIds: string[],
  wagerRaw: bigint,
  standOn: number,
): Transaction {
  const tx = new Transaction();
  const primary = tx.object(eveCoinIds[0]);
  if (eveCoinIds.length > 1) {
    tx.mergeCoins(primary, eveCoinIds.slice(1).map((id) => tx.object(id)));
  }
  const [wager] = tx.splitCoins(primary, [tx.pure.u64(wagerRaw)]);
  tx.moveCall({
    target: `${CASINO_PKG}::blackjack::play`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.object(houseId),
      tx.object(RANDOM_OBJECT),
      wager,
      tx.pure.u8(standOn),
    ],
  });
  return tx;
}

// Measured house edge per threshold (from scripts/edge_sim.py, 500k hands each).
// Shown in UI so players see real odds — never invented.
export const MEASURED_EDGE: Record<number, number> = {
  12: 7.41, 13: 6.61, 14: 5.36, 15: 4.88, 16: 5.18,
  17: 5.73, 18: 9.41, 19: 18.20, 20: 33.60, 21: 64.15,
};

// ── Interactive blackjack (commit-reveal: real hit/stand/double) ──────────────

export interface LiveHand {
  handId: string;
  player: string;
  wager: number;         // base wager, EVE
  playerCards: number[];
  dealerUpcard: number;
  playerTotal: number;
  settled: boolean;
}

export interface LiveSettlement {
  handId: string;
  wager: number;         // total staked (2x if doubled), EVE
  deck: number[];        // full 52-card order — provably-fair audit
  playerCards: number[];
  dealerCards: number[];
  playerTotal: number;
  dealerTotal: number;
  doubled: boolean;
  outcome: number;
  payout: number;        // EVE
  txDigest: string;
}

/** Best blackjack total for a set of card indices (client mirror of Move logic). */
export function handTotal(cards: number[]): number {
  let total = 0, aces = 0;
  for (const c of cards) {
    const r = c % 13;
    if (r === 0) { aces++; total += 11; }
    else if (r >= 9) total += 10;
    else total += r + 1;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

/** Tx1: deal a live hand. Consumes randomness once; escrows stake in a Hand. */
export function buildDealTx(eveCoinIds: string[], wagerRaw: bigint): Transaction {
  const tx = new Transaction();
  const primary = tx.object(eveCoinIds[0]);
  if (eveCoinIds.length > 1) tx.mergeCoins(primary, eveCoinIds.slice(1).map((id) => tx.object(id)));
  const [wager] = tx.splitCoins(primary, [tx.pure.u64(wagerRaw)]);
  tx.moveCall({
    target: `${CASINO_PKG}::blackjack_live::deal`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), wager],
  });
  return tx;
}

export function buildHitTx(handId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CASINO_PKG}::blackjack_live::hit`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(handId)],
  });
  return tx;
}

export function buildStandTx(handId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CASINO_PKG}::blackjack_live::stand`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(handId)],
  });
  return tx;
}

/** Double down: add an equal stake, draw one card, auto-stand + settle. */
export function buildDoubleTx(handId: string, eveCoinIds: string[], wagerRaw: bigint): Transaction {
  const tx = new Transaction();
  const primary = tx.object(eveCoinIds[0]);
  if (eveCoinIds.length > 1) tx.mergeCoins(primary, eveCoinIds.slice(1).map((id) => tx.object(id)));
  const [extra] = tx.splitCoins(primary, [tx.pure.u64(wagerRaw)]);
  tx.moveCall({
    target: `${CASINO_PKG}::blackjack_live::double`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(handId), extra],
  });
  return tx;
}

/** Extract the created Hand object id from a deal tx result (if not auto-settled). */
export function extractHandId(result: any): string | null {
  try {
    const effects = result.effects ?? result;
    const created = effects?.created ?? result.created ?? [];
    for (const c of created) {
      const o = c.owner;
      if (o && typeof o === "object" && "AddressOwner" in o) {
        return c.reference?.objectId ?? c.objectId ?? null;
      }
    }
  } catch {}
  return null;
}

/**
 * Resolve a deal tx by its digest — the AUTHORITATIVE path. The wallet signer
 * result usually omits effects/events, so "latest event" guessing shows the
 * wrong (stale) hand. Instead we read THIS tx block and pull its own created
 * Hand object + its own emitted event. Returns either a live hand id (player's
 * turn) or a settlement (natural blackjack that auto-resolved in deal).
 */
export async function resolveDealByDigest(digest: string): Promise<
  { kind: "live"; handId: string } | { kind: "settled"; settlement: LiveSettlement } | null
> {
  // Retry a few times — the fullnode may lag a beat behind the tx.
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await rpc("sui_getTransactionBlock", [
        digest,
        { showEffects: true, showEvents: true, showObjectChanges: true },
      ]);
      const events = res?.events ?? [];
      // 1) AUTHORITATIVE: HandSettled event in THIS tx = natural BJ auto-resolved
      //    inside deal. Settled path takes precedence over a live hand.
      for (const e of events) {
        if (typeof e.type === "string" && e.type.endsWith("::blackjack_live::HandSettled")) {
          const pj = e.parsedJson ?? {};
          return { kind: "settled", settlement: {
            handId: pj.hand_id ?? "",
            wager: Number(pj.wager ?? 0) / 1e9,
            deck: (pj.deck ?? []).map((x: any) => Number(x)),
            playerCards: (pj.player_cards ?? []).map((x: any) => Number(x)),
            dealerCards: (pj.dealer_cards ?? []).map((x: any) => Number(x)),
            playerTotal: Number(pj.player_total ?? 0),
            dealerTotal: Number(pj.dealer_total ?? 0),
            doubled: Boolean(pj.doubled),
            outcome: Number(pj.outcome ?? 0),
            payout: Number(pj.payout ?? 0) / 1e9,
            txDigest: digest,
          } };
        }
      }
      // 2) AUTHORITATIVE live turn: read hand_id from the HandDealt event. This
      //    is object::id(&hand) straight from the contract — never a coin. Using
      //    objectChanges here was the bug: it could return a created Coin id,
      //    so the next hit/stand/double called tx.object(<coin>) and failed with
      //    "Object ... not found".
      for (const e of events) {
        if (typeof e.type === "string" && e.type.endsWith("::blackjack_live::HandDealt")) {
          const pj = e.parsedJson ?? {};
          if (pj.hand_id) return { kind: "live", handId: String(pj.hand_id) };
        }
      }
      // 3) Fallback ONLY if no event surfaced: scan objectChanges for the Hand
      //    object type explicitly (must match ::blackjack_live::Hand<, not a coin).
      const changes = res?.objectChanges ?? [];
      for (const ch of changes) {
        if (ch.type === "created" && typeof ch.objectType === "string" && ch.objectType.includes("::blackjack_live::Hand<")) {
          return { kind: "live", handId: ch.objectId };
        }
      }
    } catch { /* fullnode lag — retry */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

/** Resolve a settling action (stand/hit-bust/double) by tx digest → settlement. */
export async function resolveSettleByDigest(digest: string): Promise<LiveSettlement | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await rpc("sui_getTransactionBlock", [digest, { showEvents: true }]);
      const events = res?.events ?? [];
      for (const e of events) {
        if (typeof e.type === "string" && e.type.endsWith("::blackjack_live::HandSettled")) {
          const pj = e.parsedJson ?? {};
          return {
            handId: pj.hand_id ?? "",
            wager: Number(pj.wager ?? 0) / 1e9,
            deck: (pj.deck ?? []).map((x: any) => Number(x)),
            playerCards: (pj.player_cards ?? []).map((x: any) => Number(x)),
            dealerCards: (pj.dealer_cards ?? []).map((x: any) => Number(x)),
            playerTotal: Number(pj.player_total ?? 0),
            dealerTotal: Number(pj.dealer_total ?? 0),
            doubled: Boolean(pj.doubled),
            outcome: Number(pj.outcome ?? 0),
            payout: Number(pj.payout ?? 0) / 1e9,
            txDigest: digest,
          };
        }
      }
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

/** Read a live Hand object (returns null if it no longer exists = settled). */
export async function fetchLiveHand(handId: string): Promise<LiveHand | null> {
  // Direct fullnode: must observe hit/stand mutations in real time (see rpcDirect).
  const res = await rpcDirect("sui_getObject", [handId, { showContent: true }]);
  const f = res?.data?.content?.fields;
  if (!f) return null;
  const pc = (f.player_cards ?? []).map((x: any) => Number(x));
  return {
    handId,
    player: f.player,
    wager: Number(f.base_wager ?? 0) / 1e9,
    playerCards: pc,
    dealerUpcard: Number((f.dealer_cards ?? [])[0] ?? 0),
    playerTotal: handTotal(pc),
    settled: false,
  };
}

/** Find the settlement for a given hand id (poll after a settling action). */
export async function fetchSettlement(handId: string): Promise<LiveSettlement | null> {
  if (!CASINO_PKG) return null;
  const result = await rpc("suix_queryEvents", [
    { MoveEventType: `${CASINO_PKG}::blackjack_live::HandSettled` },
    null, 30, true,
  ]);
  for (const e of result.data ?? []) {
    const pj = e.parsedJson ?? {};
    if (pj.hand_id !== handId) continue;
    return {
      handId,
      wager: Number(pj.wager ?? 0) / 1e9,
      deck: (pj.deck ?? []).map((x: any) => Number(x)),
      playerCards: (pj.player_cards ?? []).map((x: any) => Number(x)),
      dealerCards: (pj.dealer_cards ?? []).map((x: any) => Number(x)),
      playerTotal: Number(pj.player_total ?? 0),
      dealerTotal: Number(pj.dealer_total ?? 0),
      doubled: Boolean(pj.doubled),
      outcome: Number(pj.outcome ?? 0),
      payout: Number(pj.payout ?? 0) / 1e9,
      txDigest: e.id?.txDigest ?? "",
    };
  }
  return null;
}

/** Recent live-blackjack settlements for the feed, newest first. */
export async function fetchRecentLiveHands(limit = 25): Promise<LiveSettlement[]> {
  if (!CASINO_PKG) return [];
  const result = await rpc("suix_queryEvents", [
    { MoveEventType: `${CASINO_PKG}::blackjack_live::HandSettled` },
    null, limit, true,
  ]);
  return (result.data ?? []).map((e: any) => {
    const pj = e.parsedJson ?? {};
    return {
      handId: pj.hand_id ?? "",
      wager: Number(pj.wager ?? 0) / 1e9,
      deck: [],
      playerCards: (pj.player_cards ?? []).map((x: any) => Number(x)),
      dealerCards: (pj.dealer_cards ?? []).map((x: any) => Number(x)),
      playerTotal: Number(pj.player_total ?? 0),
      dealerTotal: Number(pj.dealer_total ?? 0),
      doubled: Boolean(pj.doubled),
      outcome: Number(pj.outcome ?? 0),
      payout: Number(pj.payout ?? 0) / 1e9,
      txDigest: e.id?.txDigest ?? "",
      player: pj.player ?? "",
    } as LiveSettlement & { player: string };
  });
}
