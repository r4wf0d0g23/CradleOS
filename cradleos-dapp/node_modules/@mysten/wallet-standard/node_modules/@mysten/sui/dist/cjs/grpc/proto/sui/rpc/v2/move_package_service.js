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
var move_package_service_exports = {};
__export(move_package_service_exports, {
  GetDatatypeRequest: () => GetDatatypeRequest,
  GetDatatypeResponse: () => GetDatatypeResponse,
  GetFunctionRequest: () => GetFunctionRequest,
  GetFunctionResponse: () => GetFunctionResponse,
  GetPackageRequest: () => GetPackageRequest,
  GetPackageResponse: () => GetPackageResponse,
  ListPackageVersionsRequest: () => ListPackageVersionsRequest,
  ListPackageVersionsResponse: () => ListPackageVersionsResponse,
  MovePackageService: () => MovePackageService,
  PackageVersion: () => PackageVersion
});
module.exports = __toCommonJS(move_package_service_exports);
var import_runtime_rpc = require("@protobuf-ts/runtime-rpc");
var import_runtime = require("@protobuf-ts/runtime");
var import_move_package = require("./move_package.js");
var import_move_package2 = require("./move_package.js");
var import_move_package3 = require("./move_package.js");
class GetPackageRequest$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.GetPackageRequest", [
      {
        no: 1,
        name: "package_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const GetPackageRequest = new GetPackageRequest$Type();
class GetPackageResponse$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.GetPackageResponse", [
      { no: 1, name: "package", kind: "message", T: () => import_move_package3.Package }
    ]);
  }
}
const GetPackageResponse = new GetPackageResponse$Type();
class GetDatatypeRequest$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.GetDatatypeRequest", [
      {
        no: 1,
        name: "package_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "module_name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const GetDatatypeRequest = new GetDatatypeRequest$Type();
class GetDatatypeResponse$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.GetDatatypeResponse", [
      { no: 1, name: "datatype", kind: "message", T: () => import_move_package2.DatatypeDescriptor }
    ]);
  }
}
const GetDatatypeResponse = new GetDatatypeResponse$Type();
class GetFunctionRequest$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.GetFunctionRequest", [
      {
        no: 1,
        name: "package_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "module_name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const GetFunctionRequest = new GetFunctionRequest$Type();
class GetFunctionResponse$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.GetFunctionResponse", [
      { no: 1, name: "function", kind: "message", T: () => import_move_package.FunctionDescriptor }
    ]);
  }
}
const GetFunctionResponse = new GetFunctionResponse$Type();
class ListPackageVersionsRequest$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ListPackageVersionsRequest", [
      {
        no: 1,
        name: "package_id",
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
const ListPackageVersionsRequest = new ListPackageVersionsRequest$Type();
class ListPackageVersionsResponse$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ListPackageVersionsResponse", [
      {
        no: 1,
        name: "versions",
        kind: "message",
        repeat: 1,
        T: () => PackageVersion
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
const ListPackageVersionsResponse = new ListPackageVersionsResponse$Type();
class PackageVersion$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.PackageVersion", [
      {
        no: 1,
        name: "package_id",
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
      }
    ]);
  }
}
const PackageVersion = new PackageVersion$Type();
const MovePackageService = new import_runtime_rpc.ServiceType("sui.rpc.v2.MovePackageService", [
  { name: "GetPackage", options: {}, I: GetPackageRequest, O: GetPackageResponse },
  { name: "GetDatatype", options: {}, I: GetDatatypeRequest, O: GetDatatypeResponse },
  { name: "GetFunction", options: {}, I: GetFunctionRequest, O: GetFunctionResponse },
  {
    name: "ListPackageVersions",
    options: {},
    I: ListPackageVersionsRequest,
    O: ListPackageVersionsResponse
  }
]);
//# sourceMappingURL=move_package_service.js.map
