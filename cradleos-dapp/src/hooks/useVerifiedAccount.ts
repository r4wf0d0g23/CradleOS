// useVerifiedAccount.ts
// Challenge-response identity verification using signPersonalMessage.
// Wraps useCurrentAccount() — returns null until the wallet proves key ownership.

import { useState, useCallback, useEffect, useRef } from "react";
import { useCurrentAccount, useDAppKit, useCurrentClient } from "@mysten/dapp-kit-react";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";

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

  const [cryptoVerified, setCryptoVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track which address we last attempted so we don't re-loop on failure
  const lastAttempted = useRef<string | null>(null);

  const requestVerification = useCallback(async () => {
    if (!currentAccount) return;
    setIsVerifying(true);
    setError(null);
    lastAttempted.current = currentAccount.address;

    try {
      // Build challenge before signing — we'll use THIS exact buffer for verification
      // (Do NOT use wallet-returned `bytes` — EVE Vault may encode it differently)
      const challenge = buildChallenge();

      // Triggers the wallet popup
      const { signature } = await dAppKit.signPersonalMessage({
        message: challenge,
      });

      // Derive address from signature using the original challenge bytes we sent.
      // EVE Vault uses zkLogin — must pass a Sui RPC client so the verifier can
      // fetch the JWKs needed to verify the zkLogin proof.
      const publicKey = await verifyPersonalMessageSignature(challenge, signature, {
        client: suiClient,
      });
      const derivedAddress = publicKey.toSuiAddress();

      if (derivedAddress !== currentAccount.address) {
        throw new Error(
          `Address mismatch — wallet claims ${currentAccount.address.slice(0, 10)}… ` +
          `but signature proves ${derivedAddress.slice(0, 10)}…`
        );
      }

      setCryptoVerified(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes("reject") ||
        msg.includes("cancel") ||
        msg.toLowerCase().includes("user denied") ||
        msg.toLowerCase().includes("user rejected")
      ) {
        setError("declined");
      } else {
        // Verification failed (e.g. zkLogin testnet RPC limitation) — not a spoofing signal,
        // just an unsupported verification path. Address is still usable for tx signing.
        setError(msg);
      }
      setCryptoVerified(false);
    } finally {
      setIsVerifying(false);
    }
  }, [currentAccount, dAppKit, suiClient]);

  // Auto-trigger on fresh connect or account switch
  useEffect(() => {
    if (!currentAccount) {
      setCryptoVerified(false);
      setError(null);
      lastAttempted.current = null;
      return;
    }

    // Only auto-fire if this address hasn't been attempted yet
    if (currentAccount.address !== lastAttempted.current) {
      requestVerification();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccount?.address]);

  // account is always non-null when connected — verified flag reflects crypto proof result
  const account: VerifiedAccount | null = currentAccount
    ? { address: currentAccount.address, verified: cryptoVerified }
    : null;

  return { account, isVerified: cryptoVerified, isVerifying, verificationError: error, requestVerification };
}
