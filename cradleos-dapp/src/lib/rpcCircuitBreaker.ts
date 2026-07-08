/**
 * Sui RPC circuit breaker — proxy → public-fullnode automatic fallback.
 *
 * Why this exists:
 *   `SUI_TESTNET_RPC` (in constants.ts) points at our caching JSON-RPC proxy
 *   on DGX1. The proxy gives us request coalescing + TTL caching + upstream
 *   rotation, dramatically reducing "Failed to fetch" cascades caused by
 *   public-fullnode per-IP rate limiting.
 *
 *   But the proxy is a single point of failure. If DGX1 is down, Tailscale
 *   Funnel hiccups, or the proxy itself crashes, EVERY call fails for every
 *   user — instead of degrading per-user like before.
 *
 *   This circuit breaker watches outgoing RPC calls. After N consecutive
 *   5xx (or network error) responses to the proxy URL, the breaker trips
 *   and subsequent fetches are transparently rewritten to the public
 *   fullnode URL. The breaker resets after a cooldown OR on the next
 *   successful response, so transient proxy hiccups don't permanently
 *   pin everyone to the bare public endpoint.
 *
 * How it works:
 *   `installRpcCircuitBreaker()` is called once at app boot. It monkey-
 *   patches `window.fetch` so any call where the URL starts with the
 *   proxy URL is intercepted. The original Request is preserved, only
 *   the URL is swapped if the breaker is tripped. Non-RPC fetches
 *   (World API, Keeper Reapers Shop, GraphQL, etc.) pass through
 *   completely unmodified.
 *
 * Failure semantics:
 *   - 5xx responses count as failures (server error)
 *   - 4xx responses do NOT count as failures (client error, our problem)
 *   - Network errors (TypeError: Failed to fetch) count as failures
 *   - Successful 2xx response resets the consecutive-failure counter
 *
 * Trip threshold:
 *   3 consecutive failures → trip
 *   45 second cooldown after trip → re-try proxy on next request
 *   On re-try success → counter resets, breaker un-trips
 *   On re-try failure → trip immediately again, cooldown extends
 */

const PROXY_URL = "https://keeper.reapers.shop/sui";
// 2026-07-08: fullnode.testnet.sui.io 404s on everything; BlockVision public
// endpoint verified live with CORS *.
const FALLBACK_URL = "https://sui-testnet-endpoint.blockvision.org";

const FAIL_THRESHOLD = 3;
const COOLDOWN_MS = 45_000;

interface BreakerState {
  consecutiveFailures: number;
  trippedUntil: number;
  totalTrips: number;
  totalFailovers: number;
  lastError: string | null;
}

const state: BreakerState = {
  consecutiveFailures: 0,
  trippedUntil: 0,
  totalTrips: 0,
  totalFailovers: 0,
  lastError: null,
};

let installed = false;
let originalFetch: typeof window.fetch | null = null;

/**
 * Returns true if the breaker is currently tripped (we should use fallback).
 * Pure read, no side effects.
 */
function isTripped(): boolean {
  return Date.now() < state.trippedUntil;
}

/** Should this URL go through the circuit breaker? */
function isProxyTarget(url: string): boolean {
  return typeof url === "string" && url.startsWith(PROXY_URL);
}

/** Rewrite a proxy URL to the public-fullnode URL. */
function failoverUrl(originalUrl: string): string {
  return originalUrl.replace(PROXY_URL, FALLBACK_URL);
}

/** Record a successful response from the proxy. Resets the counter. */
function recordSuccess(): void {
  if (state.consecutiveFailures > 0 || state.trippedUntil > 0) {
    if (state.trippedUntil > 0) {
      // eslint-disable-next-line no-console
      console.info("[rpcCircuitBreaker] proxy recovered, breaker reset");
    }
    state.consecutiveFailures = 0;
    state.trippedUntil = 0;
    state.lastError = null;
  }
}

/** Record a failed response from the proxy. May trip the breaker. */
function recordFailure(reason: string): void {
  state.consecutiveFailures++;
  state.lastError = reason;
  if (state.consecutiveFailures >= FAIL_THRESHOLD && state.trippedUntil < Date.now()) {
    state.trippedUntil = Date.now() + COOLDOWN_MS;
    state.totalTrips++;
    // eslint-disable-next-line no-console
    console.warn(
      `[rpcCircuitBreaker] proxy tripped after ${FAIL_THRESHOLD} failures (last: ${reason}). ` +
      `Falling back to public fullnode for ${COOLDOWN_MS / 1000}s.`
    );
  }
}

/**
 * Install the circuit breaker at app boot. Idempotent — safe to call multiple
 * times; subsequent calls are no-ops.
 *
 * Must be called BEFORE any RPC fetch in the app. Call from `main.tsx`
 * before React renders.
 */
export function installRpcCircuitBreaker(): void {
  if (installed) return;
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;

  installed = true;
  originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Resolve the URL string from the various forms `fetch()` accepts.
    let url: string;
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input instanceof Request) {
      url = input.url;
    } else {
      // Unknown shape — pass through.
      return originalFetch!(input, init);
    }

    // Non-RPC requests pass through completely unmodified.
    if (!isProxyTarget(url)) {
      return originalFetch!(input, init);
    }

    // Breaker is tripped — rewrite to fallback, don't update state.
    if (isTripped()) {
      state.totalFailovers++;
      const newUrl = failoverUrl(url);
      // Preserve the original Request body/headers when we got a Request object.
      if (input instanceof Request) {
        const fallbackRequest = new Request(newUrl, input);
        return originalFetch!(fallbackRequest, init);
      }
      return originalFetch!(newUrl, init);
    }

    // Breaker is closed — try the proxy. Record success/failure.
    try {
      const res = await originalFetch!(input, init);
      if (res.status >= 500) {
        recordFailure(`HTTP ${res.status}`);
      } else {
        recordSuccess();
      }
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      recordFailure(msg);
      throw err;
    }
  };

  // eslint-disable-next-line no-console
  console.info(
    `[rpcCircuitBreaker] installed. proxy=${PROXY_URL} fallback=${FALLBACK_URL} ` +
    `threshold=${FAIL_THRESHOLD} cooldown=${COOLDOWN_MS}ms`
  );
}

/**
 * Read the current breaker state. Useful for diagnostics or a status pill in
 * the UI.
 */
export function getRpcCircuitBreakerState(): Readonly<BreakerState> & {
  installed: boolean;
  isTripped: boolean;
  proxyUrl: string;
  fallbackUrl: string;
} {
  return {
    ...state,
    installed,
    isTripped: isTripped(),
    proxyUrl: PROXY_URL,
    fallbackUrl: FALLBACK_URL,
  };
}

/**
 * Force-reset the breaker. Useful for testing or a manual "retry" button.
 */
export function resetRpcCircuitBreaker(): void {
  state.consecutiveFailures = 0;
  state.trippedUntil = 0;
  state.lastError = null;
}
