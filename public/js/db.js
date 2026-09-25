/* ==========================================================================
   VORTEX GAMING — js/db.js  (Sub-Batch 4C, client half)
   Hybrid client database layer.
   Local-first: everything works offline in localStorage; authenticated data
   syncs in the background to the PostgreSQL REST API.
   ========================================================================== */
(function () {
  "use strict";

  var LS_TOKEN = "vg_token";
  var LS_USER = "vg_user";
  var LS_LOCAL = "vg_local_scores";
  var LS_PENDING = "vg_pending_sync";
  var API_TIMEOUT_MS = 9000;

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* storage may be full/blocked — non-fatal */
    }
  }

  var listeners = [];

  var VortexDB = {
    token: localStorage.getItem(LS_TOKEN) || null,
    user: readJSON(LS_USER, null),

    /* --------------------------- events --------------------------- */
    onAuthChange: function (fn) {
      listeners.push(fn);
    },
    emitAuth: function () {
      for (var i = 0; i < listeners.length; i++) {
        try {
          listeners[i](this.user);
        } catch (err) {
          console.error(err);
        }
      }
    },

    /* ------------------------- transport -------------------------- */
    api: function (path, options) {
      options = options || {};
      var method = options.method || "GET";
      var headers = { "Content-Type": "application/json" };
      if (this.token) headers["Authorization"] = "Bearer " + this.token;

      var controller = new AbortController();
      var timer = setTimeout(function () {
        controller.abort();
      }, API_TIMEOUT_MS);

      return fetch(path, {
        method: method,
        headers: headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
        credentials: "same-origin",
      })
        .then(function (res) {
          clearTimeout(timer);
          return res
            .json()
            .catch(function () {
              return null;
            })
            .then(function (data) {
              if (!res.ok) {
                return {
                  ok: false,
                  status: res.status,
                  error: (data && data.error) || "Request failed (" + res.status + ")",
                };
              }
              return data;
            });
        })
        .catch(function () {
          clearTimeout(timer);
          return null; // network down / aborted — caller falls back to local
        });
    },

    /* ---------------------------- auth ---------------------------- */
    register: function (username, email, password) {
      var self = this;
      return this.api("/api/auth/register", {
        method: "POST",
        body: { username: username, email: email, password: password },
      }).then(function (res) {
        if (res && res.ok && res.token) {
          self.setSession(res.token, res.user);
          self.flushPending();
          return { ok: true, user: res.user };
        }
        return { ok: false, error: (res && res.error) || "Could not reach the grid." };
      });
    },

    login: function (email, password) {
      var self = this;
      return this.api("/api/auth/login", {
        method: "POST",
        body: { email: email, password: password },
      }).then(function (res) {
        if (res && res.ok && res.token) {
          self.setSession(res.token, res.user);
          self.flushPending();
          return { ok: true, user: res.user };
        }
        return { ok: false, error: (res && res.error) || "Could not reach the grid." };
      });
    },

    logout: function () {
      this.token = null;
      this.user = null;
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_USER);
      this.emitAuth();
    },

    setSession: function (token, user) {
      this.token = token;
      this.user = user;
      localStorage.setItem(LS_TOKEN, token);
      writeJSON(LS_USER, user);
      this.emitAuth();
    },

    refreshMe: function () {
      var self = this;
      if (!this.token) return Promise.resolve(null);
      return this.api("/api/auth/me").then(function (res) {
        if (res && res.ok) {
          self.user = res.user;
          writeJSON(LS_USER, res.user);
          self.emitAuth();
          return res.user;
        }
        if (res && res.status === 401) self.logout();
        return null;
      });
    },

    isAdmin: function () {
      return !!(this.user && this.user.role === "admin" && this.token);
    },

    /* ----------------------- local high scores -------------------- */
    localScores: function () {
      return readJSON(LS_LOCAL, {});
    },

    getBest: function (gameKey) {
      var local = this.localScores();
      return Number(local[gameKey] || 0);
    },

    recordLocal: function (gameKey, score) {
      var local = this.localScores();
      if (score > Number(local[gameKey] || 0)) {
        local[gameKey] = score;
        writeJSON(LS_LOCAL, local);
      }
      return Number(local[gameKey] || 0);
    },

    /* ------------------------- score submit ----------------------- */
    queuePending: function (entry) {
      var q = readJSON(LS_PENDING, []);
      q.push(entry);
      writeJSON(LS_PENDING, q.slice(-50)); // keep the queue bounded
    },

    submitScore: function (gameKey, score, xpDelta) {
      var self = this;
      var best = this.recordLocal(gameKey, score);
      var entry = { gameKey: gameKey, score: score, xpDelta: xpDelta };

      if (!this.token) {
        this.queuePending(entry);
        return Promise.resolve({ saved: false, synced: false, best: best, reason: "guest" });
      }

      return this.api("/api/scores/submit", { method: "POST", body: entry }).then(function (res) {
        if (res && res.ok) {
          if (self.user && typeof res.totalXp === "number") {
            self.user.totalXp = res.totalXp;
            self.user.level = res.level;
            writeJSON(LS_USER, self.user);
            self.emitAuth();
          }
          return { saved: true, synced: true, best: Math.max(best, res.highScore || 0), data: res };
        }
        if (res === null) self.queuePending(entry);
        return { saved: true, synced: false, best: best, error: res && res.error };
      });
    },

    flushPending: function () {
      var self = this;
      if (!this.token) return Promise.resolve(0);
      var q = readJSON(LS_PENDING, []);
      if (!q.length) return Promise.resolve(0);

      // Sequentially replay the queue; survivors stay queued.
      writeJSON(LS_PENDING, []);
      var flushed = 0;

      function step() {
        if (!q.length) return Promise.resolve(flushed);
        var entry = q.shift();
        return self
          .api("/api/scores/submit", { method: "POST", body: entry })
          .then(function (res) {
            if (res && res.ok) flushed++;
            else if (res === null) self.queuePending(entry);
            return step();
          });
      }

      return step();
    },

    /* ------------------------- leaderboard ------------------------ */
    leaderboard: function (gameKey, scope) {
      var self = this;
      var suffix = scope === "session" ? "?scope=session" : "";
      return this.api("/api/leaderboard/" + encodeURIComponent(gameKey) + suffix).then(function (res) {
        if (res && res.ok) {
          return { entries: res.entries || [], game: res.game, live: true, source: res.source, scope: res.scope, me: self.user ? self.user.username : null };
        }
        // Offline fallback: surface the local solo record.
        var best = self.getBest(gameKey);
        var entries = [];
        if (best > 0) {
          entries.push({
            rank: 1,
            username: (self.user && self.user.username) || "you",
            score: best,
            xpEarned: 0,
            createdAt: null,
          });
        }
        return { entries: entries, game: null, live: false, me: null };
      });
    },

    ping: function () {
      return this.api("/api/health").then(function (res) {
        return !!(res && res.ok);
      });
    },
  };

  /* Background sync: on reconnect + a slow interval. */
  window.addEventListener("online", function () {
    VortexDB.flushPending();
  });
  setInterval(function () {
    if (VortexDB.token) VortexDB.flushPending();
  }, 20000);

  window.VortexDB = VortexDB;
})();
