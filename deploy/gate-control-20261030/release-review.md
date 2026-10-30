# Gate control — pre-website release review

Reviewed 2026-10-30 after isolated testnet publication.

## Result

**PASS — no blocking release defect found.** The reviewed website integration
may proceed through its existing deployment and production-verification steps.
This review does not claim that the website has already deployed or that a real
owner has signed, linked or jumped through the new integration.

## Publication and provenance

- Reviewed committed package source:
  `1ca6141b7a257e6d57b054a4ec73f27be3be2561`, tagged
  `publish/cradleos-gate-2026-10-30-reviewed`. The Move package is explicitly
  present in that commit, including manifest, lock, module and tests.
- `clean-build.json` records an exact independently reconstructed committed
  build using world commit `d33ff232bd3878e8f9ad0721e18564b21facc925`.
- Publication:
  `9fFAyFpXi1rfc83eN5cTYjoX1on5H2ZPc1TrzG7tRoYW`.
- Package:
  `0x52a273e9250744b72fdbd242ebeb89bb0ed0606857c9028963abfd6c1645434e`.
- Registry:
  `0x193257f2f5b1d07e7dec512c7678f94d6a9bb1e8612f7b3a6825e110d2125755`.
- The frontend deployment pin matches the publication receipt and current
  world dependency.

In addition to reading the release receipts, this reviewer independently fetched
the live package, registry, UpgradeCap and publication transaction through the
official Sui testnet gRPC endpoint. Publication is successful; both registry
tables remain empty; the publisher retains the UpgradeCap. Normalizing the one
published module self-address reproduces reviewed compiled SHA-256 exactly:
`56476a7b1c2b147f47672e83b02fdf9212a82b35eaa94491a84d70253dc6c245`.
Receipt verification also confirms exact transaction effects and zero gate
writes; the sole changed pre-existing object was publication gas.

## Runtime delta since feature review

- Pinned verified package/registry IDs; no contract source change.
- History transport retries are bounded to three attempts for transient
  network/429/502/503/504 failures. HTTP failures, GraphQL errors, incomplete
  history and exhausted retries remain failures, never empty-success results.
  Two added regression cases cover transient recovery and GraphQL failure.
- After route creation, selecting its gate resolves to the newly discovered
  active route. Existing route-ID-dependent detail loading resets review,
  consent and history state for that transition.
- The QA gate-ID attribute only exposes an already public chain object ID.

## Evidence and its limits

- `live-flow-summary.json`: seven checks-enabled unsigned simulations, a raw
  gRPC shape simulation, real-pair archival admission, unchanged gate versions
  and an empty registry afterward. No simulation was submitted.
- The current-EVE route was exercised with zero-fee permits/pass/claim. The
  nonzero paid flow used generic SUI because the candidate held no EVE. This
  verifies generic monetary execution, **not a nonzero live EVE payment**.
- `captured-json-reader.json`: the production `readGateRoute` parsed a genuine
  simulation-captured EVE Route JSON body. Registry/object metadata were
  explicitly synthetic for this offline replay; it was not a live route sale.
- `preview-browser.json`: release preview with actual chain data, a synthetic
  read-only wallet, activation review without signing, archival admission,
  read-failure recovery, disconnect cleanup and four viewport widths. Zero
  signing/write attempts and no page errors. TLS validation was preserved.
- The fixture-browser suite was rerun after the final UI change. Its coverage
  complements rather than substitutes for the real-chain preview checks.

The prior feature review's authorization, amount, stale-quote, current-extension
and historical-admission findings remain resolved. Reporting still distinguishes
permits/passes/revenue from completed native jumps.

## Remaining operational verification

Actual EVE Vault destination selection, owner signing, paid EVE passage and a
native player jump remain unverified. They require a real owner-operated flow;
no such player action was fabricated or performed during release review.

No runtime source was edited and no transaction was submitted by this reviewer.
