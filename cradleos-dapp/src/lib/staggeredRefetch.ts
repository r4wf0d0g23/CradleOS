/**
 * staggeredRefetch — chain-update reconciliation helper.
 *
 * After a successful on-chain tx, the dApp needs to refetch the affected
 * queries to show new state. Sui's testnet event indexer typically lags 1-3
 * seconds behind block finality but can occasionally take longer (5-15s for
 * the public RPC under load).
 *
 * Single-shot invalidation often misses: it fires before the indexer has the
 * new event, the refetch returns stale data, and the UI sits frozen on the
 * pre-tx state until something else invalidates the cache.
 *
 * This helper schedules invalidations at 1s, 3s, 6s, 12s, 20s. Optionally
 * accepts a `predicate(data)` that runs after each refetch — if the predicate
 * returns true the schedule short-circuits (we got the expected state).
 *
 * Cleanup: returns a cancel() function. Callers don't have to use it but
 * components can if they unmount during the refetch window.
 */
import type { QueryClient, QueryKey } from "@tanstack/react-query";

const DEFAULT_DELAYS_MS = [1000, 3000, 6000, 12000, 20000];

export interface StaggeredRefetchOptions<TData = unknown> {
  /** React Query client. */
  queryClient: QueryClient;
  /** One or more query keys to invalidate. Each key triggers its own refetch. */
  queryKeys: QueryKey[];
  /** Custom delay schedule in ms (default 1, 3, 6, 12, 20s). */
  delaysMs?: number[];
  /**
   * Optional. After each refetch resolves, the helper inspects the cache for
   * the FIRST queryKey and calls predicate(data). If it returns true, the
   * remaining scheduled invalidations are cancelled. Use for "wait until the
   * new entry appears" or "wait until the count matches expected" flows.
   */
  predicate?: (data: TData | undefined) => boolean;
}

export function staggeredRefetch<TData = unknown>(
  opts: StaggeredRefetchOptions<TData>,
): () => void {
  const { queryClient, queryKeys, delaysMs = DEFAULT_DELAYS_MS, predicate } = opts;
  const timeouts: ReturnType<typeof setTimeout>[] = [];
  let cancelled = false;

  function cancel() {
    cancelled = true;
    for (const t of timeouts) clearTimeout(t);
  }

  for (const delay of delaysMs) {
    const t = setTimeout(async () => {
      if (cancelled) return;
      // Invalidate (and refetch) every key in parallel.
      await Promise.all(
        queryKeys.map(key => queryClient.invalidateQueries({ queryKey: key })),
      );
      // After invalidation completes, check predicate against the first key.
      if (predicate && queryKeys.length > 0 && !cancelled) {
        const data = queryClient.getQueryData<TData>(queryKeys[0]);
        if (predicate(data)) {
          cancel();
        }
      }
    }, delay);
    timeouts.push(t);
  }

  return cancel;
}
