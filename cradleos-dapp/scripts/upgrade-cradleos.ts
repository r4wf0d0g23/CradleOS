/**
 * CradleOS Package Upgrade Script
 * 
 * Upgrades the original CradleOS package (v4: 0xee8c...) to include all v8+ modules
 * (recruiting_terminal, bounty_contract, cargo_contract, etc.)
 * 
 * This makes the TribeVault type compatible across all modules.
 * 
 * Signer: 0xc80fe7d6043f0c23ee30dc45c8b1036d079e11d149c4eff9ab0cbd0310803023
 * UpgradeCap: 0xe9710eaa4507ad2004bb9e395ea857447f97146abcc08dcd0fdae45617f3c5dc
 * Original Package: 0xee8cd44d4373a8fbb644edbd96281f0e25eacaec6209408c00a2b7c76a179546
 */

import { Transaction, UpgradePolicy } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/sui/utils";
import bytecodeData from "../../upgrade_bytecode.json";

const UPGRADE_CAP = "0xe9710eaa4507ad2004bb9e395ea857447f97146abcc08dcd0fdae45617f3c5dc";

export function buildUpgradeTransaction(): Transaction {
  const tx = new Transaction();

  const modules: number[][] = bytecodeData.modules.map((m: string) => [...fromBase64(m)]);
  const dependencies: string[] = bytecodeData.dependencies;
  const digest: number[] = bytecodeData.digest;

  // Authorize the upgrade
  const upgradeTicket = tx.moveCall({
    target: "0x2::package::authorize_upgrade",
    arguments: [
      tx.object(UPGRADE_CAP),
      tx.pure.u8(UpgradePolicy.COMPATIBLE),
      tx.pure.vector("u8", digest),
    ],
  });

  // Commit the upgrade with the compiled modules
  const upgradeReceipt = tx.upgrade({
    modules,
    dependencies,
    package: bytecodeData.dependencies[0], // original package ID
    ticket: upgradeTicket,
  });

  // Commit the upgrade
  tx.moveCall({
    target: "0x2::package::commit_upgrade",
    arguments: [
      tx.object(UPGRADE_CAP),
      upgradeReceipt,
    ],
  });

  tx.setGasBudget(500_000_000);
  return tx;
}

// If running standalone
if (typeof window === "undefined") {
  const tx = buildUpgradeTransaction();
  console.log("Upgrade transaction built successfully");
  console.log("Modules:", bytecodeData.modules.length);
  console.log("Dependencies:", bytecodeData.dependencies.length);
  console.log("Gas budget: 500M MIST");
  console.log("\nTo sign: connect wallet 0xc80f... and execute this transaction");
}
