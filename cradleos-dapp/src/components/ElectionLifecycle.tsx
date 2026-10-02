import { useEffect, useState } from "react";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { CurrentAccountSigner } from "../lib/cycleSigner";
import { rpcGetObject } from "../lib";
import { STATE, buildAdvanceToOpenTx, buildAdvanceToClosedTx, buildComputeTallyTx, buildFinalizeTx, fetchBallotsForElection } from "../lib/voting";
import type { Transaction } from "@mysten/sui/transactions";

/** Permissionless lifecycle operations; never require the creator to stay online. */
export function ElectionLifecycle({ electionId, onChanged }: { electionId: string; onChanged: () => void }) {
  const { account } = useVerifiedAccountContext();
  const kit = useDAppKit();
  const [action, setAction] = useState<"open" | "close" | "tally" | "finalize" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const e = await rpcGetObject(electionId);
        const c = await rpcGetObject("0x6");
        const now = Number(c.timestamp_ms);
        const timing = (e.schedule as { fields?: Record<string, unknown> })?.fields ?? e.schedule as Record<string, unknown>;
        let next: typeof action = null, message = "";
        if (Number(e.state) === STATE.SCHEDULED) {
          if (now >= Number(timing.opens_ms)) next = "open";
          else message = "Opens " + new Date(Number(timing.opens_ms)).toLocaleString();
        } else if (Number(e.state) === STATE.OPEN) {
          if (now >= Number(timing.closes_ms)) next = "close";
          else message = "Closes " + new Date(Number(timing.closes_ms)).toLocaleString();
        } else if (Number(e.state) === STATE.CLOSED) next = "tally";
        else if (Number(e.state) === STATE.TALLIED) {
          const t = await rpcGetObject(optionId(e.tally_id));
          const deadline = Number(t.dispute_window_closes_ms);
          if (now >= deadline) next = "finalize";
          else message = "Finalization available " + new Date(deadline).toLocaleString();
        }
        if (!stopped) { setAction(next); setNotice(message); setError(""); }
      } catch (e) { if (!stopped) { setAction(null); setError(String((e as Error).message)); } }
    };
    void load();
    const timer = setInterval(load, 30000);
    return () => { stopped = true; clearInterval(timer); };
  }, [electionId, refresh]);
  const execute = async () => {
    if (!action || !account) return;
    setBusy(true); setError("");
    try {
      let tx: Transaction;
      if (action === "open") tx = buildAdvanceToOpenTx(electionId);
      else if (action === "close") tx = buildAdvanceToClosedTx(electionId);
      else if (action === "finalize") {
        const e = await rpcGetObject(electionId);
        tx = buildFinalizeTx(electionId, optionId(e.tally_id));
      } else {
        const [e, ballots] = await Promise.all([rpcGetObject(electionId), fetchBallotsForElection(electionId)]);
        if (ballots.length !== Number(e.revealed_count)) throw new Error("Ballot indexing is incomplete. Retry after the index catches up.");
        tx = buildComputeTallyTx(electionId, ballots.map(b => b.characterId), ballots.map(b => b.encodedVote), ballots.map(b => b.weight));
      }
      await new CurrentAccountSigner(kit).signAndExecuteTransaction({ transaction: tx });
      setAction(null); setNotice("Transaction submitted. Refreshing chain state…");
      setTimeout(() => { setRefresh(x => x + 1); onChanged(); }, 16000);
    } catch (e) { setError(String((e as Error).message)); }
    finally { setBusy(false); }
  };
  return <section aria-label="Election lifecycle" style={{ marginBottom: 12 }}>
    {notice && <p>{notice}</p>}
    {action && <button disabled={busy || !account} onClick={execute}>{busy ? "Waiting for wallet…" : ({ open: "Open voting", close: "Close voting", tally: "Compute verified tally", finalize: "Finalize results" }[action])}</button>}
    {action && !account && <p>Connect your wallet to advance this election.</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
function optionId(value: unknown): string {
  if (typeof value === "string") return value;
  const o = value as { fields?: { vec?: string[] }; vec?: string[] } | null;
  const id = o?.fields?.vec?.[0] ?? o?.vec?.[0];
  if (!id) throw new Error("Canonical tally is unavailable");
  return id;
}
