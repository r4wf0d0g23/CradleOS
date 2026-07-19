// Cloudflare Pages Function — same-origin owned-structures API for the dApp.
//
// Serves cradleos.io/api/owned-structures by proxying to the CradleOS
// owned-objects index. Returns a character's OwnerCaps joined to the full
// content of each controlled structure in ONE call — the robust structure
// discovery path that eliminates the per-structure RPC fan-out (the flaky step
// that dropped structures every refresh). Same origin as the dApp -> zero CORS
// / Private-Network-Access friction. See functions/api/owned-objects.ts.

interface Env {
  INDEX_UPSTREAM?: string; // e.g. "https://keeper.reapers.shop/index"
}

const DEFAULT_UPSTREAM = "https://keeper.reapers.shop/index";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const upstreamBase = (ctx.env.INDEX_UPSTREAM || DEFAULT_UPSTREAM).replace(/\/+$/, "");
  const target = `${upstreamBase}/owned-structures${url.search}`;
  try {
    const r = await fetch(target, {
      method: "GET",
      headers: { "Accept": "application/json" },
      // Short edge cache: structure state changes on txs; 5s collapses bursts
      // of identical dashboard loads while staying fresh.
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
