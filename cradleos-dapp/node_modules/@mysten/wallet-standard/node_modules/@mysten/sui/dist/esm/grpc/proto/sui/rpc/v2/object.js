import { MessageType } from "@protobuf-ts/runtime";
import { Value } from "../../../google/protobuf/struct.js";
import { Package } from "./move_package.js";
import { Owner } from "./owner.js";
import { Bcs } from "./bcs.js";
class Object$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.Object", [
      { no: 1, name: "bcs", kind: "message", T: () => Bcs },
      {
        no: 2,
        name: "object_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 5, name: "owner", kind: "message", T: () => Owner },
      {
        no: 6,
        name: "object_type",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 7,
        name: "has_public_transfer",
        kind: "scalar",
        opt: true,
        T: 8
        /*ScalarType.BOOL*/
      },
      { no: 8, name: "contents", kind: "message", T: () => Bcs },
      { no: 9, name: "package", kind: "message", T: () => Package },
      {
        no: 10,
        name: "previous_transaction",
        kind: "scalar",
        opt: true,
        T: 9
      },
      {
        no: 11,
        name: "storage_rebate",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 100, name: "json", kind: "message", T: () => Value },
      {
        no: 101,
        name: "balance",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      }
    ]);
  }
}
const Object = new Object$Type();
class ObjectSet$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.ObjectSet", [
      { no: 1, name: "objects", kind: "message", repeat: 1, T: () => Object }
    ]);
  }
}
const ObjectSet = new ObjectSet$Type();
export {
  Object,
  ObjectSet
};
//# sourceMappingURL=object.js.map
