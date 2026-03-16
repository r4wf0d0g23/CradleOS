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
var timestamp_exports = {};
__export(timestamp_exports, {
  Timestamp: () => Timestamp
});
module.exports = __toCommonJS(timestamp_exports);
var import_runtime = require("@protobuf-ts/runtime");
var import_runtime2 = require("@protobuf-ts/runtime");
var import_runtime3 = require("@protobuf-ts/runtime");
class Timestamp$Type extends import_runtime3.MessageType {
  constructor() {
    super("google.protobuf.Timestamp", [
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
   * Creates a new `Timestamp` for the current time.
   */
  now() {
    const msg = this.create();
    const ms = Date.now();
    msg.seconds = import_runtime2.PbLong.from(Math.floor(ms / 1e3)).toBigInt();
    msg.nanos = ms % 1e3 * 1e6;
    return msg;
  }
  /**
   * Converts a `Timestamp` to a JavaScript Date.
   */
  toDate(message) {
    return new Date(
      import_runtime2.PbLong.from(message.seconds).toNumber() * 1e3 + Math.ceil(message.nanos / 1e6)
    );
  }
  /**
   * Converts a JavaScript Date to a `Timestamp`.
   */
  fromDate(date) {
    const msg = this.create();
    const ms = date.getTime();
    msg.seconds = import_runtime2.PbLong.from(Math.floor(ms / 1e3)).toBigInt();
    msg.nanos = (ms % 1e3 + (ms < 0 && ms % 1e3 !== 0 ? 1e3 : 0)) * 1e6;
    return msg;
  }
  /**
   * In JSON format, the `Timestamp` type is encoded as a string
   * in the RFC 3339 format.
   */
  internalJsonWrite(message, options) {
    let ms = import_runtime2.PbLong.from(message.seconds).toNumber() * 1e3;
    if (ms < Date.parse("0001-01-01T00:00:00Z") || ms > Date.parse("9999-12-31T23:59:59Z"))
      throw new Error(
        "Unable to encode Timestamp to JSON. Must be from 0001-01-01T00:00:00Z to 9999-12-31T23:59:59Z inclusive."
      );
    if (message.nanos < 0)
      throw new Error("Unable to encode invalid Timestamp to JSON. Nanos must not be negative.");
    let z = "Z";
    if (message.nanos > 0) {
      let nanosStr = (message.nanos + 1e9).toString().substring(1);
      if (nanosStr.substring(3) === "000000") z = "." + nanosStr.substring(0, 3) + "Z";
      else if (nanosStr.substring(6) === "000") z = "." + nanosStr.substring(0, 6) + "Z";
      else z = "." + nanosStr + "Z";
    }
    return new Date(ms).toISOString().replace(".000Z", z);
  }
  /**
   * In JSON format, the `Timestamp` type is encoded as a string
   * in the RFC 3339 format.
   */
  internalJsonRead(json, options, target) {
    if (typeof json !== "string")
      throw new Error("Unable to parse Timestamp from JSON " + (0, import_runtime.typeofJsonValue)(json) + ".");
    let matches = json.match(
      /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:Z|\.([0-9]{3,9})Z|([+-][0-9][0-9]:[0-9][0-9]))$/
    );
    if (!matches) throw new Error("Unable to parse Timestamp from JSON. Invalid format.");
    let ms = Date.parse(
      matches[1] + "-" + matches[2] + "-" + matches[3] + "T" + matches[4] + ":" + matches[5] + ":" + matches[6] + (matches[8] ? matches[8] : "Z")
    );
    if (Number.isNaN(ms)) throw new Error("Unable to parse Timestamp from JSON. Invalid value.");
    if (ms < Date.parse("0001-01-01T00:00:00Z") || ms > Date.parse("9999-12-31T23:59:59Z"))
      throw new globalThis.Error(
        "Unable to parse Timestamp from JSON. Must be from 0001-01-01T00:00:00Z to 9999-12-31T23:59:59Z inclusive."
      );
    if (!target) target = this.create();
    target.seconds = import_runtime2.PbLong.from(ms / 1e3).toBigInt();
    target.nanos = 0;
    if (matches[7])
      target.nanos = parseInt("1" + matches[7] + "0".repeat(9 - matches[7].length)) - 1e9;
    return target;
  }
}
const Timestamp = new Timestamp$Type();
//# sourceMappingURL=timestamp.js.map
