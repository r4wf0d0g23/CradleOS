/**
 * hud.tsx — Casino3D HUD overlay stub.
 * Renders the on-screen UI overlay for the 3D casino floor:
 * nearest station label, enter/exit buttons, recall control.
 * Minimal stub to unblock build.
 */

import type { Station, ZoneInfo } from "./stations";

interface Casino3DHudProps {
  nearStation: Station | null;
  nearZone: ZoneInfo | null;
  onEnter: () => void;
  onExit: () => void;
  onRecall: () => void;
}

export function Casino3DHud({ nearStation, nearZone, onEnter, onExit, onRecall }: Casino3DHudProps) {
  const ACCENT = "#FF4700";
  const GOLD   = "#E8B84B";
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 16 }}>
      {/* Zone label */}
      {nearZone && (
        <div style={{ pointerEvents: "none", color: `#${nearZone.accent.toString(16).padStart(6,"0")}`, fontSize: 10, letterSpacing: "0.14em", fontWeight: 700, marginBottom: 6, textShadow: "0 1px 4px #000" }}>
          {nearZone.label.toUpperCase()}
        </div>
      )}
      {/* Station prompt */}
      {nearStation && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", pointerEvents: "auto" }}>
          <div style={{ color: "#ccc", fontSize: 12, letterSpacing: "0.1em", fontWeight: 700, textShadow: "0 1px 4px #000" }}>
            {nearStation.name}
          </div>
          <button
            onClick={onEnter}
            style={{ background: ACCENT, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, padding: "6px 14px", cursor: "pointer", letterSpacing: "0.08em" }}
          >
            ENTER
          </button>
          <button
            onClick={onExit}
            style={{ background: "transparent", border: `1px solid #444`, color: "#888", fontSize: 11, padding: "6px 10px", cursor: "pointer" }}
          >
            EXIT
          </button>
        </div>
      )}
      {/* Recall button */}
      <button
        onClick={onRecall}
        style={{ pointerEvents: "auto", position: "absolute", top: 12, right: 12, background: "transparent", border: `1px solid ${GOLD}44`, color: GOLD, fontSize: 10, padding: "6px 10px", cursor: "pointer", letterSpacing: "0.06em" }}
      >
        ENTRANCE
      </button>
    </div>
  );
}
