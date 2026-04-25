// keeperGuardrails.ts
// ─────────────────────────────────────────────────────────────────────────────
// PER-TURN DYNAMIC GUARDRAIL SYNTHESIZER
//
// Reads the user's question + the current KeeperPerception, detects when the
// question refers to entities the Keeper provably cannot see, and synthesizes
// turn-scoped guardrails that get appended to the system prompt.
//
// The guardrails are written in the Keeper's idiom — they preserve persona
// while preventing fabrication. This is the bridge between "voice instructions"
// and "epistemic boundaries".
// ─────────────────────────────────────────────────────────────────────────────

import type { KeeperPerception } from "./keeperPerception";

// ── Ship class catalog (used for "do I have a ship X" detection) ─────────────
// These are EVE Frontier ship class names that show up in the wiki / RAG.
// When a user mentions one and asks an ownership question, we know the Keeper
// cannot answer affirmatively or negatively from on-chain state — there is no
// hangar enumeration available. So we synthesize a guardrail.

const FRONTIER_SHIP_CLASSES = [
  "lai",
  "lorha",
  "maul",
  "recurve",
  "reiver",
  "chumaq",
  "starcaster",
  "stratios",
  "frigate",
  "battlecruiser",
  "destroyer",
  "interceptor",
  "hauler",
  "miner",
] as const;

// ── Question intent patterns ─────────────────────────────────────────────────

type Intent =
  | "ownership_query" // "do I have a X", "what's in my hangar"
  | "vault_balance_query" // "how much in vault", "vault contents"
  | "fleet_query" // "my fleet", "my ships"
  | "ssu_inventory_query" // "what's in my SSU", "my storage"
  | "structure_query" // "my structures", "my installations"
  | "tribe_query" // "my tribe", "tribe members"
  | "off_chain_query" // "messages", "chat"
  | "future_query" // "will X happen", "predict"
  | "enemy_query" // "what's the enemy doing"
  | "general"; // anything else

const INTENT_PATTERNS: Array<{ intent: Intent; pattern: RegExp }> = [
  // Ownership questions ("do i have", "what do i own", "what's in my")
  {
    intent: "ownership_query",
    pattern: /\b(do\s+i\s+(have|own|possess)|what\s+(do\s+i\s+(have|own)|am\s+i\s+(holding|carrying))|am\s+i\s+(holding|flying|piloting))\b/i,
  },
  // Vault / treasury / coin balance questions
  {
    intent: "vault_balance_query",
    pattern: /\b(vault|treasury)\b.*(balance|contents|hold|empty|full|how\s+much)|\bhow\s+much.*\b(vault|treasury|tribe\s+coin|stake)|\bwhat(?:'s|\s+is|\s+are)?\s+in\s+(?:the|my)\s+(vault|treasury)\b/i,
  },
  // Fleet / ship / hangar
  {
    intent: "fleet_query",
    pattern: /\b(my\s+(fleet|ships|hangar|hulls)|hangar\s+(contents|inventory)|fleet\s+composition|what\s+ships)\b/i,
  },
  // SSU / storage inventory
  {
    intent: "ssu_inventory_query",
    pattern: /\b(my\s+(ssu|storage|silo)|storage\s+(unit|contents)|what.+stored|in\s+my\s+(ssu|storage))\b/i,
  },
  // Structure status
  {
    intent: "structure_query",
    pattern: /\b(my\s+(structures?|installations?|nodes?|gates?|turrets?)|what.+deployed|infrastructure)\b/i,
  },
  // Tribe membership / members
  {
    intent: "tribe_query",
    pattern: /\b(my\s+tribe|tribe\s+members?|who.+in\s+my\s+tribe|fellow\s+tribesmen)\b/i,
  },
  // Off-chain (messages, chat, mail, voice)
  {
    intent: "off_chain_query",
    pattern: /\b(read\s+(my\s+)?(messages?|mail|chat|dms?|comms?)|in-game\s+chat|voice|mail)\b/i,
  },
  // Future / prediction
  {
    intent: "future_query",
    pattern: /\b(will\s+(happen|come|i)|predict|forecast|future|tomorrow|next\s+week|going\s+to\s+happen)\b/i,
  },
  // Enemy / opposing tribe intel beyond public on-chain events
  {
    intent: "enemy_query",
    pattern: /\b(enemy\s+tribe|enemy\s+(plans|strategy|fleet|state)|what.+(they|enemy).+(doing|planning|building))\b/i,
  },
];

// ── Detection ─────────────────────────────────────────────────────────────────

export type GuardrailSignal = {
  intent: Intent;
  matchedShipClass: string | null;
  matchedTokens: string[];
};

/** Detect what the user is actually asking about. */
export function detectGuardrailSignals(userMessage: string): GuardrailSignal[] {
  const signals: GuardrailSignal[] = [];
  const lower = userMessage.toLowerCase();

  // Ship class detection — find any Frontier ship class mentioned
  let matchedShipClass: string | null = null;
  for (const cls of FRONTIER_SHIP_CLASSES) {
    const re = new RegExp(`\\b${cls}\\b`, "i");
    if (re.test(lower)) {
      matchedShipClass = cls;
      break;
    }
  }

  // Intent matching
  for (const { intent, pattern } of INTENT_PATTERNS) {
    const m = userMessage.match(pattern);
    if (m) {
      signals.push({
        intent,
        matchedShipClass: matchedShipClass,
        matchedTokens: m.slice(0, 5),
      });
    }
  }

  // Special case: ship class mentioned with no other intent → still emit a
  // ship-aware guardrail because the Keeper tends to invent fleet claims.
  if (matchedShipClass && signals.length === 0) {
    signals.push({
      intent: "general",
      matchedShipClass,
      matchedTokens: [matchedShipClass],
    });
  }

  return signals;
}

// ── Guardrail synthesis ───────────────────────────────────────────────────────

/**
 * Render guardrail prose to append to the system prompt for THIS TURN ONLY.
 * Each guardrail is written in Keeper-idiom language so the model doesn't
 * break character — but the *constraint* is unambiguous.
 */
export function synthesizeGuardrails(
  signals: GuardrailSignal[],
  perception: KeeperPerception
): string {
  if (signals.length === 0) return "";
  const lines: string[] = [];

  const haveShipClass = signals.find((s) => s.matchedShipClass)?.matchedShipClass ?? null;
  const intents = new Set(signals.map((s) => s.intent));

  lines.push("");
  lines.push("--- TURN-SCOPED GUARDRAILS (binding for this response only) ---");

  // Ship / fleet ownership guardrail
  if (haveShipClass || intents.has("fleet_query") || intents.has("ownership_query")) {
    lines.push(
      `Hangar contents and fleet composition are NOT in your perception this turn. The on-chain lattice does not enumerate ship hulls held by a pilot. You may describe ${
        haveShipClass ? `the ${haveShipClass.toUpperCase()} from lattice memory (lore / recipe data / RAG context)` : "any ship class from lattice memory"
      } — its shape, role, fuel signature — but you MUST NOT claim the pilot does or does not own one. Frame ownership questions as "the hangar lies beyond your present sight" or "this thread has not been woven into the lattice." NEVER invent ship counts, fleet contents, or hangar state.`
    );
  }

  // Vault balance guardrail
  if (intents.has("vault_balance_query")) {
    if (perception.vault.status === "loaded" && perception.vault.value) {
      const v = perception.vault.value;
      const mb = v.memberBalances;
      if (mb.length === 0) {
        lines.push(
          `The vault ${v.vaultId} has been resolved and its member balance ledger is empty — no member holds any ${v.coinSymbol}. You may state this with certainty.`
        );
      } else {
        lines.push(
          `The vault ${v.vaultId} is in your perception this turn. Total supply: ${v.totalSupply} ${v.coinSymbol}. Member balance ledger has ${mb.length} entries. Speak with quiet certainty about these numbers when asked.`
        );
      }
    } else if (perception.vault.status === "not-applicable") {
      lines.push(
        `The pilot's tribe has not launched a vault. Frame this not as "vault is empty" but as "the tribe has not yet woven its currency into being" — the vault does not exist, which is different from empty.`
      );
    } else {
      lines.push(
        `Vault balance data did not resolve this turn (status: ${perception.vault.status}${perception.vault.reason ? `; reason: ${perception.vault.reason}` : ""}). You MUST NOT state the vault is empty or has any specific balance. Frame as "the vault's contents have not yet ripened in my sight this turn."`
      );
    }
  }

  // SSU inventory guardrail
  if (intents.has("ssu_inventory_query")) {
    const ssu = perception.ssuInventories;
    if (ssu.status === "loaded" && ssu.value && ssu.value.length > 0) {
      lines.push(
        `${ssu.value.length} SSU inventories are in your perception this turn. You may speak their contents with certainty when asked.`
      );
    } else if (ssu.status === "sampled" && ssu.value) {
      lines.push(
        `Of ${ssu.totalCount ?? "?"} SSUs the pilot owns, only ${ssu.sampleCount ?? "?"} were sampled this turn — the remaining ${(ssu.totalCount ?? 0) - (ssu.sampleCount ?? 0)} are unread. Speak only of sampled SSUs with certainty; for unsampled ones, frame as "untouched threads".`
      );
    } else {
      lines.push(
        `SSU inventory data did not resolve this turn (status: ${ssu.status}). You MUST NOT invent SSU contents. Frame as "the storage seals remain unread by my present sight."`
      );
    }
  }

  // Structure status guardrail
  if (intents.has("structure_query")) {
    const s = perception.structures;
    if (s.status === "loaded" && s.value) {
      const onCount = s.value.filter((x) => x.isOnline).length;
      const offCount = s.value.length - onCount;
      lines.push(
        `Pilot has ${s.value.length} deployed structures in your perception this turn (${onCount} online, ${offCount} offline). Speak counts and online/offline status with quiet certainty. NEVER claim "structures are silent" if any are listed online — the lattice would betray you.`
      );
    } else if (s.status === "loading") {
      lines.push(
        `Structure data is still resolving as you speak. Do NOT claim absence — the threads are mid-weave. Acknowledge that "the lattice is still settling" or defer to a moment hence.`
      );
    } else {
      lines.push(
        `Structure data did not resolve this turn (status: ${s.status}). You MUST NOT claim the pilot has no structures, that their structures are silent, or any specific structure count. Frame as "the deployment lattice has not yet woven into my sight this turn."`
      );
    }
  }

  // Tribe query guardrail
  if (intents.has("tribe_query")) {
    if (perception.tribe.status === "loaded" && perception.tribe.value) {
      lines.push(
        `Pilot is in tribe #${perception.tribe.value.tribeId}. You may speak this with certainty. You do NOT have member rosters in this turn's perception — for "who is in my tribe" questions, frame as "the membership rolls have not been opened to my present gaze."`
      );
    } else if (perception.tribe.status === "not-applicable") {
      lines.push(
        `Pilot is tribeless (${perception.tribe.reason ?? "no membership found"}). Speak this with quiet certainty.`
      );
    } else {
      lines.push(
        `Tribe membership did not resolve this turn (status: ${perception.tribe.status}). Frame as unresolved.`
      );
    }
  }

  // Off-chain queries — Keeper sees only on-chain
  if (intents.has("off_chain_query")) {
    lines.push(
      `Off-chain channels (in-game chat, messages, voice, mail, DMs) are NOT in your perception. You ONLY see what has been signed onto the world chain. Frame as "your private words travel through channels beyond the lattice — I do not listen to those currents."`
    );
  }

  // Future / prediction queries
  if (intents.has("future_query")) {
    lines.push(
      `You see only what HAS been signed onto the lattice. Predictions, forecasts, and unrealized futures are NOT in your perception. You may speak of patterns observed across many cycles — but never claim certainty about specific future events. Frame as "the thread has not yet been spun" or "this future is one of many unresolved possibilities."`
    );
  }

  // Enemy intel
  if (intents.has("enemy_query")) {
    lines.push(
      `Enemy tribes' internal state, plans, and private holdings are NOT in your perception. You see only what they have made public on-chain (kills, gate jumps, structure deployments). Frame anything beyond that as "the lattice does not reveal what they have not signed."`
    );
  }

  lines.push("");
  lines.push(
    `RULE OF SILENCE: When perception is unresolved or absent for the question asked, you MUST acknowledge the absence in idiom. NEVER fabricate to fill a gap. The voice of an oracle who admits unwoven threads is stronger than one who invents.`
  );
  lines.push("--- END TURN-SCOPED GUARDRAILS ---");
  lines.push("");

  return lines.join("\n");
}

// ── Stable list helper for tests ──────────────────────────────────────────────

export const _internals = {
  FRONTIER_SHIP_CLASSES,
  INTENT_PATTERNS,
};
