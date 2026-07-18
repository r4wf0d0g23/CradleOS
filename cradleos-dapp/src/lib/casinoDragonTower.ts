/**
 * casinoDragonTower.ts — Dragon Tower stateful game helpers.
 *
 * Game flow:
 *   1. Player calls `dragon_tower::start` (consumes $EVE wager) → creates player-owned TowerGame object.
 *   2. Player calls `dragon_tower::pick` with a cell index in the current row.
 *      - Safe → TowerGame re-transferred (row climbed, multiplier grows).
 *      - Dragon → TowerGame consumed + TowerSettled emitted (busted).
 *   3. Player calls `dragon_tower::cashout` → TowerSettled emitted (busted=false).
 *
 * Resolution discipline (same standing rule as casinoMines.ts):
 *   - Resolve every tx by ITS OWN digest via sui_getTransactionBlock — never "latest event of type X".
 *   - Event type matching uses endsWith to be version-agnostic.
 */
import { Transaction } from "@mysten/sui/transactions";
import {
  CASINO_PKG,
  CASINO_HOUSE,
  EVE_COIN_TYPE,
  RANDOM_OBJECT,
  SUI_TESTNET_RPC,
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

// ── Difficulty helpers ────────────────────────────────────────────────────────
/** Number of tiles per row by difficulty (0=EASY 1=MEDIUM 2=HARD). */
export const TOWER_TILES: Record<number, number> = { 0: 4, 1: 3, 2: 2 };
export const TOWER_DIFFICULTY_LABEL: Record<number, string> = { 0: "EASY (4 tiles)", 1: "MEDIUM (3 tiles)", 2: "HARD (2 tiles)" };
export const TOWER_ROWS = 9;

/**
 * Client-side multiplier preview: (tiles / (tiles-1))^rows * 0.97
 * rows = number of rows climbed so far (0 = no reveals).
 */
export function computeTowerMultBps(difficulty: number, rowsClimbed: number): number {
  if (rowsClimbed <= 0) return 10000;
  const tiles = TOWER_TILES[difficulty] ?? 4;
  const safe = tiles - 1;
  if (safe <= 0) return 10000;
  const mult = Math.pow(tiles / safe, rowsClimbed) * 0.97;
  return Math.floor(mult * 10000);
}

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface TowerGameState {
  gameId: string;
  wager: number;         // EVE display units
  difficulty: number;    // 0=EASY 1=MEDIUM 2=HARD
  tiles: number;         // tiles per row
  rowsClimbed: number;   // rows completed (0 = just started)
  multiplierBps: number; // current multiplier in bps
  picks: number[];       // cells picked per row (index i = row i pick)
}

export interface TowerStartResult {
  gameId: string;
  player: string;
  wager: number;       // EVE display units
  difficulty: number;
  tiles: number;
}

export interface TowerRowResult {
  kind: "climbed";
  row: number;
  cell: number;
  rowsClimbed: number;
  multiplierBps: number;
}

export interface TowerSettleResult {
  busted: boolean;
  rowsClimbed: number;
  dragonPos: number[];   // dragon position per row (revealed on end)
  multiplierBps: number;
  payout: number;        // EVE display units (0 on bust)
  wager: number;         // EVE display units
}

export type TowerPickOutcome =
  | { kind: "climbed"; row: TowerRowResult }
  | { kind: "settled"; settle: TowerSettleResult };

// ── Tx builders ───────────────────────────────────────────────────────────────

export function buildTowerStartTx(coins: string[], wagerRaw: bigint, characterId: string, difficulty: number): Transaction {
  const tx = new Transaction();
  const primary = tx.object(coins[0]);
  if (coins.length > 1) tx.mergeCoins(primary, coins.slice(1).map((id) => tx.object(id)));
  const [wager] = tx.splitCoins(primary, [tx.pure.u64(wagerRaw)]);
  tx.moveCall({
    target: `${CASINO_PKG}::dragon_tower::start`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.object(RANDOM_OBJECT), tx.object(characterId), wager, tx.pure.u8(difficulty)],
  });
  return tx;
}

export async function buildTowerPickTx(gameId: string, cell: number): Promise<Transaction> {
  const ref = await fetchOwnedRefDirect(gameId); // fresh ref — object mutates every pick
  const tx = new Transaction();
  tx.moveCall({
    target: `${CASINO_PKG}::dragon_tower::pick`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.objectRef(ref), tx.pure.u8(cell)],
  });
  return tx;
}

export async function buildTowerCashoutTx(gameId: string): Promise<Transaction> {
  const ref = await fetchOwnedRefDirect(gameId);
  const tx = new Transaction();
  tx.moveCall({
    target: `${CASINO_PKG}::dragon_tower::cashout`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(CASINO_HOUSE), tx.objectRef(ref)],
  });
  return tx;
}

// ── Resolution by digest ──────────────────────────────────────────────────────

export async function resolveTowerStartByDigest(digest: string): Promise<TowerStartResult | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await rpc("sui_getTransactionBlock", [digest, { showEvents: true }]);
      for (const e of res?.events ?? []) {
        if (typeof e.type === "string" && e.type.endsWith("::dragon_tower::TowerStarted")) {
          const f = e.parsedJson ?? {};
          const diff = Number(f.difficulty ?? 0);
          return {
            gameId: String(f.game_id ?? ""),
            player: String(f.player ?? ""),
            wager: Number(f.wager ?? 0) / 1e9,
            difficulty: diff,
            tiles: TOWER_TILES[diff] ?? 4,
          };
        }
      }
    } catch { /* fullnode lag — retry */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

export async function resolveTowerPickByDigest(digest: string): Promise<TowerPickOutcome | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await rpc("sui_getTransactionBlock", [digest, { showEvents: true }]);
      const events: any[] = res?.events ?? [];
      // Check settle (dragon hit) first
      const settled = parseTowerSettled(events);
      if (settled) return { kind: "settled", settle: settled };
      // Check safe climb
      for (const e of events) {
        if (typeof e.type === "string" && e.type.endsWith("::dragon_tower::RowClimbed")) {
          const f = e.parsedJson ?? {};
          return {
            kind: "climbed",
            row: {
              kind: "climbed",
              row: Number(f.row ?? 0),
              cell: Number(f.cell ?? 0),
              rowsClimbed: Number(f.rows_climbed ?? 0),
              multiplierBps: Number(f.multiplier_bps ?? 10000),
            },
          };
        }
      }
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

export async function resolveTowerCashoutByDigest(digest: string): Promise<TowerSettleResult | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await rpc("sui_getTransactionBlock", [digest, { showEvents: true }]);
      const settled = parseTowerSettled(res?.events ?? []);
      if (settled) return settled;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

// ── Active game fetch ─────────────────────────────────────────────────────────

export async function fetchActiveTowerGame(addr: string): Promise<TowerGameState | null> {
  if (!CASINO_PKG || !addr) return null;
  try {
    const result = await rpc("suix_getOwnedObjects", [
      addr,
      {
        filter: { StructType: `${CASINO_PKG}::dragon_tower::TowerGame<${EVE_COIN_TYPE}>` },
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

    const diff = Number(f.difficulty ?? 0);
    const picks = Array.isArray(f.picks) ? (f.picks as any[]).map(Number) : [];
    return {
      gameId,
      wager: Number(wagerRaw) / 1e9,
      difficulty: diff,
      tiles: TOWER_TILES[diff] ?? 4,
      rowsClimbed: Number(f.rows_climbed ?? 0),
      multiplierBps: Number(f.multiplier_bps ?? 10000),
      picks,
    };
  } catch {
    return null;
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

function parseTowerSettled(events: any[]): TowerSettleResult | null {
  for (const e of events) {
    if (typeof e.type === "string" && e.type.endsWith("::dragon_tower::TowerSettled")) {
      const f = e.parsedJson ?? {};
      return {
        busted: Boolean(f.busted),
        rowsClimbed: Number(f.rows_climbed ?? 0),
        dragonPos: Array.isArray(f.dragon_pos) ? (f.dragon_pos as any[]).map(Number) : [],
        multiplierBps: Number(f.multiplier_bps ?? 0),
        payout: Number(f.payout ?? 0) / 1e9,
        wager: Number(f.wager ?? 0) / 1e9,
      };
    }
  }
  return null;
}
