"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
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
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var core_exports = {};
__export(core_exports, {
  JSONRpcCoreClient: () => JSONRpcCoreClient
});
module.exports = __toCommonJS(core_exports);
var import_bcs = require("@mysten/bcs");
var import_bcs2 = require("../bcs/index.js");
var import_Transaction = require("../transactions/Transaction.js");
var import_json_rpc_resolver = require("./json-rpc-resolver.js");
var import_TransactionData = require("../transactions/TransactionData.js");
var import_utils = require("@mysten/utils");
var import_sui_types = require("../utils/sui-types.js");
var import_core = require("../experimental/core.js");
var import_errors = require("../experimental/errors.js");
var import_experimental = require("../experimental/index.js");
var _jsonRpcClient;
class JSONRpcCoreClient extends import_core.Experimental_CoreClient {
  constructor({
    jsonRpcClient,
    mvr
  }) {
    super({ network: jsonRpcClient.network, base: jsonRpcClient, mvr });
    __privateAdd(this, _jsonRpcClient);
    __privateSet(this, _jsonRpcClient, jsonRpcClient);
  }
  async getObjects(options) {
    const batches = (0, import_utils.chunk)(options.objectIds, 50);
    const results = [];
    for (const batch of batches) {
      const objects = await __privateGet(this, _jsonRpcClient).multiGetObjects({
        ids: batch,
        options: {
          showOwner: true,
          showType: true,
          showBcs: true,
          showPreviousTransaction: true
        },
        signal: options.signal
      });
      for (const [idx, object] of objects.entries()) {
        if (object.error) {
          results.push(import_errors.ObjectError.fromResponse(object.error, batch[idx]));
        } else {
          results.push(parseObject(object.data));
        }
      }
    }
    return {
      objects: results
    };
  }
  async getOwnedObjects(options) {
    const objects = await __privateGet(this, _jsonRpcClient).getOwnedObjects({
      owner: options.address,
      limit: options.limit,
      cursor: options.cursor,
      options: {
        showOwner: true,
        showType: true,
        showBcs: true,
        showPreviousTransaction: true
      },
      filter: options.type ? { StructType: options.type } : null,
      signal: options.signal
    });
    return {
      objects: objects.data.map((result) => {
        if (result.error) {
          throw import_errors.ObjectError.fromResponse(result.error);
        }
        return parseObject(result.data);
      }),
      hasNextPage: objects.hasNextPage,
      cursor: objects.nextCursor ?? null
    };
  }
  async getCoins(options) {
    const coins = await __privateGet(this, _jsonRpcClient).getCoins({
      owner: options.address,
      coinType: options.coinType,
      limit: options.limit,
      cursor: options.cursor,
      signal: options.signal
    });
    return {
      objects: coins.data.map((coin) => {
        return {
          id: coin.coinObjectId,
          version: coin.version,
          digest: coin.digest,
          balance: coin.balance,
          type: `0x2::coin::Coin<${coin.coinType}>`,
          content: Promise.resolve(
            Coin.serialize({
              id: coin.coinObjectId,
              balance: {
                value: coin.balance
              }
            }).toBytes()
          ),
          owner: {
            $kind: "ObjectOwner",
            ObjectOwner: options.address
          },
          previousTransaction: coin.previousTransaction
        };
      }),
      hasNextPage: coins.hasNextPage,
      cursor: coins.nextCursor ?? null
    };
  }
  async getBalance(options) {
    const balance = await __privateGet(this, _jsonRpcClient).getBalance({
      owner: options.address,
      coinType: options.coinType,
      signal: options.signal
    });
    return {
      balance: {
        coinType: balance.coinType,
        balance: balance.totalBalance
      }
    };
  }
  async getAllBalances(options) {
    const balances = await __privateGet(this, _jsonRpcClient).getAllBalances({
      owner: options.address,
      signal: options.signal
    });
    return {
      balances: balances.map((balance) => ({
        coinType: balance.coinType,
        balance: balance.totalBalance
      })),
      hasNextPage: false,
      cursor: null
    };
  }
  async getTransaction(options) {
    const transaction = await __privateGet(this, _jsonRpcClient).getTransactionBlock({
      digest: options.digest,
      options: {
        showRawInput: true,
        showObjectChanges: true,
        showRawEffects: true,
        showEvents: true,
        showEffects: true,
        showBalanceChanges: true
      },
      signal: options.signal
    });
    return {
      transaction: parseTransaction(transaction)
    };
  }
  async executeTransaction(options) {
    const transaction = await __privateGet(this, _jsonRpcClient).executeTransactionBlock({
      transactionBlock: options.transaction,
      signature: options.signatures,
      options: {
        showRawEffects: true,
        showEvents: true,
        showObjectChanges: true,
        showRawInput: true,
        showEffects: true,
        showBalanceChanges: true
      },
      signal: options.signal
    });
    return {
      transaction: parseTransaction(transaction)
    };
  }
  async dryRunTransaction(options) {
    const tx = import_Transaction.Transaction.from(options.transaction);
    const result = await __privateGet(this, _jsonRpcClient).dryRunTransactionBlock({
      transactionBlock: options.transaction,
      signal: options.signal
    });
    const { effects, objectTypes } = parseTransactionEffectsJson({
      effects: result.effects,
      objectChanges: result.objectChanges
    });
    return {
      transaction: {
        digest: await tx.getDigest(),
        epoch: null,
        effects,
        objectTypes: Promise.resolve(objectTypes),
        signatures: [],
        transaction: (0, import_experimental.parseTransactionBcs)(options.transaction),
        balanceChanges: result.balanceChanges.map((change) => ({
          coinType: change.coinType,
          address: parseOwnerAddress(change.owner),
          amount: change.amount
        }))
      }
    };
  }
  async getReferenceGasPrice(options) {
    const referenceGasPrice = await __privateGet(this, _jsonRpcClient).getReferenceGasPrice({
      signal: options?.signal
    });
    return {
      referenceGasPrice: String(referenceGasPrice)
    };
  }
  async getDynamicFields(options) {
    const dynamicFields = await __privateGet(this, _jsonRpcClient).getDynamicFields({
      parentId: options.parentId,
      limit: options.limit,
      cursor: options.cursor
    });
    return {
      dynamicFields: dynamicFields.data.map((dynamicField) => {
        return {
          id: dynamicField.objectId,
          type: dynamicField.objectType,
          name: {
            type: dynamicField.name.type,
            bcs: (0, import_bcs.fromBase64)(dynamicField.bcsName)
          }
        };
      }),
      hasNextPage: dynamicFields.hasNextPage,
      cursor: dynamicFields.nextCursor
    };
  }
  async verifyZkLoginSignature(options) {
    const result = await __privateGet(this, _jsonRpcClient).verifyZkLoginSignature({
      bytes: options.bytes,
      signature: options.signature,
      intentScope: options.intentScope,
      author: options.author
    });
    return {
      success: result.success,
      errors: result.errors
    };
  }
  async defaultNameServiceName(options) {
    const name = (await __privateGet(this, _jsonRpcClient).resolveNameServiceNames(options)).data[0];
    return {
      data: {
        name
      }
    };
  }
  resolveTransactionPlugin() {
    return (0, import_json_rpc_resolver.jsonRpcClientResolveTransactionPlugin)(__privateGet(this, _jsonRpcClient));
  }
  async getMoveFunction(options) {
    const result = await __privateGet(this, _jsonRpcClient).getNormalizedMoveFunction({
      package: (await this.mvr.resolvePackage({ package: options.packageId })).package,
      module: options.moduleName,
      function: options.name
    });
    return {
      function: {
        packageId: (0, import_sui_types.normalizeSuiAddress)(options.packageId),
        moduleName: options.moduleName,
        name: options.name,
        visibility: parseVisibility(result.visibility),
        isEntry: result.isEntry,
        typeParameters: result.typeParameters.map((abilities) => ({
          isPhantom: false,
          constraints: parseAbilities(abilities)
        })),
        parameters: result.parameters.map((param) => parseNormalizedSuiMoveType(param)),
        returns: result.return.map((ret) => parseNormalizedSuiMoveType(ret))
      }
    };
  }
}
_jsonRpcClient = new WeakMap();
function parseObject(object) {
  return {
    id: object.objectId,
    version: object.version,
    digest: object.digest,
    type: object.type,
    content: Promise.resolve(
      object.bcs?.dataType === "moveObject" ? (0, import_bcs.fromBase64)(object.bcs.bcsBytes) : new Uint8Array()
    ),
    owner: parseOwner(object.owner),
    previousTransaction: object.previousTransaction ?? null
  };
}
function parseOwner(owner) {
  if (owner === "Immutable") {
    return {
      $kind: "Immutable",
      Immutable: true
    };
  }
  if ("ConsensusAddressOwner" in owner) {
    return {
      $kind: "ConsensusAddressOwner",
      ConsensusAddressOwner: {
        owner: owner.ConsensusAddressOwner.owner,
        startVersion: owner.ConsensusAddressOwner.start_version
      }
    };
  }
  if ("AddressOwner" in owner) {
    return {
      $kind: "AddressOwner",
      AddressOwner: owner.AddressOwner
    };
  }
  if ("ObjectOwner" in owner) {
    return {
      $kind: "ObjectOwner",
      ObjectOwner: owner.ObjectOwner
    };
  }
  if ("Shared" in owner) {
    return {
      $kind: "Shared",
      Shared: {
        initialSharedVersion: owner.Shared.initial_shared_version
      }
    };
  }
  throw new Error(`Unknown owner type: ${JSON.stringify(owner)}`);
}
function parseOwnerAddress(owner) {
  if (owner === "Immutable") {
    return null;
  }
  if ("ConsensusAddressOwner" in owner) {
    return owner.ConsensusAddressOwner.owner;
  }
  if ("AddressOwner" in owner) {
    return owner.AddressOwner;
  }
  if ("ObjectOwner" in owner) {
    return owner.ObjectOwner;
  }
  if ("Shared" in owner) {
    return null;
  }
  throw new Error(`Unknown owner type: ${JSON.stringify(owner)}`);
}
function parseTransaction(transaction) {
  const parsedTx = import_bcs2.bcs.SenderSignedData.parse((0, import_bcs.fromBase64)(transaction.rawTransaction))[0];
  const objectTypes = {};
  transaction.objectChanges?.forEach((change) => {
    if (change.type !== "published") {
      objectTypes[change.objectId] = change.objectType;
    }
  });
  const bytes = import_bcs2.bcs.TransactionData.serialize(parsedTx.intentMessage.value).toBytes();
  const data = import_TransactionData.TransactionDataBuilder.restore({
    version: 2,
    sender: parsedTx.intentMessage.value.V1.sender,
    expiration: parsedTx.intentMessage.value.V1.expiration,
    gasData: parsedTx.intentMessage.value.V1.gasData,
    inputs: parsedTx.intentMessage.value.V1.kind.ProgrammableTransaction.inputs,
    commands: parsedTx.intentMessage.value.V1.kind.ProgrammableTransaction.commands
  });
  return {
    digest: transaction.digest,
    epoch: transaction.effects?.executedEpoch ?? null,
    effects: (0, import_experimental.parseTransactionEffectsBcs)(new Uint8Array(transaction.rawEffects)),
    objectTypes: Promise.resolve(objectTypes),
    transaction: {
      ...data,
      bcs: bytes
    },
    signatures: parsedTx.txSignatures,
    balanceChanges: transaction.balanceChanges?.map((change) => ({
      coinType: change.coinType,
      address: parseOwnerAddress(change.owner),
      amount: change.amount
    })) ?? []
  };
}
function parseTransactionEffectsJson({
  bytes,
  effects,
  objectChanges
}) {
  const changedObjects = [];
  const unchangedConsensusObjects = [];
  const objectTypes = {};
  objectChanges?.forEach((change) => {
    switch (change.type) {
      case "published":
        changedObjects.push({
          id: change.packageId,
          inputState: "DoesNotExist",
          inputVersion: null,
          inputDigest: null,
          inputOwner: null,
          outputState: "PackageWrite",
          outputVersion: change.version,
          outputDigest: change.digest,
          outputOwner: null,
          idOperation: "Created"
        });
        break;
      case "transferred":
        changedObjects.push({
          id: change.objectId,
          inputState: "Exists",
          inputVersion: change.version,
          inputDigest: change.digest,
          inputOwner: {
            $kind: "AddressOwner",
            AddressOwner: change.sender
          },
          outputState: "ObjectWrite",
          outputVersion: change.version,
          outputDigest: change.digest,
          outputOwner: parseOwner(change.recipient),
          idOperation: "None"
        });
        objectTypes[change.objectId] = change.objectType;
        break;
      case "mutated":
        changedObjects.push({
          id: change.objectId,
          inputState: "Exists",
          inputVersion: change.previousVersion,
          inputDigest: null,
          inputOwner: parseOwner(change.owner),
          outputState: "ObjectWrite",
          outputVersion: change.version,
          outputDigest: change.digest,
          outputOwner: parseOwner(change.owner),
          idOperation: "None"
        });
        objectTypes[change.objectId] = change.objectType;
        break;
      case "deleted":
        changedObjects.push({
          id: change.objectId,
          inputState: "Exists",
          inputVersion: change.version,
          inputDigest: effects.deleted?.find((d) => d.objectId === change.objectId)?.digest ?? null,
          inputOwner: null,
          outputState: "DoesNotExist",
          outputVersion: null,
          outputDigest: null,
          outputOwner: null,
          idOperation: "Deleted"
        });
        objectTypes[change.objectId] = change.objectType;
        break;
      case "wrapped":
        changedObjects.push({
          id: change.objectId,
          inputState: "Exists",
          inputVersion: change.version,
          inputDigest: null,
          inputOwner: {
            $kind: "AddressOwner",
            AddressOwner: change.sender
          },
          outputState: "ObjectWrite",
          outputVersion: change.version,
          outputDigest: effects.wrapped?.find((w) => w.objectId === change.objectId)?.digest ?? null,
          outputOwner: {
            $kind: "ObjectOwner",
            ObjectOwner: change.sender
          },
          idOperation: "None"
        });
        objectTypes[change.objectId] = change.objectType;
        break;
      case "created":
        changedObjects.push({
          id: change.objectId,
          inputState: "DoesNotExist",
          inputVersion: null,
          inputDigest: null,
          inputOwner: null,
          outputState: "ObjectWrite",
          outputVersion: change.version,
          outputDigest: change.digest,
          outputOwner: parseOwner(change.owner),
          idOperation: "Created"
        });
        objectTypes[change.objectId] = change.objectType;
        break;
    }
  });
  return {
    objectTypes,
    effects: {
      bcs: bytes ?? null,
      digest: effects.transactionDigest,
      version: 2,
      status: effects.status.status === "success" ? { success: true, error: null } : { success: false, error: effects.status.error },
      gasUsed: effects.gasUsed,
      transactionDigest: effects.transactionDigest,
      gasObject: {
        id: effects.gasObject?.reference.objectId,
        inputState: "Exists",
        inputVersion: null,
        inputDigest: null,
        inputOwner: null,
        outputState: "ObjectWrite",
        outputVersion: effects.gasObject.reference.version,
        outputDigest: effects.gasObject.reference.digest,
        outputOwner: parseOwner(effects.gasObject.owner),
        idOperation: "None"
      },
      eventsDigest: effects.eventsDigest ?? null,
      dependencies: effects.dependencies ?? [],
      lamportVersion: effects.gasObject.reference.version,
      changedObjects,
      unchangedConsensusObjects,
      auxiliaryDataDigest: null
    }
  };
}
const Balance = import_bcs2.bcs.struct("Balance", {
  value: import_bcs2.bcs.u64()
});
const Coin = import_bcs2.bcs.struct("Coin", {
  id: import_bcs2.bcs.Address,
  balance: Balance
});
function parseNormalizedSuiMoveType(type) {
  if (typeof type !== "string") {
    if ("Reference" in type) {
      return {
        reference: "immutable",
        body: parseNormalizedSuiMoveTypeBody(type.Reference)
      };
    }
    if ("MutableReference" in type) {
      return {
        reference: "mutable",
        body: parseNormalizedSuiMoveTypeBody(type.MutableReference)
      };
    }
  }
  return {
    reference: null,
    body: parseNormalizedSuiMoveTypeBody(type)
  };
}
function parseNormalizedSuiMoveTypeBody(type) {
  switch (type) {
    case "Address":
      return { $kind: "address" };
    case "Bool":
      return { $kind: "bool" };
    case "U8":
      return { $kind: "u8" };
    case "U16":
      return { $kind: "u16" };
    case "U32":
      return { $kind: "u32" };
    case "U64":
      return { $kind: "u64" };
    case "U128":
      return { $kind: "u128" };
    case "U256":
      return { $kind: "u256" };
  }
  if (typeof type === "string") {
    throw new Error(`Unknown type: ${type}`);
  }
  if ("Vector" in type) {
    return {
      $kind: "vector",
      vector: parseNormalizedSuiMoveTypeBody(type.Vector)
    };
  }
  if ("Struct" in type) {
    return {
      $kind: "datatype",
      datatype: {
        typeName: `${(0, import_sui_types.normalizeSuiAddress)(type.Struct.address)}::${type.Struct.module}::${type.Struct.name}`,
        typeParameters: type.Struct.typeArguments.map((t) => parseNormalizedSuiMoveTypeBody(t))
      }
    };
  }
  if ("TypeParameter" in type) {
    return {
      $kind: "typeParameter",
      index: type.TypeParameter
    };
  }
  throw new Error(`Unknown type: ${JSON.stringify(type)}`);
}
function parseAbilities(abilitySet) {
  return abilitySet.abilities.map((ability) => {
    switch (ability) {
      case "Copy":
        return "copy";
      case "Drop":
        return "drop";
      case "Store":
        return "store";
      case "Key":
        return "key";
      default:
        return "unknown";
    }
  });
}
function parseVisibility(visibility) {
  switch (visibility) {
    case "Public":
      return "public";
    case "Private":
      return "private";
    case "Friend":
      return "friend";
    default:
      return "unknown";
  }
}
//# sourceMappingURL=core.js.map
