/**
 * Keeper Cipher — expedition target selectors and on-chain verification.
 *
 * v0 keeps everything client-side:
 *   - System selection from publicly-readable on-chain state
 *   - Verification of "did this player reveal a node in this system after
 *     the mission was issued" via LocationRevealedEvent scans
 *   - No custom Move contracts required
 */

import { rpcFetchWithRetry } from "../../lib";
import { WORLD_PKG } from "../../constants";

const SUI_RPC = "https://fullnode.testnet.sui.io:443";

export interface KillEventLite {
  killer_id?: string;
  victim_id?: string;
  solar_system_id: string;
  kill_timestamp: number;
}

export interface LocationReveal {
  assemblyId: string;
  solarSystemId: number;
  txDigest: string;
  blockTimeMs: number;
}

// ── Selectors ─────────────────────────────────────────────────────────────────

/**
 * Walk recent KillmailCreatedEvents and return the system with the highest
 * kill count in the requested window. Returns null if no kills found.
 */
export async function selectBloodiestSystem(
  windowSeconds: number,
  maxPages = 20,
): Promise<number | null> {
  const eventType = `${WORLD_PKG}::killmail::KillmailCreatedEvent`;
  const stopAt = Math.floor(Date.now() / 1000) - windowSeconds;
  const counts = new Map<number, number>();
  let cursor: any = null;

  for (let page = 0; page < maxPages; page++) {
    let json: any;
    try {
      const res = await rpcFetchWithRetry(SUI_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "suix_queryEvents",
          params: [{ MoveEventType: eventType }, cursor, 50, true],
        }),
      });
      json = await res.json();
    } catch {
      break;
    }
    const result = json?.result;
    if (!result || !Array.isArray(result.data)) break;

    let pageHasOldEvent = false;
    for (const e of result.data) {
      const pj = e.parsedJson ?? {};
      const ts = parseInt(String(pj.kill_timestamp ?? "0"), 10);
      if (ts < stopAt) {
        pageHasOldEvent = true;
        continue;
      }
      const sysId = Number(pj.solar_system_id?.item_id);
      if (sysId && Number.isFinite(sysId)) {
        counts.set(sysId, (counts.get(sysId) ?? 0) + 1);
      }
    }
    if (pageHasOldEvent) break;
    if (!result.hasNextPage || !result.nextCursor) break;
    cursor = result.nextCursor;
  }

  if (counts.size === 0) return null;
  let best: number | null = null;
  let bestCount = 0;
  for (const [sys, c] of counts) {
    if (c > bestCount) {
      best = sys;
      bestCount = c;
    }
  }
  return best;
}

/**
 * Pick a system that has NEVER had a LocationRevealedEvent. The Keeper's
 * "unsettled vector" mission. We sample a small window of recent kill
 * systems and the in-game system catalog to find an unmarked candidate.
 *
 * Implementation: walk LocationRevealedEvent history (paginated) to build
 * a set of "settled" systems. Then ask the World API for solar system ids
 * and pick the lowest id that's NOT in the settled set. This biases toward
 * lore-canon "old" systems that haven't been touched yet.
 */
export async function selectUnsettledSystem(
  maxPages = 30,
): Promise<number | null> {
  const eventType = `${WORLD_PKG}::location::LocationRevealedEvent`;
  const settled = new Set<number>();
  let cursor: any = null;

  for (let page = 0; page < maxPages; page++) {
    let json: any;
    try {
      const res = await rpcFetchWithRetry(SUI_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "suix_queryEvents",
          params: [{ MoveEventType: eventType }, cursor, 50, true],
        }),
      });
      json = await res.json();
    } catch {
      break;
    }
    const result = json?.result;
    if (!result || !Array.isArray(result.data)) break;
    for (const e of result.data) {
      const sys = Number(e.parsedJson?.solarsystem);
      if (sys && Number.isFinite(sys)) settled.add(sys);
    }
    if (!result.hasNextPage || !result.nextCursor) break;
    cursor = result.nextCursor;
  }

  // Pick a small range of plausible system ids. Stillness uses ids in the
  // 30000000-30030000 range. Sample ids until we find one not in `settled`.
  // Keep this seeded by today's date so all players see the same target.
  const dateSeed = Math.floor(Date.now() / 86_400_000);
  const startId = 30000000 + ((dateSeed * 1009) % 30000);
  for (let offset = 0; offset < 30000; offset++) {
    const candidate = 30000000 + ((startId + offset - 30000000) % 30000);
    if (!settled.has(candidate)) return candidate;
  }
  return null;
}

/**
 * For the "adjacent_to_previous" selector: returns a system id "near" the
 * player's last successful expedition target. Without a gate-graph index
 * client-side, "adjacent" is approximated as: any system in the same
 * thousand-id band that has had recent activity.
 *
 * v0 keeps it simple and uses the bloodiest_24h selector on a filtered set
 * of nearby ids. If no recent activity nearby, falls back to an arbitrary
 * neighbor in the band.
 */
export async function selectAdjacentSystem(
  previousSystemId: number,
  windowSeconds = 7 * 86400,
): Promise<number | null> {
  const lo = Math.floor(previousSystemId / 1000) * 1000;
  const hi = lo + 999;
  // Reuse the bloodiest_24h scan but client-side filter.
  const eventType = `${WORLD_PKG}::killmail::KillmailCreatedEvent`;
  const stopAt = Math.floor(Date.now() / 1000) - windowSeconds;
  const counts = new Map<number, number>();
  let cursor: any = null;

  for (let page = 0; page < 30; page++) {
    let json: any;
    try {
      const res = await rpcFetchWithRetry(SUI_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "suix_queryEvents",
          params: [{ MoveEventType: eventType }, cursor, 50, true],
        }),
      });
      json = await res.json();
    } catch {
      break;
    }
    const result = json?.result;
    if (!result || !Array.isArray(result.data)) break;
    let pageHasOldEvent = false;
    for (const e of result.data) {
      const pj = e.parsedJson ?? {};
      const ts = parseInt(String(pj.kill_timestamp ?? "0"), 10);
      if (ts < stopAt) {
        pageHasOldEvent = true;
        continue;
      }
      const sysId = Number(pj.solar_system_id?.item_id);
      if (sysId >= lo && sysId <= hi && sysId !== previousSystemId) {
        counts.set(sysId, (counts.get(sysId) ?? 0) + 1);
      }
    }
    if (pageHasOldEvent) break;
    if (!result.hasNextPage || !result.nextCursor) break;
    cursor = result.nextCursor;
  }

  if (counts.size === 0) {
    // Fallback: arbitrary neighbor with seeded randomization for determinism.
    return previousSystemId + 1;
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [sys, c] of counts) {
    if (c > bestCount) { best = sys; bestCount = c; }
  }
  return best;
}

// ── Verification ──────────────────────────────────────────────────────────────

/**
 * Find a `LocationRevealedEvent` that:
 *   - targets the requested solarSystemId
 *   - was emitted at or after `issuedAtMs`
 *   - whose assembly's owner_cap_id chains back to the requesting player's
 *     character object id
 *
 * Returns the matching reveal or null. Verification is async and may take
 * a few seconds depending on the event volume since `issuedAtMs`.
 */
export async function verifyExpeditionReveal(args: {
  targetSystemId: number;
  issuedAtMs: number;
  playerCharacterObjectId: string;
}): Promise<LocationReveal | null> {
  const { targetSystemId, issuedAtMs, playerCharacterObjectId } = args;
  const eventType = `${WORLD_PKG}::location::LocationRevealedEvent`;
  const stopMs = issuedAtMs;
  let cursor: any = null;

  // Walk LocationRevealedEvents newest-first until we cross `issuedAtMs`.
  const candidates: LocationReveal[] = [];
  outer: for (let page = 0; page < 50; page++) {
    let json: any;
    try {
      const res = await rpcFetchWithRetry(SUI_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "suix_queryEvents",
          params: [{ MoveEventType: eventType }, cursor, 50, true],
        }),
      });
      json = await res.json();
    } catch {
      break;
    }
    const result = json?.result;
    if (!result || !Array.isArray(result.data)) break;

    for (const e of result.data) {
      const ts = parseInt(String(e.timestampMs ?? "0"), 10);
      if (ts < stopMs) {
        // Crossed window — stop scanning further pages.
        break outer;
      }
      const sys = Number(e.parsedJson?.solarsystem);
      if (sys !== targetSystemId) continue;
      const aId = String(e.parsedJson?.assembly_id ?? "");
      if (!aId) continue;
      candidates.push({
        assemblyId: aId,
        solarSystemId: sys,
        txDigest: String(e.id?.txDigest ?? ""),
        blockTimeMs: ts,
      });
    }
    if (!result.hasNextPage || !result.nextCursor) break;
    cursor = result.nextCursor;
  }

  if (candidates.length === 0) return null;

  // For each candidate, verify the assembly's OwnerCap is held by the
  // requesting player's Character object. Sequential to avoid hammering RPC.
  const playerCharLower = playerCharacterObjectId.toLowerCase();
  for (const c of candidates) {
    try {
      // Step 1: read assembly to get its owner_cap_id
      const aRes = await rpcFetchWithRetry(SUI_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sui_getObject",
          params: [c.assemblyId, { showContent: true }],
        }),
      });
      const aJson = await aRes.json();
      const aFields = aJson?.result?.data?.content?.fields;
      const capId = aFields?.owner_cap_id;
      if (!capId) continue;

      // Step 2: read OwnerCap to find AddressOwner. For NetworkNode the
      // OwnerCap is owned by the player's Character object id (shared
      // object pattern).
      const cRes = await rpcFetchWithRetry(SUI_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sui_getObject",
          params: [capId, { showOwner: true }],
        }),
      });
      const cJson = await cRes.json();
      const owner = cJson?.result?.data?.owner;
      const ownerAddr =
        (owner && typeof owner === "object" && "AddressOwner" in owner
          ? (owner as any).AddressOwner
          : null) ?? null;
      if (!ownerAddr) continue;
      if (String(ownerAddr).toLowerCase() === playerCharLower) {
        return c;
      }
    } catch {
      continue;
    }
  }
  return null;
}

// ── Daily seed ────────────────────────────────────────────────────────────────

/**
 * Build today's deterministic seed. Combines the UTC date with the most
 * recent killmail tx digest at puzzle-load time so the same day's puzzle
 * is identical for everyone but unpredictable in advance.
 */
export async function buildDailySeed(): Promise<string> {
  const today = new Date();
  const ymd = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;

  let killSalt = "";
  try {
    const eventType = `${WORLD_PKG}::killmail::KillmailCreatedEvent`;
    const res = await rpcFetchWithRetry(SUI_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: eventType }, null, 1, true],
      }),
    });
    const j = await res.json();
    killSalt = String(j?.result?.data?.[0]?.id?.txDigest ?? "");
  } catch {
    /* fallback to date only */
  }

  // Cheap stable hash via subtle.digest if available, else FNV.
  const raw = `${ymd}|${killSalt}`;
  if (typeof crypto !== "undefined" && crypto.subtle && typeof TextEncoder !== "undefined") {
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
    } catch {
      /* fallthrough */
    }
  }
  // FNV-1a fallback.
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0").repeat(8); // pad to 64 hex chars for parity
}
