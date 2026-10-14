# Keeper games — October13

Raw requested a few Keeper-themed casino games. Deliver three web Play Money games with authentic Keeper identity: diamond/pixel-grid UI, not a physical body. Existing financial wagering hold, retired physical station34, accounts, original game math, and services remain unchanged.

## Games
- **Keeper’s Cipher**: three distinct glyphs from six, ordered uniformly (120codes). Three guesses with exact/misplaced clue counts. Solve1/2/3 pays18×/4.5×/1.8× total; fail/end trial pays0. No repeated guesses. Logical strategy, not a timer.
- **Archive Resonance**: five independent equiprobable glyphs, hold positions and redraw once or retain all. Five same18×; four3×; full house1.2×; three.6×; two pairs.3×; other0. Highest combination only, total returns. Draw replacements precommitted by position, hidden until player locks holds.
- **Keeper’s Passage**: five independent four-gate stages. Stable3safe/4 or Deep2safe/4, chosen before each gate. Bank gross stake×.96×product(4/safeCount), rounded down only once. Failure0; fifth successauto-bank. Before any gate, returnstake allowed. Maximum30.72×. No hidden future gate data exposed in UI.

`math.py` exhaustively evaluates Cipher optimal guesses and Archive optimal holds before denomination rounding:95.25% /95.2889%. Passage any chosen risk/bank strategy after crossing gives96% before rounding, with no information about future draws. UI labels strategy-dependent estimates accurately. Script/multipliers are game-specific, not transplanted odds. All stakes integer hundredths; same1–1000chip stake range (100–100000integer hundredths).

## State and integration
Extend existing Frontier optional v1 transcript with three new typed keys. Shared Sessionv2 balance, draw/actionbeforeanimation, id/revision guard, terminalcollectonce. Preserve existingtray/history. Reserve max32× before new wager and restore; no chainops. New titles/catalog entries/cards only in web PlayMoney. Existing34physicalcatalog unaffected. No new dependencies.

## Visual acceptance
Native Keeper frame/static art visible at rest; native notification plays only during action. Cipher panels decode row-by-row with exact/misplaced counts tied to saved guesses; secret never revealed until rounddone. Archive heldglyphs remain stable while onlydiscardedpositions dissolve/refill; showing correctcombination/return. Passage chosenlane carries amberpulse to actualsafe/failurecell, previousrows readable, futuregatesconcealed. Compact labels and rule/paytable details; controls keyboard/touch friendly at320px. Source failure leaves conciseKeeper/glyphfallback.

## Verification/release
Architecture review; engine/legal-action/RNG/boundary/replay/collect-once tests; productionbuild. Browserfreshrounds + deterministicwin/loss/interruption/Instant/System/storage/refill/mobile checks, visual inspection. Finalreview before publish. ScopedprimaryPagesdeployment, verifiedartifacthashes andfreshlivegames. No claim of physical-device or chain execution.
