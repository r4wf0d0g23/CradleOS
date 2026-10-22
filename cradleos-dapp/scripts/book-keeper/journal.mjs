import {Transaction} from '@mysten/sui/transactions';
import {receipt} from './engine.mjs';
/** A durable pending record must survive every unknown network outcome. */
export function journalRunner({client,signer,bookId,state,save}) {
 async function complete(result){
  const r=receipt(result);if(r.digest!==state.pending?.digest)throw Error('DIGEST_MISMATCH');
  state.lastTransaction={...r,action:state.pending.action,at:new Date().toISOString()};state.pending=null;await save();return r.success;
 }
 return {
  async recover(){
   const p=state.pending;if(!p)return;
   if(p.bookId!==bookId||p.signer!==signer.toSuiAddress())throw Error('JOURNAL_PROVENANCE');
   const tx=Transaction.from(Buffer.from(p.bytes,'base64'));if(await tx.getDigest()!==p.digest)throw Error('JOURNAL_DIGEST');
   let found;
   try{found=await client.getTransaction({digest:p.digest});}catch{/* not-found/transport error is never proof of failure */}
   if(found)return complete(found);
   return complete(await client.executeTransaction({transaction:Buffer.from(p.bytes,'base64'),signatures:[p.signature]}));
  },
  async submit(action,tx){
   if(state.pending)throw Error('PENDING_TRANSACTION');
   const bytes=await tx.build({client}),digest=await tx.getDigest();const signed=await signer.signTransaction(bytes);
   state.pending={bookId,signer:signer.toSuiAddress(),action,digest,bytes:Buffer.from(bytes).toString('base64'),signature:signed.signature};
   await save();
   return complete(await client.executeTransaction({transaction:bytes,signatures:[signed.signature]}));
  },
 };
}
