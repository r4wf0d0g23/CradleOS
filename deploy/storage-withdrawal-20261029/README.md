# Owner withdrawal routing — October 29, 2026

Raw relayed player screenshots (Discord 1565454817990811658) showing Large Reaper Shared Storage empty in the game while CradleOS showed 13 own-personal stacks. This continues the authorized storage repair.

## Diagnosis

Fresh supported-chain reads confirm all 13 stacks intact, including Building Foam 163 and Carbon Weave 28. Owner-main and shared slots are empty. Successful withdrawal FFuotf6SBcTyXtqAtHPbxkFzyhbceyZ5jstQwerXknyC emits official ItemDepositedEventV2 into the owner's character-cap partition. Official deposit_to_owned always uses the character cap, including when the recipient owns this SSU. The native owner inventory is a distinct SSU-cap partition. This is an owner-routing integration fault, not established item loss or an established Fenris indexer failure.

## Correction

Frontend-only, no contract upgrade: owner shared withdrawal/recovery now goes through the existing access-controlled contract and atomically moves the exact quantity onward to owner-main, using official withdraw_by_owner<Character> and deposit_by_owner<StorageUnit>. Each canonical cap is borrowed once and returned. Every transit Item is consumed within the same unit; no wallet Item, burn, game bridge, permission/configuration changes or cross-unit transfer.

Existing own-personal stock has explicit Move to owner storage / Move all to owner storage actions. Native recovery remains usable without sharing permission or an extension. Other pilots' items are never selected. Non-owner shared withdrawals still go to their own personal inventory. Exact amounts, Remove/Max, consequence confirmation, stale-state/wallet/network guards and one signature are retained. Capacity-only failures leave review editable but block signing until quantities fit. Owners now drag shared stock to the Owner storage tab.

## Checks

- 737 frontend tests; 14 focused independently rerun; TypeScript/build pass.
- 31 sandboxed Chromium fixture groups: real components/builders/common transaction guard, simulated wallet/reads. Includes wrong/stale account, pending signer lock, exact amounts, bulk, foreign exclusion, nonowner unchanged, recovery without extension, all responsive widths, capacity-limited partial transfer.
- Four checks-enabled unsigned live-builder simulations: all 13 actual stacks personal→owner, wrong sender rejected, owner withdrawal, owner recovery. The latter two explicitly simulate a legitimate one-item deposit from existing personal stock before withdrawing it in the same unsigned PTB; no admin mint or committed preparatory transaction.
- Origins guard 8 checks; exact dApp dependency IOC scan clean.
- Independent architecture and final source review PASS; reviewer identified double-cap consumption and capacity-review issue during staging, both corrected before release.

No player transaction was signed or submitted. The exact in-game visibility after a player signs recovery remains unverified; user should first return a small amount and reopen the native storage window. Game-side escalation is warranted if the canonical owner slot has stock on-chain but the game still omits it.

## Deployment

Production verification and rollback are recorded in web-release.json, live-assets.json and live-browser.json. Local raw chain/simulation receipts and screenshots are ignored; compact diagnosis/simulation summaries are included for reproducibility. Existing storefront, casino, partner metrics, backend services and contract pins unchanged.
