/**
 * CcpToggle — left/right power toggle.
 *
 * Anatomy (per CCP design system, 2026-04-25):
 *   Track: dark pill, hairline Martian-Red border (or neutral when disabled).
 *          Inside the track sits a single chip (the knob) wide enough to
 *          hold its own label, plus a separate dim label on the opposite
 *          (inactive) terminal.
 *   Chip:  the active indicator. ON → Martian-Red filled, dark "ON" text.
 *          OFF → dark, neutral-40 border, bright "OFF" text.
 *   Inactive label: small neutral-20 label in the empty half of the track,
 *          tells the user what flipping would do.
 *
 * Disabled state follows the components-form sheet — neutral fills, muted
 * border, no glow, opacity 0.55, cursor: not-allowed.
 *
 * Promoted from src/playground/VariantAD.tsx 2026-04-25.
 */


export interface CcpToggleProps {
  on: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
}

const M   = "#FF2800";
const N   = "#FAFAE5";
const N20 = "rgba(250,250,229,0.20)";
const N40 = "rgba(250,250,229,0.40)";

export function CcpToggle({ on, onChange, ariaLabel, disabled = false, disabledReason }: CcpToggleProps) {
  const W = 84;
  const H = 26;
  const PAD = 2;
  const CHIP_W = 38;
  const CHIP_H = H - PAD * 2;
  const inactiveLabelLeft  = on ? PAD + 6 : W - CHIP_W - PAD;
  const inactiveLabelText  = on ? "OFF" : "ON";
  const inactiveAlign      = on ? "flex-start" : "flex-end";
  const inactivePadX       = on ? "0 0 0 6px" : "0 6px 0 0";

  const trackBorder = disabled ? N40 : M;
  const chipBorder  = disabled ? N40 : (on ? M : N40);
  const chipBg      = disabled ? "#1A1A1A" : (on ? M : "#1A1A1A");
  const chipText    = disabled ? N40 : (on ? "#0A0A0A" : N);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      title={disabled && disabledReason ? disabledReason : undefined}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!on);
      }}
      style={{
        position: "relative",
        width: W,
        height: H,
        background: "#0A0A0A",
        border: `1px solid ${trackBorder}`,
        borderRadius: 0,
        padding: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        flexShrink: 0,
        opacity: disabled ? 0.55 : 1,
        transition: "box-shadow 120ms ease, opacity 140ms ease",
        fontFamily: "inherit",
      }}
      onMouseEnter={e => {
        if (disabled) return;
        (e.currentTarget as HTMLButtonElement).style.boxShadow =
          "0 0 0 2px rgba(255,40,0,0.20)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
      }}
    >
      {/* Inactive-terminal label */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: inactiveLabelLeft,
          width: W - CHIP_W - PAD * 2 - 4,
          display: "flex",
          alignItems: "center",
          justifyContent: inactiveAlign,
          padding: inactivePadX,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.14em",
          color: N20,
          transition: "left 140ms ease, color 140ms ease",
          pointerEvents: "none",
        }}
      >{inactiveLabelText}</span>

      {/* Active chip */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: PAD,
          left: on ? W - CHIP_W - PAD : PAD,
          width: CHIP_W,
          height: CHIP_H,
          background: chipBg,
          border: `1px solid ${chipBorder}`,
          color: chipText,
          transition: "left 160ms ease, background 160ms ease, border-color 160ms ease, color 160ms ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          boxShadow: on
            ? "inset 0 0 0 1px rgba(0,0,0,0.30)"
            : "inset 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >{on ? "ON" : "OFF"}</span>
    </button>
  );
}
