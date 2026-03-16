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
var checkpoint_summary_exports = {};
__export(checkpoint_summary_exports, {
  CheckpointCommitment: () => CheckpointCommitment,
  CheckpointCommitment_CheckpointCommitmentKind: () => CheckpointCommitment_CheckpointCommitmentKind,
  CheckpointSummary: () => CheckpointSummary,
  EndOfEpochData: () => EndOfEpochData
});
module.exports = __toCommonJS(checkpoint_summary_exports);
var import_runtime = require("@protobuf-ts/runtime");
var import_signature = require("./signature.js");
var import_timestamp = require("../../../google/protobuf/timestamp.js");
var import_gas_cost_summary = require("./gas_cost_summary.js");
var import_bcs = require("./bcs.js");
var CheckpointCommitment_CheckpointCommitmentKind = /* @__PURE__ */ ((CheckpointCommitment_CheckpointCommitmentKind2) => {
  CheckpointCommitment_CheckpointCommitmentKind2[CheckpointCommitment_CheckpointCommitmentKind2["CHECKPOINT_COMMITMENT_KIND_UNKNOWN"] = 0] = "CHECKPOINT_COMMITMENT_KIND_UNKNOWN";
  CheckpointCommitment_CheckpointCommitmentKind2[CheckpointCommitment_CheckpointCommitmentKind2["ECMH_LIVE_OBJECT_SET"] = 1] = "ECMH_LIVE_OBJECT_SET";
  CheckpointCommitment_CheckpointCommitmentKind2[CheckpointCommitment_CheckpointCommitmentKind2["CHECKPOINT_ARTIFACTS"] = 2] = "CHECKPOINT_ARTIFACTS";
  return CheckpointCommitment_CheckpointCommitmentKind2;
})(CheckpointCommitment_CheckpointCommitmentKind || {});
class CheckpointSummary$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.CheckpointSummary", [
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
        name: "epoch",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "sequence_number",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 5,
        name: "total_network_transactions",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 6,
        name: "content_digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 7,
        name: "previous_digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 8, name: "epoch_rolling_gas_cost_summary", kind: "message", T: () => import_gas_cost_summary.GasCostSummary },
      { no: 9, name: "timestamp", kind: "message", T: () => import_timestamp.Timestamp },
      {
        no: 10,
        name: "commitments",
        kind: "message",
        repeat: 1,
        T: () => CheckpointCommitment
      },
      { no: 11, name: "end_of_epoch_data", kind: "message", T: () => EndOfEpochData },
      {
        no: 12,
        name: "version_specific_data",
        kind: "scalar",
        opt: true,
        T: 12
      }
    ]);
  }
}
const CheckpointSummary = new CheckpointSummary$Type();
class EndOfEpochData$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.EndOfEpochData", [
      {
        no: 1,
        name: "next_epoch_committee",
        kind: "message",
        repeat: 1,
        T: () => import_signature.ValidatorCommitteeMember
      },
      {
        no: 2,
        name: "next_epoch_protocol_version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "epoch_commitments",
        kind: "message",
        repeat: 1,
        T: () => CheckpointCommitment
      }
    ]);
  }
}
const EndOfEpochData = new EndOfEpochData$Type();
class CheckpointCommitment$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.CheckpointCommitment", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: true,
        T: () => [
          "sui.rpc.v2.CheckpointCommitment.CheckpointCommitmentKind",
          CheckpointCommitment_CheckpointCommitmentKind
        ]
      },
      {
        no: 2,
        name: "digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const CheckpointCommitment = new CheckpointCommitment$Type();
//# sourceMappingURL=checkpoint_summary.js.map
