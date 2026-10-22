import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { sha256 } from "@noble/hashes/sha2.js";
import { queryChain, listOwnedCurrentObjects } from "./currentWorldRead";
import { SPORTS_DEPLOYMENT } from "./sportsDeployment";
export {
  parseEve,
  formatEve,
  findBookCharacter,
  bookReceipt,
} from "./bettingBook";
export type { Ticket } from "./bettingBook";
import type { Ticket } from "./bettingBook";
export const U64 = (1n << 64n) - 1n;
type Node = {
  address: string;
  owner?: { __typename: string };
  asMoveObject?: {
    contents: { type: { repr: string }; json: Record<string, unknown> };
  };
};
export type SportsMarket = {
  id: string;
  bookId: string;
  creator: string;
  reporter: string;
  league: 1 | 2;
  labels: [string, string];
  slug: string;
  sourceId: string;
  termsHash: string;
  starts: number;
  cutoff: number;
  proofDeadline: number;
  candidate: number;
  candidateAt: number;
  poolA: bigint;
  poolB: bigint;
  escrow: bigint;
  result: 0 | 1 | 2 | 3;
  remainingWinningStake: bigint;
  claimCount: bigint;
  claimsId: string;
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
function bytesHex(x: unknown): string {
  if (typeof x !== "string") throw Error("Invalid oracle feed.");
  try {
    return Array.from(atob(x), (c) =>
      c.charCodeAt(0).toString(16).padStart(2, "0"),
    ).join("");
  } catch {
    throw Error("Invalid oracle feed.");
  }
}

function requireConfig(cfg = SPORTS_DEPLOYMENT) {
  if (!cfg.packageId || !cfg.bookId || !cfg.reporter)
    throw Error("Sports book unavailable.");
  objectId(cfg.packageId);
  objectId(cfg.bookId);
}
export function parseMarket(n: Node, cfg = SPORTS_DEPLOYMENT): SportsMarket {
  const c = n.asMoveObject?.contents,
    f = c?.json;
  if (
    n.owner?.__typename !== "Shared" ||
    c?.type.repr !== `${cfg.packageId}::sports::Market<${cfg.coinType}>` ||
    !f ||
    raw(f.version) !== 1n ||
    f.book_id !== cfg.bookId ||
    f.tenant !== cfg.tenant ||
    f.reporter !== cfg.reporter ||
    typeof f.terms_json !== "string"
  )
    throw Error("Unverified sports market.");
  const hash = Array.from(sha256(new TextEncoder().encode(f.terms_json)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
  const t = JSON.parse(f.terms_json);
  if (
    hash !== bytesHex(f.terms_hash) ||
    t.adapter !== 1 ||
    t.version !== "v1" ||
    t.chain !== 137 ||
    t.ctf !== "0x4d97dcd97ec945f40cf65f87097ace5ea0476045" ||
    t.oracle !== "0x65070be91477460d8a7aeeb94ef92fe056c2f2a7" ||
    t.labels?.[0] !== f.label_a ||
    t.labels?.[1] !== f.label_b ||
    t.marketId !== f.source_market ||
    t.condition !== "0x" + bytesHex(f.condition) ||
    !/^((nba)|(nfl))-[a-z]{2,3}-[a-z]{2,3}-\d{4}-\d{2}-\d{2}$/.test(t.slug)
  )
    throw Error("Unverified sports terms.");
  const m: SportsMarket = {
    id: objectId(n.address),
    bookId: objectId(f.book_id),
    creator: objectId(f.creator),
    reporter: objectId(f.reporter),
    league: small(f.league) as 1 | 2,
    labels: t.labels,
    slug: t.slug,
    sourceId: String(f.source_market),
    termsHash: hash,
    starts: seconds(f.starts),
    cutoff: seconds(f.cutoff),
    proofDeadline: seconds(f.proof_deadline),
    candidate: small(f.candidate),
    candidateAt: seconds(f.candidate_at),
    poolA: raw(f.pool_a),
    poolB: raw(f.pool_b),
    escrow: raw(f.escrow),
    result: small(f.result) as 0 | 1 | 2 | 3,
    remainingWinningStake: raw(f.remaining_winning_stake),
    claimCount: raw(f.claim_count),
    claimsId: objectId((f.claims as { id: unknown }).id),
  };
  if (
    ![1, 2].includes(m.league) ||
    t.league !== (m.league === 1 ? "nba" : "nfl") ||
    t.start !== m.starts ||
    t.cutoff !== m.cutoff ||
    m.cutoff !== m.starts - 300 ||
    t.deadline !== m.proofDeadline ||
    m.proofDeadline !== m.starts + 172800 ||
    t.hold !== 7200 ||
    !Array.isArray(m.labels) ||
    m.labels.length !== 2 ||
    m.labels.some((x) => typeof x !== "string" || x.length > 40) ||
    m.labels[0] === m.labels[1] ||
    m.poolA + m.poolB > U64 ||
    m.escrow > m.poolA + m.poolB ||
    ![0, 1, 2, 3].includes(m.result) ||
    ![0, 1, 2, 3].includes(m.candidate) ||
    m.claimCount > 10000n
  )
    throw Error("Invalid sports state.");
  return m;
}
const fields =
  "address owner{__typename} asMoveObject{contents{type{repr} json}}";
export async function fetchMarket(id: string, cfg = SPORTS_DEPLOYMENT) {
  requireConfig(cfg);
  const r = await queryChain<{ object: Node }>(
    `query($id:SuiAddress!){object(address:$id){${fields}}}`,
    { id: objectId(id) },
  );
  if (!r.object) throw Error("Market unavailable.");
  return parseMarket(r.object, cfg);
}
export async function fetchBook(cfg = SPORTS_DEPLOYMENT) {
  requireConfig(cfg);
  const r = await queryChain<{ object: Node }>(
    `query($id:SuiAddress!){object(address:$id){${fields}}}`,
    { id: cfg.bookId },
  );
  const n = r.object,
    c = n?.asMoveObject?.contents,
    f = c?.json;
  if (
    n?.owner?.__typename !== "Shared" ||
    c?.type.repr !== `${cfg.packageId}::sports::Book<${cfg.coinType}>` ||
    !f ||
    f.reporter !== cfg.reporter ||
    f.tenant !== cfg.tenant ||
    raw(f.version) !== 1n ||
    typeof f.paused !== "boolean" ||
    !Array.isArray(f.markets)
  )
    throw Error("Book unavailable.");
  return { paused: f.paused, marketIds: f.markets.map(objectId) };
}
export async function fetchTickets(
  owner: string,
  cfg = SPORTS_DEPLOYMENT,
): Promise<Ticket[]> {
  requireConfig(cfg);
  const address = objectId(owner),
    nodes = await listOwnedCurrentObjects(
      address,
      `${cfg.packageId}::sports::Ticket<${cfg.coinType}>`,
    );
  const receipts = nodes.map((n) => {
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
      entitlementId: objectId(f.entitlement_id),
    };
  });
  const result: Ticket[] = [];
  for (let i = 0; i < receipts.length; i += 25) {
    const batch = receipts.slice(i, i + 25);
    const query =
      "query{" +
      batch
        .map((r, j) => `e${j}:object(address:"${r.entitlementId}"){${fields}}`)
        .join(" ") +
      "}";
    const data = await queryChain<Record<string, Node | null>>(query);
    batch.forEach((r, j) => {
      const n = data[`e${j}`],
        c = n?.asMoveObject?.contents,
        f = c?.json;
      if (
        !n ||
        n.owner?.__typename !== "Shared" ||
        objectId(n.address) !== r.entitlementId ||
        c?.type.repr !==
          `${cfg.packageId}::sports::Entitlement<${cfg.coinType}>` ||
        !f ||
        objectId(f.market_id) !== r.marketId ||
        objectId(f.bettor) !== r.bettor ||
        small(f.side) !== r.side ||
        raw(f.stake) !== r.stake ||
        typeof f.paid !== "boolean"
      )
        throw Error("Payment status unavailable.");
      result.push({ ...r, paid: f.paid, payout: raw(f.payout) });
    });
  }
  return result;
}
function splitFunds(
  tx: Transaction,
  amount: bigint,
  coins: { id: string; balance: bigint }[],
) {
  if (amount <= 0n || amount > U64) throw Error("Invalid EVE amount.");
  const seen = new Set<string>();
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
  return parts[0];
}

export function phase(m: SportsMarket, now = Math.floor(Date.now() / 1000)) {
  return m.result === 3
    ? "Refund"
    : m.result
      ? m.labels[m.result - 1] + " won"
      : now >= m.proofDeadline
        ? "Refund due"
        : now < m.cutoff
          ? "Open"
          : m.candidate
            ? "Confirming"
            : "Awaiting result";
}
export function estimatedReturn(m: SportsMarket, side: 1 | 2, stake: bigint) {
  if (
    ![1, 2].includes(side) ||
    stake <= 0n ||
    stake > U64 ||
    m.poolA + m.poolB + stake > U64
  )
    throw Error("Invalid stake.");
  const pool = (side === 1 ? m.poolA : m.poolB) + stake;
  return (stake * (m.poolA + m.poolB + stake)) / pool;
}
export function buildBet(
  m: SportsMarket,
  character: string,
  side: 1 | 2,
  amount: bigint,
  coins: { id: string; balance: bigint }[],
  cfg = SPORTS_DEPLOYMENT,
) {
  requireConfig(cfg);
  if (!cfg.wageringEnabled || m.bookId !== cfg.bookId || phase(m) !== "Open")
    throw Error("Betting closed.");
  estimatedReturn(m, side, amount);
  const tx = new Transaction();
  const funds = splitFunds(tx, amount, coins);
  tx.moveCall({
    target: `${cfg.packageId}::sports::place_bet`,
    typeArguments: [cfg.coinType],
    arguments: [
      tx.object(cfg.bookId),
      tx.object(m.id),
      tx.object(objectId(character)),
      tx.pure.u8(side),
      funds,
      tx.object("0x6"),
    ],
  });
  return tx;
}
export function buildClaim(
  market: string,
  entitlement: string,
  cfg = SPORTS_DEPLOYMENT,
) {
  requireConfig(cfg);
  const tx = new Transaction();
  tx.moveCall({
    target: `${cfg.packageId}::sports::claim_for`,
    typeArguments: [cfg.coinType],
    arguments: [tx.object(objectId(market)), tx.object(objectId(entitlement))],
  });
  return tx;
}

export function buildFinalize(market: string, cfg = SPORTS_DEPLOYMENT) {
  requireConfig(cfg);
  const tx = new Transaction();
  tx.moveCall({
    target: `${cfg.packageId}::sports::finalize`,
    typeArguments: [cfg.coinType],
    arguments: [tx.object(objectId(market)), tx.object("0x6")],
  });
  return tx;
}
