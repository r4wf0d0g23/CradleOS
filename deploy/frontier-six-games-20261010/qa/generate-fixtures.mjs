import {createServer} from '../../../cradleos-dapp/node_modules/vite/dist/node/index.js';import {writeFile} from 'node:fs/promises';
const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
try{
 const {initialSession,restoreSession,playSession}=await server.ssrLoadModule('/src/lib/casinoSessions.ts');
 const {startFrontier,actFrontier,collectFrontier}=await server.ssrLoadModule('/src/lib/casinoFrontierSession.ts');
 const {frontierView,FRONTIER_KEYS}=await server.ssrLoadModule('/src/lib/casinoFrontier.ts');
 const {houseWing}=await server.ssrLoadModule('/src/lib/casinoFrontierPoker.ts');
 const a=(kind,...values)=>({kind,values}),fixtures={};
 for(const game of FRONTIER_KEYS){const s=startFrontier(initialSession(),game,2500,game==='frontier_remainder'?[4]:game==='frontier_race'?[0,0]:game==='frontier_pusher'?[180,300]:[],n=>n-1);fixtures[game]=s;}
 for(const [name,draw,actions] of [
  ['royal',[0,12,14,27,9,10,11,2,17],[a('raise',4)]],
  ['tie',[1,15,3,17,0,9,10,11,12],[a('raise',3)]],
  ['fold',[0,12,14,27,9,10,11,2,17],[a('check'),a('check'),a('fold')]],
  ['flop',[0,12,14,27,9,10,11,2,17],[a('check')]],
 ]){let s=structuredClone(fixtures.frontier_holdem);s.frontier.current.draw=draw;for(const action of actions)s=actFrontier(s,1,s.frontier.current.actions.length,action);fixtures['holdem_'+name]=s;}
 let broker=structuredClone(fixtures.frontier_broker);for(const action of [a('pick',0),...Array.from({length:10},(_,i)=>[a('open',i+1),...([3,6,8,10].includes(i+1)?[a('reject')]:[])]).flat()])broker=actFrontier(broker,1,broker.frontier.current.actions.length,action);fixtures.broker_final=broker;
 let wing=structuredClone(fixtures.frontier_wing);wing=actFrontier(wing,1,0,a('split',...houseWing(wing.frontier.current.draw.slice(0,7))));fixtures.wing_done=wing;
 fixtures.old_blackjack=playSession(initialSession(),'blackjack',2500,{}, {seats:1},()=>0);
 for(const [name,s] of Object.entries(fixtures)){if(JSON.stringify(restoreSession(JSON.stringify(s)))!==JSON.stringify(s))throw Error('Unrestorable '+name);}
 await writeFile(new URL('fixtures.json',import.meta.url),JSON.stringify({states:fixtures,outcomes:Object.fromEntries(Object.entries(fixtures).filter(([,s])=>s.frontier).map(([name,s])=>[name,frontierView(s.frontier.current)]))},null,2));
}finally{await server.close();}
