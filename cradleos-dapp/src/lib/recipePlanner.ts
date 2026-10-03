import type { NativeRecipe, NativeSnapshot } from "./gameData";

export type RecipeData = Pick<NativeSnapshot, "types" | "recipes">;
export type RouteChoices = Record<number, number | "acquire">;
export type MaterialLine = { typeID: number; quantity: number };
export type Route = { typeID: number; recipeID: number | null; reason: "build" | "acquire" | "direct" | "external" | "choice" };
export type RecipeJob = {
  recipeID: number; runs: number; inputs: MaterialLine[];
  outputs: Array<MaterialLine & { allocated: number; surplus: number }>;
};
export type RecipePlan = {
  status: "ready" | "needs-routes" | "cycle";
  routes: Route[]; jobs: RecipeJob[]; required: Array<MaterialLine & { reason: Route["reason"] }>;
  requested: MaterialLine; cycleRecipes: number[];
};

export function producersFor(data: RecipeData): Map<number, NativeRecipe[]> {
  const result = new Map<number, NativeRecipe[]>();
  for (const r of data.recipes) for (const output of r.outputs) {
    result.set(output.typeID, [...(result.get(output.typeID) ?? []), r]);
  }
  for (const rows of result.values()) rows.sort((a, b) => a.id - b.id);
  return result;
}

function positive(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error("Quantities must be positive whole numbers within the safe calculation range.");
  return value;
}
function add(a: number, b: number): number {
  const value = a + b;
  if (!Number.isSafeInteger(value)) throw new Error("This plan is too large to calculate exactly. Reduce the requested quantity.");
  return value;
}
function multiply(a: number, b: number): number {
  positive(a); positive(b);
  const value = a * b;
  if (!Number.isSafeInteger(value)) throw new Error("This plan is too large to calculate exactly. Reduce the requested quantity.");
  return value;
}
function batches(need: number, output: number): number {
  positive(need); positive(output);
  return Number((BigInt(need) + BigInt(output) - 1n) / BigInt(output));
}

/** One graph node per chosen recipe, NOT per tree path or per output.
 * Aggregate all parent demand before rounding a shared job up to full batches.
 * Only demands assigned to that recipe receive its outputs; no global optimizer
 * or hidden recycling/by-product netting is implied.
 */
export function planRecipe(data: RecipeData, target: number, quantity: number, rootRecipeID: number,
  mode: "direct" | "chain", choices: RouteChoices = {}): RecipePlan {
  positive(quantity);
  if (!data.types[target]) throw new Error("Unknown product type.");
  const producers = producersFor(data);
  const byID = new Map(data.recipes.map(r => [r.id, r]));
  const root = byID.get(rootRecipeID);
  if (!root?.outputs.some(o => o.typeID === target)) throw new Error("Choose a recipe that produces this product.");
  if (mode === "direct") {
    const runs = batches(quantity, root.outputs.find(o => o.typeID === target)!.quantity);
    const inputs = root.inputs.map(x => ({ typeID: x.typeID, quantity: multiply(x.quantity, runs) }));
    const outputs = root.outputs.map(x => {
      const produced = multiply(x.quantity, runs);
      const allocated = x.typeID === target ? quantity : 0;
      return { typeID: x.typeID, quantity: produced, allocated, surplus: produced - allocated };
    });
    return { status: "ready", routes: [{ typeID: target, recipeID: rootRecipeID, reason: "build" }],
      jobs: [{ recipeID: rootRecipeID, runs, inputs, outputs }],
      required: inputs.map(x => ({ ...x, reason: "direct" })), requested: { typeID: target, quantity }, cycleRecipes: [] };
  }
  const routes = new Map<number, Route>();
  const graph = new Map<number, Set<number>>();

  function visit(typeID: number, isRoot = false): number | null {
    if (routes.has(typeID)) return routes.get(typeID)!.recipeID;
    if (!data.types[typeID]) throw new Error("A recipe refers to an unknown item.");
    const options = producers.get(typeID) ?? [];
    const chosen = isRoot ? rootRecipeID : choices[typeID];
    let recipeID: number | null = null;
    let reason: Route["reason"];
    if (chosen === "acquire") reason = "acquire";
    else if (chosen !== undefined) {
      if (!options.some(r => r.id === chosen)) throw new Error("A selected route no longer produces its assigned ingredient. Choose another route.");
      recipeID = chosen; reason = "build";
    } else if (options.length === 1) { recipeID = options[0].id; reason = "build"; }
    else reason = options.length ? "choice" : "external";
    routes.set(typeID, { typeID, recipeID, reason });
    if (recipeID !== null && !graph.has(recipeID)) {
      const deps = new Set<number>(); graph.set(recipeID, deps);
      const recipe = byID.get(recipeID)!;
      for (const line of [...recipe.inputs, ...recipe.outputs]) positive(line.quantity);
      for (const input of recipe.inputs) {
        const dependency = visit(input.typeID);
        if (dependency !== null) deps.add(dependency);
      }
    }
    return recipeID;
  }
  visit(target, true);
  const result: RecipePlan = { status: "ready", routes: [...routes.values()], jobs: [], required: [], requested: { typeID: target, quantity }, cycleRecipes: [] };
  const inbound = new Map([...graph.keys()].map(k => [k, 0]));
  for (const deps of graph.values()) for (const dep of deps) inbound.set(dep, inbound.get(dep)! + 1);
  const queue = [...inbound].filter(([, degree]) => degree === 0).map(([id]) => id);
  const order: number[] = [];
  for (let n = 0; n < queue.length; n++) {
    const id = queue[n]; order.push(id);
    for (const dep of graph.get(id)!) {
      inbound.set(dep, inbound.get(dep)! - 1);
      if (inbound.get(dep) === 0) queue.push(dep);
    }
  }
  if (order.length !== graph.size) {
    result.status = "cycle";
    result.cycleRecipes = [...inbound].filter(([, degree]) => degree > 0).map(([id]) => id);
    return result; // Never label incomplete/cyclic totals as raw-material needs.
  }
  const demand = new Map<number, number>([[target, quantity]]);
  for (const id of order) {
    const r = byID.get(id)!;
    const assigned = r.outputs.filter(o => routes.get(o.typeID)?.recipeID === id);
    const runs = Math.max(0, ...assigned.map(o => {
      const need = demand.get(o.typeID) ?? 0;
      return need ? batches(need, o.quantity) : 0;
    }));
    if (runs === 0) continue;
    const inputs = r.inputs.map(x => ({ typeID: x.typeID, quantity: multiply(x.quantity, runs) }));
    for (const x of inputs) demand.set(x.typeID, add(demand.get(x.typeID) ?? 0, x.quantity));
    const outputs = r.outputs.map(x => {
      const produced = multiply(x.quantity, runs);
      const allocated = routes.get(x.typeID)?.recipeID === id ? demand.get(x.typeID) ?? 0 : 0;
      if (allocated > produced) throw new Error("Inconsistent shared-recipe demand.");
      return { typeID: x.typeID, quantity: produced, allocated, surplus: produced - allocated };
    });
    result.jobs.push({ recipeID: id, runs, inputs, outputs });
  }
  result.jobs.reverse(); // Dependency-first build order; no inferred duration.
  result.required = result.routes.filter(r => r.recipeID === null && (demand.get(r.typeID) ?? 0) > 0)
    .map(r => ({ typeID: r.typeID, quantity: demand.get(r.typeID)!, reason: r.reason }))
    .sort((a, b) => data.types[a.typeID].name.localeCompare(data.types[b.typeID].name) || a.typeID - b.typeID);
  if (result.required.some(r => r.reason === "choice")) result.status = "needs-routes";
  return result;
}

export function materialListText(data: RecipeData, plan: RecipePlan): string {
  if (plan.status !== "ready") throw new Error("Resolve recipe choices and loops before copying the material list.");
  return ["CradleOS · Cycle 7 client recipe plan",
    `Target: ${plan.requested.quantity} × ${data.types[plan.requested.typeID].name} [type ${plan.requested.typeID}]`,
    "Materials to acquire (not an inventory shortfall):",
    ...plan.required.map(x => `${x.quantity} × ${data.types[x.typeID].name} [type ${x.typeID}]`),
    `Recipe batches: ${plan.jobs.map(j => `#${j.recipeID} × ${j.runs}`).join(", ")}`,
    "No facility eligibility, timing, inventory, or gameplay modifiers assumed."].join("\n");
}
