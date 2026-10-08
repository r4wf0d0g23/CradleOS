import {FLEET,spinFleet} from '/home/rawdata/.openclaw-captain/workspace/worktrees/cradleos-cycle7-20261002/cradleos-dapp/src/lib/casinoSlotFleet.ts';
import fs from 'node:fs';
const report={samplesPerSeed:250000,seeds:[1023449,701209],stakes:[100,2500,100000],games:{}};
for(const [key,g] of Object.entries(FLEET)){
 const batches=[];
 for(const seed of report.seeds){let x=seed+Object.keys(FLEET).indexOf(key)*223;const rng=b=>{const limit=Math.floor(4294967296/b)*b;let n;do{x^=x<<13;x^=x>>>17;x^=x<<5;n=x>>>0;}while(n>=limit);return n%b;};
 const stages={},stats=report.stakes.map(stake=>({stake,sum:0,sum2:0,hit:0,profit:0,cap:0,max:0,over100:0,over500:0}));let bonus=0,cascade=0,full=0;
 for(let i=0;i<report.samplesPerSeed;i++){const r=spinFleet(key,100,rng),points=r.frames.reduce((a,f)=>a+f.points,0);stages[r.frames.length]=(stages[r.frames.length]??0)+1;bonus+=r.frames.some(f=>f.kind==='free'||f.kind==='hold');cascade+=r.frames.some(f=>f.kind==='cascade');full+=g.mode==='hold'&&r.frames.at(-1).coins.every(n=>n>0);
 for(const s of stats){const uncapped=Number(BigInt(s.stake)*BigInt(points)*BigInt(g.scale)/100000000n),p=Math.min(uncapped,s.stake*2500),v=p/s.stake;s.sum+=v;s.sum2+=v*v;s.hit+=v>0;s.profit+=v>1;s.cap+=uncapped>s.stake*2500;s.max=Math.max(s.max,v);s.over100+=v>=100;s.over500+=v>=500;}}
 batches.push({seed,bonus,cascade,full,stages,stakes:stats.map(s=>{const mean=s.sum/report.samplesPerSeed,se=Math.sqrt((s.sum2/report.samplesPerSeed-mean*mean)/report.samplesPerSeed);return {stake:s.stake,rtpPercent:mean*100,interval95Percent:[(mean-1.96*se)*100,(mean+1.96*se)*100],hitPercent:s.hit/report.samplesPerSeed*100,netProfitPercent:s.profit/report.samplesPerSeed*100,capCount:s.cap,maxObservedReturn:s.max,over100:s.over100,over500:s.over500,zeroCapOneSided95UpperProbability:s.cap===0?1-Math.pow(.05,1/report.samplesPerSeed):null};})});
 }
 report.games[key]=batches;fs.writeFileSync('/home/rawdata/.openclaw-captain/workspace/research/cradleos-casino-slot-fleet-20261008/tails.json',JSON.stringify(report,null,2));console.log(key);
}
