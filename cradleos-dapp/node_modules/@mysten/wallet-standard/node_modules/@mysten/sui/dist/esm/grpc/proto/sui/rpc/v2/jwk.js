import { MessageType } from "@protobuf-ts/runtime";
class JwkId$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.JwkId", [
      {
        no: 1,
        name: "iss",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "kid",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const JwkId = new JwkId$Type();
class Jwk$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.Jwk", [
      {
        no: 1,
        name: "kty",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "e",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "n",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 4,
        name: "alg",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const Jwk = new Jwk$Type();
export {
  Jwk,
  JwkId
};
//# sourceMappingURL=jwk.js.map
