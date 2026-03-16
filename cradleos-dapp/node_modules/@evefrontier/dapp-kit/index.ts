// Main provider
export { EveFrontierProvider } from "./providers";

// Hooks
export {
  useConnection,
  useSmartObject,
  useNotification,
  useSponsoredTransaction,
} from "./hooks";

// Hook error types and sponsored transaction types
export {
  WalletSponsoredTransactionNotSupportedError,
  WalletNotConnectedError,
  WalletNoAccountSelectedError,
} from "./hooks";
export type {
  UseSponsoredTransactionError,
  UseSponsoredTransactionArgs,
  UseSponsoredTransactionMutationOptions,
} from "./hooks";

// Providers (for advanced usage)
export {
  VaultProvider,
  VaultContext,
  SmartObjectProvider,
  SmartObjectContext,
  NotificationProvider,
  NotificationContext,
} from "./providers";

// =========================================
// Types (re-exported from ./types)
// =========================================
export * from "./types";

// =========================================
// Utils (re-exported from ./utils)
// =========================================
export * from "./utils";

// =========================================
// GraphQL - Query execution & helper functions
// =========================================
export * from "./graphql";

// =========================================
// Config
// =========================================
export { dAppKit } from "./config/dapp-kit";
export {
  getEnergyConfig,
  getFuelEfficiencyConfig,
  getFuelEfficiencyForType,
  getEnergyUsageForType,
} from "./utils/config";

// =========================================
// Constants & Configuration
// =========================================
export {
  getSuiGraphqlEndpoint,
  getEveWorldPackageId,
  getCharacterOwnerCapType,
  getObjectRegistryType,
  POLLING_INTERVAL,
  STORAGE_KEYS,
} from "./utils/constants";

// =========================================
// Wallet Standard Extensions
// =========================================
export {
  getAssemblyTypeApiString,
  hasSponsoredTransactionFeature,
  walletSupportsSponsoredTransaction,
  getSponsoredTransactionFeature,
} from "./wallet";

export type {
  EveFrontierSponsoredTransactionFeature,
  SponsoredTransactionArgs,
  SponsoredTransactionInput,
  SponsoredTransactionOutput,
  SponsoredTransactionMethod,
} from "./wallet";
