# Animated slot default — October 9, 2026

Raw explicitly requested: “default to animated, not reduced.”

Two-line runtime delta: missing/invalid/unreadable cosmetic preference now defaults to Animated. Explicitly saved System or Instant remains respected. Prior release did not persist its implicit System default, so existing users without an explicit choice receive Animated after refresh. Preference remains practice-slot-only; other games, accounting, outcomes and transaction gates unchanged. No migration, wallet signing, backend or chain writes.

Independent inherited-model source review PASS. TypeScript/build, Origins8, exact-directory IOC scanner and whitespace checks pass. This two-line change is verified with targeted browser tests, not a claimed new full-suite run.

## Browser/release
Seven production-build preview scenarios pass: fresh desktop OS-reduced+Animated, fresh mobile normal+Animated, fresh classic OS-reduced+Animated, invalid preference, blocked preference read, explicit System and explicit Instant. Actual rendered transforms change in animated cases; explicit reduced modes finish quickly. Every fresh RNG spin stays one sequence/debit and result/history/balance unchanged during reveal. No page errors/overflow. Existing-choice fixtures initialize the current-world marker first; otherwise the intentional first-visit cycle cleanup removes preloaded operational keys. No change to that cleanup logic. qa/preview-browser.json.

Publication/live verification pending.
