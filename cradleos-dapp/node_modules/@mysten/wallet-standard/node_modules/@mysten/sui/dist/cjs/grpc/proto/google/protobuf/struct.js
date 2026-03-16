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
var struct_exports = {};
__export(struct_exports, {
  ListValue: () => ListValue,
  NullValue: () => NullValue,
  Struct: () => Struct,
  Value: () => Value
});
module.exports = __toCommonJS(struct_exports);
var import_runtime = require("@protobuf-ts/runtime");
var import_runtime2 = require("@protobuf-ts/runtime");
var import_runtime3 = require("@protobuf-ts/runtime");
var NullValue = /* @__PURE__ */ ((NullValue2) => {
  NullValue2[NullValue2["NULL_VALUE"] = 0] = "NULL_VALUE";
  return NullValue2;
})(NullValue || {});
class Struct$Type extends import_runtime3.MessageType {
  constructor() {
    super("google.protobuf.Struct", [
      {
        no: 1,
        name: "fields",
        kind: "map",
        K: 9,
        V: { kind: "message", T: () => Value }
      }
    ]);
  }
  /**
   * Encode `Struct` to JSON object.
   */
  internalJsonWrite(message, options) {
    let json = {};
    for (let [k, v] of Object.entries(message.fields)) {
      json[k] = Value.toJson(v);
    }
    return json;
  }
  /**
   * Decode `Struct` from JSON object.
   */
  internalJsonRead(json, options, target) {
    if (!(0, import_runtime.isJsonObject)(json))
      throw new globalThis.Error(
        "Unable to parse message " + this.typeName + " from JSON " + (0, import_runtime2.typeofJsonValue)(json) + "."
      );
    if (!target) target = this.create();
    for (let [k, v] of globalThis.Object.entries(json)) {
      target.fields[k] = Value.fromJson(v);
    }
    return target;
  }
}
const Struct = new Struct$Type();
class Value$Type extends import_runtime3.MessageType {
  constructor() {
    super("google.protobuf.Value", [
      {
        no: 1,
        name: "null_value",
        kind: "enum",
        oneof: "kind",
        T: () => ["google.protobuf.NullValue", NullValue]
      },
      {
        no: 2,
        name: "number_value",
        kind: "scalar",
        oneof: "kind",
        T: 1
        /*ScalarType.DOUBLE*/
      },
      {
        no: 3,
        name: "string_value",
        kind: "scalar",
        oneof: "kind",
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 4,
        name: "bool_value",
        kind: "scalar",
        oneof: "kind",
        T: 8
        /*ScalarType.BOOL*/
      },
      { no: 5, name: "struct_value", kind: "message", oneof: "kind", T: () => Struct },
      { no: 6, name: "list_value", kind: "message", oneof: "kind", T: () => ListValue }
    ]);
  }
  /**
   * Encode `Value` to JSON value.
   */
  internalJsonWrite(message, options) {
    if (message.kind.oneofKind === void 0) throw new globalThis.Error();
    switch (message.kind.oneofKind) {
      case void 0:
        throw new globalThis.Error();
      case "boolValue":
        return message.kind.boolValue;
      case "nullValue":
        return null;
      case "numberValue":
        let numberValue = message.kind.numberValue;
        if (typeof numberValue == "number" && !Number.isFinite(numberValue))
          throw new globalThis.Error();
        return numberValue;
      case "stringValue":
        return message.kind.stringValue;
      case "listValue":
        let listValueField = this.fields.find((f) => f.no === 6);
        if (listValueField?.kind !== "message") throw new globalThis.Error();
        return listValueField.T().toJson(message.kind.listValue);
      case "structValue":
        let structValueField = this.fields.find((f) => f.no === 5);
        if (structValueField?.kind !== "message") throw new globalThis.Error();
        return structValueField.T().toJson(message.kind.structValue);
    }
  }
  /**
   * Decode `Value` from JSON value.
   */
  internalJsonRead(json, options, target) {
    if (!target) target = this.create();
    switch (typeof json) {
      case "number":
        target.kind = { oneofKind: "numberValue", numberValue: json };
        break;
      case "string":
        target.kind = { oneofKind: "stringValue", stringValue: json };
        break;
      case "boolean":
        target.kind = { oneofKind: "boolValue", boolValue: json };
        break;
      case "object":
        if (json === null) {
          target.kind = { oneofKind: "nullValue", nullValue: 0 /* NULL_VALUE */ };
        } else if (globalThis.Array.isArray(json)) {
          target.kind = { oneofKind: "listValue", listValue: ListValue.fromJson(json) };
        } else {
          target.kind = { oneofKind: "structValue", structValue: Struct.fromJson(json) };
        }
        break;
      default:
        throw new globalThis.Error(
          "Unable to parse " + this.typeName + " from JSON " + (0, import_runtime2.typeofJsonValue)(json)
        );
    }
    return target;
  }
}
const Value = new Value$Type();
class ListValue$Type extends import_runtime3.MessageType {
  constructor() {
    super("google.protobuf.ListValue", [
      { no: 1, name: "values", kind: "message", repeat: 1, T: () => Value }
    ]);
  }
  /**
   * Encode `ListValue` to JSON array.
   */
  internalJsonWrite(message, options) {
    return message.values.map((v) => Value.toJson(v));
  }
  /**
   * Decode `ListValue` from JSON array.
   */
  internalJsonRead(json, options, target) {
    if (!globalThis.Array.isArray(json))
      throw new globalThis.Error(
        "Unable to parse " + this.typeName + " from JSON " + (0, import_runtime2.typeofJsonValue)(json)
      );
    if (!target) target = this.create();
    let values = json.map((v) => Value.fromJson(v));
    target.values.push(...values);
    return target;
  }
}
const ListValue = new ListValue$Type();
//# sourceMappingURL=struct.js.map
