/**
 * SSU policy discovery and legacy transaction builders.
 *
 * October 2026 audit: the deployed extension exposes public new_auth(), so
 * its saved tribe/allow/deny policy is NOT an enforced access boundary.
 * Shared builders are quarantined by ssuSafety and the common wallet signer.
 * Do not re-enable them without a separately reviewed replacement protocol.
 *
 * Current official storage has owner inventory, per-character inventory
 * (deposit_to_owned), and one extension-controlled pool
 * (deposit_to_open_inventory). Each partition has independent capacity.
 * Policy discovery is retained for read-only visibility of affected SSUs.
 * Manual recover_to_owned only returns an Item already in the caller's
 * wallet to that caller's personal partition; it cannot drain shared stock.
 */

import { Transaction } from "@mysten/sui/transactions";
import { assertSharedSsuOperationsEnabled } from "./ssuSafety";
import {
  SSU_ACCESS_PKG,
  SSU_POLICY_REGISTRY,
  SSU_ACCESS_AVAILABLE,
  SSU_ACCESS_ORIGINAL,
  WORLD_PKG,
} from "../constants";

import { storageObject, storageObjects, storageOwned, storageFields, storageId, storageUint, storageRecord, assertStorageType, assertIdField, idFieldId, unavailable } from './storageRead';

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

/** Live registry and exact dynamic-field binding. No cached absence on read failure. */
export async function getPoliciesTableId(): Promise<string | null> {
  if (!SSU_ACCESS_AVAILABLE || !SSU_POLICY_REGISTRY) return null;
  const registry = await storageObject(SSU_POLICY_REGISTRY);
  assertStorageType(registry, `${SSU_ACCESS_ORIGINAL}::ssu_access::SsuPolicyRegistry`);
  if (registry.owner.kind !== 3) return unavailable();
  return storageId(storageRecord(registry.fields.policies).id);
}
export async function resolvePolicyId(ssuObjectId: string): Promise<string | null> {
  const tableId = await getPoliciesTableId(); if (!tableId) return null;
  const field = (await storageObjects([idFieldId(tableId, ssuObjectId)]))[0];
  if (!field) return null;
  assertIdField(field, tableId, ssuObjectId, '0x2::object::ID');
  return storageId(field.fields.value);
}
function decodePolicy(fields: Record<string, any>): AccessMode {
  const mode = storageUint(fields.mode);
  // Deployed versions use either tribe_id (single tribe) or tribe_ids (alliance).
  const tribeIds = Array.isArray(fields.tribe_ids) ? fields.tribe_ids.map(storageUint) : [storageUint(fields.tribe_id)];
  if (!Array.isArray(fields.deny) || !Array.isArray(fields.allow)) return unavailable();
  const deny = fields.deny.map(storageId);
  const allow: AllowEntry[] = fields.allow.map((raw: any) => {
    const f = storageRecord(raw);
    if (typeof f.can_deposit !== 'boolean' || typeof f.can_withdraw !== 'boolean') return unavailable();
    return { characterId: storageId(f.character_id), expiresAt: storageUint(f.expires_at), canDeposit: f.can_deposit, canWithdraw: f.can_withdraw };
  });
  if (mode === MODE_NONE) return { kind: 'none' };
  if (mode === MODE_TRIBE_ALLIANCE) return { kind: 'tribe_alliance', tribeIds };
  if (mode === MODE_ALLOWLIST) return { kind: 'allowlist', entries: allow };
  if (mode === MODE_HYBRID) return { kind: 'hybrid', tribeIds, deny, allow };
  if (mode === MODE_PUBLIC) return { kind: 'public' };
  return unavailable();
}
export async function fetchPolicy(policyId: string, ssuObjectId?: string): Promise<AccessMode> {
  const policy = await storageObject(policyId);
  assertStorageType(policy, `${SSU_ACCESS_ORIGINAL}::ssu_access::SsuPolicy`);
  if (policy.owner.kind !== 3 || (ssuObjectId && storageId(policy.fields.ssu_id) !== storageId(ssuObjectId))) return unavailable();
  storageId(policy.fields.ssu_id);
  return decodePolicy(policy.fields);
}
export async function loadPolicyForSsu(ssuObjectId: string): Promise<LoadedPolicy> {
  const policyId = await resolvePolicyId(ssuObjectId);
  if (!policyId) return { policyId: null, mode: { kind: 'none' } };
  return { policyId, mode: await fetchPolicy(policyId, ssuObjectId) };
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
  assertSharedSsuOperationsEnabled();
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
 * deposit_to_open_inventory<SsuAuth> directly. This exposed the public
 * witness bypass and is quarantined before any commands are appended.
 * Historical implementation below is not an authorization pattern to reuse.
 */
export function appendOwnerDepositToOpen(
  tx: Transaction,
  args: OwnerDepositToOpenArgs,
): void {
  assertSharedSsuOperationsEnabled();
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
  assertSharedSsuOperationsEnabled();
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
  assertSharedSsuOperationsEnabled();
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
  assertSharedSsuOperationsEnabled();
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
  assertSharedSsuOperationsEnabled();
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
  assertSharedSsuOperationsEnabled();
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

function worldItemStructType(worldPkgOriginal: string): string { return `${worldPkgOriginal}::inventory::Item`; }
/** Complete wallet-owned transit items; unavailable never means empty. */
export async function fetchStuckItems(
  walletAddress: string,
  worldPkgOriginal: string,
): Promise<StuckItem[]> {
  const objects = await storageOwned(walletAddress, worldItemStructType(worldPkgOriginal));
  return objects.map(o => {
    const f = o.fields, quantity = storageUint(f.quantity);
    if (f.tenant !== 'stillness' || quantity > 0xffffffff) return unavailable();
    return { itemObjectId: o.id, parentSsuId: storageId(f.parent_id), typeId: storageUint(f.type_id),
      quantity, volume: storageUint(f.volume), tenant: f.tenant };
  });
}

// Read-only saved-policy discovery. Shared transfers remain quarantined.
export type DiscoveredSharedSsu = {
  ssuObjectId: string;
  policyId: string;
  mode: AccessMode;
  /** True if caller can withdraw via this policy. */
  canWithdraw: boolean;
  /** True if caller can deposit via this policy. */
  canDeposit: boolean;
};

/** Complete current-world saved-policy view; failures propagate separately to UI. */
export async function discoverSharedSsus(
  caller: CallerIdentity,
  skipSsuIds: Set<string>,
): Promise<DiscoveredSharedSsu[]> {
  if (!SSU_ACCESS_AVAILABLE) return [];
  const tableId = await getPoliciesTableId(); if (!tableId) return [];
  const fields = await storageFields(tableId, '0x2::object::ID');
  const candidates = fields.filter(f => !skipSsuIds.has(storageId(f.fields.name)));
  const targets = await storageObjects(candidates.map(f => storageId(f.fields.name)));
  const out: DiscoveredSharedSsu[] = [];
  for (const [i, target] of targets.entries()) {
    // Explicitly deleted or previous-world targets are not live shared storage.
    if (!target || target.type !== `${WORLD_PKG}::storage_unit::StorageUnit`) continue;
    if (target.owner.kind !== 3) return unavailable();
    const policyId = storageId(candidates[i].fields.value);
    const mode = await fetchPolicy(policyId, target.id);
    const canWithdraw = canWithdrawVia(mode, caller), canDeposit = canDepositVia(mode, caller);
    if (canWithdraw || canDeposit) out.push({ ssuObjectId: target.id, policyId, mode, canWithdraw, canDeposit });
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
  const caps = await storageOwned(characterId, `${WORLD_PKG}::access::OwnerCap<${WORLD_PKG}::character::Character>`);
  const matches = caps.filter(c => storageId(c.fields.authorized_object_id) === storageId(characterId));
  if (matches.length !== 1) return unavailable();
  return matches[0].id;
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
  assertSharedSsuOperationsEnabled();
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

/**
 * Batch variant of `buildPromoteToSharedTx`: promote N items from the caller's
 * per-character (ephemeral / [locked]) partition into the SSU's shared open
 * inventory — all in a single PTB, one signature.
 *
 * Borrow OwnerCap<Character> once, chain N promote_ephemeral_to_shared calls
 * against it, return the cap once. Mirrors the WITHDRAW ALL flow's batching.
 *
 * Sui PTBs execute commands sequentially within one tx, so the same charCap
 * (borrowed by &mut from the Character) can be reused as a &ref argument by
 * every promote call before being returned. This is the same pattern the
 * StructurePanel batch online/offline builders use for OwnerCap<Structure>.
 */
export function buildPromoteAllToSharedTx(
  ssuObjectId: string,
  characterId: string,
  policyId: string,
  items: Array<{ typeId: number | bigint; quantity: number }>,
  charOwnerCapId: string,
): Transaction {
  assertSharedSsuOperationsEnabled();
  if (!SSU_ACCESS_AVAILABLE) {
    throw new Error("ssu_access feature not available on this server.");
  }
  if (items.length === 0) {
    throw new Error("buildPromoteAllToSharedTx: no items to promote.");
  }

  const tx = new Transaction();

  // 1. Borrow OwnerCap<Character> once.
  const [charCap, charCapReceipt] = tx.moveCall({
    target: `${WORLD_PKG}::character::borrow_owner_cap`,
    typeArguments: [`${WORLD_PKG}::character::Character`],
    arguments: [
      tx.object(characterId),
      tx.object(charOwnerCapId),
    ],
  });

  // 2. One promote_ephemeral_to_shared call per item. charCap is passed by &ref
  //    so it stays valid across the loop.
  for (const item of items) {
    tx.moveCall({
      target: `${SSU_ACCESS_PKG}::ssu_access::promote_ephemeral_to_shared`,
      arguments: [
        tx.object(ssuObjectId),
        tx.object(policyId),
        tx.object(characterId),
        charCap,
        tx.pure.u64(BigInt(item.typeId)),
        tx.pure.u32(item.quantity),
        tx.object("0x6"),
      ],
    });
  }

  // 3. Return the cap once (consumes charCap by value + receipt).
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
