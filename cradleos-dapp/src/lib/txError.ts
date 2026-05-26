// Centralized translation of common transaction errors into user-friendly messages.
//
// Particularly handles the EVE Vault service-worker eviction case where the
// ephemeral signing key gets nulled when Chrome/Chromium kills the idle SW
// (after ~30s of inactivity), surfacing as `[KEEPER_EPH_SIGN] LOCKED` even
// though the user's 10-minute unlock timer hasn't expired.
//
// Use:
//   } catch (e) { setErr(translateTxError(e)); }
//
// And optionally check `isVaultLockError(e)` to render a "Retry" affordance.

const VAULT_LOCK_PATTERNS = [
  /\[KEEPER_EPH_SIGN\]\s*LOCKED/i,
  /KEEPER_EPH_SIGN.*LOCKED/i,
  /^LOCKED$/i,
  /vault.*locked/i,
];

export function isVaultLockError(e: unknown): boolean {
  const msg = errorMessage(e);
  return VAULT_LOCK_PATTERNS.some((p) => p.test(msg));
}

export function translateTxError(e: unknown): string {
  const msg = errorMessage(e);

  if (isVaultLockError(e)) {
    return "EVE Vault is locked — please open the Vault, unlock it, then retry. (Vault sleeps after ~30s of inactivity.)";
  }

  // Common Sui error patterns — short, human messages
  if (/InsufficientGas/i.test(msg)) {
    return "Not enough SUI for gas. Top up via the testnet faucet and try again.";
  }
  if (/User\s*rejected|UserRejected|cancelled/i.test(msg)) {
    return "Signing was cancelled.";
  }
  if (/timeout/i.test(msg)) {
    return "Network timed out reaching Sui RPC. Try again in a moment.";
  }

  // Default: pass through the original message (truncated)
  return msg.length > 240 ? msg.slice(0, 240) + "…" : msg;
}

function errorMessage(e: unknown): string {
  if (!e) return "";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object") {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}
