import {writeFileSync} from 'node:fs';
import {initialSession,playSession,restoreSession} from '../../../cradleos-dapp/src/lib/casinoSessions';
let i=0;const seq=[490,0];
const fixtures={max:playSession(initialSession(),'limbo',2500,{target:100000},{},()=>0),custom:playSession(initialSession(),'limbo',2500,{target:137},{},()=>100),near:playSession(initialSession(),'limbo',2500,{target:200},{},()=>seq[i++%2]),win:playSession(initialSession(),'limbo',2500,{target:200},{},()=>100),loss:playSession(initialSession(),'limbo',2500,{target:200},{},()=>999)};
for(const s of Object.values(fixtures))if(JSON.stringify(restoreSession(JSON.stringify(s)))!==JSON.stringify(s))throw Error('Invalid fixture');
writeFileSync('deploy/lai-jump-20261010/qa/fixtures.json',JSON.stringify(fixtures,null,2)+'\n');
