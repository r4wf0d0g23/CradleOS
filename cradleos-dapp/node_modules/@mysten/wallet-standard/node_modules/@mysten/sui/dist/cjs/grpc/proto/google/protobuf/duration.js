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
var duration_exports = {};
__export(duration_exports, {
  Duration: () => Duration
});
module.exports = __toCommonJS(duration_exports);
var import_runtime = require("@protobuf-ts/runtime");
var import_runtime2 = require("@protobuf-ts/runtime");
var import_runtime3 = require("@protobuf-ts/runtime");
class Duration$Type extends import_runtime3.MessageType {
  constructor() {
    super("google.protobuf.Duration", [
      {
        no: 1,
        name: "seconds",
        kind: "scalar",
        T: 3,
        L: 0
      },
      {
        no: 2,
        name: "nanos",
        kind: "scalar",
        T: 5
        /*ScalarType.INT32*/
      }
    ]);
  }
  /**
   * Encode `Duration` to JSON string like "3.000001s".
   */
  internalJsonWrite(message, options) {
    let s = import_runtime2.PbLong.from(message.seconds).toNumber();
    if (s > 315576e6 || s < -315576e6) throw new Error("Duration value out of range.");
    let text = message.seconds.toString();
    if (s === 0 && message.nanos < 0) text = "-" + text;
    if (message.nanos !== 0) {
      let nanosStr = Math.abs(message.nanos).toString();
      nanosStr = "0".repeat(9 - nanosStr.length) + nanosStr;
      if (nanosStr.substring(3) === "000000") nanosStr = nanosStr.substring(0, 3);
      else if (nanosStr.substring(6) === "000") nanosStr = nanosStr.substring(0, 6);
      text += "." + nanosStr;
    }
    return text + "s";
  }
  /**
   * Decode `Duration` from JSON string like "3.000001s"
   */
  internalJsonRead(json, options, target) {
    if (typeof json !== "string")
      throw new Error(
        "Unable to parse Duration from JSON " + (0, import_runtime.typeofJsonValue)(json) + ". Expected string."
      );
    let match = json.match(/^(-?)([0-9]+)(?:\.([0-9]+))?s/);
    if (match === null)
      throw new Error("Unable to parse Duration from JSON string. Invalid format.");
    if (!target) target = this.create();
    let [, sign, secs, nanos] = match;
    let longSeconds = import_runtime2.PbLong.from(sign + secs);
    if (longSeconds.toNumber() > 315576e6 || longSeconds.toNumber() < -315576e6)
      throw new Error("Unable to parse Duration from JSON string. Value out of range.");
    target.seconds = longSeconds.toBigInt();
    if (typeof nanos == "string") {
      let nanosStr = sign + nanos + "0".repeat(9 - nanos.length);
      target.nanos = parseInt(nanosStr);
    }
    return target;
  }
}
const Duration = new Duration$Type();
//# sourceMappingURL=duration.js.map
