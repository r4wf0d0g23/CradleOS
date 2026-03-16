var AddressTransactionRelationship = /* @__PURE__ */ ((AddressTransactionRelationship2) => {
  AddressTransactionRelationship2["Affected"] = "AFFECTED";
  AddressTransactionRelationship2["Sent"] = "SENT";
  return AddressTransactionRelationship2;
})(AddressTransactionRelationship || {});
var ConsensusObjectCancellationReason = /* @__PURE__ */ ((ConsensusObjectCancellationReason2) => {
  ConsensusObjectCancellationReason2["CancelledRead"] = "CANCELLED_READ";
  ConsensusObjectCancellationReason2["Congested"] = "CONGESTED";
  ConsensusObjectCancellationReason2["RandomnessUnavailable"] = "RANDOMNESS_UNAVAILABLE";
  ConsensusObjectCancellationReason2["Unknown"] = "UNKNOWN";
  return ConsensusObjectCancellationReason2;
})(ConsensusObjectCancellationReason || {});
var ExecutionStatus = /* @__PURE__ */ ((ExecutionStatus2) => {
  ExecutionStatus2["Failure"] = "FAILURE";
  ExecutionStatus2["Success"] = "SUCCESS";
  return ExecutionStatus2;
})(ExecutionStatus || {});
var MoveAbility = /* @__PURE__ */ ((MoveAbility2) => {
  MoveAbility2["Copy"] = "COPY";
  MoveAbility2["Drop"] = "DROP";
  MoveAbility2["Key"] = "KEY";
  MoveAbility2["Store"] = "STORE";
  return MoveAbility2;
})(MoveAbility || {});
var MoveVisibility = /* @__PURE__ */ ((MoveVisibility2) => {
  MoveVisibility2["Friend"] = "FRIEND";
  MoveVisibility2["Private"] = "PRIVATE";
  MoveVisibility2["Public"] = "PUBLIC";
  return MoveVisibility2;
})(MoveVisibility || {});
var OwnerKind = /* @__PURE__ */ ((OwnerKind2) => {
  OwnerKind2["Address"] = "ADDRESS";
  OwnerKind2["Immutable"] = "IMMUTABLE";
  OwnerKind2["Object"] = "OBJECT";
  OwnerKind2["Shared"] = "SHARED";
  return OwnerKind2;
})(OwnerKind || {});
var RegulatedState = /* @__PURE__ */ ((RegulatedState2) => {
  RegulatedState2["Regulated"] = "REGULATED";
  RegulatedState2["Unregulated"] = "UNREGULATED";
  return RegulatedState2;
})(RegulatedState || {});
var SupplyState = /* @__PURE__ */ ((SupplyState2) => {
  SupplyState2["BurnOnly"] = "BURN_ONLY";
  SupplyState2["Fixed"] = "FIXED";
  return SupplyState2;
})(SupplyState || {});
var TransactionKindInput = /* @__PURE__ */ ((TransactionKindInput2) => {
  TransactionKindInput2["ProgrammableTx"] = "PROGRAMMABLE_TX";
  TransactionKindInput2["SystemTx"] = "SYSTEM_TX";
  return TransactionKindInput2;
})(TransactionKindInput || {});
var ZkLoginIntentScope = /* @__PURE__ */ ((ZkLoginIntentScope2) => {
  ZkLoginIntentScope2["PersonalMessage"] = "PERSONAL_MESSAGE";
  ZkLoginIntentScope2["TransactionData"] = "TRANSACTION_DATA";
  return ZkLoginIntentScope2;
})(ZkLoginIntentScope || {});
class TypedDocumentString extends String {
  constructor(value, __meta__) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }
  toString() {
    return this.value;
  }
}
const Object_Owner_FieldsFragmentDoc = new TypedDocumentString(`
    fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}
    `, { "fragmentName": "OBJECT_OWNER_FIELDS" });
const Object_FieldsFragmentDoc = new TypedDocumentString(`
    fragment OBJECT_FIELDS on Object {
  address
  digest
  version
  asMoveObject {
    contents {
      bcs
      type {
        repr
      }
    }
  }
  owner {
    ...OBJECT_OWNER_FIELDS
  }
  previousTransaction {
    digest
  }
}
    fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`, { "fragmentName": "OBJECT_FIELDS" });
const Move_Object_FieldsFragmentDoc = new TypedDocumentString(`
    fragment MOVE_OBJECT_FIELDS on MoveObject {
  address
  digest
  version
  contents {
    bcs
    type {
      repr
    }
  }
  owner {
    ...OBJECT_OWNER_FIELDS
  }
  previousTransaction {
    digest
  }
}
    fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`, { "fragmentName": "MOVE_OBJECT_FIELDS" });
const Transaction_FieldsFragmentDoc = new TypedDocumentString(`
    fragment TRANSACTION_FIELDS on Transaction {
  digest
  transactionBcs
  signatures {
    signatureBytes
  }
  effects {
    effectsBcs
    epoch {
      epochId
    }
    unchangedConsensusObjects {
      nodes {
        __typename
        ... on ConsensusObjectRead {
          object {
            asMoveObject {
              address
              contents {
                type {
                  repr
                }
              }
            }
          }
        }
      }
    }
    objectChanges {
      nodes {
        address
        inputState {
          version
          asMoveObject {
            address
            contents {
              type {
                repr
              }
            }
          }
        }
        outputState {
          asMoveObject {
            address
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
    balanceChanges(first: 50) {
      pageInfo {
        hasNextPage
      }
      nodes {
        owner {
          address
        }
        coinType {
          repr
        }
        amount
      }
    }
  }
}
    `, { "fragmentName": "TRANSACTION_FIELDS" });
const GetAllBalancesDocument = new TypedDocumentString(`
    query getAllBalances($owner: SuiAddress!, $limit: Int, $cursor: String) {
  address(address: $owner) {
    balances(first: $limit, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        coinType {
          repr
        }
        totalBalance
      }
    }
  }
}
    `);
const GetBalanceDocument = new TypedDocumentString(`
    query getBalance($owner: SuiAddress!, $coinType: String! = "0x2::sui::SUI") {
  address(address: $owner) {
    balance(coinType: $coinType) {
      coinType {
        repr
      }
      totalBalance
    }
  }
}
    `);
const GetCoinsDocument = new TypedDocumentString(`
    query getCoins($owner: SuiAddress!, $first: Int, $cursor: String, $type: String! = "0x2::coin::Coin<0x2::sui::SUI>") {
  address(address: $owner) {
    address
    objects(first: $first, after: $cursor, filter: {type: $type}) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        owner {
          ...OBJECT_OWNER_FIELDS
        }
        contents {
          bcs
          json
          type {
            repr
          }
        }
        address
        version
        digest
        previousTransaction {
          digest
        }
      }
    }
  }
}
    fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`);
const GetDynamicFieldsDocument = new TypedDocumentString(`
    query getDynamicFields($parentId: SuiAddress!, $first: Int, $cursor: String) {
  address(address: $parentId) {
    dynamicFields(first: $first, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        name {
          bcs
          type {
            repr
          }
        }
        value {
          __typename
          ... on MoveValue {
            type {
              repr
            }
          }
          ... on MoveObject {
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
  }
}
    `);
const GetMoveFunctionDocument = new TypedDocumentString(`
    query getMoveFunction($package: SuiAddress!, $module: String!, $function: String!) {
  package(address: $package) {
    module(name: $module) {
      function(name: $function) {
        name
        visibility
        isEntry
        typeParameters {
          constraints
        }
        parameters {
          signature
        }
        return {
          signature
        }
      }
    }
  }
}
    `);
const GetReferenceGasPriceDocument = new TypedDocumentString(`
    query getReferenceGasPrice {
  epoch {
    referenceGasPrice
  }
}
    `);
const DefaultSuinsNameDocument = new TypedDocumentString(`
    query defaultSuinsName($address: SuiAddress!) {
  address(address: $address) {
    defaultSuinsName
  }
}
    `);
const GetOwnedObjectsDocument = new TypedDocumentString(`
    query getOwnedObjects($owner: SuiAddress!, $limit: Int, $cursor: String, $filter: ObjectFilter) {
  address(address: $owner) {
    objects(first: $limit, after: $cursor, filter: $filter) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...MOVE_OBJECT_FIELDS
      }
    }
  }
}
    fragment MOVE_OBJECT_FIELDS on MoveObject {
  address
  digest
  version
  contents {
    bcs
    type {
      repr
    }
  }
  owner {
    ...OBJECT_OWNER_FIELDS
  }
  previousTransaction {
    digest
  }
}
fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`);
const MultiGetObjectsDocument = new TypedDocumentString(`
    query multiGetObjects($objectKeys: [ObjectKey!]!) {
  multiGetObjects(keys: $objectKeys) {
    ...OBJECT_FIELDS
  }
}
    fragment OBJECT_FIELDS on Object {
  address
  digest
  version
  asMoveObject {
    contents {
      bcs
      type {
        repr
      }
    }
  }
  owner {
    ...OBJECT_OWNER_FIELDS
  }
  previousTransaction {
    digest
  }
}
fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`);
const SimulateTransactionDocument = new TypedDocumentString(`
    query simulateTransaction($transaction: JSON!) {
  simulateTransaction(transaction: $transaction) {
    error
    effects {
      transaction {
        ...TRANSACTION_FIELDS
      }
    }
  }
}
    fragment TRANSACTION_FIELDS on Transaction {
  digest
  transactionBcs
  signatures {
    signatureBytes
  }
  effects {
    effectsBcs
    epoch {
      epochId
    }
    unchangedConsensusObjects {
      nodes {
        __typename
        ... on ConsensusObjectRead {
          object {
            asMoveObject {
              address
              contents {
                type {
                  repr
                }
              }
            }
          }
        }
      }
    }
    objectChanges {
      nodes {
        address
        inputState {
          version
          asMoveObject {
            address
            contents {
              type {
                repr
              }
            }
          }
        }
        outputState {
          asMoveObject {
            address
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
    balanceChanges(first: 50) {
      pageInfo {
        hasNextPage
      }
      nodes {
        owner {
          address
        }
        coinType {
          repr
        }
        amount
      }
    }
  }
}`);
const ExecuteTransactionDocument = new TypedDocumentString(`
    mutation executeTransaction($transactionDataBcs: Base64!, $signatures: [Base64!]!) {
  executeTransaction(
    transactionDataBcs: $transactionDataBcs
    signatures: $signatures
  ) {
    errors
    effects {
      transaction {
        ...TRANSACTION_FIELDS
      }
    }
  }
}
    fragment TRANSACTION_FIELDS on Transaction {
  digest
  transactionBcs
  signatures {
    signatureBytes
  }
  effects {
    effectsBcs
    epoch {
      epochId
    }
    unchangedConsensusObjects {
      nodes {
        __typename
        ... on ConsensusObjectRead {
          object {
            asMoveObject {
              address
              contents {
                type {
                  repr
                }
              }
            }
          }
        }
      }
    }
    objectChanges {
      nodes {
        address
        inputState {
          version
          asMoveObject {
            address
            contents {
              type {
                repr
              }
            }
          }
        }
        outputState {
          asMoveObject {
            address
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
    balanceChanges(first: 50) {
      pageInfo {
        hasNextPage
      }
      nodes {
        owner {
          address
        }
        coinType {
          repr
        }
        amount
      }
    }
  }
}`);
const GetTransactionBlockDocument = new TypedDocumentString(`
    query getTransactionBlock($digest: String!) {
  transaction(digest: $digest) {
    ...TRANSACTION_FIELDS
  }
}
    fragment TRANSACTION_FIELDS on Transaction {
  digest
  transactionBcs
  signatures {
    signatureBytes
  }
  effects {
    effectsBcs
    epoch {
      epochId
    }
    unchangedConsensusObjects {
      nodes {
        __typename
        ... on ConsensusObjectRead {
          object {
            asMoveObject {
              address
              contents {
                type {
                  repr
                }
              }
            }
          }
        }
      }
    }
    objectChanges {
      nodes {
        address
        inputState {
          version
          asMoveObject {
            address
            contents {
              type {
                repr
              }
            }
          }
        }
        outputState {
          asMoveObject {
            address
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
    balanceChanges(first: 50) {
      pageInfo {
        hasNextPage
      }
      nodes {
        owner {
          address
        }
        coinType {
          repr
        }
        amount
      }
    }
  }
}`);
const VerifyZkLoginSignatureDocument = new TypedDocumentString(`
    query verifyZkLoginSignature($bytes: Base64!, $signature: Base64!, $intentScope: ZkLoginIntentScope!, $author: SuiAddress!) {
  verifyZkLoginSignature(
    bytes: $bytes
    signature: $signature
    intentScope: $intentScope
    author: $author
  ) {
    success
    error
  }
}
    `);
export {
  AddressTransactionRelationship,
  ConsensusObjectCancellationReason,
  DefaultSuinsNameDocument,
  ExecuteTransactionDocument,
  ExecutionStatus,
  GetAllBalancesDocument,
  GetBalanceDocument,
  GetCoinsDocument,
  GetDynamicFieldsDocument,
  GetMoveFunctionDocument,
  GetOwnedObjectsDocument,
  GetReferenceGasPriceDocument,
  GetTransactionBlockDocument,
  MoveAbility,
  MoveVisibility,
  Move_Object_FieldsFragmentDoc,
  MultiGetObjectsDocument,
  Object_FieldsFragmentDoc,
  Object_Owner_FieldsFragmentDoc,
  OwnerKind,
  RegulatedState,
  SimulateTransactionDocument,
  SupplyState,
  TransactionKindInput,
  Transaction_FieldsFragmentDoc,
  TypedDocumentString,
  VerifyZkLoginSignatureDocument,
  ZkLoginIntentScope
};
//# sourceMappingURL=queries.js.map
