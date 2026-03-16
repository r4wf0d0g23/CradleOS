import { MessageType } from "@protobuf-ts/runtime";
import { Value } from "../../../google/protobuf/struct.js";
import { Bcs } from "./bcs.js";
class TransactionEvents$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.TransactionEvents", [
      { no: 1, name: "bcs", kind: "message", T: () => Bcs },
      {
        no: 2,
        name: "digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 3, name: "events", kind: "message", repeat: 1, T: () => Event }
    ]);
  }
}
const TransactionEvents = new TransactionEvents$Type();
class Event$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.Event", [
      {
        no: 1,
        name: "package_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "module",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "sender",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 4,
        name: "event_type",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 5, name: "contents", kind: "message", T: () => Bcs },
      { no: 6, name: "json", kind: "message", T: () => Value }
    ]);
  }
}
const Event = new Event$Type();
export {
  Event,
  TransactionEvents
};
//# sourceMappingURL=event.js.map
