import { useState, useEffect, useRef } from "react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { fetchPlayerStructures, type PlayerStructure, type LocationGroup } from "../lib";
import { SUI_TESTNET_RPC, WORLD_API } from "../constants";

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
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchSSUInventory(
  ssuId: string
): Promise<Array<{ typeId: number; quantity: number; volume: number; itemId: string }>> {
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

  const items: Array<{ typeId: number; quantity: number; volume: number; itemId: string }> = [];

  // 2. For each slot key, get inventory contents
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
    const contents =
      invJson.result?.data?.content?.fields?.value?.fields?.items?.fields?.contents ?? [];
    for (const entry of contents) {
      const val = entry?.fields?.value?.fields;
      if (val) {
        items.push({
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
  for (const item of items) {
    if (map.has(item.typeId)) {
      map.get(item.typeId)!.quantity += item.quantity;
    } else {
      map.set(item.typeId, { ...item });
    }
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity);
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

function SSUCard({ inv }: { inv: SSUInventory }) {
  const { ssu, items, resolvedNames, loading, error } = inv;

  const nonZero = items.filter(i => i.quantity > 0);
  const totalVol = nonZero.reduce((acc, i) => acc + i.volume * i.quantity, 0);
  // EVE Frontier SSU capacity is typically 2,000,000 — use totalVol as used for now
  const maxVol = 2_000_000;

  const suffix = ssu.objectId.slice(-6);

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
          USED: {totalVol.toLocaleString()} / {maxVol.toLocaleString()} vol
        </div>
        <CapacityBar used={totalVol} max={maxVol} />
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
                return (
                  <div
                    key={item.typeId}
                    style={{
                      display: "flex",
                      gap: 8,
                      padding: "3px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
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

// ── Main component ────────────────────────────────────────────────────────────

export function InventoryPanel() {
  const { account } = useVerifiedAccountContext();
  const walletAddress = account?.address;
  const [inventories, setInventories] = useState<SSUInventory[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | undefined>();
  const nameCache = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;

    async function load() {
      setGlobalLoading(true);
      setGlobalError(undefined);
      setInventories([]);
      try {
        const groups: LocationGroup[] = await fetchPlayerStructures(walletAddress!);
        const allStructures = groups.flatMap(g => g.structures);
        const ssus = allStructures.filter(s => s.kind === "StorageUnit");

        // Sort: online first, then offline
        ssus.sort((a, b) => {
          if (a.isOnline === b.isOnline) return 0;
          return a.isOnline ? -1 : 1;
        });

        if (cancelled) return;

        // Initialize loading placeholders
        setInventories(
          ssus.map(ssu => ({
            ssu,
            items: [],
            resolvedNames: new Map(),
            loading: true,
          }))
        );
        setGlobalLoading(false);

        // Load each SSU inventory in parallel
        await Promise.all(
          ssus.map(async (ssu, idx) => {
            try {
              const items = await fetchSSUInventory(ssu.objectId);

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
        <SSUCard key={inv.ssu.objectId} inv={inv} />
      ))}
    </div>
  );
}
