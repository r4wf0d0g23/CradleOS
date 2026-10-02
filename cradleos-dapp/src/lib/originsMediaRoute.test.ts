import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestGet, onRequestHead } from "../../functions/api/origins/chapter-2/video";

afterEach(() => vi.unstubAllGlobals());

describe("Chapter 2 Pages media route", () => {
  it("fails closed without media authorization", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const response = await onRequestGet({ env: {}, request: new Request("https://cradleos.io/api/origins/chapter-2/video") } as never);
    expect(response.status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("streams approved upstream bytes with ranges and no redirect credential leakage", async () => {
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.redirect).toBe("manual");
      expect(new Headers(init.headers).get("range")).toBe("bytes=0-3");
      expect(new Headers(init.headers).get("authorization")).toBe("Bearer synthetic-test-token");
      return new Response("film", { status: 206, headers: { "Content-Range": "bytes 0-3/49437043", ETag: '"approved"', "Content-Type": "video/mp4" } });
    });
    vi.stubGlobal("fetch", fetcher);
    const response = await onRequestGet({ env: { ORIGINS_MEDIA_PROXY_TOKEN: "synthetic-test-token" }, request: new Request("https://cradleos.io/api/origins/chapter-2/video", { headers: { Range: "bytes=0-3" } }) } as never);
    expect(fetcher.mock.calls[0][0]).toBe("https://keeper.reapers.shop/index/origins-media/chapter-2/video");
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 0-3/49437043");
    expect(response.headers.get("etag")).toBe('"approved"');
    expect(await response.text()).toBe("film");
  });
  it("keeps HEAD bodyless", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe("HEAD");
      return new Response(null, { headers: { "Content-Length": "49437043" } });
    }));
    const response = await onRequestHead({ env: { ORIGINS_MEDIA_PROXY_TOKEN: "synthetic-test-token" }, request: new Request("https://cradleos.io/api/origins/chapter-2/video", { method: "HEAD" }) } as never);
    expect(response.headers.get("content-length")).toBe("49437043");
    expect(await response.text()).toBe("");
  });
  it("rejects redirects without following them or leaking the location", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 302, headers: { Location: "https://not-authorized.invalid" } }));
    vi.stubGlobal("fetch", fetcher);
    const response = await onRequestGet({ env: { ORIGINS_MEDIA_PROXY_TOKEN: "synthetic-test-token" }, request: new Request("https://cradleos.io/api/origins/chapter-2/video") } as never);
    expect(response.status).toBe(502);
    expect(response.headers.has("location")).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
