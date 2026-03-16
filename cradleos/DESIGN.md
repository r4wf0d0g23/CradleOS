# CradleOS Corp Contract — Design Document

**Project:** CradleOS — Wallet-native Corporation Command Stack for EVE Frontier  
**Target:** Sui Move on EVE Frontier's `world` package  
**Modules:** `corp_registry`, `corp_gate`, `corp_treasury`  
**Status:** Skeleton / Architecture Phase

---

## 1. Patterns Found in World Contracts

### 1.1 Typed Witness Extension Pattern

The core extensibility mechanism in the `world` package. Every programmable assembly (Gate, StorageUnit, Turret) stores an `Option<TypeName>` field called `extension`. An extension module defines a **zero-sized drop struct** (the witness):

```move
public struct XAuth has drop {}
```

To register: `gate::authorize_extension<XAuth>(gate, owner_cap)` — this writes `type_name::with_defining_ids<XAuth>()` into the gate's `extension` field.

When calling privileged world functions (e.g., `issue_jump_permit<XAuth>`, `deposit_item<XAuth>`), the world contract verifies the extension field matches the type of the passed witness value. This means **only the module that defines `XAuth` can use it** — type-system enforced, not runtime address checks.

**CradleOS uses:** `CorpGateAuth` for Gate, `CorpTreasuryAuth` for SSU.

### 1.2 ExtensionConfig + Dynamic Field Rules

Seen in `tribe_permit` and `corpse_gate_bounty`: each extension has a shared `ExtensionConfig` object where rule structs (e.g., `TribeConfig`, `BountyConfig`) are stored as typed dynamic fields. This decouples the rule data from the assembly object itself.

**CradleOS deviation:** We merged the "extension config" into the `CorpRegistry` (for registry-level data) and store per-assembly state as dynamic fields directly on the Gate / SSU object. This is slightly simpler for a single-corp-per-assembly design.

### 1.3 OwnerCap Capability Pattern

`OwnerCap<Gate>` and `OwnerCap<StorageUnit>` are capabilities held by the character that owns the assembly. World functions that mutate assembly state require the matching cap. Caps are transferred to the Character object and can be borrowed with a hot-potato receipt pattern.

**CradleOS uses:** Callers pass `OwnerCap<Gate>` to `authorize_on_gate` and `OwnerCap<StorageUnit>` to `initialize_treasury`. After authorization the extension manages operations without requiring cap each time.

### 1.4 Hot Potato Pattern

Seen in `turret.move` (`OnlineReceipt`) and in `network_node` ops (`OfflineAssemblies`, `HandleOrphanedAssemblies`). A value with no `drop` ability is returned and must be explicitly consumed by the correct function. Ensures correctness of multi-step call sequences.

**CradleOS:** Not used in v1 skeleton. Could apply to multi-gate auth flows in future.

### 1.5 AdminACL Sponsored Transactions

Many world functions require `admin_acl.verify_sponsor(ctx)` — meaning the transaction must be co-signed by an authorized game server. This applies to `jump`, `jump_with_permit`, `anchor`, etc. Extension-level functions that don't mutate world assemblies directly do not need this check.

**CradleOS impact:** `issue_jump_permit` and `deposit_item` / `withdraw_item` are world functions called FROM extension code. The extension call itself doesn't need `admin_acl`, but the final `jump_with_permit` called by the game client will need it.

### 1.6 Character as On-Chain Identity

`Character` is a shared object with:
- `id: UID` — deterministic on-chain ID, usable as a membership key
- `character_address: address` — the player's wallet address (tx sender)
- `tribe_id: u32` — game tribe affiliation
- `owner_cap_id: ID` — links to the character's OwnerCap

CradleOS membership is keyed on **`object::id(&character)`** (the Character UID), not wallet address. This allows multi-character accounts and is consistent with how `JumpPermit` binds to `character_id`.

### 1.7 Shared Object Mutability

Both `Gate` and `StorageUnit` are shared objects. Extensions must pass mutable references (`&mut Gate`) for write operations. `CorpRegistry` is also shared — all three modules share a reference to it without ownership.

---

## 2. CradleOS Module Architecture

```
┌─────────────────────────────────────────────┐
│             cradleos::corp_registry          │
│  CorpRegistry (shared)                       │
│  - name: String                              │
│  - commander: address                        │
│  - members: vector<ID>                       │
│  - member_table: Table<ID, bool>  (O(1) lookup)│
│  CommanderCap (key, store)                   │
└───────────┬─────────────────┬───────────────┘
            │ &CorpRegistry   │ &CorpRegistry
            ▼                 ▼
┌───────────────────┐  ┌────────────────────────┐
│ cradleos::corp_gate│  │cradleos::corp_treasury │
│                   │  │                        │
│ CorpGateAuth      │  │ CorpTreasuryAuth        │
│ (witness: drop)   │  │ (witness: drop)         │
│                   │  │                        │
│ CorpGateConfig    │  │ TreasuryState           │
│ (dyn field on     │  │ (dyn field on SSU)      │
│  Gate object)     │  │  - item_type_id         │
│  - corp_id        │  │  - total_balance        │
│  - permit_ms      │  │  - member_balances:     │
│                   │  │    Table<ID, u64>       │
│ Hooks:            │  │                        │
│ gate::authorize   │  │ Hooks:                  │
│ gate::issue_permit│  │ ssu::authorize_extension│
│                   │  │ ssu::deposit_item<Auth> │
│                   │  │ ssu::withdraw_item<Auth>│
│                   │  │ ssu::deposit_to_owned   │
└───────────────────┘  └────────────────────────┘
```

---

## 3. Module Summaries

### 3.1 `corp_registry.move`

**Purpose:** Single source of truth for corp identity and membership. Referenced by all other CradleOS modules.

**Key Structs:**
- `CorpRegistry { id, name, commander, members, member_table }` — shared object
- `CommanderCap { id, corp_id }` — capability object, transferred to founder wallet

**Key Functions:**
| Function | Auth | Description |
|---|---|---|
| `create_corp(name)` | Public | Create registry, share it, issue `CommanderCap` to sender |
| `add_member(registry, cap, character_id)` | CommanderCap | Add character to member list |
| `remove_member(registry, cap, character_id)` | CommanderCap | Remove character from member list |
| `transfer_command(registry, cap, new_addr)` | CommanderCap (consumed) | Transfer command, mint new cap |
| `is_member(registry, character_id)` | View | O(1) Table lookup |

**Events:** `CorpCreatedEvent`, `MemberAddedEvent`, `MemberRemovedEvent`, `CommandTransferredEvent`

### 3.2 `corp_gate.move`

**Purpose:** Restricts gate usage to corp members via the typed witness extension pattern.

**Key Structs:**
- `CorpGateAuth {}` — zero-sized drop witness, registered on Gate
- `CorpGateConfig { corp_id, permit_duration_ms }` — stored as dynamic field on the Gate object

**Key Functions:**
| Function | Auth | Description |
|---|---|---|
| `authorize_on_gate(gate, registry, cap, owner_cap)` | CommanderCap + OwnerCap<Gate> | Register extension + store config |
| `request_jump_permit(registry, src, dst, character, clock)` | Membership check | Issues `JumpPermit` if character is corp member |
| `set_permit_duration(gate, registry, cap, ms)` | CommanderCap | Update permit validity window |

**Events:** `CorpGateAuthorizedEvent`, `CorpJumpPermitIssuedEvent`, `CorpGatePermitDurationUpdatedEvent`

**Flow:**
```
Commander: authorize_on_gate(gate_A) + authorize_on_gate(gate_B)
Member:    request_jump_permit(gate_A, gate_B, character)
             → gate::issue_jump_permit<CorpGateAuth>(...)
             → JumpPermit transferred to character wallet
Client:    gate::jump_with_permit(gate_A, gate_B, character, permit, ...)
             → permit burned, JumpEvent emitted
```

### 3.3 `corp_treasury.move`

**Purpose:** Corp bank — SSU extension tracking per-member item deposits with commander drain.

**Key Structs:**
- `CorpTreasuryAuth {}` — zero-sized drop witness, registered on SSU
- `TreasuryState { corp_id, item_type_id, total_balance, member_balances }` — dynamic field on SSU
- `TreasuryStateKey {}` — dynamic field key

**Key Functions:**
| Function | Auth | Description |
|---|---|---|
| `initialize_treasury(ssu, registry, cap, owner_cap, item_type_id)` | CommanderCap + OwnerCap<SSU> | Register extension + create ledger |
| `deposit(ssu, registry, character, owner_cap, qty)` | Membership check | Move items owned→corp inventory, credit balance |
| `withdraw(ssu, registry, character, qty)` | Membership + balance check | Move items corp→owned inventory, debit balance |
| `commander_withdraw_all(ssu, registry, cap, character)` | CommanderCap | Drain entire treasury to commander |

**Events:** `TreasuryInitializedEvent`, `TreasuryDepositEvent`, `TreasuryWithdrawEvent`, `TreasuryCommanderDrainEvent`

---

## 4. Key Design Decisions

### 4.1 Character ID as Membership Key

Members are keyed by `object::id(&character)` (the `Character` UID), not by wallet address. This is stable, unique on-chain, and consistent with how the world's `JumpPermit` works. A single wallet can own multiple characters with separate membership states.

### 4.2 Flat member_table for O(1) Lookup

The `vector<ID>` member list is O(n) for lookup but needed for ordered display and iteration. The parallel `Table<ID, bool>` enables O(1) membership check at runtime (used during gate permit issuance and treasury operations). Updates must maintain both.

### 4.3 Single Currency Treasury

The treasury is scoped to a single `item_type_id` (designated at initialization). This simplifies accounting, mirrors EVE's ISK paradigm, and avoids complex multi-asset balance tracking. Future versions can add a `Table<u64, TreasuryState>` mapping type_id → state.

### 4.4 Commander Drain Balance Zeroing

When `commander_withdraw_all` is called, we zero `total_balance` but cannot efficiently zero all `member_balances` entries in the `Table` (Move Tables don't support bulk iteration/reset). Three approaches:
1. **Generation counter (recommended):** Add `drain_generation: u64` to `TreasuryState`. Each member balance entry stores `(generation, amount)`. A balance is valid only if its generation matches current.
2. **Manual reset:** Commander calls a separate `reset_member_balance(character_id)` for each member after drain.
3. **Accept stale state:** Treat post-drain balances as stale; clamp `withdraw()` to `min(member_balance, total_balance)`.

Current skeleton uses approach 3 (simplest for demo). Production should use approach 1.

### 4.5 Dynamic Field Storage on Assembly

Extension config (`CorpGateConfig`, `TreasuryState`) is stored as dynamic fields directly on the Gate / SSU objects rather than in a separate `ExtensionConfig` shared object. This keeps all assembly-related state co-located and reduces the number of shared objects. The tradeoff: the Gate/SSU must expose `uid_mut` or similar for extension writes.

**Blocker:** The current `world::gate` and `world::storage_unit` modules do not publicly expose `uid_mut` for third-party use. The examples use the `ExtensionConfig` pattern (a separate shared object owned by the extension) specifically to avoid needing raw UID access. **We may need to follow the same pattern and store `CorpGateConfig` in a separate shared `ExtensionConfig` object rather than directly on the Gate.**

---

## 5. Blockers & Open Questions

### 5.1 UID Access for Dynamic Fields on Assemblies

The example extensions (`tribe_permit`, `corpse_gate_bounty`) don't write dynamic fields onto the `Gate` or `StorageUnit` directly. Instead they use a separate `ExtensionConfig` shared object (from `extension_examples::config`). This suggests the world package does NOT expose `gate.uid_mut()` or `storage_unit.uid_mut()` to external packages.

**Resolution needed:** Either:
- Add a separate `CorpGateExtensionConfig` and `CorpTreasuryExtensionConfig` shared object (follow examples pattern), OR
- Confirm that the world package provides an extension UID accessor we haven't seen yet

The skeleton files assume uid access exists for clarity — production code will need the separate config object pattern.

### 5.2 CommanderCap Import Across Modules

`corp_gate` and `corp_treasury` both need `CommanderCap` to validate commander-only operations. Since `CommanderCap` is defined in `corp_registry`, both modules import it. This creates a dependency chain:
```
corp_gate → corp_registry
corp_treasury → corp_registry
```
This is fine in Sui Move (no circular deps here), but the `Move.toml` for the `cradleos` package must declare `world` as a dependency.

### 5.3 Both Gates Must Use Same Extension Type

The world enforces that `source_gate` and `destination_gate` must have the same extension `TypeName` when issuing a permit. This means:
- A commander must call `authorize_on_gate` on BOTH ends of the gate pair.
- If the destination gate is owned by a different player, they must also register `CorpGateAuth` — which requires them to hold a `CommanderCap`. This may not be practical for cross-corp gate pairs.

**Potential solution:** Gate B's owner grants the corp commander a separate `OwnerCap` delegation, or the world team makes destination extension check optional.

### 5.4 Deposit Flow Requires Items in Owned Slot First

The treasury deposit flow requires the member to first deposit items into their owned inventory slot in the SSU (`deposit_by_owner`), then call `corp_treasury::deposit()` to move them to the corp slot. This is two transactions. A single-step deposit from character inventory (not SSU) would require a different flow.

**Consider:** A `deposit_from_character_inventory(character, ssu, ...)` function that moves items directly from an in-game character inventory to the corp SSU in one transaction.

### 5.5 `withdraw_by_owner` requires `ctx.sender() == character.character_address()`

The world's `withdraw_by_owner` enforces that the tx sender IS the character's address. This means the `deposit()` function in the treasury can only be called by the character themselves — not by the commander on their behalf. This is actually desirable for security.

### 5.6 Move.toml Configuration Needed

The `cradleos` package needs a `Move.toml` specifying:
- Published address for `cradleos`
- Dependency on `world` (the EVE Frontier world package address)
- Dependency on `sui` framework

A starter `Move.toml` should be created before attempting to build.

---

## 6. Suggested Next Steps

1. **Create `Move.toml`** — wire up `world` dependency and package address.
2. **Resolve UID access question** — check if `world` exposes UID for extension dynamic fields, or adopt the `ExtensionConfig` pattern from examples.
3. **Implement `corp_registry` first** — it has no world dependencies and can be tested standalone.
4. **Implement `corp_gate`** — test with a local world package fork.
5. **Add generation counter to treasury** — for correct post-drain balance semantics.
6. **Write PTB (Programmable Transaction Block) scripts** — for multi-step flows (authorize both gates, deposit flow, etc.)
7. **Integration test** — deploy on Sui Testnet with a test world package instance.

---

## 7. File Inventory

| File | Description |
|---|---|
| `corp_registry.move` | Corp identity & membership shared object + CommanderCap |
| `corp_gate.move` | Gate extension — member-only JumpPermit issuance |
| `corp_treasury.move` | SSU extension — corp bank with per-member balance ledger |
| `DESIGN.md` | This document |

*Future additions: `corp_turret.move` (member-exempted auto-defense), `corp_hangar.move` (multi-asset SSU), `corp_beacon.move` (member broadcast events)*
