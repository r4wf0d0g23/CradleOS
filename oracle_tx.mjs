/**
 * oracle_tx.mjs — CradleOS settlement oracle transaction submitter
 *
 * Called by the Python Intel API as a subprocess:
 *   node oracle_tx.mjs <action> <json_args>
 *
 * Actions:
 *   finalize_cargo  {"contract_id": "0x...", "pkg": "0x..."}
 *   finalize_srp    {"claim_id": "0x...", "policy_id": "0x...", "pkg": "0x..."}
 *   pay_bounty      {"bounty_id": "0x...", "pkg": "0x..."}
 *
 * Env (loaded from .env automatically by the Python caller):
 *   SUI_PRIVATE_KEY  — ed25519 private key (bech32 suiprivkey1... or 32-byte hex)
 *   SUI_RPC          — optional override (default: testnet)
 *
 * Exits 0 on success, 1 on error.
 * Stdout: JSON { "digest": "...", "status": "success" } or { "error": "..." }
 */

import { Transaction }      from "./cradleos-dapp/node_modules/@mysten/sui/dist/transactions/index.mjs";
import { Ed25519Keypair }   from "./cradleos-dapp/node_modules/@mysten/sui/dist/keypairs/ed25519/index.mjs";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "./cradleos-dapp/node_modules/@mysten/sui/dist/jsonRpc/index.mjs";

const CLOCK   = "0x0000000000000000000000000000000000000000000000000000000000000006";
const SUI_RPC = process.env.SUI_RPC ?? getJsonRpcFullnodeUrl("testnet");

function loadKeypair() {
  const raw = process.env.SUI_PRIVATE_KEY;
  if (!raw) throw new Error("SUI_PRIVATE_KEY not set");
  return Ed25519Keypair.fromSecretKey(raw);
}

async function run() {
  const [,, action, argsJson] = process.argv;
  if (!action || !argsJson) {
    console.log(JSON.stringify({ error: "Usage: oracle_tx.mjs <action> <json_args>" }));
    process.exit(1);
  }

  let args;
  try { args = JSON.parse(argsJson); } catch {
    console.log(JSON.stringify({ error: "Invalid JSON args" }));
    process.exit(1);
  }

  let keypair, client;
  try {
    keypair = loadKeypair();
    client  = new SuiJsonRpcClient({ url: SUI_RPC });
  } catch (e) {
    console.log(JSON.stringify({ error: `Init failed: ${String(e)}` }));
    process.exit(1);
  }

  const sender = keypair.getPublicKey().toSuiAddress();
  const tx = new Transaction();
  tx.setSender(sender);

  try {
    if (action === "finalize_cargo") {
      // finalize_delivery_entry(claim: &mut CargoContract, clock: &Clock, ctx)
      tx.moveCall({
        target: `${args.pkg}::cargo_contract::finalize_delivery_entry`,
        arguments: [
          tx.object(args.contract_id),
          tx.object(CLOCK),
        ],
      });
    } else if (action === "finalize_srp") {
      // finalize_claim_entry(claim: &mut SRPClaim, policy: &mut SRPPolicy, clock: &Clock, ctx)
      tx.moveCall({
        target: `${args.pkg}::ship_reimbursement::finalize_claim_entry`,
        arguments: [
          tx.object(args.claim_id),
          tx.object(args.policy_id),
          tx.object(CLOCK),
        ],
      });
    } else if (action === "pay_bounty") {
      // pay_bounty_entry(bounty: &mut BountyContract, ctx)
      tx.moveCall({
        target: `${args.pkg}::bounty_contract::pay_bounty_entry`,
        arguments: [
          tx.object(args.bounty_id),
        ],
      });
    } else {
      console.log(JSON.stringify({ error: `Unknown action: ${action}` }));
      process.exit(1);
    }

    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showEffects: true },
    });

    const status = result.effects?.status?.status ?? "unknown";
    if (status !== "success") {
      console.log(JSON.stringify({
        error: `Transaction failed: ${status}`,
        digest: result.digest,
        effects: result.effects?.status,
      }));
      process.exit(1);
    }

    console.log(JSON.stringify({ digest: result.digest, status: "success" }));
    process.exit(0);

  } catch (e) {
    console.log(JSON.stringify({ error: String(e) }));
    process.exit(1);
  }
}

run();
