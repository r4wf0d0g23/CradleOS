
/** Normalize on-chain errors to user-friendly messages */
export function normalizeChainError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("unable to find function")) return "Module not yet deployed on-chain. Contract deployment pending.";
  if (msg.includes("VMVerificationOrDeserializationError")) return "Contract version mismatch — redeploy required.";
  if (msg.includes("InsufficientCoinBalance") || msg.includes("insufficient")) return "Insufficient balance.";
  if (msg.includes("MoveAbort")) {
    const m = msg.match(/MoveAbort.*abort_code: (\d+)/);
    return m ? `Transaction aborted (code ${m[1]}).` : "Transaction aborted by contract.";
  }
  return msg;
}
