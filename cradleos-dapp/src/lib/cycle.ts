/** Cycle 7, verified 2026-10-02 against official world-contracts PR #261
 * and wallet-core's generated MVR cache. No runtime MVR lookup is required.
 * Keep old contract and token identities for recovery; a world reset is NOT
 * an upgrade of CradleOS's deployed Move packages. */
export const CURRENT_CYCLE = "Cycle 7 · Vestiges";
export const CYCLE_STARTED = "2026-09-29";
export const CURRENT_WORLD = "0x7be18d6294e533bedd9a5d70a96ce8d9d4b87a7c74188ba65d3fe966bbed9d92";
export const CURRENT_EVE_PACKAGE = "0xc663658ff707985246bc7b5c605a458ec2caea28bfc35c253eb526dcf961643e";
export const CURRENT_EVE_COIN_TYPE = `${CURRENT_EVE_PACKAGE}::EVE::EVE`;
export const LEGACY_WORLD = "0x8b8a46ed766fa1358ce7c5c51f6a164b13d627a63e45343f69ed0ba0446c1aa1";
export const LEGACY_EVE_COIN_TYPE = "0xac361aa5ceb726bd974f885c9dea9e55dc9bc98fa1f5731c5965a810707bf0b8::EVE::EVE";
export const PUBLIC_UNIVERSE_AVAILABLE = false;
export const LEGACY_EXTENSIONS_READY = false;
// Identity/owned discovery remains independently verified through official GraphQL.
// Search/intel use the separately rebuilt Cycle 7 index, not this optional fast path.
export const CURRENT_WORLD_INDEX_READY = false;
export const PATCH_NOTES_URL = "https://evefrontier.com/en/news/patch-notes-founder-access-0-7-0-0-vestiges";
export const LATEST_PATCH_URL = "https://evefrontier.com/en/news/patch-notes-founder-access-0-7-1-0-vestiges";
export const WORLD_RELEASE_URL = "https://github.com/evefrontier/world-contracts/pull/261";
