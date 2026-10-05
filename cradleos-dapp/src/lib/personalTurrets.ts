import { Transaction } from "@mysten/sui/transactions";
import {
  deriveDynamicFieldID,
  normalizeStructTag,
  normalizeSuiAddress,
} from "@mysten/sui/utils";
import { CURRENT_WORLD } from "./cycle";
import { CYCLE_DEPLOYMENT } from "./cycleDeployment";
import {
  findCurrentCharacters,
  listOwnedCurrentObjects,
  queryChain,
} from "./currentWorldRead";
import {
  encodeTurretSettings,
  readTurretSettings,
  type TurretSettings,
} from "./turretSettings";

export const PERSONAL_TURRET_PACKAGE: string = CYCLE_DEPLOYMENT.packages.turret;
export const PERSONAL_TURRET_AUTH = `${PERSONAL_TURRET_PACKAGE}::turret::TurretAuth`;
const TURRET_TYPE = `${CURRENT_WORLD}::turret::Turret`;
export type OwnedTurret = {
  id: string;
  capId: string;
  characterId: string;
  name: string;
  typeId: number;
  online: boolean;
  frozen: boolean;
  extension: string | null;
  description: string;
  settings: TurretSettings | null;
  version: number;
};
type ObjectRow = {
  address: string;
  version: number;
  asMoveObject: {
    contents: { type: { repr: string }; json: Record<string, any> };
  } | null;
};
export function isOurTurretExtension(extension: string | null): boolean {
  if (!extension || !PERSONAL_TURRET_PACKAGE) return false;
  try {
    return (
      normalizeStructTag(extension) === normalizeStructTag(PERSONAL_TURRET_AUTH)
    );
  } catch {
    return false;
  }
}
function option(value: any): any {
  if (value == null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  if (value.vec) return value.vec[0] ?? null;
  return value;
}
async function objects(ids: string[]): Promise<Array<ObjectRow | null>> {
  if (!ids.length) return [];
  const query = ids
    .map(
      (_, i) =>
        `o${i}:object(address:$id${i}){address version asMoveObject{contents{type{repr} json}}}`,
    )
    .join(" ");
  const data = await queryChain<Record<string, ObjectRow | null>>(
    `query(${ids.map((_, i) => `$id${i}:SuiAddress!`).join(",")}){${query}}`,
    Object.fromEntries(ids.map((id, i) => [`id${i}`, id])),
  );
  return ids.map((_, i) => {
    if (!("o" + i in data))
      throw new Error("Turret lookup incomplete. Refresh to retry.");
    return data["o" + i];
  });
}
export async function fetchPersonalTurrets(
  wallet: string,
): Promise<OwnedTurret[]> {
  // Same live-Character selection as Structures. Never use a dev/view-as account.
  const characters = await findCurrentCharacters(wallet);
  if (!characters.length) return [];
  const characterId = characters[0].characterId;
  const [character] = await objects([characterId]);
  const cf = character?.asMoveObject?.contents;
  if (
    cf?.type.repr !== `${CURRENT_WORLD}::character::Character` ||
    normalizeSuiAddress(String(cf.json.character_address)) !==
      normalizeSuiAddress(wallet)
  )
    throw new Error("Character ownership changed. Refresh before editing.");
  const caps = await listOwnedCurrentObjects(
    characterId,
    `${CURRENT_WORLD}::access::OwnerCap<${TURRET_TYPE}>`,
  );
  const out: OwnedTurret[] = [];
  // A failed page/read throws; do not silently present a partial owned fleet.
  for (let start = 0; start < caps.length; start += 10) {
    const batch = caps.slice(start, start + 10);
    const ids = batch.map((c) =>
      String(c.asMoveObject?.contents.json.authorized_object_id ?? ""),
    );
    if (ids.some((id) => !/^0x[\da-f]{64}$/i.test(id)))
      throw new Error("Incomplete turret ownership record.");
    const freezeIds = ids.map((id) =>
      deriveDynamicFieldID(
        id,
        `${CURRENT_WORLD}::extension_freeze::ExtensionFrozenKey`,
        new Uint8Array([0]),
      ),
    );
    const rows = await objects([...ids, ...freezeIds]);
    for (let i = 0; i < batch.length; i++) {
      const row = rows[i];
      if (!row) continue; // Explicitly deleted structure, not transport failure.
      const content = row.asMoveObject?.contents;
      if (
        content?.type.repr !== TURRET_TYPE ||
        normalizeSuiAddress(content.json.owner_cap_id) !==
          normalizeSuiAddress(batch[i].address)
      )
        throw new Error("Turret ownership record changed. Refresh to retry.");
      const f = content.json;
      const meta = option(f.metadata);
      if (!meta || typeof meta.description !== "string")
        throw new Error("Turret metadata is unavailable. Refresh to retry.");
      const rawExtension = option(f.extension);
      if (rawExtension !== null && typeof rawExtension.name !== "string")
        throw new Error("Turret extension data is incomplete.");
      const extension = rawExtension?.name ?? null;
      if (extension !== null && typeof extension !== "string")
        throw new Error("Turret extension data is incomplete.");
      const status = f.status?.status;
      out.push({
        id: row.address,
        capId: batch[i].address,
        characterId,
        name:
          meta.name || `Turret ${f.key?.item_id ?? row.address.slice(0, 10)}`,
        typeId: Number(f.type_id),
        online:
          status === "ONLINE" ||
          status?.$kind === "ONLINE" ||
          status?.variant === "ONLINE" ||
          status?.["@variant"] === "ONLINE",
        frozen: rows[i + batch.length] !== null,
        extension: extension
          ? extension.startsWith("0x")
            ? extension
            : `0x${extension}`
          : null,
        description: meta.description,
        settings: readTurretSettings(meta.description),
        version: row.version,
      });
    }
  }
  return out;
}
export function buildPersonalTurretTransaction(
  wallet: string,
  turret: OwnedTurret,
  settings: TurretSettings | null,
  replaceExisting = false,
): Transaction {
  if (!PERSONAL_TURRET_PACKAGE)
    throw new Error("Personal turret controls are awaiting deployment.");
  const ours = isOurTurretExtension(turret.extension);
  if (turret.frozen && (!ours || settings === null))
    throw new Error("This turret's extension binding is frozen.");
  if (settings === null && !ours)
    throw new Error("Only CradleOS turret settings can be reset here.");
  if (settings !== null && turret.extension && !ours && !replaceExisting)
    throw new Error("Confirm replacing the existing extension first.");
  const tx = new Transaction();
  tx.setSender(wallet);
  const [cap, receipt] = tx.moveCall({
    target: `${CURRENT_WORLD}::character::borrow_owner_cap`,
    typeArguments: [TURRET_TYPE],
    arguments: [tx.object(turret.characterId), tx.object(turret.capId)],
  });
  tx.moveCall({
    target: `${PERSONAL_TURRET_PACKAGE}::turret::${settings ? "save_settings" : "restore_defaults"}`,
    arguments: settings
      ? [
          tx.object(turret.id),
          cap,
          tx.pure.vector("u8", encodeTurretSettings(settings)),
          tx.pure.bool(replaceExisting),
        ]
      : [tx.object(turret.id), cap],
  });
  tx.moveCall({
    target: `${CURRENT_WORLD}::character::return_owner_cap`,
    typeArguments: [TURRET_TYPE],
    arguments: [tx.object(turret.characterId), cap, receipt],
  });
  return tx;
}
