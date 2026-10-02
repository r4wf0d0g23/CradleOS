// Same-origin, non-listing film delivery surface for cradleos.io/origins.
// The immutable origin runs on DGX2 and is already behind the keeper tunnel;
// this Pages Function keeps the audience-facing URL inside cradleos.io and
// streams byte ranges without buffering the 301 MB film in Worker memory.

interface Env {
  ORIGINS_MEDIA_UPSTREAM?: string;
  ORIGINS_MEDIA_PROXY_TOKEN?: string;
}

const DEFAULT_UPSTREAM = "https://keeper.reapers.shop/index/origins-media/chapter-1/video";
const REQUEST_HEADERS = ["range", "if-range", "if-none-match"];
const RESPONSE_HEADERS = [
  "accept-ranges", "cache-control", "content-disposition", "content-length",
  "content-range", "content-type", "etag", "last-modified", "x-content-type-options",
];

const proxy: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.ORIGINS_MEDIA_PROXY_TOKEN) {
    return new Response(JSON.stringify({ error: "media delivery is not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  const headers = new Headers();
  headers.set("authorization", `Bearer ${ctx.env.ORIGINS_MEDIA_PROXY_TOKEN}`);
  for (const name of REQUEST_HEADERS) {
    const value = ctx.request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const upstream = await fetch(ctx.env.ORIGINS_MEDIA_UPSTREAM || DEFAULT_UPSTREAM, {
    method: ctx.request.method,
    headers,
  });
  const responseHeaders = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(ctx.request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
};

export const onRequestGet = proxy;
export const onRequestHead = proxy;
