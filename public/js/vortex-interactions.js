/* ==========================================================================
   VORTEX GAMING — vortex-interactions.js  (Sub-Batch 3B)
   Card grid renderer, 3D hover-tilt physics, fuzzy search engine, game
   launcher shell, auth UI, leaderboard, dpad routing and the preloader.
   ========================================================================== */
(function () {
  "use strict";

  var DEVICE = window.VortexDevice || { tier: "medium", touch: false, reducedMotion: false };
  var DB = window.VortexDB;
  var MANIFEST = window.VortexManifest || [];

  function $(id) { return document.getElementById(id); }
  function hexToRgba(hex, alpha) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  /* ================================================================== */
  /* 1. CARD GRID RENDERER                                              */
  /* ================================================================== */
  var cardEls = {};  // key -> tile element
  var bestEls = {};  // key -> <b> element for live best refresh

  function getManifest() {
    if (!MANIFEST.length && window.VortexManifest) MANIFEST = window.VortexManifest;
    return MANIFEST;
  }

  function renderCards() {
    var list = getManifest();

    // Guard against load-order anomalies: never leave the grid blank —
    // poll briefly for the manifest module before mounting the tiles.
    if (!list.length) {
      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        if (getManifest().length || tries > 40) {
          clearInterval(timer);
          renderCards();
          applyFilter();
          initReveal();
        }
      }, 50);
      return;
    }

    for (var i = 0; i < list.length; i++) {
      (function (g, idx) {
        var grid = $(g.gridId);
        if (!grid) return;

        var tile = document.createElement("article");
        tile.className = "game-card-tile";
        tile.setAttribute("data-key", g.key);
        tile.setAttribute("data-title", g.title.toLowerCase());
        tile.setAttribute("data-cat", g.cat);
        tile.setAttribute("data-tags", g.tags.join(" "));
        tile.style.transitionDelay = (idx % 4) * 70 + "ms";

        var best = DB ? DB.getBest(g.key) : 0;

        tile.innerHTML =
          '<div class="card-preview" style="--prev-a:' + hexToRgba(g.color, 0.22) + '; --prev-b:' + g.color + '">' +
            '<img class="card-thumb" data-thumb-key="' + g.key + '" src="assets/games/' + g.key + '.jpg" alt="" loading="lazy" decoding="async" onerror="if(!this.dataset.f){this.dataset.f=\'1\';this.src=\'assets/games/\'+this.getAttribute(\'data-thumb-key\')+\'.svg\';}else{this.remove();}" />' +
            '<span class="card-scan-badge">LIVE FEED</span>' +
            '<span class="card-diff">' + g.diff + '</span>' +
            '<div class="card-glyph ' + g.glyph + '"></div>' +
            '<span class="card-live-dot">STANDBY #' + String(idx + 1).padStart(2, "0") + '</span>' +
          '</div>' +
          '<div class="card-body">' +
            '<h3 class="card-title">' + g.title + '</h3>' +
            '<p class="card-tagline">' + g.tagline + '</p>' +
            '<div class="card-meta"><span>#' + g.tags[0] + ' #' + g.tags[1] + '</span>' +
            '<span class="card-best">BEST <b data-best="' + g.key + '">' + best + '</b></span></div>' +
            '<button class="card-play" type="button">▶&nbsp; PLAY</button>' +
          '</div>';

        tile.addEventListener("click", function () { launch(g.key); });
        grid.appendChild(tile);
        cardEls[g.key] = tile;
        var b = tile.querySelector('b[data-best="' + g.key + '"]');
        if (b) bestEls[g.key] = b;
      })(list[i], i);
    }
  }

  function refreshCardBest(key) {
    if (bestEls[key] && DB) bestEls[key].textContent = DB.getBest(key);
  }

  /* ================================================================== */
  /* 2. 3D TILT PHYSICS  (skipped on perf-low / touch / reduced motion) */
  /* ================================================================== */
  function initTilt() {
    if (DEVICE.tier === "low" || DEVICE.touch || DEVICE.reducedMotion) return;

    var active = null;
    var rx = 0, ry = 0, tx = 0, ty = 0;
    var rafRunning = false;

    function lerpLoop() {
      rx += (tx - rx) * 0.16;
      ry += (ty - ry) * 0.16;
      if (active) {
        active.style.setProperty("--tilt-rx", rx.toFixed(2) + "deg");
        active.style.setProperty("--tilt-ry", ry.toFixed(2) + "deg");
      }
      if (active || Math.abs(rx) > 0.05 || Math.abs(ry) > 0.05) {
        requestAnimationFrame(lerpLoop);
      } else {
        rafRunning = false;
      }
    }

    document.addEventListener("pointermove", function (e) {
      var tile = e.target && e.target.closest ? e.target.closest(".game-card-tile") : null;
      if (tile !== active) {
        if (active) {
          active.style.setProperty("--tilt-rx", "0deg");
          active.style.setProperty("--tilt-ry", "0deg");
        }
        active = tile;
        rx = 0; ry = 0; tx = 0; ty = 0;
      }
      if (!active) return;
      var rect = active.getBoundingClientRect();
      var px = (e.clientX - rect.left) / rect.width;
      var py = (e.clientY - rect.top) / rect.height;
      tx = (0.5 - py) * 14;
      ty = (px - 0.5) * 16;
      active.style.setProperty("--glare-x", (px * 100).toFixed(1) + "%");
      active.style.setProperty("--glare-y", (py * 100).toFixed(1) + "%");
      if (!rafRunning) { rafRunning = true; requestAnimationFrame(lerpLoop); }
    }, { passive: true });
  }

  /* ================================================================== */
  /* 3. FUZZY SEARCH + TAG CHIPS                                        */
  /* ================================================================== */
  var activeTag = "all";

  function fuzzyScore(query, hay) {
    if (!query) return 1;
    var idx = hay.indexOf(query);
    if (idx === 0) return 100 - query.length * 0.01;
    if (idx > 0) return 60 - idx * 0.1;
    // subsequence match
    var qi = 0;
    for (var i = 0; i < hay.length && qi < query.length; i++) {
      if (hay[i] === query[qi]) qi++;
    }
    return qi === query.length ? 30 : 0;
  }

  function applyFilter() {
    var q = ($("search-input") ? $("search-input").value : "").trim().toLowerCase();
    var visible = 0;
    var bestTile = null;
    var bestScore = 0;

    for (var i = 0; i < MANIFEST.length; i++) {
      var g = MANIFEST[i];
      var tile = cardEls[g.key];
      if (!tile) continue;
      var tagOk = activeTag === "all" || g.cat === activeTag || g.tags.indexOf(activeTag) !== -1;
      var hay = (g.title + " " + g.tags.join(" ") + " " + g.catLabel).toLowerCase();
      var score = q ? fuzzyScore(q, hay) : 1;
      var show = tagOk && score > 0;
      tile.classList.toggle("hidden", !show);
      if (show) {
        visible++;
        var rank = score + (tagOk && activeTag !== "all" ? 5 : 0);
        if (rank > bestScore) { bestScore = rank; bestTile = tile; }
      }
    }

    var empty = $("empty-state");
    if (empty) {
      // "NO SIGNALS FOUND" is reserved for ACTIVE queries that match nothing —
      // never on the initial render (or when every tile simply failed to mount).
      var activeQuery = q.length > 0 || activeTag !== "all";
      empty.classList.toggle("hidden", !(activeQuery && visible === 0));
    }
    var clearBtn = $("search-clear");
    if (clearBtn) clearBtn.classList.toggle("hidden", q.length === 0);
    return bestTile;
  }

  function initSearch() {
    var input = $("search-input");
    if (!input) return;
    input.addEventListener("input", applyFilter);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        var top = applyFilter();
        if (top) launch(top.getAttribute("data-key"));
      }
    });
    var clearBtn = $("search-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        input.value = "";
        applyFilter();
        input.focus();
      });
    }
    var chips = document.querySelectorAll(".chip");
    for (var i = 0; i < chips.length; i++) {
      (function (chip) {
        chip.addEventListener("click", function () {
          activeTag = chip.getAttribute("data-tag") || "all";
          for (var j = 0; j < chips.length; j++) chips[j].classList.remove("active");
          chip.classList.add("active");
          applyFilter();
          if (window.VortexAudio) window.VortexAudio.blip(540, 0.05, "triangle", 0.05);
        });
      })(chips[i]);
    }
  }

  /* ================================================================== */
  /* 4. GAME LAUNCHER                                                   */
  /* ================================================================== */
  var session = {
    game: null,        // manifest entry
    engine: null,      // live engine controller
    sessionXp: 0,
    ticker: null,      // time-based XP heartbeat
    score: 0,
    open: false,
  };

  function setScore(n) {
    session.score = n;
    var el = $("gm-hud-score");
    if (el) el.textContent = String(n);
  }

  function launch(key) {
    var meta = null;
    for (var i = 0; i < MANIFEST.length; i++) if (MANIFEST[i].key === key) meta = MANIFEST[i];
    var factory = window.VortexGames && window.VortexGames[key];
    if (!meta || !factory) return;

    closeGame(true); // hard-reset any previous session
    session.game = meta;
    session.sessionXp = 0;
    session.open = true;
    session.logged = false;   // telemetry: reset the quit-duplication guard

    $("gm-title").textContent = meta.title.toUpperCase();
    $("gm-category").textContent = meta.catLabel;
    $("gm-hint").textContent = factory.hint || "";
    $("gm-hud-best").textContent = DB ? DB.getBest(key) : 0;
    setScore(0);

    var dpad = $("dpad");
    if (dpad) dpad.classList.toggle("hidden", !factory.pad);

    var modal = $("game-modal");
    if (modal) {
      modal.classList.remove("hidden");
      // per-game cyberpunk banner behind the modal head (svg base, jpg upgrade)
      modal.style.setProperty("--gm-img", "url('assets/games/" + meta.key + ".svg')");
      (function (key) {
        var probe = new Image();
        probe.onload = function () {
          if (session.game && session.game.key === key) {
            modal.style.setProperty("--gm-img", "url('assets/games/" + key + ".jpg')");
          }
        };
        probe.src = "assets/games/" + key + ".jpg";
      })(meta.key);
    }
    var over = $("game-over-panel");
    if (over) over.classList.add("hidden");

    document.body.style.overflow = "hidden";
    document.body.classList.add("game-active");   // locks mobile scroll/zoom

    // ---- SILENT TELEMETRY EMITTER (non-blocking; listeners attach elsewhere) ----
    try {
      window.dispatchEvent(new CustomEvent("vortex:game:start", {
        detail: { gameKey: meta.key, gameName: meta.title },
      }));
    } catch (err) { /* telemetry is optional, never block gameplay */ }

    // engine boot (defer one tick so the modal has computed dimensions)
    setTimeout(function () {
      var canvas = $("gm-canvas");
      if (!canvas || !session.open) return;
      session.engine = factory.init({
        canvas: canvas,
        audio: window.VortexAudio || null,
        device: DEVICE,
        onScore: setScore,
        onXp: function (n) { session.sessionXp += n; },
        onGameOver: onGameOver,
      });
    }, 30);

    // time-based XP heartbeat: +1 XP every 10s of active play
    session.ticker = setInterval(function () {
      if (session.open && !document.hidden) {
        session.sessionXp += 1;
      }
    }, 10000);

    if (window.VortexAudio) window.VortexAudio.blip(392, 0.09, "triangle", 0.08);
  }
  window.VortexLaunch = launch;

  function destroyEngine() {
    if (session.engine) {
      try { session.engine.destroy(); } catch (e) { console.error(e); }
      session.engine = null;
    }
    if (session.ticker) {
      clearInterval(session.ticker);
      session.ticker = null;
    }
  }

  function onGameOver(finalScore, outcome) {
    var meta = session.game;
    if (!meta) return;
    destroyEngine();

    // ---- SILENT TELEMETRY EMITTER ----
    try {
      window.dispatchEvent(new CustomEvent("vortex:game:over", {
        detail: { gameKey: meta.key, gameName: meta.title, finalScore: finalScore, status: finalScore > 0 ? "WON" : "LOST" },
      }));
      session.logged = true;   // stop the close() path from double-logging a quit
    } catch (err) { /* telemetry is optional */ }

    // final XP = live events + playtime + score payout
    var xpDelta = session.sessionXp + 10 + Math.floor(finalScore / 20);
    if (window.VortexGamification) window.VortexGamification.addXP(xpDelta, meta.title);
    else if (window.VortexXP) window.VortexXP.add(xpDelta, meta.title);

    var bestBefore = DB ? DB.getBest(meta.key) : 0;
    var newBest = Math.max(bestBefore, finalScore);

    $("go-score").textContent = String(finalScore);
    $("go-xp").textContent = "+" + xpDelta;
    $("go-best").textContent = String(newBest);
    $("gm-hud-best").textContent = String(newBest);

    var syncEl = $("go-sync");
    if (syncEl) {
      syncEl.classList.remove("live");
      syncEl.textContent = "Syncing to global grid…";
    }

    var panel = $("game-over-panel");
    if (panel) panel.classList.remove("hidden");
    if (window.VortexAudio) window.VortexAudio.arpUp();

    if (DB) {
      DB.submitScore(meta.key, finalScore, xpDelta).then(function (res) {
        var synced = res && res.synced;
        if (syncEl) {
          syncEl.textContent = synced
            ? "▲ SYNCED — global leaderboard updated"
            : res && res.reason === "guest"
              ? "LOCAL RECORD — sign in to sync to the global grid"
              : "OFFLINE — queued for background sync";
          if (synced) syncEl.classList.add("live");
        }
        refreshCardBest(meta.key);
        if ($("lb-select") && $("lb-select").value === meta.key) loadLeaderboard();
      });
    }
  }

  function restart() {
    var key = session.game ? session.game.key : null;
    if (key) launch(key);
  }

  function closeGame(silent) {
    if (!session.open) { destroyEngine(); return; }
    // ---- SILENT TELEMETRY: emit quit ONLY if it never reached game-over ----
    try {
      if (session.game && !session.logged) {
        window.dispatchEvent(new CustomEvent("vortex:game:quit", {
          detail: { gameKey: session.game.key, gameName: session.game.title, finalScore: session.score || 0, status: "QUIT" },
        }));
      }
    } catch (err) { /* telemetry is optional */ }
    session.open = false;
    destroyEngine();
    var modal = $("game-modal");
    if (modal) modal.classList.add("hidden");
    var panel = $("game-over-panel");
    if (panel) panel.classList.add("hidden");
    document.body.style.overflow = "";
    document.body.classList.remove("game-active");
    var canvas = $("gm-canvas");
    if (canvas) {
      var ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (!silent && window.VortexAudio) window.VortexAudio.blip(240, 0.08, "triangle", 0.06);
    session.game = null;
  }

  function initLauncher() {
    var closeBtn = $("gm-close");
    if (closeBtn) closeBtn.addEventListener("click", function () { closeGame(false); });
    var restartBtn = $("btn-restart");
    if (restartBtn) restartBtn.addEventListener("click", restart);
    var exitBtn = $("btn-exit");
    if (exitBtn) exitBtn.addEventListener("click", function () { closeGame(false); });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (session.open) closeGame(false);
        var auth = $("auth-modal");
        if (auth && !auth.classList.contains("hidden")) auth.classList.add("hidden");
        var spin = $("spin-overlay");
        if (spin) spin.classList.add("hidden");
      }
    });

    // Mobile containment: while a game is active, kill page scroll, pull-to-
    // refresh and pinch-zoom inside the game surface (CSS covers most of it;
    // this blocks the non-passive gestures browsers still allow by default).
    var gameModal = $("game-modal");
    if (gameModal) {
      gameModal.addEventListener("touchmove", function (e) {
        if (document.body.classList.contains("game-active")) e.preventDefault();
      }, { passive: false });
      gameModal.addEventListener("gesturestart", function (e) { e.preventDefault(); });
      gameModal.addEventListener("dblclick", function (e) {
        if (document.body.classList.contains("game-active")) e.preventDefault();
      });
    }

    // dpad routing → engines listen on window 'vortex-dir' / 'vortex-dir-up'.
    // Press AND release are broadcast so games can read *held* state.
    var dpadButtons = document.querySelectorAll("#dpad .dpad-btn");
    for (var i = 0; i < dpadButtons.length; i++) {
      (function (btn) {
        var dir = btn.getAttribute("data-dir") || (btn.getAttribute("data-action") ? "action" : null);
        if (!dir) return;
        var down = false;

        function press(e) {
          if (e) e.preventDefault();
          if (down) return;
          down = true;
          btn.classList.add("pressed");
          window.dispatchEvent(new CustomEvent("vortex-dir", { detail: { dir: dir } }));
        }
        function release() {
          if (!down) return;
          down = false;
          btn.classList.remove("pressed");
          window.dispatchEvent(new CustomEvent("vortex-dir-up", { detail: { dir: dir } }));
        }

        btn.addEventListener("pointerdown", press);
        btn.addEventListener("pointerup", release);
        btn.addEventListener("pointercancel", release);
        btn.addEventListener("pointerleave", release);
        window.addEventListener("blur", release);
        btn.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      })(dpadButtons[i]);
    }

    var enterBtn = $("btn-enter-arcade");
    if (enterBtn) {
      enterBtn.addEventListener("click", function () {
        var cat = $("categories");
        if (cat) cat.scrollIntoView({ behavior: DEVICE.reducedMotion ? "auto" : "smooth" });
      });
    }
  }

  /* ================================================================== */
  /* 5. LEADERBOARD                                                     */
  /* ================================================================== */
  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function setLbStatus(text, live) {
    var status = $("lb-status");
    if (!status) return;
    status.textContent = text;
    status.classList.toggle("live", !!live);
  }

  function loadLeaderboard() {
    var select = $("lb-select");
    var body = $("lb-body");
    if (!select || !body) return;
    var key = select.value;
    var scopeEl = $("lb-scope");
    var scope = scopeEl ? scopeEl.value : "global";
    setLbStatus("SYNCING…", false);

    // Resolve into a rendered board (or a graceful empty state) no matter
    // what the transport does — the old code could stall on "SYNCING…".
    var settle = function (res) {
      try {
      if (!body) return;
      body.innerHTML = "";
      setLbStatus(
        res.live
          ? "● LIVE — " + (res.source === "validated-telemetry" ? "VALIDATED TELEMETRY" : "POSTGRES GRID")
          : "○ LOCAL RECORDS",
        res.live
      );
      if (!res.entries.length) {
        body.innerHTML = '<tr class="lb-empty"><td colspan="5">No records on this grid yet — be the first.</td></tr>';
        return;
      }
      for (var i = 0; i < res.entries.length; i++) {
        var e = res.entries[i];
        var tr = document.createElement("tr");
        tr.className = "top-" + e.rank + (res.me && e.username === res.me ? " lb-me" : "");
        tr.innerHTML =
          '<td class="lb-rank"><span class="lb-rank-badge">' + e.rank + '</span></td>' +
          '<td>' + escapeHtml(e.username) + '</td>' +
          '<td class="lb-num">' + Number(e.score).toLocaleString() + '</td>' +
          '<td class="lb-num lb-xp-col">' + Number(e.xpEarned || 0).toLocaleString() + '</td>' +
          '<td class="lb-date-col">' + fmtDate(e.createdAt) + '</td>';
        body.appendChild(tr);
      }
      } catch (err) {
        console.error("[leaderboard]", err);
        setLbStatus("○ LOCAL RECORDS", false);
      }
    };

    try {
      if (!DB) {
        settle({ entries: [], live: false, me: null });
        return;
      }
      DB.leaderboard(key, scope).then(settle).catch(function () {
        settle({ entries: [], live: false, me: null });
      });
    } catch (err) {
      settle({ entries: [], live: false, me: null });
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function initLeaderboard() {
    var select = $("lb-select");
    if (!select) return;
    for (var i = 0; i < MANIFEST.length; i++) {
      var opt = document.createElement("option");
      opt.value = MANIFEST[i].key;
      opt.textContent = MANIFEST[i].title;
      if (MANIFEST[i].key === "neon-snake") opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener("change", loadLeaderboard);
    var scope = $("lb-scope");
    if (scope) scope.addEventListener("change", loadLeaderboard);
    loadLeaderboard();
    // Lightweight realtime refresh — validated telemetry appears without reload.
    setInterval(function () {
      if (!document.hidden && $("leaderboard")) loadLeaderboard();
    }, 20000);
  }

  /* ================================================================== */
  /* 6. AUTH                                                            */
  /* ================================================================== */
  function showAuthError(id, msg) {
    var el = $(id);
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  }

  function refreshAuthUI() {
    if (!DB) return;
    var user = DB.user;
    var chip = $("user-chip");
    var authBtn = $("btn-auth");
    var name = $("user-chip-name");
    var avatar = $("user-chip-avatar");
    var signedIn = !!(user && DB.token);
    if (chip) chip.classList.toggle("hidden", !signedIn);
    if (authBtn) authBtn.classList.toggle("hidden", signedIn);
    if (signedIn && name) name.textContent = user.username;
    if (signedIn && avatar) avatar.textContent = (user.username || "V").charAt(0).toUpperCase();
  }

  function initAuth() {
    var modal = $("auth-modal");
    var openBtn = $("btn-auth");
    var loginTab = document.querySelector('.auth-tab[data-tab="login"]');
    var regTab = document.querySelector('.auth-tab[data-tab="register"]');
    var formLogin = $("form-login");
    var formRegister = $("form-register");

    if (openBtn && modal) {
      openBtn.addEventListener("click", function () { modal.classList.remove("hidden"); });
    }
    var closers = document.querySelectorAll("[data-close-auth]");
    for (var i = 0; i < closers.length; i++) {
      closers[i].addEventListener("click", function () { modal.classList.add("hidden"); });
    }
    function switchTab(which) {
      if (!loginTab || !regTab || !formLogin || !formRegister) return;
      loginTab.classList.toggle("active", which === "login");
      regTab.classList.toggle("active", which === "register");
      formLogin.classList.toggle("hidden", which !== "login");
      formRegister.classList.toggle("hidden", which !== "register");
    }
    if (loginTab) loginTab.addEventListener("click", function () { switchTab("login"); });
    if (regTab) regTab.addEventListener("click", function () { switchTab("register"); });

    if (formLogin) {
      formLogin.addEventListener("submit", function (e) {
        e.preventDefault();
        showAuthError("login-error", "");
        var email = $("login-email").value.trim();
        var pass = $("login-password").value;
        DB.login(email, pass).then(function (res) {
          if (res.ok) {
            modal.classList.add("hidden");
            // greet the returning pilot by handle (persistent identity)
            window.VortexToast("Welcome back, " + res.user.username + " — grid access restored.");
            refreshAuthUI();
          } else {
            showAuthError("login-error", res.error || "Invalid credentials.");
          }
        });
      });
    }
    if (formRegister) {
      formRegister.addEventListener("submit", function (e) {
        e.preventDefault();
        showAuthError("reg-error", "");
        var username = $("reg-username").value.trim();
        var email = $("reg-email").value.trim();
        var pass = $("reg-password").value;
        DB.register(username, email, pass).then(function (res) {
          if (res.ok) {
            modal.classList.add("hidden");
            window.VortexToast("Account created — welcome to the grid, " + res.user.username);
            refreshAuthUI();
          } else {
            showAuthError("reg-error", res.error || "Could not create account.");
          }
        });
      });
    }
    var logoutBtn = $("btn-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        DB.logout();
        refreshAuthUI();
        window.VortexToast("Signed out", "warn");
      });
    }
    if (DB) DB.onAuthChange(refreshAuthUI);
    refreshAuthUI();
  }

  /* ================================================================== */
  /* 7. SCROLL REVEAL                                                   */
  /* ================================================================== */
  function initReveal() {
    if (!("IntersectionObserver" in window)) {
      var all = document.querySelectorAll(".game-card-tile");
      for (var i = 0; i < all.length; i++) all[i].classList.add("in-view");
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add("in-view");
          io.unobserve(entries[i].target);
        }
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    var tiles = document.querySelectorAll(".game-card-tile");
    for (var j = 0; j < tiles.length; j++) io.observe(tiles[j]);
  }

  /* ================================================================== */
  /* 8. PRELOADER + FOOTER TELEMETRY                                    */
  /* ================================================================== */
  function initPreloader() {
    var pre = $("preloader");
    var bar = $("preloader-bar");
    var status = $("preloader-status");
    if (!pre || !bar) return;

    var progress = 0;
    var phases = ["CALIBRATING HARDWARE…", "BENCHMARKING RENDER CORE…", "SYNCHRONIZING GRID…", "ARMING GAME ENGINES…"];
    var phaseIdx = 0;

    var timer = setInterval(function () {
      progress = Math.min(100, progress + 6 + Math.random() * 9);
      bar.style.width = progress + "%";
      if (status && progress > (phaseIdx + 1) * 24 && phaseIdx < phases.length - 1) {
        phaseIdx++;
        status.textContent = phases[phaseIdx];
      }
      if (progress >= 100) {
        clearInterval(timer);
        finish();
      }
    }, 110);

    function finish() {
      if (status) status.textContent = "PROFILE LOCKED — " + (DEVICE.tier || "medium").toUpperCase() + " TIER";
      setTimeout(function () {
        pre.classList.add("done");
      }, 420);
    }
  }

  function initTelemetry() {
    var perf = $("perf-readout");
    var heroPerf = $("stat-perf");
    var footerHw = $("footer-hw");
    var label = (DEVICE.tier || "medium").toUpperCase() + " TIER";
    if (perf) perf.textContent = label;
    if (heroPerf) heroPerf.textContent = label;
    if (footerHw) {
      footerHw.textContent = "Hardware profile: " + label + " · " + (DEVICE.cores || "?") + " cores · " + (DEVICE.memory || "?") + "GB · DPR " + (DEVICE.dpr || 1);
    }

    /* Footer API status: must ALWAYS resolve out of "checking…" — online,
       offline and degraded are all valid, a hanging request is not. */
    var footerApi = $("footer-api");
    function pingFooter() {
      if (!footerApi) return;
      try {
        if (!DB || typeof DB.ping !== "function") {
          footerApi.textContent = "API: offline — local mode";
          return;
        }
        DB.ping().then(function (live) {
          footerApi.textContent = live
            ? "API: online — PostgreSQL linked"
            : "API: offline — local mode";
        }).catch(function () {
          footerApi.textContent = "API: offline — local mode";
        });
      } catch (err) {
        footerApi.textContent = "API: offline — local mode";
      }
    }
    pingFooter();
    // re-ping so the footer recovers when the grid link comes back
    setInterval(function () { if (!document.hidden) pingFooter(); }, 30000);

    /* Render-core readout safety net: if the stage meter never published
       (no canvas context, backgrounded boot), resolve to a stable value. */
    setTimeout(function () {
      var fps = $("stat-fps");
      if (fps && /^—|SCANNING/i.test(fps.textContent || "")) {
        fps.textContent = "STANDBY";
        if ($("fps-readout")) $("fps-readout").textContent = "STANDBY";
        var fRender = $("footer-render");
        if (fRender && (fRender.textContent || "").indexOf("—") !== -1) {
          fRender.textContent = "Render core: standby";
        }
      }
    }, 2500);
  }

  /* ================================================================== */
  /* BOOT                                                               */
  /* ================================================================== */
  function boot() {
    renderCards();
    initTilt();
    initSearch();
    applyFilter();
    initLauncher();
    initLeaderboard();
    initAuth();
    initReveal();
    initPreloader();
    initTelemetry();
    if (window.VortexXP) window.VortexXP.applyCardGlows();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
