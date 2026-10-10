import {writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
import {initialSession,playSession,restoreSession} from '../../../cradleos-dapp/src/lib/casinoSessions';
const out={};for(const [name,[a,b]] of Object.entries({dragon:[12,0],tiger:[0,12],tie:[7,7]})){const ca=a*4,cb=b*4+(a===b?1:0),raw=[ca,cb<ca?cb:cb-1];let i=0;const s=playSession(initialSession(),'dragon_tiger',2500,{side:0}, {},()=>raw[i++]);assert.deepEqual(s.history[0].values,[a,b]);assert.deepEqual(restoreSession(JSON.stringify(s)),JSON.parse(JSON.stringify(s)));out[name]=s;}
writeFileSync('deploy/frigate-duel-upgrade-20261010/qa/fixtures.json',JSON.stringify(out,null,2)+'\n');
