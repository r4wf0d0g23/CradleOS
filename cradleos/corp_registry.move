/// CradleOS Corp Registry — shared source-of-truth for corporation membership.
///
/// `CorpRegistry` is a shared object that stores the corp name, the commander address,
/// and the member list (by Character object ID). Both `corp_gate` and `corp_treasury`
/// extensions reference this object for membership checks.
///
/// Access control uses a capability pattern: the founder receives a `CommanderCap` at
/// creation time, and only the holder of that cap can mutate the registry.
///
/// Membership is stored redundantly as:
///   - `vector<ID>` for ordered iteration / display
///   - `Table<ID, bool>` for O(1) lookup during gate/treasury checks
///
/// Pattern: Capability-gated shared object with Table-based fast membership lookup.
///
/// STATUS: Pre-hackathon skeleton — signatures only. Implementation begins March 11, 2026.
module cradleos::corp_registry;

use std::string::String;
use sui::{event, table::Table};

// === Errors ===
#[error(code = 0)]
const ENotCommander: vector<u8> = b"Only the corp commander can perform this action";
#[error(code = 1)]
const EAlreadyMember: vector<u8> = b"Character is already a corp member";
#[error(code = 2)]
const ENotMember: vector<u8> = b"Character is not a corp member";
#[error(code = 3)]
const ECapMismatch: vector<u8> = b"CommanderCap does not belong to this corp";
#[error(code = 4)]
const ENameEmpty: vector<u8> = b"Corp name cannot be empty";

// === Structs ===

/// The central shared corp object. Both gate and treasury extensions hold a reference to this.
public struct CorpRegistry has key {
    id: UID,
    /// Human-readable corp name.
    name: String,
    /// Wallet address of the current corp commander.
    commander: address,
    /// Ordered list of member Character IDs (for iteration/display).
    members: vector<ID>,
    /// Fast O(1) membership lookup. Maps character_id -> true.
    member_table: Table<ID, bool>,
}

/// Capability minted to the corp founder at creation.
/// Must be held to perform commander-only actions on any corp module.
public struct CommanderCap has key, store {
    id: UID,
    /// The ID of the `CorpRegistry` this cap governs.
    corp_id: ID,
}

// === Events ===

public struct CorpCreatedEvent has copy, drop {
    corp_id: ID,
    name: String,
    commander: address,
}

public struct MemberAddedEvent has copy, drop {
    corp_id: ID,
    character_id: ID,
}

public struct MemberRemovedEvent has copy, drop {
    corp_id: ID,
    character_id: ID,
}

public struct CommandTransferredEvent has copy, drop {
    corp_id: ID,
    old_commander: address,
    new_commander: address,
}

// === Public Entry Functions ===

/// Create a new corp. The caller (tx sender) becomes the commander.
/// Shares the `CorpRegistry` and transfers the `CommanderCap` to the sender.
public entry fun create_corp(
    name: String,
    ctx: &mut TxContext,
) { abort 0 }

/// Add a character (by object ID) to the corp. Commander only.
/// The character_id must be the on-chain `object::id(&character)`.
public entry fun add_member(
    registry: &mut CorpRegistry,
    cap: &CommanderCap,
    character_id: ID,
    _ctx: &mut TxContext,
) { abort 0 }

/// Remove a character from the corp. Commander only.
public entry fun remove_member(
    registry: &mut CorpRegistry,
    cap: &CommanderCap,
    character_id: ID,
    _ctx: &mut TxContext,
) { abort 0 }

/// Transfer the commander role to a new wallet address.
/// Consumes the old `CommanderCap` and mints a new one to `new_commander`.
public entry fun transfer_command(
    registry: &mut CorpRegistry,
    cap: CommanderCap,
    new_commander: address,
    ctx: &mut TxContext,
) { abort 0 }

// === View Functions ===

/// Returns true if the given character ID is a registered corp member.
public fun is_member(registry: &CorpRegistry, character_id: ID): bool { abort 0 }

/// Returns the corp commander's wallet address.
public fun commander(registry: &CorpRegistry): address { abort 0 }

/// Returns the corp name.
public fun name(registry: &CorpRegistry): String { abort 0 }

/// Returns the number of registered corp members.
public fun member_count(registry: &CorpRegistry): u64 { abort 0 }

/// Returns a reference to the ordered member list (for iteration).
public fun members(registry: &CorpRegistry): &vector<ID> { abort 0 }

/// Returns the CorpRegistry's object ID (used by extensions to bind cap checks).
public fun corp_id(registry: &CorpRegistry): ID { abort 0 }

// === Internal Helpers ===

/// Assert that `cap` belongs to `registry` and the tx sender is the commander.
fun assert_commander(registry: &CorpRegistry, cap: &CommanderCap) { abort 0 }
