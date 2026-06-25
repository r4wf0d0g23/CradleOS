/**
 * Canonical EVE Frontier tenant configuration.
 *
 * Vendored from `@evefrontier/wallet-core/tenant` (MIT, Fenris Creations ehf.,
 * upstream HEAD 1b4be23 as of 2026-06-22). We vendor instead of importing
 * directly because wallet-core is published to the GitHub Packages registry
 * (auth-gated) rather than public npm. Vendoring the small data table avoids
 * adding auth complexity to our build environment.
 *
 * This is the SINGLE SOURCE OF TRUTH for world package IDs and datahub hosts
 * across CradleOS. When CCP republishes a tenant world package (wipe day, world
 * contract upgrades), update the entry here and every consumer in the codebase
 * picks it up automatically.
 *
 * Cross-references:
 *   - CCP's @evefrontier/wallet-core/tenant exposes the same data
 *   - CCP's @evefrontier/dapp-kit utils/constants exposes the same data
 *   - We keep ours synchronized via a periodic sanity check
 *
 * Update procedure:
 *   1. Pull latest wallet-core HEAD; compare TENANT_CONFIG block to this file
 *   2. If drift exists, update entries here
 *   3. Bump LAST_SYNCED_FROM date
 *   4. Run full build to validate
 *
 * Last synced from wallet-core: 2026-06-22 (HEAD 1b4be23)
 *
 * 2026-06-25 wipe-day update: Stillness world republished (fresh v1) per
 * world-contracts PR #189. New ids verified on-chain; wallet-core had not
 * yet picked them up at time of patch (HEAD still on previous ids).
 */

/** Tenant identifier — matches CCP's TenantId enum. */
export enum TenantId {
  STILLNESS = "stillness",
  UTOPIA = "utopia",
  TAUCETI = "tauceti",
  TIAKI = "tiaki",
  TETRA = "tetra",
  TESSERACT = "tesseract",
}

/** Per-tenant world configuration. */
export interface TenantConfig {
  /** World contract package id on Sui. */
  packageId: string;
  /** EVE token package id on Sui. */
  evePackageId: string;
  /** Datahub (World API) hostname for this tenant. */
  datahubHost: string;
}

/**
 * Canonical tenant table — derived from world-contracts v0.0.18.
 *
 * SOURCE OF TRUTH for world package IDs. Do not duplicate these values
 * in other files; import from here.
 */
export const TENANT_CONFIG: Record<TenantId, TenantConfig> = {
  [TenantId.TAUCETI]: {
    packageId:
      "0x353988e063b4683580e3603dbe9e91fefd8f6a06263a646d43fd3a2f3ef6b8c1",
    evePackageId:
      "0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9",
    datahubHost: "world-api-tauceti.test.priv.evefrontier.com",
  },
  [TenantId.TIAKI]: {
    packageId:
      "0x353988e063b4683580e3603dbe9e91fefd8f6a06263a646d43fd3a2f3ef6b8c1",
    evePackageId:
      "0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9",
    datahubHost: "world-api-tiaki.test.priv.evefrontier.com",
  },
  [TenantId.TESSERACT]: {
    packageId:
      "0x353988e063b4683580e3603dbe9e91fefd8f6a06263a646d43fd3a2f3ef6b8c1",
    evePackageId:
      "0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9",
    datahubHost: "world-api-tesseract.test.priv.evefrontier.com",
  },
  [TenantId.TETRA]: {
    packageId:
      "0x353988e063b4683580e3603dbe9e91fefd8f6a06263a646d43fd3a2f3ef6b8c1",
    evePackageId:
      "0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9",
    datahubHost: "world-api-tetra.test.priv.evefrontier.com",
  },
  [TenantId.UTOPIA]: {
    packageId:
      "0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75",
    evePackageId:
      "0xf0446b93345c1118f21239d7ac58fb82d005219b2016e100f074e4d17162a465",
    datahubHost: "world-api-utopia.uat.pub.evefrontier.com",
  },
  [TenantId.STILLNESS]: {
    packageId:
      "0x8b8a46ed766fa1358ce7c5c51f6a164b13d627a63e45343f69ed0ba0446c1aa1",
    evePackageId:
      "0xac361aa5ceb726bd974f885c9dea9e55dc9bc98fa1f5731c5965a810707bf0b8",
    datahubHost: "world-api-stillness.live.pub.evefrontier.com",
  },
};

/** EVE token coin type suffix — always `{packageId}::EVE::EVE`. */
export const EVE_COIN_TYPE_SUFFIX = "::EVE::EVE";

/** Returns the EVE coin type for the given tenant. */
export function getEveCoinType(tenant: TenantId): string {
  return `${TENANT_CONFIG[tenant].evePackageId}${EVE_COIN_TYPE_SUFFIX}`;
}

/** True when `coinType` is a known EVE token across any tenant. */
const KNOWN_EVE_COIN_TYPES: ReadonlySet<string> = new Set(
  Object.values(TenantId).map((t) => getEveCoinType(t)),
);
export function isEveCoinType(coinType: string): boolean {
  return KNOWN_EVE_COIN_TYPES.has(coinType);
}

/**
 * Sponsored transaction action enum.
 *
 * Vendored from `@evefrontier/wallet-core/sponsored-transaction`. These are
 * the only operations that CCP's sponsored-tx backend will pay gas for.
 * Voting and other CradleOS-extension operations are NOT in this enum and
 * must use CradleOS's own sponsorship layer.
 */
export enum SponsoredTransactionAction {
  BRING_ONLINE = "online",
  BRING_OFFLINE = "offline",
  UPDATE_METADATA = "update-metadata",
  LINK_SMART_GATE = "link-smart-gate",
  UNLINK_SMART_GATE = "unlink-smart-gate",
}

/** Assembly kinds that participate in sponsored transactions. */
export enum AssemblyKind {
  SmartStorageUnit = "SmartStorageUnit",
  SmartTurret = "SmartTurret",
  SmartGate = "SmartGate",
  NetworkNode = "NetworkNode",
  Assembly = "Assembly",
}
