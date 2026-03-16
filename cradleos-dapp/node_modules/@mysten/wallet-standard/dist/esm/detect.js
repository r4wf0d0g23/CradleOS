import { StandardConnect, StandardEvents } from "@wallet-standard/core";
const REQUIRED_FEATURES = [StandardConnect, StandardEvents];
function isWalletWithRequiredFeatureSet(wallet, additionalFeatures = []) {
  return [...REQUIRED_FEATURES, ...additionalFeatures].every(
    (feature) => feature in wallet.features
  );
}
export {
  isWalletWithRequiredFeatureSet
};
//# sourceMappingURL=detect.js.map
