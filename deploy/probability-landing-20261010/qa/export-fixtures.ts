import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {initialSession,playSession,restoreSession} from '../../../cradleos-dapp/src/lib/casinoSessions';
const out={};
for(const roll of [1,50,100]){const s=playSession(initialSession(),'dice',2500,{target:50,over:true},{},()=>roll-1);assert.equal(s.history[0].values[0],roll);assert.deepEqual(restoreSession(JSON.stringify(s)),JSON.parse(JSON.stringify(s)));out[roll]=s;}
writeFileSync('deploy/probability-landing-20261010/qa/fixtures.json',JSON.stringify(out,null,2)+'\n');
