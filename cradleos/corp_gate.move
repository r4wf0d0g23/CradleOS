/// CradleOS Corp Gate — Gate extension that restricts jumps to corp members.
///
/// This module is a typed-witness extension for `world::gate::Gate`.
///
/// ## How It Works
/// 1. A gate owner calls `authorize_on_gate` to register `CorpGateAuth` as the extension
///    witness on their gate (both source and destination must use the same auth type).
/// 2. Once authorized, the default `gate::jump` is disabled; travelers must call
///    `gate::jump_with_permit` with a `JumpPermit` issued by this extension.
/// 3. Corp members call `request_jump_permit`, which:
///    - Verifies the character's object ID is in the `CorpRegistry` member list
///    - Issues a time-limited `JumpPermit` via `gate::issue_jump_permit<CorpGateAuth>`
///    - Emits a `CorpJumpPermitIssuedEvent`
/// 4. The permit is a single-use NFT transferred to the character's wallet. When consumed
///    by `gate::jump_with_permit`, it is burned on-chain.
///
/// ## Typed Witness Pattern
/// `CorpGateAuth { }` is the zero-sized drop witness. The world contract verifies at
/// `issue_jump_permit<CorpGateAuth>` that the gate's registered extension type matches
/// `type_name::with_defining_ids<CorpGateAuth>()`. This ensures only this module can
/// issue permits for gates configured with this extension.
///
/// ## References
/// - world::gate::authorize_extension<Auth>
/// - world::gate::issue_jump_permit<Auth>
/// - world::gate::jump_with_permit
/// - cradleos::corp_registry::CorpRegistry
///
/// STATUS: Pre-hackathon skeleton — signatures only. Implementation begins March 11, 2026.
module cradleos::corp_gate;

use cradleos::corp_registry::{CorpRegistry, CommanderCap};
use sui::{clock::Clock, event};
use world::{
    access::OwnerCap,
    character::Character,
    gate::{Self, Gate},
};

// === Errors ===
#[error(code = 0)]
const ENotCorpMember: vector<u8> = b"Character is not a member of this corp";
#[error(code = 1)]
const ERegistryMismatch: vector<u8> = b"CommanderCap does not match the gate's corp registry";
#[error(code = 2)]
const EGateNotAuthorized: vector<u8> = b"Gate not authorized for this corp extension";

// === Constants ===

/// Default permit validity: 7 days in milliseconds.
const DEFAULT_PERMIT_DURATION_MS: u64 = 7 * 24 * 60 * 60 * 1000;

// === Typed Witness ===

/// Zero-sized witness type used to authorize this extension on a Gate.
/// Must be `drop` — consumed by `gate::issue_jump_permit<CorpGateAuth>`.
public struct CorpGateAuth has drop {}

// === Structs ===

/// Per-gate configuration stored as a Sui dynamic field on the Gate object.
/// Keyed by `CorpGateConfigKey {}`.
public struct CorpGateConfig has store {
    /// The corp registry ID this gate is bound to.
    corp_id: ID,
    /// Permit validity window in milliseconds (configurable by commander).
    permit_duration_ms: u64,
}

/// Dynamic field key for `CorpGateConfig`.
public struct CorpGateConfigKey has copy, drop, store {}

// === Events ===

public struct CorpGateAuthorizedEvent has copy, drop {
    gate_id: ID,
    corp_id: ID,
    commander: address,
}

public struct CorpJumpPermitIssuedEvent has copy, drop {
    corp_id: ID,
    source_gate_id: ID,
    destination_gate_id: ID,
    character_id: ID,
    expires_at_ms: u64,
}

public struct CorpGatePermitDurationUpdatedEvent has copy, drop {
    gate_id: ID,
    corp_id: ID,
    old_duration_ms: u64,
    new_duration_ms: u64,
}

// === Public Entry Functions ===

/// Register `CorpGateAuth` as the extension on a Gate.
/// Must be called on BOTH the source and destination gate before permits can be issued
/// (the world contract enforces matching extension types on both ends).
///
/// Requires:
///   - Caller holds `CommanderCap` for the given `CorpRegistry`
///   - Caller holds `OwnerCap<Gate>` for the given gate
///   - The `registry` corp_id matches the `cap` binding
///
/// Stores a `CorpGateConfig` as a dynamic field on the gate so the gate binds to this corp.
public entry fun authorize_on_gate(
    gate: &mut Gate,
    registry: &CorpRegistry,
    cap: &CommanderCap,
    owner_cap: &OwnerCap<Gate>,
    ctx: &mut TxContext,
) { abort 0 }

/// Issue a `JumpPermit` to a corp member character.
///
/// This is the main user-facing function. Any corp member can call this to get
/// a permit for the configured gate pair.
///
/// Requires:
///   - `character` object ID is in `registry.member_table`
///   - Source gate is authorized with `CorpGateAuth`
///   - Destination gate is authorized with `CorpGateAuth`
///
/// Emits: `CorpJumpPermitIssuedEvent`
public entry fun request_jump_permit(
    registry: &CorpRegistry,
    source_gate: &Gate,
    destination_gate: &Gate,
    character: &Character,
    clock: &Clock,
    ctx: &mut TxContext,
) { abort 0 }

/// Commander updates the permit duration for a gate.
public entry fun set_permit_duration(
    gate: &mut Gate,
    registry: &CorpRegistry,
    cap: &CommanderCap,
    new_duration_ms: u64,
    _ctx: &mut TxContext,
) { abort 0 }

// === View Functions ===

/// Returns true if the gate has CorpGateConfig attached.
public fun is_gate_configured(gate: &Gate): bool { abort 0 }

/// Returns the permit duration configured for the gate (ms).
public fun permit_duration_ms(gate: &Gate): u64 { abort 0 }

/// Returns the corp ID bound to this gate's config.
public fun gate_corp_id(gate: &Gate): ID { abort 0 }
