import { Experimental_CoreClient } from '../experimental/core.js';
import type { Experimental_SuiClientTypes } from '../experimental/types.js';
import type { SuiGraphQLClient } from './client.js';
export declare class GraphQLCoreClient extends Experimental_CoreClient {
    #private;
    constructor({ graphqlClient, mvr, }: {
        graphqlClient: SuiGraphQLClient;
        mvr?: Experimental_SuiClientTypes.MvrOptions;
    });
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
    resolveTransactionPlugin(): never;
}
export type GraphQLResponseErrors = Array<{
    message: string;
    locations?: {
        line: number;
        column: number;
    }[];
    path?: (string | number)[];
}>;
