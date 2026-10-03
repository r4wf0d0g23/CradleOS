import { test } from "node:test";
import assert from "node:assert/strict";
import { retireKeeper } from "./retired-keeper.mjs";

function run(path, method = "GET") {
  const result = { forwarded: false, headers: {} };
  const res = {
    setHeader(name, value) { result.headers[name] = value; },
    status(status) { result.status = status; return this; },
    json(body) { result.body = body; return this; },
    sendStatus(status) { result.status = status; return this; },
  };
  retireKeeper({ path, method }, res, () => { result.forwarded = true; });
  return result;
}

test("old clients cannot invoke any retired Keeper handlers", () => {
  for (const path of ["/keeper", "/keeper/submit", "/keeper/novelty-stats", "/KEEPER/OCR/", "/keeper/pilot-tier/wallet", "/v1/chat/completions", "/v1/feedback", "/v1/models", "/queue", "/rag/query", "/submissions/file"]) {
    for (const method of ["GET", "POST", "HEAD", "PUT", "DELETE"]) {
      const res = run(path, method);
      assert.equal(res.forwarded, false, path);
      assert.equal(res.status, 410, path);
      assert.equal(res.body.code, "KEEPER_RETIRED");
    }
  }
});

test("shared services and prefix-lookalikes remain accessible", () => {
  for (const path of ["/health", "/telemetry/verify", "/telemetry/combined", "/war/latest", "/images/origins.jpg", "/sui", "/sui-status", "/index/owned-objects", "/keeperboard", "/v10", "/ragtime"]) {
    assert.equal(run(path).forwarded, true, path);
  }
});

test("retired preflight stops before any legacy handler", () => {
  const res = run("/keeper/submit", "OPTIONS");
  assert.equal(res.status, 204);
  assert.equal(res.forwarded, false);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
});
