import { Assemblies, SponsoredTransactionActions, type SendSponsoredTransactionFn, type AssemblyType } from "@evefrontier/dapp-kit";
import { SERVER_ENV } from "../constants";
import { readStructureSnapshot } from "./structureRead";
import { readGate } from "./gateControl";
import { storageClient, storageId } from "./storageRead";

/** The wallet owns destination selection: its public API has no destination field. */
export async function sponsoredGateLink(source: string, wallet: string, unlink: boolean,
  send: SendSponsoredTransactionFn, assertWallet: () => void): Promise<string> {
  assertWallet();
  const [owned, gate] = await Promise.all([readStructureSnapshot(wallet), readGate(source)]);
  if (!owned.structures.some(s=>s.objectId===gate.id && s.ownerCapId===gate.ownerCapId)) throw Error("Gate owner required.");
  if (unlink ? !gate.linkedGateId : !!gate.linkedGateId) throw Error("Gate link changed. Refresh.");
  if (unlink && gate.extension) throw Error("Deactivate gate policy before unlinking.");
  const previous=gate.linkedGateId;
  assertWallet();
  const result=await send({ txAction:unlink?SponsoredTransactionActions.UNLINK_SMART_GATE:SponsoredTransactionActions.LINK_SMART_GATE,
    assembly:{item_id:gate.itemId,type:Assemblies.SmartGate} as AssemblyType<Assemblies.SmartGate>,tenant:SERVER_ENV,account:wallet });
  if (!result.digest) throw Error("Link result unverified. Refresh.");
  const confirmed=await storageClient.waitForTransaction({digest:result.digest,timeout:20000});
  if (confirmed.$kind==="FailedTransaction") throw Error("Gate transaction failed.");
  assertWallet();
  const fresh=await readGate(source);
  if (unlink) {
    if (fresh.linkedGateId || !previous || (await readGate(previous)).linkedGateId===storageId(source)) throw Error("Unlink unverified. Refresh.");
  } else {
    if (!fresh.linkedGateId || fresh.linkedGateId===fresh.id) throw Error("Link unverified. Refresh.");
    const target=await readGate(fresh.linkedGateId);
    if (target.linkedGateId!==fresh.id || target.typeId!==fresh.typeId) throw Error("Link unverified. Refresh.");
  }
  return result.digest;
}
