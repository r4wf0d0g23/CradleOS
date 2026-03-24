import { normalizeChainError } from "../utils";
import { ItemTypePicker } from "./ItemTypePicker";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { Transaction } from "@mysten/sui/transactions";
import {
  CLOCK,
  CRADLEOS_PKG,
  CRDL_COIN_TYPE,
  SUI_TESTNET_RPC,
  SUI_GRAPHQL,
  ZERO_ADDRESS,
  eventType,
} from "../constants";
import { numish, rpcGetObject } from "../lib";

// ─── Types ────────────────────────────────────────────────────────────────────

type CargoContractState = {
  objectId: string;
  shipper: string;
  carrier: string;
  description: string;
  destinationSsuId: string;
  itemTypeId: bigint;
  minQuantity: bigint;
  reward: bigint;
  claimedTxDigest: string; // hex-decoded or empty
  claimSubmittedMs: number;
  disputeWindowMs: number;
  status: number;
  createdMs: number;
  deadlineMs: number;
};

type ContractCreatedEvent = {
  contractId: string;
  shipper: string;
  carrier: string;
  description: string;
  destinationSsuId: string;
  rewardAmount: bigint;
  deadlineMs: number;
  createdMs: number;
};

// ─── POD Validator types ──────────────────────────────────────────────────────

type PodValidationResult = {
  assemblyIdMatch: boolean | null;
  itemTypeIdMatch: boolean | null;
  quantityOk: boolean | null;
  pass: boolean;
  error?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddr(a: string | undefined | null) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function isZeroAddr(value: string | null | undefined) {
  if (!value) return true;
  const normalized = value.toLowerCase();
  return normalized === "0x0" || normalized === ZERO_ADDRESS.toLowerCase();
}

function formatReward(value: bigint) {
  return `${value.toString()} CRDL`;
}

function formatDateTime(ms: number) {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "—";
  }
}

function msToHuman(ms: number): string {
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function statusMeta(status: number) {
  switch (status) {
    case 0:
      return { label: "Open", color: "#FF4700", bg: "rgba(255,71,0,0.12)", border: "rgba(255,71,0,0.35)" };
    case 1:
      return { label: "Claimed — Dispute Window Active", color: "#64b4ff", bg: "rgba(100,180,255,0.12)", border: "rgba(100,180,255,0.35)" };
    case 2:
      return { label: "Delivered", color: "#00ff96", bg: "rgba(0,255,150,0.12)", border: "rgba(0,255,150,0.35)" };
    case 3:
      return { label: "Cancelled", color: "#a4a4a4", bg: "rgba(180,180,180,0.12)", border: "rgba(180,180,180,0.28)" };
    case 4:
      return { label: "Disputed", color: "#ff6464", bg: "rgba(255,100,100,0.12)", border: "rgba(255,100,100,0.3)" };
    default:
      return { label: `Status ${status}`, color: "#888", bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)" };
  }
}

// ─── RPC helpers ─────────────────────────────────────────────────────────────

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json() as { result?: T; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message || `RPC error: ${method}`);
  if (json.result === undefined) throw new Error(`Missing RPC result: ${method}`);
  return json.result;
}

function extractReward(raw: unknown): bigint {
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "bigint") {
    try { return BigInt(raw); } catch { return 0n; }
  }
  if (raw && typeof raw === "object") {
    const fields = (raw as { fields?: Record<string, unknown> }).fields;
    const nested = fields?.value ?? (raw as Record<string, unknown>).value;
    if (typeof nested === "string" || typeof nested === "number" || typeof nested === "bigint") {
      try { return BigInt(nested); } catch { return 0n; }
    }
  }
  return 0n;
}

function bytesToString(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    try {
      return new TextDecoder().decode(new Uint8Array(raw as number[]));
    } catch {
      return raw.join(",");
    }
  }
  return String(raw);
}

async function fetchContractEvents(): Promise<ContractCreatedEvent[]> {
  try {
    const result = await rpc<{ data?: Array<{ parsedJson?: Record<string, unknown> }> }>(
      "suix_queryEvents",
      [{ MoveEventType: eventType("cargo_contract", "ContractCreated") }, null, 100, true],
    );
    return (result.data ?? []).map((e) => {
      const parsed = e.parsedJson ?? {};
      return {
        contractId: String(parsed["contract_id"] ?? ""),
        shipper: String(parsed["shipper"] ?? ""),
        carrier: String(parsed["carrier"] ?? ZERO_ADDRESS),
        description: bytesToString(parsed["description"]),
        destinationSsuId: String(parsed["destination_ssu_id"] ?? ""),
        rewardAmount: extractReward(parsed["reward_amount"]),
        deadlineMs: numish(parsed["deadline_ms"]) ?? 0,
        createdMs: numish(parsed["created_ms"]) ?? 0,
      };
    });
  } catch {
    return [];
  }
}

async function fetchContractObject(objectId: string): Promise<CargoContractState | null> {
  try {
    const fields = await rpcGetObject(objectId);
    if (fields._deleted) return null;
    return {
      objectId,
      shipper: String(fields["shipper"] ?? ""),
      carrier: String(fields["carrier"] ?? ZERO_ADDRESS),
      description: bytesToString(fields["description"]),
      destinationSsuId: String(fields["destination_ssu_id"] ?? ""),
      itemTypeId: BigInt(numish(fields["item_type_id"]) ?? 0),
      minQuantity: BigInt(numish(fields["min_quantity"]) ?? 0),
      reward: extractReward(fields["reward"]),
      claimedTxDigest: bytesToString(fields["claimed_tx_digest"]),
      claimSubmittedMs: numish(fields["claim_submitted_ms"]) ?? 0,
      disputeWindowMs: numish(fields["dispute_window_ms"]) ?? 86_400_000,
      status: numish(fields["status"]) ?? 0,
      createdMs: numish(fields["created_ms"]) ?? 0,
      deadlineMs: numish(fields["deadline_ms"]) ?? 0,
    };
  } catch {
    return null;
  }
}

async function fetchContracts(): Promise<CargoContractState[]> {
  const events = await fetchContractEvents();
  const objects = await Promise.all(events.map((ev) => fetchContractObject(ev.contractId)));
  return objects.filter((item): item is CargoContractState => !!item)
    .sort((a, b) => b.createdMs - a.createdMs);
}

async function fetchOwnedCrdlCoins(owner: string): Promise<Array<{ coinObjectId: string; balance: bigint }>> {
  try {
    const result = await rpc<{
      data?: Array<{ coinObjectId?: string; balance?: string }>;
    }>("suix_getCoins", [owner, CRDL_COIN_TYPE, null, 100]);
    return (result.data ?? []).map((coin) => ({
      coinObjectId: String(coin.coinObjectId ?? ""),
      balance: BigInt(coin.balance ?? "0"),
    })).filter((coin) => !!coin.coinObjectId && coin.balance > 0n);
  } catch {
    return [];
  }
}

// ─── Transaction builders ──────────────────────────────────────────────────────

async function buildCreateContractTransaction(args: {
  owner: string;
  description: string;
  destinationSsuId: string;
  itemTypeId: bigint;
  minQuantity: bigint;
  reward: bigint;
  carrier: string;
  disputeWindowMs: bigint;
  deadlineMs: number;
}): Promise<Transaction> {
  const tx = new Transaction();
  const coins = await fetchOwnedCrdlCoins(args.owner);
  const source = coins.find((coin) => coin.balance >= args.reward);
  if (!source) throw new Error("No CRDL coin found with enough balance for this reward.");

  const splitCoins = tx.splitCoins(tx.object(source.coinObjectId), [tx.pure.u64(args.reward)]);
  tx.moveCall({
    target: `${CRADLEOS_PKG}::cargo_contract::create_contract_entry`,
    arguments: [
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(args.description))),
      tx.pure.address(args.destinationSsuId),
      tx.pure.u64(args.itemTypeId),
      tx.pure.u64(args.minQuantity),
      splitCoins[0],
      tx.pure.address(args.carrier),
      tx.pure.u64(args.disputeWindowMs),
      tx.pure.u64(BigInt(args.deadlineMs)),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

function buildSubmitDeliveryClaimTransaction(contractId: string, txDigestString: string) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::cargo_contract::submit_delivery_claim_entry`,
    arguments: [
      tx.object(contractId),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(txDigestString))),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

function buildDisputeDeliveryTransaction(contractId: string) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::cargo_contract::dispute_delivery_entry`,
    arguments: [tx.object(contractId), tx.object(CLOCK)],
  });
  return tx;
}

function buildFinalizeDeliveryTransaction(contractId: string) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::cargo_contract::finalize_delivery_entry`,
    arguments: [tx.object(contractId), tx.object(CLOCK)],
  });
  return tx;
}

function buildCancelContractTransaction(contractId: string) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::cargo_contract::cancel_contract_entry`,
    arguments: [tx.object(contractId), tx.object(CLOCK)],
  });
  return tx;
}

// ─── POD Validator ─────────────────────────────────────────────────────────────

async function validatePod(
  txDigest: string,
  contract: CargoContractState,
): Promise<PodValidationResult> {
  const query = `{
    transaction(digest: "${txDigest}") {
      effects { status }
      events { nodes { contents { json } } }
    }
  }`;

  let data: unknown;
  try {
    const res = await fetch(SUI_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    data = await res.json();
  } catch (e) {
    return { assemblyIdMatch: null, itemTypeIdMatch: null, quantityOk: null, pass: false, error: String(e) };
  }

  const txData = (data as { data?: { transaction?: { effects?: { status?: string }; events?: { nodes?: Array<{ contents?: { json?: unknown } }> } } } })
    ?.data?.transaction;

  if (!txData) {
    return { assemblyIdMatch: null, itemTypeIdMatch: null, quantityOk: null, pass: false, error: "Transaction not found" };
  }

  const nodes = txData.events?.nodes ?? [];
  let assemblyIdMatch = false;
  let itemTypeIdMatch = false;
  let quantityOk = false;

  for (const node of nodes) {
    const json = node.contents?.json;
    if (!json || typeof json !== "object") continue;
    const ev = json as Record<string, unknown>;

    // Look for ItemMintedEvent or similar fields
    const evAssemblyId = String(ev["assembly_id"] ?? ev["ssu_id"] ?? ev["destination_ssu_id"] ?? "").toLowerCase();
    const evItemTypeId = String(ev["item_type_id"] ?? "");
    const evQuantity = numish(ev["quantity"] ?? ev["amount"] ?? ev["count"]);

    if (evAssemblyId && evAssemblyId === contract.destinationSsuId.toLowerCase()) {
      assemblyIdMatch = true;
    }
    if (evItemTypeId && BigInt(evItemTypeId || "0") === contract.itemTypeId) {
      itemTypeIdMatch = true;
    }
    if (evQuantity !== null && BigInt(evQuantity) >= contract.minQuantity) {
      quantityOk = true;
    }
  }

  const pass = assemblyIdMatch && itemTypeIdMatch && quantityOk;
  return { assemblyIdMatch, itemTypeIdMatch, quantityOk, pass };
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function PodValidator({ contract }: { contract: CargoContractState }) {
  const [podDigest, setPodDigest] = useState(contract.claimedTxDigest || "");
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<PodValidationResult | null>(null);

  const handleValidate = async () => {
    if (!podDigest.trim()) return;
    setValidating(true);
    setResult(null);
    try {
      const res = await validatePod(podDigest.trim(), contract);
      setResult(res);
    } finally {
      setValidating(false);
    }
  };

  const checkIcon = (val: boolean | null) => {
    if (val === null) return "—";
    return val ? "✓" : "✗";
  };

  const checkColor = (val: boolean | null) => {
    if (val === null) return "#888";
    return val ? "#00ff96" : "#ff6432";
  };

  return (
    <div style={{ marginTop: "14px", padding: "10px 12px", background: "rgba(100,180,255,0.05)", border: "1px solid rgba(100,180,255,0.18)" }}>
      <div style={{ color: "#64b4ff", fontSize: "11px", fontWeight: 700, fontFamily: "monospace", marginBottom: "8px" }}>
        POD VALIDATOR
      </div>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={podDigest}
          onChange={(e) => setPodDigest(e.target.value)}
          placeholder="Tx digest to verify"
          style={{ ...inputStyle, flex: "1", minWidth: "200px" }}
        />
        <button onClick={handleValidate} disabled={validating} style={verifyButtonStyle}>
          {validating ? "Validating…" : "Validate"}
        </button>
        <a
          href={`https://suiscan.xyz/testnet/tx/${contract.claimedTxDigest}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#64b4ff", fontSize: "11px", fontFamily: "monospace" }}
        >
          Verify on GraphQL ↗
        </a>
      </div>
      {result && (
        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ color: checkColor(result.assemblyIdMatch), fontSize: "11px", fontFamily: "monospace" }}>
            {checkIcon(result.assemblyIdMatch)} Assembly ID match
          </div>
          <div style={{ color: checkColor(result.itemTypeIdMatch), fontSize: "11px", fontFamily: "monospace" }}>
            {checkIcon(result.itemTypeIdMatch)} Item Type ID match
          </div>
          <div style={{ color: checkColor(result.quantityOk), fontSize: "11px", fontFamily: "monospace" }}>
            {checkIcon(result.quantityOk)} Quantity ≥ min_quantity
          </div>
          <div style={{
            marginTop: "6px",
            color: result.pass ? "#00ff96" : "#ff6432",
            fontWeight: 700,
            fontSize: "12px",
            fontFamily: "monospace",
            padding: "4px 10px",
            background: result.pass ? "rgba(0,255,150,0.1)" : "rgba(255,100,50,0.1)",
            border: `1px solid ${result.pass ? "rgba(0,255,150,0.3)" : "rgba(255,100,50,0.3)"}`,
            display: "inline-block",
          }}>
            {result.pass ? "✓ PASS" : "✗ FAIL"}
          </div>
          {result.error && (
            <div style={{ color: "#ff6432", fontSize: "11px", fontFamily: "monospace" }}>{result.error}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Contract card ─────────────────────────────────────────────────────────────

function ContractCard({
  contract,
  accountAddress,
  onAction,
  actionBusyId,
  actionError,
}: {
  contract: CargoContractState;
  accountAddress: string | null;
  onAction: (type: string, contractId: string, extra?: string) => Promise<void>;
  actionBusyId: string | null;
  actionError: string | null;
}) {
  const [txDigestInput, setTxDigestInput] = useState("");
  const status = statusMeta(contract.status);
  const now = Date.now();
  const disputeExpiry = contract.claimSubmittedMs + contract.disputeWindowMs;
  const disputeRemaining = disputeExpiry - now;
  const withinDisputeWindow = disputeRemaining > 0;

  const isBusy = actionBusyId === contract.objectId;

  const isCarrier =
    !!accountAddress &&
    (isZeroAddr(contract.carrier) || accountAddress.toLowerCase() === contract.carrier.toLowerCase());
  const isShipper = !!accountAddress && accountAddress.toLowerCase() === contract.shipper.toLowerCase();

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.18)", padding: "12px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "14px", fontFamily: "monospace", marginBottom: "4px" }}>
            {contract.description || "Untitled contract"}
          </div>
          <div style={{ color: "#aaa", fontSize: "12px", marginBottom: "2px" }}>
            SSU: <span style={{ color: "#00ff96", fontFamily: "monospace" }}>{shortAddr(contract.destinationSsuId)}</span>
          </div>
          <div style={{ color: "#888", fontSize: "11px", fontFamily: "monospace" }}>
            Item Type: {contract.itemTypeId.toString()} · Min Qty: {contract.minQuantity.toString()} · Reward: {formatReward(contract.reward)}
          </div>
        </div>
        <div style={{
          color: status.color,
          background: status.bg,
          border: `1px solid ${status.border}`,
          padding: "4px 10px",
          fontSize: "11px",
          fontWeight: 700,
          fontFamily: "monospace",
          whiteSpace: "nowrap",
        }}>
          {status.label}
        </div>
      </div>

      {/* Meta */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "6px",
        marginTop: "10px",
        color: "#888",
        fontSize: "11px",
        fontFamily: "monospace",
      }}>
        <div>SHIPPER: {shortAddr(contract.shipper)}</div>
        <div>CARRIER: {isZeroAddr(contract.carrier) ? "OPEN" : shortAddr(contract.carrier)}</div>
        <div>DEADLINE: {formatDateTime(contract.deadlineMs)}</div>
        <div>DISPUTE WINDOW: {(contract.disputeWindowMs / 3_600_000).toFixed(0)}h</div>
      </div>

      {/* Status 0: actions */}
      {contract.status === 0 && (
        <div style={{ marginTop: "12px" }}>
          {isCarrier && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={txDigestInput}
                  onChange={(e) => setTxDigestInput(e.target.value)}
                  placeholder="Delivery tx digest"
                  style={{ ...inputStyle, flex: "1", minWidth: "200px" }}
                />
                <button
                  onClick={() => onAction("submitClaim", contract.objectId, txDigestInput)}
                  disabled={isBusy || !txDigestInput.trim()}
                  style={confirmButtonStyle}
                >
                  {isBusy ? "Working…" : "Submit Delivery Proof"}
                </button>
              </div>
            </div>
          )}
          {isShipper && (
            <div style={{ marginTop: "8px" }}>
              <button onClick={() => onAction("cancel", contract.objectId)} disabled={isBusy} style={cancelButtonStyle}>
                {isBusy ? "Working…" : "Cancel"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Status 1: claimed */}
      {contract.status === 1 && (
        <div style={{ marginTop: "12px" }}>
          <div style={{ color: "#888", fontSize: "11px", fontFamily: "monospace", marginBottom: "6px" }}>
            CLAIM TX: <span style={{ color: "#64b4ff" }}>{contract.claimedTxDigest || "—"}</span>
          </div>
          <div style={{ color: "#888", fontSize: "11px", fontFamily: "monospace", marginBottom: "10px" }}>
            DISPUTE WINDOW: {withinDisputeWindow ? msToHuman(disputeRemaining) + " remaining" : "expired"}
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {isShipper && withinDisputeWindow && (
              <button onClick={() => onAction("dispute", contract.objectId)} disabled={isBusy} style={disputeButtonStyle}>
                {isBusy ? "Working…" : "Dispute"}
              </button>
            )}
            {!withinDisputeWindow && (
              <button onClick={() => onAction("finalize", contract.objectId)} disabled={isBusy} style={confirmButtonStyle}>
                {isBusy ? "Working…" : "Finalize Delivery"}
              </button>
            )}
          </div>

          <PodValidator contract={contract} />
        </div>
      )}

      {/* Status 2/3/4: read-only */}
      {contract.status >= 2 && contract.claimedTxDigest && (
        <div style={{ marginTop: "10px", color: "#888", fontSize: "11px", fontFamily: "monospace" }}>
          CLAIM TX: <span style={{ color: "#aaa" }}>{contract.claimedTxDigest}</span>
        </div>
      )}

      {actionError && actionBusyId === null && (
        <div style={{ color: "#ff6432", fontSize: "11px", marginTop: "8px", fontFamily: "monospace" }}>{actionError}</div>
      )}
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────

export function CargoContractPanel() {
  const { account: _verifiedAcct } = useVerifiedAccountContext();
  const account = _verifiedAcct;
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  // Create form state
  const [description, setDescription] = useState("");
  const [destinationSsuId, setDestinationSsuId] = useState("");
  const [itemTypeId, setItemTypeId] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const [reward, setReward] = useState("");
  const [carrier, setCarrier] = useState("");
  const [disputeWindowHours, setDisputeWindowHours] = useState("24");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Action state
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: contracts, isLoading } = useQuery<CargoContractState[]>({
    queryKey: ["cargoContractsV11"],
    queryFn: fetchContracts,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const allContracts = useMemo(() => contracts ?? [], [contracts]);

  const invalidate = () => {
    setTimeout(() => queryClient.invalidateQueries({ queryKey: ["cargoContractsV11"] }), 2500);
    setTimeout(() => queryClient.invalidateQueries({ queryKey: ["cargoContractsV11"] }), 7000);
  };

  const handleCreate = async () => {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      const rewardAmount = BigInt(reward.trim() || "0");
      if (rewardAmount <= 0n) throw new Error("Reward must be greater than zero.");
      if (!description.trim()) throw new Error("Description is required.");
      if (!destinationSsuId.trim()) throw new Error("Destination SSU (assembly_id) is required.");
      const itemTypeIdN = BigInt(itemTypeId.trim() || "0");
      const minQuantityN = BigInt(minQuantity.trim() || "0");
      if (minQuantityN <= 0n) throw new Error("Min quantity must be greater than zero.");
      const disputeHours = Number(disputeWindowHours);
      if (!Number.isFinite(disputeHours) || disputeHours <= 0) throw new Error("Dispute window must be > 0.");
      const disputeWindowMs = BigInt(Math.floor(disputeHours * 3_600_000));
      const deadlineMs = deadlineDate ? new Date(deadlineDate).getTime() : Date.now() + 7 * 86_400_000;
      if (Number.isNaN(deadlineMs)) throw new Error("Invalid deadline date.");

      const tx = await buildCreateContractTransaction({
        owner: account.address,
        description: description.trim(),
        destinationSsuId: destinationSsuId.trim(),
        itemTypeId: itemTypeIdN,
        minQuantity: minQuantityN,
        reward: rewardAmount,
        carrier: carrier.trim() || ZERO_ADDRESS,
        disputeWindowMs,
        deadlineMs,
      });
      const signer = new CurrentAccountSigner(dAppKit);
      await signer.signAndExecuteTransaction({ transaction: tx });
      setDescription("");
      setDestinationSsuId("");
      setItemTypeId("");
      setMinQuantity("");
      setReward("");
      setCarrier("");
      setDisputeWindowHours("24");
      setDeadlineDate("");
      invalidate();
    } catch (e) {
      setError(normalizeChainError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAction = async (type: string, contractId: string, extra?: string) => {
    setActionBusyId(contractId);
    setActionError(null);
    try {
      const signer = new CurrentAccountSigner(dAppKit);
      let tx;
      if (type === "submitClaim") {
        tx = buildSubmitDeliveryClaimTransaction(contractId, extra ?? "");
      } else if (type === "dispute") {
        tx = buildDisputeDeliveryTransaction(contractId);
      } else if (type === "finalize") {
        tx = buildFinalizeDeliveryTransaction(contractId);
      } else if (type === "cancel") {
        tx = buildCancelContractTransaction(contractId);
      } else {
        throw new Error(`Unknown action: ${type}`);
      }
      await signer.signAndExecuteTransaction({ transaction: tx });
      invalidate();
    } catch (e) {
      setActionError(normalizeChainError(e));
    } finally {
      setActionBusyId(null);
    }
  };

  return (
    <div className="card">
      <div style={{ color: "#FF4700", fontWeight: 700, fontSize: "18px", marginBottom: "16px", fontFamily: "monospace" }}>
        Cargo Contracts
      </div>

      {/* ── Create Form ── */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,71,0,0.12)",
        padding: "14px",
        marginBottom: "20px",
      }}>
        <div style={{ color: "#FF4700", fontWeight: 600, fontSize: "13px", marginBottom: "12px", fontFamily: "monospace" }}>
          Post Contract
        </div>

        {!account ? (
          <div style={{ color: "#888", fontSize: "12px" }}>Connect wallet to post a cargo contract.</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
              <label style={labelStyle}>
                DESCRIPTION
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Cargo manifest description" style={inputStyle} />
              </label>
              <label style={labelStyle}>
                DESTINATION SSU (ASSEMBLY_ID)
                <input value={destinationSsuId} onChange={(e) => setDestinationSsuId(e.target.value)} placeholder="0x..." style={inputStyle} />
              </label>
              <label style={labelStyle}>
                ITEM TYPE ID
                <ItemTypePicker
                  value={itemTypeId ? Number(itemTypeId) : null}
                  onChange={(id) => setItemTypeId(String(id))}
                  placeholder="Search items by name…"
                />
              </label>
              <label style={labelStyle}>
                MIN QUANTITY
                <input value={minQuantity} onChange={(e) => setMinQuantity(e.target.value.replace(/[^0-9]/g, ""))} placeholder="1" style={inputStyle} />
              </label>
              <label style={labelStyle}>
                REWARD (CRDL)
                <input value={reward} onChange={(e) => setReward(e.target.value.replace(/[^0-9]/g, ""))} placeholder="100" style={inputStyle} />
              </label>
              <label style={labelStyle}>
                CARRIER ADDRESS (OPTIONAL)
                <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Leave blank for open" style={inputStyle} />
              </label>
              <label style={labelStyle}>
                DISPUTE WINDOW (HOURS)
                <input value={disputeWindowHours} onChange={(e) => setDisputeWindowHours(e.target.value.replace(/[^0-9]/g, ""))} placeholder="24" style={inputStyle} />
              </label>
              <label style={labelStyle}>
                DEADLINE
                <input type="datetime-local" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} style={inputStyle} />
              </label>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
              <button className="accent-button" onClick={handleCreate} disabled={busy}>
                {busy ? "Posting…" : "Post Contract"}
              </button>
              <div style={{ color: "rgba(107,107,94,0.65)", fontSize: "11px", fontFamily: "monospace" }}>
                Blank carrier = open to any pilot. Dispute window default 24h.
              </div>
            </div>
            {error && <div style={{ color: "#ff6432", fontSize: "12px", marginTop: "8px" }}>{error}</div>}
          </>
        )}
      </div>

      {/* ── Contract List ── */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        padding: "14px",
      }}>
        <div style={{ color: "#aaa", fontWeight: 600, fontSize: "13px", marginBottom: "12px", fontFamily: "monospace" }}>
          Active Contracts
        </div>

        {isLoading ? (
          <div style={{ color: "#888", fontSize: "12px" }}>Loading contracts…</div>
        ) : allContracts.length === 0 ? (
          <div style={{ color: "rgba(107,107,94,0.55)", fontSize: "12px" }}>No cargo contracts found yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {allContracts.map((contract) => (
              <ContractCard
                key={contract.objectId}
                contract={contract}
                accountAddress={account?.address ?? null}
                onAction={handleAction}
                actionBusyId={actionBusyId}
                actionError={actionError}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#fff",
  fontSize: "12px",
  padding: "8px 10px",
  outline: "none",
  borderRadius: "0",
  fontFamily: "monospace",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  color: "#888",
  fontSize: "11px",
  fontFamily: "monospace",
};

const confirmButtonStyle: React.CSSProperties = {
  background: "rgba(0,255,150,0.12)",
  border: "1px solid rgba(0,255,150,0.35)",
  color: "#00ff96",
  fontSize: "12px",
  padding: "6px 14px",
  cursor: "pointer",
  borderRadius: "0",
  fontFamily: "monospace",
};

const cancelButtonStyle: React.CSSProperties = {
  background: "rgba(180,180,180,0.1)",
  border: "1px solid rgba(180,180,180,0.28)",
  color: "#b8b8b8",
  fontSize: "12px",
  padding: "6px 14px",
  cursor: "pointer",
  borderRadius: "0",
  fontFamily: "monospace",
};

const disputeButtonStyle: React.CSSProperties = {
  background: "rgba(255,100,100,0.1)",
  border: "1px solid rgba(255,100,100,0.3)",
  color: "#ff6464",
  fontSize: "12px",
  padding: "6px 14px",
  cursor: "pointer",
  borderRadius: "0",
  fontFamily: "monospace",
};

const verifyButtonStyle: React.CSSProperties = {
  background: "rgba(100,180,255,0.1)",
  border: "1px solid rgba(100,180,255,0.3)",
  color: "#64b4ff",
  fontSize: "12px",
  padding: "6px 14px",
  cursor: "pointer",
  borderRadius: "0",
  fontFamily: "monospace",
  whiteSpace: "nowrap",
};
