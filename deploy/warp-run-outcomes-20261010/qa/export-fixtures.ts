import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {initialSession,playSession,restoreSession} from '../../../cradleos-dapp/src/lib/casinoSessions';
const cases={subOne:[1000000,200,9800],one:[980000,200,10000],nearMiss:[490001,200,19999],equal:[490000,200,20000],above:[489975,200,20001],max:[1,100000,10000000]};
const out={};
for(const [name,[roll,target,expected]] of Object.entries(cases)) {const parts=[Math.floor((roll-1)/1000),(roll-1)%1000];let i=0;const s=playSession(initialSession(),'crash',2500,{target},{},()=>parts[i++]);assert.equal(s.history[0].values[0],expected);assert.deepEqual(restoreSession(JSON.stringify(s)),JSON.parse(JSON.stringify(s)));out[name]=s;}
writeFileSync('deploy/warp-run-outcomes-20261010/qa/fixtures.json',JSON.stringify(out,null,2)+'\n');
