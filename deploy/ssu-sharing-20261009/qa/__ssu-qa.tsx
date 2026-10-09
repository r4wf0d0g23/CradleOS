import React,{useState} from 'react';
import ReactDOM from 'react-dom/client';
import {EveFrontierProvider} from '@evefrontier/dapp-kit';
import {QueryClient} from '@tanstack/react-query';
import {Theme} from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import {SsuStorageCard} from './components/SsuStorageCard';
import {SSU_AUTH,SSU_TYPE,openStorageKey,type SsuSnapshot} from './lib/ssuSafety';
const id='0x'+'a'.repeat(64),cap='0x'+'b'.repeat(64),personal='0x'+'c'.repeat(64),wallet='0x'+'d'.repeat(64),character='0x'+'e'.repeat(64),open=openStorageKey(id);
const mode=new URLSearchParams(location.search).get('mode')??'owner';
const slots=[{key:cap,partition:'owner_main',used:100,max:10000,items:[{typeId:88335,quantity:100,volume:1,itemId:'0',partition:'owner_main',partitionKey:cap}]},{key:personal,partition:'unknown',used:300,max:10000,items:[{typeId:88783,quantity:3,volume:100,itemId:'0',partition:'unknown',partitionKey:personal}]},{key:open,partition:'open',used:500,max:10000,items:[{typeId:88782,quantity:5,volume:100,itemId:'0',partition:'open',partitionKey:open}]}] as SsuSnapshot['slots'];
const state:SsuSnapshot={id,type:SSU_TYPE,version:'10',ownerCapId:cap,extension:mode==='none'?null:mode==='foreign'?'0x'+'f'.repeat(64)+'::foreign::Auth':SSU_AUTH,frozen:mode==='frozen',online:true,slots,readAt:Date.now()};
const originalFetch=window.fetch;
// Isolated browser fixtures. No transaction execution endpoint is implemented.
window.fetch=async(url,options)=>{
 if(!String(url).includes('/sui'))return originalFetch(url,options);
 const q=JSON.parse(String(options?.body));let result:any;
 if(q.method==='sui_getObject') result=q.params[0]===id?{data:{objectId:id,version:'10',content:{type:SSU_TYPE,fields:{owner_cap_id:cap,inventory_keys:slots.map(s=>s.key),extension:SSU_AUTH,status:{fields:{status:{variant:'ONLINE'}}}}}}}:{error:{code:'notExists'}};
 else if(q.method==='suix_getDynamicFieldObject'){const s=slots.find(s=>s.key===q.params[1].value)!;result={data:{content:{fields:{name:s.key,value:{fields:{used_capacity:s.used,max_capacity:s.max,items:{fields:{contents:s.items.map(i=>({fields:{value:{fields:{type_id:i.typeId,quantity:i.quantity,volume:i.volume,item_id:i.itemId}}}}))}}}}}}}};}
 else throw new Error('Fixture prohibits '+q.method);
 return new Response(JSON.stringify({jsonrpc:'2.0',id:1,result}),{status:200});
};
function Demo(){const[collapsed,setCollapsed]=useState(false);return <main style={{maxWidth:1000,margin:'0 auto',padding:12,fontFamily:'monospace'}}><SsuStorageCard inv={{ssu:{objectId:id,typeFull:SSU_TYPE,typeId:88083,displayName:'STRG-1',isOnline:true} as any,items:slots.flatMap(s=>s.items),resolvedNames:new Map([[88335,'Iron ore'],[88783,'Carbon'],[88782,'Dense ore']]),loading:false,snapshot:mode==='error'?undefined:state,error:mode==='error'?'Storage data unavailable. Retry; this is not an empty inventory.':undefined,operator:{name:'Raw',key:wallet}}} characterId={character} walletAddress={wallet} ownerCaps={mode==='nonowner'?new Map():new Map([[id,cap]])} charOwnerCapId={personal} onRefresh={()=>{}} collapsed={collapsed} onToggleCollapse={()=>setCollapsed(v=>!v)}/></main>}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Theme appearance="dark" accentColor="orange" grayColor="sand"><EveFrontierProvider queryClient={new QueryClient()}><Demo/></EveFrontierProvider></Theme></React.StrictMode>);
