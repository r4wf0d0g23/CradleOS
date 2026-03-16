import { typeofJsonValue } from "@protobuf-ts/runtime";
import { lowerCamelCase } from "@protobuf-ts/runtime";
import { MessageType } from "@protobuf-ts/runtime";
class FieldMask$Type extends MessageType {
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
      return lowerCamelCase(p);
    }).join(",");
  }
  /**
   * Decode `FieldMask` from JSON object.
   */
  internalJsonRead(json, options, target) {
    if (typeof json !== "string")
      throw new Error(
        "Unable to parse FieldMask from JSON " + typeofJsonValue(json) + ". Expected string."
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
export {
  FieldMask
};
//# sourceMappingURL=field_mask.js.map
