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
          "Storage changed since the preview. Review the updated stock before signing.",
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
        throw new Error("The transaction failed. No revocation was applied.");
      setPreview(null);
      setConfirmed(false);
      setStatus(
        "Transaction submitted. Verifying revocation on-chain; refresh before taking another action.",
      );
      const after = await fetchSsuSnapshot(ssuObjectId);
      if (currentIdentity.current !== identity) return;
      setStatus(
        after.extension === null
          ? "Extension disabled on-chain. Refresh storage to view the result."
          : "Transaction submitted. The chain read has not confirmed revocation yet; refresh before taking another action.",
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
          <strong>Current sharing rules are not secure</strong>The enabled
          CradleOS extension can bypass tribe and pilot permissions, exposing
          owner storage and the shared pool. New shared transfers are paused in
          this app. This warning does not disable access on-chain.
          {snapshot?.frozen ? (
            <p>
              This extension was permanently frozen. The owner cannot revoke it
              here; a separately reviewed recovery is required.
            </p>
          ) : isOwner ? (
            <p>
              Review the shared stock and disable the affected extension with
              your wallet. Changing the saved tribe rule is not a fix.
            </p>
          ) : (
            <p>
              Ask the SSU owner to review and disable the affected extension.
              You cannot change another pilot's storage access.
            </p>
          )}
        </div>
      ) : (
        <p className="ssu-help">
          {readError
            ? "Access status could not be verified. Refresh before making changes."
            : !snapshot
              ? "Reading the active extension and freeze status…"
              : snapshot.extension
                ? "A different extension controls this SSU. CradleOS will not replace or remove it."
                : "Default storage is active. New CradleOS sharing is paused until a reviewed replacement is available."}
        </p>
      )}
      <details className="ssu-details">
        <summary>
          <ClientUIIcon name="action/settings_16px" />
          Manage access
        </summary>
        <p className="ssu-help">
          Saved rules are shown for reference, not as proof of enforced access.
        </p>
        <ul className="ssu-policy-facts">
          <li>
            Saved rule:{" "}
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
                : "Yes, with the matching OwnerCap"
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
                ? `${shared.length} shared stack(s) will remain in the pool. Disabling the extension will make this stock inaccessible until a separately reviewed recovery is available.`
                : "No shared stock was found. The transaction will disable the extension without moving items."}
            </p>
            <p>
              No items will move. Owner and personal storage stay in place. New
              stock arriving before confirmation can also remain in the shared
              pool. No replacement extension will be enabled. Do not change the
              extension in another session while signing; revocation clears the
              extension active at execution.
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
              I understand that no stock will move, sharing will stop, and any
              shared stock will be inaccessible pending recovery.
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
