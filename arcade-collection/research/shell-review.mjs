import { chromium } from "/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs";
import fs from "node:fs";
const root = new URL(".", import.meta.url),
  base = "http://127.0.0.1:5370";
const ids = [
  "voidhook",
  "gatebreaker",
  "signal-diver",
  "wreck-runner",
  "feral-circuit",
  "dockyard-panic",
  "salvage-swarm",
  "scrapline-defense",
];
const browser = await chromium.launch({
  headless: true,
  chromiumSandbox: true,
  executablePath:
    "/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",
  env: {
    ...process.env,
    CHROME_DEVEL_SANDBOX: "/opt/nvidia/dgx-oobe-desktop/chrome-sandbox",
  },
});
const results = [],
  errors = [];
try {
  const sizes = process.env.REVIEW_SIZES
    ? JSON.parse(process.env.REVIEW_SIZES)
    : [
        [320, 568],
        [568, 320],
      ];
  for (const [width, height] of sizes) {
    const ctx = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
    });
    for (const id of ids) {
      const p = await ctx.newPage();
      p.on("pageerror", (e) => errors.push({ id, width, error: e.message }));
      await p.goto(`${base}/games/${id}/`);
      await p.getByRole("button", { name: "PLAY", exact: true }).waitFor();
      const before = await p.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        width: innerWidth,
        actions: [...document.querySelectorAll(".panel .buttons>*")].map(
          (e) => {
            const r = e.getBoundingClientRect();
            return {
              text: e.textContent,
              x: r.x,
              y: r.y,
              right: r.right,
              bottom: r.bottom,
              hit: e.contains(
                document.elementFromPoint(
                  r.x + r.width / 2,
                  r.y + r.height / 2,
                ),
              ),
            };
          },
        ),
      }));
      await p.getByRole("button", { name: "PLAY", exact: true }).tap();
      await p.waitForTimeout(180);
      const controls = await p
        .locator(".control-rail button")
        .evaluateAll((es) =>
          es.map((e) => {
            const r = e.getBoundingClientRect();
            return {
              text: e.textContent,
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              right: r.right,
              bottom: r.bottom,
              hit: e.contains(
                document.elementFromPoint(
                  r.x + r.width / 2,
                  r.y + r.height / 2,
                ),
              ),
            };
          }),
        );
      const snapshot = await p.evaluate(() => arcadeSnapshot());
      const size = await p.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        width: innerWidth,
        canvas: document
          .querySelector("canvas")
          .getBoundingClientRect()
          .toJSON(),
      }));
      await p.screenshot({
        path: new URL(`shell-${id}-${width}.png`, root).pathname,
      });
      await p.locator("#pause").tap();
      const paused = await p.evaluate(() => arcadeSnapshot());
      await p.waitForTimeout(200);
      const stable =
        (await p.evaluate(() => arcadeSnapshot())).time === paused.time;
      await p.getByRole("button", { name: "RESUME", exact: true }).tap();
      await p.waitForTimeout(100);
      const resumed = await p.evaluate(() => arcadeSnapshot());
      results.push({
        id,
        width,
        height,
        before,
        controls,
        size,
        started: snapshot?.state === "playing",
        pauseStable: stable,
        resumed: !resumed.paused,
      });
      await p.close();
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(
    new URL((process.env.REVIEW_TAG || "shell-review") + ".json", root),
    JSON.stringify({ at: new Date().toISOString(), results, errors }, null, 2),
  );
}
console.log(
  JSON.stringify({
    cases: results.length,
    errors,
    overflow: results
      .filter((r) => r.size.scroll > r.width)
      .map((r) => [r.id, r.width, r.size.scroll]),
    hiddenControls: results.flatMap((r) =>
      r.controls
        .filter((b) => !b.hit || b.right > r.width || b.bottom > r.height)
        .map((b) => ({ id: r.id, width: r.width, ...b })),
    ),
  }),
);
