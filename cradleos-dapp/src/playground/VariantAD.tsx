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

function NodeGroup({ node }: { node: FixtureNode }) {
  const [nodeOn, setNodeOn] = useState(node.isOnline);
  const childOnline = node.children.filter(c => c.isOnline).length;
  const childOffline = node.children.length - childOnline;
  const fuelColor = node.fuelLevelPct < 15 ? "#FFB54A"
    : node.fuelLevelPct < 50 ? "#FFB54A" : ON;
  const onlineColor = nodeOn ? ON : M;
  const sorted = sortByFamily(node.children);

  return (
    <div style={{ border: `1px solid ${N10}` }}>
      {/* Node header. The standalone status badge was removed — the
          status dot is now rendered immediately next to the node toggle
          for the same read-order reasons as the structure rows. */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto auto",
        alignItems: "center",
        gap: 14,
        padding: "12px 18px",
        background: N05,
        borderBottom: `1px solid ${N10}`,
      }}>
        <span style={{ color: N40, fontSize: 14 }}>{KIND_GLYPH.NetworkNode}</span>
        <span style={{
          color: N,
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}>
          {node.label}
          <span style={{
            color: N40,
            fontWeight: 400,
            fontSize: 11,
            marginLeft: 12,
            letterSpacing: "0.10em",
          }}>NETWORK NODE · {node.children.length} STRUCT · {childOnline}↑ {childOffline}↓</span>
        </span>
        {/* Fuel + energy bar chips */}
        <BarChip label="FUEL" pct={node.fuelLevelPct}
          right={`${node.fuelUnitsLeft.toLocaleString()} u`} color={fuelColor} />
        <BarChip label="EP"
          pct={(node.fuelGjCurrent / node.fuelGjMax) * 100}
          right={`${node.fuelGjCurrent}/${node.fuelGjMax}`}
          color={N80} />
        {/* STATUS + power toggle + secondary actions, all clustered at right */}
        <span style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "flex-end",
        }}>
          <span style={{
            color: onlineColor,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            minWidth: 64,
            textAlign: "right",
          }}>● {nodeOn ? "ONLINE" : "OFFLINE"}</span>
          <CcpToggle on={nodeOn} onChange={setNodeOn} ariaLabel={`${node.label} power`} />
          <CcpBtn>EDIT</CcpBtn>
          <CcpBtn variant="ghost">DEFENSE</CcpBtn>
          <CcpBtn variant="ghost">GATES</CcpBtn>
        </span>
      </div>

      {/* Column header. STATUS column was removed — the status dot is now
          rendered alongside the toggle inside the ACTIONS cluster, which
          tightens the read order: object identity left, controls right. */}
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

      {/* Structure rows, family-clustered (mini-printer next to printer next
          to heavy-printer, etc.) but no group separators — just one continuous
          list. Zebra striping comes from row index, so the eye still picks
          up the row rhythm without visual category breaks. */}
      <div>
        {sorted.map((s, i) => (
          <StructureRow key={s.objectId} structure={s} index={i} />
        ))}
      </div>
    </div>
  );
}

function StructureRow({ structure, index }: { structure: FixtureStructure; index: number }) {
  const zebra = index % 2 === 0 ? "rgba(0,0,0,0)" : "rgba(255,255,255,0.025)";
  // Local state lets the playground demo the toggle interaction without
  // wiring real on-chain calls. Production will pass an onToggle handler.
  const [isOn, setIsOn] = useState(structure.isOnline);
  const statusColor = isOn ? ON : M;
  const glyph = KIND_GLYPH[structure.kind] ?? "◇";

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
        color: N80,
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.02em",
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
        <span style={{
          color: statusColor,
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: "0.12em",
          minWidth: 38,
          textAlign: "right",
        }}>● {isOn ? "ON" : "OFF"}</span>
        <CcpToggle on={isOn} onChange={setIsOn} ariaLabel={`${structure.label} power`} />
        <CcpBtn small variant="ghost">EDIT</CcpBtn>
      </span>
    </div>
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
function CcpToggle({ on, onChange, ariaLabel }: {
  on: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
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

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={() => onChange(!on)}
      style={{
        position: "relative",
        width: W,
        height: H,
        background: "#0A0A0A",
        border: `1px solid ${M}`,
        borderRadius: 0,
        padding: 0,
        cursor: "pointer",
        flexShrink: 0,
        transition: "box-shadow 120ms ease",
        fontFamily: "inherit",
      }}
      onMouseEnter={e => {
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
          color: N20,
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
          background: on ? M : "#1A1A1A",
          border: `1px solid ${on ? M : N40}`,
          color: on ? "#0A0A0A" : N,
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
