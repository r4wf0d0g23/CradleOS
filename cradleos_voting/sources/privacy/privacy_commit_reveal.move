/// CradleOS Voting — Commit-Reveal Privacy mode.
///
/// Commit: voter posts H(salt || encoded_vote) during OPEN phase.
/// Reveal: voter posts (salt, encoded_vote) during REVEAL phase; contract
///   verifies the hash matches. Unrevealed commits are forfeit at reveal
///   deadline (intentional design choice — see §7).
///
/// All logic lives in voting.move (commit_ballot / reveal_ballot). This module
/// is a registration anchor.
module cradleos_voting::privacy_commit_reveal {
    const KIND_COMMIT_REVEAL: u8 = 1;
    public fun kind(): u8 { KIND_COMMIT_REVEAL }
}
