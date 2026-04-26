import { describe, it, expect } from "vitest";
import { sortByFamily } from "./sortByFamily";
import type { PlayerStructure } from "../../lib";

function s(partial: Partial<PlayerStructure> & { objectId: string; typeName?: string; label?: string; kind?: any; displayName?: string }): PlayerStructure {
  return {
    objectId: partial.objectId,
    ownerCapId: partial.ownerCapId ?? "0xowner",
    kind: (partial.kind ?? "Assembly") as any,
    typeFull: partial.typeFull ?? "",
    label: partial.label ?? partial.typeName ?? "",
    displayName: partial.displayName ?? partial.typeName ?? partial.label ?? "?",
    hasCustomName: false,
    isOnline: partial.isOnline ?? false,
    locationHash: "",
    typeName: partial.typeName,
  } as PlayerStructure;
}

describe("sortByFamily", () => {
  it("clusters mini-printer next to printer next to heavy printer", () => {
    const input = [
      s({ objectId: "0x3", typeName: "Heavy Printer" }),
      s({ objectId: "0x1", typeName: "Mini Printer" }),
      s({ objectId: "0x2", typeName: "Printer" }),
    ];
    const sorted = sortByFamily(input);
    expect(sorted.map(x => x.typeName)).toEqual([
      "Mini Printer",
      "Printer",
      "Heavy Printer",
    ]);
  });

  it("groups Smart Storage Unit family together", () => {
    const input = [
      s({ objectId: "0x4", typeName: "Heavy Storage Unit" }),
      s({ objectId: "0x1", typeName: "Smart Storage Unit" }),
      s({ objectId: "0x2", typeName: "Mini Storage Unit" }),
    ];
    const sorted = sortByFamily(input);
    expect(sorted.map(x => x.typeName)).toEqual([
      "Mini Storage Unit",
      "Smart Storage Unit",
      "Heavy Storage Unit",
    ]);
  });

  it("orders families by canonical FAMILY_ORDER", () => {
    const input = [
      s({ objectId: "0x4", typeName: "Refinery" }),
      s({ objectId: "0x1", typeName: "Smart Tether" }),
      s({ objectId: "0x2", typeName: "Network Node", kind: "NetworkNode" }),
      s({ objectId: "0x3", typeName: "Smart Storage Unit" }),
    ];
    const sorted = sortByFamily(input);
    expect(sorted.map(x => x.typeName)).toEqual([
      "Smart Tether",
      "Network Node",
      "Smart Storage Unit",
      "Refinery",
    ]);
  });

  it("sorts within same family by display name", () => {
    const input = [
      s({ objectId: "0x2", typeName: "Refinery", displayName: "Beta Refinery" }),
      s({ objectId: "0x1", typeName: "Refinery", displayName: "Alpha Refinery" }),
      s({ objectId: "0x3", typeName: "Refinery", displayName: "Gamma Refinery" }),
    ];
    const sorted = sortByFamily(input);
    expect(sorted.map(x => x.displayName)).toEqual([
      "Alpha Refinery",
      "Beta Refinery",
      "Gamma Refinery",
    ]);
  });

  it("places unknown-family kinds at the end alphabetically by family", () => {
    const input = [
      s({ objectId: "0x3", typeName: "Refinery" }),
      s({ objectId: "0x1", typeName: "Quanta Engine" }),
      s({ objectId: "0x2", typeName: "Beacon" }),
    ];
    const sorted = sortByFamily(input);
    // Refinery is in FAMILY_ORDER, the other two land at the end alphabetically by family stem
    expect(sorted[0].typeName).toBe("Refinery");
    // beacon < engine alphabetically
    expect(sorted[1].typeName).toBe("Beacon");
    expect(sorted[2].typeName).toBe("Quanta Engine");
  });

  it("falls back to kind when typeName is missing", () => {
    const input = [
      s({ objectId: "0x2", kind: "Turret", label: "Turret" }),
      s({ objectId: "0x1", kind: "NetworkNode", label: "Network Node" }),
    ];
    const sorted = sortByFamily(input);
    // Network nodes come before turrets in the canonical order
    expect(sorted[0].kind).toBe("NetworkNode");
    expect(sorted[1].kind).toBe("Turret");
  });

  it("does not mix online/offline within a family", () => {
    const input = [
      s({ objectId: "0x1", typeName: "Refinery", displayName: "A", isOnline: false }),
      s({ objectId: "0x2", typeName: "Refinery", displayName: "B", isOnline: true }),
      s({ objectId: "0x3", typeName: "Refinery", displayName: "C", isOnline: false }),
    ];
    // Family clustering wins; order is alphabetical by displayName regardless of online state
    const sorted = sortByFamily(input);
    expect(sorted.map(x => x.displayName)).toEqual(["A", "B", "C"]);
  });
});
