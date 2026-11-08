export const KEY = "frontier-arcade-v1";
export const IDS = [
  "salvage-swarm",
  "gatebreaker",
  "wreck-runner",
  "scrapline-defense",
  "voidhook",
  "dockyard-panic",
  "feral-circuit",
  "signal-diver",
];
const safe = (v, max) =>
  Number.isSafeInteger(v) && v >= 0 && v <= max ? v : 0;
export function sanitize(raw) {
  return {
    version: 1,
    best: safe(raw?.best, 100000000),
    wins: safe(raw?.wins, 1000000),
    plays: safe(raw?.plays, 1000000),
  };
}
export function load(storage, id) {
  if (!IDS.includes(id)) return sanitize(null);
  try {
    const raw = JSON.parse(storage.getItem(KEY + ":" + id));
    return sanitize(raw?.version === 1 ? raw : null);
  } catch {
    return sanitize(null);
  }
}
export function record(storage, id, score, won) {
  const r = load(storage, id);
  if (!IDS.includes(id) || !Number.isFinite(score))
    return { record: r, saved: false };
  r.best = Math.max(
    r.best,
    Math.min(100000000, Math.max(0, Math.floor(score))),
  );
  r.plays = Math.min(1000000, r.plays + 1);
  r.wins = Math.min(1000000, r.wins + (won ? 1 : 0));
  try {
    storage.setItem(KEY + ":" + id, JSON.stringify(r));
    return { record: r, saved: true };
  } catch {
    return { record: r, saved: false };
  }
}
export function sound(storage, value) {
  try {
    if (typeof value === "boolean")
      storage.setItem(KEY + ":sound", JSON.stringify(value));
    return storage.getItem(KEY + ":sound") !== "false";
  } catch {
    return true;
  }
}
