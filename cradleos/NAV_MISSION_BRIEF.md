# CradleOS — Navigator Mission Brief
## Hackathon Sprint: March 11-31, 2026

---

## Mission
Build CradleOS — a wallet-native corporation command stack for EVE Frontier on Sui Move.
Hackathon: EVE Frontier × Sui 2026. Prize pool: $80k. Submission deadline: March 31.
This is the real work. Not training. Not warmup.

## Your Role
You are Navigator. You write Move modules, build, test, fix, and repeat until tests pass.
You do NOT wait for Captain to review every step. Tests are the gate. If `sui move build` and `sui move test` pass — it's done. Surface only when: all tests pass, or you're stuck after 3 attempts.

## Full Module Spec
Read: `/home/agent-raw/.openclaw/workspace/frontier/cradleos/MODULE_SPEC.md`

## Build Order (strict — each depends on prior)
1. `sources/registry.move` — corp directory, no deps
2. `sources/corp.move` — membership + roles, needs registry
3. `sources/treasury.move` — corp funds with real SUI (Balance<SUI>), needs corp
4. `sources/gate_control.move` — Smart Gate access control, needs corp
5. `sources/contributions.move` — contribution tracking, needs corp

## Package Location
`/home/agent-raw/.openclaw/workspace/frontier/cradleos/`

## Build/Test Commands (sync workspace → DGX, then test)
```bash
# Sync
rsync -a /home/agent-raw/.openclaw/workspace/frontier/cradleos/ rawdata@100.78.161.126:/tmp/cradleos/

# Build + test
ssh -i ~/.ssh/id_ed25519 rawdata@100.78.161.126 '
export PATH="/home/rawdata/.local/bin:$PATH"
cd /tmp/cradleos
sui move build 2>&1 && sui move test 2>&1
'
```

## Acceptance Criteria (every module — no exceptions)
- `sui move build` — zero errors
- `sui move test` — 100% pass
- `public struct` on all struct declarations (Move 2024 required)
- Named `const` error codes (not bare numbers in asserts)
- Events emitted on every state change
- Auth checked on all mutating functions
- `let mut` on reassigned locals
- `i = i + 1` not `i += 1`
- No overflow without checked arithmetic

## Key Move 2024 Gotchas (from training run)
- All structs: `public struct Foo has ...` not `struct Foo has ...`
- Mutable locals: `let mut i = 0` not `let i = 0`
- Compound assignment doesn't exist: `i = i + 1` only
- Use `sui::test_scenario` for tests that need different senders
- `std::unit_test::destroy` (not deprecated `sui::test_utils::destroy`)
- Don't re-import auto-provided aliases (UID, ID, TxContext, Self)

## DGX Build Environment
- Sui CLI: `/home/rawdata/.local/bin/sui` (v1.67.2)
- Deploy wallet: `0xc80fe7d6043f0c23ee30dc45c8b1036d079e11d149c4eff9ab0cbd0310803023`
- Testnet RPC: `https://fullnode.testnet.sui.io:443`
- Utopia RPC: `https://fullnode.testnet.sui.io:443` (Utopia is live — same as standard testnet)

## What Captain Handles (not your job)
- Integration testing across modules
- Testnet deployment
- GitHub + submission packaging
- Demo recording

## Status as of March 10
- Package scaffold ready at `frontier/cradleos/sources/`
- Sui CLI permanent on DGX
- 18/18 training tests passed — Move patterns confirmed working

---
*Begin executing at hackathon launch: March 11, 9 AM CT.*
