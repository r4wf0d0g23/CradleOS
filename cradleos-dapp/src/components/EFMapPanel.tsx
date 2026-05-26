// EFMapPanel — embedded ef-map.com starmap
//
// Wraps the canonical EF-Map (https://ef-map.com) /embed entry point. Per their
// llms.txt (fetched 2026-05-26), /embed is the only route that allows iframing —
// all other paths set X-Frame-Options: DENY. The embed strips UI chrome and
// shows the 3D star map; users can click "Open on EF Map" for the full app.
//
// EF-Map is the authoritative source for EVE Frontier routing math (WASM
// Dijkstra, in-browser SQLite, fuel/temperature physics). We embed it rather
// than reimplement — see MEMORY.md "ef-map.com is canonical physics source".

import { useRef, useState } from "react";

const EMBED_BASE = "https://ef-map.com/embed";
const FULL_BASE  = "https://ef-map.com";

// Default landing view: routing card visible, no preset systems, top-down-ish.
const DEFAULT_SRC = `${EMBED_BASE}?zoom=4000&angle=30&color=accent`;

export function EFMapPanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "75vh",
        minHeight: 480,
        border: "1px solid rgba(255,71,0,0.12)",
        background: "rgba(8,5,2,0.6)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── Header strip ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          borderBottom: "1px solid rgba(255,71,0,0.14)",
          background: "rgba(0,0,0,0.55)",
          fontSize: 10,
          letterSpacing: "0.12em",
          fontFamily: "monospace",
          color: "rgba(250,250,229,0.72)",
          flexShrink: 0,
        }}
      >
        <span style={{ textTransform: "uppercase" }}>
          ⬡ EF-MAP · embedded starmap
        </span>
        <a
          href={FULL_BASE}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#FF4700",
            textDecoration: "none",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            border: "1px solid rgba(255,71,0,0.4)",
            padding: "2px 8px",
            background: "rgba(255,71,0,0.05)",
          }}
          title="Open ef-map.com in a new tab for full UI"
        >
          ↗ open full
        </a>
      </div>

      {/* ── Iframe ────────────────────────────────────────────────────────── */}
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        {!loaded && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(250,250,229,0.45)",
              fontFamily: "monospace",
              fontSize: 11,
              letterSpacing: "0.1em",
              pointerEvents: "none",
            }}
          >
            loading ef-map…
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={DEFAULT_SRC}
          title="EF-Map embedded starmap"
          loading="lazy"
          allow="fullscreen"
          allowFullScreen
          onLoad={() => setLoaded(true)}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
            background: "#000",
          }}
        />
      </div>

      {/* ── Footer attribution ────────────────────────────────────────────── */}
      <div
        style={{
          padding: "4px 12px",
          borderTop: "1px solid rgba(255,71,0,0.08)",
          background: "rgba(0,0,0,0.55)",
          fontSize: 9,
          color: "rgba(180,160,140,0.5)",
          fontFamily: "monospace",
          letterSpacing: "0.06em",
          flexShrink: 0,
        }}
      >
        powered by <a
          href={FULL_BASE}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "rgba(255,71,0,0.65)", textDecoration: "none" }}
        >ef-map.com</a> — community-built EVE Frontier starmap
      </div>
    </div>
  );
}

export default EFMapPanel;
