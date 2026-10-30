import { describe,it,expect,vi } from "vitest";
import { verifyGateHistory, type GraphRead } from "./gateHistory";
import { WORLD_PKG } from "../constants";
const id=(n:number)=>`0x${n.toString(16).padStart(64,"0")}`;
const gate={id:id(1),version:"2",ownerCapId:id(11)},d={packageId:id(99),originalId:id(99),registryId:id(98),worldId:WORLD_PKG};
const route={id:id(3),gateA:id(1),gateB:id(2)};
const event=(type:string,json:unknown)=>({contents:{type:{repr:type},json}});
const created=event(`${WORLD_PKG}::gate::GateCreatedEvent`,{assembly_id:gate.id,owner_cap_id:gate.ownerCapId});
const auth=(extension=`${id(99)}::route::GateAuth`)=>event(`${WORLD_PKG}::gate::ExtensionAuthorizedEvent`,{assembly_id:gate.id,extension_type:extension});
const routeCreated=event(`${id(99)}::route::RouteCreated`,{route_id:route.id,gate_a:route.gateA,gate_b:route.gateB});
const page=(nodes:any[],more=false,cursor:string|null=null)=>({nodes,pageInfo:{hasNextPage:more,endCursor:cursor}});
const version=(v:number,events:any[])=>({version:v,previousTransaction:{digest:`tx${v}`,effects:{events:page(events)}}});
const read=(nodes:any[]):GraphRead=>vi.fn(async()=>({objectVersions:page(nodes)}));
describe("archival gate admission",()=>{
  it("proves first creation through last current version",async()=>expect(await verifyGateHistory(gate,null,d,read([version(1,[created]),version(2,[])]))).toBeNull());
  it("allows only this route's creation witness in same transaction",async()=>expect(await verifyGateHistory(gate,route,d,read([version(1,[created]),version(2,[auth(),routeCreated])]))).toBe("tx2"));
  it("rejects previous authorization even if later revoked",async()=>expect(verifyGateHistory(gate,null,d,read([version(1,[created,auth()]),version(2,[])]))).rejects.toThrow("Previously"));
  it("rejects other extension and manual authorization without creation",async()=>{
    await expect(verifyGateHistory(gate,route,d,read([version(1,[created]),version(2,[auth(`${id(8)}::evil::Auth`),routeCreated])]))).rejects.toThrow();
    await expect(verifyGateHistory(gate,route,d,read([version(1,[created]),version(2,[auth()])]))).rejects.toThrow();
  });
  it("rejects truncated early or recent history",async()=>{
    await expect(verifyGateHistory(gate,null,d,read([version(2,[])]))).rejects.toThrow("incomplete");
    await expect(verifyGateHistory(gate,null,d,read([version(1,[created])]))).rejects.toThrow("incomplete");
  });
  it("rejects current mutation racing past snapshot",async()=>expect(verifyGateHistory(gate,null,d,read([version(1,[created]),version(3,[])]))).rejects.toThrow("changed"));
  it("requires complete version pagination",async()=>{
    const reader:GraphRead=vi.fn(async(_q,v)=>({objectVersions:v.after?page([version(2,[])]):page([version(1,[created])],true,"v1")}));
    await expect(verifyGateHistory(gate,null,d,reader)).resolves.toBeNull();expect(reader).toHaveBeenCalledTimes(2);
  });
  it("searches authorization beyond first event page",async()=>{
    const v=version(1,[created]);v.previousTransaction.effects.events=page([created],true,"ev1");
    const reader:GraphRead=vi.fn(async(q)=>q.includes("objectVersions")?{objectVersions:page([v,version(2,[])])}:{transaction:{effects:{events:page([auth()])}}});
    await expect(verifyGateHistory(gate,null,d,reader)).rejects.toThrow("Previously");
  });
  it("never treats transport failure or stalled cursor as no history",async()=>{
    await expect(verifyGateHistory(gate,null,d,async()=>{throw Error("network");})).rejects.toThrow("network");
    const reader:GraphRead=async()=>({objectVersions:page([version(1,[created])],true,"stuck")});
    await expect(verifyGateHistory(gate,null,d,reader)).rejects.toThrow();
  });
  it("rejects missing events/page metadata and another cap",async()=>{
    const v=version(1,[created]);(v.previousTransaction.effects as any).events=null;
    await expect(verifyGateHistory(gate,null,d,read([v,version(2,[]) ]))).rejects.toThrow();
    await expect(verifyGateHistory({...gate,ownerCapId:id(9)},null,d,read([version(1,[created]),version(2,[]) ]))).rejects.toThrow();
  });
});
