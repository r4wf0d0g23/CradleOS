import { useEffect, useRef, useState } from "react";
import { ShopProceeds } from "./ShopProceeds";
import { useDAppKit } from "@mysten/dapp-kit-react";
import type { PlayerStructure } from "../lib";
import { CurrentAccountSigner } from "../lib/cycleSigner";
import { fetchSsuSnapshot, type SsuSnapshot } from "../lib/ssuSafety";
import { readInventoryCharacter } from "../lib/inventoryRead";
import { getTypeName } from "../data/typeCatalog";
import { ItemIcon } from "./GameIcon";
import { STOREFRONT_DEPLOYMENT } from "../lib/storefrontDeployment";
import {
  storefrontOperationLock,
  buildShopAction,
  discoverShops,
  readShop,
  shopExtension,
  shopPermits,
  shopPreviewKey,
  SHOP_CURRENCIES,
  shopPrice,
  formatShopPrice,
  type Shop,
  type ShopAction,
  type ShopListing,
  type ShopRules,
} from "../lib/storefront";
import "./Storefront.css";

type Props = {
  walletAddress?: string;
  characterId: string | null;
  ownerCaps: Map<string, string>;
  charOwnerCapId: string | null;
  owned: PlayerStructure[];
};
const modes = ["Closed", "Tribes", "Pilots", "Tribes + pilots", "Public"];
const itemName = (id: number) => getTypeName("stillness", id) || `Item ${id}`;
const tokens = (text: string) =>
  text.trim() ? text.trim().split(/[\s,]+/) : [];
const symbol = (type: string) =>
  SHOP_CURRENCIES.find((c) => c.type === type)?.symbol ?? "Unsupported";
export function StorefrontPanel(props: Props) {
  const [shops, setShops] = useState<Shop[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0);
  const [selected, setSelected] = useState(
      () => new URLSearchParams(window.location.search).get("storefront") ?? "",
    ),
    [search, setSearch] = useState("");
  useEffect(() => {
    let stopped = false;
    setLoading(true);
    setError("");
    setShops([]);
    if (!STOREFRONT_DEPLOYMENT) {
      setLoading(false);
      return;
    }
    discoverShops()
      .then((s) => {
        if (!stopped) {
          setShops(s.shops);
          if (s.unavailable)
            setError(`${s.unavailable} storefronts unavailable.`);
        }
      })
      .catch(() => {
        if (!stopped) setError("Storefronts unavailable.");
      })
      .finally(() => {
        if (!stopped) setLoading(false);
      });
    return () => {
      stopped = true;
    };
  }, [props.walletAddress, reload]);
  const select = (id: string) => {
    setSelected(id);
    const u = new URL(window.location.href);
    if (id) u.searchParams.set("storefront", id);
    else u.searchParams.delete("storefront");
    window.history.replaceState(null, "", u);
  };
  return (
    <section className="shop-panel" aria-label="SSU storefronts">
      <header className="shop-heading">
        <h2>Storefronts</h2>
        <span className="ssu-pill">Testnet</span>
        <button onClick={() => setReload((n) => n + 1)} disabled={loading}>
          Refresh shops
        </button>
      </header>
      {!STOREFRONT_DEPLOYMENT ? (
        <div role="status">Storefront release pending</div>
      ) : (
        <>
          {error && <div role="alert">{error}</div>}
          {loading && <div role="status">Loading storefronts…</div>}
          <div className="shop-selection">
            <label>
              Storefront
              <select
                aria-label="Choose storefront"
                value={selected}
                onChange={(e) => select(e.target.value)}
              >
                <option value="">Select SSU</option>
                {shops.map((s) => (
                  <option key={s.ssuId} value={s.ssuId}>
                    {s.name} · {s.open ? "Open" : "Paused"}
                  </option>
                ))}
                {props.owned
                  .filter((s) => !shops.some((p) => p.ssuId === s.objectId))
                  .map((s) => (
                    <option key={s.objectId} value={s.objectId}>
                      {s.displayName} · Set up
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Find shop
              <input
                aria-label="Find shop"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          {!selected && !loading && (
            <div className="shop-directory">
              {shops
                .filter((s) =>
                  `${s.name} ${s.ssuId}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((s) => (
                  <button key={s.id} onClick={() => select(s.ssuId)}>
                    <strong>{s.name}</strong>
                    <span>
                      {s.open ? "Open" : "Paused"} ·{" "}
                      {
                        s.listings.filter((l) => l.enabled && l.stock > 0)
                          .length
                      }{" "}
                      offers
                    </span>
                  </button>
                ))}
              {!shops.length && !error && <span>No storefronts yet</span>}
            </div>
          )}
          {selected && (
            <StorefrontDetails
              key={`${props.walletAddress}:${props.characterId}:${selected}`}
              {...props}
              ssuId={selected}
              onChanged={() => setReload((n) => n + 1)}
            />
          )}
        </>
      )}
    </section>
  );
}
type Review = {
  snapshot: SsuSnapshot;
  shop: Shop | null;
  action: ShopAction;
  summary: string;
};
function StorefrontDetails({
  ssuId,
  onChanged,
  ...props
}: Props & { ssuId: string; onChanged: () => void }) {
  const kit = useDAppKit(),
    generation = useRef(0),
    signing = useRef(false),
    operation = storefrontOperationLock;
  const [snapshot, setSnapshot] = useState<SsuSnapshot | null>(null),
    [shop, setShop] = useState<Shop | null>(null),
    [tribe, setTribe] = useState<number | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [reload, setReload] = useState(0);
  const [review, setReview] = useState<Review | null>(null),
    [consent, setConsent] = useState(false),
    [name, setName] = useState(""),
    [view, setView] = useState<"grid" | "list">("grid");
  const [edit, setEdit] = useState<ShopListing | null>(null),
    [listingOpen, setListingOpen] = useState(false);
  const ownerCap = props.ownerCaps.get(ssuId),
    owner = !!ownerCap && !!props.characterId && !!props.walletAddress;
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    generation.current++;
    let stopped = false;
    setLoading(true);
    setError("");
    setReview(null);
    setConsent(false);
    Promise.all([
      fetchSsuSnapshot(ssuId).catch(() => null),
      readShop(ssuId),
      props.characterId
        ? readInventoryCharacter(props.characterId)
        : Promise.resolve(null),
    ])
      .then(([s, p, c]) => {
        if (!stopped) {
          setSnapshot(s);
          setShop(p);
          setTribe(c?.tribeId ?? null);
          setName(
            p?.name ??
              props.owned.find((o) => o.objectId === ssuId)?.displayName ??
              "Storefront",
          );
          if (!s) setError("Storage unavailable.");
        }
      })
      .catch(() => {
        if (!stopped) {
          setSnapshot(null);
          setShop(null);
          setError("Storefront unavailable. Retry.");
        }
      })
      .finally(() => {
        if (!stopped) setLoading(false);
      });
    return () => {
      stopped = true;
    };
  }, [ssuId, reload, props.characterId]);
  function walletCurrent() {
    if (
      !props.walletAddress ||
      !props.characterId ||
      kit.stores.$connection.get().account?.address !== props.walletAddress ||
      kit.stores.$currentNetwork.get() !== "testnet"
    )
      throw Error("Wallet changed. Reopen storefront.");
  }
  async function prepare(action: ShopAction, summary: string) {
    if (!snapshot || busy || operation.current || signing.current) return;
    operation.current = true;
    const g = generation.current;
    setBusy(true);
    setError("");
    setStatus("");
    setReview(null);
    setConsent(false);
    try {
      walletCurrent();
      const [fresh, p, currentCharacter] = await Promise.all([
        fetchSsuSnapshot(ssuId),
        readShop(ssuId),
        readInventoryCharacter(props.characterId!),
      ]);
      if (g !== generation.current) return;
      walletCurrent();
      if (shopPreviewKey(snapshot, shop) !== shopPreviewKey(fresh, p)) {
        setSnapshot(fresh);
        setShop(p);
        throw Error("Stock or settings changed. Review again.");
      }
      if (
        action.kind === "buy" &&
        (!p || !shopPermits(p, props.characterId!, currentCharacter.tribeId))
      )
        throw Error("Buyer access denied.");
      buildShopAction(
        fresh,
        p,
        action,
        props.characterId!,
        props.walletAddress!,
        ownerCap,
        props.charOwnerCapId ?? undefined,
      );
      setReview({ snapshot: fresh, shop: p, action, summary });
    } catch (e) {
      if (g === generation.current)
        setError(e instanceof Error ? e.message : "Review failed.");
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function submit() {
    if (!review || !consent || operation.current || signing.current) return;
    operation.current = true;
    const g = generation.current;
    setBusy(true);
    setError("");
    try {
      walletCurrent();
      const [fresh, p, currentCharacter] = await Promise.all([
        fetchSsuSnapshot(ssuId),
        readShop(ssuId),
        readInventoryCharacter(props.characterId!),
      ]);
      if (g !== generation.current) return;
      walletCurrent();
      if (
        shopPreviewKey(fresh, p) !==
        shopPreviewKey(review.snapshot, review.shop)
      )
        throw Error("Stock or settings changed. Review again.");
      if (
        review.action.kind === "buy" &&
        (!p || !shopPermits(p, props.characterId!, currentCharacter.tribeId))
      )
        throw Error("Buyer access denied.");
      const tx = buildShopAction(
        fresh,
        p,
        review.action,
        props.characterId!,
        props.walletAddress!,
        ownerCap,
        props.charOwnerCapId ?? undefined,
      );
      signing.current = true;
      let result: any;
      try {
        result = await new CurrentAccountSigner(kit).signAndExecuteTransaction({
          transaction: tx,
        });
      } finally {
        signing.current = false;
      }
      if (g !== generation.current) return;
      if (
        result?.$kind === "FailedTransaction" ||
        result?.FailedTransaction ||
        result?.effects?.status?.status === "failure"
      )
        throw Error("Transaction failed. No changes applied.");
      setStatus("Submitted · Refreshing");
      setReview(null);
      setConsent(false);
      setListingOpen(false);
      setReload((n) => n + 1);
      onChanged();
    } catch (e) {
      if (g === generation.current) {
        setError(e instanceof Error ? e.message : "Transaction failed.");
        setReview(null);
        setConsent(false);
      }
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  const proceeds = shop ? (
    <ShopProceeds
      key={`${shop.id}:${props.walletAddress}`}
      shop={shop}
      characterId={props.characterId}
      wallet={props.walletAddress}
      disabled={!!review}
      operation={operation}
      onBusy={setBusy}
      onChanged={() => {
        setReload((n) => n + 1);
        onChanged();
      }}
    />
  ) : null;
  if (loading) return <div role="status">Reading storefront…</div>;
  if (!snapshot)
    return (
      <>
        <div role="alert">
          {error}
          <button disabled={busy} onClick={() => setReload((n) => n + 1)}>
            Retry storefront
          </button>
        </div>
        {proceeds}
      </>
    );
  const active = shopExtension(snapshot.extension) && snapshot.online,
    disabled = busy || !!review;
  const permitted =
    !!shop &&
    !!props.characterId &&
    tribe !== null &&
    shopPermits(shop, props.characterId, tribe);
  return (
    <div className="shop-details">
      <div className="shop-heading">
        <h3>{shop?.name ?? "New storefront"}</h3>
        <span className="ssu-pill">
          {snapshot.online ? "Online" : "Offline"}
        </span>
        {shop && (
          <span className="ssu-pill">
            {active ? (shop.open ? "Open" : "Paused") : "Inactive"}
          </span>
        )}
        <button disabled={busy} onClick={() => setReload((n) => n + 1)}>
          Refresh stock
        </button>
      </div>
      {error && (
        <div className="ssu-warning" role="alert">
          {error}
        </div>
      )}
      {status && <div role="status">{status}</div>}
      {!shop &&
        (owner ? (
          <div className="shop-create">
            <label>
              Shop name
              <input
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={disabled}
              />
            </label>
            {snapshot.extension ||
            snapshot.frozen ||
            snapshot.slots.some(
              (s) => s.partition === "open" && s.items.length,
            ) ? (
              <span>Requires an empty default-storage SSU</span>
            ) : (
              <button
                disabled={disabled}
                onClick={() =>
                  prepare(
                    { kind: "create", name },
                    `Activate storefront: ${name}. This SSU will use storefront mode, not tribal sharing.`,
                  )
                }
              >
                Review activation
              </button>
            )}
          </div>
        ) : (
          <div>No storefront configured</div>
        ))}
      {shop && (
        <>
          <div className="shop-heading">
            <span>{modes[shop.mode]} access</span>
            <div role="group" aria-label="Offer view">
              <button
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
              >
                Grid
              </button>
              <button
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                List
              </button>
            </div>
            {owner && (
              <button
                disabled={disabled}
                onClick={() => {
                  setEdit(null);
                  setListingOpen(true);
                }}
              >
                Add listing
              </button>
            )}
          </div>
          <div className={`shop-offers ${view}`}>
            {shop.listings.map((l) => (
              <Offer
                key={l.typeId}
                listing={l}
                shop={shop}
                owner={owner}
                canBuy={permitted && active && shop.open}
                disabled={disabled}
                snapshot={snapshot}
                characterCap={props.charOwnerCapId}
                onReview={prepare}
                onEdit={() => {
                  setEdit(l);
                  setListingOpen(true);
                }}
              />
            ))}
            {!shop.listings.length && <span>No listings</span>}
          </div>
          {owner && (
            <>
              {listingOpen && (
                <ListingEditor
                  key={`${edit?.typeId ?? "new"}:${edit?.revision}`}
                  existing={edit}
                  disabled={disabled}
                  onCancel={() => setListingOpen(false)}
                  onReview={(l) =>
                    prepare(
                      { kind: "listing", listing: l },
                      `${edit ? "Update" : "Create"} listing: ${itemName(l.typeId)} · ${formatShopPrice(l.price, l.currency)} ${symbol(l.currency)} each`,
                    )
                  }
                />
              )}
              <ShopSettings
                key={`${shop.id}:${shop.revision}`}
                shop={shop}
                disabled={disabled}
                onReview={(r) =>
                  prepare(
                    { kind: "configure", rules: r },
                    `Save ${r.name} · ${r.open ? "Open" : "Paused"} · ${modes[r.mode]} access`,
                  )
                }
              />
            </>
          )}
        </>
      )}
      {proceeds}
      {review && (
        <section
          className="shop-review"
          aria-label="Review storefront transaction"
        >
          <h4>Review transaction</h4>
          <div>{review.summary}</div>
          {review.action.kind === "buy" && (
            <div>Delivery: personal storage in this SSU</div>
          )}
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={busy}
            />
            Confirm
          </label>
          <div className="shop-actions">
            <button disabled={!consent || busy} onClick={submit}>
              {busy ? "Awaiting wallet…" : "Approve in wallet"}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setReview(null);
                setConsent(false);
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
function Offer({
  listing: l,
  shop,
  owner,
  canBuy,
  disabled,
  snapshot,
  characterCap,
  onReview,
  onEdit,
}: {
  listing: ShopListing;
  shop: Shop;
  owner: boolean;
  canBuy: boolean;
  disabled: boolean;
  snapshot: SsuSnapshot;
  characterCap: string | null;
  onReview: (a: ShopAction, s: string) => void;
  onEdit: () => void;
}) {
  const [amount, setAmount] = useState(String(l.minimum));
  const q = Number(amount),
    valid =
      /^\d+$/.test(amount) &&
      Number.isSafeInteger(q) &&
      q > 0 &&
      q <= 0xffffffff &&
      BigInt(l.price) * BigInt(q) <= 0xffffffffffffffffn;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const scheduled = now < l.startsAt,
    expired = !!l.endsAt && now >= l.endsAt,
    stock = (key: string | undefined) =>
      snapshot.slots
        .find((s) => s.key === key)
        ?.items.find((i) => i.typeId === l.typeId)?.quantity ?? 0;
  return (
    <article className="shop-offer">
      <div className="shop-item">
        <ItemIcon typeId={l.typeId} size={40} />
        <strong>{itemName(l.typeId)}</strong>
      </div>
      <div>
        {formatShopPrice(l.price, l.currency)} {symbol(l.currency)} / item
      </div>
      <div>
        Stock <b>{l.stock}</b> · {l.minimum}–{l.maximum} / order · Step {l.step}
      </div>
      {l.perPilot !== "0" && <div>{l.perPilot} / character · lifetime</div>}
      {(l.startsAt > 0 || l.endsAt > 0) && (
        <div>
          {l.startsAt ? new Date(l.startsAt).toLocaleString() : "Now"} →{" "}
          {l.endsAt ? new Date(l.endsAt).toLocaleString() : "No expiry"}
        </div>
      )}
      <span className="ssu-pill">
        {!l.enabled
          ? "Disabled"
          : scheduled
            ? "Scheduled"
            : expired
              ? "Ended"
              : !l.stock
                ? "Sold out"
                : "Available"}
      </span>
      <label>
        Quantity
        <input
          aria-label={`Quantity for ${itemName(l.typeId)}`}
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={disabled}
        />
      </label>
      {valid && (
        <div>
          Total{" "}
          {formatShopPrice(
            (BigInt(l.price) * BigInt(q)).toString(),
            l.currency,
          )}{" "}
          {symbol(l.currency)}
        </div>
      )}
      <div className="shop-actions">
        <button
          disabled={
            disabled ||
            !valid ||
            !canBuy ||
            !l.enabled ||
            scheduled ||
            expired ||
            q < l.minimum ||
            q > l.maximum ||
            q % l.step !== 0 ||
            q > l.stock ||
            !SHOP_CURRENCIES.some((c) => c.type === l.currency)
          }
          onClick={() =>
            onReview(
              { kind: "buy", typeId: l.typeId, quantity: q },
              `Buy ${q} × ${itemName(l.typeId)} · ${formatShopPrice((BigInt(l.price) * BigInt(q)).toString(), l.currency)} ${symbol(l.currency)} from ${shop.name}`,
            )
          }
        >
          Review purchase
        </button>
        {owner && (
          <>
            <button disabled={disabled} onClick={onEdit}>
              Edit listing
            </button>
            <button
              disabled={disabled || !valid || q > stock(snapshot.ownerCapId)}
              onClick={() =>
                onReview(
                  { kind: "stock_owner", typeId: l.typeId, quantity: q },
                  `Stock ${q} × ${itemName(l.typeId)} from owner storage`,
                )
              }
            >
              Stock from owner
            </button>
            <button
              disabled={
                disabled ||
                !valid ||
                !characterCap ||
                q > stock(characterCap ?? undefined)
              }
              onClick={() =>
                onReview(
                  { kind: "stock_personal", typeId: l.typeId, quantity: q },
                  `Stock ${q} × ${itemName(l.typeId)} from your personal storage`,
                )
              }
            >
              Stock from personal
            </button>
            <button
              disabled={disabled || !valid || q > l.stock}
              onClick={() =>
                onReview(
                  { kind: "unstock", typeId: l.typeId, quantity: q },
                  `Return ${q} × ${itemName(l.typeId)} to your personal storage`,
                )
              }
            >
              Remove stock
            </button>
          </>
        )}
      </div>
    </article>
  );
}
function ShopSettings({
  shop,
  disabled,
  onReview,
}: {
  shop: Shop;
  disabled: boolean;
  onReview: (r: ShopRules) => void;
}) {
  const [name, setName] = useState(shop.name),
    [open, setOpen] = useState(shop.open),
    [mode, setMode] = useState(shop.mode),
    [tribes, setTribes] = useState(shop.tribes.join(", ")),
    [pilots, setPilots] = useState(shop.pilots.join("\n")),
    [deny, setDeny] = useState(shop.deny.join("\n"));
  return (
    <details>
      <summary>Shop settings</summary>
      <fieldset disabled={disabled} className="shop-form">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <input
            type="checkbox"
            checked={open}
            onChange={(e) => setOpen(e.target.checked)}
          />
          Open for sales
        </label>
        <label>
          Buyer access
          <select
            value={mode}
            onChange={(e) => setMode(Number(e.target.value))}
          >
            {modes.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
        </label>
        {(mode === 1 || mode === 3) && (
          <label>
            Tribe IDs
            <input value={tribes} onChange={(e) => setTribes(e.target.value)} />
          </label>
        )}
        {(mode === 2 || mode === 3) && (
          <label>
            Pilot character IDs
            <textarea
              value={pilots}
              onChange={(e) => setPilots(e.target.value)}
            />
          </label>
        )}
        <label>
          Denied character IDs
          <textarea value={deny} onChange={(e) => setDeny(e.target.value)} />
        </label>
        <button
          onClick={() =>
            onReview({
              name,
              open,
              mode,
              tribes:
                mode === 1 || mode === 3 ? tokens(tribes).map(Number) : [],
              pilots: mode === 2 || mode === 3 ? tokens(pilots) : [],
              deny: tokens(deny),
            })
          }
        >
          Review settings
        </button>
      </fieldset>
    </details>
  );
}
function ListingEditor({
  existing: l,
  disabled,
  onCancel,
  onReview,
}: {
  existing: ShopListing | null;
  disabled: boolean;
  onCancel: () => void;
  onReview: (l: ShopListing) => void;
}) {
  const [type, setType] = useState(String(l?.typeId ?? "")),
    [currency, setCurrency] = useState(l?.currency ?? SHOP_CURRENCIES[0].type),
    [price, setPrice] = useState(l ? formatShopPrice(l.price, l.currency) : ""),
    [minimum, setMinimum] = useState(String(l?.minimum ?? 1)),
    [maximum, setMaximum] = useState(String(l?.maximum ?? 1000)),
    [step, setStep] = useState(String(l?.step ?? 1)),
    [limit, setLimit] = useState(l?.perPilot ?? "0"),
    [enabled, setEnabled] = useState(l?.enabled ?? true),
    [start, setStart] = useState(
      l?.startsAt
        ? new Date(
            l.startsAt - new Date(l.startsAt).getTimezoneOffset() * 60000,
          )
            .toISOString()
            .slice(0, 16)
        : "",
    ),
    [end, setEnd] = useState(
      l?.endsAt
        ? new Date(l.endsAt - new Date(l.endsAt).getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
        : "",
    ),
    [error, setError] = useState("");
  const submit = () => {
    try {
      setError("");
      onReview({
        typeId: Number(type),
        currency,
        price: shopPrice(price, currency),
        stock: l?.stock ?? 0,
        revision: l?.revision ?? "0",
        enabled,
        minimum: Number(minimum),
        maximum: Number(maximum),
        step: Number(step),
        startsAt: start ? new Date(start).getTime() : 0,
        endsAt: end ? new Date(end).getTime() : 0,
        perPilot: limit,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid listing.");
    }
  };
  return (
    <section aria-label="Listing editor">
      <h4>{l ? "Edit listing" : "New listing"}</h4>
      <fieldset disabled={disabled} className="shop-form">
        <label>
          Item type ID
          <input
            inputMode="numeric"
            value={type}
            disabled={!!l}
            onChange={(e) => setType(e.target.value)}
          />
        </label>
        <label>
          Currency
          <select
            disabled={!!l}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {SHOP_CURRENCIES.map((c) => (
              <option key={c.type} value={c.type}>
                {c.symbol}
              </option>
            ))}
          </select>
        </label>
        <label>
          Price per item
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <label>
          Minimum / order
          <input value={minimum} onChange={(e) => setMinimum(e.target.value)} />
        </label>
        <label>
          Maximum / order
          <input value={maximum} onChange={(e) => setMaximum(e.target.value)} />
        </label>
        <label>
          Quantity step
          <input value={step} onChange={(e) => setStep(e.target.value)} />
        </label>
        <label>
          Lifetime / character · 0 unlimited
          <input value={limit} onChange={(e) => setLimit(e.target.value)} />
        </label>
        <label>
          Starts · local time
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Ends · local time
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enabled
        </label>
        <div className="shop-actions">
          <button onClick={submit}>Review listing</button>
          <button onClick={onCancel}>Cancel editing</button>
        </div>
      </fieldset>
      {error && <div role="alert">{error}</div>}
    </section>
  );
}
