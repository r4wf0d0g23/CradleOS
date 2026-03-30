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
  switchServerAndReload,
} from "../constants";

type MismatchState = "checking" | "ok" | "wrong-server" | "not-found" | "error";

const OTHER_ENV: "stillness" | "utopia" = SERVER_ENV === "stillness" ? "utopia" : "stillness";
const OTHER_SERVER_LABEL = SERVER_ENV === "stillness" ? "UTOPIA (Hackathon)" : "STILLNESS (Live)";
const OTHER_WORLD_PKG    = SERVER_ENV === "stillness" ? WORLD_PKG_UTOPIA : WORLD_PKG_STILLNESS;

/** Check if a wallet owns a PlayerProfile from a given world package. */
async function hasPlayerProfile(walletAddress: string, pkg: string): Promise<boolean> {
  const res = await fetch(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "suix_getOwnedObjects",
      params: [
        walletAddress,
        { filter: { StructType: `${pkg}::character::PlayerProfile` }, options: { showType: true } },
        null, 5,
      ],
    }),
  });
  const d = await res.json();
  const objs: Array<unknown> = d?.result?.data ?? [];
  return objs.length > 0;
}

/** Scan CharacterCreatedEvent for the wallet address (fallback for zkLogin/sponsored wallets). */
async function hasCharacterEvent(walletAddress: string, pkg: string): Promise<boolean> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [
          { MoveEventType: `${pkg}::character::CharacterCreatedEvent` },
          null, 50, false,
        ],
      }),
    });
    const json = await res.json() as {
      result: { data: Array<{ parsedJson: { character_address: string } }> }
    };
    return json.result?.data?.some(
      e => e.parsedJson?.character_address?.toLowerCase() === walletAddress.toLowerCase()
    ) ?? false;
  } catch {
    return false;
  }
}

async function checkCharacterServer(walletAddress: string): Promise<MismatchState> {
  try {
    const { WORLD_PKG } = await import("../constants");
    // Try PlayerProfile first (fast), then fall back to event scan (covers zkLogin/sponsored chars)
    const [profileThis, profileOther] = await Promise.all([
      hasPlayerProfile(walletAddress, WORLD_PKG),
      hasPlayerProfile(walletAddress, OTHER_WORLD_PKG),
    ]);
    if (profileThis)  return "ok";
    if (profileOther) return "wrong-server";

    // Fallback: scan events (covers characters where PlayerProfile went to a different address)
    const [eventThis, eventOther] = await Promise.all([
      hasCharacterEvent(walletAddress, WORLD_PKG),
      hasCharacterEvent(walletAddress, OTHER_WORLD_PKG),
    ]);
    if (eventThis)  return "ok";
    if (eventOther) return "wrong-server";

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
              {" "}for this wallet. If you just created a character, try refreshing — it may take a moment to index. Make sure your EVE Vault wallet address matches the address used to create the character in-game.
            </>
          )}
        </div>
        {isWrong && (
          <button
            onClick={() => switchServerAndReload(OTHER_ENV)}
            style={{
              marginTop: "8px", padding: "6px 16px",
              background: "rgba(255,71,0,0.15)", border: "1px solid rgba(255,71,0,0.5)",
              color: "#FF4700", cursor: "pointer", fontSize: "11px",
              fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
              fontFamily: "inherit",
            }}
          >
            Switch to {OTHER_SERVER_LABEL}
          </button>
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
