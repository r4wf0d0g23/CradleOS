interface Env {
  ORIGINS_MEDIA_PROXY_TOKEN?: string;
}

const REQUEST_HEADERS = ["range", "if-range", "if-none-match"];
const RESPONSE_HEADERS = [
  "accept-ranges", "cache-control", "content-disposition", "content-length",
  "content-range", "content-type", "etag", "last-modified", "x-content-type-options",
];

const proxy = async (ctx: { env: Env; request: Request }): Promise<Response> => {
  if (!ctx.env.ORIGINS_MEDIA_PROXY_TOKEN) {
    return new Response("Media delivery is not configured", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const headers = new Headers();
  headers.set("authorization", `Bearer ${ctx.env.ORIGINS_MEDIA_PROXY_TOKEN}`);
  for (const name of REQUEST_HEADERS) {
    const value = ctx.request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const upstream = await fetch("https://keeper.reapers.shop/index/origins-media/chapter-2/video", {
    method: ctx.request.method,
    headers,
    redirect: "manual",
  });
  if ([301, 302, 303, 307, 308].includes(upstream.status)) {
    await upstream.body?.cancel();
    return new Response("Media upstream redirect refused", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
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
