import { MessageType } from "@protobuf-ts/runtime";
class Bcs$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.Bcs", [
      {
        no: 1,
        name: "name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "value",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      }
    ]);
  }
}
const Bcs = new Bcs$Type();
export {
  Bcs
};
//# sourceMappingURL=bcs.js.map
