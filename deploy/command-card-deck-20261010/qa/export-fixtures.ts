import {writeFileSync} from 'node:fs';
import {initialSession,playSession} from '../../../cradleos-dapp/src/lib/casinoSessions';
let found;
for(let seed=1;seed<1000;seed++){
 let n=seed; const rand=(bound:number)=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n%bound;};
 const s=playSession(initialSession(),'andar_bahar',2500,{}, {},rand);
 if(s.pack.rounds[0].values.length>20&&s.pack.rounds[0].values.slice(-8).includes(9)){found=s;break;}
}
if(!found)throw Error('Long engine fixture not found');
writeFileSync('deploy/command-card-deck-20261010/qa/fixtures.json',JSON.stringify({longAndar:found},null,2)+'\n');
