import { beforeEach, expect, it, vi } from "vitest";
import { deriveDynamicFieldID } from "@mysten/sui/utils";
const id = (n: number) => "0x" + n.toString(16).padStart(64, "0");
vi.mock("./cycleDeployment", () => ({
  CYCLE_DEPLOYMENT: { packages: { turret: "0x" + "9".repeat(64) } },
}));
vi.mock("./currentWorldRead", () => ({
  findCurrentCharacters: vi.fn(),
  listOwnedCurrentObjects: vi.fn(),
  queryChain: vi.fn(),
}));
import {
  findCurrentCharacters,
  listOwnedCurrentObjects,
  queryChain,
} from "./currentWorldRead";
import { CURRENT_WORLD } from "./cycle";
import {
  fetchPersonalTurrets,
  buildPersonalTurretTransaction as build,
  isOurTurretExtension,
  PERSONAL_TURRET_AUTH,
  type OwnedTurret,
} from "./personalTurrets";
import { DEFAULT_TURRET_SETTINGS as defaults } from "./turretSettings";
const base: OwnedTurret = {
  id: id(3),
  capId: id(4),
  characterId: id(2),
  name: "North turret",
  typeId: 92402,
  online: true,
  frozen: false,
  extension: null,
  description: "",
  settings: null,
  version: 1,
};
const row = (address: string, type: string, json: object) => ({
  address,
  version: 1,
  asMoveObject: { contents: { type: { repr: type }, json } },
});
const char = row(id(2), `${CURRENT_WORLD}::character::Character`, {
  character_address: id(1),
});
const turret = row(id(3), `${CURRENT_WORLD}::turret::Turret`, {
  owner_cap_id: id(4),
  key: { item_id: "10001" },
  type_id: "92402",
  status: { status: { "@variant": "ONLINE" } },
  metadata: { name: "North turret", description: "", url: "" },
  extension: null,
});
beforeEach(() => vi.resetAllMocks());
function setup() {
  vi.mocked(findCurrentCharacters).mockResolvedValue([
    { characterId: id(2), tribeId: 7, version: 1 },
  ]);
  vi.mocked(listOwnedCurrentObjects).mockResolvedValue([
    {
      address: id(4),
      version: 1,
      asMoveObject: { contents: { json: { authorized_object_id: id(3) } } },
    },
  ]);
  vi.mocked(queryChain)
    .mockResolvedValueOnce({ o0: char })
    .mockResolvedValueOnce({ o0: turret, o1: null });
}
function setupExtension(extension: unknown) {
  setup();
  vi.mocked(queryChain)
    .mockReset()
    .mockResolvedValueOnce({ o0: char })
    .mockResolvedValueOnce({
      o0: row(id(3), `${CURRENT_WORLD}::turret::Turret`, {
        ...turret.asMoveObject.contents.json,
        extension,
      }),
      o1: null,
    });
}
// Captured from the public current-world GraphQL response on 2026-10-08 UTC:
// turret 0x0e5be29757fac288bd8594e0db59329ad251b30d0a0b2166c52ddf3820755ee5.
// Option<TypeName> is flattened to a string, NOT { name: string }.
const liveExtension =
  "84f0dc475c0942fff9d0b8e771623857a87926106016f1f2a10fda6d41861f9e::turret::CommercialAuthV2";
it("decodes the live configured extension without losing foreign replacement consent", async () => {
  setupExtension(liveExtension);
  const [result] = await fetchPersonalTurrets(id(1));
  expect(result.extension).toBe(`0x${liveExtension}`);
  expect(isOurTurretExtension(result.extension)).toBe(false);
  expect(() => build(id(1), result, defaults)).toThrow(/Confirm/);
  expect(() => build(id(1), result, defaults, true)).not.toThrow();
});
it.each([
  PERSONAL_TURRET_AUTH,
  PERSONAL_TURRET_AUTH.slice(2),
  { name: PERSONAL_TURRET_AUTH },
  [PERSONAL_TURRET_AUTH],
  { vec: [{ name: PERSONAL_TURRET_AUTH.slice(2) }] },
])("recognizes our extension in supported JSON forms: %j", async (extension) => {
  setupExtension(extension);
  const [result] = await fetchPersonalTurrets(id(1));
  expect(result.extension).toBe(PERSONAL_TURRET_AUTH);
  expect(isOurTurretExtension(result.extension)).toBe(true);
  expect(() => build(id(1), result, null)).not.toThrow();
});
it.each([null, [], { vec: [] }])("keeps an explicit empty extension as defaults: %j", async (extension) => {
  setupExtension(extension);
  const [result] = await fetchPersonalTurrets(id(1));
  expect(result.extension).toBeNull();
});
it.each([
  undefined, "", "not-a-type", 7, {}, { name: 7 }, { name: "" },
  { vec: "invalid" }, [liveExtension, liveExtension], { vec: [null] },
  [null], { name: "0x123::turret::Auth::extra" },
])("fails closed for incomplete or malformed extension data: %j", async (extension) => {
  setupExtension(extension);
  await expect(fetchPersonalTurrets(id(1))).rejects.toThrow(/extension data/);
});
it("borrows, saves and returns OwnerCap without extra config object", () => {
  const tx = build(id(1), base, defaults).getData();
  expect(tx.sender).toBe(id(1));
  expect(tx.commands.map((c) => c.MoveCall?.function)).toEqual([
    "borrow_owner_cap",
    "save_settings",
    "return_owner_cap",
  ]);
  expect(tx.commands[1].MoveCall?.arguments).toHaveLength(4);
  expect(JSON.stringify(tx)).not.toContain("turret_ext");
});
it("requires consent for foreign extension and rejects frozen foreign binding", () => {
  const t = { ...base, extension: `${id(8)}::turret::TurretAuth` };
  expect(() => build(id(1), t, defaults)).toThrow(/Confirm/);
  expect(() => build(id(1), t, defaults, true)).not.toThrow();
  expect(() => build(id(1), { ...t, frozen: true }, defaults, true)).toThrow(
    /frozen/,
  );
});
it("permits frozen ours edits, rejects frozen or foreign restore", () => {
  const t = { ...base, extension: PERSONAL_TURRET_AUTH, frozen: true };
  expect(() => build(id(1), t, defaults)).not.toThrow();
  expect(() => build(id(1), t, null)).toThrow(/frozen/);
  expect(() => build(id(1), base, null)).toThrow(/Only CradleOS/);
  expect(
    build(id(1), { ...t, frozen: false }, null).getData().commands[1].MoveCall
      ?.function,
  ).toBe("restore_defaults");
});
it("compares exact full extension identity", () => {
  expect(isOurTurretExtension(PERSONAL_TURRET_AUTH)).toBe(true);
  expect(isOurTurretExtension(PERSONAL_TURRET_AUTH + "Evil")).toBe(false);
  expect(isOurTurretExtension(null)).toBe(false);
});
it("reads actual GraphQL JSON with current owner/cap and online status", async () => {
  setup();
  expect(await fetchPersonalTurrets(id(1))).toEqual([base]);
  expect(listOwnedCurrentObjects).toHaveBeenCalledWith(
    id(2),
    `${CURRENT_WORLD}::access::OwnerCap<${CURRENT_WORLD}::turret::Turret>`,
  );
});
it("rejects incomplete reads instead of a partial fleet", async () => {
  setup();
  vi.mocked(queryChain)
    .mockReset()
    .mockResolvedValueOnce({ o0: char })
    .mockResolvedValueOnce({ o0: turret });
  await expect(fetchPersonalTurrets(id(1))).rejects.toThrow(/incomplete/);
});
it("rejects changed owner", async () => {
  setup();
  vi.mocked(queryChain)
    .mockReset()
    .mockResolvedValueOnce({
      o0: row(id(2), `${CURRENT_WORLD}::character::Character`, {
        character_address: id(9),
      }),
    });
  await expect(fetchPersonalTurrets(id(1))).rejects.toThrow(
    /ownership changed/,
  );
});
it("propagates discovery errors rather than empty list", async () => {
  vi.mocked(findCurrentCharacters).mockRejectedValue(new Error("503"));
  await expect(fetchPersonalTurrets(id(1))).rejects.toThrow("503");
});
it("detects frozen marker using deployed empty-struct dummy bool encoding", async () => {
  setup();
  vi.mocked(queryChain)
    .mockReset()
    .mockResolvedValueOnce({ o0: char })
    .mockResolvedValueOnce({ o0: turret, o1: row(id(8), "field", {}) });
  expect((await fetchPersonalTurrets(id(1)))[0].frozen).toBe(true);
  const vars = vi.mocked(queryChain).mock.calls[1][1];
  expect(vars?.id1).toBe(
    deriveDynamicFieldID(
      id(3),
      `${CURRENT_WORLD}::extension_freeze::ExtensionFrozenKey`,
      new Uint8Array([0]),
    ),
  );
  expect(vars?.id1).not.toBe(
    deriveDynamicFieldID(
      id(3),
      `${CURRENT_WORLD}::extension_freeze::ExtensionFrozenKey`,
      new Uint8Array(),
    ),
  );
});
