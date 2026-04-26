/**
 * VariantAD — Tactical Status Rows (A) + CCP Token Correction (D).
 *
 * The combined direction: dense per-row layout PLUS the official CCP
 * design system tokens (Martian Red #FF2800, Disket Mono with proper
 * tracking, hairline neutral-20 borders, alternating zebra rows).
 *
 * This is the most "EVE Frontier-esque" of the four variants.
 */

import { useState } from "react";
import type { FixtureNode, FixtureStructure, StructureKind } from "./fixture";

type Summary = { structures: number; online: number; systems: number; hidden: number };
type Props = { nodes: FixtureNode[]; summary: Summary };

// CCP tokens
const N   = "#FAFAE5";
const N80 = "rgba(250,250,229,0.80)";
const N60 = "rgba(250,250,229,0.60)";
const N40 = "rgba(250,250,229,0.40)";
const N20 = "rgba(250,250,229,0.20)";
const N10 = "rgba(250,250,229,0.10)";
const N05 = "rgba(250,250,229,0.05)";
const M   = "#FF2800";
const M40 = "rgba(255,40,0,0.40)";
const M10 = "rgba(255,40,0,0.10)";
const ON  = "#5DFF9A";

const FAMILY = '"Frontier Disket Mono", "Disket Mono", monospace';

const KIND_GLYPH: Record<string, string> = {
  NetworkNode: "◆",
  MiniPrinter: "▤",
  Printer: "▤",
  MiniStorage: "▣",
  Nest: "◯",
  Nursery: "◯",
  Refinery: "▥",
  Shelter: "△",
  Assembler: "▦",
  Berth: "◐",
  HeavyBerth: "●",
  MiniBerth: "○",
  Relay: "▷",
};

// Sort structures so same-family kinds cluster together (mini-printer next
// to printer, mini-storage next to storage, mini-berth next to berth and
// heavy-berth) WITHOUT visual breaks between them. Within a family they
// order by family-rank (mini < standard < heavy), then by label.
//
// Family is the noun stem ('printer', 'storage', 'berth'). Family rank is
// the size variant: mini = 0, standard = 1, heavy = 2.
//
// Kinds outside any defined family land at the end in alphabetical order.
const FAMILY_ORDER = [
  "relay",      // utility/networking sized rank 1
  "node",       // network nodes (rank 1)
  "storage",    // storage family
  "berth",      // berth family (mini/standard/heavy)
  "printer",    // printer family (mini/standard)
  "refinery",
  "assembler",
  "nest",
  "nursery",
  "shelter",
];

// Maps each StructureKind → (family stem, rank-within-family).
const FAMILY_OF: Record<StructureKind, { family: string; rank: number }> = {
  Relay:        { family: "relay",     rank: 1 },
  NetworkNode:  { family: "node",      rank: 1 },
  MiniStorage:  { family: "storage",   rank: 0 },
  MiniBerth:    { family: "berth",     rank: 0 },
  Berth:        { family: "berth",     rank: 1 },
  HeavyBerth:   { family: "berth",     rank: 2 },
  MiniPrinter:  { family: "printer",   rank: 0 },
  Printer:      { family: "printer",   rank: 1 },
  Refinery:     { family: "refinery",  rank: 1 },
  Assembler:    { family: "assembler", rank: 1 },
  Nest:         { family: "nest",      rank: 1 },
  Nursery:      { family: "nursery",   rank: 1 },
  Shelter:      { family: "shelter",   rank: 1 },
};

function sortByFamily(children: FixtureStructure[]): FixtureStructure[] {
  return [...children].sort((a, b) => {
    const fa = FAMILY_OF[a.kind] ?? { family: "~" + a.kind, rank: 1 };
    const fb = FAMILY_OF[b.kind] ?? { family: "~" + b.kind, rank: 1 };
    const ai = FAMILY_ORDER.indexOf(fa.family);
    const bi = FAMILY_ORDER.indexOf(fb.family);
    const aRank = ai === -1 ? FAMILY_ORDER.length : ai;
    const bRank = bi === -1 ? FAMILY_ORDER.length : bi;
    if (aRank !== bRank) return aRank - bRank;
    if (fa.rank !== fb.rank) return fa.rank - fb.rank;
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.label.localeCompare(b.label) || a.objectId.localeCompare(b.objectId);
  });
}

export function VariantAD({ nodes, summary }: Props) {
  return (
    <div style={{ fontFamily: FAMILY, color: N }}>
      {/* Summary bar */}
      <div style={{
        display: "flex",
        gap: 32,
        padding: "14px 18px",
        marginBottom: 0,
        background: N05,
        border: `1px solid ${N10}`,
        borderBottom: "none",
        flexWrap: "wrap",
        alignItems: "baseline",
      }}>
        <Stat n={summary.structures} label="STRUCTURES" color={N} />
        <Stat n={summary.online}     label="ONLINE"     color={ON} />
        <Stat n={summary.systems}    label="SYSTEMS"    color={M} />
        <Stat n={summary.hidden}     label="HIDDEN"     color={N60} />
      </div>

      {/* Banner */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 18px",
        marginBottom: 22,
        background: M10,
        border: `1px solid ${M40}`,
        borderTop: `1px solid ${N10}`,
      }}>
        <span style={{ fontSize: 14, color: M }}>◆</span>
        <span style={{
          fontSize: 12,
          color: N80,
          letterSpacing: "0.01em",
          lineHeight: 1.5,
        }}>
          <span style={{
            color: M,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}>All of your structures are in unrevealed systems.</span>
          {" "}Their solar-system identity has not yet been written to the lattice.
        </span>
      </div>

      {/* Node groups */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {nodes.map(node => <NodeGroup key={node.objectId} node={node} />)}
      </div>
    </div>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <span>
      <span style={{
        fontSize: 26,
        fontWeight: 700,
        color,
        letterSpacing: "0.02em",
        fontVariantNumeric: "tabular-nums",
      }}>{n}</span>
      <span style={{
        fontSize: 11,
        color: N60,
        marginLeft: 10,
        letterSpacing: "0.10em",
        fontWeight: 700,
      }}>{label}</span>
    </span>
  );
}

// localStorage key prefix for per-node collapse state.
const COLLAPSE_KEY_PREFIX = "cradleos.playground.nodeCollapsed.";

function loadCollapsed(objectId: string): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY_PREFIX + objectId) === "1";
  } catch {
    return false;
  }
}
function saveCollapsed(objectId: string, collapsed: boolean): void {
  try {
    if (collapsed) window.localStorage.setItem(COLLAPSE_KEY_PREFIX + objectId, "1");
    else window.localStorage.removeItem(COLLAPSE_KEY_PREFIX + objectId);
  } catch { /* localStorage unavailable — silently ignore */ }
}

function NodeGroup({ node }: { node: FixtureNode }) {
  const [nodeOn, setNodeOn] = useState(node.isOnline);
  // Lifted: per-child on/off state lives on the node so we can compute live
  // EP availability across the whole node and gate toggle interactions on it.
  // Map keyed by child objectId.
  const [childOnState, setChildOnState] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const c of node.children) m[c.objectId] = c.isOnline;
    return m;
  });
  const setChildOn = (objectId: string, next: boolean) => {
    setChildOnState(prev => ({ ...prev, [objectId]: next }));
  };

  // Collapse state persists per-node via localStorage so the user's
  // expand/collapse choices survive page reloads.
  const [collapsed, setCollapsed] = useState<boolean>(() => loadCollapsed(node.objectId));

  // Live EP accounting. The node's max-output capacity is fuelGjMax; the
  // currently consumed EP is the sum of online children's energyCost.
  const consumedEp = node.children
    .filter(c => childOnState[c.objectId])
    .reduce((sum, c) => sum + c.energyCost, 0);
  const epAvailable = Math.max(0, node.fuelGjMax - consumedEp);

  const childOnline = node.children.filter(c => childOnState[c.objectId]).length;
  const childOffline = node.children.length - childOnline;
  const fuelColor = node.fuelLevelPct < 15 ? "#FFB54A"
    : node.fuelLevelPct < 50 ? "#FFB54A" : ON;
  const sorted = sortByFamily(node.children);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    saveCollapsed(node.objectId, next);
  }

  return (
    <div style={{ border: `1px solid ${N10}` }}>
      {/* Node header. Click the title area or chevron to collapse/expand the
          structure list below; controls (toggle, edit, defense, gates) and
          status indicators stay visible regardless of collapse state so the
          dashboard can be scanned at a glance even when fully collapsed. */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto auto",
        alignItems: "center",
        gap: 14,
        padding: "12px 18px",
        background: N05,
        borderBottom: collapsed ? "none" : `1px solid ${N10}`,
      }}>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? `Expand ${node.label}` : `Collapse ${node.label}`}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand" : "Collapse"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: N60,
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 10,
              fontSize: 11,
              lineHeight: 1,
              transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
              transition: "transform 140ms ease",
              color: N60,
            }}
          >▶</span>
          <span style={{ color: N40, fontSize: 14 }}>{KIND_GLYPH.NetworkNode}</span>
        </button>
        <button
          type="button"
          onClick={toggleCollapsed}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
            color: N,
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontFamily: "inherit",
          }}
        >
          {node.label}
          <span style={{
            color: N40,
            fontWeight: 400,
            fontSize: 11,
            marginLeft: 12,
            letterSpacing: "0.10em",
          }}>NETWORK NODE · {node.children.length} STRUCT · {childOnline}↑ {childOffline}↓{collapsed ? " · COLLAPSED" : ""}</span>
        </button>
        {/* Fuel + energy bar chips. EP chip reflects live consumption from
            the lifted childOnState map, not the static fixture, so the bar
            updates as you toggle structures on/off. */}
        <BarChip label="FUEL" pct={node.fuelLevelPct}
          right={`${node.fuelUnitsLeft.toLocaleString()} u`} color={fuelColor} />
        <BarChip label="EP"
          pct={(consumedEp / node.fuelGjMax) * 100}
          right={`${consumedEp}/${node.fuelGjMax}`}
          color={consumedEp > node.fuelGjMax * 0.9 ? "#FFB54A" : N80} />
        {/* STATUS + power toggle + secondary actions, all clustered at right */}
        <span style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "flex-end",
        }}>
          <StatusLight on={nodeOn} size={14} ariaLabel={`${node.label} status`} />
          <CcpToggle on={nodeOn} onChange={setNodeOn} ariaLabel={`${node.label} power`} />
          <CcpBtn>EDIT</CcpBtn>
          <CcpBtn variant="ghost">DEFENSE</CcpBtn>
          <CcpBtn variant="ghost">GATES</CcpBtn>
        </span>
      </div>

      {/* Column header + structure rows are hidden when the node is
          collapsed. Status indicators and controls remain visible in
          the header so the dashboard stays scannable. */}
      {!collapsed && (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "32px 1fr 70px 90px 230px",
            alignItems: "center",
            gap: 12,
            padding: "7px 18px",
            background: N05,
            borderBottom: `1px solid ${N10}`,
            fontSize: 10,
            color: N60,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}>
            <span></span>
            <span>NAME</span>
            <span style={{ textAlign: "right" }}>EP</span>
            <span style={{ textAlign: "right" }}>OBJ ID</span>
            <span style={{ textAlign: "right" }}>STATUS · ACTIONS</span>
          </div>

          {/* Structure rows, family-clustered (mini-printer next to printer
              next to heavy-printer, etc.) but no group separators — just
              one continuous list. Zebra striping comes from row index, so
              the eye still picks up the row rhythm without visual category
              breaks. */}
          <div>
            {sorted.map((s, i) => (
              <StructureRow
                key={s.objectId}
                structure={s}
                index={i}
                isOn={childOnState[s.objectId]}
                onToggle={next => setChildOn(s.objectId, next)}
                epAvailable={epAvailable}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StructureRow({ structure, index, isOn, onToggle, epAvailable }: {
  structure: FixtureStructure;
  index: number;
  isOn: boolean;
  onToggle: (next: boolean) => void;
  epAvailable: number;
}) {
  const zebra = index % 2 === 0 ? "rgba(0,0,0,0)" : "rgba(255,255,255,0.025)";
  const glyph = KIND_GLYPH[structure.kind] ?? "◇";

  // Capability gate: an offline structure cannot be turned on if its
  // energyCost exceeds the node's currently available EP budget. The
  // toggle is disabled (visually + interactively) and a warning glyph
  // appears immediately to its left.
  //
  // Edge case: a structure whose energyCost is 0 is always allowed online
  // even if the node is over-budget — a free structure cannot be the cause
  // of an over-budget situation, and blocking it would be confusing.
  const wouldExceedBudget =
    !isOn && structure.energyCost > 0 && structure.energyCost > epAvailable;
  const epShort = structure.energyCost - epAvailable; // only meaningful when blocked
  const epColor = wouldExceedBudget ? "#FFB54A" : N80;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "32px 1fr 70px 90px 230px",
      alignItems: "center",
      gap: 12,
      padding: "9px 18px",
      background: zebra,
      borderBottom: `1px solid ${N10}`,
      fontSize: 13,
      transition: "background 80ms ease",
    }}>
      <span style={{ color: N60, fontSize: 16, textAlign: "center" }}>{glyph}</span>
      <span style={{
        color: N,
        fontWeight: 400,
        letterSpacing: "0.02em",
      }}>{structure.label}</span>
      <span style={{
        color: epColor,
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.02em",
        fontWeight: wouldExceedBudget ? 700 : 400,
      }}>{structure.energyCost} EP</span>
      <span style={{
        color: N40,
        fontSize: 10,
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.04em",
      }}>{structure.objectId.slice(-6)}</span>
      {/* STATUS + ACTIONS cluster. Status dot sits adjacent to the toggle
          so the eye reads (current state → control → secondary action)
          without scanning across the row. */}
      <span style={{
        display: "flex",
        gap: 10,
        justifyContent: "flex-end",
        alignItems: "center",
      }}>
        <StatusLight on={isOn} size={12} ariaLabel={`${structure.label} status`} />
        {wouldExceedBudget && (
          <PowerBlockedGlyph
            ariaLabel={`Insufficient energy: needs ${structure.energyCost} EP, ${epAvailable} available`}
            tooltip={`INSUFFICIENT POWER — needs ${structure.energyCost} EP, ${epAvailable} available (short by ${epShort})`}
          />
        )}
        <CcpToggle
          on={isOn}
          onChange={onToggle}
          ariaLabel={`${structure.label} power`}
          disabled={wouldExceedBudget}
          disabledReason={wouldExceedBudget
            ? `Insufficient energy: needs ${structure.energyCost} EP, ${epAvailable} available`
            : undefined}
        />
        <CcpBtn small variant="ghost">EDIT</CcpBtn>
      </span>
    </div>
  );
}

/**
 * PowerBlockedGlyph — small warning indicator shown beside the toggle
 * when an offline structure cannot be brought online due to insufficient
 * EP budget on the parent node. Uses the CCP warning amber (#FFB54A)
 * rather than Martian Red to distinguish 'capability blocked' from
 * 'destructive action' — the user can fix this by freeing up EP, so it's
 * not an error, it's a constraint.
 */
function PowerBlockedGlyph({ ariaLabel, tooltip }: {
  ariaLabel: string;
  tooltip: string;
}) {
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
      }}
    >!</span>
  );
}

function BarChip({ label, pct, right, color }: {
  label: string; pct: number; right: string; color: string;
}) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{
        fontSize: 10,
        color: N60,
        letterSpacing: "0.10em",
        fontWeight: 700,
      }}>{label}</span>
      <Segmented value={pct} color={color} segments={20} width={100} />
      <span style={{
        fontSize: 10,
        color: N80,
        fontVariantNumeric: "tabular-nums",
      }}>{Math.round(pct)}%</span>
      <span style={{
        fontSize: 10,
        color: N40,
        fontVariantNumeric: "tabular-nums",
      }}>{right}</span>
    </span>
  );
}

function Segmented({ value, color, segments, width }: {
  value: number; color: string; segments: number; width: number;
}) {
  const filled = Math.round((value / 100) * segments);
  const segGap = 1;
  const segWidth = (width - segGap * (segments - 1)) / segments;
  return (
    <div style={{ display: "flex", gap: segGap, height: 8, width }}>
      {Array.from({ length: segments }).map((_, i) => (
        <div key={i} style={{
          width: segWidth,
          height: "100%",
          background: i < filled ? color : N10,
        }} />
      ))}
    </div>
  );
}

/**
 * StatusLight — glowing instrument-panel indicator LED.
 *
 * Green when on, Martian Red when off. Subtle dual-layer glow + an
 * inner highlight so it reads as a real bulb rather than a flat dot.
 * Pulses slowly when on (1.6s cycle) so the eye picks up live state
 * across a long list of structures even in peripheral vision.
 */
function StatusLight({ on, size = 12, ariaLabel }: {
  on: boolean;
  size?: number;
  ariaLabel?: string;
}) {
  const ON_CORE  = "#5DFF9A";
  const ON_GLOW  = "rgba(93,255,154,0.55)";
  const ON_HALO  = "rgba(93,255,154,0.18)";
  const OFF_CORE = "#FF2800";
  const OFF_GLOW = "rgba(255,40,0,0.45)";
  const OFF_HALO = "rgba(255,40,0,0.14)";
  const core = on ? ON_CORE  : OFF_CORE;
  const glow = on ? ON_GLOW  : OFF_GLOW;
  const halo = on ? ON_HALO  : OFF_HALO;
  return (
    <span
      role="img"
      aria-label={ariaLabel ?? (on ? "online" : "offline")}
      style={{
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
        animation: on ? "ccp-led-pulse-on 1.6s ease-in-out infinite" : "ccp-led-pulse-off 2.4s ease-in-out infinite",
        flexShrink: 0,
      }}
    />
  );
}

/**
 * CcpToggle — left/right power toggle following the CCP design-system
 * toggle component (per the official component-form sheet, 2026-04-25).
 *
 * Anatomy:
 *   Track: dark pill, hairline Martian-Red border. Inside the track sits
 *          a single "chip" knob that is wide enough to hold its own label,
 *          and a separate dim label on the opposite (inactive) terminal.
 *   Chip:  the active indicator. When ON, the chip is Martian-Red filled
 *          and reads bright "ON" in dark ink, sitting at the right terminal.
 *          When OFF, the chip is dark with a neutral-40 border and reads
 *          "OFF" in bright neutral ink, sitting at the left terminal.
 *   Inactive terminal label: small, neutral-20, in the empty half of the
 *          track. Tells the user what the OTHER state would be.
 *
 * This avoids the previous bug where the active label and the knob were
 * the same Martian-Red — the chip is now the carrier of the active label,
 * which means the chip and its label can't visually fight each other.
 *
 * Click anywhere on the track flips state.
 */
function CcpToggle({ on, onChange, ariaLabel, disabled = false, disabledReason }: {
  on: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const W = 84;       // total track width
  const H = 26;
  const PAD = 2;      // inner padding from track edge to chip
  const CHIP_W = 38;  // active chip is roughly half the track
  const CHIP_H = H - PAD * 2;
  const inactiveLabelLeft  = on ? PAD + 6 : W - CHIP_W - PAD;
  const inactiveLabelText  = on ? "OFF" : "ON";
  const inactiveAlign      = on ? "flex-start" : "flex-end";
  const inactivePadX       = on ? "0 0 0 6px" : "0 6px 0 0";

  // Disabled palette — per the CCP design system disabled-state spec from
  // the components-form sheet, disabled controls go to neutral fills with
  // muted borders and no glow on hover.
  const trackBorder = disabled ? N40 : M;
  const chipBorder  = disabled ? N40 : (on ? M : N40);
  const chipBg      = disabled ? "#1A1A1A" : (on ? M : "#1A1A1A");
  const chipText    = disabled ? N40 : (on ? "#0A0A0A" : N);
  const labelColor  = disabled ? N20 : N20;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      title={disabled && disabledReason ? disabledReason : undefined}
      onClick={() => { if (!disabled) onChange(!on); }}
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
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 0 2px rgba(255,40,0,0.20)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
      }}
    >
      {/* Inactive-terminal label — sits in the empty half of the track
          and tells the user what flipping would do. */}
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
          color: labelColor,
          transition: "left 140ms ease, color 140ms ease",
          pointerEvents: "none",
        }}
      >{inactiveLabelText}</span>

      {/* The active chip — the knob carries the active state's label */}
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
          // Inset shadow to read as a physical chip over the track
          boxShadow: on
            ? "inset 0 0 0 1px rgba(0,0,0,0.30)"
            : "inset 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >{on ? "ON" : "OFF"}</span>
    </button>
  );
}

function CcpBtn({ children, small, variant, accent }: {
  children: React.ReactNode;
  small?: boolean;
  variant?: "solid" | "ghost";
  accent?: string;
}) {
  const isGhost = variant === "ghost";
  const c = accent ?? M;
  return (
    <button style={{
      background: isGhost ? "transparent" : c,
      border: `1px solid ${c}`,
      color: isGhost ? c : "#0B0B0B",
      padding: small ? "3px 8px" : "5px 12px",
      fontSize: small ? 10 : 11,
      fontFamily: FAMILY,
      fontWeight: 700,
      letterSpacing: "0.10em",
      textTransform: "uppercase",
      cursor: "pointer",
    }}>{children}</button>
  );
}
