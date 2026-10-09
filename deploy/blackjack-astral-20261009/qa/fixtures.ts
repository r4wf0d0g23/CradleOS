import {writeFileSync} from 'node:fs';
import {initialSession,playSession,actSession,restoreSession} from '../../../cradleos-dapp/src/lib/casinoSessions';
import {blackjackPlan} from '../../../cradleos-dapp/src/lib/casinoTableMotion';
const rng=(seed:number)=>(n:number)=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed%n};
const fixtures:any={};
for(let seed=1;seed<5000;seed++){
 const s=playSession(initialSession(),'blackjack',100,{}, {seats:3},rng(seed));
 if(!s.table)continue;
 if(!fixtures.three)fixtures.three=s;
 const h=s.table.hands[0];
 if(s.table.active===0&&h.cards[0]%13===h.cards[1]%13&&!fixtures.split)fixtures.split=s;
 const one=playSession(initialSession(),'blackjack',100,{}, {seats:1},rng(seed));
 if(one.table&&!fixtures.one)fixtures.one=one;
 if(fixtures.one&&fixtures.three&&fixtures.split)break;
}
fixtures.splitNext=actSession(fixtures.split,'split');fixtures.hit=actSession(fixtures.one,'hit');fixtures.double=actSession(fixtures.one,'double');
for(const [k,v] of Object.entries(fixtures)){if(JSON.stringify(restoreSession(JSON.stringify(v)))!==JSON.stringify(v))throw Error(k+' invalid fixture')}
writeFileSync(new URL('./fixtures.json',import.meta.url),JSON.stringify({fixtures,splitPlan:blackjackPlan(fixtures.splitNext,fixtures.split)},null,2));
