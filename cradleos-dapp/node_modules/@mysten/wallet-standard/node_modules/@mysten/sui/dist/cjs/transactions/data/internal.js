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
var internal_exports = {};
__export(internal_exports, {
  $Intent: () => $Intent,
  ArgumentSchema: () => ArgumentSchema,
  BCSBytes: () => BCSBytes,
  CommandSchema: () => CommandSchema,
  GasDataSchema: () => GasDataSchema,
  JsonU64: () => JsonU64,
  NormalizedCallArg: () => NormalizedCallArg,
  ObjectArgSchema: () => ObjectArgSchema,
  ObjectID: () => ObjectID,
  ObjectRefSchema: () => ObjectRefSchema,
  OpenMoveTypeSignatureBodySchema: () => OpenMoveTypeSignatureBodySchema,
  OpenMoveTypeSignatureSchema: () => OpenMoveTypeSignatureSchema,
  StructTagSchema: () => StructTagSchema,
  SuiAddress: () => SuiAddress,
  TransactionDataSchema: () => TransactionDataSchema,
  TransactionExpiration: () => TransactionExpiration,
  safeEnum: () => safeEnum
});
module.exports = __toCommonJS(internal_exports);
var import_valibot = require("valibot");
var import_sui_types = require("../../utils/sui-types.js");
function safeEnum(options) {
  const unionOptions = Object.entries(options).map(([key, value]) => (0, import_valibot.object)({ [key]: value }));
  return (0, import_valibot.pipe)(
    (0, import_valibot.union)(unionOptions),
    (0, import_valibot.transform)(
      (value) => ({
        ...value,
        $kind: Object.keys(value)[0]
      })
    )
  );
}
const SuiAddress = (0, import_valibot.pipe)(
  (0, import_valibot.string)(),
  (0, import_valibot.transform)((value) => (0, import_sui_types.normalizeSuiAddress)(value)),
  (0, import_valibot.check)(import_sui_types.isValidSuiAddress)
);
const ObjectID = SuiAddress;
const BCSBytes = (0, import_valibot.string)();
const JsonU64 = (0, import_valibot.pipe)(
  (0, import_valibot.union)([(0, import_valibot.string)(), (0, import_valibot.pipe)((0, import_valibot.number)(), (0, import_valibot.integer)())]),
  (0, import_valibot.check)((val) => {
    try {
      BigInt(val);
      return BigInt(val) >= 0 && BigInt(val) <= 18446744073709551615n;
    } catch {
      return false;
    }
  }, "Invalid u64")
);
const ObjectRefSchema = (0, import_valibot.object)({
  objectId: SuiAddress,
  version: JsonU64,
  digest: (0, import_valibot.string)()
});
const ArgumentSchema = (0, import_valibot.pipe)(
  (0, import_valibot.union)([
    (0, import_valibot.object)({ GasCoin: (0, import_valibot.literal)(true) }),
    (0, import_valibot.object)({ Input: (0, import_valibot.pipe)((0, import_valibot.number)(), (0, import_valibot.integer)()), type: (0, import_valibot.optional)((0, import_valibot.literal)("pure")) }),
    (0, import_valibot.object)({ Input: (0, import_valibot.pipe)((0, import_valibot.number)(), (0, import_valibot.integer)()), type: (0, import_valibot.optional)((0, import_valibot.literal)("object")) }),
    (0, import_valibot.object)({ Result: (0, import_valibot.pipe)((0, import_valibot.number)(), (0, import_valibot.integer)()) }),
    (0, import_valibot.object)({ NestedResult: (0, import_valibot.tuple)([(0, import_valibot.pipe)((0, import_valibot.number)(), (0, import_valibot.integer)()), (0, import_valibot.pipe)((0, import_valibot.number)(), (0, import_valibot.integer)())]) })
  ]),
  (0, import_valibot.transform)((value) => ({
    ...value,
    $kind: Object.keys(value)[0]
  }))
  // Defined manually to add `type?: 'pure' | 'object'` to Input
);
const GasDataSchema = (0, import_valibot.object)({
  budget: (0, import_valibot.nullable)(JsonU64),
  price: (0, import_valibot.nullable)(JsonU64),
  owner: (0, import_valibot.nullable)(SuiAddress),
  payment: (0, import_valibot.nullable)((0, import_valibot.array)(ObjectRefSchema))
});
const StructTagSchema = (0, import_valibot.object)({
  address: (0, import_valibot.string)(),
  module: (0, import_valibot.string)(),
  name: (0, import_valibot.string)(),
  // type_params in rust, should be updated to use camelCase
  typeParams: (0, import_valibot.array)((0, import_valibot.string)())
});
const OpenMoveTypeSignatureBodySchema = (0, import_valibot.union)([
  (0, import_valibot.literal)("address"),
  (0, import_valibot.literal)("bool"),
  (0, import_valibot.literal)("u8"),
  (0, import_valibot.literal)("u16"),
  (0, import_valibot.literal)("u32"),
  (0, import_valibot.literal)("u64"),
  (0, import_valibot.literal)("u128"),
  (0, import_valibot.literal)("u256"),
  (0, import_valibot.object)({ vector: (0, import_valibot.lazy)(() => OpenMoveTypeSignatureBodySchema) }),
  (0, import_valibot.object)({
    datatype: (0, import_valibot.object)({
      package: (0, import_valibot.string)(),
      module: (0, import_valibot.string)(),
      type: (0, import_valibot.string)(),
      typeParameters: (0, import_valibot.array)((0, import_valibot.lazy)(() => OpenMoveTypeSignatureBodySchema))
    })
  }),
  (0, import_valibot.object)({ typeParameter: (0, import_valibot.pipe)((0, import_valibot.number)(), (0, import_valibot.integer)()) })
]);
const OpenMoveTypeSignatureSchema = (0, import_valibot.object)({
  ref: (0, import_valibot.nullable)((0, import_valibot.union)([(0, import_valibot.literal)("&"), (0, import_valibot.literal)("&mut")])),
  body: OpenMoveTypeSignatureBodySchema
});
const ProgrammableMoveCallSchema = (0, import_valibot.object)({
  package: ObjectID,
  module: (0, import_valibot.string)(),
  function: (0, import_valibot.string)(),
  // snake case in rust
  typeArguments: (0, import_valibot.array)((0, import_valibot.string)()),
  arguments: (0, import_valibot.array)(ArgumentSchema),
  _argumentTypes: (0, import_valibot.optional)((0, import_valibot.nullable)((0, import_valibot.array)(OpenMoveTypeSignatureSchema)))
});
const $Intent = (0, import_valibot.object)({
  name: (0, import_valibot.string)(),
  inputs: (0, import_valibot.record)((0, import_valibot.string)(), (0, import_valibot.union)([ArgumentSchema, (0, import_valibot.array)(ArgumentSchema)])),
  data: (0, import_valibot.record)((0, import_valibot.string)(), (0, import_valibot.unknown)())
});
const CommandSchema = safeEnum({
  MoveCall: ProgrammableMoveCallSchema,
  TransferObjects: (0, import_valibot.object)({
    objects: (0, import_valibot.array)(ArgumentSchema),
    address: ArgumentSchema
  }),
  SplitCoins: (0, import_valibot.object)({
    coin: ArgumentSchema,
    amounts: (0, import_valibot.array)(ArgumentSchema)
  }),
  MergeCoins: (0, import_valibot.object)({
    destination: ArgumentSchema,
    sources: (0, import_valibot.array)(ArgumentSchema)
  }),
  Publish: (0, import_valibot.object)({
    modules: (0, import_valibot.array)(BCSBytes),
    dependencies: (0, import_valibot.array)(ObjectID)
  }),
  MakeMoveVec: (0, import_valibot.object)({
    type: (0, import_valibot.nullable)((0, import_valibot.string)()),
    elements: (0, import_valibot.array)(ArgumentSchema)
  }),
  Upgrade: (0, import_valibot.object)({
    modules: (0, import_valibot.array)(BCSBytes),
    dependencies: (0, import_valibot.array)(ObjectID),
    package: ObjectID,
    ticket: ArgumentSchema
  }),
  $Intent
});
const ObjectArgSchema = safeEnum({
  ImmOrOwnedObject: ObjectRefSchema,
  SharedObject: (0, import_valibot.object)({
    objectId: ObjectID,
    // snake case in rust
    initialSharedVersion: JsonU64,
    mutable: (0, import_valibot.boolean)()
  }),
  Receiving: ObjectRefSchema
});
const CallArgSchema = safeEnum({
  Object: ObjectArgSchema,
  Pure: (0, import_valibot.object)({
    bytes: BCSBytes
  }),
  UnresolvedPure: (0, import_valibot.object)({
    value: (0, import_valibot.unknown)()
  }),
  UnresolvedObject: (0, import_valibot.object)({
    objectId: ObjectID,
    version: (0, import_valibot.optional)((0, import_valibot.nullable)(JsonU64)),
    digest: (0, import_valibot.optional)((0, import_valibot.nullable)((0, import_valibot.string)())),
    initialSharedVersion: (0, import_valibot.optional)((0, import_valibot.nullable)(JsonU64)),
    mutable: (0, import_valibot.optional)((0, import_valibot.nullable)((0, import_valibot.boolean)()))
  })
});
const NormalizedCallArg = safeEnum({
  Object: ObjectArgSchema,
  Pure: (0, import_valibot.object)({
    bytes: BCSBytes
  })
});
const TransactionExpiration = safeEnum({
  None: (0, import_valibot.literal)(true),
  Epoch: JsonU64
});
const TransactionDataSchema = (0, import_valibot.object)({
  version: (0, import_valibot.literal)(2),
  sender: (0, import_valibot.nullish)(SuiAddress),
  expiration: (0, import_valibot.nullish)(TransactionExpiration),
  gasData: GasDataSchema,
  inputs: (0, import_valibot.array)(CallArgSchema),
  commands: (0, import_valibot.array)(CommandSchema)
});
//# sourceMappingURL=internal.js.map
