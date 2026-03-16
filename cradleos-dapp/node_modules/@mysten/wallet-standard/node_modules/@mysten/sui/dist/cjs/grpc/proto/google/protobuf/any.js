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
var any_exports = {};
__export(any_exports, {
  Any: () => Any
});
module.exports = __toCommonJS(any_exports);
var import_runtime = require("@protobuf-ts/runtime");
var import_runtime2 = require("@protobuf-ts/runtime");
var import_runtime3 = require("@protobuf-ts/runtime");
var import_runtime4 = require("@protobuf-ts/runtime");
class Any$Type extends import_runtime4.MessageType {
  constructor() {
    super("google.protobuf.Any", [
      {
        no: 1,
        name: "type_url",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "value",
        kind: "scalar",
        T: 12
        /*ScalarType.BYTES*/
      }
    ]);
  }
  /**
   * Pack the message into a new `Any`.
   *
   * Uses 'type.googleapis.com/full.type.name' as the type URL.
   */
  pack(message, type) {
    return {
      typeUrl: this.typeNameToUrl(type.typeName),
      value: type.toBinary(message)
    };
  }
  /**
   * Unpack the message from the `Any`.
   */
  unpack(any, type, options) {
    if (!this.contains(any, type))
      throw new Error(
        "Cannot unpack google.protobuf.Any with typeUrl '" + any.typeUrl + "' as " + type.typeName + "."
      );
    return type.fromBinary(any.value, options);
  }
  /**
   * Does the given `Any` contain a packed message of the given type?
   */
  contains(any, type) {
    if (!any.typeUrl.length) return false;
    let wants = typeof type == "string" ? type : type.typeName;
    let has = this.typeUrlToName(any.typeUrl);
    return wants === has;
  }
  /**
   * Convert the message to canonical JSON value.
   *
   * You have to provide the `typeRegistry` option so that the
   * packed message can be converted to JSON.
   *
   * The `typeRegistry` option is also required to read
   * `google.protobuf.Any` from JSON format.
   */
  internalJsonWrite(any, options) {
    if (any.typeUrl === "") return {};
    let typeName = this.typeUrlToName(any.typeUrl);
    let opt = (0, import_runtime3.jsonWriteOptions)(options);
    let type = opt.typeRegistry?.find((t) => t.typeName === typeName);
    if (!type)
      throw new globalThis.Error(
        "Unable to convert google.protobuf.Any with typeUrl '" + any.typeUrl + "' to JSON. The specified type " + typeName + " is not available in the type registry."
      );
    let value = type.fromBinary(any.value, { readUnknownField: false });
    let json = type.internalJsonWrite(value, opt);
    if (typeName.startsWith("google.protobuf.") || !(0, import_runtime.isJsonObject)(json)) json = { value: json };
    json["@type"] = any.typeUrl;
    return json;
  }
  internalJsonRead(json, options, target) {
    if (!(0, import_runtime.isJsonObject)(json))
      throw new globalThis.Error(
        "Unable to parse google.protobuf.Any from JSON " + (0, import_runtime2.typeofJsonValue)(json) + "."
      );
    if (typeof json["@type"] != "string" || json["@type"] == "") return this.create();
    let typeName = this.typeUrlToName(json["@type"]);
    let type = options?.typeRegistry?.find((t) => t.typeName == typeName);
    if (!type)
      throw new globalThis.Error(
        "Unable to parse google.protobuf.Any from JSON. The specified type " + typeName + " is not available in the type registry."
      );
    let value;
    if (typeName.startsWith("google.protobuf.") && json.hasOwnProperty("value"))
      value = type.fromJson(json["value"], options);
    else {
      let copy = Object.assign({}, json);
      delete copy["@type"];
      value = type.fromJson(copy, options);
    }
    if (target === void 0) target = this.create();
    target.typeUrl = json["@type"];
    target.value = type.toBinary(value);
    return target;
  }
  typeNameToUrl(name) {
    if (!name.length) throw new Error("invalid type name: " + name);
    return "type.googleapis.com/" + name;
  }
  typeUrlToName(url) {
    if (!url.length) throw new Error("invalid type url: " + url);
    let slash = url.lastIndexOf("/");
    let name = slash > 0 ? url.substring(slash + 1) : url;
    if (!name.length) throw new Error("invalid type url: " + url);
    return name;
  }
}
const Any = new Any$Type();
//# sourceMappingURL=any.js.map
