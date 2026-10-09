/** Permissionless current-world seeding. A gift is not a wager or an investment. */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import type { DAppKit } from "@mysten/dapp-kit-core";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { CASINO_HOUSE } from "../constants";
import { fetchEveCoins, buildDonateTx, withGas } from "../lib/casino";
import { assertCycleCompatible } from "../lib/transactionCompatibility";
import {
  clearDonationAttempt,
  assertNoSeedLiabilities,
  assertSeedable,
  donationAmount,
  donationLabel,
  donationReceipt,
  fetchDonationHouse,
  formatDonation,
} from "../lib/casinoDonations";
import { ItemIcon } from "./GameIcon";

export function HouseDonatePanel({
  onBusyChange,
}: { onBusyChange?: (value: boolean) => void } = {}) {
  const dAppKit = useDAppKit<DAppKit<["testnet"]>>();
  const { account } = useVerifiedAccountContext();
  const addr = account?.address ?? "";
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [receipt, setReceipt] = useState<{
    digest: string;
    amount: string;
    address: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(() => {
    try {
      return sessionStorage.getItem("cradle.casino.donation.pending") ?? "";
    } catch {
      return "Tab storage is unavailable. Enable it before donating.";
    }
  });
  const house = useQuery({
    queryKey: ["casinoSeedHouse"],
    queryFn: fetchDonationHouse,
    refetchInterval: 15000,
  });
  const coins = useQuery({
    queryKey: ["casinoSeedCoins", addr],
    queryFn: () => fetchEveCoins(addr),
    enabled: !!addr,
    refetchInterval: 20000,
  });
  const ready =
    !!addr &&
    house.data?.paused === true &&
    !house.isError &&
    !coins.isError &&
    !!coins.data;
  const network = dAppKit.stores.$currentNetwork.get();

  async function donate() {
    if (lock.current || pending) return;
    lock.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    setReceipt(null);
    let attempted = false;
    let confirmed = false;
    let attemptMarker = "";
    function finishAttempt() {
      clearDonationAttempt(sessionStorage, attemptMarker);
      setPending(
        sessionStorage.getItem("cradle.casino.donation.pending") ?? "",
      );
    }
    try {
      const raw = donationAmount(amount),
        tag = donationLabel(label);
      const connection = dAppKit.stores.$connection.get();
      const signerAccount = connection.account;
      if (!addr || signerAccount?.address !== addr)
        throw Error("Connect the wallet you want to donate from.");
      if (dAppKit.stores.$currentNetwork.get() !== "testnet")
        throw Error("Switch to Sui testnet before donating.");
      const freshCoins = await fetchEveCoins(addr);
      let tx = buildDonateTx(CASINO_HOUSE, freshCoins.coins, raw, tag);
      tx.setSender(addr);
      tx = await withGas(tx, addr);
      await assertNoSeedLiabilities();
      const freshHouse = await fetchDonationHouse();
      assertSeedable(freshHouse, raw, freshCoins.totalRaw);
      if (
        dAppKit.stores.$connection.get().account?.address !== addr ||
        dAppKit.stores.$currentNetwork.get() !== "testnet"
      )
        throw Error("Wallet or network changed. Review before signing.");
      if (!mounted.current)
        throw Error("Donation form closed. No wallet request was sent.");
      if (sessionStorage.getItem("cradle.casino.donation.pending"))
        throw Error("Another donation attempt needs review before signing.");
      assertCycleCompatible(tx);
      const marker = `${formatDonation(raw)} $EVE · ${addr} · ${new Date().toISOString()} · ${crypto.randomUUID()}`;
      attemptMarker = marker;
      // Save BEFORE opening the wallet. Reloads must not silently repeat an uncertain gift.
      sessionStorage.setItem("cradle.casino.donation.pending", marker);
      setPending(marker);
      attempted = true;
      const result = await dAppKit.signAndExecuteTransaction({
        transaction: tx,
        account: signerAccount,
        network: "testnet",
      });
      if (result.$kind === "FailedTransaction") {
        attempted = false;
        finishAttempt();
      }
      const digest = donationReceipt(result);
      confirmed = true;
      setReceipt({ digest, amount: formatDonation(raw), address: addr });
      setAmount("");
      setLabel("");
      try {
        finishAttempt();
      } catch {
        /* Keep the receipt and retry guard if storage failed. */
      }
      void house.refetch();
      void coins.refetch();
    } catch (e) {
      if (!confirmed)
        setError(
          `${e instanceof Error ? e.message : String(e)}${attempted ? " Check wallet activity before retrying; no automatic retry will be sent." : ""}`,
        );
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  function clearPending() {
    if (lock.current) return;
    try {
      if (!clearDonationAttempt(sessionStorage, pending))
        throw Error(
          "Donation attempt changed. Review the current wallet activity first.",
        );
      setPending("");
      setError("");
    } catch (e) {
      try {
        setPending(
          sessionStorage.getItem("cradle.casino.donation.pending") ?? pending,
        );
      } catch {
        /* Keep the existing guard. */
      }
      setError(e instanceof Error ? e.message : "Tab storage is unavailable.");
    }
  }
  return (
    <section
      className="casino-donate"
      aria-labelledby="casino-donate-title"
      aria-busy={busy}
    >
      <div className="casino-donate-heading">
        <ItemIcon typeId={72244} size={76} />
        <div>
          <span className="lounge-eyebrow">PLAYER-FUNDED · SUI TESTNET</span>
          <h2 id="casino-donate-title">Seed the house</h2>

        </div>
      </div>
      <div className="casino-donate-status">
        <div>
          <span>House bank</span>
          <strong>
            {house.data && !house.isError
              ? `${formatDonation(house.data.bank)} $EVE`
              : "Unavailable"}
          </strong>
        </div>
        <div>
          <span>Wagering</span>
          <strong>Not enabled</strong>
        </div>
        <div>
          <span>Your wallet</span>
          <strong>
            {addr && coins.data && !coins.isError
              ? `${formatDonation(coins.data.totalRaw)} $EVE`
              : "Connect to view"}
          </strong>
        </div>
      </div>
      <p className="lounge-muted">
        Irreversible gift · Operator-controlled funds · No withdrawal or profit-sharing rights
      </p>
      {(house.isError ||
        (addr && coins.isError) ||
        house.data?.paused === false) && (
        <p role="alert" className="lounge-error">
          {house.data?.paused === false
            ? "Seeding is closed while the house is unpaused."
            : "Balance unavailable. Refresh."}
        </p>
      )}
      {network !== "testnet" && (
        <p role="alert" className="lounge-error">
          Select Sui testnet to donate.
        </p>
      )}
      {!addr && (
        <div className="casino-donate-connect">
          <ConnectButton />
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void donate();
        }}
      >
        <fieldset disabled={busy || !!pending}>
          <label>
            Amount in $EVE
            <input
              aria-label="Donation amount in EVE"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              maxLength={32}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            Name / tribe <small>optional · public</small>
            <input
              aria-label="Public donation label"
              type="text"
              maxLength={64}
              placeholder="Anonymous label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <p className="lounge-muted">
            Current-cycle $EVE · SUI gas required · Public transaction
          </p>
          <button
            className="lounge-primary"
            type="submit"
            disabled={!ready || !amount.trim() || network !== "testnet"}
          >
            {busy ? "Awaiting wallet…" : "Donate $EVE"}
          </button>
        </fieldset>
      </form>
      <button
        type="button"
        disabled={busy || house.isFetching || coins.isFetching}
        onClick={() => {
          void house.refetch();
          if (addr) void coins.refetch();
        }}
      >
        Refresh balances
      </button>
      {error && (
        <p className="lounge-error" role="alert">
          {error}
        </p>
      )}
      {receipt && (
        <div className="casino-donate-receipt" role="status">
          <strong>Confirmed: {receipt.amount} $EVE donated.</strong>
          <span>From {receipt.address}</span>
          <a
            href={`https://suiexplorer.com/txblock/${encodeURIComponent(receipt.digest)}?network=testnet`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction ↗
          </a>
          <p>Wagering remains disabled.</p>
        </div>
      )}
      {pending && !busy && (
        <div className="lounge-confirm casino-donate-pending">
          <p>A donation attempt needs review: {pending}</p>
          <p>
            Check wallet history before retrying.
          </p>
          <button type="button" onClick={clearPending}>
            Checked wallet history · Clear
          </button>
        </div>
      )}
      <details className="lounge-rules">
        <summary>Destination</summary>

        <p className="casino-donate-id">House: {CASINO_HOUSE}</p>
      </details>
    </section>
  );
}
