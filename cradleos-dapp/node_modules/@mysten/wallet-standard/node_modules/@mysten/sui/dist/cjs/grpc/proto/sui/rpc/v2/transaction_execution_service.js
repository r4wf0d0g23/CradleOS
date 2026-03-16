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
var transaction_execution_service_exports = {};
__export(transaction_execution_service_exports, {
  CommandOutput: () => CommandOutput,
  CommandResult: () => CommandResult,
  ExecuteTransactionRequest: () => ExecuteTransactionRequest,
  ExecuteTransactionResponse: () => ExecuteTransactionResponse,
  SimulateTransactionRequest: () => SimulateTransactionRequest,
  SimulateTransactionRequest_TransactionChecks: () => SimulateTransactionRequest_TransactionChecks,
  SimulateTransactionResponse: () => SimulateTransactionResponse,
  TransactionExecutionService: () => TransactionExecutionService
});
module.exports = __toCommonJS(transaction_execution_service_exports);
var import_runtime_rpc = require("@protobuf-ts/runtime-rpc");
var import_runtime = require("@protobuf-ts/runtime");
var import_struct = require("../../../google/protobuf/struct.js");
var import_bcs = require("./bcs.js");
var import_argument = require("./argument.js");
var import_executed_transaction = require("./executed_transaction.js");
var import_field_mask = require("../../../google/protobuf/field_mask.js");
var import_signature = require("./signature.js");
var import_transaction = require("./transaction.js");
var SimulateTransactionRequest_TransactionChecks = /* @__PURE__ */ ((SimulateTransactionRequest_TransactionChecks2) => {
  SimulateTransactionRequest_TransactionChecks2[SimulateTransactionRequest_TransactionChecks2["ENABLED"] = 0] = "ENABLED";
  SimulateTransactionRequest_TransactionChecks2[SimulateTransactionRequest_TransactionChecks2["DISABLED"] = 1] = "DISABLED";
  return SimulateTransactionRequest_TransactionChecks2;
})(SimulateTransactionRequest_TransactionChecks || {});
class ExecuteTransactionRequest$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ExecuteTransactionRequest", [
      { no: 1, name: "transaction", kind: "message", T: () => import_transaction.Transaction },
      {
        no: 2,
        name: "signatures",
        kind: "message",
        repeat: 1,
        T: () => import_signature.UserSignature
      },
      { no: 3, name: "read_mask", kind: "message", T: () => import_field_mask.FieldMask }
    ]);
  }
}
const ExecuteTransactionRequest = new ExecuteTransactionRequest$Type();
class ExecuteTransactionResponse$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ExecuteTransactionResponse", [
      { no: 1, name: "transaction", kind: "message", T: () => import_executed_transaction.ExecutedTransaction }
    ]);
  }
}
const ExecuteTransactionResponse = new ExecuteTransactionResponse$Type();
class SimulateTransactionRequest$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.SimulateTransactionRequest", [
      { no: 1, name: "transaction", kind: "message", T: () => import_transaction.Transaction },
      { no: 2, name: "read_mask", kind: "message", T: () => import_field_mask.FieldMask },
      {
        no: 3,
        name: "checks",
        kind: "enum",
        opt: true,
        T: () => [
          "sui.rpc.v2.SimulateTransactionRequest.TransactionChecks",
          SimulateTransactionRequest_TransactionChecks
        ]
      },
      {
        no: 4,
        name: "do_gas_selection",
        kind: "scalar",
        opt: true,
        T: 8
        /*ScalarType.BOOL*/
      }
    ]);
  }
}
const SimulateTransactionRequest = new SimulateTransactionRequest$Type();
class SimulateTransactionResponse$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.SimulateTransactionResponse", [
      { no: 1, name: "transaction", kind: "message", T: () => import_executed_transaction.ExecutedTransaction },
      {
        no: 2,
        name: "command_outputs",
        kind: "message",
        repeat: 1,
        T: () => CommandResult
      }
    ]);
  }
}
const SimulateTransactionResponse = new SimulateTransactionResponse$Type();
class CommandResult$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.CommandResult", [
      {
        no: 1,
        name: "return_values",
        kind: "message",
        repeat: 1,
        T: () => CommandOutput
      },
      {
        no: 2,
        name: "mutated_by_ref",
        kind: "message",
        repeat: 1,
        T: () => CommandOutput
      }
    ]);
  }
}
const CommandResult = new CommandResult$Type();
class CommandOutput$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.CommandOutput", [
      { no: 1, name: "argument", kind: "message", T: () => import_argument.Argument },
      { no: 2, name: "value", kind: "message", T: () => import_bcs.Bcs },
      { no: 3, name: "json", kind: "message", T: () => import_struct.Value }
    ]);
  }
}
const CommandOutput = new CommandOutput$Type();
const TransactionExecutionService = new import_runtime_rpc.ServiceType(
  "sui.rpc.v2.TransactionExecutionService",
  [
    {
      name: "ExecuteTransaction",
      options: {},
      I: ExecuteTransactionRequest,
      O: ExecuteTransactionResponse
    },
    {
      name: "SimulateTransaction",
      options: {},
      I: SimulateTransactionRequest,
      O: SimulateTransactionResponse
    }
  ]
);
//# sourceMappingURL=transaction_execution_service.js.map
