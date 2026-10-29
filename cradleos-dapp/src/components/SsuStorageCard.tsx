import { shopExtension } from "../lib/storefront";
import { useEffect, useRef, useState } from "react";
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
import { secureStorageExtension } from "../lib/storageAccess";
import { useStorageTransfers } from "./useStorageTransfers";
import { useStorageView } from "./useStorageView";
import {
  storageTransferTarget,
  type StorageDropTarget,
} from "../lib/storageTransferIntent";

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
  const [view, setView] = useStorageView();
  const [dropTarget, setDropTarget] = useState<StorageDropTarget | null>(null);
  const drag = useRef<{ item: StorageItem; identity: string } | null>(null);
  const { ssu, snapshot } = inv;
  const ownerCapId = ownerCaps.get(ssu.objectId);
  const available = !!snapshot && !inv.error && !inv.loading;
  const transfers = useStorageTransfers({
    snapshot: available ? snapshot : undefined,
    characterId,
    walletAddress,
    ownerCapId,
    charOwnerCapId,
    names: inv.resolvedNames,
    onRefresh: () => onRefresh(ssu.objectId),
  });
  useEffect(() => {
    drag.current = null;
    setDropTarget(null);
  }, [transfers.identity, collapsed]);
  const clearDrag = () => {
    drag.current = null;
    setDropTarget(null);
  };
  const acceptsDrop = (key: Filter) => {
    const active = drag.current;
    if (!active || active.identity !== transfers.identity || transfers.disabled)
      return false;
    const direction = transfers.directionFor(active.item);
    return !!direction && storageTransferTarget(direction) === key;
  };
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
  const tabs: { key: Filter; label: string; icon: string }[] = [
    {
      key: "all",
      label: "All stock",
      icon: "gameplay/inventory_32px",
    },
    {
      key: "owner_main",
      label: "Owner storage",
      icon: "window/locked_16px",
    },
    {
      key: "personal",
      label: "Personal storage",
      icon: "generic/person_16px",
    },
    {
      key: "open",
      label: shopExtension(snapshot?.extension ?? null) ? "Shop stock" : "Shared pool",
      icon: "folder/shared_folder_16px",
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
                  : shopExtension(snapshot.extension)
                    ? "Storefront"
                    : snapshot.extension
                    ? secureStorageExtension(snapshot.extension)
                      ? "Sharing enabled"
                      : "Other extension"
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
          {shopExtension(snapshot?.extension ?? null) ? <div className="ssu-warning">Storefront mode · Manage under Storefronts</div> : <SharedAccessSection
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
          />}
          <div
            className="ssu-storage-tabs"
            role="group"
            aria-label="Storage area"
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                aria-pressed={filter === tab.key}
                className={
                  dropTarget === tab.key ? "ssu-drop-ready" : undefined
                }
                onClick={() => setFilter(tab.key)}
                onDragOver={(e) => {
                  if (acceptsDrop(tab.key)) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDropTarget(tab.key as StorageDropTarget);
                  }
                }}
                onDragLeave={(e) => {
                  if (
                    !(
                      e.relatedTarget instanceof Node &&
                      e.currentTarget.contains(e.relatedTarget)
                    )
                  )
                    setDropTarget(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const active = drag.current;
                  if (active && acceptsDrop(tab.key))
                    transfers.request(active.item);
                  clearDrag();
                }}
              >
                <ClientUIIcon name={tab.icon} size={24} />
                <span>{tab.label}</span>
                <b>{available ? counts[tab.key] : "—"}</b>
              </button>
            ))}
          </div>

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
            <div
              className="ssu-view-switch"
              role="group"
              aria-label="Stock view"
            >
              <button
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                List
              </button>
              <button
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
              >
                Grid
              </button>
            </div>
            <span>
              {available
                ? `${rows.length} stack${rows.length === 1 ? "" : "s"}`
                : inv.loading
                  ? "Loading"
                  : "Unavailable"}
            </span>
          </div>
          {available && characterId && !charOwnerCapId && (
            <p className="ssu-help" role="status">
              Personal access unavailable · Refresh
            </p>
          )}
          {inv.loading ? (
            <p className="ssu-empty" role="status">
              Reading storage…
            </p>
          ) : inv.error ? (
            <div className="ssu-warning" role="alert">
              Storage unavailable.
              <button onClick={() => onRefresh(ssu.objectId)}>
                Retry storage read
              </button>
            </div>
          ) : !snapshot ? (
            <p className="ssu-empty">Not loaded</p>
          ) : !rows.length ? (
            <p className="ssu-empty">
              {query ? "No matching items." : "No stock in this view."}
            </p>
          ) : (
            <ul
              className={`ssu-stock-list${view === "grid" ? " ssu-stock-grid" : ""}`}
              aria-label="Stored items"
            >
              {rows.map((item) => (
                <li
                  key={`${item.partitionKey}:${item.typeId}`}
                  draggable={
                    !transfers.disabled && !!transfers.directionFor(item)
                  }
                  onDragStart={(e) => {
                    if (transfers.disabled || !transfers.directionFor(item)) {
                      e.preventDefault();
                      return;
                    }
                    drag.current = { item, identity: transfers.identity };
                    e.dataTransfer.effectAllowed = "move";
                    // No external payload is accepted. The active source is local to this card.
                    e.dataTransfer.setData(
                      "application/x-cradleos-storage",
                      "local-stack",
                    );
                  }}
                  onDragEnd={clearDrag}
                >
                  <ItemIcon
                    typeId={item.typeId}
                    size={view === "grid" ? 64 : 44}
                  />
                  <div className="ssu-stock-name">
                    <strong>{nameOf(item)}</strong>
                    <small>
                      {item.partition === "open"
                        ? secureStorageExtension(snapshot.extension)
                          ? "Shared pool"
                          : "Shared pool · transfers paused"
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
                    {transfers.action(item)}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {transfers.controls}
          {available && snapshot && (
            <details className="ssu-details">
              <summary>
                <ClientUIIcon name="editing/details_view_16px" />
                Storage capacity & details
              </summary>

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
            </details>
          )}
        </div>
      )}
    </section>
  );
}
