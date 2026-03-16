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
var state_service_exports = {};
__export(state_service_exports, {
  Balance: () => Balance,
  CoinMetadata: () => CoinMetadata,
  CoinMetadata_MetadataCapState: () => CoinMetadata_MetadataCapState,
  CoinTreasury: () => CoinTreasury,
  CoinTreasury_SupplyState: () => CoinTreasury_SupplyState,
  DynamicField: () => DynamicField,
  DynamicField_DynamicFieldKind: () => DynamicField_DynamicFieldKind,
  GetBalanceRequest: () => GetBalanceRequest,
  GetBalanceResponse: () => GetBalanceResponse,
  GetCoinInfoRequest: () => GetCoinInfoRequest,
  GetCoinInfoResponse: () => GetCoinInfoResponse,
  ListBalancesRequest: () => ListBalancesRequest,
  ListBalancesResponse: () => ListBalancesResponse,
  ListDynamicFieldsRequest: () => ListDynamicFieldsRequest,
  ListDynamicFieldsResponse: () => ListDynamicFieldsResponse,
  ListOwnedObjectsRequest: () => ListOwnedObjectsRequest,
  ListOwnedObjectsResponse: () => ListOwnedObjectsResponse,
  RegulatedCoinMetadata: () => RegulatedCoinMetadata,
  RegulatedCoinMetadata_CoinRegulatedState: () => RegulatedCoinMetadata_CoinRegulatedState,
  StateService: () => StateService
});
module.exports = __toCommonJS(state_service_exports);
var import_runtime_rpc = require("@protobuf-ts/runtime-rpc");
var import_runtime = require("@protobuf-ts/runtime");
var import_bcs = require("./bcs.js");
var import_object = require("./object.js");
var import_field_mask = require("../../../google/protobuf/field_mask.js");
var CoinMetadata_MetadataCapState = /* @__PURE__ */ ((CoinMetadata_MetadataCapState2) => {
  CoinMetadata_MetadataCapState2[CoinMetadata_MetadataCapState2["METADATA_CAP_STATE_UNKNOWN"] = 0] = "METADATA_CAP_STATE_UNKNOWN";
  CoinMetadata_MetadataCapState2[CoinMetadata_MetadataCapState2["CLAIMED"] = 1] = "CLAIMED";
  CoinMetadata_MetadataCapState2[CoinMetadata_MetadataCapState2["UNCLAIMED"] = 2] = "UNCLAIMED";
  CoinMetadata_MetadataCapState2[CoinMetadata_MetadataCapState2["DELETED"] = 3] = "DELETED";
  return CoinMetadata_MetadataCapState2;
})(CoinMetadata_MetadataCapState || {});
var CoinTreasury_SupplyState = /* @__PURE__ */ ((CoinTreasury_SupplyState2) => {
  CoinTreasury_SupplyState2[CoinTreasury_SupplyState2["SUPPLY_STATE_UNKNOWN"] = 0] = "SUPPLY_STATE_UNKNOWN";
  CoinTreasury_SupplyState2[CoinTreasury_SupplyState2["FIXED"] = 1] = "FIXED";
  CoinTreasury_SupplyState2[CoinTreasury_SupplyState2["BURN_ONLY"] = 2] = "BURN_ONLY";
  return CoinTreasury_SupplyState2;
})(CoinTreasury_SupplyState || {});
var RegulatedCoinMetadata_CoinRegulatedState = /* @__PURE__ */ ((RegulatedCoinMetadata_CoinRegulatedState2) => {
  RegulatedCoinMetadata_CoinRegulatedState2[RegulatedCoinMetadata_CoinRegulatedState2["COIN_REGULATED_STATE_UNKNOWN"] = 0] = "COIN_REGULATED_STATE_UNKNOWN";
  RegulatedCoinMetadata_CoinRegulatedState2[RegulatedCoinMetadata_CoinRegulatedState2["REGULATED"] = 1] = "REGULATED";
  RegulatedCoinMetadata_CoinRegulatedState2[RegulatedCoinMetadata_CoinRegulatedState2["UNREGULATED"] = 2] = "UNREGULATED";
  return RegulatedCoinMetadata_CoinRegulatedState2;
})(RegulatedCoinMetadata_CoinRegulatedState || {});
var DynamicField_DynamicFieldKind = /* @__PURE__ */ ((DynamicField_DynamicFieldKind2) => {
  DynamicField_DynamicFieldKind2[DynamicField_DynamicFieldKind2["DYNAMIC_FIELD_KIND_UNKNOWN"] = 0] = "DYNAMIC_FIELD_KIND_UNKNOWN";
  DynamicField_DynamicFieldKind2[DynamicField_DynamicFieldKind2["FIELD"] = 1] = "FIELD";
  DynamicField_DynamicFieldKind2[DynamicField_DynamicFieldKind2["OBJECT"] = 2] = "OBJECT";
  return DynamicField_DynamicFieldKind2;
})(DynamicField_DynamicFieldKind || {});
class GetCoinInfoRequest$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.GetCoinInfoRequest", [
      {
        no: 1,
        name: "coin_type",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const GetCoinInfoRequest = new GetCoinInfoRequest$Type();
class GetCoinInfoResponse$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.GetCoinInfoResponse", [
      {
        no: 1,
        name: "coin_type",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 2, name: "metadata", kind: "message", T: () => CoinMetadata },
      { no: 3, name: "treasury", kind: "message", T: () => CoinTreasury },
      { no: 4, name: "regulated_metadata", kind: "message", T: () => RegulatedCoinMetadata }
    ]);
  }
}
const GetCoinInfoResponse = new GetCoinInfoResponse$Type();
class CoinMetadata$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.CoinMetadata", [
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
        name: "decimals",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      },
      {
        no: 3,
        name: "name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 4,
        name: "symbol",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 5,
        name: "description",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 6,
        name: "icon_url",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 7,
        name: "metadata_cap_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 8,
        name: "metadata_cap_state",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.CoinMetadata.MetadataCapState", CoinMetadata_MetadataCapState]
      }
    ]);
  }
}
const CoinMetadata = new CoinMetadata$Type();
class CoinTreasury$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.CoinTreasury", [
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
        name: "total_supply",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "supply_state",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.CoinTreasury.SupplyState", CoinTreasury_SupplyState]
      }
    ]);
  }
}
const CoinTreasury = new CoinTreasury$Type();
class RegulatedCoinMetadata$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.RegulatedCoinMetadata", [
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
        name: "coin_metadata_object",
        kind: "scalar",
        opt: true,
        T: 9
      },
      {
        no: 3,
        name: "deny_cap_object",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 4,
        name: "allow_global_pause",
        kind: "scalar",
        opt: true,
        T: 8
        /*ScalarType.BOOL*/
      },
      {
        no: 5,
        name: "variant",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      },
      {
        no: 6,
        name: "coin_regulated_state",
        kind: "enum",
        opt: true,
        T: () => [
          "sui.rpc.v2.RegulatedCoinMetadata.CoinRegulatedState",
          RegulatedCoinMetadata_CoinRegulatedState
        ]
      }
    ]);
  }
}
const RegulatedCoinMetadata = new RegulatedCoinMetadata$Type();
class GetBalanceRequest$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.GetBalanceRequest", [
      {
        no: 1,
        name: "owner",
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
const GetBalanceRequest = new GetBalanceRequest$Type();
class GetBalanceResponse$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.GetBalanceResponse", [
      { no: 1, name: "balance", kind: "message", T: () => Balance }
    ]);
  }
}
const GetBalanceResponse = new GetBalanceResponse$Type();
class ListBalancesRequest$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ListBalancesRequest", [
      {
        no: 1,
        name: "owner",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "page_size",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      },
      {
        no: 3,
        name: "page_token",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      }
    ]);
  }
}
const ListBalancesRequest = new ListBalancesRequest$Type();
class ListBalancesResponse$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ListBalancesResponse", [
      {
        no: 1,
        name: "balances",
        kind: "message",
        repeat: 1,
        T: () => Balance
      },
      {
        no: 2,
        name: "next_page_token",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      }
    ]);
  }
}
const ListBalancesResponse = new ListBalancesResponse$Type();
class Balance$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.Balance", [
      {
        no: 1,
        name: "coin_type",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "balance",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      }
    ]);
  }
}
const Balance = new Balance$Type();
class ListDynamicFieldsRequest$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ListDynamicFieldsRequest", [
      {
        no: 1,
        name: "parent",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "page_size",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      },
      {
        no: 3,
        name: "page_token",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      },
      { no: 4, name: "read_mask", kind: "message", T: () => import_field_mask.FieldMask }
    ]);
  }
}
const ListDynamicFieldsRequest = new ListDynamicFieldsRequest$Type();
class ListDynamicFieldsResponse$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ListDynamicFieldsResponse", [
      {
        no: 1,
        name: "dynamic_fields",
        kind: "message",
        repeat: 1,
        T: () => DynamicField
      },
      {
        no: 2,
        name: "next_page_token",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      }
    ]);
  }
}
const ListDynamicFieldsResponse = new ListDynamicFieldsResponse$Type();
class DynamicField$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.DynamicField", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.DynamicField.DynamicFieldKind", DynamicField_DynamicFieldKind]
      },
      {
        no: 2,
        name: "parent",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "field_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 4, name: "field_object", kind: "message", T: () => import_object.Object },
      { no: 5, name: "name", kind: "message", T: () => import_bcs.Bcs },
      { no: 6, name: "value", kind: "message", T: () => import_bcs.Bcs },
      {
        no: 7,
        name: "value_type",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 8,
        name: "child_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 9, name: "child_object", kind: "message", T: () => import_object.Object }
    ]);
  }
}
const DynamicField = new DynamicField$Type();
class ListOwnedObjectsRequest$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ListOwnedObjectsRequest", [
      {
        no: 1,
        name: "owner",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "page_size",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      },
      {
        no: 3,
        name: "page_token",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      },
      { no: 4, name: "read_mask", kind: "message", T: () => import_field_mask.FieldMask },
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
const ListOwnedObjectsRequest = new ListOwnedObjectsRequest$Type();
class ListOwnedObjectsResponse$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ListOwnedObjectsResponse", [
      { no: 1, name: "objects", kind: "message", repeat: 1, T: () => import_object.Object },
      {
        no: 2,
        name: "next_page_token",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      }
    ]);
  }
}
const ListOwnedObjectsResponse = new ListOwnedObjectsResponse$Type();
const StateService = new import_runtime_rpc.ServiceType("sui.rpc.v2.StateService", [
  {
    name: "ListDynamicFields",
    options: {},
    I: ListDynamicFieldsRequest,
    O: ListDynamicFieldsResponse
  },
  {
    name: "ListOwnedObjects",
    options: {},
    I: ListOwnedObjectsRequest,
    O: ListOwnedObjectsResponse
  },
  { name: "GetCoinInfo", options: {}, I: GetCoinInfoRequest, O: GetCoinInfoResponse },
  { name: "GetBalance", options: {}, I: GetBalanceRequest, O: GetBalanceResponse },
  { name: "ListBalances", options: {}, I: ListBalancesRequest, O: ListBalancesResponse }
]);
//# sourceMappingURL=state_service.js.map
