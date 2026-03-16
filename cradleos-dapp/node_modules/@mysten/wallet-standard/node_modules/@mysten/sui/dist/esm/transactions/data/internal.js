import {
  array,
  boolean,
  check,
  integer,
  lazy,
  literal,
  nullable,
  nullish,
  number,
  object,
  optional,
  pipe,
  record,
  string,
  transform,
  tuple,
  union,
  unknown
} from "valibot";
import { isValidSuiAddress, normalizeSuiAddress } from "../../utils/sui-types.js";
function safeEnum(options) {
  const unionOptions = Object.entries(options).map(([key, value]) => object({ [key]: value }));
  return pipe(
    union(unionOptions),
    transform(
      (value) => ({
        ...value,
        $kind: Object.keys(value)[0]
      })
    )
  );
}
const SuiAddress = pipe(
  string(),
  transform((value) => normalizeSuiAddress(value)),
  check(isValidSuiAddress)
);
const ObjectID = SuiAddress;
const BCSBytes = string();
const JsonU64 = pipe(
  union([string(), pipe(number(), integer())]),
  check((val) => {
    try {
      BigInt(val);
      return BigInt(val) >= 0 && BigInt(val) <= 18446744073709551615n;
    } catch {
      return false;
    }
  }, "Invalid u64")
);
const ObjectRefSchema = object({
  objectId: SuiAddress,
  version: JsonU64,
  digest: string()
});
const ArgumentSchema = pipe(
  union([
    object({ GasCoin: literal(true) }),
    object({ Input: pipe(number(), integer()), type: optional(literal("pure")) }),
    object({ Input: pipe(number(), integer()), type: optional(literal("object")) }),
    object({ Result: pipe(number(), integer()) }),
    object({ NestedResult: tuple([pipe(number(), integer()), pipe(number(), integer())]) })
  ]),
  transform((value) => ({
    ...value,
    $kind: Object.keys(value)[0]
  }))
  // Defined manually to add `type?: 'pure' | 'object'` to Input
);
const GasDataSchema = object({
  budget: nullable(JsonU64),
  price: nullable(JsonU64),
  owner: nullable(SuiAddress),
  payment: nullable(array(ObjectRefSchema))
});
const StructTagSchema = object({
  address: string(),
  module: string(),
  name: string(),
  // type_params in rust, should be updated to use camelCase
  typeParams: array(string())
});
const OpenMoveTypeSignatureBodySchema = union([
  literal("address"),
  literal("bool"),
  literal("u8"),
  literal("u16"),
  literal("u32"),
  literal("u64"),
  literal("u128"),
  literal("u256"),
  object({ vector: lazy(() => OpenMoveTypeSignatureBodySchema) }),
  object({
    datatype: object({
      package: string(),
      module: string(),
      type: string(),
      typeParameters: array(lazy(() => OpenMoveTypeSignatureBodySchema))
    })
  }),
  object({ typeParameter: pipe(number(), integer()) })
]);
const OpenMoveTypeSignatureSchema = object({
  ref: nullable(union([literal("&"), literal("&mut")])),
  body: OpenMoveTypeSignatureBodySchema
});
const ProgrammableMoveCallSchema = object({
  package: ObjectID,
  module: string(),
  function: string(),
  // snake case in rust
  typeArguments: array(string()),
  arguments: array(ArgumentSchema),
  _argumentTypes: optional(nullable(array(OpenMoveTypeSignatureSchema)))
});
const $Intent = object({
  name: string(),
  inputs: record(string(), union([ArgumentSchema, array(ArgumentSchema)])),
  data: record(string(), unknown())
});
const CommandSchema = safeEnum({
  MoveCall: ProgrammableMoveCallSchema,
  TransferObjects: object({
    objects: array(ArgumentSchema),
    address: ArgumentSchema
  }),
  SplitCoins: object({
    coin: ArgumentSchema,
    amounts: array(ArgumentSchema)
  }),
  MergeCoins: object({
    destination: ArgumentSchema,
    sources: array(ArgumentSchema)
  }),
  Publish: object({
    modules: array(BCSBytes),
    dependencies: array(ObjectID)
  }),
  MakeMoveVec: object({
    type: nullable(string()),
    elements: array(ArgumentSchema)
  }),
  Upgrade: object({
    modules: array(BCSBytes),
    dependencies: array(ObjectID),
    package: ObjectID,
    ticket: ArgumentSchema
  }),
  $Intent
});
const ObjectArgSchema = safeEnum({
  ImmOrOwnedObject: ObjectRefSchema,
  SharedObject: object({
    objectId: ObjectID,
    // snake case in rust
    initialSharedVersion: JsonU64,
    mutable: boolean()
  }),
  Receiving: ObjectRefSchema
});
const CallArgSchema = safeEnum({
  Object: ObjectArgSchema,
  Pure: object({
    bytes: BCSBytes
  }),
  UnresolvedPure: object({
    value: unknown()
  }),
  UnresolvedObject: object({
    objectId: ObjectID,
    version: optional(nullable(JsonU64)),
    digest: optional(nullable(string())),
    initialSharedVersion: optional(nullable(JsonU64)),
    mutable: optional(nullable(boolean()))
  })
});
const NormalizedCallArg = safeEnum({
  Object: ObjectArgSchema,
  Pure: object({
    bytes: BCSBytes
  })
});
const TransactionExpiration = safeEnum({
  None: literal(true),
  Epoch: JsonU64
});
const TransactionDataSchema = object({
  version: literal(2),
  sender: nullish(SuiAddress),
  expiration: nullish(TransactionExpiration),
  gasData: GasDataSchema,
  inputs: array(CallArgSchema),
  commands: array(CommandSchema)
});
export {
  $Intent,
  ArgumentSchema,
  BCSBytes,
  CommandSchema,
  GasDataSchema,
  JsonU64,
  NormalizedCallArg,
  ObjectArgSchema,
  ObjectID,
  ObjectRefSchema,
  OpenMoveTypeSignatureBodySchema,
  OpenMoveTypeSignatureSchema,
  StructTagSchema,
  SuiAddress,
  TransactionDataSchema,
  TransactionExpiration,
  safeEnum
};
//# sourceMappingURL=internal.js.map
