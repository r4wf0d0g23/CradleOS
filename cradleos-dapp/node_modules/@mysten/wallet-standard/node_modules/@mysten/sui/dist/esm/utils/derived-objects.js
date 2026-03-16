import { TypeTagSerializer } from "../bcs/type-tag-serializer.js";
import { deriveDynamicFieldID } from "./dynamic-fields.js";
function deriveObjectID(parentId, typeTag, key) {
  const typeTagStr = typeof typeTag === "string" ? typeTag : TypeTagSerializer.tagToString(typeTag);
  return deriveDynamicFieldID(
    parentId,
    `0x2::derived_object::DerivedObjectKey<${typeTagStr}>`,
    key
  );
}
export {
  deriveObjectID
};
//# sourceMappingURL=derived-objects.js.map
