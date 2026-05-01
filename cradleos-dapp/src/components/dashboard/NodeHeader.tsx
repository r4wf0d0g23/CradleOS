/**
 * NodeHeader — production dashboard Network Node header bar.
 *
 * Two-row layout (designed to fit narrow in-game iframe widths):
 *
 *   Row 1: [▶] [◆] [NAME · N STRUCT · N↑ N↓]              [🟢] [OFF│ON] EDIT DEFENSE GATES
 *   Row 2:                          FUEL [████▒▒▒] X% Yu     EP [████▒▒▒] N/1000
 *
 * History: previous single-row layout pushed EDIT/DEFENSE/GATES off the
 * right edge in the in-game iframe. "NETWORK NODE" type descriptor
 * removed — redundant inside the Hidden Structures node section header.
 *
 * Stays visible when the node is collapsed so health and power are
 * always reachable. Click the chevron to collapse/expand. Click the
 * name or anywhere else on the header (except interactive elements)
 * to open the in-game dApp.
 */

import React from "react";
import type { PlayerStructure } from "../../lib";
import { StatusLight, CcpToggle, BarChip } from "../ccp";

const N    = "#FAFAE5";
const N40  = "rgba(250,250,229,0.40)";
const N60  = "rgba(250,250,229,0.60)";
const N10  = "rgba(250,250,229,0.10)";
const N05  = "rgba(250,250,229,0.05)";
const ON   = "#5DFF9A";

export interface NodeHeaderProps {
  node: PlayerStructure;
  childCount: number;
  childOnline: number;
  childOffline: number;
  /** Live consumed EP, sum of online children's energyCost. */
  consumedEp: number;
  /** Max EP capacity (1000 for in-game default). */
  epMax: number;
  /** Whether this node is currently collapsed. */
  collapsed: boolean;
  /** Toggle handler for the chevron. */
  onToggleCollapsed: () => void;
  /** Click anywhere else on the header → open the in-game dApp. */
  onOpenDApp: () => void;
  /** Hover hooks for cross-panel focus highlight. */
  onFocus?: (s: PlayerStructure | null) => void;
  /** Whether this node is currently the focused element. */
  isFocused?: boolean;
  /** Power toggle handler. */
  onTogglePower: () => void;
  /** Action busy state for the toggle (disables when transaction pending). */
  busy: boolean;
  /** Secondary action handlers. */
  onEdit: () => void;
  /** Install the CradleOS dashboard kiosk on this node (sets the
   *  metadata.url to the dashboard URL via update_metadata_url).
   *  Only rendered when the node does NOT already have the dashboard
   *  installed; once installed the button is replaced with an
   *  INSTALLED indicator. Removed when undefined. */
  onInstallCradleOS?: () => void;
  /** True when node.metadata.url already matches the dashboard URL.
   *  Drives the install-vs-installed display in the header. */
  cradleOSInstalled?: boolean;
}

const M = "#FF2800";

function ghostBtn(color: string): React.CSSProperties {
  return {
    background: "transparent",
    border: `1px solid ${color}`,
    color,
    padding: "4px 12px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

export function NodeHeader({
  node,
  childCount,
  childOnline,
  childOffline,
  consumedEp,
  epMax,
  collapsed,
  onToggleCollapsed,
  onOpenDApp,
  onFocus,
  isFocused,
  onTogglePower,
  busy,
  onEdit,
  onInstallCradleOS,
  cradleOSInstalled,
}: NodeHeaderProps) {
  const fuelPct = Math.min(100, Math.max(0, node.fuelLevelPct ?? 0));
  const fuelColor = fuelPct < 15 ? "#FFB54A"
    : fuelPct < 50 ? "#FFB54A"
    : ON;
  const consumedPct = Math.min(100, (consumedEp / epMax) * 100);
  // EP bar amber when consumption > 90% of capacity, else neutral
  const epColor = consumedEp > epMax * 0.9 ? "#FFB54A" : "rgba(250,250,229,0.80)";

  // Visual right tail for the fuel bar.
  //
  // Confirmed by Raw 2026-04-25: the value the production lib.ts calc emits
  // (qty * burn_rate_in_ms / 3.6e6) is fuel UNITS remaining, not hours. The
  // formula's dimensional analysis was wrong. Until lib.ts is fixed we render
  // the value as 'u' here so the label matches reality — it's better to show
  // a correctly-labeled units count than a wrong 'hours' figure.
  const fuelRightLabel = node.runtimeHoursRemaining !== undefined
    ? `${Math.round(node.runtimeHoursRemaining).toLocaleString()} u`
    : "";

  return (
    <div
      role="banner"
      onMouseEnter={() => onFocus?.(node)}
      onMouseLeave={() => onFocus?.(null)}
      onClick={onOpenDApp}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "12px 18px",
        background: isFocused ? "rgba(255,40,0,0.04)" : N05,
        borderBottom: collapsed ? "none" : `1px solid ${N10}`,
        cursor: "pointer",
      }}
    >
      {/* ── Row 1: identity + actions ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
      }}>
        {/* Chevron + kind glyph cluster — its own click target so the rest of
            the header still opens the in-game dApp. */}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onToggleCollapsed();
          }}
          aria-label={collapsed ? `Expand ${node.displayName}` : `Collapse ${node.displayName}`}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand" : "Collapse"}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: N60,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "inherit",
            flexShrink: 0,
            // Suppress webview UA focus/active styling. The in-game
            // embedded Chrome was painting a default blue focus ring +
            // tap-highlight on this button after click, which Raw saw as a
            // "blue dropdown arrow" that doesn't match the orange theme.
            outline: "none",
            WebkitTapHighlightColor: "transparent",
            WebkitAppearance: "none" as const,
            appearance: "none" as const,
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 16,
              fontSize: 16,
              lineHeight: 1,
              transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
              transition: "transform 140ms ease, color 140ms ease",
              color: M,
            }}
          >▶</span>
          <span style={{ color: N40, fontSize: 14 }}>◆</span>
        </button>

        {/* Name + tribe-meta
            ("NETWORK NODE" type descriptor removed — the parent section header
            already identifies this as the Hidden Structures node group) */}
        <span style={{
          color: N,
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
          minWidth: 0,
        }}>
          {node.displayName}
          <span style={{
            color: N40,
            fontWeight: 400,
            fontSize: 11,
            marginLeft: 12,
            letterSpacing: "0.10em",
          }}>
            {childCount} STRUCT · {childOnline}↑ {childOffline > 0 ? `${childOffline}↓` : ""}
            {collapsed ? " · COLLAPSED" : ""}
          </span>
        </span>

        {/* STATUS LED + power toggle + action chips. Click-stop so header's
            openDApp doesn't fire when interacting with these. */}
        <span
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            justifyContent: "flex-end",
            flexWrap: "wrap",
            flexShrink: 0,
          }}
          onClick={e => e.stopPropagation()}
        >
          <StatusLight on={node.isOnline} size={14} ariaLabel={`${node.displayName} status`} />
          <CcpToggle
            on={node.isOnline}
            onChange={() => { if (!busy) onTogglePower(); }}
            ariaLabel={`${node.displayName} power`}
            disabled={busy}
          />
          <button type="button" onClick={onEdit} title="Rename" style={ghostBtn(M)}>
            EDIT
          </button>
          {/* CradleOS install state — either offers the install action
              when the node has no kiosk URL set yet, or shows a quiet
              INSTALLED chip once attached. The DEFENSE / GATES buttons
              that used to live here were removed 2026-05-01 in favor
              of the kiosk nav bar (Defense + Gates are reachable from
              every kiosk page, so per-node shortcuts were redundant
              real estate). */}
          {onInstallCradleOS && !cradleOSInstalled && (
            <button
              type="button"
              onClick={onInstallCradleOS}
              disabled={busy}
              title="Attach the CradleOS dashboard kiosk to this Network Node"
              style={{
                ...ghostBtn("#00ff96"),
                opacity: busy ? 0.4 : 1,
              }}
            >
              INSTALL CRADLEOS
            </button>
          )}
          {cradleOSInstalled && (
            <span
              title="CradleOS dashboard kiosk is installed on this node"
              style={{
                fontSize: 9,
                fontFamily: "monospace",
                letterSpacing: "0.12em",
                color: "rgba(0,255,150,0.55)",
                border: "1px solid rgba(0,255,150,0.3)",
                padding: "3px 8px",
                borderRadius: 2,
                whiteSpace: "nowrap",
              }}
            >
              ◉ INSTALLED
            </span>
          )}
        </span>
      </div>

      {/* ── Row 2: FUEL + EP bars ──
          Indented under the name to align with the typography rhythm. */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        flexWrap: "wrap",
        paddingLeft: 40, // chevron(16) + gap(8) + glyph(14) + gap(2) ≈ 40px
      }}>
        {/* FUEL bar — only shown when fuel data is available */}
        {node.fuelLevelPct !== undefined && (
          <div style={{ minWidth: 220, flex: "1 1 220px" }}>
            <BarChip label="FUEL" pct={fuelPct} right={fuelRightLabel} color={fuelColor} />
          </div>
        )}

        {/* EP bar — live, computed from online children's energyCost sum */}
        <div style={{ minWidth: 220, flex: "1 1 220px" }}>
          <BarChip
            label="EP"
            pct={consumedPct}
            right={`${consumedEp}/${epMax}`}
            color={epColor}
          />
        </div>
      </div>
    </div>
  );
}
