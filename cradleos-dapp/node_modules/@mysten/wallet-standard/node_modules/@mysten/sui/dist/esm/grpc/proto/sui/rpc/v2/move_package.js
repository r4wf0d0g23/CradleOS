import { MessageType } from "@protobuf-ts/runtime";
var DatatypeDescriptor_DatatypeKind = /* @__PURE__ */ ((DatatypeDescriptor_DatatypeKind2) => {
  DatatypeDescriptor_DatatypeKind2[DatatypeDescriptor_DatatypeKind2["DATATYPE_KIND_UNKNOWN"] = 0] = "DATATYPE_KIND_UNKNOWN";
  DatatypeDescriptor_DatatypeKind2[DatatypeDescriptor_DatatypeKind2["STRUCT"] = 1] = "STRUCT";
  DatatypeDescriptor_DatatypeKind2[DatatypeDescriptor_DatatypeKind2["ENUM"] = 2] = "ENUM";
  return DatatypeDescriptor_DatatypeKind2;
})(DatatypeDescriptor_DatatypeKind || {});
var OpenSignatureBody_Type = /* @__PURE__ */ ((OpenSignatureBody_Type2) => {
  OpenSignatureBody_Type2[OpenSignatureBody_Type2["TYPE_UNKNOWN"] = 0] = "TYPE_UNKNOWN";
  OpenSignatureBody_Type2[OpenSignatureBody_Type2["ADDRESS"] = 1] = "ADDRESS";
  OpenSignatureBody_Type2[OpenSignatureBody_Type2["BOOL"] = 2] = "BOOL";
  OpenSignatureBody_Type2[OpenSignatureBody_Type2["U8"] = 3] = "U8";
  OpenSignatureBody_Type2[OpenSignatureBody_Type2["U16"] = 4] = "U16";
  OpenSignatureBody_Type2[OpenSignatureBody_Type2["U32"] = 5] = "U32";
  OpenSignatureBody_Type2[OpenSignatureBody_Type2["U64"] = 6] = "U64";
  OpenSignatureBody_Type2[OpenSignatureBody_Type2["U128"] = 7] = "U128";
  OpenSignatureBody_Type2[OpenSignatureBody_Type2["U256"] = 8] = "U256";
  OpenSignatureBody_Type2[OpenSignatureBody_Type2["VECTOR"] = 9] = "VECTOR";
  OpenSignatureBody_Type2[OpenSignatureBody_Type2["DATATYPE"] = 10] = "DATATYPE";
  OpenSignatureBody_Type2[OpenSignatureBody_Type2["TYPE_PARAMETER"] = 11] = "TYPE_PARAMETER";
  return OpenSignatureBody_Type2;
})(OpenSignatureBody_Type || {});
var FunctionDescriptor_Visibility = /* @__PURE__ */ ((FunctionDescriptor_Visibility2) => {
  FunctionDescriptor_Visibility2[FunctionDescriptor_Visibility2["VISIBILITY_UNKNOWN"] = 0] = "VISIBILITY_UNKNOWN";
  FunctionDescriptor_Visibility2[FunctionDescriptor_Visibility2["PRIVATE"] = 1] = "PRIVATE";
  FunctionDescriptor_Visibility2[FunctionDescriptor_Visibility2["PUBLIC"] = 2] = "PUBLIC";
  FunctionDescriptor_Visibility2[FunctionDescriptor_Visibility2["FRIEND"] = 3] = "FRIEND";
  return FunctionDescriptor_Visibility2;
})(FunctionDescriptor_Visibility || {});
var OpenSignature_Reference = /* @__PURE__ */ ((OpenSignature_Reference2) => {
  OpenSignature_Reference2[OpenSignature_Reference2["REFERENCE_UNKNOWN"] = 0] = "REFERENCE_UNKNOWN";
  OpenSignature_Reference2[OpenSignature_Reference2["IMMUTABLE"] = 1] = "IMMUTABLE";
  OpenSignature_Reference2[OpenSignature_Reference2["MUTABLE"] = 2] = "MUTABLE";
  return OpenSignature_Reference2;
})(OpenSignature_Reference || {});
var Ability = /* @__PURE__ */ ((Ability2) => {
  Ability2[Ability2["ABILITY_UNKNOWN"] = 0] = "ABILITY_UNKNOWN";
  Ability2[Ability2["COPY"] = 1] = "COPY";
  Ability2[Ability2["DROP"] = 2] = "DROP";
  Ability2[Ability2["STORE"] = 3] = "STORE";
  Ability2[Ability2["KEY"] = 4] = "KEY";
  return Ability2;
})(Ability || {});
class Package$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.Package", [
      {
        no: 1,
        name: "storage_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "original_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 4, name: "modules", kind: "message", repeat: 1, T: () => Module },
      {
        no: 5,
        name: "type_origins",
        kind: "message",
        repeat: 1,
        T: () => TypeOrigin
      },
      {
        no: 6,
        name: "linkage",
        kind: "message",
        repeat: 1,
        T: () => Linkage
      }
    ]);
  }
}
const Package = new Package$Type();
class Module$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.Module", [
      {
        no: 1,
        name: "name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "contents",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      },
      {
        no: 3,
        name: "datatypes",
        kind: "message",
        repeat: 1,
        T: () => DatatypeDescriptor
      },
      {
        no: 4,
        name: "functions",
        kind: "message",
        repeat: 1,
        T: () => FunctionDescriptor
      }
    ]);
  }
}
const Module = new Module$Type();
class DatatypeDescriptor$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.DatatypeDescriptor", [
      {
        no: 1,
        name: "type_name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "defining_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "module",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 4,
        name: "name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 5,
        name: "abilities",
        kind: "enum",
        repeat: 1,
        T: () => ["sui.rpc.v2.Ability", Ability]
      },
      {
        no: 6,
        name: "type_parameters",
        kind: "message",
        repeat: 1,
        T: () => TypeParameter
      },
      {
        no: 7,
        name: "kind",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.DatatypeDescriptor.DatatypeKind", DatatypeDescriptor_DatatypeKind]
      },
      {
        no: 8,
        name: "fields",
        kind: "message",
        repeat: 1,
        T: () => FieldDescriptor
      },
      {
        no: 9,
        name: "variants",
        kind: "message",
        repeat: 1,
        T: () => VariantDescriptor
      }
    ]);
  }
}
const DatatypeDescriptor = new DatatypeDescriptor$Type();
class TypeParameter$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.TypeParameter", [
      {
        no: 1,
        name: "constraints",
        kind: "enum",
        repeat: 1,
        T: () => ["sui.rpc.v2.Ability", Ability]
      },
      {
        no: 2,
        name: "is_phantom",
        kind: "scalar",
        opt: true,
        T: 8
        /*ScalarType.BOOL*/
      }
    ]);
  }
}
const TypeParameter = new TypeParameter$Type();
class FieldDescriptor$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.FieldDescriptor", [
      {
        no: 1,
        name: "name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "position",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      },
      { no: 3, name: "type", kind: "message", T: () => OpenSignatureBody }
    ]);
  }
}
const FieldDescriptor = new FieldDescriptor$Type();
class VariantDescriptor$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.VariantDescriptor", [
      {
        no: 1,
        name: "name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "position",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      },
      {
        no: 3,
        name: "fields",
        kind: "message",
        repeat: 1,
        T: () => FieldDescriptor
      }
    ]);
  }
}
const VariantDescriptor = new VariantDescriptor$Type();
class OpenSignatureBody$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.OpenSignatureBody", [
      {
        no: 1,
        name: "type",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.OpenSignatureBody.Type", OpenSignatureBody_Type]
      },
      {
        no: 2,
        name: "type_name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "type_parameter_instantiation",
        kind: "message",
        repeat: 1,
        T: () => OpenSignatureBody
      },
      {
        no: 4,
        name: "type_parameter",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      }
    ]);
  }
}
const OpenSignatureBody = new OpenSignatureBody$Type();
class FunctionDescriptor$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.FunctionDescriptor", [
      {
        no: 1,
        name: "name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 5,
        name: "visibility",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.FunctionDescriptor.Visibility", FunctionDescriptor_Visibility]
      },
      {
        no: 6,
        name: "is_entry",
        kind: "scalar",
        opt: true,
        T: 8
        /*ScalarType.BOOL*/
      },
      {
        no: 7,
        name: "type_parameters",
        kind: "message",
        repeat: 1,
        T: () => TypeParameter
      },
      {
        no: 8,
        name: "parameters",
        kind: "message",
        repeat: 1,
        T: () => OpenSignature
      },
      {
        no: 9,
        name: "returns",
        kind: "message",
        repeat: 1,
        T: () => OpenSignature
      }
    ]);
  }
}
const FunctionDescriptor = new FunctionDescriptor$Type();
class OpenSignature$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.OpenSignature", [
      {
        no: 1,
        name: "reference",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.OpenSignature.Reference", OpenSignature_Reference]
      },
      { no: 2, name: "body", kind: "message", T: () => OpenSignatureBody }
    ]);
  }
}
const OpenSignature = new OpenSignature$Type();
class TypeOrigin$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.TypeOrigin", [
      {
        no: 1,
        name: "module_name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "datatype_name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "package_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const TypeOrigin = new TypeOrigin$Type();
class Linkage$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.Linkage", [
      {
        no: 1,
        name: "original_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "upgraded_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "upgraded_version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      }
    ]);
  }
}
const Linkage = new Linkage$Type();
export {
  Ability,
  DatatypeDescriptor,
  DatatypeDescriptor_DatatypeKind,
  FieldDescriptor,
  FunctionDescriptor,
  FunctionDescriptor_Visibility,
  Linkage,
  Module,
  OpenSignature,
  OpenSignatureBody,
  OpenSignatureBody_Type,
  OpenSignature_Reference,
  Package,
  TypeOrigin,
  TypeParameter,
  VariantDescriptor
};
//# sourceMappingURL=move_package.js.map
