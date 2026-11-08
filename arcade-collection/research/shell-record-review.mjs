import { chromium } from "/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
import { load, record, KEY } from "../site/profile.js";
const memory = new Map(),
  storage = {
    getItem: (k) => memory.get(k) || null,
    setItem: (k, v) => memory.set(k, v),
  };
record(storage, "voidhook", 800, true);
record(storage, "gatebreaker", 900, false);
assert.equal(load(storage, "voidhook").best, 800);
assert.equal(load(storage, "gatebreaker").best, 900);
record(storage, "voidhook", 100, false);
assert.equal(load(storage, "voidhook").best, 800);
assert.equal(load(storage, "gatebreaker").plays, 1);
memory.set(KEY + ":signal-diver", "{bad");
assert.equal(load(storage, "signal-diver").best, 0);
const b = await chromium.launch({
    headless: true,
    chromiumSandbox: true,
    executablePath:
      "/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",
    env: {
      ...process.env,
      CHROME_DEVEL_SANDBOX: "/opt/nvidia/dgx-oobe-desktop/chrome-sandbox",
    },
  }),
  checks = [],
  errors = [];
try {
  for (const denied of [false, true]) {
    const ctx = await b.newContext({ viewport: { width: 320, height: 568 } });
    if (denied)
      await ctx.addInitScript(() => {
        Object.defineProperty(window, "localStorage", {
          get() {
            throw new DOMException("Blocked", "SecurityError");
          },
        });
      });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.clock.install();
    await p.goto("http://127.0.0.1:5370/games/signal-diver/");
    await p.getByRole("button", { name: "PLAY", exact: true }).click();
    await p.locator("#sound").click();
    await p.clock.runFor(55000);
    let s = await p.evaluate(() => arcadeSnapshot());
    assert.equal(s.state, "lost");
    assert(s.awarded);
    assert.equal(s.recordSaved, !denied);
    await p.getByRole("heading", { name: "Run ended", exact: true }).waitFor();
    if (!denied) {
      let r = await p.evaluate(() =>
        JSON.parse(localStorage.getItem("frontier-arcade-v1:signal-diver")),
      );
      assert.equal(r.plays, 1);
      await p.clock.runFor(5000);
      r = await p.evaluate(() =>
        JSON.parse(localStorage.getItem("frontier-arcade-v1:signal-diver")),
      );
      assert.equal(r.plays, 1);
    } else await p.getByText("Record not saved", { exact: true }).waitFor();
    await p.getByRole("button", { name: "PLAY AGAIN", exact: true }).click();
    s = await p.evaluate(() => arcadeSnapshot());
    assert.equal(s.state, "playing");
    assert(!s.awarded);
    checks.push({
      deniedStorage: denied,
      terminalDisplayed: true,
      awardOnce: true,
      retry: true,
    });
    await ctx.close();
  }
} finally {
  await b.close();
  fs.writeFileSync(
    new URL("shell-record-review.json", import.meta.url),
    JSON.stringify(
      { checks, errors, crossGameIsolation: true, corruptRecordFallback: true },
      null,
      2,
    ),
  );
}
console.log(JSON.stringify({ checks, errors }));
