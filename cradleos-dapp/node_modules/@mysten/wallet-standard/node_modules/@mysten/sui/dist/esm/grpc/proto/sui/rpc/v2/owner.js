import { MessageType } from "@protobuf-ts/runtime";
var Owner_OwnerKind = /* @__PURE__ */ ((Owner_OwnerKind2) => {
  Owner_OwnerKind2[Owner_OwnerKind2["OWNER_KIND_UNKNOWN"] = 0] = "OWNER_KIND_UNKNOWN";
  Owner_OwnerKind2[Owner_OwnerKind2["ADDRESS"] = 1] = "ADDRESS";
  Owner_OwnerKind2[Owner_OwnerKind2["OBJECT"] = 2] = "OBJECT";
  Owner_OwnerKind2[Owner_OwnerKind2["SHARED"] = 3] = "SHARED";
  Owner_OwnerKind2[Owner_OwnerKind2["IMMUTABLE"] = 4] = "IMMUTABLE";
  Owner_OwnerKind2[Owner_OwnerKind2["CONSENSUS_ADDRESS"] = 5] = "CONSENSUS_ADDRESS";
  return Owner_OwnerKind2;
})(Owner_OwnerKind || {});
class Owner$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.Owner", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.Owner.OwnerKind", Owner_OwnerKind]
      },
      {
        no: 2,
        name: "address",
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
      }
    ]);
  }
}
const Owner = new Owner$Type();
export {
  Owner,
  Owner_OwnerKind
};
//# sourceMappingURL=owner.js.map
