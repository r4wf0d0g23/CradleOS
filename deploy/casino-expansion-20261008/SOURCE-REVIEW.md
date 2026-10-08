# Independent expanded casino candidate review

2026-10-08. Inherited native reviewer, not Opus. Read-only runtime/Move source; only review scripts and evidence written. No wallet, signatures, testnet bets, funding or publication.

## Gate status

**PASS for the bounded practice-only frontend release.** No remaining accounting, RNG or visual blocker found in the bounded implementation pass. Prior architecture report separately retains the current on-chain funding/activation HOLD.

### C1 — visible card ranks effectively unreadable (resolved)

The host rule in `src/main.css:262`, `[class*="card"] { background: rgba(8,5,2,.50) !important; }`, overrides the new `.casino-dealt-card` cream background. Its rank and side text remain `rgb(24,37,27)` on a near-black face. Independently reproduced on 390px Baccarat and 320px Andar, including actual computed styles. Screenshots: `candidate-390-baccarat.png`, `candidate-320-andar-limit.png`.

Parent applied narrowly scoped face/back and container/corner overrides, leaving host CSS unchanged. Verified production preview 5200: face background rgb(238,238,218), rank text rgb(24,37,27), **13.55:1 contrast**. Blackjack faces/corners and covered patterned backs also pass. See `card-contrast.json`, `fixed-320-baccarat.png`, `fixed-320-blackjack.png`; screenshots visually inspected.

### Minor rule copy

- Three-card paytable nonqualifying-dealer-win probability says approximately 30%; exact current probability is approximately 25.27%. Corrected to approximately 25.27%.
- Red Dog catalog hook implies staking after anchor revelation; actual wager precedes all three ranks. Corrected to state that staking precedes all three draws.

## Source findings that passed

- Expanded outcome helpers have no network/wallet imports. All draws validate safe integer bounds; production Web Crypto rejection sampling feeds them. A million Crash/Limbo outcomes use two unbiased base-1000 draws, not modulo reduction.
- Seventeen additions plus eight existing practice games yield 25. Hi-Lo is not added. Baccarat implements the missing no-third-card sentinel correctly. Scratch uses the deliberately corrected unbiased tier distribution and tier-identifying triples. Those differences from old contracts are explicitly documented.
- Stakes remain integer hundredths, bounded before play. Outcomes compute on a copied state and settle with a single debit/payout; session storage is written before UI state. Renderers have no randomness or ledger writes. Storage failure rejects the entire transition.
- Existing session key/schema and old game validation remain. Added per-game array shape/bounds protect renderer indices; generated new rounds round-trip. Local saves are not an authenticated/redeemable balance, and saved historical payouts/labels are not mathematically revalidated: this is acceptable only for this explicitly free-practice scope.
- Three-card category/high-card comparison faithfully retains the documented custom contract variant, including corrected 1.75× dealer-nonqualification return. Red Dog, Dragon Tiger, dice tables, Keno, risk/money wheels and refinery match independently inspected formulas/tables.
- Outcome rendering uses committed immutable round identity. Refill ID reuse cannot accidentally reuse an old animation frame. Parent's new shared RAF progress clamp fixes preceding-frame timestamps before reel/die indexing. Andar gets bounded duration up to 8.78 seconds and displays a 52-card no-match fallback without inventing a matching card.
- UI fieldset and action locks stop option changes while the committed replay runs. A synchronous ref additionally gates duplicate starts. Payout reveal never rerolls.
- Testnet catalog excludes Hi-Lo/Baccarat/Scratch; table rendering also blocks them and `InstantGamePanel` new-wager guard includes quarantine. The previous three vulnerable games remain disabled. Static house readiness remains false. Frontend quarantine is explicitly not a bytecode repair or activation permission.

## Independent verification

- `npm test -- --run src/lib/casinoExpanded.test.ts src/lib/casinoPractice.test.ts src/lib/plinkoMotion.test.ts`: **58 PASS**.
- New `casinoMotion.test.ts`: **1 PASS**, including preceding RAF timestamps.
- Final `npx tsc --noEmit`: **PASS**. Earlier known unused-test-parameter build failure was corrected.
- `candidate-browser.mjs` / `candidate-browser.json`: **PASS**, actual 320px touch, normal motion; rerun on current production build at local preview 5200 after fixes. Covered empty Keno atomic rejection, six-pick ceiling, exact ten draws; High risk profile persistence and wheel/pointer geometry; reload preserving committed ledger; Scratch payout independently derived from visible triple; ordinary isolated-session 52-miss Andar fixture; 23 staged testnet tables with all six excluded.
- No page exceptions in that run. Console diagnostics were the known host SmartObjectProvider missing object ID and Slush metadata CORS/ERR_FAILED, not a claim of console silence.
- Independent math/security architecture evidence is in `architecture-review.md`, `math-evidence.json`, `math-audit.py`.

Broader parent browser matrix/build results are not presented as independently executed here. Live publication needs a separate bounded live gate after corrected source is frozen.
