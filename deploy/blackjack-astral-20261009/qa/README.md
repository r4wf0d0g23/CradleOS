# Astral blackjack checks

verify.mjs operates the real app at QA_URL (default local Vite5203), not a renderer replica. Fresh deals use actual practice RNG. Saved-hand fixtures are created through the real session engine; hit/double/split results and settlement are compared against that engine and checked for no animation-time ledger writes. Only this browser's play-money sessionStorage is affected; no wallet connection or funded transaction.

Regenerate fixtures from cradleos-dapp using esbuild on this folder's fixtures.ts with --bundle --platform=node --format=esm and output .fixtures.mjs in this folder; run it with node. This generated module is not source or part of dist.

Run: QA_URL=http://127.0.0.1:5204/ QA_TAG=preview QA_WIDTHS='[320,390,844,1440]' node ../deploy/blackjack-astral-20261009/qa/verify.mjs

Checks cover actual movement, hidden-card DOM, hits, doubles, split stability, exact saved results, pause/reload, resized/hidden tabs, reduced motion, viewport/table overflow, 44px pause controls, runtime errors and current-icon loads. Animated blackjack on testnet is not exercised: financial wagering remains on hold.
