import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GetCharacterAndOwnedObjectsResponse } from "../../graphql/types";
import {
  getCharacterOwnedObjectsJson,
  getCharacterOwnedObjects,
} from "../characterOwnedObjects";

vi.mock("../../graphql/client", () => ({
  getCharacterAndOwnedObjects: vi.fn(),
}));

import { getCharacterAndOwnedObjects } from "../../graphql/client";

/** Minimal owned object node shape (Gate/Assembly/Character/NetworkNode). */
function ownedObjectNode(json: Record<string, unknown>, typeRepr: string) {
  return {
    contents: {
      extract: {
        asAddress: {
          asObject: {
            asMoveObject: {
              contents: { type: { repr: typeRepr }, json },
            },
          },
        },
      },
    },
  };
}

/** Builds a valid GetCharacterAndOwnedObjectsResponse with the given owned-object json payloads. */
function buildResponse(
  ownedJsons: Record<string, unknown>[],
  typeRepr = "0x2::example::Object",
): GetCharacterAndOwnedObjectsResponse {
  const nodes = ownedJsons.map((json) => ownedObjectNode(json, typeRepr));
  return {
    address: {
      address: "0xwallet",
      objects: {
        nodes: [
          {
            contents: {
              extract: {
                asAddress: {
                  asObject: {
                    asMoveObject: {
                      contents: {
                        type: { repr: "0x2::character::Character" },
                        json: { id: "0xchar", metadata: {} },
                      },
                    },
                  },
                  objects: { nodes },
                },
              },
            },
          },
        ],
      },
    },
  };
}

describe("getCharacterOwnedObjectsJson", () => {
  it("returns undefined when data is undefined", () => {
    expect(getCharacterOwnedObjectsJson(undefined)).toBeUndefined();
  });

  it("returns undefined when data is null", () => {
    expect(getCharacterOwnedObjectsJson(null as unknown as undefined)).toBeUndefined();
  });

  it("returns undefined when address is missing", () => {
    expect(
      getCharacterOwnedObjectsJson(
        {} as unknown as GetCharacterAndOwnedObjectsResponse,
      ),
    ).toBeUndefined();
  });

  it("returns undefined when address.objects is missing", () => {
    expect(
      getCharacterOwnedObjectsJson({
        address: { address: "0x" },
      } as unknown as GetCharacterAndOwnedObjectsResponse),
    ).toBeUndefined();
  });

  it("returns undefined when address.objects.nodes is missing", () => {
    expect(
      getCharacterOwnedObjectsJson({
        address: { address: "0x", objects: {} },
      } as unknown as GetCharacterAndOwnedObjectsResponse),
    ).toBeUndefined();
  });

  it("returns undefined when address.objects.nodes is empty", () => {
    expect(
      getCharacterOwnedObjectsJson({
        address: { address: "0x", objects: { nodes: [] } },
      }),
    ).toBeUndefined();
  });

  it("returns undefined when first node has no contents.extract.asAddress.objects", () => {
    const data = {
      address: {
        address: "0x",
        objects: {
          nodes: [
            {
              contents: {
                extract: {
                  asAddress: {
                    /* objects missing – path ends here */
                  },
                },
              },
            },
          ],
        },
      },
    } as unknown as GetCharacterAndOwnedObjectsResponse;
    expect(getCharacterOwnedObjectsJson(data)).toBeUndefined();
  });

  it("returns undefined when objects.nodes is empty", () => {
    const data = buildResponse([]);
    expect(getCharacterOwnedObjectsJson(data)).toBeUndefined();
  });

  it("extracts json array from full deep GraphQL shape (single object)", () => {
    const json1 = { id: "0xobj1", type_id: "123", owner_cap_id: "0xcap" };
    const data = buildResponse([json1]);
    const result = getCharacterOwnedObjectsJson(data);
    expect(result).toEqual([json1]);
  });

  it("extracts json array from full deep GraphQL shape (multiple objects)", () => {
    const json1 = { id: "0xgate", type_id: "gate" };
    const json2 = { id: "0xasm", type_id: "assembly", metadata: {} };
    const json3 = { id: "0xchar", tribe_id: 17, character_address: "0xaddr" };
    const data = buildResponse([json1, json2, json3]);
    const result = getCharacterOwnedObjectsJson(data);
    expect(result).toEqual([json1, json2, json3]);
  });

  it("preserves exact json payloads (regression: deep path must match GraphQL shape)", () => {
    const nested = {
      id: "0xnode",
      fuel: { quantity: "100", is_burning: false },
      connected_assembly_ids: ["0xa", "0xb"],
    };
    const data = buildResponse([nested]);
    const result = getCharacterOwnedObjectsJson(data);
    expect(result).toHaveLength(1);
    expect(result![0]).toEqual(nested);
  });
});

describe("getCharacterOwnedObjects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns extracted json array when response has data with owned objects", async () => {
    const payloads = [
      { id: "0x1", type_id: "gate" },
      { id: "0x2", type_id: "assembly" },
    ];
    const responseData = buildResponse(payloads);
    vi.mocked(getCharacterAndOwnedObjects).mockResolvedValue({
      data: responseData,
    });

    const result = await getCharacterOwnedObjects("0xwallet");

    expect(getCharacterAndOwnedObjects).toHaveBeenCalledWith("0xwallet");
    expect(result).toEqual(payloads);
  });

  it("returns undefined when response.data is undefined", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(getCharacterAndOwnedObjects).mockResolvedValue({});

    const result = await getCharacterOwnedObjects("0xwallet");

    expect(result).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      "[Dapp] No data returned from getCharacterAndOwnedObjects",
    );
    warnSpy.mockRestore();
  });

  it("returns undefined when response.data has no owned objects (empty nodes)", async () => {
    const responseData = buildResponse([]);
    vi.mocked(getCharacterAndOwnedObjects).mockResolvedValue({
      data: responseData,
    });

    const result = await getCharacterOwnedObjects("0xwallet");

    expect(result).toBeUndefined();
  });

  it("returns undefined when response.data.address is missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(getCharacterAndOwnedObjects).mockResolvedValue({
      data: {} as GetCharacterAndOwnedObjectsResponse,
    });

    const result = await getCharacterOwnedObjects("0xwallet");

    expect(result).toBeUndefined();
    warnSpy.mockRestore();
  });
});
