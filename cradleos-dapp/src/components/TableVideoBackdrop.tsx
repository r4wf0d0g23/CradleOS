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
// Per-reel visual calibration: the Free Trial nebula reel is very dark footage
// (mean luma ~0.08) and needs a strong brightness lift to read through the
// tint; the signal animation is brighter and only needs mild treatment.
const REELS: { src: string; filter: string; opacity: number }[] = [
  { src: "media/table-bg.mp4", filter: "brightness(2.3) contrast(1.15) saturate(1.15)", opacity: 0.7 },
  { src: "media/table-bg-signal.webm", filter: "brightness(1.2) saturate(0.95)", opacity: 0.65 },
];

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
        key={REELS[reelIdx].src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        src={`${import.meta.env.BASE_URL}${REELS[reelIdx].src}`}
        onError={onError}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: REELS[reelIdx].opacity,
          filter: REELS[reelIdx].filter,
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: tint }} />
    </div>
  );
}
