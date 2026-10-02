import test from 'node:test';
import assert from 'node:assert/strict';
import {IndexedReads} from '../indexed-reads.js';
const page=(nodes,more=false,cursor=null)=>({address:{dynamicFields:{nodes,pageInfo:{hasNextPage:more,endCursor:cursor}}}});
const row=(id,n)=>({address:id,version:1,digest:'d',name:{type:{repr:'u32'},json:n,bcs:'AA=='},contents:{type:{repr:'0x2::dynamic_field::Field<u32,bool>'}},value:{__typename:'MoveValue'}});
test('lookup paginates and preserves actual object read format',async()=>{let calls=0;const r=new IndexedReads({graphql:async()=>++calls===1?page([row('0x1',1)],true,'c'):page([row('0x2',2)]),objectReader:async id=>({data:{objectId:id,content:{fields:{value:true}}}})});assert.equal((await r.handle('suix_getDynamicFieldObject',['0x42',{type:'u32',value:'2'}])).data.objectId,'0x2');assert.equal(calls,2);});
test('does not call failed field lookup an absent field',async()=>{const r=new IndexedReads({graphql:async()=>{throw new Error('offline')}});await assert.rejects(()=>r.handle('suix_getDynamicFieldObject',['0x42',{type:'u32',value:0}]),/offline/);});
test('rejects stalled pagination',async()=>{const r=new IndexedReads({graphql:async()=>page([],true,'same')});await assert.rejects(()=>r.handle('suix_getDynamicFieldObject',['0x42',{type:'u32',value:0}]),/stalled/);});
test('empty complete page yields an explicit missing field',async()=>{const r=new IndexedReads({graphql:async()=>page([])});assert.equal((await r.handle('suix_getDynamicFieldObject',['0x42',{type:'u32',value:0}])).error.code,'dynamicFieldNotFound');});

test('hex-looking string keys remain distinct',async()=>{
 const a=row('0x1','0x01'),b=row('0x2','0x1');a.name.type.repr=b.name.type.repr='0x1::string::String';
 const r=new IndexedReads({graphql:async()=>page([a,b]),objectReader:async id=>({data:{objectId:id}})});
 assert.equal((await r.handle('suix_getDynamicFieldObject',['0x42',{type:'0x1::string::String',value:'0x1'}])).data.objectId,'0x2');
});
test('missing field-value variant is not guessed',async()=>{const n=row('0x1',0);delete n.value;const r=new IndexedReads({graphql:async()=>page([n])});await assert.rejects(()=>r.handle('suix_getDynamicFields',['0x42']),/Unresolved/);});

test('dynamic object fields resolve the referenced child object',async()=>{const n=row('0x1',0);n.value={__typename:'MoveObject',address:'0x99',version:2,digest:'child',contents:{type:{repr:'0x123::thing::Thing'}}};const r=new IndexedReads({graphql:async()=>page([n]),objectReader:async id=>({data:{objectId:id}})});assert.equal((await r.handle('suix_getDynamicFieldObject',['0x42',{type:'u32',value:0}])).data.objectId,'0x99');});
test('missing pagination completeness flag fails closed',async()=>{const result=page([]);delete result.address.dynamicFields.pageInfo.hasNextPage;const r=new IndexedReads({graphql:async()=>result});await assert.rejects(()=>r.handle('suix_getDynamicFields',['0x42']),/Incomplete/);});
