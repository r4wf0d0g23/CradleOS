import { ServiceType } from '@protobuf-ts/runtime-rpc';
import { MessageType } from '@protobuf-ts/runtime';
import { ActiveJwk } from './transaction.js';
import { UserSignature } from './signature.js';
import { Bcs } from './bcs.js';
/**
 * @generated from protobuf message sui.rpc.v2.VerifySignatureRequest
 */
export interface VerifySignatureRequest {
    /**
     * The message to verify against.
     *
     * Today the only supported message types are `PersonalMessage` and
     * `TransactionData` and the `Bcs.name` must be set to indicate which type of
     * message is being verified.
     *
     * @generated from protobuf field: optional sui.rpc.v2.Bcs message = 1;
     */
    message?: Bcs;
    /**
     * The signature to verify.
     *
     * @generated from protobuf field: optional sui.rpc.v2.UserSignature signature = 2;
     */
    signature?: UserSignature;
    /**
     * Optional. Address to validate against the provided signature.
     *
     * If provided, this address will be compared against the the address derived
     * from the provide signature and a successful response will only be returned
     * if they match.
     *
     * @generated from protobuf field: optional string address = 3;
     */
    address?: string;
    /**
     * The set of JWKs to use when verifying Zklogin signatures.
     * If this is empty the current set of valid JWKs stored onchain will be used
     *
     * @generated from protobuf field: repeated sui.rpc.v2.ActiveJwk jwks = 4;
     */
    jwks: ActiveJwk[];
}
/**
 * @generated from protobuf message sui.rpc.v2.VerifySignatureResponse
 */
export interface VerifySignatureResponse {
    /**
     * Indicates if the provided signature was valid given the requested parameters.
     *
     * @generated from protobuf field: optional bool is_valid = 1;
     */
    isValid?: boolean;
    /**
     * If `is_valid` is `false`, this is the reason for why the signature verification failed.
     *
     * @generated from protobuf field: optional string reason = 2;
     */
    reason?: string;
}
declare class VerifySignatureRequest$Type extends MessageType<VerifySignatureRequest> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.VerifySignatureRequest
 */
export declare const VerifySignatureRequest: VerifySignatureRequest$Type;
declare class VerifySignatureResponse$Type extends MessageType<VerifySignatureResponse> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.VerifySignatureResponse
 */
export declare const VerifySignatureResponse: VerifySignatureResponse$Type;
/**
 * @generated ServiceType for protobuf service sui.rpc.v2.SignatureVerificationService
 */
export declare const SignatureVerificationService: ServiceType;
export {};
