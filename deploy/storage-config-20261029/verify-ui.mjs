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
f.reset=(secure=false)=>{f.key++;f.wallet=id(4);f.network='testnet';f.fail=false;f.hold=false;f.writes=[];f.pending=[];f.snapshot={id:id(1),type:SSU_TYPE,version:'7',ownerCapId:id(2),extension:secure?id(99)+'::storage_access::SharedAccess':null,frozen:false,online:true,readAt:Date.now(),slots:[{key:openStorageKey(id(1)),partition:'open',used:100,max:10000,items:[{typeId:42,quantity:10,volume:10,itemId:'7',partition:'open',partitionKey:openStorageKey(id(1))}]},{key:id(5),partition:'unknown',used:100,max:10000,items:[{typeId:43,quantity:10,volume:10,itemId:'8',partition:'unknown',partitionKey:id(5)}]}]};f.policy=secure?{id:id(6),ssuId:id(1),revision:'7',version:'88',rules:{mode:4,tribeIds:[],deny:[],allow:[]}}:null;f.owner=true;f.render();};
const root=createRoot(document.getElementById('root'));
f.render=()=>root.render(<SsuStorageCard key={f.key} inv={{ssu:{objectId:id(1),displayName:'Reap Shared storage',typeFull:SSU_TYPE,typeId:5555,isOnline:true},snapshot:f.snapshot,items:f.snapshot.slots.flatMap(s=>s.items),resolvedNames:new Map([[42,'Still Kernel'],[43,'Building Foam']]),operator:{name:'Tauriskus',key:id(3)},loading:false,policy:{policyId:null,mode:{kind:'none'}}}} characterId={f.wallet?id(3):null} walletAddress={f.wallet||undefined} ownerCaps={f.owner?new Map([[id(1),id(2)]]):new Map()} charOwnerCapId={id(5)} onRefresh={()=>{f.refreshed=true}} collapsed={false} onToggleCollapse={()=>{}}/>);
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
            `\nexport async function readInventoryCharacter(){return window.fixture.read({name:'Tauriskus',tribeId:100});}`,
          loader: "ts",
        }));
        b.onLoad({ filter: /cycleSigner\.ts$/ }, () => ({
          contents: `import {assertCycleCompatible} from './transactionCompatibility'; export class CurrentAccountSigner {constructor(kit){} async signAndExecuteTransaction({transaction}){assertCycleCompatible(transaction);window.fixture.writes.push(transaction.getData());return {digest:'SIMULATED-NOT-SUBMITTED'};}}`,
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
await new Promise((r) => server.listen(5343, "127.0.0.1", r));
const browser = await chromium.launch({
  headless: true,
  chromiumSandbox: true,
  executablePath: "/tmp/cradleos-sandboxed-chrome-20261021.sh",
});
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } }),
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
const reset = async (secure) => {
  await page.evaluate((v) => window.fixture.reset(v), secure);
  await page.locator("summary").filter({ hasText: "Manage access" }).click();
};
const configure = async () => {
  await page.getByRole("button", { name: "Tribes", exact: true }).click();
  await page.getByLabel("Tribe IDs", { exact: true }).fill("100, 200");
  await page
    .getByRole("button", { name: "Review configuration", exact: true })
    .click();
  await page.getByLabel("Review storage configuration").waitFor();
};
try {
  await page.goto("http://127.0.0.1:5343");
  await page.locator("summary").filter({ hasText: "Manage access" }).click();
  await configure();
  const review = page.getByLabel("Review storage configuration");
  assert.match(await review.innerText(), /Replaces the current extension/);
  assert.match(await review.innerText(), /including new arrivals/);
  assert.match(await review.innerText(), /Still Kernel × 10/);
  assert.equal(
    await page.getByRole("button", { name: "Sign & apply" }).isDisabled(),
    true,
  );
  assert.equal(await page.evaluate(() => window.fixture.writes.length), 0);
  await review.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Sign & apply" }).click();
  await page.waitForFunction(() => window.fixture.writes.length === 1);
  assert.deepEqual(
    await page.evaluate(() =>
      window.fixture.writes[0].commands.map((c) => c.MoveCall.function),
    ),
    [
      "borrow_owner_cap",
      "create_policy",
      "configure",
      "authorize",
      "share_policy",
      "return_owner_cap",
    ],
  );
  checks.push(
    "new policy explicit stock/replacement review + gated atomic PTB",
  );
  await reset(false);
  await configure();
  await page.evaluate(() => {
    window.fixture.snapshot = { ...window.fixture.snapshot, version: "8" };
  });
  await page
    .getByLabel("Review storage configuration")
    .getByRole("checkbox")
    .check();
  await page.getByRole("button", { name: "Sign & apply" }).click();
  await page.getByRole("alert").filter({ hasText: "changed" }).waitFor();
  assert.equal(await page.evaluate(() => window.fixture.writes.length), 0);
  checks.push("changed storage aborts before wallet");
  await reset(false);
  await configure();
  await page.evaluate(() => {
    window.fixture.wallet = "";
    window.fixture.render();
  });
  await page.waitForFunction(
    () => !document.body.innerText.includes("Sign & apply"),
  );
  assert.equal(await page.evaluate(() => window.fixture.writes.length), 0);
  checks.push("disconnect clears review");
  await reset(false);
  await page.getByRole("button", { name: "Public", exact: true }).click();
  await page.evaluate(() => (window.fixture.hold = true));
  await page
    .getByRole("button", { name: "Review configuration", exact: true })
    .click();
  await page.waitForFunction(() => window.fixture.pending.length >= 2);
  await page.evaluate(() => {
    const f = window.fixture;
    f.wallet = "0x" + "8".padStart(64, "0");
    f.render();
  });
  await page.waitForFunction(
    () => !document.body.innerText.includes("Checking…"),
  );
  await page.evaluate(() => {
    const f = window.fixture;
    f.wallet = "0x" + "4".padStart(64, "0");
    f.render();
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    window.fixture.hold = false;
    window.fixture.pending.forEach((r) => r());
  });
  await page.waitForTimeout(100);
  assert.equal(
    await page.getByLabel("Review storage configuration").count(),
    0,
  );
  checks.push("A→B→A rejects deferred old review");
  await reset(true);
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  let tr = page.getByLabel("Review storage transfer");
  await tr.waitFor();
  await tr.getByLabel("Quantity for 42").fill("3");
  await tr.getByRole("checkbox").check();
  await tr.getByRole("button", { name: "Sign transfer" }).click();
  await page.waitForFunction(() => window.fixture.writes.length === 1);
  assert.deepEqual(
    await page.evaluate(() =>
      window.fixture.writes[0].commands.map((c) => c.MoveCall.function),
    ),
    ["withdraw"],
  );
  checks.push("withdraw uses only bound shared→personal wrapper");
  await reset(true);
  await page
    .getByRole("button", { name: "Deposit all personal stock", exact: true })
    .click();
  tr = page.getByLabel("Review storage transfer");
  await tr.waitFor();
  await tr.getByRole("checkbox").check();
  await tr.getByRole("button", { name: "Sign transfer" }).click();
  await page.waitForFunction(() => window.fixture.writes.length === 1);
  assert.deepEqual(
    await page.evaluate(() =>
      window.fixture.writes[0].commands.map((c) => c.MoveCall.function),
    ),
    ["borrow_owner_cap", "deposit", "return_owner_cap"],
  );
  checks.push("deposit all limited to own personal stock");
  await reset(false);
  await page.getByRole("button", { name: "Pilots", exact: true }).click();
  await page.getByRole("button", { name: "Add pilot", exact: true }).click();
  await page.getByLabel("Pilot 1 character ID").fill(id(7));
  await page.getByLabel("Pilot 1 expiry").fill("2026-11-01T12:00");
  await page.getByLabel("Withdraw", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Review configuration", exact: true })
    .click();
  await page.getByLabel("Review storage configuration").waitFor();
  assert.match(
    await page.getByLabel("Review storage configuration").innerText(),
    /No withdraw/,
  );
  checks.push("pilot direction/expiry editor reviewed");
  for (const width of [650, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: dir + "ui-" + width + ".png",
      fullPage: true,
    });
  }
  checks.push("650/390/320px no horizontal overflow");
  await reset(false);
  await page.evaluate(() => {
    window.fixture.fail = true;
    window.fixture.snapshot = { ...window.fixture.snapshot, version: "9" };
    window.fixture.render();
  });
  await page
    .getByRole("alert")
    .filter({ hasText: "Access rules unavailable" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Review configuration", exact: true })
      .isDisabled(),
    true,
  );
  checks.push("failed policy read blocks configuration");
  assert.deepEqual(errors, []);
  writeFileSync(
    dir + "ui-browser.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        environment:
          "sandboxed Chromium; simulated reads and wallet; real UI/PTB/compatibility guard",
        checks,
        errors,
        realTransactions: 0,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ checks, errors, realTransactions: 0 }));
} catch (e) {
  writeFileSync(dir + "ui-failure.log", await page.locator("body").innerText());
  await page.screenshot({ path: dir + "ui-failure.png", fullPage: true });
  throw e;
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
