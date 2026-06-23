/// # cradleos_keeper_seal::keeper_seal
///
/// Soulbound on-chain achievement records ("Seals") issued by The Keeper.
/// Recognizes player accomplishments — both known (catalog-listed) and
/// hidden (cryptic Keeper-voice clues until earned). Lore-tied to the
/// Keeper's role as observer of the cycle.
///
/// ## Design (locked 2026-05-01)
///
/// - **Soulbound**: `Seal` has `key` only (no `store`), so it cannot be
///   transferred after issuance. The recipient owns it forever.
/// - **No duplicates per character**: shared `Registry` enforces
///   (seal_id, recipient_address) uniqueness via on-chain table lookup.
/// - **Off-chain catalog**: each `Seal` carries a `metadata_url` field
///   pointing to canonical lore for that seal_id. Catalog can grow
///   without contract upgrades; per-issuance variants supported via
///   custom metadata_url overrides.
/// - **Identity binding**: `issued_to: address` stores the player's
///   `character.character_address` (the EVE Vault zkLogin wallet),
///   which persists across cycles even when Character objects are
///   culled at world wipe.
/// - **Mint authority**: `KeeperMintCap` is held by a single dedicated
///   Keeper signing wallet. Issuance requires a reference to this cap.
///
/// ## Trigger paths (all converge on issue_seal):
///   1. Deterministic — backend cron watches chain events
///   2. Heuristic — Keeper LLM tool calls issue_seal mid-conversation
///   3. Discretionary — manual issuance for community moments / lore
///
/// ## Roll-up plan
///
/// At the next world wipe, this module will be merged into the main
/// `cradleos` package as the 25th module. Until then it lives as its
/// own package for iteration speed and isolated upgrade blast radius.
module cradleos_keeper_seal::keeper_seal;

use sui::clock::{Self, Clock};
use sui::table::{Self, Table};
use sui::event;
use std::string::{Self, String};

// ── Errors ───────────────────────────────────────────────────────────

const E_DUPLICATE: u64 = 1;
const E_INVALID_TIER: u64 = 2;

// ── Tier constants ───────────────────────────────────────────────────

const TIER_COMMON: u8 = 0;
const TIER_RARE: u8 = 1;
const TIER_MYTHIC: u8 = 2;
const TIER_HIDDEN: u8 = 3;

// ── Mint authority ───────────────────────────────────────────────────

/// Capability proving the holder is authorized to issue Seals. Created
/// at module init, transferred to the deployer (us), then transferred
/// once more to the Keeper signing wallet via a manual admin tx.
///
/// Has `store` so it can be transferred between addresses (e.g., wallet
/// rotation). Loss = inability to issue new seals; rotation requires
/// republishing the package, since this is the only mint authority.
public struct KeeperMintCap has key, store {
    id: UID,
}

// ── The Seal ─────────────────────────────────────────────────────────

/// Soulbound achievement record. `key` only — no `store` ability — so
/// after `transfer::transfer` to the recipient it cannot be moved
/// elsewhere. The recipient owns it for the lifetime of their wallet
/// (or until they explicitly burn it themselves; see `burn`).
public struct Seal has key {
    id: UID,
    /// Catalog identifier. Matches an entry in the off-chain seal
    /// catalog (e.g. /seals/catalog.json#${seal_id}).
    seal_id: u64,
    /// `character.character_address` — the EVE Vault zkLogin wallet.
    /// Persists across cycle resets even when Character objects are
    /// culled, so the trophy case threads through rebirths.
    issued_to: address,
    /// Wall-clock ms timestamp from the on-chain Clock at issuance.
    issued_at_ms: u64,
    /// 0=common, 1=rare, 2=mythic, 3=hidden. Hidden seals are not
    /// listed in the public catalog UI; only the recipient sees them.
    tier: u8,
    /// Cycle number at issuance time (current cycle = configurable
    /// per mint). Lets us distinguish seals earned in different cycles
    /// when stitching multi-cycle trophy cases together.
    cycle: u8,
    /// Free-text description of the Keeper cycle phase at issuance
    /// (e.g., "shroud of fear"). Lore color, not a structural field.
    cycle_phase: String,
    /// Canonical metadata URL. Default: catalog entry for seal_id.
    /// Per-issuance overrides supported for limited editions /
    /// cycle-specific variants.
    metadata_url: String,
}

// ── Registry (on-chain dedup) ────────────────────────────────────────

/// Shared object tracking issued (seal_id, recipient) pairs. Prevents
/// the same seal from being earned twice by the same wallet. Created
/// at module init alongside the KeeperMintCap.
public struct Registry has key {
    id: UID,
    /// Composite key: BCS(seal_id) ++ BCS(recipient_address). The
    /// table only stores `bool` (always `true`) — we just need the
    /// existence check.
    issued: Table<vector<u8>, bool>,
}

// ── Events ───────────────────────────────────────────────────────────

/// Emitted on every successful seal issuance. Indexers / off-chain
/// services can subscribe to react (e.g., post a Keeper-voice
/// announcement to the tribe announcement board).
public struct SealIssuedEvent has copy, drop {
    seal_object_id: ID,
    seal_id: u64,
    issued_to: address,
    issued_at_ms: u64,
    tier: u8,
    cycle: u8,
}

/// Emitted when a recipient burns one of their own seals. Rare path.
public struct SealBurnedEvent has copy, drop {
    seal_object_id: ID,
    seal_id: u64,
    issued_to: address,
}

// ── Init ─────────────────────────────────────────────────────────────

/// Module initializer. Runs exactly once at publish.
///
/// Creates the singleton `KeeperMintCap` and transfers it to the
/// publisher (the deployer wallet). The deployer should immediately
/// transfer it to the dedicated Keeper signing wallet via a one-shot
/// admin tx after the publish settles.
///
/// Creates the shared `Registry` so any sponsored mint tx can read /
/// write the dedup table without holding a custom owner cap.
fun init(ctx: &mut TxContext) {
    transfer::public_transfer(
        KeeperMintCap { id: object::new(ctx) },
        ctx.sender(),
    );
    transfer::share_object(Registry {
        id: object::new(ctx),
        issued: table::new(ctx),
    });
}

// ── Issue ────────────────────────────────────────────────────────────

/// Mint a new Seal and transfer it to `recipient`.
///
/// Requires:
/// - Caller holds `&KeeperMintCap` (proves Keeper authority)
/// - `&mut Registry` (shared object) for dedup
/// - `&Clock` for timestamp
/// - `tier` in [0, 3]
/// - (seal_id, recipient) pair not already in the Registry
public fun issue_seal(
    _cap: &KeeperMintCap,
    registry: &mut Registry,
    seal_id: u64,
    recipient: address,
    tier: u8,
    cycle: u8,
    cycle_phase: vector<u8>,
    metadata_url: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(tier <= TIER_HIDDEN, E_INVALID_TIER);

    let key = make_dedup_key(seal_id, recipient);
    assert!(!table::contains(&registry.issued, key), E_DUPLICATE);
    table::add(&mut registry.issued, key, true);

    let issued_at_ms = clock::timestamp_ms(clock);
    let seal_uid = object::new(ctx);
    let seal_object_id = seal_uid.to_inner();

    let seal = Seal {
        id: seal_uid,
        seal_id,
        issued_to: recipient,
        issued_at_ms,
        tier,
        cycle,
        cycle_phase: string::utf8(cycle_phase),
        metadata_url: string::utf8(metadata_url),
    };

    event::emit(SealIssuedEvent {
        seal_object_id,
        seal_id,
        issued_to: recipient,
        issued_at_ms,
        tier,
        cycle,
    });

    // Soulbound: Seal lacks `store`, so transfer::transfer is the only
    // way to put it in a wallet, and the recipient cannot move it out.
    transfer::transfer(seal, recipient);
}

// ── Burn (recipient-only escape hatch) ───────────────────────────────

/// Allow a recipient to destroy one of their own Seals. Emits
/// SealBurnedEvent so off-chain trophy displays can update.
///
/// Note: burning does NOT free up the (seal_id, recipient) entry in
/// the Registry — the original earning still counts as historic record.
/// If we ever need to allow re-earning (rare; would be lore-driven),
/// add a separate Keeper-cap-gated `clear_dedup_entry` function.
public fun burn(seal: Seal, _ctx: &mut TxContext) {
    let Seal {
        id,
        seal_id,
        issued_to,
        issued_at_ms: _,
        tier: _,
        cycle: _,
        cycle_phase: _,
        metadata_url: _,
    } = seal;
    event::emit(SealBurnedEvent {
        seal_object_id: id.to_inner(),
        seal_id,
        issued_to,
    });
    id.delete();
}

// ── Internal helpers ─────────────────────────────────────────────────

/// Build the BCS-encoded composite key used by the Registry.
/// Layout: BCS(seal_id: u64) ++ BCS(recipient: address).
fun make_dedup_key(seal_id: u64, recipient: address): vector<u8> {
    let mut k = std::bcs::to_bytes(&seal_id);
    k.append(std::bcs::to_bytes(&recipient));
    k
}

// ── Read accessors ───────────────────────────────────────────────────

public fun seal_id(s: &Seal): u64 { s.seal_id }
public fun issued_to(s: &Seal): address { s.issued_to }
public fun issued_at_ms(s: &Seal): u64 { s.issued_at_ms }
public fun tier(s: &Seal): u8 { s.tier }
public fun cycle(s: &Seal): u8 { s.cycle }
public fun cycle_phase(s: &Seal): &String { &s.cycle_phase }
public fun metadata_url(s: &Seal): &String { &s.metadata_url }

// ── Tier predicates (for off-chain/UI use) ───────────────────────────

public fun tier_common(): u8 { TIER_COMMON }
public fun tier_rare(): u8 { TIER_RARE }
public fun tier_mythic(): u8 { TIER_MYTHIC }
public fun tier_hidden(): u8 { TIER_HIDDEN }
