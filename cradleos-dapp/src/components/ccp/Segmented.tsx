/**
 * Segmented — discrete-cell progress bar for CCP UIs.
 *
 * Renders a row of N small rectangles, the first K filled with the supplied
 * color and the rest faintly visible at neutral-10. The segmented look is
 * canonical CCP — fluent bars feel out of place against the rest of the
 * design system.
 *
 * Promoted from src/playground/VariantAD.tsx 2026-04-25.
 */

const N10 = "rgba(250,250,229,0.10)";

export interface SegmentedProps {
  /** Filled portion as 0..100 percent. */
  value: number;
  /** Color used for the filled segments. */
  color: string;
  /** Total number of segments to draw. */
  segments: number;
  /** Total bar width in px. Segment widths are calculated to fit. */
  width: number;
  /** Bar height in px. Defaults to 8. */
  height?: number;
}

export function Segmented({ value, color, segments, width, height = 8 }: SegmentedProps) {
  const filled = Math.round((value / 100) * segments);
  const segGap = 1;
  const segWidth = (width - segGap * (segments - 1)) / segments;
  return (
    <div style={{ display: "flex", gap: segGap, height, width }}>
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          style={{
            width: segWidth,
            height: "100%",
            background: i < filled ? color : N10,
          }}
        />
      ))}
    </div>
  );
}
