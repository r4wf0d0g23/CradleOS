/** Result-driven winch presentation. No randomness, money or session writes. */
export const SALVAGE_POCKETS = 54;
export const SALVAGE_STEP = 360 / SALVAGE_POCKETS;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const salvageRestAngle = (index: number) =>
  (((360 - index * SALVAGE_STEP) % 360) + 360) % 360;
/** Integrated speed: motor take-up, brief drive, then monotonic frictional coast. */
export function salvageTravel(t: number) {
  const p = clamp(t),
    a = 0.12,
    b = 0.2,
    coast = 0.8,
    takeup = (2 * a) / Math.PI,
    area = takeup + b - a + coast / 3;
  if (p === 1) return 1;
  if (p < a) return (takeup * (1 - Math.cos((Math.PI * p) / (2 * a)))) / area;
  if (p < b) return (takeup + p - a) / area;
  const u = (p - b) / coast;
  return (takeup + b - a + (coast * (1 - (1 - u) ** 3)) / 3) / area;
}
export function salvageMotion(index: number, previousIndex = 0) {
  const start = salvageRestAngle(previousIndex),
    target = salvageRestAngle(index),
    travel = 1440 + ((target - start + 360) % 360);
  const contactAngles: number[] = [];
  for (let k = Math.floor(start / SALVAGE_STEP - 0.5) + 1; ; k++) {
    const angle = (k + 0.5) * SALVAGE_STEP;
    if (angle >= start + travel) break;
    contactAngles.push(angle);
  }
  const contacts = contactAngles.map((angle) => {
    const fraction = (angle - start) / travel;
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 35; i++) {
      const mid = (lo + hi) / 2;
      if (salvageTravel(mid) < fraction) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  });
  return { start, travel, contacts };
}
export function salvagePointer(
  t: number,
  duration: number,
  contacts: number[],
) {
  let flex = 0;
  for (const contact of contacts) {
    const elapsed = (t - contact) * duration;
    if (elapsed >= 0 && elapsed < 260)
      flex -= 17 * Math.exp(-elapsed / 60) * Math.sin(elapsed / 24);
  }
  return Math.max(-23, Math.min(5, flex));
}
export function salvagePocket(angle: number) {
  return (
    ((Math.round(-angle / SALVAGE_STEP) % SALVAGE_POCKETS) + SALVAGE_POCKETS) %
    SALVAGE_POCKETS
  );
}
export const SALVAGE_PULL_PX = 28;
