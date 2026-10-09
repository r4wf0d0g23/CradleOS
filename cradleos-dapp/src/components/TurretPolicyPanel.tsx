/** Personal turret controls: no tribe vault, no shared policy or view-as writes. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { CurrentAccountSigner } from "../lib/cycleSigner";
import { translateTxError } from "../lib/txError";
import {
  fetchPersonalTurrets,
  buildPersonalTurretTransaction,
  isOurTurretExtension,
  PERSONAL_TURRET_PACKAGE,
  type OwnedTurret,
} from "../lib/personalTurrets";
import {
  DEFAULT_TURRET_SETTINGS,
  parsePilotIds,
  encodeTurretSettings,
  type TurretSettings,
} from "../lib/turretSettings";
import "../styles/turrets.css";

const MODES = [
  "Hold fire",
  "Aggressors only",
  "Non-friendlies",
  "Marked hostiles only",
];
const PRIORITIES = [
  "Attackers first",
  "Lowest hull",
  "Lowest shield",
  "Lowest armor",
];
const CLASSES = [
  "Any ship",
  "Match turret weapon",
  "Small · Shuttle / Corvette",
  "Medium · Frigate / Destroyer",
  "Large · Cruiser / Battlecruiser",
];
const LISTS = [
  ["friends", "Friendly pilots"],
  ["hostiles", "Hostile pilots"],
  ["friendlyTribes", "Friendly tribes"],
  ["hostileTribes", "Hostile tribes"],
] as const;

export function TurretSettingsCard({
  turret,
  onSave,
  ready = true,
}: {
  turret: OwnedTurret;
  onSave: (s: TurretSettings | null, replace: boolean) => Promise<string>;
  ready?: boolean;
}) {
  const ours = isOurTurretExtension(turret.extension);
  const initial = turret.settings ?? DEFAULT_TURRET_SETTINGS;
  const [settings, setSettings] = useState<TurretSettings>(initial);
  const [ids, setIds] = useState(
    Object.fromEntries(
      LISTS.map(([key]) => [key, initial[key].join(", ")]),
    ) as Record<(typeof LISTS)[number][0], string>,
  );
  const [replace, setReplace] = useState(false);
  const [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const blocked = !ready || (turret.frozen && !ours);
  const other = !!turret.extension && !ours;
  async function save(restore: boolean) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const s = { ...settings };
      if (!restore) {
        for (const [key] of LISTS) s[key] = parsePilotIds(ids[key]);
        encodeTurretSettings(s);
      }
      const digest = await onSave(restore ? null : s, replace);
      setMessage(`Confirmed · ${digest.slice(0, 12)}…`);
      setReset(false);
    } catch (e) {
      setError(translateTxError(e));
    } finally {
      setBusy(false);
    }
  }
  const update = (key: keyof TurretSettings, value: number | boolean) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setMessage("");
  };
  return (
    <article className="turret-card">
      <header>
        <div>
          <h3>{turret.name}</h3>
          <small>
            {turret.id.slice(0, 10)}…{turret.id.slice(-6)} · Type{" "}
            {turret.typeId}
          </small>
        </div>
        <span className={turret.online ? "turret-online" : "turret-offline"}>
          {turret.online ? "Online" : "Offline"}
        </span>
      </header>
      <p className="turret-state">
        {ours
          ? turret.settings
            ? `Saved: ${MODES[turret.settings.mode]}`
            : "Settings missing or invalid · holding fire"
          : other
            ? "Another extension is configured"
            : "Game defaults"}
        {turret.frozen && " · binding frozen"}
      </p>
      {blocked && (
        <p role="status">
          {!ready
            ? "Controls are awaiting deployment."
            : "This turret is permanently bound to another extension."}
        </p>
      )}
      <fieldset disabled={busy || blocked}>
        <div className="turret-main-controls">
          <label>
            Engagement
            <select
              aria-label={`${turret.name} engagement`}
              value={settings.mode}
              onChange={(e) => update("mode", Number(e.target.value))}
            >
              {MODES.map((s, i) => (
                <option key={s} value={i}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target priority
            <select
              aria-label={`${turret.name} target priority`}
              value={settings.priority}
              onChange={(e) => update("priority", Number(e.target.value))}
            >
              {PRIORITIES.map((s, i) => (
                <option key={s} value={i}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prefer ship class
            <select
              aria-label={`${turret.name} ship class`}
              value={settings.shipClass}
              onChange={(e) => update("shipClass", Number(e.target.value))}
            >
              {CLASSES.map((s, i) => (
                <option
                  key={s}
                  value={i}
                  disabled={
                    i === 1 && ![92402, 92403, 92484].includes(turret.typeId)
                  }
                >
                  {s}
                  {i === 1 && ![92402, 92403, 92484].includes(turret.typeId)
                    ? " · unavailable for this model"
                    : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="turret-help">
          {settings.mode === 0
            ? "No targets selected."
            : settings.mode === 1
              ? "Targets attackers against anyone"
              : settings.mode === 2
                ? "Targets non-friendlies"
                : "Targets hostile lists only"}{" "}
          {settings.shipClass !== 0 &&
            "Class preference → Target priority"}
        </p>
        <details className="turret-advanced">
          <summary>Advanced · friends, hostiles &amp; targeting</summary>
          <p>
            Protected: you, friendly pilots, your tribe and friendly tribes. Hostile pilots override tribe protection.
          </p>
          <label className="turret-check">
            <input
              type="checkbox"
              checked={settings.strictClass}
              onChange={(e) => update("strictClass", e.target.checked)}
            />
            Only target the selected ship class
          </label>
          {settings.strictClass &&
            settings.shipClass === 1 &&
            ![92402, 92403, 92484].includes(turret.typeId) && (
              <p role="status">
                No class match · Strict matching holds fire
              </p>
            )}
          <label className="turret-check">
            <input
              type="checkbox"
              checked={settings.stopOnDisengage}
              onChange={(e) => update("stopOnDisengage", e.target.checked)}
            />
            Drop targets when they stop attacking
          </label>
          <div className="turret-id-lists">
            {LISTS.map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  aria-label={`${turret.name} ${label.toLowerCase()}`}
                  value={ids[key]}
                  placeholder="Game IDs, separated by commas"
                  onChange={(e) => {
                    setIds((v) => ({ ...v, [key]: e.target.value }));
                    setMessage("");
                  }}
                />
              </label>
            ))}
          </div>
          <small>
            Up to 16 game IDs per list · Excludes NPCs
          </small>
        </details>
        {other && (
          <label className="turret-check">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            Replace the current extension with these settings
          </label>
        )}
        <div className="turret-actions">
          <button
            className="turret-primary"
            disabled={other && !replace}
            onClick={() => save(false)}
          >
            {busy ? "Confirming…" : ours ? "Save settings" : "Apply settings"}
          </button>
          {ours && !turret.frozen && (
            <button onClick={() => setReset((v) => !v)}>
              Use game defaults
            </button>
          )}
        </div>
        {reset && (
          <div className="turret-reset">
            <p>
              Remove custom targeting and restore the game’s default rules?
              Same-tribe aggressors may be targeted by those rules.
            </p>
            <button onClick={() => save(true)}>Restore defaults</button>
            <button onClick={() => setReset(false)}>Cancel</button>
          </div>
        )}
      </fieldset>
      {error && (
        <p className="turret-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="turret-confirmed" role="status">
          {message}
        </p>
      )}
    </article>
  );
}

export function TurretPolicyPanel() {
  const { account } = useVerifiedAccountContext();
  const dAppKit = useDAppKit();
  const [confirmed, setConfirmed] = useState<{
    address: string;
    text: string;
  } | null>(null);
  const query = useQuery({
    queryKey: ["personal-turrets", account?.address],
    queryFn: () => fetchPersonalTurrets(account!.address),
    enabled: !!account,
    staleTime: 15000,
    retry: 1,
  });
  async function save(
    turret: OwnedTurret,
    settings: TurretSettings | null,
    replace: boolean,
  ) {
    if (!account) throw new Error("Connect the turret owner's wallet.");
    const address = account.address;
    const fresh = (await fetchPersonalTurrets(address)).find(
      (t) => t.id === turret.id,
    );
    if (!fresh)
      throw new Error(
        "This turret is no longer owned by the connected character.",
      );
    if (fresh.version !== turret.version) {
      await query.refetch();
      throw new Error(
        "Turret changed since loading. Review its refreshed settings before saving.",
      );
    }
    if (dAppKit.stores.$connection.get().account?.address !== address)
      throw new Error("Wallet changed. Refresh before signing.");
    const tx = buildPersonalTurretTransaction(
      address,
      fresh,
      settings,
      replace,
    );
    const signer = new CurrentAccountSigner(dAppKit);
    const result = await signer.signAndExecuteTransaction({ transaction: tx });
    if (result.$kind === "FailedTransaction")
      throw new Error(
        result.FailedTransaction.status.error?.message ??
          "Transaction failed. No settings were saved.",
      );
    if (!result.Transaction?.status.success)
      throw new Error(
        "Transaction outcome is unknown. Refresh before trying again.",
      );
    const digest = result.Transaction.digest;
    setConfirmed({
      address,
      text: `${fresh.name}: ${settings ? "settings saved" : "game defaults restored"} · ${digest.slice(0, 12)}…`,
    });
    // Do not infer success merely from a wallet approval or optimistic state.
    await query.refetch();
    return digest;
  }
  return (
    <section className="personal-turrets">
      <header className="turret-page-header">
        <div>
          <h2>My Turrets</h2>

        </div>
        {account && (
          <button disabled={query.isFetching} onClick={() => query.refetch()}>
            {query.isFetching ? "Refreshing…" : "Refresh"}
          </button>
        )}
      </header>
      {!account ? (
        <p className="turret-empty">
          Connect wallet
        </p>
      ) : (
        <>
          {confirmed?.address === account.address && (
            <p className="turret-confirmed" role="status">
              {confirmed.text}
            </p>
          )}
          {query.isPending && <p role="status">Finding your turrets…</p>}
          {query.isError && (
            <p className="turret-error" role="alert">
              {query.error.message}{" "}
              <button onClick={() => query.refetch()}>Retry</button>
            </p>
          )}
          {!query.isError && query.data?.length === 0 && (
            <p className="turret-empty">
              No turrets found
            </p>
          )}
          {!query.isError && (
            <div className="turret-grid">
              {query.data?.map((t) => (
                <TurretSettingsCard
                  key={`${account.address}:${t.id}:${t.version}`}
                  turret={t}
                  ready={!!PERSONAL_TURRET_PACKAGE}
                  onSave={(s, r) => save(t, s, r)}
                />
              ))}
            </div>
          )}
          <p className="turret-footnote">
            <a href="#/structures">Structure power ↗</a>
          </p>
        </>
      )}
    </section>
  );
}
