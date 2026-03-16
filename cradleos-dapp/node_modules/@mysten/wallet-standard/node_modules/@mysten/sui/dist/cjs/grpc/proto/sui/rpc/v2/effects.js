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
var effects_exports = {};
__export(effects_exports, {
  ChangedObject: () => ChangedObject,
  ChangedObject_IdOperation: () => ChangedObject_IdOperation,
  ChangedObject_InputObjectState: () => ChangedObject_InputObjectState,
  ChangedObject_OutputObjectState: () => ChangedObject_OutputObjectState,
  TransactionEffects: () => TransactionEffects,
  UnchangedConsensusObject: () => UnchangedConsensusObject,
  UnchangedConsensusObject_UnchangedConsensusObjectKind: () => UnchangedConsensusObject_UnchangedConsensusObjectKind
});
module.exports = __toCommonJS(effects_exports);
var import_runtime = require("@protobuf-ts/runtime");
var import_owner = require("./owner.js");
var import_object_reference = require("./object_reference.js");
var import_gas_cost_summary = require("./gas_cost_summary.js");
var import_execution_status = require("./execution_status.js");
var import_bcs = require("./bcs.js");
var ChangedObject_InputObjectState = /* @__PURE__ */ ((ChangedObject_InputObjectState2) => {
  ChangedObject_InputObjectState2[ChangedObject_InputObjectState2["UNKNOWN"] = 0] = "UNKNOWN";
  ChangedObject_InputObjectState2[ChangedObject_InputObjectState2["DOES_NOT_EXIST"] = 1] = "DOES_NOT_EXIST";
  ChangedObject_InputObjectState2[ChangedObject_InputObjectState2["EXISTS"] = 2] = "EXISTS";
  return ChangedObject_InputObjectState2;
})(ChangedObject_InputObjectState || {});
var ChangedObject_OutputObjectState = /* @__PURE__ */ ((ChangedObject_OutputObjectState2) => {
  ChangedObject_OutputObjectState2[ChangedObject_OutputObjectState2["UNKNOWN"] = 0] = "UNKNOWN";
  ChangedObject_OutputObjectState2[ChangedObject_OutputObjectState2["DOES_NOT_EXIST"] = 1] = "DOES_NOT_EXIST";
  ChangedObject_OutputObjectState2[ChangedObject_OutputObjectState2["OBJECT_WRITE"] = 2] = "OBJECT_WRITE";
  ChangedObject_OutputObjectState2[ChangedObject_OutputObjectState2["PACKAGE_WRITE"] = 3] = "PACKAGE_WRITE";
  return ChangedObject_OutputObjectState2;
})(ChangedObject_OutputObjectState || {});
var ChangedObject_IdOperation = /* @__PURE__ */ ((ChangedObject_IdOperation2) => {
  ChangedObject_IdOperation2[ChangedObject_IdOperation2["ID_OPERATION_UNKNOWN"] = 0] = "ID_OPERATION_UNKNOWN";
  ChangedObject_IdOperation2[ChangedObject_IdOperation2["NONE"] = 1] = "NONE";
  ChangedObject_IdOperation2[ChangedObject_IdOperation2["CREATED"] = 2] = "CREATED";
  ChangedObject_IdOperation2[ChangedObject_IdOperation2["DELETED"] = 3] = "DELETED";
  return ChangedObject_IdOperation2;
})(ChangedObject_IdOperation || {});
var UnchangedConsensusObject_UnchangedConsensusObjectKind = /* @__PURE__ */ ((UnchangedConsensusObject_UnchangedConsensusObjectKind2) => {
  UnchangedConsensusObject_UnchangedConsensusObjectKind2[UnchangedConsensusObject_UnchangedConsensusObjectKind2["UNCHANGED_CONSENSUS_OBJECT_KIND_UNKNOWN"] = 0] = "UNCHANGED_CONSENSUS_OBJECT_KIND_UNKNOWN";
  UnchangedConsensusObject_UnchangedConsensusObjectKind2[UnchangedConsensusObject_UnchangedConsensusObjectKind2["READ_ONLY_ROOT"] = 1] = "READ_ONLY_ROOT";
  UnchangedConsensusObject_UnchangedConsensusObjectKind2[UnchangedConsensusObject_UnchangedConsensusObjectKind2["MUTATE_CONSENSUS_STREAM_ENDED"] = 2] = "MUTATE_CONSENSUS_STREAM_ENDED";
  UnchangedConsensusObject_UnchangedConsensusObjectKind2[UnchangedConsensusObject_UnchangedConsensusObjectKind2["READ_CONSENSUS_STREAM_ENDED"] = 3] = "READ_CONSENSUS_STREAM_ENDED";
  UnchangedConsensusObject_UnchangedConsensusObjectKind2[UnchangedConsensusObject_UnchangedConsensusObjectKind2["CANCELED"] = 4] = "CANCELED";
  UnchangedConsensusObject_UnchangedConsensusObjectKind2[UnchangedConsensusObject_UnchangedConsensusObjectKind2["PER_EPOCH_CONFIG"] = 5] = "PER_EPOCH_CONFIG";
  return UnchangedConsensusObject_UnchangedConsensusObjectKind2;
})(UnchangedConsensusObject_UnchangedConsensusObjectKind || {});
class TransactionEffects$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.TransactionEffects", [
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
      { no: 4, name: "status", kind: "message", T: () => import_execution_status.ExecutionStatus },
      {
        no: 5,
        name: "epoch",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 6, name: "gas_used", kind: "message", T: () => import_gas_cost_summary.GasCostSummary },
      {
        no: 7,
        name: "transaction_digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 8, name: "gas_object", kind: "message", T: () => ChangedObject },
      {
        no: 9,
        name: "events_digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 10,
        name: "dependencies",
        kind: "scalar",
        repeat: 2,
        T: 9
      },
      {
        no: 11,
        name: "lamport_version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 12,
        name: "changed_objects",
        kind: "message",
        repeat: 1,
        T: () => ChangedObject
      },
      {
        no: 13,
        name: "unchanged_consensus_objects",
        kind: "message",
        repeat: 1,
        T: () => UnchangedConsensusObject
      },
      {
        no: 14,
        name: "auxiliary_data_digest",
        kind: "scalar",
        opt: true,
        T: 9
      },
      {
        no: 15,
        name: "unchanged_loaded_runtime_objects",
        kind: "message",
        repeat: 1,
        T: () => import_object_reference.ObjectReference
      }
    ]);
  }
}
const TransactionEffects = new TransactionEffects$Type();
class ChangedObject$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ChangedObject", [
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
        name: "input_state",
        kind: "enum",
        opt: true,
        T: () => [
          "sui.rpc.v2.ChangedObject.InputObjectState",
          ChangedObject_InputObjectState,
          "INPUT_OBJECT_STATE_"
        ]
      },
      {
        no: 3,
        name: "input_version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "input_digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 5, name: "input_owner", kind: "message", T: () => import_owner.Owner },
      {
        no: 6,
        name: "output_state",
        kind: "enum",
        opt: true,
        T: () => [
          "sui.rpc.v2.ChangedObject.OutputObjectState",
          ChangedObject_OutputObjectState,
          "OUTPUT_OBJECT_STATE_"
        ]
      },
      {
        no: 7,
        name: "output_version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 8,
        name: "output_digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 9, name: "output_owner", kind: "message", T: () => import_owner.Owner },
      {
        no: 10,
        name: "id_operation",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.ChangedObject.IdOperation", ChangedObject_IdOperation]
      },
      {
        no: 11,
        name: "object_type",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const ChangedObject = new ChangedObject$Type();
class UnchangedConsensusObject$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.UnchangedConsensusObject", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: true,
        T: () => [
          "sui.rpc.v2.UnchangedConsensusObject.UnchangedConsensusObjectKind",
          UnchangedConsensusObject_UnchangedConsensusObjectKind
        ]
      },
      {
        no: 2,
        name: "object_id",
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
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 5,
        name: "object_type",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const UnchangedConsensusObject = new UnchangedConsensusObject$Type();
//# sourceMappingURL=effects.js.map
