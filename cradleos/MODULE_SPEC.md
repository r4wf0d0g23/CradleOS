# CradleOS — Module Specification
## Hackathon: EVE Frontier × Sui 2026 (Mar 11-31)

---

## Package Config
```toml
[package]
name = "cradleos"
version = "0.1.0"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "testnet-v1.67.2" }

[addresses]
cradleos = "0x0"
```

---

## Module 1: `cradleos::registry`
**Purpose:** Root object — on-chain directory of all CradleOS corps.

### Structs
```
public struct Registry has key {
    id: UID,
    admin: address,          // platform admin
    corp_count: u64,
}

public struct CorpRegistered has copy, drop {
    corp_id: ID,
    name: vector<u8>,
    founder: address,
}
```

### Functions
- `create_registry(ctx): Registry` — one-time init, returns shared object
- `register_corp(registry: &mut Registry, corp: &Corp, ctx)` — called by corp on creation

### Tests Required
- Registry creation sets admin to sender
- Corp registration increments corp_count
- Only Corp objects (by type) can register

---

## Module 2: `cradleos::corp`
**Purpose:** Core corporation object. Membership management, roles, EVE Frontier corp identity.

### Structs
```
public struct Corp has key {
    id: UID,
    name: vector<u8>,
    founder: address,
    members: vector<address>,
    member_roles: vector<u8>,   // parallel to members: 0=member, 1=officer, 2=director
    active: bool,
}

public struct MemberCap has key, store {
    id: UID,
    corp_id: ID,
    member: address,
    role: u8,
}

public struct CorpFounded has copy, drop { corp_id: ID, name: vector<u8>, founder: address }
public struct MemberJoined has copy, drop { corp_id: ID, member: address, role: u8 }
public struct MemberRemoved has copy, drop { corp_id: ID, member: address }
public struct RoleChanged has copy, drop { corp_id: ID, member: address, new_role: u8 }
```

### Error Constants
```
const ENotFounder: u64 = 0;
const ENotOfficer: u64 = 1;
const EAlreadyMember: u64 = 2;
const EMemberNotFound: u64 = 3;
const EInvalidRole: u64 = 4;
const ECorpInactive: u64 = 5;
```

### Functions
- `found_corp(registry: &mut Registry, name: vector<u8>, ctx): Corp` — creates Corp + MemberCap for founder
- `add_member(corp: &mut Corp, member: address, role: u8, cap: &MemberCap, ctx)` — officer+ can add
- `remove_member(corp: &mut Corp, member: address, cap: &MemberCap, ctx)` — officer+ can remove
- `change_role(corp: &mut Corp, member: address, new_role: u8, cap: &MemberCap, ctx)` — director only
- `is_member(corp: &Corp, addr: address): bool`
- `get_role(corp: &Corp, addr: address): Option<u8>`
- `member_count(corp: &Corp): u64`

### Tests Required
- Corp creation registers in registry, founder gets MemberCap with role=2
- Officer can add member, gets MemberCap
- Non-officer cannot add member (ENotOfficer)
- Duplicate member rejected (EAlreadyMember)
- Role change by director succeeds; by member fails
- Member removal event emitted

---

## Module 3: `cradleos::treasury`
**Purpose:** Corp treasury. Holds SUI. Members deposit, directors withdraw. On-chain accounting.

### Structs
```
public struct Treasury has key {
    id: UID,
    corp_id: ID,
    balance: Balance<SUI>,
    total_deposited: u64,
    total_withdrawn: u64,
}

public struct DepositRecord has copy, drop { treasury_id: ID, depositor: address, amount: u64, new_balance: u64 }
public struct WithdrawRecord has copy, drop { treasury_id: ID, recipient: address, amount: u64, new_balance: u64 }
```

### Error Constants
```
const ENotMember: u64 = 0;
const ENotDirector: u64 = 1;
const EInsufficientFunds: u64 = 2;
const EZeroAmount: u64 = 3;
```

### Functions
- `create_treasury(corp: &Corp, ctx): Treasury` — creates treasury linked to corp
- `deposit(treasury: &mut Treasury, corp: &Corp, payment: Coin<SUI>, ctx)` — any member
- `withdraw(treasury: &mut Treasury, corp: &Corp, amount: u64, cap: &MemberCap, ctx): Coin<SUI>` — director only
- `balance(treasury: &Treasury): u64`
- `total_deposited(treasury: &Treasury): u64`

### Tests Required
- Member can deposit, balance increases
- Non-member cannot deposit (ENotMember)
- Director can withdraw, balance decreases
- Non-director cannot withdraw (ENotDirector)
- Overdraw rejected (EInsufficientFunds)
- Zero deposit rejected (EZeroAmount)
- Events emitted on deposit and withdraw

---

## Module 4: `cradleos::gate_control`
**Purpose:** EVE Frontier Smart Gate access control. Corps define who can pass their gates.

### Structs
```
public struct GatePolicy has key {
    id: UID,
    corp_id: ID,
    gate_id: u64,             // EVE Frontier Smart Gate object ID (on-chain ref)
    allow_allies: bool,
    allowed_corps: vector<ID>,   // allied corp IDs
    blocked_addresses: vector<address>,
}

public struct PassLog has copy, drop { gate_id: u64, pilot: address, allowed: bool, reason: u8 }
public struct PolicyUpdated has copy, drop { gate_id: u64, corp_id: ID }
```

### Error Constants
```
const ENotOfficer: u64 = 0;
const EGateNotOwned: u64 = 1;
const EAlreadyAllied: u64 = 2;
const ECorpNotFound: u64 = 3;
```

### Functions
- `create_policy(corp: &Corp, gate_id: u64, cap: &MemberCap, ctx): GatePolicy` — officer+
- `add_allied_corp(policy: &mut GatePolicy, ally_id: ID, cap: &MemberCap, ctx)` — officer+
- `block_address(policy: &mut GatePolicy, addr: address, cap: &MemberCap, ctx)` — officer+
- `check_access(policy: &GatePolicy, corp: &Corp, pilot: address): bool` — read-only, emits PassLog
- `update_ally_flag(policy: &mut GatePolicy, allow: bool, cap: &MemberCap, ctx)` — officer+

### Tests Required
- Policy creation ties gate_id to corp
- Corp member passes access check
- Blocked address denied
- Allied corp member passes if allow_allies=true
- Non-officer cannot create policy (ENotOfficer)
- PassLog emitted on every check_access call

---

## Module 5: `cradleos::contributions`
**Purpose:** Track member contributions to corp operations. Build queues, delivery logs, reward points.

### Structs
```
public struct ContribLedger has key {
    id: UID,
    corp_id: ID,
    entries: vector<ContribEntry>,
    total_points: u64,
}

public struct ContribEntry has copy, drop, store {
    member: address,
    action_type: u8,       // 0=material_delivery, 1=build_contribution, 2=combat_support
    points: u64,
    epoch: u64,
    memo: vector<u8>,
}

public struct ContribLogged has copy, drop {
    corp_id: ID,
    member: address,
    action_type: u8,
    points: u64,
}
```

### Error Constants
```
const ENotOfficer: u64 = 0;
const EInvalidActionType: u64 = 1;
const EZeroPoints: u64 = 2;
```

### Functions
- `create_ledger(corp: &Corp, ctx): ContribLedger` — creates per-corp ledger
- `log_contribution(ledger: &mut ContribLedger, corp: &Corp, member: address, action_type: u8, points: u64, memo: vector<u8>, cap: &MemberCap, ctx)` — officer+ logs on behalf of member
- `get_member_points(ledger: &ContribLedger, member: address): u64` — sum all points for address
- `get_total_points(ledger: &ContribLedger): u64`
- `get_entry_count(ledger: &ContribLedger): u64`

### Tests Required
- Contribution logged, points accumulate correctly
- Non-officer cannot log (ENotOfficer)
- Zero points rejected (EZeroPoints)
- Invalid action_type rejected (EInvalidActionType)
- get_member_points returns correct sum across multiple entries
- ContribLogged event emitted

---

## Build Order
1. `registry` (no dependencies)
2. `corp` (depends on registry)
3. `treasury` (depends on corp)
4. `gate_control` (depends on corp)
5. `contributions` (depends on corp)

## Acceptance Criteria (ALL modules)
- `sui move build` — zero errors
- `sui move test` — 100% pass rate
- Named error constants (no bare numeric asserts)
- `public struct` declarations
- Events on all state changes
- Auth checks on all mutating functions
- No overflow risks (checked arithmetic)

## Integration Test (after all modules pass)
- Found corp → add members → create treasury → deposit → log contributions → create gate policy → check access → withdraw

---
*Spec v1 — 2026-03-10. Navigator uses this as standing mission brief.*
