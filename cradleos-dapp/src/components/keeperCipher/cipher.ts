/**
 * Keeper Cipher — encryption / decryption helpers.
 *
 * v0 uses a monoalphabetic substitution cipher where 8-26 of the 26 letters
 * are shuffled and replaced with monospace-safe glyphs. The cipher strength
 * controls (a) how many letters are scrambled vs left in clear and
 * (b) how many "free" hint mappings are revealed at puzzle start.
 *
 *   strength 1 → 8 letters scrambled, 4 hint mappings free
 *   strength 2 → 14 letters scrambled, 2 hint mappings free
 *   strength 3 → 26 letters scrambled, 1 hint mapping free
 *   strength 4-5 reserved for v1 (Vigenère + rotating key)
 *
 * Determinism: the same `seedHex` always produces the same scramble for a
 * given (plaintext, strength) tuple, so every player on a given day sees
 * the same puzzle.
 */

/** 26 monospace-safe glyphs (verified webview-safe per TOOLS.md). */
const CIPHER_GLYPHS = [
  "◉", "◇", "◆", "✦", "▣", "⊕", "⬢", "▲",
  "◢", "◣", "◤", "◥", "▤", "▥", "▦", "▧",
  "▨", "▩", "≡", "≣", "⊞", "⊟", "⊠", "⊡",
  "⌬", "❖",
];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Mulberry32 PRNG seeded from a hex digest. Cheap, deterministic, fine here. */
function rngFromSeed(seedHex: string): () => number {
  let h = 0;
  for (let i = 0; i < seedHex.length; i++) {
    h = (h * 31 + seedHex.charCodeAt(i)) >>> 0;
  }
  let state = h || 0xdeadbeef;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface CipherPuzzle {
  /** Plain alphabet letter → cipher glyph (only for letters that appear in
   *  the plaintext AND were scrambled). Used by the engine to render. */
  encryptionMap: Map<string, string>;
  /** Reverse map: cipher glyph → plain letter. The "answer key". */
  decryptionMap: Map<string, string>;
  /** The encrypted display string the player sees. Spaces and unknown chars
   *  pass through untouched. */
  ciphertext: string;
  /** Letters whose mappings are revealed for free as starting hints. */
  freeHints: Array<{ glyph: string; letter: string }>;
  /** All cipher glyphs that appear in the puzzle, in display order
   *  (deduped). Used to render the cipher key panel. */
  glyphsInPuzzle: string[];
}

export function encryptFragment(
  plaintext: string,
  strength: 1 | 2 | 3 | 4 | 5,
  seedHex: string,
): CipherPuzzle {
  const rng = rngFromSeed(seedHex);

  // Pick how many letters of the alphabet to scramble.
  const scrambleCount = strength <= 1 ? 8 : strength === 2 ? 14 : 26;
  const hintCount = strength <= 1 ? 4 : strength === 2 ? 2 : 1;

  // Choose which letters to scramble (the rest pass through as cleartext).
  const lettersInPlaintext = new Set(
    plaintext.toUpperCase().split("").filter(c => /[A-Z]/.test(c)),
  );
  const candidates = ALPHABET.split("").filter(l => lettersInPlaintext.has(l));
  shuffleInPlace(candidates, rng);
  const scrambled = new Set(candidates.slice(0, Math.min(scrambleCount, candidates.length)));

  // Pick a glyph permutation for the scrambled letters.
  const glyphPool = shuffleInPlace([...CIPHER_GLYPHS], rng);
  const encryptionMap = new Map<string, string>();
  const decryptionMap = new Map<string, string>();
  let glyphIdx = 0;
  for (const letter of scrambled) {
    const glyph = glyphPool[glyphIdx++ % glyphPool.length];
    encryptionMap.set(letter, glyph);
    decryptionMap.set(glyph, letter);
  }

  // Build the ciphertext. Pass through letters not scrambled.
  const ciphertext = plaintext
    .toUpperCase()
    .split("")
    .map(c => encryptionMap.get(c) ?? c)
    .join("");

  // Pick free-hint mappings. Bias toward common letters (E, T, A, O, I, N, S, R, H, L)
  // so the player gets a useful foothold instead of random low-frequency reveals.
  const COMMON = "ETAOINSRHLDCUMFPGWYBVKXJQZ";
  const scrambledList = [...scrambled];
  scrambledList.sort((a, b) => COMMON.indexOf(a) - COMMON.indexOf(b));
  const freeHints = scrambledList.slice(0, hintCount).map(letter => ({
    glyph: encryptionMap.get(letter)!,
    letter,
  }));

  // Glyphs in display order (first appearance in ciphertext).
  const seen = new Set<string>();
  const glyphsInPuzzle: string[] = [];
  for (const c of ciphertext) {
    if (decryptionMap.has(c) && !seen.has(c)) {
      seen.add(c);
      glyphsInPuzzle.push(c);
    }
  }

  return { encryptionMap, decryptionMap, ciphertext, freeHints, glyphsInPuzzle };
}

/** Score the player's guess against the answer key. Returns
 *  { correctLetters, totalLetters, isComplete }. */
export function scoreAttempt(
  decryptionMap: Map<string, string>,
  playerGuess: Map<string, string>,
): { correctLetters: number; totalLetters: number; isComplete: boolean } {
  let correct = 0;
  for (const [glyph, letter] of decryptionMap) {
    if (playerGuess.get(glyph) === letter) correct++;
  }
  return {
    correctLetters: correct,
    totalLetters: decryptionMap.size,
    isComplete: correct === decryptionMap.size,
  };
}

/** Apply the player's current guess to the ciphertext for live preview. */
export function previewDecryption(
  ciphertext: string,
  decryptionMap: Map<string, string>,
  playerGuess: Map<string, string>,
): string {
  return ciphertext
    .split("")
    .map(c => {
      if (!decryptionMap.has(c)) return c; // not a cipher glyph (space, punct, cleartext)
      const guess = playerGuess.get(c);
      return guess ?? "_";
    })
    .join("");
}
