import type { ExpandedGame } from "./casinoExpanded";
export const EXPANSION_RULES: Record<ExpandedGame, string> = {
  limbo:
    "Choose 1.01–1,000× before launch. An unbiased draw sets the flight limit. Reaching your target returns that multiplier; otherwise zero. No timing or manual cash-out advantage. Approximately 98% return before chip rounding.",
  crash:
    "Choose your auto-stop target before launch. The flight is a replay of the committed result, not a cash-out race. Target reached returns target × stake; otherwise zero. Approximately 98% return before chip rounding.",
  diamonds:
    "Five independent signals, seven equally likely symbols. Largest match of 3 returns 2.55×, 4 returns 30×, 5 returns 500×. Two or fewer returns zero.",
  keno: "Pick 1–6 different numbers from 1–40; ten are drawn without replacement. The selected paytable below gives total returns for each match count. Draw animation cannot change the result.",
  sicbo:
    "Three dice. Small (4–10) / Big (11–17) return 2× but any triple loses. Single face returns 2×, 3× or 4× for 1, 2 or 3 matches. Specific triple returns 180×; any triple returns 30×.",
  double_dice:
    "Two dice. Under / over 7 return 2.3×; exactly 7 or any double return 5.5×. Exact sum returns 34.2 divided by its number of possible combinations, rounded down to four decimals.",
  under_over_7:
    "Two dice. Under or over 7 returns 2.32×; exactly 7 returns 5.7×. All other outcomes lose.",
  chuck_a_luck:
    "Pick a face, then roll three dice. One match returns 1.9×, two 3.7×, three 12×; no match loses. Expected return 97.22% before rounding.",
  baccarat:
    "Single deck, standard third-card rules. Player win returns 2×; Banker 1.95×; Tie 9×. A tie refunds Player/Banker stakes. The Tie bet has a much higher house edge (about 15.75%). Practice corrects the old contract’s Banker draw rule; that testnet table remains quarantined.",
  three_card_poker:
    "Single deck, no fold/play bet. Categories: straight flush > trips > straight > flush > pair > high card. This contract variant breaks ties using only the highest card (Ace high). Losing hands return zero; ties 1×. Win against non-qualifying dealer returns 1.75×, not 2×. Dealer qualifies with any pair+ or Queen-high. Qualified wins return 2×, straight 3×, trips 5×, straight flush 6×.",
  dragon_tiger:
    "Two distinct cards from a 52-card deck, 2 low through Ace high. Winning side returns 2×. A rank tie returns half to side bets, or 9× to a Tie bet. Tie side bet has a high 47.06% house edge.",
  red_dog:
    "Three independent ranks, 2 low through Ace high. Third must lie strictly between anchors. Spread of 1/2/3/4/5+ ranks returns 6×/5×/4×/3×/2×. Consecutive anchors push. Equal anchors pay 12× if the third matches, otherwise push. All three cards are drawn after staking.",
  ore_refine:
    "Five intensity profiles. Result is Slag, Partial, Yield or Bonus. Every roll uses the selected threshold table; approximately 97% return before rounding. Higher intensity increases losses and the bonus ceiling, not expected profit.",
  risk_wheel:
    "20 equally likely sectors. Low: six blanks, nine 1.2×, four 1.4×, one 3× (97% return). Medium: twelve blanks, five 1.2×, two 1.6×, one 10× (96%). High: fourteen blanks, four 1.1×, one 1.3×, one 13.5× (96%).",
  money_wheel:
    "54 equal sectors: 24 blanks, eighteen 1.1×, eight 1.2×, three 1.6×, one 18×. Expected return 96.67% before rounding. No selected-segment wager: the landed sector sets your return.",
  andar_bahar:
    "Independent ranks with replacement, not a finite-deck variant. Match the Joker by alternating Andar then Bahar. Andar pays 1.88×; Bahar 2×. No match after 52 cards awards Andar. This limit slightly changes the uncapped odds; there is no player timing decision.",
  scratch_cards:
    "A sealed ticket reveals nine signals automatically. Outcome odds: 70% loss; 20% at 1.5×; 7% at 3×; 2.5% at 8×; 0.3% at 20×; 0.2% at 100×. Three Ice/Fuel/Circuits/Data/Lai symbols identify the respective winning tier. Practice uses unbiased selection (97% return); the old testnet randomness is quarantined. Reveal speed does not affect payout.",
};
/** Frontend quarantine is defense-in-depth, NOT a fix for callable old bytecode. */
export const TESTNET_QUARANTINE = new Set([
  "hilo",
  "baccarat",
  "scratch_cards",
]);
