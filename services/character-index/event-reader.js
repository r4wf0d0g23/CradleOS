/** Official GraphQL event reader. Public JSON-RPC event indexing is retired.
 * The adapter preserves the indexer's existing event shape, but cursors remain
 * opaque GraphQL strings. Persistent latest-event markers are separate IDs. */
export async function readEvents(graphql, [filter, cursor, limit = 50, descending = false]) {
  const match = filter.MoveEventType ? { type: filter.MoveEventType } : filter.MoveModule ?
    { module: `${filter.MoveModule.package}::${filter.MoveModule.module}` } : null;
  if (!match) throw new Error("Unsupported event filter");
  if (cursor !== null && cursor !== undefined && typeof cursor !== "string") throw new Error("Incompatible event cursor");
  const count = Math.min(Math.max(Number(limit), 1), 50);
  const field = Object.keys(match)[0];
  const query = `{ events(filter: {${field}: ${JSON.stringify(match[field])}},
    ${descending ? "last" : "first"}: ${count}${cursor ? `, ${descending ? "before" : "after"}: ${JSON.stringify(cursor)}` : ""}) {
      nodes { sequenceNumber timestamp transaction { digest } contents { json } }
      pageInfo { hasNextPage endCursor hasPreviousPage startCursor }
    } }`;
  const { events } = await graphql(query);
  if (!events?.nodes || !events.pageInfo) throw new Error("Incomplete event response");
  const nodes = descending ? [...events.nodes].reverse() : events.nodes;
  const data = nodes.map(n => {
    if (!n.transaction?.digest || !n.contents?.json || n.sequenceNumber == null || !n.timestamp) throw new Error("Unresolved event content");
    return { id: { txDigest: n.transaction.digest, eventSeq: String(n.sequenceNumber) },
      parsedJson: n.contents.json, timestampMs: String(Date.parse(n.timestamp)) };
  });
  const hasNextPage = descending ? events.pageInfo.hasPreviousPage : events.pageInfo.hasNextPage;
  const nextCursor = descending ? events.pageInfo.startCursor : events.pageInfo.endCursor;
  if (hasNextPage && (!nextCursor || nextCursor === cursor)) throw new Error("Event pagination stalled");
  return { data, hasNextPage, nextCursor };
}

/** Capture one newest-first window; never advance past unprocessed events. */
export async function collectEventsSince(readPage, marker, maxPages = 2000, snapshotStartedAt = 0) {
  let cursor = null, latest = null;
  const events = [];
  for (let page = 0; page < maxPages; page++) {
    const result = await readPage(cursor);
    if (!Array.isArray(result?.data)) throw new Error('Incomplete event window');
    if (page === 0) latest = result.data[0]?.id ?? null;
    for (const event of result.data) {
      // Initial snapshot covers state read at/after this time. Scan all events
      // since its START, not its completion, to close the backfill/poll race.
      if (!marker && snapshotStartedAt && Number(event.timestampMs) < snapshotStartedAt) return { events, latest };
      if (marker && event.id.txDigest === marker.txDigest && String(event.id.eventSeq) === String(marker.eventSeq)) return { events, latest };
      events.push(event);
    }
    if (!result.hasNextPage) return { events, latest };
    if (!result.nextCursor || result.nextCursor === cursor) throw new Error('Event window stalled');
    cursor = result.nextCursor;
  }
  throw new Error('Event window limit reached; marker unchanged');
}
