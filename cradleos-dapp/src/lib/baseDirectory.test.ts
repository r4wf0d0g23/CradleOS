import { describe, expect, it } from 'vitest';
import type { LocationGroup, PlayerStructure } from '../lib';
import { baseContents, baseMatches, baseTitle, buildBaseDirectory, structureMatches } from './baseDirectory';
const structure = (objectId: string, kind: PlayerStructure['kind'], extra: Partial<PlayerStructure> = {}): PlayerStructure => ({ objectId, ownerCapId: 'cap-'+objectId, kind, label: kind, typeFull: 'native::'+kind, displayName: kind, hasCustomName: false, isOnline: false, locationHash: 'hash', ...extra });
const group = (key: string, structures: PlayerStructure[], solarSystemId?: number): LocationGroup => ({key,structures,solarSystemId,tabLabel:key});

describe('owned base directory', () => {
 it('keeps cross-location children attached to the exact owned node, without synthesizing its location', () => {
  const node=structure('n','NetworkNode'), gun=structure('g','Turret',{energySourceId:'n',solarSystemId:42}), storage=structure('s','StorageUnit',{energySourceId:'n'});
  const d=buildBaseDirectory([group('unknown',[node,storage]),group('42',[gun],42)]);
  expect(d.bases).toEqual([{node,children:[storage,gun]}]);expect(d.others).toEqual([]);expect(d.bases[0].node.solarSystemId).toBeUndefined();
 });
 it('represents each structure once and preserves empty/offline bases and unmatched parents', () => {
  const rows=[structure('n1','NetworkNode'),structure('n2','NetworkNode'),structure('g','Turret',{energySourceId:'n1'}),structure('o','StorageUnit',{energySourceId:'not-owned'}),structure('u','Assembly')];
  const d=buildBaseDirectory([group('unknown',rows)]),represented=[...d.bases.flatMap(b=>[b.node,...b.children]),...d.others];
  expect(represented.map(s=>s.objectId).sort()).toEqual(rows.map(s=>s.objectId).sort());expect(new Set(represented.map(s=>s.objectId)).size).toBe(rows.length);expect(d.bases.find(b=>b.node.objectId==='n2')?.children).toEqual([]);expect(d.others).toHaveLength(2);
 });
 it('child-only search retains all siblings, counts and energy-accounting inputs', () => {
  const d=buildBaseDirectory([group('all',[structure('n','NetworkNode'),structure('g','Turret',{energySourceId:'n',displayName:'North battery',isOnline:true,energyCost:20}),structure('s','StorageUnit',{energySourceId:'n',isOnline:true,energyCost:100})])]);
  const visible=d.bases.filter(b=>baseMatches(b,'  NORTH '));expect(visible).toHaveLength(1);expect(visible[0]).toBe(d.bases[0]);expect(visible[0].children).toHaveLength(2);expect(visible[0].children.reduce((sum,s)=>sum+(s.energyCost??0),0)).toBe(120);expect(baseContents(visible[0].children)).toBe('1 turret · 1 storage');
 });
 it('uses saved names or distinct item IDs and never guesses a system from a child/name', () => {
  expect(baseTitle(structure('n1','NetworkNode',{gameItemId:'123'}))).toBe('Base 123');
  expect(baseTitle(structure('n2','NetworkNode',{gameItemId:'124'}))).toBe('Base 124');
  expect(baseTitle(structure('n3','NetworkNode',{hasCustomName:true,displayName:'Starter base'}))).toBe('Starter base');
  expect(baseContents([])).toBe('No attached structures');
 });
 it('searches exact IDs/names/type labels, with clear no-match and empty-query behavior', () => {
  const s=structure('0xabc','StorageUnit',{gameItemId:'123456',displayName:'Depot',typeName:'Heavy Storage'});
  for(const q of ['DEPOT','123456','0xabc','heavy','storage',''])expect(structureMatches(s,q)).toBe(true);
  expect(structureMatches(s,'nothing')).toBe(false);
 });
 it('does not mutate source structures/groups and preserves deterministic identity order', () => {
  const groups=[group('b',[structure('n2','NetworkNode',{gameItemId:'20'})]),group('a',[structure('n1','NetworkNode',{gameItemId:'10'})])],before=JSON.stringify(groups);
  expect(buildBaseDirectory(groups).bases.map(b=>b.node.objectId)).toEqual(['n1','n2']);expect(JSON.stringify(groups)).toBe(before);
 });
});
