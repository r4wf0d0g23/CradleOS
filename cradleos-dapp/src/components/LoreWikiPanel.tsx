/**
 * LoreWikiPanel — Community knowledge base for EVE Frontier.
 *
 * Anyone can publish articles covering Lore, Mechanics, Locations,
 * Factions, Ships, History, and more. Authors may edit or delete their
 * own articles. Upvotes are honor-system counters open to all.
 *
 * Data flow:
 *   ArticlePublished events → article IDs → suix_getDynamicFieldObject per ID
 *
 * If WIKI_BOARD is empty the panel shows a "not yet deployed" placeholder.
 */
import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { Transaction } from "@mysten/sui/transactions";
import { CRADLEOS_PKG, SUI_TESTNET_RPC, CLOCK, WIKI_BOARD, WIKI_MOD_CAP, eventType } from "../constants";

// Moderator address — holder of WikiModCap at deploy time
const WIKI_MOD_ADDRESS: string = ""; // populated after contract deploy

interface BuiltinArticle {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string;
  isBuiltin: true;
}

// ── Types ──────────────────────────────────────────────────────────────────────

type ArticleData = {
  articleId: number;
  title: string;
  content: string;
  category: string;
  author: string;
  tribeId: number;
  tags: string[];
  createdMs: number;
  editedMs: number;
  upvotes: number;
  downvotes: number;
};

type DisplayArticle =
  | ({ source: "onchain" } & ArticleData)
  | ({ source: "builtin" } & BuiltinArticle);

type StillnessType = {
  id?: string | number;
  name?: string;
  categoryName?: string;
  groupName?: string;
  mass?: number | string | null;
};

const CATEGORIES = ["Lore", "Mechanics", "Locations", "Factions", "Ships", "Assets", "History"] as const;
type Category = typeof CATEGORIES[number];

const STILLNESS_API = "https://world-api-stillness.live.tech.evefrontier.com";

const HIGH_GROUPS = new Set([
  "Energy Lance",
  "Mass Driver",
  "Coilgun",
  "Autocannon",
  "Howitzer",
  "Plasma",
  "Mining Laser",
  "Moon Drill",
]);

const MID_GROUPS = new Set([
  "Afterburner",
  "Engine",
  "Warp Accelerator",
  "Shield Generator",
  "Shield Restorer",
  "Field Array",
  "Stasis Web",
  "Warp Scrambler",
  "Heat Ejector",
  "Scanner",
]);

const LOW_GROUPS = new Set([
  "Armor Plate",
  "Armor Restorer",
  "Armor Repairer",
  "Nanitic Brace",
  "Cargo Grid",
  "Hull Repairer",
]);

const SHIP_ARTICLES: BuiltinArticle[] = [
  {
    id: "builtin-ship-87698", title: "Wend — Shuttle", category: "Ships", tags: ["shuttle", "wend", "basic-fuel"],
    content: `The Wend is a Shuttle-class vessel — the lightest hull in EVE Frontier.\n\nSLOT LAYOUT\nHigh: 1  |  Medium: 3  |  Low: 0\n\nFITTING\nCPU: 30 tf  |  Powergrid: 30 MW\nCapacitor: 32\n\nCOMBAT STATS\nStructure HP: 750\nMax Velocity: 260 m/s\n\nJUMP STATS\nMass: 6,800,000 kg (6.8 Mt)\nFuel Capacity: 200 (Basic fuel)\nFull-tank jump range (D1): ${((200 * 0.10) / (1e-7 * 6800000)).toFixed(1)} LY\n\nNOTES\nThe Wend uses basic fuel and has no low slots. Primarily suited for fast travel and light utility fits.`,
    isBuiltin: true,
  },
  {
    id: "builtin-ship-87846", title: "Recurve — Corvette", category: "Ships", tags: ["corvette", "recurve", "basic-fuel"],
    content: `The Recurve is a Corvette-class vessel balanced for general use.\n\nSLOT LAYOUT\nHigh: 2  |  Medium: 3  |  Low: 1\n\nFITTING\nCPU: 35 tf  |  Powergrid: 50 MW\nCapacitor: 50\n\nCOMBAT STATS\nStructure HP: 1,650\nMax Velocity: 405 m/s\n\nJUMP STATS\nMass: 10,200,000 kg (10.2 Mt)\nFuel Capacity: 970 (Basic fuel)\nFull-tank jump range (D1): ${((970 * 0.10) / (1e-7 * 10200000)).toFixed(1)} LY\n\nNOTES\nCompact Corvette with a balanced slot layout. Good entry-level hull for combat or exploration fits.`,
    isBuiltin: true,
  },
  {
    id: "builtin-ship-87847", title: "Reflex — Corvette", category: "Ships", tags: ["corvette", "reflex", "basic-fuel", "cap-heavy"],
    content: `The Reflex is a Corvette-class vessel with 4 medium slots — the highest mid-slot count in its class.\n\nSLOT LAYOUT\nHigh: 2  |  Medium: 4  |  Low: 1\n\nFITTING\nCPU: 32 tf  |  Powergrid: 35 MW\nCapacitor: 50\n\nCOMBAT STATS\nStructure HP: 1,250\nMax Velocity: 260 m/s\n\nJUMP STATS\nMass: 9,750,000 kg (9.75 Mt)\nFuel Capacity: 1,750 (Basic fuel)\nFull-tank jump range (D1): ${((1750 * 0.10) / (1e-7 * 9750000)).toFixed(1)} LY\n\nNOTES\nThe Reflex sacrifices velocity and low slots for extra medium slot depth. Suited for propulsion/shield-heavy mid-slot fits.`,
    isBuiltin: true,
  },
  {
    id: "builtin-ship-87848", title: "Reiver — Corvette", category: "Ships", tags: ["corvette", "reiver", "basic-fuel", "tackle"],
    content: `The Reiver is a fast Corvette-class vessel with equal high and low slots.\n\nSLOT LAYOUT\nHigh: 2  |  Medium: 2  |  Low: 2\n\nFITTING\nCPU: 35 tf  |  Powergrid: 50 MW\nCapacitor: 50\n\nCOMBAT STATS\nStructure HP: 1,900\nMax Velocity: 435 m/s\n\nJUMP STATS\nMass: 10,400,000 kg (10.4 Mt)\nFuel Capacity: 1,416 (Basic fuel)\nFull-tank jump range (D1): ${((1416 * 0.10) / (1e-7 * 10400000)).toFixed(1)} LY\n\nNOTES\nFastest Corvette at 435 m/s. The balanced H2/M2/L2 layout suits tackle or skirmish roles.`,
    isBuiltin: true,
  },
  {
    id: "builtin-ship-81609", title: "USV — Frigate", category: "Ships", tags: ["frigate", "usv", "advanced-fuel", "mining", "industrial"],
    content: `The USV is a Frigate-class vessel optimised for resource extraction.\n\nSLOT LAYOUT\nHigh: 2  |  Medium: 3  |  Low: 4\n\nFITTING\nCPU: 30 tf  |  Powergrid: 110 MW\nCapacitor: 45\n\nCOMBAT STATS\nStructure HP: 2,160\nMax Velocity: 280 m/s\n\nJUMP STATS\nMass: 30,266,600 kg (30.3 Mt)\nFuel Capacity: 2,420 (Advanced fuel)\nFull-tank range (D1): ${((2420 * 0.10) / (1e-7 * 30266600)).toFixed(1)} LY  |  (SOF-80): ${((2420 * 0.80) / (1e-7 * 30266600)).toFixed(1)} LY\n\nNOTES\nDeep low-slot count (4L) makes the USV ideal for stacking armor plates and cargo rigs. Low CPU limits active modules.`,
    isBuiltin: true,
  },
  {
    id: "builtin-ship-81904", title: "MCF — Frigate", category: "Ships", tags: ["frigate", "mcf", "advanced-fuel"],
    content: `The MCF is a Frigate-class vessel with high CPU for active module fits.\n\nSLOT LAYOUT\nHigh: 2  |  Medium: 3  |  Low: 2\n\nFITTING\nCPU: 60 tf  |  Powergrid: 100 MW\nCapacitor: 40\n\nCOMBAT STATS\nStructure HP: 2,400\nMax Velocity: 410 m/s\n\nJUMP STATS\nMass: 52,313,800 kg (52.3 Mt)\nFuel Capacity: 6,548 (Advanced fuel)\nFull-tank range (D1): ${((6548 * 0.10) / (1e-7 * 52313800)).toFixed(1)} LY  |  (SOF-80): ${((6548 * 0.80) / (1e-7 * 52313800)).toFixed(1)} LY\n\nNOTES\nHighest CPU of all frigates. Large fuel tank gives extended jump range despite heavy hull mass.`,
    isBuiltin: true,
  },
  {
    id: "builtin-ship-82424", title: "HAF — Frigate", category: "Ships", tags: ["frigate", "haf", "advanced-fuel", "combat"],
    content: `The HAF is a combat Frigate with the highest structure HP in its class.\n\nSLOT LAYOUT\nHigh: 2  |  Medium: 3  |  Low: 3\n\nFITTING\nCPU: 45 tf  |  Powergrid: 140 MW\nCapacitor: 50\n\nCOMBAT STATS\nStructure HP: 2,650\nMax Velocity: 440 m/s\n\nJUMP STATS\nMass: 81,883,000 kg (81.9 Mt)\nFuel Capacity: 4,184 (Advanced fuel)\nFull-tank range (D1): ${((4184 * 0.10) / (1e-7 * 81883000)).toFixed(1)} LY  |  (SOF-80): ${((4184 * 0.80) / (1e-7 * 81883000)).toFixed(1)} LY\n\nNOTES\nHighest powergrid output of all frigates (140 MW). Heaviest frigate hull. Suited for heavy weapon platforms.`,
    isBuiltin: true,
  },
  {
    id: "builtin-ship-82426", title: "LORHA — Frigate", category: "Ships", tags: ["frigate", "lorha", "advanced-fuel", "industry", "no-high"],
    content: `The LORHA is a Frigate-class industrial vessel with no high slots.\n\nSLOT LAYOUT\nHigh: 0  |  Medium: 2  |  Low: 4\n\nFITTING\nCPU: 32 tf  |  Powergrid: 110 MW\nCapacitor: 30\n\nCOMBAT STATS\nStructure HP: 2,155\nMax Velocity: 450 m/s — fastest frigate\n\nJUMP STATS\nMass: 42,691,300 kg (42.7 Mt)\nFuel Capacity: 2,508 (Advanced fuel)\nFull-tank range (D1): ${((2508 * 0.10) / (1e-7 * 42691300)).toFixed(1)} LY  |  (SOF-80): ${((2508 * 0.80) / (1e-7 * 42691300)).toFixed(1)} LY\n\nNOTES\nNo high slots — cannot fit weapons or high-slot tackle. Fastest frigate in the game. Deep low-slot layout for cargo/tank mods.`,
    isBuiltin: true,
  },
  {
    id: "builtin-ship-81808", title: "TADES — Destroyer", category: "Ships", tags: ["destroyer", "tades", "advanced-fuel", "combat"],
    content: `The TADES is a Destroyer-class vessel with the most high slots of any frigate-sized hull.\n\nSLOT LAYOUT\nHigh: 3  |  Medium: 4  |  Low: 2\n\nFITTING\nCPU: 125 tf  |  Powergrid: 280 MW\nCapacitor: 65\n\nCOMBAT STATS\nStructure HP: 2,600\nMax Velocity: 420 m/s\n\nJUMP STATS\nMass: 74,655,504 kg (74.7 Mt)\nFuel Capacity: 5,972 (Advanced fuel)\nFull-tank range (D1): ${((5972 * 0.10) / (1e-7 * 74655504)).toFixed(1)} LY  |  (SOF-80): ${((5972 * 0.80) / (1e-7 * 74655504)).toFixed(1)} LY\n\nNOTES\nHighest CPU and PG of the frigate-sized hulls. 3 high slots + 4 mid slots allows full weapon + mid utility fits. Classic DPS platform.`,
    isBuiltin: true,
  },
  {
    id: "builtin-ship-82430", title: "MAUL — Cruiser", category: "Ships", tags: ["cruiser", "maul", "advanced-fuel", "combat", "capital"],
    content: `The MAUL is a Cruiser-class combat vessel with extreme powergrid output.\n\nSLOT LAYOUT\nHigh: 4  |  Medium: 3  |  Low: 3\n\nFITTING\nCPU: 150 tf  |  Powergrid: 2,450 MW\nCapacitor: 80\n\nCOMBAT STATS\nStructure HP: 4,400\nMax Velocity: 400 m/s\n\nJUMP STATS\nMass: 548,435,968 kg (548.4 Mt)\nFuel Capacity: 24,160 (Advanced fuel)\nFull-tank range (D1): ${((24160 * 0.10) / (1e-7 * 548435968)).toFixed(1)} LY  |  (SOF-80): ${((24160 * 0.80) / (1e-7 * 548435968)).toFixed(1)} LY\n\nNOTES\nMassive PG output (2,450 MW) allows fitting capital-class weapons. Heaviest sub-capital hull. Large fuel tank offset by enormous mass.`,
    isBuiltin: true,
  },
  {
    id: "builtin-ship-81611", title: "Chumaq — Combat Battlecruiser", category: "Ships", tags: ["battlecruiser", "chumaq", "advanced-fuel", "capital", "no-high", "industrial"],
    content: `The Chumaq is a Combat Battlecruiser with enormous cargo capacity and no high slots.\n\nSLOT LAYOUT\nHigh: 0  |  Medium: 5  |  Low: 7\n\nFITTING\nCPU: 145 tf  |  Powergrid: 2,520 MW\nCapacitor: 80\n\nCOMBAT STATS\nStructure HP: 6,250 — highest in the game\nMax Velocity: 170 m/s — slowest hull\n\nJUMP STATS\nMass: 1,487,389,952 kg (1,487.4 Mt)\nFuel Capacity: 270,585 (Advanced fuel)\nFull-tank range (D1): ${((270585 * 0.10) / (1e-7 * 1487389952)).toFixed(1)} LY  |  (SOF-80): ${((270585 * 0.80) / (1e-7 * 1487389952)).toFixed(1)} LY\n\nNOTES\nLargest fuel tank in the game (270,585 units). No high slots. 7 low slots enables stacking cargo or armor. The definitive industrial capital.`,
    isBuiltin: true,
  },
];

const MECHANICS_ARTICLES: BuiltinArticle[] = [
  {
    id: "builtin-mech-jump",
    title: "Jump Mechanics — Fuel and Heat",
    category: "Mechanics",
    tags: ["jump", "fuel", "heat", "physics"],
    content: `Ships jump between solar systems using fuel consumed according to:\n\n  fuel_used = (distance_LY × FUEL_K × mass_kg) / quality\n  where FUEL_K = 1×10⁻⁷\n\nMAX JUMP RANGE is the minimum of two limits:\n\n1. FUEL-LIMITED RANGE\n   max_LY = (fuel_units × quality) / (FUEL_K × total_mass_kg)\n\n2. HEAT-LIMITED RANGE\n   max_LY = (ΔT × specificHeat × hull_mass) / (3 × total_mass)\n   where ΔT = 150 − current_star_temp\n\nHeat zones:\n  < 70 °C  — White Zone (optimal)\n  70–79 °C — Yellow Zone (caution)\n  80–89 °C — Orange Zone (danger)\n  ≥ 90 °C  — Red Zone (no jumps possible)\n\nADAPTIVE PROPULSION CALIBRATION (skill)\n  Each level increases effective specific heat by 2%:\n  cEff = specificHeat × (1 + level × 0.02)`,
    isBuiltin: true,
  },
  {
    id: "builtin-mech-fuel",
    title: "Fuel Types — Basic vs Advanced",
    category: "Mechanics",
    tags: ["fuel", "d1", "d2", "sof", "eu", "basic", "advanced"],
    content: `EVE Frontier uses two tiers of jump fuel:\n\nBASIC FUEL (Corvettes and Wend Shuttle only)\n  D1  — quality 0.10\n  D2  — quality 0.15\n\nADVANCED FUEL (Frigates, Destroyers, Cruisers, Battlecruisers)\n  SOF-40 — quality 0.40\n  EU-40  — quality 0.40\n  SOF-80 — quality 0.80\n  EU-90  — quality 0.90\n\nFuel quality directly multiplies jump range. Higher quality = longer jump per unit consumed.\n\nBasic hulls cannot use advanced fuel. Advanced hulls cannot use basic fuel.`,
    isBuiltin: true,
  },
  {
    id: "builtin-mech-fitting",
    title: "Ship Fitting — Slots, CPU, and Powergrid",
    category: "Mechanics",
    tags: ["fitting", "slots", "cpu", "powergrid", "modules"],
    content: `Every ship has three module slot types:\n\nHIGH SLOTS — weapons and offensive modules\n  Energy Lance, Coilgun, Autocannon, Howitzer, Plasma, Mining Laser\n\nMEDIUM SLOTS — propulsion, shield, and utility modules\n  Afterburners, Engines, Warp Accelerators, Shield Generators,\n  Shield Hardeners, Stasis Webs, Warp Scramblers, Heat Ejectors\n\nLOW SLOTS — armor and cargo modules\n  Armor Plates, Armor Repairers, Nanitic Braces, Cargo Grids, Hull Repairers\n\nFITTING CONSTRAINTS\n  Each module costs CPU (tf) and Powergrid (MW).\n  Total cost must not exceed ship's CPU/PG output.\n  Modules also add mass — reducing jump range.\n\nNote: CPU/PG costs per module are not yet exposed by the CCP API.\n  Module mass impact on jump range is calculable from known module mass values.`,
    isBuiltin: true,
  },
  {
    id: "builtin-mech-weapons",
    title: "Weapon Types — Turrets and Damage Profiles",
    category: "Mechanics",
    tags: ["weapons", "damage", "turrets", "combat"],
    content: `EVE Frontier features four weapon categories, each with distinct damage profiles:\n\nENERGY LANCE (Tuho / Xoru series)\n  Damage type: Electromagnetic\n  Fits: High slots\n  Variants: S-class (Tuho 7/9/S), M-class (Xoru 7/9/S)\n\nMASSK DRIVER / COILGUN\n  Damage type: Kinetic\n  Fits: High slots\n  Variants: Base / Tier 2 / Tier 3, S and M sizes\n\nPROJECTILE (Autocannon / Howitzer)\n  Damage type: Explosive/Kinetic\n  Fits: High slots\n  Turret variants: Base Autocannon (S), Turret Autocannon, Base Howitzer (M), Turret Howitzer\n\nPLASMA\n  Damage type: Thermal\n  Fits: High slots\n  Variants: Base Rapid Plasma (S/M), Tier 2/3\n\nMINING LASER\n  Type: Resource extraction (not combat)\n  Fits: High slots\n  Variants: Small/Medium/Purified Moon Cutting Laser, Crude Extractor`,
    isBuiltin: true,
  },
  {
    id: "builtin-mech-defense",
    title: "Defense Modules — Tank Types",
    category: "Mechanics",
    tags: ["defense", "armor", "shield", "tank", "fitting"],
    content: `EVE Frontier ships have three hit point layers: Shield, Armor, and Structure.\nAll three start at base values defined by the ship hull.\nModules modify these values:\n\nSHIELD (Medium slots)\n  Bulwark Shield Generator — adds shield HP\n  Attuned Shield Generator — adds shield HP\n  Reinforced Shield Generator — adds shield HP\n  Shield Restorer — increases shield recharge\n  EM/Thermal/Explosive/Kinetic Field Array — shield resistances\n  Note: Shield regenerates passively. Active regen requires Shield Restorer.\n\nARMOR (Low slots)\n  Bulky Armor Plates — high HP bonus, high mass penalty\n  Coated Armor Plates — balanced HP/mass\n  Reactive Armor Plates — reactive resist bonus\n  Nimble Armor Plates — low mass penalty\n  Systematic Armor Restorer — active armor repair\n  Nanitic Brace variants — armor resist bonuses by damage type\n\nSTRUCTURE (Low slots)\n  Hull Repairer — active structure repair\n  Structure does not regen passively.\n\nNote: Detailed HP values and fitting costs are pending CCP API data exposure.`,
    isBuiltin: true,
  },
  {
    id: "builtin-mech-smartgates",
    title: "Smart Gates — Tribe Infrastructure",
    category: "Mechanics",
    tags: ["smartgate", "gate", "infrastructure", "tribe", "access"],
    content: `Smart Gates are player-deployable stargates built on Smart Storage Units (SSUs).\nThey connect two solar systems and can be configured for access control.\n\nACCESS POLICIES\n  Open     — any rider may use the gate\n  Tribe Only — only tribe members may pass\n  Whitelist  — only addresses on the gate's whitelist may pass\n  Closed   — gate is locked to all traffic\n\nTOLL\n  Tribe operators can set a CRDL toll for gate passage.\n  Toll is collected in CRADLE_COIN and deposited into the tribe vault.\n\nGATE PROFILES (CradleOS)\n  CradleOS extends gate management with on-chain profiles.\n  Each vault can manage gate access, whitelists, and toll configuration\n  directly from the tribe dashboard.\n\nON-CHAIN DATA\n  Gate passage events (PassageLogged) are recorded on Sui testnet.\n  Query live data via the CradleOS Intel Dashboard.`,
    isBuiltin: true,
  },
  {
    id: "builtin-mech-tribes",
    title: "Tribes — Player Organisations",
    category: "Mechanics",
    tags: ["tribe", "corporation", "organisation", "crdl"],
    content: `Tribes are the primary player organisation structure in EVE Frontier.\nThey are equivalent to corporations in other EVE games.\n\nFORMING A TRIBE\n  Any rider can create a tribe using the EVE Frontier client.\n  Tribes have a tax rate, short name (ticker), and optional URL.\n\nTRIBE INFRASTRUCTURE\n  Tribes can deploy Smart Storage Units (SSUs) and Smart Gates.\n  These structures are owned by the tribe and protected by its members.\n\nCRADLEOS TRIBE MANAGEMENT\n  CradleOS provides on-chain infrastructure for tribe economies:\n  - CRDL token (CRADLE_COIN) for internal tribal finance\n  - Tribe Vault for treasury management\n  - Smart Gate access profiles\n  - Bounty contracts, cargo contracts, succession planning\n  - Announcement boards, recruiting terminals, lore wiki\n\nOn Stillness, there are currently ${2} tribes registered via the live API.`,
    isBuiltin: true,
  },
  {
    id: "builtin-mech-cradleos",
    title: "CradleOS — Tribe Command Stack",
    category: "Mechanics",
    tags: ["cradleos", "crdl", "tribe", "sui", "hackathon"],
    content: `CradleOS is a wallet-native tribe command stack built on Sui Move for EVE Frontier.\n\nCORE MODULES (on-chain, Sui testnet)\n  - cradle_coin    — CRDL token (infra-backed tribe currency)\n  - tribe_vault    — tribal treasury with DEX/registry/defense\n  - defense_policy — smart gate access control via on-chain policy\n  - bounty_contract — trustless kill bounties with attestor model\n  - cargo_contract  — escrow cargo delivery contracts\n  - gate_profile    — on-chain gate access/toll configuration\n  - inheritance     — succession planning (testament deeds)\n  - announcement_board — on-chain tribe announcements\n  - recruiting_terminal — on-chain application/review system\n  - lore_wiki       — decentralised knowledge base (this wiki)\n\nPACKAGE\n  Deployed on Sui Testnet\n  Package ID: 0x97c4350fc23fbb18de9fad6ef9de6290c98c4f4e57958325ffa0a16a21b759b4\n\nDEVELOPMENT\n  CradleOS is actively developed for the EVE Frontier Hackathon 2026.\n  Source: github.com/r4wf0d0g23/Reality_Anchor_Eve_Frontier_Hackathon_2026`,
    isBuiltin: true,
  },
];

const STRUCTURE_ARTICLES: BuiltinArticle[] = [
  {
    id: "builtin-structure-network-node",
    title: "Network Node — Installation Heart",
    category: "Mechanics",
    tags: ["structure", "network-node", "fuel", "energy", "infrastructure"],
    content: `The Network Node is the central hub of every player-built installation in EVE Frontier.\n\nROLE\nRequired for all other structures to function. Every SSU, turret, gate, refinery, and hangar at a location must be connected to a Network Node to operate. Without it, all connected structures go offline.\n\nENERGY\nThe node provides energy to connected structures. Each online structure draws a fixed energy allocation from the node's fuel supply. The node's current fuel level determines how many structures can be kept online simultaneously — when fuel runs low, structures begin dropping offline.\n\nFUEL MANAGEMENT\nFuel must be regularly resupplied to keep the node running. Monitoring fuel levels is critical for tribe infrastructure ops. CradleOS provides fuel tracking via the tribe vault dashboard.`,
    isBuiltin: true,
  },
  {
    id: "builtin-structure-ssu",
    title: "Smart Storage Unit (SSU)",
    category: "Mechanics",
    tags: ["structure", "ssu", "storage", "inventory", "tribe"],
    content: `The Smart Storage Unit (SSU) is the primary storage structure for player deployments.\n\nFUNCTION\nHolds resources, modules, and manufactured goods. Acts as the anchor point for tribe infrastructure — gates, turrets, and other deployables are associated with an SSU in the game world.\n\nACCESS CONTROL\nOwners can configure the SSU to allow:\n  - Owner only (private)\n  - Tribe members\n  - Public (any rider)\n\nINVENTORY\nThe SSU inventory is accessible via the CradleOS dApp UI for authorized users. Tribe members can deposit and withdraw items within the configured access policy.\n\nINFRASTRUCTURE ANCHOR\nAll other structures (turrets, gates, refineries, hangars) must be deployed in proximity to a Network Node. The SSU serves as the logical grouping point for tribe assets at a location.`,
    isBuiltin: true,
  },
  {
    id: "builtin-structure-assembly",
    title: "Smart Assembly Unit",
    category: "Mechanics",
    tags: ["structure", "assembly", "manufacturing", "blueprints", "crafting"],
    content: `The Smart Assembly Unit is a manufacturing facility deployable at tribe installations.\n\nFUNCTION\nAccepts blueprint inputs and raw materials, then outputs manufactured goods. Supports production of modules, consumables, and other items defined by available blueprints.\n\nPRODUCTION FLOW\n  1. Load blueprint into the assembly queue\n  2. Deposit required raw material inputs\n  3. Start the assembly job\n  4. Wait for the timer to complete\n  5. Collect the output goods\n\nASSEMBLY TIME\nJob duration scales with blueprint complexity and tier. Higher-tier blueprints require more time and more advanced inputs. Tribe members with access can queue and manage jobs via the dApp.\n\nINTEGRATION\nThe Smart Assembly Unit must be connected to an active Network Node to function. Energy draw is proportional to active job load.`,
    isBuiltin: true,
  },
  {
    id: "builtin-structure-turret",
    title: "Smart Turret",
    category: "Mechanics",
    tags: ["structure", "turret", "defense", "pve", "pvp", "tribe"],
    content: `The Smart Turret is an automated defense structure that fires on hostile ships.\n\nFUNCTION\nAutomatically targets and fires on ships that match the tribe's defense policy. Turrets operate continuously while the Network Node has fuel and the structure is online.\n\nSIZES\nThree hull sizes are available:\n  S — Small turret (lighter hull targets)\n  M — Medium turret (frigate/destroyer class)\n  B — Large/Battle turret (heavier hull targets)\n\nDEFENSE POLICY\nTurret behavior is governed by the TribeDefensePolicy on-chain object. Members must delegate individual turrets to the tribe vault to allow tribe-level policy enforcement. Without delegation, a turret only uses the owner's personal settings.\n\nSee: Turret Delegation article for the delegation flow.\n\nFIRING LOGIC\nTurrets fire on ships whose player relation is set to HOSTILE in the active defense policy. Green/friendly players pass without being targeted. Alert level (GREEN/YELLOW/RED) modifies engagement range and aggression.`,
    isBuiltin: true,
  },
  {
    id: "builtin-structure-gate",
    title: "Smart Gate",
    category: "Mechanics",
    tags: ["structure", "gate", "access", "travel", "tribe", "gatepolicy"],
    content: `The Smart Gate controls rider access between solar systems.\n\nFUNCTION\nAllows or blocks ship passage between two connected solar systems. Gate access is configurable by the owner and enforced on-chain via the CradleOS GatePolicy contract.\n\nACCESS MODES\n  OPEN        — any rider may pass\n  TRIBE ONLY  — restricted to registered tribe members\n  ALLIES      — tribe members and whitelisted allies\n  CLOSED      — gate locked to all traffic\n\nGATE POLICY CONTRACT\nCradleOS enforces gate access via the gate_profile Move module on Sui. Each gate linked to a tribe vault inherits the vault's configured access policy. Tribe admins can modify gate policies from the CradleOS dashboard.\n\nTOLL\nTribe gates can be configured to charge a CRDL toll for passage. Toll payments are deposited directly into the tribe vault treasury.\n\nMEMBER DELEGATION\nIndividual gate operators can delegate gate control to the tribe vault, allowing centralized policy management. See: Gate Access Control article for full details.`,
    isBuiltin: true,
  },
  {
    id: "builtin-structure-refinery",
    title: "Smart Refinery",
    category: "Mechanics",
    tags: ["structure", "refinery", "ore", "materials", "industry"],
    content: `The Smart Refinery processes raw asteroid ore and other harvested materials into refined components.\n\nFUNCTION\nAccepts raw ore and asteroid materials as input. Outputs refined components used in manufacturing blueprints and ship construction.\n\nPROCESSING FLOW\n  1. Deposit raw ore or asteroid materials into the refinery input\n  2. Start a refining job\n  3. Wait for the processing timer\n  4. Collect refined output components\n\nYIELD\nRefining yield depends on the input material type and quality. Higher-grade ore produces a greater ratio of refined output. Tribe refineries benefit from proximity to resource-rich asteroid belts.\n\nINTEGRATION\nMust be connected to an active Network Node. Energy consumption scales with active refining load.`,
    isBuiltin: true,
  },
  {
    id: "builtin-structure-shipyard",
    title: "Smart Shipyard",
    category: "Mechanics",
    tags: ["structure", "shipyard", "construction", "ships", "blueprints"],
    content: `The Smart Shipyard constructs new ships from blueprints and component materials.\n\nFUNCTION\nAccepts ship blueprints and the required component materials as inputs. Outputs completed ship hulls ready to be fitted and flown.\n\nCONSTRUCTION FLOW\n  1. Load a ship blueprint into the production queue\n  2. Deposit all required component materials\n  3. Start the construction job\n  4. Wait for the build timer to complete\n  5. Claim the finished ship hull\n\nBLUEPRINT TIERS\nShip blueprints exist in multiple tiers corresponding to hull class. Frigates and destroyers require advanced-tier blueprints and refined components. Capital-class hulls demand significantly more materials and construction time.\n\nINTEGRATION\nRequires an active Network Node connection. Finished ships can be stored directly in a co-located Smart Hangar.`,
    isBuiltin: true,
  },
  {
    id: "builtin-structure-hangar",
    title: "Smart Hangar",
    category: "Mechanics",
    tags: ["structure", "hangar", "ships", "dock", "tribe"],
    content: `The Smart Hangar stores fitted and unfitted ships, allowing members to dock and undock.\n\nFUNCTION\nA persistent ship storage structure at tribe installations. Members with hangar access can dock their ships, store fitted hulls, and undock when ready to deploy.\n\nACCESS\nHangar access is configured by the owner — typically restricted to tribe members. Public hangars are possible but uncommon due to security concerns.\n\nDOCKING FLOW\n  1. Approach the installation within docking range\n  2. Request dock via the in-game UI\n  3. Ship is stored with fitting intact\n  4. Undock via the dApp or in-game client when ready\n\nSTORAGE\nThe hangar stores both the ship hull and its fitted modules. Stored ships do not consume fuel or generate a killmail while docked.\n\nINTEGRATION\nConnects to the Network Node for power. Co-located with Smart Shipyard for direct transfer of newly built hulls.`,
    isBuiltin: true,
  },
];

const DEFENSE_ARTICLES: BuiltinArticle[] = [
  {
    id: "builtin-defense-turret-delegation",
    title: "Turret Delegation",
    category: "Mechanics",
    tags: ["defense", "turret", "delegation", "tribe", "on-chain"],
    content: `Turret Delegation allows tribe members to assign their personally owned turrets to follow the tribe's TribeDefensePolicy on-chain.\n\nWHY DELEGATE\nBy default, a turret only enforces the owner's personal settings. To have turrets follow tribe-wide defense policy (alert levels, player relations, aggression mode), each turret must be delegated to the tribe vault.\n\nDELEGATION FLOW\n  1. The turret owner calls delegate_to_tribe() on the defense_policy module\n  2. This creates a TurretDelegation object owned by the tribe vault\n  3. The turret now inherits the tribe's active TribeDefensePolicy\n  4. Changes to the tribe policy automatically apply to all delegated turrets\n\nTURRET DELEGATION OBJECT\nThe TurretDelegation object is stored on-chain under the tribe vault. It records:\n  - Turret ID\n  - Delegating member address\n  - Timestamp of delegation\n  - Associated tribe vault ID\n\nREVOKE FLOW\nTo revoke delegation:\n  1. The turret owner (or a tribe admin) calls the revoke function\n  2. The TurretDelegation object is destroyed\n  3. The turret returns to owner-only policy\n\nNOTE\nDelegated turrets follow tribe policy until explicitly revoked. Tribe admins can also revoke delegations to remove inactive member turrets from the tribe defense network.`,
    isBuiltin: true,
  },
  {
    id: "builtin-defense-policy-levels",
    title: "Defense Policy Levels",
    category: "Mechanics",
    tags: ["defense", "alert", "green", "yellow", "red", "aggression", "policy"],
    content: `The TribeDefensePolicy defines three security alert levels and an aggression mode toggle that govern how tribe turrets and gates respond to incoming ships.\n\nALERT LEVELS\n\nGREEN — Low Alert\n  The default peacetime setting. Turrets are operational but engage only ships explicitly marked HOSTILE in player relations. Neutral players pass freely. Gate access follows configured policy without additional checks.\n\nYELLOW — Caution\n  Elevated readiness. Turrets extend engagement range and may target ships with no explicit FRIENDLY tag. Unknown players (not in tribe or whitelist) are treated with caution. Gate challenges may be issued.\n\nRED — Full Defense\n  Maximum security posture. Turrets engage all ships not explicitly FRIENDLY. Unknown and neutral players are treated as hostile. Gates may lock down to TRIBE ONLY or CLOSED automatically depending on config.\n\nAGGRESSION MODE TOGGLE\nSeparate from alert level, the aggression toggle switches between:\n  PASSIVE — turrets only fire when fired upon (PvE-friendly)\n  ACTIVE  — turrets proactively engage hostile-flagged ships on sight\n\nPOLICY CHANGES\nAlert level and aggression mode are set by tribe admins via the CradleOS tribe dashboard. Changes propagate immediately to all delegated turrets and associated gates.`,
    isBuiltin: true,
  },
  {
    id: "builtin-defense-player-relations",
    title: "Player Relations",
    category: "Mechanics",
    tags: ["defense", "relations", "hostile", "friendly", "override", "policy"],
    content: `Player Relations allow per-player HOSTILE or FRIENDLY overrides on the tribe's TribeDefensePolicy, superseding tribe-level defaults for specific riders.\n\nOVERRIDE SYSTEM\nEach player in EVE Frontier has a default relation determined by their tribe membership status and the active alert level. Player Relations allow fine-grained overrides:\n\n  HOSTILE override — this player is always engaged by tribe turrets regardless of alert level or tribe membership\n  FRIENDLY override — this player always passes safely, even at RED alert\n\nUSE CASES\n  - Mark a known pirate HOSTILE permanently\n  - Grant a trusted neutral FRIENDLY status to allow gate passage\n  - Temporarily HOSTILE a disgraced ex-member even after they leave the tribe\n\nPRECEDENCE\nPlayer-level HOSTILE/FRIENDLY overrides take precedence over tribe-level defaults. The override hierarchy is:\n  1. Player-specific override (highest priority)\n  2. Tribe membership status\n  3. Active alert level default behavior\n\nMANAGEMENT\nTribe admins and officers can set player relations via the CradleOS defense policy interface. Changes apply in real time to all delegated turrets.`,
    isBuiltin: true,
  },
];

const GATE_ARTICLES: BuiltinArticle[] = [
  {
    id: "builtin-gate-access-control",
    title: "Gate Access Control",
    category: "Mechanics",
    tags: ["gate", "access", "open", "closed", "tribe", "allies", "delegation"],
    content: `Smart Gate access is governed by a configurable policy that determines which riders can use a gate to travel between solar systems.\n\nACCESS LEVELS\n\nOPEN\n  Any rider may use the gate. No restrictions. Commonly used for public infrastructure or neutral transit corridors.\n\nTRIBE ONLY\n  Only members registered in the tribe vault may pass. All others are denied. Default for secure tribe logistics routes.\n\nALLIES\n  Tribe members plus explicitly whitelisted players or allied tribes may pass. Useful for coalition logistics where multiple tribes cooperate without making a gate fully public.\n\nCLOSED\n  Gate is locked to all traffic, including tribe members. Used during emergencies, wartime lockdowns, or when a gate is temporarily taken offline.\n\nTRIBE-LEVEL OVERRIDES\nThe tribe vault admin can change the gate's access level at any time via the CradleOS gate_profile module. Changes are enforced on-chain immediately.\n\nPLAYER-LEVEL OVERRIDES\nIndividual players can be whitelisted or blacklisted on a gate regardless of tribe membership. A blacklisted tribe member is denied even at TRIBE ONLY access. A whitelisted outsider is admitted even at TRIBE ONLY.\n\nGATE DELEGATION FLOW\n  1. Gate operator calls the delegation function in gate_profile\n  2. The gate is linked to the tribe vault\n  3. Gate policy is now managed centrally from the tribe dashboard\n  4. Access changes made in the dashboard propagate to the gate immediately\n  5. To revoke: operator calls undelegate; gate returns to owner-only management\n\nTOLL CONFIGURATION\nOptionally, a CRDL toll can be set per gate. Toll is collected on passage and deposited into the tribe vault treasury.`,
    isBuiltin: true,
  },
];

const TRIBE_ARTICLES: BuiltinArticle[] = [
  {
    id: "builtin-tribe-vault",
    title: "Tribe Vault",
    category: "Mechanics",
    tags: ["tribe", "vault", "crdl", "treasury", "on-chain", "sui"],
    content: `The TribeVault is the central on-chain object representing a tribe's treasury and governance anchor in CradleOS.\n\nWHAT IT HOLDS\n  - CRDL tribe tokens (CRADLE_COIN) — the tribe's internal currency for operations, tolls, and bounties\n  - Infra credits — spendable balance for deploying and maintaining tribe infrastructure\n  - Founder address — the original tribe creator with highest authority\n  - Member registry — on-chain list of current tribe members with their assigned roles\n  - Defense policy link — reference to the tribe's active TribeDefensePolicy object\n\nCRDL TRIBE TOKENS\nThe tribe vault holds and distributes CRDL tokens earned from gate tolls, bounty contracts, and other economic activity. Admins can allocate CRDL to members via the tribe dashboard.\n\nINFRA CREDITS\nInfra credits cover the operational costs of tribe structures. Depleting infra credits causes structures to begin going offline. Regular top-ups are required for active installations.\n\nFOUNDER vs MEMBERS\nThe founder has full control over the vault at creation. Over time, roles can be delegated to trusted members. The founder retains a special authority that cannot be overridden by other roles.\n\nCREATION\nA tribe vault is created during the registry claim flow (see Registry article). Once created, the vault is the on-chain identity of the tribe.`,
    isBuiltin: true,
  },
  {
    id: "builtin-tribe-roles",
    title: "Tribe Roles",
    category: "Mechanics",
    tags: ["tribe", "roles", "admin", "officer", "treasurer", "recruiter"],
    content: `CradleOS implements an on-chain role system for tribe governance, allowing the founder to delegate specific authorities to trusted members.\n\nROLES\n\nADMIN\n  Full control over tribe vault operations, defense policy, gate configurations, and member management. Can assign and revoke all other roles. Highest delegated authority below founder.\n\nOFFICER\n  Can manage defense policy alert levels and player relations. Can configure gate access policies. Cannot modify treasury or member roster directly.\n\nTREASURER\n  Controls CRDL token distribution, infra credit allocation, and bounty contract funding. Cannot change defense or access policies.\n\nRECRUITER\n  Can review and approve tribe membership applications submitted via the recruiting terminal. Cannot access treasury or change policy.\n\nINITIALIZING THE ROLE SYSTEM\nThe role system must be explicitly initialized by the founder after vault creation:\n  1. Call initialize_roles() on the tribe_vault module\n  2. This creates the on-chain role registry for the tribe\n  3. The founder is automatically assigned the ADMIN role\n  4. Additional roles can then be assigned to member addresses\n\nDELEGATING ROLES\nThe founder (or current ADMIN) delegates roles to members via the CradleOS tribe dashboard:\n  1. Navigate to Tribe Management → Roles\n  2. Select the member's address\n  3. Assign the appropriate role\n  4. Confirm the transaction — role is recorded on-chain immediately\n\nROVOKING ROLES\nRoles can be revoked at any time by an ADMIN or the founder. Revoked members immediately lose the associated authorities.`,
    isBuiltin: true,
  },
  {
    id: "builtin-tribe-registry",
    title: "Registry — Tribe Registration",
    category: "Mechanics",
    tags: ["tribe", "registry", "claim", "id", "vault", "creation"],
    content: `The CradleOS Registry is the on-chain system for establishing a tribe's official identity and creating its vault.\n\nCLAIM REGISTRATION\nTo register a tribe in CradleOS:\n  1. The founder submits a claim to the registry module with the tribe's in-game short name and tribe ID\n  2. The registry verifies the tribe ID against the live Stillness world API\n  3. If valid and unclaimed, the registration proceeds\n  4. A unique tribe record is created in the registry\n\nTRIBE ID\nEvery tribe has a numeric Tribe ID assigned by the EVE Frontier game servers. This ID is the canonical identifier used throughout CradleOS contracts. All vaults, defense policies, and gate profiles reference the tribe ID.\n\nVAULT CREATION FLOW\n  1. Complete claim registration (above)\n  2. Call create_vault() on the tribe_vault module, passing the registered tribe ID\n  3. A new TribeVault object is created on Sui with the caller as founder\n  4. Optionally: initialize the role system via initialize_roles()\n  5. Optionally: fund the vault with initial CRDL tokens and infra credits\n\nON-CHAIN IDENTITY\nOnce registered, the tribe's vault address is its permanent on-chain identity. All CradleOS modules (bounty contracts, gate profiles, recruiting terminal, lore wiki) reference the tribe via this vault ID.\n\nVERIFICATION\nThe CradleOS registry maintains a mapping of tribe ID → vault address, ensuring each EVE Frontier tribe has at most one registered vault.`,
    isBuiltin: true,
  },
];

// ── Asset Registry Articles ──────────────────────────────────────────────────
// 3D model availability tags for ships/structures
const HAS_3D_MODEL = new Set([
  "wend","usv","lai","haf","carom","lorha","reflex","tades","maul",
  "gate","turret","hangar","refinery","assembly","printer","shipyard","silo","tether",
  "asteroid","asteroid2",
]);

const ASSET_ARTICLES: BuiltinArticle[] = [
  {
    id: "builtin-asset-registry",
    title: "Asset Registry — 3D Model Database",
    category: "Assets",
    tags: ["assets", "3d", "models", "ships", "structures", "registry"],
    content: `CradleOS maintains an extracted asset registry of EVE Frontier game models, converted from the client's ResFiles (.gr2 format) into web-ready glTF/GLB for the Keeper viewport.

CONVERSION PIPELINE
  ResFiles (.gr2) → evegr2toobj.exe → OBJ → sequential face gen → obj2gltf → GLB
  Note: Face topology is approximate (sequential triangulation). Real index buffers pending.

AVAILABLE 3D MODELS (20 total)

SHIPS (9 of 14 playable)
  ✅ LAI        — Dataist frigate, light combat (1.8 MB)
  ✅ HAF        — Dataist frigate, heavy combat (2.4 MB)
  ✅ Carom      — Dataist frigate, assassination (3.0 MB)
  ✅ Lorha      — Dataist frigate, hauling (2.2 MB)
  ✅ Reflex     — Synod frigate, light combat (4.5 MB)
  ✅ TADES      — Dataist destroyer, heavy combat (4.7 MB)
  ✅ Maul       — Dataist destroyer, light combat (6.1 MB)
  ✅ Wend       — Dataist shuttle, transport (4.9 MB)
  ✅ USV        — Synod shuttle, cargo transport (6.6 MB)
  ⬜ MCF, Recurve, Stride, Reiver, Chumaq — pending decimation

STRUCTURES (9 deployable types)
  ✅ Smart Gate     — dep_stargate_s_01v01 (4.9 MB)
  ✅ Smart Turret   — smart_turret_01 (6.6 MB)
  ✅ Smart Hangar   — dep_smart_hangar_01 (5.5 MB)
  ✅ Refinery       — dep_refinery_s_01v01 (6.1 MB)
  ✅ Assembly Line  — dep_assembly_line_s_01v01 (4.2 MB)
  ✅ Printer        — dep_printer_s_01v01 (4.6 MB)
  ✅ Shipyard       — dep_shipyard_s_01v01 (1.9 MB)
  ✅ Crude Silo     — dep_crude_silo_s_01v01 (3.9 MB)
  ✅ Smart Tether   — dep_smart_tether_01 (0.6 MB)
  ⬜ SSU            — too large at any LOD (30 MB+), uses procedural geometry

CELESTIALS (2)
  ✅ Mineable Asteroid      — as_mine_gen_01 (0.4 MB)
  ✅ Mineable Asteroid v2   — as_mine_gen_02 (0.2 MB)

KNOWN UNCONVERTED (in ResFiles)
  • 5 NPC stargate variants (st_gen_01–05)
  • 6 wreck models (ship + structure debris)
  • 172 asteroid variants (generic, arctic, inferno, debris)
  • 38 weapon turret models (S/M/L energy, projectile, plasma)
  • 100s of kitbash megastructure parts
  • Corvettes, battleships, battlecruiser hulls (not yet playable)
  • Capsule (escape pod)
  • Additional deployables: base core, clone facility, nursery, lens

SOURCE
  EVE Frontier ResFiles (stillness client), 47,514 entries
  Factions: Dataist, Synod, Traditionalist, Concord, NPC, NPE`,
    isBuiltin: true,
  },
  {
    id: "builtin-asset-factions",
    title: "Factions — Ship Design Origins",
    category: "Assets",
    tags: ["factions", "dataist", "synod", "ships", "design"],
    content: `Ships in EVE Frontier are manufactured by two major factions, each with distinct design philosophies.

DATAIST FACTION
  Design language: Angular, modular, utilitarian
  Ships: LAI, HAF, Carom, Lorha, MCF, TADES, Maul, Wend, Stride, Reiver, Chumaq
  Coverage: Frigates (6), destroyers (2), cruisers (3), shuttle (1)
  Notes: Dominates the playable roster. All advanced-fuel ships except Wend (basic).

SYNOD FACTION
  Design language: Curved, organic, flowing
  Ships: Reflex, Recurve, USV
  Coverage: Frigates (2), shuttle (1)
  Notes: Smaller roster. USV is the premier mining/industrial frigate.

GAME FILE FACTIONS (from ResFiles)
  • dataist    — 24 ship models (incl. corvette, longbow, shortbow, kayak variants)
  • synod      — 6 ship models (incl. corvette mine/navy variants)
  • concord    — 2 frigate models (conf2, conf4)
  • npc        — 1 prototype ship
  • npe        — 2 newbie tutorial ships
  • generic    — capsule + wreck models

UNRELEASED HULL CLASSES (models exist in files)
  • Corvette   — data_corv_01, syn_corv_mine_01, syn_corv_navy_01
  • Battlecruiser — data_bcr_heavy_01
  • Battleship — data_bs_assa_01, data_bs_mine_01
  • Kayak/Longbow/Shortbow — dataist-exclusive light classes`,
    isBuiltin: true,
  },
  {
    id: "builtin-asset-deployables",
    title: "Deployable Structures — Full Catalog",
    category: "Assets",
    tags: ["structures", "deployables", "ssu", "gate", "turret", "industry"],
    content: `EVE Frontier deployables are player-built structures that form the backbone of tribe infrastructure.

SMART STRUCTURES (player-programmable)
  Smart Storage Unit (SSU) — inventory container
    Heavy: 2,600,000,000 m³  |  Standard: 20,000,000 m³  |  Mini: 2,000,000 m³
  Smart Gate — jump gate with access policies and toll configuration
  Smart Turret — automated defense with configurable targeting
  Smart Hangar — ship docking and storage
  Smart Tether — tractor beam for pulling objects
  Smart Printer — blueprint-driven 3D manufacturing
  Smart Refinery — ore → refined material processing
  Smart Crude Silo — bulk raw material storage

PRODUCTION CHAIN
  Mining → Refinery → Silo (storage) → Assembly Line → Printer → Shipyard
  Each step requires an active Network Node for power.

SIZES (from ResFiles)
  Most structures come in S (small), M (medium), B (big/battle) variants.
  Smart structures are typically S-class. Industrial variants span all sizes.
  Turrets: dep_turret_s/m/b, smart_turret_01
  Hangars: dep_hangar_s/m/b, dep_smart_hangar_01
  Refineries: dep_refinery_s/m/b, dep_smart_refinery_s_01
  Printers: dep_printer_s/m/b, dep_smart_printer_s_01
  Shipyards: dep_shipyard_s/m/b

ADDITIONAL STRUCTURES (from ResFiles)
  Base Core — central installation core
  Clone Facility / Clone Hangar — respawn infrastructure
  Nursery — unknown function (crew/population?)
  Lens — unknown function (scanning/observation?)
  No-Service — placeholder/disabled structure
  Crude Lift — material transport between levels

DEPLOYABLE COUNT IN RESFILES: 94 unique models`,
    isBuiltin: true,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(a: string | undefined | null): string {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function formatDate(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function numish(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseInt(v, 10) || 0;
  if (typeof v === "bigint") return Number(v);
  return 0;
}

function extractString(v: unknown): string {
  if (typeof v === "string") return v;
  const f = (v as { fields?: { bytes?: unknown } } | null)?.fields?.bytes;
  if (typeof f === "string") return f;
  if (Array.isArray(f)) return new TextDecoder().decode(new Uint8Array(f as number[]));
  return String(v ?? "");
}

function resolveSlotType(groupName: string): string {
  if (HIGH_GROUPS.has(groupName)) return "high";
  if (MID_GROUPS.has(groupName)) return "medium";
  if (LOW_GROUPS.has(groupName)) return "low";

  const lower = groupName.toLowerCase();
  if (
    lower.includes("lance") ||
    lower.includes("driver") ||
    lower.includes("coilgun") ||
    lower.includes("autocannon") ||
    lower.includes("howitzer") ||
    lower.includes("plasma") ||
    lower.includes("laser") ||
    lower.includes("drill")
  ) return "high";

  if (
    lower.includes("shield") ||
    lower.includes("afterburner") ||
    lower.includes("engine") ||
    lower.includes("accelerator") ||
    lower.includes("field array") ||
    lower.includes("web") ||
    lower.includes("scrambler") ||
    lower.includes("heat ejector") ||
    lower.includes("scanner")
  ) return "medium";

  if (
    lower.includes("armor") ||
    lower.includes("brace") ||
    lower.includes("cargo") ||
    lower.includes("hull repair")
  ) return "low";

  return "utility";
}

function chunkNames(names: string[], size = 3): string {
  const lines: string[] = [];
  for (let i = 0; i < names.length; i += size) {
    lines.push(`  ${names.slice(i, i + size).join(", ")}`);
  }
  return lines.join("\n");
}

function buildModuleGroupArticles(types: StillnessType[]): BuiltinArticle[] {
  const modules = types.filter(t => t.categoryName === "Module" && t.groupName && t.name);
  const grouped = new Map<string, StillnessType[]>();

  for (const mod of modules) {
    const groupName = String(mod.groupName);
    if (!grouped.has(groupName)) grouped.set(groupName, []);
    grouped.get(groupName)?.push(mod);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([groupName, groupItems]) => {
      const slotType = resolveSlotType(groupName);
      const names = groupItems
        .map(item => String(item.name ?? "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      const masses = groupItems
        .map(item => numish(item.mass))
        .filter(mass => Number.isFinite(mass) && mass > 0)
        .sort((a, b) => a - b);
      const minMass = masses.length > 0 ? masses[0].toLocaleString() : "Unknown";
      const maxMass = masses.length > 0 ? masses[masses.length - 1].toLocaleString() : "Unknown";

      return {
        id: `builtin-module-${groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        title: `${groupName} — Module Group`,
        category: "Mechanics",
        tags: ["module", groupName.toLowerCase().replace(/\s+/g, "-"), slotType],
        content: `${groupName} modules occupy ${slotType} slots.\n\nKnown modules in this group:\n${chunkNames(names)}\n\nMass range: ${minMass} – ${maxMass} kg per module\n\nNote: Stat effects (CPU cost, PG cost, HP bonus) are pending CCP API data exposure.`,
        isBuiltin: true,
      } satisfies BuiltinArticle;
    });
}

// ── Data fetching ─────────────────────────────────────────────────────────────

/** Fetch all ArticlePublished event article IDs (up to 500). */
async function fetchPublishedIds(): Promise<number[]> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: eventType("lore_wiki", "ArticlePublished") }, null, 500, true],
      }),
    });
    const j = await res.json() as { result?: { data?: Array<{ parsedJson: Record<string, unknown> }> } };
    const ids = (j.result?.data ?? []).map(e => numish(e.parsedJson["article_id"]));
    return Array.from(new Set(ids));
  } catch { return []; }
}

/** Fetch ArticleDeleted events to exclude deleted IDs. */
async function fetchDeletedIds(): Promise<Set<number>> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: eventType("lore_wiki", "ArticleDeleted") }, null, 500, true],
      }),
    });
    const j = await res.json() as { result?: { data?: Array<{ parsedJson: Record<string, unknown> }> } };
    return new Set((j.result?.data ?? []).map(e => numish(e.parsedJson["article_id"])));
  } catch { return new Set(); }
}

/** Fetch a single article from a dynamic field on the WikiBoard. */
async function fetchArticle(boardId: string, articleId: number): Promise<ArticleData | null> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_getDynamicFieldObject",
        params: [boardId, { type: "u64", value: String(articleId) }],
      }),
    });
    const j = await res.json() as {
      result?: { data?: { content?: { fields?: Record<string, unknown> } } }
    };
    const f = j.result?.data?.content?.fields;
    if (!f) return null;

    const inner = (f["value"] as { fields?: Record<string, unknown> })?.fields
      ?? (f["value"] as Record<string, unknown>)
      ?? {};

    let tags: string[] = [];
    const rawTags = inner["tags"];
    if (Array.isArray(rawTags)) {
      tags = rawTags.map(t => extractString(t));
    }

    return {
      articleId,
      title: extractString(inner["title"]),
      content: extractString(inner["content"]),
      category: extractString(inner["category"]),
      author: String(inner["author"] ?? ""),
      tribeId: numish(inner["tribe_id"]),
      tags,
      createdMs: numish(inner["created_ms"]),
      editedMs: numish(inner["edited_ms"]),
      upvotes: numish(inner["upvotes"]),
      downvotes: numish(inner["downvotes"]),
    };
  } catch { return null; }
}

/** Load all live articles from the WikiBoard. */
async function fetchAllArticles(boardId: string): Promise<ArticleData[]> {
  const [publishedIds, deletedIds] = await Promise.all([fetchPublishedIds(), fetchDeletedIds()]);
  const liveIds = publishedIds.filter(id => !deletedIds.has(id));
  const results = await Promise.all(liveIds.map(id => fetchArticle(boardId, id)));
  return results.filter((a): a is ArticleData => a !== null);
}

// ── Tx builders ───────────────────────────────────────────────────────────────

function enc(s: string): number[] {
  return Array.from(new TextEncoder().encode(s));
}

function buildPublishTransaction(
  boardId: string,
  title: string,
  content: string,
  category: string,
  tribeId: number,
  tags: string[],
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::lore_wiki::publish_article_entry`,
    arguments: [
      tx.object(boardId),
      tx.pure.vector("u8", enc(title)),
      tx.pure.vector("u8", enc(content)),
      tx.pure.vector("u8", enc(category)),
      tx.pure.u32(tribeId),
      tx.makeMoveVec({
        type: "vector<u8>",
        elements: tags.map(t => tx.pure.vector("u8", enc(t))),
      }),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

function buildEditTransaction(
  boardId: string,
  articleId: number,
  title: string,
  content: string,
  category: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::lore_wiki::edit_article_entry`,
    arguments: [
      tx.object(boardId),
      tx.pure.u64(BigInt(articleId)),
      tx.pure.vector("u8", enc(title)),
      tx.pure.vector("u8", enc(content)),
      tx.pure.vector("u8", enc(category)),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

function buildUpvoteTransaction(boardId: string, articleId: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::lore_wiki::upvote_article_entry`,
    arguments: [
      tx.object(boardId),
      tx.pure.u64(BigInt(articleId)),
    ],
  });
  return tx;
}

function buildDeleteTransaction(boardId: string, articleId: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::lore_wiki::delete_article_entry`,
    arguments: [
      tx.object(boardId),
      tx.pure.u64(BigInt(articleId)),
    ],
  });
  return tx;
}

async function buildDownvoteArticleTx(boardId: string, articleId: number): Promise<Transaction> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::lore_wiki::downvote_article_entry`,
    arguments: [tx.object(boardId), tx.pure.u64(articleId)],
  });
  return tx;
}

async function buildModDeleteTx(boardId: string, articleId: number, modCapId: string): Promise<Transaction> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::lore_wiki::mod_delete_entry`,
    arguments: [tx.object(boardId), tx.object(modCapId), tx.pure.u64(articleId)],
  });
  return tx;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "0",
  color: "#fff",
  fontSize: "13px",
  padding: "7px 10px",
  outline: "none",
  boxSizing: "border-box",
};

const ghostBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(107,107,94,0.7)",
  borderRadius: "0",
  fontSize: "11px",
  padding: "3px 10px",
  cursor: "pointer",
};

const sectionHeadingStyle: React.CSSProperties = {
  color: "#aaa",
  fontWeight: 700,
  fontSize: "11px",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  marginBottom: "8px",
};

function CategoryBadge({ cat }: { cat: string }) {
  const colors: Record<string, string> = {
    Lore: "#b8860b",
    Mechanics: "#2e8b57",
    Locations: "#4682b4",
    Factions: "#9932cc",
    Ships: "#FF4700",
    History: "#696969",
  };
  const color = colors[cat] ?? "#555";
  return (
    <span style={{
      fontSize: "10px", fontWeight: 700, padding: "1px 6px",
      border: `1px solid ${color}55`, color, letterSpacing: "0.06em",
      background: `${color}18`,
    }}>
      {cat.toUpperCase()}
    </span>
  );
}

function SourceBadge({ source }: { source: "builtin" | "onchain" }) {
  return (
    <span style={{
      fontSize: "10px",
      fontWeight: 700,
      padding: "1px 6px",
      border: "1px solid rgba(255,255,255,0.12)",
      color: "rgba(107,107,94,0.8)",
      background: "rgba(255,255,255,0.03)",
      letterSpacing: "0.06em",
    }}>
      {source === "builtin" ? "BUILT-IN" : "ON-CHAIN"}
    </span>
  );
}

// ── Main exported panel ────────────────────────────────────────────────────────

export function LoreWikiPanel() {
  // Always render — built-in articles show even before contract is deployed.
  // On-chain features are disabled when WIKI_BOARD is empty.
  return <LoreWikiPanelInner boardId={WIKI_BOARD} />;
}

// ── Inner panel ───────────────────────────────────────────────────────────────

type PanelView = "list" | "new";
type SourceFilter = "all" | "onchain" | "builtin";

function LoreWikiPanelInner({ boardId }: { boardId: string }) {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<PanelView>("list");
  const [builtinArticles, setBuiltinArticles] = useState<BuiltinArticle[]>([...SHIP_ARTICLES, ...MECHANICS_ARTICLES, ...STRUCTURE_ARTICLES, ...DEFENSE_ARTICLES, ...GATE_ARTICLES, ...TRIBE_ARTICLES, ...ASSET_ARTICLES]);

  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("Lore");
  const [newTags, setNewTags] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newTribeSpecific, setNewTribeSpecific] = useState(false);
  const [newTribeId, setNewTribeId] = useState("");
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishErr, setPublishErr] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState<Category>("Lore");
  const [editContent, setEditContent] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  const [actionBusy, setActionBusy] = useState<Record<number, string>>({});
  const [showFlagged, setShowFlagged] = useState(false);
  const [modCapId, setModCapId] = useState(WIKI_MOD_CAP); // WikiModCap object from deploy

  const { data: articles, isLoading } = useQuery<ArticleData[]>({
    queryKey: ["wikiArticles", boardId],
    queryFn: () => fetchAllArticles(boardId),
    staleTime: 30_000,
  });

  useEffect(() => {
    let cancelled = false;

    const loadBuiltinArticles = async () => {
      try {
        const res = await fetch(`${STILLNESS_API}/v2/types?limit=500`);
        const data = await res.json() as { data?: StillnessType[] } | StillnessType[];
        const types = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);
        const moduleArticles = buildModuleGroupArticles(types);
        if (!cancelled) {
          setBuiltinArticles([...SHIP_ARTICLES, ...MECHANICS_ARTICLES, ...STRUCTURE_ARTICLES, ...DEFENSE_ARTICLES, ...GATE_ARTICLES, ...TRIBE_ARTICLES, ...ASSET_ARTICLES, ...moduleArticles]);
        }
      } catch {
        if (!cancelled) {
          setBuiltinArticles([...SHIP_ARTICLES, ...MECHANICS_ARTICLES, ...STRUCTURE_ARTICLES, ...DEFENSE_ARTICLES, ...GATE_ARTICLES, ...TRIBE_ARTICLES, ...ASSET_ARTICLES]);
        }
      }
    };

    void loadBuiltinArticles();
    return () => { cancelled = true; };
  }, []);

  const invalidate = () => {
    [2500, 6000, 12000].forEach(delay =>
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["wikiArticles", boardId] }), delay)
    );
  };

  const onChainArticles = useMemo(
    () => (articles ?? []).map(article => ({ ...article, source: "onchain" as const })),
    [articles]
  );

  const builtinDisplayArticles = useMemo(
    () => builtinArticles.map(article => ({ ...article, source: "builtin" as const })),
    [builtinArticles]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const all: DisplayArticle[] = [
      ...(sourceFilter === "all" || sourceFilter === "builtin" ? builtinDisplayArticles : []),
      ...(sourceFilter === "all" || sourceFilter === "onchain" ? onChainArticles : []),
    ];

    return all
      .filter(a => {
        if (a.source === "onchain") {
          const score = (a as ArticleData).upvotes - (a as ArticleData).downvotes;
          if (score < -2 && !showFlagged) return false;
        }
        return true;
      })
      .filter(a => categoryFilter === "All" || a.category === categoryFilter)
      .filter(a =>
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        const aTime = a.source === "onchain" ? a.createdMs : 0;
        const bTime = b.source === "onchain" ? b.createdMs : 0;
        return bTime - aTime || a.title.localeCompare(b.title);
      });
  }, [builtinDisplayArticles, onChainArticles, sourceFilter, categoryFilter, search, showFlagged]);

  const selectedArticle = useMemo(
    () => (selectedId !== null ? filtered.find(a => (a.source === "builtin" ? a.id : `onchain-${a.articleId}`) === selectedId)
      ?? [...builtinDisplayArticles, ...onChainArticles].find(a => (a.source === "builtin" ? a.id : `onchain-${a.articleId}`) === selectedId)
      ?? null : null),
    [builtinDisplayArticles, filtered, onChainArticles, selectedId]
  );

  const handlePublish = async () => {
    if (!account || !newTitle.trim() || !newContent.trim()) return;
    setPublishBusy(true); setPublishErr(null);
    try {
      const tags = newTags.split(",").map(t => t.trim()).filter(Boolean).slice(0, 5);
      const tribeId = newTribeSpecific ? (parseInt(newTribeId, 10) || 0) : 0;
      const tx = buildPublishTransaction(boardId, newTitle.trim(), newContent.trim(), newCategory, tribeId, tags);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setNewTitle(""); setNewTags(""); setNewContent(""); setNewTribeSpecific(false); setNewTribeId("");
      setView("list");
      invalidate();
    } catch (e) { setPublishErr(e instanceof Error ? e.message : String(e)); }
    finally { setPublishBusy(false); }
  };

  const handleEditSubmit = async () => {
    if (!account || editingId === null || !editTitle.trim() || !editContent.trim()) return;
    setEditBusy(true); setEditErr(null);
    try {
      const tx = buildEditTransaction(boardId, editingId, editTitle.trim(), editContent.trim(), editCategory);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setEditingId(null);
      invalidate();
    } catch (e) { setEditErr(e instanceof Error ? e.message : String(e)); }
    finally { setEditBusy(false); }
  };

  const handleUpvote = async (articleId: number) => {
    if (!account) return;
    setActionBusy(prev => ({ ...prev, [articleId]: "upvote" }));
    try {
      const tx = buildUpvoteTransaction(boardId, articleId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      invalidate();
    } catch { }
    finally { setActionBusy(prev => { const n = { ...prev }; delete n[articleId]; return n; }); }
  };

  const handleDelete = async (articleId: number) => {
    if (!account) return;
    setActionBusy(prev => ({ ...prev, [articleId]: "delete" }));
    try {
      const tx = buildDeleteTransaction(boardId, articleId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      if (selectedId === `onchain-${articleId}`) setSelectedId(null);
      invalidate();
    } catch { }
    finally { setActionBusy(prev => { const n = { ...prev }; delete n[articleId]; return n; }); }
  };

  const handleDownvote = async (articleId: number) => {
    if (!account || !boardId) return;
    setActionBusy(prev => ({ ...prev, [articleId]: "downvote" }));
    try {
      const tx = await buildDownvoteArticleTx(boardId, articleId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      invalidate();
    } catch (e) {
      console.error("downvote failed", e);
    } finally {
      setActionBusy(prev => { const n = { ...prev }; delete n[articleId]; return n; });
    }
  };

  const handleModDelete = async (articleId: number) => {
    if (!account || !boardId || !modCapId) return;
    setActionBusy(prev => ({ ...prev, [articleId]: "moddelete" }));
    try {
      const tx = await buildModDeleteTx(boardId, articleId, modCapId);
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      if (selectedId === `onchain-${articleId}`) setSelectedId(null);
      invalidate();
    } catch (e) {
      console.error("mod-delete failed", e);
    } finally {
      setActionBusy(prev => { const n = { ...prev }; delete n[articleId]; return n; });
    }
  };

  const startEdit = (a: ArticleData) => {
    setEditingId(a.articleId);
    setEditTitle(a.title);
    setEditContent(a.content);
    setEditCategory((CATEGORIES.includes(a.category as Category) ? a.category : "Lore") as Category);
    setEditErr(null);
    setView("list");
  };

  const sidebar = (
    <div style={{
      width: "200px",
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      borderRight: "1px solid rgba(255,71,0,0.1)",
      paddingRight: "16px",
    }}>
      <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "14px", letterSpacing: "0.05em" }}>
        LORE WIKI
      </div>

      <div>
        <div style={sectionHeadingStyle}>Search</div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search articles…"
          style={{ ...inputStyle, fontSize: "12px" }}
        />
      </div>

      <div>
        <div style={sectionHeadingStyle}>Source</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {[
            ["all", "All"],
            ["onchain", "On-Chain"],
            ["builtin", "Built-In"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setSourceFilter(value as SourceFilter)}
              style={{
                textAlign: "left",
                background: sourceFilter === value ? "rgba(255,71,0,0.12)" : "transparent",
                border: sourceFilter === value ? "1px solid rgba(255,71,0,0.35)" : "1px solid transparent",
                color: sourceFilter === value ? "#FF4700" : "rgba(107,107,94,0.7)",
                borderRadius: "0",
                fontSize: "12px",
                padding: "4px 10px",
                cursor: "pointer",
                fontWeight: sourceFilter === value ? 700 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={sectionHeadingStyle}>Category</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {["All", ...CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              style={{
                textAlign: "left",
                background: categoryFilter === cat ? "rgba(255,71,0,0.12)" : "transparent",
                border: categoryFilter === cat ? "1px solid rgba(255,71,0,0.35)" : "1px solid transparent",
                color: categoryFilter === cat ? "#FF4700" : "rgba(107,107,94,0.7)",
                borderRadius: "0",
                fontSize: "12px",
                padding: "4px 10px",
                cursor: "pointer",
                fontWeight: categoryFilter === cat ? 700 : 400,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Moderation */}
      <div>
        <div style={sectionHeadingStyle}>Moderation</div>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "rgba(107,107,94,0.7)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showFlagged}
            onChange={e => setShowFlagged(e.target.checked)}
            style={{ accentColor: "#FF4700" }}
          />
          Show flagged content
        </label>
        {!showFlagged && [...builtinDisplayArticles, ...onChainArticles].some(a => a.source === "onchain" && ((a as ArticleData).upvotes - (a as ArticleData).downvotes) < -2) && (
          <div style={{ color: "#ff4444", fontSize: "11px", marginTop: "4px" }}>
            {[...builtinDisplayArticles, ...onChainArticles].filter(a => a.source === "onchain" && ((a as ArticleData).upvotes - (a as ArticleData).downvotes) < -2).length} flagged hidden
          </div>
        )}
        {account && WIKI_MOD_ADDRESS && account.address.toLowerCase() === WIKI_MOD_ADDRESS.toLowerCase() && (
          <div style={{ marginTop: "8px" }}>
            <div style={{ ...sectionHeadingStyle, marginBottom: "4px", fontSize: "10px" }}>Mod Cap ID</div>
            <input
              value={modCapId}
              onChange={e => setModCapId(e.target.value)}
              placeholder="WikiModCap object ID"
              style={{ ...inputStyle, fontSize: "11px" }}
            />
          </div>
        )}
      </div>

      {account && (
        <button
          className="accent-button"
          onClick={() => { setView(view === "new" ? "list" : "new"); setEditingId(null); }}
          style={{ fontSize: "12px", padding: "6px 10px" }}
        >
          {view === "new" ? "Cancel" : "+ New Article"}
        </button>
      )}

      <div style={{ marginTop: "auto" }}>
        <div style={sectionHeadingStyle}>Stats</div>
        <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "12px" }}>
          {builtinArticles.length} built-in  |  {(articles ?? []).length} on-chain
        </div>
        <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "12px" }}>
          {filtered.length} shown
        </div>
      </div>
    </div>
  );

  const newArticleForm = (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,71,0,0.12)",
      padding: "14px",
      borderRadius: "0",
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      overflowY: "auto",
    }}>
      <div style={{ ...sectionHeadingStyle, color: "#FF4700", fontSize: "13px" }}>New Article</div>

      <div>
        <div style={{ ...sectionHeadingStyle, marginBottom: "4px" }}>Title</div>
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="Article title"
          style={inputStyle}
        />
      </div>

      <div>
        <div style={{ ...sectionHeadingStyle, marginBottom: "4px" }}>Category</div>
        <select
          value={newCategory}
          onChange={e => setNewCategory(e.target.value as Category)}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <div style={{ ...sectionHeadingStyle, marginBottom: "4px" }}>Tags (comma-separated, max 5)</div>
        <input
          value={newTags}
          onChange={e => setNewTags(e.target.value)}
          placeholder="e.g. wormhole, navigation, survival"
          style={inputStyle}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={newTribeSpecific}
            onChange={e => setNewTribeSpecific(e.target.checked)}
            style={{ accentColor: "#FF4700" }}
          />
          <span style={{ color: "rgba(107,107,94,0.8)", fontSize: "12px" }}>Tribe-specific article</span>
        </label>
        {newTribeSpecific && (
          <input
            value={newTribeId}
            onChange={e => setNewTribeId(e.target.value)}
            placeholder="Tribe ID (number)"
            style={{ ...inputStyle, fontSize: "12px" }}
          />
        )}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <div style={sectionHeadingStyle}>Content</div>
          <div style={{ color: newContent.length > 4000 ? "#ff6432" : "rgba(107,107,94,0.6)", fontSize: "11px" }}>
            {newContent.length} / 4000
          </div>
        </div>
        <textarea
          value={newContent}
          onChange={e => setNewContent(e.target.value.slice(0, 4000))}
          placeholder="Write your article here… (markdown-friendly plain text)"
          style={{
            ...inputStyle,
            height: "400px",
            resize: "vertical",
            fontFamily: "inherit",
            lineHeight: "1.6",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <button
          className="accent-button"
          onClick={handlePublish}
          disabled={publishBusy || !newTitle.trim() || !newContent.trim()}
          style={{ fontSize: "12px", padding: "7px 24px" }}
        >
          {publishBusy ? "Publishing…" : "Publish"}
        </button>
        {publishErr && <div style={{ color: "#ff6432", fontSize: "12px" }}>⚠ {publishErr}</div>}
      </div>
    </div>
  );

  const articleList = (
    <div style={{
      width: "40%",
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      overflowY: "auto",
      borderRight: "1px solid rgba(255,71,0,0.08)",
      paddingRight: "12px",
    }}>
      {isLoading && (
        <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "13px", padding: "16px 0" }}>
          Loading articles…
        </div>
      )}
      {!isLoading && filtered.length === 0 && (
        <div style={{ color: "rgba(107,107,94,0.6)", fontSize: "13px", padding: "16px 0" }}>
          No articles found.
        </div>
      )}
      {filtered.map(a => {
        const articleKey = a.source === "builtin" ? a.id : `onchain-${a.articleId}`;
        return (
          <div
            key={articleKey}
            onClick={() => { setSelectedId(articleKey); setView("list"); setEditingId(null); }}
            style={{
              padding: "10px 12px",
              cursor: "pointer",
              background: selectedId === articleKey
                ? "rgba(255,71,0,0.08)"
                : "rgba(255,255,255,0.01)",
              border: `1px solid ${selectedId === articleKey ? "rgba(255,71,0,0.3)" : "rgba(255,255,255,0.04)"}`,
              borderRadius: "0",
              transition: "background 0.1s",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: "13px", color: "#ddd", marginBottom: "4px", lineHeight: "1.3", display: "flex", alignItems: "center", gap: "6px" }}>
              {a.title}
              {a.tags?.some(t => HAS_3D_MODEL.has(t)) && (
                <span style={{ fontSize: "9px", color: "rgba(0,200,255,0.7)", border: "1px solid rgba(0,200,255,0.3)", padding: "0 3px", borderRadius: "2px", letterSpacing: "0.08em", flexShrink: 0 }}>3D</span>
              )}
            </div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
              <CategoryBadge cat={a.category} />
              <SourceBadge source={a.source} />
              {a.source === "onchain" ? (
                <>
                  <span style={{ color: "rgba(107,107,94,0.55)", fontSize: "11px", fontFamily: "monospace" }}>
                    {shortAddr(a.author)}
                  </span>
                  <span style={{ color: "#00ff96", fontSize: "11px" }}>
                    ▲ {a.upvotes}
                  </span>
                  <button
                    style={{ background: "transparent", border: "1px solid rgba(255,68,68,0.3)", color: "#ff4444", fontSize: "10px", padding: "2px 6px", cursor: "pointer", borderRadius: 0 }}
                    onClick={e => { e.stopPropagation(); handleDownvote((a as ArticleData).articleId); }}
                    disabled={!!actionBusy[(a as ArticleData).articleId]}
                  >
                    ▼ {(a as ArticleData).downvotes}
                  </button>
                  {((a as ArticleData).upvotes - (a as ArticleData).downvotes) < 0 && (
                    <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 6px", border: "1px solid rgba(255,68,68,0.35)", color: "#ff4444", background: "rgba(255,68,68,0.08)", letterSpacing: "0.06em" }}>
                      FLAGGED
                    </span>
                  )}
                  <span style={{ color: "rgba(107,107,94,0.4)", fontSize: "11px" }}>
                    {formatDate(a.createdMs)}
                  </span>
                </>
              ) : (
                <span style={{ color: "rgba(107,107,94,0.4)", fontSize: "11px" }}>
                  CradleOS Knowledge Base
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const articleDetail = selectedArticle ? (
    <div style={{
      flex: 1,
      overflowY: "auto",
      paddingLeft: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}>
      {selectedArticle.source === "onchain" && editingId === selectedArticle.articleId ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ ...sectionHeadingStyle, color: "#FF4700", fontSize: "13px" }}>Edit Article</div>
          <input
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            style={inputStyle}
            placeholder="Title"
          />
          <select
            value={editCategory}
            onChange={e => setEditCategory(e.target.value as Category)}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={sectionHeadingStyle}>Content</div>
            <div style={{ color: editContent.length > 4000 ? "#ff6432" : "rgba(107,107,94,0.6)", fontSize: "11px" }}>
              {editContent.length} / 4000
            </div>
          </div>
          <textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value.slice(0, 4000))}
            style={{
              ...inputStyle,
              height: "360px",
              resize: "vertical",
              fontFamily: "inherit",
              lineHeight: "1.6",
            }}
          />
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              className="accent-button"
              onClick={handleEditSubmit}
              disabled={editBusy || !editTitle.trim() || !editContent.trim()}
              style={{ fontSize: "12px", padding: "6px 20px" }}
            >
              {editBusy ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditingId(null)} style={ghostBtnStyle}>Cancel</button>
            {editErr && <span style={{ color: "#ff6432", fontSize: "11px" }}>⚠ {editErr}</span>}
          </div>
        </div>
      ) : (
        <>
          <div>
            <div style={{ color: "#eee", fontWeight: 700, fontSize: "18px", marginBottom: "6px" }}>
              {selectedArticle.title}
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "8px" }}>
              <CategoryBadge cat={selectedArticle.category} />
              <SourceBadge source={selectedArticle.source} />
              {selectedArticle.source === "onchain" && selectedArticle.tribeId > 0 && (
                <span style={{
                  fontSize: "10px", fontWeight: 700, color: "#aaa",
                  border: "1px solid rgba(255,255,255,0.15)", padding: "1px 6px",
                  fontFamily: "monospace",
                }}>
                  TRIBE {selectedArticle.tribeId}
                </span>
              )}
            </div>
            <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "11px", display: "flex", gap: "14px", flexWrap: "wrap" }}>
              {selectedArticle.source === "onchain" ? (
                <>
                  <span>
                    Author:{" "}
                    <span style={{ fontFamily: "monospace" }}>{shortAddr(selectedArticle.author)}</span>
                  </span>
                  <span>Published: {formatDate(selectedArticle.createdMs)}</span>
                  {selectedArticle.editedMs > selectedArticle.createdMs && (
                    <span>Edited: {formatDate(selectedArticle.editedMs)}</span>
                  )}
                </>
              ) : (
                <span>CradleOS Knowledge Base</span>
              )}
            </div>
            {selectedArticle.tags.length > 0 && (
              <div style={{ marginTop: "6px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {selectedArticle.tags.map(tag => (
                  <span
                    key={tag}
                    style={{
                      fontSize: "10px", color: "rgba(107,107,94,0.6)",
                      border: "1px solid rgba(107,107,94,0.2)",
                      padding: "1px 7px",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{
            color: "#ccc",
            fontSize: "13px",
            lineHeight: "1.7",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            paddingTop: "12px",
          }}>
            {selectedArticle.content}
          </div>

          {selectedArticle.source === "onchain" ? (
            <div style={{ display: "flex", gap: "8px", alignItems: "center", paddingTop: "8px", flexWrap: "wrap" }}>
              <button
                onClick={() => handleUpvote(selectedArticle.articleId)}
                disabled={!account || actionBusy[selectedArticle.articleId] === "upvote"}
                style={{
                  ...ghostBtnStyle,
                  color: "#00ff96",
                  borderColor: "rgba(0,255,150,0.25)",
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "4px 12px",
                }}
              >
                {actionBusy[selectedArticle.articleId] === "upvote" ? "…" : `▲ ${selectedArticle.upvotes}`}
              </button>

              {account && selectedArticle.author.toLowerCase() === account.address.toLowerCase() && (
                <>
                  <button
                    onClick={() => startEdit(selectedArticle)}
                    style={ghostBtnStyle}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(selectedArticle.articleId)}
                    disabled={actionBusy[selectedArticle.articleId] === "delete"}
                    style={{ ...ghostBtnStyle, color: "#ff6432", borderColor: "rgba(255,100,50,0.25)" }}
                  >
                    {actionBusy[selectedArticle.articleId] === "delete" ? "Deleting…" : "Delete"}
                  </button>
                </>
              )}

              {account && WIKI_MOD_ADDRESS && account.address.toLowerCase() === WIKI_MOD_ADDRESS.toLowerCase() && (
                <button
                  onClick={() => handleModDelete(selectedArticle.articleId)}
                  disabled={!!actionBusy[selectedArticle.articleId] || !modCapId}
                  style={{ ...ghostBtnStyle, color: "#ff4444", borderColor: "rgba(255,68,68,0.3)", fontSize: "11px" }}
                >
                  {actionBusy[selectedArticle.articleId] === "moddelete" ? "Removing…" : "Mod Delete"}
                </button>
              )}

              {!account && (
                <span style={{ color: "rgba(107,107,94,0.5)", fontSize: "11px" }}>
                  Connect wallet to upvote or contribute
                </span>
              )}
            </div>
          ) : (
            <div style={{ color: "rgba(107,107,94,0.5)", fontSize: "11px", paddingTop: "8px" }}>
              Built-in reference article
            </div>
          )}
        </>
      )}
    </div>
  ) : (
    <div style={{
      flex: 1,
      paddingLeft: "16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{ color: "rgba(107,107,94,0.4)", fontSize: "13px", textAlign: "center" }}>
        Select an article to read
      </div>
    </div>
  );

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", flex: 1, gap: "0", overflow: "hidden", minHeight: 0 }}>
        {sidebar}

        <div style={{ flex: 1, display: "flex", gap: "0", overflow: "hidden", paddingLeft: "16px" }}>
          {view === "new"
            ? newArticleForm
            : (
              <div style={{ flex: 1, display: "flex", gap: "0", overflow: "hidden" }}>
                {articleList}
                {articleDetail}
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
}
