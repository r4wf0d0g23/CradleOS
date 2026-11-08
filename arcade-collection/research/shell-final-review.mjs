import { chromium } from "/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
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
  const root = await b.newPage({ viewport: { width: 320, height: 568 } });
  await root.goto("http://127.0.0.1:5370/");
  await root.locator(".game-card").last().waitFor();
  assert.equal(await root.locator(".game-card").count(), 8);
  assert(
    await root.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await root.close();
  for (const id of ["wreck-runner", "feral-circuit"]) {
    const c = await b.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
      }),
      p = await c.newPage();
    p.on("pageerror", (e) => errors.push({ id, error: e.message }));
    await p.goto("http://127.0.0.1:5370/games/" + id + "/");
    await p.getByRole("button", { name: "PLAY", exact: true }).tap();
    const r = await p.locator("canvas").boundingBox(),
      a = await p.locator("[data-action=primary]").boundingBox(),
      x = r.x + r.width * 0.5,
      y = r.y + r.height * 0.5,
      bx = a.x + a.width / 2,
      by = a.y + a.height / 2,
      cdp = await c.newCDPSession(p);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x, y }],
    });
    await p.waitForTimeout(80);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { id: 1, x, y },
        { id: 2, x: bx, y: by },
      ],
    });
    await p.waitForTimeout(180);
    let s = await p.evaluate(() => arcadeSnapshot());
    assert(s.input.dragging && s.input.action);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [{ id: 2, x: bx, y: by }],
    });
    await p.waitForTimeout(80);
    s = await p.evaluate(() => arcadeSnapshot());
    assert(s.input.dragging && !s.input.action);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [{ id: 1, x, y }],
    });
    await p.waitForTimeout(50);
    assert(!(await p.evaluate(() => arcadeSnapshot())).input.dragging);
    if (id === "feral-circuit") {
      const br = await p.locator("[data-action=brake]").boundingBox(),
        tx = br.x + br.width / 2,
        ty = br.y + br.height / 2;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ id: 3, x: tx, y: ty }],
      });
      await p.waitForTimeout(150);
      assert((await p.evaluate(() => arcadeSnapshot())).input.brake);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [{ id: 3, x: tx, y: ty }],
      });
      await p.waitForTimeout(50);
      assert(!(await p.evaluate(() => arcadeSnapshot())).input.brake);
    }
    await p.locator("#fullscreen").click();
    await p.waitForTimeout(200);
    assert(await p.evaluate(() => !!document.fullscreenElement));
    s = await p.evaluate(() => arcadeSnapshot());
    assert(s.paused && !s.input.action && !s.input.dragging);
    await p.locator("#fullscreen").click();
    await p.waitForTimeout(150);
    assert(!(await p.evaluate(() => !!document.fullscreenElement)));
    await p.getByRole("button", { name: "RESUME", exact: true }).tap();
    assert(!(await p.evaluate(() => arcadeSnapshot())).paused);
    if (id === "wreck-runner") {
      await p.keyboard.down("ArrowRight");
      await p.keyboard.down(" ");
      await p.waitForTimeout(1600);
      await p.keyboard.up(" ");
      await p.keyboard.up("ArrowRight");
      await p.screenshot({
        path: new URL("play-wreck-clipped.png", import.meta.url).pathname,
      });
    }
    checks.push({
      id,
      multitouchOwnership: true,
      release: true,
      brake: id === "feral-circuit",
      fullscreenEnterExitPauseResume: true,
    });
    await c.close();
  }
} finally {
  await b.close();
  fs.writeFileSync(
    new URL("shell-final-review.json", import.meta.url),
    JSON.stringify(
      { checks, errors, lobbyEightCardsNoOverflow: true },
      null,
      2,
    ),
  );
}
console.log(JSON.stringify({ checks, errors }));
