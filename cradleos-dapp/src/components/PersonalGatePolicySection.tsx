/** Gate-only portion of the former combined defense panel. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { CurrentAccountSigner } from "../lib/cycleSigner";
import { translateTxError } from "../lib/txError";
import { fetchPersonalGateSetup } from "../lib/personalGateSetup";
import {
  buildCreatePersonalVaultTx,
  buildCreatePersonalGatePolicyTx,
  buildSetGateAccessLevelTx,
  GATE_ACCESS_LABELS,
} from "../lib";
export function PersonalGatePolicySection() {
  const { account } = useVerifiedAccountContext();
  const kit = useDAppKit();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<{ address: string; text: string } | null>(
      null,
    ),
    [message, setMessage] = useState<{ address: string; text: string } | null>(
      null,
    );
  const setup = useQuery({
    queryKey: ["personal-gate-setup", account?.address],
    queryFn: () => fetchPersonalGateSetup(account!.address),
    enabled: !!account,
    retry: 1,
  });
  async function send(action: "setup" | "policy" | "level", level = 0) {
    if (!account) return;
    const address = account.address;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const fresh = await fetchPersonalGateSetup(address);
      if (action === "setup" && fresh.vault)
        throw new Error("A setup already exists. Refresh before continuing.");
      if (action === "policy" && (!fresh.vault || fresh.policy))
        throw new Error("Gate setup changed. Refresh before continuing.");
      if (action === "level" && (!fresh.vault || !fresh.policy))
        throw new Error("Gate policy is no longer available.");
      if (kit.stores.$connection.get().account?.address !== address)
        throw new Error("Wallet changed. Refresh before signing.");
      const tx =
        action === "setup"
          ? buildCreatePersonalVaultTx(fresh.tribeId)
          : action === "policy"
            ? buildCreatePersonalGatePolicyTx(fresh.vault!.objectId)
            : buildSetGateAccessLevelTx(
                fresh.policy!.objectId,
                fresh.vault!.objectId,
                level,
              );
      tx.setSender(address);
      const result = await new CurrentAccountSigner(
        kit,
      ).signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === "FailedTransaction")
        throw new Error(
          result.FailedTransaction.status.error?.message ??
            "Transaction failed.",
        );
      if (!result.Transaction?.status.success)
        throw new Error("Unknown outcome. Refresh before retrying.");
      setMessage({
        address,
        text: "Transaction confirmed. Refresh if the new setup is still indexing.",
      });
      await setup.refetch();
    } catch (e) {
      setError({ address, text: translateTxError(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h3>My Gate Policy</h3>

      {!account ? (
        <p>Connect wallet</p>
      ) : setup.isPending ? (
        <p>Loading personal gate setup…</p>
      ) : setup.isError ? (
        <p role="alert">{setup.error.message}</p>
      ) : (
        <>
          {!setup.data?.vault ? (
            <button disabled={busy} onClick={() => send("setup")}>
              Create personal gate setup
            </button>
          ) : !setup.data.policy ? (
            <button disabled={busy} onClick={() => send("policy")}>
              Create gate policy
            </button>
          ) : (
            <>
              <p>
                Gate policy configured ·{" "}
                {setup.data.policy.objectId.slice(0, 12)}…
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.entries(GATE_ACCESS_LABELS).map(([level, label]) => (
                  <button
                    key={level}
                    aria-pressed={
                      setup.data.policy!.accessLevel === Number(level)
                    }
                    disabled={busy}
                    onClick={() => send("level", Number(level))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {account && (
        <button
          disabled={busy || setup.isFetching}
          onClick={() => setup.refetch()}
        >
          Refresh
        </button>
      )}
      {error?.address === account?.address && <p role="alert">{error?.text}</p>}
      {message?.address === account?.address && (
        <p role="status">{message?.text}</p>
      )}
    </section>
  );
}
