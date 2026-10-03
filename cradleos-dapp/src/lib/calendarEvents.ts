// Previous releases persisted these built-in rows alongside player-created events.
// Match exact reserved IDs, never titles or dates: real player events must survive.
const RETIRED_EVENT_IDS = new Set([
  "hk-start", "hk-build", "hk-deadline", "hk-deploy",
  "hk-vote", "hk-judging", "hk-winners",
]);

export function withoutRetiredCalendarEvents<T extends { id: string }>(events: T[]): T[] {
  return events.filter(event => !RETIRED_EVENT_IDS.has(event.id));
}
