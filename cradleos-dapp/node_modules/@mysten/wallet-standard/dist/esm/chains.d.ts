import type { IdentifierString } from '@wallet-standard/core';
/** Sui Devnet */
export declare const SUI_DEVNET_CHAIN = "sui:devnet";
/** Sui Testnet */
export declare const SUI_TESTNET_CHAIN = "sui:testnet";
/** Sui Localnet */
export declare const SUI_LOCALNET_CHAIN = "sui:localnet";
/** Sui Mainnet */
export declare const SUI_MAINNET_CHAIN = "sui:mainnet";
export declare const SUI_CHAINS: readonly ["sui:devnet", "sui:testnet", "sui:localnet", "sui:mainnet"];
export type SuiChain = (typeof SUI_CHAINS)[number];
/**
 * Utility that returns whether or not a chain identifier is a valid Sui chain.
 * @param chain a chain identifier in the form of `${string}:{$string}`
 */
export declare function isSuiChain(chain: IdentifierString): chain is SuiChain;
