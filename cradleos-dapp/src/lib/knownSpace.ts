import { isValidTransactionDigest } from "@mysten/sui/utils";
import { CURRENT_WORLD } from "./cycle";
import { TESTNET_CHAIN_ID } from "./headerStatus";

export const KNOWN_SPACE_API = "https://keeper.reapers.shop/known-space";
export const KNOWN_SPACE_STALE_MS = 180_000;
export type KnownGate = {
  id: string;
  itemId: string;
  typeId: string | null;
  name: string | null;
  systemId: string | null;
  locationDigest: string | null;
  locationAt: number | null;
  status: "ONLINE" | "OFFLINE" | "UNKNOWN";
  linkedGateId: string | null;
  checkedAt: number | null;
};
export type KnownGateEdge = {
  id: string;
  source: string;
  target: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  firstDigest: string;
  lastDigest: string;
};
export type KnownJump = {
  id: string;
  source: string;
  target: string;
  at: number;
  digest: string;
};
export type KnownSpaceSnapshot = {
  schemaVersion: 1;
  world: string;
  tenant: "stillness";
  chainId: string;
  cycle: 7;
  generatedAt: number;
  indexedAt: number | null;
  status: "live" | "backfilling" | "stale" | "unavailable";
  backfillComplete: boolean;
  coverage: {
    retainedFrom: number | null;
    firstEventAt: number | null;
    lastEventAt: number | null;
    eventCount: number;
    jumpCount: number;
    rejected: number;
    gaps: number;
    requestedAt: number | null;
  };
  gates: KnownGate[];
  edges: KnownGateEdge[];
  recentJumps: KnownJump[];
};
const fail = (): never => {
  throw new Error("Known space unavailable");
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail();
  return value as Record<string, unknown>;
}
function integer(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    return fail();
  return value;
}
function time(value: unknown): number {
  return integer(value, 1, 253402300799999);
}
function nullable<T>(value: unknown, parse: (v: unknown) => T): T | null {
  return value === null ? null : parse(value);
}
function objectId(value: unknown): string {
  if (typeof value !== "string" || !/^0x[0-9a-f]{64}$/.test(value))
    return fail();
  return value;
}
function decimal(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value) ||
    BigInt(value) > 0xffffffffffffffffn
  )
    return fail();
  return value;
}
function digest(value: unknown): string {
  if (typeof value !== "string" || !isValidTransactionDigest(value))
    return fail();
  return value;
}
function name(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 256 ||
    /[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/.test(value)
  )
    return fail();
  return value;
}
function enumeration<T extends string>(
  value: unknown,
  choices: readonly T[],
): T {
  if (typeof value !== "string" || !choices.includes(value as T)) return fail();
  return value as T;
}
function array(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) return fail();
  return value;
}
function unique(ids: string[]) {
  if (new Set(ids).size !== ids.length) fail();
}

/** Validate the public snapshot boundary. Unknown fields never enter the model. */
export function parseKnownSpace(
  value: unknown,
  requestedAt: number | null = null,
): KnownSpaceSnapshot {
  if (requestedAt !== null) time(requestedAt);
  const r = record(value),
    c = record(r.coverage);
  if (
    r.schemaVersion !== 1 ||
    r.world !== CURRENT_WORLD ||
    r.tenant !== "stillness" ||
    r.chainId !== TESTNET_CHAIN_ID ||
    r.cycle !== 7 ||
    typeof r.backfillComplete !== "boolean"
  )
    fail();
  const generatedAt = time(r.generatedAt),
    indexedAt = nullable(r.indexedAt, time);
  const coverage = {
    retainedFrom: nullable(c.retainedFrom, time),
    firstEventAt: nullable(c.firstEventAt, time),
    lastEventAt: nullable(c.lastEventAt, time),
    eventCount: integer(c.eventCount),
    jumpCount: integer(c.jumpCount),
    rejected: integer(c.rejected),
    gaps: integer(c.gaps),
    requestedAt: nullable(c.requestedAt, time),
  };
  if (
    coverage.requestedAt !== requestedAt ||
    (indexedAt !== null && indexedAt > generatedAt) ||
    (requestedAt !== null && requestedAt > generatedAt)
  )
    fail();
  const eventLimit = requestedAt ?? generatedAt;
  if (
    coverage.firstEventAt !== null &&
    coverage.lastEventAt !== null &&
    coverage.firstEventAt > coverage.lastEventAt
  )
    fail();
  // Coverage is the global retained/indexed range, including during replay.
  // Only graph discoveries and jumps are filtered by the selected timestamp.
  if (
    (coverage.firstEventAt !== null && coverage.firstEventAt > generatedAt) ||
    (coverage.lastEventAt !== null && coverage.lastEventAt > generatedAt)
  )
    fail();
  const gates = array(r.gates, 20_000).map((value) => {
    const g = record(value);
    const gate: KnownGate = {
      id: objectId(g.id),
      itemId: decimal(g.itemId),
      typeId: nullable(g.typeId, decimal),
      name: nullable(g.name, name),
      systemId: nullable(g.systemId, decimal),
      locationDigest: nullable(g.locationDigest, digest),
      locationAt: nullable(g.locationAt, time),
      status: enumeration(g.status, ["ONLINE", "OFFLINE", "UNKNOWN"]),
      linkedGateId: nullable(g.linkedGateId, objectId),
      checkedAt: nullable(g.checkedAt, time),
    };
    if (
      (gate.systemId !== null && gate.locationAt === null) ||
      (gate.systemId === null &&
        (gate.locationAt !== null || gate.locationDigest !== null))
    )
      fail();
    if (
      (gate.locationAt !== null && gate.locationAt > eventLimit) ||
      (gate.checkedAt !== null && gate.checkedAt > generatedAt)
    )
      fail();
    if (
      requestedAt !== null &&
      (gate.status !== "UNKNOWN" ||
        gate.linkedGateId !== null ||
        gate.name !== null ||
        gate.typeId !== null)
    )
      fail();
    return gate;
  });
  unique(gates.map((g) => g.id));
  const gateIds = new Set(gates.map((g) => g.id));
  const edges = array(r.edges, 100_000).map((value) => {
    const e = record(value),
      source = objectId(e.source),
      target = objectId(e.target);
    if (
      !gateIds.has(source) ||
      !gateIds.has(target) ||
      e.id !== `${source}>${target}`
    )
      fail();
    const edge: KnownGateEdge = {
      id: e.id as string,
      source,
      target,
      count: integer(e.count, 1),
      firstSeen: time(e.firstSeen),
      lastSeen: time(e.lastSeen),
      firstDigest: digest(e.firstDigest),
      lastDigest: digest(e.lastDigest),
    };
    if (edge.firstSeen > edge.lastSeen || edge.lastSeen > eventLimit) fail();
    return edge;
  });
  unique(edges.map((e) => e.id));
  if (
    !Number.isSafeInteger(edges.reduce((total, edge) => total + edge.count, 0))
  )
    fail();
  const recentJumps = array(r.recentJumps, 500).map((value) => {
    const j = record(value),
      source = objectId(j.source),
      target = objectId(j.target),
      tx = digest(j.digest),
      at = time(j.at);
    if (
      !gateIds.has(source) ||
      !gateIds.has(target) ||
      at > eventLimit ||
      typeof j.id !== "string" ||
      !j.id.startsWith(`${tx}#`)
    )
      fail();
    const sequence = (j.id as string).slice(tx.length + 1);
    if (
      !/^(0|[1-9]\d*)$/.test(sequence) ||
      BigInt(sequence) > 0xffffffffffffffffn
    )
      fail();
    return { id: j.id as string, source, target, digest: tx, at };
  });
  unique(recentJumps.map((j) => j.id));
  return {
    schemaVersion: 1,
    world: CURRENT_WORLD,
    tenant: "stillness",
    chainId: TESTNET_CHAIN_ID,
    cycle: 7,
    generatedAt,
    indexedAt,
    status: enumeration(r.status, [
      "live",
      "backfilling",
      "stale",
      "unavailable",
    ]),
    backfillComplete: r.backfillComplete as boolean,
    coverage,
    gates,
    edges,
    recentJumps,
  };
}

export async function fetchKnownSpace(
  at: number | null,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<KnownSpaceSnapshot> {
  if (at !== null) time(at);
  const response = await fetcher(
    `${KNOWN_SPACE_API}${at === null ? "" : `?at=${at}`}`,
    { signal, headers: { Accept: "application/json" }, credentials: "omit" },
  );
  if (!response.ok) throw new Error("Known space unavailable");
  const text = await response.text();
  if (text.length > 32_000_000) fail();
  return parseKnownSpace(JSON.parse(text), at);
}

export type SpaceNode = {
  id: string;
  systemId: string | null;
  gates: KnownGate[];
  x: number;
  y: number;
};
export type SpaceEdge = {
  id: string;
  source: string;
  target: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  gates: KnownGateEdge[];
};
export type SpaceGraph = {
  nodes: SpaceNode[];
  edges: SpaceEdge[];
  nodeByGate: Map<string, string>;
};
/** Deterministic seed only; the displayed layout is topology-based. */
export function knownSpacePosition(id: string): { x: number; y: number } {
  function hash(seed: number) {
    let h = seed;
    for (let i = 0; i < id.length; i++)
      h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
    return (h ^ (h >>> 16)) >>> 0;
  }
  return {
    x: (hash(2166136261) / 0xffffffff - 0.5) * 1800,
    y: (hash(3335557771) / 0xffffffff - 0.5) * 1100,
  };
}
export function buildKnownSpaceGraph(snapshot: KnownSpaceSnapshot): SpaceGraph {
  const nodes = new Map<string, SpaceNode>(),
    nodeByGate = new Map<string, string>();
  for (const gate of snapshot.gates) {
    const id =
      gate.systemId === null ? `gate:${gate.id}` : `system:${gate.systemId}`;
    let node = nodes.get(id);
    if (!node) {
      node = {
        id,
        systemId: gate.systemId,
        gates: [],
        ...knownSpacePosition(id),
      };
      nodes.set(id, node);
    }
    node.gates.push(gate);
    nodeByGate.set(gate.id, id);
  }
  const edges = new Map<string, SpaceEdge>();
  for (const edge of snapshot.edges) {
    const source = nodeByGate.get(edge.source)!,
      target = nodeByGate.get(edge.target)!,
      id = `${source}>${target}`;
    const existing = edges.get(id);
    if (existing) {
      existing.count += edge.count;
      existing.firstSeen = Math.min(existing.firstSeen, edge.firstSeen);
      existing.lastSeen = Math.max(existing.lastSeen, edge.lastSeen);
      existing.gates.push(edge);
    } else
      edges.set(id, {
        id,
        source,
        target,
        count: edge.count,
        firstSeen: edge.firstSeen,
        lastSeen: edge.lastSeen,
        gates: [edge],
      });
  }
  const orderedEdges = [...edges.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  return {
    nodes: layoutKnownSpace([...nodes.values()], orderedEdges),
    edges: orderedEdges,
    nodeByGate,
  };
}

/** Separate disconnected groups, then relax local topology. No geography,
 * randomness, traffic-count weighting, timers, or mutation of caller objects.
 * Identical topology yields identical positions; discoveries may expand/repack
 * components, but never scatter their endpoints independently across the map.
 */
export function layoutKnownSpace(
  input: SpaceNode[],
  edges: SpaceEdge[],
): SpaceNode[] {
  const ordered = [...input].sort((a, b) => a.id.localeCompare(b.id));
  const adjacency = new Map(ordered.map((n) => [n.id, new Set<string>()]));
  for (const edge of edges)
    if (edge.source !== edge.target) {
      adjacency.get(edge.source)!.add(edge.target);
      adjacency.get(edge.target)!.add(edge.source);
    }
  const seen = new Set<string>(),
    components: string[][] = [];
  for (const node of ordered) {
    if (seen.has(node.id)) continue;
    const ids = [node.id];
    seen.add(node.id);
    for (let i = 0; i < ids.length; i++)
      for (const neighbor of [...adjacency.get(ids[i])!].sort()) {
        if (!seen.has(neighbor)) {
          seen.add(neighbor);
          ids.push(neighbor);
        }
      }
    components.push(ids.sort());
  }
  const groups = components
    .map((ids) => {
      const index = new Map(ids.map((id, i) => [id, i]));
      const links: [number, number][] = [];
      for (const id of ids)
        for (const other of [...adjacency.get(id)!].sort())
          if (id < other) links.push([index.get(id)!, index.get(other)!]);
      const points = ids.map((id, i) => {
        const seed = knownSpacePosition(id);
        const angle = i * 2.399963229728653 + seed.x * 0.0001;
        const radius = Math.sqrt(i) * 65;
        return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
      });
      // Bounded work: large components use local spatial buckets, not O(n²).
      const iterations = ids.length <= 300 ? 160 : 80;
      for (let step = 0; step < iterations && ids.length > 1; step++) {
        const dx = new Float64Array(ids.length),
          dy = new Float64Array(ids.length);
        const repel = (a: number, b: number) => {
          let x = points[a].x - points[b].x,
            y = points[a].y - points[b].y;
          if (Math.abs(x) + Math.abs(y) < 0.001) {
            x = 0.01 * (a + 1);
            y = 0.01 * (b + 1);
          }
          const length = Math.max(1, Math.hypot(x, y)),
            force = 4200 / (length * length);
          dx[a] += x * force;
          dy[a] += y * force;
          dx[b] -= x * force;
          dy[b] -= y * force;
        };
        if (ids.length <= 300) {
          for (let a = 0; a < ids.length; a++)
            for (let b = a + 1; b < ids.length; b++) repel(a, b);
        } else {
          const buckets = new Map<string, number[]>();
          points.forEach((p, i) => {
            const key = `${Math.floor(p.x / 160)}:${Math.floor(p.y / 160)}`;
            const bucket = buckets.get(key);
            if (bucket) bucket.push(i);
            else buckets.set(key, [i]);
          });
          points.forEach((p, a) => {
            const x = Math.floor(p.x / 160),
              y = Math.floor(p.y / 160);
            for (let i = -1; i <= 1; i++)
              for (let j = -1; j <= 1; j++)
                for (const b of buckets.get(`${x + i}:${y + j}`) ?? [])
                  if (b > a) repel(a, b);
          });
        }
        for (const [a, b] of links) {
          const x = points[b].x - points[a].x,
            y = points[b].y - points[a].y,
            length = Math.max(1, Math.hypot(x, y));
          const force = ((length - 90) * 0.065) / length;
          dx[a] += x * force;
          dy[a] += y * force;
          dx[b] -= x * force;
          dy[b] -= y * force;
        }
        const temperature = 16 * (1 - step / iterations) + 0.25;
        points.forEach((p, i) => {
          const x = dx[i] - p.x * 0.004,
            y = dy[i] - p.y * 0.004,
            length = Math.max(1, Math.hypot(x, y));
          const scale = Math.min(1, temperature / length);
          p.x += x * scale;
          p.y += y * scale;
        });
      }
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      return {
        ids,
        points,
        minX,
        minY,
        width: maxX - minX + 110,
        height: maxY - minY + 110,
      };
    })
    .sort(
      (a, b) => b.ids.length - a.ids.length || a.ids[0].localeCompare(b.ids[0]),
    );
  const targetWidth = Math.max(
    400,
    ...groups.map((g) => g.width),
    Math.sqrt(groups.reduce((area, g) => area + g.width * g.height, 0) * 1.6),
  );
  const positioned = new Map<string, { x: number; y: number }>();
  let x = 0,
    y = 0,
    rowHeight = 0,
    maxX = 0;
  for (const group of groups) {
    if (x > 0 && x + group.width > targetWidth) {
      x = 0;
      y += rowHeight + 35;
      rowHeight = 0;
    }
    group.ids.forEach((id, i) =>
      positioned.set(id, {
        x: x + 55 + group.points[i].x - group.minX,
        y: y + 55 + group.points[i].y - group.minY,
      }),
    );
    x += group.width + 35;
    maxX = Math.max(maxX, x - 35);
    rowHeight = Math.max(rowHeight, group.height);
  }
  const height = y + rowHeight;
  return ordered.map((node) => ({
    ...node,
    x: Math.round((positioned.get(node.id)!.x - maxX / 2) * 100) / 100,
    y: Math.round((positioned.get(node.id)!.y - height / 2) * 100) / 100,
  }));
}
export const shortSpaceId = (id: string) => `${id.slice(0, 8)}…${id.slice(-5)}`;
export function spaceNodeLabel(
  node: SpaceNode,
  names: ReadonlyMap<string, string>,
): string {
  return node.systemId !== null
    ? (names.get(node.systemId) ?? `System ${node.systemId}`)
    : (node.gates[0].name ?? `Gate ${node.gates[0].itemId}`);
}
export function spaceNodeMatches(
  node: SpaceNode,
  query: string,
  names: ReadonlyMap<string, string>,
): boolean {
  const q = query.trim().toLocaleLowerCase();
  return (
    !q ||
    [
      node.systemId ?? "",
      spaceNodeLabel(node, names),
      ...node.gates.flatMap((g) => [g.id, g.itemId, g.name ?? ""]),
    ].some((value) => value.toLocaleLowerCase().includes(q))
  );
}
export function knownSpaceStatus(
  snapshot: KnownSpaceSnapshot,
  now = Date.now(),
): "Live" | "Backfilling" | "Stale" | "Unavailable" {
  if (snapshot.status === "unavailable") return "Unavailable";
  if (
    snapshot.status === "stale" ||
    snapshot.indexedAt === null ||
    now - snapshot.indexedAt > KNOWN_SPACE_STALE_MS ||
    snapshot.generatedAt > now + 60_000
  )
    return "Stale";
  return snapshot.status === "backfilling" || !snapshot.backfillComplete
    ? "Backfilling"
    : "Live";
}

/** Archived evidence remains reachable after upstream retention advances. */
export function knownSpaceHistoryRange(
  snapshot: KnownSpaceSnapshot,
): { start: number; end: number } | null {
  const starts = [
    snapshot.coverage.retainedFrom,
    snapshot.coverage.firstEventAt,
  ].filter((value): value is number => value !== null);
  if (!starts.length) return null;
  const start = Math.min(...starts),
    end = snapshot.indexedAt ?? snapshot.generatedAt;
  return start < end ? { start, end } : null;
}
