// Ambient video backdrop for casino table surfaces.
//
// Renders a muted looping EVE Frontier flight video (self-hosted at
// public/media/table-bg.mp4 — 3.8MB, sourced from cdn.evefrontier.com) behind
// the table content, with a per-table tint gradient so each surface keeps its
// hue identity (green felt, mines purple, tower amber, poker olive) and text /
// cards / chips stay readable.
//
// Usage: the host container must have `position: "relative"`,
// `isolation: "isolate"` and `overflow: "hidden"` (isolation guarantees the
// negative z-index video paints above the container's own background but
// below ALL in-flow children — no child wrapping needed). Keep the existing
// felt gradient on the container: it is the graceful fallback whenever the
// video can't play (reduced-motion users, embedded webviews without codecs,
// missing asset) since this component simply renders nothing in those cases.
import React from "react";

const PREFERS_REDUCED_MOTION =
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function TableVideoBackdrop({ tint }: { tint: string }) {
  const [failed, setFailed] = React.useState(false);
  if (PREFERS_REDUCED_MOTION || failed) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none", borderRadius: "inherit", overflow: "hidden" }}>
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        src={`${import.meta.env.BASE_URL}media/table-bg.mp4`}
        onError={() => setFailed(true)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.5,
          filter: "saturate(0.9) brightness(0.8)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: tint }} />
    </div>
  );
}
