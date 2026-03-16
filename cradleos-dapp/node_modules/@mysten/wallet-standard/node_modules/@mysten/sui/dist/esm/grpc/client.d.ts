import type { GrpcWebOptions } from '@protobuf-ts/grpcweb-transport';
import { TransactionExecutionServiceClient } from './proto/sui/rpc/v2/transaction_execution_service.client.js';
import { LedgerServiceClient } from './proto/sui/rpc/v2/ledger_service.client.js';
import { MovePackageServiceClient } from './proto/sui/rpc/v2/move_package_service.client.js';
import { SignatureVerificationServiceClient } from './proto/sui/rpc/v2/signature_verification_service.client.js';
import type { RpcTransport } from '@protobuf-ts/runtime-rpc';
import { StateServiceClient } from './proto/sui/rpc/v2/state_service.client.js';
import { SubscriptionServiceClient } from './proto/sui/rpc/v2/subscription_service.client.js';
import { GrpcCoreClient } from './core.js';
import type { Experimental_SuiClientTypes } from '../experimental/index.js';
import { Experimental_BaseClient } from '../experimental/index.js';
import { NameServiceClient } from './proto/sui/rpc/v2/name_service.client.js';
interface SuiGrpcTransportOptions extends GrpcWebOptions {
    transport?: never;
}
export type SuiGrpcClientOptions = {
    network: Experimental_SuiClientTypes.Network;
    mvr?: Experimental_SuiClientTypes.MvrOptions;
} & ({
    transport: RpcTransport;
} | SuiGrpcTransportOptions);
export declare class SuiGrpcClient extends Experimental_BaseClient {
    core: GrpcCoreClient;
    transactionExecutionService: TransactionExecutionServiceClient;
    ledgerService: LedgerServiceClient;
    stateService: StateServiceClient;
    subscriptionService: SubscriptionServiceClient;
    movePackageService: MovePackageServiceClient;
    signatureVerificationService: SignatureVerificationServiceClient;
    nameService: NameServiceClient;
    constructor(options: SuiGrpcClientOptions);
}
export {};
