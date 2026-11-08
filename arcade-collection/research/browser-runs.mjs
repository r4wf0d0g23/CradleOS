import { chromium } from "/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { catalog } from "../site/catalog.js";
import { pilot } from "./pilots.mjs";
const base = process.env.BASE || "http://127.0.0.1:5370",
  tag = process.env.TAG || "browser-runs",
  only = process.env.ONLY?.split(","),
  results = [];
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
try {
  for (const g of catalog.filter((g) => !only || only.includes(g.id))) {
    const mod = await import(`../site/games/${g.id}.js`),
      ct = await browser.newContext({ viewport: { width: 1000, height: 900 } }),
      p = await ct.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`${base}/games/${g.id}/`);
    await p.getByRole("button", { name: "PLAY", exact: true }).waitFor();
    await p.clock.install();
    await p.clock.pauseAt(new Date(Date.now() + 100));
    await p.getByRole("button", { name: "PLAY", exact: true }).click();
    await p.clock.runFor(20);
    const coord = async (x, y) => {
      const r = await p.locator("#arena").boundingBox(),
        k = Math.min(r.width, r.height) / 720;
      return {
        x: r.x + (r.width - 720 * k) / 2 + x * k,
        y: r.y + (r.height - 720 * k) / 2 + y * k,
      };
    };
    const press = async (key) => {
      const button = p.locator(`[data-action="${key}"]`);
      if (await button.count()) await button.click();
      else if (key.startsWith("ship:")) await p.keyboard.press(key.slice(5));
      else if (key.startsWith("upgrade:"))
        await p
          .getByRole("button", {
            name: key.endsWith("chain")
              ? "Arc relay"
              : key.endsWith("cutter")
                ? "Cutter array"
                : "Orbit drones",
            exact: false,
          })
          .click();
    };
    let model = {},
      held = new Set(),
      mouse = false,
      lastTime = 0,
      frames = 0;
    for (; frames < 12000; frames++) {
      const snap = await p.evaluate(() => arcadeSnapshot());
      Object.assign(model, snap);
      if (["won", "lost"].includes(model.state)) break;
      assert(!model.paused, `${g.id} unexpected pause`);
      const actions = [];
      const adapter = {
        ...mod,
        action: (s, key) => {
          actions.push({ key });
          mod.action(s, key);
        },
        update: (s, dt, i) => {
          if (i.tap) actions.push({ tap: i.tap });
          mod.update(s, dt, i);
        },
      };
      const input = pilot(g.id, adapter, model);
      if(actions.length && mouse){await p.mouse.up();mouse=false;}
      for (const a of actions) {
        if (a.tap) {
          const q = await coord(a.tap.x, a.tap.y);
          await p.mouse.click(q.x, q.y);
        } else await press(a.key);
      }
      const keys = new Set(
        Object.entries({
          left: "ArrowLeft",
          right: "ArrowRight",
          up: "ArrowUp",
          down: "ArrowDown",
          action: "Space",
          brake: "ArrowDown",
        })
          .filter(([k]) => input[k])
          .map(([, v]) => v),
      );
      for (const key of held) if (!keys.has(key)) await p.keyboard.up(key);
      for (const key of keys)
        if (!held.has(key)) {
          await p.locator("#arena").focus();
          await p.keyboard.down(key);
        }
      held = keys;
      if (input.dragging && input.pointer) {
        const q = await coord(input.pointer.x, input.pointer.y);
        await p.mouse.move(q.x, q.y);
        if (!mouse) {
          await p.mouse.down();
          mouse = true;
        }
      } else if (mouse) {
        await p.mouse.up();
        mouse = false;
      }
      // Signal needs a near-note sampling interval; physics pilots use100ms human-scale input updates.
      let advance = g.id === 'gatebreaker' ? 50 : 100;
      if (g.id === "signal-diver") {
        const next = model.notes.find((n) => !n.done);
        advance = next
          ? Math.max(8, Math.min(150, (next.at - model.time) * 1000))
          : 100;
      }
      await p.clock.runFor(advance);
      if (frames === 60)
        await p.screenshot({
          path: new URL(`${tag}-${g.id}-play.png`, import.meta.url).pathname,
        });
      if (model.time > lastTime + 60) {
        lastTime = model.time;
        console.log(
          g.id,
          "time",
          Math.floor(model.time),
          "state",
          model.state,
          "score",
          model.score,
        );
      }
    }
    for (const key of held) await p.keyboard.up(key);
    if (mouse) await p.mouse.up();
    const s = await p.evaluate(() => arcadeSnapshot());
    await p.screenshot({
      path: new URL(`${tag}-${g.id}-result.png`, import.meta.url).pathname,
    });
    const r = {
      id: g.id,
      state: s.state,
      time: s.time,
      score: s.score,
      hp: s.hp,
      frames,
      errors,
    };
    results.push(r);
    console.log(JSON.stringify(r));
    assert.equal(s.state, "won", JSON.stringify(r));
    assert(s.awarded);
    const profile = await p.evaluate(
      (id) => JSON.parse(localStorage.getItem("frontier-arcade-v1:" + id)),
      g.id,
    );
    assert.equal(profile.wins, 1);
    await p.clock.runFor(1500);
    assert.equal(
      await p.evaluate(
        (id) =>
          JSON.parse(localStorage.getItem("frontier-arcade-v1:" + id)).wins,
        g.id,
      ),
      1,
    );
    await p.getByRole("button", { name: "PLAY AGAIN", exact: true }).click();
    await p.clock.runFor(50);
    assert.equal((await p.evaluate(() => arcadeSnapshot())).state, "playing");
    await p.reload();
    await p.getByRole("button", { name: "PLAY", exact: true }).waitFor();
    assert((await p.locator(".record").textContent()).includes("1 WINS"));
    assert.deepEqual(errors, []);
    await ct.close();
  }
} finally {
  writeFileSync(
    new URL(tag + ".json", import.meta.url),
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}
