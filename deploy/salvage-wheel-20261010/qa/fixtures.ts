import { initialSession, playSession, restoreSession } from '../../../cradleos-dapp/src/lib/casinoSessions';
import { writeFileSync } from 'node:fs';
const result:Record<string,unknown>={};
for(const index of [0,24,42,50,53]){const s=playSession(initialSession(),'money_wheel',2500,{}, {},()=>index);if(JSON.stringify(restoreSession(JSON.stringify(s)))!==JSON.stringify(s))throw Error('Invalid fixture');result[index]=s;}
writeFileSync(new URL('./fixtures.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
