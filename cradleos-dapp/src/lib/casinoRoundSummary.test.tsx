import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CasinoRoundHistory,
  CasinoRoundSummary,
  roundOutcome,
} from "../components/CasinoRoundSummary";
import { chipLabel, type Round } from "./casinoPractice";
import {
  initialSession,
  playSession,
  revealSlot,
  pendingSlot,
  packTotal,
} from "./casinoSessions";

const rng =
  (seed = 7921) =>
  (bound: number) => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) % bound;
  };
const history = (state: ReturnType<typeof initialSession>, busy = false) =>
  renderToStaticMarkup(
    <CasinoRoundHistory state={state} busy={busy} title={(g) => g} />,
  );

describe("payout-first casino presentation", () => {
  it.each([
    [0, "No payout", "-25"],
    [1250, "Partial return", "-12.5"],
    [2500, "Bet returned", "0"],
    [7500, "Win", "+50"],
  ])(
    "keeps %i return truthful without a prominent net amount",
    (payout, status, change) => {
      const round = { stake: 2500, payout, label: "Known outcome" };
      const html = renderToStaticMarkup(<CasinoRoundSummary round={round} />);
      const [primary, detail] = html.split("<details");
      expect(roundOutcome(round)).toBe(status);
      expect(primary).toContain(status);
      expect(primary).toContain("Total bet 25 chips");
      expect(primary).toContain(chipLabel(payout));
      expect(primary).not.toMatch(/Net|Balance change|Known outcome/);
      expect(detail).toContain(`Balance change</dt><dd>${change} chips`);
      expect(detail).toContain("Known outcome");
      expect(html).not.toContain(" open=");
    },
  );

  it("withholds the entire future receipt and current history row at every pending cursor", () => {
    const draw = rng();
    let state = initialSession();
    for (let n = 0; n < 200; n++) {
      state = playSession(
        initialSession(),
        "slot_gatecrash",
        2500,
        {},
        {},
        draw,
      );
      if (state.pack!.slot!.frames.length > 1) break;
    }
    expect(state.pack!.slot!.frames.length).toBeGreaterThan(1);
    const prior: Round = {
      id: 0,
      game: "coinflip",
      stake: 100,
      payout: 0,
      values: [1],
      label: "Earlier visible outcome",
    };
    state.history.push(prior);
    while (pendingSlot(state)) {
      const html = history(state);
      expect(html).toContain("Earlier visible outcome");
      expect(html).not.toContain("slot_gatecrash");
      expect(html).not.toContain(state.pack!.rounds[0].label);
      expect(html).not.toContain("casino-pack-receipt");
      expect(history(state, true)).toBe("");
      state = revealSlot(state);
    }
    expect(history(state)).toContain("slot_gatecrash");
    expect(history(state)).toContain(state.pack!.rounds[0].label);
  });

  it("preserves exact aggregate and individual accounting for a multi-play pack", () => {
    const state = playSession(
      initialSession(),
      "plinko",
      2500,
      {},
      { count: 3, profile: "Low" },
      rng(),
    );
    const before = JSON.stringify(state);
    const html = history(state);
    expect(html).toContain("3 individual plays");
    expect(html).toContain(
      `Total bet 75 · Payout ${chipLabel(packTotal(state.pack!, "payout"))} chips`,
    );
    for (const r of state.pack!.rounds) {
      expect(html).toContain(
        `Bet ${chipLabel(r.stake)} · Payout ${chipLabel(r.payout)} chips`,
      );
      const change = r.payout - r.stake;
      expect(html).toContain(
        `Balance change</dt><dd>${change > 0 ? "+" : ""}${chipLabel(change)} chips`,
      );
    }
    expect(html).not.toContain(" open=");
    expect(JSON.stringify(state)).toBe(before);
  });
});
