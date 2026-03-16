import { ServiceType } from "@protobuf-ts/runtime-rpc";
import { MessageType } from "@protobuf-ts/runtime";
import { ActiveJwk } from "./transaction.js";
import { UserSignature } from "./signature.js";
import { Bcs } from "./bcs.js";
class VerifySignatureRequest$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.VerifySignatureRequest", [
      { no: 1, name: "message", kind: "message", T: () => Bcs },
      { no: 2, name: "signature", kind: "message", T: () => UserSignature },
      {
        no: 3,
        name: "address",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 4, name: "jwks", kind: "message", repeat: 1, T: () => ActiveJwk }
    ]);
  }
}
const VerifySignatureRequest = new VerifySignatureRequest$Type();
class VerifySignatureResponse$Type extends MessageType {
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
const SignatureVerificationService = new ServiceType(
  "sui.rpc.v2.SignatureVerificationService",
  [{ name: "VerifySignature", options: {}, I: VerifySignatureRequest, O: VerifySignatureResponse }]
);
export {
  SignatureVerificationService,
  VerifySignatureRequest,
  VerifySignatureResponse
};
//# sourceMappingURL=signature_verification_service.js.map
