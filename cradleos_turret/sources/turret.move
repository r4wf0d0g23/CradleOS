/// Personal turret policy. The game's callback has exactly FOUR inputs; all
/// settings therefore travel in this turret's owner-controlled metadata.
module cradleos_turret::turret;

use std::{bcs, string::{Self, String}, type_name};
use world::{access::OwnerCap, character::Character, metadata,
    turret::{Self as world_turret, Turret, OnlineReceipt, TargetCandidate, ReturnTargetPriorityList}};

const ESettings: u64 = 0;
const EMetadata: u64 = 1;
const EBinding: u64 = 2;
const EReceipt: u64 = 3;
const MARKER: vector<u8> = b"\n[cradleos-turret:v1:";
const MAX_DESCRIPTION: u64 = 8192;
const MAX_IDS: u64 = 16;

public struct TurretAuth has drop {}
public struct Settings has copy, drop {
    mode: u8, // hold, aggressors, non-friendlies, marked hostiles
    priority: u8, // aggressors, low hull, low shield, low armor
    class: u8, // any, match turret, small, medium, large
    flags: u8, // bit0: strict class; bit1: drop STOPPED_ATTACK
    friends: vector<u32>, hostiles: vector<u32>,
    friendly_tribes: vector<u32>, hostile_tribes: vector<u32>,
}

/// Atomic settings + binding. Frozen-to-us permits edits, never rebinding.
public fun save_settings(turret: &mut Turret, cap: &OwnerCap<Turret>, bytes: vector<u8>, replace_existing: bool) {
    assert!(decode_settings(&bytes).is_some(), ESettings);
    assert!(world_turret::metadata(turret).is_some(), EMetadata);
    if (world_turret::is_extension_frozen(turret)) {
        assert!(world_turret::extension(turret).contains(&type_name::with_defining_ids<TurretAuth>()), EBinding);
    } else {
        assert!(replace_existing || world_turret::extension(turret).is_none()
            || world_turret::extension(turret).contains(&type_name::with_defining_ids<TurretAuth>()), EBinding);
        world_turret::authorize_extension<TurretAuth>(turret, cap);
    };
    let description = metadata::description(world_turret::metadata(turret).borrow());
    world_turret::update_metadata_description(turret, cap, with_settings(description, bytes));
}

/// Only our own binding can be reset through this UI; never revoke another app.
public fun restore_defaults(turret: &mut Turret, cap: &OwnerCap<Turret>) {
    assert!(world_turret::extension(turret).contains(&type_name::with_defining_ids<TurretAuth>()), EBinding);
    world_turret::revoke_extension_authorization(turret, cap);
    let description = metadata::description(world_turret::metadata(turret).borrow());
    world_turret::update_metadata_description(turret, cap, strip_settings(description));
}

/// Exact official callback ABI and module name. No mutable registry, clock,
/// external fetch, optional extra object or implicit tribe policy dependency.
public fun get_target_priority_list(
    turret: &Turret,
    owner_character: &Character,
    target_candidate_list: vector<u8>,
    receipt: OnlineReceipt,
): vector<u8> {
    assert!(world_turret::turret_id(&receipt) == object::id(turret), EReceipt);
    world_turret::destroy_online_receipt(receipt, TurretAuth {});
    let empty: vector<ReturnTargetPriorityList> = vector[];
    if (!world_turret::extension(turret).contains(&type_name::with_defining_ids<TurretAuth>())
        || world_turret::metadata(turret).is_none()) return bcs::to_bytes(&empty);
    let cfg = read_settings(metadata::description(world_turret::metadata(turret).borrow()));
    if (cfg.is_none()) return bcs::to_bytes(&empty);
    let candidates = world_turret::unpack_candidate_list(target_candidate_list);
    bcs::to_bytes(&evaluate(cfg.borrow(), &candidates, owner_character.key().item_id(), owner_character.tribe(), turret.type_id()))
}

public fun evaluate(cfg: &Settings, candidates: &vector<TargetCandidate>, owner: u64, tribe: u32, turret_type: u64): vector<ReturnTargetPriorityList> {
    let mut result = vector[];
    if (cfg.mode == 0) return result;
    candidates.do_ref!(|c| {
        let pilot = c.character_id();
        let target_tribe = c.character_tribe();
        let explicit_hostile = pilot != 0 && cfg.hostiles.contains(&pilot);
        let friendly = (pilot != 0 && (pilot as u64) == owner)
            || (pilot != 0 && cfg.friends.contains(&pilot))
            || (!explicit_hostile && target_tribe != 0 &&
                (target_tribe == tribe || cfg.friendly_tribes.contains(&target_tribe)));
        let hostile = explicit_hostile || (target_tribe != 0 && cfg.hostile_tribes.contains(&target_tribe));
        // World exposes the enum getter, but its variants are private to that
        // module. Pinned BCS enum discriminant 3 is STOPPED_ATTACK.
        let stopped = bcs::to_bytes(&c.behaviour_change()) == vector[3];
        let matches = class_matches(cfg.class, turret_type, c.group_id());
        if (!friendly && !(cfg.flags & 2 != 0 && stopped)
            && !(cfg.flags & 1 != 0 && !matches)
            && (cfg.mode == 2 || (cfg.mode == 1 && c.is_aggressor()) || (cfg.mode == 3 && hostile))) {
            // Bounded independent scores: incoming game weight cannot overflow
            // or defeat our preference. Stable candidate order breaks ties.
            let health = if (cfg.priority == 1) c.hp_ratio()
                else if (cfg.priority == 2) c.shield_ratio() else c.armor_ratio();
            let priority = if (cfg.priority == 0) { if (c.is_aggressor()) 100 else 0 }
                else 100 - std::u64::min(health, 100);
            let weight = 1 + priority + if (cfg.class != 0 && matches) 1000 else 0;
            result.push_back(world_turret::new_return_target_priority_list(c.item_id(), weight));
        };
    });
    result
}

fun class_matches(class: u8, turret_type: u64, group: u64): bool {
    let class = if (class != 1) class else if (turret_type == 92402) 2
        else if (turret_type == 92403) 3 else if (turret_type == 92484) 4 else 255;
    class == 0 || (class == 2 && (group == 31 || group == 237))
        || (class == 3 && (group == 25 || group == 420))
        || (class == 4 && (group == 26 || group == 419))
}

/// Version-1 wire: 4 u8 scalars, then four [u8 count, u32LE IDs] lists.
/// Parser bounds all reads; unsupported/malformed state returns None, not abort.
public fun decode_settings(bytes: &vector<u8>): Option<Settings> {
    if (bytes.length() < 8 || bytes.length() > 264) return option::none();
    if (bytes[0] > 3 || bytes[1] > 3 || bytes[2] > 4 || bytes[3] > 3) return option::none();
    let mut cursor = 4;
    let mut lists = vector[];
    let mut l = 0u64;
    while (l < 4) {
        if (cursor >= bytes.length()) return option::none();
        let n = bytes[cursor] as u64; cursor = cursor + 1;
        if (n > MAX_IDS || cursor + n * 4 > bytes.length()) return option::none();
        let mut ids = vector[];
        let mut i = 0;
        while (i < n) {
            let id = (bytes[cursor] as u32) | ((bytes[cursor+1] as u32) << 8)
                | ((bytes[cursor+2] as u32) << 16) | ((bytes[cursor+3] as u32) << 24);
            if (id == 0 || ids.contains(&id)) return option::none();
            ids.push_back(id); cursor = cursor + 4; i = i + 1;
        };
        lists.push_back(ids); l = l + 1;
    };
    if (cursor != bytes.length() || intersects(&lists[0], &lists[1]) || intersects(&lists[2], &lists[3])) return option::none();
    option::some(Settings { mode: bytes[0], priority: bytes[1], class: bytes[2], flags: bytes[3],
        friends: lists[0], hostiles: lists[1], friendly_tribes: lists[2], hostile_tribes: lists[3] })
}

fun intersects(a: &vector<u32>, b: &vector<u32>): bool {
    let mut i = 0;
    while (i < a.length()) { if (b.contains(&a[i])) return true; i = i + 1; };
    false
}

fun marker_offset(bytes: &vector<u8>): Option<u64> {
    let marker = MARKER;
    if (bytes.length() > MAX_DESCRIPTION || bytes.length() < marker.length()) return option::none();
    let mut i = bytes.length() - marker.length();
    loop {
        let mut j = 0;
        while (j < marker.length() && bytes[i+j] == marker[j]) { j = j + 1; };
        if (j == marker.length()) return option::some(i);
        if (i == 0) return option::none();
        i = i - 1;
    }
}

public fun read_settings(description: String): Option<Settings> {
    let bytes = description.as_bytes();
    let offset = marker_offset(bytes);
    if (offset.is_none() || bytes[bytes.length()-1] != 93) return option::none();
    let marker = MARKER;
    let start = *offset.borrow() + marker.length();
    let end = bytes.length()-1;
    if (end < start || (end-start) % 2 != 0 || end-start > 528) return option::none();
    let mut raw = vector[];
    let mut i = start;
    while (i < end) {
        let hi = nibble(bytes[i]); let lo = nibble(bytes[i+1]);
        if (hi > 15 || lo > 15) return option::none();
        raw.push_back(hi * 16 + lo); i = i + 2;
    };
    decode_settings(&raw)
}

fun nibble(c: u8): u8 {
    if (c >= 48 && c <= 57) c - 48 else if (c >= 97 && c <= 102) c - 87 else 255
}

public fun strip_settings(description: String): String {
    if (read_settings(description).is_none()) return description;
    let mut bytes = description.into_bytes();
    let offset = marker_offset(&bytes).destroy_some();
    while (bytes.length() > offset) { bytes.pop_back(); };
    string::utf8(bytes)
}

public fun with_settings(description: String, bytes: vector<u8>): String {
    assert!(decode_settings(&bytes).is_some(), ESettings);
    let mut out = strip_settings(description).into_bytes();
    out.append(MARKER);
    let hex = b"0123456789abcdef";
    bytes.do!(|b| { out.push_back(hex[(b / 16) as u64]); out.push_back(hex[(b % 16) as u64]); });
    out.push_back(93);
    assert!(out.length() <= MAX_DESCRIPTION, EMetadata);
    string::utf8(out)
}
