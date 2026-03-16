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
export {
  SUI_CHAINS,
  SUI_DEVNET_CHAIN,
  SUI_LOCALNET_CHAIN,
  SUI_MAINNET_CHAIN,
  SUI_TESTNET_CHAIN,
  isSuiChain
};
//# sourceMappingURL=chains.js.map
