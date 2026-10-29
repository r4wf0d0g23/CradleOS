import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { CurrentAccountSigner } from "../lib/cycleSigner";
import {
  SHOP_CURRENCIES,
  readShop,
  readShopClaimAuthority,
  readShopProceeds,
  buildShopClaim,
  formatShopPrice,
  type Shop,
  type ShopClaimAuthority,
} from "../lib/storefront";
export function ShopProceeds({
  shop,
  characterId,
  wallet,
  disabled,
  operation,
  onBusy,
  onChanged,
}: {
  shop: Shop;
  characterId: string | null;
  wallet?: string;
  disabled: boolean;
  operation: MutableRefObject<boolean>;
  onBusy: (v: boolean) => void;
  onChanged: () => void;
}) {
  const kit = useDAppKit(),
    generation = useRef(0),
    [authority, setAuthority] = useState<ShopClaimAuthority | null>(null),
    [funds, setFunds] = useState<Record<string, string> | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [review, setReview] = useState<{
      shop: Shop;
      authority: ShopClaimAuthority;
      currency: string;
      amount: string;
    } | null>(null),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let gone = false;
    generation.current++;
    setReview(null);
    setConsent(false);
    setAuthority(null);
    setFunds(null);
    setLoading(true);
    if (!characterId || !wallet) {
      setLoading(false);
      return;
    }
    Promise.all([
      readShopClaimAuthority(shop, characterId, wallet),
      readShopProceeds(shop),
    ])
      .then(([a, f]) => {
        if (!gone) {
          setAuthority(a);
          setFunds(f);
        }
      })
      .catch(() => {
        if (!gone) setError("Proceeds unavailable.");
      })
      .finally(() => {
        if (!gone) setLoading(false);
      });
    return () => {
      gone = true;
      generation.current++;
    };
  }, [shop.id, shop.version, characterId, wallet]);
  const current = () => {
    if (
      !wallet ||
      !characterId ||
      kit.stores.$connection.get().account?.address !== wallet ||
      kit.stores.$currentNetwork.get() !== "testnet"
    )
      throw Error("Wallet changed. Reopen proceeds.");
  };
  async function prepare(currency: string) {
    if (operation.current || disabled || busy) return;
    operation.current = true;
    onBusy(true);
    setBusy(true);
    setError("");
    const g = generation.current;
    try {
      current();
      const p = await readShop(shop.ssuId);
      if (!p) throw Error("Proceeds unavailable.");
      const [a, f] = await Promise.all([
        readShopClaimAuthority(p, characterId!, wallet!),
        readShopProceeds(p),
      ]);
      if (g !== generation.current) return;
      current();
      if (!a || !f[currency] || f[currency] === "0")
        throw Error("No proceeds available.");
      buildShopClaim(p, currency, a);
      setReview({ shop: p, authority: a, currency, amount: f[currency] });
      setConsent(false);
    } catch (e) {
      if (g === generation.current) {
        setError(e instanceof Error ? e.message : "Proceeds unavailable.");
        onBusy(false);
      }
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function submit() {
    if (!review || !consent || busy || operation.current) return;
    operation.current = true;
    setBusy(true);
    const g = generation.current;
    try {
      current();
      const p = await readShop(shop.ssuId);
      if (!p) throw Error("Proceeds unavailable.");
      const [a, f] = await Promise.all([
        readShopClaimAuthority(p, characterId!, wallet!),
        readShopProceeds(p),
      ]);
      if (g !== generation.current) return;
      current();
      if (
        !a ||
        JSON.stringify([a.capId, a.direct, a.wallet, a.characterId]) !==
          JSON.stringify([
            review.authority.capId,
            review.authority.direct,
            review.authority.wallet,
            review.authority.characterId,
          ]) ||
        f[review.currency] !== review.amount
      )
        throw Error("Proceeds changed. Review again.");
      const result: any = await new CurrentAccountSigner(
        kit,
      ).signAndExecuteTransaction({
        transaction: buildShopClaim(p, review.currency, a),
      });
      if (g !== generation.current) return;
      if (
        result?.$kind === "FailedTransaction" ||
        result?.FailedTransaction ||
        result?.effects?.status?.status === "failure"
      )
        throw Error("Withdrawal failed.");
      setReview(null);
      onChanged();
    } catch (e) {
      if (g === generation.current) {
        setReview(null);
        setError(e instanceof Error ? e.message : "Withdrawal failed.");
      }
    } finally {
      operation.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  if (!authority && !error)
    return loading ? <div role="status">Reading proceeds…</div> : null;
  return (
    <details>
      <summary>Seller proceeds</summary>
      {error && <div role="alert">{error}</div>}
      {authority && (
        <div className="shop-actions">
          {SHOP_CURRENCIES.map((c) => (
            <div key={c.type}>
              <strong>
                {funds ? formatShopPrice(funds[c.type], c.type) : "—"}{" "}
                {c.symbol}
              </strong>
              <button
                disabled={
                  disabled ||
                  busy ||
                  !!review ||
                  !funds ||
                  funds[c.type] === "0"
                }
                onClick={() => prepare(c.type)}
              >
                Withdraw {c.symbol}
              </button>
            </div>
          ))}
        </div>
      )}
      {review && (
        <section className="shop-review" aria-label="Review proceeds">
          <h4>Withdraw proceeds</h4>
          <div>
            {formatShopPrice(review.amount, review.currency)}{" "}
            {SHOP_CURRENCIES.find((c) => c.type === review.currency)?.symbol} →
            your wallet
          </div>
          <label>
            <input
              type="checkbox"
              checked={consent}
              disabled={busy}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Confirm withdrawal
          </label>
          <button disabled={!consent || busy} onClick={submit}>
            Approve withdrawal
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setReview(null);
              setConsent(false);
              onBusy(false);
            }}
          >
            Cancel withdrawal
          </button>
        </section>
      )}
    </details>
  );
}
