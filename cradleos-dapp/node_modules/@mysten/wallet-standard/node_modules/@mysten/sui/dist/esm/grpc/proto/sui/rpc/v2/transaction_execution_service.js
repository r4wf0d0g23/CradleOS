import { ServiceType } from "@protobuf-ts/runtime-rpc";
import { MessageType } from "@protobuf-ts/runtime";
import { Value } from "../../../google/protobuf/struct.js";
import { Bcs } from "./bcs.js";
import { Argument } from "./argument.js";
import { ExecutedTransaction } from "./executed_transaction.js";
import { FieldMask } from "../../../google/protobuf/field_mask.js";
import { UserSignature } from "./signature.js";
import { Transaction } from "./transaction.js";
var SimulateTransactionRequest_TransactionChecks = /* @__PURE__ */ ((SimulateTransactionRequest_TransactionChecks2) => {
  SimulateTransactionRequest_TransactionChecks2[SimulateTransactionRequest_TransactionChecks2["ENABLED"] = 0] = "ENABLED";
  SimulateTransactionRequest_TransactionChecks2[SimulateTransactionRequest_TransactionChecks2["DISABLED"] = 1] = "DISABLED";
  return SimulateTransactionRequest_TransactionChecks2;
})(SimulateTransactionRequest_TransactionChecks || {});
class ExecuteTransactionRequest$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.ExecuteTransactionRequest", [
      { no: 1, name: "transaction", kind: "message", T: () => Transaction },
      {
        no: 2,
        name: "signatures",
        kind: "message",
        repeat: 1,
        T: () => UserSignature
      },
      { no: 3, name: "read_mask", kind: "message", T: () => FieldMask }
    ]);
  }
}
const ExecuteTransactionRequest = new ExecuteTransactionRequest$Type();
class ExecuteTransactionResponse$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.ExecuteTransactionResponse", [
      { no: 1, name: "transaction", kind: "message", T: () => ExecutedTransaction }
    ]);
  }
}
const ExecuteTransactionResponse = new ExecuteTransactionResponse$Type();
class SimulateTransactionRequest$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.SimulateTransactionRequest", [
      { no: 1, name: "transaction", kind: "message", T: () => Transaction },
      { no: 2, name: "read_mask", kind: "message", T: () => FieldMask },
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
class SimulateTransactionResponse$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.SimulateTransactionResponse", [
      { no: 1, name: "transaction", kind: "message", T: () => ExecutedTransaction },
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
class CommandResult$Type extends MessageType {
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
class CommandOutput$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.CommandOutput", [
      { no: 1, name: "argument", kind: "message", T: () => Argument },
      { no: 2, name: "value", kind: "message", T: () => Bcs },
      { no: 3, name: "json", kind: "message", T: () => Value }
    ]);
  }
}
const CommandOutput = new CommandOutput$Type();
const TransactionExecutionService = new ServiceType(
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
export {
  CommandOutput,
  CommandResult,
  ExecuteTransactionRequest,
  ExecuteTransactionResponse,
  SimulateTransactionRequest,
  SimulateTransactionRequest_TransactionChecks,
  SimulateTransactionResponse,
  TransactionExecutionService
};
//# sourceMappingURL=transaction_execution_service.js.map
