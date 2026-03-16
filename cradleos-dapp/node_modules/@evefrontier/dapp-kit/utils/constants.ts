// ============================================================================
// Environment Variable Helpers
// ============================================================================

import { SuiGraphqlNetwork } from "../types";

/**
 * Get a required environment variable, throwing if not set.
 * @param name - The environment variable name (e.g., "VITE_SUI_GRAPHQL_ENDPOINT")
 * @throws {Error} If the environment variable is not set
 */
function getEnvVar(name: string): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Please set it in your .env file.`,
    );
  }
  return value;
}

// ============================================================================
// Environment-Based Configuration
// ============================================================================

function isSuiGraphqlNetwork(value: string): value is SuiGraphqlNetwork {
  return SUI_GRAPHQL_NETWORKS.includes(value as SuiGraphqlNetwork);
}

/**
 * Get the Sui GraphQL endpoint URL for the given network.
 * Unknown values fall back to testnet to avoid returning undefined.
 * @param env - Network identifier (testnet, devnet, mainnet). Defaults to testnet.
 * @returns The GraphQL endpoint URL
 * @category Utilities - Config
 */
export function getSuiGraphqlEndpoint(
  env: string = DEFAULT_GRAPHQL_NETWORK,
): string {
  const network = isSuiGraphqlNetwork(env) ? env : DEFAULT_GRAPHQL_NETWORK;
  return GRAPHQL_ENDPOINTS[network];
}

/**
 * Get the EVE World package ID from environment.
 * @returns The package ID (0x-prefixed address)
 * @throws {Error} If VITE_EVE_WORLD_PACKAGE_ID is not set
 * @category Utilities - Config
 */
export const getEveWorldPackageId = (): string =>
  getEnvVar("VITE_EVE_WORLD_PACKAGE_ID");

/** Type string for Character OwnerCap from the EVE World package. @category Utilities - Config */
export const getCharacterOwnerCapType = (): string => {
  const pkg = getEveWorldPackageId();
  return `${pkg}::access::OwnerCap<${pkg}::character::Character>`;
};

/** Type string for Character PlayerProfile from the EVE World package. @category Utilities - Config */
export const getCharacterPlayerProfileType = (): string => {
  const pkg = getEveWorldPackageId();
  return `${pkg}::character::PlayerProfile`;
};

/** Type string for ObjectRegistry from the EVE World package. @category Utilities - Config */
export const getObjectRegistryType = (): string =>
  `${getEveWorldPackageId()}::object_registry::ObjectRegistry`;

/** Type string for EnergyConfig from the EVE World package. @category Utilities - Config */
export const getEnergyConfigType = (): string =>
  `${getEveWorldPackageId()}::energy::EnergyConfig`;

/** Type string for FuelConfig from the EVE World package. @category Utilities - Config */
export const getFuelEfficiencyConfigType = (): string =>
  `${getEveWorldPackageId()}::fuel::FuelConfig`;

// ============================================================================
// Constants
// ============================================================================

/** Default Sui network for GraphQL endpoint selection.
 *  @category Constants
 */
export const DEFAULT_GRAPHQL_NETWORK: SuiGraphqlNetwork = "testnet";

/** Tenant when not provided via URL ?tenant= (e.g. dev/default chain).
 *  @category Constants
 */
export const DEFAULT_TENANT = "stillness";

/** Allowed Sui network identifiers for GraphQL endpoint selection.
 *  @category Constants
 */
export const SUI_GRAPHQL_NETWORKS = ["testnet", "devnet", "mainnet"] as const;

/** GraphQL endpoint URLs for each Sui network.
 *  @category Constants
 */
export const GRAPHQL_ENDPOINTS: Record<SuiGraphqlNetwork, string> = {
  testnet: "https://graphql.testnet.sui.io/graphql",
  devnet: "https://graphql.devnet.sui.io/graphql",
  mainnet: "https://graphql.mainnet.sui.io/graphql",
};

/** Polling interval in milliseconds (10 seconds).
 *  @category Constants
 */
export const POLLING_INTERVAL = 10000;

/** Local storage keys.
 *  @category Constants
 */
export const STORAGE_KEYS = {
  CONNECTED: "eve-dapp-connected",
} as const;

/** Type IDs for in-game items.
 *  @category Constants
 */
/* eslint-disable @typescript-eslint/no-loss-of-precision */
export enum TYPEIDS {
  LENS = 77518,
  TRANSACTION_CHIP = 79193,
  COMMON_ORE = 77800,
  METAL_RICH_ORE = 77810,
  SMART_STORAGE_UNIT = 77917,
  PROTOCOL_DEPOT = 85249,
  GATEKEEPER = 83907,
  SALT = 83839,
  NETWORK_NODE = 88092,
  PORTABLE_REFINERY = 87161,
  PORTABLE_PRINTER = 87162,
  PORTABLE_STORAGE = 87566,
  REFUGE = 87160,
}

/** @category Constants */
export const EXCLUDED_TYPEIDS = [
  TYPEIDS.PORTABLE_REFINERY,
  TYPEIDS.PORTABLE_PRINTER,
  TYPEIDS.PORTABLE_STORAGE,
  TYPEIDS.REFUGE,
];

/** Volume - from wei units to m3.
 *  @category Constants
 */
export const ONE_M3 = 1000000000000000000;

export type TenantId = "utopia" | "stillness" | "testevenet" | "nebula";

/** Per-tenant config: EVE token package ID (Sui) and Datahub API host. v0.0.18
 * @category Constants
 */
export interface TenantConfig {
  packageId: string;
  evePackageId: string;
  datahubHost: string;
}

/** Single source of truth for the four tenants (package ID + datahub host).
 * Corresponds to world contracts v0.0.18
 * @category Constants
 */
export const TENANT_CONFIG: Record<TenantId, TenantConfig> = {
  nebula: {
    packageId:
      "0x353988e063b4683580e3603dbe9e91fefd8f6a06263a646d43fd3a2f3ef6b8c1",
    evePackageId:
      "0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9",
    datahubHost: "world-api-nebula.test.evefrontier.tech",
  },
  testevenet: {
    packageId:
      "0x353988e063b4683580e3603dbe9e91fefd8f6a06263a646d43fd3a2f3ef6b8c1",
    evePackageId:
      "0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9",
    datahubHost: "world-api-testevenet.test.evefrontier.tech",
  },
  utopia: {
    packageId:
      "0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75",
    evePackageId:
      "0xf0446b93345c1118f21239d7ac58fb82d005219b2016e100f074e4d17162a465",
    datahubHost: "world-api-utopia.uat.pub.evefrontier.com",
  },
  stillness: {
    packageId:
      "0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c",
    evePackageId:
      "0x2a66a89b5a735738ffa4423ac024d23571326163f324f9051557617319e59d60",
    datahubHost: "world-api-stillness.live.tech.evefrontier.com",
  },
};

/** EVE token package ID per tenant (derived from TENANT_CONFIG).
 * @category Constants
 */
export const EVE_PACKAGE_ID_BY_TENANT = Object.fromEntries(
  (Object.entries(TENANT_CONFIG) as [TenantId, TenantConfig][]).map(
    ([id, config]) => [id, config.evePackageId],
  ),
) as Record<TenantId, string>;

/** Datahub API host per tenant (derived from TENANT_CONFIG).
 * @category Constants
 */
export const DATAHUB_BY_TENANT = Object.fromEntries(
  (Object.entries(TENANT_CONFIG) as [TenantId, TenantConfig][]).map(
    ([id, config]) => [id, config.datahubHost],
  ),
) as Record<TenantId, string>;

/** @category Constants */
const EVE_COIN_TYPE_SUFFIX = "::EVE::EVE";

/**
 * Returns the EVE token coin type for the given tenant.
 * Format: `{packageId}::EVE::EVE` (Sui Move type used by RPC/GraphQL).
 * @param tenantId - The tenant identifier (e.g., "utopia", "stillness")
 * @returns The fully qualified EVE coin type string
 *
 * @category Utilities - Config
 */
export function getEveCoinType(tenantId: TenantId): string {
  return `${EVE_PACKAGE_ID_BY_TENANT[tenantId]}${EVE_COIN_TYPE_SUFFIX}`;
}

/** Known EVE coin types (one per tenant) for strict matching.
 *  @category Constants
 */
export const KNOWN_EVE_COIN_TYPES = new Set(
  (Object.keys(EVE_PACKAGE_ID_BY_TENANT) as TenantId[]).map(getEveCoinType),
);
