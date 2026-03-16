import { ServiceType } from "@protobuf-ts/runtime-rpc";
import { MessageType } from "@protobuf-ts/runtime";
import { Epoch } from "./epoch.js";
import { Checkpoint } from "./checkpoint.js";
import { ExecutedTransaction } from "./executed_transaction.js";
import { Status } from "../../../google/rpc/status.js";
import { Object } from "./object.js";
import { FieldMask } from "../../../google/protobuf/field_mask.js";
import { Timestamp } from "../../../google/protobuf/timestamp.js";
class GetServiceInfoRequest$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.GetServiceInfoRequest", []);
  }
}
const GetServiceInfoRequest = new GetServiceInfoRequest$Type();
class GetServiceInfoResponse$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.GetServiceInfoResponse", [
      {
        no: 1,
        name: "chain_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "chain",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "epoch",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "checkpoint_height",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 5, name: "timestamp", kind: "message", T: () => Timestamp },
      {
        no: 6,
        name: "lowest_available_checkpoint",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 7,
        name: "lowest_available_checkpoint_objects",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 8,
        name: "server",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const GetServiceInfoResponse = new GetServiceInfoResponse$Type();
class GetObjectRequest$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.GetObjectRequest", [
      {
        no: 1,
        name: "object_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 3, name: "read_mask", kind: "message", T: () => FieldMask }
    ]);
  }
}
const GetObjectRequest = new GetObjectRequest$Type();
class GetObjectResponse$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.GetObjectResponse", [
      { no: 1, name: "object", kind: "message", T: () => Object }
    ]);
  }
}
const GetObjectResponse = new GetObjectResponse$Type();
class BatchGetObjectsRequest$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.BatchGetObjectsRequest", [
      {
        no: 1,
        name: "requests",
        kind: "message",
        repeat: 1,
        T: () => GetObjectRequest
      },
      { no: 2, name: "read_mask", kind: "message", T: () => FieldMask }
    ]);
  }
}
const BatchGetObjectsRequest = new BatchGetObjectsRequest$Type();
class BatchGetObjectsResponse$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.BatchGetObjectsResponse", [
      {
        no: 1,
        name: "objects",
        kind: "message",
        repeat: 1,
        T: () => GetObjectResult
      }
    ]);
  }
}
const BatchGetObjectsResponse = new BatchGetObjectsResponse$Type();
class GetObjectResult$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.GetObjectResult", [
      { no: 1, name: "object", kind: "message", oneof: "result", T: () => Object },
      { no: 2, name: "error", kind: "message", oneof: "result", T: () => Status }
    ]);
  }
}
const GetObjectResult = new GetObjectResult$Type();
class GetTransactionRequest$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.GetTransactionRequest", [
      {
        no: 1,
        name: "digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 2, name: "read_mask", kind: "message", T: () => FieldMask }
    ]);
  }
}
const GetTransactionRequest = new GetTransactionRequest$Type();
class GetTransactionResponse$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.GetTransactionResponse", [
      { no: 1, name: "transaction", kind: "message", T: () => ExecutedTransaction }
    ]);
  }
}
const GetTransactionResponse = new GetTransactionResponse$Type();
class BatchGetTransactionsRequest$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.BatchGetTransactionsRequest", [
      {
        no: 1,
        name: "digests",
        kind: "scalar",
        repeat: 2,
        T: 9
      },
      { no: 2, name: "read_mask", kind: "message", T: () => FieldMask }
    ]);
  }
}
const BatchGetTransactionsRequest = new BatchGetTransactionsRequest$Type();
class BatchGetTransactionsResponse$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.BatchGetTransactionsResponse", [
      {
        no: 1,
        name: "transactions",
        kind: "message",
        repeat: 1,
        T: () => GetTransactionResult
      }
    ]);
  }
}
const BatchGetTransactionsResponse = new BatchGetTransactionsResponse$Type();
class GetTransactionResult$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.GetTransactionResult", [
      {
        no: 1,
        name: "transaction",
        kind: "message",
        oneof: "result",
        T: () => ExecutedTransaction
      },
      { no: 2, name: "error", kind: "message", oneof: "result", T: () => Status }
    ]);
  }
}
const GetTransactionResult = new GetTransactionResult$Type();
class GetCheckpointRequest$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.GetCheckpointRequest", [
      {
        no: 1,
        name: "sequence_number",
        kind: "scalar",
        oneof: "checkpointId",
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "digest",
        kind: "scalar",
        oneof: "checkpointId",
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 3, name: "read_mask", kind: "message", T: () => FieldMask }
    ]);
  }
}
const GetCheckpointRequest = new GetCheckpointRequest$Type();
class GetCheckpointResponse$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.GetCheckpointResponse", [
      { no: 1, name: "checkpoint", kind: "message", T: () => Checkpoint }
    ]);
  }
}
const GetCheckpointResponse = new GetCheckpointResponse$Type();
class GetEpochRequest$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.GetEpochRequest", [
      {
        no: 1,
        name: "epoch",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 2, name: "read_mask", kind: "message", T: () => FieldMask }
    ]);
  }
}
const GetEpochRequest = new GetEpochRequest$Type();
class GetEpochResponse$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.GetEpochResponse", [
      { no: 1, name: "epoch", kind: "message", T: () => Epoch }
    ]);
  }
}
const GetEpochResponse = new GetEpochResponse$Type();
const LedgerService = new ServiceType("sui.rpc.v2.LedgerService", [
  { name: "GetServiceInfo", options: {}, I: GetServiceInfoRequest, O: GetServiceInfoResponse },
  { name: "GetObject", options: {}, I: GetObjectRequest, O: GetObjectResponse },
  { name: "BatchGetObjects", options: {}, I: BatchGetObjectsRequest, O: BatchGetObjectsResponse },
  { name: "GetTransaction", options: {}, I: GetTransactionRequest, O: GetTransactionResponse },
  {
    name: "BatchGetTransactions",
    options: {},
    I: BatchGetTransactionsRequest,
    O: BatchGetTransactionsResponse
  },
  { name: "GetCheckpoint", options: {}, I: GetCheckpointRequest, O: GetCheckpointResponse },
  { name: "GetEpoch", options: {}, I: GetEpochRequest, O: GetEpochResponse }
]);
export {
  BatchGetObjectsRequest,
  BatchGetObjectsResponse,
  BatchGetTransactionsRequest,
  BatchGetTransactionsResponse,
  GetCheckpointRequest,
  GetCheckpointResponse,
  GetEpochRequest,
  GetEpochResponse,
  GetObjectRequest,
  GetObjectResponse,
  GetObjectResult,
  GetServiceInfoRequest,
  GetServiceInfoResponse,
  GetTransactionRequest,
  GetTransactionResponse,
  GetTransactionResult,
  LedgerService
};
//# sourceMappingURL=ledger_service.js.map
