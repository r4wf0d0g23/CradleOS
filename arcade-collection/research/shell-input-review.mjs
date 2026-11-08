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
  }),
  checks = [],
  errors = [];
try {
  for (const id of ["wreck-runner", "feral-circuit"]) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://127.0.0.1:5370/games/" + id + "/");
    await p.getByRole("button", { name: "PLAY", exact: true }).click();
    await p.locator("[data-action=primary]").focus();
    const before = await p.evaluate(() => arcadeSnapshot());
    await p.keyboard.down(" ");
    await p.waitForTimeout(350);
    await p.keyboard.up(" ");
    const button = await p.evaluate(() => arcadeSnapshot());
    await p.locator("canvas").focus();
    await p.keyboard.down(" ");
    await p.waitForTimeout(350);
    await p.keyboard.up(" ");
    const canvas = await p.evaluate(() => arcadeSnapshot());
    checks.push({
      id,
      before: { ammo: before.ammo, heat: before.heat },
      focusedButton: {
        ammo: button.ammo,
        heat: button.heat,
        action: button.input.action,
      },
      focusedCanvas: { ammo: canvas.ammo, heat: canvas.heat },
    });
    const t = canvas.time;
    await p.setViewportSize({ width: 844, height: 390 });
    await p.waitForTimeout(100);
    const rotate = await p.evaluate(() => arcadeSnapshot());
    await p.waitForTimeout(200);
    checks.push({
      id,
      rotatePaused: rotate.paused,
      timeFrozen:
        (await p.evaluate(() => arcadeSnapshot())).time === rotate.time,
      ammoRetained: rotate.ammo === canvas.ammo,
    });
    await p.close();
  }
} finally {
  await b.close();
  fs.writeFileSync(
    new URL("shell-input-review.json", import.meta.url),
    JSON.stringify({ checks, errors }, null, 2),
  );
}
console.log(JSON.stringify({ checks, errors }));
