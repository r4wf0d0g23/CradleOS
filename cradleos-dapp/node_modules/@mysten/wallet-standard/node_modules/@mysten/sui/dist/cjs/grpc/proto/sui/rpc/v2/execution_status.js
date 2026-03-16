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
var execution_status_exports = {};
__export(execution_status_exports, {
  CleverError: () => CleverError,
  CoinDenyListError: () => CoinDenyListError,
  CommandArgumentError: () => CommandArgumentError,
  CommandArgumentError_CommandArgumentErrorKind: () => CommandArgumentError_CommandArgumentErrorKind,
  CongestedObjects: () => CongestedObjects,
  ExecutionError: () => ExecutionError,
  ExecutionError_ExecutionErrorKind: () => ExecutionError_ExecutionErrorKind,
  ExecutionStatus: () => ExecutionStatus,
  IndexError: () => IndexError,
  MoveAbort: () => MoveAbort,
  MoveLocation: () => MoveLocation,
  PackageUpgradeError: () => PackageUpgradeError,
  PackageUpgradeError_PackageUpgradeErrorKind: () => PackageUpgradeError_PackageUpgradeErrorKind,
  SizeError: () => SizeError,
  TypeArgumentError: () => TypeArgumentError,
  TypeArgumentError_TypeArgumentErrorKind: () => TypeArgumentError_TypeArgumentErrorKind
});
module.exports = __toCommonJS(execution_status_exports);
var import_runtime = require("@protobuf-ts/runtime");
var ExecutionError_ExecutionErrorKind = /* @__PURE__ */ ((ExecutionError_ExecutionErrorKind2) => {
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["EXECUTION_ERROR_KIND_UNKNOWN"] = 0] = "EXECUTION_ERROR_KIND_UNKNOWN";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["INSUFFICIENT_GAS"] = 1] = "INSUFFICIENT_GAS";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["INVALID_GAS_OBJECT"] = 2] = "INVALID_GAS_OBJECT";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["INVARIANT_VIOLATION"] = 3] = "INVARIANT_VIOLATION";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["FEATURE_NOT_YET_SUPPORTED"] = 4] = "FEATURE_NOT_YET_SUPPORTED";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["OBJECT_TOO_BIG"] = 5] = "OBJECT_TOO_BIG";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["PACKAGE_TOO_BIG"] = 6] = "PACKAGE_TOO_BIG";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["CIRCULAR_OBJECT_OWNERSHIP"] = 7] = "CIRCULAR_OBJECT_OWNERSHIP";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["INSUFFICIENT_COIN_BALANCE"] = 8] = "INSUFFICIENT_COIN_BALANCE";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["COIN_BALANCE_OVERFLOW"] = 9] = "COIN_BALANCE_OVERFLOW";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["PUBLISH_ERROR_NON_ZERO_ADDRESS"] = 10] = "PUBLISH_ERROR_NON_ZERO_ADDRESS";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["SUI_MOVE_VERIFICATION_ERROR"] = 11] = "SUI_MOVE_VERIFICATION_ERROR";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["MOVE_PRIMITIVE_RUNTIME_ERROR"] = 12] = "MOVE_PRIMITIVE_RUNTIME_ERROR";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["MOVE_ABORT"] = 13] = "MOVE_ABORT";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["VM_VERIFICATION_OR_DESERIALIZATION_ERROR"] = 14] = "VM_VERIFICATION_OR_DESERIALIZATION_ERROR";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["VM_INVARIANT_VIOLATION"] = 15] = "VM_INVARIANT_VIOLATION";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["FUNCTION_NOT_FOUND"] = 16] = "FUNCTION_NOT_FOUND";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["ARITY_MISMATCH"] = 17] = "ARITY_MISMATCH";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["TYPE_ARITY_MISMATCH"] = 18] = "TYPE_ARITY_MISMATCH";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["NON_ENTRY_FUNCTION_INVOKED"] = 19] = "NON_ENTRY_FUNCTION_INVOKED";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["COMMAND_ARGUMENT_ERROR"] = 20] = "COMMAND_ARGUMENT_ERROR";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["TYPE_ARGUMENT_ERROR"] = 21] = "TYPE_ARGUMENT_ERROR";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["UNUSED_VALUE_WITHOUT_DROP"] = 22] = "UNUSED_VALUE_WITHOUT_DROP";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["INVALID_PUBLIC_FUNCTION_RETURN_TYPE"] = 23] = "INVALID_PUBLIC_FUNCTION_RETURN_TYPE";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["INVALID_TRANSFER_OBJECT"] = 24] = "INVALID_TRANSFER_OBJECT";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["EFFECTS_TOO_LARGE"] = 25] = "EFFECTS_TOO_LARGE";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["PUBLISH_UPGRADE_MISSING_DEPENDENCY"] = 26] = "PUBLISH_UPGRADE_MISSING_DEPENDENCY";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["PUBLISH_UPGRADE_DEPENDENCY_DOWNGRADE"] = 27] = "PUBLISH_UPGRADE_DEPENDENCY_DOWNGRADE";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["PACKAGE_UPGRADE_ERROR"] = 28] = "PACKAGE_UPGRADE_ERROR";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["WRITTEN_OBJECTS_TOO_LARGE"] = 29] = "WRITTEN_OBJECTS_TOO_LARGE";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["CERTIFICATE_DENIED"] = 30] = "CERTIFICATE_DENIED";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["SUI_MOVE_VERIFICATION_TIMEDOUT"] = 31] = "SUI_MOVE_VERIFICATION_TIMEDOUT";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["CONSENSUS_OBJECT_OPERATION_NOT_ALLOWED"] = 32] = "CONSENSUS_OBJECT_OPERATION_NOT_ALLOWED";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["INPUT_OBJECT_DELETED"] = 33] = "INPUT_OBJECT_DELETED";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["EXECUTION_CANCELED_DUE_TO_CONSENSUS_OBJECT_CONGESTION"] = 34] = "EXECUTION_CANCELED_DUE_TO_CONSENSUS_OBJECT_CONGESTION";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["ADDRESS_DENIED_FOR_COIN"] = 35] = "ADDRESS_DENIED_FOR_COIN";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["COIN_TYPE_GLOBAL_PAUSE"] = 36] = "COIN_TYPE_GLOBAL_PAUSE";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["EXECUTION_CANCELED_DUE_TO_RANDOMNESS_UNAVAILABLE"] = 37] = "EXECUTION_CANCELED_DUE_TO_RANDOMNESS_UNAVAILABLE";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["MOVE_VECTOR_ELEM_TOO_BIG"] = 38] = "MOVE_VECTOR_ELEM_TOO_BIG";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["MOVE_RAW_VALUE_TOO_BIG"] = 39] = "MOVE_RAW_VALUE_TOO_BIG";
  ExecutionError_ExecutionErrorKind2[ExecutionError_ExecutionErrorKind2["INVALID_LINKAGE"] = 40] = "INVALID_LINKAGE";
  return ExecutionError_ExecutionErrorKind2;
})(ExecutionError_ExecutionErrorKind || {});
var CommandArgumentError_CommandArgumentErrorKind = /* @__PURE__ */ ((CommandArgumentError_CommandArgumentErrorKind2) => {
  CommandArgumentError_CommandArgumentErrorKind2[CommandArgumentError_CommandArgumentErrorKind2["COMMAND_ARGUMENT_ERROR_KIND_UNKNOWN"] = 0] = "COMMAND_ARGUMENT_ERROR_KIND_UNKNOWN";
  CommandArgumentError_CommandArgumentErrorKind2[CommandArgumentError_CommandArgumentErrorKind2["TYPE_MISMATCH"] = 1] = "TYPE_MISMATCH";
  CommandArgumentError_CommandArgumentErrorKind2[CommandArgumentError_CommandArgumentErrorKind2["INVALID_BCS_BYTES"] = 2] = "INVALID_BCS_BYTES";
  CommandArgumentError_CommandArgumentErrorKind2[CommandArgumentError_CommandArgumentErrorKind2["INVALID_USAGE_OF_PURE_ARGUMENT"] = 3] = "INVALID_USAGE_OF_PURE_ARGUMENT";
  CommandArgumentError_CommandArgumentErrorKind2[CommandArgumentError_CommandArgumentErrorKind2["INVALID_ARGUMENT_TO_PRIVATE_ENTRY_FUNCTION"] = 4] = "INVALID_ARGUMENT_TO_PRIVATE_ENTRY_FUNCTION";
  CommandArgumentError_CommandArgumentErrorKind2[CommandArgumentError_CommandArgumentErrorKind2["INDEX_OUT_OF_BOUNDS"] = 5] = "INDEX_OUT_OF_BOUNDS";
  CommandArgumentError_CommandArgumentErrorKind2[CommandArgumentError_CommandArgumentErrorKind2["SECONDARY_INDEX_OUT_OF_BOUNDS"] = 6] = "SECONDARY_INDEX_OUT_OF_BOUNDS";
  CommandArgumentError_CommandArgumentErrorKind2[CommandArgumentError_CommandArgumentErrorKind2["INVALID_RESULT_ARITY"] = 7] = "INVALID_RESULT_ARITY";
  CommandArgumentError_CommandArgumentErrorKind2[CommandArgumentError_CommandArgumentErrorKind2["INVALID_GAS_COIN_USAGE"] = 8] = "INVALID_GAS_COIN_USAGE";
  CommandArgumentError_CommandArgumentErrorKind2[CommandArgumentError_CommandArgumentErrorKind2["INVALID_VALUE_USAGE"] = 9] = "INVALID_VALUE_USAGE";
  CommandArgumentError_CommandArgumentErrorKind2[CommandArgumentError_CommandArgumentErrorKind2["INVALID_OBJECT_BY_VALUE"] = 10] = "INVALID_OBJECT_BY_VALUE";
  CommandArgumentError_CommandArgumentErrorKind2[CommandArgumentError_CommandArgumentErrorKind2["INVALID_OBJECT_BY_MUT_REF"] = 11] = "INVALID_OBJECT_BY_MUT_REF";
  CommandArgumentError_CommandArgumentErrorKind2[CommandArgumentError_CommandArgumentErrorKind2["CONSENSUS_OBJECT_OPERATION_NOT_ALLOWED"] = 12] = "CONSENSUS_OBJECT_OPERATION_NOT_ALLOWED";
  CommandArgumentError_CommandArgumentErrorKind2[CommandArgumentError_CommandArgumentErrorKind2["INVALID_ARGUMENT_ARITY"] = 13] = "INVALID_ARGUMENT_ARITY";
  return CommandArgumentError_CommandArgumentErrorKind2;
})(CommandArgumentError_CommandArgumentErrorKind || {});
var PackageUpgradeError_PackageUpgradeErrorKind = /* @__PURE__ */ ((PackageUpgradeError_PackageUpgradeErrorKind2) => {
  PackageUpgradeError_PackageUpgradeErrorKind2[PackageUpgradeError_PackageUpgradeErrorKind2["PACKAGE_UPGRADE_ERROR_KIND_UNKNOWN"] = 0] = "PACKAGE_UPGRADE_ERROR_KIND_UNKNOWN";
  PackageUpgradeError_PackageUpgradeErrorKind2[PackageUpgradeError_PackageUpgradeErrorKind2["UNABLE_TO_FETCH_PACKAGE"] = 1] = "UNABLE_TO_FETCH_PACKAGE";
  PackageUpgradeError_PackageUpgradeErrorKind2[PackageUpgradeError_PackageUpgradeErrorKind2["NOT_A_PACKAGE"] = 2] = "NOT_A_PACKAGE";
  PackageUpgradeError_PackageUpgradeErrorKind2[PackageUpgradeError_PackageUpgradeErrorKind2["INCOMPATIBLE_UPGRADE"] = 3] = "INCOMPATIBLE_UPGRADE";
  PackageUpgradeError_PackageUpgradeErrorKind2[PackageUpgradeError_PackageUpgradeErrorKind2["DIGEST_DOES_NOT_MATCH"] = 4] = "DIGEST_DOES_NOT_MATCH";
  PackageUpgradeError_PackageUpgradeErrorKind2[PackageUpgradeError_PackageUpgradeErrorKind2["UNKNOWN_UPGRADE_POLICY"] = 5] = "UNKNOWN_UPGRADE_POLICY";
  PackageUpgradeError_PackageUpgradeErrorKind2[PackageUpgradeError_PackageUpgradeErrorKind2["PACKAGE_ID_DOES_NOT_MATCH"] = 6] = "PACKAGE_ID_DOES_NOT_MATCH";
  return PackageUpgradeError_PackageUpgradeErrorKind2;
})(PackageUpgradeError_PackageUpgradeErrorKind || {});
var TypeArgumentError_TypeArgumentErrorKind = /* @__PURE__ */ ((TypeArgumentError_TypeArgumentErrorKind2) => {
  TypeArgumentError_TypeArgumentErrorKind2[TypeArgumentError_TypeArgumentErrorKind2["TYPE_ARGUMENT_ERROR_KIND_UNKNOWN"] = 0] = "TYPE_ARGUMENT_ERROR_KIND_UNKNOWN";
  TypeArgumentError_TypeArgumentErrorKind2[TypeArgumentError_TypeArgumentErrorKind2["TYPE_NOT_FOUND"] = 1] = "TYPE_NOT_FOUND";
  TypeArgumentError_TypeArgumentErrorKind2[TypeArgumentError_TypeArgumentErrorKind2["CONSTRAINT_NOT_SATISFIED"] = 2] = "CONSTRAINT_NOT_SATISFIED";
  return TypeArgumentError_TypeArgumentErrorKind2;
})(TypeArgumentError_TypeArgumentErrorKind || {});
class ExecutionStatus$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ExecutionStatus", [
      {
        no: 1,
        name: "success",
        kind: "scalar",
        opt: true,
        T: 8
        /*ScalarType.BOOL*/
      },
      { no: 2, name: "error", kind: "message", T: () => ExecutionError }
    ]);
  }
}
const ExecutionStatus = new ExecutionStatus$Type();
class ExecutionError$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ExecutionError", [
      {
        no: 1,
        name: "description",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "command",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "kind",
        kind: "enum",
        opt: true,
        T: () => [
          "sui.rpc.v2.ExecutionError.ExecutionErrorKind",
          ExecutionError_ExecutionErrorKind
        ]
      },
      { no: 4, name: "abort", kind: "message", oneof: "errorDetails", T: () => MoveAbort },
      { no: 5, name: "size_error", kind: "message", oneof: "errorDetails", T: () => SizeError },
      {
        no: 6,
        name: "command_argument_error",
        kind: "message",
        oneof: "errorDetails",
        T: () => CommandArgumentError
      },
      {
        no: 7,
        name: "type_argument_error",
        kind: "message",
        oneof: "errorDetails",
        T: () => TypeArgumentError
      },
      {
        no: 8,
        name: "package_upgrade_error",
        kind: "message",
        oneof: "errorDetails",
        T: () => PackageUpgradeError
      },
      { no: 9, name: "index_error", kind: "message", oneof: "errorDetails", T: () => IndexError },
      {
        no: 10,
        name: "object_id",
        kind: "scalar",
        oneof: "errorDetails",
        T: 9
      },
      {
        no: 11,
        name: "coin_deny_list_error",
        kind: "message",
        oneof: "errorDetails",
        T: () => CoinDenyListError
      },
      {
        no: 12,
        name: "congested_objects",
        kind: "message",
        oneof: "errorDetails",
        T: () => CongestedObjects
      }
    ]);
  }
}
const ExecutionError = new ExecutionError$Type();
class MoveAbort$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.MoveAbort", [
      {
        no: 1,
        name: "abort_code",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 2, name: "location", kind: "message", T: () => MoveLocation },
      { no: 3, name: "clever_error", kind: "message", T: () => CleverError }
    ]);
  }
}
const MoveAbort = new MoveAbort$Type();
class MoveLocation$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.MoveLocation", [
      {
        no: 1,
        name: "package",
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
        name: "function",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      },
      {
        no: 4,
        name: "instruction",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      },
      {
        no: 5,
        name: "function_name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const MoveLocation = new MoveLocation$Type();
class CleverError$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.CleverError", [
      {
        no: 1,
        name: "error_code",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "line_number",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "constant_name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 4,
        name: "constant_type",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 5,
        name: "rendered",
        kind: "scalar",
        oneof: "value",
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 6,
        name: "raw",
        kind: "scalar",
        oneof: "value",
        T: 12
        /*ScalarType.BYTES*/
      }
    ]);
  }
}
const CleverError = new CleverError$Type();
class SizeError$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.SizeError", [
      {
        no: 1,
        name: "size",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "max_size",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      }
    ]);
  }
}
const SizeError = new SizeError$Type();
class IndexError$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.IndexError", [
      {
        no: 1,
        name: "index",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      },
      {
        no: 2,
        name: "subresult",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      }
    ]);
  }
}
const IndexError = new IndexError$Type();
class CoinDenyListError$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.CoinDenyListError", [
      {
        no: 1,
        name: "address",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "coin_type",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const CoinDenyListError = new CoinDenyListError$Type();
class CongestedObjects$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.CongestedObjects", [
      {
        no: 1,
        name: "objects",
        kind: "scalar",
        repeat: 2,
        T: 9
      }
    ]);
  }
}
const CongestedObjects = new CongestedObjects$Type();
class CommandArgumentError$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.CommandArgumentError", [
      {
        no: 1,
        name: "argument",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      },
      {
        no: 2,
        name: "kind",
        kind: "enum",
        opt: true,
        T: () => [
          "sui.rpc.v2.CommandArgumentError.CommandArgumentErrorKind",
          CommandArgumentError_CommandArgumentErrorKind
        ]
      },
      { no: 3, name: "index_error", kind: "message", T: () => IndexError }
    ]);
  }
}
const CommandArgumentError = new CommandArgumentError$Type();
class PackageUpgradeError$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.PackageUpgradeError", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: true,
        T: () => [
          "sui.rpc.v2.PackageUpgradeError.PackageUpgradeErrorKind",
          PackageUpgradeError_PackageUpgradeErrorKind
        ]
      },
      {
        no: 2,
        name: "package_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 4,
        name: "policy",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      },
      {
        no: 5,
        name: "ticket_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const PackageUpgradeError = new PackageUpgradeError$Type();
class TypeArgumentError$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.TypeArgumentError", [
      {
        no: 1,
        name: "type_argument",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      },
      {
        no: 2,
        name: "kind",
        kind: "enum",
        opt: true,
        T: () => [
          "sui.rpc.v2.TypeArgumentError.TypeArgumentErrorKind",
          TypeArgumentError_TypeArgumentErrorKind
        ]
      }
    ]);
  }
}
const TypeArgumentError = new TypeArgumentError$Type();
//# sourceMappingURL=execution_status.js.map
