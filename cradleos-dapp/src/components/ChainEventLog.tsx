import { useEffect, useState } from 'react';
import { useChainEvents } from '../contexts/ChainEventsContext';
import { eventAmount, eventIdentity, eventMatches, eventSentence, eventSentenceParts, EVENT_MAX_PAGES, EVENT_SOURCES, streamStatus, tickerEvents, type ChainEvent, type EntityNames, type EventRef } from '../lib/chainEvents';
import './ChainEventLog.css';

const timestamp = (ms: number) => new Date(ms).toLocaleString();
export function ChainEventLog() {
  const feed = useChainEvents();
  const [category, setCategory] = useState('All');
  useEffect(()=>setCategory('All'),[feed.focusVersion]);
  const shown = feed.events.filter(e => (category === 'All' || e.category === category) && eventMatches(e, feed.query, feed.names));
  const jumps = shown.filter(e => e.kind === 'jump');
  const pilots = new Set(jumps.flatMap(e => e.refs.filter(r => r.role === 'Pilot').map(r => r.id)));
  const more = Object.values(feed.streams).some(s => !s.pages || s.more && s.pages < EVENT_MAX_PAGES);
  const initial = !Object.values(feed.streams).some(s => s.pages);
  const broken = Object.values(feed.streams).some(s => s.error);
  return <section className="chain-log" aria-label="Chain event log">
    <header><h2>Event log</h2><span>Stillness · Testnet</span><button disabled={feed.busy} onClick={feed.refresh}>{feed.busy ? 'Loading…' : 'Refresh latest'}</button></header>
    <div className="chain-source-status">{EVENT_SOURCES.map(source => <span key={source.id} data-state={streamStatus(feed.streams[source.id],feed.now,feed.history)}>{source.label} · {streamStatus(feed.streams[source.id],feed.now,feed.history)}</span>)}</div>
    <div className="chain-log-filters"><input aria-label="Search chain events" placeholder="Pilot, gate, name, ID or transaction…" value={feed.query} onChange={e => feed.setQuery(e.target.value)} />
      <select aria-label="Event category" value={category} onChange={e => setCategory(e.target.value)}>{['All','Jumps','Gates','Structures','Access','Payments','Losses'].map(c=><option key={c}>{c}</option>)}</select>
      {(feed.query || category !== 'All') && <button onClick={()=>{feed.setQuery('');setCategory('All');}}>Clear</button>}
    </div>
    <div className="chain-log-counts"><span>Loaded events · {initial?'—':shown.length}</span><span>Loaded jumps · {initial?'—':jumps.length}</span><span>Loaded unique pilots · {initial?'—':pilots.size}</span>
      {feed.history && <span>History snapshot</span>}{feed.namesFailed && <span>Names unavailable</span>}
      {Object.values(feed.streams).some(s=>s.skipped) && <span>Unsupported events omitted</span>}
    </div>
    {broken && <div role="status">Some sources unavailable · Retry with Refresh latest</div>}
    {!shown.length ? <p>{initial && feed.busy ? 'Loading events…' : initial && broken ? 'Events unavailable' : 'No matching events loaded'}</p>
      : <ol className="chain-event-list">{shown.map(e => <EventRow key={e.id} event={e} />)}</ol>}
    {more && !initial && <button className="chain-load-older" disabled={feed.busy} onClick={feed.older}>Load older</button>}
    {!more && Object.values(feed.streams).some(s=>s.more) && <span>History limit reached</span>}
  </section>;
}
function EntityLabel({ entity, names }: { entity: EventRef; names: EntityNames }) {
  const identity = eventIdentity(entity,names);
  return <span className="chain-entity" data-identified={identity.identified}>{identity.label}</span>;
}
function EventText({ event, names }: { event: ChainEvent; names: EntityNames }) {
  return <>{eventSentenceParts(event,names).map((part,i)=>typeof part==='string' ? part : <EntityLabel key={i} entity={part} names={names} />)}</>;
}
function EventRow({ event: e }: { event: ChainEvent }) {
  const { names } = useChainEvents(), amount = eventAmount(e, names);
  return <li data-event-id={e.id} data-kind={e.kind}>
    <div className="chain-event-meta"><time dateTime={new Date(e.recordedAt).toISOString()}>{timestamp(e.recordedAt)}</time><span>{e.category}</span>
      <a href={`https://suiscan.xyz/testnet/tx/${e.digest}`} target="_blank" rel="noreferrer">Transaction ↗</a></div>
    <div className="chain-event-text"><EventText event={e} names={names} /></div>
    {amount && e.kind !== 'claimed' && <div className="chain-event-amount">Paid · {amount}</div>}
    {e.occurredAt !== undefined && <div className="chain-event-occurred">Occurred · {timestamp(e.occurredAt)} · Recorded above</div>}
    <details><summary>Details</summary><dl>
      {e.refs.map((r,i)=><div key={`${r.role}:${i}`}><dt>{r.role}</dt><dd><EntityLabel entity={r} names={names} /><code>{r.id}</code></dd></div>)}
      {e.expiresAt !== undefined && <div><dt>Expires</dt><dd>{timestamp(e.expiresAt)}</dd></div>}
      <div><dt>Event</dt><dd><code>{e.type}</code></dd></div>
      <div><dt>Record</dt><dd><code>{e.id}</code></dd></div>
      <div><dt>Names</dt><dd>Current metadata</dd></div>
    </dl></details>
  </li>;
}
export function ChainEventTicker({ onOpen }: { onOpen: (query?: string) => void }) {
  const feed = useChainEvents();
  const [paused,setPaused] = useState(()=>{try{return localStorage.getItem('cradleos:chain-ticker-paused')==='true';}catch{return false;}});
  const events = tickerEvents(feed.events,feed.streams,feed.now,feed.history);
  const state = feed.history ? 'History snapshot' : Object.values(feed.streams).every(s=>streamStatus(s,feed.now)==='Current') ? 'No recent highlights'
    : Object.values(feed.streams).some(s=>s.pages) ? 'Feed partial / stale' : feed.busy ? 'Loading…' : 'Feed unavailable';
  const toggle = () => { const value=!paused;setPaused(value);try{localStorage.setItem('cradleos:chain-ticker-paused',String(value));}catch{/* Preference optional. */} };
  return <aside className="chain-ticker" aria-label="Notable chain events" data-paused={paused}>
    <button className="chain-ticker-open" onClick={()=>onOpen()}>Event log</button>
    {events.length>0 && Object.values(feed.streams).some(s=>streamStatus(s,feed.now)!=='Current') && <span className="chain-ticker-empty">Partial</span>}
    <div className="chain-ticker-window">
      {events.length ? <div className="chain-ticker-track" style={{animationDuration:`${Math.max(45,events.reduce((n,e)=>n+eventSentence(e,feed.names).length,0)/9)}s`}}>
        <div className="chain-ticker-group">{events.map(e=><button key={e.id} onClick={()=>onOpen(e.digest)}><time>{timestamp(e.recordedAt)}</time> · <EventText event={e} names={feed.names} /></button>)}</div>
        <div className="chain-ticker-group chain-ticker-copy" aria-hidden="true" inert>{events.map(e=><span key={e.id}>{timestamp(e.recordedAt)} · <EventText event={e} names={feed.names} /></span>)}</div>
      </div> : <span className="chain-ticker-empty">{state}</span>}
    </div>
    <button className="chain-ticker-pause" onClick={toggle} aria-label={paused?'Resume event ticker':'Pause event ticker'} aria-pressed={paused}>{paused?'Resume':'Pause'}</button>
  </aside>;
}
