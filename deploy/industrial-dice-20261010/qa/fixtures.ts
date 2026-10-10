import { initialSession, playSession, restoreSession } from '../../../cradleos-dapp/src/lib/casinoSessions';
import { changeCrapsBet, rollCraps } from '../../../cradleos-dapp/src/lib/casinoCrapsSession';
import { writeFileSync } from 'node:fs';
const result: Record<string, unknown> = {};
for (const [name, values] of [['low', [0,1,2]], ['high',[3,4,5]]] as const) {
 let i=0; const s=playSession(initialSession(),'sicbo',2500,{side:0},{},()=>values[i++]);
 if (JSON.stringify(restoreSession(JSON.stringify(s)))!==JSON.stringify(s)) throw Error('Invalid saved fixture');
 result[name]=s;
}
let i=0; result.pending=rollCraps(changeCrapsBet(initialSession(),'pass',500),()=>[2,3][i++]);
writeFileSync(new URL('./fixtures.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
