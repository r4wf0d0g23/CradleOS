import { normalizeChainError } from "../utils";
/**
 * AnnouncementPanel — Tribe announcement board.
 *
 * Founder:
 *   • Create the AnnouncementBoard for the vault
 *   • Post new announcements (title, body, pin toggle)
 *   • Edit, delete, and pin/unpin existing posts
 *
 * Members:
 *   • Read-only view of all announcements
 *   • Pinned posts highlighted at top with orange border
 *
 * Board discovery: localStorage cache key `cradleos:board:{vaultId}`,
 * fallback to BoardCreated event query.
 */
import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { Transaction } from "@mysten/sui/transactions";
import {
  CRADLEOS_PKG, SUI_TESTNET_RPC, CLOCK, eventType,
} from "../constants";
import {
  rpcGetObject, numish,
  fetchCharacterTribeId, fetchTribeVault, getCachedVaultId,
  type TribeVaultState,
} from "../lib";

// ── Types ──────────────────────────────────────────────────────────────────────

type BoardState = {
  objectId: string;
  vaultId: string;
  postCount: number;
};

type AnnouncementData = {
  postId: number;
  title: string;
  body: string;
  author: string;
  pinned: boolean;
  createdMs: number;
  editedMs: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(a: string | undefined | null) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function formatDate(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Get cached board ID from localStorage. */
function getCachedBoardId(vaultId: string): string | null {
  try { return localStorage.getItem(`cradleos:board:${vaultId}`); } catch { return null; }
}

/** Cache board ID in localStorage. */
function setCachedBoardId(vaultId: string, boardId: string): void {
  try { localStorage.setItem(`cradleos:board:${vaultId}`, boardId); } catch { /* */ }
}

/** Fetch board ID for vault — localStorage first, then BoardCreated event fallback. */
async function fetchBoardIdForVault(vaultId: string): Promise<string | null> {
  const cached = getCachedBoardId(vaultId);
  if (cached) return cached;

  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: eventType("announcement_board", "BoardCreated") }, null, 50, true],
      }),
    });
    const j = await res.json() as { result?: { data?: Array<{ parsedJson: Record<string, unknown> }> } };
    const match = (j.result?.data ?? []).find(e => String(e.parsedJson["vault_id"]) === vaultId);
    if (match) {
      const id = String(match.parsedJson["board_id"]);
      setCachedBoardId(vaultId, id);
      return id;
    }
    return null;
  } catch { return null; }
}

/** Fetch AnnouncementBoard object state. */
async function fetchBoardState(boardId: string): Promise<BoardState | null> {
  try {
    const fields = await rpcGetObject(boardId);
    return {
      objectId: boardId,
      vaultId: String(fields["vault_id"] ?? ""),
      postCount: numish(fields["post_count"]) ?? 0,
    };
  } catch { return null; }
}

/** Fetch all AnnouncementPosted events for a vault, return unique post IDs. */
async function fetchPostedEvents(vaultId: string): Promise<Array<{ postId: number; boardId: string }>> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: eventType("announcement_board", "AnnouncementPosted") }, null, 200, true],
      }),
    });
    const j = await res.json() as { result?: { data?: Array<{ parsedJson: Record<string, unknown> }> } };
    return (j.result?.data ?? [])
      .filter(e => String(e.parsedJson["vault_id"]) === vaultId)
      .map(e => ({
        postId: numish(e.parsedJson["post_id"]) ?? 0,
        boardId: String(e.parsedJson["board_id"] ?? ""),
      }));
  } catch { return []; }
}

/** Fetch a single announcement dynamic field from the board. */
async function fetchAnnouncement(boardId: string, postId: number): Promise<AnnouncementData | null> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_getDynamicFieldObject",
        params: [boardId, { type: "u64", value: String(postId) }],
      }),
    });
    const j = await res.json() as { result?: { data?: { content?: { fields?: Record<string, unknown> } } } };
    const f = j.result?.data?.content?.fields;
    if (!f) return null;

    // Dynamic field wraps the value under "value" → unwrap
    const inner = (f["value"] as { fields?: Record<string, unknown> })?.fields ?? (f["value"] as Record<string, unknown>) ?? {};
    const titleRaw = inner["title"];
    const bodyRaw = inner["body"];
    return {
      postId,
      title: typeof titleRaw === "string" ? titleRaw
        : String((titleRaw as { fields?: { bytes?: unknown } })?.fields?.bytes ?? titleRaw ?? ""),
      body: typeof bodyRaw === "string" ? bodyRaw
        : String((bodyRaw as { fields?: { bytes?: unknown } })?.fields?.bytes ?? bodyRaw ?? ""),
      author: String(inner["author"] ?? ""),
      pinned: Boolean(inner["pinned"]),
      createdMs: numish(inner["created_ms"]) ?? 0,
      editedMs: numish(inner["edited_ms"]) ?? 0,
    };
  } catch { return null; }
}

/** Fetch all live announcements for a board (from events → dynamic fields). */
async function fetchAnnouncements(boardId: string, vaultId: string): Promise<AnnouncementData[]> {
  const posted = await fetchPostedEvents(vaultId);
  const unique = Array.from(new Set(posted.map(p => p.postId)));
  const results = await Promise.all(unique.map(id => fetchAnnouncement(boardId, id)));
  return results.filter((a): a is AnnouncementData => a !== null);
}

// ── Tx builders ───────────────────────────────────────────────────────────────

function buildCreateBoardTransaction(vaultId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::announcement_board::create_board_entry`,
    arguments: [tx.object(vaultId)],
  });
  return tx;
}

function buildPostAnnouncementTransaction(
  boardId: string,
  vaultId: string,
  title: string,
  body: string,
  pinned: boolean,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::announcement_board::post_announcement_entry`,
    arguments: [
      tx.object(boardId),
      tx.object(vaultId),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(title))),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(body))),
      tx.pure.bool(pinned),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

function buildEditAnnouncementTransaction(
  boardId: string,
  vaultId: string,
  postId: number,
  newTitle: string,
  newBody: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::announcement_board::edit_announcement_entry`,
    arguments: [
      tx.object(boardId),
      tx.object(vaultId),
      tx.pure.u64(BigInt(postId)),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(newTitle))),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(newBody))),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

function buildDeleteAnnouncementTransaction(
  boardId: string,
  vaultId: string,
  postId: number,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::announcement_board::delete_announcement_entry`,
    arguments: [
      tx.object(boardId),
      tx.object(vaultId),
      tx.pure.u64(BigInt(postId)),
    ],
  });
  return tx;
}

function buildPinAnnouncementTransaction(
  boardId: string,
  vaultId: string,
  postId: number,
  pinned: boolean,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::announcement_board::pin_announcement_entry`,
    arguments: [
      tx.object(boardId),
      tx.object(vaultId),
      tx.pure.u64(BigInt(postId)),
      tx.pure.bool(pinned),
    ],
  });
  return tx;
}

// ── Main exported panel ────────────────────────────────────────────────────────

export function AnnouncementPanel() {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;

  const { data: tribeId } = useQuery<number | null>({
    queryKey: ["characterTribeId", account?.address],
    queryFn: () => account ? fetchCharacterTribeId(account.address) : Promise.resolve(null),
    enabled: !!account?.address,
  });

  const { data: vault, isLoading: vaultLoading } = useQuery<TribeVaultState | null>({
    queryKey: ["tribeVault", tribeId, account?.address],
    queryFn: async () => {
      if (!tribeId || !account) return null;
      const vaultId = getCachedVaultId(tribeId);
      if (!vaultId) return null;
      return fetchTribeVault(vaultId);
    },
    enabled: !!tribeId && !!account,
    staleTime: 15_000,
  });

  if (!account) return (
    <div className="card" style={{ textAlign: "center", padding: "32px", color: "#888" }}>
      Connect your EVE Vault to view announcements
    </div>
  );
  if (vaultLoading || !vault) return (
    <div className="card" style={{ textAlign: "center", padding: "32px", color: "#888" }}>
      {vaultLoading ? "Loading vault…" : "No tribe vault found. Create one in the Tribe Token tab first."}
    </div>
  );
  return <AnnouncementPanelInner vault={vault} />;
}

// ── Inner panel (vault resolved) ──────────────────────────────────────────────

function AnnouncementPanelInner({ vault }: { vault: TribeVaultState }) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const isFounder = !!account && vault.founder.toLowerCase() === account.address.toLowerCase();

  // New post form state
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newPinned, setNewPinned] = useState(false);
  const [postBusy, setPostBusy] = useState(false);
  const [postErr, setPostErr] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  // Create board state
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  // Action busy states
  const [actionBusy, setActionBusy] = useState<Record<number, string>>({});

  // Board discovery
  const { data: boardId, refetch: refetchBoardId } = useQuery<string | null>({
    queryKey: ["boardId", vault.objectId],
    queryFn: () => fetchBoardIdForVault(vault.objectId),
    staleTime: 10_000,
  });

  const { data: board } = useQuery<BoardState | null>({
    queryKey: ["boardState", boardId],
    queryFn: () => boardId ? fetchBoardState(boardId) : Promise.resolve(null),
    enabled: !!boardId,
    staleTime: 15_000,
  });

  const { data: announcements } = useQuery<AnnouncementData[]>({
    queryKey: ["announcements", boardId, vault.objectId],
    queryFn: () => boardId ? fetchAnnouncements(boardId, vault.objectId) : Promise.resolve([]),
    enabled: !!boardId,
    staleTime: 30_000,
  });

  const invalidate = useCallback(() => {
    const keys = [
      ["boardId", vault.objectId],
      ["boardState", boardId],
      ["announcements", boardId, vault.objectId],
    ];
    [2500, 6000, 12000].forEach(delay => {
      setTimeout(() => keys.forEach(k => queryClient.invalidateQueries({ queryKey: k })), delay);
    });
  }, [boardId, vault.objectId, queryClient]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!account) return;
    setCreateBusy(true); setCreateErr(null);
    try {
      const tx = buildCreateBoardTransaction(vault.objectId);
      const signer = new CurrentAccountSigner(dAppKit);
      const result = await signer.signAndExecuteTransaction({ transaction: tx });

      // Try to extract the created board ID from the transaction effects
      const digest = (result as Record<string, unknown>)["digest"] as string | undefined;
      if (digest) {
        try {
          const res = await fetch(SUI_TESTNET_RPC, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1,
              method: "sui_getTransactionBlock",
              params: [digest, { showEffects: true }],
            }),
          });
          const j = await res.json() as {
            result?: { effects?: { created?: Array<{ owner: unknown; reference: { objectId: string } }> } }
          };
          const created = (j.result?.effects?.created ?? [])
            .filter(c => c.owner && typeof c.owner === "object" && "Shared" in (c.owner as object))
            .map(c => c.reference.objectId);
          if (created[0]) setCachedBoardId(vault.objectId, created[0]);
        } catch { /* fall through to event discovery */ }
      }
      invalidate();
      refetchBoardId();
      [3000, 7000, 14000].forEach(d => setTimeout(() => refetchBoardId(), d));
    } catch (e) { setCreateErr(normalizeChainError(e)); }
    finally { setCreateBusy(false); }
  };

  const handlePost = async () => {
    if (!account || !boardId || !newTitle.trim()) return;
    setPostBusy(true); setPostErr(null);
    try {
      const tx = buildPostAnnouncementTransaction(boardId, vault.objectId, newTitle.trim(), newBody.trim(), newPinned);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setNewTitle(""); setNewBody(""); setNewPinned(false);
      invalidate();
    } catch (e) { setPostErr(normalizeChainError(e)); }
    finally { setPostBusy(false); }
  };

  const handleEditSubmit = async () => {
    if (!account || !boardId || editingId === null) return;
    setEditBusy(true); setEditErr(null);
    try {
      const tx = buildEditAnnouncementTransaction(boardId, vault.objectId, editingId, editTitle.trim(), editBody.trim());
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setEditingId(null);
      invalidate();
    } catch (e) { setEditErr(normalizeChainError(e)); }
    finally { setEditBusy(false); }
  };

  const handleDelete = async (postId: number) => {
    if (!account || !boardId) return;
    setActionBusy(prev => ({ ...prev, [postId]: "delete" }));
    try {
      const tx = buildDeleteAnnouncementTransaction(boardId, vault.objectId, postId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      invalidate();
    } catch { /* ignore */ }
    finally { setActionBusy(prev => { const n = { ...prev }; delete n[postId]; return n; }); }
  };

  const handlePin = async (postId: number, pinned: boolean) => {
    if (!account || !boardId) return;
    setActionBusy(prev => ({ ...prev, [postId]: "pin" }));
    try {
      const tx = buildPinAnnouncementTransaction(boardId, vault.objectId, postId, pinned);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      invalidate();
    } catch { /* ignore */ }
    finally { setActionBusy(prev => { const n = { ...prev }; delete n[postId]; return n; }); }
  };

  const startEdit = (a: AnnouncementData) => {
    setEditingId(a.postId);
    setEditTitle(a.title);
    setEditBody(a.body);
    setEditErr(null);
  };

  // ── No board yet ─────────────────────────────────────────────────────────────

  if (!boardId) {
    return (
      <div className="card">
        <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "16px", marginBottom: "16px", letterSpacing: "0.05em" }}>
          ANNOUNCEMENT BOARD
        </div>
        <p style={{ color: "rgba(107,107,94,0.6)", fontSize: "13px", marginBottom: "20px" }}>
          No announcement board exists for this vault. Create one to post updates for your tribe members.
        </p>
        {isFounder && (
          <>
            <button className="accent-button" onClick={handleCreate} disabled={createBusy}>
              {createBusy ? "Creating…" : "Create Announcement Board"}
            </button>
            {createErr && <div style={{ color: "#ff6432", fontSize: "12px", marginTop: "8px" }}>⚠ {createErr}</div>}
          </>
        )}
        <button
          onClick={() => {
            try { localStorage.removeItem(`cradleos:board:${vault.objectId}`); } catch { /* */ }
            refetchBoardId();
          }}
          style={{
            marginTop: "12px", background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)", color: "rgba(107,107,94,0.6)",
            borderRadius: "0", fontSize: "11px", padding: "4px 12px", cursor: "pointer",
            display: "block",
          }}
        >
          ↻ Refresh (check for existing board)
        </button>
      </div>
    );
  }

  // ── Sort: pinned first, then newest first ────────────────────────────────────

  const sorted = [...(announcements ?? [])].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.createdMs - a.createdMs;
  });

  const pinnedPosts = sorted.filter(a => a.pinned);
  const recentPosts = sorted.filter(a => !a.pinned);

  // ── Render announcement card ─────────────────────────────────────────────────

  const renderAnnouncement = (a: AnnouncementData) => {
    const isEditing = editingId === a.postId;
    const busy = actionBusy[a.postId];

    return (
      <div
        key={a.postId}
        style={{
          background: a.pinned ? "rgba(255,71,0,0.05)" : "rgba(255,255,255,0.02)",
          border: `1px solid ${a.pinned ? "rgba(255,71,0,0.4)" : "rgba(255,255,255,0.07)"}`,
          borderRadius: "2px",
          padding: "14px 16px",
          marginBottom: "10px",
        }}
      >
        {isEditing ? (
          /* Edit form */
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              style={inputStyle}
              placeholder="Title"
            />
            <textarea
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              rows={5}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: "1.5" }}
              placeholder="Body"
            />
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                className="accent-button"
                onClick={handleEditSubmit}
                disabled={editBusy || !editTitle.trim()}
                style={{ fontSize: "12px", padding: "5px 16px" }}
              >
                {editBusy ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setEditingId(null)}
                style={ghostBtnStyle}
              >
                Cancel
              </button>
              {editErr && <span style={{ color: "#ff6432", fontSize: "11px" }}>⚠ {editErr}</span>}
            </div>
          </div>
        ) : (
          /* View mode */
          <>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "8px" }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  color: a.pinned ? "#FF4700" : "#ddd",
                  fontWeight: 700, fontSize: "14px", marginBottom: "2px",
                  display: "flex", alignItems: "center", gap: "8px",
                }}>
                  {a.pinned && (
                    <span style={{
                      fontSize: "10px", fontWeight: 700, color: "#FF4700",
                      border: "1px solid rgba(255,71,0,0.5)", padding: "1px 6px",
                      letterSpacing: "0.08em",
                    }}>PINNED</span>
                  )}
                  {a.title}
                </div>
                <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "11px" }}>
                  {shortAddr(a.author)} · {formatDate(a.createdMs)}
                  {a.editedMs > a.createdMs && (
                    <span style={{ marginLeft: "6px", opacity: 0.7 }}>(edited {formatDate(a.editedMs)})</span>
                  )}
                </div>
              </div>

              {isFounder && (
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <button
                    onClick={() => handlePin(a.postId, !a.pinned)}
                    disabled={!!busy}
                    style={{
                      ...ghostBtnStyle,
                      color: a.pinned ? "#FF4700" : "#666",
                      borderColor: a.pinned ? "rgba(255,71,0,0.3)" : "rgba(255,255,255,0.1)",
                    }}
                  >
                    {busy === "pin" ? "…" : a.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button onClick={() => startEdit(a)} style={ghostBtnStyle}>Edit</button>
                  <button
                    onClick={() => handleDelete(a.postId)}
                    disabled={!!busy}
                    style={{ ...ghostBtnStyle, color: "#ff6432", borderColor: "rgba(255,100,50,0.25)" }}
                  >
                    {busy === "delete" ? "…" : "Delete"}
                  </button>
                </div>
              )}
            </div>
            <div style={{
              color: "#bbb", fontSize: "13px", lineHeight: "1.6",
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {a.body}
            </div>
          </>
        )}
      </div>
    );
  };

  // ── Full render ──────────────────────────────────────────────────────────────

  return (
    <div className="card">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "18px", letterSpacing: "0.04em" }}>
          ANNOUNCEMENT BOARD
        </div>
        <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px" }}>
          {board?.postCount ?? 0} posts total
        </div>
      </div>

      {/* New announcement form (founder only) */}
      {isFounder && (
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,71,0,0.12)",
          borderRadius: "0", padding: "14px 16px", marginBottom: "24px",
        }}>
          <div style={{ color: "#FF4700", fontWeight: 600, fontSize: "13px", marginBottom: "12px" }}>
            New Announcement
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Title"
              style={inputStyle}
            />
            <textarea
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              rows={5}
              placeholder="Write your announcement…"
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: "1.5" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              {/* Pin toggle */}
              <button
                onClick={() => setNewPinned(p => !p)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "6px 12px", borderRadius: "0", cursor: "pointer",
                  background: newPinned ? "rgba(255,71,0,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${newPinned ? "rgba(255,71,0,0.4)" : "rgba(255,255,255,0.1)"}`,
                  color: newPinned ? "#FF4700" : "#666",
                  fontSize: "11px", fontWeight: 600,
                }}
              >
                <span>{newPinned ? "●" : "○"}</span> Pin this post
              </button>

              <button
                className="accent-button"
                onClick={handlePost}
                disabled={postBusy || !newTitle.trim()}
                style={{ fontSize: "12px", padding: "6px 20px" }}
              >
                {postBusy ? "Posting…" : "Post Announcement"}
              </button>
              {postErr && <div style={{ color: "#ff6432", fontSize: "11px" }}>⚠ {postErr}</div>}
            </div>
          </div>
        </div>
      )}

      {/* No announcements yet */}
      {sorted.length === 0 && (
        <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "13px", padding: "20px 0" }}>
          No announcements posted yet.
        </div>
      )}

      {/* Pinned section */}
      {pinnedPosts.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{
            color: "#FF4700", fontSize: "11px", fontWeight: 700,
            letterSpacing: "0.08em", marginBottom: "8px",
          }}>
            PINNED
          </div>
          {pinnedPosts.map(renderAnnouncement)}
        </div>
      )}

      {/* Recent section */}
      {recentPosts.length > 0 && (
        <div>
          {pinnedPosts.length > 0 && (
            <div style={{
              color: "rgba(107,107,94,0.55)", fontSize: "11px", fontWeight: 700,
              letterSpacing: "0.08em", marginBottom: "8px",
            }}>
              RECENT
            </div>
          )}
          {recentPosts.map(renderAnnouncement)}
        </div>
      )}
    </div>
  );
}

// ── Shared style constants ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "0",
  color: "#fff",
  fontSize: "13px",
  padding: "8px 10px",
  outline: "none",
  boxSizing: "border-box",
};

const ghostBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(107,107,94,0.7)",
  borderRadius: "0",
  fontSize: "11px",
  padding: "3px 10px",
  cursor: "pointer",
};
