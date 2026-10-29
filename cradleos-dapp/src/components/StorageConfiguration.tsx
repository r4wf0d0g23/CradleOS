import { useEffect, useRef, useState } from "react";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { CurrentAccountSigner } from "../lib/cycleSigner";
import { STORAGE_ACCESS_DEPLOYMENT } from "../lib/storageAccessDeployment";
import {
  buildStorageConfiguration,
  CLOSED_RULES,
  readStoragePolicy,
  secureStorageExtension,
  STORAGE_MODE_LABELS,
  storagePreviewKey,
  validateStorageRules,
  type StoragePolicy,
  type StorageRules,
} from "../lib/storageAccess";
import { fetchSsuSnapshot, type SsuSnapshot } from "../lib/ssuSafety";
import { translateTxError } from "../lib/txError";
import { readInventoryCharacter } from "../lib/inventoryRead";

type Props = {
  snapshot?: SsuSnapshot;
  characterId: string | null;
  ownerCapId?: string;
  walletAddress?: string;
  onRefresh: () => void;
  resolvedNames?: Map<number, string>;
};
type Review = {
  snapshot: SsuSnapshot;
  policy: StoragePolicy | null;
  rules: StorageRules;
  replace: boolean;
};
export function StorageConfiguration({
  snapshot,
  characterId,
  ownerCapId,
  walletAddress,
  onRefresh,
  resolvedNames,
}: Props) {
  const kit = useDAppKit();
  const [policy, setPolicy] = useState<StoragePolicy | null>(null);
  const [rules, setRules] = useState<StorageRules>(CLOSED_RULES);
  const [tribes, setTribes] = useState("");
  const [denied, setDenied] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [consent, setConsent] = useState(false);
  const [reload, setReload] = useState(0);
  const identity = `${walletAddress}:${characterId}:${ownerCapId}:${snapshot?.id}`;
  const generation = useRef(0),
    identityRef = useRef(identity);
  if (identityRef.current !== identity) {
    identityRef.current = identity;
    generation.current++;
  }
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setPolicy(null);
    setRules(CLOSED_RULES);
    setTribes("");
    setDenied("");
    setReview(null);
    setConsent(false);
    setError("");
    setStatus("");
    setBusy(false);
    if (!snapshot || !STORAGE_ACCESS_DEPLOYMENT) return;
    const g = generation.current;
    readStoragePolicy(snapshot.id)
      .then((p) => {
        if (cancelled || g !== generation.current) return;
        const r = p?.rules ?? CLOSED_RULES;
        setPolicy(p);
        setRules(r);
        setTribes(r.tribeIds.join(", "));
        setDenied(r.deny.join("\n"));
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled && g === generation.current)
          setError("Access rules unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, [identity, snapshot?.version, reload]);
  const isOwner = !!ownerCapId && !!characterId && !!walletAddress;
  const secure = !!snapshot && secureStorageExtension(snapshot.extension);
  const frozen = !!snapshot?.frozen && !secure;
  const change = (r: StorageRules) => {
    setRules(r);
    setReview(null);
    setConsent(false);
    setStatus("");
    setError("");
  };
  function selectedRules() {
    if (rules.mode === 1 && !tribes.trim())
      throw new Error("Add your tribe or enter a tribe ID.");
    const split = (v: string) => (v.trim() ? v.trim().split(/[\s,]+/) : []);
    return validateStorageRules({
      ...rules,
      tribeIds:
        rules.mode === 1 || rules.mode === 3
          ? split(tribes).map((n) => (/^\d+$/.test(n) ? Number(n) : NaN))
          : [],
      deny: rules.mode === 3 ? split(denied) : [],
      allow: rules.mode === 2 || rules.mode === 3 ? rules.allow : [],
    });
  }
  function assertWallet() {
    if (
      !walletAddress ||
      kit.stores.$connection.get().account?.address !== walletAddress ||
      kit.stores.$currentNetwork.get() !== "testnet"
    )
      throw new Error("Wallet changed. Reopen configuration.");
  }
  async function addMyTribe() {
    if (!isOwner || !characterId || busy || review) return;
    const g = generation.current;
    setBusy(true);
    setError("");
    try {
      assertWallet();
      const { tribeId } = await readInventoryCharacter(characterId);
      if (g !== generation.current) return;
      assertWallet();
      if (!Number.isInteger(tribeId) || tribeId < 1 || tribeId > 0xffffffff)
        throw new Error("No tribe assigned. Enter a tribe ID.");
      const ids = tribes.trim() ? tribes.trim().split(/[\s,]+/) : [];
      if (!ids.some((id) => /^\d+$/.test(id) && Number(id) === tribeId))
        ids.push(String(tribeId));
      setTribes(ids.join(", "));
      change(rules);
    } catch (e) {
      if (g === generation.current) setError(translateTxError(e));
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  async function prepare() {
    if (
      !snapshot ||
      !isOwner ||
      !characterId ||
      !ownerCapId ||
      !walletAddress ||
      busy
    )
      return;
    const g = generation.current;
    setBusy(true);
    setError("");
    setStatus("");
    setReview(null);
    setConsent(false);
    try {
      assertWallet();
      const selected = selectedRules();
      const [fresh, p] = await Promise.all([
        fetchSsuSnapshot(snapshot.id),
        readStoragePolicy(snapshot.id),
      ]);
      if (g !== generation.current) return;
      assertWallet();
      const replace = !secureStorageExtension(fresh.extension);
      buildStorageConfiguration(
        fresh,
        p,
        selected,
        characterId,
        ownerCapId,
        walletAddress,
        replace,
      );
      setReview({ snapshot: fresh, policy: p, rules: selected, replace });
    } catch (e) {
      if (g === generation.current) setError(translateTxError(e));
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  async function submit() {
    if (
      !review ||
      !consent ||
      !characterId ||
      !ownerCapId ||
      !walletAddress ||
      busy
    )
      return;
    const g = generation.current;
    setBusy(true);
    setError("");
    try {
      assertWallet();
      const [fresh, p] = await Promise.all([
        fetchSsuSnapshot(review.snapshot.id),
        readStoragePolicy(review.snapshot.id),
      ]);
      if (g !== generation.current) return;
      assertWallet();
      if (
        storagePreviewKey(fresh, p) !==
        storagePreviewKey(review.snapshot, review.policy)
      )
        throw new Error("Storage or rules changed. Review again.");
      const tx = buildStorageConfiguration(
        fresh,
        p,
        review.rules,
        characterId,
        ownerCapId,
        walletAddress,
        review.replace,
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
        throw new Error("Transaction failed. Configuration unchanged.");
      setReview(null);
      setConsent(false);
      setStatus("Submitted · Verifying…");
      const [after, saved] = await Promise.all([
        fetchSsuSnapshot(fresh.id),
        readStoragePolicy(fresh.id),
      ]);
      if (g !== generation.current) return;
      const verified =
        secureStorageExtension(after.extension) &&
        saved &&
        JSON.stringify(saved.rules) === JSON.stringify(review.rules);
      setStatus(
        verified ? "Configuration saved" : "Submitted · Refresh to verify",
      );
      if (verified) setPolicy(saved);
      onRefresh();
    } catch (e) {
      if (g === generation.current) {
        setError(translateTxError(e));
        setReview(null);
        setConsent(false);
      }
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  const stacks =
    review?.snapshot.slots
      .filter((s) => s.partition === "open")
      .flatMap((s) => s.items)
      .filter((i) => i.quantity > 0) ?? [];
  if (!isOwner)
    return secure ? (
      <p className="ssu-help">
        Access:{" "}
        {loaded
          ? STORAGE_MODE_LABELS[policy?.rules.mode ?? 0]
          : error
            ? "Unavailable"
            : "Checking…"}
      </p>
    ) : null;
  return (
    <div className="ssu-config">
      <strong>Sharing rules</strong>
      <span className="ssu-pill">
        {!STORAGE_ACCESS_DEPLOYMENT
          ? "Release pending"
          : frozen
            ? "Permanently frozen"
            : loaded
              ? secure
                ? STORAGE_MODE_LABELS[policy?.rules.mode ?? 0]
                : "Not enabled"
              : "Unverified"}
      </span>
      <fieldset
        disabled={
          busy ||
          !!review ||
          frozen ||
          !snapshot ||
          (!!STORAGE_ACCESS_DEPLOYMENT && !loaded)
        }
      >
        <legend>Access</legend>
        <div
          className="ssu-config-modes"
          role="group"
          aria-label="Sharing mode"
        >
          {STORAGE_MODE_LABELS.map((label, i) => (
            <button
              type="button"
              key={label}
              aria-pressed={rules.mode === i}
              onClick={() =>
                change({ ...rules, mode: i as StorageRules["mode"] })
              }
            >
              {label}
            </button>
          ))}
        </div>
        {(rules.mode === 1 || rules.mode === 3) && (
          <div>
            <label>
              Tribe IDs
              <input
                aria-label="Tribe IDs"
                value={tribes}
                onChange={(e) => {
                  setTribes(e.target.value);
                  change(rules);
                }}
                placeholder="Tribe IDs, comma-separated"
              />
            </label>
            <button type="button" onClick={addMyTribe}>
              Add my tribe
            </button>
          </div>
        )}
        {(rules.mode === 2 || rules.mode === 3) && (
          <div className="ssu-config-pilots">
            {rules.allow.map((e, i) => (
              <div className="ssu-config-pilot" key={i}>
                <label>
                  Pilot character ID
                  <input
                    aria-label={`Pilot ${i + 1} character ID`}
                    value={e.characterId}
                    onChange={(v) =>
                      change({
                        ...rules,
                        allow: rules.allow.map((a, n) =>
                          n === i ? { ...a, characterId: v.target.value } : a,
                        ),
                      })
                    }
                    placeholder="0x…"
                  />
                </label>
                <label>
                  Expires (local)
                  <input
                    aria-label={`Pilot ${i + 1} expiry`}
                    type="datetime-local"
                    value={
                      e.expiresAt
                        ? new Date(
                            e.expiresAt -
                              new Date(e.expiresAt).getTimezoneOffset() * 60000,
                          )
                            .toISOString()
                            .slice(0, 16)
                        : ""
                    }
                    onChange={(v) =>
                      change({
                        ...rules,
                        allow: rules.allow.map((a, n) =>
                          n === i
                            ? {
                                ...a,
                                expiresAt: v.target.value
                                  ? new Date(v.target.value).getTime()
                                  : 0,
                              }
                            : a,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={e.canDeposit}
                    onChange={(v) =>
                      change({
                        ...rules,
                        allow: rules.allow.map((a, n) =>
                          n === i ? { ...a, canDeposit: v.target.checked } : a,
                        ),
                      })
                    }
                  />
                  Deposit
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={e.canWithdraw}
                    onChange={(v) =>
                      change({
                        ...rules,
                        allow: rules.allow.map((a, n) =>
                          n === i ? { ...a, canWithdraw: v.target.checked } : a,
                        ),
                      })
                    }
                  />
                  Withdraw
                </label>
                <button
                  type="button"
                  aria-label={`Remove pilot ${i + 1}`}
                  onClick={() =>
                    change({
                      ...rules,
                      allow: rules.allow.filter((_, n) => n !== i),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={rules.allow.length >= 128}
              onClick={() =>
                change({
                  ...rules,
                  allow: [
                    ...rules.allow,
                    {
                      characterId: "",
                      expiresAt: 0,
                      canDeposit: true,
                      canWithdraw: true,
                    },
                  ],
                })
              }
            >
              Add pilot
            </button>
          </div>
        )}
        {rules.mode === 3 && (
          <label>
            Denied character IDs
            <textarea
              aria-label="Denied character IDs"
              value={denied}
              onChange={(e) => setDenied(e.target.value)}
              placeholder="0x…"
            />
          </label>
        )}
        {rules.mode === 4 && (
          <p className="ssu-help">
            Anyone can deposit and withdraw shared stock.
          </p>
        )}
      </fieldset>
      {!review && (
        <button
          type="button"
          disabled={
            !STORAGE_ACCESS_DEPLOYMENT || !loaded || busy || frozen || !snapshot
          }
          onClick={prepare}
        >
          {busy ? "Checking…" : "Review configuration"}
        </button>
      )}
      {review && (
        <div className="ssu-warning" aria-label="Review storage configuration">
          <strong>
            Review configuration · {STORAGE_MODE_LABELS[review.rules.mode]}
          </strong>
          {review.rules.tribeIds.length > 0 && (
            <p>Tribes: {review.rules.tribeIds.join(", ")}</p>
          )}
          {review.rules.allow.map((e) => (
            <p className="ssu-object-id" key={e.characterId}>
              {e.characterId} · {e.canDeposit ? "Deposit" : "No deposit"} ·{" "}
              {e.canWithdraw ? "Withdraw" : "No withdraw"} ·{" "}
              {e.expiresAt
                ? new Date(e.expiresAt).toLocaleString()
                : "No expiry"}
            </p>
          ))}
          {review.rules.deny.map((id) => (
            <p className="ssu-object-id" key={id}>
              Deny: {id}
            </p>
          ))}
          <ul className="ssu-policy-facts">
            {review.replace && <li>Replaces the current extension.</li>}
            <li>Rules apply to all shared stock, including new arrivals.</li>
            <li>Owner and personal storage stay private. No items move.</li>
          </ul>
          <p>
            {stacks.length
              ? `${stacks.length} shared stacks`
              : "Shared pool empty"}
          </p>
          {stacks.map((i) => (
            <p key={i.typeId}>
              {resolvedNames?.get(i.typeId) ?? `Item ${i.typeId}`} ×{" "}
              {i.quantity.toLocaleString()}
            </p>
          ))}
          <label className="ssu-confirm">
            <input
              type="checkbox"
              checked={consent}
              disabled={busy}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Apply these permissions to all shared stock
            {review.replace ? " and replace the current extension" : ""}.
          </label>
          <div className="ssu-config-modes">
            <button disabled={!consent || busy} onClick={submit}>
              {busy ? "Submitting…" : "Sign & apply"}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setReview(null);
                setConsent(false);
              }}
            >
              Back
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="ssu-warning" role="alert">
          {error}
          {!loaded && STORAGE_ACCESS_DEPLOYMENT && (
            <button onClick={() => setReload((n) => n + 1)}>
              Retry access read
            </button>
          )}
        </div>
      )}
      {status && (
        <p className="ssu-success" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
