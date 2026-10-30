import { afterEach, describe, expect, it, vi } from 'vitest';
import { CURRENT_WORLD, CURRENT_EVE_COIN_TYPE } from './cycle';
import { TESTNET_CHAIN_ID } from './headerStatus';
import { GATE_DEPLOYMENT } from './gateDeployment';
import { combinedEvents, decodeChainEvent, decodeEventEntity, emptyStream, EVENT_SOURCES, eventAmount, eventLabel, eventMatches,
  eventObjectId, eventSentence, mergeEventPage, readEventPage, streamStatus, tickerEvents, verifyRouteEventTenants, type ChainEvent, type EventPage } from './chainEvents';
const at = Date.parse('2026-10-30T18:30:00Z'), digest = 'BpbjSfQX3BSMaUfddJgHNavKZd3ax3Gnwmezy9S2vQY6';
const oid = (n: number) => '0x' + n.toString(16).padStart(64,'0');
const key = (n: number) => ({ item_id: String(n), tenant: 'stillness' });
const pair = () => ({ source_gate_id: eventObjectId('10'), source_gate_key: key(10), destination_gate_id: eventObjectId('11'), destination_gate_key: key(11) });
const jump = () => ({ ...pair(), character_id: eventObjectId('12'), character_key: key(12) });
const raw = (type = `${CURRENT_WORLD}::gate::JumpEvent`, json: any = jump(), sequenceNumber = 0) => ({ sequenceNumber, timestamp: new Date(at).toISOString(), transaction: { digest }, contents: { type: { repr: type }, json } });
const source = (id: string) => EVENT_SOURCES.find(s => s.id === id)!;
const event = () => decodeChainEvent(raw(), source('gates'))!;
const page = (events = [event()], cursor: string | null = 'a', more = true): EventPage => ({ events, cursor, more, skipped: 0, indexedAt: at, observedAt: at });
function fetcher(nodes: any[] = [raw()], overrides: any = {}) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { chainIdentifier: TESTNET_CHAIN_ID, serviceConfig: { availableRange: { last: { sequenceNumber: 1, timestamp: new Date(at).toISOString() } } }, events: { nodes, pageInfo: { hasPreviousPage: true, startCursor: 'a' } }, ...overrides } }))) as unknown as typeof fetch;
}
afterEach(() => vi.restoreAllMocks());

describe('typed native records', () => {
  it('validates a real captured native jump and preserves direction/identity', () => {
    const e = event(); expect(e.kind).toBe('jump'); expect(e.refs.map(r=>r.role)).toEqual(['Pilot','From','To']);
    expect(eventSentence(e, {})).toBe('Pilot 12 jumped · Gate 10 → Gate 11');
    expect(e.id).toBe(`${digest}#0`);
  });
  it.each(['source_gate_key','destination_gate_key','character_key'])('rejects foreign tenant in %s', field => {
    const data: any = jump(); data[field] = { ...data[field], tenant: 'utopia' };
    expect(()=>decodeChainEvent(raw(undefined,data),source('gates'))).toThrow();
  });
  it('rejects unrelated package types and mismatched derived object keys', () => {
    expect(()=>decodeChainEvent(raw(`${oid(999)}::gate::JumpEvent`),source('gates'))).toThrow();
    expect(()=>decodeChainEvent(raw(undefined,{...jump(),character_id:oid(1)}),source('gates'))).toThrow();
  });
  it.each([{ timestamp: 'yesterday' }, { timestamp: '2025-01-01T00:00:00Z' }, { sequenceNumber: NaN }, { transaction: { digest: 'javascript:alert(1)' } }])('rejects invalid provenance %#', change => {
    expect(()=>decodeChainEvent({...raw(),...change},source('gates'))).toThrow();
  });
  it('keeps separate event positions within a transaction', () => {
    expect(decodeChainEvent(raw(undefined,jump(),1),source('gates'))!.id).not.toBe(event().id);
  });
  it('counts unknown future types as unsupported, not fictional events', () => {
    expect(decodeChainEvent(raw(`${CURRENT_WORLD}::gate::FutureEvent`,{}),source('gates'))).toBeNull();
  });
  it('preserves reported-versus-occurred time and does not infer victim as pilot', () => {
    const json = { key:key(90), killer_id:key(12), victim_id:key(13), reported_by_character_id:key(14), solar_system_id:key(3001), loss_type:{'@variant':'STRUCTURE'}, kill_timestamp: String(at/1000-86400) };
    const e = decodeChainEvent(raw(`${CURRENT_WORLD}::killmail::KillmailCreatedEvent`,json),source('losses'))!;
    expect(e.occurredAt).toBe(at-86400000); expect(e.recordedAt).toBe(at);
    expect(eventSentence(e,{})).toBe('Structure loss reported · Killer 12 → Victim 13 · System 3001');
    expect(e.refs.some(r=>r.itemId==='14')).toBe(false);
    expect(()=>decodeChainEvent(raw(`${CURRENT_WORLD}::killmail::KillmailCreatedEvent`,{...json,kill_timestamp:String(at/1000+3600)}),source('losses'))).toThrow();
  });
  it('does not call an unanchoring a destruction', () => {
    const e = decodeChainEvent(raw(source('structures').type,{assembly_id:eventObjectId('10'),assembly_key:key(10),action:{'@variant':'UNANCHORED'},status:{'@variant':'NULL'}}),source('structures'))!;
    expect(eventSentence(e,{})).toBe('Structure 10 unanchored');
  });
});

describe('supported history reads', () => {
  it('queries bounded backward pages and checks network/watermark', async () => {
    const call=fetcher(); const p=await readEventPage(source('gates'),null,new AbortController().signal,call);
    expect(p.events).toHaveLength(1); expect(p.indexedAt).toBe(at);
    expect(JSON.parse((vi.mocked(call).mock.calls[0][1] as RequestInit).body as string).variables).toEqual({ type:source('gates').type,before:null,count:30 });
  });
  it('rejects HTTP errors, GraphQL partial errors, wrong network, null/invalid pages', async () => {
    const bad = [vi.fn().mockResolvedValue(new Response('{}',{status:429})),vi.fn().mockResolvedValue(new Response(JSON.stringify({errors:[{message:'partial'}],data:{}}))),fetcher([],{chainIdentifier:'wrong'}),fetcher([],{events:null}),fetcher([],{events:{nodes:[],pageInfo:{hasPreviousPage:true,startCursor:'a'}}})];
    for(const f of bad) await expect(readEventPage(source('gates'),null,new AbortController().signal,f)).rejects.toThrow();
  });
  it('rejects duplicate events and stuck cursors', async () => {
    await expect(readEventPage(source('gates'),null,new AbortController().signal,fetcher([raw(),raw()]))).rejects.toThrow();
    await expect(readEventPage(source('gates'),'a',new AbortController().signal,fetcher())).rejects.toThrow();
  });
  it('rejects a record beyond the indexed checkpoint time', async () => {
    await expect(readEventPage(source('gates'),null,new AbortController().signal,fetcher([{...raw(),timestamp:new Date(at+10000).toISOString()}]))).rejects.toThrow();
  });
  it('uses the event-specific index watermark even when the root checkpoint is fresh', async () => {
    vi.spyOn(Date,'now').mockReturnValue(at);
    const staleAt=at-240000;
    const node={...raw(`${CURRENT_WORLD}::gate::GateLinkedEvent`,pair()),timestamp:new Date(staleAt).toISOString()};
    const p=await readEventPage(source('gates'),null,new AbortController().signal,fetcher([node],{
      checkpoint:{sequenceNumber:99,timestamp:new Date(at).toISOString()},
      serviceConfig:{availableRange:{last:{sequenceNumber:90,timestamp:new Date(staleAt).toISOString()}}},
    }));
    const s=mergeEventPage(emptyStream(),p,false);
    expect(s.indexedAt).toBe(staleAt); expect(streamStatus(s,at)).toBe('Stale');
    expect(tickerEvents(s.events,{gates:s},at,false)).toEqual([]);
  });
  it('rejects unavailable or malformed event-index watermarks rather than falling back to the chain head', async () => {
    for(const last of [null,{sequenceNumber:-1,timestamp:new Date(at).toISOString()},{sequenceNumber:1,timestamp:'unknown'}]) {
      await expect(readEventPage(source('gates'),null,new AbortController().signal,fetcher([],{
        checkpoint:{sequenceNumber:99,timestamp:new Date(at).toISOString()},serviceConfig:{availableRange:{last}},
      }))).rejects.toThrow();
    }
  });
  it('accepts proven empty history and does not conflate it with failure', async () => {
    const p=await readEventPage(source('gates'),null,new AbortController().signal,fetcher([],{events:{nodes:[],pageInfo:{hasPreviousPage:false,startCursor:null}}}));
    expect(p.events).toEqual([]); expect(p.more).toBe(false);
  });
  it('merges older pages without resetting newest watermark; detects overlap/cursor cycles', () => {
    const first=mergeEventPage(emptyStream(),page(),false), e={...event(),id:`${digest}#1`,sequence:1,recordedAt:at-1000};
    const next=mergeEventPage(first,{...page([e],'b'),observedAt:at+10000},true);
    expect(next.events).toHaveLength(2); expect(next.observedAt).toBe(at); expect(next.cursors).toEqual(['a','b']);
    expect(()=>mergeEventPage(next,page([],'a'),true)).toThrow();
    expect(()=>mergeEventPage(first,page(),true)).toThrow();
  });
  it('freshness reflects index age, not last matching event age', () => {
    const s=mergeEventPage(emptyStream(),page([{...event(),recordedAt:at-86400000}]),false);
    expect(streamStatus(s,at)).toBe('Current'); expect(streamStatus({...s,indexedAt:at-200000},at)).toBe('Stale');
    expect(streamStatus({...s,error:true},at)).toBe('Stale'); expect(streamStatus({...emptyStream(),error:true},at)).toBe('Unavailable');
    expect(streamStatus(s,at+1000000,true)).toBe('History');
  });
});

describe('route scope, currency and metadata', () => {
  const routeId=oid(90), a=eventObjectId('10'), b=eventObjectId('11');
  const object=(id:string,type:string,fields:any)=>({id,type,version:'1',owner:{kind:3},fields:{id,...fields}} as any);
  const route=(coin=CURRENT_EVE_COIN_TYPE)=>object(routeId,`${GATE_DEPLOYMENT!.originalId}::route::Route<${coin}>`,{name:'Route',gate_a:a,gate_b:b});
  const gate=(item:number,tenant='stillness')=>object(eventObjectId(String(item)),`${CURRENT_WORLD}::gate::Gate`,{key:{item_id:String(item),tenant},metadata:{name:'Gate'}});
  const routeEvent=()=>decodeChainEvent(raw(`${GATE_DEPLOYMENT!.originalId}::route::PassPurchased`,{route_id:routeId,character:eventObjectId('12'),paid:'1234567891',expires_at:at+10000}),source('routes'))!;
  it('requires both typed Stillness gates for route events with no tenant field', async () => {
    const read=vi.fn().mockResolvedValueOnce([route()]).mockResolvedValueOnce([gate(10),gate(11)]);
    await expect(verifyRouteEventTenants([routeEvent()],new AbortController().signal,read)).resolves.toBeUndefined();
    for(const bad of [null,gate(11,'utopia'),object(b,`${CURRENT_WORLD}::storage_unit::StorageUnit`,{key:key(11),metadata:null})]) {
      const read=vi.fn().mockResolvedValueOnce([route()]).mockResolvedValueOnce([gate(10),bad]);
      await expect(verifyRouteEventTenants([routeEvent()],new AbortController().signal,read)).rejects.toThrow();
    }
  });
  it('verifies routes before returning even an otherwise valid event page', async () => {
    const check=vi.fn().mockRejectedValue(Error('tenant proof missing'));
    const node=raw(`${GATE_DEPLOYMENT!.originalId}::route::PassPurchased`,{route_id:routeId,character:eventObjectId('12'),paid:'0',expires_at:at+1000});
    await expect(readEventPage(source('routes'),null,new AbortController().signal,fetcher([node]),check)).rejects.toThrow('tenant proof missing');
  });
  it('does not label arbitrary generic coins as EVE', () => {
    const e=routeEvent();expect(eventAmount(e,{})).toBe('1234567891 units · Token unknown');
    expect(eventAmount(e,{[routeId]:decodeEventEntity(route())!})).toBe('1.234567891 $EVE');
    expect(eventAmount(e,{[routeId]:decodeEventEntity(route('0x2::sui::SUI'))!})).toBe('1.234567891 SUI');
    expect(eventAmount(e,{[routeId]:decodeEventEntity(route(`${oid(22)}::fake::EVE`))!})).toContain('Token unknown');
  });
  it('names cannot impersonate another entity kind or carry control/bidi characters', () => {
    const r=event().refs[0];expect(eventLabel(r,{[r.id]:{kind:'gate',name:'Wrong'}})).toBe('Pilot 12');
    const c=object(r.id,`${CURRENT_WORLD}::character::Character`,{key:key(12),metadata:{name:'A\n\u202eB'}});
    expect(eventLabel(r,{[r.id]:decodeEventEntity(c)!})).toBe('AB');
  });
  it('filters by names, exact gate IDs and verified route endpoints', () => {
    const e=routeEvent(),names={[routeId]:decodeEventEntity(route())!};
    expect(eventMatches(e,a,names)).toBe(true);expect(eventMatches(e,'nomatch',names)).toBe(false);
  });
  it('deduplicates native/custom permit descriptions but preserves a separate jump', () => {
    const e:ChainEvent={...event(),kind:'permit',permitId:oid(9)}, paid={...e,id:`${digest}#1`,sequence:1,paid:'0'};
    const all=combinedEvents({gates:mergeEventPage(emptyStream(),page([e,{...event(),id:`${digest}#2`,sequence:2}]),false),routes:mergeEventPage(emptyStream(),page([paid]),false)});
    expect(all).toHaveLength(2);expect(all.filter(e=>e.kind==='jump')).toHaveLength(1);
  });
  it('ticker excludes stale, historical, old, and routine records', () => {
    const e={...event(),notable:true},s=mergeEventPage(emptyStream(),page([e]),false);
    expect(tickerEvents([e],{gates:s},at,false)).toHaveLength(1);
    expect(tickerEvents([e],{gates:{...s,error:true}},at,false)).toEqual([]);
    expect(tickerEvents([e],{gates:s},at,true)).toEqual([]);
    expect(tickerEvents([{...e,recordedAt:at-86400001}],{gates:s},at,false)).toEqual([]);
    expect(tickerEvents([event()],{gates:s},at,false)).toEqual([]);
  });
});
