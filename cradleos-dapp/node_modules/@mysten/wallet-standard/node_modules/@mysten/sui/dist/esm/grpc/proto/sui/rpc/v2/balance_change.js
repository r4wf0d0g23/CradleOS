import { MessageType } from "@protobuf-ts/runtime";
class BalanceChange$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.BalanceChange", [
      {
        no: 1,
        name: "address",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "coin_type",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "amount",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const BalanceChange = new BalanceChange$Type();
export {
  BalanceChange
};
//# sourceMappingURL=balance_change.js.map
