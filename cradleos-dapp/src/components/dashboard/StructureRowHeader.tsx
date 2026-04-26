/**
 * StructureRowHeader — column-label strip rendered once per node above
 * the StructureRow list. Same grid template as StructureRow so labels
 * line up exactly with the data they describe.
 */

const N05 = "rgba(250,250,229,0.05)";
const N10 = "rgba(250,250,229,0.10)";
const N60 = "rgba(250,250,229,0.60)";

export function StructureRowHeader() {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "32px 1fr 90px 90px 320px",
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
  );
}
