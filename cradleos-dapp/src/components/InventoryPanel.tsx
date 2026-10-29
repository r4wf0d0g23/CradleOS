import { StorefrontPanel } from "./StorefrontPanel";
import { ItemIcon, ClientUIIcon } from "./GameIcon";
import { useState, useEffect, useRef, useMemo } from "react";
import { PortalSelect } from "./PortalSelect";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { fetchPlayerStructureSnapshot, type PlayerStructure } from "../lib";
import { WORLD_PKG, SSU_ACCESS_AVAILABLE, SERVER_ENV } from "../constants";
import { readInventoryCharacter, readSharedStorage } from '../lib/inventoryRead';
import { getType } from "../lib/dataClient";
import { getTypeName as getStaticTypeName, type WorldKey } from "../data/typeCatalog";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { CurrentAccountSigner } from "../lib/cycleSigner";
import { Transaction } from "@mysten/sui/transactions";
import { SsuStorageCard as SSUCard } from "./SsuStorageCard";
import { fetchSsuSnapshot, SSU_SHARING_PAUSED, type SsuSnapshot } from "../lib/ssuSafety";
import { STORAGE_ACCESS_DEPLOYMENT } from '../lib/storageAccessDeployment';
import { discoverStoragePolicies, secureStorageExtension } from '../lib/storageAccess';
import "./SsuStorage.css";
import {
  loadPolicyForSsu,
  canDepositVia,
  appendSharedDeposit,
  // appendSharedWithdrawToCharacter is intentionally NOT imported anymore:
  // v12 of cradleos::ssu_access introduced shared_withdraw_to_owned, which
  // routes withdrawn items directly into the caller's per-character partition
  // (visible in-game) instead of into wallet limbo. The legacy fn remains on
  // chain for back-compat but the dApp should never call it again.
  appendRecoverToOwned,
  appendRecoverToShared,
  fetchStuckItems,
  type StuckItem,
  discoverSharedSsus,
  type LoadedPolicy,
  fetchCharacterOwnerCapId,
} from "../lib/ssuAccess";

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
  /** The dynamic-field key this item was stored under. For "unknown"
   *  partitions this equals the depositor's `OwnerCap<Character>` id
   *  (per-accessor lockbox), so we can identify which lockbox an item
   *  belongs to and only show DEPOSIT controls to its rightful owner. */
  partitionKey: string;
};

type SSUInventory = {
  ssu: PlayerStructure;
  items: InventoryItem[];
  resolvedNames: Map<number, string>;
  loading: boolean;
  error?: string;
  maxCapacity: number;
  usedCapacity: number;
  snapshot?: SsuSnapshot;
  /** True after the first successful inventory fetch for this SSU.
   *  Used by the lazy-load gate in the expand handler so we only load
   *  contents the first time a card opens (and when the user explicitly
   *  hits REFRESH). Without this flag we'd re-fetch on every collapse/
   *  expand cycle, defeating the lazy-load goal of minimizing RPC. */
  hasLoadedContents?: boolean;
  /** cradleos::ssu_access policy attached to this SSU, if any.
   *  undefined = not yet resolved; { policyId: null, mode: "none" } = no policy. */
  policy?: LoadedPolicy;
  /** True when this SSU is surfaced via shared-access discovery (caller is
   *  not the owner). The card renders a SHARED badge and ALL→SHARED / rename
   *  controls are hidden because the caller has no OwnerCap. */
  sharedFrom?: "tribe" | "allowlist" | "hybrid" | "public";
  /** Resolved operator (Character) of this SSU. `name` is the display
   *  string (e.g., "raw", "Zasar"). `key` is the lowercased on-chain
   *  address used as a stable grouping/filter key (Phase 2). For
   *  Stillness this is the Character object id. Undefined while still
   *  resolving or when resolution failed. */
  operator?: { name: string; key: string };
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

/**
 * Concurrency-limited Promise.all replacement. Public Sui testnet RPC
 * (`fullnode.testnet.sui.io`) rate-limits aggressively and was producing
 * "Failed to fetch" bursts on initial load when N SSUs all fanned out
 * with `Promise.all` (each SSU itself does 2 + (k partitions) RPC calls,
 * so 10 SSUs ≈ 40-60 simultaneous calls). Cap concurrency at a sane
 * default and process in waves. (2026-04-28.)
 */
// 2026-06-01: raised default concurrency 3 → 8 after promoting DGX2 private
// fullnode to primary upstream. The original `3` was set when the public
// fullnode rate-limited at ~5 rps per IP and N>10 concurrent fan-outs would
// cascade into "Failed to fetch". With private node + caching proxy in front,
// 8 concurrent is well under the 16-slot upstream concurrency cap and gives
// the inventory panel meaningfully faster load times.
type SSUInventoryResult = {
  items: InventoryItem[];
  maxCapacity: number;
  usedCapacity: number;
  snapshot?: SsuSnapshot;
};

async function fetchSSUInventory(ssuId: string): Promise<SSUInventoryResult> {
  const snapshot = await fetchSsuSnapshot(ssuId);
  return { snapshot, items: snapshot.slots.flatMap(slot => slot.items),
    maxCapacity: Math.max(0, ...snapshot.slots.map(slot => slot.max)),
    usedCapacity: snapshot.slots.reduce((sum, slot) => sum + slot.used, 0) };
}

/**
 * Resolve an item name for a given type_id.
 *
 * Resolution order:
 *  1. Session cache (already resolved in this session)
 *  2. Bundled static catalog (`src/data/typeCatalog.ts`, refreshed via
 *     `scripts/refresh-type-catalog.mjs` — 392+ Stillness types as of
 *     2026-06-23). Synchronous, zero-RPC, handles all known content.
 *  3. Live world-api fallback (handles new content added after last
 *     catalog refresh; failures degrade to `type_id NNNNN`).
 *
 * Previously every name was a world-api call — expand-cargo bursts
 * could rate-limit and leave rows showing `type_id NNNNN`. The static
 * catalog eliminates that hot path entirely for known ids.
 */
async function resolveItemName(
  typeId: number,
  cache: Map<number, string>
): Promise<string> {
  if (cache.has(typeId)) return cache.get(typeId)!;
  const world = SERVER_ENV as WorldKey;
  const fromCatalog = getStaticTypeName(world, typeId);
  if (fromCatalog) {
    cache.set(typeId, fromCatalog);
    return fromCatalog;
  }
  try {
    const json = await getType(typeId);
    const name = json?.name ?? `type_id ${typeId}`;
    cache.set(typeId, name);
    return name;
  } catch {
    return `type_id ${typeId}`;
  }
}

async function fetchWalletItems(walletAddress: string, nameCache: Map<number, string>, characterId?: string): Promise<WalletItem[]> {
  const all = (await Promise.all([walletAddress, ...(characterId ? [characterId] : [])].map(address => fetchStuckItems(address, WORLD_PKG)))).flat();
  const seen = new Set<string>();
  return Promise.all(all.map(async item => {
    if (seen.has(item.itemObjectId)) throw new Error('Wallet items changed. Retry.');
    seen.add(item.itemObjectId);
    return { objectId: item.itemObjectId, typeId: item.typeId, quantity: item.quantity,
      parentId: item.parentSsuId, name: await resolveItemName(item.typeId, nameCache) };
  }));
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
    } catch {
      setStuck([]); setScanError('Wallet items unavailable.');
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
          {scanError ? "Unavailable" : loading ? "scanning…" : `${stuck.length} item${stuck.length === 1 ? "" : "s"}`}
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
            Return wallet items to their source SSU · Shared returns paused
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
                    <ItemIcon typeId={it.typeId} size={24} /> {it.quantity.toLocaleString()}× {itemName}
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
                  disabled={SSU_SHARING_PAUSED || isBusy || !policy}
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
                  SHARED RETURN PAUSED
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
  const [itemsError, setItemsError] = useState(false);
  const [itemsReload, setItemsReload] = useState(0);
  const [loading, setLoading] = useState(false);
  const [depositStatus, setDepositStatus] = useState<Map<string, { status?: string; error?: string }>>(new Map());

  // Caller's tribe — needed for canDepositVia in tribe_alliance / hybrid modes.
  const [ownTribeId, setOwnTribeId] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!walletAddress || !characterId) { setOwnTribeId(undefined); return; }
    let cancelled = false;
    readInventoryCharacter(characterId).then(({ tribeId: t }) => {
      if (!cancelled) setOwnTribeId(t ?? undefined);
    }).catch(() => { if (!cancelled) setOwnTribeId(undefined); });
    return () => { cancelled = true; };
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    setLoading(true); setItemsError(false); setWalletItems([]);
    fetchWalletItems(walletAddress, nameCache, characterId ?? undefined)
      .then(items => { if (!cancelled) setWalletItems(items); })
      .catch(() => { if (!cancelled) setItemsError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [walletAddress, characterId, itemsReload]);

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
      if (SSU_SHARING_PAUSED) continue;
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
        setItemsReload(n => n + 1);
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
            color: "rgba(175,175,155,0.5)",
            letterSpacing: "0.08em",
          }}
        >
          (undeposited)
        </span>
      </div>

      <div style={{ padding: "8px 14px 10px" }}>
        {loading ? (
          <div style={{ color: "rgba(175,175,155,0.4)", fontFamily: "monospace", fontSize: 11 }}>
            loading wallet items…
          </div>
        ) : itemsError ? (<p role="status">Wallet items unavailable. <button onClick={() => setItemsReload(n => n + 1)}>Retry</button></p>) : walletItems.length === 0 ? (
          <div
            style={{
              color: "rgba(175,175,155,0.3)",
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
                  <span className="icon-label"><ItemIcon typeId={item.typeId} size={24} /><span>{item.name}</span></span>
                </div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: "rgba(175,175,155,0.5)",
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


// ── Operator filter dropdown ──────────────────────────────────────
// Thin wrapper around shared <PortalSelect> (../components/PortalSelect.tsx).
// Native <select> popouts render outside the iframe in the embedded
// webview and dismiss instantly; the portal-mounted dropdown is the
// safe replacement (see TOOLS.md "CradleOS Webview Dialog + Native
// Overlay Ban"). Kept as a tiny named wrapper so the call site stays
// readable in InventoryPanel's render path.
function OperatorFilterDropdown({
  value,
  onChange,
  groups,
  totalCount,
}: {
  value: string;
  onChange: (v: string) => void;
  groups: Array<{ key: string; label: string; inventories: { length: number } }>;
  totalCount: number;
}) {
  const options = useMemo(
    () => [
      { value: "__all__", label: `ALL OPERATORS (${totalCount})` },
      ...groups.map(g => ({
        value: g.key,
        label: `${g.label.toUpperCase()} (${g.inventories.length})`,
      })),
    ],
    [groups, totalCount],
  );
  return (
    <PortalSelect
      value={value}
      onChange={onChange}
      options={options}
      title="Filter SSUs by operator (the Character that owns each SSU). Selection persists across reloads."
      buttonStyle={{
        fontSize: 9,
        letterSpacing: "0.08em",
        padding: "2px 8px",
        minWidth: 140,
        borderColor: "rgba(255,71,0,0.3)",
      }}
      panelStyle={{
        fontSize: 9,
        letterSpacing: "0.08em",
      }}
      optionStyle={{
        padding: "5px 10px",
      }}
    />
  );
}

export function InventoryPanel() {
  const [area,setArea] = useState<"storage"|"storefront">(()=>new URLSearchParams(window.location.search).has("storefront")?"storefront":"storage");
  const { account } = useVerifiedAccountContext();
  const walletAddress = account?.address;
  const dAppKit = useDAppKit();
  const [inventories, setInventories] = useState<SSUInventory[]>([]);
  const [globalLoading, setGlobalLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [sharedError, setSharedError] = useState(false);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | undefined>();
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

  const mounted = useRef(false);
  const refreshWallet = useRef(walletAddress);
  refreshWallet.current = walletAddress;
  const requests = useRef(new Map<string, number>());
  const requestSequence = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; requests.current.clear(); }; }, []);
  const refreshSSU = async (ssuObjectId: string) => {
    if (!mounted.current || !walletAddress || !inventories.some(inv => inv.ssu.objectId === ssuObjectId)) return;
    const request = ++requestSequence.current;
    requests.current.set(ssuObjectId, request);
    const current = () => mounted.current && refreshWallet.current === walletAddress && requests.current.get(ssuObjectId) === request;
    const refreshCharacterId = transferState.characterId;
    setInventories(prev => prev.map(inv => inv.ssu.objectId === ssuObjectId ? { ...inv, loading: true, error: undefined, policy: undefined, snapshot: undefined, items: [] } : inv));
    try {
      const [{ items, maxCapacity, usedCapacity, snapshot }, policy, refreshedCap] = await Promise.all([
        fetchSSUInventory(ssuObjectId),
        SSU_ACCESS_AVAILABLE ? loadPolicyForSsu(ssuObjectId).catch(() => undefined) : Promise.resolve(undefined),
        !transferState.charOwnerCapId && refreshCharacterId ? fetchCharacterOwnerCapId(refreshCharacterId).catch(() => null) : Promise.resolve(null),
      ]);
      const resolvedNames = new Map<number, string>();
      await Promise.all(items.map(async item => { resolvedNames.set(item.typeId, await resolveItemName(item.typeId, nameCache.current)); }));
      if (!current()) return;
      if (refreshedCap) setTransferState(prev => prev.characterId === refreshCharacterId ? { ...prev, charOwnerCapId: refreshedCap } : prev);
      setInventories(prev => prev.map(inv => inv.ssu.objectId === ssuObjectId ? {
        ...inv, items, resolvedNames, maxCapacity, usedCapacity, snapshot, policy,
        loading: false, error: undefined, hasLoadedContents: true,
      } : inv));
    } catch {
      if (!current()) return;
      setInventories(prev => prev.map(inv => inv.ssu.objectId === ssuObjectId ? {
        ...inv, loading: false, error: 'Storage unavailable.', snapshot: undefined, items: [], policy: undefined,
      } : inv));
    }
  };

  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    const abort = new AbortController();
    async function load() {
      requests.current.clear();
      setGlobalLoading(true); setGlobalError(undefined); setSharedError(false); setSharedLoading(false); setInventories([]);
      try {
        const { groups, characterId } = await fetchPlayerStructureSnapshot(walletAddress!, abort.signal);
        const owned = groups.flatMap(g => g.structures).filter(s => s.kind === 'StorageUnit').sort((a,b) => Number(b.isOnline) - Number(a.isOnline));
        const ownerCaps = new Map(owned.map(s => [s.objectId, s.ownerCapId]));
        const [character, charOwnerCapId] = characterId ? await Promise.all([
          readInventoryCharacter(characterId).catch(() => null), fetchCharacterOwnerCapId(characterId).catch(() => null),
        ]) : [null, null];
        if (cancelled) return;
        setTransferState(prev => ({ ...prev, characterId: characterId || null, ownerCaps, charOwnerCapId }));
        const empty = (ssu: PlayerStructure): SSUInventory => ({ ssu, items: [], resolvedNames: new Map(), loading: false, maxCapacity: 0, usedCapacity: 0, hasLoadedContents: false });
        setInventories(owned.map(ssu => ({ ...empty(ssu), operator: { name: character?.name ?? 'You', key: characterId } })));
        setGlobalLoading(false);
        if ((!SSU_ACCESS_AVAILABLE && !STORAGE_ACCESS_DEPLOYMENT) || !characterId) return;
        setSharedLoading(true);
        try {
          // No stale event-based tribe fallback when checking saved policies.
          if (!character) throw new Error('Character unavailable');
          const [legacyResult, secureResult] = await Promise.allSettled([
            SSU_ACCESS_AVAILABLE ? discoverSharedSsus({ characterObjectId: characterId, ownTribeId: character.tribeId }, new Set(owned.map(s => s.objectId))) : Promise.resolve([]),
            STORAGE_ACCESS_DEPLOYMENT ? discoverStoragePolicies(characterId, character.tribeId, new Set(owned.map(s => s.objectId))) : Promise.resolve([]),
          ]);
          if (!cancelled && (legacyResult.status === 'rejected' || secureResult.status === 'rejected')) setSharedError(true);
          const discovered = legacyResult.status === 'fulfilled' ? legacyResult.value : [];
          const shared: SSUInventory[] = [];
          for (const d of discovered) {
            try {
            const { structure, operator } = await readSharedStorage(d.ssuObjectId);
            shared.push({ ...empty(structure), operator, policy: { policyId: d.policyId, mode: d.mode },
              sharedFrom: d.mode.kind === 'tribe_alliance' ? 'tribe' : d.mode.kind === 'none' ? undefined : d.mode.kind });
            } catch { if (!cancelled) setSharedError(true); }
          }
          if (secureResult.status === 'fulfilled') {
            const existing = new Set([...owned.map(s => s.objectId), ...shared.map(s => s.ssu.objectId)]);
            for (const p of secureResult.value) {
              try {
              const snapshot = await fetchSsuSnapshot(p.ssuId);
              if (!secureStorageExtension(snapshot.extension) || existing.has(p.ssuId)) continue;
              const { structure, operator } = await readSharedStorage(p.ssuId);
              shared.push({ ...empty(structure), operator }); existing.add(p.ssuId);
              } catch { if (!cancelled) setSharedError(true); }
            }
          }
          if (!cancelled) setInventories(prev => [...prev, ...shared]);
        } catch { if (!cancelled) setSharedError(true); }
        finally { if (!cancelled) setSharedLoading(false); }
      } catch {
        if (!cancelled) { setGlobalError('Storage units unavailable.'); setGlobalLoading(false); }
      }
    }
    void load();
    return () => { cancelled = true; abort.abort(); };
  }, [walletAddress, reload]);

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
  // 2026-05-01: lazy-load means SSUs default to collapsed. When new
  // SSUs arrive (initial mount, shared discovery completes, refresh),
  // auto-add them to collapsedIds so users see a clean list of headers
  // and explicitly opt in to loading per-card. SSUs already in
  // collapsedIds (from localStorage or prior state) are unchanged.
  // Once an SSU has been expanded once this session and content has
  // loaded (hasLoadedContents=true), we leave it alone — the user has
  // expressed intent and we respect it.
  useEffect(() => {
    if (inventories.length === 0) return;
    const newlyArrived = inventories.filter(
      inv => !collapsedIds.has(inv.ssu.objectId) && !inv.hasLoadedContents,
    );
    if (newlyArrived.length === 0) return;
    setCollapsedIds(prev => {
      const next = new Set(prev);
      for (const inv of newlyArrived) next.add(inv.ssu.objectId);
      return next;
    });
    // Intentionally only depend on inventories.length so we don't loop
    // when collapsedIds itself updates. New SSUs always change the
    // length.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventories.length]);

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
      const wasCollapsed = next.has(ssuId);
      if (wasCollapsed) next.delete(ssuId);
      else next.add(ssuId);
      // Lazy-load: when a card transitions from collapsed → expanded
      // AND its contents haven't been loaded yet AND it's not
      // currently loading AND there's no prior error to surface,
      // kick off the inventory fetch. Refresh button on the card
      // (refreshSSU) is the explicit re-fetch path; this gate is the
      // implicit first-time fetch on user intent. We schedule it via
      // setTimeout(0) so the setCollapsedIds state update commits
      // first — keeps React rendering deterministic and avoids the
      // 'setState during render' warning.
      if (wasCollapsed) {
        const inv = inventories.find(i => i.ssu.objectId === ssuId);
        if (inv && !inv.hasLoadedContents && !inv.loading && !inv.error) {
          setTimeout(() => { refreshSSU(ssuId); }, 0);
        }
      }
      return next;
    });
  };
  const collapseAll = () => setCollapsedIds(new Set(inventories.map(i => i.ssu.objectId)));
  // Expand-all triggers lazy-load for every not-yet-loaded SSU. We
  // serialize the loads (one at a time) via refreshSSU to stay under
  // the public Sui RPC rate limit; even if the user expands all 11+
  // SSUs at once, the loads queue rather than fire in parallel and
  // re-create the original 'Failed to fetch' cascade. Cards already
  // loaded are skipped.
  const expandAll = () => {
    setCollapsedIds(new Set());
    const toLoad = inventories.filter(
      i => !i.hasLoadedContents && !i.loading && !i.error,
    );
    if (toLoad.length === 0) return;
    // Fire-and-forget serial chain: await between loads so we never
    // pile up requests. refreshSSU sets loading:true synchronously
    // (in setInventories) so a re-entrant toggleCollapse during the
    // chain won't double-fire. Errors per-SSU are swallowed by
    // refreshSSU's own try/catch — they show in the card error slot.
    (async () => {
      for (const inv of toLoad) {
        await refreshSSU(inv.ssu.objectId);
      }
    })();
  };

  // ── Operator grouping + filter (Phase 2) ────────────────────────
  // Once Phase 1 resolves an operator name + key on each SSUInventory,
  // group the cards by operator so users with many shared SSUs can
  // navigate by who deployed each one. Self-pinned at top so the user's
  // own SSUs are always reachable without scrolling. Filter dropdown
  // (persisted in localStorage) lets users focus on a single operator.
  const FILTER_KEY = walletAddress
    ? `cradleos:invpanel:opfilter:${walletAddress}`
    : "cradleos:invpanel:opfilter:_";
  const [operatorFilter, setOperatorFilter] = useState<string>(() => {
    try {
      const v = typeof window !== "undefined"
        ? localStorage.getItem(FILTER_KEY)
        : null;
      return v ?? "__all__";
    } catch { return "__all__"; }
  });
  // Re-read filter when the wallet address changes (account swap).
  useEffect(() => {
    try {
      const v = typeof window !== "undefined"
        ? localStorage.getItem(FILTER_KEY)
        : null;
      setOperatorFilter(v ?? "__all__");
    } catch { setOperatorFilter("__all__"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem(FILTER_KEY, operatorFilter);
    } catch { /* quota / disabled storage — silently ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorFilter, walletAddress]);

  type OperatorGroup = {
    /** Stable group identifier. operator.key for resolved operators,
     *  __self__ for the caller's own SSUs, __unresolved__ for SSUs
     *  whose operator hasn't resolved yet. */
    key: string;
    /** Display string shown in the section header and filter dropdown. */
    label: string;
    /** True iff this group represents the caller's own SSUs. */
    isSelf: boolean;
    inventories: SSUInventory[];
  };

  const operatorGroups = useMemo<OperatorGroup[]>(() => {
    const ownCharKey = transferState.characterId?.toLowerCase() ?? null;
    const buckets = new Map<string, OperatorGroup>();
    for (const inv of inventories) {
      let key: string;
      let label: string;
      let isSelf = false;
      if (!inv.operator) {
        key = "__unresolved__";
        label = "Resolving…";
      } else if (ownCharKey && inv.operator.key === ownCharKey) {
        key = "__self__";
        label = `${inv.operator.name} (you)`;
        isSelf = true;
      } else {
        key = inv.operator.key;
        label = inv.operator.name;
      }
      if (!buckets.has(key)) {
        buckets.set(key, { key, label, isSelf, inventories: [] });
      }
      buckets.get(key)!.inventories.push(inv);
    }
    // Sort: self first, then alphabetical by label, unresolved last.
    return [...buckets.values()].sort((a, b) => {
      if (a.isSelf && !b.isSelf) return -1;
      if (!a.isSelf && b.isSelf) return 1;
      if (a.key === "__unresolved__" && b.key !== "__unresolved__") return 1;
      if (b.key === "__unresolved__" && a.key !== "__unresolved__") return -1;
      return a.label.localeCompare(b.label);
    });
  }, [inventories, transferState.characterId]);

  // Garbage-collect a stale filter selection when the operator it points
  // at is no longer in any group (operator unshared an SSU, or this is a
  // fresh load that hasn't seen the previously-cached operator yet).
  // Reset to "__all__" so the user isn't stuck with an invisible filter.
  useEffect(() => {
    if (operatorFilter === "__all__") return;
    if (inventories.length === 0) return; // still loading; don't reset
    const exists = operatorGroups.some(g => g.key === operatorFilter);
    if (!exists) setOperatorFilter("__all__");
  }, [operatorFilter, operatorGroups, inventories.length]);

  const visibleGroups = useMemo<OperatorGroup[]>(() => {
    if (operatorFilter === "__all__") return operatorGroups;
    return operatorGroups.filter(g => g.key === operatorFilter);
  }, [operatorGroups, operatorFilter]);

  const visibleCount = useMemo(
    () => visibleGroups.reduce((sum, g) => sum + g.inventories.length, 0),
    [visibleGroups],
  );
  const filteredLabel = useMemo(() => {
    if (operatorFilter === "__all__") return null;
    const grp = operatorGroups.find(g => g.key === operatorFilter);
    return grp?.label ?? null;
  }, [operatorFilter, operatorGroups]);

  // Effective collapse count: only count collapsedIds that refer to SSUs
  // currently in the inventories list. Stale ids from previous sessions
  // (when shared discovery returned different SSUs) would otherwise inflate
  // the count to e.g. "11 collapsed" against "7 storages".
  const effectiveCollapsedCount = useMemo(() => {
    if (collapsedIds.size === 0) return 0;
    let n = 0;
    for (const inv of inventories) {
      if (collapsedIds.has(inv.ssu.objectId)) n++;
    }
    return n;
  }, [collapsedIds, inventories]);

  // GC stale collapse ids when inventories change. Don't run while still
  // loading (inventories.length === 0 immediately after wallet change),
  // and avoid pruning when shared discovery hasn't completed yet — its
  // SSUs may legitimately appear in collapsedIds from a previous session.
  // Threshold: prune when there's been a stable inventory snapshot for at
  // least one render and at least one stale id is detected.
  useEffect(() => {
    if (inventories.length === 0) return;
    if (collapsedIds.size === 0) return;
    const liveIds = new Set(inventories.map(i => i.ssu.objectId));
    const stale = [...collapsedIds].filter(id => !liveIds.has(id));
    if (stale.length === 0) return;
    // Only prune ids that have been stale for >5 seconds since the last
    // inventory change — this gives shared discovery + slow operator
    // resolution time to surface their SSUs without us pruning them.
    const t = setTimeout(() => {
      setCollapsedIds(prev => {
        const next = new Set(prev);
        for (const id of stale) next.delete(id);
        return next;
      });
    }, 5000);
    return () => clearTimeout(t);
  }, [collapsedIds, inventories]);

  return (
    <div style={{ padding: "0 0 24px" }}>
      <nav className="inventory-modes" aria-label="Inventory mode"><button aria-pressed={area === "storage"} onClick={()=>setArea("storage")}>Tribal storage</button><button aria-pressed={area === "storefront"} onClick={()=>setArea("storefront")}>Storefronts</button></nav>
      {area === "storefront" ? <StorefrontPanel walletAddress={walletAddress} characterId={transferState.characterId} ownerCaps={transferState.ownerCaps} charOwnerCapId={transferState.charOwnerCapId} owned={inventories.filter(i=>transferState.ownerCaps.has(i.ssu.objectId)).map(i=>i.ssu)} /> : <>
      <section className="ssu-overview">
        <h2><ClientUIIcon name="gameplay/inventory_32px" size={32} />Tribal storage</h2>

        <div className="ssu-warning"><strong>{STORAGE_ACCESS_DEPLOYMENT ? 'Legacy sharing paused' : 'Shared transfers paused'}</strong>Existing on-chain access remains active.</div>
      </section>

      {/* No wallet */}
      {!walletAddress && (
        <div
          style={{
            color: "rgba(175,175,155,0.5)",
            fontFamily: "monospace",
            fontSize: 12,
            padding: "24px 0",
            textAlign: "center",
          }}
        >
          Connect EVE Vault
        </div>
      )}

      {/* Global loading */}
      {walletAddress && globalLoading && (
        <div
          style={{
            color: "rgba(175,175,155,0.4)",
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
          {globalError} <button onClick={() => setReload(n => n + 1)}>Retry</button>
        </div>
      )}

      {sharedLoading && <div role="status">Reading shared storage…</div>}
      {sharedError && <div role="status">Shared storage unavailable. <button onClick={() => setReload(n => n + 1)}>Retry</button></div>}
      {/* No SSUs found */}
      {walletAddress && !globalLoading && !globalError && !sharedLoading && !sharedError && inventories.length === 0 && (
        <div
          style={{
            color: "rgba(175,175,155,0.4)",
            fontFamily: "monospace",
            fontSize: 12,
            padding: "16px 0",
            fontStyle: "italic",
          }}
        >
          No Storage Units found for this wallet.
        </div>
      )}

      {/* Toolbar: operator filter + collapse/expand controls. Only render
          when there are 2+ SSUs; with one card the controls are noise. */}
      {inventories.length >= 2 && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
            fontFamily: "monospace",
            fontSize: 9,
            letterSpacing: "0.08em",
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "rgba(175,175,155,0.5)" }}>
            {operatorFilter === "__all__"
              ? <>{inventories.length} storage{inventories.length === 1 ? "" : "s"} · {effectiveCollapsedCount} collapsed</>
              : <>{visibleCount} of {inventories.length} storages · filtered: {filteredLabel} · {effectiveCollapsedCount} collapsed</>}
          </span>
          {/* Operator filter — only render when 2+ distinct groups exist.
              With a single operator (the user's own SSUs only, no shared)
              the dropdown adds noise without value.
              Custom dropdown (NOT native <select>) because the EVE Vault
              Mobile / Stillness embedded webview renders native <select>
              popouts at the top-left of the iframe and dismisses them
              instantly on focus loss. Same class of bug as the
              `window.prompt` / `window.confirm` no-op (see AGENTS.md
              Webview Dialog Ban). Portal-mounted list anchored to the
              button avoids both problems. */}
          {operatorGroups.length >= 2 && (
            <OperatorFilterDropdown
              value={operatorFilter}
              onChange={setOperatorFilter}
              groups={operatorGroups}
              totalCount={inventories.length}
            />
          )}
          <button
            onClick={collapseAll}
            disabled={effectiveCollapsedCount === inventories.length}
            title="Collapse every storage card. Affects ALL SSUs, not just the filtered view."
            style={{
              fontSize: 9, fontFamily: "monospace", letterSpacing: "0.08em",
              background: "transparent",
              border: "1px solid rgba(255,71,0,0.3)",
              color: effectiveCollapsedCount === inventories.length ? "rgba(255,71,0,0.3)" : "#FF4700",
              padding: "2px 8px",
              cursor: effectiveCollapsedCount === inventories.length ? "default" : "pointer",
            }}
          >COLLAPSE ALL</button>
          <button
            onClick={expandAll}
            disabled={effectiveCollapsedCount === 0}
            title="Expand every storage card. Affects ALL SSUs, not just the filtered view."
            style={{
              fontSize: 9, fontFamily: "monospace", letterSpacing: "0.08em",
              background: "transparent",
              border: "1px solid rgba(255,71,0,0.3)",
              color: effectiveCollapsedCount === 0 ? "rgba(255,71,0,0.3)" : "#FF4700",
              padding: "2px 8px",
              cursor: effectiveCollapsedCount === 0 ? "default" : "pointer",
            }}
          >EXPAND ALL</button>
        </div>
      )}

      {/* SSU cards — grouped by operator. When the user has selected a
          specific operator from the filter, only that group renders. The
          group section header is suppressed when there's only one group
          visible (no point in a header for a single section). */}
      {visibleGroups.map(group => {
        const showHeader = operatorFilter === "__all__" && operatorGroups.length >= 2;
        return (
          <div key={group.key} style={{ marginBottom: showHeader ? 14 : 0 }}>
            {showHeader && (
              <div
                style={{
                  padding: "6px 0 4px",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  marginBottom: 4,
                  fontFamily: "monospace",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  color: group.isSelf ? "#FF4700" : "rgba(200,200,180,0.55)",
                }}
              >
                ── {group.label.toUpperCase()} ({group.inventories.length}) ──
              </div>
            )}
            {group.inventories.map(inv => (
              <SSUCard
                key={inv.ssu.objectId}
                inv={inv}
                characterId={transferState.characterId}
                ownerCaps={transferState.ownerCaps}
                walletAddress={walletAddress}
                onRefresh={refreshSSU}
                collapsed={collapsedIds.has(inv.ssu.objectId)}
                onToggleCollapse={() => toggleCollapse(inv.ssu.objectId)}
                charOwnerCapId={transferState.charOwnerCapId}
              />
            ))}
          </div>
        );
      })}

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
      </>}
    </div>
  );
}
