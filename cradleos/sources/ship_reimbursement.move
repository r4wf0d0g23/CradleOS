/// CradleOS – Ship Reimbursement Plan (SRP) / Combat Insurance
///
/// Trustless coin payout triggered by on-chain Killmail objects.
/// Generic over coin type T — works with EVE, LUX, or any Sui coin.
///
/// Use cases:
///   • Tribal SRP  — founder funds a pool; any tribe member who loses a ship
///                   during a sanctioned op claims reimbursement.
///   • Personal insurance — pilot self-insures; any Killmail where they are
///                          the victim triggers the payout.
///
/// Proof of loss = the Killmail object ID (on-chain, permanent, publicly
/// verifiable via Sui GraphQL or suiscan).  Dispute window lets the sponsor
/// query the killmail and challenge fraudulent claims before funds leave.
///
/// Lifecycle:
///   1. Sponsor calls create_policy_entry<T> → SRPPolicy<T> shared, funded.
///   2. Pilot loses ship → Killmail object is created on-chain by WORLD_PKG.
///   3. Pilot calls submit_claim_entry(policy, killmail_object_id) →
///      SRPClaim shared object created, dispute window starts.
///   4. Sponsor verifies the Killmail object:
///        • victim_id matches claimant's registered character
///        • kill_timestamp is within policy valid window
///        • loss_type is SHIP (not STRUCTURE, unless policy covers both)
///      If fraudulent → call dispute_claim_entry within window.
///   5. After window with no dispute → anyone calls finalize_claim_entry →
///      payout_per_loss transfers from policy fund to claimant.
///   6. Sponsor can top_up_policy_entry any time, or drain_policy_entry when done.
///
/// Claim status codes:
///   0 = pending   (waiting for dispute window to close)
///   1 = paid      (finalized, coin sent to claimant)
///   2 = disputed  (sponsor rejected within window, no payout)
///
/// Policy status codes:
///   0 = active
///   1 = drained  (sponsor reclaimed remaining funds)
module cradleos::ship_reimbursement {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::clock::Clock;
    use sui::event;
    use std::string::{Self, String};

    // ── Error codes ───────────────────────────────────────────────────────────

    const ENotSponsor:           u64 = 0;
    const EWrongStatus:          u64 = 1;
    const EDisputeWindowClosed:  u64 = 2;
    const EDisputeWindowOpen:    u64 = 3;
    const EInsufficientFunds:    u64 = 4;
    const EPolicyInactive:       u64 = 5;

    // ── Status codes ──────────────────────────────────────────────────────────

    const CLAIM_PENDING:  u8 = 0;
    const CLAIM_PAID:     u8 = 1;
    const CLAIM_DISPUTED: u8 = 2;

    const POLICY_ACTIVE:  u8 = 0;
    const POLICY_DRAINED: u8 = 1;

    /// Default dispute window: 24 hours.
    const DEFAULT_DISPUTE_WINDOW_MS: u64 = 86_400_000;

    // ── Structs ───────────────────────────────────────────────────────────────

    /// Shared. The funded reimbursement pool. Generic over coin type T.
    public struct SRPPolicy<phantom T> has key {
        id: UID,
        /// Tribe founder or individual pilot who funds and administers the policy.
        sponsor: address,
        /// Human-readable description (e.g. "Reapers Doctrine SRP — March 2026 op").
        description: String,
        /// Coin amount paid out per approved claim.
        payout_per_loss: u64,
        /// Maximum number of claims (0 = unlimited while funded).
        max_claims: u64,
        /// How many claims have been paid so far.
        claims_paid: u64,
        /// Coin reserve.
        fund: Balance<T>,
        /// Policy is only claimable between these timestamps (ms).
        valid_from_ms: u64,
        valid_until_ms: u64,
        /// How long after claim submission the sponsor has to dispute (ms).
        dispute_window_ms: u64,
        /// Policy lifecycle status.
        status: u8,
    }

    /// Shared. One per loss event submitted by a pilot.
    public struct SRPClaim has key {
        id: UID,
        /// Which policy this claim is against.
        policy_id: ID,
        /// The wallet address of the killed pilot (ctx.sender() at submission time).
        claimant: address,
        /// On-chain Killmail object ID — the proof of ship loss.
        killmail_object_id: address,
        /// When the claim was submitted (ms).
        claim_submitted_ms: u64,
        /// Claim lifecycle status (0=pending, 1=paid, 2=disputed).
        status: u8,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct PolicyCreated has copy, drop {
        policy_id: ID,
        sponsor: address,
        description: String,
        payout_per_loss: u64,
        max_claims: u64,
        initial_fund: u64,
        valid_from_ms: u64,
        valid_until_ms: u64,
        dispute_window_ms: u64,
    }

    public struct PolicyToppedUp has copy, drop {
        policy_id: ID,
        sponsor: address,
        amount_added: u64,
        new_balance: u64,
    }

    public struct ClaimSubmitted has copy, drop {
        claim_id: ID,
        policy_id: ID,
        claimant: address,
        killmail_object_id: address,
        claim_submitted_ms: u64,
    }

    public struct ClaimFinalized has copy, drop {
        claim_id: ID,
        policy_id: ID,
        claimant: address,
        payout: u64,
        killmail_object_id: address,
        finalized_ms: u64,
    }

    public struct ClaimDisputed has copy, drop {
        claim_id: ID,
        policy_id: ID,
        claimant: address,
        sponsor: address,
        killmail_object_id: address,
        timestamp_ms: u64,
    }

    public struct PolicyDrained has copy, drop {
        policy_id: ID,
        sponsor: address,
        amount_recovered: u64,
        timestamp_ms: u64,
    }

    // ── Entry functions ───────────────────────────────────────────────────────

    /// Sponsor creates a funded SRP policy.
    entry fun create_policy_entry<T>(
        description: vector<u8>,
        payout_per_loss: u64,
        max_claims: u64,
        valid_from_ms: u64,
        valid_until_ms: u64,
        dispute_window_ms: u64,
        coin: Coin<T>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let _ = clock;
        let sponsor = ctx.sender();
        let initial_fund = coin.value();
        let window = if (dispute_window_ms == 0) { DEFAULT_DISPUTE_WINDOW_MS } else { dispute_window_ms };

        let uid = object::new(ctx);
        let policy_id = object::uid_to_inner(&uid);

        event::emit(PolicyCreated {
            policy_id,
            sponsor,
            description: string::utf8(description),
            payout_per_loss,
            max_claims,
            initial_fund,
            valid_from_ms,
            valid_until_ms,
            dispute_window_ms: window,
        });

        transfer::share_object(SRPPolicy<T> {
            id: uid,
            sponsor,
            description: string::utf8(description),
            payout_per_loss,
            max_claims,
            claims_paid: 0,
            fund: coin.into_balance(),
            valid_from_ms,
            valid_until_ms,
            dispute_window_ms: window,
            status: POLICY_ACTIVE,
        });
    }

    /// Sponsor tops up the policy fund.
    entry fun top_up_policy_entry<T>(
        policy: &mut SRPPolicy<T>,
        coin: Coin<T>,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == policy.sponsor, ENotSponsor);
        let amount_added = coin.value();
        balance::join(&mut policy.fund, coin.into_balance());

        event::emit(PolicyToppedUp {
            policy_id: object::uid_to_inner(&policy.id),
            sponsor: policy.sponsor,
            amount_added,
            new_balance: balance::value(&policy.fund),
        });
    }

    /// Killed pilot submits a loss claim.
    entry fun submit_claim_entry<T>(
        policy: &mut SRPPolicy<T>,
        killmail_object_id: address,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(policy.status == POLICY_ACTIVE, EPolicyInactive);
        assert!(balance::value(&policy.fund) >= policy.payout_per_loss, EInsufficientFunds);
        assert!(policy.max_claims == 0 || policy.claims_paid < policy.max_claims, EWrongStatus);

        let claimant = ctx.sender();
        let claim_submitted_ms = clock.timestamp_ms();
        let uid = object::new(ctx);
        let claim_id = object::uid_to_inner(&uid);
        let policy_id = object::uid_to_inner(&policy.id);

        event::emit(ClaimSubmitted {
            claim_id,
            policy_id,
            claimant,
            killmail_object_id,
            claim_submitted_ms,
        });

        transfer::share_object(SRPClaim {
            id: uid,
            policy_id,
            claimant,
            killmail_object_id,
            claim_submitted_ms,
            status: CLAIM_PENDING,
        });
    }

    /// Sponsor disputes a claim within the dispute window.
    entry fun dispute_claim_entry<T>(
        claim: &mut SRPClaim,
        policy: &SRPPolicy<T>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(claim.status == CLAIM_PENDING, EWrongStatus);
        assert!(ctx.sender() == policy.sponsor, ENotSponsor);
        assert!(claim.policy_id == object::uid_to_inner(&policy.id), EWrongStatus);
        let now = clock.timestamp_ms();
        assert!(now <= claim.claim_submitted_ms + policy.dispute_window_ms, EDisputeWindowClosed);

        claim.status = CLAIM_DISPUTED;

        event::emit(ClaimDisputed {
            claim_id: object::uid_to_inner(&claim.id),
            policy_id: claim.policy_id,
            claimant: claim.claimant,
            sponsor: policy.sponsor,
            killmail_object_id: claim.killmail_object_id,
            timestamp_ms: now,
        });
    }

    /// Finalize a pending claim after the dispute window has passed.
    /// Permissionless — anyone can call this once the window closes.
    entry fun finalize_claim_entry<T>(
        claim: &mut SRPClaim,
        policy: &mut SRPPolicy<T>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let _ = ctx;
        assert!(claim.status == CLAIM_PENDING, EWrongStatus);
        assert!(claim.policy_id == object::uid_to_inner(&policy.id), EWrongStatus);
        let now = clock.timestamp_ms();
        assert!(now > claim.claim_submitted_ms + policy.dispute_window_ms, EDisputeWindowOpen);
        assert!(balance::value(&policy.fund) >= policy.payout_per_loss, EInsufficientFunds);

        claim.status = CLAIM_PAID;
        policy.claims_paid = policy.claims_paid + 1;

        let payout_coin = coin::from_balance(
            balance::split(&mut policy.fund, policy.payout_per_loss),
            ctx,
        );
        transfer::public_transfer(payout_coin, claim.claimant);

        event::emit(ClaimFinalized {
            claim_id: object::uid_to_inner(&claim.id),
            policy_id: claim.policy_id,
            claimant: claim.claimant,
            payout: policy.payout_per_loss,
            killmail_object_id: claim.killmail_object_id,
            finalized_ms: now,
        });
    }

    /// Sponsor reclaims remaining fund and closes the policy.
    entry fun drain_policy_entry<T>(
        policy: &mut SRPPolicy<T>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let _ = clock;
        assert!(ctx.sender() == policy.sponsor, ENotSponsor);
        assert!(policy.status == POLICY_ACTIVE, EPolicyInactive);

        let amount_recovered = balance::value(&policy.fund);
        policy.status = POLICY_DRAINED;

        let recovered_coin = coin::from_balance(balance::withdraw_all(&mut policy.fund), ctx);
        transfer::public_transfer(recovered_coin, policy.sponsor);

        event::emit(PolicyDrained {
            policy_id: object::uid_to_inner(&policy.id),
            sponsor: policy.sponsor,
            amount_recovered,
            timestamp_ms: clock.timestamp_ms(),
        });
    }

    // ── Public reads ──────────────────────────────────────────────────────────

    public fun sponsor<T>(p: &SRPPolicy<T>): address           { p.sponsor }
    public fun payout_per_loss<T>(p: &SRPPolicy<T>): u64       { p.payout_per_loss }
    public fun max_claims<T>(p: &SRPPolicy<T>): u64            { p.max_claims }
    public fun claims_paid<T>(p: &SRPPolicy<T>): u64           { p.claims_paid }
    public fun fund_balance<T>(p: &SRPPolicy<T>): u64          { balance::value(&p.fund) }
    public fun valid_from_ms<T>(p: &SRPPolicy<T>): u64         { p.valid_from_ms }
    public fun valid_until_ms<T>(p: &SRPPolicy<T>): u64        { p.valid_until_ms }
    public fun dispute_window_ms<T>(p: &SRPPolicy<T>): u64     { p.dispute_window_ms }
    public fun policy_status<T>(p: &SRPPolicy<T>): u8          { p.status }
    public fun description<T>(p: &SRPPolicy<T>): &String       { &p.description }

    public fun claim_claimant(c: &SRPClaim): address     { c.claimant }
    public fun claim_status(c: &SRPClaim): u8            { c.status }
    public fun claim_policy_id(c: &SRPClaim): ID         { c.policy_id }
    public fun killmail_object_id(c: &SRPClaim): address { c.killmail_object_id }
    public fun claim_submitted_ms(c: &SRPClaim): u64     { c.claim_submitted_ms }
}
