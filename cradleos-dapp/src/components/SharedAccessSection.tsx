import { useEffect, useRef, useState } from "react";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { CurrentAccountSigner } from "../lib/cycleSigner";
import { type LoadedPolicy, modeLabel } from "../lib/ssuAccess";
import {
  buildDisableSsuSharingTx,
  fetchSsuSnapshot,
  isUnsafeSsuExtension,
  type SsuSnapshot,
} from "../lib/ssuSafety";
import { ClientUIIcon } from "./GameIcon";
import "./SsuStorage.css";

type Props = {
  ssuObjectId: string;
  ssuTypeFull: string;
  ownerCapId?: string;
  characterId: string | null;
  walletAddress?: string;
  snapshot?: SsuSnapshot;
  loadedPolicy?: LoadedPolicy;
  resolvedNames?: Map<number, string>;
  readError?: string;
  onRefresh: () => void;
};
export function SharedAccessSection({
  ssuObjectId,
  ownerCapId,
  characterId,
  walletAddress,
  snapshot,
  loadedPolicy,
  resolvedNames,
  readError,
  onRefresh,
}: Props) {
  const dAppKit = useDAppKit();
  const [preview, setPreview] = useState<SsuSnapshot | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const identity = `${walletAddress}:${characterId}:${ownerCapId}:${ssuObjectId}`;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  useEffect(() => {
    currentIdentity.current = identity;
    setPreview(null);
    setConfirmed(false);
    setBusy(false);
    setError("");
    setStatus("");
    return () => {
      currentIdentity.current = "unmounted";
    };
  }, [identity]);
  const unsafe = !!snapshot && isUnsafeSsuExtension(snapshot.extension);
  const isOwner = !!ownerCapId && !!characterId && !!walletAddress;
  async function prepare() {
    if (!isOwner || !characterId || !walletAddress || !ownerCapId) return;
    setBusy(true);
    setError("");
    setStatus("");
    setConfirmed(false);
    try {
      const fresh = await fetchSsuSnapshot(ssuObjectId);
      if (currentIdentity.current !== identity) return;
      buildDisableSsuSharingTx(fresh, characterId, ownerCapId, walletAddress);
      setPreview(fresh);
    } catch (e) {
      if (currentIdentity.current === identity) {
        setError(e instanceof Error ? e.message : String(e));
        setPreview(null);
      }
    } finally {
      if (currentIdentity.current === identity) setBusy(false);
    }
  }
  async function submit() {
    if (
      !preview ||
      !confirmed ||
      !characterId ||
      !ownerCapId ||
      !walletAddress ||
      busy
    )
      return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const fresh = await fetchSsuSnapshot(ssuObjectId);
      if (currentIdentity.current !== identity) return;
      if (
        fresh.version !== preview.version ||
        JSON.stringify(fresh.slots) !== JSON.stringify(preview.slots)
      ) {
        setPreview(null);
        setConfirmed(false);
        throw new Error(
          "Storage changed. Review again.",
        );
      }
      const tx = buildDisableSsuSharingTx(
        fresh,
        characterId,
        ownerCapId,
        walletAddress,
      );
      const result = await new CurrentAccountSigner(
        dAppKit,
      ).signAndExecuteTransaction({ transaction: tx });
      if (currentIdentity.current !== identity) return;
      const response = result as any;
      if (
        response?.$kind === "FailedTransaction" ||
        response?.FailedTransaction ||
        response?.effects?.status?.status === "failure"
      )
        throw new Error("Transaction failed · Sharing unchanged");
      setPreview(null);
      setConfirmed(false);
      setStatus(
        "Submitted · Verifying sharing status…",
      );
      const after = await fetchSsuSnapshot(ssuObjectId);
      if (currentIdentity.current !== identity) return;
      setStatus(
        after.extension === null
          ? "Sharing disabled"
          : "Revocation unconfirmed · Refresh before retrying",
      );
      onRefresh();
    } catch (e) {
      if (currentIdentity.current === identity)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (currentIdentity.current === identity) setBusy(false);
    }
  }
  const shared =
    preview?.slots
      .filter((s) => s.partition === "open")
      .flatMap((s) => s.items)
      .filter((i) => i.quantity > 0) ?? [];
  return (
    <section className="ssu-access" aria-label="Sharing access">
      <div className="ssu-access-heading">
        <ClientUIIcon name="folder/shared_folder_16px" size={24} />
        <h3>Sharing access</h3>
        <span className={`ssu-pill ${unsafe ? "danger" : ""}`}>
          {readError
            ? "Unverified"
            : !snapshot
              ? "Checking…"
              : unsafe
                ? "Action required"
                : snapshot.extension
                  ? "Other extension"
                  : "Not enabled"}
        </span>
      </div>
      {unsafe ? (
        <div className="ssu-warning">
          <strong>Unsafe sharing active</strong>Owner storage and shared pool exposed.
          {snapshot?.frozen ? (
            <p>
              Permanently frozen · Cannot disable
            </p>
          ) : isOwner ? (
            <p>
              Owner action required
            </p>
          ) : (
            <p>
              Owner action required
            </p>
          )}
        </div>
      ) : (
        <p className="ssu-help">
          {readError
            ? "Access unverified · Refresh"
            : !snapshot
              ? "Checking access…"
              : snapshot.extension
                ? "External extension"
                : "Default storage · Sharing paused"}
        </p>
      )}
      <details className="ssu-details">
        <summary>
          <ClientUIIcon name="action/settings_16px" />
          Manage access
        </summary>

        <ul className="ssu-policy-facts">
          <li>
            Saved rule {unsafe ? "(unenforced)" : ""}:{" "}
            {loadedPolicy?.policyId
              ? modeLabel(loadedPolicy.mode)
              : "No policy loaded"}
          </li>
          <li>
            Extension:{" "}
            {snapshot
              ? snapshot.extension
                ? unsafe
                  ? "Affected CradleOS sharing"
                  : "Another extension"
                : "None"
              : "Not verified"}
          </li>
          <li>
            Owner can disable:{" "}
            {snapshot
              ? snapshot.frozen
                ? "No — permanently frozen"
                : "Yes"
              : "Not verified"}
          </li>
        </ul>
        {loadedPolicy?.policyId && (
          <small className="ssu-object-id">
            Policy {loadedPolicy.policyId}
          </small>
        )}
        {unsafe && isOwner && !snapshot?.frozen && !preview && (
          <button
            onClick={prepare}
            disabled={busy || !!readError}
            className="ssu-danger-button"
          >
            <ClientUIIcon name="action/power_off_16px" />
            {busy ? "Checking storage…" : "Review & disable sharing"}
          </button>
        )}
        {preview && (
          <div className="ssu-warning">
            <strong>Review before signing</strong>
            <p>
              {shared.length
                ? `${shared.length} shared stack(s) remain · Inaccessible pending recovery`
                : "Shared pool empty"}
            </p>
            <p>
              No items move. Shared stock, including new arrivals, becomes inaccessible pending recovery. Do not change the extension elsewhere while signing.
            </p>
            {shared.length > 0 && (
              <ul className="ssu-policy-facts">
                {shared.map((i) => (
                  <li key={i.typeId}>
                    {resolvedNames?.get(i.typeId) ?? `Item ${i.typeId}`}:{" "}
                    {i.quantity.toLocaleString()} units remain
                  </li>
                ))}
              </ul>
            )}
            <label className="ssu-confirm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={busy}
              />
              Disable sharing · Leave shared stock inaccessible pending recovery
            </label>
            <button
              className="ssu-danger-button"
              disabled={!confirmed || busy}
              onClick={submit}
            >
              {busy ? "Waiting for wallet / chain…" : "Confirm in wallet"}
            </button>{" "}
            <button
              onClick={() => {
                setPreview(null);
                setConfirmed(false);
              }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        )}
      </details>
      {error && (
        <p className="ssu-warning" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="ssu-success" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
