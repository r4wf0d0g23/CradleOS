/**
 * VariantA — Tactical Status Rows.
 *
 * Replaces the 8-up grid of identical-size structure cards with dense
 * horizontal status rows (one structure per row). Each row mirrors the
 * EVE Frontier ship-info-panel pattern: alternating zebra background,
 * monochromatic line icon, label + secondary, right-aligned numerical
 * values, and inline action buttons.
 *
 * Trades visual variety for information density. Closer to actual
 * EF in-game UI patterns. Easier to scan many structures at once.
 *
 * Uses production color palette (legacy --ccp-* tokens, NOT corrected)
 * so it can be compared against VariantAD which adds the official tokens.
 */

import type { FixtureNode, FixtureStructure } from "./fixture";

type Summary = { structures: number; online: number; systems: number; hidden: number };
type Props = { nodes: FixtureNode[]; summary: Summary };

const FAMILY = '"Disket Mono", monospace';

// Glyph per structure kind — monochromatic, no decorative coloring
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

export function VariantA({ nodes, summary }: Props) {
  return (
    <div style={{ fontFamily: FAMILY, color: "#FAFAE5" }}>
      {/* Summary bar */}
      <div style={{
        display: "flex",
        gap: 28,
        padding: "12px 16px",
        marginBottom: 4,
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
        flexWrap: "wrap",
        alignItems: "baseline",
      }}>
        <Stat n={summary.structures} label="STRUCTURES" color="#FAFAE5" />
        <Stat n={summary.online}     label="ONLINE"     color="#5DFF9A" />
        <Stat n={summary.systems}    label="SYSTEMS"    color="#FF4700" />
        <Stat n={summary.hidden}     label="HIDDEN"     color="rgba(255,255,255,0.55)" />
      </div>

      {/* Banner */}
      <div style={{
        padding: "10px 14px",
        marginBottom: 18,
        background: "rgba(255,71,0,0.05)",
        border: "1px solid rgba(255,71,0,0.20)",
        fontSize: 12,
        color: "rgba(255,255,255,0.75)",
        lineHeight: 1.5,
      }}>
        <span style={{ color: "#FF4700", fontWeight: 700 }}>◆ ALL OF YOUR STRUCTURES ARE IN UNREVEALED SYSTEMS.</span>
        {" "}Their solar-system identity has not yet been written to the lattice.
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
      <span style={{ fontSize: 26, fontWeight: 700, color }}>{n}</span>
      <span style={{
        fontSize: 11,
        color: "rgba(255,255,255,0.55)",
        marginLeft: 8,
        letterSpacing: "0.08em",
        fontWeight: 700,
      }}> {label}</span>
    </span>
  );
}

function NodeGroup({ node }: { node: FixtureNode }) {
  const childOnline = node.children.filter(c => c.isOnline).length;
  const childOffline = node.children.length - childOnline;
  const fuelColor = node.fuelLevelPct < 15 ? "#FFB54A"
    : node.fuelLevelPct < 50 ? "#FFB54A" : "#5DFF9A";
  const onlineColor = node.isOnline ? "#5DFF9A" : "#FF4700";

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.10)" }}>
      {/* Node header — same density as before, just clean rules */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto auto auto auto auto",
        alignItems: "center",
        gap: 14,
        padding: "10px 14px",
        background: "rgba(255,255,255,0.02)",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
      }}>
        <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>
          {KIND_GLYPH.NetworkNode}
        </span>
        <span style={{
          color: "#FAFAE5",
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}>
          {node.label}
          <span style={{
            color: "rgba(255,255,255,0.45)",
            fontWeight: 400,
            fontSize: 11,
            marginLeft: 10,
            letterSpacing: "0.08em",
          }}>NETWORK NODE · {node.children.length} STRUCT · {childOnline}↑ {childOffline}↓</span>
        </span>
        <span style={{ color: onlineColor, fontSize: 11, fontWeight: 700, letterSpacing: "0.10em" }}>
          ● {node.isOnline ? "ONLINE" : "OFFLINE"}
        </span>
        <BarChip label="FUEL" pct={node.fuelLevelPct}
          right={`~${node.fuelHoursLeft}h`} color={fuelColor} />
        <BarChip label="EP"
          pct={(node.fuelGjCurrent / node.fuelGjMax) * 100}
          right={`${node.fuelGjCurrent}/${node.fuelGjMax}`}
          color="#FFD24A" />
        <ActionBtn>{node.isOnline ? "OFFLINE" : "ONLINE"}</ActionBtn>
        <ActionBtn>EDIT</ActionBtn>
        <span style={{ display: "flex", gap: 6 }}>
          <ActionBtn ghost>DEFENSE</ActionBtn>
          <ActionBtn ghost>GATES</ActionBtn>
        </span>
      </div>

      {/* Column header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "32px 1fr 110px 70px 80px 80px 130px",
        alignItems: "center",
        gap: 12,
        padding: "6px 14px",
        background: "rgba(255,255,255,0.015)",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
        fontSize: 10,
        color: "rgba(255,255,255,0.50)",
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        fontWeight: 700,
      }}>
        <span></span>
        <span>NAME</span>
        <span>KIND</span>
        <span style={{ textAlign: "right" }}>EP</span>
        <span style={{ textAlign: "center" }}>STATUS</span>
        <span style={{ textAlign: "right" }}>OBJ ID</span>
        <span style={{ textAlign: "right" }}>ACTIONS</span>
      </div>

      {/* Structure rows */}
      <div>
        {node.children.map((s, i) => (
          <StructureRow key={s.objectId} structure={s} index={i} />
        ))}
      </div>
    </div>
  );
}

function StructureRow({ structure, index }: { structure: FixtureStructure; index: number }) {
  const zebra = index % 2 === 0 ? "rgba(255,255,255,0.000)" : "rgba(255,255,255,0.020)";
  const statusColor = structure.isOnline ? "#5DFF9A" : "#FF4700";
  const glyph = KIND_GLYPH[structure.kind] ?? "◇";

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "32px 1fr 110px 70px 80px 80px 130px",
      alignItems: "center",
      gap: 12,
      padding: "8px 14px",
      background: zebra,
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      fontSize: 12,
    }}>
      <span style={{
        color: "rgba(255,255,255,0.55)",
        fontSize: 16,
        textAlign: "center",
      }}>{glyph}</span>
      <span style={{ color: "#FAFAE5", fontWeight: 400 }}>{structure.label}</span>
      <span style={{
        color: "rgba(255,255,255,0.50)",
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}>{structure.kind}</span>
      <span style={{
        color: "rgba(255,255,255,0.75)",
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
      }}>{structure.energyCost} EP</span>
      <span style={{
        color: statusColor,
        textAlign: "center",
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: "0.10em",
      }}>● {structure.isOnline ? "ON" : "OFF"}</span>
      <span style={{
        color: "rgba(255,255,255,0.40)",
        fontSize: 10,
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.04em",
      }}>{structure.objectId.slice(-6)}</span>
      <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <ActionBtn small accent={statusColor}>
          {structure.isOnline ? "OFFLINE" : "ONLINE"}
        </ActionBtn>
        <ActionBtn small ghost>EDIT</ActionBtn>
      </span>
    </div>
  );
}

function BarChip({ label, pct, right, color }: {
  label: string; pct: number; right: string; color: string;
}) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{
        fontSize: 10,
        color: "rgba(255,255,255,0.45)",
        letterSpacing: "0.08em",
      }}>{label}</span>
      <div style={{
        width: 60,
        height: 4,
        background: "rgba(255,255,255,0.10)",
      }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
      <span style={{
        fontSize: 10,
        color: "rgba(255,255,255,0.65)",
        fontVariantNumeric: "tabular-nums",
      }}>{Math.round(pct)}%</span>
      <span style={{
        fontSize: 10,
        color: "rgba(255,255,255,0.45)",
        fontVariantNumeric: "tabular-nums",
      }}>{right}</span>
    </span>
  );
}

function ActionBtn({ children, small, ghost, accent }: {
  children: React.ReactNode; small?: boolean; ghost?: boolean; accent?: string;
}) {
  const c = accent ?? "#FF4700";
  return (
    <button style={{
      background: ghost ? "transparent" : `rgba(${c === "#FF4700" ? "255,71,0" : "93,255,154"},0.10)`,
      border: `1px solid ${c}`,
      color: c,
      padding: small ? "3px 8px" : "5px 12px",
      fontSize: small ? 10 : 11,
      fontFamily: FAMILY,
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      cursor: "pointer",
    }}>{children}</button>
  );
}
