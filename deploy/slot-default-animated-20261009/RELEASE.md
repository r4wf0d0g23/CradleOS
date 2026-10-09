# Animated slot default — October 9, 2026

Raw explicitly requested: “default to animated, not reduced.”

Two-line runtime delta: missing/invalid/unreadable cosmetic preference now defaults to Animated. Explicitly saved System or Instant remains respected. Prior release did not persist its implicit System default, so existing users without an explicit choice receive Animated after refresh. Preference remains practice-slot-only; other games, accounting, outcomes and transaction gates unchanged. No migration, wallet signing, backend or chain writes.

Independent inherited-model source review PASS. TypeScript/build, Origins8, exact-directory IOC scanner and whitespace checks pass. This two-line change is verified with targeted browser tests, not a claimed new full-suite run.

## Browser/release
Seven production-build preview scenarios pass: fresh desktop OS-reduced+Animated, fresh mobile normal+Animated, fresh classic OS-reduced+Animated, invalid preference, blocked preference read, explicit System and explicit Instant. Actual rendered transforms change in animated cases; explicit reduced modes finish quickly. Every fresh RNG spin stays one sequence/debit and result/history/balance unchanged during reveal. No page errors/overflow. Existing-choice fixtures initialize the current-world marker first; otherwise the intentional first-visit cycle cleanup removes preloaded operational keys. No change to that cleanup logic. qa/preview-browser.json.

Source9aafe611bec8f4ca8c3b2bf3f1e9780cfbfe16f6 pushed; Pages production6238a7eb (https://6238a7eb.cradleos-d75.pages.dev), primary https://cradleos.io/#/casino. Previous07611d3e.

Actual production fresh desktop1440 OS-reduced (Scrapyard) and mobile390 normal (classic) automatically select Animated with no preference click. Actual rendered transforms move; one fresh RNG spin each, committed result/history/balance preserved, no page errors/overflow. Two live scenarios, not a claimed repeat of all seven preview cases. No wallet or chain actions. qa/live-browser.json.

Both public bundles byte-match reviewed dist: JSindex-CmQUhBcL.js SHA2569ae114428eea2eb0808e9e92c34e874019776df88d37d1fd1bb54da1afa412c6; CSSindex-VOoReneF.css SHA256edb190a0e101d0ea6794f723048f7a53e2f50722642efa70bd56008a30867499 (unchanged). Source runtime unchanged after build; deployment-time uncommitted files only receipts and pre-existing Wrangler directories.

Final independent delivery review PASS: source/bundle alignment, unchanged CSS,7preview/2live scope and automatic Animated selection with actual movement verified. Task-owned5211preview stopped; live-index worktree/pre-existing Wrangler directories retained.
