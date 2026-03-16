"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var signature_verification_service_client_exports = {};
__export(signature_verification_service_client_exports, {
  SignatureVerificationServiceClient: () => SignatureVerificationServiceClient
});
module.exports = __toCommonJS(signature_verification_service_client_exports);
var import_signature_verification_service = require("./signature_verification_service.js");
var import_runtime_rpc = require("@protobuf-ts/runtime-rpc");
class SignatureVerificationServiceClient {
  constructor(_transport) {
    this._transport = _transport;
    this.typeName = import_signature_verification_service.SignatureVerificationService.typeName;
    this.methods = import_signature_verification_service.SignatureVerificationService.methods;
    this.options = import_signature_verification_service.SignatureVerificationService.options;
  }
  /**
   * Perform signature verification of a UserSignature against the provided message.
   *
   * @generated from protobuf rpc: VerifySignature(sui.rpc.v2.VerifySignatureRequest) returns (sui.rpc.v2.VerifySignatureResponse);
   */
  verifySignature(input, options) {
    const method = this.methods[0], opt = this._transport.mergeOptions(options);
    return (0, import_runtime_rpc.stackIntercept)(
      "unary",
      this._transport,
      method,
      opt,
      input
    );
  }
}
//# sourceMappingURL=signature_verification_service.client.js.map
