import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import { installOriginsMediaProxy } from "../origins-media-proxy.js";

test("chapter 2 is separately routed and retains auth, HEAD and conditional headers", async (context) => {
  let calls = 0;
  const upstream = http.createServer((request, response) => {
    calls += 1;
    assert.equal(request.url, "/second");
    assert.equal(request.headers["if-none-match"], '"second"');
    response.writeHead(304, { ETag: '"second"' });
    response.end();
  });
  const upstreamPort = await listen(upstream);
  context.after(() => upstream.close());
  const app = express();
  installOriginsMediaProxy(app, "http://127.0.0.1:1/first", "test-token", `http://127.0.0.1:${upstreamPort}/second`);
  const proxy = http.createServer(app);
  const proxyPort = await listen(proxy);
  context.after(() => proxy.close());
  const base = `http://127.0.0.1:${proxyPort}/origins-media`;
  for (const chapter of ["chapter-2", "chapter-3"]) {
    const response = await fetch(`${base}/${chapter}/video`);
    assert.equal(response.status, 404);
  }
  assert.equal(calls, 0);
  const response = await fetch(`${base}/chapter-2/video`, {
    method: "HEAD",
    headers: { Authorization: "Bearer test-token", "If-None-Match": '"second"' },
  });
  assert.equal(response.status, 304);
  assert.equal(response.headers.get("etag"), '"second"');
  assert.equal(await response.text(), "");
  assert.equal(calls, 1);
});

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

test("origins media proxy preserves range status and immutable evidence headers", async (t) => {
  const upstream = http.createServer((req, res) => {
    assert.equal(req.headers.range, "bytes=2-5");
    res.writeHead(206, {
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": "4",
      "Content-Range": "bytes 2-5/10",
      "Content-Type": "video/mp4",
      "ETag": '"sha256-test"',
    });
    res.end("2345");
  });
  const upstreamPort = await listen(upstream);
  t.after(() => upstream.close());

  const app = express();
  installOriginsMediaProxy(app, `http://127.0.0.1:${upstreamPort}/video`, "test-token");
  const proxy = http.createServer(app);
  const proxyPort = await listen(proxy);
  t.after(() => proxy.close());

  const hidden = await fetch(`http://127.0.0.1:${proxyPort}/origins-media/chapter-1/video`, { headers: { Range: "bytes=2-5" } });
  assert.equal(hidden.status, 404);
  const response = await fetch(`http://127.0.0.1:${proxyPort}/origins-media/chapter-1/video`, {
    headers: { Authorization: "Bearer test-token", Range: "bytes=2-5" },
  });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 2-5/10");
  assert.equal(response.headers.get("etag"), '"sha256-test"');
  assert.equal(await response.text(), "2345");
});
