import { MessageType } from "@protobuf-ts/runtime";
import { ObjectSet } from "./object.js";
import { BalanceChange } from "./balance_change.js";
import { Timestamp } from "../../../google/protobuf/timestamp.js";
import { TransactionEvents } from "./event.js";
import { TransactionEffects } from "./effects.js";
import { UserSignature } from "./signature.js";
import { Transaction } from "./transaction.js";
class ExecutedTransaction$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.ExecutedTransaction", [
      {
        no: 1,
        name: "digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 2, name: "transaction", kind: "message", T: () => Transaction },
      {
        no: 3,
        name: "signatures",
        kind: "message",
        repeat: 1,
        T: () => UserSignature
      },
      { no: 4, name: "effects", kind: "message", T: () => TransactionEffects },
      { no: 5, name: "events", kind: "message", T: () => TransactionEvents },
      {
        no: 6,
        name: "checkpoint",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 7, name: "timestamp", kind: "message", T: () => Timestamp },
      {
        no: 8,
        name: "balance_changes",
        kind: "message",
        repeat: 1,
        T: () => BalanceChange
      },
      { no: 9, name: "objects", kind: "message", T: () => ObjectSet }
    ]);
  }
}
const ExecutedTransaction = new ExecutedTransaction$Type();
export {
  ExecutedTransaction
};
//# sourceMappingURL=executed_transaction.js.map
