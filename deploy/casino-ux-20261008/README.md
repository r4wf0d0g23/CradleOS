# Payout-first casino UX — October 8

User requested psychological/UX research and removal of prominent Net readouts.
Research and sourced design decisions: PLAN.md. This release favors clear visual
hierarchy and player comprehension, not loss concealment or chasing prompts.

- Primary result: Payout, exact settled Total bet and short truthful status.
- Round details retain the exact signed balance change and outcome explanation.
- Recent rounds collapse into one accessible disclosure, with Bet/Payout rows;
  multi-play breakdown retained inside it. No duplicate single-play receipt.
- Pending slot receipt and current history row are omitted entirely until revealed.
- Completed fleet no longer repeats stage/collected totals. Actual free-spin
  subtotal remains distinct from whole-round payout including the base spin.
- Optional measured-odds prose uses payout above bet rather than net profit.

All game engines, saved accounting, odds, audio/motion/bonus modules, donation and
paused testnet paths are unchanged. All 92 artwork files preserved. No wallet
connection, signature, funds transfer, contract change or activation.

277 tests/27 files; TypeScript/build, Origins 8 and IOC pass. Parent 21 UX preview
checks at320/390/1440, prior all-six-bonus390 and all-eight-slot320/1440 accounting
and storage checks pass. Independent source/preview PASS:36focused tests and12
cases including a bonus with a nonzero base, DOM/accessibility outcome masking,
keyboard focus and exact aggregate totals after changing the next-bet field.

Known inherited dormant testnet presentation deficiencies are recorded in PLAN.md
as pre-activation items, not fixed or approved by this practice-only release.
Known Vite mixed-import/large-bundle and external SDK/Slush metadata diagnostics
remain; no claim of an empty console or real-device measured FPS/audio listening.

Published runtime77c4b00a777f0a0d2a2717dc4bbd2761516d60c3, Pages0c1d38f9,
primary https://cradleos.io/#/casino; rollback230071f3. 98 public file hashes,
primary+immutable HTML bundle references and public icon API pass. Final browser
and independent public verdict are captured in the accompanying release receipt.

Final live gate PASS:14 parent live checks at390/1440 and independent320touch
including nonzero-base bonus proof. Receipt release.json; no financial actions.
Owned5199/5200 servers stopped. Runtime source and public hashes remain exact.
