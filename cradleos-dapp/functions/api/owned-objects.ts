// Cloudflare Pages Function — same-origin owned-objects API for the dApp.
//
// Serves cradleos.io/api/owned-objects (and /api/owned-count) by proxying to
// the CradleOS owned-objects index running on our private fullnode host
// (DGX1/DGX2). Same-origin as the dApp -> zero CORS / Private-Network-Access
// friction, which is the whole point of putting this on cradleos.io instead of
// a separate origin (keeper.reapers.shop).
//
// The index is the complete owned-objects index the snapshot-restored fullnode
// can't natively serve (suix_getOwnedObjects returns partial results for
// pre-snapshot objects). Backed by SQLite on the node, ~4ms, deterministic.
//
// Upstream: the index is reachable via the keeper tunnel's /index/* route,
// which currently terminates on the DGX host's :8004 character-index service.
// Overridable via the INDEX_UPSTREAM env binding on the Pages project.

interface Env {
  INDEX_UPSTREAM?: string; // e.g. "https://keeper.reapers.shop/index"
}

const DEFAULT_UPSTREAM = "https://keeper.reapers.shop/index";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const upstreamBase = (ctx.env.INDEX_UPSTREAM || DEFAULT_UPSTREAM).replace(/\/+$/, "");
  // Forward the query string verbatim to the index's /owned-objects endpoint.
  const target = `${upstreamBase}/owned-objects${url.search}`;
  try {
    const r = await fetch(target, {
      method: "GET",
      headers: { "Accept": "application/json" },
      // Short edge-side cache: owned-objects changes on structure txs; 5s keeps
      // it fresh while collapsing bursts of identical dashboard loads.
      cf: { cacheTtl: 5, cacheEverything: true },
    });
    const body = await r.text();
    return new Response(body, {
      status: r.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=5",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "index upstream unreachable", detail: String(err) }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
};
