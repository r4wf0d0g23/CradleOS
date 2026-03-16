import { MessageType } from "@protobuf-ts/runtime";
class ProtocolConfig$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.ProtocolConfig", [
      {
        no: 1,
        name: "protocol_version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "feature_flags",
        kind: "map",
        K: 9,
        V: {
          kind: "scalar",
          T: 8
          /*ScalarType.BOOL*/
        }
      },
      {
        no: 3,
        name: "attributes",
        kind: "map",
        K: 9,
        V: {
          kind: "scalar",
          T: 9
          /*ScalarType.STRING*/
        }
      }
    ]);
  }
}
const ProtocolConfig = new ProtocolConfig$Type();
export {
  ProtocolConfig
};
//# sourceMappingURL=protocol_config.js.map
