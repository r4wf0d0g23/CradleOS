/** Names only, extracted from the current Stillness client. This dictionary is
 * NOT a list of active/discovered systems and must not be used as a universe map.
 * Callers supply IDs from current-world records; unknowns remain numeric. */
import { SERVER_ENV } from "../constants";
import { CURRENT_WORLD } from "./cycle";

const CLIENT_BUILD = 3573151;
const SNAPSHOT = "system-names-stillness-cycle7-3573151.json";
const RETRY_MS = 30_000;
let cached: ReadonlyMap<number, string> | null = null;
let pending: Promise<ReadonlyMap<number, string>> | null = null;
let retryAfter = 0;

function parseNames(value: unknown): ReadonlyMap<number, string> {
  if (!value || typeof value !== "object") throw new Error("Invalid name snapshot");
  const data = value as Record<string, unknown>;
  if (data.cycle !== 7 || data.world !== "stillness" || data.worldPackage !== CURRENT_WORLD ||
      data.clientBuild !== CLIENT_BUILD || data.kind !== "client-localization-names-only" ||
      !data.names || typeof data.names !== "object" || Array.isArray(data.names)) {
    throw new Error("Name snapshot provenance mismatch");
  }
  const names = new Map<number, string>();
  for (const [key, name] of Object.entries(data.names)) {
    const id = Number(key);
    if (!/^[1-9]\d*$/.test(key) || !Number.isSafeInteger(id) || typeof name !== "string" ||
        name !== name.trim() || !name || name.length > 80 || /^\d+$/.test(name) ||
        name === `System ${id}` || /[\x00-\x1f\x7f]/.test(name)) {
      throw new Error("Malformed system name");
    }
    names.set(id, name);
  }
  if (data.count !== names.size || names.size === 0) throw new Error("Name count mismatch");
  return names;
}

async function loadNames(): Promise<ReadonlyMap<number, string>> {
  // No previous-cycle sessionStorage fallback; URL and provenance are cycle/build scoped.
  if (SERVER_ENV !== "stillness") return new Map();
  if (cached) return cached;
  if (pending) return pending;
  if (Date.now() < retryAfter) return new Map();
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  pending = Promise.resolve().then(async () => {
    try {
      const res = await fetch(`${base}/data/${SNAPSHOT}`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`Names HTTP ${res.status}`);
      cached = parseNames(await res.json());
      return cached;
    } catch {
      retryAfter = Date.now() + RETRY_MS;
      return new Map<number, string>();
    } finally {
      pending = null;
    }
  });
  return pending;
}

export async function resolveCurrentSystemName(id: number): Promise<string | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return (await loadNames()).get(id) ?? null;
}
