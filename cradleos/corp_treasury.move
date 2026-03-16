/// CradleOS Corp Treasury — SSU extension for corp-gated item banking.
///
/// This module extends a `world::storage_unit::StorageUnit` (SSU) to function as a
/// corporation bank. Only registered corp members may deposit or withdraw. The commander
/// can drain the treasury at any time.
///
/// ## Design
/// - `TreasuryState` is stored as a dynamic field on the SSU (keyed by `TreasuryStateKey {}`).
/// - It tracks `member_balances: Table<ID, u64>` — mapping character_id to item quantity credited.
/// - A single `item_type_id` is designated as the corp currency at treasury creation time.
///   This mirrors EVE's single-ISK-equivalent paradigm; multi-asset support can be added later.
///
/// ## Deposit Flow
/// 1. Member has items in their *owned inventory* slot within the SSU (deposited via `deposit_by_owner`).
/// 2. Member calls `deposit()` — items are moved from owned slot → corp main inventory.
/// 3. Member's balance in `member_balances` is credited by the quantity deposited.
///
/// ## Withdraw Flow
/// 1. Member calls `withdraw()` with a quantity ≤ their credited balance.
/// 2. Items are moved from corp main inventory → member's owned inventory in the SSU.
/// 3. Member's balance is debited.
///
/// ## Commander Drain
/// - `commander_withdraw_all()` moves all treasury items to the commander's character inventory.
/// - Resets all member balances to zero.
///
/// ## Typed Witness Pattern
/// `CorpTreasuryAuth { }` is registered on the SSU via `storage_unit::authorize_extension<Auth>`.
/// Functions `deposit_item<Auth>` and `withdraw_item<Auth>` verify the SSU's extension type
/// matches `type_name::with_defining_ids<CorpTreasuryAuth>()`, ensuring only this module
/// can manipulate the corp inventory slot.
///
/// ## References
/// - world::storage_unit::authorize_extension<Auth>
/// - world::storage_unit::deposit_item<Auth>
/// - world::storage_unit::withdraw_item<Auth>
/// - world::storage_unit::deposit_to_owned<Auth>
/// - cradleos::corp_registry::CorpRegistry
///
/// STATUS: Pre-hackathon skeleton — signatures only. Implementation begins March 11, 2026.
module cradleos::corp_treasury;

use cradleos::corp_registry::{CorpRegistry, CommanderCap};
use sui::{dynamic_field as df, event, table::Table};
use world::{
    access::OwnerCap,
    character::Character,
    storage_unit::{Self, StorageUnit},
};

// === Errors ===
#[error(code = 0)]
const ENotCorpMember: vector<u8> = b"Character is not a member of this corp";
#[error(code = 1)]
const EInsufficientBalance: vector<u8> = b"Insufficient member balance for withdrawal";
#[error(code = 2)]
const ERegistryMismatch: vector<u8> = b"CommanderCap does not match the treasury's corp registry";
#[error(code = 3)]
const ETreasuryAlreadyInitialized: vector<u8> = b"Treasury already initialized on this SSU";
#[error(code = 4)]
const ETreasuryNotInitialized: vector<u8> = b"Treasury not initialized on this SSU";
#[error(code = 5)]
const EZeroQuantity: vector<u8> = b"Quantity must be greater than zero";

// === Constants ===

/// Maximum items per withdrawal to prevent gas runaway (configurable).
const MAX_SINGLE_WITHDRAW: u32 = 10_000;

// === Typed Witness ===

/// Zero-sized drop witness for this extension. Passed to world SSU functions
/// that require `Auth: drop` proving the SSU's authorized extension type.
public struct CorpTreasuryAuth has drop {}

// === Structs ===

/// Stored as a dynamic field on the SSU. Acts as the treasury ledger.
public struct TreasuryState has store {
    /// The CorpRegistry ID this treasury is bound to.
    corp_id: ID,
    /// The in-game item type ID used as the corp currency (e.g. ISK-equivalent ore).
    item_type_id: u64,
    /// Total item quantity held in corp inventory (sum of all member_balances).
    total_balance: u64,
    /// Per-member credited balance. character_id -> quantity.
    member_balances: Table<ID, u64>,
}

/// Dynamic field key for `TreasuryState`.
public struct TreasuryStateKey has copy, drop, store {}

// === Events ===

public struct TreasuryInitializedEvent has copy, drop {
    ssu_id: ID,
    corp_id: ID,
    item_type_id: u64,
    commander: address,
}

public struct TreasuryDepositEvent has copy, drop {
    ssu_id: ID,
    corp_id: ID,
    character_id: ID,
    quantity: u64,
    new_member_balance: u64,
    new_total_balance: u64,
}

public struct TreasuryWithdrawEvent has copy, drop {
    ssu_id: ID,
    corp_id: ID,
    character_id: ID,
    quantity: u64,
    remaining_member_balance: u64,
    remaining_total_balance: u64,
}

public struct TreasuryCommanderDrainEvent has copy, drop {
    ssu_id: ID,
    corp_id: ID,
    commander: address,
    total_drained: u64,
}

// === Public Entry Functions ===

/// Initialize the corp treasury on an SSU.
/// Registers `CorpTreasuryAuth` as the SSU's extension witness.
/// Stores a fresh `TreasuryState` as a dynamic field on the SSU.
///
/// Requires:
///   - Caller holds `CommanderCap` for `registry`
///   - Caller holds `OwnerCap<StorageUnit>` for `ssu`
///   - Treasury not already initialized
///
/// After this call, the SSU's default access is replaced by corp-gated logic.
public entry fun initialize_treasury(
    ssu: &mut StorageUnit,
    registry: &CorpRegistry,
    cap: &CommanderCap,
    owner_cap: &OwnerCap<StorageUnit>,
    item_type_id: u64,
    ctx: &mut TxContext,
) { abort 0 }

/// Corp member deposits items into the treasury.
///
/// The items are moved from the member's owned inventory slot in the SSU into
/// the corp's main extension-controlled inventory slot. The member's balance is credited.
///
/// Requires:
///   - `character` is a registered corp member
///   - SSU is online
///   - Member has sufficient items in their owned slot
public entry fun deposit(
    ssu: &mut StorageUnit,
    registry: &CorpRegistry,
    character: &Character,
    owner_cap: &OwnerCap<StorageUnit>,
    quantity: u32,
    ctx: &mut TxContext,
) { abort 0 }

/// Corp member withdraws items from the treasury up to their credited balance.
///
/// Items are moved from the corp's extension-controlled slot into the member's
/// owned inventory slot via `deposit_to_owned<Auth>`.
///
/// Requires:
///   - `character` is a registered corp member
///   - Member's balance >= quantity
///   - SSU is online
public entry fun withdraw(
    ssu: &mut StorageUnit,
    registry: &CorpRegistry,
    character: &Character,
    quantity: u32,
    ctx: &mut TxContext,
) { abort 0 }

/// Commander drains the entire treasury to their character's inventory.
/// All member balances are zeroed after the drain.
///
/// NOTE: Move does not support arbitrary iteration/reset of all Table entries in one call.
/// Balance invalidation should be handled via a `reset_generation: u64` counter
/// that makes all old balances stale. See DESIGN.md for details.
public entry fun commander_withdraw_all(
    ssu: &mut StorageUnit,
    registry: &CorpRegistry,
    cap: &CommanderCap,
    character: &Character,
    ctx: &mut TxContext,
) { abort 0 }

// === View Functions ===

/// Returns the total item balance held in corp treasury.
public fun total_balance(ssu: &StorageUnit): u64 { abort 0 }

/// Returns a specific member's credited balance in the treasury.
public fun member_balance(ssu: &StorageUnit, character_id: ID): u64 { abort 0 }

/// Returns the item type ID used as corp currency.
public fun item_type_id(ssu: &StorageUnit): u64 { abort 0 }

/// Returns true if the SSU has an initialized treasury.
public fun is_initialized(ssu: &StorageUnit): bool { abort 0 }
