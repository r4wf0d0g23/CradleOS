/** Presentation only. Index positions map to unchanged version-1 payout symbols. */
import type { FleetKey, SlotFrame, SlotReceipt } from "./casinoSlotFleet";
export type ArtSymbol = { name: string; library: string };
export type SlotIdentity = {
  scene: string;
  title: [string, string];
  tagline: string;
  accent: string;
  secondary: string;
  wild: string;
  scatter: string;
  symbols: ArtSymbol[];
};
const art = (name: string, library: string): ArtSymbol => ({ name, library });
export const SLOT_IDENTITIES: Record<FleetKey, SlotIdentity> = {
  slot_scrapyard: {
    scene: "scrapyard",
    title: ["SCRAPYARD", "CIRCUIT"],
    tagline: "The salvage line",
    accent: "#e7b565",
    secondary: "#af673c",
    wild: "repairkit",
    scatter: "materials/technocore",
    symbols: [
      art("Circuit", "materials/printed_circuits"),
      art("Scrap alloy", "materials/reinforced_alloys"),
      art("Carbon spool", "materials/carbon_nanothread"),
      art("Thermal compound", "materials/thermal_composites"),
      art("Feldspar", "materials/feldspar"),
      art("Palladium ingot", "materials/palladium_refined_01"),
      art("Salvaged assembly", "components/ev/components_ev_parts-1"),
    ],
  },
  slot_wreckways: {
    scene: "wreckway",
    title: ["WRECKWAY", "243"],
    tagline: "Recover the lost cargo",
    accent: "#b6dbeb",
    secondary: "#547e9e",
    wild: "massrepairer",
    scatter: "cargoextenders_universal_64",
    symbols: [
      art("Hull plating", "components/ev/components_ev_surface"),
      art("Support frame", "components/ev/components_ev_structure"),
      art("Magazine", "components/ev/components_ev_ammo"),
      art("Coupling", "components/ev/components_ev_gear"),
      art("Power assembly", "components/ev/components_ev_energy"),
      art("Drive housing", "components/ev/components_ev_engine-l"),
      art("Control assembly", "components/ev/components_ev_control"),
    ],
  },
  slot_reactor: {
    scene: "reactor",
    title: ["REACTOR", "FALL"],
    tagline: "Feed the reaction",
    accent: "#ffb04f",
    secondary: "#e84226",
    wild: "reactor6",
    scatter: "reactor6",
    symbols: [
      art("Energy cell", "energycell"),
      art("Charge flask", "fuel_charge_1a_64"),
      art("Contained plasma", "fuel_confined_64"),
      art("Cooling fan", "activecooling"),
      art("Nuclear ore", "materials/nuclear_ore"),
      art("Fuel rod", "materials/plutonium_fuel"),
      art("Reactor core", "reactor6"),
    ],
  },
  slot_feral: {
    scene: "feral",
    title: ["FERAL", "SWARM"],
    tagline: "Break the machine mind",
    accent: "#c0f191",
    secondary: "#738f48",
    wild: "gr_smf",
    scatter: "materials/memory_fragment",
    symbols: [
      art("Chitin shell", "materials/chitin_shell"),
      art("Culture", "materials/biopolymers"),
      art("Metabolic gel", "materials/metabolic_scaffolding"),
      art("Red core", "gr_gsc1"),
      art("Blue core", "gr_smf"),
      art("Ancient core", "gr_snm1"),
      art("Memory spark", "materials/memory_fragment"),
    ],
  },
  slot_vault: {
    scene: "vault",
    title: ["NULL", "VAULT"],
    tagline: "Breach. Lock. Collect.",
    accent: "#e9d3a2",
    secondary: "#977756",
    wild: "gateaccesslicense",
    scatter: "gateaccesslicense",
    symbols: [
      art("Seal", "gateaccesslicense"),
      art("Core", "gr_sct1"),
      art("Fragment", "materials/memory_fragment"),
      art("Palladium", "materials/palladium_refined_01"),
      art("Crystal", "linear_crystal1"),
      art("Energy", "energycell"),
      art("Technocore", "materials/technocore"),
    ],
  },
  slot_gatecrash: {
    scene: "gatecrash",
    title: ["GATE", "CRASH"],
    tagline: "Punch through the frontier",
    accent: "#ea9dd3",
    secondary: "#945ba5",
    wild: "materials/technocore",
    scatter: "materials/memory_fragment",
    symbols: [
      art("Burner", "afterburner2"),
      art("Warp drive", "mwd3"),
      art("Access key", "gateaccesslicense"),
      art("Repulser", "repulser2"),
      art("Navigation unit", "components/ev/components_ev_navigation-s"),
      art("Warp crystal", "linear_crystal1"),
      art("Turbine", "fuel_engine_64"),
    ],
  },
  slot_drones: {
    scene: "drones",
    title: ["DRONE", "PROTOCOL"],
    tagline: "Reclaim the hardpoints",
    accent: "#80e7e1",
    secondary: "#3d989c",
    wild: "gr_sct1",
    scatter: "materials/memory_fragment",
    symbols: [
      art("Capacitor", "components/ev/components_ev_cap-s"),
      art("Drone rack", "components/ev/components_ev_eyrie-s"),
      art("Targeting unit", "components/ev/components_ev_targeting-s"),
      art("Actuator", "components/ev/components_ev_gear"),
      art("Weapon assembly", "components/ev/components_ev_weapon-s"),
      art("Micro engine", "components/ev/components_ev_engine-s"),
      art("Control drone", "components/ev/components_ev_control"),
    ],
  },
  slot_eclipse: {
    scene: "eclipse",
    title: ["ECLIPSE", "ROUTES"],
    tagline: "Read the alignment",
    accent: "#e6dfc1",
    secondary: "#b493da",
    wild: "linear_crystal4",
    scatter: "materials/memory_fragment",
    symbols: [
      art("Ice world", "frontier_res1"),
      art("Copper moon", "frontier_res11"),
      art("Violet anomaly", "frontier_res16"),
      art("Carbon remnant", "frontier_ore4"),
      art("Golden asteroid", "materials/feldspar"),
      art("Phase prism", "linear_crystal4"),
      art("Stellar fragment", "crystal2"),
    ],
  },
};
export const slotSymbol = (key: FleetKey, index: number) =>
  SLOT_IDENTITIES[key].symbols[index];

export const fullInitialVault = (game: FleetKey, frame?: SlotFrame) =>
  game === "slot_vault" &&
  frame?.kind === "spin" &&
  frame.coins.length === 15 &&
  frame.coins.every((n) => n > 0);
export const slotFrameLabel = (game: FleetKey, frame?: SlotFrame) =>
  fullInitialVault(game, frame)
    ? "FULL VAULT · COLLECTION READY"
    : (frame?.label ?? "READY");
export const slotAwaitingCollection = (receipt?: SlotReceipt) =>
  !!receipt &&
  receipt.cursor > 0 &&
  receipt.cursor < receipt.frames.length &&
  fullInitialVault(receipt.key, receipt.frames[receipt.cursor - 1]);
