import { chromium } from "/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs";
import fs from "node:fs";
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
  for (const id of ids) {
    const p = await b.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    p.on("pageerror", (e) => errors.push({ id, error: e.message }));
    await p.goto("http://127.0.0.1:5370/games/" + id + "/");
    await p.getByRole("button", { name: "PLAY", exact: true }).click();
    const movePoint = async (x, y) => {
      const r = await p.locator("canvas").boundingBox(),
        scale = Math.min(r.width / 720, r.height / 720);
      return {
        x: r.x + (r.width - 720 * scale) / 2 + x * scale,
        y: r.y + (r.height - 720 * scale) / 2 + y * scale,
      };
    };
    if (id === "gatebreaker") await p.keyboard.press(" ");
    if (id === "wreck-runner") {
      await p.keyboard.down("ArrowRight");
      await p.keyboard.down(" ");
    }
    if (id === "feral-circuit") await p.keyboard.down("ArrowRight");
    if (id === "voidhook") {
      const q = await movePoint(150, 200);
      await p.mouse.move(q.x, q.y);
      await p.mouse.down();
    }
    if (id === "salvage-swarm") await p.keyboard.down("ArrowLeft");
    if (id === "dockyard-panic") {
      await p.waitForTimeout(100);
      const s = await p.evaluate(() => arcadeSnapshot()),
        q = s.ships[0];
      await p.keyboard.press(String(q.slot + 1));
      await p.keyboard.press(["q", "w", "e"][q.needs[0]]);
    }
    if (id === "scrapline-defense") {
      await p.getByRole("button", { name: "CUTTER · 60", exact: true }).tap();
      const q = await movePoint(360, 225);
      await p.mouse.click(q.x, q.y);
      await p.getByRole("button", { name: "CUTTER · 60", exact: true }).tap();
      await p.getByRole("button", { name: "START WAVE", exact: true }).tap();
    }
    await p.waitForTimeout(2800);
    await p.screenshot({
      path: new URL("play-" + id + ".png", import.meta.url).pathname,
    });
    const s = await p.evaluate(() => arcadeSnapshot());
    checks.push({
      id,
      time: s.time,
      state: s.state,
      errors: errors.filter((e) => e.id === id),
    });
    await p.close();
  }
} finally {
  await b.close();
  fs.writeFileSync(
    new URL("shell-visual-review.json", import.meta.url),
    JSON.stringify({ checks, errors }, null, 2),
  );
}
console.log(JSON.stringify({ checks, errors }));
