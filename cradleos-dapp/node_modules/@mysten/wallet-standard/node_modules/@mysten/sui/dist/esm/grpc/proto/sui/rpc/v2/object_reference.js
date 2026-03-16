import { MessageType } from "@protobuf-ts/runtime";
class ObjectReference$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.ObjectReference", [
      {
        no: 1,
        name: "object_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const ObjectReference = new ObjectReference$Type();
export {
  ObjectReference
};
//# sourceMappingURL=object_reference.js.map
