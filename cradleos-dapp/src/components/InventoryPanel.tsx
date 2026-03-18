import { useState, useEffect, useRef } from "react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { fetchPlayerStructures, type PlayerStructure, findCharacterForWallet } from "../lib";
import { SUI_TESTNET_RPC, WORLD_API, WORLD_PKG } from "../constants";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { Transaction } from "@mysten/sui/transactions";

// ── Types ─────────────────────────────────────────────────────────────────────

type InventoryItem = {
  typeId: number;
  quantity: number;
  volume: number;
  itemId: string;
};

type SSUInventory = {
  ssu: PlayerStructure;
  items: InventoryItem[];
  resolvedNames: Map<number, string>;
  loading: boolean;
  error?: string;
  maxCapacity: number;
  usedCapacity: number;
};

type TransferState = {
  characterId: string | null;
  ownerCaps: Map<string, string>; // ssuObjectId → ownerCapId
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
  items: Array<{ typeId: number; quantity: number; volume: number; itemId: string }>;
  maxCapacity: number;
  usedCapacity: number;
};

async function fetchSSUInventory(ssuId: string): Promise<SSUInventoryResult> {
  // 1. Get dynamic fields (inventory slots)
  const dfRes = await fetch(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "suix_getDynamicFields",
      params: [ssuId, null, 20],
    }),
  });
  const dfJson = await dfRes.json();
  const keys: string[] =
    dfJson.result?.data?.map((f: any) => f.name?.value).filter(Boolean) ?? [];

  const rawItems: Array<{ typeId: number; quantity: number; volume: number; itemId: string }> = [];
  let maxCapacity = 0;
  let usedCapacity = 0;

  // 2. For each slot key, get inventory contents + capacity fields
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
      // Read capacity from inventory object fields
      if (invFields.max_capacity !== undefined) {
        maxCapacity = Math.max(maxCapacity, Number(invFields.max_capacity));
      }
      if (invFields.used_capacity !== undefined) {
        usedCapacity += Number(invFields.used_capacity);
      }
    }
    const contents = invFields?.items?.fields?.contents ?? [];
    for (const entry of contents) {
      const val = entry?.fields?.value?.fields;
      if (val) {
        rawItems.push({
          typeId: Number(val.type_id),
          quantity: Number(val.quantity),
          volume: Number(val.volume),
          itemId: String(val.item_id),
        });
      }
    }
  }

  // Deduplicate by typeId (sum quantities across slots)
  const map = new Map<number, { typeId: number; quantity: number; volume: number; itemId: string }>();
  for (const item of rawItems) {
    if (map.has(item.typeId)) {
      map.get(item.typeId)!.quantity += item.quantity;
    } else {
      map.set(item.typeId, { ...item });
    }
  }
  return {
    items: [...map.values()].sort((a, b) => b.quantity - a.quantity),
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
const COL_ACT  = { width: 90,  flexShrink: 0, textAlign: "right" as const };

type SSUCardProps = {
  inv: SSUInventory;
  characterId: string | null;
  ownerCaps: Map<string, string>;
  dAppKit: ReturnType<typeof useDAppKit>;
  walletAddress: string | undefined;
  allSsuIds: string[];
  onRefresh: (ssuObjectId: string) => void;
};

function SSUCard({ inv, characterId, ownerCaps, dAppKit, walletAddress, onRefresh }: SSUCardProps) {
  const { ssu, items, resolvedNames, loading, error } = inv;
  const [withdrawingTypeId, setWithdrawingTypeId] = useState<number | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);


  const ownerCapId = ownerCaps.get(ssu.objectId);
  const nonZero = items.filter(i => i.quantity > 0);
  const totalVol = nonZero.reduce((acc, i) => acc + i.volume * i.quantity, 0);
  const usedCap = inv.usedCapacity > 0 ? inv.usedCapacity : totalVol;
  const maxCap = inv.maxCapacity > 0 ? inv.maxCapacity : 2_000_000;
  const suffix = ssu.objectId.slice(-6);

  // Withdraw item from SSU to wallet
  async function handleWithdraw(item: InventoryItem) {
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
      onRefresh(ssu.objectId);
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
          CAPACITY: {usedCap.toLocaleString()} / {maxCap.toLocaleString()} m³
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
                const isWithdrawing = withdrawingTypeId === item.typeId;
                return (
                  <div
                    key={item.typeId}
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
                      }}
                      title={name}
                    >
                      {name}
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
                      {item.volume.toLocaleString()}
                    </div>
                    <div
                      style={{
                        ...COL_TOT,
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "#c8c8b8",
                      }}
                    >
                      {totalItemVol.toLocaleString()}
                    </div>
                    {ownerCapId && (
                      <div style={{ ...COL_ACT }}>
                        <button
                          disabled={isWithdrawing || withdrawingTypeId !== null}
                          onClick={() => handleWithdraw(item)}
                          style={{
                            fontSize: 10,
                            fontFamily: "monospace",
                            letterSpacing: "0.08em",
                            background: "transparent",
                            border: `1px solid rgba(255,71,0,${isWithdrawing ? 0.2 : 0.4})`,
                            color: isWithdrawing ? "rgba(255,71,0,0.4)" : "#FF4700",
                            padding: "2px 6px",
                            cursor: isWithdrawing ? "not-allowed" : "pointer",
                          }}
                        >
                          {isWithdrawing ? "WITHDRAWING…" : "WITHDRAW"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
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
  nameCache: Map<number, string>;
  onRefresh: (ssuObjectId: string) => void;
};

function WalletItemsSection({
  characterId,
  walletAddress,
  ownerCaps,
  dAppKit,
  allSsuIds,
  nameCache,
  onRefresh,
}: WalletItemsSectionProps) {
  const [walletItems, setWalletItems] = useState<WalletItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [depositStatus, setDepositStatus] = useState<Map<string, { status?: string; error?: string }>>(new Map());

  useEffect(() => {
    if (!walletAddress) return;
    setLoading(true);
    fetchWalletItems(walletAddress, WORLD_API, nameCache, characterId ?? undefined)
      .then(setWalletItems)
      .catch(() => setWalletItems([]))
      .finally(() => setLoading(false));
  }, [walletAddress, characterId]);

  async function handleDeposit(item: WalletItem, targetSsuId: string) {
    if (!characterId) return;
    const targetCapId = ownerCaps.get(targetSsuId);
    if (!targetCapId) {
      setDepositStatus(prev => new Map(prev).set(item.objectId, { error: "No OwnerCap for target SSU." }));
      return;
    }
    setDepositStatus(prev => new Map(prev).set(item.objectId, { status: "Depositing…" }));
    try {
      const tx = new Transaction();
      // Borrow OwnerCap from Character
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
          tx.object(targetSsuId),
          tx.object(item.objectId),
          tx.object(characterId),
          ownerCap,
        ],
      });
      // Return OwnerCap back to Character
      tx.moveCall({
        target: `${WORLD_PKG}::character::return_owner_cap`,
        typeArguments: [`${WORLD_PKG}::storage_unit::StorageUnit`],
        arguments: [
          tx.object(characterId),
          ownerCap,
          receipt,
        ],
      });
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setDepositStatus(prev => new Map(prev).set(item.objectId, { status: "Deposited." }));
      onRefresh(targetSsuId);
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
                    onClick={() => handleDeposit(item, item.parentId!)}
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
                {!item.parentId && allSsuIds.length > 0 && (
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
                      if (e.target.value) handleDeposit(item, e.target.value);
                    }}
                  >
                    <option value="" disabled>DEPOSIT ▾</option>
                    {allSsuIds.map(id => (
                      <option key={id} value={id}>
                        {id.slice(-10)}
                      </option>
                    ))}
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

export function InventoryPanel() {
  const { account } = useVerifiedAccountContext();
  const walletAddress = account?.address;
  const dAppKit = useDAppKit();
  const [inventories, setInventories] = useState<SSUInventory[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | undefined>();
  const nameCache = useRef<Map<number, string>>(new Map());
  const [transferState, setTransferState] = useState<TransferState>({
    characterId: null,
    ownerCaps: new Map(),
    pendingWithdraw: null,
    pendingDeposit: null,
    txStatus: null,
    txError: null,
  });

  // Refresh a single SSU's inventory
  const refreshSSU = async (ssuObjectId: string) => {
    const idx = inventories.findIndex(inv => inv.ssu.objectId === ssuObjectId);
    if (idx === -1) return;
    setInventories(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], loading: true };
      return next;
    });
    try {
      const { items, maxCapacity, usedCapacity } = await fetchSSUInventory(ssuObjectId);
      const resolvedNames = new Map<number, string>();
      await Promise.all(
        items.map(async item => {
          const name = await resolveItemName(item.typeId, WORLD_API, nameCache.current);
          resolvedNames.set(item.typeId, name);
        })
      );
      setInventories(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], items, resolvedNames, maxCapacity, usedCapacity, loading: false, error: undefined };
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

        const allStructures = groups.flatMap(g => g.structures);
        const ssus = allStructures.filter(s => s.kind === "StorageUnit");

        // Sort: online first, then offline
        ssus.sort((a, b) => {
          if (a.isOnline === b.isOnline) return 0;
          return a.isOnline ? -1 : 1;
        });

        // Fetch OwnerCaps if we have a characterId
        let ownerCaps = new Map<string, string>();
        if (characterId) {
          try {
            ownerCaps = await fetchOwnerCaps(characterId);
          } catch {
            // non-fatal
          }
        }

        if (cancelled) return;

        setTransferState(prev => ({ ...prev, characterId, ownerCaps }));

        // Initialize loading placeholders
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

        // Load each SSU inventory in parallel
        await Promise.all(
          ssus.map(async (ssu, idx) => {
            try {
              const { items, maxCapacity, usedCapacity } = await fetchSSUInventory(ssu.objectId);

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
                const next = [...prev];
                next[idx] = {
                  ...next[idx],
                  items,
                  resolvedNames,
                  maxCapacity,
                  usedCapacity,
                  loading: false,
                };
                return next;
              });
            } catch (err: any) {
              if (cancelled) return;
              setInventories(prev => {
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
        />
      ))}

      {/* Wallet Items section */}
      {walletAddress && !globalLoading && transferState.characterId && (
        <WalletItemsSection
          characterId={transferState.characterId}
          walletAddress={walletAddress}
          ownerCaps={transferState.ownerCaps}
          dAppKit={dAppKit}
          allSsuIds={allSsuIds}
          nameCache={nameCache.current}
          onRefresh={refreshSSU}
        />
      )}
    </div>
  );
}
