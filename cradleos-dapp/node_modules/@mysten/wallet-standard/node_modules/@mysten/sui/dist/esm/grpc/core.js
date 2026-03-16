var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var _client;
import { Experimental_CoreClient } from "../experimental/index.js";
import { Owner_OwnerKind } from "./proto/sui/rpc/v2/owner.js";
import { chunk, fromBase64, toBase64 } from "@mysten/utils";
import { UnchangedConsensusObject_UnchangedConsensusObjectKind } from "./proto/sui/rpc/v2/effects.js";
import {
  ChangedObject_IdOperation,
  ChangedObject_InputObjectState,
  ChangedObject_OutputObjectState
} from "./proto/sui/rpc/v2/effects.js";
import { TransactionDataBuilder } from "../transactions/index.js";
import { bcs } from "../bcs/index.js";
import {
  Ability,
  FunctionDescriptor_Visibility,
  OpenSignature_Reference,
  OpenSignatureBody_Type
} from "./proto/sui/rpc/v2/move_package.js";
class GrpcCoreClient extends Experimental_CoreClient {
  constructor({ client, ...options }) {
    super(options);
    __privateAdd(this, _client);
    __privateSet(this, _client, client);
  }
  async getObjects(options) {
    const batches = chunk(options.objectIds, 50);
    const results = [];
    for (const batch of batches) {
      const response = await __privateGet(this, _client).ledgerService.batchGetObjects({
        requests: batch.map((id) => ({ objectId: id })),
        readMask: {
          paths: [
            "owner",
            "object_type",
            "bcs",
            "digest",
            "version",
            "object_id",
            "previous_transaction"
          ]
        }
      });
      results.push(
        ...response.response.objects.map(
          (object) => {
            if (object.result.oneofKind === "error") {
              return new Error(object.result.error.message);
            }
            if (object.result.oneofKind !== "object") {
              return new Error("Unexpected result type");
            }
            return {
              id: object.result.object.objectId,
              version: object.result.object.version?.toString(),
              digest: object.result.object.digest,
              // TODO: bcs content is not returned in all cases
              content: Promise.resolve(object.result.object.bcs?.value),
              owner: mapOwner(object.result.object.owner),
              type: object.result.object.objectType,
              previousTransaction: object.result.object.previousTransaction ?? null
            };
          }
        )
      );
    }
    return {
      objects: results
    };
  }
  async getOwnedObjects(options) {
    const response = await __privateGet(this, _client).stateService.listOwnedObjects({
      owner: options.address,
      objectType: options.type ? (await this.mvr.resolveType({ type: options.type })).type : void 0,
      pageToken: options.cursor ? fromBase64(options.cursor) : void 0,
      readMask: {
        paths: [
          "owner",
          "object_type",
          "bcs",
          "digest",
          "version",
          "object_id",
          "previous_transaction"
        ]
      }
    });
    const objects = response.response.objects.map(
      (object) => ({
        id: object.objectId,
        version: object.version?.toString(),
        digest: object.digest,
        // TODO: List owned objects doesn't return content right now
        get content() {
          return object.bcs?.value ? Promise.resolve(object.bcs.value) : Promise.reject(
            new Error("GRPC does not return object contents when listing owned objects")
          );
        },
        owner: mapOwner(object.owner),
        type: object.objectType,
        previousTransaction: object.previousTransaction ?? null
      })
    );
    return {
      objects,
      cursor: response.response.nextPageToken ? toBase64(response.response.nextPageToken) : null,
      hasNextPage: response.response.nextPageToken !== void 0
    };
  }
  async getCoins(options) {
    const response = await __privateGet(this, _client).stateService.listOwnedObjects({
      owner: options.address,
      objectType: `0x2::coin::Coin<${(await this.mvr.resolveType({ type: options.coinType })).type}>`,
      pageToken: options.cursor ? fromBase64(options.cursor) : void 0,
      readMask: {
        paths: [
          "owner",
          "object_type",
          "bcs",
          "digest",
          "version",
          "object_id",
          "balance",
          "previous_transaction"
        ]
      }
    });
    return {
      objects: response.response.objects.map(
        (object) => ({
          id: object.objectId,
          version: object.version?.toString(),
          digest: object.digest,
          // TODO: List owned objects doesn't return content right now
          get content() {
            return object.bcs?.value ? Promise.resolve(object.bcs.value) : Promise.reject(
              new Error("GRPC does not return object contents when listing owned objects")
            );
          },
          owner: mapOwner(object.owner),
          type: object.objectType,
          balance: object.balance?.toString(),
          previousTransaction: object.previousTransaction ?? null
        })
      ),
      cursor: response.response.nextPageToken ? toBase64(response.response.nextPageToken) : null,
      hasNextPage: response.response.nextPageToken !== void 0
    };
  }
  async getBalance(options) {
    const result = await __privateGet(this, _client).stateService.getBalance({
      owner: options.address,
      coinType: (await this.mvr.resolveType({ type: options.coinType })).type
    });
    return {
      balance: {
        balance: result.response.balance?.balance?.toString() ?? "0",
        coinType: result.response.balance?.coinType ?? options.coinType
      }
    };
  }
  async getAllBalances(options) {
    const result = await __privateGet(this, _client).stateService.listBalances({
      owner: options.address,
      pageToken: options.cursor ? fromBase64(options.cursor) : void 0,
      pageSize: options.limit
    });
    return {
      hasNextPage: !!result.response.nextPageToken,
      cursor: result.response.nextPageToken ? toBase64(result.response.nextPageToken) : null,
      balances: result.response.balances.map((balance) => ({
        balance: balance.balance?.toString() ?? "0",
        coinType: balance.coinType
      }))
    };
  }
  async getTransaction(options) {
    const { response } = await __privateGet(this, _client).ledgerService.getTransaction({
      digest: options.digest,
      readMask: {
        paths: ["digest", "transaction", "effects", "signatures", "balance_changes"]
      }
    });
    return {
      transaction: parseTransaction(response.transaction)
    };
  }
  async executeTransaction(options) {
    const { response } = await __privateGet(this, _client).transactionExecutionService.executeTransaction({
      transaction: {
        bcs: {
          value: options.transaction
        }
      },
      signatures: options.signatures.map((signature) => ({
        bcs: {
          value: fromBase64(signature)
        },
        signature: {
          oneofKind: void 0
        }
      })),
      readMask: {
        paths: [
          "transaction.digest",
          "transaction.transaction",
          "transaction.effects",
          "transaction.signatures",
          "transaction.balance_changes"
        ]
      }
    });
    return {
      transaction: parseTransaction(response.transaction)
    };
  }
  async dryRunTransaction(options) {
    const { response } = await __privateGet(this, _client).transactionExecutionService.simulateTransaction({
      transaction: {
        bcs: {
          value: options.transaction
        }
      },
      readMask: {
        paths: [
          "transaction.digest",
          "transaction.transaction",
          "transaction.effects",
          "transaction.signatures",
          "transaction.balance_changes"
        ]
      }
    });
    return {
      transaction: parseTransaction(response.transaction)
    };
  }
  async getReferenceGasPrice() {
    const response = await __privateGet(this, _client).ledgerService.getEpoch({});
    return {
      referenceGasPrice: response.response.epoch?.referenceGasPrice?.toString()
    };
  }
  async getDynamicFields(options) {
    const response = await __privateGet(this, _client).stateService.listDynamicFields({
      parent: options.parentId,
      pageToken: options.cursor ? fromBase64(options.cursor) : void 0
    });
    return {
      dynamicFields: response.response.dynamicFields.map((field) => ({
        id: field.fieldId,
        name: {
          type: field.name?.name,
          bcs: field.name?.value
        },
        type: field.fieldObject ? `0x2::dynamic_field::Field<0x2::dynamic_object_field::Wrapper<${field.name?.name}>,0x2::object::ID>` : `0x2::dynamic_field::Field<${field.name?.value},${field.valueType}>`
      })),
      cursor: response.response.nextPageToken ? toBase64(response.response.nextPageToken) : null,
      hasNextPage: response.response.nextPageToken !== void 0
    };
  }
  async verifyZkLoginSignature(options) {
    const { response } = await __privateGet(this, _client).signatureVerificationService.verifySignature({
      message: {
        name: options.intentScope,
        value: fromBase64(options.bytes)
      },
      signature: {
        bcs: {
          value: fromBase64(options.signature)
        },
        signature: {
          oneofKind: void 0
        }
      },
      jwks: []
    });
    return {
      success: response.isValid ?? false,
      errors: response.reason ? [response.reason] : []
    };
  }
  async defaultNameServiceName(options) {
    const name = (await __privateGet(this, _client).nameService.reverseLookupName({
      address: options.address
    })).response.record?.name ?? null;
    return {
      data: {
        name
      }
    };
  }
  async getMoveFunction(options) {
    const { response } = await __privateGet(this, _client).movePackageService.getFunction({
      packageId: (await this.mvr.resolvePackage({ package: options.packageId })).package,
      moduleName: options.moduleName,
      name: options.name
    });
    let visibility = "unknown";
    switch (response.function?.visibility) {
      case FunctionDescriptor_Visibility.PUBLIC:
        visibility = "public";
        break;
      case FunctionDescriptor_Visibility.PRIVATE:
        visibility = "private";
        break;
      case FunctionDescriptor_Visibility.FRIEND:
        visibility = "friend";
        break;
    }
    return {
      function: {
        packageId: options.packageId,
        moduleName: options.moduleName,
        name: response.function?.name,
        visibility,
        isEntry: response.function?.isEntry ?? false,
        typeParameters: response.function?.typeParameters?.map(({ constraints }) => ({
          isPhantom: false,
          constraints: constraints.map((constraint) => {
            switch (constraint) {
              case Ability.COPY:
                return "copy";
              case Ability.DROP:
                return "drop";
              case Ability.STORE:
                return "store";
              case Ability.KEY:
                return "key";
              default:
                return "unknown";
            }
          }) ?? []
        })) ?? [],
        parameters: response.function?.parameters?.map((param) => parseNormalizedSuiMoveType(param)) ?? [],
        returns: response.function?.returns?.map((ret) => parseNormalizedSuiMoveType(ret)) ?? []
      }
    };
  }
  resolveTransactionPlugin() {
    return async function resolveTransactionData(_transactionData, _options, _next) {
      throw new Error("Transaction resolution is not supported with the GRPC client");
    };
  }
}
_client = new WeakMap();
function mapOwner(owner) {
  if (!owner) {
    return null;
  }
  if (owner.kind === Owner_OwnerKind.IMMUTABLE) {
    return {
      $kind: "Immutable",
      Immutable: true
    };
  }
  if (owner.kind === Owner_OwnerKind.ADDRESS) {
    return {
      AddressOwner: owner.address,
      $kind: "AddressOwner"
    };
  }
  if (owner.kind === Owner_OwnerKind.OBJECT) {
    return {
      $kind: "ObjectOwner",
      ObjectOwner: owner.address
    };
  }
  if (owner.kind === Owner_OwnerKind.SHARED) {
    if (owner.address) {
      return {
        $kind: "ConsensusAddressOwner",
        ConsensusAddressOwner: {
          owner: owner.address,
          startVersion: owner.version?.toString()
        }
      };
    }
    return {
      $kind: "Shared",
      Shared: {
        initialSharedVersion: owner.version?.toString()
      }
    };
  }
  throw new Error("Unknown owner kind");
}
function mapIdOperation(operation) {
  if (operation == null) {
    return null;
  }
  switch (operation) {
    case ChangedObject_IdOperation.CREATED:
      return "Created";
    case ChangedObject_IdOperation.DELETED:
      return "Deleted";
    case ChangedObject_IdOperation.NONE:
    case ChangedObject_IdOperation.ID_OPERATION_UNKNOWN:
      return "None";
    default:
      operation;
      return "Unknown";
  }
}
function mapInputObjectState(state) {
  if (state == null) {
    return null;
  }
  switch (state) {
    case ChangedObject_InputObjectState.EXISTS:
      return "Exists";
    case ChangedObject_InputObjectState.DOES_NOT_EXIST:
      return "DoesNotExist";
    case ChangedObject_InputObjectState.UNKNOWN:
      return "Unknown";
    default:
      state;
      return "Unknown";
  }
}
function mapOutputObjectState(state) {
  if (state == null) {
    return null;
  }
  switch (state) {
    case ChangedObject_OutputObjectState.OBJECT_WRITE:
      return "ObjectWrite";
    case ChangedObject_OutputObjectState.PACKAGE_WRITE:
      return "PackageWrite";
    case ChangedObject_OutputObjectState.DOES_NOT_EXIST:
      return "DoesNotExist";
    case ChangedObject_OutputObjectState.UNKNOWN:
      return "Unknown";
    default:
      state;
      return "Unknown";
  }
}
function mapUnchangedConsensusObjectKind(kind) {
  if (kind == null) {
    return null;
  }
  switch (kind) {
    case UnchangedConsensusObject_UnchangedConsensusObjectKind.UNCHANGED_CONSENSUS_OBJECT_KIND_UNKNOWN:
      return "Unknown";
    case UnchangedConsensusObject_UnchangedConsensusObjectKind.READ_ONLY_ROOT:
      return "ReadOnlyRoot";
    case UnchangedConsensusObject_UnchangedConsensusObjectKind.MUTATE_CONSENSUS_STREAM_ENDED:
      return "MutateConsensusStreamEnded";
    case UnchangedConsensusObject_UnchangedConsensusObjectKind.READ_CONSENSUS_STREAM_ENDED:
      return "ReadConsensusStreamEnded";
    case UnchangedConsensusObject_UnchangedConsensusObjectKind.CANCELED:
      return "Cancelled";
    case UnchangedConsensusObject_UnchangedConsensusObjectKind.PER_EPOCH_CONFIG:
      return "PerEpochConfig";
    default:
      kind;
      return "Unknown";
  }
}
function parseTransactionEffects({
  effects
}) {
  if (!effects) {
    return null;
  }
  const changedObjects = effects.changedObjects.map(
    (change) => {
      return {
        id: change.objectId,
        inputState: mapInputObjectState(change.inputState),
        inputVersion: change.inputVersion?.toString() ?? null,
        inputDigest: change.inputDigest ?? null,
        inputOwner: mapOwner(change.inputOwner),
        outputState: mapOutputObjectState(change.outputState),
        outputVersion: change.outputVersion?.toString() ?? null,
        outputDigest: change.outputDigest ?? null,
        outputOwner: mapOwner(change.outputOwner),
        idOperation: mapIdOperation(change.idOperation)
      };
    }
  );
  return {
    bcs: effects.bcs?.value,
    digest: effects.digest,
    version: 2,
    status: effects.status?.success ? {
      success: true,
      error: null
    } : {
      success: false,
      // TODO: parse errors properly
      error: JSON.stringify(effects.status?.error)
    },
    gasUsed: {
      computationCost: effects.gasUsed?.computationCost?.toString(),
      storageCost: effects.gasUsed?.storageCost?.toString(),
      storageRebate: effects.gasUsed?.storageRebate?.toString(),
      nonRefundableStorageFee: effects.gasUsed?.nonRefundableStorageFee?.toString()
    },
    transactionDigest: effects.transactionDigest,
    gasObject: {
      id: effects.gasObject?.objectId,
      inputState: mapInputObjectState(effects.gasObject?.inputState),
      inputVersion: effects.gasObject?.inputVersion?.toString() ?? null,
      inputDigest: effects.gasObject?.inputDigest ?? null,
      inputOwner: mapOwner(effects.gasObject?.inputOwner),
      outputState: mapOutputObjectState(effects.gasObject?.outputState),
      outputVersion: effects.gasObject?.outputVersion?.toString() ?? null,
      outputDigest: effects.gasObject?.outputDigest ?? null,
      outputOwner: mapOwner(effects.gasObject?.outputOwner),
      idOperation: mapIdOperation(effects.gasObject?.idOperation)
    },
    eventsDigest: effects.eventsDigest ?? null,
    dependencies: effects.dependencies,
    lamportVersion: effects.lamportVersion?.toString() ?? null,
    changedObjects,
    unchangedConsensusObjects: effects.unchangedConsensusObjects.map(
      (object) => {
        return {
          kind: mapUnchangedConsensusObjectKind(object.kind),
          // TODO: we are inconsistent about id vs objectId
          objectId: object.objectId,
          version: object.version?.toString() ?? null,
          digest: object.digest ?? null
        };
      }
    ),
    auxiliaryDataDigest: effects.auxiliaryDataDigest ?? null
  };
}
function parseTransaction(transaction) {
  const parsedTx = bcs.SenderSignedData.parse(transaction.transaction?.bcs?.value)[0];
  const bytes = bcs.TransactionData.serialize(parsedTx.intentMessage.value).toBytes();
  const data = TransactionDataBuilder.restore({
    version: 2,
    sender: parsedTx.intentMessage.value.V1.sender,
    expiration: parsedTx.intentMessage.value.V1.expiration,
    gasData: parsedTx.intentMessage.value.V1.gasData,
    inputs: parsedTx.intentMessage.value.V1.kind.ProgrammableTransaction.inputs,
    commands: parsedTx.intentMessage.value.V1.kind.ProgrammableTransaction.commands
  });
  const objectTypes = {};
  transaction.objects?.objects.forEach((object) => {
    if (object.objectId && object.objectType) {
      objectTypes[object.objectId] = object.objectType;
    }
  });
  const effects = parseTransactionEffects({
    effects: transaction.effects
  });
  return {
    digest: transaction.digest,
    epoch: transaction.effects?.epoch?.toString() ?? null,
    effects,
    objectTypes: Promise.resolve(objectTypes),
    transaction: {
      gasData: data.gasData,
      sender: data.sender,
      expiration: data.expiration,
      commands: data.commands,
      inputs: data.inputs,
      version: data.version,
      bcs: bytes
    },
    signatures: parsedTx.txSignatures,
    balanceChanges: transaction.balanceChanges?.map((change) => ({
      coinType: change.coinType,
      address: change.address,
      amount: change.amount
    })) ?? []
  };
}
function parseNormalizedSuiMoveType(type) {
  let reference = null;
  if (type.reference === OpenSignature_Reference.IMMUTABLE) {
    reference = "immutable";
  } else if (type.reference === OpenSignature_Reference.MUTABLE) {
    reference = "mutable";
  }
  return {
    reference,
    body: parseNormalizedSuiMoveTypeBody(type.body)
  };
}
function parseNormalizedSuiMoveTypeBody(type) {
  switch (type.type) {
    case OpenSignatureBody_Type.TYPE_UNKNOWN:
      return { $kind: "unknown" };
    case OpenSignatureBody_Type.ADDRESS:
      return { $kind: "address" };
    case OpenSignatureBody_Type.BOOL:
      return { $kind: "bool" };
    case OpenSignatureBody_Type.U8:
      return { $kind: "u8" };
    case OpenSignatureBody_Type.U16:
      return { $kind: "u16" };
    case OpenSignatureBody_Type.U32:
      return { $kind: "u32" };
    case OpenSignatureBody_Type.U64:
      return { $kind: "u64" };
    case OpenSignatureBody_Type.U128:
      return { $kind: "u128" };
    case OpenSignatureBody_Type.U256:
      return { $kind: "u256" };
    case OpenSignatureBody_Type.VECTOR:
      return {
        $kind: "vector",
        vector: parseNormalizedSuiMoveTypeBody(type.typeParameterInstantiation[0])
      };
    case OpenSignatureBody_Type.DATATYPE:
      return {
        $kind: "datatype",
        datatype: {
          typeName: type.typeName,
          typeParameters: type.typeParameterInstantiation.map(
            (t) => parseNormalizedSuiMoveTypeBody(t)
          )
        }
      };
    case OpenSignatureBody_Type.TYPE_PARAMETER:
      return {
        $kind: "typeParameter",
        index: type.typeParameter
      };
    default:
      return { $kind: "unknown" };
  }
}
export {
  GrpcCoreClient,
  parseTransactionEffects
};
//# sourceMappingURL=core.js.map
