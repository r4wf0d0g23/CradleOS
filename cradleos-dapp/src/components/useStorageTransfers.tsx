import { useEffect, useRef, useState } from "react";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { CurrentAccountSigner } from "../lib/cycleSigner";
import {
  buildStorageTransfer,
  readStoragePolicy,
  secureStorageExtension,
  storagePermits,
  storagePreviewKey,
  type StoragePolicy,
} from "../lib/storageAccess";
import {
  fetchSsuSnapshot,
  type SsuSnapshot,
  type StorageItem,
} from "../lib/ssuSafety";
import { readInventoryCharacter } from "../lib/inventoryRead";
import { translateTxError } from "../lib/txError";

type Props = {
  snapshot?: SsuSnapshot;
  characterId: string | null;
  walletAddress?: string;
  ownerCapId?: string;
  charOwnerCapId: string | null;
  names: Map<number, string>;
  onRefresh: () => void;
};
type Selection = {
  direction: "deposit" | "withdraw" | "recover";
  items: { typeId: number; quantity: number }[];
  snapshot: SsuSnapshot;
  policy: StoragePolicy;
};
export function useStorageTransfers({
  snapshot,
  characterId,
  walletAddress,
  ownerCapId,
  charOwnerCapId,
  names,
  onRefresh,
}: Props) {
  const kit = useDAppKit();
  const [access, setAccess] = useState<{
    policy: StoragePolicy;
    tribe: number;
  } | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const generation = useRef(0),
    identity = `${walletAddress}:${characterId}:${ownerCapId}:${charOwnerCapId}:${snapshot?.id}`,
    lastIdentity = useRef(identity);
  if (identity !== lastIdentity.current) {
    lastIdentity.current = identity;
    generation.current++;
  }
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const enabled = !!snapshot && secureStorageExtension(snapshot.extension);
  useEffect(() => {
    let cancelled = false;
    const g = generation.current;
    setAccess(null);
    setSelection(null);
    setConsent(false);
    setError("");
    setStatus("");
    setBusy(false);
    if (snapshot && characterId && enabled)
      Promise.all([
        readStoragePolicy(snapshot.id),
        readInventoryCharacter(characterId),
      ])
        .then(([policy, c]) => {
          if (!cancelled && g === generation.current) {
            if (!policy) setError("Access rules unavailable.");
            else setAccess({ policy, tribe: c.tribeId });
          }
        })
        .catch(() => {
          if (!cancelled && g === generation.current)
            setError("Transfer access unavailable.");
        });
    return () => {
      cancelled = true;
    };
  }, [identity, snapshot?.version, enabled]);
  const walletCurrent = () => {
    if (
      !walletAddress ||
      kit.stores.$connection.get().account?.address !== walletAddress ||
      kit.stores.$currentNetwork.get() !== "testnet"
    )
      throw new Error("Wallet changed. Reopen storage.");
  };
  const permits = (withdraw: boolean) =>
    !!access &&
    !!characterId &&
    storagePermits(access.policy.rules, characterId, access.tribe, withdraw);
  async function prepare(
    direction: Selection["direction"],
    items: Selection["items"],
  ) {
    if (!snapshot || !characterId || !walletAddress || busy) return;
    const g = generation.current;
    setBusy(true);
    setError("");
    setStatus("");
    setSelection(null);
    setConsent(false);
    try {
      walletCurrent();
      const [fresh, policy, c] = await Promise.all([
        fetchSsuSnapshot(snapshot.id),
        readStoragePolicy(snapshot.id),
        readInventoryCharacter(characterId),
      ]);
      if (g !== generation.current) return;
      walletCurrent();
      if (
        !policy ||
        (direction !== "recover" &&
          !storagePermits(
            policy.rules,
            characterId,
            c.tribeId,
            direction === "withdraw",
          ))
      )
        throw new Error("Access denied or expired.");
      buildStorageTransfer(
        fresh,
        policy,
        characterId,
        walletAddress,
        direction,
        items,
        direction === "recover" ? ownerCapId : (charOwnerCapId ?? undefined),
      );
      setSelection({ direction, items, snapshot: fresh, policy });
    } catch (e) {
      if (g === generation.current) setError(translateTxError(e));
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  async function submit() {
    if (!selection || !consent || !characterId || !walletAddress || busy)
      return;
    const g = generation.current;
    setBusy(true);
    setError("");
    try {
      walletCurrent();
      const [fresh, policy, c] = await Promise.all([
        fetchSsuSnapshot(selection.snapshot.id),
        readStoragePolicy(selection.snapshot.id),
        readInventoryCharacter(characterId),
      ]);
      if (g !== generation.current) return;
      walletCurrent();
      if (
        !policy ||
        storagePreviewKey(fresh, policy) !==
          storagePreviewKey(selection.snapshot, selection.policy)
      )
        throw new Error("Stock or rules changed. Review again.");
      if (
        selection.direction !== "recover" &&
        !storagePermits(
          policy.rules,
          characterId,
          c.tribeId,
          selection.direction === "withdraw",
        )
      )
        throw new Error("Access denied or expired.");
      const tx = buildStorageTransfer(
        fresh,
        policy,
        characterId,
        walletAddress,
        selection.direction,
        selection.items,
        selection.direction === "recover"
          ? ownerCapId
          : (charOwnerCapId ?? undefined),
      );
      const result: any = await new CurrentAccountSigner(
        kit,
      ).signAndExecuteTransaction({ transaction: tx });
      if (g !== generation.current) return;
      if (
        result?.$kind === "FailedTransaction" ||
        result?.FailedTransaction ||
        result?.effects?.status?.status === "failure"
      )
        throw new Error("Transfer failed. No items moved.");
      setStatus("Submitted · Refreshing stock");
      setSelection(null);
      setConsent(false);
      onRefresh();
    } catch (e) {
      if (g === generation.current) {
        setError(translateTxError(e));
        setSelection(null);
        setConsent(false);
      }
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  const personal =
    snapshot?.slots
      .find((s) => s.key === charOwnerCapId)
      ?.items.filter((i) => i.quantity > 0) ?? [];
  return {
    action(item: StorageItem) {
      if (
        !enabled ||
        !snapshot?.online ||
        !access ||
        !walletAddress ||
        !characterId
      )
        return null;
      const direction =
        item.partition === "open"
          ? permits(true)
            ? "withdraw"
            : ownerCapId
              ? "recover"
              : null
          : item.partitionKey === charOwnerCapId && permits(false)
            ? "deposit"
            : null;
      if (!direction) return null;
      return (
        <button
          disabled={busy || !!selection}
          onClick={() =>
            prepare(direction, [
              { typeId: item.typeId, quantity: item.quantity },
            ])
          }
        >
          {direction === "deposit"
            ? "Deposit"
            : direction === "recover"
              ? "Recover"
              : "Withdraw"}
        </button>
      );
    },
    controls: enabled ? (
      <div className="ssu-config">
        {personal.length > 0 && personal.length <= 100 && permits(false) && (
          <button
            disabled={busy || !!selection || !snapshot?.online}
            onClick={() =>
              prepare(
                "deposit",
                personal.map((i) => ({
                  typeId: i.typeId,
                  quantity: i.quantity,
                })),
              )
            }
          >
            Deposit all personal stock
          </button>
        )}
        {selection && (
          <div className="ssu-warning" aria-label="Review storage transfer">
            <strong>
              {selection.direction === "deposit"
                ? "Personal → Shared pool"
                : "Shared pool → Your personal storage"}
            </strong>
            {selection.items.map((row, i) => (
              <label key={row.typeId}>
                {names.get(row.typeId) ?? `Item ${row.typeId}`}
                <input
                  aria-label={`Quantity for ${row.typeId}`}
                  type="number"
                  min={1}
                  step={1}
                  value={row.quantity}
                  disabled={busy}
                  onChange={(e) => {
                    setConsent(false);
                    setSelection({
                      ...selection,
                      items: selection.items.map((r, n) =>
                        n === i
                          ? { ...r, quantity: Number(e.target.value) }
                          : r,
                      ),
                    });
                  }}
                />
              </label>
            ))}
            <label className="ssu-confirm">
              <input
                type="checkbox"
                checked={consent}
                disabled={busy}
                onChange={(e) => setConsent(e.target.checked)}
              />
              {selection.direction === "deposit"
                ? "Shared stock can be withdrawn by permitted pilots."
                : "Move these items to my personal storage."}
            </label>
            <div className="ssu-config-modes">
              <button disabled={!consent || busy} onClick={submit}>
                {busy ? "Submitting…" : "Sign transfer"}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setSelection(null);
                  setConsent(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {error && (
          <div className="ssu-warning" role="alert">
            {error}
          </div>
        )}
        {status && <p role="status">{status}</p>}
      </div>
    ) : null,
  };
}
