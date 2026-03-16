# CradleOS — Design Document

**Project:** CradleOS — On-chain Tribe Economy Stack for EVE Frontier  
**Network:** Sui Testnet  
**Status:** Live — deployed V7–V14 contracts + standalone packages  
**Hackathon:** EVE Frontier × Sui 2026 · March 11–31

---

## Architecture Overview

CradleOS provides tribe founders and members with on-chain infrastructure for:
- Tribe token economy (CRDL)
- Defense policy management
- Gate access control
- Role delegation
- Cargo contracts and ship insurance
- Bounty boards and announcements

All contracts are deployed as **shared objects** on Sui testnet. The dApp at `r4wf0d0g23.github.io/CradleOS/` provides a browser interface. The dApp also runs in the EVE Frontier in-game browser when a structure URL is set.

---

## Contract Suite

### Core (V7 — `0x036c2c...afade`)
- **`tribe_vault`** — CRDL token + treasury. Founder-owned shared object. Members tracked via dynamic fields.
- **`defense_policy`** — Security levels (GREEN/YELLOW/RED), turret aggression mode, tribe relations.
- **`cargo_contract`** — Trustless delivery with proof-of-delivery bond. Auto-settlement via oracle.
- **`bounty_board`** — On-chain bounties with CRDL reward.
- **`announcement_board`** — Tribe announcements.
- **`wiki_board`** — Community lore wiki.
- **`corp_registry`** — Tribe claim registration (tribe_id → vault + character mapping).

### Turret Delegation (V10 — `0x6d2ef8...073f`)
- **`turret_delegation`** — Member-owned `TurretDelegation` objects linking structure → tribe vault. No TribeVault dependency (avoids cross-package type mismatch).

### Cargo V2 (V11 — `0xf572af...dccc`)
- **`cargo_contract`** — Trustless delivery v2. `tx_digest` of `ItemMintedEvent` as proof-of-delivery bond.

### Ship Reimbursement (V12 — `0x30557f...fd7`)
- **`ship_reimbursement`** — SRP + combat insurance. Killmail object ID as POD proof.

### Player Relations (V14 — `0xcc3a03...1af`)
- Extends `defense_policy` via dynamic fields — per-player HOSTILE/FRIENDLY overrides.

### Standalone Packages
- **`TRIBE_ROLES_PKG`** (`0x1686b3...79bf`) — Admin/Officer/Treasurer/Recruiter role delegation
- **`GATE_POLICY_PKG`** (`0x398d1f...b14`) — Gate access control (OPEN/TRIBE ONLY/ALLIES/CLOSED)

---

## Design Principles

### No TribeVault Type Dependency in Secondary Packages
Early deployments passed `&TribeVault` directly into extension functions. This caused `TypeMismatch` errors because the vault's package address (V7) differs from the calling package address. 

**Solution:** Standalone packages (`tribe_roles`, `gate_policy`, `turret_delegation`) take `vault_id: address` and `tribe_id: u32` as raw values. The caller attests ownership; no cross-package type import required.

### Shared Objects for Policy, Owned Objects for Delegation
- Policy objects (TribeDefensePolicy, TribeGatePolicy, TribeRoles) are **shared** — all members can read them.
- Delegation objects (TurretDelegation, GateDelegation) are **owned** by the member — they hold them in their wallet.

### Oracle Settlement
Cargo contracts and SRP claims have a dispute window. An oracle process (running on Jetson1 at port 8899) polls for expired contracts and auto-submits `finalize_*` transactions via `oracle_tx.mjs`.

### Sponsored Transactions
Metadata updates (name, description, URL on assemblies) use CCP's sponsored transaction backend via `useSponsoredTransaction()` — zero gas cost for users with EVE Vault.

---

## In-Game Integration

The dApp URL can be set on any assembly via `update_metadata_url`. When a rider presses **F** near the structure in EVE Frontier, the in-game browser opens and loads CradleOS. EVE Vault is pre-injected so wallet connection works without leaving the game.

The launcher integration (⚓ CradleOS button) is a patched `app.asar` for the EVE Frontier Electron launcher.

---

## Agent Integration (in progress)

A read-only AI agent proxy (`cradleos-agent-proxy/`) runs on the DGX Spark GB10, fronting `Nemotron-3-Super-120B-A12B-NVFP4` via vLLM. The proxy:
- Injects CradleOS + EVE Frontier system prompt
- Logs all query/response pairs for training data
- Exposes OpenAI-compatible API at port 4403
- Pluggable: users can swap in their own endpoint

Training goal: fine-tune Nemotron3-Super on EVE Frontier + Sui Move domain data.
