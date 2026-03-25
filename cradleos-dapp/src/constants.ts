// ── Server environment ─────────────────────────────────────────────────────────
// VITE_SERVER_ENV: "utopia" (hackathon) | "stillness" (live CradleOS)
// Set at build time via env var. Defaults to utopia (hackathon dApp).
// In dev mode, can be toggled at runtime via setServerEnv().

export type ServerEnv = "utopia" | "stillness";

// Runtime-switchable env (dev only — production builds bake it at compile time)
// In dev mode, check localStorage for override
const _buildEnv = (import.meta.env.VITE_SERVER_ENV ?? "utopia") as ServerEnv;
const _storedEnv = import.meta.env.DEV ? (localStorage.getItem("cradleos_dev_env") as ServerEnv | null) : null;
let _serverEnv: ServerEnv = _storedEnv ?? _buildEnv;
const _listeners = new Set<() => void>();

export function getServerEnv(): ServerEnv { return _serverEnv; }
export function setServerEnv(env: ServerEnv) {
  if (env === _serverEnv) return;
  _serverEnv = env;
  if (import.meta.env.DEV) localStorage.setItem("cradleos_dev_env", env);
  _listeners.forEach(fn => fn());
}
export function onServerEnvChange(fn: () => void) { _listeners.add(fn); return () => { _listeners.delete(fn); }; }

// Static alias for non-reactive imports (still reads current value)
export const SERVER_ENV = _serverEnv;

// Derived values — use getters for reactive access
export const SERVER_LABEL = _serverEnv === "stillness" ? "STILLNESS (Live)" : "UTOPIA (Hackathon)";

// Utopia WORLD_PKG — v2 deployed 2026-03-22 (world-contracts v0.0.21)
// Original v1: 0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75
export const WORLD_PKG_UTOPIA    = "0x07e6b810c2dff6df56ea7fbad9ff32f4d84cbee53e496267515887b712924bd1";
export const WORLD_PKG_UTOPIA_V1 = "0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75";
// Stillness WORLD_PKG — confirmed active, different deployment on same Sui testnet
export const WORLD_PKG_STILLNESS = "0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c";
export const WORLD_PKG = _serverEnv === "stillness" ? WORLD_PKG_STILLNESS : WORLD_PKG_UTOPIA;
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000000000000000000000000000";

// ── Unified package ───────────────────────────────────────────────────────────
// Clean-slate publish 2026-03-24: all 22 modules in a single package.
// All old per-version package IDs are retired.
export const CRADLEOS_PKG = "0x97c4350fc23fbb18de9fad6ef9de6290c98c4f4e57958325ffa0a16a21b759b4";

// All modules live in the unified package — these aliases exist for backward compat
// with any code that still imports versioned names.
export const CRADLEOS_PKG_V8  = CRADLEOS_PKG;
export const CRADLEOS_PKG_V10 = CRADLEOS_PKG;
export const CRADLEOS_PKG_V11 = CRADLEOS_PKG;
export const CRADLEOS_PKG_V12 = CRADLEOS_PKG;
export const CRADLEOS_PKG_V14 = CRADLEOS_PKG;
export const RECRUITING_PKG   = CRADLEOS_PKG;
export const TRIBE_ROLES_PKG  = CRADLEOS_PKG;
export const GATE_POLICY_PKG  = CRADLEOS_PKG;
export const CRADLEOS_EVENTS_PKG = CRADLEOS_PKG;
export const CRADLEOS_PKG_V5  = CRADLEOS_PKG;

// ── Module origin map ─────────────────────────────────────────────────────────
// Clean-slate publish: all events will be indexed under the new unified package.
// Every module was first introduced in this package — no split origins.
//
// To use: import { eventType } from "../constants";
//   eventType("defense_policy", "PolicyCreated")
//   → "0x97c435...::defense_policy::PolicyCreated"
const MODULE_ORIGIN_PKG: Record<string, string> = {
  cradle_coin:         CRADLEOS_PKG,
  tribe_vault:         CRADLEOS_PKG,
  tribe_dex:           CRADLEOS_PKG,
  registry:            CRADLEOS_PKG,
  defense_policy:      CRADLEOS_PKG,
  bounty_contract:     CRADLEOS_PKG,
  gate_profile:        CRADLEOS_PKG,
  inheritance:         CRADLEOS_PKG,
  cargo_contract:      CRADLEOS_PKG,
  recruiting_terminal: CRADLEOS_PKG,
  announcement_board:  CRADLEOS_PKG,
  lore_wiki:           CRADLEOS_PKG,
  turret_delegation:   CRADLEOS_PKG,
  ship_reimbursement:  CRADLEOS_PKG,
  corp:                CRADLEOS_PKG,
  gate_control:        CRADLEOS_PKG,
  gate_policy:         CRADLEOS_PKG,
  tribe_roles:         CRADLEOS_PKG,
  treasury:            CRADLEOS_PKG,
  contributions:       CRADLEOS_PKG,
  character_registry:  CRADLEOS_PKG,
  turret_ext:          CRADLEOS_PKG,
};

/** Build the correct MoveEventType string for suix_queryEvents.
 *  Always uses the original package ID regardless of current version. */
export function eventType(module: string, event: string): string {
  const pkg = MODULE_ORIGIN_PKG[module] ?? CRADLEOS_PKG;
  return `${pkg}::${module}::${event}`;
}

// Shared objects created by the unified package publish
export const CRADLE_MINT_CONTROLLER = "0xc2257efb6d3df3dbcfa47ec4dd784587e1c09d63b67d3b01a1b5a0410de1ca0c";
export const CRDL_COIN_TYPE = `${CRADLEOS_PKG}::cradle_coin::CRADLE_COIN`;

// Developer testnet objects — real users connect their own wallet
export const RAW_CHARACTER_ID = "0x5ef314c39748d5027fe4aef711f92497a4ea9618886f107916f2df0f16034c1c";
export const RAW_NETWORK_NODE_ID = "0xbce555aedb0c1322232c4243ce62cfc6210293cb69be6b4fe212ab9b4ba49fd7";
export const RAW_NODE_OWNER_CAP = "0x1e69832d1977a6963ea93b4cf2feeb7e432cde4ae463ff2989f35de3c78765f2";
export const FUEL_CONFIG = "0x0f354c803af170ac0d1ac9068625c6321996b3013dc67bdaf14d06f93fa1671f";
// EnergyConfig for Stillness world package (0x28b497...)
export const ENERGY_CONFIG = "0xd77693d0df5656d68b1b833e2a23cc81eb3875d8d767e7bd249adde82bdbc952";
export const ENERGY_CONFIG_INITIAL_SHARED_VERSION = 791126223;
// EnergyConfig for Utopia world package (0xd12a70c7...) — kept for reference
export const ENERGY_CONFIG_UTOPIA = "0x9285364e8104c04380d9cc4a001bbdfc81a554aad441c2909c2d3bd52a0c9c62";
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

// Shared objects that must be re-created by founders on the new chain
export const BOUNTY_BOARD = "";
export const WIKI_BOARD   = "";
export const WIKI_MOD_CAP = "";

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
