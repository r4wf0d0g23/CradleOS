import { afterEach, expect, it, vi } from "vitest";
import { rpcGetObject, rpcMultiGetObjects } from "../lib";
afterEach(() => vi.unstubAllGlobals());
const reply = (body: unknown) => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
it("rejects the live RPC retirement response instead of returning deleted", async () => {
  reply({ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "JSON-RPC has been removed on Sui as of Sui v1.82" } });
  await expect(rpcGetObject("0x1")).rejects.toThrow(/unavailable/);
  reply({ error: { code: -32601 } });
  await expect(rpcMultiGetObjects(["0x1"])).rejects.toThrow(/unavailable/);
});
it("rejects absent, partial and reordered batch responses", async () => {
  for (const body of [{}, { result: [] }, { result: [{ data: { objectId: "0x2", content: { fields: {} } } }] }]) {
    reply(body); await expect(rpcMultiGetObjects(["0x1"])).rejects.toThrow(/unavailable/);
  }
});
it("preserves explicitly deleted object semantics", async () => {
  reply({ result: { error: { code: "deleted" } } });
  expect(await rpcGetObject("0x1")).toEqual({ _deleted: true });
  reply({ result: [{ error: { code: "notExists" } }] });
  expect((await rpcMultiGetObjects(["0x1"])).get("0x1")).toEqual({ _deleted: true });
});
