# Cycle 7 visible-copy audit — October 2, 2026

Raw requested that the title-bar cycle/name be updated and remaining text checked.
This is a frontend text/link release; no contract, wallet or financial state changes.

## Changes

- Home-page topbar and Flappy Frontier use the existing shared `CURRENT_CYCLE`
  (Cycle 7 · Vestiges), instead of hardcoded Cycle6/Sanctuary or Cycle5 labels.
  Browser-tab/social titles were already correct and stay unchanged.
- Expired Sanctuary countdown is no longer mounted. Separate Era6/Awakening
  label is unchanged; a cycle number is not evidence of an era change.
- Voting help matches the current Open/One, Public, SingleChoice/Approval release,
  no recasts, voter-paid gas. Removed unsupported Q4 promise/internal planning
  references; corrected quadratic credit-cost explanation to votes squared.
- Casino help and bankroll tooltip describe the current fresh house, with funding
  and wagering still paused. No previous-cycle bankroll wording.
- Wiki describes current Core package from configuration, the fresh deployment,
  current site URL, and no longer asserts a hardcoded live tribe count of two.
- Game Data is explicitly a historical Cycle5/6 client archive. Metadata provenance
  remains Sanctuary, not relabeled as Vestiges. Categories/deltas/event descriptions
  no longer imply current-cycle validation. GLB stand-ins remain labeled illustrative.
- Game Data already appeared in both public navigation menus; adding it to the
  renderer's public-tab set fixes the inconsistent wallet gate. It only serves
  static JSON/GLB content, not wallet data or transaction controls.
- Community card and generated kiosk/preset links use cradleos.io instead of old
  GitHub Pages. Alternate-server URLs and legacy URL recognition remain intact.

## Verification scope

- TypeScript/Vite build and 102 existing frontend tests pass.
- Independent copy review approved, including public archive visibility and URL changes.
- Browser QA explicitly includes the actual home page at desktop and mobile widths;
  older hash-route checks used kiosk layout and therefore did not cover its topbar.
- Game Data QA uses Home → Game Data navigation; no new direct route is introduced.
- Deployment receipt and final live browser results are recorded in `copy-release.json`.
- Contract state and the deferred backup follow-up from the activation release are unchanged.
