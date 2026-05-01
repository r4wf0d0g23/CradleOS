/**
 * cradleos::ssu_access — shared SSU access helpers + tx builders
 * ───────────────────────────────────────────────────────────────────────────
 * The CCP `world::storage_unit` module ships only two deposit paths:
 *   - deposit_to_owned (owner-only, single shared list)
 *   - deposit_to_open_inventory (per-accessor partition; capacity multiplies)
 *
 * Neither produces truly shared communal storage that tribes expect
 * (one inventory, owner + tribemates all read/write the same list, capacity
 * actually shared not multiplied). CradleOS published `cradleos::ssu_access`
 * (2026-04-26) to provide that primitive on top of CCP's contracts:
 *   - shared_deposit(ssu, policy, char, item, clock, ctx)
 *   - shared_withdraw_to_character(ssu, policy, char, type_id, qty, clock, ctx)
 *
 * Access is gated by an SsuPolicy attached to the SSU, owned by the SSU
 * owner. Modes:
 *   - none           policy not initialized
 *   - tribe_alliance any character whose tribe_id is in tribeIds
 *   - allowlist      explicit per-character allow with optional expiry
 *   - hybrid         tribe ∪ allow, minus deny
 *   - public         anyone
 *
 * Discovery: SsuPolicyRegistry shared object holds a `Table<ID, ID>` mapping
 * ssu_id → policy_id. Resolve once per SSU; cache in caller.
 *
 * Owner self-deposits/withdrawals continue to use the CCP owner-only path
 * (deposit_by_owner / withdraw_by_owner). The shared path is for non-owners
 * AND for owners who want their items to land in the shared inventory rather
 * than the private owned partition.
 */

import { Transaction } from "@mysten/sui/transactions";
import {
  SSU_ACCESS_PKG,
  SSU_POLICY_REGISTRY,
  SSU_ACCESS_AVAILABLE,
  SUI_TESTNET_RPC,
  WORLD_PKG,
} from "../constants";

// ──────────────────────────────────────────────────────────────────────────
// Move mode constants (mirror cradleos::ssu_access)
// ──────────────────────────────────────────────────────────────────────────

export const MODE_NONE = 0;
export const MODE_TRIBE_ALLIANCE = 1;
export const MODE_ALLOWLIST = 2;
export const MODE_HYBRID = 3;
export const MODE_PUBLIC = 4;

// ──────────────────────────────────────────────────────────────────────────
// Types — mirror Move
// ──────────────────────────────────────────────────────────────────────────

export type AllowEntry = {
  characterId: string;
  /** Unix ms; 0 means no expiry */
  expiresAt: number;
  canDeposit: boolean;
  canWithdraw: boolean;
};

export type AccessMode =
  | { kind: "none" }
  | { kind: "tribe_alliance"; tribeIds: number[] }
  | { kind: "allowlist"; entries: AllowEntry[] }
  | {
      kind: "hybrid";
      tribeIds: number[];
      deny: string[];
      allow: AllowEntry[];
    }
  | { kind: "public" };

export type LoadedPolicy = {
  /** null when no policy has been initialized for this SSU. */
  policyId: string | null;
  mode: AccessMode;
};

// ──────────────────────────────────────────────────────────────────────────
// Decoders
// ──────────────────────────────────────────────────────────────────────────

export function decodeAllowEntry(raw: any): AllowEntry {
  const f = raw.fields ?? raw;
  return {
    characterId:
      typeof f.character_id === "string"
        ? f.character_id
        : f.character_id?.fields?.id ?? f.character_id?.id ?? "",
    expiresAt: Number(f.expires_at ?? 0),
    canDeposit: Boolean(f.can_deposit),
    canWithdraw: Boolean(f.can_withdraw),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Chain reads
// ──────────────────────────────────────────────────────────────────────────

/**
 * Wrap fetch() with retries on 429 / 5xx / network errors. Public Sui
 * fullnode rate-limits aggressively when the inventory panel fans out
 * RPCs in parallel (per-SSU inventory loads + operator resolution +
 * policy walks all hit the same window). Without retries, a transient
 * 429 silently breaks discovery: page walks return partial data,
 * loadPolicyForSsu returns null, and shared SSUs disappear from the
 * UI. This helper restores discovery's robustness without changing
 * the surrounding logic.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 3,
  backoffMs = 600,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)));
        continue;
      }
    }
  }
  throw lastErr ?? new Error("fetch failed after retries");
}

/**
 * Memoize the policies-table id. Registry layout never changes, so the
 * Table<ID, ID> id is stable for the lifetime of the deployed package.
 */
let _policiesTableIdCache: string | null = null;
let _policiesTableIdInflight: Promise<string | null> | null = null;

export async function getPoliciesTableId(): Promise<string | null> {
  if (_policiesTableIdCache) return _policiesTableIdCache;
  if (_policiesTableIdInflight) return _policiesTableIdInflight;
  if (!SSU_ACCESS_AVAILABLE || !SSU_POLICY_REGISTRY) return null;
  _policiesTableIdInflight = (async () => {
    try {
      const res = await fetchWithRetry(SUI_TESTNET_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sui_getObject",
          params: [SSU_POLICY_REGISTRY, { showContent: true }],
        }),
      });
      const json = await res.json();
      const tableId =
        json.result?.data?.content?.fields?.policies?.fields?.id?.id;
      const v = typeof tableId === "string" ? tableId : null;
      _policiesTableIdCache = v;
      return v;
    } catch {
      return null;
    } finally {
      _policiesTableIdInflight = null;
    }
  })();
  return _policiesTableIdInflight;
}

/**
 * Resolve the policy_id for an SSU via Table<ID, ID> dynamic field lookup.
 * Returns null when no policy has been initialized for this SSU (the
 * common case for stock SSUs that haven't opted in to shared access).
 */
export async function resolvePolicyId(
  ssuObjectId: string,
): Promise<string | null> {
  const tableId = await getPoliciesTableId();
  if (!tableId) return null;
  try {
    const res = await fetchWithRetry(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_getDynamicFieldObject",
        params: [
          tableId,
          { type: "0x2::object::ID", value: ssuObjectId },
        ],
      }),
    });
    const json = await res.json();
    if (json.error || !json.result?.data || json.result?.error) return null;
    const value = json.result.data.content?.fields?.value;
    if (typeof value === "string") return value;
    if (value?.fields?.id) return value.fields.id;
    if (value?.id) return value.id;
    return null;
  } catch {
    return null;
  }
}

/** Fetch a SsuPolicy object's contents and decode into AccessMode. */
export async function fetchPolicy(
  policyId: string,
): Promise<AccessMode | null> {
  try {
    const res = await fetchWithRetry(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sui_getObject",
        params: [policyId, { showContent: true, showType: true }],
      }),
    });
    const json = await res.json();
    const fields = json.result?.data?.content?.fields;
    if (!fields) return null;
    const mode = Number(fields.mode);
    const tribeIdsRaw: any[] = fields.tribe_ids ?? [];
    const tribeIds = tribeIdsRaw
      .map((t) => Number(t))
      .filter((t) => Number.isFinite(t));
    const denyRaw: any[] = fields.deny ?? [];
    const allowRaw: any[] = fields.allow ?? [];
    const deny = denyRaw.map((d) =>
      typeof d === "string" ? d : d.fields?.id ?? d.id ?? "",
    );
    const allow: AllowEntry[] = allowRaw.map(decodeAllowEntry);

    if (mode === MODE_NONE) return { kind: "none" };
    if (mode === MODE_TRIBE_ALLIANCE)
      return { kind: "tribe_alliance", tribeIds };
    if (mode === MODE_ALLOWLIST) return { kind: "allowlist", entries: allow };
    if (mode === MODE_HYBRID)
      return { kind: "hybrid", tribeIds, deny, allow };
    if (mode === MODE_PUBLIC) return { kind: "public" };
    return { kind: "none" };
  } catch {
    return null;
  }
}

export async function loadPolicyForSsu(
  ssuObjectId: string,
): Promise<LoadedPolicy> {
  const policyId = await resolvePolicyId(ssuObjectId);
  if (!policyId) return { policyId: null, mode: { kind: "none" } };
  const mode = await fetchPolicy(policyId);
  return { policyId, mode: mode ?? { kind: "none" } };
}

// ──────────────────────────────────────────────────────────────────────────
// Permission predicates
// ──────────────────────────────────────────────────────────────────────────

/**
 * Identity context for a permission check. ownTribeId is the caller's
 * current tribe (Character.tribe_id). characterObjectId is the Character
 * object id, used for allowlist matching. nowMs is provided by the caller
 * so tests can inject deterministic time.
 */
export type CallerIdentity = {
  characterObjectId: string;
  ownTribeId: number | undefined;
  /** Defaults to Date.now() when omitted. */
  nowMs?: number;
};

function findAllowEntry(
  entries: AllowEntry[],
  characterObjectId: string,
  nowMs: number,
): AllowEntry | undefined {
  return entries.find(
    (e) =>
      e.characterId === characterObjectId &&
      (e.expiresAt === 0 || e.expiresAt > nowMs),
  );
}

/**
 * Can the caller deposit through the shared path?
 *
 * Mirrors the on-chain check semantics from cradleos::ssu_access. Returns
 * true when:
 *   - public mode (anyone), OR
 *   - tribe_alliance and caller's tribe_id ∈ policy.tribe_ids, OR
 *   - allowlist and caller has an unexpired allow entry with can_deposit, OR
 *   - hybrid: (tribe match OR active allow entry) AND not in deny[]
 */
export function canDepositVia(
  mode: AccessMode,
  caller: CallerIdentity,
): boolean {
  const now = caller.nowMs ?? Date.now();
  switch (mode.kind) {
    case "none":
      return false;
    case "public":
      return true;
    case "tribe_alliance":
      return (
        caller.ownTribeId !== undefined &&
        mode.tribeIds.includes(caller.ownTribeId)
      );
    case "allowlist": {
      const e = findAllowEntry(mode.entries, caller.characterObjectId, now);
      return Boolean(e && e.canDeposit);
    }
    case "hybrid": {
      if (mode.deny.includes(caller.characterObjectId)) return false;
      const tribeOk =
        caller.ownTribeId !== undefined &&
        mode.tribeIds.includes(caller.ownTribeId);
      const allowEntry = findAllowEntry(
        mode.allow,
        caller.characterObjectId,
        now,
      );
      const allowOk = Boolean(allowEntry && allowEntry.canDeposit);
      return tribeOk || allowOk;
    }
  }
}

/** Same semantics as canDepositVia but for withdrawals (allowlist entries
 *  must have can_withdraw set; tribe/public/none unchanged). */
export function canWithdrawVia(
  mode: AccessMode,
  caller: CallerIdentity,
): boolean {
  const now = caller.nowMs ?? Date.now();
  switch (mode.kind) {
    case "none":
      return false;
    case "public":
      return true;
    case "tribe_alliance":
      return (
        caller.ownTribeId !== undefined &&
        mode.tribeIds.includes(caller.ownTribeId)
      );
    case "allowlist": {
      const e = findAllowEntry(mode.entries, caller.characterObjectId, now);
      return Boolean(e && e.canWithdraw);
    }
    case "hybrid": {
      if (mode.deny.includes(caller.characterObjectId)) return false;
      const tribeOk =
        caller.ownTribeId !== undefined &&
        mode.tribeIds.includes(caller.ownTribeId);
      const allowEntry = findAllowEntry(
        mode.allow,
        caller.characterObjectId,
        now,
      );
      const allowOk = Boolean(allowEntry && allowEntry.canWithdraw);
      return tribeOk || allowOk;
    }
  }
}

/** Human label for a policy mode, used in UI badges + status lines. */
export function modeLabel(mode: AccessMode): string {
  switch (mode.kind) {
    case "none":
      return "no policy";
    case "tribe_alliance":
      return `tribe alliance (${mode.tribeIds.length} tribe${mode.tribeIds.length === 1 ? "" : "s"})`;
    case "allowlist":
      return `allowlist (${mode.entries.length})`;
    case "hybrid":
      return `hybrid (${mode.tribeIds.length} tribes, ${mode.allow.length} allow, ${mode.deny.length} deny)`;
    case "public":
      return "public";
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Tx builders — append to a Transaction the caller already created
// ──────────────────────────────────────────────────────────────────────────

const CLOCK_OBJECT_ID = "0x6";

export type SharedDepositArgs = {
  ssuObjectId: string;
  policyId: string;
  characterObjectId: string;
  /** Live `world::inventory::Item` object id from the caller's wallet. */
  itemObjectId: string;
};

/**
 * Append a shared_deposit moveCall to `tx`. The caller is expected to have
 * already verified the policy permits this deposit (canDepositVia). On-chain
 * checks will reject anyway — this is a UX guard, not a security boundary.
 */
export function appendSharedDeposit(
  tx: Transaction,
  args: SharedDepositArgs,
): void {
  if (!SSU_ACCESS_AVAILABLE) {
    throw new Error("ssu_access feature not available on this server.");
  }
  tx.moveCall({
    target: `${SSU_ACCESS_PKG}::ssu_access::shared_deposit`,
    typeArguments: [],
    arguments: [
      tx.object(args.ssuObjectId),
      tx.object(args.policyId),
      tx.object(args.characterObjectId),
      tx.object(args.itemObjectId),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
}

export type SharedDepositItemArgArgs = {
  ssuObjectId: string;
  policyId: string;
  characterObjectId: string;
  /** Transaction-result handle to a `world::inventory::Item` produced earlier
   *  in the same PTB (e.g. by a `withdraw_by_owner` moveCall). The Item never
   *  hits the wallet — it flows directly from one moveCall result into the
   *  next, so the caller's character never owns it as a free-floating object.
   */
  itemArg: ReturnType<Transaction["moveCall"]> | any;
};

export type OwnerDepositToOpenArgs = {
  ssuObjectId: string;
  characterObjectId: string;
  itemArg: ReturnType<Transaction["moveCall"]> | any;
};

/**
 * OWNER-PATH shared deposit (no policy gate).
 *
 * The standard `shared_deposit` path runs `check_access(policy, character, ...)`
 * which in MODE_ALLOWLIST returns false for the SSU owner unless they
 * explicitly added themselves to their own allowlist. That's a footgun —
 * the owner controls the SSU and should always be able to deposit to its
 * shared partition regardless of policy mode.
 *
 * This helper bypasses `check_access` entirely by going around
 * `ssu_access::shared_deposit` and calling `world::storage_unit::
 * deposit_to_open_inventory<SsuAuth>` directly. The witness comes from
 * the public `ssu_access::new_auth()` constructor; `SsuAuth` only needs
 * `drop`, has no internal state, and the SSU has already authorized the
 * extension at policy-init time, so this is safe and equivalent to what
 * `shared_deposit` does on the inside, minus the policy check.
 *
 * Use this only when the caller is the SSU owner (verified upstream by
 * possession of `OwnerCap<StorageUnit>`). Non-owners must continue to use
 * the policy-gated `appendSharedDeposit` / `appendSharedDepositItemArg`.
 *
 * NOTE: no SharedDepositEvent is emitted by this path. The event chain
 * remains owned by `shared_deposit`. If we want owner deposits visible in
 * the activity feed, we should add a Move-side `owner_deposit_to_shared`
 * function later that emits the event explicitly. For now the deposit is
 * still observable through SSU inventory state.
 */
export function appendOwnerDepositToOpen(
  tx: Transaction,
  args: OwnerDepositToOpenArgs,
): void {
  if (!SSU_ACCESS_AVAILABLE) {
    throw new Error("ssu_access feature not available on this server.");
  }
  // Mint an SsuAuth witness. The constructor is intentionally public on
  // the cradleos::ssu_access module — the security boundary is the SSU's
  // `authorize_extension<SsuAuth>` call (done at policy init time), not
  // the witness constructor.
  const witness = tx.moveCall({
    target: `${SSU_ACCESS_PKG}::ssu_access::new_auth`,
  });
  // Deposit directly to the SSU's open partition.
  tx.moveCall({
    target: `${WORLD_PKG}::storage_unit::deposit_to_open_inventory`,
    typeArguments: [`${SSU_ACCESS_PKG}::ssu_access::SsuAuth`],
    arguments: [
      tx.object(args.ssuObjectId),
      tx.object(args.characterObjectId),
      args.itemArg,
      witness,
    ],
  });
}

/**
 * Variant of {@link appendSharedDeposit} that consumes an `Item` produced
 * by a previous moveCall in the same PTB, rather than a pre-existing object
 * id. Used by the "Move to Shared" flow where `withdraw_by_owner` extracts
 * the item from the owner_main partition and `shared_deposit` immediately
 * places it in the open partition — all in one signature.
 */
export function appendSharedDepositItemArg(
  tx: Transaction,
  args: SharedDepositItemArgArgs,
): void {
  if (!SSU_ACCESS_AVAILABLE) {
    throw new Error("ssu_access feature not available on this server.");
  }
  tx.moveCall({
    target: `${SSU_ACCESS_PKG}::ssu_access::shared_deposit`,
    typeArguments: [],
    arguments: [
      tx.object(args.ssuObjectId),
      tx.object(args.policyId),
      tx.object(args.characterObjectId),
      args.itemArg,
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
}

export type SharedWithdrawToCharacterArgs = {
  ssuObjectId: string;
  policyId: string;
  characterObjectId: string;
  typeId: number;
  /** Item quantity to withdraw. u32 in the Move signature. */
  quantity: number;
};

/**
 * Append a shared_withdraw_to_character moveCall to `tx`. The withdrawn
 * Item is auto-deposited into the caller's Character inventory by the
 * Move function — no separate transferObjects call required.
 */
export function appendSharedWithdrawToCharacter(
  tx: Transaction,
  args: SharedWithdrawToCharacterArgs,
): void {
  if (!SSU_ACCESS_AVAILABLE) {
    throw new Error("ssu_access feature not available on this server.");
  }
  tx.moveCall({
    target: `${SSU_ACCESS_PKG}::ssu_access::shared_withdraw_to_character`,
    typeArguments: [],
    arguments: [
      tx.object(args.ssuObjectId),
      tx.object(args.policyId),
      tx.object(args.characterObjectId),
      tx.pure.u64(args.typeId),
      tx.pure.u32(args.quantity),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
}

export type SharedWithdrawToOwnedArgs = {
  ssuObjectId: string;
  policyId: string;
  characterObjectId: string;
  typeId: number;
  /** Item quantity to withdraw. u32 in the Move signature. */
  quantity: number;
};

/**
 * PREFERRED tribemate-withdraw primitive (added v12, 2026-04-27).
 *
 * Routes the withdrawn Item directly into the caller's per-character
 * partition on the SAME SSU — NOT into their wallet. The item stays
 * visible in the in-game inventory window under the caller's character,
 * which is what tribemates actually want.
 *
 * Replaces `appendSharedWithdrawToCharacter` for normal flows; the
 * `_to_character` variant is retained only for back-compat (it leaves
 * items in limbo and should be considered deprecated).
 *
 * Atomic: withdraw + deposit_to_owned are a single Move call composed of
 * two PTB-equivalent operations. Either both land or neither does.
 */
export function appendSharedWithdrawToOwned(
  tx: Transaction,
  args: SharedWithdrawToOwnedArgs,
): void {
  if (!SSU_ACCESS_AVAILABLE) {
    throw new Error("ssu_access feature not available on this server.");
  }
  tx.moveCall({
    target: `${SSU_ACCESS_PKG}::ssu_access::shared_withdraw_to_owned`,
    typeArguments: [],
    arguments: [
      tx.object(args.ssuObjectId),
      tx.object(args.policyId),
      tx.object(args.characterObjectId),
      tx.pure.u64(args.typeId),
      tx.pure.u32(args.quantity),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
}

export type SharedWithdrawArgs = {
  ssuObjectId: string;
  policyId: string;
  characterObjectId: string;
  typeId: number;
  quantity: number;
};

/**
 * Append a `shared_withdraw` moveCall (the Item-returning variant, NOT the
 * `_to_character` auto-transfer variant) to `tx`. Returns the moveCall
 * result handle, which represents an `Item` flowing through the PTB. The
 * caller is responsible for consuming the Item in a subsequent moveCall
 * (e.g. `deposit_by_owner` to re-deposit into the same SSU's owner_main
 * partition for the SSU owner, or `deposit_to_owned<SsuAuth>` via a
 * Move-side wrapper for tribemate → lockbox routing).
 *
 * IMPORTANT: the returned Item is a **transient by-value** value within the
 * PTB. It MUST be consumed by another moveCall in the same tx, otherwise
 * the tx will fail to typecheck (linear types in Move).
 */
export function appendSharedWithdrawReturningItem(
  tx: Transaction,
  args: SharedWithdrawArgs,
): ReturnType<Transaction["moveCall"]> {
  if (!SSU_ACCESS_AVAILABLE) {
    throw new Error("ssu_access feature not available on this server.");
  }
  return tx.moveCall({
    target: `${SSU_ACCESS_PKG}::ssu_access::shared_withdraw`,
    typeArguments: [],
    arguments: [
      tx.object(args.ssuObjectId),
      tx.object(args.policyId),
      tx.object(args.characterObjectId),
      tx.pure.u64(args.typeId),
      tx.pure.u32(args.quantity),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Recovery: wallet-stuck Items → SSU partition (added 2026-04-26 v11)
//
// `shared_withdraw_to_character` historically transfers the withdrawn Item
// to the caller's wallet. Items in limbo there are unusable in-game and
// only redepositable to their origin SSU (parent_id binding enforced in
// base contract). v11 of cradleos::ssu_access adds two recovery paths:
//
//   recover_to_owned   → deposit_to_owned<SsuAuth> (per-character partition,
//                        visible in the in-game inventory window)
//   recover_to_shared  → deposit_to_open_inventory<SsuAuth> (shared open
//                        partition; original SSU owner can recover via
//                        owner-direct withdraw)
//
// Both gate on caller == character.character_address. The shared variant
// also re-checks current access policy (a tribemate's access could have
// been revoked between the original withdraw and the recovery attempt).
// ──────────────────────────────────────────────────────────────────────────

export type RecoverToOwnedArgs = {
  ssuObjectId: string;
  characterObjectId: string;
  /** Live `world::inventory::Item` object id from the caller's wallet. */
  itemObjectId: string;
};

/**
 * Append a `recover_to_owned` moveCall to `tx`. Routes a wallet-held Item
 * back into the caller's per-character partition on the SSU it came from.
 * The Item must parent to the SSU (base contract enforces; surface this
 * in the UI by reading `parent_id` before calling).
 */
export function appendRecoverToOwned(
  tx: Transaction,
  args: RecoverToOwnedArgs,
): void {
  if (!SSU_ACCESS_AVAILABLE) {
    throw new Error("ssu_access feature not available on this server.");
  }
  tx.moveCall({
    target: `${SSU_ACCESS_PKG}::ssu_access::recover_to_owned`,
    typeArguments: [],
    arguments: [
      tx.object(args.ssuObjectId),
      tx.object(args.characterObjectId),
      tx.object(args.itemObjectId),
    ],
  });
}

export type RecoverToSharedArgs = {
  ssuObjectId: string;
  policyId: string;
  characterObjectId: string;
  itemObjectId: string;
};

/**
 * Append a `recover_to_shared` moveCall. Routes a wallet-held Item back
 * into the SSU's shared open partition. Caller must currently have
 * deposit access via the policy (re-checked on-chain).
 */
export function appendRecoverToShared(
  tx: Transaction,
  args: RecoverToSharedArgs,
): void {
  if (!SSU_ACCESS_AVAILABLE) {
    throw new Error("ssu_access feature not available on this server.");
  }
  tx.moveCall({
    target: `${SSU_ACCESS_PKG}::ssu_access::recover_to_shared`,
    typeArguments: [],
    arguments: [
      tx.object(args.ssuObjectId),
      tx.object(args.policyId),
      tx.object(args.characterObjectId),
      tx.object(args.itemObjectId),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Wallet-stuck-Item discovery (added 2026-04-26 v11)
//
// Enumerates `world::inventory::Item` objects currently owned by the
// caller's wallet (top-level Sui objects, NOT inside any SSU partition).
// These are items that landed via `shared_withdraw_to_character`'s
// public_transfer and are now in limbo — unusable in-game until
// recovered to their origin SSU.
//
// Each item exposes `parent_id` which pins it to the SSU it came from.
// The recovery UI groups by parent_id and shows TO MY PARTITION /
// TO SHARED POOL buttons per item.
// ──────────────────────────────────────────────────────────────────────────

export type StuckItem = {
  itemObjectId: string;
  parentSsuId: string;
  typeId: number;
  quantity: number;
  volume: number;
  tenant: string;
};

/**
 * The `world` package's `inventory::Item` struct type. Used as the
 * StructType filter in suix_getOwnedObjects to enumerate wallet-stuck
 * items. world's package id is read from constants.
 */
function worldItemStructType(worldPkgOriginal: string): string {
  return `${worldPkgOriginal}::inventory::Item`;
}

/**
 * Enumerate all `world::inventory::Item` objects currently owned by
 * `walletAddress`. Returns an empty list when ssu_access is unavailable
 * or no items are stuck. Pages through `suix_getOwnedObjects` until
 * exhausted (cap 4 pages × 50 = 200 items to avoid runaway calls in
 * pathological wallets).
 */
export async function fetchStuckItems(
  walletAddress: string,
  worldPkgOriginal: string,
): Promise<StuckItem[]> {
  const filter = { StructType: worldItemStructType(worldPkgOriginal) };
  const opts = { showContent: true, showType: true };
  const out: StuckItem[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 4; page++) {
    let resp: any;
    try {
      const r = await fetch(SUI_TESTNET_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "suix_getOwnedObjects",
          params: [walletAddress, { filter, options: opts }, cursor, 50],
        }),
      });
      const j = await r.json();
      resp = j?.result;
    } catch {
      break;
    }
    const items = (resp?.data ?? []) as any[];
    for (const entry of items) {
      const data = entry?.data;
      const fields = (data?.content as any)?.fields;
      if (!data?.objectId || !fields) continue;
      const parentSsuId = String(fields.parent_id ?? "");
      if (!parentSsuId) continue;
      out.push({
        itemObjectId: String(data.objectId),
        parentSsuId,
        typeId: Number(fields.type_id ?? 0),
        quantity: Number(fields.quantity ?? 0),
        volume: Number(fields.volume ?? 0),
        tenant: String(fields.tenant ?? ""),
      });
    }
    if (!resp?.hasNextPage || !resp?.nextCursor) break;
    cursor = resp.nextCursor as string;
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Shared-SSU discovery (added 2026-04-26)
//
// Registry-walk path: enumerate every (ssu_id → policy_id) entry in the
// SsuPolicyRegistry's policies table, fetch each policy, and surface SSUs
// whose policy permits the caller to deposit OR withdraw. Used by
// InventoryPanel to show tribe-shared / allowlist / public SSUs that the
// caller does NOT own but does have access to.
//
// Cost: O(N) RPC calls where N = total policies on chain. Page size 50 per
// dynamic-field call. Each policy is then fetched via sui_getObject. For
// the Stillness server's current SSU policy population this is small
// (single-digit page count). If the registry grows large, switch to
// event-based incremental discovery via PolicyConfigured events.
// ──────────────────────────────────────────────────────────────────────────

export type DiscoveredSharedSsu = {
  ssuObjectId: string;
  policyId: string;
  mode: AccessMode;
  /** True if caller can withdraw via this policy. */
  canWithdraw: boolean;
  /** True if caller can deposit via this policy. */
  canDeposit: boolean;
};

/**
 * Enumerate every (ssu, policy) entry in SsuPolicyRegistry.policies and
 * filter to the ones the caller has shared access to. Skips any ssu_id in
 * `skipSsuIds` (use this to exclude SSUs the caller already owns to avoid
 * duplicate cards).
 *
 * Returns an empty list when:
 *   - ssu_access feature not available on this server (no Move package), OR
 *   - registry table id can't be resolved, OR
 *   - the registry has no entries.
 *
 * RPC failures during page walking are non-fatal — the caller will simply
 * see fewer shared SSUs surfaced rather than a broken UI.
 */
export async function discoverSharedSsus(
  caller: CallerIdentity,
  skipSsuIds: Set<string>,
): Promise<DiscoveredSharedSsu[]> {
  if (!SSU_ACCESS_AVAILABLE) return [];
  const tableId = await getPoliciesTableId();
  if (!tableId) return [];

  // Walk all dynamic fields of the policies table. Each field's name is
  // the SSU id (the Table<ID, ID> key); the value is the policy id. Since
  // suix_getDynamicFields gives us the names but not the values directly,
  // we then fetch each value via getDynamicFieldObject. For now we
  // re-resolve via resolvePolicyId() which already does that round trip;
  // batching is fine because we already paged through field names.

  const ssuIds: string[] = [];
  let cursor: string | null = null;
  // Hard cap iterations at 20 pages * 50 = 1000 SSUs to avoid runaway
  // walks if the registry gets large. Anything beyond that should switch
  // to event-based discovery anyway.
  for (let page = 0; page < 20; page++) {
    let json: any;
    try {
      const res = await fetchWithRetry(SUI_TESTNET_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "suix_getDynamicFields",
          params: [tableId, cursor, 50],
        }),
      });
      json = await res.json();
    } catch {
      break;
    }
    const data = json?.result?.data ?? [];
    for (const f of data) {
      // Field name layout for Table<ID, ID>: name.value is the SSU id.
      const v = f?.name?.value;
      if (typeof v === "string" && v.startsWith("0x")) ssuIds.push(v);
    }
    if (!json?.result?.hasNextPage) break;
    cursor = json?.result?.nextCursor ?? null;
    if (!cursor) break;
  }

  // De-dup vs caller's owned set BEFORE doing per-policy round trips.
  const candidates = ssuIds.filter(id => !skipSsuIds.has(id));

  // Resolve policies in parallel. Bound concurrency so we don't hammer
  // public RPC endpoints — chunk size 8 is a safe middle ground.
  const out: DiscoveredSharedSsu[] = [];
  const CHUNK = 8;
  for (let i = 0; i < candidates.length; i += CHUNK) {
    const chunk = candidates.slice(i, i + CHUNK);
    const resolved = await Promise.all(
      chunk.map(async ssuId => {
        const policy = await loadPolicyForSsu(ssuId).catch(() => null);
        if (!policy || !policy.policyId) return null;
        // Filter early: skip "none" policies (initialized but disabled).
        if (policy.mode.kind === "none") return null;
        const canW = canWithdrawVia(policy.mode, caller);
        const canD = canDepositVia(policy.mode, caller);
        if (!canW && !canD) return null;
        return {
          ssuObjectId: ssuId,
          policyId: policy.policyId,
          mode: policy.mode,
          canWithdraw: canW,
          canDeposit: canD,
        } as DiscoveredSharedSsu;
      }),
    );
    for (const r of resolved) if (r) out.push(r);
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Promote ephemeral → shared (added v4, 2026-04-27)
//
// `shared_withdraw_to_owned` puts items into the caller's per-character
// partition on the SSU (keyed by character.owner_cap_id()). These show as
// [locked] in the CradleOS UI because their DF key is neither the open
// partition key nor the SSU owner's cap key.
//
// `promote_ephemeral_to_shared` reverses this: it pulls items from the
// caller's per-character partition using `withdraw_by_owner<Character>`
// (which uses object::id(OwnerCap<Character>) as the DF key, matching
// the key that deposit_to_owned wrote) and deposits them into the shared
// open partition via deposit_to_open_inventory<SsuAuth>.
//
// PTB structure:
//   1. character::borrow_owner_cap<Character> → (charCap, charCapReceipt)
//   2. ssu_access::promote_ephemeral_to_shared (uses charCap by &ref)
//   3. character::return_owner_cap<Character>  (consumes charCap + receipt)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Fetch the object ID of the caller's own OwnerCap<Character>.
 * This cap is stored inside the Character object and is needed for
 * the promote_ephemeral_to_shared PTB (to borrow_owner_cap<Character>).
 * Returns null when no cap found (shouldn't happen for valid characters).
 */
export async function fetchCharacterOwnerCapId(
  characterId: string,
): Promise<string | null> {
  if (!WORLD_PKG) return null;
  const capType = `${WORLD_PKG}::access::OwnerCap<${WORLD_PKG}::character::Character>`;
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_getOwnedObjects",
        params: [
          characterId,
          { filter: { StructType: capType }, options: {} },
          null,
          1,
        ],
      }),
    });
    const json = await res.json();
    const data = json.result?.data ?? [];
    return (data[0]?.data?.objectId as string) ?? null;
  } catch {
    return null;
  }
}

/**
 * Build a PTB that promotes items from the caller's per-character partition
 * (the [locked] partition) into the SSU's shared open inventory.
 *
 * Requires `charOwnerCapId` — the object ID of the caller's OwnerCap<Character>.
 * Fetch this with `fetchCharacterOwnerCapId(characterId)` before calling.
 *
 * On-chain flow:
 *   1. borrow_owner_cap<Character>  → (charCap, receipt)
 *   2. ssu_access::promote_ephemeral_to_shared  (policy-gated, emits SharedDepositEvent)
 *   3. return_owner_cap<Character>
 */
export function buildPromoteToSharedTx(
  ssuObjectId: string,
  characterId: string,
  policyId: string,
  typeId: number | bigint,
  quantity: number,
  charOwnerCapId: string,
): Transaction {
  if (!SSU_ACCESS_AVAILABLE) {
    throw new Error("ssu_access feature not available on this server.");
  }
  const tx = new Transaction();

  // 1. Borrow the caller's own OwnerCap<Character> from inside the Character object.
  //    The Character's OwnerCap<Character> is stored as a child object of the Character.
  //    tx.object() handles the ReceivingObject semantics automatically.
  const [charCap, charCapReceipt] = tx.moveCall({
    target: `${WORLD_PKG}::character::borrow_owner_cap`,
    typeArguments: [`${WORLD_PKG}::character::Character`],
    arguments: [
      tx.object(characterId),
      tx.object(charOwnerCapId),
    ],
  });

  // 2. promote_ephemeral_to_shared: pulls from per-character partition,
  //    deposits to shared open inventory. charCap is passed by &ref (not consumed).
  tx.moveCall({
    target: `${SSU_ACCESS_PKG}::ssu_access::promote_ephemeral_to_shared`,
    arguments: [
      tx.object(ssuObjectId),
      tx.object(policyId),
      tx.object(characterId),
      charCap,
      tx.pure.u64(BigInt(typeId)),
      tx.pure.u32(quantity),
      tx.object("0x6"),
    ],
  });

  // 3. Return the borrowed cap (consumes charCap by value + receipt).
  tx.moveCall({
    target: `${WORLD_PKG}::character::return_owner_cap`,
    typeArguments: [`${WORLD_PKG}::character::Character`],
    arguments: [
      tx.object(characterId),
      charCap,
      charCapReceipt,
    ],
  });

  return tx;
}
