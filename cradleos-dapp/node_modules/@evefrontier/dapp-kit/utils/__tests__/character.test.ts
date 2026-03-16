import { describe, expect, it } from "vitest";
import { parseCharacterFromJson } from "../character";

describe("parseCharacterFromJson", () => {
  const validCharacterJson = {
    id: "0x65916b0c872aa5e29b0e9ec66a29fa18cd5f85b188d48914d4437d42abc4f800",
    character_address: "0x82da5c79037b5cb544ed89725f61a577d17c55a14941ea992a8d18cc476893d7",
    tribe_id: 17,
    key: { item_id: "12345", tenant: "default" },
    metadata: {
      name: "Test Character",
      description: "",
      url: "",
      assembly_id: "0xassembly",
    },
  };

  it("returns null when json is null", () => {
    expect(parseCharacterFromJson(null)).toBeNull();
  });

  it("returns null when json is undefined", () => {
    expect(parseCharacterFromJson(undefined)).toBeNull();
  });

  it("returns null when json is a string", () => {
    expect(parseCharacterFromJson("not an object")).toBeNull();
  });

  it("returns null when json is an array", () => {
    expect(parseCharacterFromJson([])).toBeNull();
  });

  it("returns CharacterInfo with all fields when given valid object", () => {
    const result = parseCharacterFromJson(validCharacterJson);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(validCharacterJson.id);
    expect(result!.address).toBe(validCharacterJson.character_address);
    expect(result!.name).toBe(validCharacterJson.metadata.name);
    expect(result!.tribeId).toBe(17);
    expect(result!.characterId).toBe(12345);
    expect(result!._raw).toBe(validCharacterJson);
  });

  it("parses tribe_id when it is a string", () => {
    const result = parseCharacterFromJson({
      ...validCharacterJson,
      tribe_id: "42",
    });
    expect(result).not.toBeNull();
    expect(result!.tribeId).toBe(42);
  });

  it("parses key.item_id when it is a string", () => {
    const result = parseCharacterFromJson({
      ...validCharacterJson,
      key: { item_id: "999", tenant: "x" },
    });
    expect(result).not.toBeNull();
    expect(result!.characterId).toBe(999);
  });

  it("returns 0 for tribeId when tribe_id is missing", () => {
    const { tribe_id: _, ...withoutTribe } = validCharacterJson;
    const result = parseCharacterFromJson(withoutTribe);
    expect(result).not.toBeNull();
    expect(result!.tribeId).toBe(0);
  });

  it("returns 0 for characterId when key is missing", () => {
    const { key: _, ...withoutKey } = validCharacterJson;
    const result = parseCharacterFromJson(withoutKey);
    expect(result).not.toBeNull();
    expect(result!.characterId).toBe(0);
  });

  it("returns empty string for name when metadata is not an object", () => {
    const result = parseCharacterFromJson({
      ...validCharacterJson,
      metadata: "invalid",
    });
    expect(result).not.toBeNull();
    expect(result!.name).toBe("");
  });

  it("returns empty string for name when metadata.name is missing", () => {
    const result = parseCharacterFromJson({
      ...validCharacterJson,
      metadata: { description: "", url: "", assembly_id: "0x" },
    });
    expect(result).not.toBeNull();
    expect(result!.name).toBe("");
  });

  it("returns empty strings for id and address when missing or wrong type", () => {
    const result = parseCharacterFromJson({
      tribe_id: 0,
      key: {},
      metadata: {},
    });
    expect(result).not.toBeNull();
    expect(result!.id).toBe("");
    expect(result!.address).toBe("");
    expect(result!.name).toBe("");
  });

  it("stores original json as _raw", () => {
    const input = { ...validCharacterJson };
    const result = parseCharacterFromJson(input);
    expect(result!._raw).toBe(input);
  });
});
