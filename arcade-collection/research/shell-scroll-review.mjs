import { chromium } from "/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs";
import fs from "node:fs";
const b = await chromium.launch({
  headless: true,
  chromiumSandbox: true,
  executablePath:
    "/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",
  env: {
    ...process.env,
    CHROME_DEVEL_SANDBOX: "/opt/nvidia/dgx-oobe-desktop/chrome-sandbox",
  },
});
let result;
try {
  const c = await b.newContext({
      viewport: { width: 568, height: 320 },
      hasTouch: true,
    }),
    p = await c.newPage();
  await p.goto("http://127.0.0.1:5370/games/scrapline-defense/");
  await p.getByRole("button", { name: "PLAY", exact: true }).tap();
  const before = await p.evaluate(() => arcadeSnapshot());
  const r = await p
      .getByRole("button", { name: "POWER", exact: true })
      .boundingBox(),
    x = r.x + r.width / 2,
    y = r.y + r.height / 2;
  const cdp = await c.newCDPSession(p);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 1, x, y }],
  });
  for (let k = 1; k <= 8; k++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ id: 1, x, y: y - k * 14 }],
    });
    await p.waitForTimeout(20);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [{ id: 1, x, y: y - 112 }],
  });
  await p.waitForTimeout(100);
  const after = await p.evaluate(() => arcadeSnapshot()),
    scroll = await p.locator(".control-rail").evaluate((e) => e.scrollTop),
    start = await p
      .getByRole("button", { name: "START WAVE", exact: true })
      .evaluate((e) => {
        const r = e.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          bottom: r.bottom,
          hit: e.contains(
            document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
          ),
        };
      });
  await p.getByRole("button", { name: "START WAVE", exact: true }).tap();
  const wave = (await p.evaluate(() => arcadeSnapshot())).wave;
  result = {
    beforeCash: before.cash,
    afterCash: after.cash,
    generator: after.generator,
    scroll,
    start,
    actualStartWave: wave,
  };
  await p.screenshot({
    path: new URL("shell-scroll-landscape.png", import.meta.url).pathname,
  });
} finally {
  await b.close();
  fs.writeFileSync(
    new URL("shell-scroll-review.json", import.meta.url),
    JSON.stringify(result, null, 2),
  );
}
console.log(JSON.stringify(result));
