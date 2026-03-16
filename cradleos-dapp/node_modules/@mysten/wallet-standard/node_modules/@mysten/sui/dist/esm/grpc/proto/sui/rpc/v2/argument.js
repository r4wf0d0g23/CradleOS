import { MessageType } from "@protobuf-ts/runtime";
var Argument_ArgumentKind = /* @__PURE__ */ ((Argument_ArgumentKind2) => {
  Argument_ArgumentKind2[Argument_ArgumentKind2["ARGUMENT_KIND_UNKNOWN"] = 0] = "ARGUMENT_KIND_UNKNOWN";
  Argument_ArgumentKind2[Argument_ArgumentKind2["GAS"] = 1] = "GAS";
  Argument_ArgumentKind2[Argument_ArgumentKind2["INPUT"] = 2] = "INPUT";
  Argument_ArgumentKind2[Argument_ArgumentKind2["RESULT"] = 3] = "RESULT";
  return Argument_ArgumentKind2;
})(Argument_ArgumentKind || {});
class Argument$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.Argument", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.Argument.ArgumentKind", Argument_ArgumentKind]
      },
      {
        no: 2,
        name: "input",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      },
      {
        no: 3,
        name: "result",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      },
      {
        no: 4,
        name: "subresult",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      }
    ]);
  }
}
const Argument = new Argument$Type();
export {
  Argument,
  Argument_ArgumentKind
};
//# sourceMappingURL=argument.js.map
