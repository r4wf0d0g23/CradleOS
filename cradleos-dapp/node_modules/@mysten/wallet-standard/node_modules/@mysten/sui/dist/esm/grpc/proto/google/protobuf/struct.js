import { isJsonObject } from "@protobuf-ts/runtime";
import { typeofJsonValue } from "@protobuf-ts/runtime";
import { MessageType } from "@protobuf-ts/runtime";
var NullValue = /* @__PURE__ */ ((NullValue2) => {
  NullValue2[NullValue2["NULL_VALUE"] = 0] = "NULL_VALUE";
  return NullValue2;
})(NullValue || {});
class Struct$Type extends MessageType {
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
    if (!isJsonObject(json))
      throw new globalThis.Error(
        "Unable to parse message " + this.typeName + " from JSON " + typeofJsonValue(json) + "."
      );
    if (!target) target = this.create();
    for (let [k, v] of globalThis.Object.entries(json)) {
      target.fields[k] = Value.fromJson(v);
    }
    return target;
  }
}
const Struct = new Struct$Type();
class Value$Type extends MessageType {
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
          "Unable to parse " + this.typeName + " from JSON " + typeofJsonValue(json)
        );
    }
    return target;
  }
}
const Value = new Value$Type();
class ListValue$Type extends MessageType {
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
        "Unable to parse " + this.typeName + " from JSON " + typeofJsonValue(json)
      );
    if (!target) target = this.create();
    let values = json.map((v) => Value.fromJson(v));
    target.values.push(...values);
    return target;
  }
}
const ListValue = new ListValue$Type();
export {
  ListValue,
  NullValue,
  Struct,
  Value
};
//# sourceMappingURL=struct.js.map
