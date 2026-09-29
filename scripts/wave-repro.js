/* Targeted repro: drive cyber-invaders through wave transitions + bomb damage. */
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
    removeEventListener(t, fn) { listeners[t] = (listeners[t] || []).filter((f) => f !== fn); },
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
  setTimeout(fn, ms) { sandbox.__timers.push({ fn, at: sandbox.__clock + (ms || 0) }); return sandbox.__timers.length; },
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

for (const f of ["js/vortex-fx.js", "js/games-action.js"]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, "public", f), "utf8"), sandbox, { filename: f });
}
const game = sandbox.VortexGames["cyber-invaders"];
let score = 0, over = false, err = null;
const inst = game.init({
  canvas,
  audio: { blip() {}, arpUp() {}, explosion() {} },
  device: { tier: "high" },
  onScore: (s) => { score = s; },
  onXp: () => {},
  onGameOver: () => { over = true; },
});

function frames(n) {
  for (let i = 0; i < n && !err; i++) {
    sandbox.__clock += 16.7;
    const q = rafQueue.splice(0, rafQueue.length);
    if (!q.length) { console.log("RAF QUEUE EMPTY (loop died) at step " + i); return false; }
    for (const cb of q) {
      try { cb(sandbox.__clock); } catch (e) { err = e; return false; }
    }
    for (let z = sandbox.__timers.length - 1; z >= 0; z--) {
      if (sandbox.__timers[z].at <= sandbox.__clock) {
        const tm = sandbox.__timers.splice(z, 1)[0];
        try { tm.fn(); } catch (e) { err = e; return false; }
      }
    }
  }
  return !err;
}

const st = inst.getState();
console.log("wave=" + st.wave + " invaders=" + st.invaders.length + " boss=" + !!st.boss);

// --- Scenario A: clear wave 1, observe transition to wave 2 ---
st.invaders.forEach((iv) => { iv.alive = false; });
if (!frames(3)) {
  console.log("FAIL A: " + err.message + "\n" + err.stack.split("\n").slice(0, 3).join("\n"));
} else {
  console.log("A ok: wave=" + st.wave + " invaders=" + st.invaders.length + " alive=" + st.invaders.filter((x) => x.alive).length);
}

// --- Scenario B: clear wave 2 -> wave 3 (boss) ---
st.invaders.forEach((iv) => { iv.alive = false; });
if (!frames(3)) {
  console.log("FAIL B: " + err.message + "\n" + err.stack.split("\n").slice(0, 3).join("\n"));
} else {
  console.log("B ok: wave=" + st.wave + " invaders=" + st.invaders.length + " boss=" + !!st.boss);
}

// --- Scenario C: kill boss -> wave 4 ---
if (st.boss) {
  st.boss.hp = 1;
  st.bullets.push({ x: st.boss.x, y: st.boss.y, vx: 0, vy: -600 });
}
if (!frames(3)) {
  console.log("FAIL C: " + err.message + "\n" + err.stack.split("\n").slice(0, 3).join("\n"));
} else {
  console.log("C ok: wave=" + st.wave + " invaders=" + st.invaders.length + " boss=" + !!st.boss);
}

// --- Scenario D: bomb hits ship while more bombs in flight (damage clears array).
// Bombs are iterated from the END, so the hitting bomb must be the LAST pushed
// while older bombs still sit at lower indices when damage() zeroes the array.
st.bombs.push({ x: st.ship.x - 40, y: st.ship.y - 160, vx: 0, vy: 200 });
st.bombs.push({ x: st.ship.x + 40, y: st.ship.y - 120, vx: 0, vy: 200 });
st.bombs.push({ x: st.ship.x, y: st.ship.y, vx: 0, vy: 200 });
if (!frames(3)) {
  console.log("FAIL D: " + err.message + "\n" + err.stack.split("\n").slice(0, 3).join("\n"));
} else {
  console.log("D ok: lives=" + st.lives + " bombs=" + st.bombs.length);
}

console.log(err ? "\nRESULT: REPRODUCED ERROR" : "\nRESULT: no crash in scenarios");
try { inst.destroy(); } catch (e) {}

/* ---- Scenario E: full progressive wave sweep 1 -> 6 (boss waves at 3 & 6) ---- */
try { inst.destroy(); } catch (e) {}
rafQueue.length = 0; sandbox.__timers.length = 0; err = null; over = false;
const inst2 = game.init({
  canvas,
  audio: { blip() {}, arpUp() {}, explosion() {} },
  device: { tier: "high" },
  onScore() {}, onXp() {}, onGameOver: () => { over = true; },
});
function frames2(n) {
  for (let i = 0; i < n && !err; i++) {
    sandbox.__clock += 16.7;
    const q = rafQueue.splice(0, rafQueue.length);
    if (!q.length) return false;
    for (const cb of q) { try { cb(sandbox.__clock); } catch (e) { err = e; return false; } }
    for (let z = sandbox.__timers.length - 1; z >= 0; z--) {
      if (sandbox.__timers[z].at <= sandbox.__clock) {
        const tm = sandbox.__timers.splice(z, 1)[0];
        try { tm.fn(); } catch (e) { err = e; return false; }
      }
    }
  }
  return !err;
}
const st2 = inst2.getState();
const log = [];
for (let w = 1; w <= 7 && !err; w++) {
  st2.lives = 9;
  log.push("wave=" + st2.wave + " invaders=" + st2.invaders.length + " boss=" + !!st2.boss + " bombs=" + st2.bombs.length);
  if (st2.boss) {
    // shoot the boss down; put the bullet at the boss with 1hp
    st2.boss.hp = 1;
    st2.bullets.push({ x: st2.boss.x, y: st2.boss.y, vx: 0, vy: -600 });
    frames2(4);
  } else {
    st2.invaders.forEach((iv) => { iv.alive = false; });
    frames2(4);
    // interleave an enemy volley right through the transition (regression guard)
    if (!err) {
      st2.lives = 9;   // keep the sweep alive through repeated test volleys
      st2.bombs.push({ x: st2.ship.x - 40, y: st2.ship.y - 160, vx: 0, vy: 200 });
      st2.bombs.push({ x: st2.ship.x, y: st2.ship.y, vx: 0, vy: 200 });
      frames2(4);
    }
  }
}
log.push("final wave=" + st2.wave + " invaders=" + st2.invaders.length + " boss=" + !!st2.boss);
console.log(err ? "FAIL E: " + err.message + "\n" + err.stack.split("\n").slice(0, 3).join("\n") : "E ok");
console.log(log.join("\n"));
try { inst2.destroy(); } catch (e) {}
console.log(err ? "\nRESULT: STILL BROKEN" : "\nRESULT: all scenarios clean");
