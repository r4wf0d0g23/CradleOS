/** Presentation only. Inverse rigid-contact trajectories replay the twelve committed bits.
 * Gravity and passive normal restitution are fixed; only launch position and flight
 * times are fitted. This is not a new random draw or a ball-to-ball simulation. */
export const PLINKO_ROWS = 12;
export const PLINKO_GRAVITY = 1000;
export const PLINKO_RESTITUTION = 0.35;
export const PLINKO_FLOOR_RESTITUTION = 0.16;
export const PLINKO_BALL_RADIUS = 3;
export const PLINKO_PEG_RADIUS = 2;
export const PLINKO_LAUNCH_MS = 360;
export const PLINKO_COLLECTION_MS = 160;
// Exhaustively bounded over all 4096 paths, including dissipative tray rebounds.
export const PLINKO_MOTION_MS = 3600;
export const PLINKO_REVEAL_MS = PLINKO_MOTION_MS + 180;
export type Point = { x: number; y: number };
export type Flight = {
  start: Point;
  velocity: Point;
  at: number;
  duration: number;
};
export type Contact = {
  point: Point;
  peg: Point;
  at: number;
  incoming: Point;
  outgoing: Point;
  row: number;
};
export type PlinkoRoute = {
  start: Point;
  contacts: Contact[];
  pegs: Point[];
  flights: Flight[];
  landing: Point;
  bucket: number;
  floorAt: number;
  duration: number;
  svg: string;
};
export const plinkoPeg = (row: number, column: number): Point => ({
  x: 150 - row * 9 + column * 18,
  y: 24 + row * 16,
});
export const plinkoBucketX = (bucket: number) => 42 + bucket * 18;
const radius = PLINKO_BALL_RADIUS + PLINKO_PEG_RADIUS;

function geometry(z: number[], pegs: Point[], landing: Point) {
  const points = pegs.map((p, i) => ({
    x: p.x + radius * Math.sin(z[i]),
    y: p.y - radius * Math.cos(z[i]),
  }));
  const start = { x: points[0].x, y: 5 };
  const stops = [start, ...points, landing];
  const velocities = stops.slice(0, -1).map((p, i) => ({
    x: (stops[i + 1].x - p.x) / z[12 + i],
    y: (stops[i + 1].y - p.y) / z[12 + i] - (PLINKO_GRAVITY * z[12 + i]) / 2,
  }));
  return { points, start, stops, velocities };
}
function residual(z: number[], pegs: Point[], landing: Point) {
  const { velocities } = geometry(z, pegs, landing);
  const values: number[] = [];
  for (let i = 0; i < PLINKO_ROWS; i++) {
    const incoming = {
      x: velocities[i].x,
      y: velocities[i].y + PLINKO_GRAVITY * z[12 + i],
    };
    const nx = Math.sin(z[i]),
      ny = -Math.cos(z[i]);
    const impulse =
      (1 + PLINKO_RESTITUTION) * (incoming.x * nx + incoming.y * ny);
    values.push(
      (velocities[i + 1].x - incoming.x + impulse * nx) / 100,
      (velocities[i + 1].y - incoming.y + impulse * ny) / 100,
    );
  }
  values.push(velocities[0].y / 100); // release from rest; no hidden launch kick
  return values;
}
/** Pivoted Gaussian elimination, bounded 25-variable solve. */
function solve(matrix: number[][], values: number[]) {
  const a = matrix.map((row, i) => [...row, values[i]]),
    n = values.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-12)
      throw Error("Invalid Plinko contact geometry.");
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let row = col + 1; row < n; row++) {
      const factor = a[row][col] / a[col][col];
      for (let k = col; k <= n; k++) a[row][k] -= factor * a[col][k];
    }
  }
  const x = Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let v = a[row][n];
    for (let col = row + 1; col < n; col++) v -= a[row][col] * x[col];
    x[row] = v / a[row][row];
  }
  return x;
}
export function buildPlinkoRoute(bits: readonly number[]): PlinkoRoute {
  if (bits.length !== PLINKO_ROWS || bits.some((n) => n !== 0 && n !== 1))
    throw Error("Plinko needs twelve committed left/right steps.");
  let rights = 0;
  const pegs = bits.map((bit, row) => {
    const p = plinkoPeg(row, rights);
    rights += bit;
    return p;
  });
  const landing = { x: plinkoBucketX(rights), y: 219 };
  const scale = Math.sqrt(700 / PLINKO_GRAVITY);
  let z = [
    ...Array(12).fill(0),
    ...[0.2, 0.28, ...Array(10).fill(0.31), 0.36].map((t) => t * scale),
  ];
  let converged = false;
  for (let iteration = 0; iteration < 8; iteration++) {
    const f = residual(z, pegs, landing);
    if (Math.max(...f.map(Math.abs)) < 1e-9) {
      converged = true;
      break;
    }
    const columns = z.map((_, col) => {
      const next = [...z];
      next[col] += 1e-5;
      return residual(next, pegs, landing).map((v, row) => (v - f[row]) / 1e-5);
    });
    const delta = solve(
      f.map((_, row) => columns.map((col) => col[row])),
      f.map((v) => -v),
    );
    z = z.map((v, i) => v + delta[i]);
  }
  if (
    !converged ||
    z.some((v) => !Number.isFinite(v)) ||
    z.slice(12).some((t) => t <= 0)
  )
    throw Error("Plinko trajectory did not converge.");
  const { start, stops, velocities, points } = geometry(z, pegs, landing);
  let at = 0;
  const flights: Flight[] = velocities.map((velocity, i) => {
    const f = { start: stops[i], velocity, at, duration: z[12 + i] * 1000 };
    at += f.duration;
    return f;
  });
  const contacts = points.map((point, i) => ({
    point,
    peg: pegs[i],
    at: flights[i + 1].at,
    row: i,
    incoming: {
      x: velocities[i].x,
      y: velocities[i].y + PLINKO_GRAVITY * z[12 + i],
    },
    outgoing: velocities[i + 1],
  }));
  const floorAt = at;
  let vy =
    (velocities[12].y + PLINKO_GRAVITY * z[24]) * PLINKO_FLOOR_RESTITUTION;
  // Tray friction arrests the small lateral speed at contact (mu=.3 suffices).
  // Vertical impacts retain only 16% of speed; subpixel rebounds settle to rest.
  while (vy > 2) {
    const duration = ((2 * vy) / PLINKO_GRAVITY) * 1000;
    flights.push({ start: landing, velocity: { x: 0, y: -vy }, at, duration });
    at += duration;
    vy *= PLINKO_FLOOR_RESTITUTION;
  }
  if (at + PLINKO_COLLECTION_MS > PLINKO_MOTION_MS)
    throw Error("Plinko flight exceeded its reveal window.");
  const svg =
    `M${start.x},${start.y} ` +
    flights
      .map((f) => {
        const dt = f.duration / 1000;
        const end = flightPoint(f, f.duration);
        return `Q${f.start.x + (f.velocity.x * dt) / 2},${f.start.y + (f.velocity.y * dt) / 2} ${end.x},${end.y}`;
      })
      .join(" ");
  return {
    start,
    contacts,
    pegs,
    flights,
    landing,
    bucket: rights,
    floorAt,
    duration: at,
    svg,
  };
}
function flightPoint(f: Flight, elapsed: number): Point {
  const t = elapsed / 1000;
  return {
    x: f.start.x + f.velocity.x * t,
    y: f.start.y + f.velocity.y * t + 0.5 * PLINKO_GRAVITY * t * t,
  };
}
export function samplePlinko(route: PlinkoRoute, elapsed: number): Point {
  if (elapsed <= 0) return route.start;
  if (elapsed >= route.duration) return route.landing;
  const flight = route.flights.find((f) => elapsed < f.at + f.duration)!;
  return flightPoint(flight, elapsed - flight.at);
}
