import { describe, expect, it } from "vitest";
import native from "../../public/data/game-data-cycle7-3573151/native-v1.json";
import { materialListText, planRecipe, producersFor, type RecipeData } from "./recipePlanner";
import type { NativeRecipe } from "./gameData";

const recipe = (id: number, inputs: Array<[number, number]>, outputs: Array<[number, number]>): NativeRecipe => ({
  id, primaryTypeID: inputs[0][0], runTime: 14,
  inputs: inputs.map(([typeID, quantity]) => ({ typeID, quantity })),
  outputs: outputs.map(([typeID, quantity]) => ({ typeID, quantity })),
});
function fixture(recipes: NativeRecipe[]): RecipeData {
  const ids = new Set(recipes.flatMap(r => [...r.inputs, ...r.outputs].map(x => x.typeID)));
  return { recipes, types: Object.fromEntries([...ids].map(id => [id, {
    id, name: `Item ${id}`, apiPublished: true, clientRecord: true, clientName: null,
    group: null, category: null, graphicID: null, attributes: [],
  }])) };
}

describe("current recipe material planner", () => {
  it("rounds fuel into whole batches with correct surplus and alternate routes", () => {
    const residue = planRecipe(native, 88335, 76, 1627, "direct");
    expect(residue.jobs[0].runs).toBe(2);
    expect(residue.required).toMatchObject([{ typeID: 89258, quantity: 42 }]);
    expect(residue.jobs[0].outputs).toMatchObject([{ typeID: 88335, quantity: 150, allocated: 76, surplus: 74 }]);
    const water = planRecipe(native, 88335, 76, 1181, "direct");
    expect(water.required).toMatchObject([{ typeID: 78423, quantity: 416 }]);
    expect(planRecipe(native, 88335, 75, 1627, "direct").jobs[0].runs).toBe(1);
  });
  it("indexes all real outputs, not a refining recipe's primary input", () => {
    const r = native.recipes.find(x => x.id === 1200)!;
    expect(r.primaryTypeID).toBe(78449);
    const plan = planRecipe(native, 88782, 9, 1200, "direct");
    expect(plan.jobs[0].runs).toBe(2);
    expect(plan.required).toMatchObject([{ typeID: 78449, quantity: 200 }]);
    expect(plan.jobs[0].outputs).toEqual([
      { typeID: 88781, quantity: 2, allocated: 0, surplus: 2 },
      { typeID: 88782, quantity: 16, allocated: 9, surplus: 7 },
    ]);
  });
  it("does not silently select one of multiple component routes", () => {
    const pending = planRecipe(native, 88335, 76, 1627, "chain");
    expect(pending.status).toBe("needs-routes");
    expect(pending.required).toMatchObject([{ typeID: 89258, quantity: 42, reason: "choice" }]);
    expect(() => materialListText(native, pending)).toThrow(/Resolve/);
    const ready = planRecipe(native, 88335, 76, 1627, "chain", { 89258: "acquire" });
    expect(ready.status).toBe("ready");
    expect(materialListText(native, ready)).toContain("42 × Hydrocarbon Residue");
    expect(() => planRecipe(native, 88335, 76, 1627, "chain", { 89258: 1627 })).toThrow(/no longer produces/);
  });
  it("aggregates diamond-shaped demand before rounding a shared component", () => {
    const d = fixture([
      recipe(1, [[2, 1], [3, 1]], [[1, 1]]),
      recipe(2, [[4, 3]], [[2, 1]]), recipe(3, [[4, 3]], [[3, 1]]),
      recipe(4, [[5, 10]], [[4, 4]]),
    ]);
    const p = planRecipe(d, 1, 1, 1, "chain");
    expect(p.status).toBe("ready");
    expect(p.jobs.find(j => j.recipeID === 4)?.runs).toBe(2);
    expect(p.required).toMatchObject([{ typeID: 5, quantity: 20 }]);
    expect(p.jobs[p.jobs.length - 1]?.recipeID).toBe(1);
  });
  it("shares multi-output batches across different parent branches", () => {
    const d = fixture([
      recipe(1, [[2, 1], [3, 1]], [[1, 1]]),
      recipe(2, [[4, 6]], [[2, 1]]), recipe(3, [[5, 8]], [[3, 1]]),
      recipe(4, [[6, 10]], [[4, 4], [5, 3]]),
    ]);
    const p = planRecipe(d, 1, 1, 1, "chain");
    const job = p.jobs.find(j => j.recipeID === 4)!;
    expect(job.runs).toBe(3); // max(ceil(6/4), ceil(8/3)), NOT 2+3
    expect(p.jobs.filter(j => j.recipeID === 4)).toHaveLength(1);
    expect(p.required).toMatchObject([{ typeID: 6, quantity: 30 }]);
    expect(job.outputs).toEqual([
      { typeID: 4, quantity: 12, allocated: 6, surplus: 6 },
      { typeID: 5, quantity: 9, allocated: 8, surplus: 1 },
    ]);
  });
  it("does not implicitly credit by-products assigned to another route", () => {
    const d = fixture([recipe(1, [[2, 1], [3, 1]], [[1, 1]]),
      recipe(2, [[4, 1]], [[2, 1], [3, 1]]), recipe(3, [[5, 1]], [[3, 1]])]);
    const p = planRecipe(d, 1, 1, 1, "chain", { 3: 3 });
    expect(p.required).toMatchObject([{ typeID: 4, quantity: 1 }, { typeID: 5, quantity: 1 }]);
    expect(p.jobs.find(j => j.recipeID === 2)?.outputs.find(x => x.typeID === 3)?.surplus).toBe(1);
  });
  it("detects recycling loops and allows explicit acquisition to break them", () => {
    const d = fixture([recipe(1, [[2, 1]], [[1, 1]]), recipe(2, [[1, 1]], [[2, 1]])]);
    const loop = planRecipe(d, 1, 1, 1, "chain");
    expect(loop.status).toBe("cycle"); expect(loop.jobs).toEqual([]); expect(loop.required).toEqual([]);
    expect(() => materialListText(d, loop)).toThrow();
    const fixed = planRecipe(d, 1, 1, 1, "chain", { 2: "acquire" });
    expect(fixed.status).toBe("ready"); expect(fixed.required[0].quantity).toBe(1);
  });
  it("direct mode can require a starter input without netting it against output", () => {
    const d = fixture([recipe(1, [[1, 2]], [[1, 3]])]);
    const p = planRecipe(d, 1, 5, 1, "direct");
    expect(p.required[0].quantity).toBe(4); expect(p.jobs[0].outputs[0].quantity).toBe(6);
    expect(planRecipe(d, 1, 5, 1, "chain").status).toBe("cycle");
  });
  it("rejects fractional, unsafe or overflowing quantities", () => {
    for (const n of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => planRecipe(native, 88335, n, 1627, "direct")).toThrow();
    }
    const d = fixture([recipe(1, [[2, Number.MAX_SAFE_INTEGER]], [[1, 1]])]);
    expect(() => planRecipe(d, 1, 2, 1, "direct")).toThrow(/too large/);
  });
  it("uses exact ceiling division at the safe-integer boundary", () => {
    const d = fixture([recipe(1, [[2, 1]], [[1, Number.MAX_SAFE_INTEGER]])]);
    expect(planRecipe(d, 1, Number.MAX_SAFE_INTEGER, 1, "direct").jobs[0].runs).toBe(1);
    expect(planRecipe(d, 1, Number.MAX_SAFE_INTEGER - 1, 1, "direct").jobs[0].outputs[0].surplus).toBe(1);
  });
  it("rejects a wrong product/recipe pairing, and accepts every current direct recipe output", () => {
    expect(() => planRecipe(native, 88335, 1, 1200, "direct")).toThrow(/produces/);
    expect(producersFor(native).size).toBe(263);
    for (const r of native.recipes) for (const o of r.outputs) {
      expect(planRecipe(native, o.typeID, 1, r.id, "direct").status).toBe("ready");
    }
  });
});
