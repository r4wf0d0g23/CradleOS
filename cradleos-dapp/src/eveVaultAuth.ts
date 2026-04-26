/**
 * eveVaultAuth — shared helper for requesting an EVE Vault auth token via
 * the extension's postMessage protocol.
 *
 * The EVE Vault browser extension authenticates the connected pilot with
 * EVE Frontier's official identity provider. Web dApps interact with it
 * via window.postMessage:
 *
 *   1. dApp posts:    { __to: "Eve Vault", action: "dapp_login", id: <reqId> }
 *   2. extension replies: { __from: "Eve Vault", type: "auth_success",
 *                           token: { id_token: "<JWT>" } }
 *
 * The JWT can be sent as `Authorization: Bearer <id_token>` to authenticated
 * EVE Frontier World API endpoints (e.g. /v2/characters/me/jumps).
 *
 * Historical bug (fixed 2026-04-25): the MapPanel locate-me flow posted
 * { __from: "CradleOS", type: "REQUEST_AUTH" }, which the EVE Vault
 * extension does not recognize. Auth therefore silently timed out after
 * 4s. The KeeperPanel jump-history flow used the correct envelope. This
 * shared helper unifies them so future panels can't repeat the bug.
 */

const TIMEOUT_MS = 4000;
let _idCounter = 0;

/**
 * Request an id_token from the EVE Vault extension.
 *
 * Returns null if the extension doesn't reply within TIMEOUT_MS (extension
 * not installed, not authenticated, or postMessage envelope changed).
 */
export function requestEveVaultIdToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const requestId = `cradleos_auth_${Date.now()}_${++_idCounter}`;
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve(null);
    }, TIMEOUT_MS);

    function handler(event: MessageEvent) {
      const d = event.data as { __from?: string; type?: string; token?: { id_token?: string } };
      if (!d || d.__from !== "Eve Vault") return;
      if ((d.type === "auth_success" || d.type === "AUTH_SUCCESS") && d.token?.id_token) {
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        resolve(d.token.id_token);
      }
    }

    window.addEventListener("message", handler);
    window.postMessage({ __to: "Eve Vault", action: "dapp_login", id: requestId }, "*");
  });
}

/** Convenience: get headers ready to attach to an authenticated World API
 *  fetch. Returns null if no token can be obtained (caller should bail). */
export async function getEveVaultAuthHeaders(): Promise<Record<string, string> | null> {
  const idToken = await requestEveVaultIdToken();
  if (!idToken) return null;
  return { Authorization: `Bearer ${idToken}` };
}
