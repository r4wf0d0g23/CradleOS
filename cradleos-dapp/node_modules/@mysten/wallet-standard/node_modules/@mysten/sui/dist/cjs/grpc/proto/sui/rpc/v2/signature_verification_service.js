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
var signature_verification_service_exports = {};
__export(signature_verification_service_exports, {
  SignatureVerificationService: () => SignatureVerificationService,
  VerifySignatureRequest: () => VerifySignatureRequest,
  VerifySignatureResponse: () => VerifySignatureResponse
});
module.exports = __toCommonJS(signature_verification_service_exports);
var import_runtime_rpc = require("@protobuf-ts/runtime-rpc");
var import_runtime = require("@protobuf-ts/runtime");
var import_transaction = require("./transaction.js");
var import_signature = require("./signature.js");
var import_bcs = require("./bcs.js");
class VerifySignatureRequest$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.VerifySignatureRequest", [
      { no: 1, name: "message", kind: "message", T: () => import_bcs.Bcs },
      { no: 2, name: "signature", kind: "message", T: () => import_signature.UserSignature },
      {
        no: 3,
        name: "address",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 4, name: "jwks", kind: "message", repeat: 1, T: () => import_transaction.ActiveJwk }
    ]);
  }
}
const VerifySignatureRequest = new VerifySignatureRequest$Type();
class VerifySignatureResponse$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.VerifySignatureResponse", [
      {
        no: 1,
        name: "is_valid",
        kind: "scalar",
        opt: true,
        T: 8
        /*ScalarType.BOOL*/
      },
      {
        no: 2,
        name: "reason",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const VerifySignatureResponse = new VerifySignatureResponse$Type();
const SignatureVerificationService = new import_runtime_rpc.ServiceType(
  "sui.rpc.v2.SignatureVerificationService",
  [{ name: "VerifySignature", options: {}, I: VerifySignatureRequest, O: VerifySignatureResponse }]
);
//# sourceMappingURL=signature_verification_service.js.map
