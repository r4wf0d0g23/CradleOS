// Cloudflare Pages Function — same-origin owned-objects count (diagnostics).
// Proxies cradleos.io/api/owned-count -> index /owned-count. See
// functions/api/owned-objects.ts for the rationale.

interface Env {
  INDEX_UPSTREAM?: string;
}

const DEFAULT_UPSTREAM = "https://keeper.reapers.shop/index";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const upstreamBase = (ctx.env.INDEX_UPSTREAM || DEFAULT_UPSTREAM).replace(/\/+$/, "");
  const target = `${upstreamBase}/owned-count${url.search}`;
  try {
    const r = await fetch(target, {
      method: "GET",
      headers: { "Accept": "application/json" },
      cf: { cacheTtl: 10, cacheEverything: true },
    });
    const body = await r.text();
    return new Response(body, {
      status: r.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=10" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "index upstream unreachable", detail: String(err) }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
};
