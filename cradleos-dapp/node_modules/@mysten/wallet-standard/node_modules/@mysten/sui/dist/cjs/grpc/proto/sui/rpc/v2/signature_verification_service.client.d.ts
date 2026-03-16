import type { RpcTransport } from '@protobuf-ts/runtime-rpc';
import type { ServiceInfo } from '@protobuf-ts/runtime-rpc';
import type { VerifySignatureResponse } from './signature_verification_service.js';
import type { VerifySignatureRequest } from './signature_verification_service.js';
import type { UnaryCall } from '@protobuf-ts/runtime-rpc';
import type { RpcOptions } from '@protobuf-ts/runtime-rpc';
/**
 * @generated from protobuf service sui.rpc.v2.SignatureVerificationService
 */
export interface ISignatureVerificationServiceClient {
    /**
     * Perform signature verification of a UserSignature against the provided message.
     *
     * @generated from protobuf rpc: VerifySignature(sui.rpc.v2.VerifySignatureRequest) returns (sui.rpc.v2.VerifySignatureResponse);
     */
    verifySignature(input: VerifySignatureRequest, options?: RpcOptions): UnaryCall<VerifySignatureRequest, VerifySignatureResponse>;
}
/**
 * @generated from protobuf service sui.rpc.v2.SignatureVerificationService
 */
export declare class SignatureVerificationServiceClient implements ISignatureVerificationServiceClient, ServiceInfo {
    private readonly _transport;
    typeName: string;
    methods: import("@protobuf-ts/runtime-rpc").MethodInfo<any, any>[];
    options: {
        [extensionName: string]: import("@protobuf-ts/runtime").JsonValue;
    };
    constructor(_transport: RpcTransport);
    /**
     * Perform signature verification of a UserSignature against the provided message.
     *
     * @generated from protobuf rpc: VerifySignature(sui.rpc.v2.VerifySignatureRequest) returns (sui.rpc.v2.VerifySignatureResponse);
     */
    verifySignature(input: VerifySignatureRequest, options?: RpcOptions): UnaryCall<VerifySignatureRequest, VerifySignatureResponse>;
}
