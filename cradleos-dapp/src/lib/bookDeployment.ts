import { CURRENT_EVE_COIN_TYPE, CURRENT_WORLD } from "./cycle";
/** Filled only from a reviewed testnet publication receipt. No old-package fallback. */
export const BOOK_DEPLOYMENT = {
  packageId: "",
  bookId: "",
  wageringEnabled: false,
  rewardsEnabled: false,
  pythState: "0x3c48fe392912de6c18087a2b3f5fdbfbfdb4598e180947feff1f12f8e9ea073e",
  wormholeState: "0x750da8e6d16b6a363a39fe2eaa8295ac224a1e6fce4e47b58845e2e8746164f0",
  chain: "testnet" as const,
  chainId: "4c78adac",
  world: CURRENT_WORLD,
  coinType: CURRENT_EVE_COIN_TYPE,
  registry:
    "0x69dfecd272649c16aff85bb7638b45a0b3afe40b57433009408aa27c397a4db7",
  tenant: "stillness",
};
