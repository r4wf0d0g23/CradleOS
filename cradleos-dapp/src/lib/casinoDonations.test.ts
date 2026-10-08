import { beforeEach, expect, it, vi } from "vitest";
import { CASINO_HOUSE, CASINO_PKG, EVE_COIN_TYPE } from "../constants";
import {
  clearDonationAttempt,
  assertNoSeedLiabilities,
  assertSeedable,
  donationAmount,
  donationLabel,
  donationReceipt,
  fetchDonationHouse,
  formatDonation,
  MAX_DONATION_RAW,
} from "./casinoDonations";
import { buildDonateTx, fetchEveCoins } from "./casino";
import { queryChain } from "./currentWorldRead";
vi.mock("./currentWorldRead", () => ({ queryChain: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
it("parses exact amounts, including beyond JS safe integers, without rounding", () => {
  for (const [text, raw] of [
    ["0.000000001", 1n],
    ["12.123456789", 12123456789n],
    ["9007199.254740993", 9007199254740993n],
    ["18446744073.709551615", MAX_DONATION_RAW],
  ] as const) {
    expect(donationAmount(text)).toBe(raw);
    expect(formatDonation(raw)).toBe(text);
  }
  for (const invalid of [
    "",
    "0",
    "-1",
    "1e3",
    "NaN",
    "Infinity",
    "1.0000000001",
    "18446744073.709551616",
    "1,000",
    "1.",
    ".1",
  ])
    expect(() => donationAmount(invalid)).toThrow();
});
it("rejects oversized UTF-8 labels rather than splitting a codepoint", () => {
  expect(donationLabel("  REAP  ")).toBe("REAP");
  expect(donationLabel("⚓".repeat(21))).toHaveLength(21);
  expect(() => donationLabel("⚓".repeat(22))).toThrow();
});
it("builds only exact current-house donation calls with no wager/admin/raw transfer", () => {
  const data = buildDonateTx(
    CASINO_HOUSE,
    [
      { id: "0x1", balance: 100000000n },
      { id: "0x2", balance: 23456789n },
    ],
    123456789n,
    "REAP",
  ).getData();
  expect(data.commands.map((c) => c.$kind)).toEqual([
    "SplitCoins",
    "SplitCoins",
    "MergeCoins",
    "MoveCall",
  ]);
  const call = data.commands[3].MoveCall!;
  expect(call.package).toBe(CASINO_PKG);
  expect(call.module).toBe("house");
  expect(call.function).toBe("donate");
  expect(call.typeArguments).toEqual([EVE_COIN_TYPE]);
  for (const [house, coins, raw] of [
    ["0xbad", ["0x1"], 1n],
    [CASINO_HOUSE, [], 1n],
    [CASINO_HOUSE, ["0x1", "0x1"], 1n],
    [CASINO_HOUSE, ["0x1"], 0n],
    [CASINO_HOUSE, ["0x1"], MAX_DONATION_RAW + 1n],
  ] as const)
    expect(() =>
      buildDonateTx(
        house,
        coins.map((id) => ({ id, balance: 1n })),
        raw,
      ),
    ).toThrow();
});
it("seeding does not require wagers enabled and rejects insufficient/capacity/unpaused", () => {
  expect(() =>
    assertSeedable({ bank: 0n, paused: true }, 10n, 10n),
  ).not.toThrow();
  expect(() => assertSeedable({ bank: 0n, paused: false }, 10n, 10n)).toThrow();
  expect(() => assertSeedable({ bank: 0n, paused: true }, 11n, 10n)).toThrow();
  expect(() =>
    assertSeedable({ bank: MAX_DONATION_RAW, paused: true }, 1n, 10n),
  ).toThrow();
});
it("requires positive tagged SDK success, not a digest or absence of error", () => {
  expect(
    donationReceipt({
      $kind: "Transaction",
      Transaction: { status: { success: true }, digest: "receipt" },
    }),
  ).toBe("receipt");
  for (const r of [
    null,
    {},
    { digest: "uncertain" },
    {
      $kind: "FailedTransaction",
      FailedTransaction: { status: { error: { message: "aborted" } } },
    },
    {
      $kind: "Transaction",
      Transaction: { digest: "unknown", status: { success: false } },
    },
  ])
    expect(() => donationReceipt(r)).toThrow();
});
const response = () => ({
  object: {
    owner: { __typename: "Shared" },
    asMoveObject: {
      contents: {
        type: { repr: `${CASINO_PKG}::house::House<${EVE_COIN_TYPE}>` },
        json: { bank: "0", paused: true },
      },
    },
  },
});
it("verifies live destination type, shared custody, integer bank and boolean pause", async () => {
  vi.mocked(queryChain).mockResolvedValue(response());
  expect(await fetchDonationHouse()).toEqual({ bank: 0n, paused: true });
  for (const mutate of [
    (r: ReturnType<typeof response>) =>
      (r.object.owner.__typename = "AddressOwner"),
    (r: ReturnType<typeof response>) =>
      (r.object.asMoveObject.contents.type.repr =
        "0xold::house::House<0xold::eve::EVE>"),
    (r: ReturnType<typeof response>) =>
      (r.object.asMoveObject.contents.json.bank = "bad"),
  ]) {
    const r = response();
    mutate(r);
    vi.mocked(queryChain).mockResolvedValue(r);
    await expect(fetchDonationHouse()).rejects.toThrow();
  }
});
it("does not mistake paused house for absence of pending game liabilities", async () => {
  const empty = () =>
    Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [
        `g${i}`,
        { nodes: [], pageInfo: { hasNextPage: false } },
      ]),
    );
  vi.mocked(queryChain).mockResolvedValue(empty());
  await expect(assertNoSeedLiabilities()).resolves.toBeUndefined();
  for (const bad of [
    {},
    {
      ...empty(),
      g2: { nodes: [{ address: "0xhand" }], pageInfo: { hasNextPage: false } },
    },
    { ...empty(), g4: { nodes: [], pageInfo: { hasNextPage: true } } },
  ]) {
    vi.mocked(queryChain).mockResolvedValue(bad);
    await expect(assertNoSeedLiabilities()).rejects.toThrow();
  }
});
it("reads complete fresh coin pages and rejects missing pages, duplicate coins and wrong assets", async () => {
  const coin = (id: string, balance = "7") => ({
    coinObjectId: id,
    balance,
    coinType: EVE_COIN_TYPE,
  });
  const page = (
    data: unknown[],
    hasNextPage = false,
    nextCursor: string | null = null,
  ) => ({ json: async () => ({ result: { data, hasNextPage, nextCursor } }) });
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(page([coin("0x1")], true, "next"))
    .mockResolvedValueOnce(page([coin("0x2")]));
  vi.stubGlobal("fetch", fetch);
  expect(await fetchEveCoins("0xa")).toEqual({
    ids: ["0x" + "1".padStart(64, "0"), "0x" + "2".padStart(64, "0")],
    totalRaw: 14n,
    coins: [
      { id: "0x" + "1".padStart(64, "0"), balance: 7n },
      { id: "0x" + "2".padStart(64, "0"), balance: 7n },
    ],
  });
  for (const invalid of [
    page([coin("0x1"), coin("0x1")]),
    page([{ ...coin("0x1"), coinType: "old" }]),
    page([coin("0x1")], true, null),
    { json: async () => ({ result: {} }) },
  ]) {
    fetch.mockResolvedValue(invalid);
    await expect(fetchEveCoins("0xa")).rejects.toThrow();
  }
});

it("bounds coin inputs, canonicalizes aliases and never merges total holdings", () => {
  const rich = [
    { id: "0x1", balance: MAX_DONATION_RAW },
    { id: "0x2", balance: MAX_DONATION_RAW },
  ];
  expect(
    buildDonateTx(CASINO_HOUSE, rich, 1n)
      .getData()
      .commands.map((c) => c.$kind),
  ).toEqual(["SplitCoins", "MoveCall"]);
  const partial = [
    { id: "0x1", balance: MAX_DONATION_RAW / 2n + 1n },
    { id: "0x2", balance: MAX_DONATION_RAW / 2n + 1n },
  ];
  expect(
    buildDonateTx(CASINO_HOUSE, partial, MAX_DONATION_RAW).getData().commands,
  ).toHaveLength(4);
  expect(() =>
    buildDonateTx(
      CASINO_HOUSE,
      [
        { id: "0x1", balance: 1n },
        { id: "0x01", balance: 1n },
      ],
      1n,
    ),
  ).toThrow(/duplicated/);
  expect(() =>
    buildDonateTx(
      CASINO_HOUSE,
      Array.from({ length: 65 }, (_, i) => ({
        id: "0x" + (i + 1).toString(16),
        balance: 1n,
      })),
      65n,
    ),
  ).toThrow(/64 coin/);
});
it("old completion cannot clear a newer attempt; storage failure preserves guard", () => {
  let marker: string | null = "attempt-B";
  const storage = {
    getItem: () => marker,
    removeItem: vi.fn(() => {
      marker = null;
    }),
  };
  expect(clearDonationAttempt(storage, "attempt-A")).toBe(false);
  expect(marker).toBe("attempt-B");
  expect(storage.removeItem).not.toHaveBeenCalled();
  expect(clearDonationAttempt(storage, "attempt-B")).toBe(true);
  expect(marker).toBeNull();
  marker = "attempt-C";
  storage.removeItem.mockImplementation(() => {
    throw Error("storage failed");
  });
  expect(() => clearDonationAttempt(storage, "attempt-C")).toThrow();
  expect(marker).toBe("attempt-C");
});
