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
var wallet_exports = {};
__export(wallet_exports, {
  signAndExecuteTransaction: () => signAndExecuteTransaction,
  signTransaction: () => signTransaction
});
module.exports = __toCommonJS(wallet_exports);
var import_bcs = require("@mysten/sui/bcs");
var import_transactions = require("@mysten/sui/transactions");
var import_utils = require("@mysten/sui/utils");
async function signAndExecuteTransaction(wallet, input) {
  if (wallet.features["sui:signAndExecuteTransaction"]) {
    return wallet.features["sui:signAndExecuteTransaction"].signAndExecuteTransaction(input);
  }
  if (!wallet.features["sui:signAndExecuteTransactionBlock"]) {
    throw new Error(
      `Provided wallet (${wallet.name}) does not support the signAndExecuteTransaction feature.`
    );
  }
  const { signAndExecuteTransactionBlock } = wallet.features["sui:signAndExecuteTransactionBlock"];
  const transactionBlock = import_transactions.Transaction.from(await input.transaction.toJSON());
  const { digest, rawEffects, rawTransaction } = await signAndExecuteTransactionBlock({
    account: input.account,
    chain: input.chain,
    transactionBlock,
    options: {
      showRawEffects: true,
      showRawInput: true
    }
  });
  const [
    {
      txSignatures: [signature],
      intentMessage: { value: bcsTransaction }
    }
  ] = import_bcs.bcs.SenderSignedData.parse((0, import_utils.fromBase64)(rawTransaction));
  const bytes = import_bcs.bcs.TransactionData.serialize(bcsTransaction).toBase64();
  return {
    digest,
    signature,
    bytes,
    effects: (0, import_utils.toBase64)(new Uint8Array(rawEffects))
  };
}
async function signTransaction(wallet, input) {
  if (wallet.features["sui:signTransaction"]) {
    return wallet.features["sui:signTransaction"].signTransaction(input);
  }
  if (!wallet.features["sui:signTransactionBlock"]) {
    throw new Error(
      `Provided wallet (${wallet.name}) does not support the signTransaction feature.`
    );
  }
  const { signTransactionBlock } = wallet.features["sui:signTransactionBlock"];
  const transaction = import_transactions.Transaction.from(await input.transaction.toJSON());
  const { transactionBlockBytes, signature } = await signTransactionBlock({
    transactionBlock: transaction,
    account: input.account,
    chain: input.chain
  });
  return { bytes: transactionBlockBytes, signature };
}
//# sourceMappingURL=wallet.js.map
