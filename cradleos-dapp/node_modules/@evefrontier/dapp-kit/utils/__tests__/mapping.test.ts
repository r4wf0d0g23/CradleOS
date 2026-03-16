import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bcs } from "@mysten/sui/bcs";
import { deriveObjectID } from "@mysten/sui/utils";
import { parseStatus, getAssemblyType } from "../mapping";
import { Assemblies, State } from "../../types";
import { getObjectRegistryType } from "../constants";

// Mock env vars for testing
const TEST_EVE_WORLD_PACKAGE_ID =
  "0x2ff3e06b96eb830bdcffbc6cae9b8fe43f005c3b94cef05d9ec23057df16f107";

// Mock the GraphQL client (only for getObjectId/getRegistryAddress tests)
vi.mock("../../graphql/client", () => ({
  getSingletonObjectByType: vi.fn(),
}));

import { getSingletonObjectByType } from "../../graphql/client";

describe("mapping utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Stub environment variables for tests
    vi.stubEnv("VITE_EVE_WORLD_PACKAGE_ID", TEST_EVE_WORLD_PACKAGE_ID);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  // ============================================================================
  // parseStatus Tests
  // ============================================================================
  describe("parseStatus", () => {
    it("returns State.ONLINE for 'ONLINE' status", () => {
      expect(parseStatus("ONLINE")).toBe(State.ONLINE);
    });

    it("returns State.ONLINE for lowercase 'online' status", () => {
      expect(parseStatus("online")).toBe(State.ONLINE);
    });

    it("returns State.ANCHORED for 'OFFLINE' status", () => {
      expect(parseStatus("OFFLINE")).toBe(State.ANCHORED);
    });

    it("returns State.ANCHORED for 'ANCHORED' status", () => {
      expect(parseStatus("ANCHORED")).toBe(State.ANCHORED);
    });

    it("returns State.UNANCHORED for 'UNANCHORED' status", () => {
      expect(parseStatus("UNANCHORED")).toBe(State.UNANCHORED);
    });

    it("returns State.NULL for undefined status", () => {
      expect(parseStatus(undefined)).toBe(State.NULL);
    });

    it("returns State.NULL for empty string", () => {
      expect(parseStatus("")).toBe(State.NULL);
    });
  });

  // ============================================================================
  // getAssemblyType Tests
  // ============================================================================
  describe("getAssemblyType", () => {
    it("returns SmartStorageUnit for storage_unit type", () => {
      expect(
        getAssemblyType(
          `${TEST_EVE_WORLD_PACKAGE_ID}::storage_unit::StorageUnit<...>`,
        ),
      ).toBe(Assemblies.SmartStorageUnit);
    });

    it("returns SmartTurret for turret type", () => {
      expect(
        getAssemblyType(`${TEST_EVE_WORLD_PACKAGE_ID}::turret::Turret<...>`),
      ).toBe(Assemblies.SmartTurret);
    });

    it("returns SmartGate for gate type", () => {
      expect(
        getAssemblyType(`${TEST_EVE_WORLD_PACKAGE_ID}::gate::Gate<...>`),
      ).toBe(Assemblies.SmartGate);
    });

    it("returns NetworkNode for network_node type", () => {
      expect(
        getAssemblyType(
          `${TEST_EVE_WORLD_PACKAGE_ID}::network_node::NetworkNode<...>`,
        ),
      ).toBe(Assemblies.NetworkNode);
    });

    it("returns Assembly as default for unknown type", () => {
      expect(getAssemblyType("unknown::type::Unknown")).toBe(
        Assemblies.Assembly,
      );
    });

    it("handles type strings with different package IDs", () => {
      expect(
        getAssemblyType("0xabc123::storage_unit::StorageUnit<SomeType>"),
      ).toBe(Assemblies.SmartStorageUnit);
    });
  });

  // ============================================================================
  // getRegistryAddress Tests
  // ============================================================================
  describe("getRegistryAddress", () => {
    const mockAssemblyRegistryAddress =
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const mockCharacterRegistryAddress =
      "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321";

    beforeEach(() => {
      vi.resetModules();
    });

    it("fetches assembly registry address from GraphQL", async () => {
      vi.mocked(getSingletonObjectByType).mockResolvedValueOnce({
        data: {
          objects: {
            nodes: [{ address: mockAssemblyRegistryAddress }],
          },
        },
      });

      const { getRegistryAddress } = await import("../mapping");
      const address = await getRegistryAddress();

      expect(getSingletonObjectByType).toHaveBeenCalledWith(
        getObjectRegistryType(),
      );
      expect(address).toBe(mockAssemblyRegistryAddress);
    });

    it("fetches character registry address from GraphQL", async () => {
      vi.mocked(getSingletonObjectByType).mockResolvedValueOnce({
        data: {
          objects: {
            nodes: [{ address: mockCharacterRegistryAddress }],
          },
        },
      });

      const { getRegistryAddress } = await import("../mapping");
      const address = await getRegistryAddress();

      expect(getSingletonObjectByType).toHaveBeenCalledWith(
        getObjectRegistryType(),
      );
      expect(address).toBe(mockCharacterRegistryAddress);
    });

    it("caches assembly registry address after first fetch", async () => {
      vi.mocked(getSingletonObjectByType).mockResolvedValueOnce({
        data: {
          objects: {
            nodes: [{ address: mockAssemblyRegistryAddress }],
          },
        },
      });

      const { getRegistryAddress } = await import("../mapping");

      const address = await getRegistryAddress();

      expect(getSingletonObjectByType).toHaveBeenCalledTimes(1);
      expect(address).toBe(mockAssemblyRegistryAddress);
    });

    it("throws error when registry address is not found", async () => {
      vi.mocked(getSingletonObjectByType).mockResolvedValueOnce({
        data: {
          objects: {
            nodes: [],
          },
        },
      });

      const { getRegistryAddress } = await import("../mapping");

      await expect(getRegistryAddress()).rejects.toThrow(
        `ObjectRegistry not found for type: ${getObjectRegistryType()}`,
      );
    });

    it("throws error when GraphQL response has no data", async () => {
      vi.mocked(getSingletonObjectByType).mockResolvedValueOnce({
        data: undefined,
      });

      const { getRegistryAddress } = await import("../mapping");

      await expect(getRegistryAddress()).rejects.toThrow(
        `ObjectRegistry not found for type: ${getObjectRegistryType()}`,
      );
    });
  });

  // ============================================================================
  describe("deriveObjectID derivation", () => {
    const TenantItemIdBcs = bcs.struct("TenantItemId", {
      item_id: bcs.u64(),
      tenant: bcs.string(),
    });

    it("works with primitive string (from Sui docs)", () => {
      const result = deriveObjectID(
        "0xc0ffee",
        "0x1::string::String",
        bcs.String.serialize("foo").toBytes(),
      );

      expect(result).toBe(
        "0x699219f4a2b6cfb8640bb853fc4ab4f497da038ec0614bfa2835aa27993399db",
      );
    });

    it("works with primitive u8 (from Sui docs)", () => {
      const result = deriveObjectID(
        "0x2",
        "u8",
        bcs.u8().serialize(1).toBytes(),
      );

      expect(result).toBe(
        "0x4de7696edddfb592a8dc7c8b66053b1557eb4fa1a9194322562aabf3da9e9239",
      );
    });

    it("works with primitive u32 (from old Character contract)", () => {
      const result = deriveObjectID(
        "0xbe0c6bf206ff70ed30ef367dc46f8d47fa20263c3d3c04e0b08312b291a4755d",
        "u32",
        bcs.u32().serialize(1003).toBytes(),
      );

      expect(result).toBe(
        "0xba2beac06dfcebe1963dea11ad37b4b851dd8060b6510c57e160e84280ed8b4c",
      );
    });

    it("works with TenantItemId struct", () => {
      const key = TenantItemIdBcs.serialize({
        item_id: 204305,
        tenant: "yanns-macbook-pro.local",
      }).toBytes();

      const result = deriveObjectID(
        "0x72ad8a9f876b922fb244761da022b328a8d487708d821f4d991414f320749c41",
        "0xe938ed4a360f86554fda6f4493866b0732cdd996d80e1cee429ad35d0a03deee::game_id::TenantItemId",
        key,
      );

      expect(result).toBe(
        "0xac1edc9cd64eb00ee3f98a583d7f7c94a39493c984706e6b3afe2668c4c8fb4c",
      );
    });

    it("works with TenantItemId struct in test tenant (sample #1 from contracts)", () => {
      const key = TenantItemIdBcs.serialize({
        item_id: 691735,
        tenant: "test",
      }).toBytes();

      const result = deriveObjectID(
        "0x70c704eb8ee89c910a31ecf550a85514d5a4d3d2742cc2fbd5b2131c3513b79c",
        "0x8941524ae368d91a7f9ee95466d3e60b75ddc16de3c3b9233dc11f85ce86c258::game_id::TenantItemId",
        key,
      );

      expect(result).toBe(
        "0xccee853995609e171763798b6faaf635793a9a88d79211d6486bfdd268d3fd73",
      );
    });

    it("works with TenantItemId struct in test tenant (sample #2 from contracts)", () => {
      const key = TenantItemIdBcs.serialize({
        item_id: 625814,
        tenant: "test",
      }).toBytes();

      const result = deriveObjectID(
        "0x70c704eb8ee89c910a31ecf550a85514d5a4d3d2742cc2fbd5b2131c3513b79c",
        "0x8941524ae368d91a7f9ee95466d3e60b75ddc16de3c3b9233dc11f85ce86c258::game_id::TenantItemId",
        key,
      );

      expect(result).toBe(
        "0x4b63016cb24af75235f8ab7c43b9fdfa52bb87a0f99c8f6d3d58c228d6fdc4c5",
      );
    });

    it("works with new SSUID", () => {
      const key = TenantItemIdBcs.serialize({
        item_id: 1000000012533,
        tenant: "testevenet",
      }).toBytes();

      const result = deriveObjectID(
        "0x226c1a6e456f7438f4a2bc83808df75fb3e47fea4b11ef220f9a2df8fb91a97c",
        "0x2ff3e06b96eb830bdcffbc6cae9b8fe43f005c3b94cef05d9ec23057df16f107::in_game_id::TenantItemId",
        key,
      );

      expect(result).toBe(
        "0x4c2d7222607d8d46bb6fe03a58e4488a79b598a6c2931d87f933d86dc0557233",
      );
    });

    it("produces different results for different tenants", () => {
      const key1 = TenantItemIdBcs.serialize({
        item_id: 12345,
        tenant: "tenant1",
      }).toBytes();

      const key2 = TenantItemIdBcs.serialize({
        item_id: 12345,
        tenant: "tenant2",
      }).toBytes();

      const parentId =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const keyType = "0x1234::game_id::TenantItemId";

      const result1 = deriveObjectID(parentId, keyType, key1);
      const result2 = deriveObjectID(parentId, keyType, key2);

      expect(result1).not.toBe(result2);
    });

    it("produces different results for different parent IDs", () => {
      const key = TenantItemIdBcs.serialize({
        item_id: 12345,
        tenant: "test",
      }).toBytes();

      const keyType = "0x1234::game_id::TenantItemId";

      const result1 = deriveObjectID(
        "0x1111111111111111111111111111111111111111111111111111111111111111",
        keyType,
        key,
      );

      const result2 = deriveObjectID(
        "0x2222222222222222222222222222222222222222222222222222222222222222",
        keyType,
        key,
      );

      expect(result1).not.toBe(result2);
    });
  });

  // ============================================================================
  // getObjectId Tests (mocked)
  // ============================================================================
  describe("getObjectId", () => {
    const mockRegistryAddress =
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

    beforeEach(() => {
      vi.resetModules();

      vi.mocked(getSingletonObjectByType).mockResolvedValue({
        data: {
          objects: {
            nodes: [{ address: mockRegistryAddress }],
          },
        },
      });
    });

    it("fetches registry address and derives object ID", async () => {
      const { getObjectId } = await import("../mapping");
      const itemId = "12345";

      const objectId = await getObjectId(itemId, "testevenet");

      expect(getSingletonObjectByType).toHaveBeenCalledWith(
        getObjectRegistryType(),
      );
      expect(typeof objectId).toBe("string");
      expect(objectId.startsWith("0x")).toBe(true);
    });

    it("uses OBJECT registry type when specified", async () => {
      const { getObjectId } = await import("../mapping");

      await getObjectId("12345", "testevenet");

      expect(getSingletonObjectByType).toHaveBeenCalledWith(
        getObjectRegistryType(),
      );
    });

    it("uses default OBJECT registry type when not specified", async () => {
      const { getObjectId } = await import("../mapping");

      await getObjectId("12345", "testevenet");

      expect(getSingletonObjectByType).toHaveBeenCalledWith(
        getObjectRegistryType(),
      );
    });

    it("propagates errors when registry address not found", async () => {
      vi.mocked(getSingletonObjectByType).mockResolvedValueOnce({
        data: {
          objects: {
            nodes: [],
          },
        },
      });

      const { getObjectId } = await import("../mapping");

      await expect(getObjectId("12345", "testevenet")).rejects.toThrow(
        `ObjectRegistry not found for type: ${getObjectRegistryType()}`,
      );
    });

    it("caches registry address across multiple calls", async () => {
      const { getObjectId } = await import("../mapping");

      await getObjectId("12345", "testevenet");
      await getObjectId("67890", "testevenet");
      await getObjectId("11111", "testevenet");

      // Should only fetch registry once (cached)
      expect(getSingletonObjectByType).toHaveBeenCalledTimes(1);
    });
  });
});
