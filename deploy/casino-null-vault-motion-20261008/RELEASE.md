# Web-only casino and readable Null Vault — 2026-10-08

Live: https://cradleos.io/#/casino

- Runtime source: `1eafa70dcdfe31c9041432f177d471823d9a2bfe`.
- Pages: `ace82e52-9c42-4ba5-81ff-f77da691f66c`.
- Previous Pages: `91253fe3-fbde-4c53-8bb3-0bc6b6d4ced3` (retired station UI).
- Older web-only baseline: `934b20d7-7c3b-428a-9035-c619e4881e42`.

## Delivered

Raw first reported unreadably fast Null Vault animation, then explicitly rejected
the walk-in station and requested web-only play. Both requests are completed.

Null Vault now scans neutral closed sockets, then opens them progressively with
660ms flips. The final socket finishes at 2760ms; the saved reveal advances once
at 3400ms, leaving a readable result pause. Previously locked tokens stay still,
and known breach status is preserved. A full initial vault uses a distinct
collection-only sequence (1750ms), with no fictional respins. Covered saved
boards also conceal outcome-coloured cells. Reduced motion, explicit Reveal all,
mute and cancellation behavior remain available; outcomes and payouts are unchanged.

The native station renderer and gateway are stopped and disabled. Verified native
Wine cleanup completed; no active-run sentinel or cleanup-required gate remains.
Only Funnel10000 was removed; independent full-configuration fingerprint matches
the pre-pilot baseline. Private gateway/VNC routes were not changed. Station
navigation, native route mount and Assembly preset are removed. Old station links
open the web casino. Archived native source is marked retired, not deleted or
authorized for automatic restart. The production JS contains no native endpoint
or renderer client. No wallet/signature, funding or testnet-wager change occurred.

## Verification

- 319 tests / 34 files, TypeScript, Origins eight checks, dependency IOC scan and
  production build passed. Ten outcome/session/donation/audio source files are
  byte-identical to the previous release.
- Source temporal checks at 320/390/1440 covered initial spin, added-token respin,
  empty respin and full-grid collection. Six cancellation/reload/rapid/skip checks
  passed. The initial probe's obsolete final skip click was corrected; that was
  a harness timeout after its 21 completed assertions, not a gameplay failure.
- Compiled preview and actual live site each passed 12 checks, including fresh
  RNG play, exact displayed receipts, one cursor update, unchanged saved balance,
  mobile layout and retired-link routing. No JavaScript page exceptions.
- Actual live JS/CSS match the reviewed bytes; hashes in `qa/live-build.json`.
- Independent source/operational review passed; final live review is recorded
  alongside this receipt. Known wallet-SDK external console diagnostics are not
  claimed fixed. Sound opt-in code is unchanged; physical-device audio not measured.

Do not restart native station services as part of any app rollback. If a web
rollback becomes necessary, prefer the older web-only baseline or a targeted fix;
the immediately preceding release exposes a now-retired station entry.
