import type { WalletWithFeatures } from '@wallet-standard/core';
import type { SuiSignAndExecuteTransactionInput, SuiSignTransactionInput, SuiWalletFeatures } from './features/index.js';
declare module '@wallet-standard/core' {
    interface Wallet {
        /**
         * Unique identifier of the Wallet.
         *
         * If not provided, the wallet name will be used as the identifier.
         */
        readonly id?: string;
    }
    interface StandardConnectOutput {
        supportedIntents?: string[];
    }
}
export type { Wallet } from '@wallet-standard/core';
export declare function signAndExecuteTransaction(wallet: WalletWithFeatures<Partial<SuiWalletFeatures>>, input: SuiSignAndExecuteTransactionInput): Promise<import("./features/suiSignAndExecuteTransaction.js").SuiSignAndExecuteTransactionOutput>;
export declare function signTransaction(wallet: WalletWithFeatures<Partial<SuiWalletFeatures>>, input: SuiSignTransactionInput): Promise<import("./features/suiSignTransaction.js").SignedTransaction>;
