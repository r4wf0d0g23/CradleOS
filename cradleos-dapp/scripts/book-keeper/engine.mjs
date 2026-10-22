/** Pure, bounded policy. All amounts remain integers; no outcome discretion. */
export const FEEDS={1:'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',2:'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace'};
export function uint(value){if(typeof value!=='string'||!/^\d+$/.test(value)||BigInt(value)>18446744073709551615n)throw Error('INVALID_INTEGER');return BigInt(value);}
export function canonicalObject(node,type,bookId){
 const c=node?.asMoveObject?.contents,f=c?.json;
 if(node?.owner?.__typename!=='Shared'||c?.type?.repr!==type||!f||(bookId&&f.book_id!==bookId))throw Error('OBJECT_PROVENANCE');
 return f;
}
export function marketAction(f,now){
 if(uint(f.version)!==1n||!FEEDS[f.asset]||Buffer.from(f.price_feed,'base64').toString('hex')!==FEEDS[f.asset]||Number(f.price_exponent)!==8)throw Error('MARKET_TERMS');
 const end=Number(uint(f.ends)),deadline=Number(uint(f.proof_deadline));
 if(deadline!==end+3600||uint(f.claim_count)>10000n)throw Error('MARKET_TERMS');
 if(Number(f.result)!==0){if(![1,2,3].includes(Number(f.result)))throw Error('MARKET_RESULT');return 'payout';}
 if(now>=deadline)return 'finalize';
 if(now>=end&&uint(f.price_time)===0n)return 'proof';
 return null;
}
export function deliveryAction(f,now){if(![0,1,2].includes(Number(f.status)))throw Error('REWARD_STATUS');return Number(f.status)===0&&now>=Number(uint(f.deadline))?'refund':null;}
/** Pick one authenticated leaf without changing its message/proof or signed root. */
export function selectProof(hex,feed,target){
 if(typeof hex!=='string'||hex.length>131072||!/^([0-9a-fA-F]{2})+$/.test(hex))throw Error('BAD_ORACLE_BYTES');
 const data=Buffer.from(hex,'hex');let p=0;
 const take=n=>{if(p+n>data.length)throw Error('TRUNCATED_ORACLE_BYTES');const b=data.subarray(p,p+n);p+=n;return b;};
 if(take(4).toString()!=='PNAU'||take(1)[0]!==1)throw Error('ORACLE_VERSION');
 take(1);const trailing=take(1)[0];take(trailing);if(take(1)[0]!==0)throw Error('ORACLE_FORMAT');
 take(take(2).readUInt16BE());const header=data.subarray(0,p);const count=take(1)[0];let selected=null;
 for(let i=0;i<count;i++){
   const start=p;const message=take(take(2).readUInt16BE());const siblings=take(1)[0];take(siblings*20);
   if(message.length!==85||message[0]!==0||message.subarray(1,33).toString('hex')!==feed)continue;
   const value=message.readBigInt64BE(33),conf=message.readBigUInt64BE(41),exp=message.readInt32BE(49),published=message.readBigUInt64BE(53),previous=message.readBigInt64BE(61);
   if(value<=0n||exp!==-8||previous<0n||previous>=BigInt(target)||published<BigInt(target)||published>BigInt(target)+60n||conf*100n>value)throw Error('ORACLE_WINDOW');
   if(selected)throw Error('AMBIGUOUS_ORACLE_PROOF');
   selected=Buffer.concat([header,Buffer.from([1]),data.subarray(start,p)]);
 }
 if(p!==data.length||!selected||selected.length>16384)throw Error('NO_QUALIFYING_ORACLE_PROOF');
 return selected;
}
export function receipt(result){const r=result?.Transaction??result?.FailedTransaction;if(typeof r?.status?.success!=='boolean'||!r.digest)throw Error('UNKNOWN_TRANSACTION');return {digest:r.digest,success:r.status.success};}
