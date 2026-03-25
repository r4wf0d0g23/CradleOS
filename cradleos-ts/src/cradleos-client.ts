import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { CLOCK, MODULES, SUI_RPC, TYPES, WORLD_PKG } from './constants.js';

export type NodeStatus = {
  online: boolean;
  fuel: number;
  maxFuel: number;
};

export type CharacterView = {
  name: string | null;
  tribe_id: string | number | null;
  address: string | null;
};

type MoveFields = Record<string, unknown>;

type SuiObjectLike = {
  data?: {
    content?: {
      dataType?: string;
      type?: string;
      fields?: MoveFields;
    };
  };
};

function asFields(obj: SuiObjectLike): MoveFields {
  const content = obj.data?.content;
  if (!content || content.dataType !== 'moveObject' || !content.fields) {
    throw new Error('Expected a move object with fields');
  }
  return content.fields;
}

function normalizeNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (typeof value === 'bigint') return Number(value);
  return 0;
}

function pickField<T = unknown>(fields: MoveFields, keys: string[]): T | null {
  for (const key of keys) {
    if (key in fields) return fields[key] as T;
  }
  return null;
}

function unwrapAddress(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const nested = value as Record<string, unknown>;
    if (typeof nested.bytes === 'string') return nested.bytes;
    if (typeof nested.value === 'string') return nested.value;
    if (typeof nested.id === 'string') return nested.id;
  }
  return null;
}

export class CradleOSClient {
  readonly client: SuiClient;
  readonly packageId: string;

  constructor(options?: { rpcUrl?: string; packageId?: string }) {
    this.client = new SuiClient({
      url: options?.rpcUrl ?? SUI_RPC ?? getFullnodeUrl('testnet'),
    });
    this.packageId = options?.packageId ?? WORLD_PKG;
  }

  async getNodeStatus(nodeId: string): Promise<NodeStatus> {
    const object = await this.client.getObject({
      id: nodeId,
      options: { showContent: true },
    });

    const fields = asFields(object as SuiObjectLike);
    const online = Boolean(pickField(fields, ['online', 'is_online', 'active']));
    const fuel = normalizeNumber(pickField(fields, ['fuel', 'current_fuel', 'fuel_amount']) ?? 0);
    const maxFuel = normalizeNumber(pickField(fields, ['max_fuel', 'fuel_capacity', 'capacity']) ?? 0);

    return { online, fuel, maxFuel };
  }

  async getCharacter(characterId: string): Promise<CharacterView> {
    const object = await this.client.getObject({
      id: characterId,
      options: { showContent: true },
    });

    const fields = asFields(object as SuiObjectLike);
    const name = (pickField(fields, ['name', 'character_name']) as string | null) ?? null;
    const tribe_id = pickField(fields, ['tribe_id', 'tribe', 'tribeId']);
    const address = unwrapAddress(pickField(fields, ['address', 'owner', 'account_address']));

    return { name, tribe_id, address };
  }

  buildOnlineNodeTx(characterId: string, nodeId: string, ownerCapId: string): Transaction {
    const tx = new Transaction();

    const character = tx.object(characterId);
    const node = tx.object(nodeId);
    const ownerCapIdArg = tx.pure.id(ownerCapId);
    const clock = tx.object(CLOCK);

    const [ownerCap, receipt] = tx.moveCall({
      target: `${this.packageId}::character::borrow_owner_cap`,
      typeArguments: [TYPES.networkNode],
      arguments: [character, ownerCapIdArg],
    });

    tx.moveCall({
      target: `${this.packageId}::network_node::online`,
      arguments: [node, ownerCap, clock],
    });

    tx.moveCall({
      target: `${this.packageId}::character::return_owner_cap`,
      typeArguments: [TYPES.networkNode],
      arguments: [tx.object(characterId), ownerCap, receipt],
    });

    return tx;
  }

  buildFoundCorpTx(characterId: string, corpName: string, founderAddress: string): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::cradleos::corp::found_corp`,
      arguments: [
        tx.object(characterId),
        tx.pure.string(corpName),
        tx.pure.address(founderAddress),
      ],
    });

    return tx;
  }
}

export { MODULES };
