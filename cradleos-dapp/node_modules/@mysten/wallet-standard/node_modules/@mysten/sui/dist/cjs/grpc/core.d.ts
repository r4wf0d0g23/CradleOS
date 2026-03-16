import type { Experimental_CoreClientOptions, Experimental_SuiClientTypes } from '../experimental/index.js';
import { Experimental_CoreClient } from '../experimental/index.js';
import type { SuiGrpcClient } from './client.js';
import type { TransactionEffects } from './proto/sui/rpc/v2/effects.js';
import type { BuildTransactionOptions } from '../transactions/index.js';
import { TransactionDataBuilder } from '../transactions/index.js';
export interface GrpcCoreClientOptions extends Experimental_CoreClientOptions {
    client: SuiGrpcClient;
}
export declare class GrpcCoreClient extends Experimental_CoreClient {
    #private;
    constructor({ client, ...options }: GrpcCoreClientOptions);
    getObjects(options: Experimental_SuiClientTypes.GetObjectsOptions): Promise<Experimental_SuiClientTypes.GetObjectsResponse>;
    getOwnedObjects(options: Experimental_SuiClientTypes.GetOwnedObjectsOptions): Promise<Experimental_SuiClientTypes.GetOwnedObjectsResponse>;
    getCoins(options: Experimental_SuiClientTypes.GetCoinsOptions): Promise<Experimental_SuiClientTypes.GetCoinsResponse>;
    getBalance(options: Experimental_SuiClientTypes.GetBalanceOptions): Promise<Experimental_SuiClientTypes.GetBalanceResponse>;
    getAllBalances(options: Experimental_SuiClientTypes.GetAllBalancesOptions): Promise<Experimental_SuiClientTypes.GetAllBalancesResponse>;
    getTransaction(options: Experimental_SuiClientTypes.GetTransactionOptions): Promise<Experimental_SuiClientTypes.GetTransactionResponse>;
    executeTransaction(options: Experimental_SuiClientTypes.ExecuteTransactionOptions): Promise<Experimental_SuiClientTypes.ExecuteTransactionResponse>;
    dryRunTransaction(options: Experimental_SuiClientTypes.DryRunTransactionOptions): Promise<Experimental_SuiClientTypes.DryRunTransactionResponse>;
    getReferenceGasPrice(): Promise<Experimental_SuiClientTypes.GetReferenceGasPriceResponse>;
    getDynamicFields(options: Experimental_SuiClientTypes.GetDynamicFieldsOptions): Promise<Experimental_SuiClientTypes.GetDynamicFieldsResponse>;
    verifyZkLoginSignature(options: Experimental_SuiClientTypes.VerifyZkLoginSignatureOptions): Promise<Experimental_SuiClientTypes.ZkLoginVerifyResponse>;
    defaultNameServiceName(options: Experimental_SuiClientTypes.DefaultNameServiceNameOptions): Promise<Experimental_SuiClientTypes.DefaultNameServiceNameResponse>;
    getMoveFunction(options: Experimental_SuiClientTypes.GetMoveFunctionOptions): Promise<Experimental_SuiClientTypes.GetMoveFunctionResponse>;
    resolveTransactionPlugin(): (_transactionData: TransactionDataBuilder, _options: BuildTransactionOptions, _next: () => Promise<void>) => Promise<never>;
}
export declare function parseTransactionEffects({ effects, }: {
    effects: TransactionEffects | undefined;
}): Experimental_SuiClientTypes.TransactionEffects | null;
