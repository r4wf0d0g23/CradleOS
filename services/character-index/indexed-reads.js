// Official GraphQL bridge for read APIs no longer indexed by the JSON-RPC node.
import { readEvents } from './event-reader.js';
export const INDEXED_METHODS = new Set(['suix_queryEvents', 'suix_getDynamicFields', 'suix_getDynamicFieldObject']);
export async function publicGraphql(query, variables = {}) {
  const r = await fetch(process.env.SUI_GRAPHQL_URL || 'https://graphql.testnet.sui.io/graphql', {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({query,variables}), signal:AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`GraphQL HTTP ${r.status}`);
  const j=await r.json(); if(j.errors?.length || !j.data) throw new Error(j.errors?.[0]?.message || 'Incomplete chain response');
  return j.data;
}
const canonicalType = s => String(s).replace(/0x([0-9a-f]+)/gi,(_m,x)=>'0x'+(x.replace(/^0+/,'')||'0')).replace(/\s/g,'');
function canonicalName(v) {
  if (Array.isArray(v)) return v.map(canonicalName);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonicalName(v[k])]));
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  return v;
}
function keyValue(type, value) {
  const t=canonicalType(type);
  if ((t==='address' || t==='0x2::object::ID') && typeof value==='string' && /^0x[\da-f]{1,64}$/i.test(value)) return canonicalType(value);
  return canonicalName(value);
}
export class IndexedReads {
  constructor({graphql=publicGraphql, objectReader}={}) { this.graphql=graphql; this.objectReader=objectReader; }
  async page(parent, after=null, limit=50) {
    if (!/^0x[\da-f]{1,64}$/i.test(parent) || (after!==null && typeof after!=='string')) throw new Error('Invalid dynamic-field request');
    const data=await this.graphql(`query($parent:SuiAddress!,$after:String,$count:Int!){address(address:$parent){dynamicFields(first:$count,after:$after){
      nodes{address version digest name{type{repr}json bcs} contents{type{repr}} value{__typename ... on MoveObject{address version digest contents{type{repr}}}}}
      pageInfo{hasNextPage endCursor}}}}`,{parent,after,count:Math.min(50,Math.max(1,Number(limit)||50))});
    const page=data.address?.dynamicFields;
    if(!Array.isArray(page?.nodes)||typeof page.pageInfo?.hasNextPage!=='boolean') throw new Error('Incomplete dynamic-field response');
    const rows=page.nodes.map(n=>{
      if(!n.name?.type?.repr || n.name.json===undefined || !n.address || !n.contents?.type?.repr) throw new Error('Unresolved dynamic field');
      if(!['MoveObject','MoveValue'].includes(n.value?.__typename)) throw new Error('Unresolved dynamic-field value');
      const object=n.value.__typename==='MoveObject'?n.value:n;
      if(!object.address || object.version==null || !object.digest || !object.contents?.type?.repr) throw new Error('Incomplete field object');
      return {name:{type:canonicalType(n.name.type.repr),value:n.name.json},bcsName:n.name.bcs,
        type:n.value?.__typename==='MoveObject'?'DynamicObject':'DynamicField',objectType:canonicalType(object.contents.type.repr),objectId:object.address,version:String(object.version),digest:object.digest};
    });
    if(page.pageInfo.hasNextPage && (!page.pageInfo.endCursor || page.pageInfo.endCursor===after)) throw new Error('Dynamic-field pagination stalled');
    return {data:rows,hasNextPage:page.pageInfo.hasNextPage,nextCursor:page.pageInfo.endCursor};
  }
  async handle(method,params) {
    if(method==='suix_queryEvents') return readEvents(q=>this.graphql(q),params);
    if(method==='suix_getDynamicFields') return this.page(...params);
    if(method!=='suix_getDynamicFieldObject') throw new Error('Unsupported indexed method');
    const [parent,name]=params;
    if(!name || typeof name.type!=='string') throw new Error('Dynamic-field key required');
    let cursor=null; const cursors=new Set();
    for(let page=0;page<200;page++){
      const r=await this.page(parent,cursor,50);
      const row=r.data.find(x=>canonicalType(x.name.type)===canonicalType(name.type) && JSON.stringify(keyValue(name.type,x.name.value))===JSON.stringify(keyValue(name.type,name.value)));
      if(row){ if(!this.objectReader) throw new Error('Object reader unavailable'); return this.objectReader(row.objectId); }
      if(!r.hasNextPage) return {error:{code:'dynamicFieldNotFound',parent_object_id:parent}};
      if(cursors.has(r.nextCursor)) throw new Error('Dynamic-field pagination cycle');
      cursors.add(r.nextCursor);cursor=r.nextCursor;
    }
    throw new Error('Dynamic-field lookup limit exceeded; result incomplete');
  }
}
