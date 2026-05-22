// MAUFooterPill.tsx
// Small fixed-position pill in the bottom-right corner showing live CradleOS MAU.
// Pulls from /telemetry/combined. Refreshes every 60s.
//
// Data sources combined here:
//   wallet_mau   — sig-verified wallet-connects in trailing 30 days
//   onchain_mau  — distinct Sui tx senders against CradleOS packages (30d)
//   combined_mau — union of the two
//
// Hover (or tap on mobile) expands to show the breakdown.

import { useEffect, useState } from "react";

type Telemetry = {
  window_days: number;
  since: string;
  wallet_mau: number;
  wallet_dau: number;
  onchain_mau: number;
  combined_mau: number;
};

const ENDPOINT = "https://keeper.reapers.shop/telemetry/combined";
const REFRESH_MS = 60_000;

export default function MAUFooterPill() {
  const [data, setData] = useState<Telemetry | null>(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const r = await fetch(ENDPOINT, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as Telemetry;
        if (!cancelled) {
          setData(j);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    };
    fetchOnce();
    const t = setInterval(fetchOnce, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // While loading or on error, render nothing — the pill is best-effort UI,
  // it shouldn't show "0 MAU" or "error" because that's a worse signal than absence.
  if (error || !data) return null;

  const mau = data.combined_mau;
  // Hide entirely until we have something to show (cold-start grace).
  if (mau <= 0) return null;

  return (
    <div
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onClick={() => setExpanded((v) => !v)}
      style={{
        position: "fixed",
        bottom: 12,
        right: 12,
        zIndex: 1000,
        background: "rgba(8, 18, 28, 0.85)",
        border: "1px solid rgba(64, 192, 255, 0.35)",
        borderRadius: 999,
        padding: expanded ? "8px 14px" : "6px 12px",
        fontFamily: "Menlo, Consolas, monospace",
        fontSize: 11,
        color: "#9fd6ff",
        backdropFilter: "blur(6px)",
        cursor: "pointer",
        transition: "padding 120ms ease",
        userSelect: "none",
        boxShadow: "0 2px 14px rgba(0, 0, 0, 0.5)",
        lineHeight: 1.35,
        maxWidth: expanded ? 280 : "auto",
      }}
      title={`CradleOS MAU — trailing ${data.window_days} days since ${data.since}`}
    >
      {expanded ? (
        <div>
          <div style={{ color: "#cfeaff", fontWeight: 600, marginBottom: 4 }}>
            ◉ CradleOS Activity ({data.window_days}d)
          </div>
          <div>combined MAU&nbsp;&nbsp;<span style={{ color: "#ffffff" }}>{data.combined_mau}</span></div>
          <div>on-chain MAU&nbsp;<span style={{ color: "#ffffff" }}>{data.onchain_mau}</span></div>
          <div>wallet MAU&nbsp;&nbsp;&nbsp;<span style={{ color: "#ffffff" }}>{data.wallet_mau}</span></div>
          <div>wallet DAU&nbsp;&nbsp;&nbsp;<span style={{ color: "#ffffff" }}>{data.wallet_dau}</span></div>
          <div style={{ marginTop: 4, fontSize: 10, opacity: 0.55 }}>since {data.since}</div>
        </div>
      ) : (
        <span>
          ◉ <span style={{ color: "#ffffff", fontWeight: 600 }}>{mau}</span> MAU
        </span>
      )}
    </div>
  );
}
