import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SPORTS_RELEASE, normalizeSportsFixture as normalize, proposeSportsTerms as propose,
  inspectSportsResult as inspect, sportsDiscoveryUrl } from './sportsBook';
const receipt = (league: string) => JSON.parse(readFileSync(new URL(`../../../deploy/sports-book-20261021/${league}-discovery.json`, import.meta.url), 'utf8'));
// Recorded public discovery data is not authenticated outcome evidence.
const nflRaw = receipt('nfl').events[0];
const nbaFinal = receipt('nba').events.find((e: any) => e.status.type.completed === true);
const fresh = () => structuredClone(nflRaw);
const f = normalize('nfl', nflRaw), now = f.start - 3600;
const terms = propose(f, now);
function resultFixture(home = 21, away = 14) {
  const raw = fresh();
  raw.status.type = raw.competitions[0].status.type = { name: 'STATUS_FINAL', state: 'post', completed: true };
  for (const t of raw.competitions[0].competitors) t.score = String(t.homeAway === 'home' ? home : away);
  return normalize('nfl', raw);
}
const check = (fixture = resultFixture(), time = f.start + 15000, observedAt = time) => inspect(terms, { fixture, observedAt }, time);
describe('fixed sports discovery, not payouts', () => {
  it('recognizes both live NFL opponents by ID, not array order', () => {
    const raw = fresh(); raw.competitions[0].competitors.reverse();
    expect(normalize('nfl', raw)).toEqual(f); expect(f.homeId).not.toBe(f.awayId);
  });
  it('reads a real NBA final snapshot without authenticating it', () => {
    const n = normalize('nba', nbaFinal); expect(n.state).toBe('final'); expect(n.homeScore).not.toBeNull();
  });
  it('freezes exact timing and both ends', () => {
    expect(terms.closes).toBe(f.start - 300); expect(terms.proofDeadline).toBe(f.start + 172800);
    expect(Object.isFrozen(terms.fixture)).toBe(true); expect(Object.isFrozen(terms)).toBe(true);
  });
  it('does not enable signing or settlement based on public data', () => {
    expect(SPORTS_RELEASE.wageringEnabled).toBe(false); expect(SPORTS_RELEASE.settlementEnabled).toBe(false);
    expect(check()).toMatchObject({ status: 'result-candidate', outcome: 'home', authenticated: false });
  });
  it('preserves away winner including overtime', () => {
    const raw = fresh(); raw.status.type = raw.competitions[0].status.type = { name: 'STATUS_FINAL_OVERTIME', state: 'post', completed: true };
    for (const t of raw.competitions[0].competitors) t.score = t.homeAway === 'home' ? '21' : '24';
    expect(check(normalize('nfl', raw)).outcome).toBe('away');
  });
  it('treats equal final score as a refund candidate', () => expect(check(resultFixture(14,14)).status).toBe('refund-candidate'));
  it('never uses a scheduled/live score as final', () => expect(check(f).status).toBe('awaiting'));
  it('refunds when exact participants or season change', () => {
    for (const replacement of [{homeId:'99'}, {awayId:'99'}, {season:2027}, {eventId:'999'}, {league:'nba' as const}])
      expect(check({...resultFixture(),...replacement}).status).toBe('refund-candidate');
  });
  it('refunds changed start, even when event ID remains', () => expect(check({...resultFixture(),start:f.start+3600}).reason).toBe('Rescheduled'));
  it('does not act on stale or future observations', () => {
    const t=f.start+15000;
    expect(check(resultFixture(),t,t-121).status).toBe('awaiting');
    expect(check(resultFixture(),t,t+1).status).toBe('awaiting');
  });
  it('does not accept a final result before start', () => expect(check(resultFixture(),now).status).toBe('awaiting'));
  it('expires at the deadline, not one second later', () => expect(check(resultFixture(),terms.proofDeadline).reason).toBe('Proof deadline elapsed'));
  it('deadline dominates stale/future observations', () => {
    for (const seen of [now,terms.proofDeadline+1]) expect(check(f,terms.proofDeadline,seen).reason).toBe('Proof deadline elapsed');
  });
  it('rejects calendar rollover dates', () => {
    const raw=fresh();raw.date=raw.competitions[0].date='2026-02-30T12:00Z';expect(()=>normalize('nfl',raw)).toThrow('Invalid calendar date');
  });
  it('rejects repeated/missing opponents', () => {
    const raw=fresh();raw.competitions[0].competitors.pop();expect(()=>normalize('nfl',raw)).toThrow();
    const other=fresh();other.competitions[0].competitors[1].id=other.competitions[0].competitors[0].id;expect(()=>normalize('nfl',other)).toThrow();
  });
  it('rejects an incorrect league/event namespace', () => expect(()=>normalize('nba',nflRaw)).toThrow());
  it('rejects multi-game/ambiguous events', () => {
    const raw=fresh();raw.competitions.push(raw.competitions[0]);expect(()=>normalize('nfl',raw)).toThrow();
  });
  it('rejects uncertain start and inconsistent final flags', () => {
    const raw=fresh();raw.competitions[0].timeValid=false;expect(()=>normalize('nfl',raw)).toThrow();
    const other=fresh();other.status.type.completed=true;expect(()=>normalize('nfl',other)).toThrow();
  });
  it('keeps missing score distinct from zero; rejects malformed scores', () => {
    const raw=fresh();raw.competitions[0].competitors[0].score=null;expect(normalize('nfl',raw).homeScore).toBeNull();
    for (const score of ['NaN','-1','1.5','',null]) {
      const bad=structuredClone(nbaFinal);bad.competitions[0].competitors[0].score=score;expect(()=>normalize('nba',bad)).toThrow();
    }
  });
  it('does not reopen, propose live games, or accept arbitrary sports', () => {
    expect(()=>propose(f,f.start-599)).toThrow();expect(()=>propose({...f,state:'live'},now)).toThrow();
    expect(()=>sportsDiscoveryUrl('custom' as any)).toThrow();
  });
  it('uses only closed allowlisted discovery endpoints', () => {
    expect(sportsDiscoveryUrl('nfl')).toBe('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
    expect(sportsDiscoveryUrl('nba')).toContain('/basketball/nba/');
  });
});
