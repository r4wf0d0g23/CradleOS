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
      boxShadow:"0 2px 14px rgba(0,0,0,0.5)", lineHeight:1.5, maxWidth:"min(310px, calc(100vw - 24px))" }}>
      <button type="button" aria-expanded={expanded} aria-controls="cradleos-activity-details"
        onClick={() => setExpanded(v => !v)} style={{background:"none",border:0,color:"inherit",font:"inherit",padding:"10px 14px",minHeight:44,cursor:"pointer",textAlign:"left"}}
        title="CradleOS activity — unique verified wallets, not visitors or game rounds">
        ◉ <span style={{color:"#fff"}}>{label}</span>
      </button>
      {expanded && <div id="cradleos-activity-details" style={{padding:"0 14px 12px"}}>
        <strong style={{color:"#cfeaff"}}>CradleOS activity</strong>
        {data ? <>
          <div>Unique wallets (30d): {total ?? "unavailable"}</div>
          <div>Successful on-chain callers: {data.onchain_mau ?? "unavailable"}</div>
          <div>Verified wallet sign-ins: {data.wallet_mau}</div>
          <div>Sign-ins today (UTC): {data.wallet_dau}</div>
          <p style={{margin:"8px 0"}}>Each wallet counts once across both sources. Not people, site visits, online users or game rounds.</p>
          <div style={{fontSize:10}}>Current-cycle contracts only. {data.onchain_indexed_at ? `Chain checked through ${new Date(data.onchain_indexed_at).toLocaleString()}.` : "Chain scan not available."}</div>
          {data.onchain_status !== "current" && <p style={{color:"#ffd08a",margin:"6px 0"}}>Chain data is {data.onchain_status}. No combined total until it is current.</p>}
          <p style={{fontSize:10,margin:"6px 0 0"}}>Verified sign-in tracking restarted {new Date(data.wallet_coverage_since).toLocaleDateString()}. Earlier unverified records are excluded; historical site usage cannot be reconstructed.</p>
        </> : <p>{error ? "Could not refresh activity. No cached count is shown. Retrying automatically." : "Loading verified wallet activity…"}</p>}
      </div>}
    </div>
  );
}
