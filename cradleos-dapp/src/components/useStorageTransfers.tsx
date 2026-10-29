import { useEffect, useRef, useState } from "react";
import {
  buildOwnerStorageTransfer,
  StorageCapacityError,
} from "../lib/storageOwnerRouting";
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
import {
  storageTransferAmount,
  storageTransferDirection,
  type StorageTransferDirection,
} from "../lib/storageTransferIntent";

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
  direction: StorageTransferDirection;
  items: { typeId: number; amount: string; available: number }[];
  snapshot: SsuSnapshot;
  policy: StoragePolicy | null;
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
  const reviewRef = useRef<HTMLDivElement>(null);
  const signing = useRef(false);
  const generation = useRef(0),
    lock = useRef<number | null>(null);
  const identity = `${walletAddress}:${characterId}:${ownerCapId}:${charOwnerCapId}:${snapshot?.id}:${snapshot?.version}:${snapshot?.readAt}`;
  const lastIdentity = useRef(identity);
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
    lock.current = null;
    setAccess(null);
    setSelection(null);
    setConsent(false);
    setError("");
    setStatus("");
    setBusy(signing.current);
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
  }, [identity, enabled]);
  useEffect(() => {
    if (selection) {
      reviewRef.current?.focus();
      reviewRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [!!selection]);
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
  const nativeReady =
    !!snapshot?.online &&
    !!walletAddress &&
    !!characterId &&
    !!ownerCapId &&
    !!charOwnerCapId;
  const ready =
    enabled &&
    !!snapshot?.online &&
    !!access &&
    !!walletAddress &&
    !!characterId;
  const directionFor = (item: StorageItem) =>
    storageTransferDirection(item, {
      ready,
      charOwnerCapId,
      ownerCapId,
      canDeposit: permits(false),
      canWithdraw: permits(true),
    });
  const ownerRoute = (direction: StorageTransferDirection) =>
    direction === "owner_withdraw" ||
    direction === "owner_recover" ||
    direction === "personal_to_owner";
  const bypassPolicy = (direction: StorageTransferDirection) =>
    direction === "recover" ||
    direction === "owner_recover" ||
    direction === "personal_to_owner";
  function buildTransfer(
    state: SsuSnapshot,
    policy: StoragePolicy | null,
    direction: StorageTransferDirection,
    rows: { typeId: number; quantity: number }[],
  ) {
    if (!characterId || !walletAddress) throw new Error("Wallet unavailable.");
    if (
      direction === "owner_withdraw" ||
      direction === "owner_recover" ||
      direction === "personal_to_owner"
    ) {
      if (!ownerCapId || !charOwnerCapId)
        throw new Error("Owner capability unavailable.");
      return buildOwnerStorageTransfer(
        state,
        policy,
        characterId,
        walletAddress,
        direction,
        rows,
        ownerCapId,
        charOwnerCapId,
      );
    }
    if (!policy) throw new Error("Access rules unavailable.");
    return buildStorageTransfer(
      state,
      policy,
      characterId,
      walletAddress,
      direction,
      rows,
      direction === "recover" || direction === "owner_deposit"
        ? ownerCapId
        : (charOwnerCapId ?? undefined),
    );
  }
  async function prepare(
    direction: StorageTransferDirection,
    items: { typeId: number; quantity: number }[],
  ) {
    if (
      !snapshot ||
      !characterId ||
      !walletAddress ||
      busy ||
      selection ||
      lock.current !== null ||
      signing.current
    )
      return;
    const g = generation.current;
    lock.current = g;
    setBusy(true);
    setError("");
    setStatus("");
    setSelection(null);
    setConsent(false);
    try {
      walletCurrent();
      const [fresh, policy, c] = await Promise.all([
        fetchSsuSnapshot(snapshot.id),
        direction === "personal_to_owner"
          ? Promise.resolve(null)
          : readStoragePolicy(snapshot.id),
        direction === "personal_to_owner"
          ? Promise.resolve({ tribeId: 0 })
          : readInventoryCharacter(characterId),
      ]);
      if (g !== generation.current) return;
      walletCurrent();
      if (
        (direction !== "personal_to_owner" && !policy) ||
        (!bypassPolicy(direction) &&
          !storagePermits(
            policy!.rules,
            characterId,
            c.tribeId,
            direction === "withdraw" || direction === "owner_withdraw",
          ))
      )
        throw new Error("Access denied or expired.");
      try {
        buildTransfer(fresh, policy, direction, items);
      } catch (e) {
        if (!(e instanceof StorageCapacityError)) throw e;
      }
      const source = fresh.slots.find((s) =>
        direction === "deposit" || direction === "personal_to_owner"
          ? s.key === charOwnerCapId
          : direction === "owner_deposit"
            ? s.key === ownerCapId && s.partition === "owner_main"
            : s.partition === "open",
      );
      setSelection({
        direction,
        items: items.map((row) => ({
          typeId: row.typeId,
          amount: String(row.quantity),
          available: source!.items.find((i) => i.typeId === row.typeId)!
            .quantity,
        })),
        snapshot: fresh,
        policy,
      });
    } catch (e) {
      if (g === generation.current) setError(translateTxError(e));
    } finally {
      if (g === generation.current) {
        lock.current = null;
        setBusy(false);
      }
    }
  }
  const validAmounts =
    !!selection &&
    selection.items.length > 0 &&
    selection.items.every(
      (row) => storageTransferAmount(row.amount, row.available) !== null,
    );
  // Review amounts can be reduced even when the initially selected full stack
  // exceeds capacity. This is local validation only; submit always rereads chain.
  let quantityError = "";
  if (selection && validAmounts) {
    try {
      buildTransfer(
        { ...selection.snapshot, readAt: Date.now() },
        selection.policy,
        selection.direction,
        selection.items.map((row) => ({
          typeId: row.typeId,
          quantity: storageTransferAmount(row.amount, row.available)!,
        })),
      );
    } catch (e) {
      quantityError = translateTxError(e);
    }
  }
  async function submit() {
    if (
      !selection ||
      !consent ||
      !validAmounts ||
      !!quantityError ||
      !characterId ||
      !walletAddress ||
      busy ||
      lock.current !== null ||
      signing.current
    )
      return;
    const g = generation.current;
    lock.current = g;
    setBusy(true);
    setError("");
    try {
      walletCurrent();
      const [fresh, policy, c] = await Promise.all([
        fetchSsuSnapshot(selection.snapshot.id),
        selection.direction === "personal_to_owner"
          ? Promise.resolve(null)
          : readStoragePolicy(selection.snapshot.id),
        selection.direction === "personal_to_owner"
          ? Promise.resolve({ tribeId: 0 })
          : readInventoryCharacter(characterId),
      ]);
      if (g !== generation.current) return;
      walletCurrent();
      if (
        (selection.direction !== "personal_to_owner" && !policy) ||
        storagePreviewKey(fresh, policy) !==
          storagePreviewKey(selection.snapshot, selection.policy)
      )
        throw new Error("Stock or rules changed. Review again.");
      if (
        !bypassPolicy(selection.direction) &&
        !storagePermits(
          policy!.rules,
          characterId,
          c.tribeId,
          selection.direction === "withdraw" ||
            selection.direction === "owner_withdraw",
        )
      )
        throw new Error("Access denied or expired.");
      const rows = selection.items.map((row) => ({
        typeId: row.typeId,
        quantity: storageTransferAmount(row.amount, row.available)!,
      }));
      const tx = buildTransfer(fresh, policy, selection.direction, rows);
      signing.current = true;
      let result: any;
      try {
        result = await new CurrentAccountSigner(kit).signAndExecuteTransaction({
          transaction: tx,
        });
      } finally {
        signing.current = false;
        // A refresh may invalidate the old result, but must not unlock another
        // wallet request while this promise is pending.
        setBusy(false);
      }
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
      if (g === generation.current) {
        lock.current = null;
        setBusy(false);
      }
    }
  }
  const personal =
    snapshot?.slots
      .find((s) => s.key === charOwnerCapId && s.partition === "unknown")
      ?.items.filter((i) => i.quantity > 0 && directionFor(i) === "deposit") ??
    [];
  const movablePersonal = nativeReady
    ? (snapshot?.slots
        .find((s) => s.key === charOwnerCapId && s.partition === "unknown")
        ?.items.filter((i) => i.quantity > 0) ?? [])
    : [];
  const ownerStock =
    snapshot?.slots
      .find((s) => s.key === ownerCapId && s.partition === "owner_main")
      ?.items.filter(
        (i) => i.quantity > 0 && directionFor(i) === "owner_deposit",
      ) ?? [];
  const disabled = busy || !!selection;
  const request = (item: StorageItem) => {
    // Resolve against this card's actual snapshot, never a dragged payload's quantity.
    const current = snapshot?.slots
      .find((s) => s.key === item.partitionKey)
      ?.items.find((i) => i.typeId === item.typeId && i.itemId === item.itemId);
    const direction = current && directionFor(current);
    if (current && direction && !disabled)
      void prepare(direction, [
        { typeId: current.typeId, quantity: current.quantity },
      ]);
  };
  function setAmount(index: number, amount: string) {
    setConsent(false);
    setSelection(
      (s) =>
        s && {
          ...s,
          items: s.items.map((r, n) => (n === index ? { ...r, amount } : r)),
        },
    );
  }
  return {
    directionFor,
    request,
    disabled,
    identity,
    action(item: StorageItem) {
      const direction = directionFor(item);
      const canMove = movablePersonal.some(
        (i) => i.typeId === item.typeId && i.partitionKey === item.partitionKey,
      );
      if (!direction && !canMove) return null;
      return (
        <span className="ssu-config-modes">
          {direction && (
            <button disabled={disabled} onClick={() => request(item)}>
              {direction === "owner_deposit"
                ? "Share"
                : direction === "deposit"
                  ? "Deposit"
                  : direction === "recover" || direction === "owner_recover"
                    ? "Recover"
                    : "Withdraw"}
            </button>
          )}
          {canMove && (
            <button
              disabled={disabled}
              onClick={() =>
                prepare("personal_to_owner", [
                  { typeId: item.typeId, quantity: item.quantity },
                ])
              }
            >
              Move to owner storage
            </button>
          )}
        </span>
      );
    },
    controls:
      enabled || nativeReady ? (
        <div className="ssu-config">
          <div className="ssu-config-modes">
            {(
              [
                {
                  direction: "personal_to_owner",
                  items: movablePersonal,
                  all: "Move all to owner storage",
                  batch: "Move 100 stacks to owner storage",
                },
                {
                  direction: "owner_deposit",
                  items: ownerStock,
                  all: "Share all owner stock",
                  batch: "Share 100 owner stacks",
                },
                {
                  direction: "deposit",
                  items: personal,
                  all: "Deposit all personal stock",
                  batch: "Deposit 100 personal stacks",
                },
              ] as const
            ).map(
              (group) =>
                group.items.length > 0 && (
                  <button
                    key={group.direction}
                    disabled={
                      disabled ||
                      (group.direction === "personal_to_owner"
                        ? !nativeReady
                        : !ready)
                    }
                    onClick={() =>
                      prepare(
                        group.direction,
                        group.items.slice(0, 100).map((i) => ({
                          typeId: i.typeId,
                          quantity: i.quantity,
                        })),
                      )
                    }
                  >
                    {group.items.length > 100 ? group.batch : group.all}
                  </button>
                ),
            )}
          </div>
          {selection && (
            <div
              className="ssu-warning ssu-transfer-review"
              ref={reviewRef}
              tabIndex={-1}
              role="region"
              aria-label="Review storage transfer"
            >
              <strong>
                {selection.direction === "personal_to_owner"
                  ? "Your personal storage → Owner storage"
                  : ownerRoute(selection.direction)
                    ? "Shared pool → Owner storage"
                    : selection.direction === "owner_deposit"
                      ? "Owner storage → Shared pool"
                      : selection.direction === "deposit"
                        ? "Personal → Shared pool"
                        : "Shared pool → Your personal storage"}
              </strong>
              {selection.items.length > 1 && (
                <span className="ssu-pill">
                  {selection.items.length} stacks
                </span>
              )}
              {selection.items.map((row, i) => (
                <div className="ssu-transfer-row" key={row.typeId}>
                  <label>
                    {names.get(row.typeId) ?? `Item ${row.typeId}`}
                    <input
                      aria-label={`Quantity for ${row.typeId}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={row.amount}
                      disabled={busy}
                      aria-invalid={
                        storageTransferAmount(row.amount, row.available) ===
                        null
                      }
                      onChange={(e) => setAmount(i, e.target.value)}
                    />
                  </label>
                  <span>Available {row.available.toLocaleString()}</span>
                  <button
                    disabled={busy}
                    onClick={() => setAmount(i, String(row.available))}
                  >
                    Max
                  </button>
                  {selection.items.length > 1 && (
                    <button
                      disabled={busy}
                      aria-label={`Remove ${names.get(row.typeId) ?? `Item ${row.typeId}`}`}
                      onClick={() => {
                        setConsent(false);
                        setSelection((s) =>
                          s && s.items.length > 1
                            ? {
                                ...s,
                                items: s.items.filter(
                                  (item) => item.typeId !== row.typeId,
                                ),
                              }
                            : s,
                        );
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {quantityError && <p role="status">{quantityError}</p>}
              {!validAmounts && (
                <p role="status">Enter whole amounts within available stock.</p>
              )}
              <label className="ssu-confirm">
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={busy || !validAmounts || !!quantityError}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                {selection.direction === "deposit" ||
                selection.direction === "owner_deposit"
                  ? "Shared stock can be withdrawn by permitted pilots."
                  : ownerRoute(selection.direction)
                    ? "Move these items to my owner storage."
                    : "Move these items to my personal storage."}
              </label>
              <div className="ssu-config-modes">
                <button
                  disabled={
                    !consent || !validAmounts || !!quantityError || busy
                  }
                  onClick={submit}
                >
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
