/**
 * ElectionResultsPage — show the final tally for a finalized election.
 *
 * Sections:
 *   1. Header — title, winners, totals, state badge
 *   2. Per-option chart — counts/scores per option
 *   3. Verify on chain — pulls all raw ballot events and re-runs the tally
 *      locally; shows green ✓ when local matches chain, red diff otherwise
 *   4. Export verification bundle — downloads a JSON containing all raw events,
 *      the local re-run output, and a replay-script template
 *
 * The "verify on chain" button is required per the 2026-05-27 doctrine —
 * reproducible tally is the dApp's promise to the community.
 */
import { useState, useEffect } from "react";
import { rpcGetObject } from "../lib";
import {
  METHOD_KIND,
  STATE,
  STATE_LABELS,
  localTally,
  fetchBallotsForElection,
  fetchAllElections,
  buildVerificationBundleJson,
  toBytes,
  decodeU32LE,
  decodeU64LE,
  CRADLEOS_VOTING_AVAILABLE,
  type LocalTallyResult,
  type BallotEvent,
  type ElectionSummary,
  type VerificationBundle,
} from "../lib/voting";

interface TallyFields {
  electionId: string;
  methodKind: number;
  totalBallots: number;
  totalWeight: bigint;
  winnerOptionIds: number[];
  resultPayload: Uint8Array;
  inputHash: string;
  outputHash: string;
  disputed: boolean;
}

function readTallyFields(raw: Record<string, unknown>): TallyFields | null {
  const content = (raw as { data?: { content?: { fields?: Record<string, unknown> } } })?.data?.content?.fields;
  if (!content) return null;
  return {
    electionId: String(content.election_id ?? ""),
    methodKind: Number(content.method_kind ?? 0),
    totalBallots: Number(content.total_ballots ?? 0),
    totalWeight: BigInt(String(content.total_weight ?? "0")),
    winnerOptionIds: ((content.winner_option_ids as Array<number | string>) ?? []).map((n) => Number(n)),
    resultPayload: toBytes(content.result_payload),
    inputHash: "0x" + Array.from(toBytes(content.input_hash)).map((b) => b.toString(16).padStart(2, "0")).join(""),
    outputHash: "0x" + Array.from(toBytes(content.output_hash)).map((b) => b.toString(16).padStart(2, "0")).join(""),
    disputed: Boolean(content.disputed ?? false),
  };
}

interface ElectionMeta {
  state: number;
  methodKind: number;
  options: Array<{ id: number; label: string }>;
  title: string;
  tallyId: string | null;
}

function readElectionMeta(raw: Record<string, unknown>): ElectionMeta | null {
  const content = (raw as { data?: { content?: { fields?: Record<string, unknown> } } })?.data?.content?.fields;
  if (!content) return null;
  const opts = (content.options as Array<Record<string, unknown>> | undefined) ?? [];
  const tallyOpt = content.tally_id as { fields?: { vec?: unknown[] } } | undefined;
  let tallyId: string | null = null;
  if (tallyOpt?.fields?.vec && tallyOpt.fields.vec.length > 0) {
    tallyId = String(tallyOpt.fields.vec[0]);
  }
  return {
    state: Number(content.state ?? 0),
    methodKind: Number(content.method_kind ?? 0),
    title: String(content.title ?? ""),
    options: opts.map((o) => {
      const f = (o as { fields?: Record<string, unknown> }).fields ?? o;
      return { id: Number(f.id ?? 0), label: String(f.label ?? "") };
    }),
    tallyId,
  };
}

const containerStyle: React.CSSProperties = {
  border: "1px solid rgba(255,71,0,0.18)",
  background: "rgba(8,5,2,0.6)",
  padding: 16,
};

export function ElectionResultsPage({
  electionId,
  onBack,
}: {
  electionId: string;
  onBack?: () => void;
}) {
  const [meta, setMeta] = useState<ElectionMeta | null>(null);
  const [tally, setTally] = useState<TallyFields | null>(null);
  const [ballots, setBallots] = useState<BallotEvent[] | null>(null);
  const [localResult, setLocalResult] = useState<LocalTallyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [electionSummary, setElectionSummary] = useState<ElectionSummary | null>(null);

  // Load election meta and (if present) the tally object.
  useEffect(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const raw = await rpcGetObject(electionId);
        if (cancelled) return;
        const m = readElectionMeta(raw);
        if (!m) { setError("Could not parse election"); return; }
        setMeta(m);
        if (m.tallyId) {
          const rawTally = await rpcGetObject(m.tallyId);
          if (cancelled) return;
          setTally(readTallyFields(rawTally));
        }
        // Find the ElectionCreated event for export bundle.
        if (CRADLEOS_VOTING_AVAILABLE) {
          const all = await fetchAllElections();
          if (cancelled) return;
          const match = all.find((e) => e.electionId === electionId);
          if (match) setElectionSummary(match);
        }
      } catch (e) {
        if (!cancelled) setError(String((e as Error).message ?? e));
      }
    })();
    return () => { cancelled = true; };
  }, [electionId]);

  // Verify on chain — fetch ballots and re-run local tally.
  const handleVerify = async () => {
    if (!meta) return;
    setVerifying(true);
    setError(null);
    try {
      const events = await fetchBallotsForElection(electionId);
      setBallots(events);
      const optionIds = meta.options.map((o) => o.id);
      const result = localTally(
        meta.methodKind,
        optionIds,
        events.map((e) => ({ encodedVote: e.encodedVote, weight: e.weight })),
      );
      setLocalResult(result);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setVerifying(false);
    }
  };

  // Build verification bundle and trigger download.
  const handleExport = () => {
    if (!meta || !localResult || !ballots || !electionSummary) return;
    const bundle: VerificationBundle = {
      election: electionSummary,
      ballots,
      localResult,
      chainResultPayload: tally?.resultPayload,
      chainWinners: tally?.winnerOptionIds,
      match: matchesChain(localResult, tally) ?? undefined,
    };
    const json = buildVerificationBundleJson(bundle);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cradleos-voting-${electionId.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!meta) {
    return (
      <div style={containerStyle}>
        {onBack && <BackButton onBack={onBack} />}
        <div style={{ color: "rgba(180,160,140,0.55)", fontSize: 12, fontFamily: "monospace" }}>
          {error ?? "Loading election…"}
        </div>
      </div>
    );
  }

  const stateLabel = STATE_LABELS[meta.state] ?? "?";

  // Decode single_choice result_payload: stream of (u32 id, u64 count) pairs.
  const chainPerOption = tally && tally.methodKind === METHOD_KIND.SINGLE_CHOICE
    ? decodeSingleChoicePayload(tally.resultPayload, meta.options.map((o) => o.id))
    : null;

  const match = matchesChain(localResult, tally);

  return (
    <div style={containerStyle}>
      {onBack && <BackButton onBack={onBack} />}

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "rgba(180,160,140,0.55)", letterSpacing: "0.10em" }}>
          ELECTION RESULTS
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#FF4700", marginTop: 4 }}>
          {meta.title || electionId.slice(0, 14) + "…"}
        </div>
        <div style={{ fontSize: 10, color: "rgba(180,160,140,0.55)", letterSpacing: "0.08em", marginTop: 4 }}>
          STATE <span style={{ color: meta.state >= STATE.TALLIED ? "#00ff96" : "#FF4700" }}>{stateLabel}</span>
          {tally?.disputed && <span style={{ marginLeft: 12, color: "#ffcc00" }}>· DISPUTED</span>}
        </div>
      </div>

      {!tally ? (
        <div style={{ padding: 12, background: "rgba(255,71,0,0.05)", border: "1px solid rgba(255,71,0,0.2)", color: "rgba(220,210,190,0.8)", fontSize: 12 }}>
          No tally has been computed yet. Anyone can call <code>tally::compute_tally</code> once the
          election is in the CLOSED state.
        </div>
      ) : (
        <>
          {/* Winners */}
          <div style={{ marginBottom: 16, padding: 12, background: "rgba(0,255,150,0.05)", border: "1px solid #00ff96" }}>
            <div style={{ fontSize: 10, color: "rgba(0,255,150,0.85)", letterSpacing: "0.10em", marginBottom: 6 }}>
              WINNER{tally.winnerOptionIds.length > 1 ? "S" : ""}
            </div>
            {tally.winnerOptionIds.length === 0 ? (
              <div style={{ fontSize: 12, color: "rgba(220,210,190,0.65)" }}>No winners (no eligible ballots).</div>
            ) : (
              tally.winnerOptionIds.map((id) => {
                const opt = meta.options.find((o) => o.id === id);
                return (
                  <div key={id} style={{ fontSize: 15, color: "#00ff96", fontWeight: 700 }}>
                    ▣ {opt?.label || `Option ${id}`}
                  </div>
                );
              })
            )}
          </div>

          {/* Totals */}
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <Stat label="Total ballots" value={String(tally.totalBallots)} />
            <Stat label="Total weight" value={tally.totalWeight.toString()} />
            <Stat label="Method" value={`kind ${tally.methodKind}`} />
            <Stat label="Output hash" value={tally.outputHash.slice(0, 14) + "…"} />
          </div>

          {/* Per-option breakdown */}
          {chainPerOption && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "rgba(180,160,140,0.65)", letterSpacing: "0.10em", marginBottom: 6 }}>
                ON-CHAIN PER-OPTION
              </div>
              {chainPerOption.map((p) => {
                const opt = meta.options.find((o) => o.id === p.optionId);
                const max = chainPerOption.reduce((m, x) => x.total > m ? x.total : m, 0n);
                const pct = max > 0n ? Number((p.total * 100n) / max) : 0;
                const isWinner = tally.winnerOptionIds.includes(p.optionId);
                return (
                  <div key={p.optionId} style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: isWinner ? "#00ff96" : "rgba(250,250,229,0.85)" }}>
                        {isWinner ? "▣ " : "▢ "}{opt?.label || `Option ${p.optionId}`}
                      </span>
                      <span style={{ color: "rgba(180,160,140,0.7)", fontFamily: "monospace" }}>
                        {p.total.toString()}
                      </span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,71,0,0.1)", marginTop: 3 }}>
                      <div style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: isWinner ? "#00ff96" : "#FF4700",
                        transition: "width 0.3s",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Verify on chain */}
      <div style={{ marginTop: 16, padding: 12, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,71,0,0.2)" }}>
        <div style={{ fontSize: 11, color: "rgba(255,71,0,0.85)", letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
          ▣ Reproducible tally
        </div>
        <div style={{ fontSize: 11, color: "rgba(200,190,170,0.7)", lineHeight: 1.6, marginBottom: 10 }}>
          The chain is the source of truth. This panel fetches every raw ballot event
          and re-runs the tally locally in your browser. The result must match the
          on-chain Tally object — if it doesn't, the chain has a bug worth disputing.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={handleVerify}
            disabled={verifying || !tally}
            style={{
              background: verifying ? "rgba(180,160,140,0.3)" : "#FF4700",
              border: "1px solid",
              borderColor: verifying ? "rgba(180,160,140,0.4)" : "#FF4700",
              color: "#000", padding: "6px 14px", fontSize: 11,
              cursor: verifying || !tally ? "wait" : "pointer",
              fontFamily: "inherit", letterSpacing: "0.08em",
              textTransform: "uppercase", fontWeight: 700,
            }}>{verifying ? "Verifying…" : "Verify on chain"}</button>
          <button
            onClick={handleExport}
            disabled={!localResult || !ballots}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,71,0,0.4)",
              color: localResult ? "#FF4700" : "rgba(180,160,140,0.4)",
              padding: "6px 14px", fontSize: 11,
              cursor: localResult ? "pointer" : "not-allowed",
              fontFamily: "inherit", letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}>Export verification bundle</button>
        </div>

        {/* Verification result */}
        {localResult && (
          <div style={{ marginTop: 12, padding: 10, background: match === true
            ? "rgba(0,255,150,0.05)"
            : match === false ? "rgba(255,71,0,0.05)"
            : "rgba(255,200,0,0.05)",
            border: "1px solid", borderColor: match === true ? "#00ff96"
              : match === false ? "#ff6b6b"
              : "rgba(255,200,0,0.4)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: match === true ? "#00ff96"
              : match === false ? "#ff6b6b" : "#ffcc00", marginBottom: 4 }}>
              {match === true ? "✓ Local re-run matches the chain" :
                match === false ? "✗ Local re-run DOES NOT match the chain — possible bug" :
                "ⓘ Local re-run computed (no chain tally to compare to)"}
            </div>
            <div style={{ fontSize: 11, color: "rgba(220,210,190,0.65)", marginTop: 4 }}>
              Ballots fetched: {ballots?.length ?? 0}. Local total weight: {localResult.totalWeight.toString()}.
              {!localResult.reproducible && (
                <span style={{ color: "#ffcc00" }}>
                  &nbsp;Note: {localResult.notReproducibleReason}.
                </span>
              )}
            </div>
            {match === false && (
              <div style={{ marginTop: 8, fontSize: 11, color: "rgba(220,210,190,0.8)", fontFamily: "monospace" }}>
                Local winners: [{localResult.winners.join(", ")}]<br />
                Chain winners: [{tally?.winnerOptionIds.join(", ") ?? ""}]
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 10, background: "rgba(255,71,0,0.1)", border: "1px solid #FF4700", color: "#FF4700", fontSize: 12, fontFamily: "monospace" }}>
          {error}
        </div>
      )}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: "rgba(180,160,140,0.55)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: "#FF4700", fontFamily: "monospace", fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}

/**
 * Decode the single_choice result_payload: a stream of (LE u32 option_id, LE u64 count) pairs.
 * The on-chain emits one pair per option in option order; we honor that order.
 * Falls back to "in optionIds order with zeros" if the payload is shorter than expected.
 */
function decodeSingleChoicePayload(
  payload: Uint8Array,
  optionIds: number[],
): Array<{ optionId: number; total: bigint }> {
  const out: Array<{ optionId: number; total: bigint }> = [];
  // Each pair is 4 + 8 = 12 bytes.
  const pairBytes = 12;
  const count = Math.min(optionIds.length, Math.floor(payload.length / pairBytes));
  for (let i = 0; i < count; i++) {
    const off = i * pairBytes;
    const id = decodeU32LE(payload, off);
    const total = decodeU64LE(payload, off + 4);
    out.push({ optionId: id, total });
  }
  // Append zero rows for any remaining options.
  if (out.length < optionIds.length) {
    for (let i = out.length; i < optionIds.length; i++) {
      out.push({ optionId: optionIds[i], total: 0n });
    }
  }
  return out;
}

function matchesChain(local: LocalTallyResult | null, tally: TallyFields | null): boolean | null {
  if (!local || !tally) return null;
  if (!local.reproducible) return null;
  const a = [...local.winners].sort();
  const b = [...tally.winnerOptionIds].sort();
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
