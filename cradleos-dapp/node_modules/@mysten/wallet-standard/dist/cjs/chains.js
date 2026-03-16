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
var chains_exports = {};
__export(chains_exports, {
  SUI_CHAINS: () => SUI_CHAINS,
  SUI_DEVNET_CHAIN: () => SUI_DEVNET_CHAIN,
  SUI_LOCALNET_CHAIN: () => SUI_LOCALNET_CHAIN,
  SUI_MAINNET_CHAIN: () => SUI_MAINNET_CHAIN,
  SUI_TESTNET_CHAIN: () => SUI_TESTNET_CHAIN,
  isSuiChain: () => isSuiChain
});
module.exports = __toCommonJS(chains_exports);
const SUI_DEVNET_CHAIN = "sui:devnet";
const SUI_TESTNET_CHAIN = "sui:testnet";
const SUI_LOCALNET_CHAIN = "sui:localnet";
const SUI_MAINNET_CHAIN = "sui:mainnet";
const SUI_CHAINS = [
  SUI_DEVNET_CHAIN,
  SUI_TESTNET_CHAIN,
  SUI_LOCALNET_CHAIN,
  SUI_MAINNET_CHAIN
];
function isSuiChain(chain) {
  return SUI_CHAINS.includes(chain);
}
//# sourceMappingURL=chains.js.map
