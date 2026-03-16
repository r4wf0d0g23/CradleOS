import type { RpcTransport } from '@protobuf-ts/runtime-rpc';
import type { ServiceInfo } from '@protobuf-ts/runtime-rpc';
import type { ReverseLookupNameResponse } from './name_service.js';
import type { ReverseLookupNameRequest } from './name_service.js';
import type { LookupNameResponse } from './name_service.js';
import type { LookupNameRequest } from './name_service.js';
import type { UnaryCall } from '@protobuf-ts/runtime-rpc';
import type { RpcOptions } from '@protobuf-ts/runtime-rpc';
/**
 * @generated from protobuf service sui.rpc.v2.NameService
 */
export interface INameServiceClient {
    /**
     * @generated from protobuf rpc: LookupName(sui.rpc.v2.LookupNameRequest) returns (sui.rpc.v2.LookupNameResponse);
     */
    lookupName(input: LookupNameRequest, options?: RpcOptions): UnaryCall<LookupNameRequest, LookupNameResponse>;
    /**
     * @generated from protobuf rpc: ReverseLookupName(sui.rpc.v2.ReverseLookupNameRequest) returns (sui.rpc.v2.ReverseLookupNameResponse);
     */
    reverseLookupName(input: ReverseLookupNameRequest, options?: RpcOptions): UnaryCall<ReverseLookupNameRequest, ReverseLookupNameResponse>;
}
/**
 * @generated from protobuf service sui.rpc.v2.NameService
 */
export declare class NameServiceClient implements INameServiceClient, ServiceInfo {
    private readonly _transport;
    typeName: string;
    methods: import("@protobuf-ts/runtime-rpc").MethodInfo<any, any>[];
    options: {
        [extensionName: string]: import("@protobuf-ts/runtime").JsonValue;
    };
    constructor(_transport: RpcTransport);
    /**
     * @generated from protobuf rpc: LookupName(sui.rpc.v2.LookupNameRequest) returns (sui.rpc.v2.LookupNameResponse);
     */
    lookupName(input: LookupNameRequest, options?: RpcOptions): UnaryCall<LookupNameRequest, LookupNameResponse>;
    /**
     * @generated from protobuf rpc: ReverseLookupName(sui.rpc.v2.ReverseLookupNameRequest) returns (sui.rpc.v2.ReverseLookupNameResponse);
     */
    reverseLookupName(input: ReverseLookupNameRequest, options?: RpcOptions): UnaryCall<ReverseLookupNameRequest, ReverseLookupNameResponse>;
}
