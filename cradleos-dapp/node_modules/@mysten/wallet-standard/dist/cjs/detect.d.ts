import type { Wallet, WalletWithFeatures } from '@wallet-standard/core';
import type { MinimallyRequiredFeatures } from './features/index.js';
export declare function isWalletWithRequiredFeatureSet<AdditionalFeatures extends Wallet['features']>(wallet: Wallet, additionalFeatures?: (keyof AdditionalFeatures)[]): wallet is WalletWithFeatures<MinimallyRequiredFeatures & AdditionalFeatures>;
