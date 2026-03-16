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
var field_mask_exports = {};
__export(field_mask_exports, {
  FieldMask: () => FieldMask
});
module.exports = __toCommonJS(field_mask_exports);
var import_runtime = require("@protobuf-ts/runtime");
var import_runtime2 = require("@protobuf-ts/runtime");
var import_runtime3 = require("@protobuf-ts/runtime");
class FieldMask$Type extends import_runtime3.MessageType {
  constructor() {
    super("google.protobuf.FieldMask", [
      {
        no: 1,
        name: "paths",
        kind: "scalar",
        repeat: 2,
        T: 9
      }
    ]);
  }
  /**
   * Encode `FieldMask` to JSON object.
   */
  internalJsonWrite(message, options) {
    const invalidFieldMaskJsonRegex = /[A-Z]|(_([.0-9_]|$))/g;
    return message.paths.map((p) => {
      if (invalidFieldMaskJsonRegex.test(p))
        throw new Error(
          'Unable to encode FieldMask to JSON. lowerCamelCase of path name "' + p + '" is irreversible.'
        );
      return (0, import_runtime2.lowerCamelCase)(p);
    }).join(",");
  }
  /**
   * Decode `FieldMask` from JSON object.
   */
  internalJsonRead(json, options, target) {
    if (typeof json !== "string")
      throw new Error(
        "Unable to parse FieldMask from JSON " + (0, import_runtime.typeofJsonValue)(json) + ". Expected string."
      );
    if (!target) target = this.create();
    if (json === "") return target;
    let camelToSnake = (str) => {
      if (str.includes("_"))
        throw new Error("Unable to parse FieldMask from JSON. Path names must be lowerCamelCase.");
      let sc = str.replace(/[A-Z]/g, (letter) => "_" + letter.toLowerCase());
      return sc;
    };
    target.paths = json.split(",").map(camelToSnake);
    return target;
  }
}
const FieldMask = new FieldMask$Type();
//# sourceMappingURL=field_mask.js.map
