/**
 * NodeHeader — production dashboard Network Node header bar.
 *
 * Replaces the previous inline node header with the AD playground design:
 *   [▶] [icon] [NAME · meta line]  FUEL [bar] X% Yu   EP [bar] N/1000   🟢 [OFF│ON] EDIT DEFENSE GATES
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
  onDefense?: () => void;
  onGates?: () => void;
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
  onDefense,
  onGates,
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
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto auto",
        alignItems: "center",
        gap: 14,
        padding: "12px 18px",
        background: isFocused ? "rgba(255,40,0,0.04)" : N05,
        borderBottom: collapsed ? "none" : `1px solid ${N10}`,
        cursor: "pointer",
      }}
    >
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

      {/* Name + meta */}
      <span style={{
        color: N,
        fontWeight: 700,
        fontSize: 16,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {node.displayName}
        <span style={{
          color: N40,
          fontWeight: 400,
          fontSize: 11,
          marginLeft: 12,
          letterSpacing: "0.10em",
        }}>
          {(node.typeName ?? "Network Node").toUpperCase()} · {childCount} STRUCT · {childOnline}↑ {childOffline > 0 ? `${childOffline}↓` : ""}
          {collapsed ? " · COLLAPSED" : ""}
        </span>
      </span>

      {/* FUEL bar — only shown when fuel data is available */}
      {node.fuelLevelPct !== undefined ? (
        <BarChip label="FUEL" pct={fuelPct} right={fuelRightLabel} color={fuelColor} />
      ) : <span />}

      {/* EP bar — live, computed from online children's energyCost sum */}
      <BarChip
        label="EP"
        pct={consumedPct}
        right={`${consumedEp}/${epMax}`}
        color={epColor}
      />

      {/* STATUS LED + power toggle + action chips, all clustered at right.
          Clicks here stop propagation so the header's openDApp doesn't
          fire from them. */}
      <span
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "flex-end",
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
        {onDefense && (
          <button type="button" onClick={onDefense} title="Defense policy" style={ghostBtn(M)}>
            DEFENSE
          </button>
        )}
        {onGates && (
          <button type="button" onClick={onGates} title="Gate policy" style={ghostBtn(M)}>
            GATES
          </button>
        )}
      </span>
    </div>
  );
}
