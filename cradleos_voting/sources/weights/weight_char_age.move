/// CradleOS Voting — Character-age-weighted vote.
///
/// Weight is a function of character age (epochs since joining the game/tribe).
/// Three formula modes are supported, selected by the election creator in params.
///
/// weight_params layout:
///   [0]       mode:        u8  (0=linear, 1=sqrt, 2=capped_linear)
///   [1..9]    divisor:     u64 LE (linear/capped_linear; 0 treated as 1)
///   [9..17]   cap:         u64 LE (0=no cap)
///   [17..25]  min_epochs:  u64 LE (0=no minimum age required)
///
/// Formula per mode:
///   linear        weight = age_epochs / divisor
///   sqrt          weight = floor(sqrt(age_epochs))
///   capped_linear weight = min(age_epochs / divisor, cap)  [cap>0]
///
/// Age source:
///   1. prove_char_age_via_registry: Trustless. Uses claim_epoch from
///      CharacterRegistry as the join-epoch proxy. Only works for tribe founders
///      (those who hold the active claim for a tribe_id). This is on-chain and
///      requires no external trust assumptions beyond the registry claimer mechanism.
///
///   2. prove_char_age_self_attested: Voter self-reports join_epoch. Appropriate for
///      elections in closed communities where misreporting confers little advantage,
///      or where Sybil resistance is provided by eligibility gating rather than age.
///      See TODO below for the proper attestation mechanism.
///
/// Security model:
///   - inputs_hash binds: KIND + all params + join_epoch + age_epochs at proof time.
///   - Off-chain reproducibility: verifier recomputes age from join_epoch + epoch at
///     proof mint time (ctx.epoch()), applies the same formula, and checks weight.
///   - Trust risk (self-attested path): voter can report an earlier join_epoch to
///     inflate weight. Mitigate by pairing with eligibility_tribe_ingame or
///     eligibility_tribe_cradleos to ensure the voter is a genuine member.
///
/// TODO: Add a CharAgeAttestation object minted by a trusted attestor in
///   cradleos_voting (analogous to EpochAttestation in cradleos::character_registry).
///   This would make age proofs fully trustless for non-founder members.
///   Requires: CapabilityBearer shared object with admin-controlled attestor role.
module cradleos_voting::weight_char_age {
    use sui::hash;
    use cradleos_voting::voting::{Self, Election, WeightProof};
    use cradleos::character_registry::{Self, CharacterRegistry};

    const KIND_CHAR_AGE: u8 = 2;

    // Formula mode constants
    const MODE_LINEAR:       u8 = 0;
    const MODE_SQRT:         u8 = 1;
    const MODE_CAPPED_LINEAR: u8 = 2;

    // Error codes
    const E_BAD_PARAMS:     u64 = 0;
    const E_BELOW_MIN_AGE:  u64 = 1;
    const E_INVALID_MODE:   u64 = 2;
    const E_NO_CLAIM:       u64 = 3;
    const E_NOT_CLAIMER:    u64 = 4;

    // weight_params layout:
    //   [0]      mode:       u8  (0=linear, 1=sqrt, 2=capped_linear)
    //   [1..9]   divisor:    u64 LE
    //   [9..17]  cap:        u64 LE (0=no cap)
    //   [17..25] min_epochs: u64 LE (0=no minimum)

    /// Core weight computation. join_epoch is the character's on-chain first-seen epoch.
    /// age = current_epoch - join_epoch (saturating: 0 if current < join).
    ///
    /// Returns a WeightProof bound to the election/voter/character with inputs_hash
    /// capturing all deterministic inputs for off-chain reproducibility.
    public fun mint(
        election: &Election,
        character_id: u32,
        join_epoch: u64,
        ctx: &mut TxContext,
    ): WeightProof {
        let voter = ctx.sender();
        let params = voting::weight_params(election);
        assert!(vector::length(params) >= 25, E_BAD_PARAMS);

        let mode       = *vector::borrow(params, 0);
        let divisor    = decode_u64_at(params, 1);
        let cap        = decode_u64_at(params, 9);
        let min_epochs = decode_u64_at(params, 17);

        let current_epoch = ctx.epoch();
        // Saturating subtraction: if join_epoch is somehow in the future, age = 0
        let age_epochs = if (current_epoch >= join_epoch) {
            current_epoch - join_epoch
        } else {
            0
        };

        assert!(age_epochs >= min_epochs, E_BELOW_MIN_AGE);

        let weight = compute_weight(mode, age_epochs, divisor, cap);

        // inputs_hash: KIND + params + join_epoch + age_epochs (all deterministic)
        // Off-chain verifier: read join_epoch from event, re-derive age vs epoch at mint.
        let mut hbuf = vector::empty<u8>();
        vector::push_back(&mut hbuf, KIND_CHAR_AGE);
        vector::append(&mut hbuf, *params);
        append_u64_le(&mut hbuf, join_epoch);
        append_u64_le(&mut hbuf, age_epochs);
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

    /// Dispatch formula based on mode byte.
    fun compute_weight(mode: u8, age_epochs: u64, divisor: u64, cap: u64): u64 {
        // Treat divisor=0 as 1 to prevent division by zero
        let d = if (divisor == 0) { 1 } else { divisor };
        let raw = if (mode == MODE_LINEAR) {
            age_epochs / d
        } else if (mode == MODE_SQRT) {
            // Precision note: integer floor(sqrt(n)).
            // For ages up to 10^9 epochs, isqrt gives results up to ~31623.
            // This is sufficient for vote weight discrimination.
            isqrt(age_epochs)
        } else if (mode == MODE_CAPPED_LINEAR) {
            let w = age_epochs / d;
            if (cap > 0 && w > cap) { cap } else { w }
        } else {
            abort E_INVALID_MODE
        };
        // Apply cap to linear and sqrt modes too when cap > 0
        if (mode != MODE_CAPPED_LINEAR && cap > 0 && raw > cap) { cap } else { raw }
    }

    /// Integer square root (floor) via Newton's method.
    ///
    /// Precision: exact floor(sqrt(n)) for all u64 n.
    /// Convergence: O(log log n) iterations (typically 5-8 for realistic epoch values).
    /// No floating point; no approximation beyond floor truncation.
    /// Initial estimate (n+1)/2: safe for n < u64::MAX (epoch counts are << 2^63).
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

    /// Trustless path: prove character age via CharacterRegistry claim_epoch.
    ///
    /// Works for tribe founders (wallets holding an active registry claim).
    /// claim_epoch is used as the character's "join epoch" proxy. This is the
    /// epoch when the wallet registered its tribe_id claim on-chain.
    ///
    /// Trust model: fully trustless. All inputs are on-chain state.
    /// Limitation: only accessible to tribe founders/claimants, not general members.
    public entry fun prove_char_age_via_registry(
        election: &Election,
        registry: &CharacterRegistry,
        tribe_id: u32,
        character_id: u32,
        ctx: &mut TxContext,
    ) {
        let voter = ctx.sender();
        // Verify caller holds the active claim (trustless on-chain check)
        assert!(character_registry::has_claim(registry, tribe_id), E_NO_CLAIM);
        assert!(
            character_registry::claim_claimer(registry, tribe_id) == voter,
            E_NOT_CLAIMER
        );
        let join_epoch = character_registry::claim_epoch(registry, tribe_id);
        let proof = mint(election, character_id, join_epoch, ctx);
        transfer::public_transfer(proof, voter);
    }

    /// Self-attested path: voter provides their join_epoch directly.
    ///
    /// TRUST ASSUMPTION: voter honestly self-reports their join_epoch.
    /// The proof's inputs_hash records the reported epoch for off-chain auditability:
    /// any observer can re-derive the weight given the voter's reported join_epoch.
    ///
    /// When to use: closed elections where voters have no incentive to inflate age
    /// (e.g. participation rewards that don't scale with weight), or where eligibility
    /// gating (eligibility_tribe_ingame / eligibility_tribe_cradleos) already ensures
    /// that only genuine members can mint proofs.
    ///
    /// TODO: Replace with a CharAgeAttestation mechanism — a short-lived capability
    ///   object minted by a CradleOS-controlled attestor key after verifying the
    ///   voter's EVE Frontier CharacterCreatedEvent checkpoint sequence off-chain.
    ///   This would provide trustless age proofs for non-founder members without
    ///   modifying cradleos::character_registry.
    public entry fun prove_char_age_self_attested(
        election: &Election,
        join_epoch: u64,
        character_id: u32,
        ctx: &mut TxContext,
    ) {
        let voter = ctx.sender();
        let proof = mint(election, character_id, join_epoch, ctx);
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

    public fun kind(): u8 { KIND_CHAR_AGE }
}
