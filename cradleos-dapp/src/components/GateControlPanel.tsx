import { useEffect, useRef, useState } from "react";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { useSponsoredTransaction } from "@evefrontier/dapp-kit";
import { CurrentAccountSigner } from "../lib/cycleSigner";
import { readStructureSnapshot, type StructureSnapshot } from "../lib/structureRead";
import { GATE_DEPLOYMENT } from "../lib/gateDeployment";
import { sponsoredGateLink } from "../lib/gateLink";
import { storageClient } from "../lib/storageRead";
import { parseGateAmount, formatGateAmount, GATE_MODES, DEFAULT_GATE_RULES, DEFAULT_GATE_RATES, discoverGateRoutes, readGateRoute,
  readGatePair, readGateCharacter, readGatePass, verifyGatePairHistory, gatePreviewKey, assertGateOwner,
  buildGateAction, gateOperationLock, gateAllows, gatePrice, gateWindowEnd, assertGatePair,
  type GatePair, type GateRoute, type GateRules, type GateRates, type GateAction, type GateCharacter } from "../lib/gateControl";
import "./GateControl.css";

const money=(v:string)=>`${formatGateAmount(v)} $EVE`;
const short=(v:string)=>`${v.slice(0,6)}…${v.slice(-5)}`;
const when=(ms:number)=>new Date(ms).toLocaleString();
const parts=(s:string)=>s.trim()?s.trim().split(/[\s,]+/):[];
const durations=[[0,"Off"],[3600000,"1 hour"],[86400000,"1 day"],[604800000,"7 days"],[2592000000,"30 days"]] as const;

export function GateControlPanel() {
  const account=useCurrentAccount(), kit=useDAppKit(), {mutateAsync:send}=useSponsoredTransaction();
  const address=account?.address??"";
  const [owned,setOwned]=useState<StructureSnapshot|null>(null),[routes,setRoutes]=useState<GateRoute[]>([]),
    [selected,setSelected]=useState(""),[refresh,setRefresh]=useState(0),[loading,setLoading]=useState(false),
    [error,setError]=useState(""),[status,setStatus]=useState(""),[linkBusy,setLinkBusy]=useState(false);
  const generation=useRef(0);
  useEffect(()=>{
    const g=++generation.current; setOwned(null); setRoutes([]); setError(""); setLoading(true);
    Promise.all([address?readStructureSnapshot(address):Promise.resolve(null),GATE_DEPLOYMENT?discoverGateRoutes():Promise.resolve({routes:[],unavailable:0})])
      .then(([snapshot, found])=>{if(g===generation.current){setOwned(snapshot);setRoutes(found.routes);if(found.unavailable)setError(`${found.unavailable} routes unavailable.`);}})
      .catch(()=>{if(g===generation.current)setError("Gates unavailable. Refresh.");})
      .finally(()=>{if(g===generation.current)setLoading(false);});
    return()=>{generation.current++;};
  },[address,refresh]);
  useEffect(()=>{setSelected("");setStatus("");},[address]);
  function walletCurrent() {if(!address||kit.stores.$connection.get().account?.address!==address||kit.stores.$currentNetwork.get()!=="testnet")throw Error("Wallet changed. Refresh.");}
  async function link(id:string) {
    if(gateOperationLock.busy)return; gateOperationLock.busy=true;setLinkBusy(true);setError("");setStatus("Opening EVE Vault");
    const g=generation.current;
    try{await sponsoredGateLink(id,address,false,send,walletCurrent);if(g===generation.current){setStatus("Link confirmed");setRefresh(n=>n+1);}}
    catch(e){if(g===generation.current){setError(e instanceof Error?e.message:"Link unverified. Refresh.");setStatus("");}}
    finally{gateOperationLock.busy=false;setLinkBusy(false);}
  }
  const gates=owned?.structures.filter(s=>s.kind==="Gate")??[];
  const selectedRoute=routes.find(r=>r.id===selected)??routes.find(r=>r.active&&(r.gateA===selected||r.gateB===selected))??null;
  const selectedGate=selectedRoute?.gateA??gates.find(g=>g.objectId===selected)?.objectId;
  return <section className="gate-control">
    <header><h2>Gates</h2><span>Testnet</span><button disabled={loading||linkBusy} onClick={()=>setRefresh(n=>n+1)}>Refresh</button></header>
    {error&&<div role="alert" className="gate-error">{error}</div>}{status&&<div role="status">{status}</div>}
    {!address&&<p>Connect EVE Vault</p>}
    {loading?<p>Loading…</p>:<>
      <div className="gate-route-list">{routes.map(r=><button key={r.id} aria-pressed={selected===r.id} onClick={()=>setSelected(r.id)}>
        {r.name}<span>{!r.active?"Inactive":!r.historyVerified?"Unverified":r.locked?"Paused":"Active"}</span></button>)}</div>
      {gates.length>0&&<details open={!routes.length}><summary>My gates · {gates.length}</summary>
        {gates.map(g=><div className="gate-owned" data-gate-id={g.objectId} key={g.objectId}><strong>{g.displayName}</strong><span>{g.isOnline?"Online":"Offline"}</span>
          <span>{g.linkedGateId?"Linked":"Unlinked"}</span>
          {g.linkedGateId?<button onClick={()=>setSelected(routes.find(r=>r.active&&(r.gateA===g.objectId||r.gateB===g.objectId))?.id??g.objectId)}>Manage</button>:
            <button disabled={linkBusy||!address} onClick={()=>void link(g.objectId)}>Link in EVE Vault</button>}</div>)}
      </details>}
      {!gates.length&&!routes.length&&<p>{GATE_DEPLOYMENT?"No gates found":"Gate setup unavailable"}</p>}
      {selectedGate&&<GateRouteEditor key={`${selected}:${address}`} gateId={selectedGate} routeId={selectedRoute?.id??null}
        characterId={owned?.characterId??""} wallet={address} ownedGateIds={gates.map(g=>g.objectId)} refresh={refresh}
        changed={()=>{setStatus("Confirmed");setRefresh(n=>n+1);}}/>}
    </>}
  </section>;
}

function GateRouteEditor({gateId,routeId,characterId,wallet,ownedGateIds,refresh,changed}:{gateId:string;routeId:string|null;
  characterId:string;wallet:string;ownedGateIds:string[];refresh:number;changed:()=>void}) {
  const kit=useDAppKit();
  const [pair,setPair]=useState<GatePair|null>(null),[character,setCharacter]=useState<GateCharacter|null>(null),
    [passUntil,setPassUntil]=useState<number|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),
    [busy,setBusy]=useState(false),[consent,setConsent]=useState(false),[historyReady,setHistoryReady]=useState(false),
    [review,setReview]=useState<{pair:GatePair;action:GateAction;summary:string}|null>(null);
  const [name,setName]=useState("Route"),[rules,setRules]=useState<GateRules>(DEFAULT_GATE_RULES),[rates,setRates]=useState<GateRates>(DEFAULT_GATE_RATES);
  const generation=useRef(0);
  useEffect(()=>{
    const g=++generation.current;setLoading(true);setError("");setReview(null);setConsent(false);setPair(null);setPassUntil(null);setHistoryReady(false);
    const load=async()=>{
      const route=routeId?await readGateRoute(routeId):null;
      const [p,c]=await Promise.all([readGatePair(gateId,route),characterId?readGateCharacter(characterId):Promise.resolve(null)]);
      const until=route&&c?await readGatePass(route,c.id):0;
      if(g!==generation.current)return;
      setPair(p);setCharacter(c);setPassUntil(until);setName(route?.name??`${p.a.name} ↔ ${p.b.name}`.slice(0,60));
      setRules(route?.rules??{...DEFAULT_GATE_RULES,memberTribe:c?.tribe??0});setRates(route?.rates??DEFAULT_GATE_RATES);setLoading(false);
      if(route?.active) { await verifyGatePairHistory(p); if(g===generation.current)setHistoryReady(true); }
    };
    load().catch(e=>{if(g===generation.current)setError(e instanceof Error?e.message:"Route unavailable.");})
      .finally(()=>{if(g===generation.current)setLoading(false);});
    return()=>{generation.current++;};
  },[gateId,routeId,characterId,wallet,refresh]);
  const owner=!!pair&&ownedGateIds.includes(pair.a.id)&&ownedGateIds.includes(pair.b.id);
  function guard(){if(!wallet||!characterId||kit.stores.$connection.get().account?.address!==wallet||kit.stores.$currentNetwork.get()!=="testnet")throw Error("Wallet changed. Refresh.");}
  async function fresh(action:GateAction) {
    guard(); const r=routeId?await readGateRoute(routeId):null;
    const [p,c]=await Promise.all([readGatePair(gateId,r),readGateCharacter(characterId)]);
    if(c.address!==wallet)throw Error("Wallet changed. Refresh.");
    if(action.kind==="permit"||action.kind==="pass") {
      if(!r)throw Error("Route unavailable."); assertGatePair(p,true); await verifyGatePairHistory(p);
      const now=Date.now(); gateWindowEnd(r.rules,now);
      if(!gateAllows(r.rules,c))throw Error("Access denied.");
      const until=await readGatePass(r,c.id);
      if(action.kind==="pass"&&(!r.rates.passDuration||until>now))throw Error("Pass unavailable.");
      const price=action.kind==="permit"&&until>now?"0":gatePrice(r,c.tribe,action.kind==="pass");
      if(price!==action.amount)throw Error("Price changed. Review again.");
    } else {
      await assertGateOwner(p,c,wallet);
      if(action.kind==="activate")await verifyGatePairHistory(p);
    }
    guard(); return {p,c};
  }
  async function prepare(action:GateAction,summary:string) {
    if(gateOperationLock.busy||busy)return;gateOperationLock.busy=true;setBusy(true);setError("");setReview(null);setConsent(false);
    const g=generation.current;
    try{const {p,c}=await fresh(action);if(g!==generation.current)return;buildGateAction(p,action,c,wallet);setReview({pair:p,action,summary});}
    catch(e){if(g===generation.current)setError(e instanceof Error?e.message:"Review failed.");}
    finally{gateOperationLock.busy=false;setBusy(false);}
  }
  async function submit(){
    if(!review||!consent||gateOperationLock.busy||busy)return;gateOperationLock.busy=true;setBusy(true);setError("");
    const g=generation.current;
    try{
      const {p,c}=await fresh(review.action);if(g!==generation.current)return;
      if(gatePreviewKey(p,review.action)!==gatePreviewKey(review.pair,review.action))throw Error("Gate or settings changed. Review again.");
      guard();const result:any=await new CurrentAccountSigner(kit).signAndExecuteTransaction({transaction:buildGateAction(p,review.action,c,wallet)});
      if(result?.$kind==="FailedTransaction"||result?.FailedTransaction||result?.effects?.status?.status==="failure")throw Error("Transaction failed.");
      const digest=result?.Transaction?.digest??result?.digest;
      if(!digest)throw Error("Submission unverified. Refresh.");
      const confirmed=await storageClient.waitForTransaction({digest,timeout:20000});
      if(confirmed.$kind==="FailedTransaction")throw Error("Transaction failed.");
      if(g!==generation.current)return;
      setReview(null);setConsent(false);changed();
    }catch(e){if(g===generation.current){setError(e instanceof Error?e.message:"Submission unverified. Refresh.");setReview(null);setConsent(false);}}
    finally{gateOperationLock.busy=false;setBusy(false);}
  }
  function edit(){setReview(null);setConsent(false);}
  const r=pair?.route;
  const request=(kind:"permit"|"pass")=>{
    if(!r||!character||passUntil===null)return;
    const amount=kind==="permit"&&passUntil>Date.now()?"0":gatePrice(r,character.tribe,kind==="pass");
    void prepare({kind,amount},kind==="permit"?`${money(amount)} · One jump permit · Expires within 60s · No refund if unused`:
      `${money(amount)} · ${durations.find(([ms])=>ms===r.rates.passDuration)?.[1]??`${r.rates.passDuration/3600000} hours`} · Current access rules apply · No guaranteed refund`);
  };
  return <article className="gate-editor">
    {loading?<p>Loading route…</p>:pair&&<>
      <h3>{r?.name??"Gate pair"}</h3>
      <div className="gate-endpoints">{[pair.a,pair.b].map(g=><div key={g.id}><strong>{g.name}</strong><span>{g.online?"Online":"Offline"} · {g.itemId}</span></div>)}</div>
      {!r&&owner&&<button disabled={busy||!GATE_DEPLOYMENT} onClick={()=>void prepare({kind:"activate",name},"Enable access control on both gates · Starts paused")}>Set up route</button>}
      {r&&<>
        <div className="gate-stats"><span>{!r.active?"Inactive":!historyReady?"Unverified":r.locked?"Paused":"Active"}</span><span>{GATE_MODES[r.rules.mode]}</span><span>Permit · {money(r.rates.toll)}</span>
          <span>Pass · {r.rates.passDuration?money(r.rates.passPrice):"Off"}</span></div>
        {r.active&&wallet&&<div className="gate-actions"><button disabled={busy||!historyReady||r.locked||!pair.a.online||!pair.b.online} onClick={()=>request("permit")}>Get jump permit</button>
          {!!r.rates.passDuration&&<button disabled={busy||!historyReady||r.locked||!pair.a.online||!pair.b.online||passUntil===null||passUntil>Date.now()} onClick={()=>request("pass")}>Buy timed pass</button>}
          {passUntil!==null&&passUntil>Date.now()&&<span>Pass expires · {when(passUntil)}</span>}</div>}
        {owner&&<>
          <div className="gate-actions"><button disabled={busy||!r.active} onClick={()=>void prepare({kind:"lockdown"},"Pause route and take the first gate offline · All transit stops")}>Emergency lockdown</button>
            <button disabled={busy||!r.active} onClick={()=>void prepare({kind:r.locked?"resume":"pause"},r.locked?"Resume permit issuance · Gates stay at current power state":"Pause new permits · Existing permits remain valid for up to 60s")}>{r.locked?"Resume permits":"Pause permits"}</button>
            {!pair.a.online&&<button disabled={busy} onClick={()=>void prepare({kind:"online",gate:"a"},"Bring first gate online · Unexpired permits may work again")}>First gate online</button>}
            {!pair.b.online&&<button disabled={busy} onClick={()=>void prepare({kind:"online",gate:"b"},"Bring second gate online · Unexpired permits may work again")}>Second gate online</button>}</div>
          {r.active&&<details><summary>Access & pricing</summary><fieldset disabled={busy} onChange={edit}>
            <label>Name<input maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
            <label>Access<select value={rules.mode} onChange={e=>setRules({...rules,mode:Number(e.target.value)})}>{GATE_MODES.map((m,i)=><option key={m} value={i}>{m}</option>)}</select></label>
            <label>Member tribe<input inputMode="numeric" value={rules.memberTribe||""} onChange={e=>setRules({...rules,memberTribe:Number(e.target.value)})}/></label>
            <button type="button" disabled={!character?.tribe} onClick={()=>{edit();setRules({...rules,memberTribe:character?.tribe??0});}}>Use my tribe</button>
            <AccessInputs rules={rules} setRules={setRules}/>
            <AmountInput label="Permit price · $EVE" value={rates.toll} set={toll=>setRates({...rates,toll})}/>
            <label>Timed pass<select value={rates.passDuration} onChange={e=>setRates({...rates,passDuration:Number(e.target.value),passPrice:Number(e.target.value)?rates.passPrice:"0"})}>
              {durations.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
            {!!rates.passDuration&&<AmountInput label="Pass price · $EVE" value={rates.passPrice} set={passPrice=>setRates({...rates,passPrice})}/>}
            <label>Member discount · %<input type="number" min={0} max={100} step={0.01} value={rates.memberDiscountBps/100} onChange={e=>setRates({...rates,memberDiscountBps:Math.round(Number(e.target.value)*100)})}/></label>
            <DateInput label="Opens · UTC" value={rules.startsAt} set={startsAt=>setRules({...rules,startsAt})}/>
            <DateInput label="Closes · UTC" value={rules.endsAt} set={endsAt=>setRules({...rules,endsAt})}/>
            <label>Daily window<select value={rules.dailyStart===rules.dailyEnd?"all":"window"} onChange={e=>setRules({...rules,dailyStart:0,dailyEnd:e.target.value==="all"?0:60})}><option value="all">All day</option><option value="window">Set hours</option></select></label>
            {rules.dailyStart!==rules.dailyEnd&&<><TimeInput label="Daily start · UTC" value={rules.dailyStart} set={dailyStart=>setRules({...rules,dailyStart})}/><TimeInput label="Daily end · UTC" value={rules.dailyEnd} set={dailyEnd=>setRules({...rules,dailyEnd})}/></>}
            <button type="button" onClick={()=>void prepare({kind:"configure",name,rules,rates},"Apply access, prices and schedule · Existing permits remain valid until expiry")}>Review settings</button>
          </fieldset></details>}
        </>}
        <details><summary>Activity & revenue</summary><div className="gate-stats"><span>Permits issued · {r.permitsIssued}</span><span>Passes sold · {r.passesSold}</span>
          <span>Collected · {money(r.collected)}</span><span>Claimed · {money(r.claimed)}</span><span>Available · {money(r.proceeds)}</span></div>
          {owner&&<button disabled={busy||r.proceeds==="0"} onClick={()=>void prepare({kind:"claim"},`Claim ${money(r.proceeds)} to your wallet`)}>Claim proceeds</button>}
          <ul className="gate-activity">{[...r.activity].reverse().map((a,i)=><li key={i}><span>{a.kind?"Pass purchased":"Permit issued"}</span><span>{short(a.character)}</span><span>{money(a.paid)}</span><time>{when(a.timestamp)}</time></li>)}</ul>
        </details>
        {owner&&<details><summary>Route controls</summary>{r.active&&<button disabled={busy} onClick={()=>void prepare({kind:"deactivate"},"Remove route access control · Public transit restored on both gates · Passes become inactive")}>Restore public transit</button>}
          {!r.active&&pair.a.linkedGateId===pair.b.id&&<button disabled={busy} onClick={()=>void prepare({kind:"unlink"},"Unlink both gates · Transit stops")}>Unlink gates</button>}</details>}
      </>}
      {!r&&owner&&<button disabled={busy||!!pair.a.extension||!!pair.b.extension} onClick={()=>void prepare({kind:"unlink"},"Unlink both gates · Transit stops")}>Unlink gates</button>}
    </>}
    {error&&<div role="alert" className="gate-error">{error}</div>}
    {review&&<section className="gate-review"><h4>Confirm {review.action.kind}</h4><p>{review.summary}</p>
      <label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/> Confirm</label>
      <button disabled={busy||!consent} onClick={()=>void submit()}>Sign & apply</button><button disabled={busy} onClick={()=>{setReview(null);setConsent(false);}}>Cancel</button></section>}
    {busy&&<div role="status">Checking…</div>}
  </article>;
}
function AccessInputs({rules:r,setRules}:{rules:GateRules;setRules:(r:GateRules)=>void}) {
  return <>{([["allies","Allied tribes"],["pilots","Allowed pilots · character IDs"],["deniedTribes","Blocked tribes"],["deniedPilots","Blocked pilots · character IDs"]] as const)
    .map(([key,label])=><AccessInput key={key} label={label} initial={r[key].join(", ")} set={text=>setRules({...r,[key]:key==="allies"||key==="deniedTribes"?parts(text).map(Number):parts(text)})}/>)}</>;
}
function AmountInput({label,value,set}:{label:string;value:string;set:(s:string)=>void}) {
  const [text,setText]=useState(()=>formatGateAmount(value)),[error,setError]=useState("");
  return <label>{label}<input aria-label={label} inputMode="decimal" value={text} onChange={e=>{setText(e.target.value);try{const v=parseGateAmount(e.target.value);set(v);setError("");}catch{setError("Invalid amount");set("invalid");}}}/>{error&&<span className="gate-error">{error}</span>}</label>;
}
function DateInput({label,value,set}:{label:string;value:number;set:(n:number)=>void}) {
  return <label>{label}<input type="datetime-local" value={value?new Date(value).toISOString().slice(0,16):""} onChange={e=>set(e.target.value?Date.parse(`${e.target.value}Z`):0)}/></label>;
}
function TimeInput({label,value,set}:{label:string;value:number;set:(n:number)=>void}) {
  return <label>{label}<input type="time" value={`${Math.floor(value/60)}`.padStart(2,"0")+":"+`${value%60}`.padStart(2,"0")} onChange={e=>{const [h,m]=e.target.value.split(":").map(Number);set(h*60+m);}}/></label>;
}

function AccessInput({label,initial,set}:{label:string;initial:string;set:(v:string)=>void}) {
  const [value,setValue]=useState(initial);
  return <label>{label}<textarea aria-label={label} value={value} onChange={e=>{setValue(e.target.value);set(e.target.value);}}/></label>;
}
