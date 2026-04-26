/**
 * BarChip — a labeled segmented bar with a trailing right-aligned value.
 *
 * Used for fuel + EP indicators in the CCP-style node headers:
 *
 *   FUEL ┃▓▓▓░░░░░░░░░░░░░░░  9% 308 u
 *
 * Promoted from src/playground/VariantAD.tsx 2026-04-25.
 */

import { Segmented } from "./Segmented";

const N40 = "rgba(250,250,229,0.40)";
const N60 = "rgba(250,250,229,0.60)";
const N80 = "rgba(250,250,229,0.80)";

export interface BarChipProps {
  /** Short ALL-CAPS label, e.g. "FUEL" or "EP". */
  label: string;
  /** 0..100 percentage that fills the segmented bar. */
  pct: number;
  /** Tail text rendered right of the bar — typically "X u" or "300/1000". */
  right: string;
  /** Color used for the filled segments. */
  color: string;
  /** Number of segments. Defaults to 20 (the canonical CCP density). */
  segments?: number;
  /** Bar width in px. Defaults to 100. */
  width?: number;
}

export function BarChip({ label, pct, right, color, segments = 20, width = 100 }: BarChipProps) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          fontSize: 10,
          color: N60,
          letterSpacing: "0.10em",
          fontWeight: 700,
        }}
      >{label}</span>
      <Segmented value={pct} color={color} segments={segments} width={width} />
      <span
        style={{
          fontSize: 10,
          color: N80,
          fontVariantNumeric: "tabular-nums",
        }}
      >{Math.round(pct)}%</span>
      <span
        style={{
          fontSize: 10,
          color: N40,
          fontVariantNumeric: "tabular-nums",
        }}
      >{right}</span>
    </span>
  );
}
