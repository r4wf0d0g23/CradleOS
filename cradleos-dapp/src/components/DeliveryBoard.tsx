import { useEffect, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { Transaction } from "@mysten/sui/transactions";
import { BOOK_DEPLOYMENT as cfg } from "../lib/bookDeployment";
import { fetchEveCoins } from "../lib/casino";
import { queryChain } from "../lib/currentWorldRead";
import { fetchDelivery, fetchDeliveryItems, findBookCharacter, buildDelivery, buildFulfill, buildDeliveryRefund, parseEve, formatEve, objectId, type CreateDelivery } from "../lib/bettingBook";
const utc=(s:number)=>new Date(s*1000).toISOString().slice(0,16).replace("T"," ")+" UTC";
type Props={ids:string[];addr:string;disabled:boolean;busy:boolean;paused:boolean;now:number;execute:(label:string,build:()=>Promise<Transaction>|Transaction)=>Promise<void>};
export function DeliveryBoard({ids,addr,disabled,busy,paused,now,execute}:Props){
  const [limit,setLimit]=useState(8),[active,setActive]=useState(""),[chosen,setChosen]=useState<string[]>([]),[error,setError]=useState("");
  const [form,setForm]=useState({title:"",origin:"",itemType:"",quantity:"",deadline:"",reward:""});
  const [confirm,setConfirm]=useState<{wallet:string;create:CreateDelivery;formSnapshot:string}|{wallet:string;deliveryId:string;items:string[];sponsor:string;reward:bigint}|null>(null);
  const shown=[...ids].reverse().slice(0,limit);
  const queries=useQueries({queries:shown.map(id=>({queryKey:["bookDelivery",id],queryFn:()=>fetchDelivery(id),refetchInterval:15000}))});
  const items=useQuery({queryKey:["bookItems",addr],queryFn:()=>fetchDeliveryItems(addr),enabled:!!addr,refetchInterval:15000});
  const id=active||shown[0], d=queries[shown.indexOf(id)]?.data;
  const available=items.data?.filter(i=>i.origin===d?.origin&&i.itemType===d?.itemType)??[];
  useEffect(()=>{setConfirm(null);setChosen([]);},[addr,id]);
  useEffect(()=>{setConfirm(null);},[form,chosen]);
  function reviewCreate(){try{
    if(!/^\d+$/.test(form.itemType)||!/^\d+$/.test(form.quantity))throw Error("Enter whole item type and quantity.");
    setConfirm({wallet:addr,formSnapshot:JSON.stringify(form),create:{title:form.title.trim(),origin:objectId(form.origin),itemType:BigInt(form.itemType),quantity:BigInt(form.quantity),deadline:Date.parse(form.deadline+"Z")/1000,reward:parseEve(form.reward)}});setError("");
  }catch(e){setError(e instanceof Error?e.message:String(e));}}
  async function submit(){
    const c=confirm;if(!c||c.wallet!==addr)return;
    if("create" in c){if(c.formSnapshot!==JSON.stringify(form)){setConfirm(null);return;} await execute("Fund item reward",async()=>{
      const [character,coins,origin]=await Promise.all([findBookCharacter(addr),fetchEveCoins(addr),queryChain<{object:{asMoveObject:{contents:{type:{repr:string};json:{key:{tenant:string}}}}}|null}>("query($id:SuiAddress!){object(address:$id){asMoveObject{contents{type{repr} json}}}}",{id:c.create.origin})]);
      if(origin.object?.asMoveObject.contents.type.repr!==`${cfg.world}::storage_unit::StorageUnit`||origin.object.asMoveObject.contents.json.key?.tenant!==cfg.tenant)throw Error("Current-world origin SSU required.");
      return buildDelivery(character,c.create,coins.coins);
    });}else{if(c.deliveryId!==id||JSON.stringify(c.items)!==JSON.stringify(chosen)){setConfirm(null);return;} await execute("Deliver items",async()=>{
      const [fresh,character,owned]=await Promise.all([fetchDelivery(c.deliveryId),findBookCharacter(addr),fetchDeliveryItems(addr)]);
      if(fresh.sponsor!==c.sponsor||fresh.rewardAmount!==c.reward)throw Error("Reward changed. Review again.");
      if(fresh.sponsor===addr)throw Error("Sponsor cannot fulfill their own reward.");
      const selected=owned.filter(i=>c.items.includes(i.id));if(selected.length!==c.items.length)throw Error("Item ownership changed.");
      return buildFulfill(fresh,character,selected);
    });}
    setConfirm(null);void items.refetch();for(const q of queries)void q.refetch();
  }
  return <section className="book-deliveries">
    <h3>Item rewards</h3>
    <div className="book-layout">
      <nav className="book-list" aria-label="Item rewards">
        {!shown.length&&<p>No rewards yet</p>}
        {shown.map((v,i)=><button key={v} disabled={busy} aria-pressed={id===v} onClick={()=>setActive(v)}><strong>{queries[i].data?.title??"Reward"}</strong><span>{queries[i].isError?"Unavailable":queries[i].data?formatEve(queries[i].data!.rewardAmount)+" EVE":"Loading…"}</span></button>)}
        {limit<ids.length&&<button onClick={()=>setLimit(n=>n+8)}>More rewards</button>}
      </nav>
      {d&&<div className="book-detail">
        <div className="book-heading"><h4>{d.title}</h4><b>{d.status===1?"Delivered":d.status===2?"Refunded":now>=d.deadline?"Expired":"Open"}</b></div>
        <dl className="book-metrics">
          <div><dt>Item type</dt><dd>{String(d.itemType)}</dd></div><div><dt>Quantity</dt><dd>{String(d.quantity)}</dd></div>
          <div><dt>Reward</dt><dd>{formatEve(d.rewardAmount)} EVE</dd></div><div><dt>Deadline</dt><dd>{utc(d.deadline)}</dd></div>
          <div><dt>Origin SSU</dt><dd className="book-object-id">{d.origin}</dd></div><div><dt>Recipient</dt><dd className="book-object-id">{d.sponsor}</dd></div>
        </dl>
        {d.status===0&&now<d.deadline&&addr!==d.sponsor&&<div className="book-items">
          <h4>Your eligible items</h4>
          {!addr?<p>Connect a wallet</p>:items.isError?<p>Items unavailable</p>:!items.data?<p>Loading items…</p>:!available.length?<p>No eligible items</p>:available.map(i=><label key={i.id}><input type="checkbox" disabled={busy} checked={chosen.includes(i.id)} onChange={e=>setChosen(v=>e.target.checked?[...v,i.id]:v.filter(x=>x!==i.id))}/>{String(i.quantity)} units · {i.id.slice(0,10)}…</label>)}
          <button disabled={disabled||!chosen.length||available.filter(i=>chosen.includes(i.id)).reduce((n,i)=>n+i.quantity,0n)!==d.quantity} onClick={()=>setConfirm({wallet:addr,deliveryId:d.id,items:[...chosen],sponsor:d.sponsor,reward:d.rewardAmount})}>Review delivery</button>
        </div>}
        {d.status===0&&now>=d.deadline&&<button disabled={disabled} onClick={()=>void execute("Refund reward",()=>buildDeliveryRefund(d.id))}>Refund sponsor</button>}
        <details className="book-rules"><summary>Reward rules</summary><ul><li>Exact item type, quantity and origin SSU. No partial fulfillment.</li><li>Items transfer to the sponsor’s wallet; the full reward pays atomically to the supplier.</li><li>Wallet handoff only; no travel or in-game deposit. Origin SSU access not included.</li><li>Unfilled rewards return to the sponsor at expiry. No outcome bets.</li></ul></details>
      </div>}
    </div>
    <details className="book-admin"><summary>Sponsor a reward</summary><div className="book-create">
      {([["title","Title"],["origin","Origin SSU"],["itemType","Item type"],["quantity","Exact quantity"],["deadline","Deadline · UTC"],["reward","Reward · EVE"]] as const).map(([key,label])=><label key={key}>{label}<input disabled={busy} type={key==="deadline"?"datetime-local":"text"} value={form[key]} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))}/></label>)}
      <button disabled={disabled||paused||!cfg.rewardsEnabled} onClick={reviewCreate}>Review reward</button>
    </div></details>
    {confirm&&<div className="book-confirm"><span>{"create" in confirm?`Lock ${formatEve(confirm.create.reward)} EVE until fulfillment or expiry? No early cancellation.`:`Transfer the selected items to ${confirm.sponsor} for ${formatEve(confirm.reward)} EVE?`}</span><button disabled={disabled} onClick={()=>void submit()}>Confirm</button><button disabled={busy} onClick={()=>setConfirm(null)}>Cancel</button></div>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
