import { CASINO_HOUSE, CASINO_PKG, EVE_COIN_TYPE } from "../constants";
import { queryChain } from "./currentWorldRead";

export const MAX_DONATION_RAW = (1n << 64n) - 1n;
/** Exact nine-decimal parsing. Never route token amounts through floating point. */
export function donationAmount(value: string): bigint {
  const text = value.trim();
  if (text.length > 32 || !/^\d+(?:\.\d{1,9})?$/.test(text))
    throw Error("Use a positive amount with up to 9 decimal places.");
  const [whole, fraction = ""] = text.split(".");
  const raw = BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, "0"));
  if (raw <= 0n || raw > MAX_DONATION_RAW)
    throw Error("Amount is outside the supported range.");
  return raw;
}
export function donationLabel(value: string): string {
  const label = value.trim();
  if (new TextEncoder().encode(label).length > 64)
    throw Error("Name / tribe must fit within 64 UTF-8 bytes.");
  return label;
}
export function formatDonation(raw: bigint): string {
  const fraction = (raw % 1_000_000_000n)
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");
  return `${raw / 1_000_000_000n}${fraction ? `.${fraction}` : ""}`;
}
export async function fetchDonationHouse(): Promise<{
  bank: bigint;
  paused: boolean;
}> {
  const data = await queryChain<{
    object: {
      owner: { __typename: string };
      asMoveObject: {
        contents: { type: { repr: string }; json: Record<string, unknown> };
      };
    } | null;
  }>(
    `query($id:SuiAddress!){object(address:$id){owner{__typename} asMoveObject{contents{type{repr} json}}}}`,
    { id: CASINO_HOUSE },
  );
  const contents = data.object?.asMoveObject?.contents;
  if (
    data.object?.owner?.__typename !== "Shared" ||
    contents?.type.repr !== `${CASINO_PKG}::house::House<${EVE_COIN_TYPE}>`
  )
    throw Error("Current testnet house could not be verified.");
  const f = contents.json;
  if (
    typeof f.bank !== "string" ||
    !/^\d+$/.test(f.bank) ||
    BigInt(f.bank) > MAX_DONATION_RAW ||
    typeof f.paused !== "boolean"
  )
    throw Error("House status is incomplete. Refresh before donating.");
  return { bank: BigInt(f.bank), paused: f.paused };
}
export function assertSeedable(
  house: { bank: bigint; paused: boolean },
  amount: bigint,
  balance: bigint,
) {
  if (!house.paused)
    throw Error(
      "Seeding is available only while this testnet house is paused.",
    );
  if (
    amount <= 0n ||
    amount > MAX_DONATION_RAW ||
    house.bank + amount > MAX_DONATION_RAW
  )
    throw Error("Amount exceeds the house capacity.");
  if (amount > balance) throw Error("Insufficient $EVE in this wallet.");
}
/** A digest alone is not settlement proof; current dApp Kit returns a tagged result. */
export function donationReceipt(result: unknown): string {
  const r = result as {
    $kind?: string;
    Transaction?: { digest?: string; status?: { success?: boolean } };
    FailedTransaction?: { status?: { error?: { message?: string } } };
  } | null;
  if (r?.$kind === "FailedTransaction")
    throw Error(
      r.FailedTransaction?.status?.error?.message ??
        "Donation transaction failed.",
    );
  if (
    r?.$kind !== "Transaction" ||
    r.Transaction?.status?.success !== true ||
    !r.Transaction.digest
  )
    throw Error(
      "Donation outcome is not confirmed. Check wallet activity before retrying.",
    );
  return r.Transaction.digest;
}

// Pausing does not disable old-hand settlement. Refuse the seed-only flow if
// ANY active current-package EVE game exists (conservative across houses).
export const SEED_ESCROW_TYPES = [
  "blackjack_live::Hand",
  "blackjack_live::SplitHand",
  "hilo::HiLoGame",
  "mines::MinesGame",
  "dragon_tower::TowerGame",
  "video_poker::VideoPokerHand",
] as const;
export async function assertNoSeedLiabilities(): Promise<void> {
  type Page = {
    nodes: { address: string }[];
    pageInfo: { hasNextPage: boolean };
  };
  const vars = Object.fromEntries(
    SEED_ESCROW_TYPES.map((type, i) => [
      `t${i}`,
      `${CASINO_PKG}::${type}<${EVE_COIN_TYPE}>`,
    ]),
  );
  const query = `query(${SEED_ESCROW_TYPES.map((_, i) => `$t${i}:String!`).join(",")}){${SEED_ESCROW_TYPES.map((_, i) => `g${i}:objects(filter:{type:$t${i}},first:1){nodes{address} pageInfo{hasNextPage}}`).join("\n")}}`;
  const data = await queryChain<Record<string, Page>>(query, vars);
  for (let i = 0; i < SEED_ESCROW_TYPES.length; i++) {
    const page = data[`g${i}`];
    if (
      !page ||
      !Array.isArray(page.nodes) ||
      page.nodes.length !== 0 ||
      page.pageInfo?.hasNextPage !== false
    )
      throw Error(
        "Outstanding game checks did not clear. Seeding is unavailable; no donation was sent.",
      );
  }
}

/** Late completion of an unmounted form must never clear a newer donation. */
export function clearDonationAttempt(
  storage: Pick<Storage, "getItem" | "removeItem">,
  marker: string,
): boolean {
  const key = "cradle.casino.donation.pending";
  if (!marker || storage.getItem(key) !== marker) return false;
  storage.removeItem(key);
  return true;
}
