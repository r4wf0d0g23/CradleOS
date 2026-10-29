// Isolated browser fixture: real components/builders/signer guard, simulated
// supported reads and wallet. No extension, real signing or chain writes.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:http";
import assert from "node:assert/strict";
import { chromium } from "/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs";
const dir = new URL(".", import.meta.url).pathname,
  app = resolve(dir, "../../cradleos-dapp");
const require = createRequire(app + "/package.json"),
  { build } = require("esbuild");
const out = dir + "fixtures";
mkdirSync(out, { recursive: true });
const id = (n) => "0x" + n.toString(16).padStart(64, "0");
const entry = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {SsuStorageCard} from './src/components/SsuStorageCard';
import {WORLD_PKG} from './src/constants';
import {SSU_TYPE,openStorageKey} from './src/lib/ssuSafety';
const id=n=>'0x'+n.toString(16).padStart(64,'0');
const f=window.fixture={wallet:id(4),network:'testnet',writes:[],fail:false,hold:false,pending:[],key:0};
f.kit={stores:{$connection:{get:()=>({account:f.wallet?{address:f.wallet}:null})},$currentNetwork:{get:()=>f.network}}};
f.clone=v=>structuredClone(v);
f.read=async v=>{if(f.fail)throw Error('read unavailable');if(f.hold)await new Promise(r=>f.pending.push(r));return f.clone(v)};
f.reset=(secure=false)=>{f.key++;f.signHold=false;f.signPending=[];f.second=false;f.charCap=id(5);f.loading=false;f.error=undefined;f.tribeId=100;f.characterFail=false;f.wallet=id(4);f.network='testnet';f.fail=false;f.hold=false;f.writes=[];f.pending=[];f.snapshot={id:id(1),type:SSU_TYPE,version:'7',ownerCapId:id(2),extension:secure?id(99)+'::storage_access::SharedAccess':null,frozen:false,online:true,readAt:Date.now(),slots:[{key:openStorageKey(id(1)),partition:'open',used:100,max:10000,items:[{typeId:42,quantity:10,volume:10,itemId:'7',partition:'open',partitionKey:openStorageKey(id(1))}]},{key:id(5),partition:'unknown',used:100,max:10000,items:[{typeId:43,quantity:10,volume:10,itemId:'8',partition:'unknown',partitionKey:id(5)}]}]};f.policy=secure?{id:id(6),ssuId:id(1),revision:'7',version:'88',rules:{mode:4,tribeIds:[],deny:[],allow:[]}}:null;f.owner=true;f.render();};
const root=createRoot(document.getElementById('root'));
f.addOther=()=>{for(const [n,partition] of [[8,'unknown'],[2,'owner_main']])f.snapshot.slots.push({key:id(n),partition,used:100,max:10000,items:[{typeId:44+n,quantity:10,volume:10,itemId:String(n),partition,partitionKey:id(n)}]});f.render()};
const card=(second=false)=><SsuStorageCard key={f.key+(second?'second':'')} inv={{ssu:{objectId:second?id(11):id(1),displayName:second?'Other SSU':'Reap Shared storage',typeFull:SSU_TYPE,typeId:5555,isOnline:true},snapshot:second?{...f.snapshot,id:id(11)}:f.snapshot,items:f.snapshot.slots.flatMap(s=>s.items),resolvedNames:new Map([[42,'Still Kernel'],[43,'Building Foam']]),operator:{name:'Tauriskus',key:id(3)},loading:f.loading,error:f.error,policy:{policyId:null,mode:{kind:'none'}}}} characterId={f.wallet?id(3):null} walletAddress={f.wallet||undefined} ownerCaps={f.owner?new Map([[id(1),id(2)]]):new Map()} charOwnerCapId={f.charCap} onRefresh={()=>{f.refreshed=true}} collapsed={false} onToggleCollapse={()=>{}}/>;
f.render=()=>root.render(<>{card()}{f.second&&card(true)}</>);
f.reset();
`;
await build({
  stdin: { contents: entry, loader: "tsx", resolveDir: app },
  bundle: true,
  format: "iife",
  outdir: out,
  entryNames: "fixture",
  jsx: "automatic",
  define: {
    "process.env.NODE_ENV": '"development"',
    "import.meta.env.BASE_URL": '"/"',
  },
  plugins: [
    {
      name: "read-only-fixtures",
      setup(b) {
        b.onResolve({ filter: /^@mysten\/dapp-kit-react$/ }, () => ({
          path: "kit",
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: "export const useDAppKit=()=>window.fixture.kit;",
          loader: "js",
        }));
        b.onLoad({ filter: /storageAccessDeployment\.ts$/ }, () => ({
          contents: `import {WORLD_PKG} from '../constants'; export const STORAGE_ACCESS_DEPLOYMENT={packageId:'${id(99)}',originalId:'${id(99)}',registryId:'${id(98)}',worldId:WORLD_PKG};`,
          loader: "ts",
        }));
        b.onLoad({ filter: /ssuSafety\.ts$/ }, (args) => ({
          contents:
            readFileSync(args.path, "utf8").replace(
              "export async function fetchSsuSnapshot(",
              "async function originalFetchSsuSnapshot(",
            ) +
            `\nexport async function fetchSsuSnapshot(){const f=window.fixture; const v=await f.read(f.snapshot);v.readAt=Date.now();return v;}`,
          loader: "ts",
        }));
        b.onLoad({ filter: /storageAccess\.ts$/ }, (args) => ({
          contents:
            readFileSync(args.path, "utf8").replace(
              "export async function readStoragePolicy(",
              "async function originalReadStoragePolicy(",
            ) +
            `\nexport async function readStoragePolicy(){return window.fixture.read(window.fixture.policy);}`,
          loader: "ts",
        }));
        b.onLoad({ filter: /inventoryRead\.ts$/ }, (args) => ({
          contents:
            readFileSync(args.path, "utf8").replace(
              "export async function readInventoryCharacter(",
              "async function originalReadInventoryCharacter(",
            ) +
            `\nexport async function readInventoryCharacter(){const f=window.fixture;if(f.characterFail)throw Error('Character unavailable');return f.read({name:'Tauriskus',tribeId:f.tribeId});}`,
          loader: "ts",
        }));
        b.onLoad({ filter: /cycleSigner\.ts$/ }, () => ({
          contents: `import {assertCycleCompatible} from './transactionCompatibility'; export class CurrentAccountSigner {constructor(kit){} async signAndExecuteTransaction({transaction}){assertCycleCompatible(transaction);window.fixture.writes.push(transaction.getData());if(window.fixture.signHold)await new Promise(r=>window.fixture.signPending.push(r));return {digest:'SIMULATED-NOT-SUBMITTED'};}}`,
          loader: "ts",
        }));
      },
    },
  ],
});
const server = createServer((req, res) => {
  const file = req.url?.endsWith(".js")
    ? "fixture.js"
    : req.url?.endsWith(".css")
      ? "fixture.css"
      : null;
  if (file) {
    res.setHeader(
      "content-type",
      file.endsWith(".js") ? "text/javascript" : "text/css",
    );
    res.end(readFileSync(out + "/" + file));
  } else if (req.url === "/") {
    res.end(
      '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body style="background:#080909;color:#fafae5;margin:12px;font-family:Arial"><div id="root"></div><script src="/fixture.js"></script></body></html>',
    );
  } else {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(5346, "127.0.0.1", r));
const browser = await chromium.launch({
  headless: true,
  chromiumSandbox: true,
  executablePath: "/tmp/cradleos-sandboxed-chrome-20261021.sh",
});
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } }),
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
const reset = async (secure=true) => {
  await page.evaluate(v=>window.fixture.reset(v),secure);
  if(secure) await page.getByRole('button',{name:'Deposit',exact:true}).waitFor();
};
const review=()=>page.getByRole('region',{name:'Review storage transfer'});
const row=()=>page.locator('.ssu-stock-list li').filter({hasText:'Building Foam'}).first();
const shared=()=>page.getByRole('button',{name:/^Shared pool/}).first();
const personal=()=>page.getByRole('button',{name:/^Personal storage/}).first();
const writeCount=()=>page.evaluate(()=>window.fixture.writes.length);
const send=async()=>{await review().getByRole('checkbox').check();await review().getByRole('button',{name:'Sign transfer',exact:true}).click();await page.waitForFunction(()=>window.fixture.writes.length===1);};
const qty=async()=>page.evaluate(()=>{const tx=window.fixture.writes[0],call=tx.commands.find(c=>['deposit','withdraw','recover_shared'].includes(c.MoveCall?.function)).MoveCall;const arg=call.arguments[call.function==='recover_shared'?4:call.function==='deposit'?5:4];const pure=tx.inputs[arg.Input].Pure.bytes;const b=Uint8Array.from(atob(pure),c=>c.charCodeAt(0));return new DataView(b.buffer).getUint32(0,true);});
try {
 await page.goto('http://127.0.0.1:5346'); await reset();
 await page.getByRole('button',{name:'Grid',exact:true}).click();
 assert.equal(await page.locator('.ssu-stock-grid').count(),1);
 await page.reload(); await reset();
 assert.equal(await page.getByRole('button',{name:'Grid',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'List',exact:true}).click();
 assert.equal(await page.locator('.ssu-stock-grid').count(),0);
 checks.push('grid/list and reload persistence');
 await row().dragTo(shared()); await review().waitFor(); assert.equal(await writeCount(),0);
 assert.equal(await review().getByLabel('Quantity for 43').inputValue(),'10');
 assert.ok(await review().getByRole('button',{name:'Sign transfer',exact:true}).isDisabled());
 for(const invalid of ['','0','-1','11','1.5','1e1','9007199254740993']){
   await review().getByLabel('Quantity for 43').fill(invalid);
   assert.ok(await review().getByRole('button',{name:'Sign transfer',exact:true}).isDisabled());
   assert.equal(await review().getByLabel('Quantity for 43').getAttribute('aria-invalid'),'true');
 }
 await review().getByLabel('Quantity for 43').fill('3');
 await review().getByRole('checkbox').check(); await review().getByLabel('Quantity for 43').fill('4');
 assert.ok(!(await review().getByRole('checkbox').isChecked()));
 await review().getByRole('button',{name:'Max',exact:true}).click();assert.equal(await review().getByLabel('Quantity for 43').inputValue(),'10');
 await review().getByLabel('Quantity for 43').fill('3');await send();assert.equal(await qty(),3);
 checks.push('real mouse drag opens review only; exact deposit amount; invalid amounts blocked; consent resets; Max');
 await reset(); await page.getByRole('button',{name:'Grid',exact:true}).click();
 await page.locator('.ssu-stock-list li').filter({hasText:'Still Kernel'}).dragTo(personal());
 await review().getByLabel('Quantity for 42').fill('2');await send();assert.equal(await qty(),2);
 checks.push('grid shared-to-personal exact withdrawal');
 await reset(); await page.getByRole('button',{name:'Deposit',exact:true}).click();
 await review().getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await review().count(),0);assert.equal(await writeCount(),0);
 checks.push('button/touch alternative and cancel without writes');
 await reset();await page.evaluate(()=>window.fixture.addOther());
 for(const text of ['Another pilot', 'Owner storage']) assert.equal(await page.locator('.ssu-stock-list li').filter({hasText:text}).getAttribute('draggable'),'false');
 await row().dragTo(personal());assert.equal(await review().count(),0);assert.equal(await writeCount(),0);
 const external=await page.evaluateHandle(()=>{const d=new DataTransfer();d.setData('application/x-cradleos-storage','local-stack');return d});
 await shared().dispatchEvent('drop',{dataTransfer:external});assert.equal(await review().count(),0);
 await page.evaluate(()=>{window.fixture.second=true;window.fixture.render()});await page.locator('.ssu-card').nth(1).waitFor();
 await row().dragTo(page.locator('.ssu-card').nth(1).getByRole('button',{name:/^Shared pool/}));assert.equal(await review().count(),0);assert.equal(await writeCount(),0);
 await page.locator('.ssu-card').first().getByRole('button',{name:'List',exact:true}).click();assert.equal(await page.locator('.ssu-stock-grid').count(),0);
 checks.push('foreign/owner-main/same-target/external/cross-SSU drops rejected; preference synchronizes cards');
 await reset();
 const transfer=await page.evaluateHandle(()=>new DataTransfer());await row().dispatchEvent('dragstart',{dataTransfer:transfer});
 await page.evaluate(()=>{window.fixture.wallet='0x'+'a'.padStart(64,'0');window.fixture.render()});
 await shared().dispatchEvent('drop',{dataTransfer:transfer});assert.equal(await review().count(),0);assert.equal(await writeCount(),0);
 checks.push('stale wallet drag rejected');
 await reset();await page.getByRole('button',{name:'Deposit',exact:true}).click();await review().getByRole('checkbox').check();
 await page.evaluate(()=>window.fixture.snapshot.slots[1].items[0].quantity=8);
 await review().getByRole('button',{name:'Sign transfer',exact:true}).click();await page.getByText('Stock or rules changed. Review again.',{exact:true}).waitFor();assert.equal(await writeCount(),0);
 checks.push('stock changed after review aborts before wallet');
 await reset();await page.evaluate(()=>window.fixture.hold=true);await row().dragTo(shared());
 await page.waitForFunction(()=>window.fixture.pending.length>0);
 await page.evaluate(()=>{const f=window.fixture;f.wallet='';f.render()});
 await page.waitForTimeout(30);await page.evaluate(()=>{const f=window.fixture;f.hold=false;f.pending.forEach(r=>r())});
 assert.equal(await review().count(),0);assert.equal(await writeCount(),0);
 checks.push('wallet disconnect during preparation cancels');
 await reset();await page.getByRole('button',{name:'Deposit',exact:true}).click();await review().getByRole('checkbox').check();
 await page.evaluate(()=>window.fixture.network='mainnet');await review().getByRole('button',{name:'Sign transfer',exact:true}).click();
 await page.getByText('Wallet changed. Reopen storage.',{exact:true}).waitFor();assert.equal(await writeCount(),0);
 checks.push('network mismatch before signature blocked');
 await reset();await page.getByRole('button',{name:'Deposit',exact:true}).click();
 await page.evaluate(()=>window.fixture.signHold=true);await send();
 await page.evaluate(()=>{const f=window.fixture;f.snapshot={...f.snapshot,readAt:Date.now(),version:'99'};f.render()});
 await page.waitForTimeout(30);assert.ok(await page.getByRole('button',{name:'Deposit',exact:true}).isDisabled());assert.equal(await writeCount(),1);
 await page.evaluate(()=>{const f=window.fixture;f.signHold=false;f.signPending.forEach(r=>r())});
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Deposit'&&!b.disabled));
 assert.equal(await review().count(),0);assert.equal(await writeCount(),1);
 checks.push('refresh cannot open second wallet request while signature pending; stale completion ignored');

 await reset();await page.evaluate(()=>{const f=window.fixture;f.owner=false;f.policy.rules.mode=0;f.snapshot={...f.snapshot,version:'8'};f.render()});
 await page.waitForTimeout(50);assert.equal(await page.getByRole('button',{name:'Deposit',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Withdraw',exact:true}).count(),0);
 await reset(false);assert.equal(await page.getByRole('button',{name:'Deposit',exact:true}).count(),0);
 checks.push('closed nonowner and default extension retain gates');
 await reset();await page.evaluate(()=>{const f=window.fixture;f.policy.rules.mode=0;f.snapshot={...f.snapshot,version:'8'};f.render()});
 await page.getByRole('button',{name:'Recover',exact:true}).click();await review().getByLabel('Quantity for 42').fill('1');await send();assert.equal(await qty(),1);
 checks.push('owner-only recovery preserved');
 await reset();await page.evaluate(()=>{window.fixture.charCap=null;window.fixture.render()});await page.getByText('Personal access unavailable · Refresh',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Deposit',exact:true}).count(),0);
 await page.evaluate(()=>{window.fixture.charCap='0x'+'5'.padStart(64,'0');window.fixture.render()});await page.getByRole('button',{name:'Deposit',exact:true}).waitFor();
 checks.push('missing character capability is visible and recovers');
 // Simulate localStorage blocked for writes while reads still work.
 await page.evaluate(()=>Storage.prototype.setItem=()=>{throw Error('quota')});
 await page.getByRole('button',{name:'Grid',exact:true}).click();assert.equal(await page.locator('.ssu-stock-grid').count(),1);
 await page.getByRole('button',{name:'List',exact:true}).click();assert.equal(await page.locator('.ssu-stock-grid').count(),0);
 checks.push('cosmetic preference works when writes blocked');
 await reset();
 for(const width of [1440,650,390,320]){
  await page.setViewportSize({width,height:950});
  for(const view of ['List','Grid']){
   await page.getByRole('button',{name:view,exact:true}).click();
   assert.ok(await page.locator('.ssu-card').evaluate(e=>e.scrollWidth<=e.clientWidth+1),`${view} overflow at ${width}`);
   await page.screenshot({path:dir+`fixture-${view.toLowerCase()}-${width}.png`});
  }
 }
 await page.getByRole('button',{name:'Deposit',exact:true}).click();
 await page.screenshot({path:dir+'fixture-amount-320.png'});
 assert.ok(await review().evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 checks.push('list/grid/amount review responsive at 1440/650/390/320');
 assert.deepEqual(errors,[]);
 const receipt={at:new Date().toISOString(),environment:'sandboxed Chromium; simulated reads/wallet; real components/PTB builders; no submitted transactions',checks,errors};
 writeFileSync(dir+'ui-browser.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
} catch(e){writeFileSync(dir+'ui-failure.txt',await page.locator('body').innerText().catch(()=>''));await page.screenshot({path:dir+'ui-failure.png'}).catch(()=>{});throw e;}
finally{await browser.close();await new Promise(r=>server.close(r));}
