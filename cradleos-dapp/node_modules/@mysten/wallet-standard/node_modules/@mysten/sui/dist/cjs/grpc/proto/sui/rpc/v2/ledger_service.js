"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var ledger_service_exports = {};
__export(ledger_service_exports, {
  BatchGetObjectsRequest: () => BatchGetObjectsRequest,
  BatchGetObjectsResponse: () => BatchGetObjectsResponse,
  BatchGetTransactionsRequest: () => BatchGetTransactionsRequest,
  BatchGetTransactionsResponse: () => BatchGetTransactionsResponse,
  GetCheckpointRequest: () => GetCheckpointRequest,
  GetCheckpointResponse: () => GetCheckpointResponse,
  GetEpochRequest: () => GetEpochRequest,
  GetEpochResponse: () => GetEpochResponse,
  GetObjectRequest: () => GetObjectRequest,
  GetObjectResponse: () => GetObjectResponse,
  GetObjectResult: () => GetObjectResult,
  GetServiceInfoRequest: () => GetServiceInfoRequest,
  GetServiceInfoResponse: () => GetServiceInfoResponse,
  GetTransactionRequest: () => GetTransactionRequest,
  GetTransactionResponse: () => GetTransactionResponse,
  GetTransactionResult: () => GetTransactionResult,
  LedgerService: () => LedgerService
});
module.exports = __toCommonJS(ledger_service_exports);
var import_runtime_rpc = require("@protobuf-ts/runtime-rpc");
var import_runtime = require("@protobuf-ts/runtime");
var import_epoch = require("./epoch.js");
var import_checkpoint = require("./checkpoint.js");
var import_executed_transaction = require("./executed_transaction.js");
var import_status = require("../../../google/rpc/status.js");
var import_object = require("./object.js");
var import_field_mask = require("../../../google/protobuf/field_mask.js");
var import_timestamp = require("../../../google/protobuf/timestamp.js");
class GetServiceInfoRequest$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.GetServiceInfoRequest", []);
  }
}
const GetServiceInfoRequest = new GetServiceInfoRequest$Type();
class GetServiceInfoResponse$Type extends import_runtime.MessageType {
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
      { no: 5, name: "timestamp", kind: "message", T: () => import_timestamp.Timestamp },
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
class GetObjectRequest$Type extends import_runtime.MessageType {
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
      { no: 3, name: "read_mask", kind: "message", T: () => import_field_mask.FieldMask }
    ]);
  }
}
const GetObjectRequest = new GetObjectRequest$Type();
class GetObjectResponse$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.GetObjectResponse", [
      { no: 1, name: "object", kind: "message", T: () => import_object.Object }
    ]);
  }
}
const GetObjectResponse = new GetObjectResponse$Type();
class BatchGetObjectsRequest$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.BatchGetObjectsRequest", [
      {
        no: 1,
        name: "requests",
        kind: "message",
        repeat: 1,
        T: () => GetObjectRequest
      },
      { no: 2, name: "read_mask", kind: "message", T: () => import_field_mask.FieldMask }
    ]);
  }
}
const BatchGetObjectsRequest = new BatchGetObjectsRequest$Type();
class BatchGetObjectsResponse$Type extends import_runtime.MessageType {
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
class GetObjectResult$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.GetObjectResult", [
      { no: 1, name: "object", kind: "message", oneof: "result", T: () => import_object.Object },
      { no: 2, name: "error", kind: "message", oneof: "result", T: () => import_status.Status }
    ]);
  }
}
const GetObjectResult = new GetObjectResult$Type();
class GetTransactionRequest$Type extends import_runtime.MessageType {
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
      { no: 2, name: "read_mask", kind: "message", T: () => import_field_mask.FieldMask }
    ]);
  }
}
const GetTransactionRequest = new GetTransactionRequest$Type();
class GetTransactionResponse$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.GetTransactionResponse", [
      { no: 1, name: "transaction", kind: "message", T: () => import_executed_transaction.ExecutedTransaction }
    ]);
  }
}
const GetTransactionResponse = new GetTransactionResponse$Type();
class BatchGetTransactionsRequest$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.BatchGetTransactionsRequest", [
      {
        no: 1,
        name: "digests",
        kind: "scalar",
        repeat: 2,
        T: 9
      },
      { no: 2, name: "read_mask", kind: "message", T: () => import_field_mask.FieldMask }
    ]);
  }
}
const BatchGetTransactionsRequest = new BatchGetTransactionsRequest$Type();
class BatchGetTransactionsResponse$Type extends import_runtime.MessageType {
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
class GetTransactionResult$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.GetTransactionResult", [
      {
        no: 1,
        name: "transaction",
        kind: "message",
        oneof: "result",
        T: () => import_executed_transaction.ExecutedTransaction
      },
      { no: 2, name: "error", kind: "message", oneof: "result", T: () => import_status.Status }
    ]);
  }
}
const GetTransactionResult = new GetTransactionResult$Type();
class GetCheckpointRequest$Type extends import_runtime.MessageType {
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
      { no: 3, name: "read_mask", kind: "message", T: () => import_field_mask.FieldMask }
    ]);
  }
}
const GetCheckpointRequest = new GetCheckpointRequest$Type();
class GetCheckpointResponse$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.GetCheckpointResponse", [
      { no: 1, name: "checkpoint", kind: "message", T: () => import_checkpoint.Checkpoint }
    ]);
  }
}
const GetCheckpointResponse = new GetCheckpointResponse$Type();
class GetEpochRequest$Type extends import_runtime.MessageType {
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
      { no: 2, name: "read_mask", kind: "message", T: () => import_field_mask.FieldMask }
    ]);
  }
}
const GetEpochRequest = new GetEpochRequest$Type();
class GetEpochResponse$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.GetEpochResponse", [
      { no: 1, name: "epoch", kind: "message", T: () => import_epoch.Epoch }
    ]);
  }
}
const GetEpochResponse = new GetEpochResponse$Type();
const LedgerService = new import_runtime_rpc.ServiceType("sui.rpc.v2.LedgerService", [
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
//# sourceMappingURL=ledger_service.js.map
