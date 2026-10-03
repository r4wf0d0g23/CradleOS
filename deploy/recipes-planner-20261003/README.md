# Recipes & Materials rebuild — October 3, 2026

Raw asked to remake the recipe tab using the newly decoded current-client data.
The previously hidden historical Industry panel is replaced and restored to
public normal/kiosk navigation as Recipes; old /industry links still work and
/recipes is an alias. No wallet is required. Historical fitting remains separate.

## Features and calculation contract

- Current native-v1 snapshot only: 299 recipes,263 output product IDs. Selectable
  products come from every recipe output, never primaryTypeID (often an input).
- Explicit root recipe and integer target quantities; full batches, totals,
  extra target units and all by-products. No guessed facilities, duration,
  prices, inventory, or gameplay modifiers.
- Direct mode acquires the chosen batch's inputs. Optional supply-chain mode
  expands one user-selected global recipe per ingredient. A unique producer
  can be automatic; multiple producers require an explicit route or Acquire.
- A recipe DAG combines all parent demands before rounding. One job per recipe
  serves all its assigned outputs using maximum required batches, not their
  sum. Reverse topological order lists ingredients before their consumers.
- By-products assigned to another route are NOT automatically netted. This is
  a zero-inventory material plan, not a global optimizer or available-stock
  shortfall. Acquire is not a claim that a resource is raw/mineable/available.
- Exact integer ceiling via BigInt; checked addition/multiplication. Invalid,
  fractional, unsafe and overflowing quantities fail explicitly. Cycles
  withhold all totals; unresolved choices prevent final-list copying.
- Copyable material list + text fallback; search/category, complete recipe
  inputs/outputs, source data links, current build/world validation and Retry.

## Verification

74 frontend tests (11 dedicated planner cases),15 extractor tests,TypeScript/Vite,
8 protected Origins canon checks, existing IOC scanner and independent
architecture/source/maths/UI review pass. Browser1440px/390px covers route
alternatives,76→150 fuel batching, surplus, clipboard, invalid input, intermediate
choices/acquire, two-output refining, public/kiosk deep links and no overflow.
Local fault tests cover503/retry, wrong-cycle denial and a synthetic production
loop with totals/copy withheld. No page errors/retired data requests.

Native data bytes unchanged SHAa7702649eebcb1d12d6c18ce8dbd3df8ab88363a254bd02cef9574e847dcb66a.
Only meta coverage copy changes; current name snapshot/contracts/wallet/services
untouched. Old industry.json is not imported or shipped in the JS anymore.
Evidence: workspace research/cradleos-recipes-20261003. Production release.json
is recorded after live verification. Scope primary cradleos.io as prior Cycle7
releases; no GitHub Pages mirror claim. Rollback060aa144. Worktree remains live
indexer source; never delete it. Source branchcycle7-vestiges-20261002.
