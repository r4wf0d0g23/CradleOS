/** Presentation only: animate the committed bits, never generate a new outcome. */
export const PLINKO_ROWS = 12;
export const PLINKO_ENTRY_MS = 180;
export const PLINKO_HOP_MS = 170;
// Hold contact for roughly two display frames so a peg strike is visible.
export const PLINKO_CONTACT_MS = 32;
export const PLINKO_MOTION_MS = PLINKO_ENTRY_MS + PLINKO_ROWS * PLINKO_HOP_MS;
export const PLINKO_REVEAL_MS = PLINKO_MOTION_MS + 180;
export const PLINKO_BALL_RADIUS = 4;
export const PLINKO_PEG_RADIUS = 3;
export type Point = { x: number; y: number };
export type PlinkoRoute = {
  start: Point;
  contacts: Point[];
  pegs: Point[];
  controls: Point[];
  landing: Point;
  bucket: number;
  svg: string;
};
export const plinkoPeg = (row: number, column: number): Point => ({
  x: 150 - row * 9 + column * 18,
  y: 24 + row * 16,
});
export const plinkoBucketX = (bucket: number) => 42 + bucket * 18;
export function buildPlinkoRoute(bits: readonly number[]): PlinkoRoute {
  if (bits.length !== PLINKO_ROWS || bits.some((n) => n !== 0 && n !== 1))
    throw Error("Plinko needs twelve committed left/right steps.");
  let rights = 0;
  const pegs = bits.map((bit, row) => {
    const p = plinkoPeg(row, rights);
    rights += bit;
    return p;
  });
  const contacts = pegs.map((p) => ({
    x: p.x,
    y: p.y - PLINKO_PEG_RADIUS - PLINKO_BALL_RADIUS,
  }));
  const controls = contacts.map((p, row) => ({
    x: p.x + (bits[row] ? 9 : -9),
    y: p.y - 9,
  }));
  const start = { x: 150, y: 6 },
    landing = { x: plinkoBucketX(rights), y: 219 };
  const svg =
    `M${start.x},${start.y} L${contacts[0].x},${contacts[0].y} ` +
    contacts
      .map((_, i) => {
        const c = controls[i],
          end = contacts[i + 1] ?? landing;
        return `Q${c.x},${c.y} ${end.x},${end.y}`;
      })
      .join(" ");
  return { start, pegs, contacts, controls, landing, bucket: rights, svg };
}
export function samplePlinko(route: PlinkoRoute, elapsed: number): Point {
  const t = Math.max(0, Math.min(PLINKO_MOTION_MS, elapsed));
  if (t < PLINKO_ENTRY_MS) {
    const progress = (t / PLINKO_ENTRY_MS) ** 2;
    return {
      x: route.start.x,
      y: route.start.y + (route.contacts[0].y - route.start.y) * progress,
    };
  }
  if (t >= PLINKO_MOTION_MS) return route.landing;
  const hop = Math.floor((t - PLINKO_ENTRY_MS) / PLINKO_HOP_MS);
  const u = Math.max(
      0,
      (t - PLINKO_ENTRY_MS - hop * PLINKO_HOP_MS - PLINKO_CONTACT_MS) /
        (PLINKO_HOP_MS - PLINKO_CONTACT_MS),
    ),
    v = 1 - u;
  const a = route.contacts[hop],
    c = route.controls[hop],
    b = route.contacts[hop + 1] ?? route.landing;
  return {
    x: v * v * a.x + 2 * v * u * c.x + u * u * b.x,
    y: v * v * a.y + 2 * v * u * c.y + u * u * b.y,
  };
}
