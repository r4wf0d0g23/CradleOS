import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SLOT_IDENTITIES,
  slotSymbol,
  fullInitialVault,
  slotFrameLabel,
} from "./casinoSlotIdentity";
import { casinoSoundNotes, type CasinoCue } from "./casinoSoundDesign";
import { FLEET, FLEET_KEYS, WILD, type SlotFrame } from "./casinoSlotFleet";
import {
  FeralConnections,
  SlotSymbolArt,
  SlotCoinValue,
  SlotFeatureInstrument,
  SlotBonusPanel,
} from "../components/SlotIdentityArt";
const base = "public/data/icons-cycle7-3573151/";
const manifest = JSON.parse(readFileSync(base + "manifest.json", "utf8"));
const frame = (patch: Partial<SlotFrame>) =>
  ({
    kind: "spin",
    index: 0,
    grid: Array.from({ length: 5 }, () => [0, 0, 0]),
    coins: [],
    wins: [],
    multiplier: 1,
    remaining: 0,
    ways: 10,
    ...patch,
  }) as SlotFrame;
describe("slot identity asset and presentation contracts", () => {
  it("uses seven genuinely distinct, present content-hashed native assets per symbol index", () => {
    for (const game of FLEET_KEYS) {
      const t = SLOT_IDENTITIES[game];
      expect(t.symbols).toHaveLength(7);
      const hashes = new Set<string>();
      for (const [i, s] of t.symbols.entries()) {
        const ref = manifest.library[s.library];
        expect(ref, s.library).toBeTruthy();
        const hash = createHash("sha256")
          .update(readFileSync(base + ref.asset))
          .digest("hex");
        expect(ref.asset).toBe(`assets/${hash}.png`);
        hashes.add(hash);
        expect(slotSymbol(game, i)).toBe(s);
      }
      expect(hashes.size, game).toBe(7);
      if (FLEET[game].mode === "lines") {
        expect(
          hashes.has(manifest.library[t.wild].asset.split("/")[1].slice(0, 64)),
          game + " WILD",
        ).toBe(false);
      }
      if (FLEET[game].free > 0) {
        expect(
          hashes.has(
            manifest.library[t.scatter].asset.split("/")[1].slice(0, 64),
          ),
          game + " SCATTER",
        ).toBe(false);
      }
    }
  });
  it("preserves readable symbol identity when art is unavailable and all digits of large token values", () => {
    for (let n = 0; n < 7; n++) {
      const html = renderToStaticMarkup(
        <SlotSymbolArt game="slot_scrapyard" symbol={n} />,
      );
      expect(html).toContain(`>${String(n + 1).padStart(2, "0")}<`);
      expect(html).toContain(slotSymbol("slot_scrapyard", n).name);
    }
    const html = renderToStaticMarkup(<SlotCoinValue value={180.1464} />);
    expect(html).toContain(">180</b>");
    expect(html).toContain(">.1464×</small>");
  });
  it("treats a full initial vault as collection ready, never nonexistent respins", () => {
    const f = frame({ coins: Array(15).fill(500), remaining: 3 });
    expect(fullInitialVault("slot_vault", f)).toBe(true);
    expect(fullInitialVault("slot_reactor", f)).toBe(false);
    expect(slotFrameLabel("slot_vault", f)).toBe(
      "FULL VAULT · COLLECTION READY",
    );
    const html = renderToStaticMarkup(
      <SlotBonusPanel game="slot_vault" frame={f} />,
    );
    expect(html).toContain("COLLECTION READY");
    expect(html).not.toContain("LEFT");
    expect(html).not.toContain("<i");
  });
  it("draws edges only inside the same evaluated winning cluster, not across adjacent groups", () => {
    const f = frame({
      wins: [
        { symbol: 0, cells: [0, 1, 6, 11, 16], count: 5, points: 1, ways: 1 },
        { symbol: 1, cells: [2, 7, 12, 17, 22], count: 5, points: 1, ways: 1 },
      ],
    });
    const html = renderToStaticMarkup(<FeralConnections frame={f} visible />);
    expect((html.match(/<line /g) || []).length).toBe(8);
    expect(html).not.toContain('y1="150" x2="50" y2="250"');
    expect(
      renderToStaticMarkup(<FeralConnections frame={f} visible={false} />),
    ).toBe("");
  });
  it("keeps unrevealed instruments neutral and sticky locks limited to actual free-spin wilds", () => {
    const f = frame({
      grid: Array.from({ length: 5 }, () => [WILD, WILD, WILD]),
    });
    expect(
      renderToStaticMarkup(
        <SlotFeatureInstrument game="slot_gatecrash" frame={f} covered />,
      ),
    ).not.toContain('class="lit"');
    expect(
      renderToStaticMarkup(
        <SlotFeatureInstrument
          game="slot_gatecrash"
          frame={f}
          covered={false}
        />,
      ).match(/class="lit"/g),
    ).toHaveLength(5);
    expect(
      renderToStaticMarkup(
        <SlotFeatureInstrument game="slot_drones" frame={f} covered={false} />,
      ),
    ).toContain("00 / 15");
    expect(
      renderToStaticMarkup(
        <SlotFeatureInstrument
          game="slot_drones"
          frame={{ ...f, kind: "free" }}
          covered={false}
        />,
      ),
    ).toContain("15 / 15");
  });
  it("shows feature progress only for an earned feature using the saved current index", () => {
    expect(
      renderToStaticMarkup(
        <SlotBonusPanel game="slot_drones" frame={frame({})} />,
      ),
    ).toBe("");
    expect(
      renderToStaticMarkup(
        <SlotBonusPanel game="slot_drones" frame={frame({ remaining: 8 })} />,
      ),
    ).toContain("8 free spins awarded");
    const html = renderToStaticMarkup(
      <SlotBonusPanel
        game="slot_drones"
        frame={frame({ kind: "free", index: 3, remaining: 5 })}
      />,
    );
    expect(html).toContain("Free spin 3 of 8");
    expect(html.match(/class="on"/g)).toHaveLength(3);
    expect(
      renderToStaticMarkup(
        <SlotBonusPanel
          game="slot_vault"
          frame={frame({ kind: "hold", remaining: 2 })}
        />,
      ).match(/class="on"/g),
    ).toHaveLength(2);
  });
});
describe("original opt-in sound voices", () => {
  const cues: CasinoCue[] = [
    "select",
    "spin",
    "deal",
    "win",
    "loss",
    "stop",
    "bonus",
    "cascade",
    "coin",
  ];
  it("provides eight distinct envelopes/timbres and bounded finite cues, not ambient loops", () => {
    expect(
      new Set(
        FLEET_KEYS.map((k) => JSON.stringify(casinoSoundNotes("spin", k))),
      ).size,
    ).toBe(8);
    for (const key of [...FLEET_KEYS, undefined])
      for (const cue of cues) {
        const notes = casinoSoundNotes(cue, key);
        expect(notes.length).toBeGreaterThan(0);
        for (const n of notes) {
          expect(n.hz).toBeGreaterThan(20);
          expect(n.endHz).toBeGreaterThan(20);
          expect(n.hz).toBeLessThan(5000);
          expect(n.at + n.duration).toBeLessThan(2);
          expect(n.gain).toBeLessThanOrEqual(0.05);
          expect(n.attack).toBeLessThan(n.duration);
          expect(n.gain).toBeGreaterThan(0);
        }
      }
  });
  it("preserves default classic cue pitches and distinguishes losses from features", () => {
    expect(casinoSoundNotes("win").map((n) => n.hz)).toEqual([
      261.63, 329.63, 392,
    ]);
    for (const game of FLEET_KEYS) {
      const notes = casinoSoundNotes("loss", game);
      const fundamentals = notes.filter((n) => n.gain === notes[0].gain);
      expect(fundamentals[0].hz).toBeGreaterThan(
        fundamentals[fundamentals.length - 1].hz,
      );
      expect(casinoSoundNotes("bonus", game)).not.toEqual(
        casinoSoundNotes("loss", game),
      );
    }
  });
});
