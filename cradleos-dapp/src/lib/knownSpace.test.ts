import { describe, expect, it, vi } from "vitest";
import { CURRENT_WORLD } from "./cycle";
import { TESTNET_CHAIN_ID } from "./headerStatus";
import {
  buildKnownSpaceGraph,
  fetchKnownSpace,
  knownSpacePosition,
  knownSpaceHistoryRange,
  knownSpaceStatus,
  parseKnownSpace,
  spaceNodeMatches,
} from "./knownSpace";

const id = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;
const tx = "11111111111111111111111111111111";
const at = 1793470000000;
function gate(n: number, systemId: string | null = null) {
  return {
    id: id(n),
    itemId: String(n),
    typeId: null,
    name: null,
    systemId,
    locationDigest: systemId ? tx : null,
    locationAt: systemId ? at - 10000 : null,
    status: "UNKNOWN",
    linkedGateId: null,
    checkedAt: null,
  };
}
function fixture() {
  return {
    schemaVersion: 1,
    world: CURRENT_WORLD,
    tenant: "stillness",
    chainId: TESTNET_CHAIN_ID,
    cycle: 7,
    generatedAt: at,
    indexedAt: at - 1000,
    status: "live",
    backfillComplete: true,
    coverage: {
      retainedFrom: at - 30000,
      firstEventAt: at - 10000,
      lastEventAt: at - 2000,
      eventCount: 10,
      jumpCount: 3,
      rejected: 0,
      gaps: 0,
      requestedAt: null as number | null,
    },
    gates: [gate(1, "300001"), gate(2), gate(3), gate(4, "300001")],
    edges: [
      {
        id: `${id(1)}>${id(2)}`,
        source: id(1),
        target: id(2),
        count: 2,
        firstSeen: at - 9000,
        lastSeen: at - 2000,
        firstDigest: tx,
        lastDigest: tx,
      },
      {
        id: `${id(4)}>${id(2)}`,
        source: id(4),
        target: id(2),
        count: 1,
        firstSeen: at - 7000,
        lastSeen: at - 6000,
        firstDigest: tx,
        lastDigest: tx,
      },
    ],
    recentJumps: [
      {
        id: `${tx}#0`,
        source: id(1),
        target: id(2),
        at: at - 2000,
        digest: tx,
      },
    ],
  };
}
describe("known-space public boundary", () => {
  it("accepts verified systems and independent unresolved endpoints, ignoring unknown fields", () => {
    const parsed = parseKnownSpace({
      ...fixture(),
      privatePilot: "must not propagate",
    });
    expect(parsed.gates).toHaveLength(4);
    expect(parsed).not.toHaveProperty("privatePilot");
    expect(parsed.coverage.requestedAt).toBeNull();
  });
  it.each(["world", "tenant", "chainId", "cycle", "schemaVersion"])(
    "rejects mismatched %s",
    (field) => {
      expect(() =>
        parseKnownSpace({ ...fixture(), [field]: "wrong" }),
      ).toThrow();
    },
  );
  it("rejects duplicate gates, malformed IDs, invalid numeric strings and missing required fields", () => {
    const dup = fixture();
    dup.gates.push(dup.gates[0]);
    expect(() => parseKnownSpace(dup)).toThrow();
    for (const patch of [
      { id: "0x1" },
      { itemId: "01" },
      { itemId: "18446744073709551616" },
      { typeId: "0" },
      { status: "online" },
      { name: "bad\u202ename" },
    ]) {
      const f = fixture();
      Object.assign(f.gates[0], patch);
      expect(() => parseKnownSpace(f)).toThrow();
    }
    const f = fixture();
    delete (f.coverage as Partial<typeof f.coverage>).gaps;
    expect(() => parseKnownSpace(f)).toThrow();
  });
  it("rejects invalid times, counts and unbound location claims", () => {
    for (const bad of [
      -1,
      NaN,
      Infinity,
      1.5,
      "3",
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      const f = fixture();
      (f.coverage as any).jumpCount = bad;
      expect(() => parseKnownSpace(f)).toThrow();
    }
    const missing = fixture();
    missing.gates[0].locationAt = null;
    expect(() => parseKnownSpace(missing)).toThrow();
    const future = fixture();
    future.gates[0].locationAt = at + 1;
    expect(() => parseKnownSpace(future)).toThrow();
    const registry = fixture();
    registry.gates[0].locationDigest = null;
    expect(parseKnownSpace(registry).gates[0].systemId).toBe("300001");
  });
  it("binds directed edge IDs/references and transaction event IDs", () => {
    for (const patch of [
      { source: id(99) },
      { id: "incorrect" },
      { count: 0 },
      { lastSeen: at + 1 },
      { firstDigest: "javascript:alert(1)" },
    ]) {
      const f = fixture();
      Object.assign(f.edges[0], patch);
      expect(() => parseKnownSpace(f)).toThrow();
    }
    for (const eventId of [`${tx}#-1`, `${tx}#01`, `${tx}#1.5`, `bad#0`]) {
      const f = fixture();
      f.recentJumps[0].id = eventId;
      expect(() => parseKnownSpace(f)).toThrow();
    }
    const f = fixture();
    f.edges.push(f.edges[0]);
    expect(() => parseKnownSpace(f)).toThrow();
  });
  it("requires exact replay timestamp and no future-discovery/current-health lookahead", () => {
    const f = fixture(),
      replay = at - 1000;
    f.coverage.requestedAt = replay;
    expect(() => parseKnownSpace(f)).toThrow();
    expect(parseKnownSpace(f, replay).coverage.requestedAt).toBe(replay);
    expect(() => parseKnownSpace(f, replay - 1)).toThrow();
    for (const patch of [
      { status: "ONLINE" },
      { linkedGateId: id(2) },
      { name: "Current name" },
      { typeId: "123" },
      { locationAt: at },
    ]) {
      const changed = structuredClone(f);
      Object.assign(changed.gates[0], patch);
      expect(() => parseKnownSpace(changed, replay)).toThrow();
    }
  });
  it("retains global coverage bounds for replay while filtering graph event timestamps", () => {
    const f = fixture(),
      replay = at - 9500;
    f.coverage.requestedAt = replay;
    f.coverage.jumpCount = 0;
    f.edges = [];
    f.recentJumps = [];
    expect(parseKnownSpace(f, replay).coverage.lastEventAt).toBe(at - 2000);
    f.gates[0].locationAt = at - 9000;
    expect(() => parseKnownSpace(f, replay)).toThrow();
  });
  it("preserves a genuine empty snapshot without inventing observed endpoints", () => {
    const f = fixture();
    f.gates = [];
    f.edges = [];
    f.recentJumps = [];
    f.coverage.eventCount = 0;
    f.coverage.jumpCount = 0;
    expect(buildKnownSpaceGraph(parseKnownSpace(f)).nodes).toEqual([]);
  });
  it("requests public replay with no credentials and checks HTTP/schema", async () => {
    const f = fixture();
    f.coverage.requestedAt = at - 1000;
    const fake = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(f)),
      ) as unknown as typeof fetch;
    const abort = new AbortController();
    await fetchKnownSpace(at - 1000, abort.signal, fake);
    expect(fake).toHaveBeenCalledWith(
      `https://keeper.reapers.shop/known-space?at=${at - 1000}`,
      expect.objectContaining({ signal: abort.signal, credentials: "omit" }),
    );
    const bad = vi
      .fn()
      .mockResolvedValue(
        new Response("unavailable", { status: 503 }),
      ) as unknown as typeof fetch;
    await expect(fetchKnownSpace(null, undefined, bad)).rejects.toThrow();
  });
});
describe("known-space schematic", () => {
  it("keeps archived evidence reachable after provider retention advances", () => {
    const snapshot = parseKnownSpace(fixture());
    expect(knownSpaceHistoryRange(snapshot)).toEqual({
      start: at - 30000,
      end: at - 1000,
    });
    snapshot.coverage.retainedFrom = at - 5000;
    expect(knownSpaceHistoryRange(snapshot)).toEqual({
      start: at - 10000,
      end: at - 1000,
    });
    snapshot.coverage.retainedFrom = null;
    expect(knownSpaceHistoryRange(snapshot)?.start).toBe(at - 10000);
    snapshot.coverage.firstEventAt = null;
    expect(knownSpaceHistoryRange(snapshot)).toBeNull();
  });
  it("only merges verified system memberships and retains every underlying gate route", () => {
    const graph = buildKnownSpaceGraph(parseKnownSpace(fixture()));
    expect(graph.nodes).toHaveLength(3);
    expect(graph.nodes.filter((n) => n.systemId === null)).toHaveLength(2);
    expect(
      graph.nodes.find((n) => n.systemId === "300001")!.gates,
    ).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].count).toBe(3);
    expect(graph.edges[0].gates).toHaveLength(2);
    expect(graph.edges[0].firstSeen).toBe(at - 9000);
    expect(graph.edges[0].lastSeen).toBe(at - 2000);
  });
  it("keeps topology coordinates deterministic across ordering and traffic changes", () => {
    const f = fixture(),
      before = buildKnownSpaceGraph(parseKnownSpace(f));
    f.gates.reverse();
    f.edges.reverse();
    f.edges[0].count += 10;
    const after = buildKnownSpaceGraph(parseKnownSpace(f));
    for (const node of before.nodes)
      expect(after.nodes.find((n) => n.id === node.id)).toMatchObject({
        x: node.x,
        y: node.y,
      });
    expect(knownSpacePosition("gate:one")).not.toEqual(
      knownSpacePosition("gate:two"),
    );
  });
  it("packs disconnected components separately and preserves local geometry on growth", () => {
    const f = fixture();
    f.gates = Array.from({ length: 12 }, (_, i) => gate(i + 1));
    f.edges = Array.from({ length: 6 }, (_, i) => ({
      ...f.edges[0],
      id: `${id(i * 2 + 1)}>${id(i * 2 + 2)}`,
      source: id(i * 2 + 1),
      target: id(i * 2 + 2),
    }));
    const graph = buildKnownSpaceGraph(parseKnownSpace(f)),
      lookup = new Map(graph.nodes.map((n) => [n.id, n]));
    const boxes = f.edges.map((e) => {
      const a = lookup.get(`gate:${e.source}`)!,
        b = lookup.get(`gate:${e.target}`)!;
      return {
        left: Math.min(a.x, b.x) - 40,
        right: Math.max(a.x, b.x) + 40,
        top: Math.min(a.y, b.y) - 40,
        bottom: Math.max(a.y, b.y) + 40,
      };
    });
    for (let a = 0; a < boxes.length; a++)
      for (let b = a + 1; b < boxes.length; b++) {
        const one = boxes[a],
          two = boxes[b];
        expect(
          one.right < two.left ||
            two.right < one.left ||
            one.bottom < two.top ||
            two.bottom < one.top,
        ).toBe(true);
      }
    f.gates.push(gate(99));
    const grown = new Map(
      buildKnownSpaceGraph(parseKnownSpace(f)).nodes.map((n) => [n.id, n]),
    );
    for (const e of f.edges) {
      const a = `gate:${e.source}`,
        b = `gate:${e.target}`;
      expect(grown.get(a)!.x - grown.get(b)!.x).toBeCloseTo(
        lookup.get(a)!.x - lookup.get(b)!.x,
        1,
      );
      expect(grown.get(a)!.y - grown.get(b)!.y).toBeCloseTo(
        lookup.get(a)!.y - lookup.get(b)!.y,
        1,
      );
    }
  });
  it("preserves direction and self-system routes instead of inventing routes", () => {
    const f = fixture();
    f.edges[1] = {
      ...f.edges[1],
      id: `${id(1)}>${id(4)}`,
      source: id(1),
      target: id(4),
    };
    const graph = buildKnownSpaceGraph(parseKnownSpace(f));
    expect(graph.edges.some((e) => e.source === e.target)).toBe(true);
    expect(graph.edges.some((e) => e.source === `gate:${id(2)}`)).toBe(false);
  });
  it("searches observed system labels and underlying gate names and IDs", () => {
    const f = fixture();
    (f.gates[0] as any).name = "Home Gate";
    const node = buildKnownSpaceGraph(parseKnownSpace(f)).nodes.find(
      (n) => n.systemId,
    )!;
    const names = new Map([["300001", "Aster"]]);
    for (const query of ["aster", " HOME ", id(1), "300001"])
      expect(spaceNodeMatches(node, query, names)).toBe(true);
    expect(spaceNodeMatches(node, "not observed", names)).toBe(false);
  });
  it("uses the event-source watermark for freshness, not just response generation", () => {
    const f = parseKnownSpace(fixture());
    expect(knownSpaceStatus(f, at)).toBe("Live");
    expect(knownSpaceStatus({ ...f, indexedAt: at - 180001 }, at)).toBe(
      "Stale",
    );
    expect(knownSpaceStatus({ ...f, indexedAt: null }, at)).toBe("Stale");
    expect(knownSpaceStatus({ ...f, backfillComplete: false }, at)).toBe(
      "Backfilling",
    );
    expect(knownSpaceStatus({ ...f, status: "unavailable" }, at)).toBe(
      "Unavailable",
    );
  });
});
