import {writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
import {initialSession,playSession,restoreSession} from '../../../cradleos-dapp/src/lib/casinoSessions';
const out={};for(const [name,pair] of Object.entries({win:[12,0],loss:[0,12],tie:[7,7]})){let i=0;const s=playSession(initialSession(),'war',2500,{}, {},()=>pair[i++]);assert.deepEqual(restoreSession(JSON.stringify(s)),JSON.parse(JSON.stringify(s)));out[name]=s;}
writeFileSync('deploy/fleet-duel-upgrade-20261010/qa/fixtures.json',JSON.stringify(out,null,2)+'\n');
