import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { CASINO_PKG, CASINO_V28, CRADLEOS_PKG, CRADLEOS_EVENT_PKGS, SSU_ACCESS_PKG } from "../constants";
import { LEGACY_EVE_COIN_TYPE, LEGACY_WORLD } from "./cycle";

const casinoRecovery = new Set([
  "blackjack_live::hit", "blackjack_live::stand", "blackjack_live::split_hit", "blackjack_live::split_stand",
  "hilo::settle", "mines::reveal", "mines::cashout", "dragon_tower::pick", "dragon_tower::cashout",
  "video_poker::draw", "house::withdraw",
]);
const escrowRecovery = new Set([
  "bounty_contract::cancel_bounty_entry", "trustless_bounty::cancel_bounty_entry",
  "cargo_contract::cancel_contract_entry", "cargo_contract::dispute_delivery_entry", "cargo_contract::finalize_delivery_entry",
  "ship_reimbursement::dispute_claim_entry", "ship_reimbursement::finalize_claim_entry", "ship_reimbursement::drain_policy_entry",
  "tribe_dex::cancel_sell_order_entry", "collateral_vault::redeem_entry", "collateral_vault::drain_collateral_entry",
  "keeper_shrine::withdraw", "keeper_shrine::withdraw_all", "treasury::withdraw",
]);
const blockedPackages = new Set([CASINO_PKG, CASINO_V28, CRADLEOS_PKG, ...CRADLEOS_EVENT_PKGS, SSU_ACCESS_PKG, LEGACY_WORLD].map(p => normalizeSuiAddress(p)));

/** Client compatibility gate, not a substitute for on-chain access checks.
 * Checks EVERY command; serialization cannot bypass the same validation.
 * Recovery exceptions are reviewed against source signatures and exact targets.
 */
export function assertCycleCompatible(input: Transaction | Uint8Array | string): void {
  const tx = Transaction.from(input);
  for (const command of tx.getData().commands) {
    if (command.$kind === "Publish" || command.$kind === "Upgrade") {
      throw new Error("Contract publication is not part of the Cycle 7 website update.");
    }
    if (command.$kind !== "MoveCall") continue;
    const call = command.MoveCall;
    const pkg = normalizeSuiAddress(call.package);
    if (!blockedPackages.has(pkg)) continue;
    const target = `${call.module}::${call.function}`;
    const recovery = (pkg === normalizeSuiAddress(CASINO_PKG) && casinoRecovery.has(target)) ||
      (pkg === normalizeSuiAddress(CRADLEOS_PKG) && escrowRecovery.has(target));
    if (!recovery) throw new Error("Cycle 7 migration pending: this action uses a previous-world contract. No transaction was sent. Existing supported recovery actions remain available.");
    const expectedTypes = target === "treasury::withdraw" ? [] : [LEGACY_EVE_COIN_TYPE];
    if (JSON.stringify(call.typeArguments) !== JSON.stringify(expectedTypes)) {
      throw new Error("Legacy recovery must use the original asset type, not Cycle 7 EVE. No transaction was sent.");
    }
  }
}
