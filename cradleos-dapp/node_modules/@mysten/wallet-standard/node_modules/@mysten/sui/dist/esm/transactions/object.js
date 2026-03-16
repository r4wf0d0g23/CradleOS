import { Inputs } from "./Inputs.js";
function createObjectMethods(makeObject) {
  function object(value) {
    return makeObject(value);
  }
  object.system = (options) => {
    const mutable = options?.mutable;
    if (mutable !== void 0) {
      return object(
        Inputs.SharedObjectRef({
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
    Inputs.SharedObjectRef({
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
export {
  createObjectMethods
};
//# sourceMappingURL=object.js.map
