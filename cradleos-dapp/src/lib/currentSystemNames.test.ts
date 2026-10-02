import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const settings = vi.hoisted(() => ({ world: "stillness" }));
vi.mock("../constants", () => ({ get SERVER_ENV() { return settings.world; } }));
vi.mock("./dataClient", () => ({ getSolarSystem: vi.fn(() => { throw new Error("Retired API must not run"); }) }));
const snapshot = JSON.parse(readFileSync(new URL("../../public/data/system-names-stillness-cycle7-3573151.json", import.meta.url), "utf8"));
const response = (data: unknown = snapshot) => new Response(JSON.stringify(data));

beforeEach(() => { vi.resetModules(); settings.world = "stillness"; });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Current-client names without old-world map data", () => {
  it("resolves real current kill IDs with one fetch, without adding geography or enabling the map", async () => {
    const fetcher = vi.fn().mockImplementation(async () => response());
    vi.stubGlobal("fetch", fetcher);
    const legacy = vi.fn(() => { throw new Error("Do not read retired cache"); });
    vi.stubGlobal("sessionStorage", { getItem: legacy });
    const s = await import("./solarSystems");
    const names = await s.resolveSolarSystemsBatch([30020977, 30019815, 30019833, 30019815]);
    expect(names.get(30020977)).toEqual({ id: 30020977, name: "N.QZZ.YF1", constellationId: null, regionId: null, x: null, y: null, z: null });
    expect(names.get(30019815)?.name).toBe("OLF-FDK");
    expect(names.get(30019833)?.name).toBe("E2L-B4K");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toContain("system-names-stillness-cycle7-3573151.json");
    expect((await s.loadSolarSystemCatalog()).size).toBe(0);
    expect(legacy).not.toHaveBeenCalled();
    expect((await import("./dataClient")).getSolarSystem).not.toHaveBeenCalled();
  });

  it("leaves unknown IDs numeric and rejects invalid IDs without network access", async () => {
    const fetcher = vi.fn().mockImplementation(async () => response()); vi.stubGlobal("fetch", fetcher);
    const s = await import("./solarSystems");
    expect(await s.resolveSolarSystem(-1)).toBeNull();
    expect(await s.resolveSolarSystem(NaN)).toBeNull();
    expect(await s.resolveSolarSystem(1.5)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    expect(await s.resolveSolarSystemName(99999999)).toBe("System 99999999");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    { ...snapshot, cycle: 6 },
    { ...snapshot, worldPackage: "retired-world" },
    { ...snapshot, clientBuild: 3502403 },
    { ...snapshot, names: { "30019815": "30019815" }, count: 1 },
  ])("rejects wrong-world or placeholder data and retries after a failure", async (bad) => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    const fetcher = vi.fn().mockResolvedValueOnce(response(bad)).mockImplementation(async () => response());
    vi.stubGlobal("fetch", fetcher);
    const s = await import("./solarSystems");
    expect(await s.resolveSolarSystemName(30019815)).toBe("System 30019815");
    expect(await s.resolveSolarSystemName(30019815)).toBe("System 30019815");
    expect(fetcher).toHaveBeenCalledTimes(1);
    now.mockReturnValue(31_001);
    expect(await s.resolveSolarSystemName(30019815)).toBe("OLF-FDK");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not apply Stillness names to another server", async () => {
    settings.world = "utopia";
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const s = await import("./solarSystems");
    expect(await s.resolveSolarSystemName(30019815)).toBe("System 30019815");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
