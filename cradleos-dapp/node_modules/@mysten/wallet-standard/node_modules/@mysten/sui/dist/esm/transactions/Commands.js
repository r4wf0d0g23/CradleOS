import { toBase64 } from "@mysten/bcs";
import { parse } from "valibot";
import { normalizeSuiObjectId } from "../utils/sui-types.js";
import { ArgumentSchema } from "./data/internal.js";
var UpgradePolicy = /* @__PURE__ */ ((UpgradePolicy2) => {
  UpgradePolicy2[UpgradePolicy2["COMPATIBLE"] = 0] = "COMPATIBLE";
  UpgradePolicy2[UpgradePolicy2["ADDITIVE"] = 128] = "ADDITIVE";
  UpgradePolicy2[UpgradePolicy2["DEP_ONLY"] = 192] = "DEP_ONLY";
  return UpgradePolicy2;
})(UpgradePolicy || {});
const Commands = {
  MoveCall(input) {
    const [pkg, mod = "", fn = ""] = "target" in input ? input.target.split("::") : [input.package, input.module, input.function];
    return {
      $kind: "MoveCall",
      MoveCall: {
        package: pkg,
        module: mod,
        function: fn,
        typeArguments: input.typeArguments ?? [],
        arguments: input.arguments ?? []
      }
    };
  },
  TransferObjects(objects, address) {
    return {
      $kind: "TransferObjects",
      TransferObjects: {
        objects: objects.map((o) => parse(ArgumentSchema, o)),
        address: parse(ArgumentSchema, address)
      }
    };
  },
  SplitCoins(coin, amounts) {
    return {
      $kind: "SplitCoins",
      SplitCoins: {
        coin: parse(ArgumentSchema, coin),
        amounts: amounts.map((o) => parse(ArgumentSchema, o))
      }
    };
  },
  MergeCoins(destination, sources) {
    return {
      $kind: "MergeCoins",
      MergeCoins: {
        destination: parse(ArgumentSchema, destination),
        sources: sources.map((o) => parse(ArgumentSchema, o))
      }
    };
  },
  Publish({
    modules,
    dependencies
  }) {
    return {
      $kind: "Publish",
      Publish: {
        modules: modules.map(
          (module) => typeof module === "string" ? module : toBase64(new Uint8Array(module))
        ),
        dependencies: dependencies.map((dep) => normalizeSuiObjectId(dep))
      }
    };
  },
  Upgrade({
    modules,
    dependencies,
    package: packageId,
    ticket
  }) {
    return {
      $kind: "Upgrade",
      Upgrade: {
        modules: modules.map(
          (module) => typeof module === "string" ? module : toBase64(new Uint8Array(module))
        ),
        dependencies: dependencies.map((dep) => normalizeSuiObjectId(dep)),
        package: packageId,
        ticket: parse(ArgumentSchema, ticket)
      }
    };
  },
  MakeMoveVec({
    type,
    elements
  }) {
    return {
      $kind: "MakeMoveVec",
      MakeMoveVec: {
        type: type ?? null,
        elements: elements.map((o) => parse(ArgumentSchema, o))
      }
    };
  },
  Intent({
    name,
    inputs = {},
    data = {}
  }) {
    return {
      $kind: "$Intent",
      $Intent: {
        name,
        inputs: Object.fromEntries(
          Object.entries(inputs).map(([key, value]) => [
            key,
            Array.isArray(value) ? value.map((o) => parse(ArgumentSchema, o)) : parse(ArgumentSchema, value)
          ])
        ),
        data
      }
    };
  }
};
export {
  Commands,
  UpgradePolicy
};
//# sourceMappingURL=Commands.js.map
