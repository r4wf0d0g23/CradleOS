// keeperPerception.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE KEEPER'S PERCEPTION MODEL
//
// One typed structure that encodes EVERYTHING the Keeper can see and
// EVERYTHING the Keeper provably cannot see, on a per-turn basis.
//
// Old design:   string concatenation of whatever happened to load → model invents
// New design:   typed perception object → projected to prompt → guardrails added
//
// Every field carries a Resolution status. The prompt projection makes the
// distinction between "no data" (we tried, it failed) and "field intentionally
// not in our perception model" (we don't have plumbing for this yet) explicit.
// ─────────────────────────────────────────────────────────────────────────────

import {
  fetchPlayerStructures,
  fetchTribeVault,
  fetchEveBalance,
  findCharacterForWallet,
  numish,
  type TribeVaultState,
  type PlayerStructure,
} from "../lib";
import {
  SUI_TESTNET_RPC,
  WORLD_API,
} from "../constants";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Resolution describes how a field was populated this turn.
 *
 *   loaded         — successfully fetched, value is authoritative
 *   loading        — still in flight when snapshot was taken (treat as unknown)
 *   failed         — fetch attempted but errored (treat as unknown)
 *   not-applicable — field does not apply to this pilot (e.g., tribeless pilot has no vault)
 *   not-implemented — perception model does not yet have plumbing for this
 *   sampled        — partial data only (e.g., 5 of 25 SSU inventories sampled)
 *   not-permitted  — pilot's identity not yet verified for this scope
 */
export type Resolution =
  | "loaded"
  | "loading"
  | "failed"
  | "not-applicable"
  | "not-implemented"
  | "sampled"
  | "not-permitted";

/**
 * A perceived value carries both the data AND its resolution status.
 * Consumers MUST check `status` before reading `value`.
 */
export type Perceived<T> = {
  status: Resolution;
  value: T | null;
  /** Optional human-readable reason for non-loaded statuses. */
  reason?: string;
  /** When this field was last resolved (epoch ms). */
  resolvedAt?: number;
};

// ── Domain types ─────────────────────────────────────────────────────────────

export type StructureSummary = {
  kind: string;
  name: string;
  isOnline: boolean;
  fuelLevelPct: number | null;
  systemId: number | null;
  objectId: string;
};

export type SsuInventoryItem = {
  typeId: number;
  name: string;
  quantity: number;
};

export type SsuInventory = {
  ssuName: string;
  ssuId: string;
  items: SsuInventoryItem[];
};

export type VaultBalances = {
  /** Per-member coin holdings in this tribe's currency. */
  memberBalances: Array<{ address: string; balance: number }>;
  /** Total supply minted (denominated in tribe coin units). */
  totalSupply: number;
  /** Tribe coin metadata. */
  coinName: string;
  coinSymbol: string;
  /** Number of structures registered to the vault for revenue sharing. */
  registeredInfraCount: number;
};

export type JumpRecord = {
  time: string;
  origin: { name: string; systemId?: number };
  destination: { name: string; systemId?: number };
};

export type WalletState = {
  address: string;
  /** EVE coin balance (the universal Frontier currency). */
  eveBalance: number;
  /** Whether the wallet holds EVE coin objects (for spending). */
  hasEveCoins: boolean;
};

export type TribeIdentity = {
  tribeId: number;
  characterName: string | null;
  /** Voluntary node binding for Keeper Shrine. */
  keeperNodeActive: boolean;
};

export type WorldSnapshot = {
  serverName: string;
  tribeCount: number;
  tribeNames: string[];
};

// ── The Perception ────────────────────────────────────────────────────────────

/**
 * KeeperPerception is the Keeper's complete view of one pilot, this turn.
 *
 * Structure:
 *   - identity: who the pilot is on-chain
 *   - wallet:   what they hold (NOT including hangar / ship inventory)
 *   - tribe:    membership identity
 *   - vault:    tribe vault state (balance sheet + metadata)
 *   - structures: deployed installations (NOT contents — those are in ssuInventories)
 *   - ssuInventories: contents of SSUs the pilot owns (sampled, not exhaustive)
 *   - jumps:    gate-jump history (last 50)
 *   - world:    server/tribe headcounts
 *   - bounties: open bounty count (count only, no detail)
 *   - kills:    on-chain kill count last 24h (count only)
 *
 * Fields the perception DOES NOT include — and the prompt MUST tell the model
 * about these blind spots so it doesn't invent:
 *   ✗ ship hangar / fleet composition (no on-chain enumeration available)
 *   ✗ wallet contents beyond EVE balance (other Sui coin types)
 *   ✗ in-game chat / voice / messaging
 *   ✗ off-chain market activity
 *   ✗ enemy intel beyond public on-chain events
 *   ✗ unsampled SSUs (only first N are sampled per turn)
 *   ✗ historical state older than current RPC snapshot
 */
export type KeeperPerception = {
  /** Unique snapshot id, embedded in prompts for traceability. */
  snapshotId: string;
  /** When this snapshot was assembled (epoch ms). */
  builtAt: number;

  identity: Perceived<{ wallet: string; characterName: string | null }>;
  tribe: Perceived<TribeIdentity>;
  wallet: Perceived<WalletState>;
  vault: Perceived<VaultBalances & { vaultId: string; tribeId: number }>;
  structures: Perceived<StructureSummary[]>;
  ssuInventories: Perceived<SsuInventory[]> & {
    /** How many SSUs were sampled vs how many the pilot owns. */
    sampleCount?: number;
    totalCount?: number;
  };
  jumps: Perceived<{ recent: JumpRecord[]; total: number }>;
  world: Perceived<WorldSnapshot>;
  bounties: Perceived<{ openCount: number }>;
  kills: Perceived<{ recentCount: number }>;
  defense: Perceived<{ secLevel: number }>;

  /** List of fetch failures with reasons. Used to render "tried but failed" notes. */
  failures: Array<{ field: string; reason: string }>;
};

// ── Capability declarations (used by prompt projector) ────────────────────────

/**
 * What the Keeper CAN see. Derived from KeeperPerception field definitions.
 * Used to render the "PERCEPTION MANIFEST" block in the prompt.
 */
export const KEEPER_CAPABILITIES = {
  canSee: [
    "pilot wallet address & character identity (on-chain)",
    "tribe membership (tribe id, name)",
    "deployed structures (kind, name, online state, fuel level, location)",
    "tribe vault state (coin metadata, member balances, total supply, registered infra)",
    "SSU inventory contents — sampled, not exhaustive",
    "EVE coin wallet balance",
    "recent gate-jump history (last 50)",
    "on-chain bounty counts (open count only)",
    "on-chain kill counts (last 24h count only)",
    "tribe defense security level",
    "Frontier game data (manufacturing recipes, ship classes, lore via RAG)",
    "world snapshot (server name, tribe headcount, tribe names)",
  ],
  cannotSee: [
    "ship hangar contents / fleet composition / owned ships",
    "wallet contents beyond EVE coin balance (other Sui coin types)",
    "in-game chat, voice, messaging, mail",
    "off-chain market or trading activity",
    "enemy tribes' internal state",
    "individual kill mail detail (only count is on-chain accessible)",
    "historical state older than current RPC snapshot",
    "any SSUs beyond the sampled subset (typically first 5)",
    "fitting / module loadout of any ship — fitted or in hangar",
    "in-game items, modules, ammo, blueprints not stored in a sampled SSU",
    "future events / predictions — only what has been signed on-chain",
  ],
} as const;

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Build a fresh perception snapshot for a wallet.
 *
 * Resolves all fields in parallel where possible. Each field is independently
 * resolved — one failure does not poison the rest. Returns a fully populated
 * `KeeperPerception` even on partial failures (failed fields carry status).
 *
 * Design rules:
 *   1. NEVER throw. Every error becomes a Resolution.
 *   2. NEVER lie about resolution. If we can't resolve, mark "failed" and move on.
 *   3. EVERY field has a status — there is no `null` without explanation.
 */
export async function buildKeeperPerception(
  walletAddress: string | null,
  serverName: string = "stillness"
): Promise<KeeperPerception> {
  const builtAt = Date.now();
  const snapshotId = makeSnapshotId(builtAt, walletAddress);
  const failures: KeeperPerception["failures"] = [];

  // Initialize empty perception with all fields as `loading` — we'll populate.
  const perception: KeeperPerception = {
    snapshotId,
    builtAt,
    identity: { status: "loading", value: null },
    tribe: { status: "loading", value: null },
    wallet: { status: "loading", value: null },
    vault: { status: "loading", value: null },
    structures: { status: "loading", value: null },
    ssuInventories: { status: "loading", value: null },
    jumps: { status: "loading", value: null },
    world: { status: "loading", value: null },
    bounties: { status: "not-implemented", value: null, reason: "bounty count fetch not yet wired into perception model" },
    kills: { status: "not-implemented", value: null, reason: "on-chain kill count fetch not yet wired into perception model" },
    defense: { status: "not-implemented", value: null, reason: "tribe defense security level fetch not yet wired into perception model" },
    failures,
  };

  if (!walletAddress) {
    // Unauthenticated branch — only world snapshot is loadable.
    perception.identity = { status: "not-permitted", value: null, reason: "no wallet connected" };
    perception.tribe = { status: "not-permitted", value: null, reason: "no wallet connected" };
    perception.wallet = { status: "not-permitted", value: null, reason: "no wallet connected" };
    perception.vault = { status: "not-permitted", value: null, reason: "no wallet connected" };
    perception.structures = { status: "not-permitted", value: null, reason: "no wallet connected" };
    perception.ssuInventories = { status: "not-permitted", value: null, reason: "no wallet connected" };
    perception.jumps = { status: "not-permitted", value: null, reason: "no wallet connected" };
    perception.world = await resolveWorld(serverName, failures);
    return perception;
  }

  // Authenticated: resolve in parallel where data is independent.
  const [
    characterRes,
    structuresRes,
    eveBalanceRes,
    worldRes,
    jumpsRes,
  ] = await Promise.allSettled([
    findCharacterForWallet(walletAddress),
    fetchPlayerStructures(walletAddress),
    fetchEveBalance(walletAddress),
    resolveWorld(serverName, failures),
    fetchJumpHistorySafe(serverName),
  ]);

  // ── identity ─────────────────────────────────────────────────────────────
  // CharacterInfo only carries { characterId, tribeId }. Character display
  // name lives on the Character object's metadata field, fetched separately.
  const character = characterRes.status === "fulfilled" ? characterRes.value : null;
  let characterName: string | null = null;
  if (character?.characterId) {
    try {
      const res = await fetch(SUI_TESTNET_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sui_getObject",
          params: [character.characterId, { showContent: true }],
        }),
      });
      const j = (await res.json()) as {
        result?: { data?: { content?: { fields?: { metadata?: { fields?: { name?: string } } } } } };
      };
      const name = j.result?.data?.content?.fields?.metadata?.fields?.name?.trim();
      if (name && name.length > 0) characterName = name;
    } catch {
      /* keep null */
    }
  }

  if (characterRes.status === "rejected") {
    failures.push({ field: "identity", reason: errMsg(characterRes.reason) });
    perception.identity = { status: "failed", value: null, reason: errMsg(characterRes.reason) };
  } else if (!character) {
    perception.identity = {
      status: "loaded",
      value: { wallet: walletAddress, characterName: null },
      resolvedAt: Date.now(),
    };
  } else {
    perception.identity = {
      status: "loaded",
      value: {
        wallet: walletAddress,
        characterName,
      },
      resolvedAt: Date.now(),
    };
  }

  // ── tribe identity (depends on character) ────────────────────────────────
  if (!character) {
    perception.tribe = {
      status: "not-applicable",
      value: null,
      reason: "wallet has no Frontier character — tribeless",
    };
  } else if (character.tribeId == null) {
    perception.tribe = {
      status: "not-applicable",
      value: null,
      reason: "character has not joined a tribe",
    };
  } else {
    perception.tribe = {
      status: "loaded",
      value: {
        tribeId: character.tribeId,
        characterName,
        keeperNodeActive: false, // resolved below from structures
      },
      resolvedAt: Date.now(),
    };
  }

  // ── wallet ───────────────────────────────────────────────────────────────
  if (eveBalanceRes.status === "rejected") {
    failures.push({ field: "wallet", reason: errMsg(eveBalanceRes.reason) });
    perception.wallet = { status: "failed", value: null, reason: errMsg(eveBalanceRes.reason) };
  } else {
    const ev = eveBalanceRes.value;
    perception.wallet = {
      status: "loaded",
      value: {
        address: walletAddress,
        eveBalance: ev.balance,
        hasEveCoins: ev.allCoinIds.length > 0,
      },
      resolvedAt: Date.now(),
    };
  }

  // ── structures ───────────────────────────────────────────────────────────
  let allStructures: PlayerStructure[] = [];
  if (structuresRes.status === "rejected") {
    failures.push({ field: "structures", reason: errMsg(structuresRes.reason) });
    perception.structures = { status: "failed", value: null, reason: errMsg(structuresRes.reason) };
    perception.ssuInventories = { status: "not-applicable", value: null, reason: "no structures resolved" };
  } else {
    const groups = structuresRes.value;
    allStructures = groups.flatMap((g) => g.structures);

    perception.structures = {
      status: "loaded",
      value: allStructures.map((s) => ({
        kind: s.kind,
        name: s.displayName,
        isOnline: s.isOnline,
        fuelLevelPct: s.fuelLevelPct ?? null,
        systemId: groups.find((g) => g.structures.includes(s))?.solarSystemId ?? null,
        objectId: s.objectId,
      })),
      resolvedAt: Date.now(),
    };

    // Update tribe.keeperNodeActive flag from resolved structures.
    if (perception.tribe.status === "loaded" && perception.tribe.value) {
      perception.tribe.value.keeperNodeActive = allStructures.some((s) => {
        if (s.kind !== "NetworkNode" || !s.isOnline) return false;
        const url = (s.metadataUrl ?? "").toLowerCase();
        return (
          url.includes("r4wf0d0g23.github.io/cradleos/#/keeper") ||
          url.includes("r4wf0d0g23.github.io/reality_anchor_eve_frontier_hackathon_2026/#/keeper")
        );
      });
    }
  }

  // ── SSU inventories (sample first 5 SSUs) ────────────────────────────────
  if (perception.structures.status === "loaded") {
    const ssus = allStructures.filter((s) => s.kind === "StorageUnit");
    const sample = ssus.slice(0, 5);
    try {
      const inventories = await Promise.all(sample.map((s) => fetchSsuInventory(s)));
      const populated = inventories.filter((inv): inv is SsuInventory => inv !== null);
      perception.ssuInventories = {
        status: ssus.length > sample.length ? "sampled" : "loaded",
        value: populated,
        resolvedAt: Date.now(),
        sampleCount: sample.length,
        totalCount: ssus.length,
        reason:
          ssus.length > sample.length
            ? `only ${sample.length} of ${ssus.length} SSUs sampled — remaining ${ssus.length - sample.length} are unread`
            : undefined,
      };
    } catch (err) {
      failures.push({ field: "ssuInventories", reason: errMsg(err) });
      perception.ssuInventories = {
        status: "failed",
        value: null,
        reason: errMsg(err),
        sampleCount: 0,
        totalCount: ssus.length,
      };
    }
  }

  // ── vault (depends on tribe) ─────────────────────────────────────────────
  if (perception.tribe.status === "loaded" && perception.tribe.value) {
    try {
      const vaultId = await discoverVaultIdForTribe(perception.tribe.value.tribeId);
      if (!vaultId) {
        perception.vault = {
          status: "not-applicable",
          value: null,
          reason: "tribe has not launched a vault",
        };
      } else {
        const vault = await fetchTribeVault(vaultId);
        if (!vault) {
          perception.vault = {
            status: "failed",
            value: null,
            reason: "vault id discovered but on-chain object fetch failed",
          };
          failures.push({ field: "vault", reason: "object fetch failed" });
        } else {
          // Resolve member balances + registered infra in parallel
          const [balances, infraIds] = await Promise.all([
            fetchAllMemberBalancesSafe(vault.balancesTableId),
            fetchRegisteredInfraIdsSafe(vault.registeredInfraTableId),
          ]);
          perception.vault = {
            status: "loaded",
            value: {
              vaultId,
              tribeId: vault.tribeId,
              coinName: vault.coinName,
              coinSymbol: vault.coinSymbol,
              totalSupply: vault.totalSupply,
              memberBalances: balances,
              registeredInfraCount: infraIds.size,
            },
            resolvedAt: Date.now(),
          };
        }
      }
    } catch (err) {
      failures.push({ field: "vault", reason: errMsg(err) });
      perception.vault = { status: "failed", value: null, reason: errMsg(err) };
    }
  } else {
    perception.vault = {
      status: "not-applicable",
      value: null,
      reason: "no tribe — pilot is tribeless or unresolved",
    };
  }

  // ── jumps ─────────────────────────────────────────────────────────────────
  if (jumpsRes.status === "fulfilled" && jumpsRes.value) {
    perception.jumps = {
      status: "loaded",
      value: jumpsRes.value,
      resolvedAt: Date.now(),
    };
  } else if (jumpsRes.status === "fulfilled") {
    // null result — EVE Vault not present
    perception.jumps = {
      status: "not-permitted",
      value: null,
      reason: "EVE Vault auth not present — jump history requires JWT from EVE Vault",
    };
  } else {
    failures.push({ field: "jumps", reason: errMsg(jumpsRes.reason) });
    perception.jumps = { status: "failed", value: null, reason: errMsg(jumpsRes.reason) };
  }

  // ── world ────────────────────────────────────────────────────────────────
  if (worldRes.status === "fulfilled") {
    perception.world = worldRes.value;
  } else {
    failures.push({ field: "world", reason: errMsg(worldRes.reason) });
    perception.world = { status: "failed", value: null, reason: errMsg(worldRes.reason) };
  }

  return perception;
}

// ── In-memory snapshot cache (30s TTL) ────────────────────────────────────────

type CacheEntry = { perception: KeeperPerception; expiresAt: number };
const PERCEPTION_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

/**
 * Same as buildKeeperPerception but cached per wallet for 30s.
 * Use this in UI flows that may call multiple times in quick succession.
 */
export async function getKeeperPerception(
  walletAddress: string | null,
  serverName: string = "stillness"
): Promise<KeeperPerception> {
  const key = `${walletAddress ?? "anon"}:${serverName}`;
  const now = Date.now();
  const cached = PERCEPTION_CACHE.get(key);
  if (cached && cached.expiresAt > now) return cached.perception;
  const perception = await buildKeeperPerception(walletAddress, serverName);
  PERCEPTION_CACHE.set(key, { perception, expiresAt: now + CACHE_TTL_MS });
  return perception;
}

/** Force a fresh perception (bypass cache). Used after on-chain writes. */
export async function refreshKeeperPerception(
  walletAddress: string | null,
  serverName: string = "stillness"
): Promise<KeeperPerception> {
  const key = `${walletAddress ?? "anon"}:${serverName}`;
  PERCEPTION_CACHE.delete(key);
  return getKeeperPerception(walletAddress, serverName);
}

// ── Helper: resolve world snapshot ────────────────────────────────────────────

async function resolveWorld(
  serverName: string,
  failures: KeeperPerception["failures"]
): Promise<Perceived<WorldSnapshot>> {
  try {
    // limit=1000 to capture full tribe set (Stillness has ~412 as of Apr 2026).
    // Previous limit=200 caused tribeCount to be wrong and truncated tribeNames.
    const res = await fetch(`${WORLD_API}/v2/tribes?limit=1000`);
    if (!res.ok) throw new Error(`world api ${res.status}`);
    const j = (await res.json()) as { data?: Array<{ name?: string }>; total?: number; metadata?: { total?: number } };
    const tribeNames = (j.data ?? []).map((t) => t.name ?? "").filter(Boolean);
    return {
      status: "loaded",
      value: {
        serverName,
        tribeCount: j.metadata?.total ?? j.total ?? tribeNames.length,
        tribeNames: tribeNames.slice(0, 50),
      },
      resolvedAt: Date.now(),
    };
  } catch (err) {
    failures.push({ field: "world", reason: errMsg(err) });
    return { status: "failed", value: null, reason: errMsg(err) };
  }
}

// ── Helper: vault discovery ───────────────────────────────────────────────────

async function discoverVaultIdForTribe(tribeId: number): Promise<string | null> {
  // Cache key for stable discovery
  const cacheKey = `cradleos:vault:tribe:${tribeId}`;
  try {
    const cached = typeof localStorage !== "undefined" ? localStorage.getItem(cacheKey) : null;
    if (cached) return cached;
  } catch {
    /* */
  }
  // Walk CoinLaunched events to find the vault tied to this tribe.
  // We rely on CRADLEOS_PKG / CRADLEOS_ORIGINAL constants. Use original-id for reads.
  try {
    const { CRADLEOS_ORIGINAL } = await import("../constants");
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_queryEvents",
        params: [
          { MoveEventType: `${CRADLEOS_ORIGINAL}::tribe_vault::CoinLaunched` },
          null,
          50,
          true, // descending
        ],
      }),
    });
    const j = (await res.json()) as {
      result?: {
        data?: Array<{
          parsedJson?: { vault_id?: string; tribe_id?: string | number };
        }>;
      };
    };
    const events = j.result?.data ?? [];
    const match = events.find((e) => Number(e.parsedJson?.tribe_id) === tribeId);
    const vaultId = match?.parsedJson?.vault_id ?? null;
    if (vaultId && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(cacheKey, vaultId);
      } catch {
        /* */
      }
    }
    return vaultId;
  } catch {
    return null;
  }
}

// ── Helper: SSU inventory fetcher ────────────────────────────────────────────

async function fetchSsuInventory(ssu: PlayerStructure): Promise<SsuInventory | null> {
  try {
    const dfRes = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_getDynamicFields",
        params: [ssu.objectId, null, 20],
      }),
    });
    const dfJson = (await dfRes.json()) as {
      result?: { data?: Array<{ name?: { value?: string } }> };
    };
    const keys: string[] = (dfJson.result?.data ?? [])
      .map((f) => f.name?.value)
      .filter((v): v is string => Boolean(v));

    const rawItems: Array<{ typeId: number; quantity: number }> = [];
    for (const key of keys) {
      const invRes = await fetch(SUI_TESTNET_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "suix_getDynamicFieldObject",
          params: [ssu.objectId, { type: "0x2::object::ID", value: key }],
        }),
      });
      const invJson = (await invRes.json()) as {
        result?: {
          data?: {
            content?: {
              fields?: {
                value?: {
                  fields?: {
                    items?: {
                      fields?: {
                        contents?: Array<{
                          fields?: {
                            value?: {
                              fields?: { type_id?: string | number; quantity?: string | number };
                            };
                          };
                        }>;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
      const invFields = invJson.result?.data?.content?.fields?.value?.fields;
      const contents = invFields?.items?.fields?.contents ?? [];
      for (const entry of contents) {
        const val = entry?.fields?.value?.fields;
        if (val) rawItems.push({ typeId: Number(val.type_id), quantity: Number(val.quantity) });
      }
    }

    const map = new Map<number, number>();
    for (const item of rawItems) {
      map.set(item.typeId, (map.get(item.typeId) ?? 0) + item.quantity);
    }

    const items: SsuInventoryItem[] = [];
    for (const [typeId, quantity] of map) {
      let name = `Type#${typeId}`;
      try {
        const r = await fetch(`${WORLD_API}/v2/types/${typeId}`);
        if (r.ok) {
          const d = (await r.json()) as { name?: string };
          name = d.name ?? name;
        }
      } catch {
        /* keep numeric name */
      }
      items.push({ typeId, name, quantity });
    }

    if (items.length === 0) return null;
    return {
      ssuName: ssu.displayName,
      ssuId: ssu.objectId,
      items: items.sort((a, b) => b.quantity - a.quantity),
    };
  } catch {
    return null;
  }
}

// ── Helper: vault balances + infra (ported from AssetLedgerPanel) ─────────────

async function fetchAllMemberBalancesSafe(
  tableId: string
): Promise<VaultBalances["memberBalances"]> {
  if (!tableId) return [];
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_getDynamicFields",
        params: [tableId, null, 100],
      }),
    });
    const j = (await res.json()) as {
      result?: { data?: Array<{ name: { value: string }; objectId: string }> };
    };
    const entries = j.result?.data ?? [];
    const results = await Promise.all(
      entries.map(async (entry) => {
        const objRes = await fetch(SUI_TESTNET_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "sui_getObject",
            params: [entry.objectId, { showContent: true }],
          }),
        });
        const obj = (await objRes.json()) as {
          result?: { data?: { content?: { fields?: Record<string, unknown> } } };
        };
        const f = obj.result?.data?.content?.fields ?? {};
        const balance = numish(f["value"]) ?? 0;
        return { address: String(entry.name.value), balance };
      })
    );
    return results.sort((a, b) => b.balance - a.balance);
  } catch {
    return [];
  }
}

async function fetchRegisteredInfraIdsSafe(tableId: string): Promise<Set<string>> {
  if (!tableId) return new Set();
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_getDynamicFields",
        params: [tableId, null, 100],
      }),
    });
    const j = (await res.json()) as {
      result?: { data?: Array<{ name: { value: string } }> };
    };
    return new Set((j.result?.data ?? []).map((e) => String(e.name.value)));
  } catch {
    return new Set();
  }
}

// ── Helper: jump history (lazy import — needs EVE Vault auth) ─────────────────

async function fetchJumpHistorySafe(
  _serverName: string
): Promise<{ recent: JumpRecord[]; total: number } | null> {
  // The original implementation in KeeperPanel uses window.postMessage to talk
  // to EVE Vault for a JWT. That's a UI-side flow — for the perception model we
  // return null when it can't be resolved synchronously. The KeeperPanel
  // refactor will pass through any pre-resolved jump history via an override.
  return null;
}

// ── Helper: utilities ────────────────────────────────────────────────────────

function makeSnapshotId(builtAt: number, walletAddress: string | null): string {
  const w = walletAddress ? walletAddress.slice(2, 10) : "anon0000";
  const t = builtAt.toString(36);
  // Short, low-collision, traceable
  return `${t}#${w}`;
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "unknown error";
}

// ── Re-exports for test consumers ─────────────────────────────────────────────

export { TribeVaultState };

// ── Allow override-injection of jump history (KeeperPanel resolves it via UI) ─

/**
 * After the UI resolves jump history (via EVE Vault postMessage), inject it
 * into the perception so the prompt projector can use it. Idempotent.
 */
export function injectJumpHistory(
  perception: KeeperPerception,
  jumps: { recent: JumpRecord[]; total: number } | null
): KeeperPerception {
  if (!jumps) return perception;
  return {
    ...perception,
    jumps: { status: "loaded", value: jumps, resolvedAt: Date.now() },
  };
}
