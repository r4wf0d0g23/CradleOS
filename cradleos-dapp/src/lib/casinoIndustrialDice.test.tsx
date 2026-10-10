import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PhysicalDie,
  diceImpactCues,
} from "../components/CasinoIndustrialDice";
import { diePose, DIE_CONTACTS } from "./casinoObjectMotion";
import { casinoSoundNotes } from "./casinoSoundDesign";

describe("industrial dice presentation", () => {
  it("keeps every cube vertex above its pad at both responsive sizes and all faces", () => {
    for (const half of [22, 24, 29])
      for (let face = 1; face <= 6; face++)
        for (let index = 0; index < 3; index++) {
          for (let k = 0; k <= 400; k++) {
            const p = diePose(k / 400, face, index);
            const [ax, ay, az] = [p.rx, p.ry, p.rz].map(
              (v) => (v * Math.PI) / 180,
            );
            for (const x of [-half, half])
              for (const y of [-half, half])
                for (const z of [-half, half]) {
                  // Independently rotate a physical corner in CSS's right-to-left order.
                  const xx = x * Math.cos(ay) + z * Math.sin(ay),
                    zz = -x * Math.sin(ay) + z * Math.cos(ay);
                  const yy = y * Math.cos(ax) - zz * Math.sin(ax);
                  const worldY = xx * Math.sin(az) + yy * Math.cos(az);
                  expect(
                    worldY - p.height - (p.support - 1) * half,
                  ).toBeLessThanOrEqual(half + 1e-8);
                }
          }
        }
  });
  it("separates adjacent staggered dice lanes for every committed face pair", () => {
    for (const [size, gap] of [
      [44, 36],
      [48, 39],
      [58, 46],
    ]) {
      for (let a = 1; a <= 6; a++)
        for (let b = 1; b <= 6; b++)
          for (let i = 0; i < 2; i++)
            for (let k = 0; k <= 200; k++) {
              const t = k / 200,
                p = diePose((t - 0.06 - i * 0.07) / 0.74, a, i),
                q = diePose((t - 0.06 - (i + 1) * 0.07) / 0.74, b, i + 1);
              expect(
                size + gap + q.x - p.x - ((p.width + q.width) * size) / 2,
              ).toBeGreaterThan(0);
            }
    }
  });
  it("has continuous contacts, diminishing clearance rebounds and a quiet endpoint", () => {
    for (let f = 1; f <= 6; f++)
      for (const contact of DIE_CONTACTS) {
        const a = diePose(contact - 1e-7, f, 0),
          b = diePose(contact + 1e-7, f, 0);
        for (const field of [
          "x",
          "height",
          "rx",
          "ry",
          "rz",
          "support",
        ] as const)
          expect(Math.abs(a[field] - b[field])).toBeLessThan(0.01);
      }
    expect(diePose(0.445, 2, 0).height).toBeGreaterThan(
      diePose(0.71, 2, 0).height,
    );
    expect(diePose(0.99999, 2, 0).support).toBeCloseTo(1, 5);
  });
  it("exposes the committed face only after landing; all six standard pip faces remain present", () => {
    for (let f = 1; f <= 6; f++) {
      const early = renderToStaticMarkup(
        <PhysicalDie face={f} index={0} t={0.2} has />,
      );
      expect(early).not.toContain("data-face=");
      expect(early).toContain('aria-label="Rolling die"');
      const end = renderToStaticMarkup(
        <PhysicalDie face={f} index={0} t={1} has />,
      );
      expect(end).toContain(`data-face="${f}"`);
      expect(end).toContain(`aria-label="Die ${f}"`);
      expect((end.match(/class="pip"/g) || []).length).toBe(21);
    }
  });
  it("orders staggered impacts and bounds original opt-in thud/rattle voices", () => {
    const cues = diceImpactCues(3, 2600);
    expect(cues.length).toBe(9);
    expect(cues.every((c, i) => !i || c.at > cues[i - 1].at)).toBe(true);
    const gains: number[] = [];
    for (const cue of ["dice_impact", "dice_tick", "dice_settle"] as const) {
      const notes = casinoSoundNotes(cue);
      gains.push(Math.max(...notes.map((n) => n.gain)));
      for (const n of notes) {
        expect(n.duration).toBeLessThanOrEqual(0.1);
        expect(n.gain).toBeLessThanOrEqual(0.03);
        expect(n.hz).toBeGreaterThan(0);
      }
    }
    expect(gains[0]).toBeGreaterThan(gains[1]);
    expect(gains[1]).toBeGreaterThan(gains[2]);
  });
});
