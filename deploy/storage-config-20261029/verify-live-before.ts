import { writeFileSync } from "node:fs";
import {
  storageObject,
  storageFields,
  storageId,
} from "../../cradleos-dapp/src/lib/storageRead";
import {
  getPoliciesTableId,
  fetchPolicy,
} from "../../cradleos-dapp/src/lib/ssuAccess";
import { fetchSsuSnapshot } from "../../cradleos-dapp/src/lib/ssuSafety";
import { readSharedStorage } from "../../cradleos-dapp/src/lib/inventoryRead";
import { WORLD_PKG } from "../../cradleos-dapp/src/constants";
const table = await getPoliciesTableId();
if (!table) throw Error("Legacy registry unavailable");
const fields = await storageFields(table, "0x2::object::ID");
const old = [];
for (const f of fields) {
  const sid = storageId(f.fields.name),
    pid = storageId(f.fields.value);
  const [state, mode, descriptor] = await Promise.all([
    fetchSsuSnapshot(sid),
    fetchPolicy(pid, sid),
    readSharedStorage(sid),
  ]);
  old.push({
    ssuId: sid,
    policyId: pid,
    name: descriptor.structure.displayName,
    ownerCharacter: descriptor.operator.key,
    extension: state.extension,
    frozen: state.frozen,
    sharedStacks: state.slots
      .filter((s) => s.partition === "open")
      .flatMap((s) => s.items)
      .filter((i) => i.quantity > 0).length,
    personalStacks: state.slots
      .filter((s) => s.partition === "unknown")
      .flatMap((s) => s.items)
      .filter((i) => i.quantity > 0).length,
    mode,
  });
}
const target =
  "0x573d25ba9bafd0f01de44b81090a5ea2bfac42c6c07a84267a5b95b9e1be18c5";
const state = await fetchSsuSnapshot(target),
  descriptor = await readSharedStorage(target);
const character = await storageObject(descriptor.operator.key);
const result = {
  at: new Date().toISOString(),
  world: WORLD_PKG,
  legacyAdopters: old,
  target: {
    ssuId: target,
    name: descriptor.structure.displayName,
    characterId: descriptor.operator.key,
    wallet: character.fields.character_address,
    extension: state.extension,
    frozen: state.frozen,
    online: state.online,
    partitions: state.slots.map((s) => ({
      partition: s.partition,
      stacks: s.items.filter((i) => i.quantity > 0).length,
    })),
  },
  transactions: 0,
  legacyBindingsAndDiscoveryUnchanged: true,
};
writeFileSync(
  new URL("live-before.json", import.meta.url),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
