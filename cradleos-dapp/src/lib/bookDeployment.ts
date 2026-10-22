import { CURRENT_EVE_COIN_TYPE, CURRENT_WORLD } from "./cycle";
/** Filled only from a reviewed testnet publication receipt. No old-package fallback. */
export const BOOK_DEPLOYMENT = {
  packageId: "",
  bookId: "",
  wageringEnabled: false,
  chain: "testnet" as const,
  chainId: "4c78adac",
  world: CURRENT_WORLD,
  coinType: CURRENT_EVE_COIN_TYPE,
  registry:
    "0x69dfecd272649c16aff85bb7638b45a0b3afe40b57433009408aa27c397a4db7",
  tenant: "stillness",
};
