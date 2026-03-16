import { ServiceType } from "@protobuf-ts/runtime-rpc";
import { MessageType } from "@protobuf-ts/runtime";
import { Timestamp } from "../../../google/protobuf/timestamp.js";
class LookupNameRequest$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.LookupNameRequest", [
      {
        no: 1,
        name: "name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const LookupNameRequest = new LookupNameRequest$Type();
class LookupNameResponse$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.LookupNameResponse", [
      { no: 1, name: "record", kind: "message", T: () => NameRecord }
    ]);
  }
}
const LookupNameResponse = new LookupNameResponse$Type();
class ReverseLookupNameRequest$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.ReverseLookupNameRequest", [
      {
        no: 1,
        name: "address",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const ReverseLookupNameRequest = new ReverseLookupNameRequest$Type();
class ReverseLookupNameResponse$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.ReverseLookupNameResponse", [
      { no: 1, name: "record", kind: "message", T: () => NameRecord }
    ]);
  }
}
const ReverseLookupNameResponse = new ReverseLookupNameResponse$Type();
class NameRecord$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.NameRecord", [
      {
        no: 1,
        name: "id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "registration_nft_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 4, name: "expiration_timestamp", kind: "message", T: () => Timestamp },
      {
        no: 5,
        name: "target_address",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 6,
        name: "data",
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
const NameRecord = new NameRecord$Type();
const NameService = new ServiceType("sui.rpc.v2.NameService", [
  { name: "LookupName", options: {}, I: LookupNameRequest, O: LookupNameResponse },
  {
    name: "ReverseLookupName",
    options: {},
    I: ReverseLookupNameRequest,
    O: ReverseLookupNameResponse
  }
]);
export {
  LookupNameRequest,
  LookupNameResponse,
  NameRecord,
  NameService,
  ReverseLookupNameRequest,
  ReverseLookupNameResponse
};
//# sourceMappingURL=name_service.js.map
