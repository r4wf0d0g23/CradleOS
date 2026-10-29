import {writeFileSync} from 'node:fs';
import {fetchSsuSnapshot} from '../../cradleos-dapp/src/lib/ssuSafety';
import {readStoragePolicy,secureStorageExtension,storagePermits} from '../../cradleos-dapp/src/lib/storageAccess';
import {fetchCharacterOwnerCapId} from '../../cradleos-dapp/src/lib/ssuAccess';
import {readInventoryCharacter} from '../../cradleos-dapp/src/lib/inventoryRead';
const ssuId='0x573d25ba9bafd0f01de44b81090a5ea2bfac42c6c07a84267a5b95b9e1be18c5', characterId='0x753a02cc4a064d09704eb7333fb3bfee41317ee60a094571b85b120c4cea1ce5';
const [state,policy,cap,c]=await Promise.all([fetchSsuSnapshot(ssuId),readStoragePolicy(ssuId),fetchCharacterOwnerCapId(characterId),readInventoryCharacter(characterId)]);
const r={at:new Date().toISOString(),ssuId,extension:state.extension,secure:secureStorageExtension(state.extension),online:state.online,policy,characterCapResolved:!!cap,ownPersonalStacks:state.slots.find(s=>s.key===cap)?.items.filter(i=>i.quantity>0).length??0,ownDepositPermitted:!!policy&&storagePermits(policy.rules,characterId,c.tribeId,false),partitions:state.slots.map(s=>({kind:s.partition,own:s.key===cap,stacks:s.items.filter(i=>i.quantity>0).length})),transactions:0};
writeFileSync(new URL('live-storage-state.json',import.meta.url),JSON.stringify(r,null,2));console.log(JSON.stringify(r));
