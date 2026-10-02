import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { CURRENT_WORLD, CURRENT_EVE_PACKAGE } from "./cycle";
import { CURRENT_CONTRACT_PACKAGES } from "./cycleDeployment";
const allowed = new Set(["0x1", "0x2", CURRENT_WORLD, CURRENT_EVE_PACKAGE, ...CURRENT_CONTRACT_PACKAGES].map(p => normalizeSuiAddress(p)));
/** No previous-cycle recovery exceptions: this is a clean wipe. */
export function assertCycleCompatible(input: Transaction | Uint8Array | string): void {
  for (const command of Transaction.from(input).getData().commands) {
    if (command.$kind === "Publish" || command.$kind === "Upgrade") throw new Error("Use the reviewed Cycle 7 deployment procedure, not a browser upgrade payload.");
    if (command.$kind !== "MoveCall") continue;
    const call = command.MoveCall;
    if (!allowed.has(normalizeSuiAddress(call.package))) throw new Error("Cycle 7 clean wipe: this contract is not in the current deployment. No transaction was sent.");
    for (const type of call.typeArguments) for (const pkg of type.match(/0x[0-9a-fA-F]+(?=::)/g) || []) {
      if (!allowed.has(normalizeSuiAddress(pkg))) throw new Error("Previous-cycle asset types are retired. No transaction was sent.");
    }
  }
}
