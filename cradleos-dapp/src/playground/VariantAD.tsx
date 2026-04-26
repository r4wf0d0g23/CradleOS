/**
 * VariantAD — Tactical Status Rows (A) + CCP Token Correction (D).
 *
 * The combined direction: dense per-row layout PLUS the official CCP
 * design system tokens (Martian Red #FF2800, Disket Mono with proper
 * tracking, hairline neutral-20 borders, alternating zebra rows).
 *
 * This is the most "EVE Frontier-esque" of the four variants.
 */

import type { FixtureNode, FixtureStructure } from "./fixture";

type Summary = { structures: number; online: number; systems: number; hidden: number };
type Props = { nodes: FixtureNode[]; summary: Summary };

// CCP tokens
const N   = "#FAFAE5";
const N80 = "rgba(250,250,229,0.80)";
const N60 = "rgba(250,250,229,0.60)";
const N40 = "rgba(250,250,229,0.40)";
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
  const childOnline = node.children.filter(c => c.isOnline).length;
  const childOffline = node.children.length - childOnline;
  const fuelColor = node.fuelLevelPct < 15 ? "#FFB54A"
    : node.fuelLevelPct < 50 ? "#FFB54A" : ON;
  const onlineColor = node.isOnline ? ON : M;

  return (
    <div style={{ border: `1px solid ${N10}` }}>
      {/* Node header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto auto auto auto auto",
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
        <span style={{
          color: onlineColor,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.12em",
        }}>● {node.isOnline ? "ONLINE" : "OFFLINE"}</span>
        <BarChip label="FUEL" pct={node.fuelLevelPct}
          right={`~${node.fuelHoursLeft}h`} color={fuelColor} />
        <BarChip label="EP"
          pct={(node.fuelGjCurrent / node.fuelGjMax) * 100}
          right={`${node.fuelGjCurrent}/${node.fuelGjMax}`}
          color={N80} />
        <CcpBtn>{node.isOnline ? "OFFLINE" : "ONLINE"}</CcpBtn>
        <CcpBtn>EDIT</CcpBtn>
        <span style={{ display: "flex", gap: 6 }}>
          <CcpBtn variant="ghost">DEFENSE</CcpBtn>
          <CcpBtn variant="ghost">GATES</CcpBtn>
        </span>
      </div>

      {/* Column header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "32px 1fr 130px 70px 90px 90px 150px",
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
  const zebra = index % 2 === 0 ? "rgba(0,0,0,0)" : "rgba(255,255,255,0.025)";
  const statusColor = structure.isOnline ? ON : M;
  const glyph = KIND_GLYPH[structure.kind] ?? "◇";

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "32px 1fr 130px 70px 90px 90px 150px",
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
        color: N60,
        fontSize: 11,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
      }}>{structure.kind}</span>
      <span style={{
        color: N80,
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.02em",
      }}>{structure.energyCost} EP</span>
      <span style={{
        color: statusColor,
        textAlign: "center",
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: "0.12em",
      }}>● {structure.isOnline ? "ON" : "OFF"}</span>
      <span style={{
        color: N40,
        fontSize: 10,
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.04em",
      }}>{structure.objectId.slice(-6)}</span>
      <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <CcpBtn small accent={statusColor}>
          {structure.isOnline ? "OFFLINE" : "ONLINE"}
        </CcpBtn>
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
