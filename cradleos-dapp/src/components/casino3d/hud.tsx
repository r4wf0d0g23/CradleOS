import type { Station } from "./stations";

const ACCENT = "#FF4700";

interface Props {
  nearStation: Station | null;
  onEnter: () => void;
  onExit: () => void;
}

export function Casino3DHud({ nearStation, onEnter, onExit }: Props) {
  return (
    <>
      {/* Top-left: always-visible exit button */}
      <button
        onClick={onExit}
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          background: "rgba(10,10,18,0.88)",
          border: `1px solid ${ACCENT}88`,
          color: ACCENT,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.08em",
          padding: "10px 18px",
          cursor: "pointer",
          minHeight: 40,
          minWidth: 40,
          zIndex: 10,
          fontFamily: "monospace",
        }}
      >
        {"< 2D LOBBY"}
      </button>

      {/* Bottom-center: enter station button */}
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
            padding: "12px 28px",
            cursor: "pointer",
            minHeight: 44,
            zIndex: 10,
            fontFamily: "monospace",
            textTransform: "uppercase",
          }}
        >
          {"ENTER " + nearStation.name}
        </button>
      )}
    </>
  );
}
