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
var transaction_exports = {};
__export(transaction_exports, {
  ActiveJwk: () => ActiveJwk,
  AuthenticatorStateExpire: () => AuthenticatorStateExpire,
  AuthenticatorStateUpdate: () => AuthenticatorStateUpdate,
  CanceledTransaction: () => CanceledTransaction,
  ChangeEpoch: () => ChangeEpoch,
  Command: () => Command,
  ConsensusCommitPrologue: () => ConsensusCommitPrologue,
  ConsensusDeterminedVersionAssignments: () => ConsensusDeterminedVersionAssignments,
  EndOfEpochTransaction: () => EndOfEpochTransaction,
  EndOfEpochTransactionKind: () => EndOfEpochTransactionKind,
  EndOfEpochTransactionKind_Kind: () => EndOfEpochTransactionKind_Kind,
  ExecutionTimeObservation: () => ExecutionTimeObservation,
  ExecutionTimeObservation_ExecutionTimeObservationKind: () => ExecutionTimeObservation_ExecutionTimeObservationKind,
  ExecutionTimeObservations: () => ExecutionTimeObservations,
  GasPayment: () => GasPayment,
  GenesisTransaction: () => GenesisTransaction,
  MakeMoveVector: () => MakeMoveVector,
  MergeCoins: () => MergeCoins,
  MoveCall: () => MoveCall,
  ProgrammableTransaction: () => ProgrammableTransaction,
  Publish: () => Publish,
  RandomnessStateUpdate: () => RandomnessStateUpdate,
  SplitCoins: () => SplitCoins,
  SystemPackage: () => SystemPackage,
  Transaction: () => Transaction,
  TransactionExpiration: () => TransactionExpiration,
  TransactionExpiration_TransactionExpirationKind: () => TransactionExpiration_TransactionExpirationKind,
  TransactionKind: () => TransactionKind,
  TransactionKind_Kind: () => TransactionKind_Kind,
  TransferObjects: () => TransferObjects,
  Upgrade: () => Upgrade,
  ValidatorExecutionTimeObservation: () => ValidatorExecutionTimeObservation,
  VersionAssignment: () => VersionAssignment
});
module.exports = __toCommonJS(transaction_exports);
var import_runtime = require("@protobuf-ts/runtime");
var import_duration = require("../../../google/protobuf/duration.js");
var import_jwk = require("./jwk.js");
var import_jwk2 = require("./jwk.js");
var import_object = require("./object.js");
var import_timestamp = require("../../../google/protobuf/timestamp.js");
var import_argument = require("./argument.js");
var import_input = require("./input.js");
var import_object_reference = require("./object_reference.js");
var import_bcs = require("./bcs.js");
var TransactionExpiration_TransactionExpirationKind = /* @__PURE__ */ ((TransactionExpiration_TransactionExpirationKind2) => {
  TransactionExpiration_TransactionExpirationKind2[TransactionExpiration_TransactionExpirationKind2["TRANSACTION_EXPIRATION_KIND_UNKNOWN"] = 0] = "TRANSACTION_EXPIRATION_KIND_UNKNOWN";
  TransactionExpiration_TransactionExpirationKind2[TransactionExpiration_TransactionExpirationKind2["NONE"] = 1] = "NONE";
  TransactionExpiration_TransactionExpirationKind2[TransactionExpiration_TransactionExpirationKind2["EPOCH"] = 2] = "EPOCH";
  return TransactionExpiration_TransactionExpirationKind2;
})(TransactionExpiration_TransactionExpirationKind || {});
var TransactionKind_Kind = /* @__PURE__ */ ((TransactionKind_Kind2) => {
  TransactionKind_Kind2[TransactionKind_Kind2["KIND_UNKNOWN"] = 0] = "KIND_UNKNOWN";
  TransactionKind_Kind2[TransactionKind_Kind2["PROGRAMMABLE_TRANSACTION"] = 1] = "PROGRAMMABLE_TRANSACTION";
  TransactionKind_Kind2[TransactionKind_Kind2["CHANGE_EPOCH"] = 2] = "CHANGE_EPOCH";
  TransactionKind_Kind2[TransactionKind_Kind2["GENESIS"] = 3] = "GENESIS";
  TransactionKind_Kind2[TransactionKind_Kind2["CONSENSUS_COMMIT_PROLOGUE_V1"] = 4] = "CONSENSUS_COMMIT_PROLOGUE_V1";
  TransactionKind_Kind2[TransactionKind_Kind2["AUTHENTICATOR_STATE_UPDATE"] = 5] = "AUTHENTICATOR_STATE_UPDATE";
  TransactionKind_Kind2[TransactionKind_Kind2["END_OF_EPOCH"] = 6] = "END_OF_EPOCH";
  TransactionKind_Kind2[TransactionKind_Kind2["RANDOMNESS_STATE_UPDATE"] = 7] = "RANDOMNESS_STATE_UPDATE";
  TransactionKind_Kind2[TransactionKind_Kind2["CONSENSUS_COMMIT_PROLOGUE_V2"] = 8] = "CONSENSUS_COMMIT_PROLOGUE_V2";
  TransactionKind_Kind2[TransactionKind_Kind2["CONSENSUS_COMMIT_PROLOGUE_V3"] = 9] = "CONSENSUS_COMMIT_PROLOGUE_V3";
  TransactionKind_Kind2[TransactionKind_Kind2["CONSENSUS_COMMIT_PROLOGUE_V4"] = 10] = "CONSENSUS_COMMIT_PROLOGUE_V4";
  return TransactionKind_Kind2;
})(TransactionKind_Kind || {});
var EndOfEpochTransactionKind_Kind = /* @__PURE__ */ ((EndOfEpochTransactionKind_Kind2) => {
  EndOfEpochTransactionKind_Kind2[EndOfEpochTransactionKind_Kind2["KIND_UNKNOWN"] = 0] = "KIND_UNKNOWN";
  EndOfEpochTransactionKind_Kind2[EndOfEpochTransactionKind_Kind2["CHANGE_EPOCH"] = 1] = "CHANGE_EPOCH";
  EndOfEpochTransactionKind_Kind2[EndOfEpochTransactionKind_Kind2["AUTHENTICATOR_STATE_CREATE"] = 2] = "AUTHENTICATOR_STATE_CREATE";
  EndOfEpochTransactionKind_Kind2[EndOfEpochTransactionKind_Kind2["AUTHENTICATOR_STATE_EXPIRE"] = 3] = "AUTHENTICATOR_STATE_EXPIRE";
  EndOfEpochTransactionKind_Kind2[EndOfEpochTransactionKind_Kind2["RANDOMNESS_STATE_CREATE"] = 4] = "RANDOMNESS_STATE_CREATE";
  EndOfEpochTransactionKind_Kind2[EndOfEpochTransactionKind_Kind2["DENY_LIST_STATE_CREATE"] = 5] = "DENY_LIST_STATE_CREATE";
  EndOfEpochTransactionKind_Kind2[EndOfEpochTransactionKind_Kind2["BRIDGE_STATE_CREATE"] = 6] = "BRIDGE_STATE_CREATE";
  EndOfEpochTransactionKind_Kind2[EndOfEpochTransactionKind_Kind2["BRIDGE_COMMITTEE_INIT"] = 7] = "BRIDGE_COMMITTEE_INIT";
  EndOfEpochTransactionKind_Kind2[EndOfEpochTransactionKind_Kind2["STORE_EXECUTION_TIME_OBSERVATIONS"] = 8] = "STORE_EXECUTION_TIME_OBSERVATIONS";
  EndOfEpochTransactionKind_Kind2[EndOfEpochTransactionKind_Kind2["ACCUMULATOR_ROOT_CREATE"] = 9] = "ACCUMULATOR_ROOT_CREATE";
  EndOfEpochTransactionKind_Kind2[EndOfEpochTransactionKind_Kind2["COIN_REGISTRY_CREATE"] = 10] = "COIN_REGISTRY_CREATE";
  EndOfEpochTransactionKind_Kind2[EndOfEpochTransactionKind_Kind2["DISPLAY_REGISTRY_CREATE"] = 11] = "DISPLAY_REGISTRY_CREATE";
  return EndOfEpochTransactionKind_Kind2;
})(EndOfEpochTransactionKind_Kind || {});
var ExecutionTimeObservation_ExecutionTimeObservationKind = /* @__PURE__ */ ((ExecutionTimeObservation_ExecutionTimeObservationKind2) => {
  ExecutionTimeObservation_ExecutionTimeObservationKind2[ExecutionTimeObservation_ExecutionTimeObservationKind2["EXECUTION_TIME_OBSERVATION_KIND_UNKNOWN"] = 0] = "EXECUTION_TIME_OBSERVATION_KIND_UNKNOWN";
  ExecutionTimeObservation_ExecutionTimeObservationKind2[ExecutionTimeObservation_ExecutionTimeObservationKind2["MOVE_ENTRY_POINT"] = 1] = "MOVE_ENTRY_POINT";
  ExecutionTimeObservation_ExecutionTimeObservationKind2[ExecutionTimeObservation_ExecutionTimeObservationKind2["TRANSFER_OBJECTS"] = 2] = "TRANSFER_OBJECTS";
  ExecutionTimeObservation_ExecutionTimeObservationKind2[ExecutionTimeObservation_ExecutionTimeObservationKind2["SPLIT_COINS"] = 3] = "SPLIT_COINS";
  ExecutionTimeObservation_ExecutionTimeObservationKind2[ExecutionTimeObservation_ExecutionTimeObservationKind2["MERGE_COINS"] = 4] = "MERGE_COINS";
  ExecutionTimeObservation_ExecutionTimeObservationKind2[ExecutionTimeObservation_ExecutionTimeObservationKind2["PUBLISH"] = 5] = "PUBLISH";
  ExecutionTimeObservation_ExecutionTimeObservationKind2[ExecutionTimeObservation_ExecutionTimeObservationKind2["MAKE_MOVE_VECTOR"] = 6] = "MAKE_MOVE_VECTOR";
  ExecutionTimeObservation_ExecutionTimeObservationKind2[ExecutionTimeObservation_ExecutionTimeObservationKind2["UPGRADE"] = 7] = "UPGRADE";
  return ExecutionTimeObservation_ExecutionTimeObservationKind2;
})(ExecutionTimeObservation_ExecutionTimeObservationKind || {});
class Transaction$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.Transaction", [
      { no: 1, name: "bcs", kind: "message", T: () => import_bcs.Bcs },
      {
        no: 2,
        name: "digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "version",
        kind: "scalar",
        opt: true,
        T: 5
        /*ScalarType.INT32*/
      },
      { no: 4, name: "kind", kind: "message", T: () => TransactionKind },
      {
        no: 5,
        name: "sender",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 6, name: "gas_payment", kind: "message", T: () => GasPayment },
      { no: 7, name: "expiration", kind: "message", T: () => TransactionExpiration }
    ]);
  }
}
const Transaction = new Transaction$Type();
class GasPayment$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.GasPayment", [
      {
        no: 1,
        name: "objects",
        kind: "message",
        repeat: 1,
        T: () => import_object_reference.ObjectReference
      },
      {
        no: 2,
        name: "owner",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "price",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "budget",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      }
    ]);
  }
}
const GasPayment = new GasPayment$Type();
class TransactionExpiration$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.TransactionExpiration", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: true,
        T: () => [
          "sui.rpc.v2.TransactionExpiration.TransactionExpirationKind",
          TransactionExpiration_TransactionExpirationKind
        ]
      },
      {
        no: 2,
        name: "epoch",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      }
    ]);
  }
}
const TransactionExpiration = new TransactionExpiration$Type();
class TransactionKind$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.TransactionKind", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.TransactionKind.Kind", TransactionKind_Kind]
      },
      {
        no: 2,
        name: "programmable_transaction",
        kind: "message",
        oneof: "data",
        T: () => ProgrammableTransaction
      },
      { no: 3, name: "change_epoch", kind: "message", oneof: "data", T: () => ChangeEpoch },
      { no: 4, name: "genesis", kind: "message", oneof: "data", T: () => GenesisTransaction },
      {
        no: 5,
        name: "consensus_commit_prologue",
        kind: "message",
        oneof: "data",
        T: () => ConsensusCommitPrologue
      },
      {
        no: 6,
        name: "authenticator_state_update",
        kind: "message",
        oneof: "data",
        T: () => AuthenticatorStateUpdate
      },
      {
        no: 7,
        name: "end_of_epoch",
        kind: "message",
        oneof: "data",
        T: () => EndOfEpochTransaction
      },
      {
        no: 8,
        name: "randomness_state_update",
        kind: "message",
        oneof: "data",
        T: () => RandomnessStateUpdate
      }
    ]);
  }
}
const TransactionKind = new TransactionKind$Type();
class ProgrammableTransaction$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ProgrammableTransaction", [
      { no: 1, name: "inputs", kind: "message", repeat: 1, T: () => import_input.Input },
      {
        no: 2,
        name: "commands",
        kind: "message",
        repeat: 1,
        T: () => Command
      }
    ]);
  }
}
const ProgrammableTransaction = new ProgrammableTransaction$Type();
class Command$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.Command", [
      { no: 1, name: "move_call", kind: "message", oneof: "command", T: () => MoveCall },
      {
        no: 2,
        name: "transfer_objects",
        kind: "message",
        oneof: "command",
        T: () => TransferObjects
      },
      { no: 3, name: "split_coins", kind: "message", oneof: "command", T: () => SplitCoins },
      { no: 4, name: "merge_coins", kind: "message", oneof: "command", T: () => MergeCoins },
      { no: 5, name: "publish", kind: "message", oneof: "command", T: () => Publish },
      {
        no: 6,
        name: "make_move_vector",
        kind: "message",
        oneof: "command",
        T: () => MakeMoveVector
      },
      { no: 7, name: "upgrade", kind: "message", oneof: "command", T: () => Upgrade }
    ]);
  }
}
const Command = new Command$Type();
class MoveCall$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.MoveCall", [
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
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 4,
        name: "type_arguments",
        kind: "scalar",
        repeat: 2,
        T: 9
      },
      {
        no: 5,
        name: "arguments",
        kind: "message",
        repeat: 1,
        T: () => import_argument.Argument
      }
    ]);
  }
}
const MoveCall = new MoveCall$Type();
class TransferObjects$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.TransferObjects", [
      {
        no: 1,
        name: "objects",
        kind: "message",
        repeat: 1,
        T: () => import_argument.Argument
      },
      { no: 2, name: "address", kind: "message", T: () => import_argument.Argument }
    ]);
  }
}
const TransferObjects = new TransferObjects$Type();
class SplitCoins$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.SplitCoins", [
      { no: 1, name: "coin", kind: "message", T: () => import_argument.Argument },
      {
        no: 2,
        name: "amounts",
        kind: "message",
        repeat: 1,
        T: () => import_argument.Argument
      }
    ]);
  }
}
const SplitCoins = new SplitCoins$Type();
class MergeCoins$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.MergeCoins", [
      { no: 1, name: "coin", kind: "message", T: () => import_argument.Argument },
      {
        no: 2,
        name: "coins_to_merge",
        kind: "message",
        repeat: 1,
        T: () => import_argument.Argument
      }
    ]);
  }
}
const MergeCoins = new MergeCoins$Type();
class Publish$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.Publish", [
      {
        no: 1,
        name: "modules",
        kind: "scalar",
        repeat: 2,
        T: 12
      },
      {
        no: 2,
        name: "dependencies",
        kind: "scalar",
        repeat: 2,
        T: 9
      }
    ]);
  }
}
const Publish = new Publish$Type();
class MakeMoveVector$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.MakeMoveVector", [
      {
        no: 1,
        name: "element_type",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "elements",
        kind: "message",
        repeat: 1,
        T: () => import_argument.Argument
      }
    ]);
  }
}
const MakeMoveVector = new MakeMoveVector$Type();
class Upgrade$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.Upgrade", [
      {
        no: 1,
        name: "modules",
        kind: "scalar",
        repeat: 2,
        T: 12
      },
      {
        no: 2,
        name: "dependencies",
        kind: "scalar",
        repeat: 2,
        T: 9
      },
      {
        no: 3,
        name: "package",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 4, name: "ticket", kind: "message", T: () => import_argument.Argument }
    ]);
  }
}
const Upgrade = new Upgrade$Type();
class RandomnessStateUpdate$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.RandomnessStateUpdate", [
      {
        no: 1,
        name: "epoch",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "randomness_round",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "random_bytes",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      },
      {
        no: 4,
        name: "randomness_object_initial_shared_version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      }
    ]);
  }
}
const RandomnessStateUpdate = new RandomnessStateUpdate$Type();
class ChangeEpoch$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ChangeEpoch", [
      {
        no: 1,
        name: "epoch",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "protocol_version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "storage_charge",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "computation_charge",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 5,
        name: "storage_rebate",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 6,
        name: "non_refundable_storage_fee",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 7, name: "epoch_start_timestamp", kind: "message", T: () => import_timestamp.Timestamp },
      {
        no: 8,
        name: "system_packages",
        kind: "message",
        repeat: 1,
        T: () => SystemPackage
      }
    ]);
  }
}
const ChangeEpoch = new ChangeEpoch$Type();
class SystemPackage$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.SystemPackage", [
      {
        no: 1,
        name: "version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "modules",
        kind: "scalar",
        repeat: 2,
        T: 12
      },
      {
        no: 3,
        name: "dependencies",
        kind: "scalar",
        repeat: 2,
        T: 9
      }
    ]);
  }
}
const SystemPackage = new SystemPackage$Type();
class GenesisTransaction$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.GenesisTransaction", [
      { no: 1, name: "objects", kind: "message", repeat: 1, T: () => import_object.Object }
    ]);
  }
}
const GenesisTransaction = new GenesisTransaction$Type();
class ConsensusCommitPrologue$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ConsensusCommitPrologue", [
      {
        no: 1,
        name: "epoch",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "round",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 3, name: "commit_timestamp", kind: "message", T: () => import_timestamp.Timestamp },
      {
        no: 4,
        name: "consensus_commit_digest",
        kind: "scalar",
        opt: true,
        T: 9
      },
      {
        no: 5,
        name: "sub_dag_index",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 6,
        name: "consensus_determined_version_assignments",
        kind: "message",
        T: () => ConsensusDeterminedVersionAssignments
      },
      {
        no: 7,
        name: "additional_state_digest",
        kind: "scalar",
        opt: true,
        T: 9
      }
    ]);
  }
}
const ConsensusCommitPrologue = new ConsensusCommitPrologue$Type();
class VersionAssignment$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.VersionAssignment", [
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
        name: "start_version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      }
    ]);
  }
}
const VersionAssignment = new VersionAssignment$Type();
class CanceledTransaction$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.CanceledTransaction", [
      {
        no: 1,
        name: "digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "version_assignments",
        kind: "message",
        repeat: 1,
        T: () => VersionAssignment
      }
    ]);
  }
}
const CanceledTransaction = new CanceledTransaction$Type();
class ConsensusDeterminedVersionAssignments$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ConsensusDeterminedVersionAssignments", [
      {
        no: 1,
        name: "version",
        kind: "scalar",
        opt: true,
        T: 5
        /*ScalarType.INT32*/
      },
      {
        no: 3,
        name: "canceled_transactions",
        kind: "message",
        repeat: 1,
        T: () => CanceledTransaction
      }
    ]);
  }
}
const ConsensusDeterminedVersionAssignments = new ConsensusDeterminedVersionAssignments$Type();
class AuthenticatorStateUpdate$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.AuthenticatorStateUpdate", [
      {
        no: 1,
        name: "epoch",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "round",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "new_active_jwks",
        kind: "message",
        repeat: 1,
        T: () => ActiveJwk
      },
      {
        no: 4,
        name: "authenticator_object_initial_shared_version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      }
    ]);
  }
}
const AuthenticatorStateUpdate = new AuthenticatorStateUpdate$Type();
class ActiveJwk$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ActiveJwk", [
      { no: 1, name: "id", kind: "message", T: () => import_jwk2.JwkId },
      { no: 2, name: "jwk", kind: "message", T: () => import_jwk.Jwk },
      {
        no: 3,
        name: "epoch",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      }
    ]);
  }
}
const ActiveJwk = new ActiveJwk$Type();
class EndOfEpochTransaction$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.EndOfEpochTransaction", [
      {
        no: 1,
        name: "transactions",
        kind: "message",
        repeat: 1,
        T: () => EndOfEpochTransactionKind
      }
    ]);
  }
}
const EndOfEpochTransaction = new EndOfEpochTransaction$Type();
class EndOfEpochTransactionKind$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.EndOfEpochTransactionKind", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.EndOfEpochTransactionKind.Kind", EndOfEpochTransactionKind_Kind]
      },
      { no: 2, name: "change_epoch", kind: "message", oneof: "data", T: () => ChangeEpoch },
      {
        no: 3,
        name: "authenticator_state_expire",
        kind: "message",
        oneof: "data",
        T: () => AuthenticatorStateExpire
      },
      {
        no: 4,
        name: "execution_time_observations",
        kind: "message",
        oneof: "data",
        T: () => ExecutionTimeObservations
      },
      {
        no: 5,
        name: "bridge_chain_id",
        kind: "scalar",
        oneof: "data",
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 6,
        name: "bridge_object_version",
        kind: "scalar",
        oneof: "data",
        T: 4,
        L: 0
      }
    ]);
  }
}
const EndOfEpochTransactionKind = new EndOfEpochTransactionKind$Type();
class AuthenticatorStateExpire$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.AuthenticatorStateExpire", [
      {
        no: 1,
        name: "min_epoch",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "authenticator_object_initial_shared_version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      }
    ]);
  }
}
const AuthenticatorStateExpire = new AuthenticatorStateExpire$Type();
class ExecutionTimeObservations$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ExecutionTimeObservations", [
      {
        no: 1,
        name: "version",
        kind: "scalar",
        opt: true,
        T: 5
        /*ScalarType.INT32*/
      },
      {
        no: 2,
        name: "observations",
        kind: "message",
        repeat: 1,
        T: () => ExecutionTimeObservation
      }
    ]);
  }
}
const ExecutionTimeObservations = new ExecutionTimeObservations$Type();
class ExecutionTimeObservation$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ExecutionTimeObservation", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: true,
        T: () => [
          "sui.rpc.v2.ExecutionTimeObservation.ExecutionTimeObservationKind",
          ExecutionTimeObservation_ExecutionTimeObservationKind
        ]
      },
      { no: 2, name: "move_entry_point", kind: "message", T: () => MoveCall },
      {
        no: 3,
        name: "validator_observations",
        kind: "message",
        repeat: 1,
        T: () => ValidatorExecutionTimeObservation
      }
    ]);
  }
}
const ExecutionTimeObservation = new ExecutionTimeObservation$Type();
class ValidatorExecutionTimeObservation$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ValidatorExecutionTimeObservation", [
      {
        no: 1,
        name: "validator",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      },
      { no: 2, name: "duration", kind: "message", T: () => import_duration.Duration }
    ]);
  }
}
const ValidatorExecutionTimeObservation = new ValidatorExecutionTimeObservation$Type();
//# sourceMappingURL=transaction.js.map
