/**
 * EVE Frontier Wallet Standard Feature Extensions
 *
 * Custom wallet features for EVE Frontier dApps that extend the
 * standard Sui wallet capabilities.
 */

import {
  Assemblies,
  ASSEMBLY_TYPE_API_STRING,
  AssemblyType,
  EVEFRONTIER_SPONSORED_TRANSACTION,
  SponsoredTransactionActions,
  SponsoredTransactionAssemblyType,
  SponsoredTransactionMetadata,
} from "../types";

/**
 * Maps an assembly type enum to the API string expected by the sponsored transaction backend.
 *
 * @category Wallet
 */
export function getAssemblyTypeApiString(
  type: Assemblies,
): SponsoredTransactionAssemblyType {
  return ASSEMBLY_TYPE_API_STRING[type];
}

/**
 * Input for a sponsored transaction request
 * Takes the transformed item_id and assembly type values of the assembly object
 * Normalization from assembly object to this flat shape is done in the hook by design;
 * callers may pass either the full assembly or pre-flattened values.
 * @category Types
 */
export interface SponsoredTransactionInput {
  /** The transaction to be sponsored and executed */
  txAction: SponsoredTransactionActions;
  /** Assembly ID */
  assembly: AssemblyType<Assemblies>["item_id"];
  tenant: string;
  /** The assembly type to be sponsored and executed */
  assemblyType: SponsoredTransactionAssemblyType;
  metadata?: SponsoredTransactionMetadata;
}

/** Sponsored tx args with assembly object; id and assemblyType are derived. Tenant is optional; the hook resolves it from args, URL query param, or default. */
export type SponsoredTransactionArgs = Omit<
  SponsoredTransactionInput,
  "assembly" | "assemblyType" | "account" | "tenant"
> & {
  assembly: AssemblyType<Assemblies>;
  account?: string;
  tenant?: string;
  txAction: SponsoredTransactionActions;
  metadata?: SponsoredTransactionMetadata;
};

/**
 * Output from a successful sponsored transaction
 *
 * @category Types
 */
export interface SponsoredTransactionOutput {
  /** The transaction digest */
  digest: string;
  /** The transaction effects (BCS encoded) */
  effects?: string;
  /** Raw effects bytes (if available) */
  rawEffects?: number[];
}

/**
 * The sponsored transaction method signature
 *
 * @category Wallet
 */
export type SponsoredTransactionMethod = (
  input: SponsoredTransactionInput,
) => Promise<SponsoredTransactionOutput>;

/**
 * Feature interface for sponsored transactions.
 * Wallets that support this feature should implement this interface
 * in their `features` object.
 *
 * @category Wallet
 */
export interface EveFrontierSponsoredTransactionFeature {
  readonly [EVEFRONTIER_SPONSORED_TRANSACTION]: {
    /** Feature version for compatibility checking */
    readonly version: "1.0.0";
    /** Execute a gas-sponsored transaction */
    signSponsoredTransaction: SponsoredTransactionMethod;
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an object has the sponsored transaction feature
 * (object form with implementation).
 *
 * @category Wallet
 */
export function hasSponsoredTransactionFeature(
  features: Record<string, unknown>,
): features is Record<string, unknown> &
  EveFrontierSponsoredTransactionFeature {
  const featureValue = features[EVEFRONTIER_SPONSORED_TRANSACTION];
  return (
    EVEFRONTIER_SPONSORED_TRANSACTION in features &&
    typeof featureValue === "object" &&
    featureValue !== null &&
    "signSponsoredTransaction" in (featureValue as object)
  );
}

/**
 * Check if a wallet supports the sponsored transaction feature.
 * Supports both legacy object-shaped features and v2 array-shaped features
 * (list of feature names).
 *
 * @category Wallet
 */
export function supportsSponsoredTransaction(features: unknown): boolean {
  if (Array.isArray(features)) {
    return (features as string[]).includes(EVEFRONTIER_SPONSORED_TRANSACTION);
  }
  if (typeof features === "object" && features !== null) {
    return hasSponsoredTransactionFeature(features as Record<string, unknown>);
  }
  return false;
}
