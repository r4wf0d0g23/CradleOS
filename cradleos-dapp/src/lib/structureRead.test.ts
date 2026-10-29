import { describe, expect, it, vi } from "vitest";
import { GrpcTypes } from "@mysten/sui/grpc";
import { CURRENT_WORLD as W } from "./cycle";
import { readStructureSnapshot, type StructureReadClient } from "./structureRead";

const id = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;
const wallet = id(1), charId = id(2), profileId = id(3);
const type = `${W}::assembly::Assembly`;
function obj(objectId: string, objectType: string, json: Record<string, unknown>, owner = { kind: "SHARED", version: "1" }) {
  return GrpcTypes.Object.fromJson({ objectId, objectType, version: "20", owner, json: { id: objectId, ...json } });
}
function ownedObj(objectId: string, objectType: string, json: Record<string, unknown>, address: string) {
  return obj(objectId, objectType, json, { kind: "ADDRESS", address } as any);
}
function fixture(count = 1) {
  const profile = ownedObj(profileId, `${W}::character::PlayerProfile`, { character_id: charId }, wallet);
  const character = obj(charId, `${W}::character::Character`, { character_address: wallet });
  const caps = Array.from({ length: count }, (_, n) => ownedObj(id(1000 + n), `${W}::access::OwnerCap<${type}>`, { authorized_object_id: id(2000 + n) }, charId));
  const structures = caps.map((cap, n) => obj(id(2000 + n), type, {
    owner_cap_id: cap.objectId, energy_source_id: id(9), metadata: { name: `Factory ${n}`, url: "" },
    key: { item_id: String(999 + n), tenant: "stillness" }, type_id: "88063",
    status: { status: { "@variant": "ONLINE" } }, location: { location_hash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" },
  }));
  const map = new Map([character, ...structures].map(o => [o.objectId!, o]));
  const list = vi.fn(({ owner, pageToken }) => ({ response: Promise.resolve(owner === wallet
    ? { objects: [profile] }
    : { objects: caps.slice(pageToken ? pageToken[0] : 0, (pageToken ? pageToken[0] : 0) + 50),
      nextPageToken: (pageToken ? pageToken[0] : 0) + 50 < count ? new Uint8Array([(pageToken ? pageToken[0] : 0) + 50]) : undefined }) }));
  const batch = vi.fn(({ requests }) => ({ response: Promise.resolve({ objects: requests.map(({ objectId }: { objectId: string }) => ({ result: map.has(objectId)
    ? { oneofKind: "object", object: map.get(objectId) } : { oneofKind: "error", error: { code: 5, message: "not found" } } })) }) }));
  const api = { stateService: { listOwnedObjects: list }, ledgerService: { batchGetObjects: batch } } as unknown as StructureReadClient;
  return { api, list, batch, map, profile, character, caps, structures };
}
describe("current structure snapshot", () => {
  it("paginates >50 caps and batches >50 reads without dropping holdings", async () => {
    const f = fixture(139); const s = await readStructureSnapshot(wallet, f.api);
    expect(s.characterId).toBe(charId); expect(s.structures).toHaveLength(139);
    expect(f.list).toHaveBeenCalledTimes(4); expect(f.batch).toHaveBeenCalledTimes(4);
    expect(s.structures[0]).toMatchObject({ displayName: "Factory 0", isOnline: true, locationHash: "0".repeat(64), energySourceId: id(9) });
  });
  it("omits only explicitly NOT_FOUND targets", async () => {
    const f = fixture(2); f.map.delete(id(2000));
    expect((await readStructureSnapshot(wallet, f.api)).structures).toHaveLength(1);
  });
  it.each([7, 13, 14, 16])("fails the whole snapshot on typed status %s", async code => {
    const f = fixture(); f.batch.mockImplementation(() => ({ response: Promise.resolve({ objects: [{ result: { oneofKind: "error", error: { code, message: "Object not found misleading text" } } }] }) }) as any);
    await expect(readStructureSnapshot(wallet, f.api)).rejects.toThrow(/unavailable/);
  });
  it("rejects partial batches rather than calling missing responses deleted", async () => {
    const f = fixture(); f.batch.mockReturnValue({ response: Promise.resolve({ objects: [] }) } as any);
    await expect(readStructureSnapshot(wallet, f.api)).rejects.toThrow(/unavailable/);
  });
  it("rejects wrong object identity", async () => {
    const f = fixture(); f.map.set(charId, f.structures[0]);
    await expect(readStructureSnapshot(wallet, f.api)).rejects.toThrow(/unavailable/);
  });
  it("does not follow a transferred character from a lingering profile", async () => {
    const f = fixture(); f.map.set(charId, obj(charId, `${W}::character::Character`, { character_address: id(77) }));
    expect(await readStructureSnapshot(wallet, f.api)).toEqual({ characterId: "", structures: [] });
  });
  it("rejects a profile not owned by the wallet", async () => {
    const f = fixture(); f.profile.owner!.address = id(77);
    await expect(readStructureSnapshot(wallet, f.api)).rejects.toThrow(/unavailable/);
  });
  it("rejects a cap not owned by the selected character", async () => {
    const f = fixture(); f.caps[0].owner!.address = id(77);
    await expect(readStructureSnapshot(wallet, f.api)).rejects.toThrow(/unavailable/);
  });
  it("rejects stale cap-to-structure binding", async () => {
    const f = fixture(); const j = GrpcTypes.Object.toJson(f.structures[0]) as any; j.json.owner_cap_id = id(77); f.map.set(id(2000), GrpcTypes.Object.fromJson(j));
    await expect(readStructureSnapshot(wallet, f.api)).rejects.toThrow(/unavailable/);
  });
  it.each(["BROKEN", null])("does not interpret malformed status %s as OFFLINE", async status => {
    const f = fixture(); const j = GrpcTypes.Object.toJson(f.structures[0]) as any; j.json.status.status["@variant"] = status; f.map.set(id(2000), GrpcTypes.Object.fromJson(j));
    await expect(readStructureSnapshot(wallet, f.api)).rejects.toThrow(/unavailable/);
  });
  it("rejects a repeated pagination token", async () => {
    const f = fixture(); f.list.mockImplementation(() => ({ response: Promise.resolve({ objects: [], nextPageToken: new Uint8Array([1]) }) }) as any);
    await expect(readStructureSnapshot(wallet, f.api)).rejects.toThrow(/unavailable/);
  });
  it("propagates transport failures rather than returning empty holdings", async () => {
    const f = fixture(); f.list.mockImplementation(() => { throw new Error("offline"); });
    await expect(readStructureSnapshot(wallet, f.api)).rejects.toThrow("offline");
  });
  it("keeps explicit null optional metadata and an unlinked energy source", async () => {
    const f = fixture(); const j = GrpcTypes.Object.toJson(f.structures[0]) as any;
    j.json.metadata = null; j.json.energy_source_id = null; j.json.status.status["@variant"] = "OFFLINE";
    f.map.set(id(2000), GrpcTypes.Object.fromJson(j));
    expect((await readStructureSnapshot(wallet, f.api)).structures[0]).toMatchObject({ displayName: "Assembly", isOnline: false, hasCustomName: false });
    expect((await readStructureSnapshot(wallet, f.api)).structures[0].energySourceId).toBeUndefined();
  });
  it("does not confuse missing optional fields with explicitly null values", async () => {
    const f = fixture(); const j = GrpcTypes.Object.toJson(f.structures[0]) as any; delete j.json.energy_source_id;
    f.map.set(id(2000), GrpcTypes.Object.fromJson(j));
    await expect(readStructureSnapshot(wallet, f.api)).rejects.toThrow(/unavailable/);
  });
  it("decodes node fuel and a nullable unlinked Gate", async () => {
    for (const [module, kind] of [["network_node", "NetworkNode"], ["gate", "Gate"]]) {
      const f = fixture(); const t = `${W}::${module}::${kind}`;
      f.caps[0].objectType = `${W}::access::OwnerCap<${t}>`;
      const j = GrpcTypes.Object.toJson(f.structures[0]) as any; j.objectType = t;
      j.json.linked_gate_id = null; j.json.energy_source_id = null;
      j.json.fuel = { quantity: "10", unit_volume: "28", max_capacity: "1000", burn_rate_in_ms: "3600000" };
      f.map.set(id(2000), GrpcTypes.Object.fromJson(j));
      const s = (await readStructureSnapshot(wallet, f.api)).structures[0];
      expect(s.kind).toBe(kind);
      if (kind === "NetworkNode") { expect(s.fuelLevelPct).toBeCloseTo(28); expect(s.runtimeHoursRemaining).toBe(10); }
      else expect(s.linkedGateId).toBeUndefined();
    }
  });
  it("prefers live holdings over a newer empty sibling without mixing characters", async () => {
    const f = fixture(); const sibling = id(88);
    f.map.set(sibling, obj(sibling, `${W}::character::Character`, { character_address: wallet })); f.map.get(sibling)!.version = 999n;
    f.list.mockImplementation(({ owner }) => ({ response: Promise.resolve({ objects: owner === wallet ? [f.profile, ownedObj(id(89), `${W}::character::PlayerProfile`, { character_id: sibling }, wallet)] : owner === sibling ? [] : f.caps }) }) as any);
    const r = await readStructureSnapshot(wallet, f.api);
    expect(r.characterId).toBe(charId); expect(r.structures).toHaveLength(1); expect(r.structures[0].ownerCapId).toBe(f.caps[0].objectId);
  });
  it("passes cancellation to reads and refuses an aborted result", async () => {
    const f = fixture(); const c = new AbortController(); c.abort();
    await expect(readStructureSnapshot(wallet, f.api, c.signal)).rejects.toThrow();
    expect((f.list.mock.calls[0] as any)[1].abort).toBe(c.signal);
  });
});
