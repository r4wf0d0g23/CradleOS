/**
 * hud.tsx — 3D Casino HUD overlay.
 *
 * Elements:
 *   - Top-left:   "< 2D LOBBY" exit button
 *   - Top-left+1: "[*] ENTRANCE" recall button (glides camera back to spawn)
 *   - Top-center: Zone label chip (nearest zone)
 *   - Bottom-center: "ENTER <name>" prompt when near a station
 */

import type { Station } from "./stations";
import type { ZoneInfo } from "./stations";

const ACCENT = "#FF4700";
const BG     = "rgba(10,10,18,0.88)";
const MONO   = "monospace";

interface Props {
  nearStation: Station | null;
  nearZone:    ZoneInfo | null;
  onEnter:     () => void;
  onExit:      () => void;
  onRecall:    () => void;
}

export function Casino3DHud({ nearStation, nearZone, onEnter, onExit, onRecall }: Props) {
  return (
    <>
      {/* ── Top-left controls ─────────────────────────────────────────────── */}
      <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 8, zIndex: 10 }}>
        {/* Exit to 2D lobby */}
        <button
          onClick={onExit}
          style={{
            background: BG,
            border: `1px solid ${ACCENT}88`,
            color: ACCENT,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.08em",
            padding: "10px 18px",
            cursor: "pointer",
            minHeight: 40,
            fontFamily: MONO,
          }}
        >
          {"< 2D LOBBY"}
        </button>

        {/* Recall to entrance */}
        <button
          onClick={onRecall}
          style={{
            background: BG,
            border: `1px solid ${ACCENT}55`,
            color: "#e8b84b",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.08em",
            padding: "10px 18px",
            cursor: "pointer",
            minHeight: 40,
            fontFamily: MONO,
          }}
          title="Return to entrance"
        >
          {"[*] ENTRANCE"}
        </button>
      </div>

      {/* ── Top-center: zone label chip ───────────────────────────────────── */}
      {nearZone !== null && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            background: BG,
            border: `1px solid ${nearZone.accent ? "#" + nearZone.accent.toString(16).padStart(6, "0") : ACCENT}88`,
            color: nearZone.accent
              ? "#" + nearZone.accent.toString(16).padStart(6, "0")
              : "#e8b84b",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.14em",
            padding: "8px 22px",
            fontFamily: MONO,
            whiteSpace: "nowrap",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          {nearZone.label + " ZONE"}
        </div>
      )}

      {/* ── Bottom-center: enter station prompt ───────────────────────────── */}
      {nearStation !== null && (
        <button
          onClick={onEnter}
          style={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: ACCENT,
            border: "none",
            color: "#0a0a12",
            fontSize: 14,
            fontWeight: 900,
            letterSpacing: "0.1em",
            padding: "12px 32px",
            cursor: "pointer",
            minHeight: 44,
            fontFamily: MONO,
            textTransform: "uppercase",
            zIndex: 10,
          }}
        >
          {"ENTER " + nearStation.name}
        </button>
      )}
    </>
  );
}
