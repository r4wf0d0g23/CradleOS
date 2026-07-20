// Cloudflare Pages Function — same-origin wallet -> live Character resolver.
//
// Serves cradleos.io/api/resolve-character by proxying to the CradleOS index's
// /resolve-character. Resolves a wallet to its LIVE Character (highest-version;
// older = destroyed/rerolled) entirely from the index, bypassing the flaky
// public RPC PlayerProfile query that returned NULL_RESULT and made the casino
// and other panels show "No live Character found". Same origin as the dApp ->
// zero CORS / Private-Network-Access friction. See functions/api/owned-objects.ts.

interface Env {
  INDEX_UPSTREAM?: string; // e.g. "https://keeper.reapers.shop/index"
}

const DEFAULT_UPSTREAM = "https://keeper.reapers.shop/index";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const upstreamBase = (ctx.env.INDEX_UPSTREAM || DEFAULT_UPSTREAM).replace(/\/+$/, "");
  const target = `${upstreamBase}/resolve-character${url.search}`;
  try {
    const r = await fetch(target, {
      method: "GET",
      headers: { "Accept": "application/json" },
      // Character identity changes rarely (only on reroll); 10s edge cache is
      // plenty and collapses repeated resolves across panels.
      cf: { cacheTtl: 10, cacheEverything: true },
    });
    const body = await r.text();
    return new Response(body, {
      status: r.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=10",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "index upstream unreachable", detail: String(err) }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
};
