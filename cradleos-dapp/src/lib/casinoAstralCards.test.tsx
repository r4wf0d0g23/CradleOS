import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AstralCard, AstralTable } from "../components/CasinoAstralCards";
import {
  blackjackPlan,
  BLACKJACK_FLIGHT_MS,
  BLACKJACK_FLIP_MS,
} from "./casinoTableMotion";
import { initialSession, playSession, actSession } from "./casinoSessions";
const seeded = (seed: number) => (bound: number) => {
  seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
  return seed % bound;
};
describe("astral presentation boundaries", () => {
  it("all hidden ranks/suits have identical markup, no value metadata or outcome-dependent decoration", () => {
    const back = renderToStaticMarkup(<AstralCard value={0} hidden />);
    for (let value = 1; value < 52; value++)
      expect(renderToStaticMarkup(<AstralCard value={value} hidden />)).toBe(
        back,
      );
    expect(back).not.toContain("data-value=");
    expect(back).toContain('aria-label="Unrevealed card"');
  });
  it("flying cards stay masked before the face flip, then expose exactly the supplied rank/suit", () => {
    expect(
      renderToStaticMarkup(<AstralCard value={51} progress={0.49} fly />),
    ).not.toContain("data-value=");
    const face = renderToStaticMarkup(
      <AstralCard value={51} progress={0.51} fly />,
    );
    expect(face).toContain('data-value="51"');
    expect(face).toContain('aria-label="K · Gates"');
  });
  it("reduced motion disables decorative drift without depending on a browser or game state", () => {
    const html = renderToStaticMarkup(
      <AstralTable reduced>
        <AstralCard value={0} />
      </AstralTable>,
    );
    expect(html).toContain('data-drift="off"');
    expect(html).toContain("Reduced motion");
  });
  it("every completion sequence lands the hole card before flipping and finishes all motion before unlock", () => {
    for (let seed = 1; seed <= 80; seed++) {
      let next = playSession(
        initialSession(),
        "blackjack",
        100,
        {},
        { seats: 1 + (seed % 3) },
        seeded(seed),
      );
      let previous;
      let steps = 0;
      do {
        const plan = blackjackPlan(next, previous),
          flip = plan.events.find((e) => e.kind === "flip");
        if (flip) {
          for (const deal of plan.events.filter(
            (e) => e.kind === "deal" && e.at < flip.at,
          ))
            expect(deal.at + BLACKJACK_FLIGHT_MS).toBeLessThanOrEqual(flip.at);
          for (const draw of plan.events.filter(
            (e) => e.row === -1 && e.index >= 2,
          ))
            expect(draw.at).toBeGreaterThanOrEqual(flip.at + BLACKJACK_FLIP_MS);
        }
        for (const event of plan.events)
          expect(
            event.at +
              (event.kind === "flip" ? BLACKJACK_FLIP_MS : BLACKJACK_FLIGHT_MS),
          ).toBeLessThan(plan.duration - 100);
        if (!next.table) break;
        previous = next;
        next = actSession(next, "stand");
      } while (++steps < 4);
    }
  });
});
