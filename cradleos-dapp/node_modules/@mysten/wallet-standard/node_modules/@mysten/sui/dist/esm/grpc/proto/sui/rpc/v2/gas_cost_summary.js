import { MessageType } from "@protobuf-ts/runtime";
class GasCostSummary$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.GasCostSummary", [
      {
        no: 1,
        name: "computation_cost",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "storage_cost",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "storage_rebate",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "non_refundable_storage_fee",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      }
    ]);
  }
}
const GasCostSummary = new GasCostSummary$Type();
export {
  GasCostSummary
};
//# sourceMappingURL=gas_cost_summary.js.map
