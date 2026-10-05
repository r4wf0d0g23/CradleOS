import { describe, expect, it } from "vitest";
import { iconApi } from "./iconApi";
const call = (path = "", init?: RequestInit) => iconApi(new Request(`https://cradleos.io/api/icons${path}`, init));

describe("public icon API", () => {
  it("searches by normalized partial name and supports the name alias", async () => {
    const a = await (await call("?q=%20d1%20%20FUEL%20")).json();
    const b = await (await call("?name=D1%20Fuel")).json();
    expect(a.data[0].typeId).toBe(88335); expect(a.data).toEqual(b.data);
    expect(a.data[0].imageUrl).toMatch(/^https:\/\/cradleos.io\/data\/icons-cycle7-3573151\/assets\/[a-f0-9]+\.png$/);
    expect((await (await call("?q=hydrocarbon")).json()).data.some((x: {typeId:number}) => x.typeId === 89258)).toBe(true);
    expect(a.build).toBe("3573151"); expect(a.schemaVersion).toBe(1);
  });
  it("retains duplicate names and supports exact numeric lookup", async () => {
    const search = await (await call("?q=reiver")).json();
    expect(search.data.map((x: {typeId:number}) => x.typeId)).toEqual(expect.arrayContaining([87848,97520]));
    const lookup = await (await call("/97520")).json();
    expect(lookup.data.typeId).toBe(97520); expect(lookup.data.source).toContain("34876_128.png");
  });
  it("paginates deterministically and searches named UI symbols separately", async () => {
    const a = await (await call("?limit=2")).json(); const b = await (await call("?limit=2&offset=2")).json();
    expect(a.total).toBe(566); expect(a.nextOffset).toBe(2); expect(b.offset).toBe(2);
    expect(a.data.map((x:{key:string})=>x.key)).not.toEqual(b.data.map((x:{key:string})=>x.key));
    const symbols = await (await call("?collection=ui&q=manufacturing")).json();
    expect(symbols.data.map((x:{key:string})=>x.key)).toContain("gameplay/manufacturing_32px");
    expect(symbols.data.every((x:{collection:string})=>x.collection === "ui")).toBe(true);
    const fullKey = await (await call("?collection=ui&q=gameplay%2Fmanufacturing_32px")).json();
    expect(fullKey.total).toBe(1); expect(fullKey.data[0].key).toBe("gameplay/manufacturing_32px");
    expect((await (await call("?collection=ui&q=manufacturing_32px")).json()).data.some((x:{key:string})=>x.key === "gameplay/manufacturing_32px")).toBe(true);
    expect((await (await call("?collection=all&limit=100")).json()).total).toBe(1381);
    expect((await (await call("?offset=10000")).json()).nextOffset).toBeNull();
    expect((await (await call("?q=notfoundzzzzz")).json()).data).toEqual([]);
  });
  it("does not fabricate missing icons or unknown IDs", async () => {
    const missing = await (await call("/84556")).json(); expect(missing.data.available).toBe(false); expect(missing.data.imageUrl).toBeNull();
    expect((await call("/84556/image")).status).toBe(404);
    expect((await call("/999999999")).status).toBe(404);
    expect((await (await call("?available=false")).json()).total).toBe(2);
    expect((await (await call("?available=true")).json()).total).toBe(564);
  });
  it("redirects known image IDs only to fixed local assets", async () => {
    const image = await call("/88335/image"); expect(image.status).toBe(302);
    expect(image.headers.get("Location")).toMatch(/^https:\/\/cradleos.io\/data\/icons-cycle7-3573151\/assets\/[a-f0-9]{64}\.png$/);
    for (const path of ["/oops", "/88335/image/evil", "/88335?url=https://evil.example"]) expect((await call(path)).status).toBeGreaterThanOrEqual(400);
  });
  it("rejects bad/oversized/duplicate parameters", async () => {
    for (const path of ["?limit=0","?limit=101","?limit=1.5","?offset=-1","?offset=9007199254740992","?collection=other","?available=yes","?q=a&q=b","?q=a&name=b","?oops=x","?q="+"a".repeat(129)]) {
      const r = await call(path); expect(r.status, path).toBe(400); expect(r.headers.get("Cache-Control")).toBe("no-store");
    }
  });
  it("supports external clients, HEAD, conditional GET and safe methods only", async () => {
    const get = await call("?q=fuel"); const etag = get.headers.get("ETag")!;
    expect(get.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const head = await call("?q=fuel", {method:"HEAD"});expect(await head.text()).toBe("");expect(head.headers.get("ETag")).toBe(etag);
    const hit = await call("?q=fuel", {headers:{"If-None-Match":`W/${etag}`}});expect(hit.status).toBe(304);expect(await hit.text()).toBe("");
    expect((await call("",{method:"OPTIONS"})).status).toBe(204);
    const post = await call("",{method:"POST"});expect(post.status).toBe(405);expect(post.headers.get("Allow")).toBe("GET, HEAD, OPTIONS");
  });
});
