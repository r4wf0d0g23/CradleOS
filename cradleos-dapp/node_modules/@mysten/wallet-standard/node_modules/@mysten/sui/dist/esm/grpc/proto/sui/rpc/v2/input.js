import { MessageType } from "@protobuf-ts/runtime";
import { Value } from "../../../google/protobuf/struct.js";
var Input_InputKind = /* @__PURE__ */ ((Input_InputKind2) => {
  Input_InputKind2[Input_InputKind2["INPUT_KIND_UNKNOWN"] = 0] = "INPUT_KIND_UNKNOWN";
  Input_InputKind2[Input_InputKind2["PURE"] = 1] = "PURE";
  Input_InputKind2[Input_InputKind2["IMMUTABLE_OR_OWNED"] = 2] = "IMMUTABLE_OR_OWNED";
  Input_InputKind2[Input_InputKind2["SHARED"] = 3] = "SHARED";
  Input_InputKind2[Input_InputKind2["RECEIVING"] = 4] = "RECEIVING";
  return Input_InputKind2;
})(Input_InputKind || {});
class Input$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.Input", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.Input.InputKind", Input_InputKind]
      },
      {
        no: 2,
        name: "pure",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      },
      {
        no: 3,
        name: "object_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 4,
        name: "version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 5,
        name: "digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 6,
        name: "mutable",
        kind: "scalar",
        opt: true,
        T: 8
        /*ScalarType.BOOL*/
      },
      { no: 1e3, name: "literal", kind: "message", T: () => Value }
    ]);
  }
}
const Input = new Input$Type();
export {
  Input,
  Input_InputKind
};
//# sourceMappingURL=input.js.map
