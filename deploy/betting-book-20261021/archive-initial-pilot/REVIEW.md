# Independent review record

Parent summary of native reviewer `betting_architecture_review`, October 21.
The workspace requests an Opus milestone review, but that model was not an
available native target; the inherited available reviewer model was used.
This is not represented as an Opus review or independent third-party audit.

## Architecture — PASS after corrections

- Official current-world Killmail objects and canonical derived registry IDs
  are appropriate for positive-event proofs, with game-admin publication trust.
- A caller cannot prove "first kill" or complete event absence. Use only the
  expressly defined submitted-proof contest with fixed proof deadline.
- Freeze character keys, tenant, registry, loss type/system and all times.
- Do not claim victim ID proves historical ownership or filters self/alt kills.
- Replace arbitrary last-claimant dust with cumulative entitlement arithmetic;
  preserve exact conservation and less-than-one-atom deviation from ideal share.
- Keep new book independent from paused casino House and existing state.

## Implementation — PASS after fixes

No contract fund-loss/settlement blocker identified in reviewed source. Reviewer
flagged two frontend correctness issues, both corrected before the final pass:

1. Polling can change the default active market after bet confirmation. Capture
   `{marketId, wallet, side, stake}`, reset on relevant changes and reject
   mismatches before execution; browser regression proves invalidation.
2. Transferred character's old PlayerProfile can remain discoverable. Re-read
   current official Character object type/address/tenant before selecting it;
   a unit test proves stale candidates are skipped.

Final review independently ran the 19 book-specific frontend tests and inspected
browser evidence. Reviewed contract invariants and existing-casino isolation
remained sound. Approval covers staged source only, not publication, external
audit certification, full event completeness, or live wallet-to-chain E2E.
