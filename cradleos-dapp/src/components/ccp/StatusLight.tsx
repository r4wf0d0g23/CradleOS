/**
 * StatusLight — glowing instrument-panel indicator LED.
 *
 * Green when on, Martian Red when off. Subtle dual-layer glow + an
 * inner highlight so it reads as a real bulb rather than a flat dot.
 * Pulses slowly when on (1.6s cycle) so the eye picks up live state
 * across a long list of structures even in peripheral vision.
 *
 * Pulse keyframes are defined in src/styles/ccp-tokens.css under
 * @keyframes ccp-led-pulse-on / ccp-led-pulse-off, with a
 * prefers-reduced-motion override.
 *
 * Promoted from src/playground/VariantAD.tsx 2026-04-25.
 */
import React from "react";

export interface StatusLightProps {
  on: boolean;
  size?: number;
  ariaLabel?: string;
}

export function StatusLight({ on, size = 12, ariaLabel }: StatusLightProps) {
  const ON_CORE  = "#5DFF9A";
  const ON_GLOW  = "rgba(93,255,154,0.55)";
  const ON_HALO  = "rgba(93,255,154,0.18)";
  const OFF_CORE = "#FF2800";
  const OFF_GLOW = "rgba(255,40,0,0.45)";
  const OFF_HALO = "rgba(255,40,0,0.14)";
  const core = on ? ON_CORE  : OFF_CORE;
  const glow = on ? ON_GLOW  : OFF_GLOW;
  const halo = on ? ON_HALO  : OFF_HALO;

  const style: React.CSSProperties = {
    display: "inline-block",
    width: size,
    height: size,
    borderRadius: "50%",
    background: `radial-gradient(circle at 35% 30%, ${core} 0%, ${core} 35%, ${glow} 70%, ${halo} 100%)`,
    boxShadow: `
      0 0 ${size * 0.6}px ${glow},
      0 0 ${size * 1.4}px ${halo},
      inset 0 0 ${Math.max(2, size * 0.3)}px rgba(255,255,255,0.35)
    `,
    animation: on
      ? "ccp-led-pulse-on 1.6s ease-in-out infinite"
      : "ccp-led-pulse-off 2.4s ease-in-out infinite",
    flexShrink: 0,
  };

  return (
    <span
      role="img"
      aria-label={ariaLabel ?? (on ? "online" : "offline")}
      style={style}
    />
  );
}
