import {FLEET,spinFleet} from '/home/rawdata/.openclaw-captain/workspace/worktrees/cradleos-cycle7-20261002/cradleos-dapp/src/lib/casinoSlotFleet.ts';
import fs from 'node:fs';
const count=Number(process.env.SAMPLES??200000),phase=process.env.PHASE??'calibration',seed=Number(process.env.SEED??431223);
const results={phase,count,seed,stake:10000,method:'Independent paid rounds, deterministic xorshift32 rejection-sampled bounded draws; interval uses sample SD/sqrt(n), approximate Monte Carlo, not certification.',games:{}};
for(const [key,g] of Object.entries(FLEET)){
 let x=seed+Object.keys(FLEET).indexOf(key)*91237;const rng=bound=>{const ceiling=Math.floor(4294967296/bound)*bound;let n;do{x^=x<<13;x^=x>>>17;x^=x<<5;n=x>>>0;}while(n>=ceiling);return n%bound;};
 let sum=0,sum2=0,raw=0,hit=0,profit=0,bonus=0,caps=0,max=0,frames=0;
 for(let i=0;i<count;i++){const r=spinFleet(key,10000,rng),v=r.payout/10000;sum+=v;sum2+=v*v;raw+=r.frames.reduce((a,f)=>a+f.points,0);hit+=v>0;profit+=v>1;bonus+=r.frames.some(f=>f.kind==='free'||f.kind==='hold');caps+=r.capReached;max=Math.max(max,v);frames=Math.max(frames,r.frames.length);}
 const mean=sum/count,se=Math.sqrt(Math.max(0,sum2/count-mean*mean)/count),rawMean=raw/count;
 results.games[key]={scale:g.scale,rtpPercent:mean*100,interval95Percent:[(mean-1.96*se)*100,(mean+1.96*se)*100],hitPercent:hit/count*100,netWinPercent:profit/count*100,featurePercent:bonus/count*100,capCount:caps,maxObservedReturn:max,maxFrames:frames,meanPoints:rawMean,recommendedScale:Math.round(96000000/rawMean)};
 console.log(key,JSON.stringify(results.games[key]));
 fs.writeFileSync(`/home/rawdata/.openclaw-captain/workspace/research/cradleos-casino-slot-fleet-20261008/${phase}.json`,JSON.stringify(results,null,2));
}
