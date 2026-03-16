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
var object_exports = {};
__export(object_exports, {
  createObjectMethods: () => createObjectMethods
});
module.exports = __toCommonJS(object_exports);
var import_Inputs = require("./Inputs.js");
function createObjectMethods(makeObject) {
  function object(value) {
    return makeObject(value);
  }
  object.system = (options) => {
    const mutable = options?.mutable;
    if (mutable !== void 0) {
      return object(
        import_Inputs.Inputs.SharedObjectRef({
          objectId: "0x5",
          initialSharedVersion: 1,
          mutable
        })
      );
    }
    return object({
      $kind: "UnresolvedObject",
      UnresolvedObject: {
        objectId: "0x5",
        initialSharedVersion: 1
      }
    });
  };
  object.clock = () => object(
    import_Inputs.Inputs.SharedObjectRef({
      objectId: "0x6",
      initialSharedVersion: 1,
      mutable: false
    })
  );
  object.random = () => object({
    $kind: "UnresolvedObject",
    UnresolvedObject: {
      objectId: "0x8",
      mutable: false
    }
  });
  object.denyList = (options) => {
    return object({
      $kind: "UnresolvedObject",
      UnresolvedObject: {
        objectId: "0x403",
        mutable: options?.mutable
      }
    });
  };
  object.option = ({ type, value }) => (tx) => tx.moveCall({
    typeArguments: [type],
    target: `0x1::option::${value === null ? "none" : "some"}`,
    arguments: value === null ? [] : [tx.object(value)]
  });
  return object;
}
//# sourceMappingURL=object.js.map
