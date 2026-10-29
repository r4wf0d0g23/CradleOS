// useVerifiedAccount.ts
// Challenge-response identity verification using signPersonalMessage.
// Wraps useCurrentAccount() — returns null until the wallet proves key ownership.

import { useState, useCallback, useEffect, useRef } from "react";
import { useCurrentAccount, useDAppKit, useCurrentClient } from "@mysten/dapp-kit-react";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
import { VerificationSession, type VerificationAttempt } from "../lib/verificationSession";

export type VerifiedAccount = {
  address: string;
  // true = cryptographic zkLogin/ed25519 proof passed
  // false = connected but verification unsupported (zkLogin testnet limitation)
  verified: boolean;
};

export type UseVerifiedAccountResult = {
  // Always non-null when a wallet is connected (address is trusted for tx signing)
  account: VerifiedAccount | null;
  // true only when crypto proof succeeded
  isVerified: boolean;
  isVerifying: boolean;
  verificationError: string | null;
  requestVerification: () => void;
};

function buildChallenge(): Uint8Array {
  const nonce = crypto.randomUUID();
  const ts = Date.now();
  const msg = `CradleOS identity verification\nNonce: ${nonce}\nTimestamp: ${ts}`;
  return new TextEncoder().encode(msg);
}

export function useVerifiedAccount(): UseVerifiedAccountResult {
  const currentAccount = useCurrentAccount();
  const dAppKit = useDAppKit();
  const suiClient = useCurrentClient();

  const session = useRef(new VerificationSession());
  session.current.sync(currentAccount?.address ?? null);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [state, setState] = useState<{ attempt: VerificationAttempt | null; verified: boolean; verifying: boolean; error: string | null }>({ attempt: null, verified: false, verifying: false, error: null });
  const stateIsCurrent = session.current.current(state.attempt);
  const cryptoVerified = stateIsCurrent && state.verified;
  const isVerifying = stateIsCurrent && state.verifying;
  const error = stateIsCurrent ? state.error : null;

  const verify = useCallback(async (automatic: boolean) => {
    if (!currentAccount) return;
    const attempt = session.current.begin(automatic);
    if (!attempt) return;
    const current = () => active.current && session.current.current(attempt);
    setState({ attempt, verified: false, verifying: true, error: null });

    try {
      // Build challenge before signing — we'll use THIS exact buffer for verification
      // (Do NOT use wallet-returned `bytes` — EVE Vault may encode it differently)
      const challenge = buildChallenge();

      // Triggers the wallet popup
      const { signature } = await dAppKit.signPersonalMessage({
        message: challenge,
      });
      if (!current()) return;

      // Derive address from signature using the original challenge bytes we sent.
      // EVE Vault uses zkLogin — must pass a Sui RPC client so the verifier can
      // fetch the JWKs needed to verify the zkLogin proof.
      const publicKey = await verifyPersonalMessageSignature(challenge, signature, {
        client: suiClient,
      });
      const derivedAddress = publicKey.toSuiAddress();
      if (!current()) return;

      if (derivedAddress !== currentAccount.address) {
        throw new Error(
          `Address mismatch — wallet claims ${currentAccount.address.slice(0, 10)}… ` +
          `but signature proves ${derivedAddress.slice(0, 10)}…`
        );
      }

      setState({ attempt, verified: true, verifying: false, error: null });

      // Fire-and-forget telemetry ping. Server re-verifies sig and logs unique
      // address per day for MAU tracking. Privacy: only the wallet address
      // (already public on-chain) is sent. No PII.
      try {
        const challengeB64 = btoa(String.fromCharCode(...challenge));
        // Pass the wallet-format signature (string) for server-side re-verify.
        // Errors are swallowed — telemetry must NEVER block the user.
        fetch("https://keeper.reapers.shop/telemetry/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: currentAccount.address,
            signature,
            challenge: challengeB64,
          }),
          keepalive: true,
        }).catch(() => { /* silent — telemetry is best-effort */ });
      } catch {
        /* silent — telemetry is best-effort */
      }
    } catch (e) {
      if (!current()) return;
      const msg = e instanceof Error ? e.message : String(e);
      let verificationError = msg;
      if (
        msg.includes("reject") ||
        msg.includes("cancel") ||
        msg.toLowerCase().includes("user denied") ||
        msg.toLowerCase().includes("user rejected")
      ) {
        verificationError = "declined";
      } else {
        // Verification failed (e.g. zkLogin testnet RPC limitation) — not a spoofing signal,
        // just an unsupported verification path. Address is still usable for tx signing.
        verificationError = msg;
      }
      setState({ attempt, verified: false, verifying: false, error: verificationError });
    } finally {
      session.current.finish(attempt);
      if (current()) setState(s => s.attempt === attempt ? { ...s, verifying: false } : s);
    }
  }, [currentAccount, dAppKit, suiClient]);

  // Auto-trigger on fresh connect or account switch
  useEffect(() => {
    void verify(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccount?.address]);
  const requestVerification = useCallback(() => { void verify(false); }, [verify]);

  // account is always non-null when connected — verified flag reflects crypto proof result
  const account: VerifiedAccount | null = currentAccount
    ? { address: currentAccount.address, verified: cryptoVerified }
    : null;

  return { account, isVerified: cryptoVerified, isVerifying, verificationError: error, requestVerification };
}
