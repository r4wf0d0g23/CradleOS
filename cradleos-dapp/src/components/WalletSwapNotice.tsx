/**
 * WalletSwapNotice — user-facing note explaining the 2026-07-18 admin-wallet swap.
 *
 * Context: on 2026-07-18 the DGX1 host was reformatted after a kernel panic,
 * which destroyed the private key of the original CradleOS deploy/admin wallet
 * (0xc80fe7d6...). That wallet held every package UpgradeCap + the casino
 * HouseAdminCap, so we could no longer upgrade packages or administer the old
 * casino house. To restore control we republished the packages under a new
 * wallet we control (0x177583b2...) and stood up a fresh casino house.
 *
 * What this means for players:
 *   - The casino now runs on a fresh package + house (v27). The old house's
 *     bankroll is not recoverable and has been retired.
 *   - Core CradleOS packages have been republished under the new admin wallet
 *     so future upgrades are possible again.
 *
 * Dismissible via localStorage — once acknowledged it stays closed.
 */
import { useState } from "react";

const DISMISS_KEY = "cradleos:wallet-swap-notice:2026-07-18";
const NEW_ADMIN = "0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a";

export function WalletSwapNotice() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });
  if (dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div
      style={{
        background: "rgba(255,71,0,0.08)",
        border: "1px solid rgba(255,71,0,0.35)",
        borderRadius: 3,
        padding: "12px 14px",
        margin: "0 0 14px",
        color: "rgba(220,210,190,0.92)",
        fontFamily: "monospace",
        fontSize: 12,
        lineHeight: 1.55,
        position: "relative",
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#FF4700", marginBottom: 6, fontWeight: 700 }}>
        ▲ Admin Wallet Migration — 2026-07-18
      </div>
      <div>
        A hardware failure destroyed the original CradleOS admin wallet's key. To
        restore control, all CradleOS packages have been republished under a new
        admin wallet we fully control, and the casino now runs on a fresh package
        and house (v27). The previous casino house bankroll is not recoverable and
        has been retired. Existing tribe / gate / treasury state is unaffected and
        continues to run on the current live packages.
      </div>
      <div style={{ marginTop: 6, opacity: 0.75, fontSize: 11 }}>
        New admin wallet: <span style={{ color: "#FF7a3c" }}>{NEW_ADMIN.slice(0, 10)}…{NEW_ADMIN.slice(-6)}</span>
      </div>
      <button
        onClick={dismiss}
        title="Dismiss"
        style={{
          position: "absolute", top: 8, right: 10,
          background: "transparent", border: "1px solid rgba(255,71,0,0.35)",
          color: "rgba(220,210,190,0.8)", borderRadius: 3, cursor: "pointer",
          fontSize: 11, padding: "2px 8px", fontFamily: "inherit",
        }}
      >
        dismiss
      </button>
    </div>
  );
}
