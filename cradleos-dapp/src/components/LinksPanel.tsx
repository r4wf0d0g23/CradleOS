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
import { translateTxError } from "../lib/txError";
import {
  fetchPlayerStructures,
  buildSetUrlTransaction,
  findCharacterForWallet,
  type PlayerStructure,
} from "../lib";
import { PortalSelect } from "./PortalSelect";

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

// Service catalog — mirrors the Tab list in App.tsx (sans dev-only `flappy`).
// Hash slugs map 1:1 to ROUTE_MAP in App.tsx. When you add a new tab there,
// add it here too so the kiosk picker stays in sync.
//
// Order: most-likely-useful-as-public-kiosk first.
const SERVICES: ServiceDef[] = [
  // ── Top-level overviews ──
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Structure topology — your nodes, attached structures, and energy grid.",
    url: `${BASE}/#/dashboard`,
    icon: "◉",
  },
  {
    id: "intel",
    label: "Intel",
    description: "Live kill feed, security heatmap, and infrastructure overview.",
    url: `${BASE}/#/intel`,
    icon: "◎",
  },
  {
    id: "war",
    label: "War Board",
    description: "Lineage War scoreboard, tick countdown, and contested systems.",
    url: `${BASE}/#/war`,
    icon: "⚔",
  },
  {
    id: "map",
    label: "Star Map",
    description: "System topology, gate links, and constellation navigation.",
    url: `${BASE}/#/map`,
    icon: "✦",
  },

  // ── Tribe operations ──
  {
    id: "tribe",
    label: "Tribe Vault",
    description: "Treasury, EVE balances, and tribe administration.",
    url: `${BASE}/#/tribe`,
    icon: "▣",
  },
  {
    id: "hierarchy",
    label: "Hierarchy",
    description: "Tribe org chart, roles, and member directory.",
    url: `${BASE}/#/hierarchy`,
    icon: "≡",
  },
  {
    id: "assets",
    label: "Asset Ledger",
    description: "Tribe infra, token supply, treasury, and DEX.",
    url: `${BASE}/#/assets`,
    icon: "▤",
  },
  {
    id: "announcements",
    label: "Announcements",
    description: "Tribe broadcast board — pinned posts and feed.",
    url: `${BASE}/#/announcements`,
    icon: "◆",
  },
  {
    id: "recruiting",
    label: "Recruiting",
    description: "Open recruiting terminal — applications and intake.",
    url: `${BASE}/#/recruiting`,
    icon: "✎",
  },
  {
    id: "calendar",
    label: "Calendar",
    description: "Fleet ops schedule, timers, and event planner.",
    url: `${BASE}/#/calendar`,
    icon: "▦",
  },

  // ── Structure & inventory management ──
  {
    id: "structures",
    label: "Structures",
    description: "Manage all your deployed structures — online/offline, rename, policy.",
    url: `${BASE}/#/structures`,
    icon: "⬢",
  },
  {
    id: "inventory",
    label: "SSU Storage",
    description: "Browse items across your storage units.",
    url: `${BASE}/#/storage`,
    icon: "▥",
  },

  // ── Policy & access ──
  {
    id: "defense",
    label: "Defense Policy",
    description: "Turret targeting policy — standings, ROE, and KOS list.",
    url: `${BASE}/#/defense`,
    icon: "⛨",
  },
  {
    id: "gates",
    label: "Gate Policy",
    description: "Tribe gate access profiles — tolls and whitelists.",
    url: `${BASE}/#/gates`,
    icon: "⊞",
  },
  {
    id: "registry",
    label: "Tribe Registry",
    description: "Tribe ownership claims, challenges, and attestor verification.",
    url: `${BASE}/#/registry`,
    icon: "◇",
  },
  {
    id: "succession",
    label: "Succession",
    description: "Will & testament — time-locked deeds for tribe leadership succession.",
    url: `${BASE}/#/succession`,
    icon: "⚗",
  },

  // ── Economy & contracts ──
  {
    id: "bounties",
    label: "Bounties",
    description: "Active bounty board — post and claim targets.",
    url: `${BASE}/#/bounties`,
    icon: "◯",
  },
  {
    id: "srp",
    label: "Insurance / SRP",
    description: "Ship replacement program submissions and payouts.",
    url: `${BASE}/#/srp`,
    icon: "⊕",
  },
  {
    id: "cargo",
    label: "Cargo Contracts",
    description: "Trustless hauling contracts with EVE escrow.",
    url: `${BASE}/#/cargo`,
    icon: "▭",
  },
  {
    id: "industry",
    label: "Industry",
    description: "Manufacturing queues, blueprints, and production chains.",
    url: `${BASE}/#/industry`,
    icon: "⚙",
  },

  // ── Knowledge & tools ──
  {
    id: "fitting",
    label: "Ship Fitting",
    description: "Ship stats, fitting calculator, and comparison tool.",
    url: `${BASE}/#/fitting`,
    icon: "▲",
  },
  {
    id: "wiki",
    label: "Knowledge Base",
    description: "EVE Frontier game mechanics, structures, and ship guides.",
    url: `${BASE}/#/wiki`,
    icon: "≣",
  },
  {
    id: "query",
    label: "Chain Query",
    description: "Search characters and tribes by name, ticker, or wallet.",
    url: `${BASE}/#/query`,
    icon: "?",
  },

  // ── Keeper (easter egg — unlabeled in dropdown via `secret: true`) ──
  {
    id: "keeper",
    label: "",            // intentionally blank — easter egg
    description: "",
    url: KEEPER_URL,
    icon: "❖",
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

  // selectStyle removed 2026-05-01 — native <select> replaced with
  // PortalSelect; styles now live inline at the call site below.


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
          <div style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(175,175,155,0.5)" }}>
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
              background: "rgba(255,255,255,0.04)", color: "rgba(175,175,155,0.6)",
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

      {/* Service picker — only available on kinds that have a kiosk
          display surface in-game (NetworkNode, Turret, StorageUnit).
          Assembly and Gate don't render the metadata.url as a kiosk
          screen, so attaching a service there would never display.
          Gate has its own link semantics (gate-to-gate jump pairs);
          Assembly has no kiosk surface at all. */}
      {(s.kind === "NetworkNode" || s.kind === "Turret" || s.kind === "StorageUnit") ? (
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
            <div style={{ fontSize: 10, color: "rgba(175,175,155,0.5)", marginBottom: 8, letterSpacing: "0.08em" }}>
              ATTACH SERVICE
            </div>

            {/* Dropdown row — PortalSelect (NOT native <select>) so the
                option list renders correctly inside the EVE Vault Mobile
                / Stillness embedded webview. See TOOLS.md "CradleOS
                Webview Dialog + Native Overlay Ban". */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <PortalSelect
                  value={pendingSvcId}
                  onChange={(v) => onServiceSelect(s.objectId, v)}
                  disabled={isBusy}
                  placeholder="Select a service…"
                  options={[
                    { value: "", label: "Select a service…" },
                    ...DROPDOWN_SERVICES.map(svc => ({
                      value: svc.id,
                      label: `${svc.icon} ${svc.label}`,
                    })),
                  ]}
                  buttonStyle={{
                    width: "100%",
                    padding: "5px 8px",
                    fontSize: 11,
                    background: "#1a1a1a",
                    color: "#e0e0d0",
                    border: "1px solid rgba(255,71,0,0.25)",
                    borderRadius: 2,
                    fontFamily: "inherit",
                    minWidth: 0,
                    fontWeight: 400,
                    letterSpacing: "normal",
                  }}
                  panelStyle={{
                    fontSize: 11,
                    letterSpacing: "normal",
                  }}
                  optionStyle={{
                    padding: "6px 10px",
                  }}
                />
              </div>

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
                    color: "rgba(175,175,155,0.3)", fontFamily: "inherit",
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
      ) : (
        // Kind has no kiosk display surface — explain instead of
        // showing a non-functional service picker.
        <div style={{
          padding: "10px 14px",
          fontSize: 10,
          color: "rgba(175,175,155,0.45)",
          fontStyle: "italic",
          letterSpacing: "0.04em",
        }}>
          {s.kind === "Gate"
            ? "Gates link to other gates (jump pairs) — not to kiosk services. Use the dashboard or starmap to manage gate links."
            : s.kind === "Assembly"
              ? "Assembly structures have no kiosk display surface in-game. CradleOS services can only be attached to Network Nodes, Turrets, and Storage Units."
              : `${s.kind} structures cannot host kiosk services.`}
        </div>
      )}
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
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set(["__ALL_COLLAPSED_INIT__"])); // sentinel — see useEffect below
  const [initialized, setInitialized] = useState(false);

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
      setErr(translateTxError(e));
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

  // Default all nodes collapsed on first load
  useEffect(() => {
    if (!initialized && nodesSorted.length > 0) {
      setCollapsedNodes(new Set(nodesSorted.map(n => n.objectId)));
      setInitialized(true);
    }
  }, [nodesSorted, initialized]);

  const collapseAll = () => setCollapsedNodes(new Set(nodesSorted.map(n => n.objectId)));
  const expandAll = () => setCollapsedNodes(new Set());

  return (
    <div style={{ fontFamily: "inherit", padding: "0 4px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#FF4700", letterSpacing: "0.1em" }}>
            🔗 STRUCTURE LINKS
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={expandAll} style={{
              background: "none", border: "1px solid rgba(255,71,0,0.2)", borderRadius: 2,
              color: "rgba(255,71,0,0.5)", fontSize: 10, padding: "2px 8px", cursor: "pointer",
              fontFamily: "inherit", letterSpacing: "0.06em",
            }}>Expand All</button>
            <button onClick={collapseAll} style={{
              background: "none", border: "1px solid rgba(255,71,0,0.2)", borderRadius: 2,
              color: "rgba(255,71,0,0.5)", fontSize: 10, padding: "2px 8px", cursor: "pointer",
              fontFamily: "inherit", letterSpacing: "0.06em",
            }}>Collapse All</button>
          </div>
        </div>
        <p style={{ fontSize: 11, color: "rgba(180,160,140,0.6)", margin: 0, lineHeight: 1.6 }}>
          Attach CradleOS services to your deployed structures. Links are stored on-chain in the structure's metadata —
          visible to anyone who queries the structure.
        </p>
      </div>

      {isLoading && <div style={{ color: "rgba(175,175,155,0.6)", fontSize: 12 }}>Loading structures…</div>}

      {!isLoading && allStructures.length === 0 && (
        <div style={{ color: "rgba(175,175,155,0.6)", fontSize: 12 }}>
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
            {/* Node header card — clickable to collapse */}
            <div
              onClick={() => setCollapsedNodes(prev => {
                const next = new Set(prev);
                if (next.has(node.objectId)) next.delete(node.objectId);
                else next.add(node.objectId);
                return next;
              })}
              style={{
                padding: "7px 14px",
                marginBottom: 8,
                background: "rgba(0,232,255,0.04)",
                border: "1px solid rgba(0,232,255,0.2)",
                borderRadius: 3,
                display: "flex", alignItems: "center", gap: 10,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <span style={{ fontSize: 18, color: "#00e8ff", width: 20, flexShrink: 0, fontFamily: "monospace", fontWeight: 700, lineHeight: 1 }}>
                {collapsedNodes.has(node.objectId) ? "▶" : "▼"}
              </span>
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
              {collapsedNodes.has(node.objectId) && children.length > 0 && (
                <span style={{ fontSize: 9, color: "rgba(0,232,255,0.35)", fontFamily: "monospace", marginRight: 6 }}>
                  ({children.length + 1} structures)
                </span>
              )}
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

            {/* Node + children — collapsible */}
            {!collapsedNodes.has(node.objectId) && (
              <>
                {/* Node itself as a linkable structure */}
                <StructureCard s={node} indented {...sharedProps} />

                {/* Child structures */}
                {children.map(child => (
                  <StructureCard key={child.objectId} s={child} indented {...sharedProps} />
                ))}

                {children.length === 0 && (
                  <div style={{ marginLeft: 24, fontSize: 10, color: "rgba(175,175,155,0.4)", padding: "4px 0 8px" }}>
                    No anchored structures on this node.
                  </div>
                )}
              </>
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
              background: "rgba(175,175,155,0.06)",
              border: "1px solid rgba(175,175,155,0.15)",
              borderRadius: 3,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(175,175,155,0.7)", letterSpacing: "0.12em" }}>
                ◈ UNANCHORED
              </div>
              <div style={{ fontSize: 9, color: "rgba(175,175,155,0.4)", marginTop: 1 }}>
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
