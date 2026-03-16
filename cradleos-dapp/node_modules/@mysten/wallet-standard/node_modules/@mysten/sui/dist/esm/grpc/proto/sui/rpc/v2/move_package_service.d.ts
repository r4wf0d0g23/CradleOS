import { ServiceType } from '@protobuf-ts/runtime-rpc';
import { MessageType } from '@protobuf-ts/runtime';
import { FunctionDescriptor } from './move_package.js';
import { DatatypeDescriptor } from './move_package.js';
import { Package } from './move_package.js';
/**
 * @generated from protobuf message sui.rpc.v2.GetPackageRequest
 */
export interface GetPackageRequest {
    /**
     * Required. The `storage_id` of the requested package.
     *
     * @generated from protobuf field: optional string package_id = 1;
     */
    packageId?: string;
}
/**
 * @generated from protobuf message sui.rpc.v2.GetPackageResponse
 */
export interface GetPackageResponse {
    /**
     * The package.
     *
     * @generated from protobuf field: optional sui.rpc.v2.Package package = 1;
     */
    package?: Package;
}
/**
 * @generated from protobuf message sui.rpc.v2.GetDatatypeRequest
 */
export interface GetDatatypeRequest {
    /**
     * Required. The `storage_id` of the requested package.
     *
     * @generated from protobuf field: optional string package_id = 1;
     */
    packageId?: string;
    /**
     * Required. The name of the requested module.
     *
     * @generated from protobuf field: optional string module_name = 2;
     */
    moduleName?: string;
    /**
     * Required. The name of the requested datatype.
     *
     * @generated from protobuf field: optional string name = 3;
     */
    name?: string;
}
/**
 * @generated from protobuf message sui.rpc.v2.GetDatatypeResponse
 */
export interface GetDatatypeResponse {
    /**
     * The datatype.
     *
     * @generated from protobuf field: optional sui.rpc.v2.DatatypeDescriptor datatype = 1;
     */
    datatype?: DatatypeDescriptor;
}
/**
 * @generated from protobuf message sui.rpc.v2.GetFunctionRequest
 */
export interface GetFunctionRequest {
    /**
     * Required. The `storage_id` of the requested package.
     *
     * @generated from protobuf field: optional string package_id = 1;
     */
    packageId?: string;
    /**
     * Required. The name of the requested module.
     *
     * @generated from protobuf field: optional string module_name = 2;
     */
    moduleName?: string;
    /**
     * Required. The name of the requested function.
     *
     * @generated from protobuf field: optional string name = 3;
     */
    name?: string;
}
/**
 * @generated from protobuf message sui.rpc.v2.GetFunctionResponse
 */
export interface GetFunctionResponse {
    /**
     * The function.
     *
     * @generated from protobuf field: optional sui.rpc.v2.FunctionDescriptor function = 1;
     */
    function?: FunctionDescriptor;
}
/**
 * @generated from protobuf message sui.rpc.v2.ListPackageVersionsRequest
 */
export interface ListPackageVersionsRequest {
    /**
     * Required. The `storage_id` of any version of the package.
     *
     * @generated from protobuf field: optional string package_id = 1;
     */
    packageId?: string;
    /**
     * The maximum number of versions to return. The service may return fewer than this value.
     * If unspecified, at most `1000` entries will be returned.
     * The maximum value is `10000`; values above `10000` will be coerced to `10000`.
     *
     * @generated from protobuf field: optional uint32 page_size = 2;
     */
    pageSize?: number;
    /**
     * A page token, received from a previous `ListPackageVersions` call.
     * Provide this to retrieve the subsequent page.
     *
     * When paginating, all other parameters provided to `ListPackageVersions` must
     * match the call that provided the page token.
     *
     * @generated from protobuf field: optional bytes page_token = 3;
     */
    pageToken?: Uint8Array;
}
/**
 * @generated from protobuf message sui.rpc.v2.ListPackageVersionsResponse
 */
export interface ListPackageVersionsResponse {
    /**
     * List of all package versions, ordered by version.
     *
     * @generated from protobuf field: repeated sui.rpc.v2.PackageVersion versions = 1;
     */
    versions: PackageVersion[];
    /**
     * A token, which can be sent as `page_token` to retrieve the next page.
     * If this field is omitted, there are no subsequent pages.
     *
     * @generated from protobuf field: optional bytes next_page_token = 2;
     */
    nextPageToken?: Uint8Array;
}
/**
 * A simplified representation of a package version
 *
 * @generated from protobuf message sui.rpc.v2.PackageVersion
 */
export interface PackageVersion {
    /**
     * The storage ID of this package version
     *
     * @generated from protobuf field: optional string package_id = 1;
     */
    packageId?: string;
    /**
     * The version number
     *
     * @generated from protobuf field: optional uint64 version = 2;
     */
    version?: bigint;
}
declare class GetPackageRequest$Type extends MessageType<GetPackageRequest> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.GetPackageRequest
 */
export declare const GetPackageRequest: GetPackageRequest$Type;
declare class GetPackageResponse$Type extends MessageType<GetPackageResponse> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.GetPackageResponse
 */
export declare const GetPackageResponse: GetPackageResponse$Type;
declare class GetDatatypeRequest$Type extends MessageType<GetDatatypeRequest> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.GetDatatypeRequest
 */
export declare const GetDatatypeRequest: GetDatatypeRequest$Type;
declare class GetDatatypeResponse$Type extends MessageType<GetDatatypeResponse> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.GetDatatypeResponse
 */
export declare const GetDatatypeResponse: GetDatatypeResponse$Type;
declare class GetFunctionRequest$Type extends MessageType<GetFunctionRequest> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.GetFunctionRequest
 */
export declare const GetFunctionRequest: GetFunctionRequest$Type;
declare class GetFunctionResponse$Type extends MessageType<GetFunctionResponse> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.GetFunctionResponse
 */
export declare const GetFunctionResponse: GetFunctionResponse$Type;
declare class ListPackageVersionsRequest$Type extends MessageType<ListPackageVersionsRequest> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.ListPackageVersionsRequest
 */
export declare const ListPackageVersionsRequest: ListPackageVersionsRequest$Type;
declare class ListPackageVersionsResponse$Type extends MessageType<ListPackageVersionsResponse> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.ListPackageVersionsResponse
 */
export declare const ListPackageVersionsResponse: ListPackageVersionsResponse$Type;
declare class PackageVersion$Type extends MessageType<PackageVersion> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.PackageVersion
 */
export declare const PackageVersion: PackageVersion$Type;
/**
 * @generated ServiceType for protobuf service sui.rpc.v2.MovePackageService
 */
export declare const MovePackageService: ServiceType;
export {};
