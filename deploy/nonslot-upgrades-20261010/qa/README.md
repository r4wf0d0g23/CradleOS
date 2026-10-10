# Verification scope

- `integrated-{320,390,1440}-browser.json`: 25 fresh Play Money games at each width on the final source build, 75 total. Desktop OS reduction is deliberately enabled while explicit Animated remains active. Real transforms/attributes, early card masking, saved outcomes, balances, exact dice values, viewport fit and roulette target sizes checked. Three overview JPGs include every final scene; full-resolution PNGs are retained locally, excluded from git.
- `blackjack-browser.json`: 13 grouped fresh/engine-produced saved-hand checks covering hit, double, split, unaffected seats, hidden hole card, exact ledger, pause, reload, resize, simulated hidden-tab event and OS preference change. Uses the original astral engine-generated fixtures; no external account data.
- `boundaries.json`: 8 preference/risk/scratch/Baccarat checks, including pointer scratching through automatic reveal, reload persistence and no duplicate accounting. Initial harness failures were navigation/pref setup issues corrected in the final script; no application change was required for those failures.
- `slots-browser.json`: 7 default/preference/blocked-storage/classic/fleet regression cases.
- Earlier group passes (foundation24, wheels10, instruments14, cards21) are intermediate build evidence, not additional final-build cases.
- `tests.log`: 360 tests in 38 files; physical object endpoint/contact tests plus the existing full suite. `build-final.log`: TypeScript/Vite pass. `origins.log`:8 checks. `ioc.log`: exact canonical-directory approved scan clean.
- No wallet signing, testnet activation, wagering transfers, chain writes, physical-phone profiling or listening-based audio certification. All interaction checks are Chromium viewport emulation with isolated browser-local free Play Money. Finite reveals honor explicit Animated; blackjack ambient drift remains separately OS-aware.

Runtime source: e8459b4f961b90967d187c5420cfb1402aebae51. Production evidence is separate (`live-*.json` and RELEASE.md).

Committed command logs normalize terminal color codes and trailing whitespace only.
