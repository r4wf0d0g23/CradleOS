# Casino expansion — October 8, 2026

## Intent and scope
Raw requested the remaining games receive the refreshed Frontier casino standard,
with prior exploits explicitly considered. This release expands the local,
non-redeemable practice floor from 8 to 25 games and improves existing instant-game
presentation. It does NOT activate, fund or upgrade the paused testnet House.
The active chain package, custody, Character checks and deployment manifest remain
unchanged. Primary app origin only: cradleos.io. Prior rollback: 058ed040.

## Architecture / acceptance
- One authoritative integer-hundredths practice ledger, tab-scoped sessionStorage.
  Commit debit + outcome + payout before any animation; animation never settles.
  Quota failure must leave state untouched. Synchronous action lock prevents
  duplicate clicks, mode changes and refills during an active round/blackjack hand.
- Fresh unbiased WebCrypto draws, injected deterministic RNG for tests only.
  Reject invalid parameters, duplicate Keno picks, malformed draws and unsafe
  persisted values. Corrupt free-chip sessions can reset; there is no redemption.
- Game-specific presentation: physical peg-path Plinko, pointer-aligned wheels,
  stopped reel symbols, card deals, pip dice, progressive Keno/ticket reveals,
  precommitted multiplier flights and reactor progress. No fabricated near misses,
  manual-cashout claims or alternate random result chosen by the renderer.
- Actual normal-motion intermediate frames required, not just reduced-motion/end
  screenshots. Settled display must match committed outcome and history exactly.
- Accessible labelled controls, >=44px actions, 320/390/1440 checks, opt-in sound,
  reduced motion, no mandatory wallet, no chain reads from practice game engines.
- Rules use gross returns, not net-profit multipliers. Distinguish partial returns
  and pushes from wins. Mathematical expectations precede chip rounding.

## Game matrix
| Game | Work in this release | Security/rules gate |
|---|---|---|
| Blackjack | Existing recoverable practice hand, Frontier deck | No splits/insurance in practice; testnet remains paused |
| Slots | Outcome-led reel movement and staggered stops | Exact weighted 16-stop strip |
| Coinflip | Rotating two-face signal coin | 1.96×, unbiased fair side |
| Dice | Rolling display to committed 1–100 outcome | Strict target and bounded win chance |
| Roulette | Fixed pointer, actual winning sector rotates under it | Single zero; colors/exact number practice bets |
| Wheel | Actual equal-sector wheel | 20 sectors; exact table |
| Plinko | Preserve reviewed 12-peg collision path | Exhaustive 4096 trajectories |
| War | Progressive two-rank reveal | Tie returns half, not a win |
| Limbo / Crash | New auto-target practice flights | Set target before bet; no interactive cashout |
| Diamonds | New five-signal matching grid | 7^5 exact outcomes; 3/4/5 match payouts |
| Keno | New 40-number picker + ten-draw reveal | 1–6 distinct picks, without replacement, per-size paytable |
| Sic Bo | New three-pip-dice board, five bet kinds | Triples lose Small/Big; exhaustive 216 outcomes |
| Double Dice | New two-dice board, five bet kinds | Exact-sum multiplicity and 5% edge |
| Under/Over 7 | New two-dice threshold board | 2.32× / 5.7× as source |
| Chuck-a-luck | New chosen-face three-dice board | 1.9/3.7/12×; exhaustive outcomes |
| Baccarat | New corrected standard-tableau practice | Current contract player-positive; testnet QUARANTINED |
| Three-card poker | New two-hand reveal | Preserve repaired1.75× and explicitly disclose nonstandard highest-card-only tiebreak |
| Dragon Tiger | New two-card duel | Distinct52-card sample; disclose expensive Tie side bet |
| Red Dog | New anchor + inside card reveal | No choice after anchors; independent ranks; exact2197 outcomes |
| Risk Wheel | New three-profile sector wheel | Equal20sectors;97/96/96% expectations |
| Money Wheel | New54-sector wheel | 96.6667% expectation |
| Ore Refine | New five-profile refinery | Actual thresholds; gross recoveries visible |
| Andar Bahar | New alternating rank log | Disclose with-replacement52-card Andar fallback |
| Scratch Cards | New sealed9-signal practice reveal | Correct unbiased10000draw; explicit tier symbols; testnet QUARANTINED |
| Hi-Lo | Not added to practice; testnet QUARANTINED | Visible-base version ~105.6923% RTP; repair before reopening |
| Mines / Dragon Tower / Video Poker | Remain absent/disabled | Readable pre-drawn solution exploits; preserve on-chain entry aborts |

## Confirmed new audit findings
1. Hi-Lo: ties refund1/13 of wagers. Win term98% + tie term7.6923%
   yields105.6923% unconditional return on any feasible visible-base choice.
   Correct numerator would117400 rather than127400, including rounding tests.
2. Baccarat: player-third sentinel255 causes Banker4/5 to stand; correct rule
   draws0–5 when Player stands. Independent exact enumeration found current
   Player RTP100.3786%. Practice fixes tableau; existing bytecode not fixed here.
3. Scratch: uniform16-bit %10000 biases losses; old advertised97% becomes
   88.80615%. Practice uses rejection-sampled bounded10000, exactly97% before
   rounding. Its symbol-to-tier relationship is intentionally clear and local.
4. Three-card comparison is NOT conventional poker: category then highest card
   only. Repaired nonqualified win1.75× retained; no undocumented rules change.
5. Andar52-draw cap means actual RTP99.16530% /94.50500%, not uncapped97.76/96%.
   Diamonds table return96.54311%, not old95.7% claim.
6. House lacks aggregate reservations for pending multi-transaction liabilities.
   Old bytecode remains callable against same-origin objects after an upgrade.
   UI quarantine is defense-in-depth, never an on-chain security repair.

## Deployment / review gates
- Meaningful deterministic, exhaustive and sampled engine tests; legacy saves,
  input/RNG/corrupt-state limits; source-constant comparisons.
- Independent audit and source review with no unresolved blockers.
- Browser game-by-game normal motion and final outcome/accounting, mobile layout,
  storage failure, reload during reveal, reduced motion and paused testnet gate.
- Full existing tests, TS/build, Origins guard, IOC scan; commit reviewed source.
- Primary Pages deploy only, verify exact public bundles + live UI, record receipt.
- No funded chain transactions. Activation requires corrected enforceable chain
  design, liability reservations, bankroll/limits and separate verification.
