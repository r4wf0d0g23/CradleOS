/**
 * StructureRow — production dashboard structure row.
 *
 * Replaces the 130px-wide card grid with a dense one-row-per-structure
 * layout matching the AD playground variant approved 2026-04-25. Wires
 * real Move-call handlers, real EP-budget gate, hover focus highlight,
 * and the conditional secondary actions (EDIT / DELEGATE / LINK GATE).
 *
 * The row layout:
 *
 *   [icon] [name (clickable → dApp)] [EP cell] [obj-id] [STATUS LED + ! glyph + toggle + EDIT + DELEGATE? + LINK?]
 *
 * Owns rendering only — all state and handlers come from the parent
 * DashboardPanel via props.
 */

import React from "react";
import type { PlayerStructure } from "../../lib";
import { StatusLight, CcpToggle, PowerBlockedGlyph } from "../ccp";

export interface StructureRowProps {
  structure: PlayerStructure;
  index: number;

  // EP gate inputs
  epAvailable: number;
  /** When true, the parent node is offline/out-of-fuel — pre-existing fuel gate. */
  fuelBlocked: boolean;

  // Action handlers
  onOnline: (s: PlayerStructure) => void;
  onOffline: (s: PlayerStructure) => void;
  onRename: (s: PlayerStructure) => void;
  onDelegate: (s: PlayerStructure) => void;
  onRevoke: (s: PlayerStructure) => void;
  onLinkGate?: (s: PlayerStructure, destinationId: string) => void;
  onUnlinkGate?: (s: PlayerStructure) => void;
  onOpenDApp: (s: PlayerStructure) => void;

  // Focus/hover sync (used by other panels — e.g. the map highlight)
  onFocus?: (s: PlayerStructure | null) => void;
  isFocused?: boolean;

  // Action state
  actionBusy: string | null;
  isDelegatable: boolean;
  isDelegated: boolean;
  /** True when the user has a tribe vault available to delegate to.
   *  Required for the DELEGATE action to succeed; the button is hidden
   *  when no vault exists. REVOKE remains available regardless. */
  tribeVaultAvailable: boolean;
  /** Available unlinked gates for the link-gate <select>. */
  availableGateLinkTargets?: PlayerStructure[];
  /** Inline transient status string for gate link/unlink action. */
  gateActionStatus?: string | null;

  // Per-kind helpers
  kindIcon: (s: PlayerStructure) => string;
}

const N    = "#FAFAE5";
const N80  = "rgba(250,250,229,0.80)";
const N60  = "rgba(250,250,229,0.60)";
const N40  = "rgba(250,250,229,0.40)";
const N10  = "rgba(250,250,229,0.10)";
const ON   = "#5DFF9A";
const M    = "#FF2800";
const AMBR = "#FFB54A";

// All buttons in the actions cluster share this style — produces the
// CCP "ghost" appearance: dark background, hairline border in the
// caller-provided color, uppercase 9px label.
function ghostBtn(color: string): React.CSSProperties {
  return {
    background: "transparent",
    border: `1px solid ${color}`,
    color,
    padding: "3px 8px",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.10em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

export function StructureRow({
  structure: s,
  index,
  epAvailable,
  fuelBlocked,
  onOnline,
  onOffline,
  onRename,
  onDelegate,
  onRevoke,
  onLinkGate,
  onUnlinkGate,
  onOpenDApp,
  onFocus,
  isFocused,
  actionBusy,
  isDelegatable,
  isDelegated,
  tribeVaultAvailable,
  availableGateLinkTargets,
  gateActionStatus,
  kindIcon,
}: StructureRowProps) {
  const cost = s.energyCost ?? 0;
  const epBlocked = !s.isOnline && cost > 0 && cost > epAvailable;
  const blocked = epBlocked || fuelBlocked;
  const blockedReason = epBlocked
    ? `Insufficient energy: needs ${cost} EP, ${epAvailable} available (short by ${cost - epAvailable})`
    : fuelBlocked
      ? "Node must be online with fuel before structures can power up"
      : undefined;
  const busy = actionBusy === s.objectId;

  const zebra = index % 2 === 0 ? "rgba(0,0,0,0)" : "rgba(255,255,255,0.025)";
  const focusedBg = isFocused ? "rgba(255,40,0,0.05)" : zebra;
  const epColor = epBlocked ? AMBR : N80;

  return (
    <div
      onMouseEnter={() => onFocus?.(s)}
      onMouseLeave={() => onFocus?.(null)}
      style={{
        // Fixed column widths so EP / OBJ ID / actions all line up between
        // every row of every node. The actions cluster is fixed width too
        // because the EDIT/DELEGATE buttons would otherwise jump rightward
        // on rows where DELEGATE is hidden.
        display: "grid",
        gridTemplateColumns: "32px 1fr 90px 90px 320px",
        alignItems: "center",
        gap: 12,
        padding: "9px 18px",
        background: focusedBg,
        borderBottom: `1px solid ${N10}`,
        fontSize: 13,
        transition: "background 80ms ease",
      }}
    >
      {/* Kind icon */}
      <span style={{ color: N60, fontSize: 16, textAlign: "center" }}>
        {kindIcon(s)}
      </span>

      {/* Name — clickable; opens the in-game dApp iframe */}
      <button
        type="button"
        onClick={() => onOpenDApp(s)}
        title="Open in EVE dApp"
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          textAlign: "left",
          cursor: "pointer",
          color: N,
          fontFamily: "inherit",
          fontSize: 13,
          letterSpacing: "0.02em",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {s.displayName}
        <span style={{
          fontSize: 10,
          color: N40,
          marginLeft: 8,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}>{s.typeName ?? s.label}</span>
      </button>

      {/* EP cost (amber + bold when blocked) */}
      <span style={{
        color: epColor,
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.02em",
        fontWeight: epBlocked ? 700 : 400,
      }}>
        {cost > 0 ? `${cost} EP` : "—"}
      </span>

      {/* Object ID short */}
      <span style={{
        color: N40,
        fontSize: 10,
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.04em",
      }}>
        {s.objectId.slice(-6)}
      </span>

      {/* Status + actions cluster. Order: warning glyph (when blocked) is
          to the LEFT of the LED — user reads 'why is this blocked?' before
          the LED tells them current state. Then toggle, then secondary
          actions. */}
      <span style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        justifyContent: "flex-end",
        flexWrap: "nowrap",
      }}>
        {epBlocked && (
          <PowerBlockedGlyph
            ariaLabel={`Power blocked: ${blockedReason}`}
            tooltip={`INSUFFICIENT POWER — ${blockedReason}`}
          />
        )}
        <StatusLight on={s.isOnline} size={12} ariaLabel={`${s.displayName} status`} />
        <CcpToggle
          on={s.isOnline}
          onChange={() => {
            if (busy) return;
            if (s.isOnline) onOffline(s);
            else onOnline(s);
          }}
          ariaLabel={`${s.displayName} power`}
          disabled={blocked || busy}
          disabledReason={blockedReason}
        />
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRename(s); }}
          title="Rename"
          style={ghostBtn(N40)}
        >
          EDIT
        </button>
        {/* DELEGATE / REVOKE: REVOKE always available when delegated
            (only needs the local delegation-obj key, not the vault).
            DELEGATE only shown when the user has a tribe vault to
            delegate TO. Hidden entirely when delegatable but no
            valid action surface exists. */}
        {isDelegatable && (isDelegated || tribeVaultAvailable) && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              if (isDelegated) onRevoke(s);
              else onDelegate(s);
            }}
            title={isDelegated ? "Revoke tribe policy" : "Apply tribe policy"}
            style={ghostBtn(isDelegated ? AMBR : "#00ccff")}
          >
            {isDelegated ? "⊘ REVOKE" : "⚑ DELEGATE"}
          </button>
        )}
        {/* Gate link / unlink, inline */}
        {s.kind === "Gate" && (
          <GateLinkControls
            structure={s}
            onLink={onLinkGate}
            onUnlink={onUnlinkGate}
            availableTargets={availableGateLinkTargets ?? []}
            transientStatus={gateActionStatus ?? null}
          />
        )}
      </span>
    </div>
  );
}

function GateLinkControls({
  structure: s,
  onLink,
  onUnlink,
  availableTargets,
  transientStatus,
}: {
  structure: PlayerStructure;
  onLink?: (s: PlayerStructure, destinationId: string) => void;
  onUnlink?: (s: PlayerStructure) => void;
  availableTargets: PlayerStructure[];
  transientStatus: string | null;
}) {
  const isLinked = !!s.linkedGateId;

  if (transientStatus) {
    const c = transientStatus.startsWith("✓") ? ON
      : transientStatus.startsWith("✗") ? M : "#00ccff";
    return (
      <span style={{ fontSize: 10, color: c, fontStyle: "italic" }}>
        {transientStatus}
      </span>
    );
  }

  if (isLinked) {
    return (
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onUnlink?.(s); }}
        title="Unlink gate"
        style={ghostBtn("#00ccff")}
      >
        ⛩ UNLINK
      </button>
    );
  }

  // No link target available — hide the select rather than render an
  // empty/no-op dropdown. The user can return when they own another gate.
  const linkable = availableTargets.filter(
    g => g.objectId !== s.objectId && !g.linkedGateId,
  );
  if (linkable.length === 0) return null;

  return (
    <select
      onClick={e => e.stopPropagation()}
      onChange={e => {
        const destId = e.target.value;
        if (destId && onLink) onLink(s, destId);
        e.target.value = "";
      }}
      defaultValue=""
      style={{
        background: "rgba(0,0,0,0.6)",
        color: "#00ccff",
        border: "1px solid #00ccff",
        fontSize: 9,
        padding: "3px 6px",
        fontFamily: "inherit",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      <option value="" disabled>⛩ LINK GATE…</option>
      {linkable.map(g => (
          <option key={g.objectId} value={g.objectId}>
            {g.displayName} ({g.gameItemId ?? g.objectId.slice(0, 8)})
          </option>
        ))}
    </select>
  );
}
