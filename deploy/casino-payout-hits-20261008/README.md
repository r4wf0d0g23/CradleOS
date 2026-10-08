# Paying-hit feedback release — 2026-10-08

- Runtime source: `f222d32e13c141620817fe86b4a85e1f7e5ca507`
- Cloudflare Pages: `4c8cbbda`
- Primary: https://cradleos.io/#/casino
- Immutable: https://4c8cbbda.cradleos-d75.pages.dev
- Rollback: `0c1d38f9` (previous payout-first release)

## Delivered change

Positive returns at or below the bet use a short two-note payout cue instead of
the loss cue. Above-bet payouts retain the stronger win cue. Active positive
receipts briefly highlight the exact payout amount. Positive nonterminal
free-spin awards get the short cue; terminal frames acknowledge the aggregate
only once. Existing earned bonus fanfares remain unchanged.

Exact payout and total bet remain visible, with truthful partial/bet-return
labels and accounting details. No odds, accounting, receipts, save schemas or
custody changes. Testnet wagering remains on HOLD; seed-only donations unchanged.

Fresh reveal ownership is ephemeral and follows a successful storage commit.
The effect cannot replay from reload, navigation, editing inputs or toggling
visibility/reduced motion. Mute, background teardown and reduced-motion
preferences are respected. Refill sequence-ID reuse cannot suppress a fresh hit.

## Evidence

See VALIDATION.md, preview-qa.json, live-qa.json, bonus-regression-qa.json,
implementation-review.md and public-verification.json.
280 tests / 28 files; 15 preview cases at 320/390/1440; 7 live mobile cases;
7 existing bonus cases; independent 33-test source/preview gate.
98 public hashes, both bundle references and icon API pass.
All 92 existing artwork files and reviewed economy/custody boundaries retained.

Physical-device audio listening/frame-rate measurements were not claimed.
Existing external SDK diagnostics and Vite chunk/import warnings remain.
Only this release's 5199/5200 servers were stopped; canonical worktree/shared
services remain intact. Independent live gate PASS; see live-review.md and live-hashes.json.
