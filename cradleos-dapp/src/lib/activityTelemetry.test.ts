import { expect, it } from "vitest";
import { parseActivity } from "./activityTelemetry";
const now = Date.parse("2026-10-09T12:00:00Z");
const current = {schema_version:2,metric:"verified_wallets",window_days:30,since:"2026-09-09T12:00:00Z",generated_at:new Date(now).toISOString(),wallet_coverage_since:"2026-10-09T00:00:00Z",wallet_mau:2,wallet_dau:1,onchain_mau:2,combined_mau:3,onchain_status:"current",onchain_indexed_at:new Date(now-1000).toISOString()};
it("accepts a deduplicated union and real zero",()=>{
 expect(parseActivity(current,now).combined_mau).toBe(3);
 expect(parseActivity({...current,wallet_mau:0,wallet_dau:0,onchain_mau:0,combined_mau:0},now).combined_mau).toBe(0);
});
it("does not accept legacy MAU, invalid counts or impossible union",()=>{
 for(const patch of [{schema_version:1},{wallet_mau:-1},{wallet_dau:3},{combined_mau:5},{combined_mau:1},{combined_mau:"3"},{wallet_mau:NaN},{onchain_mau:0.5}]) expect(()=>parseActivity({...current,...patch},now)).toThrow();
});
it("incomplete chain counts must be explicitly null",()=>{
 for(const onchain_status of ["stale","unavailable"]){
  expect(parseActivity({...current,onchain_status,onchain_mau:null,combined_mau:null},now).combined_mau).toBeNull();
  expect(()=>parseActivity({...current,onchain_status},now)).toThrow();
 }
});
it("rejects stale/future API responses and stale index dressed as current",()=>{
 for(const patch of [{generated_at:new Date(now-120001).toISOString()},{generated_at:new Date(now+30001).toISOString()},{onchain_indexed_at:new Date(now-1500001).toISOString()},{onchain_indexed_at:"bad"}]) expect(()=>parseActivity({...current,...patch},now)).toThrow();
});
