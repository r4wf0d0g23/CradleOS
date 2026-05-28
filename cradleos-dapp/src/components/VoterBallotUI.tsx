/**
 * VoterBallotUI — cast a ballot in a specific election.
 *
 * Given an electionId:
 *   - Fetches the on-chain Election object
 *   - Resolves the connected wallet's character_id
 *   - Shows eligibility status (✓ eligible / ✗ ineligible / ⓘ proof required)
 *   - Renders the method-specific ballot form
 *   - Builds the PTB sequence (eligibility::mint → weight::mint → cast/commit)
 *   - Submits the tx
 *
 * Method-specific forms implemented in v1:
 *   - single_choice  — radio list (canonical)
 *   - approval       — checkbox list (canonical)
 *   - ranked_choice  — stubbed; design ready
 *   - score          — stubbed; design ready
 *   - quadratic      — stubbed; design ready
 *   - conviction     — stubbed; design ready
 *
 * Webview-ban compliance:
 *   - NO window.prompt/confirm/alert
 *   - NO native <select>
 *   - NO color-emoji glyphs (uses ✓ ✗ ⓘ ◉ ◎ which are monospace-safe)
 */
import { useState, useEffect, useMemo } from "react";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { findCharacterForWallet, rpcGetObject } from "../lib";
import {
  METHOD_KIND,
  PRIVACY_KIND,
  ELIGIBILITY_KIND,
  STATE,
  STATE_LABELS,
  WEIGHT_KIND,
  encodeSingleChoiceVote,
  encodeApprovalVote,
  buildCastBallotOpenOneTx,
  buildCommitBallotOpenOneTx,
  commitVote,
  randomSalt,
  CRADLEOS_VOTING_AVAILABLE,
  CRADLEOS_VOTING_PKG,
} from "../lib/voting";
import { translateTxError } from "../lib/txError";

interface ElectionFields {
  state: number;
  methodKind: number;
  privacyKind: number;
  eligibilityKind: number;
  weightKind: number;
  title: string;
  description: string;
  options: Array<{ id: number; label: string }>;
  scheduledOpenMs: number;
  scheduledCloseMs: number;
  revealDeadlineMs: number;
  creator: string;
  creatorCharacterId: number;
  allowRecast: boolean;
}

function readElectionFields(raw: Record<string, unknown>): ElectionFields | null {
  const content = (raw as { data?: { content?: { fields?: Record<string, unknown> } } })?.data?.content?.fields;
  if (!content) return null;
  const opts = (content.options as Array<Record<string, unknown>> | undefined) ?? [];
  return {
    state: Number(content.state ?? 0),
    methodKind: Number(content.method_kind ?? 0),
    privacyKind: Number(content.privacy_kind ?? 0),
    eligibilityKind: Number(content.eligibility_kind ?? 0),
    weightKind: Number(content.weight_kind ?? 0),
    title: String(content.title ?? ""),
    description: String(content.description ?? ""),
    options: opts.map((o) => {
      const f = (o as { fields?: Record<string, unknown> }).fields ?? o;
      return { id: Number(f.id ?? 0), label: String(f.label ?? "") };
    }),
    scheduledOpenMs: Number(content.scheduled_open_ms ?? 0),
    scheduledCloseMs: Number(content.scheduled_close_ms ?? 0),
    revealDeadlineMs: Number(content.reveal_deadline_ms ?? 0),
    creator: String(content.creator ?? ""),
    creatorCharacterId: Number(content.creator_character_id ?? 0),
    allowRecast: Boolean(content.allow_recast ?? false),
  };
}

const containerStyle: React.CSSProperties = {
  border: "1px solid rgba(255,71,0,0.18)",
  background: "rgba(8,5,2,0.6)",
  padding: 16,
};

const eligIcon = (status: "yes" | "no" | "unknown") =>
  status === "yes" ? "✓" : status === "no" ? "✗" : "ⓘ";

const eligColor = (status: "yes" | "no" | "unknown") =>
  status === "yes" ? "#00ff96" : status === "no" ? "#ff6b6b" : "rgba(220,210,190,0.7)";

export function VoterBallotUI({
  electionId,
  onCast,
  onBack,
}: {
  electionId: string;
  onCast?: () => void;
  onBack?: () => void;
}) {
  const { account } = useVerifiedAccountContext();
  const dAppKit = useDAppKit();

  const [election, setElection] = useState<ElectionFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [characterId, setCharacterId] = useState<number | null>(null);

  // Ballot state — per-method
  const [singleChoice, setSingleChoice] = useState<number | null>(null);
  const [approvals, setApprovals] = useState<Set<number>>(new Set());

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [revealBundle, setRevealBundle] = useState<{ salt: string; encodedVote: string } | null>(null);

  // Load election
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    rpcGetObject(electionId)
      .then((raw) => {
        if (cancelled) return;
        const fields = readElectionFields(raw);
        if (!fields) { setError("Could not parse election object"); return; }
        setElection(fields);
      })
      .catch((e) => { if (!cancelled) setError(translateTxError(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [electionId]);

  // Resolve character_id
  useEffect(() => {
    let cancelled = false;
    if (!account?.address) { setCharacterId(null); return; }
    findCharacterForWallet(account.address).then((c) => {
      if (cancelled) return;
      setCharacterId(c ? Number(c.characterId) : null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [account?.address]);

  // Eligibility hint — UI-side only; chain re-checks via proof.
  const eligibilityHint = useMemo<{ status: "yes" | "no" | "unknown"; reason: string }>(() => {
    if (!election) return { status: "unknown", reason: "Loading election…" };
    if (!characterId) return { status: "unknown", reason: "Connect EVE Vault to check eligibility" };
    if (election.eligibilityKind === ELIGIBILITY_KIND.OPEN) {
      return { status: "yes", reason: "Open eligibility — any verified character can vote" };
    }
    if (election.eligibilityKind === ELIGIBILITY_KIND.TRIBE_INGAME) {
      return { status: "unknown", reason: "Tribe (in-game) — eligibility verified at cast time via attestation registry" };
    }
    if (election.eligibilityKind === ELIGIBILITY_KIND.TRIBE_CRADLEOS) {
      return { status: "unknown", reason: "Tribe (CradleOS) — eligibility verified at cast time via TribeVault + TribeRoles" };
    }
    if (election.eligibilityKind === ELIGIBILITY_KIND.ALLOWLIST) {
      return { status: "unknown", reason: "Allowlist — character_id must be in the configured list" };
    }
    if (election.eligibilityKind === ELIGIBILITY_KIND.COMPOSITE) {
      return { status: "unknown", reason: "Composite — child sources verified at cast time" };
    }
    return { status: "unknown", reason: `Eligibility kind ${election.eligibilityKind}` };
  }, [election, characterId]);

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ color: "rgba(180,160,140,0.55)", fontSize: 12, fontFamily: "monospace" }}>
          Loading election…
        </div>
      </div>
    );
  }

  if (!election) {
    return (
      <div style={containerStyle}>
        <div style={{ color: "#ff6b6b", fontSize: 12 }}>
          {error ?? "Election not found"}
        </div>
        {onBack && <BackButton onBack={onBack} />}
      </div>
    );
  }

  const isOpen = election.state === STATE.OPEN;
  const isCommitReveal = election.privacyKind === PRIVACY_KIND.COMMIT_REVEAL;
  const supportsCurrentMethod =
    election.methodKind === METHOD_KIND.SINGLE_CHOICE ||
    election.methodKind === METHOD_KIND.APPROVAL;

  // ── Cast / commit handler ─────────────────────────────────────────────────
  const handleCast = async () => {
    if (!account?.address) { setError("Connect EVE Vault first"); return; }
    if (!characterId) { setError("No CradleOS character bound to this wallet"); return; }
    if (!CRADLEOS_VOTING_AVAILABLE) {
      setError("cradleos_voting not yet published");
      return;
    }

    // Encode the vote per method.
    let encodedVote: Uint8Array;
    if (election.methodKind === METHOD_KIND.SINGLE_CHOICE) {
      if (singleChoice == null) { setError("Pick an option first"); return; }
      encodedVote = encodeSingleChoiceVote(singleChoice);
    } else if (election.methodKind === METHOD_KIND.APPROVAL) {
      if (approvals.size === 0) { setError("Pick at least one option"); return; }
      encodedVote = encodeApprovalVote(Array.from(approvals));
    } else {
      setError("Ballot form for this method is not yet implemented (design ready)");
      return;
    }

    // Today we only support OPEN+ONE PTB. Higher-tier eligibility/weight needs
    // additional refs (tribe vault, roles, registry, coin). Surface clearly.
    if (
      election.eligibilityKind !== ELIGIBILITY_KIND.OPEN ||
      election.weightKind !== WEIGHT_KIND.ONE
    ) {
      setError(
        "v1 voter UI supports OPEN eligibility + 1c1v weight. Higher-tier configs (tribe-membership, asset-weight) need a more complex PTB — coming in a follow-up.",
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const signer = new CurrentAccountSigner(dAppKit);
      if (isCommitReveal) {
        // Commit-reveal: hash and commit on-chain; surface salt+vote for reveal phase.
        const salt = randomSalt(32);
        const commitment = await commitVote(salt, encodedVote);
        const tx = buildCommitBallotOpenOneTx(electionId, account.address, characterId, commitment);
        await signer.signAndExecuteTransaction({ transaction: tx });
        const hexSalt = "0x" + Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
        const hexVote = "0x" + Array.from(encodedVote).map((b) => b.toString(16).padStart(2, "0")).join("");
        setRevealBundle({ salt: hexSalt, encodedVote: hexVote });
        setResult("✓ Ballot committed. Save the salt + encoded_vote below — you need both to reveal after voting closes.");
      } else {
        const tx = buildCastBallotOpenOneTx(electionId, account.address, characterId, encodedVote);
        await signer.signAndExecuteTransaction({ transaction: tx });
        setResult("✓ Ballot cast on-chain.");
      }
      onCast?.();
    } catch (e) {
      setError(translateTxError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={containerStyle}>
      {onBack && <BackButton onBack={onBack} />}

      {/* Header */}
      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid rgba(255,71,0,0.2)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#FF4700", letterSpacing: "0.02em" }}>
          {election.title}
        </div>
        {election.description && (
          <div style={{ fontSize: 12, color: "rgba(200,190,170,0.75)", marginTop: 6, lineHeight: 1.5 }}>
            {election.description}
          </div>
        )}
        <Meta election={election} />
      </div>

      {/* Eligibility */}
      <div style={{
        marginBottom: 16, padding: 10,
        background: "rgba(0,0,0,0.25)",
        border: "1px solid rgba(255,71,0,0.15)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 18, color: eligColor(eligibilityHint.status) }}>
          {eligIcon(eligibilityHint.status)}
        </span>
        <div>
          <div style={{ fontSize: 12, color: "rgba(250,250,229,0.85)", fontWeight: 700 }}>
            {eligibilityHint.status === "yes" ? "Eligible to vote" :
              eligibilityHint.status === "no" ? "Not eligible" : "Eligibility check pending"}
          </div>
          <div style={{ fontSize: 11, color: "rgba(200,190,170,0.65)", marginTop: 2 }}>
            {eligibilityHint.reason}
          </div>
        </div>
      </div>

      {/* Ballot form */}
      {!isOpen ? (
        <div style={{ padding: 12, background: "rgba(255,71,0,0.05)", border: "1px solid rgba(255,71,0,0.2)", color: "rgba(220,210,190,0.8)", fontSize: 12 }}>
          Election state: <strong>{STATE_LABELS[election.state] ?? "?"}</strong>. Casting is only available during OPEN.
        </div>
      ) : !supportsCurrentMethod ? (
        <div style={{ padding: 12, background: "rgba(255,71,0,0.05)", border: "1px dashed rgba(255,71,0,0.3)", color: "rgba(220,210,190,0.8)", fontSize: 12 }}>
          Method-specific ballot UI for this election is coming soon. The on-chain tally module
          for this method (kind {election.methodKind}) is shipped — the dApp form lands in a follow-up.
          Design is in <code>memory/projects/voting-infrastructure.md</code>.
        </div>
      ) : election.methodKind === METHOD_KIND.SINGLE_CHOICE ? (
        <SingleChoiceForm
          options={election.options}
          value={singleChoice}
          onChange={setSingleChoice}
        />
      ) : (
        <ApprovalForm
          options={election.options}
          value={approvals}
          onChange={setApprovals}
        />
      )}

      {/* Errors / results */}
      {error && (
        <div style={{ marginTop: 12, padding: 10, background: "rgba(255,71,0,0.1)", border: "1px solid #FF4700", color: "#FF4700", fontSize: 12, fontFamily: "monospace" }}>
          {error}
        </div>
      )}
      {result && (
        <div style={{ marginTop: 12, padding: 10, background: "rgba(0,255,150,0.06)", border: "1px solid #00ff96", color: "#00ff96", fontSize: 12, fontFamily: "monospace" }}>
          {result}
        </div>
      )}

      {revealBundle && (
        <div style={{ marginTop: 12, padding: 12, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,71,0,0.25)" }}>
          <div style={{ fontSize: 11, color: "rgba(255,71,0,0.85)", letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
            ⓘ Save these for reveal phase
          </div>
          <div style={{ fontSize: 11, color: "rgba(200,190,170,0.7)", marginBottom: 6, lineHeight: 1.5 }}>
            After voting closes, paste these into the reveal form to disclose your vote.
            <strong> If you lose them, your ballot is forfeit.</strong>
          </div>
          <CopyableField label="Salt" value={revealBundle.salt} />
          <CopyableField label="Encoded vote" value={revealBundle.encodedVote} />
        </div>
      )}

      {/* Action buttons */}
      {isOpen && supportsCurrentMethod && (
        <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={handleCast}
            disabled={submitting || !characterId}
            style={{
              background: submitting ? "rgba(180,160,140,0.3)" : "#FF4700",
              border: "1px solid",
              borderColor: submitting ? "rgba(180,160,140,0.4)" : "#FF4700",
              color: "#000", padding: "8px 18px", fontSize: 11,
              cursor: submitting ? "wait" : "pointer",
              fontFamily: "inherit", letterSpacing: "0.08em",
              textTransform: "uppercase", fontWeight: 700,
            }}>
            {submitting ? "Submitting…" : isCommitReveal ? "Commit ballot" : "Cast ballot"}
          </button>
        </div>
      )}

      {/* Footer notice */}
      <div style={{ marginTop: 14, fontSize: 10, color: "rgba(180,160,140,0.45)", letterSpacing: "0.06em", fontFamily: "monospace" }}>
        Tx target: {CRADLEOS_VOTING_PKG.slice(0, 14)}…::voting::{isCommitReveal ? "commit_ballot" : "cast_ballot"}
      </div>
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} style={{
      background: "transparent", border: "1px solid rgba(255,71,0,0.3)",
      color: "rgba(220,210,190,0.7)", padding: "4px 10px", fontSize: 10,
      cursor: "pointer", marginBottom: 12, fontFamily: "inherit",
      letterSpacing: "0.08em", textTransform: "uppercase",
    }}>← Back</button>
  );
}

function Meta({ election }: { election: ElectionFields }) {
  const stateLabel = STATE_LABELS[election.state] ?? "?";
  const closeMs = election.scheduledCloseMs;
  const now = Date.now();
  const remaining = closeMs > now ? closeMs - now : 0;
  const remH = Math.floor(remaining / 3600000);
  const remM = Math.floor((remaining % 3600000) / 60000);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, fontSize: 10, color: "rgba(180,160,140,0.65)", letterSpacing: "0.08em" }}>
      <span><span style={{ color: "#FF4700" }}>{stateLabel}</span></span>
      <span>METHOD {election.methodKind}</span>
      <span>ELIG {election.eligibilityKind}</span>
      <span>WEIGHT {election.weightKind}</span>
      <span>PRIVACY {election.privacyKind}</span>
      {election.state === STATE.OPEN && closeMs > 0 && (
        <span>CLOSES IN {remH}h {remM}m</span>
      )}
    </div>
  );
}

function SingleChoiceForm({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: number; label: string }>;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 11, color: "rgba(180,160,140,0.65)", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Pick one
      </div>
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <div
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              border: selected ? "1px solid #FF4700" : "1px solid rgba(255,71,0,0.18)",
              background: selected ? "rgba(255,71,0,0.06)" : "rgba(5,3,2,0.5)",
              padding: "10px 12px",
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 10,
            }}>
            <span style={{ fontSize: 14, color: selected ? "#FF4700" : "rgba(180,160,140,0.4)" }}>
              {selected ? "◉" : "◎"}
            </span>
            <span style={{ fontSize: 13, color: selected ? "#FF4700" : "rgba(250,250,229,0.9)" }}>
              {o.label || `Option ${o.id}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ApprovalForm({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: number; label: string }>;
  value: Set<number>;
  onChange: (v: Set<number>) => void;
}) {
  const toggle = (id: number) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 11, color: "rgba(180,160,140,0.65)", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Approve any number
      </div>
      {options.map((o) => {
        const selected = value.has(o.id);
        return (
          <div
            key={o.id}
            onClick={() => toggle(o.id)}
            style={{
              border: selected ? "1px solid #FF4700" : "1px solid rgba(255,71,0,0.18)",
              background: selected ? "rgba(255,71,0,0.06)" : "rgba(5,3,2,0.5)",
              padding: "10px 12px",
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 10,
            }}>
            <span style={{
              width: 14, height: 14,
              border: selected ? "2px solid #FF4700" : "1px solid rgba(255,71,0,0.4)",
              background: selected ? "#FF4700" : "transparent",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "#000", fontSize: 10, fontWeight: 700,
            }}>{selected ? "✓" : ""}</span>
            <span style={{ fontSize: 13, color: selected ? "#FF4700" : "rgba(250,250,229,0.9)" }}>
              {o.label || `Option ${o.id}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CopyableField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 9, color: "rgba(180,160,140,0.55)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <code style={{
          flex: 1, fontSize: 10, fontFamily: "monospace",
          background: "rgba(0,0,0,0.4)", padding: "6px 8px",
          color: "rgba(250,250,229,0.85)", wordBreak: "break-all",
          border: "1px solid rgba(255,71,0,0.12)",
        }}>{value}</code>
        <button onClick={copy} style={{
          background: "transparent", border: "1px solid rgba(255,71,0,0.3)",
          color: copied ? "#00ff96" : "#FF4700",
          padding: "4px 8px", fontSize: 9, cursor: "pointer",
          fontFamily: "inherit", letterSpacing: "0.08em", textTransform: "uppercase",
        }}>{copied ? "Copied" : "Copy"}</button>
      </div>
    </div>
  );
}
