# Official league feeds — revised result architecture

Raw Oct21 message1562646187666837565 asks to use league APIs with requests near
result completion. This supersedes PLAN.md's preference for externally signed
league/oracle messages and mandatory independent corroboration. A paid feed or
native league signature is NOT inherently required.

## Model

Official league HTTPS API → our narrowly scoped result reporter → Sui escrow.
TLS authenticates the endpoint to the reporter. Sui authenticates the reporter's
signed transaction; it does NOT independently verify the HTTP response or game.
The league and our reporter are trusted for results. Multiple machines/keys we
control are not independent authorities. The reporter cannot withdraw escrow,
choose payout recipients or edit fixture terms. A dishonest/compromised reporter
could nevertheless attest a false winner; do not claim trustless settlement.

## Low-request workflow

1. Fetch the official schedule before listing: freeze league/game ID, both team
   IDs, UTC start, fixed cutoff, sport-specific winner rules and reporter address.
2. Recheck shortly before cutoff for schedule/participant changes. Never reopen.
   Early start, postponed/rescheduled fixture or ambiguity voids the market.
3. Begin checks near expected finish, e.g. start+3h for an ordinary basketball
   game. This is a polling trigger, never evidence of completion. Batch daily
   scoreboard requests where available. If still live, retry with bounded backoff
   (e.g. 10/20/30min, then hourly) within the fixed deadline. Overtime is included.
4. On explicit official Final with matching IDs and scores, submit a candidate.
   Hold at least2h from ONCHAIN candidate receipt, then retrieve the game again.
   A matching second official Final settles immediately after the hold, strictly
   before the48h deadline; it does not wait until that deadline. Confirmation
   must bind the CURRENT candidate revision and full fixture/score tuple.
   Differing observations advance the revision/reset the onchain delay;
   identical retries are idempotent and do not reset it. Unknown or unavailable
   data cannot pay a winner.
5. Hard deadline original-start+48h: a candidate that has not completed the hold
   and confirmation becomes refund-only. At/after the exact deadline, any still
   unsettled market can only refund. No administrator deadline extension.
   The settled result is terminal; later official corrections do not reopen it.
   One-sided pools, ties/void outcomes and lack of confirmed result refund.

Two matching observations are the disclosed rule, NOT proof of uninterrupted
stability or complete correction history. A paid historical-revision service is
therefore not a blanket prerequisite. Exact postponement/suspension/forfeit and
actual-start checks still depend on the chosen league schema; do not infer
successful validation from schedule time alone.

## Reporter/contract boundaries

- Exact host allowlist; no arbitrary user URL or unvalidated redirects.
- Strict status/schema, fixture IDs, team orientation, finite scores and bounded
  response size/time. Archive observation time, URL, raw response/hash and decision.
- Transaction binds network, package/book/market, frozen terms, candidate revision
  and outcome. Reporter authority is fixed per market before stakes.
- Onchain clock enforces cutoff/hold/deadline. Results must be explicitly final;
  no timer-only winner and no missing-score-as-zero behavior.
- Dedicated limited reporter signer, separate from gas-only payout keeper and
  deployment/admin keys. Reporter/creator addresses cannot wager. This does not
  establish absence of hidden alts or insider influence.
- Permissionless fixed-recipient claims/refunds; no result-admin withdrawal path.

## Live access probes — October21, 2026

- **MLB:** unauthenticated official statsapi.mlb.com schedule request HTTP200.
  Today's queried date had zero games, correctly distinguished from a final.
  Historical date2025-10-31 returned real game813025, explicit Final/F, teamIDs
  119/141, Dodgers3–BlueJays1. This is historical read-path proof, not a new market
  or payout. Raw snapshots+SHA receipts in research/sports-book-20261021/official.
  https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2025-10-31
  The corresponding official `/api/v1.1/game/813025/feed/live` also returned200,
  matching final IDs/scores, `game_finished`, and first-play about.startTime
  2025-11-01T00:09:58.938Z. Scheduled gameDate/dateTime00:00Z is NOT first pitch.
  Play timestamps offer a start-check candidate; verify their semantics on varied
  ordinary/postponed/suspended games before treating them as start evidence.
- **NBA:** cdn.nba.com scoreboard and schedule URLs returned HTTP403 from this
  host. Ordinary sandboxed browser additionally hit ERR_HTTP2_PROTOCOL_ERROR.
  Feed locations are known; accessible production retrieval is NOT yet proven.
  https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json
- **NFL:** indexed first-party Shield documentation describes OAuth2/access
  tokens. Direct documentation fetch currently returns401. Treat as credentialed
  access not verified; do not borrow/extract web-client secrets or claim a free
  supported endpoint. https://api.nfl.com/docs/global/OAuth2/index.html
- **NHL:** api-web.nhle.com score probe returned403; not usable from this host now.

No access-control bypass, paid account, credential purchase or sports deployment
performed. Official-source retrieval is a viable cheaper path; activate only
leagues whose exact result path and cancellation rules are verified. NFL/NBA were
working defaults, not a user-imposed restriction. MLB now has the clearest
confirmed direct-feed route. Existing casino and item rewards remain unchanged.

## Review
Independent native architecture review PASS after pinning revision/idempotency,
onchain hold, immediate fresh matching confirmation and exact-deadline refund
semantics. No implementation/deployment claim. League-specific status/start
normalization and fresh confirmation remain activation checks.
