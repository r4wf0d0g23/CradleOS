// ── Server environment ─────────────────────────────────────────────────────────
// VITE_SERVER_ENV: "utopia" (hackathon) | "stillness" (live CradleOS)
// Set at build time via env var. Defaults to stillness (live CradleOS build).
// Hackathon build sets VITE_SERVER_ENV=utopia explicitly.
// In dev mode, can be toggled at runtime via setServerEnv().

export type ServerEnv = "utopia" | "stillness";

// Runtime-switchable env — check localStorage override in ALL builds (not just dev)
const _buildEnv = (import.meta.env.VITE_SERVER_ENV ?? "stillness") as ServerEnv;
// For Stillness (CradleOS) builds: never allow localStorage to override to utopia.
// Utopia localStorage state from the hackathon dApp must not bleed into Stillness.
const _storedEnv = (localStorage.getItem("cradleos_server_env") as ServerEnv | null);
let _serverEnv: ServerEnv = (_buildEnv === "stillness") ? "stillness" : (_storedEnv ?? _buildEnv);
const _listeners = new Set<() => void>();

export function getServerEnv(): ServerEnv { return _serverEnv; }
export function setServerEnv(env: ServerEnv) {
  if (env === _serverEnv) return;
  _serverEnv = env;
  localStorage.setItem("cradleos_server_env", env);
  _listeners.forEach(fn => fn());
}
/** Switch server and reload the page so all derived constants reinitialize. */
export function switchServerAndReload(env: ServerEnv) {
  localStorage.setItem("cradleos_server_env", env);
  window.location.reload();
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

// ── CradleOS package IDs ──────────────────────────────────────────────────────
// Sui uses TWO addresses:
//   original-id  → event types, struct types, type filters (immutable, never changes)
//   published-at → moveCall targets (changes on each `sui client upgrade`)
//
// v2 deployed 2026-03-25 (Reapers_v2)
export const CRADLEOS_ORIGINAL = "0x70d0797bf1772c94f15af6549ace9117a6f6c43c4786355004d14e9a5c0f97b3";
export const CRADLEOS_PKG      = "0xf0211d3c84d3be89cb924dce383afaf11cfb8cf204afa05ecd2e869347f68b13";
//
// ── ARCHIVED PACKAGE IDS (do NOT use) ─────────────────────────────────────────
// v1 (2026-03-24 clean-slate):  0x97c4350fc23fbb18de9fad6ef9de6290c98c4f4e57958325ffa0a16a21b759b4
// pre-v1 (legacy):              0x7541ac23fb681e4ea2cb54c0693a0c618c2ab24e69217cf4d0436adcc62ee715
// ───────────────────────────────────────────────────────────────────────────────

// Modules added AFTER the original publish have a different original-id on Sui.
// Sui indexes events/types by the package version where the module first appeared,
// NOT the package's original-id. These modules were introduced in upgrade v2.
export const CRADLEOS_UPGRADE_ORIGIN = "0xbf4249b176bf2c7594dbd46615f825b456da4bbba035fdb968c0e812e34dab8d";
// Affected modules: collateral_vault, keeper_shrine, trustless_bounty
// Use CRADLEOS_UPGRADE_ORIGIN (not CRADLEOS_ORIGINAL) for event queries on these.

// Backward-compat aliases — all point to published-at for moveCall targets
export const RECRUITING_PKG       = CRADLEOS_PKG;
export const TRIBE_ROLES_PKG      = CRADLEOS_PKG;
export const GATE_POLICY_PKG      = CRADLEOS_PKG;
export const CRADLEOS_EVENTS_PKG  = CRADLEOS_PKG;

/** Build a MoveEventType string for suix_queryEvents.
 *  Uses ORIGINAL package ID (Sui indexes events by original, not published-at). */
export function eventType(module: string, event: string): string {
  return `${CRADLEOS_ORIGINAL}::${module}::${event}`;
}

// EVE Token coin types per server environment
export const EVE_COIN_TYPE_STILLNESS = "0x2a66a89b5a735738ffa4423ac024d23571326163f324f9051557617319e59d60::EVE::EVE";
export const EVE_COIN_TYPE_UTOPIA = "0xf0446b93345c1118f21239d7ac58fb82d005219b2016e100f074e4d17162a465::EVE::EVE";
export const EVE_COIN_TYPE = _serverEnv === "stillness" ? EVE_COIN_TYPE_STILLNESS : EVE_COIN_TYPE_UTOPIA;

// Backward compat alias — deprecated, use EVE_COIN_TYPE
export const CRDL_COIN_TYPE = EVE_COIN_TYPE;

// Developer testnet objects — real users connect their own wallet
export const RAW_CHARACTER_ID = "0x5ef314c39748d5027fe4aef711f92497a4ea9618886f107916f2df0f16034c1c";
export const RAW_NETWORK_NODE_ID = "0xbce555aedb0c1322232c4243ce62cfc6210293cb69be6b4fe212ab9b4ba49fd7";
export const RAW_NODE_OWNER_CAP = "0x1e69832d1977a6963ea93b4cf2feeb7e432cde4ae463ff2989f35de3c78765f2";
// FuelConfig per server — used in network_node::offline tx
export const FUEL_CONFIG_STILLNESS = "0x4fcf28a9be750d242bc5d2f324429e31176faecb5b84f0af7dff3a2a6e243550";
export const FUEL_CONFIG_UTOPIA    = "0x0f354c803af170ac0d1ac9068625c6321996b3013dc67bdaf14d06f93fa1671f";
export const FUEL_CONFIG = _serverEnv === "stillness" ? FUEL_CONFIG_STILLNESS : FUEL_CONFIG_UTOPIA;
// EnergyConfig for Stillness world package (0x28b497...)
export const ENERGY_CONFIG_STILLNESS = "0xd77693d0df5656d68b1b833e2a23cc81eb3875d8d767e7bd249adde82bdbc952";
export const ENERGY_CONFIG_STILLNESS_ISV = 791126223;
// EnergyConfig for Utopia world package (0xd12a70c7...)
export const ENERGY_CONFIG_UTOPIA = "0x9285364e8104c04380d9cc4a001bbdfc81a554aad441c2909c2d3bd52a0c9c62";
export const ENERGY_CONFIG_UTOPIA_ISV = 791126162;
// Active EnergyConfig — selected by server env
export const ENERGY_CONFIG = _serverEnv === "stillness" ? ENERGY_CONFIG_STILLNESS : ENERGY_CONFIG_UTOPIA;
export const ENERGY_CONFIG_INITIAL_SHARED_VERSION = _serverEnv === "stillness" ? ENERGY_CONFIG_STILLNESS_ISV : ENERGY_CONFIG_UTOPIA_ISV;
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
// Struct types use ORIGINAL package ID (Sui indexes types by original, not published-at)
export const CORP_REGISTRY_TYPE = `${CRADLEOS_ORIGINAL}::corp_registry::CorpRegistry`;
export const CORP_TYPE       = `${CRADLEOS_ORIGINAL}::corp::Corp`;
export const MEMBER_CAP_TYPE = `${CRADLEOS_ORIGINAL}::corp::MemberCap`;
export const TREASURY_TYPE   = `${CRADLEOS_ORIGINAL}::treasury::Treasury`;
export const REGISTRY_TYPE   = `${CRADLEOS_ORIGINAL}::registry::Registry`;
export const TRIBE_VAULT_TYPE = `${CRADLEOS_ORIGINAL}::tribe_vault::TribeVault`;
export const TRIBE_DEX_TYPE   = `${CRADLEOS_ORIGINAL}::tribe_dex::TribeDex`;

// Shared objects that must be re-created by founders on the new chain
export const BOUNTY_BOARD = "0x965709ce9d087d8f90edac6e19d8d42908098ec253e83f20a650884cd4814d90";
// Trustless bounty board — set after deploying trustless_bounty module
export const TRUSTLESS_BOUNTY_BOARD = "0xc6b60757b79e474745b5d0e9b1d2aa82b0ee6aca9efb92917b7f2a3c665c7498";
export const KEEPER_SHRINE = "0x1bc082778513e51d2dfe691f8084822ac3b5db4014c0135a61c4ff135b5b671a";
// Wiki board not yet created on-chain — LoreWikiPanel shows placeholder when empty
export const WIKI_BOARD   = "";
export const WIKI_MOD_CAP = "";

export const MIST_PER_SUI = 1_000_000_000n;

export const STRUCTURE_TYPES = [
  { type: NETWORK_NODE_TYPE, kind: "NetworkNode" as const, mod: "network_node", label: "Network Node" },
  { type: GATE_TYPE,         kind: "Gate"        as const, mod: "gate",         label: "Gate"         },
  { type: ASSEMBLY_TYPE,     kind: "Assembly"    as const, mod: "assembly",     label: "Assembly"     },
  { type: TURRET_TYPE,       kind: "Turret"      as const, mod: "turret",       label: "Turret"       },
  { type: STORAGE_UNIT_TYPE, kind: "StorageUnit" as const, mod: "storage_unit", label: "Storage Unit" },
] as const;

export type StructureKind = "NetworkNode" | "Gate" | "Assembly" | "Turret" | "StorageUnit";
