/**
 * VariantCurrent — replicates the production dashboard hidden-systems
 * structure-card view as it ships today (per the screenshot received
 * 2026-04-25 19:59 CDT). Uses inline styles only, no shared CSS, so it
 * stays an independent visual baseline as the production styling evolves.
 */

import type { FixtureNode } from "./fixture";

type Summary = { structures: number; online: number; systems: number; hidden: number };
type Props = { nodes: FixtureNode[]; summary: Summary };

const KIND_COLORS: Record<string, string> = {
  NetworkNode: "#FF4700",
  MiniPrinter: "#7B9EFF",
  Printer: "#7B9EFF",
  MiniStorage: "#FFD24A",
  Nest: "#A874FF",
  Nursery: "#A874FF",
  Refinery: "#A874FF",
  Shelter: "#5DD2FF",
  Assembler: "#A874FF",
  Berth: "#5DFF9A",
  HeavyBerth: "#5DFF9A",
  MiniBerth: "#5DFF9A",
  Relay: "#5DD2FF",
};

export function VariantCurrent({ nodes, summary }: Props) {
  return (
    <div style={{ fontFamily: "Disket Mono, monospace" }}>
      {/* Summary bar */}
      <div style={{
        display: "flex",
        gap: 20,
        padding: "10px 14px",
        marginBottom: 4,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        flexWrap: "wrap",
        alignItems: "center",
      }}>
        <Stat n={summary.structures} label="structures" color="#ddd" />
        <Stat n={summary.online}     label="online"     color="#00ff96" />
        <Stat n={summary.systems}    label="systems"    color="#FF4700" />
        <Stat n={summary.hidden}     label="hidden"     color="rgba(255,255,255,0.55)" />
      </div>

      {/* Banner */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        marginBottom: 14,
        background: "rgba(255,71,0,0.05)",
        border: "1px solid rgba(255,71,0,0.2)",
      }}>
        <span style={{ fontSize: 16, color: "#FF4700" }}>◆</span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
          <span style={{ color: "#FF4700", fontWeight: 700 }}>All of your structures are in unrevealed systems.</span>
          {" "}Their solar-system identity has not yet been written to the lattice.
        </span>
      </div>

      {/* Node groups */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {nodes.map(node => (
          <NodeGroup key={node.objectId} node={node} />
        ))}
      </div>
    </div>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <span>
      <span style={{ fontSize: 26, fontWeight: 700, color }}>{n}</span>
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}> {label}</span>
    </span>
  );
}

function NodeGroup({ node }: { node: FixtureNode }) {
  const childOnline = node.children.filter(c => c.isOnline).length;
  const childOffline = node.children.length - childOnline;
  const fuelBarColor = node.fuelLevelPct < 15 ? "#FFD24A"
    : node.fuelLevelPct < 50 ? "#FFB54A" : "#5DFF9A";

  return (
    <div style={{
      border: "1px solid rgba(93,255,154,0.12)",
      padding: 14,
      background: "rgba(93,255,154,0.02)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span style={{ color: "#FFB54A", fontSize: 18 }}>⚡</span>
        <span style={{ color: "#FFB54A", fontWeight: 700, fontSize: 16 }}>{node.label}</span>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Network Node</span>
        <span style={{
          color: node.isOnline ? "#5DFF9A" : "#FF4700",
          fontSize: 12,
          fontWeight: 700,
        }}>
          ● {node.isOnline ? "ONLINE" : "OFFLINE"}
        </span>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 90, height: 4, background: "rgba(255,255,255,0.1)" }}>
            <div style={{ width: `${node.fuelLevelPct}%`, height: "100%", background: fuelBarColor }} />
          </div>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
            {node.fuelLevelPct}% ({node.fuelUnitsLeft.toLocaleString()} u)
          </span>
        </div>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>⚡</span>
        <div style={{ width: 90, height: 4, background: "rgba(255,255,255,0.1)" }}>
          <div style={{
            width: `${(node.fuelGjCurrent / node.fuelGjMax) * 100}%`,
            height: "100%",
            background: "#FFD24A",
          }} />
        </div>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
          {node.fuelGjCurrent}/{node.fuelGjMax} GJ
        </span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
          {node.children.length} structures · {childOnline}↑ {childOffline}↓
        </span>
        <button style={btnStyle("#FF4700")}>{node.isOnline ? "OFFLINE" : "ONLINE"}</button>
        <button style={btnStyle("#FF4700")}>EDIT</button>
        <button style={btnStyle("#5DD2FF")}>● DEFENSE</button>
        <button style={btnStyle("#FFB54A")}>⫶⫶ GATES</button>
      </div>

      {/* Structure cards (8-up grid) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        gap: 8,
      }}>
        {node.children.map(s => (
          <StructureCard key={s.objectId} structure={s} />
        ))}
      </div>
    </div>
  );
}

function StructureCard({ structure }: { structure: any }) {
  return (
    <div style={{
      border: "1px solid rgba(93,255,154,0.10)",
      background: "rgba(0,0,0,0.4)",
      padding: 8,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
    }}>
      <div style={{
        width: 24,
        height: 24,
        border: "1px solid rgba(255,255,255,0.3)",
        marginBottom: 4,
        display: "grid",
        placeItems: "center",
        color: KIND_COLORS[structure.kind] || "#fff",
      }}>⊞</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#FAFAE5" }}>{structure.label}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{structure.label}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{structure.energyCost} EP</div>
      <div style={{ display: "flex", gap: 4, marginTop: 4, width: "100%" }}>
        <button style={miniBtnStyle(structure.isOnline ? "#5DFF9A" : "#FF4700")}>
          {structure.isOnline ? "ON" : "OFF"}
        </button>
        <button style={miniBtnStyle("rgba(255,255,255,0.5)")}>EDIT</button>
      </div>
    </div>
  );
}

function btnStyle(color: string): React.CSSProperties {
  return {
    background: "transparent",
    border: `1px solid ${color}`,
    color,
    padding: "4px 10px",
    fontSize: 11,
    fontFamily: "inherit",
    fontWeight: 700,
    letterSpacing: "0.06em",
    cursor: "pointer",
  };
}

function miniBtnStyle(color: string): React.CSSProperties {
  return {
    flex: 1,
    background: "transparent",
    border: `1px solid ${color}`,
    color,
    padding: "2px 0",
    fontSize: 10,
    fontFamily: "inherit",
    fontWeight: 700,
    letterSpacing: "0.04em",
    cursor: "pointer",
  };
}
