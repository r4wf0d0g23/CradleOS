import { useState, useEffect, useRef } from "react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { fetchPlayerStructures, type PlayerStructure, findCharacterForWallet, fetchCharacterTribeId, synthesizeSharedSsuStructure, fetchTypeNames } from "../lib";
import { SUI_TESTNET_RPC, WORLD_API, WORLD_PKG, SSU_ACCESS_AVAILABLE } from "../constants";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { Transaction } from "@mysten/sui/transactions";
import { SharedAccessSection } from "./SharedAccessSection";
import {
  loadPolicyForSsu,
  canDepositVia,
  canWithdrawVia,
  modeLabel,
  appendSharedDeposit,
  appendSharedDepositItemArg,
  appendSharedWithdrawReturningItem,
  // appendSharedWithdrawToCharacter is intentionally NOT imported anymore:
  // v12 of cradleos::ssu_access introduced shared_withdraw_to_owned, which
  // routes withdrawn items directly into the caller's per-character partition
  // (visible in-game) instead of into wallet limbo. The legacy fn remains on
  // chain for back-compat but the dApp should never call it again.
  appendSharedWithdrawToOwned,
  appendRecoverToOwned,
  appendRecoverToShared,
  fetchStuckItems,
  type StuckItem,
  discoverSharedSsus,
  type LoadedPolicy,
  buildPromoteToSharedTx,
  fetchCharacterOwnerCapId,
} from "../lib/ssuAccess";
import { blake2b } from "@noble/hashes/blake2.js";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Which sub-inventory of a StorageUnit an item lives in. The shared-access
 *  Move path (cradleos::ssu_access::shared_withdraw) only operates on the
 *  open partition; items in the owner_main partition (deposited via the
 *  in-game client or deposit_by_owner) cannot be pulled by tribemates and
 *  attempting to do so reverts with EItemDoesNotExist. */
type InventoryPartition = "open" | "owner_main" | "unknown";

type InventoryItem = {
  typeId: number;
  quantity: number;
  volume: number;
  itemId: string;
  /** Which partition of the SSU this item is stored in. Determines whether
   *  shared_withdraw_to_character can pull it. */
  partition: InventoryPartition;
};

/** Compute the deterministic dynamic-field key Sui uses for an SSU's open
 *  inventory partition. Mirrors Move:
 *    let mut bytes = bcs::to_bytes(&storage_unit_id);
 *    vector::append(&mut bytes, b"open_inventory");
 *    let digest = hash::blake2b256(&bytes);
 *    object::id_from_address(address::from_bytes(digest))
 *  (storage_unit.move :: open_storage_key_from_id) */
function computeOpenStorageKey(ssuId: string): string {
  const hex = ssuId.replace(/^0x/, "").padStart(64, "0");
  const ssuBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    ssuBytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  const suffix = new TextEncoder().encode("open_inventory");
  const buf = new Uint8Array(ssuBytes.length + suffix.length);
  buf.set(ssuBytes, 0);
  buf.set(suffix, ssuBytes.length);
  const digest = blake2b(buf, { dkLen: 32 });
  let out = "0x";
  for (const b of digest) out += b.toString(16).padStart(2, "0");
  return out;
}

/** Normalize a Sui ID/address hex string for equality comparison. */
function normalizeId(id: string): string {
  const hex = id.replace(/^0x/, "").toLowerCase().padStart(64, "0");
  return "0x" + hex;
}

type SSUInventory = {
  ssu: PlayerStructure;
  items: InventoryItem[];
  resolvedNames: Map<number, string>;
  loading: boolean;
  error?: string;
  maxCapacity: number;
  usedCapacity: number;
  /** cradleos::ssu_access policy attached to this SSU, if any.
   *  undefined = not yet resolved; { policyId: null, mode: "none" } = no policy. */
  policy?: LoadedPolicy;
  /** True when this SSU is surfaced via shared-access discovery (caller is
   *  not the owner). The card renders a SHARED badge and ALL→SHARED / rename
   *  controls are hidden because the caller has no OwnerCap. */
  sharedFrom?: "tribe" | "allowlist" | "hybrid" | "public";
};

type TransferState = {
  characterId: string | null;
  ownerCaps: Map<string, string>; // ssuObjectId → ownerCapId
  /** The caller's OwnerCap<Character> object ID — needed for promote_ephemeral_to_shared PTB. */
  charOwnerCapId: string | null;
  pendingWithdraw: { ssuId: string; typeId: number; quantity: number; itemName: string } | null;
  pendingDeposit: { targetSsuId: string } | null;
  txStatus: string | null;
  txError: string | null;
};

type WalletItem = {
  objectId: string;
  typeId: number;
  quantity: number;
  name: string;
  parentId?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

type SSUInventoryResult = {
  items: InventoryItem[];
  maxCapacity: number;
  usedCapacity: number;
};

async function fetchSSUInventory(ssuId: string): Promise<SSUInventoryResult> {
  // 1. Fetch dynamic fields (inventory partitions) AND the SSU object (for
  //    owner_cap_id) in parallel. We need owner_cap_id to identify which
  //    DF key represents the owner_main partition (= owner_cap_id) versus
  //    the open partition (= blake2b256(ssu_id || "open_inventory")).
  //    Items in any other DF key are tagged "unknown" and treated as
  //    non-shared-withdrawable for safety.
  const [dfJson, ssuJson] = await Promise.all([
    fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_getDynamicFields",
        params: [ssuId, null, 20],
      }),
    }).then(r => r.json()),
    fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sui_getObject",
        params: [ssuId, { showContent: true }],
      }),
    }).then(r => r.json()),
  ]);

  const keys: string[] =
    dfJson.result?.data?.map((f: any) => f.name?.value).filter(Boolean) ?? [];

  const ownerCapId: string | null = (() => {
    const c = ssuJson.result?.data?.content?.fields?.owner_cap_id;
    return c ? normalizeId(String(c)) : null;
  })();
  const openKey = normalizeId(computeOpenStorageKey(ssuId));

  function classify(rawKey: string): InventoryPartition {
    const k = normalizeId(rawKey);
    if (k === openKey) return "open";
    if (ownerCapId && k === ownerCapId) return "owner_main";
    return "unknown";
  }

  type RawItem = {
    typeId: number; quantity: number; volume: number; itemId: string;
    partition: InventoryPartition;
  };
  const rawItems: RawItem[] = [];
  let maxCapacity = 0;
  let usedCapacity = 0;

  // 2. For each partition key, fetch contents + capacity, tagging each
  //    item with its source partition.
  for (const key of keys) {
    const invRes = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_getDynamicFieldObject",
        params: [ssuId, { type: "0x2::object::ID", value: key }],
      }),
    });
    const invJson = await invRes.json();
    const invFields = invJson.result?.data?.content?.fields?.value?.fields;
    if (invFields) {
      if (invFields.max_capacity !== undefined) {
        maxCapacity = Math.max(maxCapacity, Number(invFields.max_capacity));
      }
      if (invFields.used_capacity !== undefined) {
        usedCapacity += Number(invFields.used_capacity);
      }
    }
    const partition = classify(key);
    const contents = invFields?.items?.fields?.contents ?? [];
    for (const entry of contents) {
      const val = entry?.fields?.value?.fields;
      if (val) {
        rawItems.push({
          typeId: Number(val.type_id),
          quantity: Number(val.quantity),
          volume: Number(val.volume),
          itemId: String(val.item_id),
          partition,
        });
      }
    }
  }

  // Aggregate by (typeId, partition) so a typeId that exists in BOTH
  // partitions surfaces as two rows — the open row will get a WITHDRAW
  // button, the owner_main row won't. Sort: open first (actionable),
  // then by quantity desc.
  type AggKey = string;
  const map = new Map<AggKey, RawItem>();
  for (const item of rawItems) {
    const k: AggKey = `${item.typeId}│${item.partition}`;
    const existing = map.get(k);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      map.set(k, { ...item });
    }
  }
  const partitionRank = (p: InventoryPartition) =>
    p === "open" ? 0 : p === "owner_main" ? 1 : 2;
  return {
    items: [...map.values()].sort((a, b) => {
      const pr = partitionRank(a.partition) - partitionRank(b.partition);
      if (pr !== 0) return pr;
      return b.quantity - a.quantity;
    }),
    maxCapacity,
    usedCapacity,
  };
}

async function resolveItemName(
  typeId: number,
  worldApi: string,
  cache: Map<number, string>
): Promise<string> {
  if (cache.has(typeId)) return cache.get(typeId)!;
  try {
    const res = await fetch(`${worldApi}/v2/types/${typeId}`);
    const json = await res.json();
    const name = json.name ?? `type_id ${typeId}`;
    cache.set(typeId, name);
    return name;
  } catch {
    return `type_id ${typeId}`;
  }
}

async function fetchOwnerCaps(characterId: string): Promise<Map<string, string>> {
  const capType = `${WORLD_PKG}::access::OwnerCap<${WORLD_PKG}::storage_unit::StorageUnit>`;
  const res = await fetch(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "suix_getOwnedObjects",
      params: [
        characterId,
        {
          filter: { StructType: capType },
          options: { showContent: true },
        },
        null,
        50,
      ],
    }),
  });
  const json = await res.json();
  const caps = new Map<string, string>();
  const data = json.result?.data ?? [];
  for (const obj of data) {
    const fields = obj?.data?.content?.fields;
    const capId = obj?.data?.objectId;
    const ssuId = fields?.authorized_object_id;
    if (capId && ssuId) {
      caps.set(ssuId, capId);
    }
  }
  return caps;
}

async function fetchWalletItems(
  walletAddress: string,
  worldApi: string,
  nameCache: Map<number, string>,
  characterId?: string,
): Promise<WalletItem[]> {
  const itemType = `${WORLD_PKG}::inventory::Item`;
  // Search both wallet address AND character object for loose Items
  const addresses = [walletAddress];
  if (characterId) addresses.push(characterId);
  const allData: any[] = [];
  for (const addr of addresses) {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_getOwnedObjects",
        params: [
          addr,
          {
            filter: { StructType: itemType },
            options: { showContent: true },
          },
          null,
          50,
        ],
      }),
    });
    const json = await res.json();
    allData.push(...(json.result?.data ?? []));
  }
  // Deduplicate by objectId
  const seen = new Set<string>();
  const items: WalletItem[] = [];
  for (const obj of allData) {
    const objectId = obj?.data?.objectId;
    const fields = obj?.data?.content?.fields;
    if (!objectId || !fields || seen.has(objectId)) continue;
    seen.add(objectId);
    const typeId = Number(fields.type_id ?? 0);
    const quantity = Number(fields.quantity ?? 1);
    const parentId = fields.parent_id as string | undefined;
    const name = await resolveItemName(typeId, worldApi, nameCache);
    items.push({ objectId, typeId, quantity, name, parentId });
  }
  return items;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CapacityBar({ used, max }: { used: number; max: number }) {
  const pct = max > 0 ? Math.min(1, used / max) : 0;
  return (
    <div
      style={{
        height: 3,
        background: "rgba(255,71,0,0.1)",
        borderRadius: 0,
        overflow: "hidden",
        margin: "4px 0 8px",
      }}
    >
      <div
        style={{
          width: `${(pct * 100).toFixed(1)}%`,
          height: "100%",
          background: "#FF4700",
          transition: "width 0.3s",
        }}
      />
    </div>
  );
}

const COL_NAME = { flex: "1 1 180px", minWidth: 0 };
const COL_TID  = { width: 80,  flexShrink: 0, textAlign: "right" as const };
const COL_QTY  = { width: 70,  flexShrink: 0, textAlign: "right" as const };
const COL_VOL  = { width: 80,  flexShrink: 0, textAlign: "right" as const };
const COL_TOT  = { width: 90,  flexShrink: 0, textAlign: "right" as const };
// COL_ACT widened from 90→30px to fit the qty input (44px) + 4px gap + WITHDRAW
// button (~75px) without overlapping the TOTAL VOL column. Without this the
// qty input visually sits on top of the total-vol value.
const COL_ACT  = { width: 140, flexShrink: 0, textAlign: "right" as const };

// EVE Frontier on-chain volumes are stored as u64 with an implicit ×100
// scale factor (2 decimal places). Raw value 400,000 = 4,000.00 m³.
// Confirmed empirically 2026-04-26 by Raw against in-game capacity totals.
// Centralize the conversion + formatting so all four display sites (per-item
// vol, total vol per row, used capacity, max capacity) stay consistent.
const VOLUME_SCALE = 100;
function formatVolume(rawU64: number): string {
  if (!Number.isFinite(rawU64)) return "—";
  return (rawU64 / VOLUME_SCALE).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type SSUCardProps = {
  inv: SSUInventory;
  characterId: string | null;
  ownerCaps: Map<string, string>;
  dAppKit: ReturnType<typeof useDAppKit>;
  walletAddress: string | undefined;
  allSsuIds: string[];
  onRefresh: (ssuObjectId: string) => void;
  /** When true the card body (capacity, item table, shared access editor)
   *  is hidden and only the header chrome is rendered. The tx status
   *  banner remains visible so the user can still see batch-move /
   *  withdraw outcomes after collapsing. */
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** The caller's OwnerCap<Character> object ID. Needed to build the
   *  promote_ephemeral_to_shared PTB. Null when not yet resolved. */
  charOwnerCapId: string | null;
};

function SSUCard({ inv, characterId, ownerCaps, dAppKit, walletAddress, onRefresh, collapsed, onToggleCollapse, charOwnerCapId }: SSUCardProps) {
  const { ssu, items, resolvedNames, loading, error, policy } = inv;
  const [withdrawingTypeId, setWithdrawingTypeId] = useState<number | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  // Per-row withdraw-quantity overrides keyed by `${typeId}|${partition}`.
  // Default (absent / empty / NaN) = full stack. Lets the user pull a
  // partial qty out of a shared-deposit pool. Bounded client-side to
  // [1, item.quantity] before tx; on-chain `inventory.withdraw_item` will
  // also abort if qty > stored qty, but failing fast in the UI saves a
  // wasted signature.
  const [withdrawQty, setWithdrawQty] = useState<Map<string, string>>(new Map());
  // True while a batch "Move All to Shared" tx is in flight.
  const [batchMovingAll, setBatchMovingAll] = useState(false);

  // Resolve the user's *current* tribe_id from chain (Character object).
  // Used to pre-populate ssu_access tribe-policy editors and badge own tribe.
  // We re-fetch on walletAddress change. Don't trust cached numbers from
  // session memory — there are multiple tribes on Stillness with the same
  // "Reapers" name (98000004 vs 98000425) and a stale id breaks defaults.
  const [ownTribeId, setOwnTribeId] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!walletAddress) { setOwnTribeId(undefined); return; }
    let cancelled = false;
    fetchCharacterTribeId(walletAddress).then(t => {
      if (!cancelled) setOwnTribeId(t ?? undefined);
    }).catch(() => { if (!cancelled) setOwnTribeId(undefined); });
    return () => { cancelled = true; };
  }, [walletAddress]);

  // Auto-refresh inventory state every 30s. Each card runs its own timer
  // to avoid coupling SSU cards together. Skips refresh while loading or
  // a withdraw/deposit is mid-flight so we don't double-fire onRefresh.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && withdrawingTypeId === null) {
        onRefresh(ssu.objectId);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [ssu.objectId, loading, withdrawingTypeId, onRefresh]);


  const ownerCapId = ownerCaps.get(ssu.objectId);

  // Can the current caller withdraw from this SSU's shared inventory? True
  // iff a policy is attached AND it permits withdrawals for this caller's
  // identity (tribe / allowlist / public). Owner self-withdraw via OwnerCap
  // is intentionally NOT exposed here — the owner-cap borrow flow had
  // historical bugs and shared-path withdrawal is the primary affordance now.
  const canWithdrawShared: boolean = (() => {
    if (!policy?.policyId || !characterId) return false;
    return canWithdrawVia(policy.mode, {
      characterObjectId: characterId,
      ownTribeId,
    });
  })();

  // Owner can move items from owner_main → open partition iff:
  //   1. They are the SSU owner (ownerCapId resolved on this Character)
  //   2. A policy is attached (policyId resolved)
  //   3. The policy permits THIS owner's character to deposit (canDepositVia).
  //      `mode == none` blocks the move; the owner must enable a real mode
  //      first (TRIBE / ALLOWLIST / HYBRID / PUBLIC) so check_access returns
  //      true. The button text encodes the consequence of skipping this
  //      gate ("requires shared mode" tooltip).
  const canMoveOwnerToShared: boolean = (() => {
    if (!ownerCapId || !characterId || !policy?.policyId) return false;
    return canDepositVia(policy.mode, {
      characterObjectId: characterId,
      ownTribeId,
    });
  })();

  // Non-owner: can promote items from their per-character partition → shared open
  // inventory. Requires:
  //   1. No ownerCapId (they are NOT the SSU owner — owner has a direct path)
  //   2. Policy exists with a non-none mode
  //   3. Policy permits their deposits
  //   4. charOwnerCapId resolved (needed for the borrow_owner_cap<Character> PTB)
  // On-chain, promote_ephemeral_to_shared re-checks the policy for defense-in-depth.
  const canPromoteToShared: boolean = (() => {
    if (!characterId || !policy?.policyId || !charOwnerCapId) return false;
    if (policy.mode.kind === "none") return false;
    return canDepositVia(policy.mode, {
      characterObjectId: characterId,
      ownTribeId,
    });
  })();

  // Shared-path withdraw — calls cradleos::ssu_access::shared_withdraw_to_character.
  // The Move function moves the Item directly into the caller's Character
  // inventory, so we do NOT need a transferObjects step here.
  //
  // PARTITION GUARD: this Move path internally calls
  // su::withdraw_from_open_inventory, which only reads the SSU's open
  // partition. If we tried to withdraw an item that lives in the
  // owner_main partition (deposited via in-game client / deposit_by_owner),
  // the base inventory module aborts with EItemDoesNotExist (line 350).
  // The UI only renders WITHDRAW for partition==="open" rows, but we
  // assert here too as defense-in-depth in case row state drifts.
  async function handleSharedWithdraw(item: InventoryItem) {
    if (!characterId || !policy?.policyId) return;
    if (item.partition !== "open") {
      setTxError(
        `Cannot shared-withdraw from "${item.partition}" partition. ` +
        "Only items in the open partition (deposited via Shared Deposit) " +
        "are accessible to tribemates."
      );
      return;
    }
    // Resolve the requested quantity from per-row override (or full stack
    // if absent / blank / NaN). Clamp to [1, stack] so we never submit
    // a tx that we know will abort. The on-chain inventory.withdraw_item
    // also asserts qty <= stored qty as belt-and-braces.
    const qtyKey = `${item.typeId}|${item.partition}`;
    const qtyRaw = withdrawQty.get(qtyKey);
    const qtyParsed = qtyRaw ? Number(qtyRaw) : item.quantity;
    const qty = Number.isFinite(qtyParsed) && qtyParsed > 0
      ? Math.min(Math.floor(qtyParsed), item.quantity)
      : item.quantity;
    if (qty < 1) {
      setTxError(`Invalid withdraw quantity: ${qtyRaw}`);
      return;
    }
    setWithdrawingTypeId(item.typeId);
    setTxStatus(null);
    setTxError(null);
    try {
      const tx = new Transaction();

      if (ownerCapId) {
        // SSU OWNER smart-routing path. The base shared_withdraw_to_character
        // helper transfers the Item to character_address() (the wallet),
        // making it INVISIBLE to the in-game client (which only renders
        // Inventory partitions inside Assemblies, never free-floating wallet
        // objects). Bug surfaced by Raw on 2026-04-26: Exclave Technocore
        // withdraw landed in wallet, no in-game-client UI exposed re-import.
        //
        // Fix: pull the Item out via shared_withdraw (returns Item handle),
        // then immediately deposit_by_owner back into THIS SAME SSU's
        // owner_main partition. Item never lands in wallet, stays visible
        // in the in-game client. One signature.
        const withdrawn = appendSharedWithdrawReturningItem(tx, {
          ssuObjectId: ssu.objectId,
          policyId: policy.policyId,
          characterObjectId: characterId,
          typeId: item.typeId,
          quantity: qty,
        });

        const [cap, receipt] = tx.moveCall({
          target: `${WORLD_PKG}::character::borrow_owner_cap`,
          typeArguments: [`${WORLD_PKG}::storage_unit::StorageUnit`],
          arguments: [
            tx.object(characterId),
            tx.object(ownerCapId),
          ],
        });

        tx.moveCall({
          target: `${WORLD_PKG}::storage_unit::deposit_by_owner`,
          typeArguments: [`${WORLD_PKG}::storage_unit::StorageUnit`],
          arguments: [
            tx.object(ssu.objectId),
            withdrawn,
            tx.object(characterId),
            cap,
          ],
        });

        tx.moveCall({
          target: `${WORLD_PKG}::character::return_owner_cap`,
          typeArguments: [`${WORLD_PKG}::storage_unit::StorageUnit`],
          arguments: [
            tx.object(characterId),
            cap,
            receipt,
          ],
        });
      } else {
        // NON-OWNER path (tribemate / allowlisted / public). v12 of
        // cradleos::ssu_access introduced `shared_withdraw_to_owned` which
        // routes the Item directly into the caller's per-character
        // partition on the SAME SSU. The item stays visible in the
        // in-game inventory window under the caller's character, instead
        // of landing in the wallet as a free-floating Item the in-game
        // client can't render.
        //
        // Old behavior (v10/v11): `shared_withdraw_to_character` did
        // `public_transfer(item, character_address)` → wallet limbo.
        // Items already stranded that way can be rescued via the Wallet
        // Stuck Items section (see WalletStuckItemsSection below).
        appendSharedWithdrawToOwned(tx, {
          ssuObjectId: ssu.objectId,
          policyId: policy.policyId,
          characterObjectId: characterId,
          typeId: item.typeId,
          quantity: qty,
        });
      }

      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      const itemName = resolvedNames.get(item.typeId) ?? `type_id ${item.typeId}`;
      // After v12, both branches land the item in an SSU partition visible
      // to the in-game client — owner branch routes to owner_main, non-owner
      // branch routes to caller's per-character partition.
      const dest = ownerCapId
        ? "owner partition (visible in-game)"
        : "your partition on this SSU (visible in-game)";
      setTxStatus(`Withdrew ${qty}× ${itemName} → ${dest}`);
      // Clear the per-row qty override after a successful tx so the next
      // render shows the (refreshed) full stack as default again.
      setWithdrawQty(prev => {
        const next = new Map(prev);
        next.delete(qtyKey);
        return next;
      });
      // Defer refresh ~1.5s: RPC indexer needs time to reflect the new
      // partition state after the tx commits. Refreshing immediately races
      // and returns stale data.
      setTimeout(() => onRefresh(ssu.objectId), 1500);
    } catch (err: any) {
      setTxError(err?.message ?? String(err));
    } finally {
      setWithdrawingTypeId(null);
    }
  }

  // Move an item from the SSU's owner_main (private) partition to its open
  // (shared) partition in a single PTB:
  //
  //   borrow_owner_cap → withdraw_by_owner (returns Item handle in tx) →
  //   shared_deposit (consumes Item handle) → return_owner_cap
  //
  // The Item never lands in the wallet — it flows directly from one moveCall
  // result into the next, so the historical owner-direct-withdraw-to-wallet
  // bug doesn't apply. Single signature.
  //
  // Permission gate: only the SSU owner has an OwnerCap, AND the policy must
  // permit the owner's character to deposit (canDepositVia). Render the
  // button only when both are true. The on-chain `shared_deposit` will also
  // re-check `check_access` for defense-in-depth.
  async function handleMoveToShared(item: InventoryItem) {
    if (!characterId || !ownerCapId || !policy?.policyId) return;
    if (item.partition !== "owner_main") {
      setTxError(
        `Cannot move from "${item.partition}" partition. ` +
        "Only items in the owner partition can be moved to shared."
      );
      return;
    }
    setWithdrawingTypeId(item.typeId);
    setTxStatus(null);
    setTxError(null);
    try {
      const tx = new Transaction();

      // Borrow OwnerCap from Character
      const [cap, receipt] = tx.moveCall({
        target: `${WORLD_PKG}::character::borrow_owner_cap`,
        typeArguments: [`${WORLD_PKG}::storage_unit::StorageUnit`],
        arguments: [
          tx.object(characterId),
          tx.object(ownerCapId),
        ],
      });

      // Withdraw from owner_main partition (returns Item handle)
      const withdrawn = tx.moveCall({
        target: `${WORLD_PKG}::storage_unit::withdraw_by_owner`,
        typeArguments: [`${WORLD_PKG}::storage_unit::StorageUnit`],
        arguments: [
          tx.object(ssu.objectId),
          tx.object(characterId),
          cap,
          tx.pure.u64(item.typeId),
          tx.pure.u32(item.quantity),
        ],
      });

      // Deposit immediately into open partition via cradleos::ssu_access
      appendSharedDepositItemArg(tx, {
        ssuObjectId: ssu.objectId,
        policyId: policy.policyId,
        characterObjectId: characterId,
        itemArg: withdrawn,
      });

      // Return OwnerCap
      tx.moveCall({
        target: `${WORLD_PKG}::character::return_owner_cap`,
        typeArguments: [`${WORLD_PKG}::storage_unit::StorageUnit`],
        arguments: [
          tx.object(characterId),
          cap,
          receipt,
        ],
      });

      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      const itemName = resolvedNames.get(item.typeId) ?? `type_id ${item.typeId}`;
      setTxStatus(`Moved ${item.quantity}× ${itemName} from owner partition to shared`);
      setTimeout(() => onRefresh(ssu.objectId), 1500);
    } catch (err: any) {
      setTxError(err?.message ?? String(err));
    } finally {
      setWithdrawingTypeId(null);
    }
  }

  // BATCH: Move every owner_main row → open partition in a single PTB.
  // Borrow OwnerCap once at the top of the tx, loop each owner-private
  // type_id through (withdraw_by_owner → shared_deposit), return OwnerCap
  // once at the bottom. One signature regardless of stack count.
  //
  // Sui PTB hard cap is ~1024 commands per tx. Each item costs 2 commands
  // (withdraw + shared_deposit) plus 2 fixed (borrow + return). Soft-cap
  // at 100 type_ids per batch (200 commands) to stay well under the
  // ceiling and bound gas. If a card has more owner stacks than that the
  // user can run the batch twice.
  const BATCH_MOVE_ALL_LIMIT = 100;
  async function handleMoveAllOwnerToShared() {
    if (!characterId || !ownerCapId || !policy?.policyId) return;
    const ownerRows = items.filter(i => i.partition === "owner_main" && i.quantity > 0);
    if (ownerRows.length === 0) {
      setTxError("No owner-private items to move.");
      return;
    }
    if (ownerRows.length > BATCH_MOVE_ALL_LIMIT) {
      setTxError(
        `Too many owner stacks (${ownerRows.length}). Sui PTB command budget ` +
        `forces a per-tx cap of ${BATCH_MOVE_ALL_LIMIT} type_ids. Run the batch ` +
        `twice (it will pick up whatever's left after the first refresh).`
      );
      return;
    }
    setBatchMovingAll(true);
    setTxStatus(null);
    setTxError(null);
    try {
      const tx = new Transaction();

      // Borrow OwnerCap ONCE at the top.
      const [cap, receipt] = tx.moveCall({
        target: `${WORLD_PKG}::character::borrow_owner_cap`,
        typeArguments: [`${WORLD_PKG}::storage_unit::StorageUnit`],
        arguments: [
          tx.object(characterId),
          tx.object(ownerCapId),
        ],
      });

      // Loop: withdraw each owner stack → deposit to shared.
      let totalMoved = 0;
      for (const row of ownerRows) {
        const withdrawn = tx.moveCall({
          target: `${WORLD_PKG}::storage_unit::withdraw_by_owner`,
          typeArguments: [`${WORLD_PKG}::storage_unit::StorageUnit`],
          arguments: [
            tx.object(ssu.objectId),
            tx.object(characterId),
            cap,
            tx.pure.u64(row.typeId),
            tx.pure.u32(row.quantity),
          ],
        });
        appendSharedDepositItemArg(tx, {
          ssuObjectId: ssu.objectId,
          policyId: policy.policyId,
          characterObjectId: characterId,
          itemArg: withdrawn,
        });
        totalMoved += row.quantity;
      }

      // Return OwnerCap ONCE at the bottom.
      tx.moveCall({
        target: `${WORLD_PKG}::character::return_owner_cap`,
        typeArguments: [`${WORLD_PKG}::storage_unit::StorageUnit`],
        arguments: [
          tx.object(characterId),
          cap,
          receipt,
        ],
      });

      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setTxStatus(
        `Moved ${totalMoved.toLocaleString()} item(s) across ${ownerRows.length} stack(s) → shared partition`
      );
      setTimeout(() => onRefresh(ssu.objectId), 1500);
    } catch (err: any) {
      setTxError(err?.message ?? String(err));
    } finally {
      setBatchMovingAll(false);
    }
  }

  // Promote items from the caller's per-character (ephemeral / [locked]) partition
  // into the SSU's shared open inventory. This is the inverse of shared_withdraw_to_owned.
  // Requires the caller's OwnerCap<Character> (charOwnerCapId) to authorize the
  // withdraw_by_owner<Character> call on-chain.
  async function handlePromoteToShared(item: InventoryItem) {
    if (!characterId || !policy?.policyId || !charOwnerCapId) return;
    if (item.partition !== "unknown") {
      setTxError(
        `Promote only applies to items in the locked/ephemeral partition. ` +
        `This item is in "${item.partition}" partition.`
      );
      return;
    }
    const qtyKey = `${item.typeId}|${item.partition}`;
    const qtyRaw = withdrawQty.get(qtyKey);
    const qtyParsed = qtyRaw ? Number(qtyRaw) : item.quantity;
    const qty = Number.isFinite(qtyParsed) && qtyParsed > 0
      ? Math.min(Math.floor(qtyParsed), item.quantity)
      : item.quantity;
    if (qty < 1) {
      setTxError(`Invalid quantity: ${qtyRaw}`);
      return;
    }
    setWithdrawingTypeId(item.typeId);
    setTxStatus(null);
    setTxError(null);
    try {
      const tx = buildPromoteToSharedTx(
        ssu.objectId,
        characterId,
        policy.policyId,
        item.typeId,
        qty,
        charOwnerCapId,
      );
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      const itemName = resolvedNames.get(item.typeId) ?? `type_id ${item.typeId}`;
      setTxStatus(`Promoted ${qty}× ${itemName} from locked partition → shared pool`);
      setWithdrawQty(prev => {
        const next = new Map(prev);
        next.delete(qtyKey);
        return next;
      });
      setTimeout(() => onRefresh(ssu.objectId), 1500);
    } catch (err: any) {
      setTxError(err?.message ?? String(err));
    } finally {
      setWithdrawingTypeId(null);
    }
  }

  const nonZero = items.filter(i => i.quantity > 0);
  const totalVol = nonZero.reduce((acc, i) => acc + i.volume * i.quantity, 0);
  const usedCap = inv.usedCapacity > 0 ? inv.usedCapacity : totalVol;
  const maxCap = inv.maxCapacity > 0 ? inv.maxCapacity : 2_000_000;
  const suffix = ssu.objectId.slice(-6);

  // Withdraw item from SSU to wallet
  // @ts-expect-error withdraw disabled
async function _handleWithdraw(item: InventoryItem) {
    if (!characterId || !ownerCapId || !walletAddress) return;
    setWithdrawingTypeId(item.typeId);
    setTxStatus(null);
    setTxError(null);
    try {
      const tx = new Transaction();

      // Borrow OwnerCap from Character
      const [cap, receipt] = tx.moveCall({
        target: `${WORLD_PKG}::character::borrow_owner_cap`,
        typeArguments: [`${WORLD_PKG}::storage_unit::StorageUnit`],
        arguments: [
          tx.object(characterId),
          tx.object(ownerCapId),
        ],
      });

      // Withdraw item
      const withdrawn = tx.moveCall({
        target: `${WORLD_PKG}::storage_unit::withdraw_by_owner`,
        typeArguments: [`${WORLD_PKG}::storage_unit::StorageUnit`],
        arguments: [
          tx.object(ssu.objectId),
          tx.object(characterId),
          cap,
          tx.pure.u64(item.typeId),
          tx.pure.u32(item.quantity),
        ],
      });

      // Return OwnerCap
      tx.moveCall({
        target: `${WORLD_PKG}::character::return_owner_cap`,
        typeArguments: [`${WORLD_PKG}::storage_unit::StorageUnit`],
        arguments: [
          tx.object(characterId),
          cap,
          receipt,
        ],
      });

      // Send Item to wallet
      tx.transferObjects([withdrawn], tx.pure.address(walletAddress));

      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      const itemName = resolvedNames.get(item.typeId) ?? `type_id ${item.typeId}`;
      setTxStatus(`Withdrew ${item.quantity}x ${itemName} to wallet`);
      setTimeout(() => onRefresh(ssu.objectId), 1500);
    } catch (err: any) {
      setTxError(err?.message ?? String(err));
    }
  }

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,71,0,0.15)",
        borderRadius: 0,
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      {/* Header. Click anywhere on the header chrome (except the buttons
          which stop propagation) to toggle collapse. The chevron is the
          primary affordance; clicking the title bar or status pill works
          too so the click target is large. */}
      <div
        onClick={onToggleCollapse}
        title={collapsed ? "Expand this storage" : "Collapse this storage"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          borderBottom: collapsed ? "none" : "1px solid rgba(255,71,0,0.1)",
          background: "rgba(255,71,0,0.04)",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span
          style={{
            color: "rgba(255,71,0,0.7)",
            fontFamily: "monospace",
            fontSize: 10,
            width: 12,
            display: "inline-block",
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          {collapsed ? "▶" : "▼"}
        </span>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: ssu.isOnline ? "#00ff96" : "#888",
            boxShadow: ssu.isOnline ? "0 0 5px #00ff96" : "none",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            color: "#FF4700",
            fontFamily: "monospace",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.06em",
          }}
        >
          {ssu.displayName}
        </span>
        <span style={{ color: "rgba(107,107,94,0.5)", fontFamily: "monospace", fontSize: 10 }}>
          #{suffix}
        </span>
        <span
          style={{
            marginLeft: 6,
            fontSize: 10,
            fontFamily: "monospace",
            color: ssu.isOnline ? "#00ff96" : "#888",
            letterSpacing: "0.1em",
          }}
        >
          {ssu.isOnline ? "ONLINE" : "OFFLINE"}
        </span>
        {/* SHARED badge — indicates the caller does NOT own this SSU but
            has access to it via a shared-access policy. Color-coded by
            policy mode for at-a-glance recognition. */}
        {inv.sharedFrom && (
          <span
            title={`Surfaced via shared-access policy (${inv.sharedFrom}). You don't own this storage — the owner has granted you access through cradleos::ssu_access.`}
            style={{
              fontSize: 9,
              fontFamily: "monospace",
              letterSpacing: "0.1em",
              color:
                inv.sharedFrom === "public" ? "#9ad6ff" :
                inv.sharedFrom === "allowlist" ? "#ffc850" :
                "#00ff96",
              border: `1px solid ${
                inv.sharedFrom === "public" ? "rgba(154,214,255,0.4)" :
                inv.sharedFrom === "allowlist" ? "rgba(255,200,80,0.4)" :
                "rgba(0,255,150,0.4)"
              }`,
              padding: "1px 5px",
              borderRadius: 0,
            }}
          >
            SHARED · {inv.sharedFrom.toUpperCase()}
          </span>
        )}
        {ssu.typeId !== undefined && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 9,
              fontFamily: "monospace",
              color: "rgba(107,107,94,0.4)",
              letterSpacing: "0.08em",
            }}
          >
            [type_id: {ssu.typeId}]
          </span>
        )}
        {/* Batch "Move All Owner → Shared" button. Only renders when:
            (a) caller owns this SSU,
            (b) policy permits owner deposits (canMoveOwnerToShared),
            (c) at least one owner_main row has nonzero qty. One signature
            for the entire batch via a single PTB. */}
        {canMoveOwnerToShared &&
          items.some(i => i.partition === "owner_main" && i.quantity > 0) && (
          <button
            onClick={(e) => { e.stopPropagation(); handleMoveAllOwnerToShared(); }}
            disabled={batchMovingAll || withdrawingTypeId !== null}
            title={`Move ALL owner-private stacks → shared partition in a single signature. Tribemates with shared access (${policy ? modeLabel(policy.mode) : "shared"}) will then be able to withdraw any of them.`}
            style={{
              marginLeft: ssu.typeId !== undefined ? 8 : "auto",
              fontSize: 9,
              fontFamily: "monospace",
              letterSpacing: "0.08em",
              background: "transparent",
              border: "1px solid rgba(255,200,80,0.5)",
              color: batchMovingAll ? "rgba(255,200,80,0.4)" : "#ffc850",
              padding: "2px 6px",
              cursor: (batchMovingAll || withdrawingTypeId !== null) ? "wait" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {batchMovingAll ? "… batch" : "↪ ALL→SHARED"}
          </button>
        )}
        {/* Manual refresh button. Always rendered to give a guaranteed
            recovery path when an auto-refresh races the RPC indexer or
            the user wants to force-pull current state. */}
        <button
          onClick={(e) => { e.stopPropagation(); onRefresh(ssu.objectId); }}
          disabled={loading}
          title="Refresh this SSU's inventory and policy state from chain"
          style={{
            marginLeft: (canMoveOwnerToShared && items.some(i => i.partition === "owner_main" && i.quantity > 0))
              ? 8
              : (ssu.typeId !== undefined ? 8 : "auto"),
            fontSize: 9,
            fontFamily: "monospace",
            letterSpacing: "0.08em",
            background: "transparent",
            border: "1px solid rgba(0,255,150,0.3)",
            color: loading ? "rgba(0,255,150,0.3)" : "#00ff96",
            padding: "2px 6px",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "…" : "↻ REFRESH"}
        </button>
      </div>

      {/* Tx status/error banner */}
      {(txStatus || txError) && (
        <div
          style={{
            padding: "6px 14px",
            fontFamily: "monospace",
            fontSize: 11,
            borderBottom: "1px solid rgba(255,71,0,0.08)",
            color: txError ? "#ff6b6b" : "#00ff96",
            background: txError ? "rgba(255,107,107,0.05)" : "rgba(0,255,150,0.04)",
          }}
        >
          {txError ? `ERR: ${txError}` : txStatus}
        </div>
      )}

      {!collapsed && (<>
      {/* Capacity */}
      <div style={{ padding: "6px 14px 0" }}>
        <div
          style={{
            fontSize: 10,
            fontFamily: "monospace",
            color: "rgba(107,107,94,0.55)",
            letterSpacing: "0.08em",
          }}
        >
          CAPACITY: {formatVolume(usedCap)} / {formatVolume(maxCap)} m³
        </div>
        <CapacityBar used={usedCap} max={maxCap} />
      </div>

      {/* Body */}
      <div style={{ padding: "0 14px 10px" }}>
        {loading ? (
          <div
            style={{
              color: "rgba(107,107,94,0.4)",
              fontFamily: "monospace",
              fontSize: 11,
              padding: "10px 0",
            }}
          >
            loading inventory…
          </div>
        ) : error ? (
          <div
            style={{
              color: "#ff6b6b",
              fontFamily: "monospace",
              fontSize: 11,
              padding: "10px 0",
            }}
          >
            ERR: {error}
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: "4px 0 4px",
                borderBottom: "1px solid rgba(255,71,0,0.08)",
                marginBottom: 4,
              }}
            >
              {[
                { label: "ITEM NAME", style: COL_NAME },
                { label: "TYPE_ID",   style: COL_TID  },
                { label: "QTY",       style: COL_QTY  },
                { label: "VOL EACH",  style: COL_VOL  },
                { label: "TOTAL VOL", style: COL_TOT  },
                ...(ownerCapId ? [{ label: "ACTION", style: COL_ACT }] : []),
              ].map(({ label, style }) => (
                <div
                  key={label}
                  style={{
                    ...style,
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: "rgba(107,107,94,0.55)",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Rows */}
            {nonZero.length === 0 ? (
              <div
                style={{
                  color: "rgba(107,107,94,0.3)",
                  fontFamily: "monospace",
                  fontSize: 11,
                  padding: "8px 0",
                  fontStyle: "italic",
                }}
              >
                No items
              </div>
            ) : (
              nonZero.map((item) => {
                const name =
                  resolvedNames.get(item.typeId) ?? `type_id ${item.typeId}`;
                const totalItemVol = item.volume * item.quantity;
                // Per-row spinner state: a typeId may exist in BOTH partitions,
                // so key the spinner on (typeId, partition).
                const isWithdrawing =
                  withdrawingTypeId === item.typeId && item.partition === "open";
                const partitionBadge: { label: string; color: string; tip: string } | null =
                  item.partition === "open"
                    ? { label: "shared",  color: "rgba(0,255,150,0.55)",  tip: "Open partition — tribe/allowlist members with shared access can withdraw." }
                    : item.partition === "owner_main"
                    ? { label: "owner",   color: "rgba(255,200,80,0.55)", tip: "Owner-private partition (deposited via in-game client). Not withdrawable by tribemates." }
                    : { label: "locked",  color: "rgba(255,255,255,0.25)", tip: "Non-shared partition (per-accessor lockbox or unrecognized). Not withdrawable by tribemates." };
                return (
                  <div
                    key={`${item.typeId}│${item.partition}`}
                    style={{
                      display: "flex",
                      gap: 8,
                      padding: "3px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        ...COL_NAME,
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "#c8c8b8",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                      }}
                      title={name}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                      {partitionBadge && (
                        <span
                          title={partitionBadge.tip}
                          style={{
                            fontSize: 9,
                            letterSpacing: "0.05em",
                            border: `1px solid ${partitionBadge.color}`,
                            color: partitionBadge.color,
                            padding: "0 4px",
                            borderRadius: 2,
                            flexShrink: 0,
                          }}
                        >
                          {partitionBadge.label}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        ...COL_TID,
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "rgba(107,107,94,0.55)",
                      }}
                    >
                      {item.typeId}
                    </div>
                    <div
                      style={{
                        ...COL_QTY,
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "#c8c8b8",
                      }}
                    >
                      {item.quantity.toLocaleString()}
                    </div>
                    <div
                      style={{
                        ...COL_VOL,
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "rgba(107,107,94,0.7)",
                      }}
                    >
                      {formatVolume(item.volume)}
                    </div>
                    <div
                      style={{
                        ...COL_TOT,
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "#c8c8b8",
                      }}
                    >
                      {formatVolume(totalItemVol)}
                    </div>
                    <div style={{ ...COL_ACT }}>
                      {canWithdrawShared && item.partition === "open" ? (
                        <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "flex-end" }}>
                          <input
                            type="number"
                            min={1}
                            max={item.quantity}
                            placeholder={String(item.quantity)}
                            value={withdrawQty.get(`${item.typeId}|${item.partition}`) ?? ""}
                            onChange={e => {
                              const v = e.target.value;
                              setWithdrawQty(prev => {
                                const next = new Map(prev);
                                if (v === "") next.delete(`${item.typeId}|${item.partition}`);
                                else next.set(`${item.typeId}|${item.partition}`, v);
                                return next;
                              });
                            }}
                            disabled={isWithdrawing}
                            title={`Quantity to withdraw (max ${item.quantity}). Leave blank to withdraw the full stack.`}
                            style={{
                              width: 44,
                              fontSize: 10,
                              fontFamily: "monospace",
                              background: "rgba(0,0,0,0.3)",
                              border: "1px solid rgba(0,255,150,0.25)",
                              color: "#c8c8b8",
                              padding: "2px 4px",
                              textAlign: "right",
                              MozAppearance: "textfield" as const,
                            }}
                          />
                          <button
                            onClick={() => handleSharedWithdraw(item)}
                            disabled={isWithdrawing}
                            title={`Withdraw via shared (${policy ? modeLabel(policy.mode) : "shared"}) — lands in ${ownerCapId ? "owner partition (visible in-game)" : "wallet (free-floating)"}`}
                            style={{
                              fontSize: 10,
                              fontFamily: "monospace",
                              letterSpacing: "0.08em",
                              background: "transparent",
                              border: "1px solid rgba(0,255,150,0.4)",
                              color: isWithdrawing ? "rgba(0,255,150,0.4)" : "#00ff96",
                              padding: "2px 6px",
                              cursor: isWithdrawing ? "wait" : "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {isWithdrawing ? "…" : "WITHDRAW"}
                          </button>
                        </div>
                      ) : item.partition === "owner_main" ? (
                        // Owner-only stack. If the caller IS the owner AND a
                        // shared-access policy permits their deposits, offer
                        // a one-click move-to-shared (single PTB:
                        // borrow_owner_cap → withdraw_by_owner → shared_deposit
                        // → return_owner_cap). Otherwise just show the
                        // "owner-only" label as before.
                        canMoveOwnerToShared ? (
                          <button
                            onClick={() => handleMoveToShared(item)}
                            disabled={withdrawingTypeId === item.typeId}
                            title={`Move ${item.quantity}× from owner-private → shared partition (single signature). Tribemates with shared access (${policy ? modeLabel(policy.mode) : "shared"}) will then be able to withdraw.`}
                            style={{
                              fontSize: 10,
                              fontFamily: "monospace",
                              letterSpacing: "0.08em",
                              background: "transparent",
                              border: "1px solid rgba(255,200,80,0.5)",
                              color:
                                withdrawingTypeId === item.typeId
                                  ? "rgba(255,200,80,0.4)"
                                  : "#ffc850",
                              padding: "2px 6px",
                              cursor:
                                withdrawingTypeId === item.typeId
                                  ? "wait"
                                  : "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {withdrawingTypeId === item.typeId ? "…" : "↪ SHARED"}
                          </button>
                        ) : ownerCapId ? (
                          <span
                            title="You own this SSU but no shared-access policy is configured (or the active policy doesn't permit your character to deposit). Open Shared Access below to enable TRIBE / ALLOWLIST / HYBRID / PUBLIC mode, then this button will appear."
                            style={{ fontSize: 9, color: "rgba(255,200,80,0.6)", fontStyle: "italic" }}
                          >
                            owner-only
                          </span>
                        ) : (
                          <span
                            title="This stack is in the owner-private partition (deposited via the in-game client or deposit_by_owner). Tribemates cannot withdraw it. The owner can move it to shared via Shared Access."
                            style={{ fontSize: 9, color: "rgba(255,200,80,0.6)", fontStyle: "italic" }}
                          >
                            owner-only
                          </span>
                        )
                      ) : item.partition === "unknown" ? (
                        canPromoteToShared ? (
                          // Per-character (ephemeral) partition items the caller can promote to shared.
                          // Uses promote_ephemeral_to_shared (v4 cradleos_ssu_access) which calls
                          // withdraw_by_owner<Character> + deposit_to_open_inventory<SsuAuth>.
                          <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "flex-end" }}>
                            <input
                              type="number"
                              min={1}
                              max={item.quantity}
                              placeholder={String(item.quantity)}
                              value={withdrawQty.get(`${item.typeId}|${item.partition}`) ?? ""}
                              onChange={e => {
                                const v = e.target.value;
                                setWithdrawQty(prev => {
                                  const next = new Map(prev);
                                  if (v === "") next.delete(`${item.typeId}|${item.partition}`);
                                  else next.set(`${item.typeId}|${item.partition}`, v);
                                  return next;
                                });
                              }}
                              disabled={withdrawingTypeId === item.typeId}
                              title={`Quantity to promote to shared pool (max ${item.quantity}). Leave blank for full stack.`}
                              style={{
                                width: 44,
                                fontSize: 10,
                                fontFamily: "monospace",
                                background: "rgba(0,0,0,0.3)",
                                border: "1px solid rgba(255,200,80,0.25)",
                                color: "#c8c8b8",
                                padding: "2px 4px",
                                textAlign: "right",
                                MozAppearance: "textfield" as const,
                              }}
                            />
                            <button
                              onClick={() => handlePromoteToShared(item)}
                              disabled={withdrawingTypeId === item.typeId}
                              title={`Move ${item.quantity}× from your locked/ephemeral partition into the shared open pool. Others with access (${policy ? modeLabel(policy.mode) : "shared"}) can then withdraw.`}
                              style={{
                                fontSize: 10,
                                fontFamily: "monospace",
                                letterSpacing: "0.08em",
                                background: "transparent",
                                border: "1px solid rgba(255,200,80,0.5)",
                                color: withdrawingTypeId === item.typeId ? "rgba(255,200,80,0.4)" : "#ffc850",
                                padding: "2px 6px",
                                cursor: withdrawingTypeId === item.typeId ? "wait" : "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {withdrawingTypeId === item.typeId ? "…" : "↑ PROMOTE"}
                            </button>
                          </div>
                        ) : (
                        <span
                          title="This stack is in a non-shared partition (e.g. per-accessor lockbox from earlier deposit_to_open_inventory calls). Cannot be pulled via shared-access path."
                          style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}
                        >
                          locked
                        </span>
                        )
                      ) : canWithdrawShared ? (
                        // partition === "open" but no permission — shouldn't happen
                        // since canWithdrawShared already gated permission, but be explicit.
                        <span
                          title="Shared-access permission required."
                          style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}
                        >
                          —
                        </span>
                      ) : ownerCapId ? (
                        <span
                          title="Owner self-withdraw via OwnerCap is currently disabled. Attach a shared-access policy on this SSU (Shared Access section below) to enable shared-path withdrawals."
                          style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}
                        >
                          disabled
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* Shared Access (cradleos::ssu_access extension) */}
      <SharedAccessSection
        ssuObjectId={ssu.objectId}
        ssuTypeFull={ssu.typeFull}
        ownerCapId={ownerCapId}
        characterId={characterId}
        walletAddress={walletAddress}
        ssuTribeId={ownTribeId}
      />
      </>)}
    </div>
  );
}

// ── Wallet STUCK Items section ───────────────────────────────────────────────────────────────────────────
//
// Renders `world::inventory::Item` objects currently owned by the wallet
// (top-level, NOT inside any SSU partition). These are items that landed
// via the legacy `shared_withdraw_to_character` `public_transfer` to the
// wallet address — unusable in-game until recovered to their origin SSU.
//
// Each item has a `parent_id` field that pins it to the SSU it came from.
// The base storage_unit module enforces parent_id == ssu_id on every
// deposit path, so an item can only be redeposited to its origin SSU.
//
// Two recovery destinations per item:
//   PRIMARY:   recover_to_owned  → caller's per-character partition
//                                  (visible in the in-game inventory
//                                  window; user can drag/use in-game)
//   SECONDARY: recover_to_shared → SSU's shared open partition
//                                  (back to the communal pool for the
//                                  original owner / other tribemates)
// ───────────────────────────────────────────────────────────────────────────

type WalletStuckItemsSectionProps = {
  walletAddress: string;
  characterId: string;
  /** Live SSU policies keyed by ssu_id, used to decide whether the
   *  caller can choose the SHARED-POOL destination for a given item. */
  inventories: SSUInventory[];
  nameCache: Map<number, string>;
  dAppKit: ReturnType<typeof useDAppKit>;
  onRefresh: (ssuObjectId: string) => void;
};

function WalletStuckItemsSection({
  walletAddress,
  characterId,
  inventories,
  nameCache,
  dAppKit,
  onRefresh,
}: WalletStuckItemsSectionProps) {
  const [stuck, setStuck] = useState<StuckItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Map ssu_id → policy info for quick lookup when deciding whether to
  // enable the RETURN TO SHARED button. SSUs without a policy on chain
  // can only accept recover_to_owned (no shared pool to return to).
  // SSUInventory.policy is LoadedPolicy where policyId is `string | null`;
  // we narrow to defined-only here.
  const policyByssu = (() => {
    const m = new Map<string, { policyId: string } | undefined>();
    for (const inv of inventories) {
      const pid = inv.policy?.policyId;
      m.set(inv.ssu.objectId, pid ? { policyId: pid } : undefined);
    }
    return m;
  })();

  const refreshScan = async () => {
    if (!walletAddress) return;
    setLoading(true);
    setScanError(null);
    try {
      const items = await fetchStuckItems(walletAddress, WORLD_PKG);
      setStuck(items);
    } catch (e) {
      setScanError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // Auto-scan once on mount + whenever the wallet changes.
  useEffect(() => {
    void refreshScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  async function handleRecoverToOwned(it: StuckItem) {
    if (!characterId) return;
    setBusyItemId(it.itemObjectId);
    setTxStatus(null);
    setTxError(null);
    try {
      const tx = new Transaction();
      appendRecoverToOwned(tx, {
        ssuObjectId: it.parentSsuId,
        characterObjectId: characterId,
        itemObjectId: it.itemObjectId,
      });
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      const itemName = nameCache.get(it.typeId) ?? `type_id ${it.typeId}`;
      setTxStatus(`Recovered ${it.quantity}× ${itemName} → your partition (visible in-game)`);
      setStuck(prev => prev.filter(x => x.itemObjectId !== it.itemObjectId));
      onRefresh(it.parentSsuId);
      setTimeout(() => { void refreshScan(); }, 1500);
    } catch (e) {
      setTxError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleRecoverToShared(it: StuckItem) {
    if (!characterId) return;
    const policy = policyByssu.get(it.parentSsuId);
    if (!policy) {
      setTxError("This SSU has no shared-access policy. Use TO MY PARTITION instead.");
      return;
    }
    setBusyItemId(it.itemObjectId);
    setTxStatus(null);
    setTxError(null);
    try {
      const tx = new Transaction();
      appendRecoverToShared(tx, {
        ssuObjectId: it.parentSsuId,
        policyId: policy.policyId,
        characterObjectId: characterId,
        itemObjectId: it.itemObjectId,
      });
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      const itemName = nameCache.get(it.typeId) ?? `type_id ${it.typeId}`;
      setTxStatus(`Returned ${it.quantity}× ${itemName} → shared pool`);
      setStuck(prev => prev.filter(x => x.itemObjectId !== it.itemObjectId));
      onRefresh(it.parentSsuId);
      setTimeout(() => { void refreshScan(); }, 1500);
    } catch (e) {
      setTxError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyItemId(null);
    }
  }

  if (!SSU_ACCESS_AVAILABLE) return null;
  // Hide entirely when nothing to show and no in-flight state.
  if (!loading && !scanError && stuck.length === 0 && !txStatus && !txError) return null;

  return (
    <div
      style={{
        margin: "0 0 16px",
        padding: "12px",
        border: "1px solid rgba(255,71,0,0.35)",
        background: "rgba(255,71,0,0.04)",
      }}
    >
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          userSelect: "none",
          marginBottom: collapsed ? 0 : 8,
        }}
      >
        <span style={{ fontFamily: "monospace", fontSize: 12, color: "#FF4700" }}>
          {collapsed ? "▶" : "▼"}
        </span>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: "#FF4700",
            textTransform: "uppercase",
            flexGrow: 1,
          }}
        >
          STUCK ITEMS — wallet recovery
        </span>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,71,0,0.6)" }}>
          {loading ? "scanning…" : `${stuck.length} item${stuck.length === 1 ? "" : "s"}`}
        </span>
        <button
          onClick={e => { e.stopPropagation(); void refreshScan(); }}
          disabled={loading}
          title="Re-scan wallet for stuck Items"
          style={{
            background: "transparent",
            border: "1px solid rgba(255,71,0,0.4)",
            color: "#FF4700",
            fontSize: 10,
            fontFamily: "monospace",
            padding: "3px 8px",
            cursor: "pointer",
            letterSpacing: "0.06em",
            outline: "none",
          }}
        >
          REFRESH
        </button>
      </div>

      {!collapsed && (
        <>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              color: "rgba(255,255,255,0.55)",
              lineHeight: 1.55,
              marginBottom: 10,
            }}
          >
            Items that landed in your wallet from a shared SSU withdraw are
            unusable in-game until redeposited to the SSU they came from.
            <br />
            <strong style={{ color: "#FF4700" }}>TO MY PARTITION</strong> drops the item
            into your per-character partition on that SSU, where the in-game
            inventory window can see it. <strong style={{ color: "rgba(255,255,255,0.7)" }}>RETURN TO SHARED</strong>{" "}
            puts it back in the communal pool.
          </div>

          {txStatus && (
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 10,
                padding: "6px 8px",
                margin: "0 0 8px",
                background: "rgba(0,255,128,0.08)",
                border: "1px solid rgba(0,255,128,0.3)",
                color: "#7be0a8",
              }}
            >
              ✓ {txStatus}
            </div>
          )}
          {(scanError || txError) && (
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 10,
                padding: "6px 8px",
                margin: "0 0 8px",
                background: "rgba(255,50,50,0.08)",
                border: "1px solid rgba(255,50,50,0.3)",
                color: "#ff8888",
                wordBreak: "break-word",
              }}
            >
              ! {scanError ?? txError}
            </div>
          )}

          {loading && stuck.length === 0 && (
            <div style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.4)", padding: "4px 0" }}>
              Scanning wallet for stuck items…
            </div>
          )}

          {stuck.map(it => {
            const policy = policyByssu.get(it.parentSsuId);
            const itemName = nameCache.get(it.typeId) ?? `type_id ${it.typeId}`;
            const ssuLabel = inventories.find(inv => inv.ssu.objectId === it.parentSsuId)?.ssu.displayName
              ?? `SSU #${it.parentSsuId.slice(-6)}`;
            const isBusy = busyItemId === it.itemObjectId;
            return (
              <div
                key={it.itemObjectId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 0",
                  borderTop: "1px solid rgba(255,71,0,0.12)",
                  fontFamily: "monospace",
                  fontSize: 11,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "#fff", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {it.quantity.toLocaleString()}× {itemName}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, marginTop: 2 }}>
                    from {ssuLabel} · #{it.itemObjectId.slice(-6)}
                  </div>
                </div>
                <button
                  onClick={() => handleRecoverToOwned(it)}
                  disabled={isBusy}
                  title="Deposit into your per-character partition on that SSU (visible in-game)"
                  style={{
                    background: isBusy ? "rgba(255,71,0,0.15)" : "#FF4700",
                    border: "1px solid #FF4700",
                    color: isBusy ? "rgba(255,255,255,0.5)" : "#000",
                    fontSize: 10,
                    fontFamily: "monospace",
                    fontWeight: 700,
                    padding: "4px 10px",
                    cursor: isBusy ? "wait" : "pointer",
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                    outline: "none",
                  }}
                >
                  {isBusy ? "…" : "→ MY PARTITION"}
                </button>
                <button
                  onClick={() => handleRecoverToShared(it)}
                  disabled={isBusy || !policy}
                  title={policy
                    ? "Return to the SSU's shared open partition (other tribemates can grab)"
                    : "This SSU has no shared-access policy attached."}
                  style={{
                    background: "transparent",
                    border: `1px solid ${policy ? "rgba(255,71,0,0.5)" : "rgba(255,255,255,0.15)"}`,
                    color: policy ? "#FF4700" : "rgba(255,255,255,0.3)",
                    fontSize: 10,
                    fontFamily: "monospace",
                    padding: "4px 10px",
                    cursor: isBusy ? "wait" : (policy ? "pointer" : "not-allowed"),
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                    outline: "none",
                  }}
                >
                  RETURN TO SHARED
                </button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ── Wallet Items section ───────────────────────────────────────────────────────

type WalletItemsSectionProps = {
  characterId: string | null;
  walletAddress: string | undefined;
  ownerCaps: Map<string, string>;
  dAppKit: ReturnType<typeof useDAppKit>;
  allSsuIds: string[];
  /** Full inventory list — needed for ssu_access policy + tribe-eligibility
   *  decisions when offering shared-deposit dropdown options. */
  inventories: SSUInventory[];
  nameCache: Map<number, string>;
  onRefresh: (ssuObjectId: string) => void;
};

/** Deposit-target option offered in the WalletItemsSection dropdown.
 *  - "owned":  caller owns the SSU → use deposit_by_owner (CCP path)
 *  - "shared": caller has shared-access via cradleos::ssu_access policy →
 *              use ssu_access::shared_deposit so the item lands in the
 *              communal inventory partition instead of a per-accessor lockbox. */
type DepositTarget = {
  ssuId: string;
  kind: "owned" | "shared";
  label: string;
  /** policyId is required for shared deposits, undefined for owned. */
  policyId?: string;
};

function WalletItemsSection({
  characterId,
  walletAddress,
  ownerCaps,
  dAppKit,
  allSsuIds,
  inventories,
  nameCache,
  onRefresh,
}: WalletItemsSectionProps) {
  const [walletItems, setWalletItems] = useState<WalletItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [depositStatus, setDepositStatus] = useState<Map<string, { status?: string; error?: string }>>(new Map());

  // Caller's tribe — needed for canDepositVia in tribe_alliance / hybrid modes.
  const [ownTribeId, setOwnTribeId] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!walletAddress) { setOwnTribeId(undefined); return; }
    let cancelled = false;
    fetchCharacterTribeId(walletAddress).then(t => {
      if (!cancelled) setOwnTribeId(t ?? undefined);
    }).catch(() => { if (!cancelled) setOwnTribeId(undefined); });
    return () => { cancelled = true; };
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) return;
    setLoading(true);
    fetchWalletItems(walletAddress, WORLD_API, nameCache, characterId ?? undefined)
      .then(setWalletItems)
      .catch(() => setWalletItems([]))
      .finally(() => setLoading(false));
  }, [walletAddress, characterId]);

  // Build the list of valid deposit targets for each item. Owned SSUs first,
  // then shared-eligible SSUs (tribe-alliance match, allowlist, public, or
  // hybrid). Same SSU can appear in both lists — owner can choose between
  // depositing to their private partition (deposit_by_owner) or to the
  // shared partition (shared_deposit) so tribemates can actually withdraw.
  const depositTargets: DepositTarget[] = (() => {
    if (!characterId) return [];
    const targets: DepositTarget[] = [];
    // Owned SSUs first
    for (const ssuId of allSsuIds) {
      if (ownerCaps.has(ssuId)) {
        targets.push({
          ssuId,
          kind: "owned",
          label: `OWN → ${ssuId.slice(-6)}`,
        });
      }
    }
    // Shared SSUs — anything with a policy that permits this caller to deposit.
    for (const inv of inventories) {
      const p = inv.policy;
      if (!p?.policyId) continue;
      const ok = canDepositVia(p.mode, {
        characterObjectId: characterId,
        ownTribeId,
      });
      if (!ok) continue;
      targets.push({
        ssuId: inv.ssu.objectId,
        kind: "shared",
        label: `SHARED → ${inv.ssu.objectId.slice(-6)}`,
        policyId: p.policyId,
      });
    }
    return targets;
  })();

  async function handleDeposit(item: WalletItem, target: DepositTarget) {
    if (!characterId) return;
    setDepositStatus(prev => new Map(prev).set(item.objectId, { status: "Depositing…" }));
    try {
      const tx = new Transaction();

      if (target.kind === "shared") {
        // ssu_access path — shared communal partition (NOT per-accessor lockbox).
        // No OwnerCap required; on-chain check verifies caller against policy.
        if (!target.policyId) {
          throw new Error("Shared deposit target missing policy id");
        }
        appendSharedDeposit(tx, {
          ssuObjectId: target.ssuId,
          policyId: target.policyId,
          characterObjectId: characterId,
          itemObjectId: item.objectId,
        });
      } else {
        // CCP owner-only path. Borrow OwnerCap from Character, deposit, return cap.
        const targetCapId = ownerCaps.get(target.ssuId);
        if (!targetCapId) {
          throw new Error("No OwnerCap for target SSU.");
        }
        const [ownerCap, receipt] = tx.moveCall({
          target: `${WORLD_PKG}::character::borrow_owner_cap`,
          typeArguments: [`${WORLD_PKG}::storage_unit::StorageUnit`],
          arguments: [
            tx.object(characterId),
            tx.object(targetCapId),
          ],
        });
        tx.moveCall({
          target: `${WORLD_PKG}::storage_unit::deposit_by_owner`,
          typeArguments: [`${WORLD_PKG}::storage_unit::StorageUnit`],
          arguments: [
            tx.object(target.ssuId),
            tx.object(item.objectId),
            tx.object(characterId),
            ownerCap,
          ],
        });
        tx.moveCall({
          target: `${WORLD_PKG}::character::return_owner_cap`,
          typeArguments: [`${WORLD_PKG}::storage_unit::StorageUnit`],
          arguments: [
            tx.object(characterId),
            ownerCap,
            receipt,
          ],
        });
      }

      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setDepositStatus(prev => new Map(prev).set(item.objectId, {
        status: target.kind === "shared" ? "Deposited (shared)." : "Deposited.",
      }));
      onRefresh(target.ssuId);
      // Refresh wallet items list
      if (walletAddress) {
        fetchWalletItems(walletAddress, WORLD_API, nameCache, characterId ?? undefined).then(setWalletItems).catch(() => {});
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      const friendly =
        msg.includes("parent_id") || msg.includes("storage_unit_id")
          ? "Cross-SSU transfer not supported by current contracts — item must be deposited back to source SSU."
          : msg;
      setDepositStatus(prev => new Map(prev).set(item.objectId, { error: friendly }));
    }
  }

  if (!characterId) return null;

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,71,0,0.15)",
        borderRadius: 0,
        marginTop: 8,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          borderBottom: "1px solid rgba(255,71,0,0.1)",
          background: "rgba(255,71,0,0.04)",
        }}
      >
        <span
          style={{
            color: "#FF4700",
            fontFamily: "monospace",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.06em",
          }}
        >
          WALLET ITEMS
        </span>
        <span
          style={{
            fontSize: 10,
            fontFamily: "monospace",
            color: "rgba(107,107,94,0.5)",
            letterSpacing: "0.08em",
          }}
        >
          (undeposited)
        </span>
      </div>

      <div style={{ padding: "8px 14px 10px" }}>
        {loading ? (
          <div style={{ color: "rgba(107,107,94,0.4)", fontFamily: "monospace", fontSize: 11 }}>
            loading wallet items…
          </div>
        ) : walletItems.length === 0 ? (
          <div
            style={{
              color: "rgba(107,107,94,0.3)",
              fontFamily: "monospace",
              fontSize: 11,
              fontStyle: "italic",
            }}
          >
            No loose items in wallet.
          </div>
        ) : (
          walletItems.map(item => {
            const st = depositStatus.get(item.objectId);
            return (
              <div
                key={item.objectId}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  padding: "4px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12,
                    color: "#c8c8b8",
                    minWidth: 160,
                    flex: "1 1 160px",
                  }}
                >
                  {item.name}
                </div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: "rgba(107,107,94,0.5)",
                    width: 60,
                    textAlign: "right",
                  }}
                >
                  ×{item.quantity}
                </div>
                {item.parentId && ownerCaps.has(item.parentId) && (
                  <button
                    onClick={() => handleDeposit(item, {
                      ssuId: item.parentId!,
                      kind: "owned",
                      label: `OWN → ${item.parentId!.slice(-6)}`,
                    })}
                    style={{
                      fontSize: 10,
                      fontFamily: "monospace",
                      letterSpacing: "0.08em",
                      background: "transparent",
                      border: "1px solid rgba(0,255,150,0.4)",
                      color: "#00ff96",
                      padding: "2px 6px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    DEPOSIT BACK → {item.parentId.slice(-6)}
                  </button>
                )}
                {!item.parentId && depositTargets.length > 0 && (
                  <select
                    style={{
                      background: "#0a0a0a",
                      border: "1px solid rgba(255,71,0,0.4)",
                      color: "#FF4700",
                      fontFamily: "monospace",
                      fontSize: 10,
                      padding: "2px 4px",
                      cursor: "pointer",
                      letterSpacing: "0.08em",
                    }}
                    defaultValue=""
                    onChange={e => {
                      const v = e.target.value;
                      if (!v) return;
                      // value format: "<kind>:<ssuId>"
                      const t = depositTargets.find(t => `${t.kind}:${t.ssuId}` === v);
                      if (t) handleDeposit(item, t);
                      // Reset so re-selecting the same option fires again.
                      e.target.value = "";
                    }}
                  >
                    <option value="" disabled>DEPOSIT ▾</option>
                    {depositTargets.filter(t => t.kind === "owned").length > 0 && (
                      <optgroup label="Your SSUs (private)">
                        {depositTargets
                          .filter(t => t.kind === "owned")
                          .map(t => (
                            <option key={`owned:${t.ssuId}`} value={`owned:${t.ssuId}`}>
                              {t.label}
                            </option>
                          ))}
                      </optgroup>
                    )}
                    {depositTargets.filter(t => t.kind === "shared").length > 0 && (
                      <optgroup label="Shared (tribe / allowlist)">
                        {depositTargets
                          .filter(t => t.kind === "shared")
                          .map(t => (
                            <option key={`shared:${t.ssuId}`} value={`shared:${t.ssuId}`}>
                              {t.label}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                )}
                {st && (
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      color: st.error ? "#ff6b6b" : "#00ff96",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {st.error ? `ERR: ${st.error}` : st.status}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// localStorage key for the SSU lockbox advisory dismissal. Bump the version
// suffix whenever banner copy materially changes so dismissed users see the
// new message once.
//   v1: 2026-04-26 — initial "per-user lockbox" advisory.
//   v2: 2026-04-26 — revised to highlight shared-access fix in CradleOS:
//                     deposits/withdrawals via cradleos::ssu_access
//                     now route through the truly-shared partition.
const SSU_ADVISORY_KEY = "cradleos.ssu_lockbox_advisory.v2";

export function InventoryPanel() {
  const { account } = useVerifiedAccountContext();
  const walletAddress = account?.address;
  const dAppKit = useDAppKit();
  const [inventories, setInventories] = useState<SSUInventory[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | undefined>();
  const [advisoryDismissed, setAdvisoryDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(SSU_ADVISORY_KEY) === "1"; }
    catch { return false; }
  });
  const dismissAdvisory = () => {
    try { localStorage.setItem(SSU_ADVISORY_KEY, "1"); } catch {}
    setAdvisoryDismissed(true);
  };
  const nameCache = useRef<Map<number, string>>(new Map());
  const [transferState, setTransferState] = useState<TransferState>({
    characterId: null,
    ownerCaps: new Map(),
    charOwnerCapId: null,
    pendingWithdraw: null,
    pendingDeposit: null,
    txStatus: null,
    txError: null,
  });

  // Refresh a single SSU's inventory + its ssu_access policy. Both are
  // best-effort: a stale or missing policy must NOT block inventory display,
  // so the policy fetch errors are swallowed and we keep the previous policy
  // value when re-resolution fails (typical case: testnet RPC blip).
  const refreshSSU = async (ssuObjectId: string) => {
    const idx = inventories.findIndex(inv => inv.ssu.objectId === ssuObjectId);
    if (idx === -1) return;
    setInventories(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], loading: true };
      return next;
    });
    try {
      const [{ items, maxCapacity, usedCapacity }, policyResult] = await Promise.all([
        fetchSSUInventory(ssuObjectId),
        SSU_ACCESS_AVAILABLE
          ? loadPolicyForSsu(ssuObjectId).catch(() => undefined)
          : Promise.resolve(undefined),
      ]);
      const resolvedNames = new Map<number, string>();
      await Promise.all(
        items.map(async item => {
          const name = await resolveItemName(item.typeId, WORLD_API, nameCache.current);
          resolvedNames.set(item.typeId, name);
        })
      );
      setInventories(prev => {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          items,
          resolvedNames,
          maxCapacity,
          usedCapacity,
          loading: false,
          error: undefined,
          // Preserve previous policy if re-fetch failed; only overwrite on success.
          policy: policyResult ?? next[idx].policy,
        };
        return next;
      });
    } catch (err: any) {
      setInventories(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], loading: false, error: err?.message ?? String(err) };
        return next;
      });
    }
  };

  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;

    async function load() {
      setGlobalLoading(true);
      setGlobalError(undefined);
      setInventories([]);
      try {
        // Load structures + character + owner caps in parallel
        const [groups, charInfo] = await Promise.all([
          fetchPlayerStructures(walletAddress!),
          findCharacterForWallet(walletAddress!),
        ]);
        const characterId = charInfo?.characterId ?? null;
        // Use the spawn tribe_id from CharacterCreatedEvent as a baseline.
        // This will be replaced by the *current* tribe_id read from the
        // Character object below before shared-SSU discovery runs.
        let ownTribeId: number | undefined =
          charInfo?.tribeId !== undefined ? Number(charInfo.tribeId) : undefined;

        const allStructures = groups.flatMap(g => g.structures);
        const ownedSsus = allStructures.filter(s => s.kind === "StorageUnit");

        // Sort: online first, then offline
        ownedSsus.sort((a, b) => {
          if (a.isOnline === b.isOnline) return 0;
          return a.isOnline ? -1 : 1;
        });

        // Fetch OwnerCaps + character's own OwnerCap<Character> if we have a characterId
        let ownerCaps = new Map<string, string>();
        let charOwnerCapId: string | null = null;
        if (characterId) {
          try {
            [ownerCaps, charOwnerCapId] = await Promise.all([
              fetchOwnerCaps(characterId),
              SSU_ACCESS_AVAILABLE
                ? fetchCharacterOwnerCapId(characterId).catch(() => null)
                : Promise.resolve(null),
            ]);
          } catch {
            // non-fatal
          }
        }

        if (cancelled) return;

        setTransferState(prev => ({ ...prev, characterId, ownerCaps, charOwnerCapId }));

        // Initialize loading placeholders for OWNED SSUs only. Shared SSUs
        // will be appended below once discovery completes; we render owned
        // ones first because they're the common case and we want first paint
        // to be fast.
        const ssus: PlayerStructure[] = [...ownedSsus];
        setInventories(
          ssus.map(ssu => ({
            ssu,
            items: [],
            resolvedNames: new Map(),
            loading: true,
            maxCapacity: 0,
            usedCapacity: 0,
          }))
        );
        setGlobalLoading(false);

        // ── Shared-SSU discovery (cradleos::ssu_access) ────────────────
        // Surface SSUs the caller does NOT own but DOES have access to via
        // a shared policy (TRIBE / ALLOWLIST / HYBRID / PUBLIC). This is
        // best-effort: discovery failures here must NOT block owned-SSU
        // rendering. Runs in parallel with owned-SSU inventory loading
        // below to avoid serial latency. The caller's *current* tribe_id
        // is read from the Character object (not the spawn-event tribe_id)
        // so tribe switches are reflected immediately.
        const sharedDiscoveryPromise = (async () => {
          if (!SSU_ACCESS_AVAILABLE || !characterId) return [] as Array<SSUInventory>;
          try {
            // Read current tribe from Character object before checking policies.
            // The spawn-event tribe id from CharacterCreatedEvent is stale if
            // the character has switched tribes since creation.
            try {
              const charFields = await fetch(SUI_TESTNET_RPC, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jsonrpc: "2.0", id: 1, method: "sui_getObject",
                  params: [characterId, { showContent: true }],
                }),
              }).then(r => r.json());
              const tid = Number(charFields?.result?.data?.content?.fields?.tribe_id);
              if (Number.isFinite(tid)) ownTribeId = tid;
            } catch { /* keep spawn tribe as fallback */ }

            const ownedIds = new Set(ownedSsus.map(s => s.objectId));
            const discovered = await discoverSharedSsus(
              { characterObjectId: characterId, ownTribeId },
              ownedIds,
            );
            if (cancelled || discovered.length === 0) return [];

            // Synthesize PlayerStructure records + patch type names from
            // the World API. We do this in two passes so we don't pay the
            // type-name fetch cost when no shared SSUs exist.
            const synthesized = (await Promise.all(
              discovered.map(async d => {
                const ps = await synthesizeSharedSsuStructure(d.ssuObjectId);
                if (!ps) return null;
                return { structure: ps, discovered: d };
              }),
            )).filter((x): x is { structure: PlayerStructure; discovered: typeof discovered[number] } => x !== null);

            if (synthesized.length === 0) return [];

            // Resolve type names so the cards show "Mini Storage" etc.
            // instead of the fallback "Storage Unit (shared)" label.
            const typeNameMap = await fetchTypeNames().catch(() => new Map<number, string>());
            for (const s of synthesized) {
              if (s.structure.typeId !== undefined && typeNameMap.has(s.structure.typeId)) {
                s.structure.typeName = typeNameMap.get(s.structure.typeId);
                if (!s.structure.hasCustomName) {
                  s.structure.displayName = s.structure.typeName!;
                }
              }
            }

            // Sort shared SSUs: online before offline (mirror owned sort).
            synthesized.sort((a, b) => {
              if (a.structure.isOnline === b.structure.isOnline) return 0;
              return a.structure.isOnline ? -1 : 1;
            });

            const sharedFromOf = (kind: string): SSUInventory["sharedFrom"] => {
              if (kind === "tribe_alliance") return "tribe";
              if (kind === "allowlist") return "allowlist";
              if (kind === "hybrid") return "hybrid";
              if (kind === "public") return "public";
              return undefined;
            };

            return synthesized.map(({ structure, discovered }) => ({
              ssu: structure,
              items: [] as InventoryItem[],
              resolvedNames: new Map<number, string>(),
              loading: true,
              maxCapacity: 0,
              usedCapacity: 0,
              policy: { policyId: discovered.policyId, mode: discovered.mode } as LoadedPolicy,
              sharedFrom: sharedFromOf(discovered.mode.kind),
            }));
          } catch {
            return [];
          }
        })();

        // Append discovered shared-SSU placeholders to the inventories list
        // as soon as discovery resolves (separate from inventory load to
        // keep the owned-SSU first-paint fast).
        sharedDiscoveryPromise.then(sharedInvs => {
          if (cancelled || sharedInvs.length === 0) return;
          // Track the indices these new entries land at so the per-card
          // inventory loaders below can target them by ssu.objectId.
          ssus.push(...sharedInvs.map(s => s.ssu));
          setInventories(prev => [...prev, ...sharedInvs]);
          // Kick off inventory load for each shared SSU. We cannot reuse
          // the parallel block below because that one captures `ssus` by
          // index closure; here we look up by objectId post-hoc.
          for (const inv of sharedInvs) {
            (async () => {
              try {
                const { items, maxCapacity, usedCapacity } = await fetchSSUInventory(inv.ssu.objectId);
                const resolvedNames = new Map<number, string>();
                await Promise.all(items.map(async item => {
                  const name = await resolveItemName(item.typeId, WORLD_API, nameCache.current);
                  resolvedNames.set(item.typeId, name);
                }));
                if (cancelled) return;
                setInventories(prev => {
                  const idx = prev.findIndex(p => p.ssu.objectId === inv.ssu.objectId);
                  if (idx === -1) return prev;
                  const next = [...prev];
                  next[idx] = { ...next[idx], items, resolvedNames, maxCapacity, usedCapacity, loading: false };
                  return next;
                });
              } catch (err: any) {
                if (cancelled) return;
                setInventories(prev => {
                  const idx = prev.findIndex(p => p.ssu.objectId === inv.ssu.objectId);
                  if (idx === -1) return prev;
                  const next = [...prev];
                  next[idx] = { ...next[idx], loading: false, error: err?.message ?? String(err) };
                  return next;
                });
              }
            })();
          }
        });

        // Load each OWNED SSU inventory in parallel. Pull ssu_access policy
        // alongside inventory so the deposit/withdraw UI can detect
        // tribe-shared SSUs on first paint without a second round-trip per
        // card. Policy lookup is best-effort — RPC failure here must NOT
        // block inventory display.
        //
        // We look up entries by objectId (not array index) because shared-SSU
        // discovery may append additional entries to `inventories` between
        // when this loop starts and when each item resolves. An index-based
        // write would race against that append and clobber the wrong card.
        await Promise.all(
          ownedSsus.map(async (ssu) => {
            try {
              const [{ items, maxCapacity, usedCapacity }, policyResult] = await Promise.all([
                fetchSSUInventory(ssu.objectId),
                SSU_ACCESS_AVAILABLE
                  ? loadPolicyForSsu(ssu.objectId).catch(() => undefined)
                  : Promise.resolve(undefined),
              ]);

              // Resolve names for all type IDs
              const resolvedNames = new Map<number, string>();
              await Promise.all(
                items.map(async item => {
                  const name = await resolveItemName(
                    item.typeId,
                    WORLD_API,
                    nameCache.current
                  );
                  resolvedNames.set(item.typeId, name);
                })
              );

              if (cancelled) return;

              setInventories(prev => {
                const idx = prev.findIndex(p => p.ssu.objectId === ssu.objectId);
                if (idx === -1) return prev;
                const next = [...prev];
                next[idx] = {
                  ...next[idx],
                  items,
                  resolvedNames,
                  maxCapacity,
                  usedCapacity,
                  loading: false,
                  policy: policyResult,
                };
                return next;
              });
            } catch (err: any) {
              if (cancelled) return;
              setInventories(prev => {
                const idx = prev.findIndex(p => p.ssu.objectId === ssu.objectId);
                if (idx === -1) return prev;
                const next = [...prev];
                next[idx] = {
                  ...next[idx],
                  loading: false,
                  error: err?.message ?? String(err),
                };
                return next;
              });
            }
          })
        );
      } catch (err: any) {
        if (!cancelled) {
          setGlobalError(err?.message ?? String(err));
          setGlobalLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  const allSsuIds = inventories.map(inv => inv.ssu.objectId);

  // ── Collapse state ───────────────────────────────────────────────
  // Collapsed SSU ids persist to localStorage so the user's pinning
  // preference survives reloads. Key includes the wallet address so two
  // accounts on the same browser don't share collapse state.
  const COLLAPSE_KEY = walletAddress
    ? `cradleos:invpanel:collapsed:${walletAddress}`
    : "cradleos:invpanel:collapsed:_";
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => {
    try {
      const raw = typeof window !== "undefined"
        ? localStorage.getItem(COLLAPSE_KEY)
        : null;
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? new Set(arr.filter((x: unknown) => typeof x === "string")) : new Set();
    } catch { return new Set(); }
  });
  // Re-read collapse state when the wallet address changes (account swap).
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined"
        ? localStorage.getItem(COLLAPSE_KEY)
        : null;
      if (!raw) { setCollapsedIds(new Set()); return; }
      const arr = JSON.parse(raw);
      setCollapsedIds(Array.isArray(arr) ? new Set(arr.filter((x: unknown) => typeof x === "string")) : new Set());
    } catch { setCollapsedIds(new Set()); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);
  // Persist on every change.
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(Array.from(collapsedIds)));
    } catch { /* quota / disabled storage — silently ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsedIds, walletAddress]);

  const toggleCollapse = (ssuId: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(ssuId)) next.delete(ssuId);
      else next.add(ssuId);
      return next;
    });
  };
  const collapseAll = () => setCollapsedIds(new Set(inventories.map(i => i.ssu.objectId)));
  const expandAll = () => setCollapsedIds(new Set());

  return (
    <div style={{ padding: "0 0 24px" }}>
      {/* Panel title */}
      <div
        style={{
          fontSize: 11,
          fontFamily: "monospace",
          fontWeight: 700,
          letterSpacing: "0.2em",
          color: "#FF4700",
          textTransform: "uppercase",
          marginBottom: 16,
          paddingBottom: 8,
          borderBottom: "1px solid rgba(255,71,0,0.2)",
        }}
      >
        INVENTORY
      </div>

      {/* Server-side bug advisory — Storage Units behave as per-user
          private lockboxes on Stillness, not as shared communal storage.
          Discovered 2026-04-26 via tribemate cross-deposit test.
          Remove this block (or bump SSU_ADVISORY_KEY suffix) when CCP
          resolves the upstream issue. */}
      {!advisoryDismissed && (
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            padding: "10px 14px",
            marginBottom: 16,
            background: "rgba(255,71,0,0.08)",
            border: "1px solid rgba(255,71,0,0.4)",
            color: "rgba(250,250,229,0.92)",
            fontSize: 11,
            lineHeight: 1.55,
            fontFamily: "inherit",
          }}
        >
          <span style={{ color: "#FF4700", fontWeight: 700, letterSpacing: "0.08em", flexShrink: 0 }}>⚠</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#FF4700", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
              Storage Unit — shared inventory mode
            </div>
            Stock CCP Storage Units partition the &ldquo;open&rdquo; inventory <strong>per accessor</strong>:
            tribemate deposits land in private lockboxes the SSU owner cannot see, and capacity
            multiplies per accessor instead of being shared. CradleOS routes deposits and withdrawals
            through <code style={{ color: "#FF8a4d" }}>cradleos::ssu_access</code> when an SSU has a
            policy attached — so the items actually live in one truly-shared inventory the whole
            tribe can read and write. Add a policy to your SSUs in the <strong>Shared Access</strong>
            section on each card to opt in.
          </div>
          <button
            type="button"
            onClick={dismissAdvisory}
            title="Dismiss"
            style={{
              background: "transparent",
              border: "1px solid rgba(255,71,0,0.4)",
              color: "rgba(250,250,229,0.7)",
              padding: "2px 8px",
              fontSize: 10,
              fontFamily: "inherit",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            DISMISS
          </button>
        </div>
      )}

      {/* No wallet */}
      {!walletAddress && (
        <div
          style={{
            color: "rgba(107,107,94,0.5)",
            fontFamily: "monospace",
            fontSize: 12,
            padding: "24px 0",
            textAlign: "center",
          }}
        >
          Wallet not connected — connect EVE Vault to view inventory.
        </div>
      )}

      {/* Global loading */}
      {walletAddress && globalLoading && (
        <div
          style={{
            color: "rgba(107,107,94,0.4)",
            fontFamily: "monospace",
            fontSize: 11,
            padding: "16px 0",
          }}
        >
          Loading storage units…
        </div>
      )}

      {/* Global error */}
      {globalError && (
        <div
          style={{
            color: "#ff6b6b",
            fontFamily: "monospace",
            fontSize: 11,
            padding: "10px 0",
          }}
        >
          ERR: {globalError}
        </div>
      )}

      {/* No SSUs found */}
      {walletAddress && !globalLoading && !globalError && inventories.length === 0 && (
        <div
          style={{
            color: "rgba(107,107,94,0.4)",
            fontFamily: "monospace",
            fontSize: 12,
            padding: "16px 0",
            fontStyle: "italic",
          }}
        >
          No Storage Units found for this wallet.
        </div>
      )}

      {/* Collapse / Expand all controls. Only render when there are 2+
          SSUs to manage; with one card the buttons are noise. */}
      {inventories.length >= 2 && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginBottom: 8,
            fontFamily: "monospace",
            fontSize: 9,
            letterSpacing: "0.08em",
          }}
        >
          <span style={{ color: "rgba(107,107,94,0.5)", alignSelf: "center" }}>
            {inventories.length} storage{inventories.length === 1 ? "" : "s"} · {collapsedIds.size} collapsed
          </span>
          <button
            onClick={collapseAll}
            disabled={collapsedIds.size === inventories.length}
            title="Collapse every storage card. Useful when you have many SSUs and need to scroll past them to find the active one."
            style={{
              fontSize: 9, fontFamily: "monospace", letterSpacing: "0.08em",
              background: "transparent",
              border: "1px solid rgba(255,71,0,0.3)",
              color: collapsedIds.size === inventories.length ? "rgba(255,71,0,0.3)" : "#FF4700",
              padding: "2px 8px",
              cursor: collapsedIds.size === inventories.length ? "default" : "pointer",
            }}
          >COLLAPSE ALL</button>
          <button
            onClick={expandAll}
            disabled={collapsedIds.size === 0}
            title="Expand every storage card."
            style={{
              fontSize: 9, fontFamily: "monospace", letterSpacing: "0.08em",
              background: "transparent",
              border: "1px solid rgba(255,71,0,0.3)",
              color: collapsedIds.size === 0 ? "rgba(255,71,0,0.3)" : "#FF4700",
              padding: "2px 8px",
              cursor: collapsedIds.size === 0 ? "default" : "pointer",
            }}
          >EXPAND ALL</button>
        </div>
      )}

      {/* SSU cards */}
      {inventories.map(inv => (
        <SSUCard
          key={inv.ssu.objectId}
          inv={inv}
          characterId={transferState.characterId}
          ownerCaps={transferState.ownerCaps}
          dAppKit={dAppKit}
          walletAddress={walletAddress}
          allSsuIds={allSsuIds}
          onRefresh={refreshSSU}
          collapsed={collapsedIds.has(inv.ssu.objectId)}
          onToggleCollapse={() => toggleCollapse(inv.ssu.objectId)}
          charOwnerCapId={transferState.charOwnerCapId}
        />
      ))}

      {/* Wallet STUCK Items section — recovery for items left in wallet by
          legacy `shared_withdraw_to_character`. Self-hides when nothing to
          show. Mounted ABOVE WalletItemsSection so the recovery prompt is
          the first thing the user sees when stuck items exist. */}
      {walletAddress && !globalLoading && transferState.characterId && (
        <WalletStuckItemsSection
          walletAddress={walletAddress}
          characterId={transferState.characterId}
          inventories={inventories}
          nameCache={nameCache.current}
          dAppKit={dAppKit}
          onRefresh={refreshSSU}
        />
      )}

      {/* Wallet Items section */}
      {walletAddress && !globalLoading && transferState.characterId && (
        <WalletItemsSection
          characterId={transferState.characterId}
          walletAddress={walletAddress}
          ownerCaps={transferState.ownerCaps}
          dAppKit={dAppKit}
          allSsuIds={allSsuIds}
          inventories={inventories}
          nameCache={nameCache.current}
          onRefresh={refreshSSU}
        />
      )}
    </div>
  );
}
