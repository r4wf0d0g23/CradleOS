import { ServiceType } from "@protobuf-ts/runtime-rpc";
import { MessageType } from "@protobuf-ts/runtime";
import { FunctionDescriptor } from "./move_package.js";
import { DatatypeDescriptor } from "./move_package.js";
import { Package } from "./move_package.js";
class GetPackageRequest$Type extends MessageType {
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
class GetPackageResponse$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.GetPackageResponse", [
      { no: 1, name: "package", kind: "message", T: () => Package }
    ]);
  }
}
const GetPackageResponse = new GetPackageResponse$Type();
class GetDatatypeRequest$Type extends MessageType {
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
class GetDatatypeResponse$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.GetDatatypeResponse", [
      { no: 1, name: "datatype", kind: "message", T: () => DatatypeDescriptor }
    ]);
  }
}
const GetDatatypeResponse = new GetDatatypeResponse$Type();
class GetFunctionRequest$Type extends MessageType {
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
class GetFunctionResponse$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.GetFunctionResponse", [
      { no: 1, name: "function", kind: "message", T: () => FunctionDescriptor }
    ]);
  }
}
const GetFunctionResponse = new GetFunctionResponse$Type();
class ListPackageVersionsRequest$Type extends MessageType {
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
class ListPackageVersionsResponse$Type extends MessageType {
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
class PackageVersion$Type extends MessageType {
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
const MovePackageService = new ServiceType("sui.rpc.v2.MovePackageService", [
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
export {
  GetDatatypeRequest,
  GetDatatypeResponse,
  GetFunctionRequest,
  GetFunctionResponse,
  GetPackageRequest,
  GetPackageResponse,
  ListPackageVersionsRequest,
  ListPackageVersionsResponse,
  MovePackageService,
  PackageVersion
};
//# sourceMappingURL=move_package_service.js.map
