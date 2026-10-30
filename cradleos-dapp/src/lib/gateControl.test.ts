import { describe, it, expect } from "vitest";
import { GrpcTypes } from "@mysten/sui/grpc";
import { WORLD_PKG } from "../constants";
import { buildGateAction, gateAllows, gatePrice, gateWindowEnd, gateInt, parseGateAmount, formatGateAmount,
  validateGateRules, validateGateRates, decodeGate, assertGatePair, DEFAULT_GATE_RULES, DEFAULT_GATE_RATES,
  assertGateOwner, gatePreviewKey, type Gate, type GateRoute, type GatePair, type GateCharacter } from "./gateControl";
const id=(n:number)=>`0x${n.toString(16).padStart(64,"0")}`;
const dep={packageId:id(99),originalId:id(99),registryId:id(98),worldId:WORLD_PKG};
const c:GateCharacter={id:id(4),address:id(5),tribe:100,tenant:"stillness"};
const a:Gate={id:id(1),version:"1",name:"A",ownerCapId:id(11),parentId:id(21),linkedGateId:id(2),
  extension:`${id(99)}::route::GateAuth`,online:true,itemId:10001,typeId:77,tenant:"stillness"};
const b:Gate={...a,id:id(2),ownerCapId:id(12),name:"B",linkedGateId:id(1),itemId:10002};
const route:GateRoute={id:id(3),version:"2",name:"AB",gateA:a.id,gateB:b.id,capA:a.ownerCapId,capB:b.ownerCapId,
  active:true,locked:false,revision:"7",rules:{...DEFAULT_GATE_RULES,mode:4,memberTribe:100},rates:{...DEFAULT_GATE_RATES,toll:"101",passPrice:"1001",passDuration:3600000,memberDiscountBps:5000},
  passesId:id(6),proceeds:"99",permitsIssued:"1",passesSold:"1",collected:"99",claimed:"0",activity:[]};
const pair:GatePair={a,b,route};
const build=(action:Parameters<typeof buildGateAction>[1],p=pair,ch=c)=>buildGateAction(p,action,ch,c.address,dep);
const calls=(tx:ReturnType<typeof build>)=>tx.getData().commands.filter(x=>x.$kind==="MoveCall").map(x=>x.MoveCall!);
describe("gate access and tariff",()=>{
  it("closed and deny beat friendly/public/tribe",()=>{
    expect(gateAllows({...route.rules,mode:0,pilots:[c.id]},c)).toBe(false);
    expect(gateAllows({...route.rules,deniedPilots:[c.id]},c)).toBe(false);
    expect(gateAllows({...route.rules,deniedTribes:[100],pilots:[c.id]},c)).toBe(false);
  });
  it("tribe, allies and pilot modes are distinct",()=>{
    expect(gateAllows({...route.rules,mode:1},c)).toBe(true);
    expect(gateAllows({...route.rules,mode:1},{...c,tribe:200})).toBe(false);
    expect(gateAllows({...route.rules,mode:2,allies:[200]},{...c,tribe:200})).toBe(true);
    expect(gateAllows({...route.rules,mode:3},c)).toBe(false);
    expect(gateAllows({...route.rules,mode:3,pilots:[c.id]},c)).toBe(true);
    expect(gateAllows({...route.rules,mode:1,memberTribe:0},{...c,tribe:0})).toBe(false);
  });
  it("discounts round up and never apply to an unrelated tribe",()=>{
    expect(gatePrice(route,100,false)).toBe("51"); expect(gatePrice(route,100,true)).toBe("501");
    expect(gatePrice(route,200,false)).toBe("101"); expect(gatePrice(route,0,false)).toBe("101");
  });
  it("zero fee and exact 9-decimal EVE amounts",()=>{
    expect(parseGateAmount("0")).toBe("0"); expect(parseGateAmount("1.000000001")).toBe("1000000001");
    expect(formatGateAmount("1000000001")).toBe("1.000000001");
    expect(formatGateAmount((2n**64n).toString())).toBe("18446744073.709551616");
  });
  it.each(["-1","1e3","0.0000000001","NaN"," 1","18446744074"])("rejects unsafe price %s",s=>expect(()=>parseGateAmount(s)).toThrow());
  it("rejects u64 overflow and unsafe numeric input",()=>{
    expect(()=>gateInt((2n**64n).toString())).toThrow();expect(()=>gateInt(Number.MAX_SAFE_INTEGER+1)).toThrow();
  });
  it("validates duration/discount/tribes/daily clock",()=>{
    expect(()=>validateGateRates({...DEFAULT_GATE_RATES,passPrice:"1"})).toThrow();
    expect(()=>validateGateRates({...DEFAULT_GATE_RATES,memberDiscountBps:10001})).toThrow();
    expect(()=>validateGateRules({...route.rules,allies:[2,2]})).toThrow();
    expect(()=>validateGateRules({...route.rules,dailyEnd:1440})).toThrow();
    expect(()=>validateGateRules({...route.rules,memberTribe:2**32})).toThrow();
  });
  it("absolute and overnight daily windows use exclusive ends",()=>{
    expect(gateWindowEnd({...route.rules,dailyStart:1380,dailyEnd:60},82800000)).toBe(90000000);
    expect(gateWindowEnd({...route.rules,dailyStart:1380,dailyEnd:60},1000)).toBe(3600000);
    expect(()=>gateWindowEnd({...route.rules,dailyStart:60,dailyEnd:120},7200000)).toThrow();
    expect(()=>gateWindowEnd({...route.rules,endsAt:1000},1000)).toThrow();
    expect(gateWindowEnd({...route.rules,endsAt:1001},1000)).toBe(1001);
  });
});
describe("gate transactions",()=>{
  it("both canonical caps borrowed once and returned; no exported witness",()=>{
    const cs=calls(build({kind:"configure",name:"AB",rules:route.rules,rates:route.rates}));
    expect(cs.filter(x=>x.function==="borrow_owner_cap")).toHaveLength(2);
    expect(cs.filter(x=>x.function==="return_owner_cap")).toHaveLength(2);
    expect(cs.map(x=>x.function)).toEqual(["borrow_owner_cap","borrow_owner_cap","rules","rates","configure","return_owner_cap","return_owner_cap"]);
    expect(cs.some(x=>/auth|issue_jump/.test(x.function))).toBe(false);
  });
  it("native offline lockdown is one atomic route call",()=>{
    expect(calls(build({kind:"lockdown"})).map(x=>x.function)).toEqual(["borrow_owner_cap","borrow_owner_cap","lockdown","return_owner_cap","return_owner_cap"]);
  });
  it("buyers never request owner capabilities",()=>{
    for(const kind of ["permit","pass"] as const){const cs=calls(build({kind,amount:"51"}));expect(cs.some(x=>x.function==="borrow_owner_cap")).toBe(false);
      expect(cs[cs.length-1]?.function).toBe(kind==="permit"?"request_permit":"buy_pass");}
  });
  it("activation protects both gates and starts as new route",()=>{
    const cs=calls(build({kind:"activate",name:"AB"},{a:{...a,extension:null},b:{...b,extension:null},route:null}));
    expect(cs.map(x=>x.function)).toContain("create");expect(cs.map(x=>x.function)).toContain("share");
  });
  it("rejects replacing programmed gates",()=>expect(()=>build({kind:"activate",name:"AB"},{...pair,route:null})).toThrow());
  it("rejects signing against stale wallet",()=>expect(()=>build({kind:"claim"},pair,{...c,address:id(8)})).toThrow());
  it("rejects active unlink and asymmetric pair",()=>{
    expect(()=>build({kind:"unlink"})).toThrow();expect(()=>assertGatePair({...pair,b:{...b,linkedGateId:id(7)}},false,dep)).toThrow();
  });
  it("rejects paused/offline/mismatched extension purchase",()=>{
    expect(()=>build({kind:"permit",amount:"51"},{...pair,route:{...route,locked:true}})).toThrow();
    expect(()=>build({kind:"permit",amount:"51"},{...pair,a:{...a,online:false}})).toThrow();
    expect(()=>build({kind:"permit",amount:"51"},{...pair,b:{...b,extension:null}})).toThrow();
  });
  it("different world deployment rejected",()=>expect(()=>buildGateAction(pair,{kind:"claim"},c,c.address,{...dep,worldId:id(44)})).toThrow());
});
describe("supported gate decoding",()=>{
  const raw=()=>({id:a.id,type:`${WORLD_PKG}::gate::Gate`,version:"5",owner:{kind:3,version:1n},fields:{key:{tenant:"stillness",item_id:"10001"},type_id:"77",
    metadata:{name:"Gate"},owner_cap_id:a.ownerCapId,energy_source_id:a.parentId,linked_gate_id:b.id,extension:`${id(99)}::route::GateAuth`,status:{status:{"@variant":"ONLINE"}}}});
  it("reads decorated gRPC extension and native linkage",()=>expect(decodeGate(raw())).toMatchObject({extension:a.extension,linkedGateId:b.id,online:true}));
  it("rejects malformed, wrong-tenant and wrong-type state",()=>{
    const x=raw();x.fields.key.tenant="liminality";expect(()=>decodeGate(x)).toThrow();
    expect(()=>decodeGate({...raw(),type:`${WORLD_PKG}::assembly::Assembly`})).toThrow();
    const y=raw();y.fields.status.status["@variant"]="UNKNOWN";expect(()=>decodeGate(y)).toThrow();
  });
});

describe("native authority and review stability",()=>{
  const api=(kind:number,owner=c.id,target=a.id)=>({ledgerService:{batchGetObjects:()=>({response:Promise.resolve({objects:[{result:{oneofKind:"object",object:GrpcTypes.Object.fromJson({objectId:a.ownerCapId,objectType:`${WORLD_PKG}::access::OwnerCap<${WORLD_PKG}::gate::Gate>`,version:"1",owner:{kind,address:owner},json:{id:a.ownerCapId,authorized_object_id:target}})}}]})})}} as any);
  it.each([1,2])("accepts native character-owned cap kind %s",async kind=>{await expect(assertGateOwner({a,b:a,route:null},c,c.address,api(kind))).resolves.toBeUndefined();});
  it("rejects foreign, shared and mismatched caps",async()=>{for(const client of [api(1,id(66)),api(3),api(1,c.id,id(66))])await expect(assertGateOwner({a,b:a,route:null},c,c.address,client)).rejects.toThrow();});
  it("sales do not invalidate permit quotes but balance invalidates claim",()=>{
    const changed={...pair,route:{...route,version:"10",proceeds:"100",permitsIssued:"3"}};
    expect(gatePreviewKey(changed,{kind:"permit",amount:"51"})).toBe(gatePreviewKey(pair,{kind:"permit",amount:"51"}));
    expect(gatePreviewKey(changed,{kind:"claim"})).not.toBe(gatePreviewKey(pair,{kind:"claim"}));
    expect(gatePreviewKey({...pair,route:{...route,revision:"8"}})).not.toBe(gatePreviewKey(pair));
  });
  it("cannot promise public transit while foreign extension remains",()=>{expect(()=>build({kind:"deactivate"},{...pair,b:{...b,extension:`${id(90)}::other::Auth`}})).toThrow("Another gate policy");});
});
