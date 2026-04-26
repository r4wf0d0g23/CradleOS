/**
 * VariantD — CCP design system color & typography correction.
 *
 * Same structural layout as VariantCurrent, but applies the official CCP
 * tokens received 2026-04-25:
 *   • Martian Red #FF2800 (was #FF4700)
 *   • Neutral #FAFAE5 with 100/80/60/40 opacity hierarchy
 *   • Crude #050505 background
 *   • Disket Mono type scale with 0.08em tracking on UPPERCASE
 *   • Monochromatic icons (no per-kind decorative coloring)
 *   • Hairline 1px borders in neutral-20
 *   • Alternating zebra rows on the structure list
 */

import type { FixtureNode, FixtureStructure } from "./fixture";

type Summary = { structures: number; online: number; systems: number; hidden: number };
type Props = { nodes: FixtureNode[]; summary: Summary };

// CCP DS tokens as locals so this file is self-explanatory
const N = "#FAFAE5";
const N80 = "rgba(250,250,229,0.80)";
const N60 = "rgba(250,250,229,0.60)";
const N40 = "rgba(250,250,229,0.40)";
const N10 = "rgba(250,250,229,0.10)";
const M  = "#FF2800";
const M40 = "rgba(255,40,0,0.40)";
const M10 = "rgba(255,40,0,0.10)";
const ON = "#5DFF9A";

const FAMILY = '"Frontier Disket Mono", "Disket Mono", monospace';

export function VariantD({ nodes, summary }: Props) {
  return (
    <div style={{ fontFamily: FAMILY, color: N }}>
      {/* Summary bar */}
      <div style={{
        display: "flex",
        gap: 28,
        padding: "12px 16px",
        marginBottom: 4,
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${N10}`,
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
        gap: 10,
        padding: "10px 14px",
        marginBottom: 18,
        background: M10,
        border: `1px solid ${M40}`,
      }}>
        <span style={{ fontSize: 14, color: M }}>◆</span>
        <span style={{ fontSize: 12, color: N80, lineHeight: 1.5, letterSpacing: "0.01em" }}>
          <span style={{ color: M, fontWeight: 700 }}>ALL OF YOUR STRUCTURES ARE IN UNREVEALED SYSTEMS.</span>
          {" "}Their solar-system identity has not yet been written to the lattice.
        </span>
      </div>

      {/* Node groups */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {nodes.map(node => <NodeGroup key={node.objectId} node={node} />)}
      </div>
    </div>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <span>
      <span style={{ fontSize: 26, fontWeight: 700, color, letterSpacing: "0.02em" }}>{n}</span>
      <span style={{
        fontSize: 11,
        color: N60,
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
  const fuelColor = node.fuelLevelPct < 15 ? "#FFB54A" : node.fuelLevelPct < 50 ? "#FFB54A" : ON;
  const onlineDot = node.isOnline ? ON : M;

  return (
    <div style={{ border: `1px solid ${N10}`, background: "rgba(255,255,255,0.015)" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 14px",
        borderBottom: `1px solid ${N10}`,
      }}>
        <span style={{ color: N40, fontSize: 14 }}>◇</span>
        <span style={{
          color: N,
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}>{node.label}</span>
        <span style={{ color: N40, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          NETWORK NODE
        </span>
        <span style={{
          color: onlineDot,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.10em",
        }}>● {node.isOnline ? "ONLINE" : "OFFLINE"}</span>

        <div style={{ flex: 1 }} />

        {/* Fuel bar (segmented) */}
        <Segmented value={node.fuelLevelPct} color={fuelColor} segments={20} width={100} />
        <span style={{ fontSize: 11, color: N60, letterSpacing: "0.02em" }}>
          {node.fuelLevelPct}% · ~{node.fuelHoursLeft}h
        </span>

        {/* Energy bar */}
        <span style={{ fontSize: 11, color: N40, marginLeft: 6 }}>EP</span>
        <Segmented
          value={(node.fuelGjCurrent / node.fuelGjMax) * 100}
          color={N80}
          segments={20}
          width={100}
        />
        <span style={{ fontSize: 11, color: N60, letterSpacing: "0.02em" }}>
          {node.fuelGjCurrent}/{node.fuelGjMax} GJ
        </span>

        <span style={{
          fontSize: 11,
          color: N40,
          letterSpacing: "0.08em",
          marginLeft: 8,
          textTransform: "uppercase",
        }}>
          {node.children.length} STRUCT · {childOnline}↑ {childOffline}↓
        </span>

        <CcpBtn>{node.isOnline ? "OFFLINE" : "ONLINE"}</CcpBtn>
        <CcpBtn>EDIT</CcpBtn>
        <CcpBtn variant="ghost">DEFENSE</CcpBtn>
        <CcpBtn variant="ghost">GATES</CcpBtn>
      </div>

      {/* Structure cards (8-up grid, restyled with CCP tokens) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        gap: 0,
        borderTop: `1px solid ${N10}`,
      }}>
        {node.children.map((s, i) => (
          <StructureCard key={s.objectId} structure={s} index={i} />
        ))}
      </div>
    </div>
  );
}

function StructureCard({ structure, index }: { structure: FixtureStructure; index: number }) {
  // Zebra rows: alternate every other column horizontally for subtle separation
  const zebra = index % 2 === 0 ? "rgba(255,255,255,0.000)" : "rgba(255,255,255,0.025)";
  return (
    <div style={{
      borderRight: `1px solid ${N10}`,
      borderBottom: `1px solid ${N10}`,
      background: zebra,
      padding: "10px 8px",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      gap: 4,
      minHeight: 96,
    }}>
      <div style={{
        width: 18,
        height: 18,
        border: `1px solid ${N40}`,
        marginBottom: 2,
        display: "grid",
        placeItems: "center",
        color: N60,
        fontSize: 12,
        alignSelf: "center",
      }}>⊞</div>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: N,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        textAlign: "center",
      }}>{structure.label}</div>
      <div style={{ fontSize: 10, color: N40, textAlign: "center" }}>{structure.energyCost} EP</div>
      <div style={{ display: "flex", gap: 4, marginTop: "auto" }}>
        <CcpBtn small accent={structure.isOnline ? ON : M}>
          {structure.isOnline ? "ON" : "OFF"}
        </CcpBtn>
        <CcpBtn small variant="ghost">EDIT</CcpBtn>
      </div>
    </div>
  );
}

// ── Components ─────────────────────────────────────────────────────────────

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
      padding: small ? "3px 0" : "5px 12px",
      fontSize: small ? 10 : 11,
      fontFamily: FAMILY,
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      cursor: "pointer",
      flex: small ? 1 : undefined,
    }}>{children}</button>
  );
}
