/// CradleOS Voting — Public Privacy mode (default).
/// No commitment, no reveal phase. Ballots are immediately visible.
/// This module exists for symmetry — voting.move handles all logic inline
/// when election.privacy_kind == PRIVACY_PUBLIC.
module cradleos_voting::privacy_public {
    const KIND_PUBLIC: u8 = 0;
    public fun kind(): u8 { KIND_PUBLIC }
}
