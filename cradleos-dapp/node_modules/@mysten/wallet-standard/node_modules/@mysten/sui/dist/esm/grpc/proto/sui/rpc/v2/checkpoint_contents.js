import { MessageType } from "@protobuf-ts/runtime";
import { UserSignature } from "./signature.js";
import { Bcs } from "./bcs.js";
class CheckpointContents$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.CheckpointContents", [
      { no: 1, name: "bcs", kind: "message", T: () => Bcs },
      {
        no: 2,
        name: "digest",
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
        T: 5
        /*ScalarType.INT32*/
      },
      {
        no: 4,
        name: "transactions",
        kind: "message",
        repeat: 1,
        T: () => CheckpointedTransactionInfo
      }
    ]);
  }
}
const CheckpointContents = new CheckpointContents$Type();
class CheckpointedTransactionInfo$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.CheckpointedTransactionInfo", [
      {
        no: 1,
        name: "transaction",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "effects",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "signatures",
        kind: "message",
        repeat: 1,
        T: () => UserSignature
      }
    ]);
  }
}
const CheckpointedTransactionInfo = new CheckpointedTransactionInfo$Type();
export {
  CheckpointContents,
  CheckpointedTransactionInfo
};
//# sourceMappingURL=checkpoint_contents.js.map
