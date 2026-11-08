import { catalog } from "./catalog.js";
import { loadArt } from "./core.js";
import { load, record, sound } from "./profile.js";
const gameId = document.body.dataset.game;
let storage;
try {
  storage = window.localStorage;
} catch {
  storage = {
    getItem() {
      return null;
    },
    setItem() {
      throw Error("unavailable");
    },
  };
}
if (!gameId) {
  const grid = document.querySelector(".collection");
  for (const g of catalog) {
    const a = document.createElement("article");
    a.className = "game-card";
    a.style.setProperty("--accent", g.color);
    a.innerHTML = `<div class="cover"><img src="assets/${g.image}" alt="" width="120" height="120"></div><div class="card-body"><span class="tag">${g.tag}</span><h2>${g.title}</h2><p>${g.hook}</p><a href="games/${g.id}/">Play <span aria-hidden="true">↗</span></a></div>`;
    grid.append(a);
  }
} else {
  const meta = catalog.find((g) => g.id === gameId);
  if (!meta) throw Error("Unknown game");
  document.documentElement.style.setProperty("--accent", meta.color);
  const mod = await import(`./games/${gameId}.js`);
  await loadArt();
  const canvas = document.querySelector("#arena"),
    ctx = canvas.getContext("2d"),
    overlay = document.querySelector(".overlay"),
    panel = document.querySelector(".panel"),
    rail = document.querySelector(".control-rail"),
    hud = document.querySelector("#hud"),
    toast = document.querySelector("#toast");
  let state = null,
    paused = false,
    awarded = false,
    recordSaved = true,
    acc = 0,
    previous = performance.now(),
    soundOn = sound(storage),
    audio = null,
    transform = { scale: 1, x: 0, y: 0 },
    primaryPointer = null;
  const input = {
    left: false,
    right: false,
    up: false,
    down: false,
    brake: false,
    action: false,
    pressed: false,
    dragging: false,
    pointer: null,
    tap: null,
  };
  const clear = () => {
    for (const k of [
      "left",
      "right",
      "up",
      "down",
      "brake",
      "action",
      "pressed",
      "dragging",
    ])
      input[k] = false;
    input.tap = null;
    primaryPointer = null;
  };
  function audioReady() {
    if (!soundOn) return;
    try {
      audio ??= new AudioContext();
      if (audio.state === "suspended") audio.resume().catch(() => {});
    } catch {}
  }
  function beep(type) {
    if (!soundOn || !audio || audio.state !== "running") return;
    const f =
      {
        tap: 600,
        hit: 150,
        upgrade: 950,
        win: 1100,
        lose: 90,
        launch: 380,
        beat: 210,
      }[type] || 400;
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = type === "hit" ? "sawtooth" : "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(type === "beat" ? 0.025 : 0.045, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.1);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.12);
  }
  function start() {
    audioReady();
    state = mod.create(crypto.getRandomValues(new Uint32Array(1))[0] || 12345);
    paused = false;
    awarded = false;
    recordSaved = true;
    acc = 0;
    previous = performance.now();
    clear();
    overlay.hidden = true;
    toast.textContent = "";
    updateControls();
    canvas.focus();
  }
  function show(title, body, buttons) {
    overlay.hidden = false;
    panel.innerHTML = `<span class="tag">${meta.tag}</span><h2>${title}</h2>${body}<div class="buttons"></div>`;
    const row = panel.querySelector(".buttons");
    for (const b of buttons) {
      const e = document.createElement(b.href ? "a" : "button");
      e.textContent = b.label;
      if (b.href) e.href = b.href;
      else {
        e.type = "button";
        e.onclick = b.fn;
      }
      if (b.primary) e.classList.add("primary");
      row.append(e);
    }
  }
  function launchScreen() {
    const r = load(storage, gameId);
    show(
      meta.title,
      `<p class="rule">${meta.rule}</p><p class="controls">${meta.controls}</p><div class="record">BEST ${r.best.toLocaleString()} · ${r.wins} WINS</div>`,
      [
        { label: "PLAY", fn: start, primary: true },
        { label: "ARCADE", href: "../../" },
      ],
    );
  }
  function pause() {
    if (!state || paused || ["won", "lost"].includes(state.state)) return;
    paused = true;
    acc = 0;
    clear();
    show(
      "Paused",
      `<p class="controls">${meta.controls}</p><div class="record">SCORE ${Math.floor(state.score)} · ${mod.hud(state).goal}</div>`,
      [
        {
          label: "RESUME",
          primary: true,
          fn: () => {
            audioReady();
            paused = false;
            acc = 0;
            previous = performance.now();
            overlay.hidden = true;
            clear();
            if (state.state === "choice") showChoices();
            canvas.focus();
          },
        },
        { label: "RETRY", fn: start },
        { label: "ARCADE", href: "../../" },
      ],
    );
  }
  function terminal() {
    if (awarded) return;
    awarded = true;
    clear();
    const r = record(storage, gameId, state.score, state.state === "won");
    recordSaved = r.saved;
    show(
      state.state === "won" ? "Run complete" : "Run ended",
      `<div class="record">SCORE ${Math.floor(state.score).toLocaleString()} · BEST ${r.record.best.toLocaleString()}</div>${!recordSaved ? '<div class="sound-status">Record not saved</div>' : ""}`,
      [
        { label: "PLAY AGAIN", fn: start, primary: true },
        { label: "ARCADE", href: "../../" },
      ],
    );
  }
  function showChoices() {
    clear();
    overlay.hidden = false;
    panel.innerHTML =
      '<span class="tag">SALVAGE RECOVERED</span><h2>Choose upgrade</h2><div class="choice-list"></div>';
    for (const choice of mod.choices(state)) {
      const b = document.createElement("button");
      b.innerHTML = `${choice.label}<small>${choice.detail}</small>`;
      b.onclick = () => {
        mod.action(state, choice.id);
        overlay.hidden = true;
        clear();
        previous = performance.now();
        acc = 0;
        canvas.focus();
      };
      panel.querySelector(".choice-list").append(b);
    }
  }
  function updateControls() {
    rail.innerHTML = "";
    const buttons = mod.controls
      ? mod.controls(state)
      : meta.action
        ? [{ id: "primary", label: meta.action }]
        : [];
    for (const b of buttons) {
      const el = document.createElement("button");
      el.type = "button";
      el.textContent = b.label;
      el.dataset.action = b.id;
      if (b.tone) el.classList.add(b.tone);
      const heldKey =
        b.id === "primary" ? "action" : b.id === "brake" ? "brake" : null;
      const press = () => {
        if (!state || paused || state.state !== "playing") return;
        audioReady();
        if (heldKey) {
          if (!input[heldKey] && b.id === "primary") input.pressed = true;
          input[heldKey] = true;
        } else mod.action(state, b.id);
      };
      const release = () => {
        if (heldKey) input[heldKey] = false;
      };
      el.onpointerdown = (e) => {
        if (!heldKey) return;
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        press();
      };
      el.onpointerup = release;
      el.onpointercancel = release;
      el.onlostpointercapture = release;
      el.onblur = release;
      el.onkeydown = (e) => {
        if (heldKey && (e.code === "Space" || e.code === "Enter")) {
          e.preventDefault();
          e.stopPropagation();
          if (!e.repeat) press();
        }
      };
      el.onkeyup = (e) => {
        if (heldKey && (e.code === "Space" || e.code === "Enter")) {
          e.preventDefault();
          e.stopPropagation();
          release();
        }
      };
      el.onclick = (e) => {
        if (!state || paused || state.state !== "playing") return;
        if (!heldKey) {
          audioReady();
          mod.action(state, b.id);
        } else if (e.detail === 0) {
          press();
          setTimeout(release, 160);
        }
      };
      rail.append(el);
    }
  }
  function resize() {
    const rect = canvas.getBoundingClientRect(),
      dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const scale = Math.min(rect.width / 720, rect.height / 720);
    transform = {
      scale,
      x: (rect.width - 720 * scale) / 2,
      y: (rect.height - 720 * scale) / 2,
      dpr,
    };
    if (state) pause();
  }
  function point(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - transform.x) / transform.scale,
      y: (e.clientY - r.top - transform.y) / transform.scale,
    };
  }
  canvas.onpointerdown = (e) => {
    if (
      !state ||
      paused ||
      state.state !== "playing" ||
      primaryPointer !== null
    )
      return;
    const p = point(e);
    if (p.x < 0 || p.x > 720 || p.y < 0 || p.y > 720) return;
    primaryPointer = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    input.pointer = p;
    input.dragging = true;
    input.tap = p;
    audioReady();
  };
  canvas.onpointermove = (e) => {
    if (e.pointerId === primaryPointer) input.pointer = point(e);
  };
  const release = (e) => {
    if (e.pointerId === primaryPointer) {
      input.dragging = false;
      primaryPointer = null;
    }
  };
  canvas.onpointerup = release;
  canvas.onpointercancel = release;
  canvas.onlostpointercapture = release;
  window.addEventListener("keydown", (e) => {
    if (e.target.closest("button,a") && ["Enter", " "].includes(e.key)) return;
    if (e.key === "Escape" || e.key.toLowerCase() === "p") {
      e.preventDefault();
      if (!e.repeat) pause();
      return;
    }
    if (!state || paused || state.state !== "playing") return;
    const key = e.key.toLowerCase();
    if (
      [
        "arrowleft",
        "arrowright",
        "arrowup",
        "arrowdown",
        " ",
        "a",
        "s",
        "d",
        "w",
        "1",
        "2",
        "3",
        "q",
        "e",
      ].includes(key)
    )
      e.preventDefault();
    audioReady();
    if (gameId === "signal-diver" && ["a", "s", "d"].includes(key)) {
      if (!e.repeat) mod.action(state, "lane:" + ["a", "s", "d"].indexOf(key));
      return;
    }
    if (gameId === "dockyard-panic") {
      if (!e.repeat && ["1", "2", "3"].includes(key))
        mod.action(state, "ship:" + Number(key));
      if (!e.repeat && ["q", "w", "e"].includes(key))
        mod.action(state, "bay:" + ["q", "w", "e"].indexOf(key));
      return;
    }
    if (
      gameId === "scrapline-defense" &&
      !e.repeat &&
      ["1", "2", "3"].includes(key)
    )
      mod.action(
        state,
        "build:" + ["cutter", "arc", "tractor"][Number(key) - 1],
      );
    const map = {
      arrowleft: "left",
      a: "left",
      arrowright: "right",
      d: "right",
      arrowup: "up",
      w: "up",
      arrowdown: "down",
      s: "down",
      " ": "action",
    };
    if (map[key]) input[map[key]] = true;
    if (key === " " && !e.repeat) input.pressed = true;
  });
  window.addEventListener("keyup", (e) => {
    const map = {
      arrowleft: "left",
      a: "left",
      arrowright: "right",
      d: "right",
      arrowup: "up",
      w: "up",
      arrowdown: "down",
      s: "down",
      " ": "action",
    };
    if (map[e.key.toLowerCase()]) input[map[e.key.toLowerCase()]] = false;
  });
  window.addEventListener("blur", pause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  window.addEventListener("resize", resize);
  document.addEventListener("fullscreenchange", () => {
    resize();
    document.querySelector("#fullscreen").textContent =
      document.fullscreenElement ? "EXIT FULL" : "FULLSCREEN";
  });
  document.querySelector("#pause").onclick = pause;
  document.querySelector("#sound").textContent = soundOn
    ? "SOUND ON"
    : "SOUND OFF";
  document.querySelector("#sound").onclick = (e) => {
    soundOn = !soundOn;
    sound(storage, soundOn);
    e.currentTarget.textContent = soundOn ? "SOUND ON" : "SOUND OFF";
    audioReady();
  };
  document.querySelector("#fullscreen").onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast.textContent = "Fullscreen unavailable";
    }
  };
  function frame(now) {
    const delta = Math.min(0.1, Math.max(0, (now - previous) / 1000));
    previous = now;
    if (state && !paused && state.state === "playing") {
      acc += delta;
      let n = 0;
      while (acc >= 1 / 60 && n++ < 6) {
        mod.update(state, 1 / 60, input);
        acc -= 1 / 60;
        input.pressed = false;
        input.tap = null;
        if (state.state !== "playing") break;
      }
      for (const event of state.events.splice(0)) beep(event);
      if (state.state === "choice") showChoices();
      if (["won", "lost"].includes(state.state)) terminal();
    }
    ctx.setTransform(transform.dpr, 0, 0, transform.dpr, 0, 0);
    ctx.clearRect(
      0,
      0,
      canvas.width / transform.dpr,
      canvas.height / transform.dpr,
    );
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);
    if (state) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, 720, 720);
      ctx.clip();
      mod.render(ctx, state);
      ctx.restore();
      const h = mod.hud(state);
      hud.innerHTML = `<div><b>${h.goal}</b>${h.detail || ""}</div><div class="right"><b>${Math.floor(state.score).toLocaleString()}</b>${h.health || ""}</div>`;
      const primary = rail.querySelector("[data-action=primary]");
      if (primary && h.action) primary.textContent = h.action;
      if (state.notice && !paused && !["won", "lost"].includes(state.state))
        toast.textContent = state.notice;
      else if (!toast.textContent.includes("Fullscreen"))
        toast.textContent = "";
    }
    requestAnimationFrame(frame);
  }
  resize();
  launchScreen();
  updateControls();
  requestAnimationFrame(frame);
  // Read-only serialized diagnostics for browser verification; no mutation surface.
  Object.defineProperty(window, "arcadeSnapshot", {
    value: () =>
      state
        ? JSON.parse(
            JSON.stringify({
              ...state,
              paused,
              awarded,
              recordSaved,
              input: { ...input },
              events: [],
            }),
          )
        : null,
    writable: false,
  });
}
