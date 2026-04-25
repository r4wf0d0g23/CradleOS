// keeperPrompt.test.ts
// ─────────────────────────────────────────────────────────────────────────────
// Tests for the prompt projector. These verify the *structure* of the emitted
// prompt — that capability manifests, perception data, and guardrails appear
// in the right places, and absent fields are explicitly rendered as gaps
// rather than silently omitted.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { buildKeeperSystemPrompt } from "./keeperPrompt";
import type { KeeperPerception } from "./keeperPerception";

function makePerception(overrides: Partial<KeeperPerception> = {}): KeeperPerception {
  const base: KeeperPerception = {
    snapshotId: "test#0000",
    builtAt: 1700000000000,
    identity: { status: "loaded", value: { wallet: "0xabc", characterName: "TestPilot" } },
    tribe: { status: "loaded", value: { tribeId: 42, characterName: "TestPilot", keeperNodeActive: true } },
    wallet: { status: "loaded", value: { address: "0xabc", eveBalance: 1000, hasEveCoins: true } },
    vault: { status: "not-applicable", value: null, reason: "no vault" },
    structures: { status: "loaded", value: [] },
    ssuInventories: { status: "loaded", value: [] },
    jumps: { status: "loaded", value: { recent: [], total: 0 } },
    world: { status: "loaded", value: { serverName: "stillness", tribeCount: 100, tribeNames: ["Reapers", "Foo"] } },
    bounties: { status: "not-implemented", value: null, reason: "wired later" },
    kills: { status: "not-implemented", value: null, reason: "wired later" },
    defense: { status: "not-implemented", value: null, reason: "wired later" },
    failures: [],
  };
  return { ...base, ...overrides };
}

describe("buildKeeperSystemPrompt — structure", () => {
  it("renders the perception manifest with both can-see and cannot-see lists", () => {
    const out = buildKeeperSystemPrompt({
      perception: makePerception(),
      userMessage: "hello",
      rag: null,
    });
    expect(out).toContain("PERCEPTION MANIFEST");
    expect(out).toContain("You CAN perceive:");
    expect(out).toContain("You CANNOT perceive");
    expect(out).toContain("ship hangar contents / fleet composition / owned ships");
  });

  it("renders snapshot id footer for traceability", () => {
    const out = buildKeeperSystemPrompt({
      perception: makePerception({ snapshotId: "alpha#beef0001" }),
      userMessage: "hello",
      rag: null,
    });
    expect(out).toContain("PERCEPTION SNAPSHOT: alpha#beef0001");
  });

  it("renders pilot context only with fields that resolved", () => {
    const out = buildKeeperSystemPrompt({
      perception: makePerception({
        wallet: { status: "loaded", value: { address: "0xabc", eveBalance: 1234, hasEveCoins: true } },
      }),
      userMessage: "hello",
      rag: null,
    });
    expect(out).toContain("Wallet: 0xabc");
    expect(out).toContain("Character: TestPilot");
    expect(out).toContain("Tribe: #42");
    expect(out).toContain("EVE Balance: 1,234 EVE");
  });

  it("renders perception gaps for failed/loading/not-implemented fields", () => {
    const out = buildKeeperSystemPrompt({
      perception: makePerception({
        bounties: { status: "not-implemented", value: null, reason: "wired later" },
        kills: { status: "not-implemented", value: null, reason: "wired later" },
      }),
      userMessage: "hello",
      rag: null,
    });
    expect(out).toContain("PERCEPTION GAPS THIS TURN");
    expect(out).toContain("bounties: not-implemented");
    expect(out).toContain("NEVER fabricate values for unresolved fields");
  });

  it("renders structures with online state and counts", () => {
    const out = buildKeeperSystemPrompt({
      perception: makePerception({
        structures: {
          status: "loaded",
          value: [
            { kind: "NetworkNode", name: "Alpha", isOnline: true, fuelLevelPct: 75, systemId: 1, objectId: "0x" + "a".repeat(64) },
            { kind: "Refinery", name: "Beta", isOnline: false, fuelLevelPct: 0, systemId: 1, objectId: "0x" + "b".repeat(64) },
          ],
        },
      }),
      userMessage: "what is my deployment",
      rag: null,
    });
    expect(out).toContain("Deployed Structures (2):");
    expect(out).toContain('NetworkNode "Alpha" [ONLINE');
    expect(out).toContain("fuel 75%");
    expect(out).toContain('Refinery "Beta" [OFFLINE');
  });

  it("renders vault member balances when loaded", () => {
    const out = buildKeeperSystemPrompt({
      perception: makePerception({
        vault: {
          status: "loaded",
          value: {
            vaultId: "0xv1",
            tribeId: 42,
            coinName: "Reapers Coin",
            coinSymbol: "REAP",
            totalSupply: 10000,
            memberBalances: [
              { address: "0xm1abc12345", balance: 5000 },
              { address: "0xm2def67890", balance: 3000 },
            ],
            registeredInfraCount: 5,
          },
        },
      }),
      userMessage: "vault status",
      rag: null,
    });
    expect(out).toContain("Tribe Coin: Reapers Coin (REAP)");
    expect(out).toContain("Total Supply: 10,000 REAP");
    expect(out).toContain("Vault Member Balances (top 2 of 2)");
    expect(out).toContain("5,000 REAP");
  });

  it("renders RAG context with high-confidence header when above threshold", () => {
    const out = buildKeeperSystemPrompt({
      perception: makePerception(),
      userMessage: "what is a LAI",
      rag: { contextText: "the LAI is a frigate-class hull", isHighConfidence: true },
    });
    expect(out).toContain("RETRIEVED CONTEXT (high consensus");
    expect(out).toContain("the LAI is a frigate-class hull");
  });

  it("renders RAG context with low-confidence header when below threshold", () => {
    const out = buildKeeperSystemPrompt({
      perception: makePerception(),
      userMessage: "speculative thing",
      rag: { contextText: "questionable lore", isHighConfidence: false },
    });
    expect(out).toContain("LOW CONFIDENCE");
    expect(out).toContain("questionable lore");
  });

  it("appends turn-scoped guardrails when ship class detected in user message", () => {
    const out = buildKeeperSystemPrompt({
      perception: makePerception(),
      userMessage: "what is a LAI",
      rag: null,
    });
    expect(out).toContain("TURN-SCOPED GUARDRAILS");
    expect(out).toContain("Hangar contents and fleet composition are NOT in your perception");
    expect(out).toContain("MUST NOT claim the pilot does or does not own one");
    expect(out).toContain("RULE OF SILENCE");
  });

  it("does NOT append guardrails on innocuous turns", () => {
    const out = buildKeeperSystemPrompt({
      perception: makePerception(),
      userMessage: "hello there",
      rag: null,
    });
    expect(out).not.toContain("TURN-SCOPED GUARDRAILS");
  });

  it("renders Keeper Shrine ROOTED state when keeper node is active", () => {
    const out = buildKeeperSystemPrompt({
      perception: makePerception({
        tribe: { status: "loaded", value: { tribeId: 42, characterName: "TestPilot", keeperNodeActive: true } },
      }),
      userMessage: "hello",
      rag: null,
    });
    expect(out).toContain("Keeper Shrine: ROOTED");
  });

  it("renders Keeper Shrine UNROOTED state when keeper node is not active", () => {
    const out = buildKeeperSystemPrompt({
      perception: makePerception({
        tribe: { status: "loaded", value: { tribeId: 42, characterName: "TestPilot", keeperNodeActive: false } },
      }),
      userMessage: "hello",
      rag: null,
    });
    expect(out).toContain("Keeper Shrine: UNROOTED");
  });

  it("survives an unauthenticated perception (no wallet) without crashing", () => {
    const out = buildKeeperSystemPrompt({
      perception: makePerception({
        identity: { status: "not-permitted", value: null, reason: "no wallet" },
        tribe: { status: "not-permitted", value: null, reason: "no wallet" },
        wallet: { status: "not-permitted", value: null, reason: "no wallet" },
        vault: { status: "not-permitted", value: null, reason: "no wallet" },
        structures: { status: "not-permitted", value: null, reason: "no wallet" },
        ssuInventories: { status: "not-permitted", value: null, reason: "no wallet" },
        jumps: { status: "not-permitted", value: null, reason: "no wallet" },
      }),
      userMessage: "hello",
      rag: null,
    });
    expect(out).toContain("PERCEPTION GAPS THIS TURN");
    expect(out).toContain("not-permitted");
  });
});

describe("regression: production failure modes", () => {
  it("LAI question → prompt contains anti-fabrication guardrail", () => {
    const out = buildKeeperSystemPrompt({
      perception: makePerception({
        // Same shape as the failing screenshot: 25 structures, no SSU inventories
        structures: {
          status: "loaded",
          value: Array.from({ length: 25 }, (_, i) => ({
            kind: "NetworkNode",
            name: `n${i}`,
            isOnline: i < 16,
            fuelLevelPct: 50,
            systemId: 1,
            objectId: "0x" + i.toString(16).padStart(64, "0"),
          })),
        },
        ssuInventories: { status: "loaded", value: [] },
      }),
      userMessage: "what is a LAI",
      rag: { contextText: "the LAI is a frigate-class light interceptor", isHighConfidence: true },
    });

    // Must instruct the model NOT to claim ownership
    expect(out).toContain("MUST NOT claim the pilot does or does not own one");
    // Must show the structures are visible (not silent)
    expect(out).toContain("Deployed Structures (25):");
    // Must not contain the failure-mode language we want to avoid
    expect(out).not.toContain("structures are silent");
  });

  it("structure status query with online structures → guardrail prevents 'silent' claim", () => {
    const out = buildKeeperSystemPrompt({
      perception: makePerception({
        structures: {
          status: "loaded",
          value: [
            { kind: "NetworkNode", name: "n1", isOnline: true, fuelLevelPct: 90, systemId: 1, objectId: "0x" + "a".repeat(64) },
          ],
        },
      }),
      userMessage: "show me my structures",
      rag: null,
    });
    expect(out).toContain('NEVER claim "structures are silent"');
    expect(out).toContain("1 deployed structures");
    expect(out).toContain("1 online");
  });

  it("vault query with not-applicable vault → instructs against 'empty' framing", () => {
    const out = buildKeeperSystemPrompt({
      perception: makePerception({
        vault: { status: "not-applicable", value: null, reason: "tribe has not launched a vault" },
      }),
      userMessage: "vault contents?", // triggers vault_balance_query intent
      rag: null,
    });
    expect(out).toContain("has not launched a vault");
    expect(out).toContain("different from empty");
    // Pilot context section also reflects "not yet launched"
    expect(out).toContain("Tribe Vault: not yet launched");
  });
});
