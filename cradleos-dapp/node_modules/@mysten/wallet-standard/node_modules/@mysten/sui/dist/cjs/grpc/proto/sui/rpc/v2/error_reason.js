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
var error_reason_exports = {};
__export(error_reason_exports, {
  ErrorReason: () => ErrorReason
});
module.exports = __toCommonJS(error_reason_exports);
var ErrorReason = /* @__PURE__ */ ((ErrorReason2) => {
  ErrorReason2[ErrorReason2["ERROR_REASON_UNKNOWN"] = 0] = "ERROR_REASON_UNKNOWN";
  ErrorReason2[ErrorReason2["FIELD_INVALID"] = 1] = "FIELD_INVALID";
  ErrorReason2[ErrorReason2["FIELD_MISSING"] = 2] = "FIELD_MISSING";
  return ErrorReason2;
})(ErrorReason || {});
//# sourceMappingURL=error_reason.js.map
