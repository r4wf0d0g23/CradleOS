import { CURRENT_WORLD } from "./cycle";

export const PUBLIC_GRAPHQL = "https://graphql.testnet.sui.io/graphql";
type Node = { address: string; version: number; asMoveObject: { contents: { json: Record<string, any> } } | null };
type Page = { nodes: Node[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };

export async function queryChain<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(PUBLIC_GRAPHQL, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`Chain data unavailable (HTTP ${r.status}). Retry; this is not an empty holdings result.`);
  const j = await r.json();
  if (j.errors?.length || !j.data) throw new Error(j.errors?.[0]?.message ?? "Chain response incomplete");
  return j.data as T;
}

function address(a: string) {
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(a)) throw new Error("Invalid Sui address");
  return a;
}

/** Complete owned-object pages. Failure/limits throw rather than returning a partial list. */
export async function listOwnedCurrentObjects(owner: string, type: string): Promise<Node[]> {
  address(owner);
  const nodes: Node[] = [];
  let after: string | null = null;
  const seen = new Set<string>();
  for (let page = 0; page < 200; page++) {
    const data: { objects: Page } = await queryChain(`query($owner: SuiAddress!, $type: String!, $after: String) {
      objects(filter: {owner: $owner, type: $type}, first: 50, after: $after) {
        nodes { address version asMoveObject { contents { json } } }
        pageInfo { hasNextPage endCursor }
      }
    }`, { owner, type, after });
    if (!data.objects?.nodes || !data.objects.pageInfo) throw new Error("Owned-object response incomplete");
    nodes.push(...data.objects.nodes);
    if (!data.objects.pageInfo.hasNextPage) return nodes;
    const next = data.objects.pageInfo.endCursor;
    if (!next || seen.has(next)) throw new Error("Owned-object pagination stalled");
    seen.add(next); after = next;
  }
  throw new Error("Owned-object pagination limit reached; holdings are incomplete");
}

export async function findCurrentCharacters(owner: string): Promise<Array<{ characterId: string; tribeId: number; version: number }>> {
  const profiles = await listOwnedCurrentObjects(owner, `${CURRENT_WORLD}::character::PlayerProfile`);
  const ids = [...new Set(profiles.map(p => p.asMoveObject?.contents.json.character_id).filter((x): x is string => typeof x === "string"))];
  const out: Array<{ characterId: string; tribeId: number; version: number }> = [];
  for (let i = 0; i < ids.length; i += 25) {
    const batch = ids.slice(i, i + 25).map(address);
    const declarations = batch.map((_, n) => `$id${n}: SuiAddress!`).join(", ");
    const fields = batch.map((_, n) => `o${n}: object(address: $id${n}) { address version asMoveObject { contents { type { repr } json } } }`).join("\n");
    const data = await queryChain<Record<string, (Node & { asMoveObject: { contents: { json: Record<string, any>; type: { repr: string } } } | null }) | null>>(
      `query(${declarations}) { ${fields} }`, Object.fromEntries(batch.map((id, n) => [`id${n}`, id])));
    if (Object.keys(data).length !== batch.length) throw new Error("Character lookup incomplete");
    for (const n of Object.values(data)) {
      if (!n) continue; // Successfully read, explicitly deleted/absent — not a transport failure.
      if (n.asMoveObject?.contents.type.repr !== `${CURRENT_WORLD}::character::Character`) continue;
      out.push({ characterId: n.address, tribeId: Number(n.asMoveObject.contents.json.tribe_id ?? 0), version: Number(n.version) });
    }
  }
  return out.sort((a, b) => b.version - a.version);
}
