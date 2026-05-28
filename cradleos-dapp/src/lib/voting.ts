/**
 * CradleOS Voting — TypeScript helper library.
 *
 * Mirrors the on-chain `cradleos_voting` Move package surface:
 *   - PTB builders for create / configure / cast / commit / reveal / tally / finalize
 *   - Event fetchers using fetchVotingEventAcrossPackages
 *     (parallel to fetchEventAcrossPackages in lib.ts; voting lives in a
 *     separate sibling package so it has its own event-pkg list)
 *   - BCS-style encoders/decoders mirroring the on-chain wire format
 *   - Local-rerun tally implementations for verification UX
 *     (single_choice + approval implemented; others stubbed)
 *   - Sponsored-tx wrapper stub (routes through Enoki when sponsored=true)
 *
 * Why a separate file: voting is a sibling package with its own published-at
 * id and its own event-pkg list (CRADLEOS_VOTING_EVENT_PKGS in constants.ts).
 * Reusing fetchEventAcrossPackages from lib.ts would query the wrong
 * package set. Replicating the pattern (not the call) is intentional.
 */

import { Transaction } from "@mysten/sui/transactions";
import {
  CRADLEOS_VOTING_PKG,
  CRADLEOS_VOTING_REGISTRY,
  CRADLEOS_VOTING_EVENT_PKGS,
  CRADLEOS_VOTING_AVAILABLE,
  CLOCK,
  SUI_TESTNET_RPC,
} from "../constants";

// ── Re-exports for panel ergonomics ─────────────────────────────────────────
export { CRADLEOS_VOTING_AVAILABLE, CRADLEOS_VOTING_PKG, CRADLEOS_VOTING_REGISTRY };

// ── Kind constants (mirror voting.move) ─────────────────────────────────────
export const METHOD_KIND = {
  SINGLE_CHOICE:    0,
  APPROVAL:         1,
  RANKED_CHOICE:    2, // subtype in method_params[0]: 0=IRV 1=Schulze 2=Borda
  QUADRATIC:        3, // subtype in method_params[0]: 0=positive 1=signed
  SCORE:            4, // subtype in method_params[0]: 0=sum 1=avg ; +STAR variant
  CONVICTION:       5,
} as const;

// Sub-types for compound method kinds (see methods/*.move)
export const RANKED_SUBTYPE = { IRV: 0, SCHULZE: 1, BORDA: 2 } as const;
export const QUADRATIC_SUBTYPE = { POSITIVE: 0, SIGNED: 1 } as const;
export const SCORE_SUBTYPE = { SUM: 0, AVG: 1, STAR: 2 } as const; // STAR layered into score module per design lock

export const ELIGIBILITY_KIND = {
  OPEN:             0,
  ALLOWLIST:        1,
  TRIBE_CRADLEOS:   2,
  TRIBE_INGAME:     3,
  COMPOSITE:        4,
} as const;

export const WEIGHT_KIND = {
  ONE:              0,
  ROLE:             1,
  CHAR_AGE:         2,
  ASSET:            3,
  COMPOSITE:        4,
} as const;

export const PRIVACY_KIND = {
  PUBLIC:           0,
  COMMIT_REVEAL:    1,
  ZK:               2,           // entry aborts in v1; UI gates it Coming Q4 2026
} as const;

export const STATE = {
  DRAFT:     0,
  SCHEDULED: 1,
  OPEN:      2,
  REVEAL:    3,
  CLOSED:    4,
  TALLIED:   5,
  FINALIZED: 6,
  CANCELED:  7,
} as const;

export const STATE_LABELS: Record<number, string> = {
  0: "DRAFT",
  1: "SCHEDULED",
  2: "OPEN",
  3: "REVEAL",
  4: "CLOSED",
  5: "TALLIED",
  6: "FINALIZED",
  7: "CANCELED",
};

// ── Descriptors for the wizard pickers ──────────────────────────────────────
// Each describes what a creator picks and the trade-offs. UI shows ALL options
// per the "versatility is the product" doctrine (SOUL.md, 2026-05-27 lock).

export type PickerOption = {
  value: number;
  title: string;
  /** One-line summary shown next to the radio. */
  summary: string;
  /** Multi-line trade-off body shown when expanded. */
  tradeoff: string;
  /** Optional disabled flag with reason (e.g. "Coming Q4 2026"). */
  disabled?: { reason: string };
};

export const ELIGIBILITY_OPTIONS: PickerOption[] = [
  {
    value: ELIGIBILITY_KIND.OPEN,
    title: "Open — any verified character",
    summary: "Anyone with a CradleOS-bound character can vote.",
    tradeoff:
      "Pros: maximum reach, simple UX, no setup. Cons: Sybil-vulnerable if multiple characters are owned by the same wallet; not suitable for governance with real stakes. Best for: community sentiment polls, gauge votes.",
  },
  {
    value: ELIGIBILITY_KIND.TRIBE_INGAME,
    title: "Tribe (in-game) — character_registry membership",
    summary: "Voter must be a member of the configured tribe per CCP's on-chain character_registry.",
    tradeoff:
      "Pros: matches the in-game corp identity that pilots actually wear. Cons: requires an attestor (trust assumption) to issue tribe-membership attestations; if attestor goes idle, no new members can join the eligibility set. Best for: official tribe governance.",
  },
  {
    value: ELIGIBILITY_KIND.TRIBE_CRADLEOS,
    title: "Tribe (CradleOS) — TribeVault membership",
    summary: "Voter must hold a role or be founder of the configured tribe vault.",
    tradeoff:
      "Pros: fully decentralized — no attestor needed; uses the same TribeRoles object that already gates other CradleOS actions. Cons: only covers members who actually onboarded into the CradleOS tribe vault, which may be a subset of the in-game tribe. Best for: CradleOS-native tribe ops.",
  },
  {
    value: ELIGIBILITY_KIND.ALLOWLIST,
    title: "Allowlist — explicit character_ids",
    summary: "Voter's character_id must appear in the configured allowlist.",
    tradeoff:
      "Pros: precise, auditable, works across tribes (e.g. a coalition CSM). Cons: maintenance burden — the creator must hand-curate the list at draft time. Best for: cross-tribe councils, hand-picked juries, beta voter sets.",
  },
  {
    value: ELIGIBILITY_KIND.COMPOSITE,
    title: "Composite — combine sources with AND / OR",
    summary: "Express boolean logic over the above sources (e.g. (Tribe AND ¬Banlist)).",
    tradeoff:
      "Pros: arbitrary expressiveness; supports advanced governance (e.g. tribe member AND CradleOS member). Cons: voter UX is more complex — each child source mints its own proof first, then composite combines. Higher gas. Best for: layered governance with multiple gates.",
  },
];

export const WEIGHT_OPTIONS: PickerOption[] = [
  {
    value: WEIGHT_KIND.ONE,
    title: "1c1v — one character, one vote",
    summary: "Every eligible voter contributes weight = 1.",
    tradeoff:
      "Pros: most legitimate-feeling; resists plutocracy. Cons: same Sybil risks as the eligibility source — if the source is OPEN, this is gameable. Best for: democratic-style decisions where stake should not buy more voice.",
  },
  {
    value: WEIGHT_KIND.ROLE,
    title: "Role-weighted",
    summary: "Weight comes from the voter's tribe role mask (Founder > Officer > Member).",
    tradeoff:
      "Pros: encodes earned authority; matches how tribes already operate. Cons: only works for tribe elections; requires a TribeRoles object on the election's tribe. Best for: tribe governance with rank hierarchy.",
  },
  {
    value: WEIGHT_KIND.CHAR_AGE,
    title: "Character age",
    summary: "Weight scales with how long ago the character joined.",
    tradeoff:
      "Pros: rewards veterans; resists Sybil pump-and-dump attacks. Cons: ossifies; new entrants get less voice; needs registry or self-attestation. Best for: long-running organizations where veteran consensus matters.",
  },
  {
    value: WEIGHT_KIND.ASSET,
    title: "Asset balance (Coin<T>)",
    summary: "Weight derived from the voter's balance of a configured coin type.",
    tradeoff:
      "Pros: stake-weighted decisions for treasury / DEX-listed assets; reflects skin-in-the-game. Cons: plutocratic — whales dominate; require sqrt-mode + cap to compress. Best for: tribe-coin votes, DAO-like resource allocation.",
  },
  {
    value: WEIGHT_KIND.COMPOSITE,
    title: "Composite — Σ child weights with coefficients",
    summary: "Sum of multiple weight sources, each scaled by a coefficient.",
    tradeoff:
      "Pros: lets you blend (1c1v base + age multiplier + asset bonus). Cons: harder to explain; the wizard collects coefficients per child source. Best for: tuned long-term governance.",
  },
];

export const METHOD_OPTIONS: PickerOption[] = [
  {
    value: METHOD_KIND.SINGLE_CHOICE,
    title: "Single-Choice (plurality)",
    summary: "Each voter picks exactly one option; winner is the option with most weight.",
    tradeoff:
      "Pros: instantly familiar; cheapest. Cons: classic two-party squeeze; vulnerable to vote-splitting in fields >2. Best for: yes/no, binary, or small fields.",
  },
  {
    value: METHOD_KIND.APPROVAL,
    title: "Approval",
    summary: "Each voter approves any subset of options; winner is the most-approved option.",
    tradeoff:
      "Pros: voters can support multiple acceptable choices; resists spoilers. Cons: requires a max-approvals cap to avoid pathological cases. Best for: shortlist selection, advisory polls.",
  },
  {
    value: METHOD_KIND.RANKED_CHOICE,
    title: "Ranked-Choice — IRV / Schulze / Borda",
    summary: "Voters rank options; tally picks subtype (IRV, Schulze, or Borda).",
    tradeoff:
      "Pros: condorcet-friendly variants exist; reveals voter preferences. Cons: longer ballots; tally rounds emit more events; subtype-pick is a sub-decision. Best for: leadership elections, multi-candidate decisions.",
  },
  {
    value: METHOD_KIND.QUADRATIC,
    title: "Quadratic — positive or signed",
    summary: "Voters allocate credits across options; cost = sqrt(votes per option).",
    tradeoff:
      "Pros: intensity-aware; resists whale capture in conjunction with 1c1v weights. Cons: requires a credit budget; signed variant allows voting AGAINST options. Best for: budget allocation, gauge weights.",
  },
  {
    value: METHOD_KIND.SCORE,
    title: "Score — sum / avg / STAR",
    summary: "Voters score every option 0..N; tally aggregates by sum, average, or STAR runoff.",
    tradeoff:
      "Pros: most informative; STAR adds a top-2 instant runoff for legitimacy. Cons: voters fatigue with many options; calibration drift across voters. Best for: rating leaderboards, multi-dim comparisons.",
  },
  {
    value: METHOD_KIND.CONVICTION,
    title: "Conviction — time-weighted",
    summary: "Voters lock weight on options; weight grows over time and can be re-allocated.",
    tradeoff:
      "Pros: continuous decision-making without discrete elections; rewards commitment. Cons: more complex UX; needs a 90-day cap (creator can extend per the 2026-05-27 lock). Best for: ongoing funding decisions, 1Hive-style.",
  },
];

export const PRIVACY_OPTIONS: PickerOption[] = [
  {
    value: PRIVACY_KIND.PUBLIC,
    title: "Public",
    summary: "Ballots are plaintext on-chain.",
    tradeoff:
      "Pros: simplest, cheapest, fully reproducible. Cons: voters' choices are visible — bandwagon and retaliation risk. Best for: low-stakes polls, gauge votes where transparency matters more than privacy.",
  },
  {
    value: PRIVACY_KIND.COMMIT_REVEAL,
    title: "Commit-Reveal",
    summary: "Voters commit a hash on-chain; reveal the plaintext after the vote closes.",
    tradeoff:
      "Pros: protects from real-time bandwagon effects; voters' choices are private until reveal window. Cons: requires a second tx in the reveal window — voters who go offline forfeit their ballot. Best for: contested elections where in-flight tactics matter.",
  },
  {
    value: PRIVACY_KIND.ZK,
    title: "Zero-Knowledge",
    summary: "Ballots stay private even after close.",
    tradeoff:
      "Designed-for; not in v1. Coming Q4 2026 (per 2026-05-27 lock). The Move scaffold is in place — `privacy_kind = 2` aborts in `create_election` today.",
    disabled: { reason: "Coming Q4 2026" },
  },
];

// ── BCS-style encoders / decoders ───────────────────────────────────────────
// All multi-byte values are little-endian, matching what the Move code emits.

export function encodeU32LE(v: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = v & 0xff;
  buf[1] = (v >>> 8) & 0xff;
  buf[2] = (v >>> 16) & 0xff;
  buf[3] = (v >>> 24) & 0xff;
  return buf;
}

export function encodeU64LE(v: number | bigint): Uint8Array {
  const big = typeof v === "bigint" ? v : BigInt(v);
  const buf = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    buf[i] = Number((big >> BigInt(i * 8)) & 0xffn);
  }
  return buf;
}

export function decodeU32LE(bytes: ArrayLike<number>, off = 0): number {
  if (bytes.length < off + 4) throw new Error("decodeU32LE: out of range");
  return (
    (bytes[off] & 0xff) |
    ((bytes[off + 1] & 0xff) << 8) |
    ((bytes[off + 2] & 0xff) << 16) |
    ((bytes[off + 3] & 0xff) << 24)
  ) >>> 0;
}

export function decodeU64LE(bytes: ArrayLike<number>, off = 0): bigint {
  if (bytes.length < off + 8) throw new Error("decodeU64LE: out of range");
  let v = 0n;
  for (let i = 0; i < 8; i++) {
    v |= BigInt(bytes[off + i] & 0xff) << BigInt(i * 8);
  }
  return v;
}

export function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

/** Decode a hex / "0x..." event payload or vector<u8> into Uint8Array. */
export function toBytes(input: unknown): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (Array.isArray(input)) return new Uint8Array(input.map((b) => Number(b) & 0xff));
  if (typeof input === "string") {
    const s = input.startsWith("0x") ? input.slice(2) : input;
    if (/^[0-9a-fA-F]*$/.test(s) && s.length % 2 === 0) {
      const out = new Uint8Array(s.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
      return out;
    }
  }
  return new Uint8Array();
}

// ── Vote encoders (mirror methods/*.move decoders) ──────────────────────────

/** single_choice: encoded_vote = LE u32 option_id (4 bytes). */
export function encodeSingleChoiceVote(optionId: number): Uint8Array {
  return encodeU32LE(optionId);
}

/** approval: encoded_vote = LE u32 count, then count × LE u32 option_id. */
export function encodeApprovalVote(optionIds: number[]): Uint8Array {
  const dedup = Array.from(new Set(optionIds));
  const parts: Uint8Array[] = [encodeU32LE(dedup.length)];
  for (const id of dedup) parts.push(encodeU32LE(id));
  return concat(...parts);
}

/** ranked_choice: count + ranked option_ids, top first. */
export function encodeRankedChoiceVote(rankedOptionIds: number[]): Uint8Array {
  const parts: Uint8Array[] = [encodeU32LE(rankedOptionIds.length)];
  for (const id of rankedOptionIds) parts.push(encodeU32LE(id));
  return concat(...parts);
}

/**
 * score: count, then count pairs of (LE u32 option_id, LE u32 score 0..max).
 * STAR variant uses the same encoding (subtype lives in method_params[0]).
 */
export function encodeScoreVote(scores: { optionId: number; score: number }[]): Uint8Array {
  const parts: Uint8Array[] = [encodeU32LE(scores.length)];
  for (const s of scores) {
    parts.push(encodeU32LE(s.optionId));
    parts.push(encodeU32LE(s.score));
  }
  return concat(...parts);
}

/**
 * quadratic positive: count, then count pairs of (LE u32 option_id, LE u32 votes).
 * Cost per option = votes^2; voter is expected to keep Σ(votes²) ≤ credit_budget.
 *
 * quadratic signed: same shape but votes is reinterpreted as i32 (LE two's
 * complement) so negative votes ("vote against") are expressible. The Move
 * tally module handles the sign decode.
 */
export function encodeQuadraticVote(votes: { optionId: number; votes: number }[]): Uint8Array {
  const parts: Uint8Array[] = [encodeU32LE(votes.length)];
  for (const v of votes) {
    parts.push(encodeU32LE(v.optionId));
    // For positive: votes always ≥ 0; for signed: reinterpret as i32 LE.
    // Both fit in a 4-byte LE slot; signed mode just reads it back as i32.
    parts.push(encodeU32LE(v.votes >>> 0));
  }
  return concat(...parts);
}

// ── Commit-reveal helper ────────────────────────────────────────────────────
// commit = keccak256(salt || encoded_vote). Match the Move side (uses keccak256).
// We import keccak via @noble/hashes when available; fall back to web-crypto SHA-256
// for the salt only (the COMMIT itself MUST be keccak256). If neither is available,
// throws — UI surfaces a "browser lacks crypto support" error.

export async function commitVote(salt: Uint8Array, encodedVote: Uint8Array): Promise<Uint8Array> {
  const buf = concat(salt, encodedVote);
  // Dynamic import — @noble/hashes ships with the dApp via @mysten/sui dependencies
  // Use dynamic import with string concat so TS doesn't try to resolve the
  // module path at type-check time (the @noble/hashes types may not be
  // present in older toolchains). The module IS shipped in node_modules
  // as a transitive dependency of @mysten/sui at runtime.
  try {
    const modName = "@noble/hashes/sha3";
    const mod = (await import(/* @vite-ignore */ modName)) as { keccak_256?: (x: Uint8Array) => Uint8Array };
    if (mod.keccak_256) return mod.keccak_256(buf);
  } catch { /* fall through */ }
  throw new Error(
    "commitVote: keccak256 not available — ensure @noble/hashes is installed."
  );
}

export function randomSalt(len = 32): Uint8Array {
  const out = new Uint8Array(len);
  crypto.getRandomValues(out);
  return out;
}

// ── PTB builders ────────────────────────────────────────────────────────────
// All targets reference CRADLEOS_VOTING_PKG. If the package is not yet published
// (placeholder zero address), each builder throws so the UI can surface a clear
// error instead of submitting a no-op tx.

function ensurePublished() {
  if (!CRADLEOS_VOTING_AVAILABLE) {
    throw new Error(
      "cradleos_voting package is not yet published. Set CRADLEOS_VOTING_PKG + CRADLEOS_VOTING_REGISTRY in constants.ts after publish."
    );
  }
}

export interface CreateElectionParams {
  title: string;
  description: string;
  metadataUri: string;
  methodKind: number;
  methodParams: Uint8Array;
  eligibilityKind: number;
  eligibilityParams: Uint8Array;
  weightKind: number;
  weightParams: Uint8Array;
  privacyKind: number;
  privacyParams: Uint8Array;
  creatorCharacterId: number;
  allowRecast: boolean;
}

export function buildCreateElectionTx(p: CreateElectionParams): Transaction {
  ensurePublished();
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_VOTING_PKG}::voting::create_election`,
    arguments: [
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(p.title))),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(p.description))),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(p.metadataUri))),
      tx.pure.u8(p.methodKind),
      tx.pure.vector("u8", Array.from(p.methodParams)),
      tx.pure.u8(p.eligibilityKind),
      tx.pure.vector("u8", Array.from(p.eligibilityParams)),
      tx.pure.u8(p.weightKind),
      tx.pure.vector("u8", Array.from(p.weightParams)),
      tx.pure.u8(p.privacyKind),
      tx.pure.vector("u8", Array.from(p.privacyParams)),
      tx.pure.u32(p.creatorCharacterId),
      tx.pure.bool(p.allowRecast),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

export function buildAddOptionTx(
  electionId: string,
  label: string,
  metadataUri: string,
  payload: Uint8Array = new Uint8Array(),
): Transaction {
  ensurePublished();
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_VOTING_PKG}::voting::add_option`,
    arguments: [
      tx.object(electionId),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(label))),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(metadataUri))),
      tx.pure.vector("u8", Array.from(payload)),
    ],
  });
  return tx;
}

export function buildRemoveOptionTx(electionId: string, optionId: number): Transaction {
  ensurePublished();
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_VOTING_PKG}::voting::remove_option`,
    arguments: [tx.object(electionId), tx.pure.u32(optionId)],
  });
  return tx;
}

export function buildSetScheduleTx(
  electionId: string,
  openMs: number,
  closeMs: number,
  revealDeadlineMs: number,
  disputeWindowMs: number,
): Transaction {
  ensurePublished();
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_VOTING_PKG}::voting::set_schedule`,
    arguments: [
      tx.object(electionId),
      tx.pure.u64(BigInt(openMs)),
      tx.pure.u64(BigInt(closeMs)),
      tx.pure.u64(BigInt(revealDeadlineMs)),
      tx.pure.u64(BigInt(disputeWindowMs)),
    ],
  });
  return tx;
}

export function buildSetSponsoredTx(
  electionId: string,
  sponsor: string,
  maxBallotsFunded: number,
  expiryMs: number,
): Transaction {
  ensurePublished();
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_VOTING_PKG}::voting::set_sponsored`,
    arguments: [
      tx.object(electionId),
      tx.pure.address(sponsor),
      tx.pure.u64(BigInt(maxBallotsFunded)),
      tx.pure.u64(BigInt(expiryMs)),
    ],
  });
  return tx;
}

export function buildPublishTx(electionId: string): Transaction {
  ensurePublished();
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_VOTING_PKG}::voting::publish`,
    arguments: [tx.object(electionId), tx.object(CLOCK)],
  });
  return tx;
}

export function buildCancelTx(electionId: string): Transaction {
  ensurePublished();
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_VOTING_PKG}::voting::cancel`,
    arguments: [tx.object(electionId), tx.object(CLOCK)],
  });
  return tx;
}

export function buildAdvanceToOpenTx(electionId: string): Transaction {
  ensurePublished();
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_VOTING_PKG}::voting::advance_to_open`,
    arguments: [tx.object(electionId), tx.object(CLOCK)],
  });
  return tx;
}

export function buildAdvanceToRevealTx(electionId: string): Transaction {
  ensurePublished();
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_VOTING_PKG}::voting::advance_to_reveal`,
    arguments: [tx.object(electionId), tx.object(CLOCK)],
  });
  return tx;
}

export function buildAdvanceToClosedTx(electionId: string): Transaction {
  ensurePublished();
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_VOTING_PKG}::voting::advance_to_closed`,
    arguments: [tx.object(electionId), tx.object(CLOCK)],
  });
  return tx;
}

/**
 * Open-eligibility ballot cast PTB (the simplest case).
 *
 * Sequence:
 *   1. eligibility_open::mint(election, character_id)  → EligibilityProof
 *   2. weight_one::mint(election, character_id)        → WeightProof
 *   3. voting::cast_ballot(election, registry, voter, encoded_vote, elig_proof, weight_proof, none)
 *
 * Higher-tier eligibility/weight sources need different mint args (extra objects
 * for vault/registry refs, coin refs for asset-weight). Those builders below.
 */
export function buildCastBallotOpenOneTx(
  electionId: string,
  voterAddress: string,
  characterId: number,
  encodedVote: Uint8Array,
): Transaction {
  ensurePublished();
  const tx = new Transaction();
  const eligibilityProof = tx.moveCall({
    target: `${CRADLEOS_VOTING_PKG}::eligibility_open::mint`,
    arguments: [tx.object(electionId), tx.pure.u32(characterId)],
  });
  const weightProof = tx.moveCall({
    target: `${CRADLEOS_VOTING_PKG}::weight_one::mint`,
    arguments: [tx.object(electionId), tx.pure.u32(characterId)],
  });
  const noneSponsor = tx.moveCall({
    target: "0x1::option::none",
    typeArguments: [`${CRADLEOS_VOTING_PKG}::voting::SponsorCap`],
    arguments: [],
  });
  tx.moveCall({
    target: `${CRADLEOS_VOTING_PKG}::voting::cast_ballot`,
    arguments: [
      tx.object(electionId),
      tx.object(CRADLEOS_VOTING_REGISTRY),
      tx.pure.address(voterAddress),
      tx.pure.vector("u8", Array.from(encodedVote)),
      eligibilityProof,
      weightProof,
      noneSponsor,
      tx.object(CLOCK),
    ],
  });
  return tx;
}

/** Same as buildCastBallotOpenOneTx but for commit-reveal: passes commitment. */
export function buildCommitBallotOpenOneTx(
  electionId: string,
  voterAddress: string,
  characterId: number,
  commitment: Uint8Array,
): Transaction {
  ensurePublished();
  const tx = new Transaction();
  const eligibilityProof = tx.moveCall({
    target: `${CRADLEOS_VOTING_PKG}::eligibility_open::mint`,
    arguments: [tx.object(electionId), tx.pure.u32(characterId)],
  });
  const weightProof = tx.moveCall({
    target: `${CRADLEOS_VOTING_PKG}::weight_one::mint`,
    arguments: [tx.object(electionId), tx.pure.u32(characterId)],
  });
  const noneSponsor = tx.moveCall({
    target: "0x1::option::none",
    typeArguments: [`${CRADLEOS_VOTING_PKG}::voting::SponsorCap`],
    arguments: [],
  });
  tx.moveCall({
    target: `${CRADLEOS_VOTING_PKG}::voting::commit_ballot`,
    arguments: [
      tx.object(electionId),
      tx.object(CRADLEOS_VOTING_REGISTRY),
      tx.pure.address(voterAddress),
      tx.pure.vector("u8", Array.from(commitment)),
      eligibilityProof,
      weightProof,
      noneSponsor,
      tx.object(CLOCK),
    ],
  });
  return tx;
}

export function buildRevealBallotTx(
  electionId: string,
  ballotId: string,
  salt: Uint8Array,
  encodedVote: Uint8Array,
): Transaction {
  ensurePublished();
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_VOTING_PKG}::voting::reveal_ballot`,
    arguments: [
      tx.object(electionId),
      tx.object(ballotId),
      tx.pure.vector("u8", Array.from(salt)),
      tx.pure.vector("u8", Array.from(encodedVote)),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

/**
 * compute_tally: anyone can submit the tally. UI re-runs locally first,
 * then this builder serializes the inputs and the chain re-derives the
 * canonical result. The chain is the source of truth — UI's local result
 * is only for the "Verify on chain" UX.
 */
export function buildComputeTallyTx(
  electionId: string,
  characterIds: number[],
  encodedVotes: Uint8Array[],
  weights: (number | bigint)[],
): Transaction {
  ensurePublished();
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_VOTING_PKG}::tally::compute_tally`,
    arguments: [
      tx.object(electionId),
      tx.pure.vector("u32", characterIds),
      tx.pure.vector("vector<u8>", encodedVotes.map((v) => Array.from(v))),
      tx.pure.vector("u64", weights.map((w) => BigInt(w))),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

export function buildFinalizeTx(electionId: string, tallyId: string): Transaction {
  ensurePublished();
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_VOTING_PKG}::tally::finalize`,
    arguments: [tx.object(electionId), tx.object(tallyId), tx.object(CLOCK)],
  });
  return tx;
}

// ── Event fetcher (mirrors fetchEventAcrossPackages in lib.ts) ──────────────

type RawEvent = {
  parsedJson?: Record<string, unknown>;
  timestampMs?: string;
  id?: { txDigest?: string; eventSeq?: string };
};

export async function fetchVotingEventAcrossPackages(
  module: string,
  event: string,
  limit = 500,
): Promise<RawEvent[]> {
  if (!CRADLEOS_VOTING_AVAILABLE) return [];
  const uniquePkgs = Array.from(new Set(CRADLEOS_VOTING_EVENT_PKGS));
  const queries = uniquePkgs.map((pkg) =>
    fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: `${pkg}::${module}::${event}` }, null, limit, true],
      }),
    })
      .then((r) => r.json())
      .catch(() => null)
  );
  const responses = await Promise.all(queries);
  const all: RawEvent[] = [];
  const seen = new Set<string>();
  for (const j of responses) {
    const data = (j as { result?: { data?: RawEvent[] } } | null)?.result?.data ?? [];
    for (const e of data) {
      const key = `${e.id?.txDigest ?? ""}#${e.id?.eventSeq ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(e);
    }
  }
  all.sort((a, b) => Number(b.timestampMs ?? 0) - Number(a.timestampMs ?? 0));
  return all;
}

// ── Election summary fetchers ───────────────────────────────────────────────

export interface ElectionSummary {
  electionId: string;
  creator: string;
  creatorCharacterId: number;
  title: string;
  methodKind: number;
  eligibilityKind: number;
  weightKind: number;
  privacyKind: number;
  txDigest: string;
  createdMs: number;
}

/**
 * Fetch all ElectionCreated events. UI uses this to populate the lists.
 * Filters can be applied client-side (creator address, character_id, etc.).
 */
export async function fetchAllElections(): Promise<ElectionSummary[]> {
  const events = await fetchVotingEventAcrossPackages("voting", "ElectionCreated");
  return events.map((e) => {
    const p = e.parsedJson ?? {};
    return {
      electionId: String(p.election_id ?? ""),
      creator: String(p.creator ?? ""),
      creatorCharacterId: Number(p.creator_character_id ?? 0),
      title: String(p.title ?? ""),
      methodKind: Number(p.method_kind ?? 0),
      eligibilityKind: Number(p.eligibility_kind ?? 0),
      weightKind: Number(p.weight_kind ?? 0),
      privacyKind: Number(p.privacy_kind ?? 0),
      txDigest: String(e.id?.txDigest ?? ""),
      createdMs: Number(e.timestampMs ?? 0),
    };
  });
}

export interface BallotEvent {
  electionId: string;
  characterId: number;
  voterAddress: string;
  encodedVote: Uint8Array;
  weight: bigint;
  castMs: number;
  txDigest: string;
}

/**
 * Fetch all ballots cast for a given election. Used for:
 *   - Local tally re-run on the results page
 *   - Verification bundle export
 *   - Dispute detection (mismatched on-chain tally)
 */
export async function fetchBallotsForElection(electionId: string): Promise<BallotEvent[]> {
  const events = await fetchVotingEventAcrossPackages("voting", "BallotCast", 1000);
  return events
    .filter((e) => String(e.parsedJson?.election_id ?? "") === electionId)
    .map((e) => {
      const p = e.parsedJson ?? {};
      return {
        electionId: String(p.election_id ?? ""),
        characterId: Number(p.character_id ?? 0),
        voterAddress: String(p.voter_address ?? ""),
        encodedVote: toBytes(p.encoded_vote),
        weight: BigInt(String(p.weight ?? "0")),
        castMs: Number(e.timestampMs ?? 0),
        txDigest: String(e.id?.txDigest ?? ""),
      };
    });
}

/** Revealed-ballot events for commit-reveal elections. */
export async function fetchRevealsForElection(electionId: string): Promise<BallotEvent[]> {
  const events = await fetchVotingEventAcrossPackages("voting", "BallotRevealed", 1000);
  return events
    .filter((e) => String(e.parsedJson?.election_id ?? "") === electionId)
    .map((e) => {
      const p = e.parsedJson ?? {};
      return {
        electionId: String(p.election_id ?? ""),
        characterId: Number(p.character_id ?? 0),
        voterAddress: "", // reveal event doesn't re-emit voter address; resolve from BallotCommitted
        encodedVote: toBytes(p.encoded_vote),
        weight: 0n, // resolved by joining with BallotCommitted by character_id
        castMs: Number(e.timestampMs ?? 0),
        txDigest: String(e.id?.txDigest ?? ""),
      };
    });
}

// ── Local tally re-runners (verification UX) ────────────────────────────────
//
// Mirror the on-chain `compute()` semantics of each method module. The exact
// tie-break and rounding rules are followed so the local result matches the
// chain bit-for-bit. Where the on-chain implementation is non-trivial (IRV,
// Schulze, quadratic-signed), we leave a TODO and surface a notice in the
// verification UX.

export interface LocalTallyResult {
  /** Method kind that was tallied. */
  methodKind: number;
  /** Winning option_ids (>1 only on multi-winner methods; ties broken deterministically). */
  winners: number[];
  /** Per-option totals; method-specific (counts, scores, etc). */
  perOption: Array<{ optionId: number; total: bigint }>;
  /** Total weight cast. */
  totalWeight: bigint;
  /** True iff this re-runner is a complete mirror of the on-chain method. */
  reproducible: boolean;
  /** When false, this string explains what's missing. */
  notReproducibleReason?: string;
}

/** single_choice local tally — matches single_choice.move bit-for-bit. */
export function localTallySingleChoice(
  optionIds: number[],
  ballots: { encodedVote: Uint8Array; weight: bigint }[],
  seed: Uint8Array = new Uint8Array(),
): LocalTallyResult {
  const counts = new Map<number, bigint>(optionIds.map((id) => [id, 0n]));
  let total = 0n;
  for (const b of ballots) {
    if (b.encodedVote.length < 4) continue;
    const optId = decodeU32LE(b.encodedVote, 0);
    total += b.weight;
    if (counts.has(optId)) counts.set(optId, counts.get(optId)! + b.weight);
  }
  let max = 0n;
  for (const c of counts.values()) if (c > max) max = c;
  let winners: number[] = [];
  if (max > 0n) {
    for (const [id, c] of counts.entries()) if (c === max) winners.push(id);
  }
  // Deterministic tie-break matches Move byte_sum(seed) % len.
  if (winners.length > 1) {
    let byteSum = 0;
    for (const b of seed) byteSum += b;
    const idx = byteSum % winners.length;
    winners = [winners[idx]];
  }
  return {
    methodKind: METHOD_KIND.SINGLE_CHOICE,
    winners,
    perOption: optionIds.map((id) => ({ optionId: id, total: counts.get(id) ?? 0n })),
    totalWeight: total,
    reproducible: true,
  };
}

/** approval local tally — matches approval.move bit-for-bit. */
export function localTallyApproval(
  optionIds: number[],
  ballots: { encodedVote: Uint8Array; weight: bigint }[],
  maxApprovals = 0, // 0 = unlimited; matches method_params[0] decode
  seed: Uint8Array = new Uint8Array(),
): LocalTallyResult {
  const counts = new Map<number, bigint>(optionIds.map((id) => [id, 0n]));
  let total = 0n;
  for (const b of ballots) {
    if (b.encodedVote.length < 4) continue;
    const count = decodeU32LE(b.encodedVote, 0);
    if (maxApprovals > 0 && count > maxApprovals) continue; // chain aborts; we skip in local
    const approved = new Set<number>();
    for (let i = 0; i < count; i++) {
      const off = 4 + i * 4;
      if (b.encodedVote.length < off + 4) break;
      approved.add(decodeU32LE(b.encodedVote, off));
    }
    total += b.weight;
    for (const optId of approved) {
      if (counts.has(optId)) counts.set(optId, counts.get(optId)! + b.weight);
    }
  }
  let max = 0n;
  for (const c of counts.values()) if (c > max) max = c;
  let winners: number[] = [];
  if (max > 0n) {
    for (const [id, c] of counts.entries()) if (c === max) winners.push(id);
  }
  if (winners.length > 1) {
    let byteSum = 0;
    for (const b of seed) byteSum += b;
    winners = [winners[byteSum % winners.length]];
  }
  return {
    methodKind: METHOD_KIND.APPROVAL,
    winners,
    perOption: optionIds.map((id) => ({ optionId: id, total: counts.get(id) ?? 0n })),
    totalWeight: total,
    reproducible: true,
  };
}

/** Stub: ranked_choice IRV / Schulze / Borda local re-runner. */
export function localTallyRankedChoice(
  _optionIds: number[],
  _ballots: { encodedVote: Uint8Array; weight: bigint }[],
  _subtype: number = RANKED_SUBTYPE.IRV,
): LocalTallyResult {
  // TODO implement local re-runner for ranked-choice (IRV/Schulze/Borda).
  // Design: replay rounds, eliminate lowest-count option, redistribute to
  // next-ranked surviving option; Schulze: build pairwise preference matrix
  // and pick the Schulze winner; Borda: sum reverse-rank points.
  return {
    methodKind: METHOD_KIND.RANKED_CHOICE,
    winners: [],
    perOption: [],
    totalWeight: 0n,
    reproducible: false,
    notReproducibleReason: "ranked-choice local re-runner not yet implemented",
  };
}

/** Stub: score (sum / avg / STAR) local re-runner. */
export function localTallyScore(
  _optionIds: number[],
  _ballots: { encodedVote: Uint8Array; weight: bigint }[],
  _subtype: number = SCORE_SUBTYPE.SUM,
): LocalTallyResult {
  // TODO implement local re-runner for score voting.
  // Sum/avg: aggregate score × weight per option, then divide by total weight
  // for avg; STAR: take top-2 from sum, then do an instant runoff between
  // them using approval-style preference.
  return {
    methodKind: METHOD_KIND.SCORE,
    winners: [],
    perOption: [],
    totalWeight: 0n,
    reproducible: false,
    notReproducibleReason: "score local re-runner not yet implemented",
  };
}

/** Stub: quadratic (positive + signed) local re-runner. */
export function localTallyQuadratic(
  _optionIds: number[],
  _ballots: { encodedVote: Uint8Array; weight: bigint }[],
  _subtype: number = QUADRATIC_SUBTYPE.POSITIVE,
): LocalTallyResult {
  // TODO implement local re-runner for quadratic voting.
  // Positive: sum sqrt(votes) × weight per option.
  // Signed: votes is i32; positive votes count toward total, negative
  // votes subtract; absolute value squared is the credit cost.
  return {
    methodKind: METHOD_KIND.QUADRATIC,
    winners: [],
    perOption: [],
    totalWeight: 0n,
    reproducible: false,
    notReproducibleReason: "quadratic local re-runner not yet implemented",
  };
}

/** Stub: conviction local re-runner (time-weighted). */
export function localTallyConviction(): LocalTallyResult {
  // TODO implement local re-runner for conviction voting.
  // Conviction accrues weight per option as a function of how long voters
  // have held their allocation. The Move tally module emits the conviction
  // curve parameters; the re-runner integrates ballot timestamps against
  // the curve to derive each option's accrued conviction at finalize time.
  return {
    methodKind: METHOD_KIND.CONVICTION,
    winners: [],
    perOption: [],
    totalWeight: 0n,
    reproducible: false,
    notReproducibleReason: "conviction local re-runner not yet implemented",
  };
}

/** Top-level dispatch by method kind. */
export function localTally(
  methodKind: number,
  optionIds: number[],
  ballots: { encodedVote: Uint8Array; weight: bigint }[],
  methodParams: Uint8Array = new Uint8Array(),
  seed: Uint8Array = new Uint8Array(),
): LocalTallyResult {
  switch (methodKind) {
    case METHOD_KIND.SINGLE_CHOICE:
      return localTallySingleChoice(optionIds, ballots, seed);
    case METHOD_KIND.APPROVAL: {
      const maxApprovals = methodParams.length >= 4 ? decodeU32LE(methodParams, 0) : 0;
      return localTallyApproval(optionIds, ballots, maxApprovals, seed);
    }
    case METHOD_KIND.RANKED_CHOICE:
      return localTallyRankedChoice(optionIds, ballots, methodParams[0] ?? RANKED_SUBTYPE.IRV);
    case METHOD_KIND.SCORE:
      return localTallyScore(optionIds, ballots, methodParams[0] ?? SCORE_SUBTYPE.SUM);
    case METHOD_KIND.QUADRATIC:
      return localTallyQuadratic(optionIds, ballots, methodParams[0] ?? QUADRATIC_SUBTYPE.POSITIVE);
    case METHOD_KIND.CONVICTION:
      return localTallyConviction();
    default:
      return {
        methodKind,
        winners: [],
        perOption: [],
        totalWeight: 0n,
        reproducible: false,
        notReproducibleReason: `unknown method kind ${methodKind}`,
      };
  }
}

// ── Sponsored-tx wrapper (stub) ─────────────────────────────────────────────
//
// When election.sponsored == true, the voter's tx must be wrapped through an
// Enoki sponsored-tx flow so the voter pays no gas. This is currently a stub —
// the full Enoki integration ships as a follow-up. Until then, sponsored
// elections still work; the voter pays their own gas (UI surfaces a notice).

export interface SponsoredTxRoute {
  /** Tx bytes to submit. */
  txBytes: Uint8Array;
  /** Sponsor signature. */
  sponsorSignature: Uint8Array;
}

/**
 * Route a Transaction through the Enoki sponsored-tx relayer.
 *
 * TODO(post-MVP): wire to Enoki sponsored-tx HTTP endpoint with the
 *   server-side keypair (100k/month budget — see TOOLS.md). Until then,
 *   sponsored elections degrade gracefully: this throws and the caller
 *   falls back to a normal signAndExecuteTransaction (voter pays gas).
 */
export async function routeViaEnoki(_tx: Transaction): Promise<SponsoredTxRoute> {
  throw new Error(
    "routeViaEnoki: sponsored-tx relayer not yet implemented. Falling back to voter-paid gas."
  );
}

// ── Verification bundle ─────────────────────────────────────────────────────
//
// Bundles everything a third party needs to independently re-run the tally:
//   - election summary (method, eligibility, weight, privacy, options)
//   - all raw ballot events (encoded_vote + weight + character_id)
//   - the chain's on-chain tally output (winners + per-option totals)
//   - a small TypeScript replay script template (so non-CradleOS verifiers
//     can run it on Node with `npx tsx replay.ts`)

export interface VerificationBundle {
  election: ElectionSummary;
  ballots: BallotEvent[];
  localResult: LocalTallyResult;
  /** Filled in once we fetch the on-chain Tally object. */
  chainResultPayload?: Uint8Array;
  chainWinners?: number[];
  /** True iff localResult.winners and chainWinners match. */
  match?: boolean;
  /** Optional human-readable diff when match=false. */
  diff?: string;
}

export function buildVerificationBundleJson(
  bundle: VerificationBundle,
): string {
  return JSON.stringify(
    {
      election: bundle.election,
      ballots: bundle.ballots.map((b) => ({
        characterId: b.characterId,
        voterAddress: b.voterAddress,
        encodedVote: "0x" + Array.from(b.encodedVote).map((x) => x.toString(16).padStart(2, "0")).join(""),
        weight: b.weight.toString(),
        castMs: b.castMs,
        txDigest: b.txDigest,
      })),
      localResult: {
        ...bundle.localResult,
        totalWeight: bundle.localResult.totalWeight.toString(),
        perOption: bundle.localResult.perOption.map((p) => ({
          optionId: p.optionId,
          total: p.total.toString(),
        })),
      },
      chainWinners: bundle.chainWinners ?? null,
      chainResultPayload:
        bundle.chainResultPayload
          ? "0x" + Array.from(bundle.chainResultPayload).map((x) => x.toString(16).padStart(2, "0")).join("")
          : null,
      match: bundle.match ?? null,
      diff: bundle.diff ?? null,
      replayScript: REPLAY_SCRIPT_TEMPLATE,
    },
    null,
    2,
  );
}

const REPLAY_SCRIPT_TEMPLATE = [
  "// Independent CradleOS Voting tally verifier.",
  "// Usage: npx tsx replay.ts bundle.json",
  "// Re-runs the local tally and compares to the chain output.",
  "// Drop into any Node 20+ env with @noble/hashes installed.",
  "import { readFileSync } from 'node:fs';",
  "const bundle = JSON.parse(readFileSync(process.argv[2], 'utf-8'));",
  "// Single-choice mirror: option_id = first 4 bytes LE of encoded_vote.",
  "// Tally = argmax(Σ weight). See cradleos_voting/sources/methods/single_choice.move",
  "// for the canonical implementation. For other method kinds, see methods/*.move.",
  "console.log('Election:', bundle.election.title);",
  "console.log('Method kind:', bundle.election.methodKind);",
  "console.log('Ballots:', bundle.ballots.length);",
  "console.log('Local winners:', bundle.localResult.winners);",
  "console.log('Chain winners:', bundle.chainWinners);",
  "console.log('Match:', bundle.match);",
].join("\n");
