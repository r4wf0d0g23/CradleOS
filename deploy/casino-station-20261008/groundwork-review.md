# Common groundwork review — bounded PASS, not shipping approval

2026-10-08. Inherited native reviewer, not Opus. Runtime choice remains pending Raw. No app/chain/deployment changes performed by reviewer.

## Source verdict

**PASS for the completed common groundwork.** Reviewed the full three-file tracked diff and three new catalog/launch/test files. The extracted Fleet/Craps catalog metadata is unchanged; practice filtering remains the same 34 allowed games. Testnet filtering/HOLD is unchanged. `initialGame` goes through an allowlist and cannot choose donate/testnet or disabled games. Pending craps rolls, blackjack hands/tables, paid slot/Scratch/classic outcomes and unfinished runs take precedence through existing activeSession logic. Parked craps still permits another practice game without removing escrow.

Return pauses the future-spin scheduler synchronously before invoking its parent callback. The new chainBusyRef is checked synchronously; direct donation onBusyChange sets it before asynchronous preparation/signing. The existing donation marker/mounted/account guards remain unchanged. No new RNG, settlement, ledger write, schema or wager-activation path was introduced. Existing normal casino callers without props retain their previous initial-game behavior and have no floor-return button.

**Required caller contract:** `onReturnToStation` must unmount this single CasinoExperience, not merely CSS-hide it or leave another instance mounted. Cleanup then cancels presentation timers/audio and persists no additional outcome. `initialGame` is mount-only: changing that prop on a still-mounted instance does not select a terminal. A station owner should unmount/recreate exactly one game instance from committed session state. Clear world input before mounting, preserve wallet gates on outer exits, and do not open a competing ledger owner. This API is not a generic suspend-in-place implementation.

The dormant legacy CasinoPanel reports much of its busy state through an effect, unlike the direct donation callback. Current wagering remains disabled; this groundwork does not certify future activated legacy wager/return races. Preserve HOLD and require synchronous coverage before any later activation.

Independent test command:

```
npx vitest run src/lib/casinoStationSession.test.ts src/lib/casinoSessions.test.ts src/lib/casinoSpinRun.test.ts src/lib/casinoCraps.test.ts
```

Result: **48 tests / 4 files passed**, including all five new station tests. Eight protected accounting/donation/audio files independently compared byte-identical to HEAD; exact reviewed hashes are in groundwork-review.json. No new browser route or mounting integration exists to qualify yet; no full browser or 311-test rerun is claimed by this reviewer.

## Native blockout qualification

Inspected all three `station-0/1/2.png` images and verified each SHA256 against probe-result.json. They are distinct 1920×1080 native captures from three documented human-height camera positions. Authoring code produces 34 terminal placeholders grouped into four zones, six material meshes, 74,160 vertices and 24,720 triangles. This is original authored geometry serialized to Carbon Mesh and rendered through the native Trinity DX11 pipeline, not proof that the separately inventoried client hangar assets have been rendered.

Visuals show a coherent paneled concourse, ceiling ribs, repeated terminal massing and a central aisle; left/right camera views demonstrate depth and occlusion. The intended amber/teal art treatment is not demonstrated: light strips read white, screens gray, and much of the housing is nearly black. There is no terminal labeling, playable surface, resolved zone identity, collision test or walk-through in these captures. Materials and lighting therefore remain blockout quality, not finished Frontier client fidelity.

Against the empty control, changed-pixel proportions are 73.1862%, 76.3694% and 76.3697%; mean absolute RGB differences are 30.6226, 24.8451 and 32.9406 on the 0–255 scale. The control was captured after clearing scene objects. Together with visual inspection and capture hashes, this supports actual geometry contribution rather than a blank/background-only success. It does not measure real-time FPS, latency, interactivity or streaming.

Receipt qualification: process exit 0 and wine_cleanup=true. Nested result/probe reports scene_rendered=true, station_blockout=true and interactive_client=false. The receipt’s top-level scene_rendered=false and ship-oriented scope/ship_rendered labels are inherited harness metadata and conflict with the station result; use the nested station evidence explicitly, or add a clearly separate corrected summary without rewriting original evidence. Do not cite this receipt as an unqualified ship/material/browser PASS.

## Remaining gates

Raw still must choose browser rendering with qualified Carbon assets versus native streamed runtime. No station route, owner assignment, interactive browser, streaming service, embedded EVE browser or shipping quality is approved by this groundwork review. The prior architecture requirements remain in force. Preserve the current production release unchanged until the selected implementation and its separate acceptance gates are complete.
