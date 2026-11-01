import type { LocationGroup, PlayerStructure } from '../lib';

export type OwnedBase = { node: PlayerStructure; children: PlayerStructure[] };
export type BaseDirectory = { structures: PlayerStructure[]; bases: OwnedBase[]; others: PlayerStructure[] };

/** Ownership is decided by the reader. Locations must never split a base. */
export function buildBaseDirectory(groups: LocationGroup[]): BaseDirectory {
  const structures = groups.flatMap(group => group.structures);
  const byNode = new Map<string, OwnedBase>();
  for (const node of structures) if (node.kind === 'NetworkNode') byNode.set(node.objectId, { node, children: [] });
  const others: PlayerStructure[] = [];
  for (const structure of structures) {
    if (structure.kind === 'NetworkNode') continue;
    const base = structure.energySourceId ? byNode.get(structure.energySourceId) : undefined;
    if (base) base.children.push(structure);
    else others.push(structure);
  }
  const bases = [...byNode.values()].sort((a, b) => baseTitle(a.node).localeCompare(baseTitle(b.node), undefined, { numeric: true }) || a.node.objectId.localeCompare(b.node.objectId));
  return { structures, bases, others };
}

export function baseTitle(node: PlayerStructure): string {
  return node.hasCustomName ? node.displayName : `Base ${node.gameItemId ?? node.objectId.slice(0, 10) + '…' + node.objectId.slice(-6)}`;
}
export function structureMatches(structure: PlayerStructure, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return !needle || [structure.displayName, structure.gameItemId, structure.objectId, structure.typeName, structure.kind, structure.label]
    .some(value => value?.toLowerCase().includes(needle));
}
/** Select the whole base, never a filtered child array used for power/stance. */
export function baseMatches(base: OwnedBase, query: string): boolean {
  return baseTitle(base.node).toLowerCase().includes(query.trim().toLowerCase()) ||
    structureMatches(base.node, query) || base.children.some(child => structureMatches(child, query));
}
export function baseContents(children: PlayerStructure[]): string {
  const counts = new Map<string, number>();
  for (const child of children) counts.set(child.kind, (counts.get(child.kind) ?? 0) + 1);
  return ([['Turret', 'turrets'], ['StorageUnit', 'storage'], ['Assembly', 'industry'], ['Gate', 'gates']] as const)
    .filter(([kind]) => counts.has(kind)).map(([kind, label]) => `${counts.get(kind)} ${counts.get(kind) === 1 && (kind === 'Turret' || kind === 'Gate') ? label.slice(0, -1) : label}`).join(' · ') || 'No attached structures';
}
