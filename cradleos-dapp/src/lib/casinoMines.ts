/**
 * casinoMines.ts — Mines multi-tx stateful game helpers.
 *
 * Game flow:
 *   1. Player calls `mines::start` (consumes $EVE wager) → creates player-owned MinesGame object.
 *   2. Player calls `mines::reveal` one tile at a time → TileRevealed event (safe) or MinesSettled event (busted).
 *   3. Player calls `mines::cashout` → MinesSettled event (busted=false) → payout sent to player.
 *
 * Resolution discipline (same standing rule as blackjack_live):
 *   - Resolve every tx by ITS OWN digest via sui_getTransactionBlock — never "latest event of type X".
 *   - Event type matching uses endsWith to be version-agnostic.
 */
import { Transaction } from "@mysten/sui/transactions";
import {
  CASINO_PKG,
  CASINO_V5,
  CASINO_HOUSE,
  EVE_COIN_TYPE,
  RANDOM_OBJECT,
  SUI_TESTNET_RPC,
} from "../constants";
import { withGas, fetchEveCoins, fetchOwnedRefDirect } from "./casino";

// Re-export for consumers that want to avoid importing from two places.
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

// ── Interfaces ────────────────────────────────────────────────────────────────

/** Live game state read from the player-owned MinesGame Sui object. */
export interface MinesGameState {
  gameId: string;
  wager: number;        // EVE display units (9 decimals)
  mines: number;        // mine count (1–24)
  revealedMap: number;  // 25-bit bitmask — bit i set means tile i was revealed as safe
  safeRevealed: number; // count of safe tiles revealed so far
  multiplierBps: number;// current multiplier in bps (10000 = 1x) BEFORE the next reveal
}

/** Game start details resolved from the MinesStarted event. */
export interface MinesStartResult {
  gameId: string;   // Sui object ID of the newly created MinesGame
  player: string;
  wager: number;    // EVE display units
  mines: number;
}

/** Final settlement resolved from the MinesSettled event. */
export interface MinesSettleResult {
  busted: boolean;
  safeRevealed: number;
  mineMap: number;      // 25-bit bitmask — bit i set means tile i has a mine
  multiplierBps: number;
  payout: number;       // EVE display units (0 on bust)
  wager: number;        // EVE display units (original wager)
}

/** Outcome of a single reveal tx — either safe or bust. */
export type TileRevealOutcome =
  | { kind: "safe"; tile: number; safeRevealed: number; multiplierBps: number }
  | { kind: "bust"; settle: MinesSettleResult };

// ── Tx builders ───────────────────────────────────────────────────────────────

/**
 * Build the Mines start PTB. Caller must wrap with withGas() and sign.
 * Splits the wager from the player's EVE coins and passes to mines::start.
 */
export function buildMinesStartTx(coins: string[], wagerRaw: bigint, mines: number): Transaction {
  const tx = new Transaction();
  const primary = tx.object(coins[0]);
  if (coins.length > 1) tx.mergeCoins(primary, coins.slice(1).map((id) => tx.object(id)));
  const [wager] = tx.splitCoins(primary, [tx.pure.u64(wagerRaw)]);
  tx.moveCall({
    target: `${CASINO_PKG}::mines::start`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), wager, tx.pure.u8(mines)],
  });
  return tx;
}

/**
 * Build a Mines reveal PTB for the given tile (0–24).
 * The MinesGame object is passed as a regular object arg — it is consumed
 * and re-transferred (safe) or settled (bust) by the Move tx.
 * Caller must wrap with withGas() and sign.
 */
export async function buildMinesRevealTx(gameId: string, tile: number): Promise<Transaction> {
  const ref = await fetchOwnedRefDirect(gameId); // fresh ref — object mutates every reveal
  const tx = new Transaction();
  tx.moveCall({
    target: `${CASINO_PKG}::mines::reveal`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.objectRef(ref), tx.pure.u8(tile)],
  });
  return tx;
}

/**
 * Build the Mines cashout PTB.
 * The MinesGame object is consumed; payout is sent to the player.
 * Caller must wrap with withGas() and sign.
 */
export async function buildMinesCashoutTx(gameId: string): Promise<Transaction> {
  const ref = await fetchOwnedRefDirect(gameId);
  const tx = new Transaction();
  tx.moveCall({
    target: `${CASINO_PKG}::mines::cashout`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.objectRef(ref)],
  });
  return tx;
}

// ── Resolution by digest ──────────────────────────────────────────────────────

/**
 * Resolve the MinesStarted event from a start tx.
 * Retries up to 6 times with 700ms backoff to handle fullnode lag.
 */
export async function resolveMinesStartByDigest(digest: string): Promise<MinesStartResult | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await rpc("sui_getTransactionBlock", [digest, { showEvents: true }]);
      for (const e of res?.events ?? []) {
        if (typeof e.type === "string" && e.type.endsWith("::mines::MinesStarted")) {
          const f = e.parsedJson ?? {};
          return {
            gameId: String(f.game_id ?? ""),
            player: String(f.player ?? ""),
            wager: Number(f.wager ?? 0) / 1e9,
            mines: Number(f.mines ?? 0),
          };
        }
      }
    } catch { /* fullnode lag — retry */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

/**
 * Resolve the MinesSettled event from a cashout (or bust) tx.
 * For bust resolution use resolveTileRevealOrBustByDigest instead.
 */
export async function resolveMinesSettleByDigest(digest: string): Promise<MinesSettleResult | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await rpc("sui_getTransactionBlock", [digest, { showEvents: true }]);
      const settled = parseMinesSettled(res?.events ?? []);
      if (settled) return settled;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

/**
 * Resolve the outcome of a reveal tx — safe tile or bust.
 *
 * A reveal tx emits:
 *   - TileRevealed { hit_mine: false, ... }  →  safe, game continues
 *   - TileRevealed { hit_mine: true, ... } + MinesSettled { busted: true, ... }  →  bust
 *
 * We check for MinesSettled first (definitive game-over signal), then fall
 * back to TileRevealed for the safe case.
 */
export async function resolveTileRevealOrBustByDigest(digest: string): Promise<TileRevealOutcome | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await rpc("sui_getTransactionBlock", [digest, { showEvents: true }]);
      const events: any[] = res?.events ?? [];
      // Check settle (bust) first
      const settled = parseMinesSettled(events);
      if (settled) return { kind: "bust", settle: settled };
      // Check safe tile reveal
      for (const e of events) {
        if (typeof e.type === "string" && e.type.endsWith("::mines::TileRevealed")) {
          const f = e.parsedJson ?? {};
          return {
            kind: "safe",
            tile: Number(f.tile ?? 0),
            safeRevealed: Number(f.safe_revealed ?? 0),
            multiplierBps: Number(f.multiplier_bps ?? 10000),
          };
        }
      }
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

// ── Active game fetch ─────────────────────────────────────────────────────────

/**
 * Fetch the player's active MinesGame object (if any).
 * Returns null if no active game exists (game ended / not started).
 * Useful for resuming a mid-session game after a page reload.
 */
export async function fetchActiveMinesGame(addr: string): Promise<MinesGameState | null> {
  if (!CASINO_PKG || !addr) return null;
  try {
    const result = await rpc("suix_getOwnedObjects", [
      addr,
      {
        // Struct types tag under the package version that INTRODUCED them.
        // The `mines` module was introduced in v5 (CASINO_V5), so MinesGame
        // objects are typed under that id — NOT the latest published-at.
        filter: { StructType: `${CASINO_V5}::mines::MinesGame<${EVE_COIN_TYPE}>` },
        options: { showContent: true, showType: true },
      },
      null,
      1,
    ]);
    const obj = result?.data?.[0];
    if (!obj?.data) return null;
    const f = obj.data?.content?.fields ?? {};
    const gameId = obj.data.objectId ?? "";
    if (!gameId) return null;

    // Wager may be stored as Coin<T> (nested) or a plain u64 amount.
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

    return {
      gameId,
      wager: Number(wagerRaw) / 1e9,
      mines: Number(f.mines ?? 0),
      revealedMap: Number(f.revealed_map ?? 0),
      safeRevealed: Number(f.safe_revealed ?? 0),
      multiplierBps: Number(f.multiplier_bps ?? 10000),
    };
  } catch {
    return null;
  }
}

// ── Multiplier math (mirrors mines.move) ──────────────────────────────────────

/**
 * Compute the expected next multiplier in bps after revealing safeRevealed tiles
 * with the given mine count (25-tile board). 97% payout rate.
 *
 * multiplier = prod_{i=0}^{k-1} (25 - i) / ((25 - mines) - i)  × 0.97
 *
 * Returns 10000 (= 1x) for safeRevealed=0 (no reveals yet).
 */
export function computeMinesMultiplierBps(mines: number, safeRevealed: number): number {
  if (safeRevealed <= 0) return 10000;
  const safe = 25 - mines;
  let mult = 1.0;
  for (let i = 0; i < safeRevealed; i++) {
    const den = safe - i;
    if (den <= 0) return 0; // shouldn't happen on valid inputs
    mult *= (25 - i) / den;
  }
  mult *= 0.97;
  return Math.floor(mult * 10000);
}

// ── Private helpers ───────────────────────────────────────────────────────────

function parseMinesSettled(events: any[]): MinesSettleResult | null {
  for (const e of events) {
    if (typeof e.type === "string" && e.type.endsWith("::mines::MinesSettled")) {
      const f = e.parsedJson ?? {};
      return {
        busted: Boolean(f.busted),
        safeRevealed: Number(f.safe_revealed ?? 0),
        mineMap: Number(f.mine_map ?? 0),
        multiplierBps: Number(f.multiplier_bps ?? 0),
        payout: Number(f.payout ?? 0) / 1e9,
        wager: Number(f.wager ?? 0) / 1e9,
      };
    }
  }
  return null;
}
