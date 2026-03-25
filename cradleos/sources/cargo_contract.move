/// CradleOS – Cargo Contract (v2 — trustless delivery via ItemMintedEvent POD)
///
/// Delivery proof is the on-chain ItemMintedEvent emitted by WORLD_PKG::inventory
/// when goods land in the destination SSU. The tx_digest of that event is
/// checkpoint-committed and publicly verifiable via Sui GraphQL.
///
/// Lifecycle:
///   1. Shipper calls create_contract_entry  → CargoContract shared, CRDL escrowed.
///   2. Carrier delivers goods to destination_ssu_id in-game.
///   3. Carrier calls submit_delivery_claim_entry with the tx_digest of the
///      ItemMintedEvent as proof. Carrier wallet = ctx.sender().
///   4. Dispute window opens (default 24 h). Shipper can query GraphQL to verify
///      the digest; if it doesn't match the contract terms, call dispute_delivery_entry.
///   5. After window with no dispute: anyone calls finalize_delivery_entry
///      → CRDL reward transfers to carrier.
///
/// Escape hatches:
///   • Shipper can cancel_contract_entry while status == open (no claim yet).
///   • Shipper can dispute_delivery_entry within the dispute window after a claim.
///
/// Status codes:
///   0 = open      (awaiting delivery + claim)
///   1 = claimed   (carrier submitted proof, dispute window active)
///   2 = delivered (finalized, reward paid to carrier)
///   3 = cancelled (shipper cancelled pre-claim)
///   4 = disputed  (shipper disputed within window, CRDL refunded)
module cradleos::cargo_contract {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::clock::Clock;
    use sui::event;
    use std::string::{Self, String};
    use cradleos::cradle_coin::CRADLE_COIN;

    // ── Error codes ───────────────────────────────────────────────────────────

    const ENotShipper:           u64 = 0;
    const ENotCarrier:           u64 = 1;
    const EWrongStatus:          u64 = 3;
    const EDeadlineNotPassed:    u64 = 4;
    const EDisputeWindowClosed:  u64 = 5;
    const EDisputeWindowOpen:    u64 = 6;
    const EWrongCarrier:         u64 = 7;

    // ── Status constants ──────────────────────────────────────────────────────

    const STATUS_OPEN:      u8 = 0;
    const STATUS_CLAIMED:   u8 = 1;
    const STATUS_DELIVERED: u8 = 2;
    const STATUS_CANCELLED: u8 = 3;
    const STATUS_DISPUTED:  u8 = 4;

    /// Open-carrier sentinel — any pilot may submit a claim.
    const ZERO_ADDRESS: address = @0x0000000000000000000000000000000000000000000000000000000000000000;

    /// Default dispute window: 24 hours in milliseconds.
    const DEFAULT_DISPUTE_WINDOW_MS: u64 = 86_400_000;

    // ── Structs ───────────────────────────────────────────────────────────────

    public struct CargoContract has key {
        id: UID,
        /// Pilot who created the contract and locked the reward.
        shipper: address,
        /// Designated carrier. ZERO_ADDRESS = open to any pilot.
        carrier: address,
        /// Human-readable description of the cargo.
        description: String,
        /// On-chain SSU object ID (assembly_id in ItemMintedEvent) for delivery.
        destination_ssu_id: address,
        /// EVE item type_id required in the delivery event.
        item_type_id: u64,
        /// Minimum quantity required in the delivery event.
        min_quantity: u64,
        /// CRDL reward held in escrow.
        reward: Balance<CRADLE_COIN>,
        /// Current lifecycle status (0–4).
        status: u8,
        /// Delivery claim: tx digest of the ItemMintedEvent (empty = no claim yet).
        claimed_tx_digest: vector<u8>,
        /// Milliseconds after which shipper can no longer dispute a claim.
        dispute_window_ms: u64,
        /// When the delivery claim was submitted (ms).
        claim_submitted_ms: u64,
        /// Creation timestamp (ms).
        created_ms: u64,
        /// Carrier must deliver before this timestamp (ms).
        deadline_ms: u64,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct ContractCreated has copy, drop {
        contract_id: ID,
        shipper: address,
        carrier: address,
        description: String,
        destination_ssu_id: address,
        item_type_id: u64,
        min_quantity: u64,
        reward_amount: u64,
        dispute_window_ms: u64,
        deadline_ms: u64,
        created_ms: u64,
    }

    public struct DeliveryClaimSubmitted has copy, drop {
        contract_id: ID,
        carrier: address,
        /// Hex-encoded tx digest of the matching ItemMintedEvent transaction.
        tx_digest: vector<u8>,
        claim_submitted_ms: u64,
    }

    public struct DeliveryFinalized has copy, drop {
        contract_id: ID,
        carrier: address,
        shipper: address,
        reward_amount: u64,
        tx_digest: vector<u8>,
        finalized_ms: u64,
    }

    public struct DeliveryDisputed has copy, drop {
        contract_id: ID,
        carrier: address,
        shipper: address,
        refund_amount: u64,
        timestamp_ms: u64,
    }

    public struct ContractCancelled has copy, drop {
        contract_id: ID,
        shipper: address,
        refund_amount: u64,
        timestamp_ms: u64,
    }

    // ── Entry functions ───────────────────────────────────────────────────────

    /// Shipper creates a cargo contract and escrows the CRDL reward.
    /// destination_ssu_id: the assembly_id of the SSU where goods must be delivered.
    /// item_type_id: the EVE type_id expected in the ItemMintedEvent.
    /// min_quantity: minimum quantity that must appear in the delivery event.
    /// carrier: ZERO_ADDRESS = open to any pilot; set to restrict to one pilot.
    /// dispute_window_ms: 0 = use default (86 400 000 ms = 24 h).
    entry fun create_contract_entry(
        description: vector<u8>,
        destination_ssu_id: address,
        item_type_id: u64,
        min_quantity: u64,
        coin: Coin<CRADLE_COIN>,
        carrier: address,
        dispute_window_ms: u64,
        deadline_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let shipper = ctx.sender();
        let created_ms = clock.timestamp_ms();
        let reward_amount = coin.value();
        let window = if (dispute_window_ms == 0) { DEFAULT_DISPUTE_WINDOW_MS } else { dispute_window_ms };

        let uid = object::new(ctx);
        let contract_id = object::uid_to_inner(&uid);

        event::emit(ContractCreated {
            contract_id,
            shipper,
            carrier,
            description: string::utf8(description),
            destination_ssu_id,
            item_type_id,
            min_quantity,
            reward_amount,
            dispute_window_ms: window,
            deadline_ms,
            created_ms,
        });

        transfer::share_object(CargoContract {
            id: uid,
            shipper,
            carrier,
            description: string::utf8(description),
            destination_ssu_id,
            item_type_id,
            min_quantity,
            reward: coin.into_balance(),
            status: STATUS_OPEN,
            claimed_tx_digest: vector::empty(),
            dispute_window_ms: window,
            claim_submitted_ms: 0,
            created_ms,
            deadline_ms,
        });
    }

    /// Carrier submits proof of delivery.
    /// tx_digest: the Sui transaction digest containing the matching ItemMintedEvent.
    ///   Verifiable at: https://graphql.testnet.sui.io/graphql
    ///   Query: { transaction(digest: "<tx_digest>") { effects { status }
    ///            events { nodes { contents { json } } } } }
    /// The shipper has `dispute_window_ms` to query GraphQL and dispute if the
    /// digest does not prove delivery to destination_ssu_id of item_type_id × min_quantity.
    entry fun submit_delivery_claim_entry(
        contract: &mut CargoContract,
        tx_digest: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(contract.status == STATUS_OPEN, EWrongStatus);
        let sender = ctx.sender();

        // Designate carrier if open contract, or verify match
        if (contract.carrier == ZERO_ADDRESS) {
            contract.carrier = sender;
        } else {
            assert!(sender == contract.carrier, EWrongCarrier);
        };

        contract.status = STATUS_CLAIMED;
        contract.claimed_tx_digest = tx_digest;
        contract.claim_submitted_ms = clock.timestamp_ms();

        event::emit(DeliveryClaimSubmitted {
            contract_id: object::uid_to_inner(&contract.id),
            carrier: contract.carrier,
            tx_digest: contract.claimed_tx_digest,
            claim_submitted_ms: contract.claim_submitted_ms,
        });
    }

    /// Shipper disputes a delivery claim within the dispute window.
    /// Shipper should verify via GraphQL that the submitted tx_digest does NOT
    /// contain a matching ItemMintedEvent before disputing.
    /// On dispute: CRDL reward is refunded to shipper; contract closes as disputed.
    entry fun dispute_delivery_entry(
        contract: &mut CargoContract,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(contract.status == STATUS_CLAIMED, EWrongStatus);
        assert!(ctx.sender() == contract.shipper, ENotShipper);
        let now = clock.timestamp_ms();
        assert!(now <= contract.claim_submitted_ms + contract.dispute_window_ms, EDisputeWindowClosed);

        let refund_amount = balance::value(&contract.reward);
        let shipper = contract.shipper;
        let carrier = contract.carrier;
        contract.status = STATUS_DISPUTED;

        let refund_coin = coin::from_balance(balance::withdraw_all(&mut contract.reward), ctx);
        transfer::public_transfer(refund_coin, shipper);

        event::emit(DeliveryDisputed {
            contract_id: object::uid_to_inner(&contract.id),
            carrier,
            shipper,
            refund_amount,
            timestamp_ms: now,
        });
    }

    /// Finalize a delivery claim after the dispute window has passed.
    /// Can be called by anyone — permissionless once the window closes.
    /// CRDL reward transfers to the carrier.
    entry fun finalize_delivery_entry(
        contract: &mut CargoContract,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(contract.status == STATUS_CLAIMED, EWrongStatus);
        let now = clock.timestamp_ms();
        assert!(now > contract.claim_submitted_ms + contract.dispute_window_ms, EDisputeWindowOpen);

        let reward_amount = balance::value(&contract.reward);
        let carrier = contract.carrier;
        let shipper = contract.shipper;
        let tx_digest = contract.claimed_tx_digest;
        contract.status = STATUS_DELIVERED;

        let reward_coin = coin::from_balance(balance::withdraw_all(&mut contract.reward), ctx);
        transfer::public_transfer(reward_coin, carrier);

        event::emit(DeliveryFinalized {
            contract_id: object::uid_to_inner(&contract.id),
            carrier,
            shipper,
            reward_amount,
            tx_digest,
            finalized_ms: now,
        });
    }

    /// Shipper cancels the contract before any delivery claim (status == open).
    /// CRDL reward is refunded.
    entry fun cancel_contract_entry(
        contract: &mut CargoContract,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(contract.status == STATUS_OPEN, EWrongStatus);
        assert!(ctx.sender() == contract.shipper, ENotShipper);

        let refund_amount = balance::value(&contract.reward);
        let shipper = contract.shipper;
        contract.status = STATUS_CANCELLED;

        let refund_coin = coin::from_balance(balance::withdraw_all(&mut contract.reward), ctx);
        transfer::public_transfer(refund_coin, shipper);

        event::emit(ContractCancelled {
            contract_id: object::uid_to_inner(&contract.id),
            shipper,
            refund_amount,
            timestamp_ms: clock.timestamp_ms(),
        });
    }

    // ── Public reads ──────────────────────────────────────────────────────────

    public fun shipper(c: &CargoContract): address             { c.shipper }
    public fun carrier(c: &CargoContract): address             { c.carrier }
    public fun status(c: &CargoContract): u8                   { c.status }
    public fun reward_amount(c: &CargoContract): u64           { balance::value(&c.reward) }
    public fun destination_ssu_id(c: &CargoContract): address  { c.destination_ssu_id }
    public fun item_type_id(c: &CargoContract): u64            { c.item_type_id }
    public fun min_quantity(c: &CargoContract): u64            { c.min_quantity }
    public fun deadline_ms(c: &CargoContract): u64             { c.deadline_ms }
    public fun created_ms(c: &CargoContract): u64              { c.created_ms }
    public fun claimed_tx_digest(c: &CargoContract): &vector<u8> { &c.claimed_tx_digest }
    public fun claim_submitted_ms(c: &CargoContract): u64      { c.claim_submitted_ms }
    public fun dispute_window_ms(c: &CargoContract): u64       { c.dispute_window_ms }
    public fun description(c: &CargoContract): &String         { &c.description }
}
