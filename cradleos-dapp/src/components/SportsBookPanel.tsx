import { useEffect, useRef, useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import type { DAppKit } from "@mysten/dapp-kit-core";
import type { Transaction } from "@mysten/sui/transactions";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { fetchEveCoins, withGas } from "../lib/casino";
import { assertCycleCompatible } from "../lib/transactionCompatibility";
import { SPORTS_DEPLOYMENT as cfg } from "../lib/sportsDeployment";
import {
  fetchBook,
  fetchMarket,
  fetchTickets,
  parseEve,
  formatEve,
  findBookCharacter,
  bookReceipt,
  phase,
  estimatedReturn,
  buildBet,
  buildClaim,
  buildFinalize,
} from "../lib/sportsWager";
const PENDING = "cradle.sports.pending.v1";
const utc = (s: number) =>
  new Date(s * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC";
function readPending() {
  try {
    return sessionStorage.getItem(PENDING) ?? "";
  } catch {
    return "Storage unavailable";
  }
}
export function SportsBookPanel({
  onBusyChange,
}: {
  onBusyChange?: (v: boolean) => void;
}) {
  const kit = useDAppKit<DAppKit<["testnet"]>>(),
    { account } = useVerifiedAccountContext(),
    addr = account?.address ?? "";
  const [selected, setSelected] = useState(""),
    [side, setSide] = useState<1 | 2>(1),
    [amount, setAmount] = useState(""),
    [limit, setLimit] = useState(12);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState(""),
    [pending, setPending] = useState(readPending);
  const [confirm, setConfirm] = useState<{
    id: string;
    wallet: string;
    side: 1 | 2;
    stake: bigint;
    terms: string;
  } | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const lock = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      1000,
    );
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);
  const ready = !!cfg.packageId && !!cfg.bookId;
  const book = useQuery({
    queryKey: ["sportsBook", cfg.bookId],
    queryFn: () => fetchBook(),
    enabled: ready,
    refetchInterval: 15000,
  });
  const tickets = useQuery({
    queryKey: ["sportsTickets", cfg.bookId, addr],
    queryFn: () => fetchTickets(addr),
    enabled: ready && !!addr,
    refetchInterval: 15000,
  });
  const ids = [
    ...new Set([
      ...(book.data?.marketIds.slice(-limit).reverse() ?? []),
      ...(tickets.data?.map((x) => x.marketId) ?? []),
    ]),
  ];
  const markets = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["sportsMarket", id],
      queryFn: () => fetchMarket(id),
      enabled: ready,
      refetchInterval: 15000,
    })),
  });
  const active = selected || ids[0] || "",
    marketQ = markets[ids.indexOf(active)],
    m = marketQ?.data;
  useEffect(() => {
    setConfirm(null);
    setReceipt("");
  }, [addr, active, side, amount, m?.termsHash, m?.result, book.data?.paused]);
  const disabled = busy || !!pending || !addr;
  const open =
    !!m &&
    phase(m, now) === "Open" &&
    cfg.wageringEnabled &&
    !book.data?.paused;
  const preview = (() => {
    try {
      return m ? formatEve(estimatedReturn(m, side, parseEve(amount))) : "—";
    } catch {
      return "—";
    }
  })();
  function clearMarker(marker: string) {
    if (sessionStorage.getItem(PENDING) === marker)
      sessionStorage.removeItem(PENDING);
    if (mounted.current) setPending(readPending());
  }
  async function execute(
    label: string,
    build: () => Promise<Transaction> | Transaction,
  ) {
    if (lock.current || readPending()) return;
    lock.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    setReceipt("");
    let marker = "",
      attempted = false;
    try {
      const signerAccount = kit.stores.$connection.get().account;
      if (
        !addr ||
        signerAccount?.address !== addr ||
        kit.stores.$currentNetwork.get() !== "testnet"
      )
        throw Error("Connect your Sui testnet wallet.");
      const tx = await withGas(await build(), addr);
      tx.setSender(addr);
      if (
        !mounted.current ||
        kit.stores.$connection.get().account?.address !== addr ||
        kit.stores.$currentNetwork.get() !== "testnet"
      )
        throw Error("Wallet changed. Review again.");
      if (readPending()) throw Error("Review the pending transaction first.");
      assertCycleCompatible(tx);
      marker = JSON.stringify({
        id: crypto.randomUUID(),
        book: cfg.bookId,
        address: addr,
        action: label,
        time: new Date().toISOString(),
      });
      sessionStorage.setItem(PENDING, marker);
      setPending(marker);
      attempted = true;
      const result = await kit.signAndExecuteTransaction({
        transaction: tx,
        account: signerAccount,
        network: "testnet",
      });
      if (result.$kind === "FailedTransaction") {
        attempted = false;
        clearMarker(marker);
      }
      const digest = bookReceipt(result);
      clearMarker(marker);
      if (mounted.current) {
        setReceipt(digest);
        setConfirm(null);
        setAmount("");
      }
      void book.refetch();
      void tickets.refetch();
      for (const q of markets) void q.refetch();
    } catch (e) {
      if (mounted.current)
        setError(
          `${e instanceof Error ? e.message : String(e)}${attempted ? " Check wallet activity before retrying." : ""}`,
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
      onBusyChange?.(false);
    }
  }

  async function wager() {
    if (!m || !confirm) return;
    const c = confirm;
    if (
      c.id !== m.id ||
      c.wallet !== addr ||
      c.side !== side ||
      c.stake !== parseEve(amount) ||
      c.terms !== m.termsHash
    ) {
      setConfirm(null);
      setError("Bet changed. Review again.");
      return;
    }
    await execute("Place sports bet", async () => {
      const [fresh, b, character, coins] = await Promise.all([
        fetchMarket(c.id),
        fetchBook(),
        findBookCharacter(addr),
        fetchEveCoins(addr),
      ]);
      if (
        b.paused ||
        fresh.termsHash !== c.terms ||
        fresh.creator === addr ||
        fresh.reporter === addr
      )
        throw Error("Bet unavailable.");
      return buildBet(fresh, character, c.side, c.stake, coins.coins);
    });
  }
  return (
    <section
      className="betting-book"
      aria-labelledby="sports-title"
      aria-busy={busy}
    >
      <header className="book-heading">
        <div>
          <h2 id="sports-title">Sports Book</h2>
          <span>TESTNET EVE · 0% FEE</span>
        </div>
        {!addr && <ConnectButton />}
      </header>
      {!ready ? (
        <p role="status">Unavailable</p>
      ) : book.isError ? (
        <p role="alert">
          Book unavailable{" "}
          <button onClick={() => void book.refetch()}>Retry</button>
        </p>
      ) : !book.data ? (
        <p role="status">Loading…</p>
      ) : (
        <>
          {(book.data.paused || !cfg.wageringEnabled) && (
            <p className="book-notice">New bets paused</p>
          )}
          <div className="book-layout">
            <nav className="book-list" aria-label="Sports fixtures">
              {!ids.length && <p>No fixtures listed</p>}
              {ids.map((id, i) => {
                const q = markets[i],
                  v = q.data;
                return (
                  <button
                    key={id}
                    disabled={busy}
                    aria-pressed={active === id}
                    onClick={() => {
                      setSelected(id);
                      setAmount("");
                      setConfirm(null);
                    }}
                  >
                    <strong>{v ? v.labels.join(" vs. ") : "Fixture"}</strong>
                    <span>
                      {v
                        ? phase(v, now)
                        : q.isError
                          ? "Unavailable"
                          : "Loading…"}
                    </span>
                    {v && (
                      <small>
                        {v.league === 1 ? "NBA" : "NFL"} · {utc(v.starts)}
                      </small>
                    )}
                  </button>
                );
              })}
              {book.data.marketIds.length > limit && (
                <button onClick={() => setLimit((x) => x + 12)}>
                  More fixtures
                </button>
              )}
            </nav>
            <div className="book-detail">
              {marketQ?.isError ? (
                <p role="alert">
                  Fixture unavailable{" "}
                  <button onClick={() => void marketQ.refetch()}>Retry</button>
                </p>
              ) : m ? (
                <>
                  <div className="book-heading">
                    <h3>{m.labels.join(" vs. ")}</h3>
                    <b>{phase(m, now)}</b>
                  </div>
                  <a
                    href={"https://polymarket.com/event/" + m.slug}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Polymarket · Cradle reporter
                  </a>
                  <dl className="book-metrics">
                    <div>
                      <dt>Start</dt>
                      <dd>{utc(m.starts)}</dd>
                    </div>
                    <div>
                      <dt>Bets close</dt>
                      <dd>{utc(m.cutoff)}</dd>
                    </div>
                    <div>
                      <dt>Refund deadline</dt>
                      <dd>{utc(m.proofDeadline)}</dd>
                    </div>
                  </dl>
                  {m.result === 0 && now >= m.proofDeadline && (
                    <button
                      disabled={disabled}
                      onClick={() =>
                        void execute("Release sports refunds", () =>
                          buildFinalize(m.id),
                        )
                      }
                    >
                      Release refunds
                    </button>
                  )}
                  <div className="book-sides">
                    {([1, 2] as const).map((v) => (
                      <button
                        key={v}
                        disabled={disabled || !open}
                        aria-pressed={side === v}
                        onClick={() => setSide(v)}
                      >
                        <span>{m.labels[v - 1]}</span>
                        <b>{formatEve(v === 1 ? m.poolA : m.poolB)} EVE</b>
                        <small>Pool</small>
                      </button>
                    ))}
                  </div>
                  <p className="book-notice">
                    Full game + overtime · 2h confirmation · Tie, void,
                    one-sided or unconfirmed at deadline: refund
                  </p>
                  <div className="book-form">
                    <label>
                      Stake · EVE
                      <input
                        aria-label="Sports stake EVE"
                        inputMode="decimal"
                        value={amount}
                        disabled={disabled || !open}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </label>
                    <span>Pool return (est.) · {preview} EVE</span>
                    <button
                      disabled={
                        disabled ||
                        !open ||
                        m.creator === addr ||
                        m.reporter === addr
                      }
                      onClick={() => {
                        try {
                          const stake = parseEve(amount);
                          estimatedReturn(m, side, stake);
                          setError("");
                          setConfirm({
                            id: m.id,
                            wallet: addr,
                            side,
                            stake,
                            terms: m.termsHash,
                          });
                        } catch (e) {
                          setError(e instanceof Error ? e.message : String(e));
                        }
                      }}
                    >
                      Review bet
                    </button>
                  </div>
                  {confirm && open && (
                    <div className="book-confirm">
                      <b>
                        {formatEve(confirm.stake)} EVE ·{" "}
                        {m.labels[confirm.side - 1]}
                      </b>
                      <p>
                        Stake locked. Return varies with the final pool; a
                        losing bet returns 0.
                      </p>
                      <button disabled={disabled} onClick={() => void wager()}>
                        Confirm bet
                      </button>
                      <button disabled={busy} onClick={() => setConfirm(null)}>
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              ) : ids.length ? (
                <p>Loading fixture…</p>
              ) : null}
            </div>
          </div>
          {!!addr && (
            <section className="book-tickets">
              <h3>My sports bets</h3>
              {tickets.isError ? (
                <p>Payment status unavailable</p>
              ) : !tickets.data ? (
                <p>Loading…</p>
              ) : !tickets.data.length ? (
                <p>No bets</p>
              ) : (
                tickets.data.map((t) => {
                  const v = markets[ids.indexOf(t.marketId)]?.data;
                  return (
                    <div className="book-heading" key={t.id}>
                      <span>
                        {v ? v.labels[t.side - 1] : "Fixture"} ·{" "}
                        {formatEve(t.stake)} EVE
                      </span>
                      <b>
                        {t.paid
                          ? `Paid ${formatEve(t.payout)} EVE`
                          : v?.result
                            ? "Payout queued"
                            : "Pending"}
                      </b>
                      {!t.paid && !!v?.result && (
                        <button
                          disabled={disabled}
                          onClick={() =>
                            void execute("Claim sports payout", () =>
                              buildClaim(t.marketId, t.entitlementId),
                            )
                          }
                        >
                          Claim
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </section>
          )}
        </>
      )}
      {pending && (
        <div className="book-notice">
          <span>Transaction status unknown</span>
          <button
            disabled={busy}
            onClick={() => {
              try {
                clearMarker(pending);
              } catch {
                setError("Storage unavailable.");
              }
            }}
          >
            Wallet activity checked
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="book-error">
          {error}
        </p>
      )}
      {receipt && (
        <p role="status">
          Confirmed ·{" "}
          <a
            href={`https://suiscan.xyz/testnet/tx/${receipt}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction
          </a>
        </p>
      )}
    </section>
  );
}
