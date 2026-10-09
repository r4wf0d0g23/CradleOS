import { useState } from "react";
import { ItemIcon, ClientUIIcon } from "./GameIcon";
import { SharedAccessSection } from "./SharedAccessSection";
import {
  isUnsafeSsuExtension,
  type SsuSnapshot,
  type StorageItem,
} from "../lib/ssuSafety";
import type { PlayerStructure } from "../lib";
import type { LoadedPolicy } from "../lib/ssuAccess";
import "./SsuStorage.css";

export type SsuInventoryView = {
  ssu: PlayerStructure;
  items: StorageItem[];
  resolvedNames: Map<number, string>;
  loading: boolean;
  error?: string;
  snapshot?: SsuSnapshot;
  policy?: LoadedPolicy;
  operator?: { name: string; key: string };
};
type Props = {
  inv: SsuInventoryView;
  characterId: string | null;
  ownerCaps: Map<string, string>;
  walletAddress: string | undefined;
  onRefresh: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  charOwnerCapId: string | null;
};
const volume = (n: number) =>
  (n / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
type Filter = "all" | "owner_main" | "personal" | "open";
export function SsuStorageCard({
  inv,
  characterId,
  ownerCaps,
  walletAddress,
  onRefresh,
  collapsed,
  onToggleCollapse,
  charOwnerCapId,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const { ssu, snapshot } = inv;
  const ownerCapId = ownerCaps.get(ssu.objectId);
  const all = inv.items.filter((i) => i.quantity > 0);
  const nameOf = (item: StorageItem) =>
    inv.resolvedNames.get(item.typeId) ?? `Item ${item.typeId}`;
  const rows = all.filter(
    (i) =>
      (filter === "all" ||
        (filter === "personal"
          ? i.partition === "unknown"
          : i.partition === filter)) &&
      `${nameOf(i)} ${i.typeId}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const unsafe = !!snapshot && isUnsafeSsuExtension(snapshot.extension);
  const counts = {
    all: all.length,
    owner_main: all.filter((i) => i.partition === "owner_main").length,
    personal: all.filter((i) => i.partition === "unknown").length,
    open: all.filter((i) => i.partition === "open").length,
  };
  const tabs: { key: Filter; label: string; icon: string; help: string }[] = [
    {
      key: "all",
      label: "All stock",
      icon: "gameplay/inventory_32px",
      help: "Storage areas are separate. A shared policy does not change ownership.",
    },
    {
      key: "owner_main",
      label: "Owner storage",
      icon: "window/locked_16px",
      help: "The SSU owner's inventory. Use the in-game client for normal owner transfers.",
    },
    {
      key: "personal",
      label: "Personal storage",
      icon: "generic/person_16px",
      help: "Separate inventories for individual pilots. Your personal storage stays separate from other pilots' stock.",
    },
    {
      key: "open",
      label: "Shared pool",
      icon: "folder/shared_folder_16px",
      help: "Extension-controlled stock. Shared transfers are paused while the current access extension is unsafe.",
    },
  ];
  return (
    <section className="ssu-card" aria-label={`${ssu.displayName} storage`}>
      <header className="ssu-card-header">
        <button
          className="ssu-expand"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${ssu.displayName}`}
        >
          <ItemIcon typeId={ssu.typeId} size={44} />
          <span>
            <strong>{ssu.displayName}</strong>
            <small>
              {inv.operator?.name ?? "Operator loading…"} ·{" "}
              {ownerCapId ? "Your SSU" : "Other operator"}
            </small>
          </span>
          <ClientUIIcon
            name={
              collapsed ? "action/expand_more_16px" : "action/expand_less_16px"
            }
          />
        </button>
        <div className="ssu-header-status">
          <span className={`ssu-pill ${ssu.isOnline ? "online" : ""}`}>
            {ssu.isOnline ? "Online" : "Offline"}
          </span>
          <span className={`ssu-pill ${unsafe ? "danger" : ""}`}>
            {inv.error
              ? "Check failed"
              : !snapshot
                ? "Not checked"
                : unsafe
                  ? "Owner action needed"
                  : snapshot.extension
                    ? "Other extension"
                    : "Default storage"}
          </span>
          <button
            className="ssu-icon-button"
            onClick={() => onRefresh(ssu.objectId)}
            disabled={inv.loading}
            aria-label={`Refresh ${ssu.displayName}`}
          >
            <ClientUIIcon name="action/refresh_16px" />
            Refresh
          </button>
        </div>
      </header>
      {!collapsed && (
        <div className="ssu-card-body">
          <SharedAccessSection
            ssuObjectId={ssu.objectId}
            ssuTypeFull={ssu.typeFull}
            ownerCapId={ownerCapId}
            characterId={characterId}
            walletAddress={walletAddress}
            snapshot={snapshot}
            loadedPolicy={inv.policy}
            resolvedNames={inv.resolvedNames}
            readError={inv.error}
            onRefresh={() => onRefresh(ssu.objectId)}
          />
          <div
            className="ssu-storage-tabs"
            role="group"
            aria-label="Storage area"
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                aria-pressed={filter === tab.key}
                onClick={() => setFilter(tab.key)}
              >
                <ClientUIIcon name={tab.icon} size={24} />
                <span>{tab.label}</span>
                <b>{counts[tab.key]}</b>
              </button>
            ))}
          </div>
          <p className="ssu-help">{tabs.find((t) => t.key === filter)?.help}</p>
          {unsafe && (
            <p className="ssu-risk-note">
              The active extension can bypass the saved rules, including access
              to owner storage and the shared pool. These area labels are not a
              security guarantee while it remains enabled.
            </p>
          )}
          <div className="ssu-stock-toolbar">
            <label className="ssu-search">
              <ClientUIIcon name="action/search_16px" />
              <input
                aria-label={`Search stock in ${ssu.displayName}`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find an item…"
                type="search"
              />
            </label>
            <span>
              {rows.length} stack{rows.length === 1 ? "" : "s"}
            </span>
          </div>
          {inv.loading ? (
            <p className="ssu-empty" role="status">
              Reading storage…
            </p>
          ) : inv.error ? (
            <div className="ssu-warning" role="alert">
              {inv.error}
              <button onClick={() => onRefresh(ssu.objectId)}>
                Retry storage read
              </button>
            </div>
          ) : !rows.length ? (
            <p className="ssu-empty">
              {query ? "No matching items." : "No stock in this view."}
            </p>
          ) : (
            <ul className="ssu-stock-list">
              {rows.map((item) => (
                <li key={`${item.partitionKey}:${item.typeId}`}>
                  <ItemIcon typeId={item.typeId} size={44} />
                  <div className="ssu-stock-name">
                    <strong>{nameOf(item)}</strong>
                    <small>
                      {item.partition === "open"
                        ? "Shared pool · transfers paused"
                        : item.partition === "owner_main"
                          ? "Owner storage"
                          : item.partitionKey === charOwnerCapId
                            ? "Your personal storage"
                            : "Another pilot's storage"}
                    </small>
                  </div>
                  <div className="ssu-stock-quantity">
                    <strong>× {item.quantity.toLocaleString()}</strong>
                    <small>{volume(item.volume * item.quantity)} m³</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {snapshot && (
            <details className="ssu-details">
              <summary>
                <ClientUIIcon name="editing/details_view_16px" />
                Storage capacity & details
              </summary>
              <p className="ssu-help">
                Capacity is measured separately for each storage area, not as
                one combined tank.
              </p>
              {snapshot.slots.map((slot) => (
                <div className="ssu-capacity" key={slot.key}>
                  <span>
                    {slot.partition === "open"
                      ? "Shared pool"
                      : slot.partition === "owner_main"
                        ? "Owner storage"
                        : slot.key === charOwnerCapId
                          ? "Your personal storage"
                          : `Pilot storage …${slot.key.slice(-6)}`}
                  </span>
                  <span>
                    {volume(slot.used)} / {volume(slot.max)} m³
                  </span>
                  <meter
                    min={0}
                    max={Math.max(slot.max, 1)}
                    value={slot.used}
                    aria-label={`${slot.partition} capacity`}
                  />
                </div>
              ))}
              <small className="ssu-object-id">SSU {ssu.objectId}</small>
              <small className="ssu-help">
                Inventory contents are public on-chain. No items have been moved
                by viewing this page.
              </small>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
