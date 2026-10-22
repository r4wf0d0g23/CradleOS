/** Read-only sports discovery. These values are NEVER settlement proofs. */
export type SportsLeague = 'nfl' | 'nba';
export const SPORTS_RELEASE = Object.freeze({
  chain: 'testnet', wageringEnabled: false, settlementEnabled: false,
  status: 'Result oracle not connected',
} as const);
const LEAGUES = {
  nfl: { sport: 'football', uid: 's:20~l:28~e:' },
  nba: { sport: 'basketball', uid: 's:40~l:46~e:' },
} as const;
export type SportsFixture = Readonly<{
  provider: 'espn-discovery'; league: SportsLeague; season: number;
  eventId: string; homeId: string; awayId: string; home: string; away: string;
  start: number; state: 'scheduled' | 'live' | 'final' | 'void' | 'unknown';
  homeScore: number | null; awayScore: number | null;
}>;
export type SportsTerms = Readonly<{
  rule: 'match-winner-including-overtime-v1'; fixture: SportsFixture;
  closes: number; proofDeadline: number; correctionSeconds: 7200;
}>;
type Obj = Record<string, unknown>;
function obj(v: unknown): Obj {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('Invalid sports data');
  return v as Obj;
}
function id(v: unknown): string {
  if (typeof v !== 'string' || !/^[1-9]\d{0,19}$/.test(v)) throw Error('Invalid sports ID');
  return v;
}
function name(v: unknown): string {
  if (typeof v !== 'string' || !v.trim() || v.length > 100 || /[\x00-\x1f<>]/.test(v)) throw Error('Invalid team name');
  return v;
}
function integer(v: unknown, min = 0, max = 10000): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max) throw Error('Invalid sports number');
  return v;
}
function timestamp(v: unknown): number {
  if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?Z$/.test(v)) throw Error('UTC start required');
  const n = Date.parse(v) / 1000;
  if (!Number.isSafeInteger(n) || n <= 0) throw Error('Invalid start');
  const canonical = new Date(n * 1000).toISOString().replace('.000Z', 'Z');
  if (canonical !== (v.length === 17 ? v.slice(0, -1) + ':00Z' : v)) throw Error('Invalid calendar date');
  return n;
}
function score(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || !/^(0|[1-9]\d{0,3})$/.test(v)) throw Error('Invalid score');
  return integer(Number(v));
}
function leagueInfo(league: SportsLeague) {
  if (league !== 'nfl' && league !== 'nba') throw Error('Unsupported league');
  return LEAGUES[league];
}
export function sportsDiscoveryUrl(league: SportsLeague): string {
  return `https://site.api.espn.com/apis/site/v2/sports/${leagueInfo(league).sport}/${league}/scoreboard`;
}
export function normalizeSportsFixture(league: SportsLeague, raw: unknown): SportsFixture {
  const info = leagueInfo(league), e = obj(raw), eventId = id(e.id);
  if (e.uid !== `${info.uid}${eventId}`) throw Error('League/event mismatch');
  if (!Array.isArray(e.competitions) || e.competitions.length !== 1) throw Error('Ambiguous event');
  const c = obj(e.competitions[0]), start = timestamp(e.date);
  if (id(c.id) !== eventId || timestamp(c.date) !== start || c.timeValid !== true) throw Error('Unfixed fixture');
  if (!Array.isArray(c.competitors) || c.competitors.length !== 2) throw Error('Two teams required');
  const teams = c.competitors.map(obj);
  const home = teams.find(t => t.homeAway === 'home'), away = teams.find(t => t.homeAway === 'away');
  if (!home || !away || home.type !== 'team' || away.type !== 'team') throw Error('Fixed opponents required');
  const ht = obj(home.team), at = obj(away.team), homeId = id(home.id), awayId = id(away.id);
  if (id(ht.id) !== homeId || id(at.id) !== awayId || homeId === awayId) throw Error('Team mismatch');
  const status = obj(obj(e.status).type), cs = obj(obj(c.status).type);
  if (status.name !== cs.name || status.state !== cs.state || status.completed !== cs.completed) throw Error('Conflicting status');
  let state: SportsFixture['state'] = 'unknown';
  if (status.name === 'STATUS_SCHEDULED' && status.state === 'pre' && status.completed === false) state = 'scheduled';
  if (status.name === 'STATUS_IN_PROGRESS' && status.state === 'in' && status.completed === false) state = 'live';
  if (['STATUS_FINAL', 'STATUS_FINAL_OVERTIME'].includes(String(status.name)) && status.state === 'post' && status.completed === true) state = 'final';
  if (['STATUS_CANCELED', 'STATUS_CANCELLED', 'STATUS_POSTPONED', 'STATUS_ABANDONED'].includes(String(status.name))) state = 'void';
  const homeScore = score(home.score), awayScore = score(away.score);
  if (state === 'final' && (homeScore === null || awayScore === null)) throw Error('Final scores missing');
  return Object.freeze({ provider: 'espn-discovery', league, season: integer(obj(e.season).year, 2000, 2200),
    eventId, homeId, awayId, home: name(ht.displayName), away: name(at.displayName), start, state, homeScore, awayScore });
}
/** Freezes a proposed fixture only. Does not create an onchain market. */
export function proposeSportsTerms(fixture: SportsFixture, now: number): SportsTerms {
  integer(now, 1, Number.MAX_SAFE_INTEGER); leagueInfo(fixture.league);
  if (fixture.state !== 'scheduled' || fixture.start < now + 600 || fixture.start > now + 2592000) throw Error('Fixture not open');
  return Object.freeze({ rule: 'match-winner-including-overtime-v1', fixture: Object.freeze({ ...fixture }),
    closes: fixture.start - 300, proofDeadline: fixture.start + 172800, correctionSeconds: 7200 });
}
export type SportsObservation = Readonly<{ fixture: SportsFixture; observedAt: number }>;
/** Conservative discovery check; a candidate is NOT permission to pay. */
export function inspectSportsResult(terms: SportsTerms, observation: SportsObservation, now: number):
  { status: 'awaiting' | 'refund-candidate' | 'result-candidate'; outcome: 'home' | 'away' | null; reason: string; authenticated: false } {
  integer(now, 1, Number.MAX_SAFE_INTEGER); integer(observation.observedAt, 1, Number.MAX_SAFE_INTEGER);
  const result = (status: 'awaiting' | 'refund-candidate' | 'result-candidate', reason: string, outcome: 'home' | 'away' | null = null) => ({status, reason, outcome, authenticated: false as const});
  if (now >= terms.proofDeadline) return result('refund-candidate', 'Proof deadline elapsed');
  if (observation.observedAt > now || now - observation.observedAt > 120) return result('awaiting', 'Stale or future observation');
  const a = terms.fixture, b = observation.fixture;
  if (a.provider !== b.provider || a.league !== b.league || a.season !== b.season || a.eventId !== b.eventId || a.homeId !== b.homeId || a.awayId !== b.awayId) return result('refund-candidate', 'Fixture identity changed');
  if (a.start !== b.start) return result('refund-candidate', 'Rescheduled');
  if (b.state === 'void') return result('refund-candidate', 'Canceled or postponed');
  if (now < a.start || b.state !== 'final') return result('awaiting', 'Final result pending');
  if (b.homeScore === null || b.awayScore === null) return result('awaiting', 'Scores unavailable');
  if (b.homeScore === b.awayScore) return result('refund-candidate', 'Tie');
  return result('result-candidate', 'Requires authenticated result, actual-start evidence and correction window', b.homeScore > b.awayScore ? 'home' : 'away');
}
