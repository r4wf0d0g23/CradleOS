import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(new URL('../../cradleos-dapp/package.json',import.meta.url));
const {SuiGrpcClient}=await import(require.resolve('@mysten/sui/grpc'));
const {Transaction}=await import(require.resolve('@mysten/sui/transactions'));
const client=new SuiGrpcClient({network:'testnet',baseUrl:'https://fullnode.testnet.sui.io:443'});
const fixtures=[{label:'USDC/USD verifier sample',sourceTransaction:'6kmVn3Ej5UQHF1VkwK5VrUKRtUyy4iz7K4UKZqpyYja3',hex:readFileSync(new URL('./pyth-public-leaf.hex',import.meta.url),'utf8').trim()},...JSON.parse(readFileSync(new URL('./pyth-market-fixtures.json',import.meta.url),'utf8'))];
const out={checksEnabled:true,simulationOnly:true,cases:[]};
for(const fixture of fixtures){
const raw=Buffer.from(fixture.hex,'hex');
const vaaStart=10,vaaSize=raw.readUInt16BE(8),msgStart=10+vaaSize+1+2;
for(const name of ['valid','signature','feed','value','merkle']){
 const data=Buffer.from(raw);
 if(name==='signature') data[vaaStart+9]^=1;
 if(name==='feed') data[msgStart+1]^=1;
 if(name==='value') data[msgStart+40]^=1;
 if(name==='merkle') data[data.length-1]^=1;
 const tx=new Transaction();tx.setSender('0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a');tx.setGasBudget(100000000);
 const [vaa]=tx.moveCall({target:'0xe79f4e3e02ce132f40f39e73220493a802329d3cb6ad7f789e98a78910fc0053::vaa::parse_and_verify',arguments:[tx.object('0x750da8e6d16b6a363a39fe2eaa8295ac224a1e6fce4e47b58845e2e8746164f0'),tx.pure.vector('u8',data.subarray(vaaStart,vaaStart+vaaSize)),tx.object('0x6')]});
 const [infos]=tx.moveCall({target:'0xd1ac23e1582080e2e5d43dbad1cf463ea2337cdbbb1a9ca669e470cefb74d8fd::pyth::create_authenticated_price_infos_using_accumulator',arguments:[tx.object('0x3c48fe392912de6c18087a2b3f5fdbfbfdb4598e180947feff1f12f8e9ea073e'),tx.pure.vector('u8',data),vaa,tx.object('0x6')]});
 tx.moveCall({target:'0xd1ac23e1582080e2e5d43dbad1cf463ea2337cdbbb1a9ca669e470cefb74d8fd::hot_potato_vector::destroy',typeArguments:['0xd1ac23e1582080e2e5d43dbad1cf463ea2337cdbbb1a9ca669e470cefb74d8fd::price_info::PriceInfo'],arguments:[infos]});
 try{const r=await client.simulateTransaction({transaction:tx,checksEnabled:true});const v=r.Transaction??r.FailedTransaction;out.cases.push({feed:fixture.label,sourceTransaction:fixture.sourceTransaction,name,kind:r.$kind,status:v?.status});console.log(name,JSON.stringify(v?.status??r).slice(0,800));}
 catch(e){out.cases.push({feed:fixture.label,sourceTransaction:fixture.sourceTransaction,name,error:String(e).slice(0,300)});console.log(name,String(e).slice(0,300));}
}
}
writeFileSync(new URL('./pyth-verification.json',import.meta.url),JSON.stringify(out,null,2));

if(out.cases.length!==15||out.cases.some(c=>c.status?.success!==(c.name==='valid')))throw Error('PYTH_VERIFICATION_FAILED');
