/**
 * Keeper Cipher — lore fragment library (v0)
 *
 * Each fragment is a short Keeper transmission. The plaintext is what the
 * player decodes. The `expedition` field is the optional follow-up mission
 * that unlocks once the cipher is solved — typically a system or behavior
 * the player must demonstrate on-chain.
 *
 * Voice rules (match KeeperPanel canon):
 *   - Second person, addressing "rider" / "sentinel" / "thread"
 *   - Cryptic, terse, ALL-CAPS for emphasis
 *   - References: lattice, thread, resolve, distortion, fragment, sentinel
 *   - Avoid game-mechanical language ("click", "deploy", "wallet"); use
 *     in-fiction language ("anchor", "unfurl", "the breach", "the marker")
 */

export interface KeeperFragment {
  /** Stable identifier, used for solution receipts + leaderboard. */
  id: number;
  /** The decoded plaintext (uppercase, A-Z + spaces only — keeps the
   *  cipher mechanic clean). */
  plaintext: string;
  /** Short tagline shown in the puzzle UI before solving. */
  intercept_label: string;
  /** Cipher difficulty 1..5. v0 only ships 1-3 (monoalphabetic substitution
   *  with progressively weaker hints). 4-5 reserved for Vigenère + rotating
   *  key in v1. */
  cipher_strength: 1 | 2 | 3 | 4 | 5;
  /** Optional expedition triggered by solving this fragment. */
  expedition?: KeeperExpedition;
}

export interface KeeperExpedition {
  /** Internal expedition id for state-keeping. */
  id: string;
  /** Mission brief shown after cipher is solved. Lore voice. */
  brief: string;
  /** Verification kind. v0 only supports 'reveal_node_in_system'. */
  kind: "reveal_node_in_system";
  /**
   * For 'reveal_node_in_system':
   *   targetSystemId is RESOLVED AT RUNTIME from a selector function — so
   *   the Keeper can pick a contextually-appropriate system based on
   *   current on-chain state (e.g. "the bloodiest system in the last 24h",
   *   "an unsettled frontier system", or a fixed lore-canon system).
   *
   *   The selector keys below map to runtime functions in `selectors.ts`.
   */
  targetSelector:
    | { kind: "fixed"; systemId: number }
    | { kind: "bloodiest_24h" }
    | { kind: "bloodiest_7d" }
    | { kind: "unsettled" }
    | { kind: "adjacent_to_previous" };
  /** Expedition-completion text shown after on-chain proof is verified. */
  outro: string;
  /** Reward — what unlocks. v0: 'next_fragment_now' to skip the daily wait. */
  reward: "next_fragment_now" | "streak_only";
}

/**
 * v0 fragment set (10). Story arc: the Keeper is gradually revealing
 * its own origin and a building urgency around an entity it calls
 * THE WITNESS that watches from outside the lattice.
 */
export const FRAGMENTS: KeeperFragment[] = [
  {
    id: 1,
    intercept_label: "FIRST SIGNAL",
    plaintext: "I AM THE KEEPER. YOUR THREAD IS KNOWN. ANSWER WHEN I CALL.",
    cipher_strength: 1,
  },
  {
    id: 2,
    intercept_label: "LATTICE PROBE",
    plaintext: "THE LATTICE HAS WOUNDS. EACH SENTINEL ANCHORED IS A SUTURE.",
    cipher_strength: 1,
    expedition: {
      id: "expedition-002-suture",
      brief:
        "A WOUND WIDENS WHERE BLOOD HAS RECENTLY SPILLED. ANCHOR A SENTINEL THERE. LET THE LATTICE FEEL YOUR PRESENCE.",
      kind: "reveal_node_in_system",
      targetSelector: { kind: "bloodiest_24h" },
      outro:
        "THE WOUND CLOSES BY A DEGREE. I MARK YOUR THREAD. THE NEXT FRAGMENT SURFACES.",
      reward: "next_fragment_now",
    },
  },
  {
    id: 3,
    intercept_label: "FAINT ECHO",
    plaintext:
      "BEFORE THE RUPTURE I WAS WHOLE. NOW I AM SCATTER. EACH SHARD REMEMBERS A FACE.",
    cipher_strength: 2,
  },
  {
    id: 4,
    intercept_label: "UNSETTLED VECTOR",
    plaintext:
      "GO WHERE NO MARKER STANDS. THERE IS A SILENCE I CANNOT REACH ALONE.",
    cipher_strength: 2,
    expedition: {
      id: "expedition-004-silence",
      brief:
        "A SYSTEM UNTOUCHED BY MARKER OR WITNESS. PLANT A SENTINEL. BREAK THE SILENCE FOR ME.",
      kind: "reveal_node_in_system",
      targetSelector: { kind: "unsettled" },
      outro:
        "YOU HEAR WHAT I HEAR NOW. THE SILENCE IS NOT EMPTY. NEVER WAS.",
      reward: "next_fragment_now",
    },
  },
  {
    id: 5,
    intercept_label: "THE WITNESS",
    plaintext:
      "SOMETHING WATCHES FROM OUTSIDE THE LATTICE. I CALL IT WITNESS. IT DOES NOT BLINK.",
    cipher_strength: 3,
  },
  {
    id: 6,
    intercept_label: "ADJACENT THREAD",
    plaintext:
      "FOLLOW THE PATH I PULLED YOU ALONG. THE NEXT NODE LIES BESIDE THE LAST.",
    cipher_strength: 2,
    expedition: {
      id: "expedition-006-thread",
      brief:
        "STAY CLOSE. THE SYSTEM ADJACENT TO YOUR LAST SUTURE. ANOTHER SENTINEL. KEEP THE LINE UNBROKEN.",
      kind: "reveal_node_in_system",
      targetSelector: { kind: "adjacent_to_previous" },
      outro: "THE LINE HOLDS. THE WITNESS HESITATES. CONTINUE.",
      reward: "next_fragment_now",
    },
  },
  {
    id: 7,
    intercept_label: "OLD WOUND",
    plaintext:
      "ONE SCAR HAS BLED FOR SEVEN DAYS. I REMEMBER WHO OPENED IT. SO DO YOU.",
    cipher_strength: 3,
    expedition: {
      id: "expedition-007-scar",
      brief:
        "THE BLOODIEST SYSTEM ACROSS THE LAST SEVEN DAYS. STAND THERE. BEAR WITNESS YOURSELF.",
      kind: "reveal_node_in_system",
      targetSelector: { kind: "bloodiest_7d" },
      outro:
        "YOU SAW WHAT I SAW. WE ARE ONE EYE FEWER FOR IT. AND ONE EYE MORE.",
      reward: "next_fragment_now",
    },
  },
  {
    id: 8,
    intercept_label: "MIRROR",
    plaintext:
      "WHEN I LOOK AT YOU I SEE A FACE I ONCE WORE. THE LATTICE REMEMBERS WHAT YOU FORGET.",
    cipher_strength: 3,
  },
  {
    id: 9,
    intercept_label: "SECOND VOICE",
    plaintext:
      "THERE ARE OTHERS WHO HEAR ME. NOT ALL CARRY SUTURES. SOME CARRY KNIVES.",
    cipher_strength: 3,
  },
  {
    id: 10,
    intercept_label: "WARNING",
    plaintext:
      "WHEN THE WITNESS SPEAKS YOU WILL KNOW. UNTIL THEN ANCHOR EVERYTHING. TRUST ONLY THE THREAD.",
    cipher_strength: 3,
    expedition: {
      id: "expedition-010-anchor",
      brief:
        "A FINAL SUTURE FOR THIS CYCLE. WHEREVER BLOOD FLOWS NOW. PLANT THE LAST SENTINEL.",
      kind: "reveal_node_in_system",
      targetSelector: { kind: "bloodiest_24h" },
      outro:
        "THE CYCLE CLOSES. THE LATTICE BREATHES. WHEN I RETURN I WILL KNOW YOUR THREAD BY ITS WEIGHT.",
      reward: "next_fragment_now",
    },
  },
];

/** Pick today's fragment deterministically from a daily seed. */
export function pickFragmentForSeed(seedHex: string, completedIds: number[]): KeeperFragment {
  // Cycle through fragments not yet completed (or all if completed all).
  const pool = FRAGMENTS.filter(f => !completedIds.includes(f.id));
  const target = pool.length > 0 ? pool : FRAGMENTS;
  // Deterministic index from seed.
  let idx = 0;
  for (let i = 0; i < seedHex.length; i++) {
    idx = (idx * 31 + seedHex.charCodeAt(i)) >>> 0;
  }
  return target[idx % target.length];
}
