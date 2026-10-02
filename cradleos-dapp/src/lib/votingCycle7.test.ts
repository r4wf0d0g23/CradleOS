import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../constants', () => ({CRADLEOS_VOTING_AVAILABLE:true, CRADLEOS_VOTING_PKG:'0x123', CRADLEOS_VOTING_REGISTRY:'0x456', CRADLEOS_VOTING_EVENT_PKGS:['0x123'],CRADLEOS_VOTING_PREVIEW:false,CRADLEOS_WIPE_DATE_ISO:'',CLOCK:'0x6'}));
import { decodeGraphqlBytes, fetchBallotsForElection, encodeApprovalVote, fetchVotingEventAcrossPackages, localTally, encodeSingleChoiceVote, METHOD_OPTIONS, PRIVACY_OPTIONS, buildComputeTallyTx } from './voting';
afterEach(()=>vi.unstubAllGlobals());
const node=(id:string)=>({sequenceNumber:0,timestamp:'2026-10-02T00:00:00Z',transaction:{digest:id},contents:{json:{election_id:id}}});
const response=(nodes:unknown[],more=false,cursor:string|null=null)=>({ok:true,json:async()=>({data:{events:{nodes,pageInfo:{hasPreviousPage:more,startCursor:cursor}}}})});
describe('Cycle 7 voting integrity',()=>{
 it('sorts and deduplicates approvals for the contract validator',()=>expect([...encodeApprovalVote([1,0,1])]).toEqual([2,0,0,0,0,0,0,0,1,0,0,0]));
 it('follows every event page rather than returning a truncated tally',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(response([node('b')],true,'next')).mockResolvedValueOnce(response([node('a')]));vi.stubGlobal('fetch',fetch);
  const events=await fetchVotingEventAcrossPackages('voting','BallotCast',1);expect(events).toHaveLength(2);expect(JSON.parse(fetch.mock.calls[1][1].body).variables.before).toBe('next');
 });
 it('rejects pagination stalls instead of displaying a partial electorate',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response([node('a')],true,'same')));await expect(fetchVotingEventAcrossPackages('voting','BallotCast')).rejects.toThrow(/stalled/);});
 it('does not interpret GraphQL failure as no elections',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({errors:[{message:'unavailable'}]})}));await expect(fetchVotingEventAcrossPackages('voting','ElectionCreated')).rejects.toThrow('unavailable');});
 it('uses the onchain seed to resolve a tie',()=>{
  const votes=[0,1].map(id=>({encodedVote:encodeSingleChoiceVote(id),weight:1n}));expect(localTally(0,[0,1],votes,new Uint8Array(),new Uint8Array([1])).winners).toEqual([1]);
 });
 it('rejects duplicate or manipulated tally inputs before wallet signing',()=>{
  expect(()=>buildComputeTallyTx('0x42',[1,1],[encodeSingleChoiceVote(0),encodeSingleChoiceVote(1)],[1,1])).toThrow(/unique/);
  expect(()=>buildComputeTallyTx('0x42',[1],[encodeSingleChoiceVote(0)],[99])).toThrow(/unique/);
 });
 it('exposes only verified methods and public privacy',()=>{expect(METHOD_OPTIONS.filter(x=>!x.disabled).map(x=>x.value)).toEqual([0,1]);expect(PRIVACY_OPTIONS.filter(x=>!x.disabled).map(x=>x.value)).toEqual([0]);});
});

describe('Official GraphQL ballot encoding',()=>{
 it('decodes actual four-byte ballot base64',()=>expect([...decodeGraphqlBytes('AAAAAA==')]).toEqual([0,0,0,0]));
 it('does not mistake all-hex-looking base64 for hex',()=>expect([...decodeGraphqlBytes('AAAAAAAAAAAAAAAA')]).toEqual(Array(12).fill(0)));
 it('rejects malformed/missing payload instead of making a zero-length vote',()=>{expect(()=>decodeGraphqlBytes(undefined)).toThrow();expect(()=>decodeGraphqlBytes('not-base64!')).toThrow();});
 it('feeds decoded official event bytes into the tally builder',async()=>{
  const event=node('vote');event.contents.json={election_id:'0x42',character_id:7,encoded_vote:'AQAAAA==',weight:'1'} as any;
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response([event])));
  const ballots=await fetchBallotsForElection('0x42');expect([...ballots[0].encodedVote]).toEqual([1,0,0,0]);
  expect(localTally(0,[0,1],ballots).winners).toEqual([1]);
 });
});
