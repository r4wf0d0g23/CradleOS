import http from "node:http";
import { timingSafeEqual } from "node:crypto";

const FORWARD_REQUEST_HEADERS = ["range", "if-range", "if-none-match"];
const FORWARD_RESPONSE_HEADERS = [
  "accept-ranges", "cache-control", "content-disposition", "content-length",
  "content-range", "content-type", "etag", "last-modified", "x-content-type-options",
];

function authorized(value, token) {
  const supplied = Buffer.from(String(value || ""));
  const expected = Buffer.from(`Bearer ${token}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function installOriginsMediaProxy(app, upstream = "http://127.0.0.1:8005/video", token = process.env.ORIGINS_MEDIA_PROXY_TOKEN, chapterTwoUpstream = "http://127.0.0.1:8006/video") {
  if (!token) throw new Error("ORIGINS_MEDIA_PROXY_TOKEN is required");
  const targets = new Map([
    ["/origins-media/chapter-1/video", new URL(upstream)],
    ["/origins-media/chapter-2/video", new URL(chapterTwoUpstream)],
  ]);
  const handler = (req, res) => {
    if (!authorized(req.headers.authorization, token)) return res.status(404).json({ error: "not found" });
    const target = targets.get(req.path);
    if (!target) return res.status(404).json({ error: "not found" });
    const headers = {};
    for (const name of FORWARD_REQUEST_HEADERS) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }
    const upstreamRequest = http.request(target, { method: req.method, headers }, (upstreamResponse) => {
      res.status(upstreamResponse.statusCode || 502);
      for (const name of FORWARD_RESPONSE_HEADERS) {
        const value = upstreamResponse.headers[name];
        if (value != null) res.set(name, String(value));
      }
      upstreamResponse.on("error", (error) => res.destroy(error));
      upstreamResponse.pipe(res);
    });
    upstreamRequest.setTimeout(10_000, () => upstreamRequest.destroy(new Error("origins media upstream timeout")));
    upstreamRequest.on("error", (error) => {
      if (!res.headersSent) res.status(502).json({ error: "origins media unavailable" });
      else res.destroy(error);
    });
    req.on("aborted", () => upstreamRequest.destroy());
    upstreamRequest.end();
  };
  app.get("/origins-media/chapter-1/video", handler);
  app.head("/origins-media/chapter-1/video", handler);
  app.get("/origins-media/chapter-2/video", handler);
  app.head("/origins-media/chapter-2/video", handler);
}
