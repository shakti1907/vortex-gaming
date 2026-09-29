/* jsdom smoke test: boot the real index.html with the real scripts and verify
   the symptom elements resolve (grid, empty-state, footer API, leaderboard,
   fps/hw readouts, auth labels). Usage: node scripts/dom-smoke.js [--offline|--online|--nodb] */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { JSDOM } = require("jsdom");

const ROOT = path.join(process.cwd(), "public");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const MODE = process.argv.includes("--real") ? "real" : process.argv.includes("--online") ? "online" : process.argv.includes("--nodb") ? "nodb" : "offline";

const dom = new JSDOM(html, { url: "http://localhost:3000/index.html", pretendToBeVisual: true, runScripts: "outside-only" });
const { window } = dom;

// ---- shims -------------------------------------------------------------
window.performance = window.performance || { now: () => Date.now() };
window.requestAnimationFrame = (cb) => setTimeout(() => cb(window.performance.now()), 16);
window.cancelAnimationFrame = (id) => clearTimeout(id);
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {} }));
window.scrollTo = () => {};
window.AudioContext = undefined;
const blocked = process.argv.includes("--blocked");
const store = {};
Object.defineProperty(window, "localStorage", { value: blocked ? {
  getItem() { throw new DOMException("The operation is insecure.", "SecurityError"); },
  setItem() { throw new DOMException("The operation is insecure.", "SecurityError"); },
  removeItem() { throw new DOMException("The operation is insecure.", "SecurityError"); },
} : {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
}, configurable: true });

// fetch mock: MODE decides /api/health + /api/leaderboard behaviour
window.AbortController = globalThis.AbortController;
window.fetch = (url, opts) => {
  const u = String(url);
  if (MODE === "real") return fetch(new URL(u, "http://localhost:3000").href, opts);
  if (MODE === "offline") return Promise.reject(new TypeError("network down"));
  if (MODE === "nodb") {
    // server up, database down: health 500s, leaderboard 500s
    return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ ok: false, db: "down", error: "Could not load leaderboard." }) });
  }
  if (u.includes("/api/health")) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, db: "up", service: "vortex-gaming" }) });
  if (u.includes("/api/leaderboard"))
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, source: "validated-telemetry", scope: "global", game: { key: "neon-snake", title: "Neon Snake" }, entries: [{ rank: 1, username: "ace", score: 900, xpEarned: 10, createdAt: new Date().toISOString() }] }) });
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
};

// eval the real scripts in the same order as index.html
const SCRIPTS = [
  "js/device-scanner.js", "js/db.js", "js/vortex-engine.js", "js/vortex-fx.js",
  "js/neon-snake.js", "js/games-action.js", "js/games-puzzle.js", "js/games-retro.js",
  "js/games-racing.js", "js/vortex-gamification.js", "js/vortex-interactions.js",
];
const errors = [];
for (const rel of SCRIPTS) {
  try {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), dom.getInternalVMContext(), { filename: rel });
  } catch (e) {
    errors.push(rel + ": " + e.message);
  }
}
if (errors.length) console.log("SCRIPT LOAD ERRORS:\n  " + errors.join("\n  "));

const $ = (id) => window.document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await sleep(1400); // let preloader timers, ping, leaderboard settle
  const tiles = window.document.querySelectorAll(".game-card-tile").length;
  console.log("MODE=" + MODE);
  console.log("grid tiles: " + tiles + " (want 16)");
  console.log("empty-state hidden: " + ($("empty-state") ? $("empty-state").classList.contains("hidden") : "MISSING") + " (want true)");
  console.log("footer-api: " + JSON.stringify($("footer-api") && $("footer-api").textContent));
  console.log("lb-status: " + JSON.stringify($("lb-status") && $("lb-status").textContent));
  console.log("lb rows: " + window.document.querySelectorAll("#lb-body tr").length);
  console.log("fps-readout: " + JSON.stringify($("fps-readout") && $("fps-readout").textContent));
  console.log("stat-fps: " + JSON.stringify($("stat-fps") && $("stat-fps").textContent));
  console.log("perf-readout: " + JSON.stringify($("perf-readout") && $("perf-readout").textContent));
  console.log("stat-perf: " + JSON.stringify($("stat-perf") && $("stat-perf").textContent));
  console.log("footer-hw: " + JSON.stringify($("footer-hw") && $("footer-hw").textContent));
  console.log("footer-render: " + JSON.stringify($("footer-render") && $("footer-render").textContent));
  const loginPh = $("login-email") && $("login-email").getAttribute("placeholder");
  console.log("login placeholder: " + JSON.stringify(loginPh));
  const tabs = [...window.document.querySelectorAll(".auth-tab")].map((t) => t.textContent.trim());
  console.log("auth tabs: " + JSON.stringify(tabs));
  const hints = [...window.document.querySelectorAll(".auth-hint")].map((h) => h.textContent.trim());
  console.log("auth hints: " + JSON.stringify(hints));
  // game modal banner?
  console.log("gm-title: " + JSON.stringify($("gm-title") && $("gm-title").textContent));
  // thumbnails mounted on every card?
  const thumbs = window.document.querySelectorAll("img.card-thumb").length;
  const thumbKeys = [...window.document.querySelectorAll("img.card-thumb")].map((i) => i.getAttribute("data-thumb-key"));
  console.log("card thumbs: " + thumbs + " (want 16) unique=" + new Set(thumbKeys).size);
  // launch a game and check the banner + game-active lock
  try {
    window.VortexLaunch && window.VortexLaunch("cyber-invaders");
    await sleep(120);
    const gm = $("game-modal");
    console.log("gm banner: " + JSON.stringify(gm && gm.style.getPropertyValue("--gm-img")));
    console.log("game-active class: " + window.document.body.classList.contains("game-active") + " (want true)");
  } catch (e) {
    console.log("launch test FAILED: " + e.message);
  }
  // empty-state rules: hidden initially, visible only for zero-result ACTIVE queries
  const empty = $("empty-state");
  const input = $("search-input");
  const visibleTiles = () => [...window.document.querySelectorAll(".game-card-tile")].filter((t) => !t.classList.contains("hidden")).length;
  console.log("-- search empty-state rules --");
  console.log("initial: empty-hidden=" + empty.classList.contains("hidden") + " visible=" + visibleTiles());
  input.value = "zzzz-no-such-game";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  console.log("no-match query: empty-hidden=" + empty.classList.contains("hidden") + " visible=" + visibleTiles() + " (want hidden=false)");
  input.value = "snake";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  console.log("match query: empty-hidden=" + empty.classList.contains("hidden") + " visible=" + visibleTiles() + " (want hidden=true)");
  input.value = "";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  console.log("cleared: empty-hidden=" + empty.classList.contains("hidden") + " visible=" + visibleTiles());
  process.exit(0);
})();
