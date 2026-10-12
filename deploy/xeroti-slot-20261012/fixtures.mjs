import fs from 'node:fs';
import {spinFleet} from '../../cradleos-dapp/src/lib/casinoSlotFleet.ts';
import {initialSession,playSession,revealSlot} from '../../cradleos-dapp/src/lib/casinoSessions.ts';
const rng=seed=>b=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)%b};
const session=r=>{let i=0;return playSession(initialSession(),'slot_xeroti',1000,{},{},()=>r.draws[i++])};
const result={top:session(spinFleet('slot_xeroti',1000,()=>99)),full:session(spinFleet('slot_xeroti',1000,()=>0))};
for(let seed=1;seed<1000;seed++){const r=spinFleet('slot_xeroti',1000,rng(seed));if(!r.payout&&!result.loss)result.loss=session(r);if(r.frames.length>1&&r.frames[0].wins.reduce((n,w)=>n+w.cells.length,0)<25&&!result.partial)result.partial=session(r);if(result.loss&&result.partial)break;}
result.fullShown=revealSlot(result.full);
fs.writeFileSync(new URL('./qa/fixtures.json',import.meta.url),JSON.stringify(result,null,2));console.log(Object.fromEntries(Object.entries(result).map(([k,s])=>[k,{frames:s.pack.slot.frames.length,cursor:s.pack.slot.cursor,payout:s.pack.slot.payout}])));
