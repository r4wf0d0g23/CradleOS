/**
 * EVE Frontier Wallet Standard Extensions
 *
 * Provides custom wallet sponsored transaction features.
 */

// Feature definitions and types
export {
  getAssemblyTypeApiString,
  hasSponsoredTransactionFeature,
  supportsSponsoredTransaction,
} from "./features";
export type {
  EveFrontierSponsoredTransactionFeature,
  SponsoredTransactionArgs,
  SponsoredTransactionInput,
  SponsoredTransactionMethod,
  SponsoredTransactionOutput,
} from "./features";

// Utility functions
export {
  walletSupportsSponsoredTransaction,
  getSponsoredTransactionFeature,
  getSponsoredTransactionMethod,
} from "./utils";
