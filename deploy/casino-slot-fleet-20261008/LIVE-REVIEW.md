# Slot fleet — independent public release review

**PASS.** Bounded independent verification of source `a6fcebde319d5e15f50d10007ca36e3f0bf34cb1`, Pages deployment `39eec190` at `https://cradleos.io/#/casino` and immutable `https://39eec190.cradleos-d75.pages.dev`. Inherited native reviewer, not Opus. No production edits, wallet connection, signature, donation, or chain mutation.

## Delivery

Six independent HTTP downloads all returned 200 and exact reviewed hashes: JS, CSS and public math JSON from both primary and immutable origins.

- `assets/index-CQg1qI7x.js`: `963f44dd27a77cc44c104729c1290a312e98a906e1ca7cef3fd43a8299b83041`
- `assets/index-DEF_5aFa.css`: `6509739f4ce73684551df461025f2666d78442ce55a73f2e6b8c2729595cc64c`
- `casino/slot-fleet-math.json`: `14c443b49ba3bddc23490b37d69adb7bcbf48ec54efad92e13363d11e6ff70cf`

Evidence: `live-hashes.json`. This is a sampled independent hash gate, not a claim to have repeated the parent's full asset sweep.

## Actual public browser checks

Fresh isolated Chromium, **320×780 touch, normal motion**, public origin:

- **33 practice games / 9 slots / 23 staged testnet tables**. No new fleet entry in the testnet catalogue, no development toolbar.
- Real production-RNG Scrapyard spin at 1 chip: visible drop animation, exactly one sequence increment and stake/payout change, actual opt-in AudioContext remains running. Reload preserves the exact saved outcome and ledger; no reroll. Audio verified programmatically, not by listening on a physical phone.
- Explicit isolated tab-storage **saved Gatecrash bonus fixture** (not claimed organically won): original pre-expansion grid appears during reveal; saved cursor survives reload; Next free spin and Reveal all preserve already-settled balance, sequence and history. Donation is disabled while the feature is pending. This fixture tests public replay/UI, not public writable QA facilities.
- Rules, measured-return summary, board and controls fit without horizontal overflow; screenshots inspected.
- Donate entry discoverable. Entering 1 EVE while disconnected leaves submit disabled; irreversible/operator-controlled gift language and wagering-not-enabled status remain visible. No wallet connection was attempted.
- Read-only house status resolved **paused, 0 EVE** in the staged catalogue. Wagering security HOLD text remains. Separately checked actual Blackjack **DEAL button disabled** in a fresh public context (`live-boundary.json`).
- No page exceptions. Request observations contain Cloudflare analytics and GraphQL/JSON-RPC reads, not transaction execution/signing calls.

Evidence: `live-probe.mjs/json`, `live-boundary.json`, `live-320-lobby.png`, `live-320-slot.png`, `live-320-donate.png`.

## Diagnostics / limits

Known SDK diagnostics persist: SmartObjectProvider without object ID and Slush wallet-metadata CORS/ERR_FAILED. They are recorded, not described as fixed or as a clean console. No additional exception was observed.

The first harness attempt assumed the never-played initial ledger was already serialized and dereferenced `null`; corrected the **test-only** pre-spin default to the actual 10,000-chip initial state. Retained `live-initial-harness.json` for transparency; the subsequent complete run passed. No runtime patch was made.

This release gate covers local nonredeemable practice and the existing disabled-wager boundary. It does not certify casino mathematics, authorize financial wagering, test contract settlement, or claim all devices/browser engines were exercised. Prior candidate math/accounting review remains in `source-review.md`.
