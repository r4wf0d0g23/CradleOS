import { ServiceType } from "@protobuf-ts/runtime-rpc";
import { MessageType } from "@protobuf-ts/runtime";
import { Bcs } from "./bcs.js";
import { Object } from "./object.js";
import { FieldMask } from "../../../google/protobuf/field_mask.js";
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
class GetCoinInfoRequest$Type extends MessageType {
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
class GetCoinInfoResponse$Type extends MessageType {
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
class CoinMetadata$Type extends MessageType {
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
class CoinTreasury$Type extends MessageType {
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
class RegulatedCoinMetadata$Type extends MessageType {
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
class GetBalanceRequest$Type extends MessageType {
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
class GetBalanceResponse$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.GetBalanceResponse", [
      { no: 1, name: "balance", kind: "message", T: () => Balance }
    ]);
  }
}
const GetBalanceResponse = new GetBalanceResponse$Type();
class ListBalancesRequest$Type extends MessageType {
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
class ListBalancesResponse$Type extends MessageType {
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
class Balance$Type extends MessageType {
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
class ListDynamicFieldsRequest$Type extends MessageType {
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
      { no: 4, name: "read_mask", kind: "message", T: () => FieldMask }
    ]);
  }
}
const ListDynamicFieldsRequest = new ListDynamicFieldsRequest$Type();
class ListDynamicFieldsResponse$Type extends MessageType {
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
class DynamicField$Type extends MessageType {
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
      { no: 4, name: "field_object", kind: "message", T: () => Object },
      { no: 5, name: "name", kind: "message", T: () => Bcs },
      { no: 6, name: "value", kind: "message", T: () => Bcs },
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
      { no: 9, name: "child_object", kind: "message", T: () => Object }
    ]);
  }
}
const DynamicField = new DynamicField$Type();
class ListOwnedObjectsRequest$Type extends MessageType {
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
      { no: 4, name: "read_mask", kind: "message", T: () => FieldMask },
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
class ListOwnedObjectsResponse$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.ListOwnedObjectsResponse", [
      { no: 1, name: "objects", kind: "message", repeat: 1, T: () => Object },
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
const StateService = new ServiceType("sui.rpc.v2.StateService", [
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
export {
  Balance,
  CoinMetadata,
  CoinMetadata_MetadataCapState,
  CoinTreasury,
  CoinTreasury_SupplyState,
  DynamicField,
  DynamicField_DynamicFieldKind,
  GetBalanceRequest,
  GetBalanceResponse,
  GetCoinInfoRequest,
  GetCoinInfoResponse,
  ListBalancesRequest,
  ListBalancesResponse,
  ListDynamicFieldsRequest,
  ListDynamicFieldsResponse,
  ListOwnedObjectsRequest,
  ListOwnedObjectsResponse,
  RegulatedCoinMetadata,
  RegulatedCoinMetadata_CoinRegulatedState,
  StateService
};
//# sourceMappingURL=state_service.js.map
