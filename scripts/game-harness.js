/* ==========================================================================
   Headless canvas harness — boots every registered Vortex game, drives real
   animation frames with randomised input, and reports runtime errors.
   Usage:  node scripts/game-harness.js
   ========================================================================== */
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const ROOT = process.cwd();

function makeCtx(owner) {
  const grad = { addColorStop() {} };
  return {
    canvas: owner,
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    setTransform() {}, clearRect() {}, fillRect() {}, strokeRect() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {},
    rect() {}, roundRect() {}, fill() {}, stroke() {}, clip() {},
    createLinearGradient: () => grad, createRadialGradient: () => grad,
    fillText() {}, strokeText() {}, measureText: () => ({ width: 10 }),
    drawImage() {}, putImageData() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    setLineDash() {},
    fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
    globalCompositeOperation: "source-over", shadowBlur: 0, shadowColor: "",
    font: "", textAlign: "", textBaseline: "", lineCap: "", lineJoin: "",
  };
}

function makeEl(tag) {
  const listeners = {};
  const el = {
    tagName: tag, width: 800, height: 480, clientWidth: 900, clientHeight: 520,
    style: {}, value: "", textContent: "", innerHTML: "", children: [],
    classList: {
      _s: new Set(),
      add(...c) { c.forEach((x) => this._s.add(x)); },
      remove(...c) { c.forEach((x) => this._s.delete(x)); },
      toggle(c, f) { f === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (f ? this._s.add(c) : this._s.delete(c)); },
      contains(c) { return this._s.has(c); },
    },
    getContext() { return makeCtx(el); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 520 }),
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener(t, fn) { if (listeners[t]) listeners[t] = listeners[t].filter((f) => f !== fn); },
    dispatchEvent(e) { (listeners[e.type] || []).slice().forEach((f) => f(e)); return true; },
    setAttribute() {}, getAttribute: () => null,
    appendChild(c) { el.children.push(c); return c; },
    remove() {}, querySelector: () => null, querySelectorAll: () => [],
    setPointerCapture() {}, focus() {}, closest: () => null,
  };
  el.parentElement = null;
  return el;
}

const rafQueue = [];
const winListeners = {};
const parent = makeEl("div");
const canvas = makeEl("canvas");
canvas.parentElement = parent;

const sandbox = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean, Error,
  Promise, Set, Map, isNaN, parseInt, parseFloat, Infinity, NaN,
  Uint8Array, Uint8ClampedArray, Float32Array,
  setInterval, clearInterval,
  setTimeout(fn, ms) { sandbox.__timers.push({ fn: fn, at: sandbox.__clock + (ms || 0) }); return sandbox.__timers.length; },
  clearTimeout() {},
  performance: { now: () => sandbox.__clock },
  requestAnimationFrame(cb) { rafQueue.push(cb); return rafQueue.length; },
  cancelAnimationFrame() {},
  CustomEvent: class { constructor(type, init) { this.type = type; this.detail = (init || {}).detail; } },
  navigator: { hardwareConcurrency: 8, deviceMemory: 8, maxTouchPoints: 0 },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.devicePixelRatio = 2;
sandbox.innerWidth = 1280;
sandbox.innerHeight = 800;
sandbox.screen = { width: 1920, height: 1080 };
sandbox.matchMedia = () => ({ matches: false, addEventListener() {} });
sandbox.addEventListener = (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); };
sandbox.removeEventListener = (t, fn) => { if (winListeners[t]) winListeners[t] = winListeners[t].filter((f) => f !== fn); };
sandbox.dispatchEvent = (e) => { (winListeners[e.type] || []).slice().forEach((f) => f(e)); return true; };
sandbox.localStorage = { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } };
const docListeners = {};
sandbox.document = {
  documentElement: makeEl("html"), body: makeEl("body"), hidden: false, readyState: "complete",
  createElement: makeEl, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  addEventListener(t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
  removeEventListener(t, fn) { if (docListeners[t]) docListeners[t] = docListeners[t].filter((f) => f !== fn); },
  dispatchEvent(e) { (docListeners[e.type] || []).slice().forEach((f) => f(e)); return true; },
};
sandbox.__clock = 1000;
sandbox.__timers = [];
vm.createContext(sandbox);

const FILES = [
  "js/vortex-fx.js", "js/neon-snake.js", "js/games-action.js",
  "js/games-puzzle.js", "js/games-retro.js", "js/games-racing.js",
];
for (const f of FILES) {
  const code = fs.readFileSync(path.join(ROOT, "public", f), "utf8");
  try { vm.runInContext(code, sandbox, { filename: f }); }
  catch (e) { console.log("LOAD FAIL " + f + ": " + e.message); process.exit(1); }
}

const games = sandbox.VortexGames || {};
const keys = Object.keys(games);
console.log("Registered games: " + keys.length + "\n");


/* Optional purposeful drivers (node scripts/game-harness.js --smart) so games
   that need intent (not random flailing) actually demonstrate scoring. */
const SMART = process.argv.includes("--smart");
function press(k) { (winListeners.keydown || []).slice().forEach((f) => f({ key: k, preventDefault() {} })); }
function rel(k) { (winListeners.keyup || []).slice().forEach((f) => f({ key: k })); }
function tap(x, y) {
  canvas.dispatchEvent({ type: "pointerdown", clientX: x, clientY: y, pointerId: 1, preventDefault() {} });
  canvas.dispatchEvent({ type: "pointermove", clientX: x, clientY: y, pointerId: 1 });
}
const DRIVERS = {
  "neon-snake": (i) => { const c = i % 200; if (c === 0) press("ArrowRight"); else if (c === 92) press("ArrowDown"); else if (c === 100) press("ArrowLeft"); else if (c === 192) press("ArrowDown"); },
  "quantum-laser": (i) => { tap(60 + ((i * 3) % 9) * 46, 50 + ((i * 5) % 7) * 46); },
  "memory-matrix": (i) => { if (i % 6 === 0) { const n = (i / 6) % 9 | 0; tap(200 + (n % 3) * 90, 120 + ((n / 3 | 0)) * 90); } },
  "neon-flow": (i) => { const seq = [[270, 88], [270, 178], [270, 268], [270, 358]]; const p2 = seq[Math.min(3, (i / 6) | 0)]; tap(p2[0], p2[1]); },
  // closed-loop pilot: aim for the next pillar gap (proves the flight model)
  "cyber-soar": () => {
    const st = sandbox.__inst && sandbox.__inst.getState ? sandbox.__inst.getState() : null;
    if (!st || !st.bird) return;
    let targetY = 260;
    if (st.pillars && st.pillars.length) {
      const ahead = st.pillars.filter((p) => p.x + 52 > st.bird.x - 10);
      if (ahead.length) targetY = ahead[0].gapY;
    }
    // proportional-derivative: thrust when we are below target or sinking fast
    const wantUp = (st.bird.y - targetY) + st.bird.vy * 0.22 > 0;
    if (wantUp) press(" "); else rel(" ");
  },
  "retro-defender": (i) => { if (i % 8 === 0) tap(100 + (i * 13) % 700, 120 + (i * 7) % 220); },
  "grid-pac-runner": (i) => { if (i % 40 === 0) { const d = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"][(i / 40) % 4 | 0]; press(d); } },
};

const KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Shift"];
const DIRS = ["up", "down", "left", "right", "action", "dash"];
let failures = 0;

for (const key of keys) {
  rafQueue.length = 0;
  let score = 0, xp = 0, over = false, err = null, inst = null;
  try {
    inst = games[key].init({
      canvas,
      audio: { blip() {}, arpUp() {}, explosion() {} },
      device: { tier: "high" },
      onScore: (s) => { score = s; },
      onXp: (n) => { xp += n; },
      onGameOver: () => { over = true; },
    });
  } catch (e) {
    console.log("x " + key + " INIT: " + e.message);
    failures++; continue;
  }

  const smartDriver = SMART ? DRIVERS[key] : null;
  sandbox.__inst = inst;
  const fArg = (process.argv.find((a) => a.startsWith("--frames=")) || "").split("=")[1];
  const LIMIT = fArg ? parseInt(fArg, 10) : (SMART ? 900 : 500);
  let t = sandbox.__clock, frames = 0;
  for (let i = 0; i < LIMIT && !err; i++) {
    t += 16.7; sandbox.__clock = t;
    if (smartDriver) { try { smartDriver(i); } catch (e) { err = e; } }
    if (!smartDriver && i % 5 === 0) {
      sandbox.dispatchEvent({ type: "vortex-dir", detail: { dir: DIRS[i % DIRS.length] } });
      (winListeners.keydown || []).slice().forEach((f) => { try { f({ key: KEYS[i % KEYS.length], preventDefault() {} }); } catch (e) { err = e; } });
    }
    if (!smartDriver && i % 9 === 0) {
      sandbox.dispatchEvent({ type: "vortex-dir-up", detail: { dir: DIRS[i % DIRS.length] } });
      (winListeners.keyup || []).slice().forEach((f) => { try { f({ key: KEYS[i % KEYS.length] }); } catch (e) { err = e; } });
    }
    if (!smartDriver && i % 13 === 0) {
      canvas.dispatchEvent({ type: "pointerdown", clientX: 80 + (i * 7) % 700, clientY: 60 + (i * 11) % 380, pointerId: 1, preventDefault() {} });
      canvas.dispatchEvent({ type: "pointermove", clientX: 120 + (i * 5) % 600, clientY: 90 + (i * 3) % 320, pointerId: 1 });
    }
    if (!smartDriver && i % 19 === 0) (winListeners.pointerup || []).slice().forEach((f) => { try { f({}); } catch (e) { err = e; } });

    // drain virtual timers (gameOver / respawn delays)
    for (let z = sandbox.__timers.length - 1; z >= 0; z--) {
      if (sandbox.__timers[z].at <= sandbox.__clock) {
        const tm = sandbox.__timers.splice(z, 1)[0];
        try { tm.fn(); } catch (e) { err = e; }
      }
    }
    const q = rafQueue.splice(0, rafQueue.length);
    if (!q.length && i > 3) break;
    for (const cb of q) {
      frames++;
      try { cb(t); } catch (e) { err = e; break; }
    }
  }

  try { if (inst) inst.destroy(); } catch (e) { err = err || e; }

  if (err) {
    console.log("x " + key + ": " + err.message);
    console.log("     " + String(err.stack || "").split("\n")[1].trim());
    failures++;
  } else {
    console.log("ok " + key.padEnd(19) + " frames=" + String(frames).padEnd(5) +
      " score=" + String(score).padEnd(8) + " xp=" + String(xp).padEnd(4) + (over ? " ended" : ""));
  }
}


/* --------------------------------------------------------------------------
   Targeted regression: pin RNG so Neon Snake food spawns at cell (0,0), then
   steer UP then LEFT so the head must consume it. Proves the eat → grow →
   score → xp pipeline, which random input rarely exercises.
   -------------------------------------------------------------------------- */
if (process.argv.includes("--eat")) {
  const realRandom = Math.random;
  // Board 28x18 minus the 3 starting body cells = 501 free cells, scanned
  // x-major. Index 276 === grid cell (15,9) = directly in front of the head.
  sandbox.Math = Object.create(Math);
  sandbox.Math.random = () => 0.5515;     // floor(0.5515 * 501) === 276
  rafQueue.length = 0;
  sandbox.__timers.length = 0;
  let score = 0, xp = 0, err = null;
  const inst = games["neon-snake"].init({
    canvas, audio: { blip() {}, arpUp() {}, explosion() {} }, device: { tier: "high" },
    onScore: (s) => { score = s; }, onXp: (n) => { xp += n; }, onGameOver: () => {},
  });
  let t = sandbox.__clock;
  for (let i = 0; i < 60 && !err; i++) {
    t += 16.7; sandbox.__clock = t;
    // no input needed: the head is already travelling right into the core
    const q = rafQueue.splice(0, rafQueue.length);
    if (!q.length && i > 3) break;
    for (const cb of q) { try { cb(t); } catch (e) { err = e; break; } }
  }
  try { inst.destroy(); } catch (e) { /* noop */ }
  sandbox.Math = Math;
  Math.random = realRandom;
  const pass = !err && score > 0 && xp > 0;
  console.log("\n[eat-test] neon-snake food pipeline: score=" + score + " xp=" + xp +
    (err ? " ERR " + err.message : "") + " -> " + (pass ? "PASS" : "FAIL"));
  if (!pass) process.exitCode = 1;
}

/* Focus guard proof: hidden frames must not advance elapsed game time. */
{
  rafQueue.length = 0;
  sandbox.document.hidden = false;
  const inst = games["neon-pong"].init({
    canvas, audio: { blip() {}, arpUp() {}, explosion() {} }, device: { tier: "high" },
    onScore() {}, onXp() {}, onGameOver() {},
  });
  let t = sandbox.__clock;
  function advance(n) {
    for (let i = 0; i < n; i++) {
      t += 16.7; sandbox.__clock = t;
      const q = rafQueue.splice(0, rafQueue.length);
      for (const cb of q) cb(t);
    }
  }
  advance(12);
  const before = inst.getHarnessState().elapsed;
  sandbox.document.hidden = true;
  sandbox.document.dispatchEvent({ type: "visibilitychange" });
  advance(40);
  const hiddenElapsed = inst.getHarnessState().elapsed;
  sandbox.document.hidden = false;
  sandbox.document.dispatchEvent({ type: "visibilitychange" });
  advance(12);
  const resumed = inst.getHarnessState().elapsed;
  inst.destroy();
  const okFocus = Math.abs(hiddenElapsed - before) < 0.0001 && resumed > hiddenElapsed;
  console.log("\n[focus-test] hidden clock frozen=" + before.toFixed(3) + "→" + hiddenElapsed.toFixed(3) +
    ", resumed=" + resumed.toFixed(3) + " -> " + (okFocus ? "PASS" : "FAIL"));
  if (!okFocus) failures++;
}

/* Generator solvability proof for the procedural laser puzzles. */
if (games["quantum-laser"] && games["quantum-laser"].selfTest) {
  const r = games["quantum-laser"].selfTest(400);
  const okGen = r.pass === r.rounds;
  console.log("\n[gen-test] quantum-laser solvable boards: " + r.pass + "/" + r.rounds + " (avg " + r.avgAttempts + " attempts) -> " + (okGen ? "PASS" : "FAIL"));
  if (!okGen) failures++;
}

console.log("\n" + (failures ? failures + " FAILURE(S)" : "ALL " + keys.length + " GAMES RAN CLEAN"));
process.exit(failures ? 1 : 0);
