import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { BOOK_DEPLOYMENT } from "./bookDeployment";
import {
  queryChain,
  listOwnedCurrentObjects,
  findCurrentCharacters,
} from "./currentWorldRead";
export {
  donationAmount as parseEve,
  formatDonation as formatEve,
} from "./casinoDonations";

export type BookConfig = typeof BOOK_DEPLOYMENT;
export const U64 = (1n << 64n) - 1n;
export type Market = {
  id: string;
  bookId: string;
  characterA: string;
  characterB: string;
  a: string;
  b: string;
  starts: number;
  ends: number;
  proofDeadline: number;
  lossType: 1 | 2;
  systemId: string;
  poolA: bigint;
  poolB: bigint;
  scoreA: bigint;
  scoreB: bigint;
  escrow: bigint;
  result: 0 | 1 | 2 | 3;
  remainingWinningStake: bigint;
};
export type Ticket = {
  id: string;
  marketId: string;
  bettor: string;
  side: 1 | 2;
  stake: bigint;
};
type Node = {
  address: string;
  owner?: { __typename: string };
  asMoveObject?: {
    contents: { type: { repr: string }; json: Record<string, unknown> };
  };
};
export function objectId(x: unknown): string {
  if (typeof x !== "string" || !/^0x[\da-fA-F]{1,64}$/.test(x))
    throw Error("Invalid object ID.");
  return normalizeSuiAddress(x);
}
function raw(x: unknown): bigint {
  if (typeof x !== "string" || !/^\d+$/.test(x) || BigInt(x) > U64)
    throw Error("Incomplete book data.");
  return BigInt(x);
}
function seconds(x: unknown): number {
  const n = raw(x);
  if (n > 8_640_000_000_000n) throw Error("Invalid event time.");
  return Number(n);
}
function small(x: unknown): number {
  if (typeof x !== "number" && !(typeof x === "string" && /^\d+$/.test(x)))
    throw Error("Invalid numeric state.");
  const n = Number(x);
  if (!Number.isInteger(n) || n < 0 || n > 255)
    throw Error("Invalid numeric state.");
  return n;
}
function key(x: unknown, cfg: BookConfig): string {
  const k = x as { item_id?: unknown; tenant?: unknown };
  if (!k || k.tenant !== cfg.tenant || raw(k.item_id) === 0n)
    throw Error("Wrong event tenant.");
  return String(k.item_id);
}
export function configured(cfg: BookConfig = BOOK_DEPLOYMENT) {
  return !!cfg.packageId && !!cfg.bookId;
}
function requireConfig(cfg: BookConfig) {
  if (!configured(cfg)) throw Error("Betting book setup pending.");
  objectId(cfg.packageId);
  objectId(cfg.bookId);
}
export function parseMarket(n: Node, cfg = BOOK_DEPLOYMENT): Market {
  const c = n.asMoveObject?.contents,
    f = c?.json;
  if (
    n.owner?.__typename !== "Shared" ||
    c?.type.repr !== `${cfg.packageId}::book::Market<${cfg.coinType}>` ||
    !f ||
    raw(f.version) !== 1n ||
    objectId(f.book_id) !== cfg.bookId ||
    objectId(f.registry) !== cfg.registry ||
    f.tenant !== cfg.tenant
  )
    throw Error("Market could not be verified.");
  const m: Market = {
    id: objectId(n.address),
    bookId: objectId(f.book_id),
    characterA: objectId(f.character_a),
    characterB: objectId(f.character_b),
    a: key(f.a, cfg),
    b: key(f.b, cfg),
    starts: seconds(f.starts),
    ends: seconds(f.ends),
    proofDeadline: seconds(f.proof_deadline),
    lossType: small(f.loss_type) as 1 | 2,
    systemId: raw(f.system_id).toString(),
    poolA: raw(f.pool_a),
    poolB: raw(f.pool_b),
    scoreA: raw(f.score_a),
    scoreB: raw(f.score_b),
    escrow: raw(f.escrow),
    result: small(f.result) as Market["result"],
    remainingWinningStake: raw(f.remaining_winning_stake),
  };
  if (
    m.a === m.b ||
    ![1, 2].includes(m.lossType) ||
    ![0, 1, 2, 3].includes(m.result) ||
    m.starts >= m.ends ||
    m.proofDeadline < m.ends + 3600 ||
    m.poolA + m.poolB > U64 ||
    m.escrow > m.poolA + m.poolB ||
    m.remainingWinningStake >
      (m.result === 1 ? m.poolA : m.result === 2 ? m.poolB : 0n)
  )
    throw Error("Invalid market state.");
  return m;
}
const fields =
  "address owner{__typename} asMoveObject{contents{type{repr} json}}";
export async function fetchMarket(
  id: string,
  cfg = BOOK_DEPLOYMENT,
): Promise<Market> {
  requireConfig(cfg);
  const r = await queryChain<{ object: Node | null }>(
    `query($id:SuiAddress!){object(address:$id){${fields}}}`,
    { id: objectId(id) },
  );
  if (!r.object) throw Error("Market unavailable.");
  return parseMarket(r.object, cfg);
}
export async function fetchBook(
  cfg = BOOK_DEPLOYMENT,
): Promise<{ paused: boolean; marketIds: string[] }> {
  requireConfig(cfg);
  const r = await queryChain<{ object: Node | null }>(
    `query($id:SuiAddress!){object(address:$id){${fields}}}`,
    { id: cfg.bookId },
  );
  const n = r.object,
    c = n?.asMoveObject?.contents,
    f = c?.json;
  if (
    n?.owner?.__typename !== "Shared" ||
    c?.type.repr !== `${cfg.packageId}::book::Book<${cfg.coinType}>` ||
    !f ||
    raw(f.version) !== 1n ||
    objectId(f.registry) !== cfg.registry ||
    f.tenant !== cfg.tenant ||
    typeof f.paused !== "boolean" ||
    !Array.isArray(f.markets)
  )
    throw Error("Book could not be verified.");
  const marketIds = f.markets.map(objectId);
  if (new Set(marketIds).size !== marketIds.length)
    throw Error("Invalid market list.");
  return { paused: f.paused, marketIds };
}
export async function fetchTickets(
  owner: string,
  cfg = BOOK_DEPLOYMENT,
): Promise<Ticket[]> {
  requireConfig(cfg);
  const address = objectId(owner),
    nodes = await listOwnedCurrentObjects(
      address,
      `${cfg.packageId}::book::Ticket<${cfg.coinType}>`,
    );
  return nodes.map((n) => {
    const f = n.asMoveObject?.contents.json;
    if (
      !f ||
      objectId(f.bettor) !== address ||
      ![1, 2].includes(small(f.side)) ||
      raw(f.stake) === 0n
    )
      throw Error("Ticket could not be verified.");
    return {
      id: objectId(n.address),
      marketId: objectId(f.market_id),
      bettor: address,
      side: small(f.side) as 1 | 2,
      stake: raw(f.stake),
    };
  });
}
export async function fetchBookAdmin(
  owner: string,
  cfg = BOOK_DEPLOYMENT,
): Promise<string | null> {
  requireConfig(cfg);
  const nodes = await listOwnedCurrentObjects(
    objectId(owner),
    `${cfg.packageId}::book::AdminCap`,
  );
  return (
    nodes.find((n) => n.asMoveObject?.contents.json.book_id === cfg.bookId)
      ?.address ?? null
  );
}
export async function findBookCharacter(
  owner: string,
  cfg = BOOK_DEPLOYMENT,
): Promise<string> {
  const address = objectId(owner),
    candidates = await findCurrentCharacters(address);
  for (const candidate of candidates) {
    const r = await queryChain<{ object: Node | null }>(
      `query($id:SuiAddress!){object(address:$id){${fields}}}`,
      { id: candidate.characterId },
    );
    const c = r.object?.asMoveObject?.contents,
      f = c?.json;
    if (
      c?.type.repr === `${cfg.world}::character::Character` &&
      f &&
      f.character_address === address &&
      (f.key as { tenant?: string })?.tenant === cfg.tenant
    )
      return objectId(candidate.characterId);
  }
  throw Error(
    "A current Frontier character linked to this wallet is required.",
  );
}
export function marketPhase(m: Market, now = Math.floor(Date.now() / 1000)) {
  if (m.result === 3) return "Refund";
  if (m.result) return "Settled";
  return now < m.starts
    ? "Open"
    : now < m.ends
      ? "Live"
      : now < m.proofDeadline
        ? "Proofs"
        : "Ready to settle";
}
export function estimatedReturn(m: Market, side: 1 | 2, stake: bigint): bigint {
  if (stake <= 0n || stake > U64 || m.poolA + m.poolB + stake > U64)
    throw Error("Stake exceeds market capacity.");
  const own = side === 1 ? m.poolA : m.poolB;
  return (stake * (m.poolA + m.poolB + stake)) / (own + stake);
}
export function ticketReturn(m: Market, t: Ticket): bigint | null {
  if (t.marketId !== m.id) throw Error("Ticket belongs to another market.");
  if (!m.result) return null;
  if (m.result === 3) return t.stake;
  if (m.result !== t.side) return 0n;
  const pool = t.side === 1 ? m.poolA : m.poolB,
    claimed = pool - m.remainingWinningStake,
    total = m.poolA + m.poolB;
  if (pool === 0n || t.stake > m.remainingWinningStake)
    throw Error("Invalid claim state.");
  return ((claimed + t.stake) * total) / pool - (claimed * total) / pool;
}
function call(
  tx: Transaction,
  fn: string,
  args: Parameters<Transaction["moveCall"]>[0]["arguments"],
  cfg: BookConfig,
) {
  requireConfig(cfg);
  tx.moveCall({
    target: `${cfg.packageId}::book::${fn}`,
    typeArguments: [cfg.coinType],
    arguments: args,
  });
  return tx;
}
/** Split exact portions before merging; total wallet holdings may exceed u64. */
export function buildBet(
  m: Market,
  character: string,
  side: 1 | 2,
  amount: bigint,
  coins: { id: string; balance: bigint }[],
  cfg = BOOK_DEPLOYMENT,
): Transaction {
  if (!cfg.wageringEnabled) throw Error("New bets paused.");
  if (
    ![1, 2].includes(side) ||
    m.bookId !== cfg.bookId ||
    marketPhase(m) !== "Open"
  )
    throw Error("Betting closed.");
  estimatedReturn(m, side, amount);
  const tx = new Transaction(),
    seen = new Set<string>();
  let remaining = amount;
  const parts = [];
  for (const c of coins) {
    const id = objectId(c.id);
    if (seen.has(id) || c.balance < 0n || c.balance > U64)
      throw Error("Invalid coin list.");
    seen.add(id);
  }
  for (const c of coins) {
    if (!remaining) break;
    const take = c.balance < remaining ? c.balance : remaining;
    if (!take) continue;
    if (parts.length === 64) throw Error("Consolidate EVE coins first.");
    parts.push(tx.splitCoins(tx.object(c.id), [tx.pure.u64(take)])[0]);
    remaining -= take;
  }
  if (remaining) throw Error("Insufficient EVE.");
  if (parts.length > 1) tx.mergeCoins(parts[0], parts.slice(1));
  return call(
    tx,
    "place_bet",
    [
      tx.object(cfg.bookId),
      tx.object(m.id),
      tx.object(objectId(character)),
      tx.pure.u8(side),
      parts[0],
      tx.object("0x6"),
    ],
    cfg,
  );
}
export function buildProof(
  market: string,
  proof: string,
  cfg = BOOK_DEPLOYMENT,
) {
  const tx = new Transaction();
  return call(
    tx,
    "submit_proof",
    [tx.object(objectId(market)), tx.object(objectId(proof)), tx.object("0x6")],
    cfg,
  );
}
export function buildFinalize(market: string, cfg = BOOK_DEPLOYMENT) {
  const tx = new Transaction();
  return call(
    tx,
    "finalize",
    [tx.object(objectId(market)), tx.object("0x6")],
    cfg,
  );
}
export function buildClaim(
  market: string,
  ticket: string,
  cfg = BOOK_DEPLOYMENT,
) {
  const tx = new Transaction();
  return call(
    tx,
    "claim",
    [tx.object(objectId(market)), tx.object(objectId(ticket))],
    cfg,
  );
}
export type CreateMarket = {
  a: string;
  b: string;
  starts: number;
  ends: number;
  proofDeadline: number;
  lossType: 1 | 2;
  systemId: bigint;
};
export function buildCreate(
  cap: string,
  p: CreateMarket,
  cfg = BOOK_DEPLOYMENT,
) {
  if (
    objectId(p.a) === objectId(p.b) ||
    ![1, 2].includes(p.lossType) ||
    p.systemId < 0n ||
    p.systemId > U64 ||
    ![p.starts, p.ends, p.proofDeadline].every(
      (n) => Number.isSafeInteger(n) && n > 0,
    ) ||
    p.ends < p.starts + 60 ||
    p.proofDeadline < p.ends + 3600
  )
    throw Error("Invalid market terms.");
  const tx = new Transaction();
  return call(
    tx,
    "create_market",
    [
      tx.object(cfg.bookId),
      tx.object(objectId(cap)),
      tx.object(objectId(p.a)),
      tx.object(objectId(p.b)),
      tx.pure.u64(p.starts),
      tx.pure.u64(p.ends),
      tx.pure.u64(p.proofDeadline),
      tx.pure.u8(p.lossType),
      tx.pure.u64(p.systemId),
      tx.object("0x6"),
    ],
    cfg,
  );
}
export function bookReceipt(result: unknown): string {
  const r = result as {
    $kind?: string;
    Transaction?: { digest?: string; status?: { success?: boolean } };
    FailedTransaction?: unknown;
  };
  if (r?.$kind === "FailedTransaction") throw Error("Transaction failed.");
  if (
    r?.$kind !== "Transaction" ||
    r.Transaction?.status?.success !== true ||
    !r.Transaction.digest
  )
    throw Error("Outcome unconfirmed. Check wallet activity.");
  return r.Transaction.digest;
}
