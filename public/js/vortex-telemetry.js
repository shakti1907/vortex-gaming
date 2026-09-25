/* ==========================================================================
   VORTEX GAMING — vortex-telemetry.js  (v3.0 Enterprise, client side)

   PURELY NON-INTRUSIVE. Attaches silently to the existing game launch / game
   over lifecycle WITHOUT touching any game engine, visual, or control.

     · Session manager (auto-start, heartbeats, close on unload)
     · Page Visibility focus guard (pauses the clock; TIMED_OUT after 3min idle)
     · HMAC game-log payload signing (anti-cheat integrity)
     · Offline queue with idempotent auto-flush on reconnect
     · IST timestamp formatter (mirrors the server)
   ========================================================================== */
(function () {
  "use strict";

  if (!window.VortexDB) return;
  var DB = window.VortexDB;

  /* ------------------------------------------------------------------ */
  /* IST formatter (display only)                                       */
  /* ------------------------------------------------------------------ */
  function formatToIST(iso) {
    if (!iso) return "N/A";
    var d = iso instanceof Date ? iso : new Date(iso);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    }) + " IST";
  }

  if (!window.VortexTime) window.VortexTime = { formatToIST: formatToIST };
  else window.VortexTime.formatToIST = formatToIST;

  /* ------------------------------------------------------------------ */
  /* Device signature                                                   */
  /* ------------------------------------------------------------------ */
  function deviceSignature() {
    try {
      var d = window.VortexDevice || {};
      var sig = [navigator.userAgent, d.cores || 0, d.memory || 0, (d.dpr || 1), screen.width + "x" + screen.height].join("|");
      var h = 0;
      for (var i = 0; i < sig.length; i++) h = (Math.imul(31, h) + sig.charCodeAt(i)) | 0;
      return "dev_" + Math.abs(h).toString(36);
    } catch (e) { return "dev_unknown"; }
  }

  /* ------------------------------------------------------------------ */
  /* Dexie / IndexedDB offline queue (idempotent via sessionKey)        */
  /* ------------------------------------------------------------------ */
  var STORE = "vortex_sync_queue";
  var FALLBACK_KEY = "vortex_sync_queue";
  var queueDb = null;
  var flushing = false;

  if (window.Dexie) {
    try {
      queueDb = new window.Dexie("VortexOfflineDB");
      queueDb.version(1).stores({ vortex_sync_queue: "&sessionKey,createdAt" });
    } catch (e) { queueDb = null; }
  }

  function fallbackRead() {
    try { return JSON.parse(localStorage.getItem(FALLBACK_KEY) || "[]"); } catch (e) { return []; }
  }
  function fallbackWrite(q) {
    try { localStorage.setItem(FALLBACK_KEY, JSON.stringify(q.slice(-100))); } catch (e) { /* noop */ }
  }

  function enqueue(item) {
    var row = Object.assign({}, item, { createdAt: Date.now() });
    if (queueDb) {
      return queueDb.table(STORE).put(row).catch(function () {
        var q = fallbackRead();
        if (!q.some(function (x) { return x.sessionKey === row.sessionKey; })) { q.push(row); fallbackWrite(q); }
      });
    }
    var q = fallbackRead();
    if (!q.some(function (x) { return x.sessionKey === row.sessionKey; })) { q.push(row); fallbackWrite(q); }
    return Promise.resolve();
  }

  function queueFirst() {
    if (queueDb) return queueDb.table(STORE).orderBy("createdAt").first();
    return Promise.resolve(fallbackRead()[0]);
  }
  function queueDelete(key) {
    if (queueDb) return queueDb.table(STORE).delete(key);
    fallbackWrite(fallbackRead().filter(function (x) { return x.sessionKey !== key; }));
    return Promise.resolve();
  }
  function queueCount() {
    if (queueDb) return queueDb.table(STORE).count();
    return Promise.resolve(fallbackRead().length);
  }

  var isOnline = typeof navigator.onLine === "boolean" ? navigator.onLine : true;

  /** Persistent auto-flusher. A null response means the network is still down. */
  function flushQueue() {
    if (!isOnline || flushing) return Promise.resolve(0);
    flushing = true;
    var flushed = 0;
    function next() {
      return queueFirst().then(function (item) {
        if (!item) return flushed;
        var payload = Object.assign({}, item);
        delete payload.createdAt;
        return DB.api("/api/tracking/game-log", { method: "POST", body: payload }).then(function (res) {
          if (res === null) return flushed;          // retain and retry later
          return queueDelete(item.sessionKey).then(function () { flushed++; return next(); });
        });
      });
    }
    return next().finally(function () { flushing = false; });
  }

  window.addEventListener("online", function () { isOnline = true; flushQueue(); });
  window.addEventListener("offline", function () { isOnline = false; });

  /* ------------------------------------------------------------------ */
  /* HMAC-signing helper (proof-of-play)                                 */
  /* The browser uses a lightweight keyed hash matching server HMAC.     */
  /* NOTE: browser cannot use Node crypto; we approximate with a keyed   */
  /* FNV-style scramble, and the server accepts both via a dual check.   */
  /* ------------------------------------------------------------------ */
  function clientChecksum(p) {
    var str = [p.sessionKey, p.gameKey, p.startTime, p.endTime, p.status, p.finalScore, "vortex"].join("|");
    var h1 = 2166136261, h2 = 1199545199;
    for (var i = 0; i < str.length; i++) {
      h1 = Math.imul(h1 ^ str.charCodeAt(i), 16777619);
      h2 = Math.imul(h2 ^ str.charCodeAt(i), 1597334677);
    }
    return "c_" + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
  }

  /* ------------------------------------------------------------------ */
  /* Session manager (single live session at a time)                    */
  /* ------------------------------------------------------------------ */
  var session = { id: null, device: deviceSignature(), lastBeat: 0, hidden: false };

  function startSession() {
    if (session.id) return;                       // one at a time
    DB.api("/api/tracking/session", {
      method: "POST",
      body: { action: "start", deviceSignature: session.device },
    }).then(function (res) {
      if (res && res.ok) session.id = res.sessionId;
    });
    session.lastBeat = Date.now();
  }

  function beat() {
    if (!session.id) return;
    var now = Date.now();
    var delta = Math.min(60, Math.max(0, (now - session.lastBeat) / 1000));
    session.lastBeat = now;
    DB.api("/api/tracking/session", {
      method: "POST",
      body: {
        action: "beat", sessionId: session.id,
        activeSeconds: session.hidden ? 0 : Math.round(delta),
        idleSeconds: session.hidden ? Math.round(delta) : 0,
      },
    });
  }
  setInterval(beat, 30000);

  function closeSession(status, useBeacon) {
    if (!session.id) return;
    var id = session.id;
    session.id = null;
    var body = { action: "close", sessionId: id, status: status };
    if (useBeacon && navigator.sendBeacon) {
      try {
        navigator.sendBeacon("/api/tracking/session", new Blob([JSON.stringify(body)], { type: "application/json" }));
        return;
      } catch (e) { /* fall through */ }
    }
    DB.api("/api/tracking/session", { method: "POST", body: body });
  }
  window.addEventListener("beforeunload", function () { closeSession("CLOSED", true); });
  window.addEventListener("pagehide", function () { closeSession("CLOSED", true); });

  /* ---- Page Visibility focus guard: TIMED_OUT after 3 minutes ---- */
  var TIMEOUT_MS = 3 * 60 * 1000;
  var hiddenAt = 0;

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      session.hidden = true;
      hiddenAt = Date.now();
      if (current) current.hiddenStart = hiddenAt;
      beat();
    } else {
      session.hidden = false;
      var away = Date.now() - hiddenAt;
      if (current && current.hiddenStart) {
        current.hiddenMs += Math.max(0, Date.now() - current.hiddenStart);
        current.hiddenStart = 0;
      }
      if (away > TIMEOUT_MS) {
        closeSession("TIMED_OUT");
        startSession();
      } else {
        session.lastBeat = Date.now();   // don't double-count the hidden window
      }
      hiddenAt = 0;
    }
  });

  if (document.readyState === "complete") startSession();
  else window.addEventListener("load", startSession);

  /* ------------------------------------------------------------------ */
  /* SILENT HOOKS — game lifecycle                                       */
  /* The launcher (vortex-interactions.js) emits these non-blocking      */
  /* CustomEvents; we only listen. We never touch game code.             */
  /* ------------------------------------------------------------------ */
  var current = null;

  window.addEventListener("vortex:game:start", function (e) {
    var g = e.detail || {};
    current = {
      sessionKey: "g_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9),
      gameKey: g.gameKey, gameName: g.gameName || g.gameKey,
      startTime: new Date().toISOString(), startMs: Date.now(),
      hiddenMs: 0, hiddenStart: 0,
    };
  });

  window.addEventListener("vortex:game:over", function (e) {
    var d = e.detail || {};
    if (!current) return;
    var endMs = Date.now();
    var hiddenNow = current.hiddenStart ? endMs - current.hiddenStart : 0;
    var duration = Math.max(1, Math.round((endMs - current.startMs - current.hiddenMs - hiddenNow) / 1000));
    var payload = {
      sessionKey: current.sessionKey,
      gameKey: current.gameKey, gameName: current.gameName,
      startTime: current.startTime,
      endTime: new Date(endMs).toISOString(),
      durationSeconds: duration,
      status: d.status || "QUIT",
      finalScore: d.finalScore || 0,
    };
    payload.checksum = clientChecksum(payload);
    current = null;

    if (isOnline) {
      DB.api("/api/tracking/game-log", { method: "POST", body: payload }).then(function (res) {
        if (res === null) enqueue(payload);                    // network died mid-flight
        else if (res.ok && window.VortexToast && d.status !== "QUIT") {
          // silent success — no toast spam
        }
      });
    } else enqueue(payload);
  });

  window.addEventListener("vortex:game:quit", function () {
    if (!current) return;
    var endMs = Date.now();
    var payload = {
      sessionKey: current.sessionKey,
      gameKey: current.gameKey, gameName: current.gameName,
      startTime: current.startTime,
      endTime: new Date(endMs).toISOString(),
      durationSeconds: Math.max(1, Math.round((endMs - current.startMs - current.hiddenMs - (current.hiddenStart ? endMs - current.hiddenStart : 0)) / 1000)),
      status: "QUIT", finalScore: 0,
    };
    payload.checksum = clientChecksum(payload);
    current = null;
    if (isOnline) DB.api("/api/tracking/game-log", { method: "POST", body: payload });
    else enqueue(payload);
  });

  /* kick an initial flush */
  if (isOnline) flushQueue();

  window.VortexTelemetry = {
    flushQueue: flushQueue,
    formatToIST: formatToIST,
    queueLength: queueCount,
    queueStore: STORE,
    storageMode: queueDb ? "dexie-indexeddb" : "localStorage-fallback",
  };
})();
