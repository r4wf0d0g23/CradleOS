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
var derived_objects_exports = {};
__export(derived_objects_exports, {
  deriveObjectID: () => deriveObjectID
});
module.exports = __toCommonJS(derived_objects_exports);
var import_type_tag_serializer = require("../bcs/type-tag-serializer.js");
var import_dynamic_fields = require("./dynamic-fields.js");
function deriveObjectID(parentId, typeTag, key) {
  const typeTagStr = typeof typeTag === "string" ? typeTag : import_type_tag_serializer.TypeTagSerializer.tagToString(typeTag);
  return (0, import_dynamic_fields.deriveDynamicFieldID)(
    parentId,
    `0x2::derived_object::DerivedObjectKey<${typeTagStr}>`,
    key
  );
}
//# sourceMappingURL=derived-objects.js.map
