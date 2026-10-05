# Personal turret controls — current Stillness

World: official `evefrontier/world-contracts` d33ff232, Stillness package
`0x7be18d6294e533bedd9a5d70a96ce8d9d4b87a7c74188ba65d3fe966bbed9d92`.

The extension module is `turret`, with the exact four-argument official
`get_target_priority_list(Turret, Character, vector<u8>, OnlineReceipt)` ABI.
It replaces the incompatible core `turret_ext` six-argument path. Existing core
lineage/shared services remain untouched. No turret is automatically opted in.

## Settings and authority

OwnerCap-gated `save_settings` atomically preserves current description text,
writes a versioned suffix, and authorizes `TurretAuth`. The callback reads those
settings directly from the supplied turret, not an unavailable extra policy
object. No tribe vault, administrator, browser storage or HTTP service is involved
in targeting. Metadata is public. Direct owner edits may change/invalidate it.

Suffix: `\n[cradleos-turret:v1:<lowercase hex>]`. Bytes: mode, priority, class,
flags (each u8), followed by four lists (u8 length then u32LE IDs): friendly
pilots, hostile pilots, friendly tribes, hostile tribes. Maximum 16/list, 264
bytes; full description <=8192 UTF-8 bytes. Duplicate/zero/conflicting IDs,
unsupported enums, truncated/extra data, invalid hex fail parsing. Missing or
invalid settings select no targets. Valid suffix replacement/removal preserves
original prefix, name and URL. Invalid old text is retained rather than erased.

Modes 0..3: hold, aggressors, non-friendlies, marked hostiles. Priority 0..3:
attackers, lowest hull, lowest shield, lowest armor. Class 0..4: any, official
weapon match, small, medium, large. Flags: strict class (1), drop stopped (2).
Class bonus 1000 dominates the bounded priority 0..100; base score 1. Input
weight is not reused. Equal scores retain input order. NPC group0 does not
match a ship class. Unknown turret types have no official weapon match.
Official pairs: 92402→31/237, 92403→25/420, 92484→26/419. These are not assumed
for other structure type IDs. Health clamps to0..100. STOPPED_ATTACK is read
through pinned BCS discriminant3 because enum variants are not public.

Owner always protected. Friendly pilots always protected. Same nonzero tribe
and friendly tribes protected unless explicitly hostile character. Hostile
tribe cannot override own-tribe protection. Hostile designation grants
eligibility; engagement mode, strict class and STOPPED filters still apply.

Foreign binding replacement requires explicit opt-in. Frozen foreign binding
cannot change. Frozen-to-us can edit settings; restore is blocked by world
freeze enforcement. No freeze operation is offered. Restoring defaults removes
only our binding and valid suffix; the official default can target same-tribe
aggressors, unlike our protected-same-tribe rule.

## Verification

`/path/to/sui move test -p cradleos_turret -e testnet_stillness cradleos_turret`
Tests cover the exact callback using real world test fixtures, owner and
wrong-turret cap rejection, malformed state/UTF-8 preservation, all modes,
health/scoring, strict class and NPCs, foreign binding opt-in, frozen edit/reset,
receipt mismatch, and the shared TS/Move golden wire fixture.

Publication and live VM evidence belong in `deploy/personal-turrets-20261005/`.
A VM simulation is not a claim of observed in-game firing or scheduling.
