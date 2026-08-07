/**
 * HouseDonatePanel — public bankroll donations + risk-tier display (v29)
 *
 * WHY THIS EXISTS
 * ───────────────────────────────────────────────────────────────────────────────
 * The House is a shared Move object, NOT a wallet. You cannot donate by sending
 * $EVE to its object id — a naked coin transfer to a shared object is
 * unrecoverable. Funding must go through an entry function. Before v29 the only
 * path was `house::deposit`, which requires the HouseAdminCap, so the public had
 * no way to contribute at all. `house::donate` is the permissionless path and
 * this panel is its UI.
 *
 * TIER COUPLING
 * A deeper bank raises the per-bet exposure budget (see `house::risk_tier`),
 * which raises max bets across every game automatically — no admin action. That
 * makes "donate" a visibly useful act rather than pure charity, so the panel
 * shows the current tier, the distance to the next one, and what the next tier
 * unlocks.
 */
import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { translateTxError } from "../lib/txError";
import { CASINO_HOUSE } from "../constants";
import {
  fetchHouseState,
  fetchEveCoins,
  fetchRecentDonations,
  aggregateDonors,
  buildDonateTx,
  withGas,
  riskTierForBank,
  maxExposureEve,
  eveToNextTier,
  effectiveMaxBetEve,
  TIER_NAMES,
  TIER_BPS,
  TIER_BOUNDS_EVE,
  EVE_UNIT,
} from "../lib/casino";

const ACCENT = "#FF4700";
const GOLD = "#E8B84B";
const DIM = "#9a9a8a";

const fmtEve = (n: number) =>
  n >= 100 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  : n >= 1 ? n.toFixed(2)
  : n.toFixed(4);

const shortAddr = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "—");

const chip: React.CSSProperties = {
  background: "#1a1a1a", border: `1px solid ${ACCENT}44`, color: ACCENT,
  fontSize: 12, padding: "8px 12px", cursor: "pointer",
};

/** Representative multipliers so players can see the tier's real effect. */
const SAMPLE_GAMES: { name: string; mult: number }[] = [
  { name: "WAR / ANDAR BAHAR", mult: 2 },
  { name: "BACCARAT", mult: 9 },
  { name: "SLOTS", mult: 60 },
  { name: "VIDEO POKER", mult: 250 },
  { name: "KENO", mult: 970 },
];

export function HouseDonatePanel() {
  const dAppKit = useDAppKit();
  const { account } = useVerifiedAccountContext();
  const addr = account?.address ?? "";
  const signer = () => new CurrentAccountSigner(dAppKit);

  const [amountEve, setAmountEve] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const houseQ = useQuery({
    queryKey: ["houseDonateState"],
    queryFn: () => fetchHouseState(CASINO_HOUSE),
    refetchInterval: 15000,
  });
  const donationsQ = useQuery({
    queryKey: ["houseDonations"],
    queryFn: () => fetchRecentDonations(CASINO_HOUSE, 50),
    refetchInterval: 30000,
  });
  const walletQ = useQuery({
    queryKey: ["donorEve", addr],
    queryFn: () => (addr ? fetchEveCoins(addr) : Promise.resolve({ ids: [], totalRaw: 0n })),
    enabled: !!addr,
    refetchInterval: 20000,
  });

  const house = houseQ.data ?? null;
  const bank = house?.bankBalance ?? 0;
  const myEve = Number(walletQ.data?.totalRaw ?? 0n) / 1e9;

  const tier = house ? house.riskTier : riskTierForBank(bank);
  const next = useMemo(() => eveToNextTier(bank), [bank]);
  const leaders = useMemo(() => aggregateDonors(donationsQ.data ?? []), [donationsQ.data]);

  // What the current vs next tier allows, per representative game.
  const tierTable = useMemo(() => {
    const nextBank = next ? TIER_BOUNDS_EVE[tier] : bank;
    return SAMPLE_GAMES.map((g) => ({
      ...g,
      now: effectiveMaxBetEve(bank, g.mult, house?.maxBet ?? 0),
      then: effectiveMaxBetEve(nextBank, g.mult, house?.maxBet ?? 0),
    }));
  }, [bank, tier, next, house?.maxBet]);

  async function donate() {
    setErr(null); setMsg(null);
    const amt = Number(amountEve);
    if (!addr) { setErr("Connect your wallet first."); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setErr("Enter an amount greater than zero."); return; }
    if (amt > myEve) { setErr(`You only hold ${fmtEve(myEve)} EVE.`); return; }
    const ids = walletQ.data?.ids ?? [];
    if (!ids.length) { setErr("No $EVE coins found in your wallet."); return; }

    setBusy(true);
    try {
      const raw = BigInt(Math.round(amt * Number(EVE_UNIT)));
      let tx = buildDonateTx(CASINO_HOUSE, ids, raw, label.trim());
      tx = await withGas(tx, addr);
      const result: any = await signer().signAndExecuteTransaction({ transaction: tx });
      if (result?.effects?.status?.error) throw new Error(result.effects.status.error);
      setMsg(`Donated ${fmtEve(amt)} EVE to the house bank. Thank you.`);
      setAmountEve(""); setLabel("");
      houseQ.refetch(); donationsQ.refetch(); walletQ.refetch();
    } catch (e: any) {
      setErr(translateTxError(e));
    } finally {
      setBusy(false);
    }
  }

  const presets = [10, 50, 100, 500].filter((v) => v <= Math.max(myEve, 0));

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={{ border: `1px solid ${ACCENT}33`, background: "rgba(10,10,10,0.96)", padding: "18px 22px", marginBottom: 16 }}>
        <div style={{ color: ACCENT, fontSize: 22, fontWeight: 800, letterSpacing: "0.12em" }}>◈ BANKROLL THE HOUSE</div>
        <div style={{ color: DIM, fontSize: 11, marginTop: 2 }}>
          PUBLIC DONATIONS · A DEEPER BANK RAISES MAX BETS FOR EVERYONE
        </div>
      </div>

      {/* ── Tier status ── */}
      <div style={{ border: `1px solid ${ACCENT}22`, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <div style={{ color: DIM, fontSize: 10, letterSpacing: "0.1em" }}>HOUSE BANK</div>
            <div style={{ color: GOLD, fontSize: 20, fontWeight: 700 }}>{fmtEve(bank)} EVE</div>
          </div>
          <div>
            <div style={{ color: DIM, fontSize: 10, letterSpacing: "0.1em" }}>RISK TIER</div>
            <div style={{ color: ACCENT, fontSize: 20, fontWeight: 700 }}>{TIER_NAMES[tier]}</div>
          </div>
          <div>
            <div style={{ color: DIM, fontSize: 10, letterSpacing: "0.1em" }}>SINGLE-BET EXPOSURE</div>
            <div style={{ color: "#eee", fontSize: 20, fontWeight: 700 }}>
              {(TIER_BPS[tier] / 100).toFixed(1)}% · {fmtEve(maxExposureEve(bank))} EVE
            </div>
          </div>
        </div>

        {next ? (
          <div style={{ borderTop: `1px solid ${ACCENT}22`, paddingTop: 12 }}>
            <div style={{ color: "#eee", fontSize: 12 }}>
              <span style={{ color: GOLD, fontWeight: 700 }}>{fmtEve(next.needed)} EVE</span>
              {" "}more unlocks{" "}
              <span style={{ color: ACCENT, fontWeight: 700 }}>{TIER_NAMES[next.nextTier]}</span>
              {" "}({(TIER_BPS[next.nextTier] / 100).toFixed(1)}% exposure)
            </div>
            {/* progress bar toward next tier */}
            <div style={{ height: 6, background: "#1a1a1a", marginTop: 8, border: `1px solid ${ACCENT}22` }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, Math.max(0, (bank / TIER_BOUNDS_EVE[tier]) * 100)).toFixed(1)}%`,
                background: GOLD,
              }} />
            </div>
          </div>
        ) : (
          <div style={{ borderTop: `1px solid ${ACCENT}22`, paddingTop: 12, color: GOLD, fontSize: 12 }}>
            Top tier reached — maximum risk appetite.
          </div>
        )}
      </div>

      {/* ── What the tier means per game ── */}
      <div style={{ border: `1px solid ${ACCENT}22`, padding: 16, marginBottom: 16 }}>
        <div style={{ color: DIM, fontSize: 10, letterSpacing: "0.1em", marginBottom: 10 }}>
          MAX BET BY GAME — DERIVED FROM BANK ÷ PAYOUT MULTIPLIER
        </div>
        {tierTable.map((g) => (
          <div key={g.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${ACCENT}11`, fontSize: 12 }}>
            <span style={{ color: "#eee" }}>{g.name} <span style={{ color: DIM }}>({g.mult}×)</span></span>
            <span>
              <span style={{ color: GOLD }}>{fmtEve(g.now)} EVE</span>
              {next && g.then > g.now && (
                <span style={{ color: DIM }}> → <span style={{ color: ACCENT }}>{fmtEve(g.then)}</span></span>
              )}
            </span>
          </div>
        ))}
        <div style={{ color: DIM, fontSize: 10, marginTop: 8, lineHeight: 1.5 }}>
          High-multiplier games are capped lower because one win costs the bank more.
          Limits rise automatically as the bank grows — no admin action needed.
        </div>
      </div>

      {/* ── Donate form ── */}
      <div style={{ border: `1px solid ${ACCENT}33`, padding: 16, marginBottom: 16 }}>
        <div style={{ color: DIM, fontSize: 10, letterSpacing: "0.1em", marginBottom: 10 }}>
          DONATE $EVE {addr && <span style={{ color: GOLD }}>· YOU HOLD {fmtEve(myEve)} EVE</span>}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <input
            type="number" min="0" step="any" placeholder="Amount in EVE"
            value={amountEve} onChange={(e) => setAmountEve(e.target.value)}
            disabled={busy}
            style={{ flex: "1 1 160px", background: "#111", border: `1px solid ${ACCENT}33`, color: "#eee", fontSize: 13, padding: "10px 12px", outline: "none" }}
          />
          <input
            type="text" maxLength={64} placeholder="Name / tribe (optional)"
            value={label} onChange={(e) => setLabel(e.target.value)}
            disabled={busy}
            style={{ flex: "1 1 160px", background: "#111", border: `1px solid ${ACCENT}33`, color: "#eee", fontSize: 13, padding: "10px 12px", outline: "none" }}
          />
        </div>

        {presets.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {presets.map((v) => (
              <button key={v} onClick={() => setAmountEve(String(v))} disabled={busy} style={chip}>{v}</button>
            ))}
            <button onClick={() => setAmountEve(String(Math.floor(myEve * 100) / 100))} disabled={busy}
              style={{ ...chip, color: GOLD, border: `1px solid ${GOLD}44` }}>
              ALL {fmtEve(myEve)}
            </button>
          </div>
        )}

        <button
          onClick={donate}
          disabled={busy || !addr || !amountEve}
          style={{
            width: "100%", padding: "12px 0",
            background: busy || !addr || !amountEve ? "#1a1a1a" : ACCENT,
            color: busy || !addr || !amountEve ? DIM : "#0a0a0a",
            border: "none", fontSize: 14, fontWeight: 800, letterSpacing: "0.1em",
            cursor: busy || !addr || !amountEve ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "SIGNING…" : !addr ? "CONNECT WALLET" : "◈ DONATE TO HOUSE"}
        </button>

        <div style={{ color: DIM, fontSize: 10, marginTop: 8, lineHeight: 1.5 }}>
          Donations are <strong style={{ color: "#eee" }}>irreversible</strong>. Funds join the house bank
          and can only leave as winnings to players or via operator withdrawal. This is
          not an investment and pays no return.
        </div>

        {msg && <div style={{ color: GOLD, fontSize: 12, marginTop: 10 }}>{msg}</div>}
        {err && <div style={{ color: "#ff6b6b", fontSize: 12, marginTop: 10 }}>{err}</div>}
      </div>

      {/* ── Donor leaderboard ── */}
      <div style={{ border: `1px solid ${ACCENT}22`, padding: 16 }}>
        <div style={{ color: DIM, fontSize: 10, letterSpacing: "0.1em", marginBottom: 10 }}>
          TOP BANKROLLERS
        </div>
        {donationsQ.isLoading ? (
          <div style={{ color: DIM, fontSize: 12 }}>Loading…</div>
        ) : leaders.length === 0 ? (
          <div style={{ color: DIM, fontSize: 12 }}>No donations yet — be the first.</div>
        ) : (
          leaders.slice(0, 15).map((d, i) => (
            <div key={d.donor} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${ACCENT}11`, fontSize: 12 }}>
              <span style={{ color: "#eee" }}>
                <span style={{ color: i === 0 ? GOLD : DIM, fontWeight: 700, marginRight: 8 }}>#{i + 1}</span>
                {d.label ? d.label : shortAddr(d.donor)}
                {d.count > 1 && <span style={{ color: DIM }}> ×{d.count}</span>}
              </span>
              <span style={{ color: i === 0 ? GOLD : "#eee", fontWeight: 600 }}>{fmtEve(d.total)} EVE</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
