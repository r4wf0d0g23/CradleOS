/// CradleOS Voting — ZK-Private (designed-for, deferred).
///
/// Voter submits a ZK proof of correct vote construction. Tally is computed
/// via threshold-decrypted aggregation or homomorphic encryption.
///
/// v1: stub. voting.move::create_election aborts if privacy_kind == 2.
/// v2 target: Groth16 verifier integration via Sui's zklogin precompiles.
module cradleos_voting::privacy_zk {
    const KIND_ZK: u8 = 2;
    public fun kind(): u8 { KIND_ZK }
}
