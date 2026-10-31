import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const here=new URL('./',import.meta.url),root=new URL('../../',here);
function read(path,name){const text=readFileSync(new URL('cradleos-dapp/src/'+path,root),'utf8'),match=text.match(new RegExp(`export const ${name}\\s*=\\s*["']([^"']+)`));if(!match)throw Error(`Missing canonical ${name}`);return match[1];}
const config={world:read('lib/cycle.ts','CURRENT_WORLD'),cycleStart:read('lib/cycle.ts','CYCLE_STARTED'),chainId:read('lib/headerStatus.ts','TESTNET_CHAIN_ID'),registry:read('constants.ts','OBJECT_REGISTRY_STILLNESS'),tenant:'stillness',cycle:7,graphql:'https://graphql.testnet.sui.io/graphql'};
writeFileSync(new URL('config.json',here),JSON.stringify(config,null,2)+'\n');mkdirSync(new URL('dist',here),{recursive:true});
execFileSync(new URL('cradleos-dapp/node_modules/.bin/esbuild',root).pathname,[new URL('server.mjs',here).pathname,'--bundle','--platform=node','--format=esm','--packages=bundle','--outfile='+new URL('dist/server.mjs',here).pathname],{stdio:'inherit'});
