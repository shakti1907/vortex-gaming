/* ==========================================================================
   VORTEX GAMING — vortex-gamification.js  (Sub-Batch 3C)
   Shared game manifest, time/event-based XP engine with level badges &
   card-glow unlocks, toasts, and the slot-machine Destiny Spin.
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* 16-GAME MANIFEST — mirrors the server catalog (src/db/seed.ts)     */
  /* ------------------------------------------------------------------ */
  var CATS = {
    action: { label: "ACTION / ARCADE", grid: "grid-action" },
    puzzle: { label: "PUZZLE / STRATEGY", grid: "grid-puzzle" },
    retro: { label: "RETRO / CLASSIC", grid: "grid-retro" },
    racing: { label: "RACING / SPEED", grid: "grid-racing" },
  };

  // [key, title, tagline, category, difficulty, tags, hue, color, glyph]
  var MANIFEST = [
    ["neon-snake", "Neon Snake", "Dash boosts, plasma trails, multi-stage cores.", "action", "CLASSIC", ["arcade", "snake", "classic", "grid"], "#143", "#ff2e88", "glyph-snake"],
    ["cyber-invaders", "Cyber Invaders", "Destructible shields and a sentinel boss core.", "action", "MEDIUM", ["arcade", "shooter", "invaders", "boss"], "#143", "#2ee6ff", "glyph-targets"],
    ["asteroid-vector", "Asteroid Vector", "360° inertia drift around a hungry singularity.", "action", "HARD", ["arcade", "space", "physics", "shooter"], "#143", "#ffb42e", "glyph-collect"],
    ["bullet-hell-rush", "Bullet Hell Rush", "Procedural bullet storms — bend time to survive.", "action", "EXPERT", ["arcade", "dodge", "reflex", "bullet"], "#143", "#8a5cff", "glyph-dodge"],

    ["grid-stacker", "Cyber Grid Stacker", "Chain line clears before the gravity surge.", "puzzle", "MEDIUM", ["puzzle", "blocks", "strategy", "tetris"], "#210", "#2ee6ff", "glyph-tetris"],
    ["quantum-laser", "Quantum Laser Reflect", "Rotate mirrors, bend the beam, light every node.", "puzzle", "HARD", ["puzzle", "logic", "laser", "optics"], "#210", "#ffb42e", "glyph-sequence"],
    ["memory-matrix", "Memory Matrix", "Rhythmic sequence hacking through the glitch.", "puzzle", "HARD", ["puzzle", "memory", "pattern", "hacking"], "#210", "#8a5cff", "glyph-memory"],
    ["neon-flow", "Neon Flow", "Route the power nodes — wires may never cross.", "puzzle", "EASY", ["puzzle", "logic", "circuit", "flow"], "#210", "#ff2e88", "glyph-collect"],

    ["neon-pong", "Neon Pong 2.0", "Curve shots, paddle powerups, reactive walls.", "retro", "EASY", ["retro", "pong", "classic", "arcade"], "#267", "#2ee6ff", "glyph-breakout"],
    ["grid-pac-runner", "Grid Pac-Runner", "Harvest data nodes, outwit the patrol sentinels.", "retro", "MEDIUM", ["retro", "maze", "classic", "arcade"], "#267", "#ffb42e", "glyph-collect"],
    ["cyber-soar", "Cyber Soar", "Precision thruster flight through energy pillars.", "retro", "HARD", ["retro", "flappy", "reflex", "arcade"], "#267", "#ff2e88", "glyph-dodge"],
    ["retro-defender", "Retro Defender", "Intercept the warheads, save all six cities.", "retro", "MEDIUM", ["retro", "defense", "classic", "missile"], "#267", "#8a5cff", "glyph-targets"],

    ["outrun-drive", "Outrun 2D Drive", "Pseudo-3D synthwave highway with nitro burn.", "racing", "HARD", ["racing", "drive", "speed", "synthwave"], "#318", "#ff2e88", "glyph-dodge"],
    ["cyber-drift", "Cyber Drift", "Break traction and bank the drift multiplier.", "racing", "MEDIUM", ["racing", "drift", "physics", "speed"], "#318", "#2ee6ff", "glyph-collect"],
    ["hyper-speed-dodge", "Hyper Speed Dodge", "First-person wireframe tunnel at terminal velocity.", "racing", "EXPERT", ["racing", "tunnel", "3d", "speed"], "#318", "#ffb42e", "glyph-sequence"],
    ["grid-dash", "Grid Dash", "Beat-locked jumps and slides over laser hazards.", "racing", "HARD", ["racing", "rhythm", "runner", "jump"], "#318", "#8a5cff", "glyph-breakout"],
  ];

  var MANIFEST_OBJ = MANIFEST.map(function (row) {
    return {
      key: row[0],
      title: row[1],
      tagline: row[2],
      cat: row[3],
      catLabel: CATS[row[3]].label,
      gridId: CATS[row[3]].grid,
      diff: row[4],
      tags: row[5],
      hueDeg: row[6],
      color: row[7],
      glyph: row[8],
    };
  });

  window.VortexManifest = MANIFEST_OBJ;
  window.VortexCategories = CATS;

  /* ------------------------------------------------------------------ */
  /* TOASTS                                                             */
  /* ------------------------------------------------------------------ */
  function toast(message, type) {
    var wrap = document.getElementById("toasts");
    if (!wrap) return;
    var el = document.createElement("div");
    el.className = "toast" + (type ? " " + type : "");
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(function () {
      el.classList.add("leaving");
      setTimeout(function () { el.remove(); }, 320);
    }, 3400);
  }
  window.VortexToast = toast;

  /* ------------------------------------------------------------------ */
  /* XP ENGINE — level curve MUST mirror levelFromXp() in src/db/seed.ts */
  /*   level N costs: 100 + 50*(N-1) XP                                 */
  /* ------------------------------------------------------------------ */
  var LS_PROFILE = "vg_profile";

  var XP = {
    xp: 0,
    level: 1,

    load: function () {
      try {
        var raw = localStorage.getItem(LS_PROFILE);
        if (raw) {
          var p = JSON.parse(raw);
          this.xp = Math.max(0, Number(p.xp) || 0);
          this.level = this.levelFromXp(this.xp);
        }
      } catch (e) { this.xp = 0; this.level = 1; }
    },

    save: function () {
      try { localStorage.setItem(LS_PROFILE, JSON.stringify({ xp: this.xp })); } catch (e) { /* ignore */ }
    },

    levelFromXp: function (xp) {
      var level = 1, need = 100, remaining = Math.max(0, Math.floor(xp));
      while (remaining >= need && level < 999) {
        remaining -= need;
        level += 1;
        need = 100 + (level - 1) * 50;
      }
      return level;
    },

    /* progress inside the current level: {into, need} */
    progress: function () {
      var level = 1, need = 100, remaining = Math.max(0, Math.floor(this.xp));
      while (remaining >= need && level < 999) {
        remaining -= need;
        level += 1;
        need = 100 + (level - 1) * 50;
      }
      return { into: remaining, need: need };
    },

    add: function (amount, reason) {
      var gain = Math.max(0, Math.floor(amount));
      if (!gain) return;
      var before = this.level;
      this.xp += gain;
      this.level = this.levelFromXp(this.xp);
      this.save();
      this.render();
      if (this.level > before) this.levelUp(this.level);
      else if (reason) toast("+" + gain + " XP — " + reason);
    },

    /* adopt server balance when it is ahead (post-login sync) */
    adoptServerTotal: function (serverXp) {
      var srv = Math.max(0, Number(serverXp) || 0);
      if (srv > this.xp) {
        this.xp = srv;
        this.level = this.levelFromXp(this.xp);
        this.save();
        this.render();
      }
    },

    render: function () {
      var badge = document.getElementById("level-badge");
      var fill = document.getElementById("xp-fill");
      var text = document.getElementById("xp-text");
      var prog = this.progress();
      if (badge) {
        badge.textContent = "LVL " + this.level;
        badge.classList.toggle("maxed", this.level >= 10);
      }
      if (fill) fill.style.width = Math.min(100, Math.round((prog.into / prog.need) * 100)) + "%";
      if (text) text.textContent = prog.into + " / " + prog.need + " XP";
      this.applyCardGlows();
    },

    /* card glow unlocks — the grid literally levels up with you */
    applyCardGlows: function () {
      var cards = document.querySelectorAll(".game-card-tile");
      var budget = this.level >= 8 ? 8 : this.level >= 5 ? 5 : this.level >= 3 ? 3 : this.level >= 2 ? 1 : 0;
      for (var i = 0; i < cards.length; i++) {
        cards[i].classList.toggle("glow-unlock", i < budget);
      }
    },

    levelUp: function (level) {
      var overlay = document.getElementById("levelup-overlay");
      var label = document.getElementById("levelup-level");
      if (label) label.textContent = "LEVEL " + level;
      if (overlay) {
        overlay.classList.remove("hidden");
        setTimeout(function () { overlay.classList.add("hidden"); }, 1900);
      }
      if (window.VortexAudio) window.VortexAudio.arpUp();
      toast("RANK INCREASE — Level " + level + " unlocked", "warn");
    },
  };

  window.VortexXP = XP;

  /* ------------------------------------------------------------------ */
  /* PUBLIC GAMIFICATION API                                            */
  /* Games / external modules call VortexGamification.addXP(points).    */
  /* ------------------------------------------------------------------ */
  window.VortexGamification = {
    addXP: function (points, reason) { XP.add(points, reason); return XP.xp; },
    getXP: function () { return XP.xp; },
    getLevel: function () { return XP.level; },
    getProgress: function () { return XP.progress(); },
    /** Push a final score to the backend leaderboard (hybrid local-first). */
    submitScore: function (gameKey, score, xpDelta) {
      if (window.VortexDB) return window.VortexDB.submitScore(gameKey, score, xpDelta || 0);
      return Promise.resolve({ saved: false, synced: false });
    },
    toast: toast,
  };

  /* ------------------------------------------------------------------ */
  /* DESTINY SPIN — slot-machine random game launcher                   */
  /* ------------------------------------------------------------------ */
  var Spin = {
    running: false,

    spin: function () {
      if (this.running) return;
      this.running = true;

      var overlay = document.getElementById("spin-overlay");
      var track = document.getElementById("spin-track");
      if (!overlay || !track) { this.running = false; return; }

      overlay.classList.remove("hidden");
      track.classList.remove("landed");

      var winner = MANIFEST_OBJ[Math.floor(Math.random() * MANIFEST_OBJ.length)];
      var start = performance.now();
      var duration = 2600;

      function frame(now) {
        var t = Math.min(1, (now - start) / duration);
        // ease-out cubic: spin fast, settle slow
        var eased = 1 - Math.pow(1 - t, 3);
        var stepMs = 40 + eased * 220;

        if (!frame.last || now - frame.last >= stepMs) {
          frame.last = now;
          var pick = t >= 1 ? winner : MANIFEST_OBJ[Math.floor(Math.random() * MANIFEST_OBJ.length)];
          track.textContent = pick.title;
          if (window.VortexAudio && Math.random() < 0.7) window.VortexAudio.blip(300 + Math.random() * 500, 0.03, "square", 0.03);
        }
        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          track.textContent = winner.title;
          track.classList.add("landed");
          if (window.VortexAudio) window.VortexAudio.arpUp();
          setTimeout(function () {
            overlay.classList.add("hidden");
            Spin.running = false;
            if (window.VortexLaunch) window.VortexLaunch(winner.key);
          }, 1000);
        }
      }
      frame.last = 0;
      requestAnimationFrame(frame);
    },
  };

  window.VortexSpin = Spin;

  /* ------------------------------------------------------------------ */
  /* BOOT                                                               */
  /* ------------------------------------------------------------------ */
  function boot() {
    XP.load();
    XP.render();

    var spinBtn = document.getElementById("btn-spin");
    if (spinBtn) spinBtn.addEventListener("click", function () { Spin.spin(); });
    var spinHero = document.getElementById("btn-spin-hero");
    if (spinHero) spinHero.addEventListener("click", function () { Spin.spin(); });

    // adopt server XP whenever the session refreshes
    if (window.VortexDB) {
      window.VortexDB.onAuthChange(function (user) {
        if (user && typeof user.totalXp === "number") XP.adoptServerTotal(user.totalXp);
      });
      if (window.VortexDB.token) {
        window.VortexDB.refreshMe();
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
