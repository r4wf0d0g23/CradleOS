// Ambient video backdrop for casino table surfaces.
//
// Renders one of the muted looping EVE Frontier reels (self-hosted in
// public/media/, sourced from cdn.evefrontier.com) behind the table content,
// picked at random per mount — tables feel alive and slightly different every
// visit. A per-table tint gradient keeps each surface's hue identity (green
// felt, mines purple, tower amber, poker olive) and text / cards / chips
// readable.
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

// Ambient reel pool — add new self-hosted clips here and they enter rotation.
const REELS = ["media/table-bg.mp4", "media/table-bg-signal.webm"];

export function TableVideoBackdrop({ tint }: { tint: string }) {
  const [failed, setFailed] = React.useState(false);
  // Random pick, stable for the lifetime of this mount. If the chosen reel
  // fails to play we fall through to the next before giving up entirely.
  const [reelIdx, setReelIdx] = React.useState(() => Math.floor(Math.random() * REELS.length));
  const [attempts, setAttempts] = React.useState(0);
  if (PREFERS_REDUCED_MOTION || failed) return null;
  const onError = () => {
    if (attempts + 1 >= REELS.length) { setFailed(true); return; }
    setAttempts(attempts + 1);
    setReelIdx((reelIdx + 1) % REELS.length);
  };
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none", borderRadius: "inherit", overflow: "hidden" }}>
      <video
        key={REELS[reelIdx]}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        src={`${import.meta.env.BASE_URL}${REELS[reelIdx]}`}
        onError={onError}
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
