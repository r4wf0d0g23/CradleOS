import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const require = createRequire(
  new URL("../../cradleos-dapp/package.json", import.meta.url),
);
const { SuiGrpcClient } = require("@mysten/sui/grpc");
const d = JSON.parse(
  readFileSync(new URL("package-build.json", import.meta.url)),
);
const world = d.dependencies.find((p) => !/^0x0+[12]$/.test(p));
const c = new SuiGrpcClient({
  network: "testnet",
  baseUrl: "https://fullnode.testnet.sui.io:443",
});
const { response } = await c.ledgerService.getObject({
  objectId: world,
  readMask: { paths: ["object_id", "package"] },
});
assert.equal(response.object.objectId, world);
const hash = (b) => createHash("sha256").update(b).digest("hex");
const modules = [];
for (const m of response.object.package.modules) {
  const local = readFileSync(
    new URL(
      "../../cradleos_storage_access/build/cradleos_storage_access/bytecode_modules/dependencies/world/" +
        m.name +
        ".mv",
      import.meta.url,
    ),
  );
  const same = hash(local) === hash(m.contents);
  modules.push({
    name: m.name,
    local: hash(local),
    live: hash(m.contents),
    same,
  });
}
const result = {
  at: new Date().toISOString(),
  world,
  modules,
  exactMatch: modules.every((m) => m.same),
};
writeFileSync(
  new URL("world-dependency.json", import.meta.url),
  JSON.stringify(result, null, 2),
);
assert.ok(result.exactMatch);
console.log(
  JSON.stringify({ world, exactModules: modules.length, exactMatch: true }),
);
