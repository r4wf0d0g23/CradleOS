import { describe, it, expect } from "vitest";
import {
  parsePartnerSnapshot,
  assertFresh,
  snapshotCsv,
  DAY,
  MAX_AGE,
} from "./model";
import { TRACKED_CONTRACTS } from "./data";
const now = Date.parse("2026-10-29T15:00:00Z");
const source = () => ({
  schema_version: 2,
  metric: "verified_wallets",
  cycle: 7,
  chain_id: "4c78adac",
  window_days: 30,
  since: new Date(now - 30 * DAY).toISOString(),
  generated_at: new Date(now).toISOString(),
  wallet_mau: 13,
  wallet_dau: 3,
  onchain_mau: 7,
  combined_mau: 14,
  wallet_coverage_since: "2026-10-09T15:44:38.271Z",
  onchain_status: "current",
  onchain_indexed_at: new Date(now - 10000).toISOString(),
  packages: Object.keys(TRACKED_CONTRACTS),
});
describe("partner aggregate report boundaries", () => {
  it("retains verified union counts without adding overlapping populations", () => {
    expect(parsePartnerSnapshot(source(), now).counts).toEqual({
      verified_wallets_30d: 14,
      signed_in_wallets_30d: 13,
      onchain_wallets_30d: 7,
      signed_in_wallets_today_utc: 3,
    });
  });
  it("projects an allowlist and excludes upstream wallet/log/signature extras from JSON and CSV", () => {
    const s = parsePartnerSnapshot(
      {
        ...source(),
        addresses: ["PRIVATE_ADDRESS_SENTINEL"],
        signature: "SECRET_SIGNATURE_SENTINEL",
        ops: { hostname: "PRIVATE_HOST_SENTINEL" },
        note: "ARBITRARY_SOURCE_NOTE",
      },
      now,
    );
    for (const value of [JSON.stringify(s), snapshotCsv(s, now)])
      expect(value).not.toMatch(/SENTINEL|ARBITRARY_SOURCE_NOTE/);
  });
  it("rejects different cycle or chain", () => {
    for (const change of [{ cycle: 8 }, { chain_id: "wrong" }])
      expect(() =>
        parsePartnerSnapshot({ ...source(), ...change }, now),
      ).toThrow();
  });
  it("rejects missing, duplicate or unexpected contracts rather than silently changing attribution", () => {
    for (const packages of [
      [],
      Object.keys(TRACKED_CONTRACTS).slice(1),
      Array(5).fill(Object.keys(TRACKED_CONTRACTS)[0]),
      [...Object.keys(TRACKED_CONTRACTS), "0x123"],
    ])
      expect(() =>
        parsePartnerSnapshot({ ...source(), packages }, now),
      ).toThrow();
  });
  it("rejects a false rolling window and future coverage", () => {
    for (const change of [
      { since: new Date(now - 7 * DAY).toISOString() },
      { wallet_coverage_since: new Date(now + 1).toISOString() },
    ])
      expect(() =>
        parsePartnerSnapshot({ ...source(), ...change }, now),
      ).toThrow();
  });
  it("keeps unavailable chain/union unknown while retaining valid sign-in counts", () => {
    const s = parsePartnerSnapshot(
      {
        ...source(),
        onchain_status: "unavailable",
        onchain_mau: null,
        combined_mau: null,
        onchain_indexed_at: null,
      },
      now,
    );
    expect(s.counts.verified_wallets_30d).toBeNull();
    expect(s.counts.onchain_wallets_30d).toBeNull();
    expect(s.counts.signed_in_wallets_30d).toBe(13);
    expect(snapshotCsv(s, now)).toContain('"Unavailable"');
  });
  it("does not accept a stale source presenting a complete count", () => {
    expect(() =>
      parsePartnerSnapshot({ ...source(), onchain_status: "stale" }, now),
    ).toThrow();
    expect(() => parsePartnerSnapshot(source(), now + MAX_AGE + 1)).toThrow();
  });
  it("preserves genuine zero, not unknown", () => {
    const s = parsePartnerSnapshot(
      {
        ...source(),
        wallet_mau: 0,
        wallet_dau: 0,
        onchain_mau: 0,
        combined_mau: 0,
      },
      now,
    );
    expect(s.counts.verified_wallets_30d).toBe(0);
  });
  it("rechecks freshness at export even when timers were suspended", () => {
    const s = parsePartnerSnapshot(source(), now);
    expect(() => assertFresh(s, now + MAX_AGE + 1)).toThrow();
    expect(() => snapshotCsv(s, now + MAX_AGE + 1)).toThrow();
  });
  it("exports coverage, UTC day, scope and release evidence with CSV formula protection", () => {
    const s = parsePartnerSnapshot(source(), now);
    s.selected_releases[0].title = "=1+1";
    const csv = snapshotCsv(s, now);
    expect(csv).toContain('"\'=1+1"');
    expect(csv).toContain("2026-10-29T00:00:00.000Z");
    expect(csv).toContain("sign_in_coverage_since");
    expect(csv).toContain("Operator wallets are included.");
    expect(csv).toContain("https://github.com/r4wf0d0g23/CradleOS/commit/");
  });
});
it("expires current chain data at its own index freshness boundary", () => {
  const s = parsePartnerSnapshot(
    {
      ...source(),
      onchain_indexed_at: new Date(now - 25 * 60000 + 1000).toISOString(),
    },
    now,
  );
  expect(() => assertFresh(s, now + 1001)).toThrow();
});
it("expires today counts at UTC midnight and rejects future-day snapshots", () => {
  const at = Date.parse("2026-10-29T23:59:59Z");
  const raw = {
    ...source(),
    generated_at: new Date(at).toISOString(),
    since: new Date(at - 30 * DAY).toISOString(),
    onchain_indexed_at: new Date(at - 1000).toISOString(),
  };
  const s = parsePartnerSnapshot(raw, at);
  expect(() => snapshotCsv(s, at + 1000)).toThrow();
  expect(() =>
    parsePartnerSnapshot(
      {
        ...raw,
        generated_at: new Date(at + 1000).toISOString(),
        since: new Date(at + 1000 - 30 * DAY).toISOString(),
      },
      at,
    ),
  ).toThrow();
});
it("requires a string-or-null chain timestamp and rejects future stale timestamps", () => {
  for (const onchain_indexed_at of [1, {}, new Date(now + 1).toISOString()])
    expect(() =>
      parsePartnerSnapshot(
        {
          ...source(),
          onchain_status: "stale",
          onchain_mau: null,
          combined_mau: null,
          onchain_indexed_at,
        },
        now,
      ),
    ).toThrow();
});
it("normalizes dates before display or CSV date slicing", () => {
  const s = parsePartnerSnapshot(
    {
      ...source(),
      generated_at: new Date(now).toUTCString(),
      since: new Date(now - 30 * DAY).toUTCString(),
      onchain_indexed_at: new Date(now - 10000).toUTCString(),
    },
    now,
  );
  expect(s.generated_at).toBe("2026-10-29T15:00:00.000Z");
  expect(snapshotCsv(s, now)).toContain("2026-10-29T00:00:00.000Z");
});
