/**
 * ElectionCreatorWizard — multi-step wizard for creating an Election.
 *
 * Steps:
 *   1. BASICS       — title, description, metadata URI
 *   2. ELIGIBILITY  — who can vote (open / tribe-ingame / tribe-cradleos / allowlist / composite)
 *   3. WEIGHT       — how vote power scales (1c1v / role / age / asset / composite)
 *   4. METHOD       — tally algorithm (single / approval / IRV / Schulze / Borda / STAR /
 *                    quadratic+ / quadratic±  / score sum / score avg / conviction)
 *   5. PRIVACY      — public / commit-reveal / ZK (ZK disabled, Coming Q4 2026)
 *   6. OPTIONS      — list of options (label + optional metadata URI)
 *   7. SCHEDULE     — open/close times, reveal deadline if commit-reveal
 *   8. GAS          — sponsored (default) vs voter-paid
 *   9. REVIEW       — final summary; "Publish" submits the multi-step tx sequence
 *
 * Webview-ban discipline: NO window.prompt/confirm/alert, NO native <select>,
 * NO color-emoji glyphs. Uses PortalSelect from components/PortalSelect.tsx and
 * a portal-mounted confirmation modal.
 *
 * Versatility doctrine: every step surfaces ALL options for that category with
 * a one-line summary + a "Show tradeoffs" expand. The creator's first decision
 * is who gets to vote (eligibility), per the 2026-05-27 lock.
 */
import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { fetchCharacterTribeId, findCharacterForWallet } from "../lib";
import { SUI_TESTNET_RPC } from "../constants";
import {
  ELIGIBILITY_OPTIONS,
  WEIGHT_OPTIONS,
  METHOD_OPTIONS,
  PRIVACY_OPTIONS,
  ELIGIBILITY_KIND,
  WEIGHT_KIND,
  METHOD_KIND,
  PRIVACY_KIND,
  RANKED_SUBTYPE,
  QUADRATIC_SUBTYPE,
  SCORE_SUBTYPE,
  encodeU32LE,
  concat,
  buildCreateElectionTx,
  buildAddOptionTx,
  buildSetScheduleTx,
  buildSetSponsoredTx,
  buildPublishTx,
  CRADLEOS_VOTING_AVAILABLE,
} from "../lib/voting";
import { translateTxError } from "../lib/txError";
import type { PickerOption } from "../lib/voting";

// ── Shared styles ──────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: "#161616",
  border: "1px solid rgba(255,71,0,0.30)",
  borderRadius: "2px",
  color: "#FF4700",
  fontSize: "13px",
  padding: "8px 10px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.10em",
  color: "rgba(180,160,140,0.65)",
  textTransform: "uppercase",
  marginBottom: 4,
  fontWeight: 700,
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid rgba(255,71,0,0.18)",
  background: "rgba(8,5,2,0.6)",
  padding: "16px",
  marginBottom: 16,
};

const stepHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#FF4700",
  fontWeight: 700,
  marginBottom: 10,
  borderBottom: "1px solid rgba(255,71,0,0.2)",
  paddingBottom: 6,
};

// ── Picker (radio-list with expandable tradeoff) ───────────────────────────
function Picker({
  options,
  value,
  onChange,
}: {
  options: PickerOption[];
  value: number;
  onChange: (v: number) => void;
}) {
  const [openTradeoff, setOpenTradeoff] = useState<number | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {options.map((opt) => {
        const selected = opt.value === value;
        const isOpen = openTradeoff === opt.value;
        const disabled = !!opt.disabled;
        return (
          <div
            key={opt.value}
            style={{
              border: selected
                ? "1px solid #FF4700"
                : "1px solid rgba(255,71,0,0.18)",
              background: selected ? "rgba(255,71,0,0.06)" : "rgba(5,3,2,0.5)",
              padding: "10px 12px",
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
            onClick={() => { if (!disabled) onChange(opt.value); }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{
                width: 14, height: 14, marginTop: 3, flexShrink: 0,
                border: selected ? "2px solid #FF4700" : "1px solid rgba(255,71,0,0.4)",
                background: selected ? "#FF4700" : "transparent",
                borderRadius: "50%",
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: selected ? "#FF4700" : "rgba(250,250,229,0.9)" }}>
                    {opt.title}
                  </span>
                  {opt.disabled && (
                    <span style={{ fontSize: 9, color: "rgba(180,160,140,0.6)", letterSpacing: "0.10em" }}>
                      {opt.disabled.reason}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "rgba(200,190,170,0.7)", marginTop: 4, lineHeight: 1.5 }}>
                  {opt.summary}
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setOpenTradeoff(isOpen ? null : opt.value); }}
                  style={{
                    marginTop: 6,
                    background: "transparent",
                    border: "none",
                    color: "rgba(255,71,0,0.7)",
                    fontSize: 10,
                    cursor: "pointer",
                    padding: 0,
                    fontFamily: "inherit",
                    letterSpacing: "0.08em",
                  }}
                >
                  {isOpen ? "▾ Hide tradeoffs" : "▸ Show tradeoffs"}
                </button>
                {isOpen && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "rgba(180,160,140,0.7)", lineHeight: 1.5, paddingLeft: 12, borderLeft: "1px solid rgba(255,71,0,0.15)" }}>
                    {opt.tradeoff}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Confirmation modal (portal-mounted, NOT window.confirm) ─────────────────
function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return createPortal(
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999,
    }} onClick={onCancel}>
      <div style={{
        background: "#0a0604",
        border: "1px solid #FF4700",
        padding: "20px",
        maxWidth: 480, width: "92%",
        fontFamily: "monospace",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 12, color: "#FF4700", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: "rgba(220,210,190,0.85)", lineHeight: 1.6, marginBottom: 16 }}>
          {body}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{
            background: "transparent",
            border: "1px solid rgba(255,71,0,0.3)",
            color: "rgba(220,210,190,0.7)",
            padding: "6px 14px", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}>{cancelLabel}</button>
          <button onClick={onConfirm} style={{
            background: "#FF4700",
            border: "1px solid #FF4700",
            color: "#000",
            padding: "6px 14px", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Wizard state ────────────────────────────────────────────────────────────
interface OptionDraft { label: string; metadataUri: string; }

const STEPS = [
  "Basics",
  "Eligibility",
  "Weight",
  "Method",
  "Privacy",
  "Options",
  "Schedule",
  "Gas",
  "Review",
] as const;

export function ElectionCreatorWizard({
  onCreated,
  onCancel,
}: {
  onCreated?: (electionId: string) => void;
  onCancel?: () => void;
}) {
  const { account } = useVerifiedAccountContext();
  const dAppKit = useDAppKit();

  const [step, setStep] = useState(0);

  // Step 1 — basics
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [metadataUri, setMetadataUri] = useState("");

  // Step 2 — eligibility
  const [eligibilityKind, setEligibilityKind] = useState<number>(ELIGIBILITY_KIND.OPEN);
  // Reserved for future params expansion (tribe id, allowlist ids, composite kids)
  const [eligibilityParams, setEligibilityParams] = useState<Uint8Array>(new Uint8Array());
  const [eligTribeId, setEligTribeId] = useState<string>("");

  // Step 3 — weight
  const [weightKind, setWeightKind] = useState<number>(WEIGHT_KIND.ONE);
  // weightParams reserved for future role-coefficients / char-age coefficient inputs;
  // not yet exposed in the wizard UI (see notice in step 2 for non-asset, non-1c1v).
  const [weightParams] = useState<Uint8Array>(new Uint8Array());
  const [assetCoinType, setAssetCoinType] = useState<string>("");
  const [assetDivisor, setAssetDivisor] = useState<string>("1000000"); // 1e6 default ≈ 1 EVE per vote

  // Step 4 — method
  const [methodKind, setMethodKind] = useState<number>(METHOD_KIND.SINGLE_CHOICE);
  const [rankedSubtype, setRankedSubtype] = useState<number>(RANKED_SUBTYPE.IRV);
  const [quadraticSigned, setQuadraticSigned] = useState<boolean>(false);
  const [scoreSubtype, setScoreSubtype] = useState<number>(SCORE_SUBTYPE.SUM);
  const [maxApprovals, setMaxApprovals] = useState<string>("0"); // 0 = unlimited

  // Step 5 — privacy
  const [privacyKind, setPrivacyKind] = useState<number>(PRIVACY_KIND.PUBLIC);

  // Step 6 — options
  const [options, setOptions] = useState<OptionDraft[]>([
    { label: "", metadataUri: "" },
    { label: "", metadataUri: "" },
  ]);

  // Step 7 — schedule
  const nowIso = useMemo(() => new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16), []);
  const [openIso, setOpenIso] = useState(nowIso);
  const [closeIso, setCloseIso] = useState(() =>
    new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
  );
  const [revealDeadlineIso, setRevealDeadlineIso] = useState(() =>
    new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 16),
  );
  const [disputeWindowHours, setDisputeWindowHours] = useState("24");

  // Step 8 — gas
  const [sponsored, setSponsored] = useState<boolean>(true);
  const [allowRecast, setAllowRecast] = useState<boolean>(false);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [progress, setProgress] = useState<string>("");

  // Derived method_params blob mirroring methods/*.move expected layout.
  const methodParams = useMemo<Uint8Array>(() => {
    switch (methodKind) {
      case METHOD_KIND.APPROVAL: {
        const n = Math.max(0, Number(maxApprovals) | 0);
        return encodeU32LE(n);
      }
      case METHOD_KIND.RANKED_CHOICE: {
        // method_params[0] = subtype (IRV/Schulze/Borda).
        return new Uint8Array([rankedSubtype & 0xff]);
      }
      case METHOD_KIND.QUADRATIC: {
        return new Uint8Array([quadraticSigned ? QUADRATIC_SUBTYPE.SIGNED : QUADRATIC_SUBTYPE.POSITIVE]);
      }
      case METHOD_KIND.SCORE: {
        return new Uint8Array([scoreSubtype & 0xff]);
      }
      default:
        return new Uint8Array();
    }
  }, [methodKind, maxApprovals, rankedSubtype, quadraticSigned, scoreSubtype]);

  // Derived eligibility_params (tribe id prefix when applicable)
  const computedEligibilityParams = useMemo<Uint8Array>(() => {
    if (eligibilityKind === ELIGIBILITY_KIND.TRIBE_INGAME ||
        eligibilityKind === ELIGIBILITY_KIND.TRIBE_CRADLEOS) {
      const tid = Number(eligTribeId) | 0;
      if (!tid) return new Uint8Array();
      return encodeU32LE(tid);
    }
    return eligibilityParams;
  }, [eligibilityKind, eligTribeId, eligibilityParams]);

  // Derived weight_params (asset config when applicable)
  const computedWeightParams = useMemo<Uint8Array>(() => {
    if (weightKind === WEIGHT_KIND.ASSET) {
      // weight_asset layout: [mode u8, divisor u64 LE, cap u64 LE]
      const mode = 0; // BALANCE_DIV
      const divisor = BigInt(Math.max(1, Number(assetDivisor) | 0));
      const cap = 0n; // no cap by default
      const divBuf = new Uint8Array(8);
      const capBuf = new Uint8Array(8);
      for (let i = 0; i < 8; i++) {
        divBuf[i] = Number((divisor >> BigInt(i * 8)) & 0xffn);
        capBuf[i] = Number((cap >> BigInt(i * 8)) & 0xffn);
      }
      return concat(new Uint8Array([mode]), divBuf, capBuf);
    }
    return weightParams;
  }, [weightKind, assetDivisor, weightParams]);

  // Validation per step
  const canProceedFrom = (n: number): { ok: boolean; reason?: string } => {
    switch (n) {
      case 0:
        if (!title.trim()) return { ok: false, reason: "Title is required" };
        return { ok: true };
      case 1:
        if ((eligibilityKind === ELIGIBILITY_KIND.TRIBE_INGAME ||
             eligibilityKind === ELIGIBILITY_KIND.TRIBE_CRADLEOS) && !eligTribeId) {
          return { ok: false, reason: "Tribe ID is required for this eligibility source" };
        }
        return { ok: true };
      case 2:
        if (weightKind === WEIGHT_KIND.ASSET && !assetCoinType.trim()) {
          return { ok: false, reason: "Coin type (e.g. 0x..::EVE::EVE) is required for asset-weight" };
        }
        return { ok: true };
      case 3:
        return { ok: true };
      case 4:
        if (privacyKind === PRIVACY_KIND.ZK) return { ok: false, reason: "ZK privacy is not yet available" };
        return { ok: true };
      case 5: {
        const filled = options.filter((o) => o.label.trim()).length;
        if (filled < 2) return { ok: false, reason: "At least 2 options required" };
        return { ok: true };
      }
      case 6: {
        const openMs = Date.parse(openIso);
        const closeMs = Date.parse(closeIso);
        if (!openMs || !closeMs) return { ok: false, reason: "Open/close times must be set" };
        if (closeMs <= openMs) return { ok: false, reason: "Close time must be after open time" };
        if (privacyKind === PRIVACY_KIND.COMMIT_REVEAL) {
          const revMs = Date.parse(revealDeadlineIso);
          if (!revMs || revMs <= closeMs) return { ok: false, reason: "Reveal deadline must be after close time" };
        }
        return { ok: true };
      }
      default:
        return { ok: true };
    }
  };

  const next = () => {
    const v = canProceedFrom(step);
    if (!v.ok) { setError(v.reason ?? null); return; }
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const prev = () => { setError(null); setStep((s) => Math.max(0, s - 1)); };

  const handleSubmit = async () => {
    if (!account?.address) { setError("Connect EVE Vault first"); return; }
    if (!CRADLEOS_VOTING_AVAILABLE) {
      setError("cradleos_voting package not yet published — set CRADLEOS_VOTING_PKG in constants.ts");
      return;
    }
    setSubmitting(true);
    setError(null);
    setProgress("Resolving character_id…");
    try {
      // Resolve creator_character_id from the connected wallet.
      const charInfo = await findCharacterForWallet(account.address);
      if (!charInfo) throw new Error("No CradleOS character bound to this wallet");
      const creatorCharacterId = Number(charInfo.characterId);

      const signer = new CurrentAccountSigner(dAppKit);

      // Step 1: create_election (Draft)
      setProgress("Creating election (Draft)…");
      const createTx = buildCreateElectionTx({
        title: title.trim(),
        description: description.trim(),
        metadataUri: metadataUri.trim(),
        methodKind,
        methodParams,
        eligibilityKind,
        eligibilityParams: computedEligibilityParams,
        weightKind,
        weightParams: computedWeightParams,
        privacyKind,
        privacyParams: new Uint8Array(),
        creatorCharacterId,
        allowRecast,
      });
      const createResult = await signer.signAndExecuteTransaction({ transaction: createTx });
      const digest = (createResult as Record<string, unknown>)["digest"] as string;
      if (!digest) throw new Error("No digest returned from create_election");

      // Extract election id from object changes (shared object).
      // Fetch tx with effects to find the new shared object.
      setProgress("Resolving election id…");
      const electionId = await fetchCreatedSharedFromDigest(digest, "::voting::Election");
      if (!electionId) throw new Error("Could not resolve created Election id from tx effects");

      // Step 2: add_option for each filled option
      const filled = options.filter((o) => o.label.trim());
      for (let i = 0; i < filled.length; i++) {
        const o = filled[i];
        setProgress(`Adding option ${i + 1}/${filled.length}: ${o.label}`);
        const t = buildAddOptionTx(electionId, o.label.trim(), o.metadataUri.trim());
        await signer.signAndExecuteTransaction({ transaction: t });
      }

      // Step 3: set_schedule
      setProgress("Setting schedule…");
      const openMs = Date.parse(openIso);
      const closeMs = Date.parse(closeIso);
      const revealMs = privacyKind === PRIVACY_KIND.COMMIT_REVEAL ? Date.parse(revealDeadlineIso) : 0;
      const disputeMs = Math.max(0, Number(disputeWindowHours) | 0) * 3600 * 1000;
      const schedTx = buildSetScheduleTx(electionId, openMs, closeMs, revealMs, disputeMs);
      await signer.signAndExecuteTransaction({ transaction: schedTx });

      // Step 4 (optional): set_sponsored
      if (sponsored) {
        setProgress("Configuring sponsored gas…");
        // 1-week expiry by default; max ballots = 10 000 (well within Enoki budget).
        const expiryMs = Date.now() + 7 * 24 * 3600 * 1000;
        const spTx = buildSetSponsoredTx(electionId, account.address, 10_000, expiryMs);
        await signer.signAndExecuteTransaction({ transaction: spTx });
      }

      // Step 5: publish (Draft → Scheduled)
      setProgress("Publishing election…");
      const pubTx = buildPublishTx(electionId);
      await signer.signAndExecuteTransaction({ transaction: pubTx });

      setProgress(`✓ Created election ${electionId.slice(0, 12)}…`);
      onCreated?.(electionId);
    } catch (e) {
      setError(translateTxError(e));
    } finally {
      setSubmitting(false);
      setSubmitConfirmOpen(false);
    }
  };

  // ── Step renderers ────────────────────────────────────────────────────────
  const stepBody = () => {
    switch (step) {
      case 0:
        return (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>Title</div>
              <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>Description</div>
              <textarea style={{ ...inputStyle, minHeight: 80 }} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
            </div>
            <div>
              <div style={labelStyle}>Metadata URI (optional, IPFS / arweave / https)</div>
              <input style={inputStyle} value={metadataUri} onChange={(e) => setMetadataUri(e.target.value)} placeholder="ipfs://…" />
            </div>
          </>
        );
      case 1:
        return (
          <>
            <div style={{ fontSize: 11, color: "rgba(180,160,140,0.7)", marginBottom: 14, lineHeight: 1.6 }}>
              First decision: who gets to vote? Pick the gate that matches your election.
            </div>
            <Picker options={ELIGIBILITY_OPTIONS} value={eligibilityKind} onChange={setEligibilityKind} />
            {(eligibilityKind === ELIGIBILITY_KIND.TRIBE_INGAME ||
              eligibilityKind === ELIGIBILITY_KIND.TRIBE_CRADLEOS) && (
              <div style={{ marginTop: 14 }}>
                <div style={labelStyle}>Tribe ID</div>
                <input
                  style={inputStyle}
                  value={eligTribeId}
                  onChange={(e) => setEligTribeId(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 12345"
                />
                <UseMyTribeButton onApply={(v) => setEligTribeId(String(v))} />
              </div>
            )}
            {eligibilityKind === ELIGIBILITY_KIND.ALLOWLIST && (
              <div style={{ marginTop: 14, padding: 10, background: "rgba(255,71,0,0.05)", border: "1px dashed rgba(255,71,0,0.25)", fontSize: 11, color: "rgba(220,210,190,0.7)" }}>
                Allowlist character_ids must be added via the post-creation Draft editor.
                Eligibility params for this source are populated as a BCS-encoded vector of u32
                ids before publish. For this MVP, paste them as a comma-separated list below
                (the dApp encodes them on submit).
                <textarea
                  style={{ ...inputStyle, marginTop: 8, minHeight: 60 }}
                  placeholder="12345, 67890, …"
                  onChange={(e) => {
                    const ids = e.target.value
                      .split(",")
                      .map((s) => Number(s.trim()))
                      .filter((n) => n > 0);
                    // Encode as: count u32 LE + each id u32 LE (matches eligibility_allowlist
                    // expected layout).
                    const parts: Uint8Array[] = [encodeU32LE(ids.length)];
                    for (const id of ids) parts.push(encodeU32LE(id));
                    setEligibilityParams(concat(...parts));
                  }}
                />
              </div>
            )}
            {eligibilityKind === ELIGIBILITY_KIND.COMPOSITE && (
              <div style={{ marginTop: 14, padding: 10, background: "rgba(255,71,0,0.05)", border: "1px dashed rgba(255,71,0,0.25)", fontSize: 11, color: "rgba(220,210,190,0.7)" }}>
                Composite eligibility combines child sources with AND / OR logic. The dApp
                exposes this in v1 as <em>post-creation configuration</em> — create the election
                with composite kind here, then attach child eligibility entries via the Draft
                editor before publish. (UI for composite child wiring lands in a follow-up.)
              </div>
            )}
          </>
        );
      case 2:
        return (
          <>
            <div style={{ fontSize: 11, color: "rgba(180,160,140,0.7)", marginBottom: 14, lineHeight: 1.6 }}>
              How does vote power scale? Pick how each voter's weight is computed.
            </div>
            <Picker options={WEIGHT_OPTIONS} value={weightKind} onChange={setWeightKind} />
            {weightKind === WEIGHT_KIND.ASSET && (
              <div style={{ marginTop: 14 }}>
                <div style={labelStyle}>Coin type</div>
                <input
                  style={inputStyle}
                  value={assetCoinType}
                  onChange={(e) => setAssetCoinType(e.target.value)}
                  placeholder="0x…::EVE::EVE  (paste the full Move type)"
                />
                <div style={{ fontSize: 10, color: "rgba(180,160,140,0.55)", marginTop: 4 }}>
                  Voters must hold a Coin&lt;T&gt; of this type at cast time. Asset shortcuts
                  for EVE / tribe coins are deferred per the 2026-05-27 lock.
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={labelStyle}>Divisor (balance / divisor = weight)</div>
                  <input
                    style={inputStyle}
                    value={assetDivisor}
                    onChange={(e) => setAssetDivisor(e.target.value.replace(/[^0-9]/g, ""))}
                  />
                  <div style={{ fontSize: 10, color: "rgba(180,160,140,0.55)", marginTop: 4 }}>
                    e.g. 1 000 000 ≈ 1 EVE per unit of vote weight (EVE has 6 decimals).
                  </div>
                </div>
              </div>
            )}
            {(weightKind === WEIGHT_KIND.ROLE || weightKind === WEIGHT_KIND.CHAR_AGE) && (
              <div style={{ marginTop: 14, padding: 10, background: "rgba(255,71,0,0.05)", border: "1px dashed rgba(255,71,0,0.25)", fontSize: 11, color: "rgba(220,210,190,0.7)" }}>
                Default weight curve applies. Per-role weights and age coefficients can be
                tuned via post-creation Draft config (UI follow-up).
              </div>
            )}
          </>
        );
      case 3:
        return (
          <>
            <div style={{ fontSize: 11, color: "rgba(180,160,140,0.7)", marginBottom: 14, lineHeight: 1.6 }}>
              What tally algorithm runs after votes close? Pick the method.
            </div>
            <Picker options={METHOD_OPTIONS} value={methodKind} onChange={setMethodKind} />
            {methodKind === METHOD_KIND.APPROVAL && (
              <div style={{ marginTop: 14 }}>
                <div style={labelStyle}>Max approvals per voter (0 = unlimited)</div>
                <input
                  style={inputStyle}
                  value={maxApprovals}
                  onChange={(e) => setMaxApprovals(e.target.value.replace(/[^0-9]/g, ""))}
                />
              </div>
            )}
            {methodKind === METHOD_KIND.RANKED_CHOICE && (
              <div style={{ marginTop: 14 }}>
                <div style={labelStyle}>Ranked-choice subtype</div>
                <Picker
                  options={[
                    { value: RANKED_SUBTYPE.IRV, title: "IRV — Instant Runoff", summary: "Eliminate lowest until majority.", tradeoff: "Most familiar; satisfies later-no-harm. Vulnerable to non-monotonic outcomes." },
                    { value: RANKED_SUBTYPE.SCHULZE, title: "Schulze — Condorcet", summary: "Pairwise preference winner.", tradeoff: "Strongest theoretical guarantees; harder to explain. Picks Condorcet winner when one exists." },
                    { value: RANKED_SUBTYPE.BORDA, title: "Borda — Positional", summary: "Reverse-rank point sum.", tradeoff: "Cardinal info preserved; consensus-friendly. Strategic burying possible." },
                  ]}
                  value={rankedSubtype}
                  onChange={setRankedSubtype}
                />
              </div>
            )}
            {methodKind === METHOD_KIND.QUADRATIC && (
              <div style={{ marginTop: 14, padding: 10, background: "rgba(255,71,0,0.05)", border: "1px dashed rgba(255,71,0,0.25)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "rgba(220,210,190,0.85)", cursor: "pointer" }}>
                  <input type="checkbox" checked={quadraticSigned} onChange={(e) => setQuadraticSigned(e.target.checked)} />
                  Signed quadratic (allow voting AGAINST options)
                </label>
                <div style={{ fontSize: 10, color: "rgba(180,160,140,0.55)", marginTop: 4 }}>
                  Per the 2026-05-27 lock: positive-only by default, signed available now as a creator opt-in.
                </div>
              </div>
            )}
            {methodKind === METHOD_KIND.SCORE && (
              <div style={{ marginTop: 14 }}>
                <div style={labelStyle}>Score subtype</div>
                <Picker
                  options={[
                    { value: SCORE_SUBTYPE.SUM, title: "Sum", summary: "Σ (score × weight) per option.", tradeoff: "Rewards concentrated enthusiasm; bigger fields win." },
                    { value: SCORE_SUBTYPE.AVG, title: "Average", summary: "Σ (score × weight) / total weight.", tradeoff: "Compresses outliers; small enthusiastic groups still win small contests." },
                    { value: SCORE_SUBTYPE.STAR, title: "STAR — Score then Auto Runoff", summary: "Top-2 by sum, then approval runoff.", tradeoff: "Most-defended modern method; resists strategic exaggeration. Requires 2-phase tally." },
                  ]}
                  value={scoreSubtype}
                  onChange={setScoreSubtype}
                />
              </div>
            )}
          </>
        );
      case 4:
        return (
          <>
            <div style={{ fontSize: 11, color: "rgba(180,160,140,0.7)", marginBottom: 14, lineHeight: 1.6 }}>
              When are ballots visible? Public is cheapest; commit-reveal hides in-flight choices.
            </div>
            <Picker options={PRIVACY_OPTIONS} value={privacyKind} onChange={setPrivacyKind} />
          </>
        );
      case 5:
        return (
          <>
            <div style={{ fontSize: 11, color: "rgba(180,160,140,0.7)", marginBottom: 14, lineHeight: 1.6 }}>
              List the options voters choose between. You can add or remove options before publishing.
            </div>
            {options.map((o, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                <span style={{ fontSize: 11, color: "rgba(180,160,140,0.55)", minWidth: 24, marginTop: 6 }}>{i + 1}.</span>
                <div style={{ flex: 1 }}>
                  <input
                    style={inputStyle}
                    placeholder={`Option ${i + 1} label`}
                    value={o.label}
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = { ...next[i], label: e.target.value };
                      setOptions(next);
                    }}
                    maxLength={120}
                  />
                  <input
                    style={{ ...inputStyle, marginTop: 4, fontSize: 11 }}
                    placeholder="Optional metadata URI"
                    value={o.metadataUri}
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = { ...next[i], metadataUri: e.target.value };
                      setOptions(next);
                    }}
                  />
                </div>
                <button
                  onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                  disabled={options.length <= 2}
                  title={options.length <= 2 ? "Minimum 2 options" : "Remove option"}
                  style={{
                    background: "transparent", border: "1px solid rgba(255,71,0,0.3)",
                    color: options.length <= 2 ? "rgba(180,160,140,0.4)" : "#FF4700",
                    width: 28, height: 28, marginTop: 4, cursor: options.length <= 2 ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                  }}>×</button>
              </div>
            ))}
            <button
              onClick={() => setOptions([...options, { label: "", metadataUri: "" }])}
              style={{
                background: "transparent", border: "1px solid rgba(255,71,0,0.4)",
                color: "#FF4700", padding: "6px 12px", fontSize: 11, cursor: "pointer",
                marginTop: 6, fontFamily: "inherit", letterSpacing: "0.08em", textTransform: "uppercase",
              }}>+ Add option</button>
          </>
        );
      case 6:
        return (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>Open time</div>
              <input style={inputStyle} type="datetime-local" value={openIso} onChange={(e) => setOpenIso(e.target.value)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>Close time</div>
              <input style={inputStyle} type="datetime-local" value={closeIso} onChange={(e) => setCloseIso(e.target.value)} />
            </div>
            {privacyKind === PRIVACY_KIND.COMMIT_REVEAL && (
              <div style={{ marginBottom: 12 }}>
                <div style={labelStyle}>Reveal deadline</div>
                <input style={inputStyle} type="datetime-local" value={revealDeadlineIso} onChange={(e) => setRevealDeadlineIso(e.target.value)} />
                <div style={{ fontSize: 10, color: "rgba(180,160,140,0.55)", marginTop: 4 }}>
                  Voters who don't reveal by this time forfeit their ballot.
                </div>
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>Dispute window (hours)</div>
              <input
                style={inputStyle}
                value={disputeWindowHours}
                onChange={(e) => setDisputeWindowHours(e.target.value.replace(/[^0-9]/g, ""))}
              />
              <div style={{ fontSize: 10, color: "rgba(180,160,140,0.55)", marginTop: 4 }}>
                After the chain tallies, anyone can submit an alternative tally with a deterministic
                re-run. The election finalizes once this window closes with no successful disputes.
              </div>
            </div>
          </>
        );
      case 7:
        return (
          <>
            <div style={{ marginBottom: 14, padding: 12, background: "rgba(255,71,0,0.05)", border: "1px solid rgba(255,71,0,0.2)" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "rgba(250,250,229,0.9)", cursor: "pointer" }}>
                <input type="checkbox" checked={sponsored} onChange={(e) => setSponsored(e.target.checked)} style={{ marginTop: 3 }} />
                <div>
                  <div style={{ fontWeight: 700 }}>Sponsored gas (default)</div>
                  <div style={{ fontSize: 11, color: "rgba(200,190,170,0.7)", marginTop: 4, lineHeight: 1.5 }}>
                    Voters pay zero gas. The election creator (you) sponsors up to 10 000 ballots
                    via the Enoki relayer. Sponsored-tx wrapper is currently a stub — see
                    constants for status. When unsponsored, voters pay their own gas.
                  </div>
                </div>
              </label>
            </div>
            <div style={{ marginBottom: 14, padding: 12, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,71,0,0.15)" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "rgba(250,250,229,0.9)", cursor: "pointer" }}>
                <input type="checkbox" checked={allowRecast} onChange={(e) => setAllowRecast(e.target.checked)} style={{ marginTop: 3 }} />
                <div>
                  <div style={{ fontWeight: 700 }}>Allow voters to recast their ballot</div>
                  <div style={{ fontSize: 11, color: "rgba(200,190,170,0.7)", marginTop: 4, lineHeight: 1.5 }}>
                    Lets voters change their vote until the election closes. Disabled by default —
                    first ballot is final.
                  </div>
                </div>
              </label>
            </div>
          </>
        );
      case 8:
        return (
          <div>
            <div style={{ fontSize: 11, color: "rgba(180,160,140,0.7)", marginBottom: 14, lineHeight: 1.6 }}>
              Review the configuration. Hitting Publish runs a multi-step transaction sequence:
              create_election → add_option × N → set_schedule → set_sponsored? → publish.
            </div>
            <ReviewRow label="Title" value={title} />
            <ReviewRow label="Description" value={description || "(none)"} multi />
            <ReviewRow label="Metadata URI" value={metadataUri || "(none)"} />
            <ReviewRow label="Eligibility" value={pickLabel(ELIGIBILITY_OPTIONS, eligibilityKind)} />
            {(eligibilityKind === ELIGIBILITY_KIND.TRIBE_INGAME ||
              eligibilityKind === ELIGIBILITY_KIND.TRIBE_CRADLEOS) && (
              <ReviewRow label="  ↳ Tribe ID" value={eligTribeId || "(missing)"} />
            )}
            <ReviewRow label="Weight" value={pickLabel(WEIGHT_OPTIONS, weightKind)} />
            {weightKind === WEIGHT_KIND.ASSET && (
              <>
                <ReviewRow label="  ↳ Coin type" value={assetCoinType} />
                <ReviewRow label="  ↳ Divisor" value={assetDivisor} />
              </>
            )}
            <ReviewRow label="Method" value={pickLabel(METHOD_OPTIONS, methodKind)} />
            {methodKind === METHOD_KIND.APPROVAL && (
              <ReviewRow label="  ↳ Max approvals" value={maxApprovals === "0" ? "unlimited" : maxApprovals} />
            )}
            {methodKind === METHOD_KIND.RANKED_CHOICE && (
              <ReviewRow label="  ↳ Subtype" value={["IRV", "Schulze", "Borda"][rankedSubtype] ?? "?"} />
            )}
            {methodKind === METHOD_KIND.QUADRATIC && (
              <ReviewRow label="  ↳ Signed" value={quadraticSigned ? "yes (vote-against allowed)" : "no (positive only)"} />
            )}
            {methodKind === METHOD_KIND.SCORE && (
              <ReviewRow label="  ↳ Subtype" value={["Sum", "Avg", "STAR"][scoreSubtype] ?? "?"} />
            )}
            <ReviewRow label="Privacy" value={pickLabel(PRIVACY_OPTIONS, privacyKind)} />
            <ReviewRow label="Options" value={options.filter((o) => o.label.trim()).map((o, i) => `${i + 1}. ${o.label}`).join(" · ")} multi />
            <ReviewRow label="Open" value={openIso} />
            <ReviewRow label="Close" value={closeIso} />
            {privacyKind === PRIVACY_KIND.COMMIT_REVEAL && (
              <ReviewRow label="Reveal deadline" value={revealDeadlineIso} />
            )}
            <ReviewRow label="Dispute window" value={`${disputeWindowHours} hours`} />
            <ReviewRow label="Sponsored gas" value={sponsored ? "yes (voters pay zero)" : "no (voters pay)"} />
            <ReviewRow label="Allow recast" value={allowRecast ? "yes" : "no"} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={sectionStyle}>
      <div style={stepHeaderStyle}>
        Step {step + 1} / {STEPS.length} — {STEPS[step]}
      </div>

      {/* Step dots */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{
            flex: 1, height: 3,
            background: i <= step ? "#FF4700" : "rgba(255,71,0,0.15)",
            transition: "background 0.2s",
          }} title={`${i + 1}. ${s}`} />
        ))}
      </div>

      {stepBody()}

      {error && (
        <div style={{ marginTop: 12, padding: 10, background: "rgba(255,71,0,0.1)", border: "1px solid #FF4700", color: "#FF4700", fontSize: 12, fontFamily: "monospace" }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "space-between" }}>
        <button
          onClick={step === 0 ? () => onCancel?.() : prev}
          disabled={submitting}
          style={{
            background: "transparent", border: "1px solid rgba(255,71,0,0.4)",
            color: "rgba(220,210,190,0.7)", padding: "8px 16px",
            fontSize: 11, cursor: submitting ? "wait" : "pointer", fontFamily: "inherit",
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
          {step === 0 ? "Cancel" : "← Back"}
        </button>
        {step < STEPS.length - 1 ? (
          <button onClick={next} style={{
            background: "#FF4700", border: "1px solid #FF4700",
            color: "#000", padding: "8px 18px", fontSize: 11, cursor: "pointer",
            fontFamily: "inherit", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
          }}>Next →</button>
        ) : (
          <button
            disabled={submitting || !CRADLEOS_VOTING_AVAILABLE}
            onClick={() => setSubmitConfirmOpen(true)}
            title={!CRADLEOS_VOTING_AVAILABLE ? "cradleos_voting package not yet published" : undefined}
            style={{
              background: CRADLEOS_VOTING_AVAILABLE ? "#00ff96" : "rgba(180,160,140,0.3)",
              border: "1px solid",
              borderColor: CRADLEOS_VOTING_AVAILABLE ? "#00ff96" : "rgba(180,160,140,0.4)",
              color: "#000", padding: "8px 18px", fontSize: 11,
              cursor: submitting || !CRADLEOS_VOTING_AVAILABLE ? "not-allowed" : "pointer",
              fontFamily: "inherit", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
            }}>{submitting ? "Submitting…" : "Publish election"}</button>
        )}
      </div>

      {progress && (
        <div style={{ marginTop: 10, padding: 8, background: "rgba(0,0,0,0.3)", fontSize: 11, color: "rgba(200,190,170,0.8)", fontFamily: "monospace" }}>
          {progress}
        </div>
      )}

      <ConfirmModal
        open={submitConfirmOpen && !submitting}
        title="Publish election?"
        body={
          <>
            <p>This will submit up to 5 transactions:</p>
            <ul style={{ paddingLeft: 16, margin: "8px 0" }}>
              <li>1× create_election</li>
              <li>{options.filter((o) => o.label.trim()).length}× add_option</li>
              <li>1× set_schedule</li>
              {sponsored && <li>1× set_sponsored</li>}
              <li>1× publish</li>
            </ul>
            <p>Once published, the configuration is locked. Continue?</p>
          </>
        }
        confirmLabel="Publish"
        onConfirm={handleSubmit}
        onCancel={() => setSubmitConfirmOpen(false)}
      />
    </div>
  );
}

function ReviewRow({ label, value, multi }: { label: string; value: string; multi?: boolean }) {
  return (
    <div style={{
      display: "flex", gap: 12, padding: "6px 0",
      borderBottom: "1px dashed rgba(255,71,0,0.1)",
      alignItems: multi ? "flex-start" : "center",
    }}>
      <div style={{ minWidth: 140, fontSize: 10, color: "rgba(180,160,140,0.65)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ flex: 1, fontSize: 12, color: "rgba(250,250,229,0.85)", wordBreak: "break-word" }}>
        {value}
      </div>
    </div>
  );
}

function pickLabel(options: PickerOption[], v: number): string {
  return options.find((o) => o.value === v)?.title ?? `kind ${v}`;
}

// Helper button: read tribe id from the user's character and apply it.
function UseMyTribeButton({ onApply }: { onApply: (tribeId: number) => void }) {
  const { account } = useVerifiedAccountContext();
  const [busy, setBusy] = useState(false);
  const click = async () => {
    if (!account?.address) return;
    setBusy(true);
    try {
      const id = await fetchCharacterTribeId(account.address);
      if (id) onApply(id);
    } finally { setBusy(false); }
  };
  return (
    <button
      onClick={click}
      disabled={busy || !account}
      style={{
        background: "transparent", border: "1px solid rgba(255,71,0,0.4)",
        color: "#FF4700", padding: "4px 10px", fontSize: 10, cursor: busy ? "wait" : "pointer",
        marginTop: 6, fontFamily: "inherit", letterSpacing: "0.08em", textTransform: "uppercase",
      }}>{busy ? "…" : "Use my tribe"}</button>
  );
}

// ── Helper: extract first created shared object id of a given type substring ─
// Mirrors the helper used in TribeVaultPanel; pulls the new Election id.
async function fetchCreatedSharedFromDigest(digest: string, typeContains: string): Promise<string | null> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sui_getTransactionBlock",
        params: [
          digest,
          { showEffects: true, showObjectChanges: true },
        ],
      }),
    });
    const j = await res.json();
    const changes = j?.result?.objectChanges as Array<Record<string, unknown>> | undefined;
    if (!changes) return null;
    for (const c of changes) {
      if (c.type === "created" && String(c.objectType ?? "").includes(typeContains)) {
        return String(c.objectId ?? "");
      }
    }
    return null;
  } catch { return null; }
}
