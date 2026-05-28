/**
 * VotingPanel — top-level voting hub. Three tabs:
 *   1. Active   — elections currently open (or scheduled to open soon) the
 *                 connected wallet might be eligible to vote in
 *   2. Create   — multi-step ElectionCreatorWizard
 *   3. My       — elections the connected wallet created (drafts, scheduled,
 *                 open, closed, finalized)
 *
 * Plus an inline router into VoterBallotUI and ElectionResultsPage when the
 * user clicks into a specific election.
 *
 * Webview-ban: NO native <select>, NO window.* dialogs. Tab strip is a
 * simple button group; election cards open inline (no portal needed).
 *
 * If the cradleos_voting Move package is not yet published (constants.ts
 * placeholder), this panel renders an explanatory banner and disables
 * write actions instead of blowing up.
 */
import { useState, useEffect, useMemo } from "react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import {
  CRADLEOS_VOTING_AVAILABLE,
  CRADLEOS_VOTING_PKG,
  STATE,
  STATE_LABELS,
  ELIGIBILITY_OPTIONS,
  WEIGHT_OPTIONS,
  METHOD_OPTIONS,
  PRIVACY_OPTIONS,
  fetchAllElections,
  type ElectionSummary,
} from "../lib/voting";
import { ElectionCreatorWizard } from "./ElectionCreatorWizard";
import { VoterBallotUI } from "./VoterBallotUI";
import { ElectionResultsPage } from "./ElectionResultsPage";
import { rpcGetObject } from "../lib";

type Tab = "active" | "create" | "my";
type Detail = { mode: "vote" | "results"; electionId: string } | null;

const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  background: active ? "rgba(255,71,0,0.15)" : "transparent",
  border: active ? "1px solid #FF4700" : "1px solid rgba(255,71,0,0.18)",
  color: active ? "#FF4700" : "rgba(220,210,190,0.65)",
  padding: "8px 16px",
  fontSize: 11,
  fontWeight: active ? 700 : 500,
  letterSpacing: "0.10em",
  textTransform: "uppercase",
  cursor: "pointer",
  fontFamily: "inherit",
});

export function VotingPanel() {
  const { account } = useVerifiedAccountContext();
  const [tab, setTab] = useState<Tab>("active");
  const [detail, setDetail] = useState<Detail>(null);
  const [elections, setElections] = useState<ElectionSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [statesByElection, setStatesByElection] = useState<Map<string, number>>(new Map());

  // Fetch elections list (across all packages). Mandatory fetchEventAcrossPackages
  // pattern lives inside fetchAllElections — see lib/voting.ts.
  const refresh = async () => {
    if (!CRADLEOS_VOTING_AVAILABLE) { setElections([]); return; }
    setLoading(true);
    try {
      const all = await fetchAllElections();
      setElections(all);
      // Fan-out: fetch each election's current state. Cap at 50 to avoid
      // wasted RPC during the first browse — UI can re-fetch on click.
      const ids = all.slice(0, 50).map((e) => e.electionId);
      const stateMap = new Map<string, number>();
      await Promise.all(ids.map(async (id) => {
        try {
          const raw = await rpcGetObject(id);
          const content = (raw as { data?: { content?: { fields?: Record<string, unknown> } } })?.data?.content?.fields;
          if (content) stateMap.set(id, Number(content.state ?? 0));
        } catch { /* ignore */ }
      }));
      setStatesByElection(stateMap);
    } catch (e) {
      console.warn("[VotingPanel] fetchAllElections failed", e);
      setElections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [account?.address]);

  // Drill-down view takes over the whole panel area.
  if (detail) {
    if (detail.mode === "vote") {
      return (
        <div>
          <VoterBallotUI electionId={detail.electionId} onBack={() => setDetail(null)} onCast={refresh} />
        </div>
      );
    }
    return (
      <div>
        <ElectionResultsPage electionId={detail.electionId} onBack={() => setDetail(null)} />
      </div>
    );
  }

  return (
    <div>
      {/* Package-not-published banner */}
      {!CRADLEOS_VOTING_AVAILABLE && (
        <div style={{
          marginBottom: 14, padding: 12,
          background: "rgba(255,200,0,0.06)",
          border: "1px solid rgba(255,200,0,0.4)",
          fontSize: 12, color: "#ffcc00",
        }}>
          <strong>Voting package not yet published.</strong> The CradleOS Voting Move package is
          built and the dApp UI is wired, but the package hasn't been published to chain yet.
          Set <code>CRADLEOS_VOTING_PKG</code> and <code>CRADLEOS_VOTING_REGISTRY</code> in
          <code> constants.ts</code> after <code>sui client publish</code> lands.
        </div>
      )}

      {/* Tab strip */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <button onClick={() => setTab("active")} style={tabBtnStyle(tab === "active")}>
          Active elections
        </button>
        <button onClick={() => setTab("create")} style={tabBtnStyle(tab === "create")}>
          + Create election
        </button>
        <button onClick={() => setTab("my")} style={tabBtnStyle(tab === "my")}>
          My elections
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={refresh} disabled={loading || !CRADLEOS_VOTING_AVAILABLE} style={{
          background: "transparent", border: "1px solid rgba(255,71,0,0.3)",
          color: loading ? "rgba(180,160,140,0.4)" : "#FF4700",
          padding: "6px 10px", fontSize: 10, cursor: loading ? "wait" : "pointer",
          fontFamily: "inherit", letterSpacing: "0.08em", textTransform: "uppercase",
        }}>{loading ? "Refreshing…" : "↻ Refresh"}</button>
      </div>

      {/* Content */}
      {tab === "create" && (
        <ElectionCreatorWizard
          onCreated={(id) => { setTab("my"); refresh(); setDetail({ mode: "vote", electionId: id }); }}
          onCancel={() => setTab("active")}
        />
      )}

      {tab === "active" && (
        <ElectionList
          mode="active"
          elections={elections}
          statesByElection={statesByElection}
          loading={loading}
          walletAddress={account?.address}
          onVote={(id) => setDetail({ mode: "vote", electionId: id })}
          onResults={(id) => setDetail({ mode: "results", electionId: id })}
        />
      )}

      {tab === "my" && (
        <ElectionList
          mode="my"
          elections={elections}
          statesByElection={statesByElection}
          loading={loading}
          walletAddress={account?.address}
          onVote={(id) => setDetail({ mode: "vote", electionId: id })}
          onResults={(id) => setDetail({ mode: "results", electionId: id })}
        />
      )}

      {/* Footer attribution */}
      <div style={{ marginTop: 18, fontSize: 9, color: "rgba(180,160,140,0.4)", letterSpacing: "0.08em", fontFamily: "monospace" }}>
        Package: {CRADLEOS_VOTING_PKG.slice(0, 18)}…  ·  Generic on-chain voting primitive  ·  Reproducible tally
      </div>
    </div>
  );
}

// ── Election list ───────────────────────────────────────────────────────────
function ElectionList({
  mode,
  elections,
  statesByElection,
  loading,
  walletAddress,
  onVote,
  onResults,
}: {
  mode: "active" | "my";
  elections: ElectionSummary[] | null;
  statesByElection: Map<string, number>;
  loading: boolean;
  walletAddress: string | undefined;
  onVote: (id: string) => void;
  onResults: (id: string) => void;
}) {
  const filtered = useMemo(() => {
    if (!elections) return null;
    if (mode === "my") {
      if (!walletAddress) return [];
      return elections.filter((e) => e.creator.toLowerCase() === walletAddress.toLowerCase());
    }
    // active = anything not in CANCELED or FINALIZED state
    return elections.filter((e) => {
      const st = statesByElection.get(e.electionId);
      // If state is unknown (RPC failed or rate-limited), default to "show" so
      // we don't accidentally hide live elections.
      if (st === undefined) return true;
      return st !== STATE.CANCELED && st !== STATE.FINALIZED;
    });
  }, [elections, mode, walletAddress, statesByElection]);

  if (loading && !elections) {
    return (
      <div style={{ padding: 20, color: "rgba(180,160,140,0.55)", fontSize: 12, fontFamily: "monospace", textAlign: "center" }}>
        Loading elections…
      </div>
    );
  }

  if (!filtered || filtered.length === 0) {
    return (
      <div style={{
        padding: 30, textAlign: "center", color: "rgba(180,160,140,0.55)", fontSize: 12,
        border: "1px dashed rgba(255,71,0,0.18)",
      }}>
        {mode === "my"
          ? "You have not created any elections yet. Switch to 'Create election' to publish your first."
          : "No active elections found. Be the first to create one."}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {filtered.map((e) => (
        <ElectionCard
          key={e.electionId}
          summary={e}
          state={statesByElection.get(e.electionId) ?? -1}
          onVote={() => onVote(e.electionId)}
          onResults={() => onResults(e.electionId)}
        />
      ))}
    </div>
  );
}

function ElectionCard({
  summary,
  state,
  onVote,
  onResults,
}: {
  summary: ElectionSummary;
  state: number;
  onVote: () => void;
  onResults: () => void;
}) {
  const stateLabel = state >= 0 ? (STATE_LABELS[state] ?? "?") : "—";
  const stateColor = state === STATE.OPEN ? "#00ff96"
    : state === STATE.SCHEDULED ? "#ffcc00"
    : state === STATE.FINALIZED ? "#a78bfa"
    : "rgba(180,160,140,0.7)";
  return (
    <div style={{
      border: "1px solid rgba(255,71,0,0.18)",
      background: "rgba(8,5,2,0.55)",
      padding: 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#FF4700", letterSpacing: "0.02em" }}>
            {summary.title || summary.electionId.slice(0, 14) + "…"}
          </div>
          <div style={{ marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap", fontSize: 9, color: "rgba(180,160,140,0.6)", letterSpacing: "0.08em" }}>
            <span style={{ color: stateColor, fontWeight: 700 }}>{stateLabel}</span>
            <span>·</span>
            <span>METHOD: {pickShort(METHOD_OPTIONS, summary.methodKind)}</span>
            <span>·</span>
            <span>ELIG: {pickShort(ELIGIBILITY_OPTIONS, summary.eligibilityKind)}</span>
            <span>·</span>
            <span>WEIGHT: {pickShort(WEIGHT_OPTIONS, summary.weightKind)}</span>
            <span>·</span>
            <span>PRIV: {pickShort(PRIVACY_OPTIONS, summary.privacyKind)}</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 9, color: "rgba(180,160,140,0.45)", fontFamily: "monospace" }}>
            {summary.electionId}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {state === STATE.OPEN ? (
            <button onClick={onVote} style={cardBtnStyle("primary")}>Vote →</button>
          ) : state >= STATE.TALLIED ? (
            <button onClick={onResults} style={cardBtnStyle("primary")}>Results →</button>
          ) : state === STATE.CLOSED ? (
            <button onClick={onResults} style={cardBtnStyle("primary")}>View →</button>
          ) : (
            <button onClick={onResults} style={cardBtnStyle("secondary")}>Details →</button>
          )}
        </div>
      </div>
    </div>
  );
}

function cardBtnStyle(variant: "primary" | "secondary"): React.CSSProperties {
  if (variant === "primary") {
    return {
      background: "#FF4700", border: "1px solid #FF4700",
      color: "#000", padding: "6px 12px", fontSize: 10,
      cursor: "pointer", fontFamily: "inherit",
      letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
    };
  }
  return {
    background: "transparent", border: "1px solid rgba(255,71,0,0.4)",
    color: "#FF4700", padding: "6px 12px", fontSize: 10,
    cursor: "pointer", fontFamily: "inherit",
    letterSpacing: "0.08em", textTransform: "uppercase",
  };
}

function pickShort(options: Array<{ value: number; title: string }>, v: number): string {
  const t = options.find((o) => o.value === v)?.title ?? `kind ${v}`;
  // Compact label: take first word.
  return t.split(" ")[0].replace(/—.*$/, "").trim();
}
