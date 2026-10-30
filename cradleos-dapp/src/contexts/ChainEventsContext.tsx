import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { combinedEvents, emptyStream, EVENT_MAX_PAGES, EVENT_SOURCES, mergeEventPage, readEventNames, readEventPage,
  type EntityNames, type EventStream } from '../lib/chainEvents';

function useEventFeed() {
  const [streams, setStreams] = useState<Record<string, EventStream>>(() => Object.fromEntries(EVENT_SOURCES.map(s => [s.id, emptyStream()])));
  const [names, setNames] = useState<EntityNames>({}), [namesFailed, setNamesFailed] = useState(false);
  const [history, setHistory] = useState(false), [busy, setBusy] = useState(false), [now, setNow] = useState(Date.now);
  const [query, setQuery] = useState(''), [focusVersion, setFocusVersion] = useState(0);
  const state = useRef(streams), historical = useRef(false), running = useRef(false), mounted = useRef(false), generation = useRef(0), controller = useRef<AbortController | null>(null);
  const load = useCallback(async (older = false) => {
    if (running.current || !mounted.current) return;
    running.current = true; setBusy(true);
    const g = generation.current, abort = new AbortController(); controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 25_000);
    historical.current = older; setHistory(older);
    const prior = state.current;
    const selected = EVENT_SOURCES.filter(s => !older || !prior[s.id].pages || prior[s.id].more && prior[s.id].pages < EVENT_MAX_PAGES);
    try {
      const results = await Promise.allSettled(selected.map(async source => {
        const previous = prior[source.id], append = older && previous.pages > 0;
        const page = await readEventPage(source, append ? previous.cursor : null, abort.signal);
        return { id: source.id, value: mergeEventPage(previous, page, append) };
      }));
      if (!mounted.current || g !== generation.current) return;
      const next = { ...prior };
      results.forEach((result, i) => {
        const source = selected[i];
        if (result.status === 'fulfilled') next[source.id] = result.value.value;
        else next[source.id] = { ...prior[source.id], error: true };
      });
      state.current = next; setStreams(next); setNow(Date.now());
      const metadata = await readEventNames(combinedEvents(next), abort.signal);
      if (mounted.current && g === generation.current) { setNames(metadata.names); setNamesFailed(metadata.failed); }
    } catch { if (mounted.current && g === generation.current) setNamesFailed(true); }
    finally { clearTimeout(timeout); if (g === generation.current) { running.current = false; controller.current = null; if (mounted.current) setBusy(false); } }
  }, []);
  useEffect(() => {
    generation.current++; mounted.current = true; void load();
    const poll = setInterval(() => { if (!document.hidden && !historical.current) void load(); }, 60_000);
    const tick = setInterval(() => setNow(Date.now()), 5000);
    const visible = () => { setNow(Date.now()); if (!document.hidden && !historical.current) void load(); };
    document.addEventListener('visibilitychange', visible);
    return () => { mounted.current = false; generation.current++; controller.current?.abort(); running.current = false; clearInterval(poll); clearInterval(tick); document.removeEventListener('visibilitychange', visible); };
  }, [load]);
  return { streams, names, namesFailed, history, busy, now, query, setQuery, focusVersion,
    focus: (text: string) => { setQuery(text); setFocusVersion(n=>n+1); },
    events: combinedEvents(streams), refresh: () => load(), older: () => load(true) };
}
const Context = createContext<ReturnType<typeof useEventFeed> | null>(null);
export function ChainEventsProvider({ children }: { children: ReactNode }) { return <Context.Provider value={useEventFeed()}>{children}</Context.Provider>; }
export function useChainEvents() { const value = useContext(Context); if (!value) throw Error('Missing chain event provider'); return value; }
