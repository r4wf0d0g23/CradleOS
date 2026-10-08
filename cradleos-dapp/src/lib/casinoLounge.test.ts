import { beforeEach, expect, it, vi } from "vitest";
import { CYCLE_DEPLOYMENT } from "./cycleDeployment";
import { CURRENT_EVE_COIN_TYPE } from "./cycle";
import { fetchLoungeHouse, testnetHouseReady } from "./casinoLounge";
import { queryChain } from "./currentWorldRead";
vi.mock("./currentWorldRead", () => ({ queryChain: vi.fn() }));
const response = (fields: Record<string, unknown> = {}) => ({
  object: {
    version: 3,
    asMoveObject: {
      contents: {
        type: {
          repr: `${CYCLE_DEPLOYMENT.packages.casino}::house::House<${CURRENT_EVE_COIN_TYPE}>`,
        },
        json: {
          bank: "0",
          min_bet: "1",
          max_bet: "1",
          paused: true,
          ...fields,
        },
      },
    },
  },
});
beforeEach(() => vi.resetAllMocks());
it("reads only the current House<EVE> and exact integer amounts", async () => {
  vi.mocked(queryChain).mockResolvedValue(
    response({ bank: "18446744073709551615" }),
  );
  expect(await fetchLoungeHouse()).toEqual({
    bank: "18446744073709551615",
    minBet: "1",
    maxBet: "1",
    paused: true,
    version: 3,
  });
  expect(vi.mocked(queryChain).mock.calls[0][1]).toEqual({
    id: CYCLE_DEPLOYMENT.objects.casinoHouse,
  });
});
it("rejects foreign types, missing objects and incomplete balances", async () => {
  const wrong = response();
  wrong.object.asMoveObject.contents.type.repr =
    "0xold::house::House<0xold::coin::COIN>";
  for (const data of [
    { object: null },
    wrong,
    response({ bank: 0 }),
    response({ max_bet: "NaN" }),
    response({ paused: "false" }),
  ]) {
    vi.mocked(queryChain).mockResolvedValue(data);
    await expect(fetchLoungeHouse()).rejects.toThrow();
  }
});
it("cannot activate the staged house via an optimistic runtime response", () => {
  expect(CYCLE_DEPLOYMENT.casinoFunded).toBe(false);
  expect(testnetHouseReady(undefined)).toBe(false);
  expect(
    testnetHouseReady({
      bank: "100000000000",
      minBet: "1",
      maxBet: "10",
      paused: false,
      version: 3,
    }),
  ).toBe(false);
});
