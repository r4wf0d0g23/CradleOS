/**
 * One-shot CradleOS package upgrade panel.
 * Signs the upgrade tx via connected wallet (must be 0xc80f...).
 */
import { useState } from "react";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { Transaction, UpgradePolicy } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/sui/utils";

const UPGRADE_CAP = "0xe9710eaa4507ad2004bb9e395ea857447f97146abcc08dcd0fdae45617f3c5dc";
const CAP_OWNER = "0xc80fe7d6043f0c23ee30dc45c8b1036d079e11d149c4eff9ab0cbd0310803023";

// Bytecode compiled from Move sources
import BYTECODE from "../upgrade-bytecode.json";

export function UpgradePanel() {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const [status, setStatus] = useState<string>("");
  const [txDigest, setTxDigest] = useState<string>("");
  const [error, setError] = useState<string>("");

  const isOwner = account?.address?.toLowerCase() === CAP_OWNER.toLowerCase();

  const handleUpgrade = async () => {
    if (!account || !isOwner) return;
    setStatus("Building upgrade transaction...");
    setError("");
    try {
      const tx = new Transaction();

      const modules: number[][] = BYTECODE.modules.map((m: string) => [...fromBase64(m)]);
      
      // Authorize upgrade
      const ticket = tx.moveCall({
        target: "0x2::package::authorize_upgrade",
        arguments: [
          tx.object(UPGRADE_CAP),
          tx.pure.u8(UpgradePolicy.COMPATIBLE),
          tx.pure.vector("u8", BYTECODE.digest),
        ],
      });

      // Upload modules
      const receipt = tx.upgrade({
        modules,
        dependencies: BYTECODE.dependencies,
        package: BYTECODE.dependencies[0],
        ticket,
      });

      // Commit
      tx.moveCall({
        target: "0x2::package::commit_upgrade",
        arguments: [tx.object(UPGRADE_CAP), receipt],
      });

      tx.setGasBudget(500_000_000);

      setStatus("Waiting for wallet signature...");
      const signer = new CurrentAccountSigner(dAppKit);
      const result = await signer.signAndExecuteTransaction({ transaction: tx });
      const digest = (result as Record<string, unknown>)["digest"] as string ?? "unknown";
      setTxDigest(digest);
      setStatus("✅ Upgrade successful!");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("❌ Upgrade failed");
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ color: "#FF4700", fontSize: 18, fontWeight: 700 }}>CradleOS Package Upgrade</h2>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
        Upgrades the original CradleOS package to include all modules (recruiting, bounties, cargo, etc.)
        with compatible TribeVault types.
      </p>
      <div style={{ margin: "12px 0", padding: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 11 }}>
        <div><span style={{ color: "rgba(255,255,255,0.4)" }}>UpgradeCap:</span> <code>{UPGRADE_CAP.slice(0, 20)}…</code></div>
        <div><span style={{ color: "rgba(255,255,255,0.4)" }}>Required signer:</span> <code>{CAP_OWNER.slice(0, 20)}…</code></div>
        <div><span style={{ color: "rgba(255,255,255,0.4)" }}>Modules:</span> {BYTECODE.modules.length}</div>
        <div><span style={{ color: "rgba(255,255,255,0.4)" }}>Connected:</span> <code>{account?.address?.slice(0, 20) ?? "not connected"}…</code></div>
        <div><span style={{ color: isOwner ? "#00ff96" : "#ff4444" }}>{isOwner ? "✓ Authorized" : "✗ Wrong wallet — connect 0xc80f..."}</span></div>
      </div>
      {status && <div style={{ color: "#FF4700", fontSize: 12, margin: "8px 0" }}>{status}</div>}
      {error && <div style={{ color: "#ff4444", fontSize: 12, margin: "8px 0" }}>⚠ {error}</div>}
      {txDigest && <div style={{ color: "#00ff96", fontSize: 12, margin: "8px 0", fontFamily: "monospace" }}>TX: {txDigest}</div>}
      <button
        onClick={handleUpgrade}
        disabled={!isOwner || !!txDigest}
        style={{
          background: isOwner ? "#FF4700" : "rgba(255,255,255,0.1)",
          color: isOwner ? "#000" : "rgba(255,255,255,0.3)",
          border: "none", padding: "10px 24px", fontSize: 14, fontWeight: 700,
          cursor: isOwner ? "pointer" : "not-allowed", fontFamily: "inherit",
        }}
      >
        {txDigest ? "UPGRADE COMPLETE" : "SIGN & UPGRADE"}
      </button>
    </div>
  );
}
