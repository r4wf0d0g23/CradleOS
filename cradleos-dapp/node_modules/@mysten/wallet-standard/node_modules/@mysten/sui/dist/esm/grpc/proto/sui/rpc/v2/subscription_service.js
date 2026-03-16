import { ServiceType } from "@protobuf-ts/runtime-rpc";
import { MessageType } from "@protobuf-ts/runtime";
import { Checkpoint } from "./checkpoint.js";
import { FieldMask } from "../../../google/protobuf/field_mask.js";
class SubscribeCheckpointsRequest$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.SubscribeCheckpointsRequest", [
      { no: 1, name: "read_mask", kind: "message", T: () => FieldMask }
    ]);
  }
}
const SubscribeCheckpointsRequest = new SubscribeCheckpointsRequest$Type();
class SubscribeCheckpointsResponse$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.SubscribeCheckpointsResponse", [
      {
        no: 1,
        name: "cursor",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 2, name: "checkpoint", kind: "message", T: () => Checkpoint }
    ]);
  }
}
const SubscribeCheckpointsResponse = new SubscribeCheckpointsResponse$Type();
const SubscriptionService = new ServiceType("sui.rpc.v2.SubscriptionService", [
  {
    name: "SubscribeCheckpoints",
    serverStreaming: true,
    options: {},
    I: SubscribeCheckpointsRequest,
    O: SubscribeCheckpointsResponse
  }
]);
export {
  SubscribeCheckpointsRequest,
  SubscribeCheckpointsResponse,
  SubscriptionService
};
//# sourceMappingURL=subscription_service.js.map
