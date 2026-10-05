import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { iconAssetUrl, validateGameIcons, type GameIcons } from "./gameIcons";

const data = () => JSON.parse(readFileSync("public/data/icons-cycle7-3573151/manifest.json", "utf8")) as GameIcons;
describe("current-client icon identity and paths", () => {
  it("keeps current/old Reiver IDs separate, fuel mapping exact and missing native records explicit", () => {
    const pack = validateGameIcons(data());
    expect(pack.types[97520].source).not.toBe(pack.types[87848].source);
    expect(pack.types[87848].source).toContain("/26977_128.png");
    // These distinct graphic paths happen to ship byte-identical thumbnails.
    expect(pack.types[97520].asset).toBe(pack.types[87848].asset);
    expect(pack.types[97520].source).toContain("/34876_128.png");
    expect(pack.types[88335].source).toContain("keeppixel64/d1.png");
    expect(pack.types[84556].asset).toBeNull();
    expect(pack.counts.resolved).toBe(564);
  });
  it("rejects wrong-world and wrong-build packs", () => {
    for (const change of [{ world: "old" }, { build: "0" }, { cycle: 6 }]) expect(() => validateGameIcons({ ...data(), ...change })).toThrow();
  });
  it("rejects external/traversal paths and inconsistent coverage", () => {
    for (const asset of ["https://evil.test/a.png", "../assets/a.png", "/assets/a.png", "assets/a.png"]) {
      const pack = data(); pack.types[88335].asset = asset;
      expect(() => validateGameIcons(pack)).toThrow(); expect(iconAssetUrl(asset)).toBeNull();
    }
    const pack = data(); pack.counts.resolved--; expect(() => validateGameIcons(pack)).toThrow();
  });
  it("supports root and subpath deployments without modifying asset identity", () => {
    const asset = data().types[88335].asset!;
    expect(iconAssetUrl(asset, "/data/icons")).toBe(`/data/icons/${asset}`);
    expect(iconAssetUrl(asset, "/CradleOS/data/icons")).toBe(`/CradleOS/data/icons/${asset}`);
    expect(iconAssetUrl(null)).toBeNull();
  });
});
