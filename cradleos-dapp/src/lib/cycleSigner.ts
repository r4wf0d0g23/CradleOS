import { CurrentAccountSigner as WalletSigner } from "@mysten/dapp-kit-core";
import { assertCycleCompatible } from "./transactionCompatibility";

/** Shared pre-wallet compatibility check for every CradleOS transaction surface. */
export class CurrentAccountSigner extends WalletSigner {
  override async signTransaction(bytes: Uint8Array) {
    assertCycleCompatible(bytes);
    return super.signTransaction(bytes);
  }
  override async signAndExecuteTransaction(input: Parameters<WalletSigner["signAndExecuteTransaction"]>[0]) {
    assertCycleCompatible(input.transaction);
    return super.signAndExecuteTransaction(input);
  }
}
