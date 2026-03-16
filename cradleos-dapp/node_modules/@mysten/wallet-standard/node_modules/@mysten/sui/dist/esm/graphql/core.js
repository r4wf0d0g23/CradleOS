var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
var _graphqlClient, _GraphQLCoreClient_instances, graphqlQuery_fn;
import { Experimental_CoreClient } from "../experimental/core.js";
import {
  DefaultSuinsNameDocument,
  ExecuteTransactionDocument,
  GetAllBalancesDocument,
  GetBalanceDocument,
  GetCoinsDocument,
  GetDynamicFieldsDocument,
  GetMoveFunctionDocument,
  GetOwnedObjectsDocument,
  GetReferenceGasPriceDocument,
  GetTransactionBlockDocument,
  MultiGetObjectsDocument,
  SimulateTransactionDocument,
  VerifyZkLoginSignatureDocument,
  ZkLoginIntentScope
} from "./generated/queries.js";
import { ObjectError } from "../experimental/errors.js";
import { chunk, fromBase64, toBase64 } from "@mysten/utils";
import { normalizeStructTag, normalizeSuiAddress } from "../utils/sui-types.js";
import { deriveDynamicFieldID } from "../utils/dynamic-fields.js";
import {
  parseTransactionBcs,
  parseTransactionEffectsBcs
} from "../experimental/transports/utils.js";
class GraphQLCoreClient extends Experimental_CoreClient {
  constructor({
    graphqlClient,
    mvr
  }) {
    super({ network: graphqlClient.network, base: graphqlClient, mvr });
    __privateAdd(this, _GraphQLCoreClient_instances);
    __privateAdd(this, _graphqlClient);
    __privateSet(this, _graphqlClient, graphqlClient);
  }
  async getObjects(options) {
    const batches = chunk(options.objectIds, 50);
    const results = [];
    for (const batch of batches) {
      const page = await __privateMethod(this, _GraphQLCoreClient_instances, graphqlQuery_fn).call(this, {
        query: MultiGetObjectsDocument,
        variables: {
          objectKeys: batch.map((address) => ({ address }))
        }
      }, (result) => result.multiGetObjects);
      results.push(
        ...batch.map((id) => normalizeSuiAddress(id)).map(
          (id) => page.find((obj) => obj?.address === id) ?? new ObjectError("notFound", `Object ${id} not found`)
        ).map((obj) => {
          if (obj instanceof ObjectError) {
            return obj;
          }
          return {
            id: obj.address,
            version: obj.version?.toString(),
            digest: obj.digest,
            owner: mapOwner(obj.owner),
            type: obj.asMoveObject?.contents?.type?.repr,
            content: Promise.resolve(
              obj.asMoveObject?.contents?.bcs ? fromBase64(obj.asMoveObject.contents.bcs) : new Uint8Array()
            ),
            previousTransaction: obj.previousTransaction?.digest ?? null
          };
        })
      );
    }
    return {
      objects: results
    };
  }
  async getOwnedObjects(options) {
    const objects = await __privateMethod(this, _GraphQLCoreClient_instances, graphqlQuery_fn).call(this, {
      query: GetOwnedObjectsDocument,
      variables: {
        owner: options.address,
        limit: options.limit,
        cursor: options.cursor,
        filter: options.type ? { type: (await this.mvr.resolveType({ type: options.type })).type } : void 0
      }
    }, (result) => result.address?.objects);
    return {
      objects: objects.nodes.map((obj) => ({
        id: obj.address,
        version: obj.version?.toString(),
        digest: obj.digest,
        owner: mapOwner(obj.owner),
        type: obj.contents?.type?.repr,
        content: Promise.resolve(
          obj.contents?.bcs ? fromBase64(obj.contents.bcs) : new Uint8Array()
        ),
        previousTransaction: obj.previousTransaction?.digest ?? null
      })),
      hasNextPage: objects.pageInfo.hasNextPage,
      cursor: objects.pageInfo.endCursor ?? null
    };
  }
  async getCoins(options) {
    const coins = await __privateMethod(this, _GraphQLCoreClient_instances, graphqlQuery_fn).call(this, {
      query: GetCoinsDocument,
      variables: {
        owner: options.address,
        cursor: options.cursor,
        first: options.limit,
        type: `0x2::coin::Coin<${(await this.mvr.resolveType({ type: options.coinType })).type}>`
      }
    }, (result) => result.address?.objects);
    return {
      cursor: coins.pageInfo.endCursor ?? null,
      hasNextPage: coins.pageInfo.hasNextPage,
      objects: coins.nodes.map((coin) => ({
        id: coin.address,
        version: coin.version?.toString(),
        digest: coin.digest,
        owner: mapOwner(coin.owner),
        type: coin.contents?.type?.repr,
        balance: coin.contents?.json?.balance,
        content: Promise.resolve(
          coin.contents?.bcs ? fromBase64(coin.contents.bcs) : new Uint8Array()
        ),
        previousTransaction: coin.previousTransaction?.digest ?? null
      }))
    };
  }
  async getBalance(options) {
    const result = await __privateMethod(this, _GraphQLCoreClient_instances, graphqlQuery_fn).call(this, {
      query: GetBalanceDocument,
      variables: {
        owner: options.address,
        type: (await this.mvr.resolveType({ type: options.coinType })).type
      }
    }, (result2) => result2.address?.balance);
    return {
      balance: {
        coinType: result.coinType?.repr,
        balance: result.totalBalance
      }
    };
  }
  async getAllBalances(options) {
    const balances = await __privateMethod(this, _GraphQLCoreClient_instances, graphqlQuery_fn).call(this, {
      query: GetAllBalancesDocument,
      variables: { owner: options.address }
    }, (result) => result.address?.balances);
    return {
      cursor: balances.pageInfo.endCursor ?? null,
      hasNextPage: balances.pageInfo.hasNextPage,
      balances: balances.nodes.map((balance) => ({
        coinType: balance.coinType?.repr,
        balance: balance.totalBalance
      }))
    };
  }
  async getTransaction(options) {
    const result = await __privateMethod(this, _GraphQLCoreClient_instances, graphqlQuery_fn).call(this, {
      query: GetTransactionBlockDocument,
      variables: { digest: options.digest }
    }, (result2) => result2.transaction);
    return {
      transaction: parseTransaction(result)
    };
  }
  async executeTransaction(options) {
    const result = await __privateMethod(this, _GraphQLCoreClient_instances, graphqlQuery_fn).call(this, {
      query: ExecuteTransactionDocument,
      variables: {
        transactionDataBcs: toBase64(options.transaction),
        signatures: options.signatures
      }
    }, (result2) => result2.executeTransaction);
    if (result.errors) {
      if (result.errors.length === 1) {
        throw new Error(result.errors[0]);
      }
      throw new AggregateError(result.errors.map((error) => new Error(error)));
    }
    return {
      transaction: parseTransaction(result.effects?.transaction)
    };
  }
  async dryRunTransaction(options) {
    const result = await __privateMethod(this, _GraphQLCoreClient_instances, graphqlQuery_fn).call(this, {
      query: SimulateTransactionDocument,
      variables: {
        transaction: {
          bcs: {
            value: toBase64(options.transaction)
          }
        }
      }
    }, (result2) => result2.simulateTransaction);
    if (result.error) {
      throw new Error(result.error);
    }
    return {
      transaction: parseTransaction(result.effects?.transaction)
    };
  }
  async getReferenceGasPrice() {
    const result = await __privateMethod(this, _GraphQLCoreClient_instances, graphqlQuery_fn).call(this, {
      query: GetReferenceGasPriceDocument
    }, (result2) => result2.epoch?.referenceGasPrice);
    return {
      referenceGasPrice: result
    };
  }
  async getDynamicFields(options) {
    const result = await __privateMethod(this, _GraphQLCoreClient_instances, graphqlQuery_fn).call(this, {
      query: GetDynamicFieldsDocument,
      variables: { parentId: options.parentId }
    }, (result2) => result2.address?.dynamicFields);
    return {
      dynamicFields: result.nodes.map((dynamicField) => {
        const valueType = dynamicField.value?.__typename === "MoveObject" ? dynamicField.value.contents?.type?.repr : dynamicField.value?.type?.repr;
        return {
          id: deriveDynamicFieldID(
            options.parentId,
            dynamicField.name?.type?.repr,
            fromBase64(dynamicField.name?.bcs)
          ),
          type: normalizeStructTag(
            dynamicField.value?.__typename === "MoveObject" ? `0x2::dynamic_field::Field<0x2::dynamic_object_field::Wrapper<${dynamicField.name?.type?.repr}>,0x2::object::ID>` : `0x2::dynamic_field::Field<${dynamicField.name?.type?.repr},${valueType}>`
          ),
          name: {
            type: dynamicField.name?.type?.repr,
            bcs: fromBase64(dynamicField.name?.bcs)
          },
          valueType
        };
      }),
      cursor: result.pageInfo.endCursor ?? null,
      hasNextPage: result.pageInfo.hasNextPage
    };
  }
  async verifyZkLoginSignature(options) {
    const intentScope = options.intentScope === "TransactionData" ? ZkLoginIntentScope.TransactionData : ZkLoginIntentScope.PersonalMessage;
    const result = await __privateMethod(this, _GraphQLCoreClient_instances, graphqlQuery_fn).call(this, {
      query: VerifyZkLoginSignatureDocument,
      variables: {
        bytes: options.bytes,
        signature: options.signature,
        intentScope,
        author: options.author
      }
    }, (result2) => result2.verifyZkLoginSignature);
    return {
      success: result.success ?? false,
      errors: result.error ? [result.error] : []
    };
  }
  async defaultNameServiceName(options) {
    const name = await __privateMethod(this, _GraphQLCoreClient_instances, graphqlQuery_fn).call(this, {
      query: DefaultSuinsNameDocument,
      signal: options.signal,
      variables: {
        address: options.address
      }
    }, (result) => result.address?.defaultSuinsName ?? null);
    return {
      data: { name }
    };
  }
  async getMoveFunction(options) {
    const moveFunction = await __privateMethod(this, _GraphQLCoreClient_instances, graphqlQuery_fn).call(this, {
      query: GetMoveFunctionDocument,
      variables: {
        package: (await this.mvr.resolvePackage({ package: options.packageId })).package,
        module: options.moduleName,
        function: options.name
      }
    }, (result) => result.package?.module?.function);
    let visibility = "unknown";
    switch (moveFunction.visibility) {
      case "PUBLIC":
        visibility = "public";
        break;
      case "PRIVATE":
        visibility = "private";
        break;
      case "FRIEND":
        visibility = "friend";
        break;
    }
    return {
      function: {
        packageId: normalizeSuiAddress(options.packageId),
        moduleName: options.moduleName,
        name: moveFunction.name,
        visibility,
        isEntry: moveFunction.isEntry ?? false,
        typeParameters: moveFunction.typeParameters?.map(({ constraints }) => ({
          isPhantom: false,
          constraints: constraints.map((constraint) => {
            switch (constraint) {
              case "COPY":
                return "copy";
              case "DROP":
                return "drop";
              case "STORE":
                return "store";
              case "KEY":
                return "key";
              default:
                return "unknown";
            }
          }) ?? []
        })) ?? [],
        parameters: moveFunction.parameters?.map((param) => parseNormalizedSuiMoveType(param.signature)) ?? [],
        returns: moveFunction.return?.map(({ signature }) => parseNormalizedSuiMoveType(signature)) ?? []
      }
    };
  }
  resolveTransactionPlugin() {
    throw new Error("GraphQL client does not support transaction resolution yet");
  }
}
_graphqlClient = new WeakMap();
_GraphQLCoreClient_instances = new WeakSet();
graphqlQuery_fn = async function(options, getData) {
  const { data, errors } = await __privateGet(this, _graphqlClient).query(options);
  handleGraphQLErrors(errors);
  const extractedData = data && (getData ? getData(data) : data);
  if (extractedData == null) {
    throw new Error("Missing response data");
  }
  return extractedData;
};
function handleGraphQLErrors(errors) {
  if (!errors || errors.length === 0) return;
  const errorInstances = errors.map((error) => new GraphQLResponseError(error));
  if (errorInstances.length === 1) {
    throw errorInstances[0];
  }
  throw new AggregateError(errorInstances);
}
class GraphQLResponseError extends Error {
  constructor(error) {
    super(error.message);
    this.locations = error.locations;
  }
}
function mapOwner(owner) {
  switch (owner.__typename) {
    case "AddressOwner":
      return { $kind: "AddressOwner", AddressOwner: owner.address?.address };
    case "ConsensusAddressOwner":
      return {
        $kind: "ConsensusAddressOwner",
        ConsensusAddressOwner: {
          owner: owner?.address?.address,
          startVersion: String(owner.startVersion)
        }
      };
    case "ObjectOwner":
      return { $kind: "ObjectOwner", ObjectOwner: owner.address?.address };
    case "Immutable":
      return { $kind: "Immutable", Immutable: true };
    case "Shared":
      return {
        $kind: "Shared",
        Shared: { initialSharedVersion: String(owner.initialSharedVersion) }
      };
  }
}
function parseTransaction(transaction) {
  const objectTypes = {};
  transaction.effects?.unchangedConsensusObjects?.nodes.forEach((node) => {
    if (node.__typename === "ConsensusObjectRead") {
      const type = node.object?.asMoveObject?.contents?.type?.repr;
      const address = node.object?.asMoveObject?.address;
      if (type && address) {
        objectTypes[address] = type;
      }
    }
  });
  transaction.effects?.objectChanges?.nodes.forEach((node) => {
    const address = node.address;
    const type = node.inputState?.asMoveObject?.contents?.type?.repr ?? node.outputState?.asMoveObject?.contents?.type?.repr;
    if (address && type) {
      objectTypes[address] = type;
    }
  });
  if (transaction.effects?.balanceChanges?.pageInfo.hasNextPage) {
    throw new Error("Pagination for balance changes is not supported");
  }
  return {
    digest: transaction.digest,
    effects: parseTransactionEffectsBcs(fromBase64(transaction.effects?.effectsBcs)),
    epoch: transaction.effects?.epoch?.epochId?.toString() ?? null,
    objectTypes: Promise.resolve(objectTypes),
    transaction: parseTransactionBcs(fromBase64(transaction.transactionBcs)),
    signatures: transaction.signatures.map((sig) => sig.signatureBytes),
    balanceChanges: transaction.effects?.balanceChanges?.nodes.map((change) => ({
      coinType: change?.coinType?.repr,
      address: change.owner?.address,
      amount: change.amount
    })) ?? []
    // events: transaction.events?.pageInfo.hasNextPage
  };
}
function parseNormalizedSuiMoveType(type) {
  let reference = null;
  if (type.ref === "&") {
    reference = "immutable";
  } else if (type.ref === "&mut") {
    reference = "mutable";
  }
  return {
    reference,
    body: parseNormalizedSuiMoveTypeBody(type.body)
  };
}
function parseNormalizedSuiMoveTypeBody(type) {
  switch (type) {
    case "address":
      return { $kind: "address" };
    case "bool":
      return { $kind: "bool" };
    case "u8":
      return { $kind: "u8" };
    case "u16":
      return { $kind: "u16" };
    case "u32":
      return { $kind: "u32" };
    case "u64":
      return { $kind: "u64" };
    case "u128":
      return { $kind: "u128" };
    case "u256":
      return { $kind: "u256" };
  }
  if (typeof type === "string") {
    throw new Error(`Unknown type: ${type}`);
  }
  if ("vector" in type) {
    return {
      $kind: "vector",
      vector: parseNormalizedSuiMoveTypeBody(type.vector)
    };
  }
  if ("datatype" in type) {
    return {
      $kind: "datatype",
      datatype: {
        typeName: `${normalizeSuiAddress(type.datatype.package)}::${type.datatype.module}::${type.datatype.type}`,
        typeParameters: type.datatype.typeParameters.map((t) => parseNormalizedSuiMoveTypeBody(t))
      }
    };
  }
  if ("typeParameter" in type) {
    return {
      $kind: "typeParameter",
      index: type.typeParameter
    };
  }
  throw new Error(`Unknown type: ${JSON.stringify(type)}`);
}
export {
  GraphQLCoreClient
};
//# sourceMappingURL=core.js.map
