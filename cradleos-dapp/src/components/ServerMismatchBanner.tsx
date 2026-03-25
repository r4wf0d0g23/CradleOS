// ServerMismatchBanner.tsx
// Detects when the connected wallet's character was registered on a different
// EVE Frontier server than the one this dApp is configured for.
// Shown prominently so players don't wonder why their data is missing.

import { useEffect, useState } from "react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import {
  SERVER_ENV, SERVER_LABEL,
  WORLD_PKG_UTOPIA, WORLD_PKG_STILLNESS,
  SUI_TESTNET_RPC,
} from "../constants";

type MismatchState = "checking" | "ok" | "wrong-server" | "not-found" | "error";

const OTHER_SERVER_LABEL = SERVER_ENV === "stillness" ? "UTOPIA (Hackathon)" : "STILLNESS (Live)";
const OTHER_WORLD_PKG    = SERVER_ENV === "stillness" ? WORLD_PKG_UTOPIA : WORLD_PKG_STILLNESS;
const SWITCH_INSTRUCTIONS = SERVER_ENV === "stillness"
  ? "Open EVE Vault → Settings → switch to Stillness (Live Server)"
  : "Open EVE Vault → Settings → switch to Utopia (Hackathon Server)";

async function checkCharacterServer(walletAddress: string): Promise<MismatchState> {
  // Query owned objects filtered by package — finds Character objects regardless of event count
  const query = (pkg: string) => fetch(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "suix_getOwnedObjects",
      params: [
        walletAddress,
        { filter: { Package: pkg }, options: { showType: true } },
        null, 5,
      ],
    }),
  }).then(r => r.json()).then(d => {
    const objs: Array<{ data?: { type?: string } }> = d?.result?.data ?? [];
    return objs.length > 0;
  });

  try {
    const { WORLD_PKG } = await import("../constants");
    const [onThis, onOther] = await Promise.all([
      query(WORLD_PKG),
      query(OTHER_WORLD_PKG),
    ]);
    if (onThis)  return "ok";
    if (onOther) return "wrong-server";
    return "not-found";
  } catch {
    return "error";
  }
}

export function ServerMismatchBanner() {
  const { account } = useVerifiedAccountContext();
  const [state, setState] = useState<MismatchState>("checking");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!account?.address) {
      setState("checking");
      return;
    }
    setState("checking");
    checkCharacterServer(account.address).then(setState);
  }, [account?.address]);

  // Never show banner when: no wallet, still checking, all good, user dismissed
  if (!account || state === "checking" || state === "ok" || dismissed) return null;

  const isWrong  = state === "wrong-server";
  // notFound: no character on either server — likely new player or wrong wallet

  return (
    <div style={{
      background: isWrong ? "rgba(255,30,30,0.10)" : "rgba(255,140,0,0.08)",
      border: `1px solid ${isWrong ? "rgba(255,50,50,0.5)" : "rgba(255,140,0,0.45)"}`,
      padding: "10px 16px",
      display: "flex", alignItems: "flex-start", gap: "12px",
      flexWrap: "wrap",
      position: "relative",
    }}>
      <div style={{ fontSize: "18px", lineHeight: 1.2, flexShrink: 0 }}>
        {isWrong ? "⚠" : "ℹ"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "11px", fontWeight: 800, letterSpacing: "0.14em",
          textTransform: "uppercase", color: isWrong ? "#ff4444" : "#ffa020",
          marginBottom: "4px",
        }}>
          {isWrong ? "Wrong Server" : "Character Not Found"}
        </div>
        <div style={{ fontSize: "12px", color: "#ccc", lineHeight: 1.5 }}>
          {isWrong ? (
            <>
              Your EVE Vault is configured for{" "}
              <strong style={{ color: "#fff" }}>{OTHER_SERVER_LABEL}</strong>
              {" "}but this dApp connects to{" "}
              <strong style={{ color: "#FF4700" }}>{SERVER_LABEL}</strong>.
              {" "}Your characters and structures won't load correctly.
            </>
          ) : (
            <>
              No character found on{" "}
              <strong style={{ color: "#FF4700" }}>{SERVER_LABEL}</strong>
              {" "}for this wallet. You may need to create a character in-game first.
            </>
          )}
        </div>
        {isWrong && (
          <div style={{
            marginTop: "6px", fontSize: "11px",
            color: "rgba(255,160,32,0.85)", fontFamily: "monospace",
            letterSpacing: "0.05em",
          }}>
            Fix: {SWITCH_INSTRUCTIONS}
          </div>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.4)", fontSize: "16px",
          padding: "0 4px", flexShrink: 0, alignSelf: "flex-start",
        }}
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
