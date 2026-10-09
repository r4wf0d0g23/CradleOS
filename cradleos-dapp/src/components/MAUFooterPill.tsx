import { useEffect, useState } from "react";
import { parseActivity, type ActivityTelemetry } from "../lib/activityTelemetry";

const ENDPOINT = "https://keeper.reapers.shop/telemetry/combined";

export default function MAUFooterPill() {
  const [data, setData] = useState<ActivityTelemetry | null>(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let active: AbortController | null = null;
    const refresh = async () => {
      if (active || stopped) return;
      clearTimeout(timer);
      active = new AbortController();
      const timeout = setTimeout(() => active?.abort(), 12_000);
      try {
        const response = await fetch(ENDPOINT, { cache: "no-store", signal: active.signal });
        if (!response.ok) throw new Error("Activity unavailable");
        const next = parseActivity(await response.json());
        if (!stopped) { setData(next); setError(false); }
      } catch {
        if (!stopped) { setData(null); setError(true); }
      } finally {
        clearTimeout(timeout);
        active = null;
        if (!stopped) timer = setTimeout(refresh, 60_000);
      }
    };
    const visible = () => { if (!document.hidden) void refresh(); };
    void refresh();
    document.addEventListener("visibilitychange", visible);
    return () => { stopped = true; clearTimeout(timer); active?.abort(); document.removeEventListener("visibilitychange", visible); };
  }, []);

  const total = data?.combined_mau;
  const label = error ? "Activity unavailable" : !data ? "Activity loading…" : total === null ? "Activity incomplete" : `${total} verified wallets · 30d`;
  return (
    <div data-activity-counter style={{ position:"fixed", bottom:12, right:12, zIndex:1000,
      background:"rgba(8,18,28,0.95)", border:"1px solid rgba(64,192,255,0.35)", borderRadius:expanded ? 14 : 999,
      fontFamily:"Menlo,Consolas,monospace", fontSize:11, color:"#9fd6ff", backdropFilter:"blur(6px)",
      boxShadow:"0 2px 14px rgba(0,0,0,0.5)", lineHeight:1.5, maxWidth:"min(250px, calc(100vw - 24px))" }}>
      <button type="button" aria-expanded={expanded} aria-controls="cradleos-activity-details"
        onClick={() => setExpanded(v => !v)} style={{background:"none",border:0,color:"inherit",font:"inherit",padding:"10px 14px",minHeight:44,cursor:"pointer",textAlign:"left"}}
        title="Verified wallet activity">
        ◉ <span style={{color:"#fff"}}>{label}</span>
      </button>
      {expanded && <div id="cradleos-activity-details" style={{padding:"0 14px 12px"}}>
        {data && <dl style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"4px 16px",margin:0}}>
          <dt>On-chain · 30d</dt><dd style={{margin:0}}>{data.onchain_mau ?? "—"}</dd>
          <dt>Sign-ins · 30d</dt><dd style={{margin:0}}>{data.wallet_mau}</dd>
          <dt>Today · UTC</dt><dd style={{margin:0}}>{data.wallet_dau}</dd>
          <dt>Sign-ins since</dt><dd style={{margin:0}}>{new Date(data.wallet_coverage_since).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</dd>
          <dt>Chain updated</dt><dd style={{margin:0}}>{data.onchain_indexed_at ? new Date(data.onchain_indexed_at).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"}) : "—"}</dd>
          {data.onchain_status !== "current" && <><dt>Chain status</dt><dd style={{margin:0}}>{data.onchain_status === "stale" ? "Stale" : "Unavailable"}</dd></>}
        </dl>}
      </div>}
    </div>
  );
}
