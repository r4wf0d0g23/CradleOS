import {
  SponsoredTransactionArgs,
  SponsoredTransactionOutput,
} from "../wallet";
import { Assemblies } from "./types";

/**
 * Available sponsored transaction actions
 *
 * @category Types
 */
export enum SponsoredTransactionActions {
  BRING_ONLINE = "online",
  BRING_OFFLINE = "offline",
  /** @deprecated Use UPDATE_METADATA instead */
  EDIT_UNIT = "edit-unit",
  UPDATE_METADATA = "update-metadata",
  LINK_SMART_GATE = "link-smart-gate",
  UNLINK_SMART_GATE = "unlink-smart-gate",
}

/** @category Types */
export type SendSponsoredTransactionFn = (
  input: SponsoredTransactionArgs,
  options?: {
    onSuccess?: (data: SponsoredTransactionOutput) => void;
    onError?: (error: Error) => void;
  },
) => Promise<SponsoredTransactionOutput>;

// ============================================================================
// Feature Identifiers
// ============================================================================

/**
 * Feature identifier for sponsored transactions.
 * Wallets implementing this feature can request gas sponsorship from
 * the EVE Frontier sponsored-transaction backend service.
 *
 * @category Wallet
 */
export const EVEFRONTIER_SPONSORED_TRANSACTION =
  "evefrontier:sponsoredTransaction" as const;

// ============================================================================
// Sponsored Transaction Types
// ============================================================================

/**
 * Map assembly types to API strings
 */
export const ASSEMBLY_TYPE_API_STRING: Record<Assemblies, string> = {
  [Assemblies.SmartStorageUnit]: "storage-units",
  [Assemblies.SmartTurret]: "turrets",
  [Assemblies.SmartGate]: "gates",
  [Assemblies.NetworkNode]: "network-nodes",
  [Assemblies.Manufacturing]: "manufacturing",
  [Assemblies.Refinery]: "refineries",
  [Assemblies.Assembly]: "assemblies",
} as const;

/** API slug for assembly type in sponsored transaction payloads (e.g. "storage-units"). */
export type SponsoredTransactionAssemblyType =
  (typeof ASSEMBLY_TYPE_API_STRING)[Assemblies];

export interface SponsoredTransactionMetadata {
  name?: string;
  description?: string;
  url?: string;
}
