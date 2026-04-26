/**
 * Realistic fixture data approximating the hidden-systems view from
 * the user's 2026-04-25 screenshot:
 *   • Network Node "Network Node" — ONLINE,  9% (~308h),  700/1000 GJ, 16 structures, 10 on / 6 off
 *   • Network Node "D1 Station"   — ONLINE, 86% (~3059h), 250/1000 GJ,  5 structures,  5 on / 0 off
 *   • Network Node "Network Node" — OFFLINE, 0% (~0h),    0/1000 GJ,    1 structure,   0 on / 1 off
 *
 * Used by all playground variants so they render identical data side-by-side.
 */

export type StructureKind =
  | "NetworkNode"
  | "MiniPrinter"
  | "MiniStorage"
  | "Nest"
  | "Nursery"
  | "Printer"
  | "Refinery"
  | "Shelter"
  | "Assembler"
  | "Berth"
  | "HeavyBerth"
  | "MiniBerth"
  | "Relay";

export interface FixtureStructure {
  objectId: string;
  label: string;             // visible label e.g. "Mini Printer"
  kind: StructureKind;
  isOnline: boolean;
  energyCost: number;        // EP cost
  energySourceId?: string;   // parent Network Node objectId
}

export interface FixtureNode {
  objectId: string;
  label: string;             // visible label e.g. "Network Node" or "D1 Station"
  kind: "NetworkNode";
  isOnline: boolean;
  fuelLevelPct: number;      // 0..100
  fuelHoursLeft: number;     // estimated hours remaining
  fuelGjCurrent: number;
  fuelGjMax: number;
  children: FixtureStructure[];
}

const node1Children: FixtureStructure[] = [
  { objectId: "0xs101", label: "Mini Printer",  kind: "MiniPrinter", isOnline: false, energyCost:  50, energySourceId: "0xn1" },
  { objectId: "0xs102", label: "Mini Storage",  kind: "MiniStorage", isOnline: false, energyCost:  50, energySourceId: "0xn1" },
  { objectId: "0xs103", label: "Nest",          kind: "Nest",        isOnline: false, energyCost:   0, energySourceId: "0xn1" },
  { objectId: "0xs104", label: "Nursery",       kind: "Nursery",     isOnline: false, energyCost: 100, energySourceId: "0xn1" },
  { objectId: "0xs105", label: "Printer",       kind: "Printer",     isOnline: false, energyCost: 100, energySourceId: "0xn1" },
  { objectId: "0xs106", label: "Refinery",      kind: "Refinery",    isOnline: false, energyCost: 100, energySourceId: "0xn1" },
  { objectId: "0xs107", label: "Refinery",      kind: "Refinery",    isOnline: false, energyCost: 100, energySourceId: "0xn1" },
  { objectId: "0xs108", label: "Refinery",      kind: "Refinery",    isOnline: false, energyCost: 100, energySourceId: "0xn1" },
  { objectId: "0xs109", label: "Refinery",      kind: "Refinery",    isOnline: false, energyCost: 100, energySourceId: "0xn1" },
  { objectId: "0xs110", label: "Shelter",       kind: "Shelter",     isOnline: false, energyCost:   0, energySourceId: "0xn1" },
  { objectId: "0xs111", label: "Assembler",     kind: "Assembler",   isOnline: true,  energyCost: 200, energySourceId: "0xn1" },
  { objectId: "0xs112", label: "Assembler",     kind: "Assembler",   isOnline: true,  energyCost: 200, energySourceId: "0xn1" },
  { objectId: "0xs113", label: "Berth",         kind: "Berth",       isOnline: true,  energyCost: 200, energySourceId: "0xn1" },
  { objectId: "0xs114", label: "Heavy Berth",   kind: "HeavyBerth",  isOnline: true,  energyCost: 300, energySourceId: "0xn1" },
  { objectId: "0xs115", label: "Mini Berth",    kind: "MiniBerth",   isOnline: true,  energyCost: 100, energySourceId: "0xn1" },
  { objectId: "0xs116", label: "Relay",         kind: "Relay",       isOnline: true,  energyCost:   1, energySourceId: "0xn1" },
];

const node2Children: FixtureStructure[] = [
  { objectId: "0xs201", label: "Mini Storage",  kind: "MiniStorage", isOnline: false, energyCost: 50, energySourceId: "0xn2" },
  { objectId: "0xs202", label: "Mini Storage",  kind: "MiniStorage", isOnline: false, energyCost: 50, energySourceId: "0xn2" },
  { objectId: "0xs203", label: "Mini Storage",  kind: "MiniStorage", isOnline: false, energyCost: 50, energySourceId: "0xn2" },
  { objectId: "0xs204", label: "Mini Storage",  kind: "MiniStorage", isOnline: false, energyCost: 50, energySourceId: "0xn2" },
  { objectId: "0xs205", label: "Mini Storage",  kind: "MiniStorage", isOnline: false, energyCost: 50, energySourceId: "0xn2" },
];

const node3Children: FixtureStructure[] = [
  { objectId: "0xs301", label: "Assembler", kind: "Assembler", isOnline: true, energyCost: 200, energySourceId: "0xn3" },
];

export const FIXTURE_NODES: FixtureNode[] = [
  {
    objectId: "0xn1",
    label: "Network Node",
    kind: "NetworkNode",
    isOnline: true,
    fuelLevelPct: 9,
    fuelHoursLeft: 308,
    fuelGjCurrent: 700,
    fuelGjMax: 1000,
    children: node1Children,
  },
  {
    objectId: "0xn2",
    label: "D1 Station",
    kind: "NetworkNode",
    isOnline: true,
    fuelLevelPct: 86,
    fuelHoursLeft: 3059,
    fuelGjCurrent: 250,
    fuelGjMax: 1000,
    children: node2Children,
  },
  {
    objectId: "0xn3",
    label: "Network Node",
    kind: "NetworkNode",
    isOnline: false,
    fuelLevelPct: 0,
    fuelHoursLeft: 0,
    fuelGjCurrent: 0,
    fuelGjMax: 1000,
    children: node3Children,
  },
];

// Aggregate stats (mirrors what the dashboard summary row shows)
export function fixtureSummary() {
  const allStructures = FIXTURE_NODES.flatMap(n => n.children);
  const allCount = allStructures.length + FIXTURE_NODES.length;  // include nodes themselves
  const onlineCount = allStructures.filter(s => s.isOnline).length
    + FIXTURE_NODES.filter(n => n.isOnline).length;
  return {
    structures: allCount,
    online: onlineCount,
    systems: 0,
    hidden: allCount,
  };
}
