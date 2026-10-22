import { useEffect, useRef, useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import type { DAppKit } from "@mysten/dapp-kit-core";
import type { Transaction } from "@mysten/sui/transactions";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { fetchEveCoins, withGas } from "../lib/casino";
import { assertCycleCompatible } from "../lib/transactionCompatibility";
import { BOOK_DEPLOYMENT as cfg } from "../lib/bookDeployment";
import {
  configured,
  fetchBook,
  fetchMarket,
  fetchTickets,
  fetchBookAdmin,
  findBookCharacter,
  marketPhase,
  parseEve,
  formatEve,
  estimatedReturn,
  ticketReturn,
  buildBet,
  buildProof,
  buildFinalize,
  buildClaim,
  buildCreate,
  bookReceipt,
} from "../lib/bettingBook";
import "./BettingBookPanel.css";

const PENDING = "cradle.book.pending.v1";
const utc = (s: number) =>
  new Date(s * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC";
function readPending() {
  try {
    return sessionStorage.getItem(PENDING) ?? "";
  } catch {
    return "Storage unavailable";
  }
}
export function BettingBookPanel({
  onBusyChange,
}: {
  onBusyChange?: (v: boolean) => void;
}) {
  const kit = useDAppKit<DAppKit<["testnet"]>>(),
    { account } = useVerifiedAccountContext(),
    addr = account?.address ?? "";
  const [selected, setSelected] = useState(""),
    [limit, setLimit] = useState(12),
    [side, setSide] = useState<1 | 2>(1),
    [amount, setAmount] = useState(""),
    [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState(""),
    [pending, setPending] = useState(readPending),
    [confirm, setConfirm] = useState<{
      marketId: string;
      wallet: string;
      side: 1 | 2;
      stake: bigint;
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
  useEffect(() => {
    setConfirm(null);
    setReceipt("");
  }, [addr, selected, amount, side]);
  const ready = configured();
  const book = useQuery({
    queryKey: ["bettingBook", cfg.bookId],
    queryFn: () => fetchBook(),
    enabled: ready,
    refetchInterval: 15000,
  });
  const tickets = useQuery({
    queryKey: ["bookTickets", cfg.bookId, addr],
    queryFn: () => fetchTickets(addr),
    enabled: ready && !!addr,
    refetchInterval: 15000,
  });
  const admin = useQuery({
    queryKey: ["bookAdmin", cfg.bookId, addr],
    queryFn: () => fetchBookAdmin(addr),
    enabled: ready && !!addr,
  });
  const ids = [
    ...new Set([
      ...(book.data?.marketIds.slice(-limit).reverse() ?? []),
      ...(tickets.data?.map((t) => t.marketId) ?? []),
    ]),
  ];
  const markets = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["bookMarket", id],
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
  }, [active]);
  const [create, setCreate] = useState({
    a: "",
    b: "",
    starts: "",
    ends: "",
    deadline: "",
    loss: "1",
    system: "0",
  });
  const preview = (() => {
    try {
      return m ? formatEve(estimatedReturn(m, side, parseEve(amount))) : "—";
    } catch {
      return "—";
    }
  })();
  const disabled = busy || !!pending || !addr;
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
        setProof("");
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
    if (
      confirm.marketId !== m.id ||
      confirm.wallet !== addr ||
      confirm.side !== side ||
      confirm.stake !== parseEve(amount)
    ) {
      setConfirm(null);
      throw Error("Bet changed. Review again.");
    }
    const id = confirm.marketId,
      chosen = confirm.side,
      stake = confirm.stake;
    await execute("Place bet", async () => {
      const [fresh, b, character, coins] = await Promise.all([
        fetchMarket(id),
        fetchBook(),
        findBookCharacter(addr),
        fetchEveCoins(addr),
      ]);
      if (b.paused) throw Error("New bets paused.");
      return buildBet(fresh, character, chosen, stake, coins.coins);
    });
  }
  function submitCreate() {
    if (!admin.data) return;
    void execute("Create market", () =>
      buildCreate(admin.data!, {
        a: create.a,
        b: create.b,
        starts: Date.parse(create.starts + "Z") / 1000,
        ends: Date.parse(create.ends + "Z") / 1000,
        proofDeadline: Date.parse(create.deadline + "Z") / 1000,
        lossType: Number(create.loss) as 1 | 2,
        systemId: BigInt(create.system),
      }),
    );
  }
  function select(id: string) {
    if (busy) return;
    setSelected(id);
    setError("");
    setConfirm(null);
    setAmount("");
    setProof("");
  }
  return (
    <section
      className="betting-book"
      aria-labelledby="book-title"
      aria-busy={busy}
    >
      <header className="book-heading">
        <div>
          <h2 id="book-title">Betting Book</h2>
          <span>TESTNET EVE · KILL CONTESTS · 0% FEE</span>
        </div>
        {!addr && <ConnectButton />}
      </header>
      {!ready ? (
        <p role="status">Setup pending</p>
      ) : book.isError ? (
        <p role="alert">
          Book unavailable{" "}
          <button onClick={() => void book.refetch()}>Retry</button>
        </p>
      ) : !book.data ? (
        <p role="status">Loading book…</p>
      ) : (
        <>
          {(book.data.paused || !cfg.wageringEnabled) && (
            <p className="book-notice">New bets paused</p>
          )}
          <div className="book-layout">
            <nav className="book-list" aria-label="Markets">
              {!ids.length && <p>No markets yet</p>}
              {ids.map((id, i) => {
                const q = markets[i],
                  v = q.data;
                return (
                  <button
                    key={id}
                    disabled={busy}
                    aria-pressed={active === id}
                    onClick={() => select(id)}
                  >
                    <strong>{v ? `Pilot ${v.a} vs ${v.b}` : "Market"}</strong>
                    <span>
                      {v
                        ? marketPhase(v, now)
                        : q.isError
                          ? "Unavailable"
                          : "Loading…"}
                    </span>
                    {v && <small>{utc(v.starts)}</small>}
                  </button>
                );
              })}
              {book.data.marketIds.length > limit && (
                <button onClick={() => setLimit((v) => v + 12)}>
                  More markets
                </button>
              )}
            </nav>
            <div className="book-detail">
              {marketQ?.isError ? (
                <p role="alert">
                  Market unavailable{" "}
                  <button onClick={() => void marketQ.refetch()}>Retry</button>
                </p>
              ) : m ? (
                <>
                  <div className="book-heading">
                    <h3>
                      Pilot {m.a} <span>vs</span> Pilot {m.b}
                    </h3>
                    <b>{marketPhase(m, now)}</b>
                  </div>
                  <dl className="book-metrics">
                    <div>
                      <dt>Starts</dt>
                      <dd>{utc(m.starts)}</dd>
                    </div>
                    <div>
                      <dt>Ends</dt>
                      <dd>{utc(m.ends)}</dd>
                    </div>
                    <div>
                      <dt>Proof deadline</dt>
                      <dd>{utc(m.proofDeadline)}</dd>
                    </div>
                    <div>
                      <dt>Losses</dt>
                      <dd>{m.lossType === 1 ? "Ships" : "Structures"}</dd>
                    </div>
                    <div>
                      <dt>System</dt>
                      <dd>{m.systemId === "0" ? "Any" : m.systemId}</dd>
                    </div>
                    <div>
                      <dt>Pool</dt>
                      <dd>{formatEve(m.poolA + m.poolB)} EVE</dd>
                    </div>
                  </dl>
                  <div className="book-sides">
                    {([1, 2] as const).map((s) => (
                      <button
                        key={s}
                        aria-pressed={side === s}
                        disabled={busy}
                        onClick={() => setSide(s)}
                      >
                        <strong>Pilot {s === 1 ? m.a : m.b}</strong>
                        <b>{String(s === 1 ? m.scoreA : m.scoreB)} verified</b>
                        <span>
                          {formatEve(s === 1 ? m.poolA : m.poolB)} EVE
                        </span>
                      </button>
                    ))}
                  </div>
                  {marketPhase(m, now) === "Open" && (
                    <div className="book-bet">
                      <label>
                        Stake · EVE
                        <input
                          inputMode="decimal"
                          value={amount}
                          disabled={busy}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                      </label>
                      <span>
                        Estimated return <b>{preview} EVE</b>
                      </span>
                      <button
                        disabled={
                          disabled ||
                          book.data.paused ||
                          !cfg.wageringEnabled ||
                          preview === "—"
                        }
                        onClick={() => {
                          try {
                            setConfirm({
                              marketId: m.id,
                              wallet: addr,
                              side,
                              stake: parseEve(amount),
                            });
                          } catch (e) {
                            setError(String(e));
                          }
                        }}
                      >
                        Review bet
                      </button>
                    </div>
                  )}
                  {confirm && (
                    <div className="book-confirm">
                      <span>
                        Lock {amount} EVE on Pilot {side === 1 ? m.a : m.b}? No
                        cash-out.
                      </span>
                      <button
                        disabled={disabled}
                        onClick={() =>
                          void wager().catch((e) => setError(String(e.message)))
                        }
                      >
                        Confirm bet
                      </button>
                      <button disabled={busy} onClick={() => setConfirm(null)}>
                        Cancel
                      </button>
                    </div>
                  )}
                  {!m.result && now >= m.starts && now < m.proofDeadline && (
                    <div className="book-proof">
                      <label>
                        Killmail object ID
                        <input
                          value={proof}
                          disabled={busy}
                          onChange={(e) => setProof(e.target.value)}
                          placeholder="0x…"
                        />
                      </label>
                      <button
                        disabled={disabled || !proof}
                        onClick={() =>
                          void execute("Submit proof", () =>
                            buildProof(m.id, proof),
                          )
                        }
                      >
                        Submit proof
                      </button>
                    </div>
                  )}
                  {!m.result && now >= m.proofDeadline && (
                    <button
                      disabled={disabled}
                      onClick={() =>
                        void execute("Finalize", () => buildFinalize(m.id))
                      }
                    >
                      Finalize result
                    </button>
                  )}
                  {m.result > 0 && (
                    <p className="book-result">
                      {m.result === 3
                        ? "Stakes refundable"
                        : `Winner · Pilot ${m.result === 1 ? m.a : m.b}`}
                    </p>
                  )}
                  <details className="book-rules">
                    <summary>Rules</summary>
                    <ul>
                      <li>
                        Only qualifying official killmails submitted before the
                        proof deadline count. Scores remain provisional until
                        settlement.
                      </li>
                      <li>
                        Most verified kills wins. Ties, no proofs or a one-sided
                        pool return stakes.
                      </li>
                      <li>
                        All qualifying official records count; self/alt/farmed
                        kills are not filtered.
                      </li>
                      <li>
                        Winners split the full pool. Estimated returns change
                        until betting closes; rounding may vary by one atomic
                        unit. No early withdrawal.
                      </li>
                    </ul>
                  </details>
                </>
              ) : active ? (
                <p>Loading market…</p>
              ) : null}
            </div>
          </div>
          <section className="book-tickets">
            <h3>My bets</h3>
            {!addr ? (
              <p>Connect a wallet</p>
            ) : tickets.isError ? (
              <p role="alert">Bets unavailable</p>
            ) : !tickets.data ? (
              <p>Loading bets…</p>
            ) : !tickets.data.length ? (
              <p>No open tickets</p>
            ) : (
              tickets.data.map((t) => {
                const v = markets[ids.indexOf(t.marketId)]?.data;
                let payout: string = "—";
                try {
                  const p = v ? ticketReturn(v, t) : null;
                  if (p !== null) payout = formatEve(p);
                } catch {
                  /* preserve unknown */
                }
                return (
                  <div key={t.id} className="book-ticket">
                    <button disabled={busy} onClick={() => select(t.marketId)}>
                      {v ? `Pilot ${t.side === 1 ? v.a : v.b}` : "Market"}
                    </button>
                    <span>{formatEve(t.stake)} EVE</span>
                    <span>
                      {v?.result ? `${payout} EVE return` : "Pending"}
                    </span>
                    <button
                      disabled={disabled || !v?.result || payout === "—"}
                      onClick={() =>
                        void execute("Claim ticket", () =>
                          buildClaim(t.marketId, t.id),
                        )
                      }
                    >
                      {v?.result === 3
                        ? "Refund"
                        : payout === "0"
                          ? "Close ticket"
                          : "Claim"}
                    </button>
                  </div>
                );
              })
            )}
          </section>
          {admin.data && (
            <details className="book-admin">
              <summary>Create market</summary>
              <div className="book-create">
                {(
                  [
                    ["a", "Pilot A · character object ID"],
                    ["b", "Pilot B · character object ID"],
                    ["starts", "Starts · UTC"],
                    ["ends", "Ends · UTC"],
                    ["deadline", "Proof deadline · UTC"],
                    ["system", "System ID · 0 for any"],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k}>
                    {label}
                    <input
                      type={
                        ["starts", "ends", "deadline"].includes(k)
                          ? "datetime-local"
                          : "text"
                      }
                      disabled={busy}
                      value={create[k]}
                      onChange={(e) =>
                        setCreate((v) => ({ ...v, [k]: e.target.value }))
                      }
                    />
                  </label>
                ))}
                <label>
                  Loss type
                  <select
                    value={create.loss}
                    onChange={(e) =>
                      setCreate((v) => ({ ...v, loss: e.target.value }))
                    }
                  >
                    <option value="1">Ships</option>
                    <option value="2">Structures</option>
                  </select>
                </label>
                <button
                  disabled={disabled || book.data.paused}
                  onClick={submitCreate}
                >
                  Create market
                </button>
              </div>
            </details>
          )}
        </>
      )}
      {pending && (
        <div className="book-notice">
          <span>Transaction needs review</span>
          <button
            disabled={busy}
            onClick={() => {
              try {
                clearMarker(pending);
                setError("");
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
