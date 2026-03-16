import type { TransactionDataBuilder } from '../transactions/TransactionData.js';
import type { BuildTransactionOptions } from '../transactions/index.js';
import type { SuiJsonRpcClient } from './client.js';
export declare function jsonRpcClientResolveTransactionPlugin(client: SuiJsonRpcClient): (transactionData: TransactionDataBuilder, options: BuildTransactionOptions, next: () => Promise<void>) => Promise<void>;
