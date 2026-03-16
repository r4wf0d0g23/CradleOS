import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_EVE_WORLD_PACKAGE_ID =
  "0x2ff3e06b96eb830bdcffbc6cae9b8fe43f005c3b94cef05d9ec23057df16f107";

vi.mock("../../graphql/client", () => ({
  getSingletonConfigObjectByType: vi.fn(),
}));

import { getSingletonConfigObjectByType } from "../../graphql/client";
import {
  getEnergyConfig,
  getEnergyUsageForType,
  getFuelEfficiencyConfig,
  getFuelEfficiencyForType,
  resetConfigCachesForTesting,
} from "../config";
import { getEnergyConfigType, getFuelEfficiencyConfigType } from "../constants";

/** Builds the response shape that config reads: data.objects.nodes[0].asMoveObject.contents.extract...dynamicFields.nodes */
function mockConfigResponse(
  nodes: Array<{ key: { json: string }; value: { json: string } }>,
) {
  return {
    data: {
      objects: {
        nodes: [
          {
            address: "0xconfig",
            asMoveObject: {
              contents: {
                extract: {
                  extract: {
                    asAddress: {
                      addressAt: {
                        dynamicFields: {
                          pageInfo: { hasNextPage: false, endCursor: null },
                          nodes,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    },
  };
}

describe("config utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_EVE_WORLD_PACKAGE_ID", TEST_EVE_WORLD_PACKAGE_ID);
    resetConfigCachesForTesting();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ============================================================================
  // Parsing (via getEnergyConfig with mocked response)
  // ============================================================================
  describe("parsing", () => {
    it("returns empty object when nodes is undefined (e.g. missing path)", async () => {
      vi.mocked(getSingletonConfigObjectByType).mockResolvedValue({
        data: {
          objects: {
            nodes: [
              {
                address: "0xcfg",
                asMoveObject: {
                  contents: {
                    extract: {
                      extract: {
                        asAddress: {
                          addressAt: {
                            dynamicFields: { nodes: undefined },
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      } as unknown as Awaited<
        ReturnType<typeof getSingletonConfigObjectByType>
      >);

      const result = await getEnergyConfig();

      expect(result).toEqual({});
    });

    it("returns empty object when nodes is empty array", async () => {
      vi.mocked(getSingletonConfigObjectByType).mockResolvedValue(
        mockConfigResponse([]),
      );

      const result = await getEnergyConfig();

      expect(result).toEqual({});
    });

    it("parses valid key/value nodes into typeId -> value map", async () => {
      vi.mocked(getSingletonConfigObjectByType).mockResolvedValue(
        mockConfigResponse([
          { key: { json: "77917" }, value: { json: "500" } },
          { key: { json: "88067" }, value: { json: "100" } },
          { key: { json: "92279" }, value: { json: "10" } },
        ]),
      );

      const result = await getEnergyConfig();

      expect(result).toEqual({
        77917: 500,
        88067: 100,
        92279: 10,
      });
    });

    it("skips entries with invalid (non-numeric) key and continues parsing", async () => {
      vi.mocked(getSingletonConfigObjectByType).mockResolvedValue(
        mockConfigResponse([
          { key: { json: "77917" }, value: { json: "500" } },
          { key: { json: "not-a-number" }, value: { json: "99" } },
          { key: { json: "88067" }, value: { json: "100" } },
        ]),
      );

      const result = await getEnergyConfig();

      expect(result).toEqual({
        77917: 500,
        88067: 100,
      });
    });

    it("uses 0 for entries with invalid (non-numeric) value", async () => {
      vi.mocked(getSingletonConfigObjectByType).mockResolvedValue(
        mockConfigResponse([
          { key: { json: "77917" }, value: { json: "nope" } },
          { key: { json: "88067" }, value: { json: "100" } },
        ]),
      );

      const result = await getEnergyConfig();

      expect(result).toEqual({
        77917: 0,
        88067: 100,
      });
    });

    it("does not silently zero out known type IDs when data is present", async () => {
      vi.mocked(getSingletonConfigObjectByType).mockResolvedValue(
        mockConfigResponse([
          { key: { json: "77917" }, value: { json: "500" } },
          { key: { json: "88071" }, value: { json: "300" } },
        ]),
      );

      const config = await getEnergyConfig();
      const usage77917 = await getEnergyUsageForType(77917);
      const usage88071 = await getEnergyUsageForType(88071);
      const usageMissing = await getEnergyUsageForType(99999);

      expect(config[77917]).toBe(500);
      expect(config[88071]).toBe(300);
      expect(usage77917).toBe(500);
      expect(usage88071).toBe(300);
      expect(usageMissing).toBe(0);
    });
  });

  // ============================================================================
  // Caching
  // ============================================================================
  describe("caching", () => {
    it("calls GraphQL once and returns same reference on second getEnergyConfig()", async () => {
      const nodes = [{ key: { json: "77917" }, value: { json: "500" } }];
      vi.mocked(getSingletonConfigObjectByType).mockResolvedValue(
        mockConfigResponse(nodes),
      );

      const first = await getEnergyConfig();
      const second = await getEnergyConfig();

      expect(getSingletonConfigObjectByType).toHaveBeenCalledTimes(1);
      expect(getSingletonConfigObjectByType).toHaveBeenCalledWith(
        getEnergyConfigType(),
        "assembly_energy",
      );
      expect(first).toBe(second);
      expect(second).toEqual({ 77917: 500 });
    });

    it("calls GraphQL once for getFuelEfficiencyConfig and returns same reference on second call", async () => {
      const nodes = [{ key: { json: "12345" }, value: { json: "75" } }];
      vi.mocked(getSingletonConfigObjectByType).mockResolvedValue({
        data: {
          objects: {
            nodes: [
              {
                address: "0xfuel",
                asMoveObject: {
                  contents: {
                    extract: {
                      extract: {
                        asAddress: {
                          addressAt: {
                            dynamicFields: {
                              pageInfo: { hasNextPage: false },
                              nodes,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      } as Awaited<ReturnType<typeof getSingletonConfigObjectByType>>);

      const first = await getFuelEfficiencyConfig();
      const second = await getFuelEfficiencyConfig();

      expect(getSingletonConfigObjectByType).toHaveBeenCalledWith(
        getFuelEfficiencyConfigType(),
        "fuel_efficiency",
      );
      expect(first).toBe(second);
      expect(second).toEqual({ 12345: 75 });
    });
  });

  // ============================================================================
  // Concurrent-call deduplication
  // ============================================================================
  describe("concurrent-call deduplication", () => {
    it("performs a single fetch when getEnergyConfig() is invoked concurrently", async () => {
      type MockResponse = Awaited<
        ReturnType<typeof getSingletonConfigObjectByType>
      >;
      let resolveFetch: (v: MockResponse) => void;
      const fetchPromise = new Promise<MockResponse>((r) => {
        resolveFetch = r;
      });
      vi.mocked(getSingletonConfigObjectByType).mockReturnValue(fetchPromise);

      const concurrentCalls = [
        getEnergyConfig(),
        getEnergyConfig(),
        getEnergyConfig(),
        getEnergyConfig(),
        getEnergyConfig(),
      ];

      resolveFetch!(
        mockConfigResponse([
          { key: { json: "77917" }, value: { json: "500" } },
        ]),
      );

      const results = await Promise.all(concurrentCalls);

      expect(getSingletonConfigObjectByType).toHaveBeenCalledTimes(1);
      expect(results.every((r) => r === results[0])).toBe(true);
      expect(results[0]).toEqual({ 77917: 500 });
    });

    it("performs a single fetch when getFuelEfficiencyConfig() is invoked concurrently", async () => {
      type MockResponse = Awaited<
        ReturnType<typeof getSingletonConfigObjectByType>
      >;
      let resolveFetch: (v: MockResponse) => void;
      const fetchPromise = new Promise<MockResponse>((r) => {
        resolveFetch = r;
      });
      vi.mocked(getSingletonConfigObjectByType).mockReturnValue(fetchPromise);

      const concurrentCalls = [
        getFuelEfficiencyConfig(),
        getFuelEfficiencyConfig(),
        getFuelEfficiencyConfig(),
      ];

      resolveFetch!(
        mockConfigResponse([
          { key: { json: "88071" }, value: { json: "200" } },
        ]),
      );

      const results = await Promise.all(concurrentCalls);

      expect(getSingletonConfigObjectByType).toHaveBeenCalledTimes(1);
      expect(results.every((r) => r === results[0])).toBe(true);
      expect(results[0]).toEqual({ 88071: 200 });
    });
  });

  // ============================================================================
  // Pagination / first-page behavior
  // ============================================================================
  describe("pagination behavior", () => {
    it("parses first page of nodes and does not zero out returned entries", async () => {
      // Simulates response where dynamicFields has one page of nodes (hasNextPage may be true on backend)
      vi.mocked(getSingletonConfigObjectByType).mockResolvedValue(
        mockConfigResponse([
          { key: { json: "77917" }, value: { json: "500" } },
          { key: { json: "88067" }, value: { json: "100" } },
        ]),
      );

      const result = await getEnergyConfig();

      expect(result).toEqual({ 77917: 500, 88067: 100 });
      expect(result[77917]).toBe(500);
      expect(result[88067]).toBe(100);
    });

    it("returns empty object when first object has no nodes (missing path) without throwing", async () => {
      vi.mocked(getSingletonConfigObjectByType).mockResolvedValue({
        data: {
          objects: {
            nodes: [
              {
                address: "0xcfg",
                asMoveObject: {
                  contents: {
                    extract: undefined,
                  },
                },
              },
            ],
          },
        },
      } as unknown as Awaited<
        ReturnType<typeof getSingletonConfigObjectByType>
      >);

      const result = await getEnergyConfig();

      expect(result).toEqual({});
    });
  });

  // ============================================================================
  // getEnergyUsageForType / getFuelEfficiencyForType
  // ============================================================================
  describe("getEnergyUsageForType / getFuelEfficiencyForType", () => {
    it("getEnergyUsageForType returns 0 for typeId not in config", async () => {
      vi.mocked(getSingletonConfigObjectByType).mockResolvedValue(
        mockConfigResponse([
          { key: { json: "77917" }, value: { json: "500" } },
        ]),
      );

      const missing = await getEnergyUsageForType(99999);

      expect(missing).toBe(0);
    });

    it("getFuelEfficiencyForType returns cached value for typeId in config", async () => {
      vi.mocked(getSingletonConfigObjectByType)
        .mockResolvedValueOnce(
          mockConfigResponse([
            { key: { json: "77917" }, value: { json: "500" } },
          ]),
        )
        .mockResolvedValueOnce({
          data: {
            objects: {
              nodes: [
                {
                  address: "0xfuel",
                  asMoveObject: {
                    contents: {
                      extract: {
                        extract: {
                          asAddress: {
                            addressAt: {
                              dynamicFields: {
                                pageInfo: {
                                  hasNextPage: false,
                                  endCursor: null,
                                },
                                nodes: [
                                  {
                                    key: { json: "77917" },
                                    value: { json: "75" },
                                  },
                                ],
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        });

      const energy = await getEnergyUsageForType(77917);
      const fuelEff = await getFuelEfficiencyForType(77917);

      expect(energy).toBe(500);
      expect(fuelEff).toBe(75);
    });
  });
});
