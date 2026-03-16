import { MessageType } from "@protobuf-ts/runtime";
import { Any } from "../protobuf/any.js";
class Status$Type extends MessageType {
  constructor() {
    super("google.rpc.Status", [
      {
        no: 1,
        name: "code",
        kind: "scalar",
        T: 5
        /*ScalarType.INT32*/
      },
      {
        no: 2,
        name: "message",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 3, name: "details", kind: "message", repeat: 1, T: () => Any }
    ]);
  }
}
const Status = new Status$Type();
export {
  Status
};
//# sourceMappingURL=status.js.map
