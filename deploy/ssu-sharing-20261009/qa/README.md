# SSU browser verification

These fixtures render the real components, not a UI replica. RPC interception provides deterministic storage states; it does not implement transaction submission. No real wallet is connected and the test never clicks Confirm in wallet.

To reproduce from cradleos-dapp: copy this folder's ssu-qa.html to the app root and __ssu-qa.tsx to src/, start local Vite on port 5201, then run `node ../deploy/ssu-sharing-20261009/qa/verify.mjs`. Remove/move the two temporary harness files back out before any production build. Do not publish them.

Screenshots include expanded mitigation review, which intentionally makes the irreversible access consequence explicit. Normal cards keep Manage access collapsed.
