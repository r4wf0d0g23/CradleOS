import { MessageType } from "@protobuf-ts/runtime";
import { ProtocolConfig } from "./protocol_config.js";
import { Timestamp } from "../../../google/protobuf/timestamp.js";
import { SystemState } from "./system_state.js";
import { ValidatorCommittee } from "./signature.js";
class Epoch$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.Epoch", [
      {
        no: 1,
        name: "epoch",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 2, name: "committee", kind: "message", T: () => ValidatorCommittee },
      { no: 3, name: "system_state", kind: "message", T: () => SystemState },
      {
        no: 4,
        name: "first_checkpoint",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 5,
        name: "last_checkpoint",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 6, name: "start", kind: "message", T: () => Timestamp },
      { no: 7, name: "end", kind: "message", T: () => Timestamp },
      {
        no: 8,
        name: "reference_gas_price",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 9, name: "protocol_config", kind: "message", T: () => ProtocolConfig }
    ]);
  }
}
const Epoch = new Epoch$Type();
export {
  Epoch
};
//# sourceMappingURL=epoch.js.map
