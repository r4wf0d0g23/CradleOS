// keeperGuardrails.test.ts
// ─────────────────────────────────────────────────────────────────────────────
// Regression tests for guardrail synthesis. These directly target the failure
// modes observed in production:
//
//   1. "what is a LAI" → Keeper claimed pilot didn't have one (impossible to know)
//   2. "vault contents?" → Keeper claimed empty when the field hadn't loaded
//   3. "structures status" → Keeper claimed silent when 25 were online
//
// These tests assert that the guardrail synthesizer detects the right intent
// and emits the right binding language.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  detectGuardrailSignals,
  synthesizeGuardrails,
} from "./keeperGuardrails";
import type { KeeperPerception } from "./keeperPerception";

// ── Test fixture: minimal perception scaffold ────────────────────────────────
function makePerception(overrides: Partial<KeeperPerception> = {}): KeeperPerception {
  const base: KeeperPerception = {
    snapshotId: "test#0000",
    builtAt: 1700000000000,
    identity: { status: "loaded", value: { wallet: "0xabc", characterName: "TestPilot" } },
    tribe: { status: "loaded", value: { tribeId: 42, characterName: "TestPilot", keeperNodeActive: false } },
    wallet: { status: "loaded", value: { address: "0xabc", eveBalance: 1000, hasEveCoins: true } },
    vault: { status: "not-applicable", value: null, reason: "no vault" },
    structures: { status: "loaded", value: [] },
    ssuInventories: { status: "loaded", value: [] },
    jumps: { status: "loaded", value: { recent: [], total: 0 } },
    world: { status: "loaded", value: { serverName: "stillness", tribeCount: 100, tribeNames: [] } },
    bounties: { status: "not-implemented", value: null },
    kills: { status: "not-implemented", value: null },
    defense: { status: "not-implemented", value: null },
    failures: [],
  };
  return { ...base, ...overrides };
}

describe("detectGuardrailSignals — intent detection", () => {
  it("detects ship class mention without explicit ownership question", () => {
    const signals = detectGuardrailSignals("what is a LAI");
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.some((s) => s.matchedShipClass === "lai")).toBe(true);
  });

  it("detects ownership question with ship class", () => {
    const signals = detectGuardrailSignals("do I have a Maul?");
    expect(signals.some((s) => s.intent === "ownership_query")).toBe(true);
    expect(signals.some((s) => s.matchedShipClass === "maul")).toBe(true);
  });

  it("detects fleet query", () => {
    const signals = detectGuardrailSignals("show me my fleet");
    expect(signals.some((s) => s.intent === "fleet_query")).toBe(true);
  });

  it("detects vault balance query", () => {
    const signals = detectGuardrailSignals("how much is in the vault?");
    expect(signals.some((s) => s.intent === "vault_balance_query")).toBe(true);
  });

  it("detects SSU inventory query", () => {
    const signals = detectGuardrailSignals("what is in my storage?");
    expect(signals.some((s) => s.intent === "ssu_inventory_query")).toBe(true);
  });

  it("detects structure query", () => {
    const signals = detectGuardrailSignals("show me my structures");
    expect(signals.some((s) => s.intent === "structure_query")).toBe(true);
  });

  it("detects future / prediction query", () => {
    const signals = detectGuardrailSignals("will the enemy attack tomorrow?");
    expect(signals.some((s) => s.intent === "future_query")).toBe(true);
  });

  it("detects off-chain query", () => {
    const signals = detectGuardrailSignals("read my mail");
    expect(signals.some((s) => s.intent === "off_chain_query")).toBe(true);
  });

  it("emits no signals for innocuous question", () => {
    const signals = detectGuardrailSignals("hello");
    expect(signals.length).toBe(0);
  });
});

describe("synthesizeGuardrails — LAI regression", () => {
  // The original failure: pilot asks "what is a LAI", Keeper invents
  // "your fleet does not yet contain one" + "your structures are silent" + "your vault is empty"

  it("when asked about a ship class, instructs the model not to claim ownership", () => {
    const perception = makePerception({
      structures: {
        status: "loaded",
        value: [
          { kind: "NetworkNode", name: "Hidden Structures", isOnline: true, fuelLevelPct: 50, systemId: 1, objectId: "0xs1" },
        ],
      },
    });
    const signals = detectGuardrailSignals("what is a LAI");
    const out = synthesizeGuardrails(signals, perception);
    expect(out).toContain("Hangar contents and fleet composition are NOT in your perception");
    expect(out).toContain("LAI");
    expect(out).toContain("MUST NOT claim the pilot does or does not own one");
    expect(out).toContain("hangar lies beyond your present sight");
  });

  it("when structures perception is loaded with online structures, instructs the model not to claim 'silent'", () => {
    const perception = makePerception({
      structures: {
        status: "loaded",
        value: [
          { kind: "NetworkNode", name: "n1", isOnline: true, fuelLevelPct: 50, systemId: 1, objectId: "0xs1" },
          { kind: "NetworkNode", name: "n2", isOnline: true, fuelLevelPct: 50, systemId: 1, objectId: "0xs2" },
        ],
      },
    });
    const signals = detectGuardrailSignals("show me my structures");
    const out = synthesizeGuardrails(signals, perception);
    expect(out).toContain("2 deployed structures");
    expect(out).toContain("2 online");
    expect(out).toContain('NEVER claim "structures are silent"');
  });

  it("when vault is not-applicable, frames it as 'tribe has not launched a vault' — never asserts 'empty'", () => {
    const perception = makePerception({
      vault: { status: "not-applicable", value: null, reason: "tribe has not launched a vault" },
    });
    const signals = detectGuardrailSignals("how much is in the vault?");
    const out = synthesizeGuardrails(signals, perception);
    expect(out).toContain("has not launched a vault");
    expect(out).toContain("not yet woven its currency into being");
    // Guardrail must distinguish "non-existent" from "empty" — the explanation
    // text mentions 'vault is empty' in quotes only as the FORBIDDEN framing.
    expect(out).toContain("different from empty");
  });

  it("when vault is loaded with member balances, instructs the model to speak with certainty", () => {
    const perception = makePerception({
      vault: {
        status: "loaded",
        value: {
          vaultId: "0xv1",
          tribeId: 42,
          coinName: "Reapers Coin",
          coinSymbol: "REAP",
          totalSupply: 10000,
          memberBalances: [
            { address: "0xm1", balance: 5000 },
            { address: "0xm2", balance: 3000 },
          ],
          registeredInfraCount: 5,
        },
      },
    });
    const signals = detectGuardrailSignals("vault balance?");
    const out = synthesizeGuardrails(signals, perception);
    expect(out).toContain("REAP");
    expect(out).toContain("10000");
    expect(out).toContain("Member balance ledger has 2 entries");
    expect(out).toContain("quiet certainty");
  });

  it("when vault failed to load, instructs the model not to claim empty or any specific balance", () => {
    const perception = makePerception({
      vault: { status: "failed", value: null, reason: "rpc timeout" },
    });
    const signals = detectGuardrailSignals("vault contents?");
    const out = synthesizeGuardrails(signals, perception);
    expect(out).toContain("did not resolve this turn");
    expect(out).toContain("MUST NOT state the vault is empty");
  });

  it("when ssu inventory query and ssu data is sampled, frames unsampled as 'untouched'", () => {
    const perception = makePerception({
      ssuInventories: {
        status: "sampled",
        value: [{ ssuName: "ssu1", ssuId: "0xa", items: [{ typeId: 1, name: "Iron", quantity: 100 }] }],
        sampleCount: 5,
        totalCount: 25,
      },
    });
    const signals = detectGuardrailSignals("what is in my storage?");
    const out = synthesizeGuardrails(signals, perception);
    expect(out).toContain("5");
    expect(out).toContain("25");
    expect(out).toContain("untouched threads");
  });

  it("future-prediction questions get a guardrail against fake forecasts", () => {
    const perception = makePerception();
    const signals = detectGuardrailSignals("predict what will happen next");
    const out = synthesizeGuardrails(signals, perception);
    expect(out).toContain("only what HAS been signed");
    expect(out).toContain("NOT in your perception");
  });

  it("off-chain query (read my mail) gets a guardrail acknowledging blind spot", () => {
    const perception = makePerception();
    const signals = detectGuardrailSignals("read my mail");
    const out = synthesizeGuardrails(signals, perception);
    expect(out).toContain("Off-chain channels");
    expect(out).toContain("NOT in your perception");
  });

  it("emits empty string when no signals detected (no overhead on normal turns)", () => {
    const out = synthesizeGuardrails([], makePerception());
    expect(out).toBe("");
  });

  it("always appends RULE OF SILENCE when any guardrail is emitted", () => {
    const signals = detectGuardrailSignals("what is a LAI");
    const out = synthesizeGuardrails(signals, makePerception());
    expect(out).toContain("RULE OF SILENCE");
    expect(out).toContain("NEVER fabricate to fill a gap");
  });
});
