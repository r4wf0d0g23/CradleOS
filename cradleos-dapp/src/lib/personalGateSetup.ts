import { normalizeSuiAddress } from "@mysten/sui/utils";
import { CURRENT_WORLD } from "./cycle";
import { CYCLE_DEPLOYMENT } from "./cycleDeployment";
import { findCurrentCharacters, queryChain } from "./currentWorldRead";
type Page = {
  objects: {
    nodes: Row[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};
type Row = {
  address: string;
  version: number;
  asMoveObject: {
    contents: { type: { repr: string }; json: Record<string, any> };
  } | null;
};
/** Complete current-core scan. Missing/failed pages are not an empty setup. */
async function scan(type: string): Promise<Row[]> {
  const rows: Row[] = [];
  let after: string | null = null;
  const seen = new Set<string>();
  for (let page = 0; page < 200; page++) {
    const data: Page = await queryChain<Page>(
      `query($type:String!,$after:String){objects(filter:{type:$type},first:50,after:$after){nodes{address version asMoveObject{contents{type{repr} json}}}pageInfo{hasNextPage endCursor}}}`,
      { type, after },
    );
    if (!data.objects?.nodes || !data.objects.pageInfo)
      throw new Error("Gate setup lookup incomplete. Refresh to retry.");
    for (const row of data.objects.nodes) {
      if (row.asMoveObject?.contents.type.repr !== type)
        throw new Error("Unexpected gate setup object.");
      rows.push(row);
    }
    if (!data.objects.pageInfo.hasNextPage) return rows;
    const next: string | null = data.objects.pageInfo.endCursor;
    if (!next || seen.has(next))
      throw new Error("Gate setup pagination incomplete.");
    seen.add(next);
    after = next;
  }
  throw new Error(
    "Gate setup lookup limit reached. No setup transaction was prepared.",
  );
}
export async function fetchPersonalGateSetup(wallet: string) {
  const chars = await findCurrentCharacters(wallet);
  const cid = chars[0]?.characterId;
  if (!cid) throw new Error("No current character found for this wallet.");
  const { character } = await queryChain<{ character: Row | null }>(
    `query($id:SuiAddress!){character:object(address:$id){address version asMoveObject{contents{type{repr} json}}}}`,
    { id: cid },
  );
  const c = character?.asMoveObject?.contents;
  if (
    c?.type.repr !== `${CURRENT_WORLD}::character::Character` ||
    normalizeSuiAddress(c.json.character_address) !==
      normalizeSuiAddress(wallet)
  )
    throw new Error("Character ownership changed. Refresh.");
  const tribeId = Number(c.json.tribe_id);
  if (!Number.isInteger(tribeId) || tribeId < 1 || tribeId > 4294967295)
    throw new Error("Your current character tribe is not available.");
  const vaults = await scan(
    `${CYCLE_DEPLOYMENT.packages.core}::tribe_vault::TribeVault`,
  );
  const matches = vaults
    .filter((v) => {
      const f = v.asMoveObject!.contents.json;
      if (
        typeof f.founder !== "string" ||
        typeof f.coin_name !== "string" ||
        typeof f.coin_symbol !== "string"
      )
        throw new Error("Incomplete vault data.");
      return (
        normalizeSuiAddress(f.founder) === normalizeSuiAddress(wallet) &&
        f.coin_name === "" &&
        f.coin_symbol === ""
      );
    })
    .sort((a, b) => b.version - a.version);
  if (matches.length > 1)
    throw new Error(
      "Multiple personal gate setups found. Select a specific vault in Tribe Vault.",
    );
  const vault = matches[0] ?? null;
  if (!vault) return { tribeId, vault: null, policy: null };
  const policies = await scan(
    `${CYCLE_DEPLOYMENT.packages.core}::gate_policy::TribeGatePolicy`,
  );
  const matched = policies.filter((p) => {
    const f = p.asMoveObject!.contents.json;
    if (typeof f.vault_id !== "string")
      throw new Error("Incomplete policy data.");
    return (
      normalizeSuiAddress(f.vault_id) === normalizeSuiAddress(vault.address)
    );
  });
  if (matched.length > 1)
    throw new Error(
      "Multiple gate policies found for this vault. Select one in gate settings.",
    );
  const accessLevel = matched[0]
    ? Number(matched[0].asMoveObject!.contents.json.access_level)
    : 0;
  if (!Number.isInteger(accessLevel) || accessLevel < 0 || accessLevel > 3)
    throw new Error("Invalid gate access level.");
  return {
    tribeId,
    vault: { objectId: vault.address },
    policy: matched[0] ? { objectId: matched[0].address, accessLevel } : null,
  };
}
