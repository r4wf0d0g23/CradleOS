// CradleOS Casino — on-chain helpers (house + blackjack)
//
// Wired directly to $EVE (9 decimals) on Stillness. All house-edge figures shown
// in the UI come from scripts/edge_sim.py (measured), never invented.

import { Transaction } from "@mysten/sui/transactions";
import {
  CASINO_PKG,
  CASINO_ORIGINAL,
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
  /** Risk tier ordinal 0..4 (SEED/SMALL/MEDIUM/LARGE/WHALE), derived from bank. */
  riskTier: number;
  /** Basis points of bank riskable on a single bet at the current tier. */
  exposureBps: number;
}

// ── Risk tiers (v29) ──────────────────────────────────────────────────────
//
// MUST stay in lockstep with the constants in `house.move`. If the Move tier
// bands or bps change, change them here too — the UI would otherwise display a
// cap the chain will reject (or hide headroom the chain would allow).

/** Tier upper bounds in EVE display units (exclusive). */
export const TIER_BOUNDS_EVE = [1_000, 10_000, 50_000, 250_000] as const;
/** Basis points of bank riskable on one bet, indexed by tier ordinal. */
export const TIER_BPS = [100, 200, 300, 400, 500] as const;
export const TIER_NAMES = ["SEED", "SMALL", "MEDIUM", "LARGE", "WHALE"] as const;

/** Tier ordinal for a bank size in EVE. Mirrors `house::risk_tier`. */
export function riskTierForBank(bankEve: number): number {
  for (let i = 0; i < TIER_BOUNDS_EVE.length; i++) {
    if (bankEve < TIER_BOUNDS_EVE[i]) return i;
  }
  return TIER_BPS.length - 1;
}

/** Single-bet exposure budget in EVE. Mirrors `house::max_exposure`. */
export function maxExposureEve(bankEve: number): number {
  return (bankEve * TIER_BPS[riskTierForBank(bankEve)]) / 10_000;
}

/**
 * Effective max bet for a game whose worst-case gross payout is `grossMult`x.
 * Mirrors `house::effective_max_bet`: min(tier-derived cap, admin max_bet).
 */
export function effectiveMaxBetEve(bankEve: number, grossMult: number, maxBetEve: number): number {
  const m = grossMult > 0 ? grossMult : 1;
  const derived = maxExposureEve(bankEve) / m;
  return maxBetEve > 0 ? Math.min(derived, maxBetEve) : derived;
}

/** EVE needed to reach the next tier, or null if already at the top. */
export function eveToNextTier(bankEve: number): { needed: number; nextTier: number } | null {
  const t = riskTierForBank(bankEve);
  if (t >= TIER_BOUNDS_EVE.length) return null;
  return { needed: Math.max(0, TIER_BOUNDS_EVE[t] - bankEve), nextTier: t + 1 };
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

/** All EVE coin object ids owned by `owner`, with total balance (raw).
 *
 *  DIRECT fullnode read (not the caching proxy): these ids feed straight into
 *  tx building, and consecutive plays consume/merge coin objects. A cached
 *  list from the proxy (5s TTL) can hand back a spent coin id → the wallet
 *  builds a tx on a dead object → "Object ... not found". Observed live on
 *  back-to-back slots spins, 2026-07-06. */
export async function fetchEveCoins(owner: string): Promise<{ ids: string[]; totalRaw: bigint }> {
  const ids: string[] = [];
  let totalRaw = 0n;
  let cursor: string | null = null;
  // paginate — suix_getCoins caps at 50 (see MEMORY.md pagination rule)
  for (let guard = 0; guard < 25; guard++) {
    const result = await rpcDirect("suix_getCoins", [owner, EVE_COIN_TYPE, cursor, 50]);
    for (const c of result.data ?? []) {
      ids.push(c.coinObjectId);
      totalRaw += BigInt(c.balance);
    }
    if (!result.hasNextPage) break;
    cursor = result.nextCursor;
  }
  return { ids, totalRaw };
}

/**
 * Explicit gas wiring — bypasses EVE Vault's wallet-side gas selection.
 *
 * Root cause of the recurring "InsufficientGas" on the SECOND+ deal
 * (observed 2026-07-06): every casino tx mutates the player's SUI gas coin.
 * When the next deal is built seconds later, the wallet's own gas resolution
 * (dry-run estimation with budget=null) works from stale coin state on its
 * fullnode and reports InsufficientGas even though the wallet holds plenty
 * of SUI. Deal #1 after a fresh page load always works because nothing has
 * mutated the gas coin yet.
 *
 * Fix: the dApp sets gas payment (fresh refs from the DIRECT fullnode — the
 * same node that just served our settle-by-digest read, so it has already
 * indexed the previous tx) and a fixed budget. With payment+budget present
 * the wallet skips gas selection AND the dry-run estimation entirely.
 */
const GAS_BUDGET_MIST = 50_000_000n; // 0.05 SUI — generous for any casino tx
export async function withGas<T extends Transaction>(tx: T, owner: string): Promise<T> {
  const coins: { objectId: string; version: string; digest: string; balance: bigint }[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 10; guard++) {
    const r = await rpcDirect("suix_getCoins", [owner, "0x2::sui::SUI", cursor, 50]);
    for (const c of r.data ?? []) {
      coins.push({ objectId: c.coinObjectId, version: c.version, digest: c.digest, balance: BigInt(c.balance) });
    }
    if (!r.hasNextPage) break;
    cursor = r.nextCursor;
  }
  if (!coins.length) throw new Error("No SUI in wallet for gas — top up via the testnet faucet.");
  // Largest coins first; pass up to 16 as payment (gas smashing merges them,
  // which also consolidates faucet dust as a side benefit).
  coins.sort((a, b) => (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0));
  const picked = coins.slice(0, 16);
  const total = picked.reduce((s, c) => s + c.balance, 0n);
  tx.setGasPayment(picked.map(({ objectId, version, digest }) => ({ objectId, version, digest })));
  tx.setGasBudget(total < GAS_BUDGET_MIST ? total : GAS_BUDGET_MIST);
  return tx;
}

/** Read live House shared-object state. */
export async function fetchHouseState(houseId: string): Promise<HouseState | null> {
  if (!houseId) return null;
  const res = await rpc("sui_getObject", [houseId, { showContent: true }]);
  const fields = res?.data?.content?.fields;
  if (!fields) return null;
  const n = (v: unknown) => Number(v ?? 0);
  const bankBalance = n(fields.bank) / 1e9;
  const riskTier = riskTierForBank(bankBalance);
  return {
    bankBalance,
    maxBet: n(fields.max_bet) / 1e9,
    minBet: n(fields.min_bet) / 1e9,
    paused: Boolean(fields.paused),
    totalWagered: n(fields.total_wagered) / 1e9,
    totalPaidOut: n(fields.total_paid_out) / 1e9,
    betsSettled: n(fields.bets_settled),
    riskTier,
    exposureBps: TIER_BPS[riskTier],
  };
}

/**
 * Fresh owned-object ref straight from the fullnode (bypasses the caching
 * proxy). Use when building txs on owned game objects that mutate between
 * player actions (TowerGame, MinesGame, HiLoGame, VideoPokerHand) — a
 * proxy-cached version produces "provided version doesn't match" equivocation
 * errors on the second action.
 */
export async function fetchOwnedRefDirect(objectId: string): Promise<{ objectId: string; version: string; digest: string }> {
  const res = await rpcDirect("sui_getObject", [objectId, {}]);
  const d = res?.data;
  if (!d?.objectId) throw new Error("Game object not found on the fullnode — try again in a moment.");
  return { objectId: d.objectId, version: d.version, digest: d.digest };
}

/**
 * Dynamic bet preset chips — derived from the effective per-game cap:
 *   min( house exposure budget / max gross multiplier, house max_bet, wallet balance )
 * rounded DOWN (whole EVE when the cap is ≥20, else 0.1 steps). Returns an
 * ascending ladder ending at the exact cap (the MAX chip). Falls back to the
 * classic static ladder while house/bank data is still loading.
 */
export function betPresets(opts: {
  bank?: number;        // house bank (EVE) — exposure guard is 3% of this
  grossMult?: number;   // game's max gross multiplier (x); omit if no on-chain exposure guard
  maxBet?: number;      // house max_bet (EVE)
  minBet?: number;      // house min_bet (EVE)
  walletEve?: number;   // player balance (EVE)
}): number[] {
  const { bank = 0, grossMult = 0, maxBet = 0, minBet = 0, walletEve = 0 } = opts;
  let cap = Infinity;
  // v29: exposure share is now tier-derived (was a flat 3%), matching
  // `house::effective_max_bet`. Keeps the preset ladder in step with what the
  // chain will actually accept as the bank grows via donations.
  if (bank > 0 && grossMult > 0) cap = Math.min(cap, maxExposureEve(bank) / grossMult);
  if (maxBet > 0) cap = Math.min(cap, maxBet);
  if (walletEve > 0) cap = Math.min(cap, walletEve);
  if (!Number.isFinite(cap) || cap <= 0) return [5, 10, 25, 100];
  const fl = (v: number) => (cap >= 20 ? Math.floor(v) : Math.floor(v * 10) / 10);
  const ladder = [fl(cap * 0.1), fl(cap * 0.25), fl(cap * 0.5), fl(cap)];
  const out: number[] = [];
  for (const v of ladder) {
    if (v > 0 && v >= minBet && !out.includes(v)) out.push(v);
  }
  if (!out.length && minBet > 0) out.push(minBet);
  return out;
}

/** Recent blackjack hands (provably-fair feed), newest first. */
export async function fetchRecentHands(houseId: string, limit = 30): Promise<HandRecord[]> {
  if (!CASINO_PKG) return [];
  const result = await rpc("suix_queryEvents", [
    { MoveEventType: `${CASINO_ORIGINAL}::blackjack::HandPlayed` },
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

/**
 * PUBLIC donation to the House bankroll (v29) — no admin cap required.
 *
 * Distinct from `buildFundHouseTx` (admin `house::deposit`): this hits
 * `house::donate`, which anyone may call. `label` is an optional donor tag
 * shown on the leaderboard; pass an empty string to donate anonymously.
 * Contract caps the label at 64 bytes, so it is truncated here to match.
 */
export function buildDonateTx(
  houseId: string,
  eveCoinIds: string[],
  amountRaw: bigint,
  label = "",
): Transaction {
  const tx = new Transaction();
  const primary = tx.object(eveCoinIds[0]);
  if (eveCoinIds.length > 1) {
    tx.mergeCoins(primary, eveCoinIds.slice(1).map((id) => tx.object(id)));
  }
  const [funds] = tx.splitCoins(primary, [tx.pure.u64(amountRaw)]);
  // Enforce the on-chain 64-BYTE limit (not 64 chars — multibyte labels count
  // per byte, so slicing by character could still abort ELabelTooLong).
  const bytes = new TextEncoder().encode(label);
  const labelBytes = bytes.length > 64 ? Array.from(bytes.slice(0, 64)) : Array.from(bytes);
  tx.moveCall({
    target: `${CASINO_PKG}::house::donate`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(houseId), funds, tx.pure.vector("u8", labelBytes)],
  });
  return tx;
}

export interface DonationRecord {
  txDigest: string;
  donor: string;
  amount: number;      // EVE
  label: string;
  newBalance: number;  // EVE, bank AFTER the donation
  timestampMs: number | null;
}

/** Recent public donations, newest first. Feeds the donor leaderboard. */
export async function fetchRecentDonations(houseId: string, limit = 50): Promise<DonationRecord[]> {
  if (!CASINO_PKG) return [];
  const result = await rpc("suix_queryEvents", [
    { MoveEventType: `${CASINO_ORIGINAL}::house::Donation` },
    null, limit, true, // descending = newest first
  ]);
  const dec = new TextDecoder();
  const out: DonationRecord[] = [];
  for (const e of result.data ?? []) {
    const pj = e.parsedJson ?? {};
    if (houseId && pj.house_id !== houseId) continue;
    // `label` arrives as a byte array (vector<u8>) or, depending on RPC
    // normalisation, already as a string. Handle both.
    let label = "";
    const raw = pj.label;
    if (typeof raw === "string") label = raw;
    else if (Array.isArray(raw)) label = dec.decode(new Uint8Array(raw.map((x: any) => Number(x))));
    out.push({
      txDigest: e.id?.txDigest ?? "",
      donor: pj.donor ?? "",
      amount: Number(pj.amount ?? 0) / 1e9,
      label,
      newBalance: Number(pj.new_balance ?? 0) / 1e9,
      timestampMs: e.timestampMs ? Number(e.timestampMs) : null,
    });
  }
  return out;
}

export interface DonorTotal {
  donor: string;
  label: string;   // most recent non-empty label this donor used
  total: number;   // EVE
  count: number;
}

/** Aggregate donations by donor address, descending by total contributed. */
export function aggregateDonors(records: DonationRecord[]): DonorTotal[] {
  const byDonor = new Map<string, DonorTotal>();
  // Records arrive newest-first, so the FIRST label seen for a donor is their
  // most recent one.
  for (const r of records) {
    const cur = byDonor.get(r.donor);
    if (cur) {
      cur.total += r.amount;
      cur.count += 1;
      if (!cur.label && r.label) cur.label = r.label;
    } else {
      byDonor.set(r.donor, { donor: r.donor, label: r.label, total: r.amount, count: 1 });
    }
  }
  return Array.from(byDonor.values()).sort((a, b) => b.total - a.total);
}

/** Play a blackjack hand. wagerRaw is raw EVE units; standOn in [12,21]. */
export function buildPlayBlackjackTx(
  houseId: string,
  eveCoinIds: string[],
  wagerRaw: bigint,
  characterId: string,
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
      tx.object(characterId),
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

export interface LiveSplitHand {
  splitId: string;
  player: string;
  wager: number;         // per-hand wager, EVE (total escrow = 2x)
  handA: number[];
  handB: number[];
  dealerUpcard: number;
  active: 0 | 1;         // which hand is being played
  totalA: number;
  totalB: number;
}

export interface SplitSettlement {
  splitId: string;
  wager: number;         // total staked (2 × per-hand), EVE
  deck: number[];
  handA: number[];
  handB: number[];
  dealerCards: number[];
  totalA: number;
  totalB: number;
  dealerTotal: number;
  outcomeA: number;
  outcomeB: number;
  payout: number;        // combined, EVE
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
export function buildDealTx(eveCoinIds: string[], wagerRaw: bigint, characterId: string): Transaction {
  const tx = new Transaction();
  const primary = tx.object(eveCoinIds[0]);
  if (eveCoinIds.length > 1) tx.mergeCoins(primary, eveCoinIds.slice(1).map((id) => tx.object(id)));
  const [wager] = tx.splitCoins(primary, [tx.pure.u64(wagerRaw)]);
  tx.moveCall({
    target: `${CASINO_PKG}::blackjack_live::deal`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager],
  });
  return tx;
}

// 2026-07-19: pin the Hand's CURRENT objectRef (id/version/digest) fetched
// fresh from the direct fullnode right before building the tx. The Hand is a
// player-OWNED object created by `deal` and mutated by prior actions; the SDK's
// object cache holds the version it saw at deal time, so `tx.object(handId)`
// was sending a STALE version -> "provided version doesn't match, provided:
// Some(<old>) actual: <new>" and the hit/stand/double could not be signed.
// Pinning the fresh ref removes the SDK's version guess entirely.
async function freshHandRef(tx: Transaction, handId: string) {
  const res = await rpcDirect("sui_getObject", [handId, { showOwner: false }]);
  const d = res?.data;
  if (!d?.objectId || d.version == null || !d.digest) {
    throw new Error("Hand object not found or already settled — refresh and start a new hand.");
  }
  return tx.objectRef({ objectId: d.objectId, version: d.version, digest: d.digest });
}

export async function buildHitTx(handId: string): Promise<Transaction> {
  const tx = new Transaction();
  const hand = await freshHandRef(tx, handId);
  tx.moveCall({
    target: `${CASINO_PKG}::blackjack_live::hit`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), hand],
  });
  return tx;
}

export async function buildStandTx(handId: string): Promise<Transaction> {
  const tx = new Transaction();
  const hand = await freshHandRef(tx, handId);
  tx.moveCall({
    target: `${CASINO_PKG}::blackjack_live::stand`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), hand],
  });
  return tx;
}

/** Double down: add an equal stake, draw one card, auto-stand + settle. */
export async function buildDoubleTx(handId: string, eveCoinIds: string[], wagerRaw: bigint): Promise<Transaction> {
  const tx = new Transaction();
  const primary = tx.object(eveCoinIds[0]);
  if (eveCoinIds.length > 1) tx.mergeCoins(primary, eveCoinIds.slice(1).map((id) => tx.object(id)));
  const [extra] = tx.splitCoins(primary, [tx.pure.u64(wagerRaw)]);
  const hand = await freshHandRef(tx, handId);
  tx.moveCall({
    target: `${CASINO_PKG}::blackjack_live::double`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), hand, extra],
  });
  return tx;
}

/** Split a same-rank pair: post an equal extra stake, play two hands. */
// Fresh objectRef for any owned casino play object (Hand or SplitHand). Same
// stale-version fix as freshHandRef (2026-07-19).
async function freshPlayRef(tx: Transaction, objectId: string) {
  const res = await rpcDirect("sui_getObject", [objectId, { showOwner: false }]);
  const d = res?.data;
  if (!d?.objectId || d.version == null || !d.digest) {
    throw new Error("Play object not found or already settled — refresh and start a new hand.");
  }
  return tx.objectRef({ objectId: d.objectId, version: d.version, digest: d.digest });
}

export async function buildSplitTx(handId: string, eveCoinIds: string[], wagerRaw: bigint): Promise<Transaction> {
  const tx = new Transaction();
  const primary = tx.object(eveCoinIds[0]);
  if (eveCoinIds.length > 1) tx.mergeCoins(primary, eveCoinIds.slice(1).map((id) => tx.object(id)));
  const [extra] = tx.splitCoins(primary, [tx.pure.u64(wagerRaw)]);
  const hand = await freshPlayRef(tx, handId);
  tx.moveCall({
    target: `${CASINO_PKG}::blackjack_live::split`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), hand, extra],
  });
  return tx;
}

export async function buildSplitHitTx(splitId: string): Promise<Transaction> {
  const tx = new Transaction();
  const split = await freshPlayRef(tx, splitId);
  tx.moveCall({
    target: `${CASINO_PKG}::blackjack_live::split_hit`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), split],
  });
  return tx;
}

export async function buildSplitStandTx(splitId: string): Promise<Transaction> {
  const tx = new Transaction();
  const split = await freshPlayRef(tx, splitId);
  tx.moveCall({
    target: `${CASINO_PKG}::blackjack_live::split_stand`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), split],
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

/** Read a live SplitHand object (null = settled/consumed). Direct fullnode. */
export async function fetchLiveSplitHand(splitId: string): Promise<LiveSplitHand | null> {
  const res = await rpcDirect("sui_getObject", [splitId, { showContent: true }]);
  const f = res?.data?.content?.fields;
  if (!f) return null;
  const a = (f.hand_a ?? []).map((x: any) => Number(x));
  const b = (f.hand_b ?? []).map((x: any) => Number(x));
  return {
    splitId,
    player: f.player,
    wager: Number(f.base_wager ?? 0) / 1e9,
    handA: a,
    handB: b,
    dealerUpcard: Number((f.dealer_cards ?? [])[0] ?? 0),
    active: Number(f.active ?? 0) === 1 ? 1 : 0,
    totalA: handTotal(a),
    totalB: handTotal(b),
  };
}

function parseSplitSettled(pj: any, digest: string): SplitSettlement {
  return {
    splitId: pj.split_id ?? "",
    wager: Number(pj.wager ?? 0) / 1e9,
    deck: (pj.deck ?? []).map((x: any) => Number(x)),
    handA: (pj.hand_a ?? []).map((x: any) => Number(x)),
    handB: (pj.hand_b ?? []).map((x: any) => Number(x)),
    dealerCards: (pj.dealer_cards ?? []).map((x: any) => Number(x)),
    totalA: Number(pj.total_a ?? 0),
    totalB: Number(pj.total_b ?? 0),
    dealerTotal: Number(pj.dealer_total ?? 0),
    outcomeA: Number(pj.outcome_a ?? 0),
    outcomeB: Number(pj.outcome_b ?? 0),
    payout: Number(pj.payout ?? 0) / 1e9,
    txDigest: digest,
  };
}

/**
 * Resolve a split tx by ITS OWN digest (standing rule: never "latest event").
 * Returns a live SplitHand id, or the settlement when it auto-resolved
 * (split aces / both hands landing on 21).
 */
export async function resolveSplitByDigest(digest: string): Promise<
  { kind: "live"; splitId: string } | { kind: "settled"; settlement: SplitSettlement } | null
> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await rpc("sui_getTransactionBlock", [
        digest,
        { showEffects: true, showEvents: true, showObjectChanges: true },
      ]);
      const events = res?.events ?? [];
      for (const e of events) {
        if (typeof e.type === "string" && e.type.endsWith("::blackjack_live::SplitSettled")) {
          return { kind: "settled", settlement: parseSplitSettled(e.parsedJson ?? {}, digest) };
        }
      }
      for (const e of events) {
        if (typeof e.type === "string" && e.type.endsWith("::blackjack_live::HandSplit")) {
          const pj = e.parsedJson ?? {};
          if (pj.split_id) return { kind: "live", splitId: String(pj.split_id) };
        }
      }
      const changes = res?.objectChanges ?? [];
      for (const ch of changes) {
        if (ch.type === "created" && typeof ch.objectType === "string" && ch.objectType.includes("::blackjack_live::SplitHand<")) {
          return { kind: "live", splitId: ch.objectId };
        }
      }
    } catch { /* fullnode lag — retry */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

/** Resolve a settling split action (hit-bust/stand on hand B) by tx digest. */
export async function resolveSplitSettleByDigest(digest: string): Promise<SplitSettlement | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await rpc("sui_getTransactionBlock", [digest, { showEvents: true }]);
      const events = res?.events ?? [];
      for (const e of events) {
        if (typeof e.type === "string" && e.type.endsWith("::blackjack_live::SplitSettled")) {
          return parseSplitSettled(e.parsedJson ?? {}, digest);
        }
      }
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

/** Find the settlement for a given hand id (poll after a settling action). */
export async function fetchSettlement(handId: string): Promise<LiveSettlement | null> {
  if (!CASINO_PKG) return null;
  const pkgs = Array.from(new Set([CASINO_ORIGINAL, CASINO_PKG].filter(Boolean)));
  const results = await Promise.all(pkgs.map((pkg) =>
    rpc("suix_queryEvents", [
      { MoveEventType: `${pkg}::blackjack_live::HandSettled` },
      null, 30, true,
    ]).catch(() => ({ data: [] }))
  ));
  for (const result of results) {
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
  }
  return null;
}

/** Recent live-blackjack settlements for the feed, newest first.
 *  Merges classic HandSettled with split settlements. Queries historical
 *  event packages plus CASINO_PKG because v27 is a fresh event lineage. */
export async function fetchRecentLiveHands(limit = 25): Promise<LiveSettlement[]> {
  if (!CASINO_PKG) return [];
  // 2026-07-19: scope the live feed to ONLY the current package (v28 0x750dcaa9).
  // Older lineages (CASINO_ORIGINAL 0x461d1296, CASINO_V2) carry HandSettled
  // events from last night's EVE-recovery grind bot against the RETIRED houses —
  // surfacing them made the feed show ~17 phantom plays when the live v28 house
  // had only 1. `blackjack_live` events tag under the pkg version that
  // introduced the module, so querying CASINO_PKG alone captures all real v28
  // play (and correctly shows an empty/short feed until players actually play).
  const [classicResults, splitResults] = await Promise.all([
    Promise.all([CASINO_PKG].map((pkg) =>
      rpc("suix_queryEvents", [
        { MoveEventType: `${pkg}::blackjack_live::HandSettled` },
        null, limit, true,
      ]).catch(() => ({ data: [] }))
    )),
    Promise.all([CASINO_PKG].map((pkg) =>
      rpc("suix_queryEvents", [
        { MoveEventType: `${pkg}::blackjack_live::SplitSettled` },
        null, limit, true,
      ]).catch(() => ({ data: [] }))
    )),
  ]);
  const classic = { data: classicResults.flatMap((r) => r.data ?? []) };
  const splits = { data: splitResults.flatMap((r) => r.data ?? []) };
  const splitRows: (LiveSettlement & { player: string; split?: boolean })[] = [];
  for (const e of splits.data ?? []) {
    const pj = e.parsedJson ?? {};
    const s = parseSplitSettled(pj, e.id?.txDigest ?? "");
    const per = s.wager / 2;
    const tsSplit = Number(e.timestampMs ?? 0);
    // Per-hand payout reconstruction: win 2x, push 1x, loss 0.
    const payFor = (o: number) => (o === 2 ? per * 2 : o === 1 ? per : 0);
    const mk = (cards: number[], total: number, outcome: number) => ({
      handId: s.splitId,
      wager: per,
      deck: [],
      playerCards: cards,
      dealerCards: s.dealerCards,
      playerTotal: total,
      dealerTotal: s.dealerTotal,
      doubled: false,
      outcome,
      payout: payFor(outcome),
      txDigest: s.txDigest,
      player: pj.player ?? "",
      split: true,
      _ts: tsSplit,
    });
    splitRows.push(mk(s.handA, s.totalA, s.outcomeA) as any);
    splitRows.push(mk(s.handB, s.totalB, s.outcomeB) as any);
  }
  const classicRows = (classic.data ?? []).map((e: any) => {
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
      _ts: Number(e.timestampMs ?? 0),
    } as LiveSettlement & { player: string };
  });
  // Merge newest-first by event timestamp, cap at `limit` rows.
  const all = [...classicRows, ...splitRows].sort(
    (a: any, b: any) => (b._ts ?? 0) - (a._ts ?? 0),
  );
  return all.slice(0, limit);
}
