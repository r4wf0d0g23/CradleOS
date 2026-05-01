import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";

/**
 * Portal-mounted dropdown that works inside the EVE Vault Mobile /
 * Stillness embedded webview, where native HTML <select> elements are
 * broken: their option popout renders at the top-left of the iframe
 * (outside the panel bounds) and dismisses instantly on focus loss.
 *
 * Same root cause as the AGENTS.md Webview Dialog Ban for window.prompt
 * / window.confirm / window.alert: native browser overlays escape the
 * iframe and the embedded Chrome kills focus.
 *
 * This component:
 *   - renders a button in normal DOM flow (anchored, no native popout),
 *   - portal-mounts the option list to document.body using
 *     getBoundingClientRect() coordinates from the button,
 *   - closes on Escape, click outside, or option click,
 *   - recomputes position on resize and scroll while open,
 *   - z-indexes above any in-iframe overlays.
 *
 * In a normal browser this is invisible: behaves identically to a
 * styled native select. Inside the webview, this is the only way to
 * make a dropdown work.
 *
 * Reference implementation history:
 *   2026-05-01 — InventoryPanel OperatorFilterDropdown (extracted to
 *                this file the same day after audit found 18 native
 *                <select> elements across CradleOS panels, several of
 *                them inside kiosk-reachable pages).
 *
 * Usage:
 *   <PortalSelect
 *     value={pendingSvcId}
 *     onChange={(v) => setPendingSvcId(v)}
 *     options={[
 *       { value: "", label: "Select a service…" },
 *       { value: "drone", label: "🛰 Drone" },
 *       ...
 *     ]}
 *     placeholder="Choose…"
 *     disabled={isBusy}
 *   />
 */

export type PortalSelectOption = {
  value: string;
  label: string;
  /** Optional disabled flag for individual options. Disabled options
   *  render greyed out and cannot be selected. */
  disabled?: boolean;
};

export type PortalSelectProps = {
  /** Currently selected value. Use empty string for "no selection". */
  value: string;
  /** Called when the user picks an option. */
  onChange: (value: string) => void;
  /** Option list. Render order matches array order. */
  options: PortalSelectOption[];
  /** Text shown when value is "" or doesn't match any option. */
  placeholder?: string;
  /** When true, the trigger button is disabled and the list won't open. */
  disabled?: boolean;
  /** Tooltip on the trigger button. */
  title?: string;
  /** Override the trigger button's inline styles. Merged on top of
   *  defaults so callers only have to override what they want changed. */
  buttonStyle?: React.CSSProperties;
  /** Override the option list's inline styles (panel container only;
   *  individual options inherit color from the panel). */
  panelStyle?: React.CSSProperties;
  /** Override individual option styles. Active option always gets the
   *  accent border + #FF4700 color regardless. */
  optionStyle?: React.CSSProperties;
  /** Maximum height of the option list (px). Default 320. */
  maxHeight?: number;
  /** Minimum width of the option list (px). Default: button width. */
  minWidth?: number;
  /** Optional aria label for the trigger button. */
  ariaLabel?: string;
};

let _portalSelectIdSeq = 0;

export function PortalSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  title,
  buttonStyle,
  panelStyle,
  optionStyle,
  maxHeight = 320,
  minWidth,
  ariaLabel,
}: PortalSelectProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number; width: number } | null>(null);
  // Stable id so multiple PortalSelect instances on the same page don't
  // collide when the click-outside handler walks document.getElementById.
  const panelIdRef = useRef<string>("");
  if (!panelIdRef.current) {
    _portalSelectIdSeq += 1;
    panelIdRef.current = `portalselect-panel-${_portalSelectIdSeq}`;
  }
  const panelId = panelIdRef.current;

  // Resolve the current selection's label.
  const currentLabel = useMemo(() => {
    const match = options.find(o => o.value === value);
    return match?.label ?? placeholder;
  }, [value, options, placeholder]);

  // Recompute anchor position when opening, on resize, and on scroll.
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (!r) return;
      setAnchor({
        left: r.left,
        top: r.bottom + 2,
        width: Math.max(r.width, minWidth ?? r.width),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, minWidth]);

  // Close on Escape or outside click.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      // Click on the button itself: let the button handler toggle.
      if (buttonRef.current && target && buttonRef.current.contains(target)) return;
      // Click on the portal panel: option click handles itself; ignore
      // here so we don't double-close.
      const panel = document.getElementById(panelId);
      if (panel && target && panel.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, panelId]);

  // Close if disabled flips on while open.
  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  const defaultButtonStyle: React.CSSProperties = {
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: "0.04em",
    background: "transparent",
    border: "1px solid rgba(255,71,0,0.3)",
    color: disabled ? "rgba(255,71,0,0.4)" : "#FF4700",
    padding: "4px 10px",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minWidth: 140,
    justifyContent: "space-between",
    borderRadius: 2,
    fontWeight: 500,
  };

  const defaultPanelStyle: React.CSSProperties = {
    position: "fixed",
    background: "rgba(5,3,2,0.98)",
    border: "1px solid rgba(255,71,0,0.6)",
    boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
    zIndex: 9999,
    fontFamily: "monospace",
    fontSize: 11,
    letterSpacing: "0.04em",
    borderRadius: 2,
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => { if (!disabled) setOpen(o => !o); }}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ ...defaultButtonStyle, ...buttonStyle }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {currentLabel}
        </span>
        <span style={{ opacity: 0.7, fontSize: 9, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && anchor && createPortal(
        <div
          id={panelId}
          role="listbox"
          style={{
            ...defaultPanelStyle,
            ...panelStyle,
            left: anchor.left,
            top: anchor.top,
            width: anchor.width,
            maxHeight,
            overflowY: "auto",
          }}
        >
          {options.map(opt => {
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={opt.disabled}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 12px",
                  background: selected ? "rgba(255,71,0,0.15)" : "transparent",
                  border: "none",
                  borderBottom: "1px solid rgba(255,71,0,0.08)",
                  color: opt.disabled
                    ? "rgba(250,250,229,0.3)"
                    : selected
                      ? "#FF4700"
                      : "rgba(250,250,229,0.85)",
                  cursor: opt.disabled ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  letterSpacing: "inherit",
                  fontWeight: selected ? 700 : 400,
                  ...optionStyle,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
