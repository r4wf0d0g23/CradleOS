import { normalizeChainError } from "../utils";
/**
 * RecruitingPanel — Tribe recruitment board and application manager.
 *
 * Public board:
 *   • Shows all tribes with open RecruitingTerminals (via TerminalCreated events)
 *   • Card per tribe: token symbol, requirements, min infra, "Apply" button
 *
 * Apply form:
 *   • Character name, message, infra count
 *   • Submits apply_entry transaction
 *
 * Founder view (own tribe):
 *   • Toggle open/closed
 *   • Edit requirements + min infra
 *   • List pending applications with Accept/Reject buttons
 *   • Accepted/rejected counts
 *
 * Applicant view:
 *   • Own applications with status badges (PENDING/ACCEPTED/REJECTED)
 */
import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { Transaction } from "@mysten/sui/transactions";
import {
  CRADLEOS_PKG, SUI_TESTNET_RPC, CLOCK,
} from "../constants";
import {
  rpcGetObject, numish,
  fetchCharacterTribeId, fetchTribeVault, getCachedVaultId,
  type TribeVaultState,
} from "../lib";

// ── Types ─────────────────────────────────────────────────────────────────────

type TerminalState = {
  objectId: string;
  vaultId: string;
  open: boolean;
  requirements: string;
  minInfraCount: number;
  applicationCount: number;
};

type ApplicationRecord = {
  applicationId: number;
  applicant: string;
  characterName: string;
  message: string;
  infraCount: number;
  status: number; // 0=pending 1=accepted 2=rejected
  createdMs: number;
};

type BoardEntry = {
  terminalId: string;
  vaultId: string;
  coinSymbol: string;
  requirements: string;
  minInfraCount: number;
  open: boolean;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_PENDING  = 0;
const STATUS_ACCEPTED = 1;
const STATUS_REJECTED = 2;

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(a: string | undefined | null) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function StatusBadge({ status }: { status: number }) {
  const cfg =
    status === STATUS_ACCEPTED ? { label: "ACCEPTED", color: "#00ff96", bg: "rgba(0,255,150,0.1)", border: "rgba(0,255,150,0.3)" } :
    status === STATUS_REJECTED ? { label: "REJECTED", color: "#888",    bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)" } :
                                 { label: "PENDING",  color: "#ffaa00", bg: "rgba(255,170,0,0.1)", border: "rgba(255,170,0,0.3)" };
  return (
    <span style={{
      fontSize: "10px", fontWeight: 700, letterSpacing: "0.07em",
      padding: "2px 8px", borderRadius: "2px",
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
  );
}

// ── RPC helpers ───────────────────────────────────────────────────────────────

async function fetchTerminalState(terminalId: string): Promise<TerminalState | null> {
  try {
    const fields = await rpcGetObject(terminalId);
    if (fields["_deleted"]) return null;
    return {
      objectId: terminalId,
      vaultId: String(fields["vault_id"] ?? ""),
      open: Boolean(fields["open"]),
      requirements: String(fields["requirements"] ?? ""),
      minInfraCount: numish(fields["min_infra_count"]) ?? 0,
      applicationCount: numish(fields["application_count"]) ?? 0,
    };
  } catch { return null; }
}

async function fetchTerminalIdForVault(vaultId: string): Promise<string | null> {
  try {
    const cached = localStorage.getItem(`cradleos:terminal:${vaultId}`);
    if (cached) return cached;
  } catch { /* */ }
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: `${CRADLEOS_PKG}::recruiting_terminal::TerminalCreated` }, null, 100, true],
      }),
    });
    const j = await res.json() as { result?: { data?: Array<{ parsedJson: Record<string, unknown> }> } };
    const match = (j.result?.data ?? []).find(e => String(e.parsedJson["vault_id"]) === vaultId);
    if (match) {
      const id = String(match.parsedJson["terminal_id"]);
      try { localStorage.setItem(`cradleos:terminal:${vaultId}`, id); } catch { /* */ }
      return id;
    }
    return null;
  } catch { return null; }
}

/** Query all TerminalCreated events to build the public board. */
async function fetchBoardEntries(): Promise<BoardEntry[]> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: `${CRADLEOS_PKG}::recruiting_terminal::TerminalCreated` }, null, 100, true],
      }),
    });
    const j = await res.json() as { result?: { data?: Array<{ parsedJson: Record<string, unknown> }> } };
    const events = j.result?.data ?? [];

    // Deduplicate by vault_id (newest first)
    const seen = new Set<string>();
    const entries: BoardEntry[] = [];

    await Promise.all(events.map(async (ev) => {
      const vaultId = String(ev.parsedJson["vault_id"] ?? "");
      const terminalId = String(ev.parsedJson["terminal_id"] ?? "");
      if (seen.has(vaultId) || !vaultId || !terminalId) return;
      seen.add(vaultId);

      // Cache terminal id
      try { localStorage.setItem(`cradleos:terminal:${vaultId}`, terminalId); } catch { /* */ }

      // Fetch live terminal state
      const terminal = await fetchTerminalState(terminalId);
      if (!terminal || !terminal.open) return;

      // Fetch token symbol from vault
      let coinSymbol = "?";
      try {
        const vaultFields = await rpcGetObject(vaultId);
        coinSymbol = String(vaultFields["coin_symbol"] ?? "?");
      } catch { /* */ }

      entries.push({
        terminalId,
        vaultId,
        coinSymbol,
        requirements: terminal.requirements,
        minInfraCount: terminal.minInfraCount,
        open: terminal.open,
      });
    }));

    return entries;
  } catch { return []; }
}

/** Fetch all applications as dynamic fields on a terminal. */
async function fetchApplications(terminal: TerminalState): Promise<ApplicationRecord[]> {
  if (terminal.applicationCount === 0) return [];
  try {
    // Use suix_getDynamicFields to enumerate keys
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_getDynamicFields",
        params: [terminal.objectId, null, terminal.applicationCount],
      }),
    });
    const j = await res.json() as { result?: { data?: Array<{ name: { value: string | number }; objectId: string }> } };
    const fields = j.result?.data ?? [];

    const records = await Promise.all(fields.map(async (entry) => {
      try {
        const objRes = await fetch(SUI_TESTNET_RPC, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1,
            method: "sui_getObject",
            params: [entry.objectId, { showContent: true }],
          }),
        });
        const od = await objRes.json() as {
          result?: { data?: { content?: { fields?: Record<string, unknown> } } }
        };
        const f = od.result?.data?.content?.fields ?? {};
        // The value field of the dynamic field
        const val = (f["value"] as { fields?: Record<string, unknown> })?.fields ?? (f["value"] as Record<string, unknown>) ?? {};
        const applicationId = numish(entry.name.value) ?? 0;
        return {
          applicationId,
          applicant: String(val["applicant"] ?? ""),
          characterName: String(val["character_name"] ?? ""),
          message: String(val["message"] ?? ""),
          infraCount: numish(val["infra_count"]) ?? 0,
          status: numish(val["status"]) ?? STATUS_PENDING,
          createdMs: numish(val["created_ms"]) ?? 0,
        } satisfies ApplicationRecord;
      } catch { return null; }
    }));

    return records.filter((r): r is ApplicationRecord => r !== null);
  } catch { return []; }
}

/** Fetch own application events filtered by sender address. */
async function fetchOwnApplicationEvents(walletAddress: string): Promise<Array<{
  terminalId: string;
  vaultId: string;
  applicationId: number;
  characterName: string;
}>> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: `${CRADLEOS_PKG}::recruiting_terminal::ApplicationSubmitted` }, null, 200, true],
      }),
    });
    const j = await res.json() as { result?: { data?: Array<{ parsedJson: Record<string, unknown> }> } };
    return (j.result?.data ?? [])
      .filter(e => String(e.parsedJson["applicant"] ?? "").toLowerCase() === walletAddress.toLowerCase())
      .map(e => ({
        terminalId: String(e.parsedJson["terminal_id"] ?? ""),
        vaultId: String(e.parsedJson["vault_id"] ?? ""),
        applicationId: numish(e.parsedJson["application_id"]) ?? 0,
        characterName: String(e.parsedJson["character_name"] ?? ""),
      }));
  } catch { return []; }
}

// ── Tx builders ───────────────────────────────────────────────────────────────

function buildCreateTerminalTransaction(vaultId: string, requirements: string, minInfraCount: number): Transaction {
  const tx = new Transaction();
  // New standalone package: vault_id passed as address, no &TribeVault ref needed
  tx.moveCall({
    target: `${CRADLEOS_PKG}::recruiting_terminal::create_terminal_entry`,
    arguments: [
      tx.pure.address(vaultId),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(requirements))),
      tx.pure.u64(BigInt(minInfraCount)),
    ],
  });
  return tx;
}

function buildSetOpenTransaction(terminalId: string, _vaultId: string, open: boolean): Transaction {
  const tx = new Transaction();
  // New: no vault arg — founder verified from terminal state
  tx.moveCall({
    target: `${CRADLEOS_PKG}::recruiting_terminal::set_open_entry`,
    arguments: [tx.object(terminalId), tx.pure.bool(open)],
  });
  return tx;
}

function buildUpdateRequirementsTransaction(
  terminalId: string,
  _vaultId: string,
  requirements: string,
  minInfraCount: number,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::recruiting_terminal::update_requirements_entry`,
    arguments: [
      tx.object(terminalId),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(requirements))),
      tx.pure.u64(BigInt(minInfraCount)),
    ],
  });
  return tx;
}

function buildApplyTransaction(
  terminalId: string,
  characterName: string,
  message: string,
  infraCount: number,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::recruiting_terminal::apply_entry`,
    arguments: [
      tx.object(terminalId),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(characterName))),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(message))),
      tx.pure.u64(BigInt(infraCount)),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

function buildReviewApplicationTransaction(
  terminalId: string,
  _vaultId: string,
  applicationId: number,
  accept: boolean,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::recruiting_terminal::review_application_entry`,
    arguments: [
      tx.object(terminalId),
      tx.pure.u64(BigInt(applicationId)),
      tx.pure.bool(accept),
    ],
  });
  return tx;
}

// ── Apply form modal ──────────────────────────────────────────────────────────

function ApplyForm({
  entry,
  onClose,
}: {
  entry: BoardEntry;
  onClose: () => void;
}) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const [characterName, setCharacterName] = useState("");
  const [message, setMessage] = useState("");
  const [infraCount, setInfraCount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleApply = async () => {
    if (!account || !characterName.trim()) return;
    setBusy(true); setErr(null);
    try {
      const tx = buildApplyTransaction(
        entry.terminalId,
        characterName.trim(),
        message.trim(),
        parseInt(infraCount, 10) || 0,
      );
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setSuccess(true);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["ownApplicationEvents"] });
        onClose();
      }, 2000);
    } catch (e) { setErr(normalizeChainError(e)); }
    finally { setBusy(false); }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{
        background: "#0d0d0d", border: "1px solid rgba(255,71,0,0.3)",
        borderRadius: "2px", padding: "28px", minWidth: "360px", maxWidth: "480px", width: "90%",
      }}>
        <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "16px", marginBottom: "4px" }}>
          Apply to [{entry.coinSymbol}]
        </div>
        <div style={{ color: "rgba(107,107,94,0.7)", fontSize: "12px", marginBottom: "20px" }}>
          {entry.requirements || "No specific requirements listed."}
        </div>
        {entry.minInfraCount > 0 && (
          <div style={{ color: "#888", fontSize: "11px", marginBottom: "16px" }}>
            Min infrastructure: <span style={{ color: "#aaa" }}>{entry.minInfraCount}</span>
          </div>
        )}

        {success ? (
          <div style={{ color: "#00ff96", textAlign: "center", padding: "16px" }}>
            Application submitted
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <div style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px", letterSpacing: "0.06em", marginBottom: "4px" }}>
                  CHARACTER NAME *
                </div>
                <input
                  value={characterName}
                  onChange={e => setCharacterName(e.target.value)}
                  placeholder="Your character name"
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px", letterSpacing: "0.06em", marginBottom: "4px" }}>
                  MESSAGE
                </div>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Tell them about yourself..."
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical", minHeight: "80px" }}
                />
              </div>
              <div>
                <div style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px", letterSpacing: "0.06em", marginBottom: "4px" }}>
                  INFRASTRUCTURE COUNT (self-reported)
                </div>
                <input
                  value={infraCount}
                  onChange={e => setInfraCount(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  style={inputStyle}
                />
              </div>
            </div>

            {err && (
              <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "10px" }}>
                {err}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button
                onClick={handleApply}
                disabled={busy || !characterName.trim()}
                className="accent-button"
                style={{ flex: 1 }}
              >
                {busy ? "Submitting…" : "Submit Application"}
              </button>
              <button
                onClick={onClose}
                style={{
                  background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#666", borderRadius: "0", fontSize: "12px",
                  padding: "8px 16px", cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "0",
  color: "#fff",
  fontSize: "12px",
  padding: "7px 10px",
  outline: "none",
  boxSizing: "border-box",
};

// ── Public board card ─────────────────────────────────────────────────────────

function BoardCard({
  entry,
  ownVaultId,
}: {
  entry: BoardEntry;
  ownVaultId?: string;
}) {
  const [applying, setApplying] = useState(false);
  const isOwnTribe = ownVaultId && entry.vaultId === ownVaultId;

  return (
    <>
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,71,0,0.15)",
        borderRadius: "2px",
        padding: "16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          <span style={{
            fontFamily: "monospace", fontWeight: 700, fontSize: "14px",
            color: "#FF4700", minWidth: "60px",
          }}>
            [{entry.coinSymbol}]
          </span>
          <span style={{
            fontSize: "10px", padding: "2px 8px", borderRadius: "2px",
            color: "#00ff96", background: "rgba(0,255,150,0.08)",
            border: "1px solid rgba(0,255,150,0.2)", fontWeight: 600, letterSpacing: "0.06em",
          }}>
            RECRUITING
          </span>
          {isOwnTribe && (
            <span style={{
              fontSize: "10px", padding: "2px 8px", borderRadius: "2px",
              color: "#888", background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)", letterSpacing: "0.06em",
            }}>
              YOUR TRIBE
            </span>
          )}
        </div>

        <div style={{ color: "#aaa", fontSize: "12px", marginBottom: "8px", lineHeight: 1.5 }}>
          {entry.requirements || <span style={{ color: "#555", fontStyle: "italic" }}>No requirements specified.</span>}
        </div>

        {entry.minInfraCount > 0 && (
          <div style={{ color: "rgba(107,107,94,0.7)", fontSize: "11px", marginBottom: "12px" }}>
            Min infrastructure: <span style={{ color: "#888" }}>{entry.minInfraCount}</span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ color: "rgba(107,107,94,0.4)", fontSize: "10px", fontFamily: "monospace" }}>
            {shortAddr(entry.terminalId)}
          </span>
          {!isOwnTribe && (
            <button
              onClick={() => setApplying(true)}
              style={{
                marginLeft: "auto",
                background: "rgba(255,71,0,0.1)",
                border: "1px solid rgba(255,71,0,0.35)",
                color: "#FF4700", borderRadius: "0",
                fontSize: "12px", fontWeight: 600,
                padding: "6px 18px", cursor: "pointer",
              }}
            >
              Apply
            </button>
          )}
        </div>
      </div>
      {applying && (
        <ApplyForm entry={entry} onClose={() => setApplying(false)} />
      )}
    </>
  );
}

// ── Founder panel ─────────────────────────────────────────────────────────────

function FounderPanel({
  vault,
  terminalId,
  terminal,
  refetchTerminal,
}: {
  vault: TribeVaultState;
  terminalId: string;
  terminal: TerminalState;
  refetchTerminal: () => void;
}) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  const [editingReqs, setEditingReqs] = useState(false);
  const [reqsDraft, setReqsDraft] = useState(terminal.requirements);
  const [minInfraDraft, setMinInfraDraft] = useState(String(terminal.minInfraCount));
  const [reqsBusy, setReqsBusy] = useState(false);
  const [reqsErr, setReqsErr] = useState<string | null>(null);

  const [openBusy, setOpenBusy] = useState(false);
  const [openErr, setOpenErr] = useState<string | null>(null);

  const [reviewBusy, setReviewBusy] = useState<number | null>(null);
  const [reviewErr, setReviewErr] = useState<string | null>(null);

  const { data: applications } = useQuery<ApplicationRecord[]>({
    queryKey: ["terminalApplications", terminalId, terminal.applicationCount],
    queryFn: () => fetchApplications(terminal),
    staleTime: 20_000,
  });

  const invalidate = useCallback(() => {
    const delays = [2500, 6000, 12000];
    for (const d of delays) {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["terminalState"] });
        queryClient.invalidateQueries({ queryKey: ["terminalApplications"] });
        queryClient.invalidateQueries({ queryKey: ["recruitingBoard"] });
      }, d);
    }
  }, [queryClient]);

  const handleToggleOpen = async () => {
    if (!account) return;
    setOpenBusy(true); setOpenErr(null);
    try {
      const tx = buildSetOpenTransaction(terminalId, vault.objectId, !terminal.open);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      invalidate();
      setTimeout(refetchTerminal, 2500);
    } catch (e) { setOpenErr(normalizeChainError(e)); }
    finally { setOpenBusy(false); }
  };

  const handleSaveRequirements = async () => {
    if (!account) return;
    setReqsBusy(true); setReqsErr(null);
    try {
      const tx = buildUpdateRequirementsTransaction(
        terminalId, vault.objectId,
        reqsDraft, parseInt(minInfraDraft, 10) || 0,
      );
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setEditingReqs(false);
      invalidate();
      setTimeout(refetchTerminal, 2500);
    } catch (e) { setReqsErr(normalizeChainError(e)); }
    finally { setReqsBusy(false); }
  };

  const handleReview = async (applicationId: number, accept: boolean) => {
    if (!account) return;
    setReviewBusy(applicationId); setReviewErr(null);
    try {
      const tx = buildReviewApplicationTransaction(terminalId, vault.objectId, applicationId, accept);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      invalidate();
    } catch (e) { setReviewErr(normalizeChainError(e)); }
    finally { setReviewBusy(null); }
  };

  const pending  = (applications ?? []).filter(a => a.status === STATUS_PENDING);
  const accepted = (applications ?? []).filter(a => a.status === STATUS_ACCEPTED);
  const rejected = (applications ?? []).filter(a => a.status === STATUS_REJECTED);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* Status bar */}
      <div style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "2px", padding: "14px 16px",
        display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap",
      }}>
        <div style={{ color: "#aaa", fontWeight: 700, fontSize: "13px" }}>Terminal Status</div>

        <div style={{
          padding: "4px 14px", borderRadius: "2px", fontSize: "12px", fontWeight: 600,
          color: terminal.open ? "#00ff96" : "#666",
          background: terminal.open ? "rgba(0,255,150,0.08)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${terminal.open ? "rgba(0,255,150,0.25)" : "rgba(255,255,255,0.1)"}`,
        }}>
          {terminal.open ? "OPEN" : "CLOSED"}
        </div>

        <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px" }}>
          {terminal.applicationCount} total applications
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            onClick={handleToggleOpen}
            disabled={openBusy}
            style={{
              background: terminal.open ? "rgba(255,71,0,0.1)" : "rgba(0,255,150,0.08)",
              border: `1px solid ${terminal.open ? "rgba(255,71,0,0.35)" : "rgba(0,255,150,0.25)"}`,
              color: terminal.open ? "#FF4700" : "#00ff96",
              borderRadius: "0", fontSize: "12px", fontWeight: 600,
              padding: "6px 16px", cursor: "pointer",
            }}
          >
            {openBusy ? "…" : terminal.open ? "Close Terminal" : "Open Terminal"}
          </button>
        </div>
        {openErr && <div style={{ color: "#ff6432", fontSize: "11px", width: "100%" }}>⚠ {openErr}</div>}
      </div>

      {/* Requirements editor */}
      <div style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "2px", padding: "14px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
          <div style={{ color: "#aaa", fontWeight: 700, fontSize: "13px" }}>Requirements</div>
          {!editingReqs && (
            <button
              onClick={() => { setReqsDraft(terminal.requirements); setMinInfraDraft(String(terminal.minInfraCount)); setEditingReqs(true); }}
              style={{
                marginLeft: "auto", background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)", color: "#666",
                borderRadius: "0", fontSize: "11px", padding: "3px 10px", cursor: "pointer",
              }}
            >
              Edit
            </button>
          )}
        </div>

        {editingReqs ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <textarea
              value={reqsDraft}
              onChange={e => setReqsDraft(e.target.value)}
              rows={4}
              placeholder="Describe your requirements..."
              style={{ ...inputStyle, resize: "vertical", minHeight: "80px" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ color: "rgba(107,107,94,0.7)", fontSize: "10px", letterSpacing: "0.06em" }}>
                MIN INFRA COUNT
              </div>
              <input
                value={minInfraDraft}
                onChange={e => setMinInfraDraft(e.target.value.replace(/\D/g, ""))}
                style={{ ...inputStyle, width: "80px" }}
              />
              <button
                className="accent-button"
                onClick={handleSaveRequirements}
                disabled={reqsBusy}
                style={{ padding: "6px 16px", fontSize: "12px" }}
              >
                {reqsBusy ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setEditingReqs(false)}
                style={{
                  background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#666", borderRadius: "0", fontSize: "11px", padding: "5px 10px", cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
            {reqsErr && <div style={{ color: "#ff6432", fontSize: "11px" }}>⚠ {reqsErr}</div>}
          </div>
        ) : (
          <div>
            <div style={{ color: "#aaa", fontSize: "12px", lineHeight: 1.5, marginBottom: "8px" }}>
              {terminal.requirements || <span style={{ color: "#555", fontStyle: "italic" }}>No requirements set.</span>}
            </div>
            {terminal.minInfraCount > 0 && (
              <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "11px" }}>
                Min infrastructure: <span style={{ color: "#888" }}>{terminal.minInfraCount}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Application counts */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {[
          { label: "PENDING",  count: pending.length,  color: "#ffaa00", bg: "rgba(255,170,0,0.08)", border: "rgba(255,170,0,0.2)" },
          { label: "ACCEPTED", count: accepted.length, color: "#00ff96", bg: "rgba(0,255,150,0.08)", border: "rgba(0,255,150,0.2)" },
          { label: "REJECTED", count: rejected.length, color: "#555",    bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)" },
        ].map(({ label, count, color, bg, border }) => (
          <div key={label} style={{
            flex: 1, minWidth: "90px",
            background: bg, border: `1px solid ${border}`,
            borderRadius: "2px", padding: "10px 14px", textAlign: "center",
          }}>
            <div style={{ color, fontSize: "22px", fontWeight: 700, fontFamily: "monospace" }}>{count}</div>
            <div style={{ color, fontSize: "9px", letterSpacing: "0.08em", marginTop: "2px" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Pending applications */}
      <div style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "2px", padding: "14px 16px",
      }}>
        <div style={{ color: "#aaa", fontWeight: 700, fontSize: "13px", marginBottom: "12px" }}>
          Pending Applications
        </div>

        {pending.length === 0 ? (
          <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "12px" }}>No pending applications.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {pending.map(app => (
              <div key={app.applicationId} style={{
                background: "rgba(255,170,0,0.04)",
                border: "1px solid rgba(255,170,0,0.15)",
                borderRadius: "2px", padding: "12px 14px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
                  <span style={{ color: "#FF4700", fontWeight: 700, fontSize: "13px" }}>
                    {app.characterName}
                  </span>
                  <span style={{ color: "rgba(107,107,94,0.5)", fontSize: "10px", fontFamily: "monospace" }}>
                    {shortAddr(app.applicant)}
                  </span>
                  <span style={{ color: "rgba(107,107,94,0.5)", fontSize: "10px" }}>
                    infra: {app.infraCount}
                  </span>
                  <span style={{ color: "rgba(107,107,94,0.4)", fontSize: "10px", marginLeft: "auto" }}>
                    #{app.applicationId}
                  </span>
                </div>
                {app.message && (
                  <div style={{ color: "#888", fontSize: "12px", lineHeight: 1.4, marginBottom: "10px" }}>
                    {app.message}
                  </div>
                )}
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    onClick={() => handleReview(app.applicationId, true)}
                    disabled={reviewBusy === app.applicationId}
                    style={{
                      background: "rgba(0,255,150,0.1)", border: "1px solid rgba(0,255,150,0.3)",
                      color: "#00ff96", borderRadius: "0", fontSize: "11px", fontWeight: 600,
                      padding: "4px 14px", cursor: "pointer",
                    }}
                  >
                    {reviewBusy === app.applicationId ? "…" : "Accept"}
                  </button>
                  <button
                    onClick={() => handleReview(app.applicationId, false)}
                    disabled={reviewBusy === app.applicationId}
                    style={{
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
                      color: "#888", borderRadius: "0", fontSize: "11px", fontWeight: 600,
                      padding: "4px 14px", cursor: "pointer",
                    }}
                  >
                    Reject
                  </button>
                  {reviewBusy === app.applicationId && (
                    <span style={{ color: "#666", fontSize: "11px" }}>Submitting…</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {reviewErr && (
          <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "8px" }}>⚠ {reviewErr}</div>
        )}
      </div>

      {/* Accepted / Rejected history (collapsed) */}
      {(accepted.length > 0 || rejected.length > 0) && (
        <div style={{
          background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "2px", padding: "12px 14px",
        }}>
          <div style={{ color: "rgba(107,107,94,0.6)", fontWeight: 700, fontSize: "11px", letterSpacing: "0.06em", marginBottom: "10px" }}>
            REVIEWED APPLICATIONS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {[...accepted, ...rejected].sort((a, b) => b.applicationId - a.applicationId).map(app => (
              <div key={app.applicationId} style={{
                display: "flex", alignItems: "center", gap: "10px",
                fontSize: "11px", color: "#666",
                padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                <span style={{ minWidth: "24px", color: "rgba(107,107,94,0.4)", fontFamily: "monospace" }}>#{app.applicationId}</span>
                <span style={{ color: "#888", flex: 1 }}>{app.characterName}</span>
                <span style={{ fontFamily: "monospace", color: "rgba(107,107,94,0.4)" }}>{shortAddr(app.applicant)}</span>
                <StatusBadge status={app.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Applicant own-applications view ──────────────────────────────────────────

function OwnApplicationsView({ walletAddress }: { walletAddress: string }) {
  const { data: ownEvents } = useQuery({
    queryKey: ["ownApplicationEvents", walletAddress],
    queryFn: () => fetchOwnApplicationEvents(walletAddress),
    staleTime: 30_000,
  });

  // For each event, we need to fetch the live status from the terminal's dynamic field
  const { data: liveStatuses } = useQuery({
    queryKey: ["ownApplicationStatuses", ownEvents?.map(e => `${e.terminalId}:${e.applicationId}`).join(",")],
    queryFn: async () => {
      if (!ownEvents?.length) return {};
      const statuses: Record<string, number> = {};
      await Promise.all(ownEvents.map(async (ev) => {
        try {
          const dfRes = await fetch(SUI_TESTNET_RPC, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1,
              method: "suix_getDynamicFieldObject",
              params: [ev.terminalId, { type: "u64", value: String(ev.applicationId) }],
            }),
          });
          const j = await dfRes.json() as {
            result?: { data?: { content?: { fields?: Record<string, unknown> } } }
          };
          const f = j.result?.data?.content?.fields ?? {};
          const val = (f["value"] as { fields?: Record<string, unknown> })?.fields ?? (f["value"] as Record<string, unknown>) ?? {};
          statuses[`${ev.terminalId}:${ev.applicationId}`] = numish(val["status"]) ?? STATUS_PENDING;
        } catch { /* leave as pending */ }
      }));
      return statuses;
    },
    enabled: !!ownEvents?.length,
    staleTime: 20_000,
  });

  if (!ownEvents?.length) {
    return (
      <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "12px", padding: "8px 0" }}>
        You have not submitted any applications.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {ownEvents.map(ev => {
        const key = `${ev.terminalId}:${ev.applicationId}`;
        const status = liveStatuses?.[key] ?? STATUS_PENDING;
        return (
          <div key={key} style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "2px", padding: "12px 14px",
            display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#aaa", fontWeight: 600, fontSize: "12px", marginBottom: "2px" }}>
                {ev.characterName}
              </div>
              <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "10px", fontFamily: "monospace" }}>
                terminal {shortAddr(ev.terminalId)} · #{ev.applicationId}
              </div>
            </div>
            <StatusBadge status={status} />
          </div>
        );
      })}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function RecruitingPanel() {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  // Discover own vault
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

  const isFounder = !!account && !!vault &&
    vault.founder.toLowerCase() === account.address.toLowerCase();

  // Discover terminal for own vault
  const { data: terminalId, refetch: refetchTerminalId } = useQuery<string | null>({
    queryKey: ["terminalId", vault?.objectId],
    queryFn: () => vault ? fetchTerminalIdForVault(vault.objectId) : Promise.resolve(null),
    enabled: !!vault?.objectId,
    staleTime: 15_000,
  });

  const { data: terminal, refetch: refetchTerminal } = useQuery<TerminalState | null>({
    queryKey: ["terminalState", terminalId],
    queryFn: () => terminalId ? fetchTerminalState(terminalId) : Promise.resolve(null),
    enabled: !!terminalId,
    staleTime: 15_000,
  });

  // Public board
  const { data: boardEntries } = useQuery<BoardEntry[]>({
    queryKey: ["recruitingBoard"],
    queryFn: fetchBoardEntries,
    staleTime: 60_000,
  });

  const invalidate = useCallback(() => {
    const delays = [2500, 6000, 12000];
    for (const d of delays) {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["terminalId"] });
        queryClient.invalidateQueries({ queryKey: ["terminalState"] });
        queryClient.invalidateQueries({ queryKey: ["recruitingBoard"] });
      }, d);
    }
  }, [queryClient]);

  const handleCreateTerminal = async () => {
    if (!account || !vault) return;
    setCreateBusy(true); setCreateErr(null);
    try {
      const tx = buildCreateTerminalTransaction(vault!.objectId, "", 0);
      const signer = new CurrentAccountSigner(dAppKit);
      const result = await signer.signAndExecuteTransaction({ transaction: tx });

      // Extract created shared object from effects
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
          if (created.length > 0) {
            try { localStorage.setItem(`cradleos:terminal:${vault!.objectId}`, created[0]); } catch { /* */ }
          }
        } catch { /* fall through to event discovery */ }
      }

      invalidate();
      refetchTerminalId();
      const retries = [3000, 7000, 14000];
      for (const d of retries) {
        setTimeout(() => refetchTerminalId(), d);
      }
    } catch (e) {
      const msg = normalizeChainError(e);
      setCreateErr(msg.includes("unable to find function") || msg.includes("MoveAbort")
        ? "Module not yet deployed on-chain. Deploy recruiting_terminal via DGX first."
        : msg);
    }
    finally { setCreateBusy(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Public Recruiting Board */}
      <div className="card">
        <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "16px", marginBottom: "16px" }}>
          Recruitment Board
        </div>

        {!boardEntries ? (
          <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "12px" }}>Loading open terminals…</div>
        ) : boardEntries.length === 0 ? (
          <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "12px" }}>
            No tribes are currently recruiting.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {boardEntries.map(entry => (
              <BoardCard
                key={entry.terminalId}
                entry={entry}
                ownVaultId={vault?.objectId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Founder section */}
      {account && (
        <div className="card">
          <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "16px", marginBottom: "16px" }}>
            Your Tribe Terminal
          </div>

          {vaultLoading ? (
            <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "12px" }}>Loading vault…</div>
          ) : !vault ? (
            <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "12px" }}>
              No tribe vault found. Create one in the Tribe Vault tab first.
            </div>
          ) : !isFounder ? (
            <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "12px" }}>
              Only the tribe founder can manage the recruiting terminal.
            </div>
          ) : !terminalId ? (
            <div>
              <div style={{ color: "#888", fontSize: "13px", marginBottom: "16px" }}>
                No recruiting terminal exists for your vault yet.
              </div>
              <button
                className="accent-button"
                onClick={handleCreateTerminal}
                disabled={createBusy}
              >
                {createBusy ? "Creating…" : "Create Recruiting Terminal"}
              </button>
              {createErr && (
                <div style={{ color: "#ff6432", fontSize: "12px", marginTop: "8px" }}>⚠ {createErr}</div>
              )}
              <button
                onClick={() => {
                  try { localStorage.removeItem(`cradleos:terminal:${vault.objectId}`); } catch { /* */ }
                  refetchTerminalId();
                }}
                style={{
                  display: "block", marginTop: "10px", background: "transparent",
                  border: "1px solid rgba(255,255,255,0.1)", color: "rgba(107,107,94,0.5)",
                  borderRadius: "0", fontSize: "11px", padding: "4px 12px", cursor: "pointer",
                }}
              >
                ↻ Refresh
              </button>
            </div>
          ) : !terminal ? (
            <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "12px" }}>Loading terminal…</div>
          ) : (
            <FounderPanel
              vault={vault}
              terminalId={terminalId}
              terminal={terminal}
              refetchTerminal={() => refetchTerminal()}
            />
          )}
        </div>
      )}

      {/* Applicant: own applications */}
      {account && (
        <div className="card">
          <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "16px", marginBottom: "16px" }}>
            Your Applications
          </div>
          <OwnApplicationsView walletAddress={account.address} />
        </div>
      )}

      {/* Not connected */}
      {!account && (
        <div className="card" style={{ textAlign: "center", padding: "32px", color: "#666" }}>
          Connect your EVE Vault to apply or manage a recruiting terminal
        </div>
      )}
    </div>
  );
}
