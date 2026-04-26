/**
 * PowerBlockedGlyph — small warning indicator shown beside a CcpToggle
 * when an offline structure cannot be brought online due to insufficient
 * EP budget on the parent node.
 *
 * Uses CCP warning amber (#FFB54A) rather than Martian Red to distinguish
 * 'capability blocked' from 'destructive action' — the user can fix this
 * by freeing up EP, so it's a constraint, not an error.
 *
 * Promoted from src/playground/VariantAD.tsx 2026-04-25.
 */


export interface PowerBlockedGlyphProps {
  ariaLabel: string;
  tooltip: string;
}

export function PowerBlockedGlyph({ ariaLabel, tooltip }: PowerBlockedGlyphProps) {
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      title={tooltip}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        border: "1px solid #FFB54A",
        color: "#FFB54A",
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        cursor: "help",
        background: "rgba(255,181,74,0.10)",
        flexShrink: 0,
      }}
    >!</span>
  );
}
