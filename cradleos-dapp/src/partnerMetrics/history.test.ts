import { describe, it, expect } from "vitest";
import { CYCLES, parseHistory, freshHistory, historyCsv } from "./history";
const now = Date.parse("2026-10-29T15:00:00Z"),
  stamp = new Date(now).toISOString();
function fixture() {
  return {
    schema_version: 1,
    generated_at: stamp,
    website: {
      source: "Cloudflare Web Analytics",
      host: "cradleos.io",
      sampling: "adaptive",
      site_since: "2026-07-06T01:42:43.766Z",
      window_start: new Date(now - 30 * 86400000).toISOString(),
      window_end: stamp,
      collected_at: stamp,
      status: "current",
      page_views: 1540,
      visits: 1300,
    },
    cycles: CYCLES.map((c) => ({
      ...c,
      coverage: "partial",
      status: c.cycle === 7 ? "current" : "archive",
      archived_wallets: c.cycle === 7 ? null : 37,
      verified_sign_in_wallets: c.cycle === 7 ? 13 : null,
      recorded_chain_wallets: c.cycle === 7 ? 7 : null,
      verified_union_wallets: c.cycle === 7 ? 14 : null,
      first_observed: c.cycle === 7 ? "2026-10-02T00:00:00.000Z" : c.start,
      last_observed:
        c.cycle === 7 ? stamp : new Date(Date.parse(c.end!) - 1).toISOString(),
      sign_in_since: c.cycle === 7 ? "2026-10-09T15:44:38.271Z" : null,
      chain_indexed_at: c.cycle === 7 ? stamp : null,
      collected_at: stamp,
    })),
  };
}
describe("website and historical wallet reporting", () => {
  it("keeps website, archive, proofs and cycle counts distinct and strips all extra data", () => {
    const f = fixture() as any;
    f.addresses = ["SECRET"];
    f.website.token = "SECRET";
    f.cycles[0].addresses = ["SECRET"];
    const r = parseHistory(f, now);
    expect(r.website.visits).toBe(1300);
    expect(r.cycles[0].verified_sign_in_wallets).toBe(null);
    expect(r.cycles[2].verified_union_wallets).toBe(14);
    expect(JSON.stringify(r)).not.toContain("SECRET");
    expect(historyCsv(r, now)).not.toContain("SECRET");
  });
  it("preserves unavailable website without turning it into zero or hiding historical wallets", () => {
    const f = fixture() as any;
    f.website.status = "unavailable";
    f.website.visits = f.website.page_views = null;
    const r = parseHistory(f, now);
    expect(r.website.visits).toBe(null);
    expect(r.cycles[0].archived_wallets).toBe(37);
  });
  it("rejects wrong host, cycle boundaries and duplicate/missing cycles", () => {
    for (const mutate of [
      (f: any) => (f.website.host = "other.com"),
      (f: any) => (f.cycles[0].start = "2026-01-01T00:00:00.000Z"),
      (f: any) => f.cycles.pop(),
      (f: any) => (f.cycles[0] = f.cycles[1]),
    ]) {
      const f = fixture();
      mutate(f);
      expect(() => parseHistory(f, now)).toThrow();
    }
  });
  it("rejects malformed, future and stale source dates instead of refreshing them with a new envelope", () => {
    for (const mutate of [
      (f: any) => (f.website.collected_at = null),
      (f: any) => (f.website.collected_at = "2026-10-28T15:00:00Z"),
      (f: any) => (f.cycles[0].last_observed = "2027-01-01T00:00:00Z"),
    ]) {
      const f = fixture();
      mutate(f);
      expect(() => parseHistory(f, now)).toThrow();
    }
    expect(() => parseHistory(fixture(), now + 2 * 3600000 + 1)).toThrow();
    expect(() =>
      freshHistory(parseHistory(fixture(), now), now + 2 * 3600000 + 1),
    ).toThrow();
  });
  it("rejects impossible union and non-integer counts", () => {
    for (const mutate of [
      (f: any) => (f.cycles[2].verified_union_wallets = 25),
      (f: any) => (f.cycles[2].verified_union_wallets = 1),
      (f: any) => (f.website.visits = 1600),
      (f: any) => (f.cycles[0].archived_wallets = 1.2),
    ]) {
      const f = fixture();
      mutate(f);
      expect(() => parseHistory(f, now)).toThrow();
    }
  });
  it("marks aging chain index unavailable while retaining recorded lower-bound history", () => {
    const r = parseHistory(fixture(), now + 30 * 60000);
    expect(r.cycles[2].status).toBe("chain_unavailable");
    expect(r.cycles[2].recorded_chain_wallets).toBe(7);
  });
  it("exports observation ranges, partial coverage and separate verified sign-in start", () => {
    const csv = historyCsv(parseHistory(fixture(), now), now);
    expect(csv).toContain("observed_range");
    expect(csv).toContain("partial");
    expect(csv).toContain("sign_in_since");
    expect(csv).toContain("2026-10-09T15:44:38.271Z");
  });
});

it("initial chain outage preserves verified sign-ins without false zero chain counts", () => {
  const f = fixture();
  f.cycles[2].status = "chain_unavailable";
  f.cycles[2].recorded_chain_wallets = null;
  f.cycles[2].verified_union_wallets = null;
  f.cycles[2].chain_indexed_at = null;
  const c = parseHistory(f, now).cycles[2];
  expect(c.recorded_chain_wallets).toBe(null);
  expect(c.verified_union_wallets).toBe(null);
  expect(c.verified_sign_in_wallets).toBe(13);
});
