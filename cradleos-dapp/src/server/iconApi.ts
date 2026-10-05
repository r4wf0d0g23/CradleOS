/** Public read-only edge API. Compiled snapshot; no database, secrets or upstream. */
import pack from "../../public/data/icons-cycle7-3573151/manifest.json";

const ROOT = "/api/icons";
const PACK_PATH = `/data/icons-cycle7-${pack.build}`;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type, If-None-Match",
  "Access-Control-Expose-Headers": "ETag, Location, Cache-Control",
  "X-Content-Type-Options": "nosniff",
};
const META = { schemaVersion: 1, cycle: pack.cycle, cycleName: pack.name, server: pack.server, build: pack.build, world: pack.world };
type Collection = "items" | "ui" | "library";
type Row = { collection: Collection; key: string; name: string; typeId: number | null; asset: string | null;
  source: string | null; apiPublished: boolean | null; reason: string | null; search: string };
const normalize = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
const typeRows: Row[] = Object.entries(pack.types).map(([key, row]) => ({ collection: "items", key, typeId: Number(key),
  name: row.name, asset: row.asset, source: row.source, apiPublished: row.apiPublished,
  reason: "reason" in row ? row.reason : null, search: normalize(`${row.name} ${key}`) }));
const rows: Row[] = [...typeRows, ...(["ui", "library"] as const).flatMap(collection =>
  Object.entries(pack[collection]).map(([key, row]) => ({ collection, key, name: key.replace(/[\/_-]/g, " "),
    typeId: null, asset: row.asset, source: row.source, apiPublished: null, reason: null,
    search: normalize(`${key} ${key.replace(/[\/_-]/g, " ")}`) })))];
const byType = new Map(typeRows.map(row => [row.key, row]));

function entry(row: Row, origin: string) {
  return { collection: row.collection, key: row.key, typeId: row.typeId, name: row.name,
    available: row.asset !== null, imageUrl: row.asset ? `${origin}${PACK_PATH}/${row.asset}` : null,
    lookupUrl: row.typeId === null ? null : `${origin}${ROOT}/${row.key}`,
    imageEndpoint: row.typeId === null ? null : `${origin}${ROOT}/${row.key}/image`,
    source: row.source, apiPublished: row.apiPublished, unavailableReason: row.reason };
}
function failure(request: Request, status: number, code: string, message: string) {
  return new Response(request.method === "HEAD" ? null : JSON.stringify({ ...META, error: { code, message } }), {
    status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
      ...(status === 405 ? { Allow: "GET, HEAD, OPTIONS" } : {}) },
  });
}
async function json(request: Request, value: unknown): Promise<Response> {
  const body = JSON.stringify(value);
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const etag = `"${Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, "0")).join("")}"`;
  const headers = { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=3600", ETag: etag };
  const candidates = request.headers.get("If-None-Match")?.split(",").map(x => x.trim().replace(/^W\//, "")) ?? [];
  if (candidates.includes(etag) || candidates.includes("*")) return new Response(null, { status: 304, headers });
  return new Response(request.method === "HEAD" ? null : body, { headers });
}
function integer(text: string | null, fallback: number, min: number, max: number) {
  if (text === null) return fallback;
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) < min || Number(text) > max) throw new Error(`Expected a whole number between ${min} and ${max}.`);
  return Number(text);
}

export async function iconApi(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Max-Age": "86400", Allow: "GET, HEAD, OPTIONS" } });
  if (request.method !== "GET" && request.method !== "HEAD") return failure(request, 405, "method_not_allowed", "Use GET, HEAD or OPTIONS.");
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");
  if (path !== ROOT) {
    const match = path.match(/^\/api\/icons\/([1-9]\d*)(\/image)?$/);
    if (!match || !Number.isSafeInteger(Number(match[1]))) return failure(request, 404, "not_found", "No icon endpoint at this path.");
    if (url.search) return failure(request, 400, "invalid_query", "Type lookup and image endpoints do not accept query parameters.");
    const row = byType.get(match[1]);
    if (!row) return failure(request, 404, "type_not_found", "Type ID is not in this icon snapshot.");
    if (match[2]) {
      if (!row.asset) return failure(request, 404, "icon_unavailable", row.reason ?? "No verified icon for this type.");
      return new Response(null, { status: 302, headers: { ...CORS, Location: `${url.origin}${PACK_PATH}/${row.asset}`, "Cache-Control": "public, max-age=300" } });
    }
    return json(request, { ...META, data: entry(row, url.origin) });
  }
  try {
    const allowed = new Set(["q", "name", "collection", "available", "limit", "offset"]);
    for (const key of url.searchParams.keys()) if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) throw new Error(`Unknown or repeated parameter: ${key.slice(0, 50)}.`);
    if (url.searchParams.has("q") && url.searchParams.has("name")) throw new Error("Use q or name, not both.");
    const input = url.searchParams.get("q") ?? url.searchParams.get("name") ?? "";
    if (input.length > 128) throw new Error("Search text must be at most 128 characters.");
    const q = normalize(input);
    const collection = url.searchParams.get("collection") ?? "items";
    if (!["items", "ui", "library", "all"].includes(collection)) throw new Error("collection must be items, ui, library or all.");
    const available = url.searchParams.get("available");
    if (available !== null && available !== "true" && available !== "false") throw new Error("available must be true or false.");
    const limit = integer(url.searchParams.get("limit"), 25, 1, 100);
    const offset = integer(url.searchParams.get("offset"), 0, 0, 10000);
    const tokens = q.split(" ").filter(Boolean);
    const rank = (row: Row) => normalize(row.name) === q || row.key === q ? 0 : normalize(row.name).startsWith(q) ? 1 : 2;
    const matches = rows.filter(row => (collection === "all" || row.collection === collection) &&
      (available === null || (row.asset !== null) === (available === "true")) && tokens.every(t => row.search.includes(t)))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "en") || a.collection.localeCompare(b.collection) || a.key.localeCompare(b.key, "en", { numeric: true }));
    return json(request, { ...META, query: q, collection, total: matches.length, limit, offset,
      nextOffset: offset + limit < matches.length ? offset + limit : null,
      data: matches.slice(offset, offset + limit).map(row => entry(row, url.origin)),
      links: { documentation: `${url.origin}/data/icon-api.md`, openapi: `${url.origin}/data/icon-api-v1.json`,
        manifest: `${url.origin}${PACK_PATH}/manifest.json`, download: `${url.origin}${PACK_PATH}/cradleos-icons-cycle7-${pack.build}.zip` },
      scope: "available means icon image available, not gameplay availability. API and recipe-linked item references; UI/source-art presence does not establish active gameplay availability.",
      attribution: "EVE Frontier artwork © Fenris Creations Not relicensed by CradleOS." });
  } catch (error) {
    return failure(request, 400, "invalid_query", error instanceof Error ? error.message : "Invalid query.");
  }
}
