import { describe, expect, it } from "vitest";
import { VerificationSession } from "./verificationSession";
describe("verification connection lifecycle", () => {
  it("deduplicates in-flight and automatic retries including StrictMode effect replay", () => {
    const s = new VerificationSession(); s.sync("A"); const a = s.begin(true)!;
    expect(s.begin(true)).toBeNull(); expect(s.begin(false)).toBeNull();
    s.finish(a); expect(s.begin(true)).toBeNull(); expect(s.begin(false)).not.toBeNull();
  });
  it("rejects A→B→A completions even though the address matches again", () => {
    const s = new VerificationSession(); s.sync("A"); const a = s.begin(true)!;
    s.sync("B"); const b = s.begin(true)!; s.sync("A"); const newer = s.begin(true)!;
    expect(s.current(a)).toBe(false); expect(s.current(b)).toBe(false); expect(s.current(newer)).toBe(true);
    s.finish(a); expect(s.begin(false)).toBeNull();
  });
  it("invalidates proof on disconnect and permits a fresh connection challenge", () => {
    const s = new VerificationSession(); s.sync("A"); const a = s.begin(true)!;
    s.sync(null); expect(s.current(a)).toBe(false); expect(s.begin(true)).toBeNull();
    s.sync("A"); expect(s.begin(true)).not.toEqual(a);
  });
});
