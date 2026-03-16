import type { RpcTransport } from '@protobuf-ts/runtime-rpc';
import type { ServiceInfo } from '@protobuf-ts/runtime-rpc';
import type { ListPackageVersionsResponse } from './move_package_service.js';
import type { ListPackageVersionsRequest } from './move_package_service.js';
import type { GetFunctionResponse } from './move_package_service.js';
import type { GetFunctionRequest } from './move_package_service.js';
import type { GetDatatypeResponse } from './move_package_service.js';
import type { GetDatatypeRequest } from './move_package_service.js';
import type { GetPackageResponse } from './move_package_service.js';
import type { GetPackageRequest } from './move_package_service.js';
import type { UnaryCall } from '@protobuf-ts/runtime-rpc';
import type { RpcOptions } from '@protobuf-ts/runtime-rpc';
/**
 * @generated from protobuf service sui.rpc.v2.MovePackageService
 */
export interface IMovePackageServiceClient {
    /**
     * @generated from protobuf rpc: GetPackage(sui.rpc.v2.GetPackageRequest) returns (sui.rpc.v2.GetPackageResponse);
     */
    getPackage(input: GetPackageRequest, options?: RpcOptions): UnaryCall<GetPackageRequest, GetPackageResponse>;
    /**
     * @generated from protobuf rpc: GetDatatype(sui.rpc.v2.GetDatatypeRequest) returns (sui.rpc.v2.GetDatatypeResponse);
     */
    getDatatype(input: GetDatatypeRequest, options?: RpcOptions): UnaryCall<GetDatatypeRequest, GetDatatypeResponse>;
    /**
     * @generated from protobuf rpc: GetFunction(sui.rpc.v2.GetFunctionRequest) returns (sui.rpc.v2.GetFunctionResponse);
     */
    getFunction(input: GetFunctionRequest, options?: RpcOptions): UnaryCall<GetFunctionRequest, GetFunctionResponse>;
    /**
     * @generated from protobuf rpc: ListPackageVersions(sui.rpc.v2.ListPackageVersionsRequest) returns (sui.rpc.v2.ListPackageVersionsResponse);
     */
    listPackageVersions(input: ListPackageVersionsRequest, options?: RpcOptions): UnaryCall<ListPackageVersionsRequest, ListPackageVersionsResponse>;
}
/**
 * @generated from protobuf service sui.rpc.v2.MovePackageService
 */
export declare class MovePackageServiceClient implements IMovePackageServiceClient, ServiceInfo {
    private readonly _transport;
    typeName: string;
    methods: import("@protobuf-ts/runtime-rpc").MethodInfo<any, any>[];
    options: {
        [extensionName: string]: import("@protobuf-ts/runtime").JsonValue;
    };
    constructor(_transport: RpcTransport);
    /**
     * @generated from protobuf rpc: GetPackage(sui.rpc.v2.GetPackageRequest) returns (sui.rpc.v2.GetPackageResponse);
     */
    getPackage(input: GetPackageRequest, options?: RpcOptions): UnaryCall<GetPackageRequest, GetPackageResponse>;
    /**
     * @generated from protobuf rpc: GetDatatype(sui.rpc.v2.GetDatatypeRequest) returns (sui.rpc.v2.GetDatatypeResponse);
     */
    getDatatype(input: GetDatatypeRequest, options?: RpcOptions): UnaryCall<GetDatatypeRequest, GetDatatypeResponse>;
    /**
     * @generated from protobuf rpc: GetFunction(sui.rpc.v2.GetFunctionRequest) returns (sui.rpc.v2.GetFunctionResponse);
     */
    getFunction(input: GetFunctionRequest, options?: RpcOptions): UnaryCall<GetFunctionRequest, GetFunctionResponse>;
    /**
     * @generated from protobuf rpc: ListPackageVersions(sui.rpc.v2.ListPackageVersionsRequest) returns (sui.rpc.v2.ListPackageVersionsResponse);
     */
    listPackageVersions(input: ListPackageVersionsRequest, options?: RpcOptions): UnaryCall<ListPackageVersionsRequest, ListPackageVersionsResponse>;
}
