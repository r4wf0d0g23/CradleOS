/// CradleOS Voting — Character-age-weighted vote.
///
/// Weight is a function of character age. Two independent, fully trustless paths
/// are provided. CradleOS does NOT act as an attestor in either path. The old
/// self-attested path (prove_char_age_self_attested) has been removed.
///
/// ═══ ORDINAL MODE (primary, fully trustless) ════════════════════════════════
/// Uses the EVE Frontier game-assigned character ID as an ordinal age proxy.
/// Character IDs are monotonically increasing — a lower ID indicates an older
/// character. Ordinal age is computed as:
///
///   ordinal_age = max(0, max_id - game_char_id)
///
/// where max_id is a population ceiling set by the election creator (e.g., the
/// highest known character ID at election creation time). Older characters have
/// smaller IDs, yielding larger ordinal_age values and therefore more weight.
///
/// The game_char_id is read directly from the world Character shared object via
/// the public `character::key()` accessor and `in_game_id::item_id()`. No
/// external trust is required. Works for every character without exception.
///
/// Ownership check: ctx.sender() must equal character.character_address.
///
/// ═══ EPOCH MODE (founders fallback, trustless) ══════════════════════════════
/// Uses claim_epoch from the CradleOS CharacterRegistry as a join-epoch proxy.
/// Only available to tribe founders — wallets that hold an active tribe_id claim
/// in the CharacterRegistry. The claim_epoch is the Sui epoch when the wallet
/// first registered its tribe_id claim on-chain. Fully trustless: all inputs
/// are verifiable on-chain state.
///
/// Limitation: only accessible to tribe founders/claimants, not general members.
///
/// ═══ TRUST MODEL ════════════════════════════════════════════════════════════
/// Both paths read on-chain state directly. No attestor, no self-report.
///
/// ═══ weight_params LAYOUT (26 bytes minimum) ════════════════════════════════
///
///   byte  0:      mode_kind   u8
///                   0 = ORDINAL_VIA_CHARACTER (primary)
///                   1 = EPOCH_VIA_REGISTRY   (founders only)
///
///   byte  1:      formula     u8
///                   0 = LINEAR        weight = age / divisor
///                   1 = SQRT          weight = floor(sqrt(age))
///                   2 = CAPPED_LINEAR weight = min(age / divisor, cap)
///
///   bytes  2– 9:  param1  u64 LE
///                   ORDINAL: max_id — the character ID ceiling (population cap)
///                   EPOCH:   divisor — divides age_epochs to get raw weight
///
///   bytes 10–17:  param2  u64 LE
///                   ORDINAL: divisor — divides ordinal_age (LINEAR/CAPPED_LINEAR)
///                   EPOCH:   unused; set to 0
///
///   bytes 18–25:  param3  u64 LE
///                   CAPPED_LINEAR (both modes): cap — maximum allowed weight
///                   All other formulas: unused; set to 0
///
/// Formula notes:
///   - divisor = 0 is treated as 1 (no division by zero)
///   - cap = 0 means uncapped (CAPPED_LINEAR becomes uncapped LINEAR)
///   - SQRT ignores divisor and cap (use CAPPED_LINEAR for capped square root)
///   - cap > 0 is applied to LINEAR and SQRT as a hard ceiling too
///
/// ═══ inputs_hash BINDING ════════════════════════════════════════════════════
/// keccak256 of:
///   KIND_CHAR_AGE (u8)
///   || all weight_params bytes
///   || character_id (u32 LE)         — game char ID used as proof binding
///   || game_char_id (u64 LE)         — ordinal mode: raw game ID from Character
///      or join_epoch (u64 LE)        — epoch mode: claim_epoch from registry
///   || computed_age (u64 LE)         — ordinal_age or age_epochs
///   || computed_weight (u64 LE)
///
/// Off-chain reproducibility: given the inputs_hash, a verifier can recover all
/// deterministic inputs from on-chain state (Character object for ordinal mode;
/// CharacterRegistry claim for epoch mode) and recompute the weight exactly.
module cradleos_voting::weight_char_age {
    use sui::hash;
    use world::character::{Self, Character};
    use world::in_game_id;
    use cradleos_voting::voting::{Self, Election, WeightProof};
    use cradleos::character_registry::{Self, CharacterRegistry};

    const KIND_CHAR_AGE: u8 = 2;

    // ── mode_kind constants (byte 0 of weight_params) ────────────────────────
    const MODE_ORDINAL: u8 = 0; // primary: trustless via world Character
    const MODE_EPOCH:   u8 = 1; // fallback: trustless via CharacterRegistry (founders)

    // ── formula constants (byte 1 of weight_params) ──────────────────────────
    const FORMULA_LINEAR:        u8 = 0;
    const FORMULA_SQRT:          u8 = 1;
    const FORMULA_CAPPED_LINEAR: u8 = 2;

    // ── Error codes ───────────────────────────────────────────────────────────
    const E_BAD_PARAMS:     u64 = 0;
    const E_INVALID_MODE:   u64 = 2;
    const E_NO_CLAIM:       u64 = 3;
    const E_NOT_CLAIMER:    u64 = 4;
    const E_NOT_CHAR_OWNER: u64 = 5;

    // ── Ordinal-mode mint (internal) ──────────────────────────────────────────

    /// Compute ordinal age weight and mint WeightProof for ORDINAL_VIA_CHARACTER mode.
    /// game_char_id_u64: the raw u64 from in_game_id::item_id (game char ID).
    /// character_id: u32 cast of game_char_id_u64, used as the WeightProof binding.
    fun mint_ordinal(
        election: &Election,
        character_id: u32,
        game_char_id_u64: u64,
        ctx: &mut TxContext,
    ): WeightProof {
        let voter = ctx.sender();
        let params = voting::weight_params(election);
        assert!(vector::length(params) >= 26, E_BAD_PARAMS);

        let formula = *vector::borrow(params, 1);
        let max_id  = decode_u64_at(params, 2);   // param1 = max_id ceiling
        let divisor = decode_u64_at(params, 10);  // param2 = divisor
        let cap     = decode_u64_at(params, 18);  // param3 = cap

        // Ordinal age: distance from ceiling. Saturates to 0 if game_id > max_id.
        let ordinal_age: u64 = if (max_id >= game_char_id_u64) {
            max_id - game_char_id_u64
        } else {
            0
        };

        let weight = apply_formula(formula, ordinal_age, divisor, cap);

        let mut hbuf = vector::empty<u8>();
        vector::push_back(&mut hbuf, KIND_CHAR_AGE);
        vector::append(&mut hbuf, *params);
        append_u32_le(&mut hbuf, character_id);
        append_u64_le(&mut hbuf, game_char_id_u64);
        append_u64_le(&mut hbuf, ordinal_age);
        append_u64_le(&mut hbuf, weight);
        let inputs_hash = hash::keccak256(&hbuf);

        voting::mint_weight_proof(
            voting::id(election),
            voter,
            character_id,
            KIND_CHAR_AGE,
            @cradleos_voting,
            weight,
            inputs_hash,
            ctx,
        )
    }

    // ── Epoch-mode mint (internal) ────────────────────────────────────────────

    /// Compute epoch age weight and mint WeightProof for EPOCH_VIA_REGISTRY mode.
    /// join_epoch: the claim_epoch from CharacterRegistry for the caller's tribe_id.
    fun mint_epoch(
        election: &Election,
        character_id: u32,
        join_epoch: u64,
        ctx: &mut TxContext,
    ): WeightProof {
        let voter = ctx.sender();
        let params = voting::weight_params(election);
        assert!(vector::length(params) >= 26, E_BAD_PARAMS);

        let formula = *vector::borrow(params, 1);
        let divisor = decode_u64_at(params, 2);   // param1 = divisor for epoch mode
        let cap     = decode_u64_at(params, 18);  // param3 = cap

        let current_epoch = ctx.epoch();
        // Saturating subtraction: future join_epoch (clock drift) yields age 0.
        let age_epochs: u64 = if (current_epoch >= join_epoch) {
            current_epoch - join_epoch
        } else {
            0
        };

        let weight = apply_formula(formula, age_epochs, divisor, cap);

        let mut hbuf = vector::empty<u8>();
        vector::push_back(&mut hbuf, KIND_CHAR_AGE);
        vector::append(&mut hbuf, *params);
        append_u32_le(&mut hbuf, character_id);
        append_u64_le(&mut hbuf, join_epoch);
        append_u64_le(&mut hbuf, age_epochs);
        append_u64_le(&mut hbuf, weight);
        let inputs_hash = hash::keccak256(&hbuf);

        voting::mint_weight_proof(
            voting::id(election),
            voter,
            character_id,
            KIND_CHAR_AGE,
            @cradleos_voting,
            weight,
            inputs_hash,
            ctx,
        )
    }

    // ── Formula dispatch ──────────────────────────────────────────────────────

    /// Apply the selected formula to compute weight from age.
    /// divisor = 0 is treated as 1 to prevent division by zero.
    /// cap = 0 means uncapped. cap > 0 is applied as a ceiling to all modes.
    fun apply_formula(formula: u8, age: u64, divisor: u64, cap: u64): u64 {
        let d = if (divisor == 0) { 1 } else { divisor };
        let raw = if (formula == FORMULA_LINEAR) {
            age / d
        } else if (formula == FORMULA_SQRT) {
            // Integer floor(sqrt(n)). See isqrt doc below.
            isqrt(age)
        } else if (formula == FORMULA_CAPPED_LINEAR) {
            let w = age / d;
            if (cap > 0 && w > cap) { cap } else { w }
        } else {
            abort E_INVALID_MODE
        };
        // Apply cap to LINEAR and SQRT modes when cap > 0
        if (formula != FORMULA_CAPPED_LINEAR && cap > 0 && raw > cap) { cap } else { raw }
    }

    /// Integer square root (floor) via Newton's method.
    ///
    /// Precision: exact floor(sqrt(n)) for all u64 n.
    /// Convergence: O(log log n) iterations (typically 5–8 for realistic values).
    /// No floating point. Initial estimate (n+1)/2 is safe for n < u64::MAX.
    fun isqrt(n: u64): u64 {
        if (n == 0) return 0;
        let mut x = n;
        let mut y = (n + 1) / 2;
        while (y < x) {
            x = y;
            y = (x + n / x) / 2;
        };
        x
    }

    // ── Entry functions ───────────────────────────────────────────────────────

    /// PRIMARY — Trustless character age via world Character object.
    ///
    /// weight_params[0] must be 0 (MODE_ORDINAL).
    /// ctx.sender() must equal character.character_address (ownership check).
    ///
    /// Reads game_char_id from the Character object:
    ///   game_char_id = in_game_id::item_id(&character::key(character))  [u64]
    ///   character_id = game_char_id as u32  (safe: game IDs are u32 at origin)
    ///
    /// ordinal_age = max(0, max_id - game_char_id)
    ///   where max_id = weight_params[2..10] (param1, u64 LE).
    ///
    /// Works for every character — no registry claim required.
    public entry fun prove_char_age_via_character(
        election: &Election,
        character: &Character,
        ctx: &mut TxContext,
    ) {
        let voter = ctx.sender();
        let params = voting::weight_params(election);
        assert!(vector::length(params) >= 26, E_BAD_PARAMS);
        assert!(*vector::borrow(params, 0) == MODE_ORDINAL, E_INVALID_MODE);

        // Ownership check: only the character's registered wallet can prove its age.
        assert!(character::character_address(character) == voter, E_NOT_CHAR_OWNER);

        // Trustless game ID read via two public (non-test) accessors.
        let game_char_id_u64: u64 = in_game_id::item_id(&character::key(character));
        let character_id: u32 = game_char_id_u64 as u32;

        let proof = mint_ordinal(election, character_id, game_char_id_u64, ctx);
        transfer::public_transfer(proof, voter);
    }

    /// FALLBACK — Trustless epoch age via CharacterRegistry (tribe founders only).
    ///
    /// weight_params[0] must be 1 (MODE_EPOCH).
    /// Caller must hold the active claim for tribe_id in CharacterRegistry.
    /// join_epoch = claim_epoch stored on-chain for that tribe_id claim.
    ///
    /// age_epochs = max(0, ctx.epoch() - join_epoch)
    ///
    /// Limitation: only accessible to tribe founders/claimants, not general members.
    /// General members should use prove_char_age_via_character instead.
    public entry fun prove_char_age_via_registry(
        election: &Election,
        registry: &CharacterRegistry,
        tribe_id: u32,
        character_id: u32,
        ctx: &mut TxContext,
    ) {
        let voter = ctx.sender();
        let params = voting::weight_params(election);
        assert!(vector::length(params) >= 26, E_BAD_PARAMS);
        assert!(*vector::borrow(params, 0) == MODE_EPOCH, E_INVALID_MODE);

        // Verify caller holds the active claim — trustless on-chain check.
        assert!(character_registry::has_claim(registry, tribe_id), E_NO_CLAIM);
        assert!(
            character_registry::claim_claimer(registry, tribe_id) == voter,
            E_NOT_CLAIMER
        );
        let join_epoch = character_registry::claim_epoch(registry, tribe_id);
        let proof = mint_epoch(election, character_id, join_epoch, ctx);
        transfer::public_transfer(proof, voter);
    }

    // ── Encoding helpers ──────────────────────────────────────────────────────

    fun decode_u64_at(v: &vector<u8>, off: u64): u64 {
        let mut out: u64 = 0;
        let mut i: u64 = 0;
        while (i < 8) {
            let b = (*vector::borrow(v, off + i)) as u64;
            out = out | (b << ((i * 8) as u8));
            i = i + 1;
        };
        out
    }

    fun append_u64_le(buf: &mut vector<u8>, v: u64) {
        let mut i: u64 = 0;
        while (i < 8) {
            vector::push_back(buf, ((v >> ((i * 8) as u8)) & 0xFF) as u8);
            i = i + 1;
        }
    }

    fun append_u32_le(buf: &mut vector<u8>, v: u32) {
        let mut i: u32 = 0;
        while (i < 4) {
            vector::push_back(buf, ((v >> ((i * 8) as u8)) & 0xFF) as u8);
            i = i + 1;
        }
    }

    public fun kind(): u8 { KIND_CHAR_AGE }
}
