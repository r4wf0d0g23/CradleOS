import { expect, it } from "vitest";
import {
  DEFAULT_TURRET_SETTINGS as defaults,
  encodeTurretSettings as encode,
  decodeTurretSettings as decode,
  readTurretSettings as read,
  parsePilotIds,
  TURRET_MARKER as marker,
} from "./turretSettings";
const hex = "02010203012c01000001ffffffff01070000000109000000",
  raw = hex.match(/../g)!.map((x) => parseInt(x, 16));
const fixture = {
  ...defaults,
  mode: 2,
  priority: 1,
  shipClass: 2,
  strictClass: true,
  friends: [300],
  hostiles: [4294967295],
  friendlyTribes: [7],
  hostileTribes: [9],
};
it("matches Move golden fixture with UTF-8 description", () => {
  expect(encode(fixture)).toEqual(raw);
  expect(decode(raw)).toEqual(fixture);
  expect(read(`café ⚓${marker}${hex}]`)).toEqual(fixture);
});
it("rejects every truncated wire and trailing bytes", () => {
  for (let i = 0; i < raw.length; i++)
    expect(decode(raw.slice(0, i))).toBeNull();
  expect(decode([...raw, 0])).toBeNull();
});
it.each([
  "",
  `${marker}]`,
  `${marker}0]`,
  `${marker}${hex.toUpperCase()}]`,
  `${marker}${hex}]tail`,
  `${marker.replace("v1", "v2")}${hex}]`,
  `${marker}zz]`,
])("holds for malformed suffix %s", (s) => expect(read(s)).toBeNull());
it("rejects invalid options, zero/duplicate/conflicting/oversized lists", () => {
  for (const bad of [
    { mode: 4 },
    { priority: 4 },
    { shipClass: 5 },
    { friends: [0] },
    { friends: [-1] },
    { friends: [4294967296] },
    { friends: [1, 1] },
    { friends: [1], hostiles: [1] },
    { friendlyTribes: [7], hostileTribes: [7] },
    { friends: Array.from({ length: 17 }, (_, i) => i + 1) },
  ])
    expect(() => encode({ ...defaults, ...bad })).toThrow();
  expect(decode([1, 0, 0, 4, 0, 0, 0, 0])).toBeNull();
});
it("accepts maximum wire and bounds description by UTF-8 bytes", () => {
  const s = {
    ...defaults,
    friends: Array.from({ length: 16 }, (_, i) => i + 1),
    hostiles: Array.from({ length: 16 }, (_, i) => i + 17),
    friendlyTribes: Array.from({ length: 16 }, (_, i) => i + 1),
    hostileTribes: Array.from({ length: 16 }, (_, i) => i + 17),
  };
  expect(encode(s).length).toBe(264);
  expect(decode(encode(s))).toEqual(s);
  expect(read("é".repeat(4096) + marker + hex + "]")).toBeNull();
});
it("accepts game IDs, not wallets or malformed text", () => {
  expect(parsePilotIds("300, 4294967295")).toEqual([300, 4294967295]);
  expect(parsePilotIds("")).toEqual([]);
  for (const s of ["0", "1,1", "-1", "1.5", "0xabcd", "3e2"])
    expect(() => parsePilotIds(s)).toThrow();
});
