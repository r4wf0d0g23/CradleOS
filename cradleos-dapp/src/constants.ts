/** Cycle 7 clean-wipe configuration. Historical version-named aliases below
 * resolve only to the fresh lineage; retired house IDs are intentionally empty.
 * Publication history is preserved in git and deploy/previous-manifests, not runtime fallbacks. */
import { CYCLE_DEPLOYMENT, CASINO_READY, SSU_READY, VOTING_READY } from "./lib/cycleDeployment";
import { CURRENT_WORLD_INDEX_READY, CURRENT_EVE_COIN_TYPE } from "./lib/cycle";

export type ServerEnv = "stillness";

const _serverEnv: ServerEnv = "stillness";

export function getServerEnv(): ServerEnv { return _serverEnv; }

export function onServerEnvChange(_fn: () => void) { return () => {}; }

export const SERVER_ENV: ServerEnv = _serverEnv;
export const SERVER_LABEL = "STILLNESS (Live)";
import { TENANT_CONFIG, TenantId } from "./lib/tenantConfig";
export const WORLD_PKG_STILLNESS = TENANT_CONFIG[TenantId.STILLNESS].packageId;
export const WORLD_PKG = WORLD_PKG_STILLNESS;
export const OBJECT_REGISTRY_STILLNESS = "0x8fd47e6e5cf8cb9b789cef26fbb674be819d8abd6afccaf50e95451212f0813a";
export const OBJECT_REGISTRY = OBJECT_REGISTRY_STILLNESS;
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000000000000000000000000000";
export const CRADLEOS_ORIGINAL = CYCLE_DEPLOYMENT.packages.core;
export const CRADLEOS_ORIGINAL_PREV = "";
export const CRADLEOS_PKG      = CYCLE_DEPLOYMENT.packages.core;
export const CRADLEOS_V2_PKG = CYCLE_DEPLOYMENT.packages.core;
export const CRADLEOS_V3_PKG = CYCLE_DEPLOYMENT.packages.core;
export const SSU_ACCESS_PKG_STILLNESS    = CYCLE_DEPLOYMENT.packages.ssu;
export const SSU_ACCESS_ORIGINAL_STILLNESS = CYCLE_DEPLOYMENT.packages.ssu;
export const SSU_POLICY_REGISTRY_STILLNESS = CYCLE_DEPLOYMENT.objects.ssuRegistry;

export const SSU_ACCESS_PKG: string = SSU_ACCESS_PKG_STILLNESS;

export const SSU_ACCESS_ORIGINAL: string = SSU_ACCESS_ORIGINAL_STILLNESS;

export const SSU_POLICY_REGISTRY: string = SSU_POLICY_REGISTRY_STILLNESS;

export const SSU_ACCESS_AVAILABLE: boolean = SSU_READY;
export const CRADLEOS_UPGRADE_ORIGIN = CYCLE_DEPLOYMENT.packages.core;
export const CRADLEOS_EVENT_PKGS: readonly string[] = CRADLEOS_ORIGINAL ? [CRADLEOS_ORIGINAL] : [];
export const RECRUITING_PKG       = CRADLEOS_PKG;
export const TRIBE_ROLES_PKG      = CRADLEOS_PKG;
export const GATE_POLICY_PKG      = CRADLEOS_PKG;
export const CRADLEOS_EVENTS_PKG  = CRADLEOS_PKG;
export const CRADLEOS_VOTING_PKG: string = CYCLE_DEPLOYMENT.packages.voting;
export const CRADLEOS_VOTING_REGISTRY: string = CYCLE_DEPLOYMENT.objects.votingRegistry;
export const CRADLEOS_VOTING_EVENT_PKGS: readonly string[] = [
  CRADLEOS_VOTING_PKG,
];
export const CRADLEOS_VOTING_AVAILABLE: boolean =
  VOTING_READY;
export const CRADLEOS_VOTING_PREVIEW: boolean = false;
export const CRADLEOS_WIPE_DATE_ISO: string = "2026-09-29";

export function eventType(module: string, event: string): string {
  return `${CRADLEOS_ORIGINAL}::${module}::${event}`;
}
export const EVE_COIN_TYPE_STILLNESS = CURRENT_EVE_COIN_TYPE;
export { CURRENT_EVE_COIN_TYPE } from "./lib/cycle";
export const EVE_COIN_TYPE = EVE_COIN_TYPE_STILLNESS;
export const CRDL_COIN_TYPE = EVE_COIN_TYPE;
export const RAW_CHARACTER_ID = "";
export const RAW_NETWORK_NODE_ID = "";
export const RAW_NODE_OWNER_CAP = "";
export const FUEL_CONFIG_STILLNESS = "0xefe91f22b382d34721a386d8d5188d5244316bcfea47dee518210c01cf080b60";
export const FUEL_CONFIG = FUEL_CONFIG_STILLNESS;
export const ENERGY_CONFIG_STILLNESS = "0xafde88ecb4f7722660a094582904c32bd837a1af8761a243d08e842a7905b6b3";
export const ENERGY_CONFIG_STILLNESS_ISV = 1016612658;
export const ENERGY_CONFIG = ENERGY_CONFIG_STILLNESS;
export const ENERGY_CONFIG_INITIAL_SHARED_VERSION = ENERGY_CONFIG_STILLNESS_ISV;
export const CLOCK = "0x6";
export const RANDOM_OBJECT = "0x8";
export const CASINO_PKG_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_PKG_V28_STILLNESS_PREV = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_PKG_V27_STILLNESS_RETIRED = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_PKG_V26_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_PKG_V26_GATELESS_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_PKG_V25_RETIRED_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_V3_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_V2_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_ORIGINAL_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_V27_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_V27 = _serverEnv === "stillness" ? CASINO_V27_STILLNESS : "";
export const CASINO_V28_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_V28 = _serverEnv === "stillness" ? CASINO_V28_STILLNESS : "";
export const CASINO_PKG = _serverEnv === "stillness" ? CASINO_PKG_STILLNESS : "";
export const CASINO_V3 = _serverEnv === "stillness" ? CASINO_V3_STILLNESS : "";
export const CASINO_V5_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_V5 = _serverEnv === "stillness" ? CASINO_V5_STILLNESS : "";
export const CASINO_V7_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_V7 = _serverEnv === "stillness" ? CASINO_V7_STILLNESS : "";
export const CASINO_V8_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_V8 = _serverEnv === "stillness" ? CASINO_V8_STILLNESS : "";
export const CASINO_V10_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_V10 = _serverEnv === "stillness" ? CASINO_V10_STILLNESS : "";
export const CASINO_PLINKO_MULTI_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_PLINKO_MULTI = _serverEnv === "stillness" ? CASINO_PLINKO_MULTI_STILLNESS : "";
export const CASINO_V16_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_V16 = _serverEnv === "stillness" ? CASINO_V16_STILLNESS : "";
export const CASINO_V18_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_V18 = _serverEnv === "stillness" ? CASINO_V18_STILLNESS : "";
export const CASINO_V19_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_V19 = _serverEnv === "stillness" ? CASINO_V19_STILLNESS : "";
export const CASINO_V20_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_V20 = _serverEnv === "stillness" ? CASINO_V20_STILLNESS : "";
export const CASINO_V21_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_V21 = _serverEnv === "stillness" ? CASINO_V21_STILLNESS : "";
export const CASINO_V22_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_V22 = _serverEnv === "stillness" ? CASINO_V22_STILLNESS : "";
export const CASINO_V23_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_V23 = _serverEnv === "stillness" ? CASINO_V23_STILLNESS : "";
export const CASINO_V24_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_V24 = _serverEnv === "stillness" ? CASINO_V24_STILLNESS : "";
export const CASINO_V25_STILLNESS = CYCLE_DEPLOYMENT.packages.casino;
export const CASINO_V25 = _serverEnv === "stillness" ? CASINO_V25_STILLNESS : "";
export const CASINO_V2 = _serverEnv === "stillness" ? CASINO_V2_STILLNESS : "";
export const CASINO_ORIGINAL = _serverEnv === "stillness" ? CASINO_ORIGINAL_STILLNESS : "";
export const CASINO_HOUSE_V25_STILLNESS = "";
export const CASINO_HOUSE_V27_STILLNESS_RETIRED = "";
export const CASINO_HOUSE_STILLNESS = CYCLE_DEPLOYMENT.objects.casinoHouse;
export const CASINO_HOUSE = _serverEnv === "stillness" ? CASINO_HOUSE_STILLNESS : "";
export const CASINO_AVAILABLE = CASINO_READY;
const _ownedIndexBase = (): string => {
  try {
    if (typeof location !== "undefined") {
      const h = location.hostname;
      if (h === "cradleos.io" || h === "www.cradleos.io" || h.endsWith(".pages.dev")) {
        return "/api/owned-objects";
      }
    }
  } catch {  }
  return "https://keeper.reapers.shop/index/owned-objects";
};
export const OWNED_INDEX_BASE = CURRENT_WORLD_INDEX_READY ? _ownedIndexBase() : "";

export const SUI_TESTNET_RPC = "https://keeper.reapers.shop/sui";
export const SUI_TESTNET_RPC_FALLBACK = "https://keeper.reapers.shop/sui?nocache=1";
export const SUI_TESTNET_RPC_DIRECT = "https://keeper.reapers.shop/sui?nocache=1";
export const SUI_GRAPHQL = "https://graphql.testnet.sui.io/graphql";
export const WELL_KNOWN_TRIBES: Array<{ tribeId: number; coinSymbol: string; label: string }> = [
  { tribeId: 1000167, coinSymbol: "—", label: "Default Spawn Tribe" },
];

export const WORLD_API = `https://${TENANT_CONFIG[TenantId.STILLNESS].datahubHost}`;

export const NETWORK_NODE_TYPE = `${WORLD_PKG}::network_node::NetworkNode`;
export const GATE_TYPE = `${WORLD_PKG}::gate::Gate`;
export const ASSEMBLY_TYPE = `${WORLD_PKG}::assembly::Assembly`;
export const TURRET_TYPE = `${WORLD_PKG}::turret::Turret`;
export const STORAGE_UNIT_TYPE = `${WORLD_PKG}::storage_unit::StorageUnit`;
export const CHARACTER_TYPE = `${WORLD_PKG}::character::Character`;
export const CORP_REGISTRY_TYPE = `${CRADLEOS_ORIGINAL}::corp_registry::CorpRegistry`;
export const CORP_TYPE       = `${CRADLEOS_ORIGINAL}::corp::Corp`;
export const MEMBER_CAP_TYPE = `${CRADLEOS_ORIGINAL}::corp::MemberCap`;
export const TREASURY_TYPE   = `${CRADLEOS_ORIGINAL}::treasury::Treasury`;
export const REGISTRY_TYPE   = `${CRADLEOS_ORIGINAL}::registry::Registry`;
export const TRIBE_VAULT_TYPE = `${CRADLEOS_ORIGINAL}::tribe_vault::TribeVault`;
export const TRIBE_DEX_TYPE   = `${CRADLEOS_ORIGINAL}::tribe_dex::TribeDex`;
export const BOUNTY_BOARD = CYCLE_DEPLOYMENT.objects.bountyBoard;
export const TRUSTLESS_BOUNTY_BOARD = CYCLE_DEPLOYMENT.objects.trustlessBountyBoard;
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
