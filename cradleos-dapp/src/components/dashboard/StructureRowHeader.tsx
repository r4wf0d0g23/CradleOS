/**
 * StructureRowHeader — column-label strip rendered once per node above
 * the StructureRow list. Uses the same density-driven grid template as
 * StructureRow so labels stay aligned at every container width.
 */

import {
  useDensity,
  gridTemplateFor,
  rowPaddingFor,
  rowGapFor,
  showObjId,
  showEp,
} from "./useDensity";

const N05 = "rgba(250,250,229,0.05)";
const N10 = "rgba(250,250,229,0.10)";
const N60 = "rgba(250,250,229,0.60)";

export function StructureRowHeader() {
  const density = useDensity();
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: gridTemplateFor(density),
      alignItems: "center",
      gap: rowGapFor(density),
      padding: rowPaddingFor(density),
      background: N05,
      borderBottom: `1px solid ${N10}`,
      fontSize: 10,
      color: N60,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      fontWeight: 700,
    }}>
      <span></span>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        NAME
      </span>
      {showEp(density)
        ? <span style={{ textAlign: "right" }}>EP</span>
        : <span />}
      {showObjId(density)
        ? <span style={{ textAlign: "right" }}>OBJ ID</span>
        : <span />}
      <span style={{ textAlign: "right" }}>
        {density === "tiny" ? "ACT" : density === "compact" ? "ACTIONS" : "STATUS · ACTIONS"}
      </span>
    </div>
  );
}
