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
const KEEPER_URL = "https://keeper.reapers.shop";

interface ServiceDef {
  id: string;
  label: string;
  description: string;
  url: string;
  icon: string;
  secret?: boolean; // easter egg — no label shown to user
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
    description: "Treasury, CRDL balances, and tribe administration.",
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
    id: "keeper",
    label: "",            // intentionally blank — easter egg
    description: "",
    url: KEEPER_URL,
    icon: "🔒",
    secret: true,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function LinksPanel() {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const [characterId, setCharacterId] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null); // objectId of structure being linked
  const [err, setErr] = useState<string | null>(null);
  const [customUrls, setCustomUrls] = useState<Record<string, string>>({}); // structureId → pending custom url

  // Load structures
  const { data: groups, isLoading, refetch } = useQuery({
    queryKey: ["playerStructures", account?.address],
    queryFn: () => fetchPlayerStructures(account!.address),
    enabled: !!account,
    staleTime: 30_000,
  });

  // Load character
  useEffect(() => {
    if (!account) return;
    findCharacterForWallet(account.address).then(c => {
      if (c?.characterId) setCharacterId(c.characterId);
    });
  }, [account?.address]);

  const allStructures: PlayerStructure[] = (groups ?? []).flatMap(g => g.structures);
  // Show all structure types that support metadata.url
  const linkable = allStructures;

  const handleLink = async (structure: PlayerStructure, url: string) => {
    if (!characterId) return;
    setBusy(structure.objectId); setErr(null);
    try {
      const tx = buildSetUrlTransaction(structure, characterId, url);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
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

      {!isLoading && linkable.length === 0 && (
        <div style={{ color: "rgba(107,107,94,0.6)", fontSize: 12 }}>
          No structures found. Deploy a Network Node or other structure in-game first.
        </div>
      )}

      {/* Structure list */}
      {linkable.map(s => {
        const currentUrl = s.metadataUrl ?? "";
        const matchedService = SERVICES.find(svc => currentUrl.startsWith(svc.url));
        const isBusy = busy === s.objectId;

        return (
          <div key={s.objectId} style={{
            marginBottom: 14,
            border: `1px solid ${currentUrl ? "rgba(0,255,150,0.2)" : "rgba(255,71,0,0.12)"}`,
            borderRadius: 3,
            background: "rgba(5,3,2,0.6)",
            overflow: "hidden",
          }}>
            {/* Structure header */}
            <div style={{
              padding: "8px 14px",
              display: "flex", alignItems: "center", gap: 10,
              background: currentUrl ? "rgba(0,255,150,0.04)" : "rgba(0,0,0,0.2)",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}>
              <span style={{ fontSize: 15 }}>
                {s.kind === "NetworkNode" ? "⬡" : s.kind === "Gate" ? "⛩" : s.kind === "Turret" ? "🔫" : "⊞"}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#e0e0d0" }}>{s.displayName}</div>
                <div style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(107,107,94,0.5)" }}>
                  {s.kind} · #{s.gameItemId ?? s.objectId.slice(0, 8)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 9, padding: "1px 6px", borderRadius: 2,
                  background: s.isOnline ? "rgba(0,255,150,0.1)" : "rgba(255,68,68,0.1)",
                  color: s.isOnline ? "#00ff96" : "#ff6666", border: `1px solid ${s.isOnline ? "rgba(0,255,150,0.2)" : "rgba(255,68,68,0.2)"}`,
                }}>
                  {s.isOnline ? "ONLINE" : "OFFLINE"}
                </span>
                {currentUrl && (
                  <span style={{ fontSize: 10, color: "#00ff96" }}>
                    {matchedService?.secret ? "⚓" : matchedService?.icon ?? "🔗"}
                    {!matchedService?.secret && <span style={{ marginLeft: 4 }}>{matchedService?.label ?? "Linked"}</span>}
                  </span>
                )}
              </div>
            </div>

            {/* Service picker */}
            <div style={{ padding: "10px 14px" }}>
              {currentUrl ? (
                // Currently linked
                <div>
                  <div style={{ fontSize: 11, color: "rgba(180,160,140,0.6)", marginBottom: 8, fontFamily: "monospace" }}>
                    {matchedService?.secret ? "███████████████" : currentUrl.slice(0, 60) + (currentUrl.length > 60 ? "…" : "")}
                  </div>
                  <button
                    onClick={() => handleDetach(s)}
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
                // Unlinked — show service grid
                <div>
                  <div style={{ fontSize: 10, color: "rgba(107,107,94,0.5)", marginBottom: 8, letterSpacing: "0.08em" }}>
                    ATTACH SERVICE
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {SERVICES.filter(svc => !svc.secret).map(svc => (
                      <button
                        key={svc.id}
                        onClick={() => handleLink(s, svc.url)}
                        disabled={isBusy}
                        title={svc.description}
                        style={{
                          padding: "5px 10px", fontSize: 11, cursor: "pointer", borderRadius: 2,
                          background: "rgba(255,71,0,0.06)", border: "1px solid rgba(255,71,0,0.2)",
                          color: "#FF4700", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5,
                          opacity: isBusy ? 0.4 : 1,
                        }}
                      >
                        <span>{svc.icon}</span>
                        <span>{svc.label}</span>
                      </button>
                    ))}

                    {/* Easter egg — unlabeled lock icon */}
                    <button
                      onClick={() => handleLink(s, KEEPER_URL)}
                      disabled={isBusy}
                      title=""
                      style={{
                        padding: "5px 10px", fontSize: 14, cursor: "pointer", borderRadius: 2,
                        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                        color: "rgba(107,107,94,0.4)", fontFamily: "inherit",
                        opacity: isBusy ? 0.4 : 1,
                      }}
                    >
                      🔒
                    </button>
                  </div>

                  {/* Custom URL input */}
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      value={customUrls[s.objectId] ?? ""}
                      onChange={e => setCustomUrls(p => ({ ...p, [s.objectId]: e.target.value }))}
                      placeholder="or enter custom URL…"
                      style={{
                        flex: 1, padding: "4px 8px", fontSize: 11, fontFamily: "monospace",
                        background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)",
                        color: "#c8c8b8", borderRadius: 2,
                      }}
                    />
                    <button
                      onClick={() => {
                        const u = customUrls[s.objectId]?.trim();
                        if (u) handleLink(s, u);
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
                </div>
              )}
              {isBusy && <div style={{ fontSize: 10, color: "rgba(255,200,0,0.7)", marginTop: 6 }}>Signing transaction…</div>}
            </div>
          </div>
        );
      })}

      {err && (
        <div style={{ fontSize: 11, color: "#ff6432", padding: "6px 10px", background: "rgba(255,100,50,0.06)", border: "1px solid rgba(255,100,50,0.2)", borderRadius: 2, marginTop: 8 }}>
          ⚠ {err}
        </div>
      )}
    </div>
  );
}
