var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var _write, _serialize, _schema, _bytes;
import { fromBase58, fromBase64, toBase58, toBase64, fromHex, toHex } from "@mysten/utils";
import { BcsReader } from "./reader.js";
import { ulebEncode } from "./uleb.js";
import { BcsWriter } from "./writer.js";
const _BcsType = class _BcsType {
  constructor(options) {
    __privateAdd(this, _write);
    __privateAdd(this, _serialize);
    this.name = options.name;
    this.read = options.read;
    this.serializedSize = options.serializedSize ?? (() => null);
    __privateSet(this, _write, options.write);
    __privateSet(this, _serialize, options.serialize ?? ((value, options2) => {
      const writer = new BcsWriter({
        initialSize: this.serializedSize(value) ?? void 0,
        ...options2
      });
      __privateGet(this, _write).call(this, value, writer);
      return writer.toBytes();
    }));
    this.validate = options.validate ?? (() => {
    });
  }
  write(value, writer) {
    this.validate(value);
    __privateGet(this, _write).call(this, value, writer);
  }
  serialize(value, options) {
    this.validate(value);
    return new SerializedBcs(this, __privateGet(this, _serialize).call(this, value, options));
  }
  parse(bytes) {
    const reader = new BcsReader(bytes);
    return this.read(reader);
  }
  fromHex(hex) {
    return this.parse(fromHex(hex));
  }
  fromBase58(b64) {
    return this.parse(fromBase58(b64));
  }
  fromBase64(b64) {
    return this.parse(fromBase64(b64));
  }
  transform({
    name,
    input,
    output,
    validate
  }) {
    return new _BcsType({
      name: name ?? this.name,
      read: (reader) => output ? output(this.read(reader)) : this.read(reader),
      write: (value, writer) => __privateGet(this, _write).call(this, input ? input(value) : value, writer),
      serializedSize: (value) => this.serializedSize(input ? input(value) : value),
      serialize: (value, options) => __privateGet(this, _serialize).call(this, input ? input(value) : value, options),
      validate: (value) => {
        validate?.(value);
        this.validate(input ? input(value) : value);
      }
    });
  }
};
_write = new WeakMap();
_serialize = new WeakMap();
let BcsType = _BcsType;
const SERIALIZED_BCS_BRAND = Symbol.for("@mysten/serialized-bcs");
function isSerializedBcs(obj) {
  return !!obj && typeof obj === "object" && obj[SERIALIZED_BCS_BRAND] === true;
}
class SerializedBcs {
  constructor(schema, bytes) {
    __privateAdd(this, _schema);
    __privateAdd(this, _bytes);
    __privateSet(this, _schema, schema);
    __privateSet(this, _bytes, bytes);
  }
  // Used to brand SerializedBcs so that they can be identified, even between multiple copies
  // of the @mysten/bcs package are installed
  get [SERIALIZED_BCS_BRAND]() {
    return true;
  }
  toBytes() {
    return __privateGet(this, _bytes);
  }
  toHex() {
    return toHex(__privateGet(this, _bytes));
  }
  toBase64() {
    return toBase64(__privateGet(this, _bytes));
  }
  toBase58() {
    return toBase58(__privateGet(this, _bytes));
  }
  parse() {
    return __privateGet(this, _schema).parse(__privateGet(this, _bytes));
  }
}
_schema = new WeakMap();
_bytes = new WeakMap();
function fixedSizeBcsType({
  size,
  ...options
}) {
  return new BcsType({
    ...options,
    serializedSize: () => size
  });
}
function uIntBcsType({
  readMethod,
  writeMethod,
  ...options
}) {
  return fixedSizeBcsType({
    ...options,
    read: (reader) => reader[readMethod](),
    write: (value, writer) => writer[writeMethod](value),
    validate: (value) => {
      if (value < 0 || value > options.maxValue) {
        throw new TypeError(
          `Invalid ${options.name} value: ${value}. Expected value in range 0-${options.maxValue}`
        );
      }
      options.validate?.(value);
    }
  });
}
function bigUIntBcsType({
  readMethod,
  writeMethod,
  ...options
}) {
  return fixedSizeBcsType({
    ...options,
    read: (reader) => reader[readMethod](),
    write: (value, writer) => writer[writeMethod](BigInt(value)),
    validate: (val) => {
      const value = BigInt(val);
      if (value < 0 || value > options.maxValue) {
        throw new TypeError(
          `Invalid ${options.name} value: ${value}. Expected value in range 0-${options.maxValue}`
        );
      }
      options.validate?.(value);
    }
  });
}
function dynamicSizeBcsType({
  serialize,
  ...options
}) {
  const type = new BcsType({
    ...options,
    serialize,
    write: (value, writer) => {
      for (const byte of type.serialize(value).toBytes()) {
        writer.write8(byte);
      }
    }
  });
  return type;
}
function stringLikeBcsType({
  toBytes,
  fromBytes,
  ...options
}) {
  return new BcsType({
    ...options,
    read: (reader) => {
      const length = reader.readULEB();
      const bytes = reader.readBytes(length);
      return fromBytes(bytes);
    },
    write: (hex, writer) => {
      const bytes = toBytes(hex);
      writer.writeULEB(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        writer.write8(bytes[i]);
      }
    },
    serialize: (value) => {
      const bytes = toBytes(value);
      const size = ulebEncode(bytes.length);
      const result = new Uint8Array(size.length + bytes.length);
      result.set(size, 0);
      result.set(bytes, size.length);
      return result;
    },
    validate: (value) => {
      if (typeof value !== "string") {
        throw new TypeError(`Invalid ${options.name} value: ${value}. Expected string`);
      }
      options.validate?.(value);
    }
  });
}
function lazyBcsType(cb) {
  let lazyType = null;
  function getType() {
    if (!lazyType) {
      lazyType = cb();
    }
    return lazyType;
  }
  return new BcsType({
    name: "lazy",
    read: (data) => getType().read(data),
    serializedSize: (value) => getType().serializedSize(value),
    write: (value, writer) => getType().write(value, writer),
    serialize: (value, options) => getType().serialize(value, options).toBytes()
  });
}
class BcsStruct extends BcsType {
  constructor({ name, fields, ...options }) {
    const canonicalOrder = Object.entries(fields);
    super({
      name,
      serializedSize: (values) => {
        let total = 0;
        for (const [field, type] of canonicalOrder) {
          const size = type.serializedSize(values[field]);
          if (size == null) {
            return null;
          }
          total += size;
        }
        return total;
      },
      read: (reader) => {
        const result = {};
        for (const [field, type] of canonicalOrder) {
          result[field] = type.read(reader);
        }
        return result;
      },
      write: (value, writer) => {
        for (const [field, type] of canonicalOrder) {
          type.write(value[field], writer);
        }
      },
      ...options,
      validate: (value) => {
        options?.validate?.(value);
        if (typeof value !== "object" || value == null) {
          throw new TypeError(`Expected object, found ${typeof value}`);
        }
      }
    });
  }
}
class BcsEnum extends BcsType {
  constructor({ fields, ...options }) {
    const canonicalOrder = Object.entries(fields);
    super({
      read: (reader) => {
        const index = reader.readULEB();
        const enumEntry = canonicalOrder[index];
        if (!enumEntry) {
          throw new TypeError(`Unknown value ${index} for enum ${options.name}`);
        }
        const [kind, type] = enumEntry;
        return {
          [kind]: type?.read(reader) ?? true,
          $kind: kind
        };
      },
      write: (value, writer) => {
        const [name, val] = Object.entries(value).filter(
          ([name2]) => Object.hasOwn(fields, name2)
        )[0];
        for (let i = 0; i < canonicalOrder.length; i++) {
          const [optionName, optionType] = canonicalOrder[i];
          if (optionName === name) {
            writer.writeULEB(i);
            optionType?.write(val, writer);
            return;
          }
        }
      },
      ...options,
      validate: (value) => {
        options?.validate?.(value);
        if (typeof value !== "object" || value == null) {
          throw new TypeError(`Expected object, found ${typeof value}`);
        }
        const keys = Object.keys(value).filter(
          (k) => value[k] !== void 0 && Object.hasOwn(fields, k)
        );
        if (keys.length !== 1) {
          throw new TypeError(
            `Expected object with one key, but found ${keys.length} for type ${options.name}}`
          );
        }
        const [variant] = keys;
        if (!Object.hasOwn(fields, variant)) {
          throw new TypeError(`Invalid enum variant ${variant}`);
        }
      }
    });
  }
}
class BcsTuple extends BcsType {
  constructor({ fields, name, ...options }) {
    super({
      name: name ?? `(${fields.map((t) => t.name).join(", ")})`,
      serializedSize: (values) => {
        let total = 0;
        for (let i = 0; i < fields.length; i++) {
          const size = fields[i].serializedSize(values[i]);
          if (size == null) {
            return null;
          }
          total += size;
        }
        return total;
      },
      read: (reader) => {
        const result = [];
        for (const field of fields) {
          result.push(field.read(reader));
        }
        return result;
      },
      write: (value, writer) => {
        for (let i = 0; i < fields.length; i++) {
          fields[i].write(value[i], writer);
        }
      },
      ...options,
      validate: (value) => {
        options?.validate?.(value);
        if (!Array.isArray(value)) {
          throw new TypeError(`Expected array, found ${typeof value}`);
        }
        if (value.length !== fields.length) {
          throw new TypeError(`Expected array of length ${fields.length}, found ${value.length}`);
        }
      }
    });
  }
}
export {
  BcsEnum,
  BcsStruct,
  BcsTuple,
  BcsType,
  SerializedBcs,
  bigUIntBcsType,
  dynamicSizeBcsType,
  fixedSizeBcsType,
  isSerializedBcs,
  lazyBcsType,
  stringLikeBcsType,
  uIntBcsType
};
//# sourceMappingURL=bcs-type.js.map
