/**
 * LinksPanel — Attach CradleOS services to your on-chain structures.
 *
 * Stores the link as the structure's metadata.url field on-chain.
 * The Keeper easter egg is unlabeled — players discover it.
 */

import { useState, useEffect } from "react";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { useQuery } from "@tanstack/react-query";
import {
  fetchPlayerStructures,
  buildSetUrlTransaction,
  findCharacterForWallet,
  type PlayerStructure,
} from "../lib";

// ── Service definitions ───────────────────────────────────────────────────────

const BASE = "https://r4wf0d0g23.github.io/CradleOS";
const KEEPER_URL = `${BASE}/#/keeper`;

interface ServiceDef {
  id: string;
  label: string;
  description: string;
  url: string;
  icon: string;
  secret?: boolean;
}

const SERVICES: ServiceDef[] = [
  {
    id: "intel",
    label: "Intel Dashboard",
    description: "Live kill feed, security heatmap, and infrastructure overview.",
    url: `${BASE}/#/intel`,
    icon: "🔍",
  },
  {
    id: "war",
    label: "War Board",
    description: "Lineage War scoreboard, tick countdown, and contested systems.",
    url: `${BASE}/#/war`,
    icon: "⚔",
  },
  {
    id: "tribe",
    label: "Tribe Vault",
    description: "Treasury, EVE balances, and tribe administration.",
    url: `${BASE}/#/tribe`,
    icon: "🏛",
  },
  {
    id: "fitting",
    label: "Ship Fitting",
    description: "Ship stats, fitting calculator, and comparison tool.",
    url: `${BASE}/#/fitting`,
    icon: "🚀",
  },
  {
    id: "wiki",
    label: "Knowledge Base",
    description: "EVE Frontier game mechanics, structures, and ship guides.",
    url: `${BASE}/#/wiki`,
    icon: "📚",
  },
  {
    id: "map",
    label: "Star Map",
    description: "System topology, gate links, and constellation navigation.",
    url: `${BASE}/#/map`,
    icon: "🗺",
  },
  {
    id: "industry",
    label: "Industry",
    description: "Manufacturing queues, blueprints, and production chains.",
    url: `${BASE}/#/industry`,
    icon: "⚙",
  },
  {
    id: "bounties",
    label: "Bounties",
    description: "Active bounty board — post and claim targets.",
    url: `${BASE}/#/bounties`,
    icon: "🎯",
  },
  {
    id: "srp",
    label: "Insurance / SRP",
    description: "Ship replacement program submissions and payouts.",
    url: `${BASE}/#/srp`,
    icon: "🛡",
  },
  {
    id: "cargo",
    label: "Cargo Contracts",
    description: "Hauling contracts and cargo courier listings.",
    url: `${BASE}/#/cargo`,
    icon: "📦",
  },
  {
    id: "defense",
    label: "Defense Policy",
    description: "Standing orders, rules of engagement, and KOS list.",
    url: `${BASE}/#/defense`,
    icon: "🛡",
  },
  {
    id: "hierarchy",
    label: "Hierarchy",
    description: "Tribe org chart, roles, and member directory.",
    url: `${BASE}/#/hierarchy`,
    icon: "👥",
  },
  {
    id: "calendar",
    label: "Calendar",
    description: "Fleet ops schedule, timers, and event planner.",
    url: `${BASE}/#/calendar`,
    icon: "📅",
  },
  {
    id: "query",
    label: "Query",
    description: "Live on-chain data query and explorer.",
    url: `${BASE}/#/query`,
    icon: "🔎",
  },
  {
    id: "keeper",
    label: "",            // intentionally blank — easter egg
    description: "",
    url: KEEPER_URL,
    icon: "🔒",
    secret: true,
  },
];

// Services shown in the dropdown (exclude secret and non-kiosk tabs)
const DROPDOWN_SERVICES = SERVICES.filter(s => !s.secret);

// ── Helpers ───────────────────────────────────────────────────────────────────

function kindIcon(kind: string): string {
  switch (kind) {
    case "NetworkNode": return "⬡";
    case "Gate": return "⛩";
    case "Turret": return "🔫";
    case "StorageUnit": return "🗄";
    default: return "⊞";
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface StructureCardProps {
  s: PlayerStructure;
  busy: string | null;
  err: string | null;
  customUrls: Record<string, string>;
  selectedService: Record<string, string>;
  onCustomUrlChange: (id: string, val: string) => void;
  onServiceSelect: (id: string, svcId: string) => void;
  onLink: (s: PlayerStructure, url: string) => void;
  onDetach: (s: PlayerStructure) => void;
  indented?: boolean;
}

function StructureCard({
  s, busy, customUrls, selectedService,
  onCustomUrlChange, onServiceSelect, onLink, onDetach,
  indented = false,
}: StructureCardProps) {
  const currentUrl = s.metadataUrl ?? "";
  const matchedService = SERVICES.find(svc => currentUrl && currentUrl.startsWith(svc.url));
  const isBusy = busy === s.objectId;
  const pendingSvcId = selectedService[s.objectId] ?? "";
  const pendingSvc = DROPDOWN_SERVICES.find(sv => sv.id === pendingSvcId);

  const selectStyle: React.CSSProperties = {
    flex: 1,
    padding: "5px 8px",
    fontSize: 11,
    background: "#1a1a1a",
    color: "#e0e0d0",
    border: "1px solid rgba(255,71,0,0.25)",
    borderRadius: 2,
    fontFamily: "inherit",
    cursor: "pointer",
    outline: "none",
  };

  return (
    <div style={{
      marginBottom: 10,
      marginLeft: indented ? 24 : 0,
      border: `1px solid ${currentUrl ? "rgba(0,255,150,0.25)" : "rgba(255,71,0,0.12)"}`,
      borderRadius: 3,
      background: "rgba(5,3,2,0.7)",
      overflow: "hidden",
    }}>
      {/* Structure header */}
      <div style={{
        padding: "8px 14px",
        display: "flex", alignItems: "center", gap: 10,
        background: currentUrl ? "rgba(0,255,150,0.05)" : "rgba(0,0,0,0.25)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        {/* Kind icon — more prominent */}
        <span style={{ fontSize: 18, lineHeight: 1 }}>{kindIcon(s.kind)}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#e0e0d0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {s.displayName}
          </div>
          <div style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(107,107,94,0.5)" }}>
            {s.kind} · #{s.gameItemId ?? s.objectId.slice(0, 8)}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* Online badge */}
          <span style={{
            fontSize: 9, padding: "1px 6px", borderRadius: 2,
            background: s.isOnline ? "rgba(0,255,150,0.1)" : "rgba(255,68,68,0.1)",
            color: s.isOnline ? "#00ff96" : "#ff6666",
            border: `1px solid ${s.isOnline ? "rgba(0,255,150,0.2)" : "rgba(255,68,68,0.2)"}`,
            letterSpacing: "0.06em",
          }}>
            {s.isOnline ? "ONLINE" : "OFFLINE"}
          </span>

          {/* Linked service — prominent green badge */}
          {currentUrl && matchedService && !matchedService.secret && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 3,
              background: "rgba(0,255,150,0.12)", color: "#00ff96",
              border: "1px solid rgba(0,255,150,0.3)",
            }}>
              {matchedService.icon} {matchedService.label}
            </span>
          )}
          {currentUrl && matchedService?.secret && (
            <span style={{
              fontSize: 12, padding: "3px 8px", borderRadius: 3,
              background: "rgba(255,255,255,0.04)", color: "rgba(107,107,94,0.6)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}>⚓</span>
          )}
          {currentUrl && !matchedService && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 3,
              background: "rgba(0,255,150,0.12)", color: "#00ff96",
              border: "1px solid rgba(0,255,150,0.3)",
            }}>
              🔗 Custom
            </span>
          )}
        </div>
      </div>

      {/* Service picker */}
      <div style={{ padding: "10px 14px" }}>
        {currentUrl ? (
          // Currently linked
          <div>
            <div style={{
              fontSize: 10, fontFamily: "monospace", color: "rgba(180,160,140,0.5)",
              marginBottom: 8, wordBreak: "break-all",
            }}>
              {matchedService?.secret ? "███████████████" : currentUrl}
            </div>
            <button
              onClick={() => onDetach(s)}
              disabled={isBusy}
              style={{
                padding: "3px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.25)",
                color: "#ff8080", cursor: "pointer", borderRadius: 2, fontFamily: "inherit",
                opacity: isBusy ? 0.5 : 1,
              }}
            >
              {isBusy ? "UNLINKING…" : "⊗ DETACH"}
            </button>
          </div>
        ) : (
          // Unlinked — dropdown + custom URL
          <div>
            <div style={{ fontSize: 10, color: "rgba(107,107,94,0.5)", marginBottom: 8, letterSpacing: "0.08em" }}>
              ATTACH SERVICE
            </div>

            {/* Dropdown row */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
              <select
                value={pendingSvcId}
                onChange={e => onServiceSelect(s.objectId, e.target.value)}
                disabled={isBusy}
                style={selectStyle}
              >
                <option value="" style={{ background: "#1a1a1a", color: "#e0e0d0" }}>
                  Select a service…
                </option>
                {DROPDOWN_SERVICES.map(svc => (
                  <option
                    key={svc.id}
                    value={svc.id}
                    style={{ background: "#1a1a1a", color: "#e0e0d0" }}
                  >
                    {svc.icon} {svc.label}
                  </option>
                ))}
              </select>

              {pendingSvc && (
                <button
                  onClick={() => onLink(s, pendingSvc.url)}
                  disabled={isBusy}
                  style={{
                    padding: "5px 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                    background: "rgba(0,255,150,0.1)", border: "1px solid rgba(0,255,150,0.35)",
                    color: "#00ff96", cursor: "pointer", borderRadius: 2, fontFamily: "inherit",
                    opacity: isBusy ? 0.5 : 1, flexShrink: 0,
                  }}
                >
                  {isBusy ? "…" : "LINK"}
                </button>
              )}
            </div>

            {/* Custom URL fallback */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                value={customUrls[s.objectId] ?? ""}
                onChange={e => onCustomUrlChange(s.objectId, e.target.value)}
                placeholder="or enter custom URL…"
                style={{
                  flex: 1, padding: "4px 8px", fontSize: 11, fontFamily: "monospace",
                  background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)",
                  color: "#c8c8b8", borderRadius: 2, outline: "none",
                }}
              />
              <button
                onClick={() => {
                  const u = customUrls[s.objectId]?.trim();
                  if (u) onLink(s, u);
                }}
                disabled={isBusy || !customUrls[s.objectId]?.trim()}
                style={{
                  padding: "4px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer",
                  background: "rgba(255,71,0,0.08)", border: "1px solid rgba(255,71,0,0.2)",
                  color: "#FF4700", borderRadius: 2, fontFamily: "inherit",
                  opacity: (isBusy || !customUrls[s.objectId]?.trim()) ? 0.4 : 1,
                }}
              >
                LINK
              </button>
            </div>

            {/* Easter egg — only visible on Nodes and SSUs */}
            {(s.kind === "NetworkNode" || s.kind === "StorageUnit") && (
              <div style={{ marginTop: 8, textAlign: "right" }}>
                <button
                  onClick={() => onLink(s, KEEPER_URL)}
                  disabled={isBusy}
                  title=""
                  style={{
                    padding: "3px 8px", fontSize: 13, cursor: "pointer", borderRadius: 2,
                    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                    color: "rgba(107,107,94,0.3)", fontFamily: "inherit",
                    opacity: isBusy ? 0.4 : 1,
                  }}
                >
                  🔒
                </button>
              </div>
            )}
          </div>
        )}
        {isBusy && (
          <div style={{ fontSize: 10, color: "rgba(255,200,0,0.7)", marginTop: 6 }}>
            Signing transaction…
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function LinksPanel() {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const [characterId, setCharacterId] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [customUrls, setCustomUrls] = useState<Record<string, string>>({});
  const [selectedService, setSelectedService] = useState<Record<string, string>>({}); // structureId → service id

  const { data: groups, isLoading, refetch } = useQuery({
    queryKey: ["playerStructures", account?.address],
    queryFn: () => fetchPlayerStructures(account!.address),
    enabled: !!account,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!account) return;
    findCharacterForWallet(account.address).then(c => {
      if (c?.characterId) setCharacterId(c.characterId);
    });
  }, [account?.address]);

  const allStructures: PlayerStructure[] = (groups ?? []).flatMap(g => g.structures);

  const handleLink = async (structure: PlayerStructure, url: string) => {
    if (!characterId) return;
    setBusy(structure.objectId); setErr(null);
    try {
      const tx = buildSetUrlTransaction(structure, characterId, url);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      // Clear selection after linking
      setSelectedService(p => { const n = { ...p }; delete n[structure.objectId]; return n; });
      refetch();
    } catch (e) {
      setErr(e instanceof Error ? e.message.slice(0, 120) : String(e));
    } finally { setBusy(null); }
  };

  const handleDetach = async (structure: PlayerStructure) => {
    await handleLink(structure, "");
  };

  if (!account) {
    return (
      <div style={{ padding: "40px 24px", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
        Connect your EVE Vault to manage structure links.
      </div>
    );
  }

  // ── Node → Structure grouping ─────────────────────────────────────────────
  // Build a map: networkNodeObjectId → NetworkNode structure
  const nodeMap = new Map<string, PlayerStructure>(
    allStructures
      .filter(s => s.kind === "NetworkNode")
      .map(s => [s.objectId, s])
  );

  // Group children by their energySourceId
  const nodeChildren = new Map<string, PlayerStructure[]>();
  const unanchored: PlayerStructure[] = [];

  for (const s of allStructures) {
    if (s.kind === "NetworkNode") continue; // nodes are headers, not children
    const parentId = s.energySourceId;
    if (parentId && nodeMap.has(parentId)) {
      const existing = nodeChildren.get(parentId) ?? [];
      existing.push(s);
      nodeChildren.set(parentId, existing);
    } else {
      unanchored.push(s);
    }
  }

  // Nodes that have no children AND are not referenced by any child — show in unanchored too
  const referencedNodeIds = new Set(
    allStructures.map(s => s.energySourceId).filter(Boolean) as string[]
  );

  const sharedProps = {
    busy,
    err,
    customUrls,
    selectedService,
    onCustomUrlChange: (id: string, val: string) =>
      setCustomUrls(p => ({ ...p, [id]: val })),
    onServiceSelect: (id: string, svcId: string) =>
      setSelectedService(p => ({ ...p, [id]: svcId })),
    onLink: handleLink,
    onDetach: handleDetach,
  };

  const nodesSorted = Array.from(nodeMap.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  return (
    <div style={{ fontFamily: "inherit", padding: "0 4px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#FF4700", letterSpacing: "0.1em", marginBottom: 6 }}>
          🔗 STRUCTURE LINKS
        </div>
        <p style={{ fontSize: 11, color: "rgba(180,160,140,0.6)", margin: 0, lineHeight: 1.6 }}>
          Attach CradleOS services to your deployed structures. Links are stored on-chain in the structure's metadata —
          visible to anyone who queries the structure.
        </p>
      </div>

      {isLoading && <div style={{ color: "rgba(107,107,94,0.6)", fontSize: 12 }}>Loading structures…</div>}

      {!isLoading && allStructures.length === 0 && (
        <div style={{ color: "rgba(107,107,94,0.6)", fontSize: 12 }}>
          No structures found. Deploy a Network Node or other structure in-game first.
        </div>
      )}

      {/* Nodes with their children */}
      {nodesSorted.map(node => {
        const children = nodeChildren.get(node.objectId) ?? [];
        const isReferenced = referencedNodeIds.has(node.objectId);
        // If node has no children and isn't referenced, render in UNANCHORED section instead
        if (!isReferenced && children.length === 0) return null;

        return (
          <div key={node.objectId} style={{ marginBottom: 18 }}>
            {/* Node header card */}
            <div style={{
              padding: "7px 14px",
              marginBottom: 8,
              background: "rgba(0,232,255,0.04)",
              border: "1px solid rgba(0,232,255,0.2)",
              borderRadius: 3,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>⬡</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#00e8ff", letterSpacing: "0.06em" }}>
                  {node.displayName}
                </div>
                <div style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(0,232,255,0.4)" }}>
                  NETWORK NODE · #{node.gameItemId ?? node.objectId.slice(0, 8)}
                  {typeof node.fuelLevelPct === "number"
                    ? ` · ⛽ ${node.fuelLevelPct.toFixed(0)}%`
                    : ""}
                </div>
              </div>
              <span style={{
                fontSize: 9, padding: "1px 6px", borderRadius: 2,
                background: node.isOnline ? "rgba(0,232,255,0.1)" : "rgba(255,68,68,0.1)",
                color: node.isOnline ? "#00e8ff" : "#ff6666",
                border: `1px solid ${node.isOnline ? "rgba(0,232,255,0.25)" : "rgba(255,68,68,0.2)"}`,
                letterSpacing: "0.06em",
              }}>
                {node.isOnline ? "ONLINE" : "OFFLINE"}
              </span>
            </div>

            {/* Node itself as a linkable structure */}
            <StructureCard s={node} indented {...sharedProps} />

            {/* Child structures */}
            {children.map(child => (
              <StructureCard key={child.objectId} s={child} indented {...sharedProps} />
            ))}

            {children.length === 0 && (
              <div style={{ marginLeft: 24, fontSize: 10, color: "rgba(107,107,94,0.4)", padding: "4px 0 8px" }}>
                No anchored structures on this node.
              </div>
            )}
          </div>
        );
      })}

      {/* UNANCHORED section — nodes with no children + orphaned structures */}
      {(() => {
        const orphanNodes = nodesSorted.filter(node => {
          const children = nodeChildren.get(node.objectId) ?? [];
          return !referencedNodeIds.has(node.objectId) && children.length === 0;
        });
        const allUnanchored = [...orphanNodes, ...unanchored];
        if (allUnanchored.length === 0) return null;

        return (
          <div style={{ marginBottom: 18 }}>
            <div style={{
              padding: "5px 14px",
              marginBottom: 8,
              background: "rgba(107,107,94,0.06)",
              border: "1px solid rgba(107,107,94,0.15)",
              borderRadius: 3,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(107,107,94,0.7)", letterSpacing: "0.12em" }}>
                ◈ UNANCHORED
              </div>
              <div style={{ fontSize: 9, color: "rgba(107,107,94,0.4)", marginTop: 1 }}>
                Structures not connected to a Network Node
              </div>
            </div>
            {allUnanchored.map(s => (
              <StructureCard key={s.objectId} s={s} {...sharedProps} />
            ))}
          </div>
        );
      })()}

      {err && (
        <div style={{
          fontSize: 11, color: "#ff6432", padding: "6px 10px",
          background: "rgba(255,100,50,0.06)", border: "1px solid rgba(255,100,50,0.2)",
          borderRadius: 2, marginTop: 8,
        }}>
          ⚠ {err}
        </div>
      )}
    </div>
  );
}
