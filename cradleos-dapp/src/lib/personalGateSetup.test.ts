import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./currentWorldRead", () => ({
  findCurrentCharacters: vi.fn(),
  queryChain: vi.fn(),
}));
import { findCurrentCharacters, queryChain } from "./currentWorldRead";
import { CURRENT_WORLD } from "./cycle";
import { CYCLE_DEPLOYMENT } from "./cycleDeployment";
import { fetchPersonalGateSetup } from "./personalGateSetup";
const id = (n: number) => "0x" + n.toString(16).padStart(64, "0");
const row = (n: number, type: string, json: object) => ({
  address: id(n),
  version: 1,
  asMoveObject: { contents: { type: { repr: type }, json } },
});
const char = (tribe = 77, owner = id(1)) => ({
  character: row(2, `${CURRENT_WORLD}::character::Character`, {
    tribe_id: tribe,
    character_address: owner,
  }),
});
const vault = (n = 3) =>
  row(n, `${CYCLE_DEPLOYMENT.packages.core}::tribe_vault::TribeVault`, {
    founder: id(1),
    coin_name: "",
    coin_symbol: "",
  });
const page = (
  nodes: ReturnType<typeof row>[],
  cursor: string | null = null,
) => ({
  objects: { nodes, pageInfo: { hasNextPage: !!cursor, endCursor: cursor } },
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findCurrentCharacters).mockResolvedValue([
    { characterId: id(2), tribeId: 999, version: 1 },
  ]);
});
it("uses the actual owned character tribe, not discovery or a fallback tribe", async () => {
  vi.mocked(queryChain)
    .mockResolvedValueOnce(char())
    .mockResolvedValueOnce(page([]));
  expect(await fetchPersonalGateSetup(id(1))).toEqual({
    tribeId: 77,
    vault: null,
    policy: null,
  });
});
it("rejects missing character, unknown tribe and wrong owner", async () => {
  vi.mocked(findCurrentCharacters).mockResolvedValueOnce([]);
  await expect(fetchPersonalGateSetup(id(1))).rejects.toThrow(
    /No current character/,
  );
  vi.mocked(queryChain).mockResolvedValueOnce(char(0));
  await expect(fetchPersonalGateSetup(id(1))).rejects.toThrow(/tribe/);
  vi.mocked(queryChain).mockResolvedValueOnce(char(77, id(9)));
  await expect(fetchPersonalGateSetup(id(1))).rejects.toThrow(/ownership/);
});
it("reads subsequent pages before deciding whether setup is missing", async () => {
  vi.mocked(queryChain)
    .mockResolvedValueOnce(char())
    .mockResolvedValueOnce(page([], "next"))
    .mockResolvedValueOnce(page([vault()]))
    .mockResolvedValueOnce(
      page([
        row(
          4,
          `${CYCLE_DEPLOYMENT.packages.core}::gate_policy::TribeGatePolicy`,
          { vault_id: id(3), access_level: 1 },
        ),
      ]),
    );
  expect(await fetchPersonalGateSetup(id(1))).toEqual({
    tribeId: 77,
    vault: { objectId: id(3) },
    policy: { objectId: id(4), accessLevel: 1 },
  });
  expect(vi.mocked(queryChain).mock.calls[2][1]?.after).toBe("next");
});
it("does not turn failed or incomplete lookup into permission to create", async () => {
  vi.mocked(queryChain)
    .mockResolvedValueOnce(char())
    .mockRejectedValueOnce(new Error("503"));
  await expect(fetchPersonalGateSetup(id(1))).rejects.toThrow("503");
  vi.mocked(queryChain)
    .mockResolvedValueOnce(char())
    .mockResolvedValueOnce({ objects: { nodes: [] } });
  await expect(fetchPersonalGateSetup(id(1))).rejects.toThrow(/incomplete/);
});
it("rejects duplicate personal setups rather than choose silently", async () => {
  vi.mocked(queryChain)
    .mockResolvedValueOnce(char())
    .mockResolvedValueOnce(page([vault(), vault(5)]));
  await expect(fetchPersonalGateSetup(id(1))).rejects.toThrow(
    /Multiple personal/,
  );
});
it("rejects repeated pagination cursors", async () => {
  vi.mocked(queryChain)
    .mockResolvedValueOnce(char())
    .mockResolvedValueOnce(page([], "loop"))
    .mockResolvedValueOnce(page([], "loop"));
  await expect(fetchPersonalGateSetup(id(1))).rejects.toThrow(/pagination/);
});
