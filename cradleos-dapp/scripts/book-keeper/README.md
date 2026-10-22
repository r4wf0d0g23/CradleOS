# Testnet book keeper

**Prepared, not installed or running in production.** No published book or funded
keeper exists yet. The example intentionally fails closed with blank IDs.

The keeper has no custody, outcome discretion, administrator cap, or selectable
payment recipient. It submits canonical signed Pyth updates, finalizes expired
markets, pays indexed shared entitlements, and refunds expired item rewards.
Onchain checks decide every result. Any wallet may trigger the same recovery
calls; losing a Character does not prevent a prior payout.

## Install after reviewed publication

1. Use the reviewed dapp checkout and its lockfile-installed Node dependencies.
2. Fill a private copy of `config.example.json` from actual publication receipts.
   Never use simulated IDs. Keep `liveEnabled:false` initially.
3. Use a new **dedicated gas-only Ed25519 signer** (one-entry Sui JSON keystore,
   mode0600, parent0700). Never use the deploy/AdminCap wallet. Record its public
   address in config and fund only bounded testnet SUI. No EVE or capabilities
   belong in this account.
4. Private environment file, mode0600, sets `BOOK_KEEPER_CONFIG`,
   `BOOK_KEEPER_STATE_DIR`, `BOOK_KEEPER_KEYSTORE_PATH`, and a securely provisioned
   `PYTH_API_KEY`. Credentials are never committed, printed, or entered in chat.
   The API origin is hard-pinned; redirects are refused. Protected-store entries
   are not assumed to appear in a systemd service: verify provisioning explicitly.
5. Run `node scripts/book-keeper/main.mjs` read-only. Require canonical chain,
   book and source checks; inspect `status.json`. Test authenticated first-crossing
   historical retrieval with a live supported feed, not only a decoder fixture.
6. Only after those checks, set live mode and install the supplied **user** service
   and timer. Enable with `systemctl --user enable --now cradleos-book-keeper.timer`.
   Check the timer, a funded signer, a successful autonomous run, and a real
   permissionless payout/refund receipt before claiming automation is live.

The main entry always re-execs through OS `flock` and verifies actual kernel lock
ownership before loading a signer. Manual starts therefore share the same lock.
One pass submits at most16 transactions; per-market claim scanning is bounded32;
reward discovery rotates128 entries per pass. Older terminal claims are skipped
using durable indexed cursors. Reward count never disables unrelated market work.
Oracle proof jobs take priority, then finalize and payout. Service health is local
`status.json` plus journal; it is **not yet a public UI monitoring endpoint**.

## Crash recovery and incident handling

The signed bytes, signature, digest and action are fsynced/renamed before broadcast.
Unknown outcomes retain that exact record. Restart first checks the digest, then
resends the same bytes. A definitive success or failure clears pending. An
unconfirmed response never clears it or creates another signed transaction.
Onchain payout/refund idempotency additionally prevents a second transfer.

A permanently unexecutable pending transaction (e.g. invalid gas object) stops
new signing. `status.json` reports its digest/action and blocked status. Recovery
is an operator incident, not an automatic timeout reset:

1. Stop the user timer and confirm the kernel lock is free.
2. Preserve the entire state directory, signed bytes, status and service journal.
3. Query the pending digest and original gas object/version through the canonical
   fullnode and indexed transaction history. Record responses, checkpoints and
   the reason the original transaction cannot execute. A timeout/404 by itself
   is **not** definitive rejection; a newer gas version alone does not prove the
   pending transaction never executed.
4. If the digest has a definitive result, restart normally so recovery records it.
   Otherwise, an operator must review the canonical target Market/Entitlement or
   Delivery state and expressly authorize quarantine of that exact pending entry.
   Keep the signed entry and evidence in an immutable incident receipt; do not
   delete it or present a retry as confirmed. All allowed actions are contract-
   guarded against double payout, but that does not make an unknown network result
   a known failure.
5. With the service stopped and backup preserved, an approved repair can replace
   only `pending` with null and retain all claim cursors/history. Recheck gas,
   restart, and verify actual target state/receipt. Never clear pending merely
   because a run is slow. Never change recipients, scores or prices in recovery.

No automatic quarantine/reset command is exposed. No unrequested user funds,
market creation, bets, wallet transfers or admin actions occur in the keeper.

## Checks

`node --test scripts/book-keeper/engine.test.mjs` tests frozen terms, clock gates,
canonical public proof selection, ambiguous outcomes, durable-before-broadcast
ordering, identical-byte recovery, and digest mismatch behavior. Move tests are
the authority for payment and refund conservation.
