// ── Server environment ─────────────────────────────────────────────────────────
// VITE_SERVER_ENV: "utopia" (hackathon) | "stillness" (live CradleOS)
// Set at build time via env var. Defaults to utopia (hackathon dApp).
export const SERVER_ENV = (import.meta.env.VITE_SERVER_ENV ?? "utopia") as "utopia" | "stillness";
export const SERVER_LABEL = SERVER_ENV === "stillness" ? "STILLNESS (Live)" : "UTOPIA (Hackathon)";

// Utopia WORLD_PKG — confirmed via CharacterCreatedEvent scan (Raw's char registered here)
export const WORLD_PKG_UTOPIA    = "0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75";
// Stillness WORLD_PKG — confirmed active, different deployment on same Sui testnet
export const WORLD_PKG_STILLNESS = "0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c";
export const WORLD_PKG = SERVER_ENV === "stillness" ? WORLD_PKG_STILLNESS : WORLD_PKG_UTOPIA;
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000000000000000000000000000";

// ── Package version history ───────────────────────────────────────────────────
// CRADLEOS_PKG = current (always point this to the latest deployed package)
// When upgrading: bump CRADLEOS_PKG, do NOT change any MODULE_ORIGIN_PKG entries
// unless a brand-new module is being added in that version.
export const CRADLEOS_PKG      = "0x036c2c0db070507940bd49d86e91f357f68ae94c3c33375c0ebc75044aeafade"; // v7 (existing deployed objects)
export const CRADLEOS_PKG_V8   = "0x04f19523db8ed24226856c845b0384de27cbb195cf91bb7b72dab17375e92aaa"; // v8 (new modules: bounty, cargo, gates, succession, wiki, recruiting, announcements)
// v9 superseded — 0x3144da884058dec39c405607ddb85f7bde0742d630a5ae59c962efd999635336 (wrong registry design, do not use)
export const CRADLEOS_PKG_V10  = "0x6d2ef8f78456d8dd03c73ead8678b83c454765a6b54b546a877a901f823a073f"; // v10 (turret_delegation — no registry, standalone owned objects)
export const CRADLEOS_PKG_V11  = "0xf572afb0c960600745ac066c5e7cc4800f5e7d3eb75060c23269c4d91ee5dccc"; // v11 (cargo_contract v2 — trustless delivery via ItemMintedEvent POD)
export const CRADLEOS_PKG_V12  = "0x30557f9ccf881e7dd40c58aaf159d542280d7c42b4ef9b0ec2d7f3b63f7c0fd7"; // v12 (ship_reimbursement — SRP/combat insurance, Killmail POD)
export const CRADLEOS_PKG_V13  = "0xf184506064df4692417dae678b9718d76595649d22c6119c228681723fb83f6c"; // v13 (tribe_roles attempt — superseded by standalone pkg)
export const TRIBE_ROLES_PKG   = "0x1686b3a05ed29cc506d2d6908b0bf833c6234ffcbe7a6366effdbbeb235079bf"; // standalone tribe_roles package
export const CRADLEOS_PKG_V14  = "0xcc3a031f0d1c1c3af2b4244aa9cd26a7d5456406a045080cb0085aaf1b741a1f"; // v14 (player_relations — per-address hostile/friendly policy)
export const CRADLEOS_PKG_V15  = "0xac93ca95ef8f0c840ca585fc3d4cdf10955647336509a9d4d7b56c95c14ccda5"; // v15 (gate_policy attempt — superseded by standalone pkg)
export const GATE_POLICY_PKG   = "0x398d1faf974c93faee6774989358723b4172045a86087c9a426de2fa21ea3b14"; // standalone gate_policy package (no TribeVault dep)
export const CRADLEOS_EVENTS_PKG = "0xee8cd44d4373a8fbb644edbd96281f0e25eacaec6209408c00a2b7c76a179546"; // v4 (original)

// ── Module origin map ─────────────────────────────────────────────────────────
// Sui indexes events under whichever package FIRST published the module.
// Upgraded packages keep the original ID forever.
// Rule: only add a new entry here when a brand-new module ships.
//       Never change an existing entry on upgrade — it's correct forever.
//
// To use: import { eventType } from "../constants";
//   eventType("defense_policy", "PolicyCreated")
//   → "0x934b...::defense_policy::PolicyCreated"
const MODULE_ORIGIN_PKG: Record<string, string> = {
  // v4 originals (CRADLEOS_EVENTS_PKG)
  cradle_coin:   "0xee8cd44d4373a8fbb644edbd96281f0e25eacaec6209408c00a2b7c76a179546",
  tribe_vault:   "0xee8cd44d4373a8fbb644edbd96281f0e25eacaec6209408c00a2b7c76a179546",
  tribe_dex:     "0xee8cd44d4373a8fbb644edbd96281f0e25eacaec6209408c00a2b7c76a179546",
  registry:      "0xee8cd44d4373a8fbb644edbd96281f0e25eacaec6209408c00a2b7c76a179546",
  // v5 additions
  defense_policy:"0x934b4838bc94dfd551e57e261c0906b374e100751848a61d0d87b73047ba5be5",
  // v6 additions — (none confirmed yet)
  // v7 additions — (security_config added; may share defense_policy origin — verify after deploy)
  bounty_contract:     "0x04f19523db8ed24226856c845b0384de27cbb195cf91bb7b72dab17375e92aaa", // v8
  gate_profile:        "0x04f19523db8ed24226856c845b0384de27cbb195cf91bb7b72dab17375e92aaa", // v8
  inheritance:         "0x04f19523db8ed24226856c845b0384de27cbb195cf91bb7b72dab17375e92aaa", // v8
  cargo_contract:      "0xf572afb0c960600745ac066c5e7cc4800f5e7d3eb75060c23269c4d91ee5dccc", // v11
  recruiting_terminal: "0x04f19523db8ed24226856c845b0384de27cbb195cf91bb7b72dab17375e92aaa", // v8
  announcement_board:  "0x04f19523db8ed24226856c845b0384de27cbb195cf91bb7b72dab17375e92aaa", // v8
  lore_wiki:           "0x04f19523db8ed24226856c845b0384de27cbb195cf91bb7b72dab17375e92aaa", // v8
  turret_delegation:   "0x6d2ef8f78456d8dd03c73ead8678b83c454765a6b54b546a877a901f823a073f", // v10
  ship_reimbursement:  "0x30557f9ccf881e7dd40c58aaf159d542280d7c42b4ef9b0ec2d7f3b63f7c0fd7", // v12
  // Future modules: add entry here with the package ID of the version that introduces them
};

/** Build the correct MoveEventType string for suix_queryEvents.
 *  Always uses the original package ID regardless of current version. */
export function eventType(module: string, event: string): string {
  const pkg = MODULE_ORIGIN_PKG[module] ?? CRADLEOS_PKG;
  return `${pkg}::${module}::${event}`;
}

// Legacy alias — kept for backward compat; prefer eventType() for new code
export const CRADLEOS_PKG_V5 = "0x934b4838bc94dfd551e57e261c0906b374e100751848a61d0d87b73047ba5be5";
// CradleMintController and CoinMetadata are shared objects from v4 init — same IDs across upgrades
export const CRADLE_MINT_CONTROLLER = "0x50a5c166ee46cd9a48b49649b6ac0b6cb01090470c96317bd9d69d7e50e19a50";
// cradle_coin was first introduced in the v8 deployment (0xee8cd44d…), not v7.
// Using MODULE_ORIGIN_PKG ensures the coin type resolves to the correct originating package.
export const CRDL_COIN_TYPE = `${MODULE_ORIGIN_PKG["cradle_coin"]}::cradle_coin::CRADLE_COIN`;
// Developer testnet objects — real users connect their own wallet
export const RAW_CHARACTER_ID = "0x5ef314c39748d5027fe4aef711f92497a4ea9618886f107916f2df0f16034c1c";
export const RAW_NETWORK_NODE_ID = "0xbce555aedb0c1322232c4243ce62cfc6210293cb69be6b4fe212ab9b4ba49fd7";
export const RAW_NODE_OWNER_CAP = "0x1e69832d1977a6963ea93b4cf2feeb7e432cde4ae463ff2989f35de3c78765f2";
export const FUEL_CONFIG = "0x0f354c803af170ac0d1ac9068625c6321996b3013dc67bdaf14d06f93fa1671f";
export const ENERGY_CONFIG = "0x9285364e8104c04380d9cc4a001bbdfc81a554aad441c2909c2d3bd52a0c9c62";
export const CLOCK = "0x6";
export const SUI_TESTNET_RPC = "https://fullnode.testnet.sui.io:443";
export const SUI_GRAPHQL = "https://graphql.testnet.sui.io/graphql";

// Well-known tribes that don't have CradleOS vaults but still need policy coverage
export const WELL_KNOWN_TRIBES: Array<{ tribeId: number; coinSymbol: string; label: string }> = [
  { tribeId: 1000167, coinSymbol: "—", label: "Default Spawn Tribe" },
];
export const WORLD_API = SERVER_ENV === "stillness"
  ? "https://world-api-stillness.live.tech.evefrontier.com"
  : "https://world-api-utopia.uat.pub.evefrontier.com";

export const NETWORK_NODE_TYPE = `${WORLD_PKG}::network_node::NetworkNode`;
export const GATE_TYPE = `${WORLD_PKG}::gate::Gate`;
export const ASSEMBLY_TYPE = `${WORLD_PKG}::assembly::Assembly`;
export const TURRET_TYPE = `${WORLD_PKG}::turret::Turret`;
export const STORAGE_UNIT_TYPE = `${WORLD_PKG}::storage_unit::StorageUnit`;
export const CHARACTER_TYPE = `${WORLD_PKG}::character::Character`;
// Legacy on-chain module names from V7 deploy — displayed as 'tribe' in UI
export const CORP_REGISTRY_TYPE = `${CRADLEOS_PKG}::corp_registry::CorpRegistry`;
export const CORP_TYPE       = `${CRADLEOS_PKG}::corp::Corp`; // on-chain name; UI displays as 'Tribe'
export const MEMBER_CAP_TYPE = `${CRADLEOS_PKG}::corp::MemberCap`;
export const TREASURY_TYPE   = `${CRADLEOS_PKG}::treasury::Treasury`;
export const REGISTRY_TYPE   = `${CRADLEOS_PKG}::registry::Registry`;
export const TRIBE_VAULT_TYPE = `${CRADLEOS_PKG}::tribe_vault::TribeVault`;
export const TRIBE_DEX_TYPE   = `${CRADLEOS_PKG}::tribe_dex::TribeDex`;

export const BOUNTY_BOARD = "0x00f1a9fc44244003b7ce2d8cc0d3aa81b37179f457b7797caeb6f5432dec7373";
export const WIKI_BOARD   = "0x7f407b8225af5cc5f7387e989ce50627d235fb1ee43d3d93424aab2b4fef709b";
export const WIKI_MOD_CAP = "0x9f9c611b84b89c73f9a629cfb3560db68831b3f90a80cad99c7c0690cb3acf0b";

export const MIST_PER_SUI = 1_000_000_000n;
export const CRDL_PER_TRIBE = 1n; // 1 CRDL per tribe coin unit (default display scale)

export const STRUCTURE_TYPES = [
  { type: NETWORK_NODE_TYPE, kind: "NetworkNode" as const, mod: "network_node", label: "Network Node" },
  { type: GATE_TYPE,         kind: "Gate"        as const, mod: "gate",         label: "Gate"         },
  { type: ASSEMBLY_TYPE,     kind: "Assembly"    as const, mod: "assembly",     label: "Assembly"     },
  { type: TURRET_TYPE,       kind: "Turret"      as const, mod: "turret",       label: "Turret"       },
  { type: STORAGE_UNIT_TYPE, kind: "StorageUnit" as const, mod: "storage_unit", label: "Storage Unit" },
] as const;

export type StructureKind = "NetworkNode" | "Gate" | "Assembly" | "Turret" | "StorageUnit";
