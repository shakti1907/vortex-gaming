/* ==========================================================================
   VORTEX GAMING — vortex-fx.js
   Centralized "game juice" core shared by all 16 titles.

     · VortexFX.boot(env, cfg)  — HiDPI canvas + delta-time loop + cleanup
     · VortexFX.Scene           — particles, sparks, trails, shake, popups
     · VortexFX.Draw            — neon vector helpers (bloom + additive)
     · VortexFX.Input           — WASD / Arrows / #dpad / pointer, unified

   Every loop is cancellable; every listener is removed on destroy().
   ========================================================================== */
(function () {
  "use strict";

  var DEVICE = window.VortexDevice || { tier: "medium", touch: false };
  var TIER = DEVICE.tier || "medium";
  var GLOW = TIER !== "low";

  /* ------------------------------------------------------------------ */
  /* THEME PALETTE                                                      */
  /* ------------------------------------------------------------------ */
  function palette() {
    if (window.VortexThemes && window.VortexStage) {
      return window.VortexThemes[window.VortexStage.themeName].colors;
    }
    return ["#ff2e88", "#2ee6ff", "#ffb42e", "#8a5cff"];
  }

  function hexToRgb(hex) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return {
      r: parseInt(h.substring(0, 2), 16) || 0,
      g: parseInt(h.substring(2, 4), 16) || 0,
      b: parseInt(h.substring(4, 6), 16) || 0,
    };
  }

  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return "rgba(" + c.r + "," + c.g + "," + c.b + "," + a + ")";
  }

  /* ------------------------------------------------------------------ */
  /* NEON DRAW HELPERS — multi-layer bloom on vector paths              */
  /* ------------------------------------------------------------------ */
  var Draw = {
    glow: function (ctx, color, blur) {
      if (GLOW) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
    },
    noGlow: function (ctx) { ctx.shadowBlur = 0; },

    /** Stroke the current path twice: wide soft halo + crisp hot core. */
    neonStroke: function (ctx, color, width, blur) {
      if (GLOW) {
        ctx.shadowColor = color;
        ctx.shadowBlur = blur === undefined ? 14 : blur;
        ctx.strokeStyle = rgba(color, 0.55);
        ctx.lineWidth = (width || 2) * 2.4;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.strokeStyle = color;
      ctx.lineWidth = width || 2;
      ctx.stroke();
    },

    neonFill: function (ctx, color, blur) {
      Draw.glow(ctx, color, blur === undefined ? 14 : blur);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.shadowBlur = 0;
    },

    circle: function (ctx, x, y, r, color, filled, width) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
      if (filled) Draw.neonFill(ctx, color);
      else Draw.neonStroke(ctx, color, width || 2);
    },

    line: function (ctx, x1, y1, x2, y2, color, width, blur) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      Draw.neonStroke(ctx, color, width || 2, blur);
    },

    rect: function (ctx, x, y, w, h, color, filled, r) {
      ctx.beginPath();
      if (r && ctx.roundRect) ctx.roundRect(x, y, w, h, r);
      else ctx.rect(x, y, w, h);
      if (filled) Draw.neonFill(ctx, color);
      else Draw.neonStroke(ctx, color, 2);
    },

    /** Closed polygon from [[x,y],...] in local space, rotated + translated. */
    poly: function (ctx, pts, x, y, rot, color, filled, width) {
      ctx.save();
      ctx.translate(x, y);
      if (rot) ctx.rotate(rot);
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]);
        else ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.closePath();
      if (filled) Draw.neonFill(ctx, color);
      else Draw.neonStroke(ctx, color, width || 2);
      ctx.restore();
    },

    text: function (ctx, str, x, y, size, color, align, weight, font) {
      ctx.save();
      ctx.font = (weight || 700) + " " + size + "px " + (font || "'Orbitron', sans-serif");
      ctx.textAlign = align || "left";
      ctx.textBaseline = "middle";
      Draw.glow(ctx, color, 10);
      ctx.fillStyle = color;
      ctx.fillText(str, x, y);
      ctx.restore();
    },

    /** Subtle animated grid floor used by several titles. */
    grid: function (ctx, w, h, size, color, offset, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha === undefined ? 0.1 : alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      var off = offset || 0;
      for (var x = -size + (off % size); x < w + size; x += size) {
        ctx.moveTo(x, 0); ctx.lineTo(x, h);
      }
      for (var y = -size + (off % size); y < h + size; y += size) {
        ctx.moveTo(0, y); ctx.lineTo(w, y);
      }
      ctx.stroke();
      ctx.restore();
    },

    /** HUD chip in the canvas corner. */
    hud: function (ctx, str, x, y, color, align, size) {
      ctx.save();
      ctx.font = "600 " + (size || 13) + "px 'JetBrains Mono', monospace";
      ctx.textAlign = align || "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = rgba(color, 0.92);
      ctx.fillText(str, x, y);
      ctx.restore();
    },
  };

  /* ------------------------------------------------------------------ */
  /* SCENE — particles / trails / shake / floating text                 */
  /* ------------------------------------------------------------------ */
  function Scene() {
    this.parts = [];
    this.trails = [];
    this.pops = [];
    this.shakeAmt = 0;
    this.flashAmt = 0;
    this.flashColor = "#ffffff";
    this.cap = TIER === "high" ? 520 : TIER === "medium" ? 260 : 90;
  }

  Scene.prototype._push = function (p) {
    if (this.parts.length < this.cap) this.parts.push(p);
  };

  /** Radial explosion. opts: {count, color(s), speed, life, size, gravity} */
  Scene.prototype.burst = function (x, y, opts) {
    opts = opts || {};
    var colors = opts.colors || [opts.color || palette()[0]];
    var count = Math.round((opts.count || 18) * (TIER === "low" ? 0.4 : TIER === "medium" ? 0.7 : 1));
    var speed = opts.speed || 190;
    for (var i = 0; i < count; i++) {
      var a = opts.angle !== undefined
        ? opts.angle + (Math.random() - 0.5) * (opts.spread || Math.PI * 2)
        : Math.random() * Math.PI * 2;
      var s = speed * (0.35 + Math.random() * 0.85);
      this._push({
        x: x, y: y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        age: 0, life: (opts.life || 0.55) * (0.6 + Math.random() * 0.7),
        r: (opts.size || 2.4) * (0.5 + Math.random()),
        color: colors[(Math.random() * colors.length) | 0],
        g: opts.gravity || 0,
        drag: opts.drag === undefined ? 0.93 : opts.drag,
      });
    }
  };

  /** Directional hit sparks (impact feedback). */
  Scene.prototype.spark = function (x, y, angle, opts) {
    opts = opts || {};
    this.burst(x, y, {
      count: opts.count || 9,
      colors: opts.colors || [opts.color || "#ffffff", palette()[2]],
      speed: opts.speed || 230,
      life: 0.3,
      size: 1.8,
      angle: angle,
      spread: opts.spread || 1.5,
      drag: 0.9,
    });
  };

  /** Soft motion trail dot — cheap, drawn additively and faded. */
  Scene.prototype.trail = function (x, y, color, size, life) {
    if (TIER === "low") return;
    if (this.trails.length > this.cap) this.trails.shift();
    this.trails.push({ x: x, y: y, r: size || 5, color: color, age: 0, life: life || 0.38 });
  };

  /** Floating combat text: "+100", "COMBO x3", "CRITICAL". */
  Scene.prototype.popup = function (x, y, text, color, size) {
    if (this.pops.length > 24) this.pops.shift();
    this.pops.push({
      x: x, y: y, text: String(text), color: color || palette()[2],
      size: size || 16, age: 0, life: 0.95, vy: -46,
    });
  };

  Scene.prototype.shake = function (amount) {
    this.shakeAmt = Math.min(26, this.shakeAmt + amount);
  };

  Scene.prototype.flash = function (color, amount) {
    this.flashColor = color;
    this.flashAmt = Math.min(1, this.flashAmt + (amount === undefined ? 0.5 : amount));
  };

  Scene.prototype.update = function (dt) {
    var i, p;
    for (i = this.parts.length - 1; i >= 0; i--) {
      p = this.parts[i];
      p.age += dt;
      if (p.age >= p.life) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      var d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
    }
    for (i = this.trails.length - 1; i >= 0; i--) {
      p = this.trails[i];
      p.age += dt;
      if (p.age >= p.life) this.trails.splice(i, 1);
    }
    for (i = this.pops.length - 1; i >= 0; i--) {
      p = this.pops[i];
      p.age += dt;
      p.y += p.vy * dt;
      p.vy *= Math.pow(0.9, dt * 60);
      if (p.age >= p.life) this.pops.splice(i, 1);
    }
    this.shakeAmt *= Math.pow(0.0025, dt);
    if (this.shakeAmt < 0.05) this.shakeAmt = 0;
    this.flashAmt = Math.max(0, this.flashAmt - dt * 2.6);
  };

  Scene.prototype.shakeOffset = function () {
    if (!this.shakeAmt) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.shakeAmt * 2,
      y: (Math.random() - 0.5) * this.shakeAmt * 2,
    };
  };

  /** Additive pass: trails under particles under popups. */
  Scene.prototype.draw = function (ctx) {
    var i, p, k;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (i = 0; i < this.trails.length; i++) {
      p = this.trails[i];
      k = 1 - p.age / p.life;
      ctx.globalAlpha = k * 0.5;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * k, 0, Math.PI * 2);
      ctx.fill();
    }

    for (i = 0; i < this.parts.length; i++) {
      p = this.parts[i];
      k = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.4, p.r * (0.3 + k * 0.7)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    for (i = 0; i < this.pops.length; i++) {
      p = this.pops[i];
      k = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.6));
      ctx.font = "800 " + p.size + "px 'Orbitron', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (GLOW) { ctx.shadowColor = p.color; ctx.shadowBlur = 12; }
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.restore();
  };

  /** Full-screen damage/impact flash — drawn after everything. */
  Scene.prototype.drawFlash = function (ctx, w, h) {
    if (this.flashAmt <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.flashAmt * 0.35;
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(-40, -40, w + 80, h + 80);
    ctx.restore();
  };

  Scene.prototype.clear = function () {
    this.parts.length = 0;
    this.trails.length = 0;
    this.pops.length = 0;
    this.shakeAmt = 0;
    this.flashAmt = 0;
  };

  /* ------------------------------------------------------------------ */
  /* INPUT — WASD / Arrows / #dpad / pointer, unified & edge-detected    */
  /* ------------------------------------------------------------------ */
  var KEYMAP = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right",
    W: "up", S: "down", A: "left", D: "right",
    " ": "action", Enter: "action", z: "action", Z: "action",
    Shift: "dash", x: "dash", X: "dash", Control: "dash",
    q: "swap", Q: "swap", e: "swap", E: "swap", Tab: "swap",
  };

  function Input(canvas, view) {
    var self = this;
    this.keys = {};
    this.edge = {};
    this.pointer = { x: 0, y: 0, down: false, moved: false };
    this.taps = [];
    this.canvas = canvas;
    this.view = view;

    this.kd = function (e) {
      var n = KEYMAP[e.key];
      if (!n) return;
      if (e.key === " " || e.key.indexOf("Arrow") === 0 || e.key === "Tab") e.preventDefault();
      if (!self.keys[n]) self.edge[n] = true;
      self.keys[n] = true;
    };
    this.ku = function (e) {
      var n = KEYMAP[e.key];
      if (n) self.keys[n] = false;
    };
    this.dpadDown = function (e) {
      if (!e.detail || !e.detail.dir) return;
      var n = e.detail.dir;
      if (!self.keys[n]) self.edge[n] = true;
      self.keys[n] = true;
    };
    this.dpadUp = function (e) {
      if (e.detail && e.detail.dir) self.keys[e.detail.dir] = false;
    };

    function toLocal(e) {
      var r = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (view.w / Math.max(1, r.width)),
        y: (e.clientY - r.top) * (view.h / Math.max(1, r.height)),
      };
    }
    this.pd = function (e) {
      var p = toLocal(e);
      self.pointer.x = p.x; self.pointer.y = p.y;
      self.pointer.down = true;
      self.taps.push({ x: p.x, y: p.y });
      if (self.taps.length > 8) self.taps.shift();
      if (canvas.setPointerCapture && e.pointerId !== undefined) {
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      }
    };
    this.pm = function (e) {
      var p = toLocal(e);
      self.pointer.x = p.x; self.pointer.y = p.y;
      self.pointer.moved = true;
    };
    this.pu = function () { self.pointer.down = false; };

    window.addEventListener("keydown", this.kd);
    window.addEventListener("keyup", this.ku);
    window.addEventListener("vortex-dir", this.dpadDown);
    window.addEventListener("vortex-dir-up", this.dpadUp);
    canvas.addEventListener("pointerdown", this.pd);
    canvas.addEventListener("pointermove", this.pm);
    window.addEventListener("pointerup", this.pu);
    canvas.addEventListener("contextmenu", preventCtx);
  }
  function preventCtx(e) { e.preventDefault(); }

  /** True once per physical press. */
  Input.prototype.pressed = function (name) {
    if (this.edge[name]) { this.edge[name] = false; return true; }
    return false;
  };
  Input.prototype.held = function (name) { return !!this.keys[name]; };
  /** Horizontal / vertical axes from keys (-1..1). */
  Input.prototype.axisX = function () { return (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0); };
  Input.prototype.axisY = function () { return (this.keys.down ? 1 : 0) - (this.keys.up ? 1 : 0); };
  /** Consume queued taps. */
  Input.prototype.takeTaps = function () {
    var t = this.taps;
    this.taps = [];
    return t;
  };
  Input.prototype.clearEdges = function () { this.edge = {}; };
  Input.prototype.destroy = function () {
    window.removeEventListener("keydown", this.kd);
    window.removeEventListener("keyup", this.ku);
    window.removeEventListener("vortex-dir", this.dpadDown);
    window.removeEventListener("vortex-dir-up", this.dpadUp);
    this.canvas.removeEventListener("pointerdown", this.pd);
    this.canvas.removeEventListener("pointermove", this.pm);
    window.removeEventListener("pointerup", this.pu);
    this.canvas.removeEventListener("contextmenu", preventCtx);
  };

  /* ------------------------------------------------------------------ */
  /* BOOT HARNESS — HiDPI canvas, dt loop, combo/score, safe teardown    */
  /* ------------------------------------------------------------------ */
  function boot(env, cfg) {
    var canvas = env.canvas;
    var ctx = canvas.getContext("2d", { alpha: true });
    var view = { w: 0, h: 0, dpr: 1, glow: GLOW, tier: TIER };

    function measure() {
      var p = canvas.parentElement;
      var w = Math.max(280, p ? p.clientWidth : 800);
      var h = Math.max(200, p ? p.clientHeight : 480);
      var dpr = Math.min(window.devicePixelRatio || 1, TIER === "high" ? 2.5 : 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      view.w = w; view.h = h; view.dpr = dpr;
    }
    measure();

    var fx = new Scene();
    var input = new Input(canvas, view);
    var audio = env.audio || null;

    var state = {
      score: 0, combo: 0, comboTimer: 0, over: false, dead: false,
      paused: !!document.hidden,
      elapsed: 0, best: 0,
    };

    /* Passive global focus guard: freezes simulation and the game clock while
       hidden. No game-specific code is touched, and no synthetic input fires. */
    var onVisibility = function () {
      state.paused = !!document.hidden;
      if (state.paused) {
        input.keys = {};
        input.edge = {};
      }
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);

    var api = {
      view: view, fx: fx, input: input, ctx: ctx, env: env,
      colors: palette(),
      device: DEVICE,
      audio: audio,
      state: state,
      data: {},   // per-game scratch space

      /* ---- scoring & juice ---- */
      addScore: function (n, x, y, label) {
        state.score += Math.round(n);
        env.onScore(state.score);
        if (x !== undefined && y !== undefined) {
          fx.popup(x, y, label || "+" + Math.round(n), api.colors[2]);
        }
        return state.score;
      },
      /** Scoring with an escalating combo multiplier + popup ladder. */
      hit: function (n, x, y) {
        state.combo++;
        state.comboTimer = 2.2;
        var mult = 1 + Math.floor(state.combo / 5) * 0.5;
        var gain = Math.round(n * mult);
        state.score += gain;
        env.onScore(state.score);
        if (x !== undefined) {
          if (state.combo >= 5 && state.combo % 5 === 0) {
            fx.popup(x, y - 18, "COMBO x" + mult.toFixed(1), api.colors[0], 18);
            if (audio) audio.blip(880 + state.combo * 12, 0.07, "square", 0.07);
          }
          fx.popup(x, y, "+" + gain, api.colors[2]);
        }
        return gain;
      },
      breakCombo: function () { state.combo = 0; state.comboTimer = 0; },
      xp: function (n) { env.onXp(n); },

      /* ---- lifecycle ---- */
      gameOver: function (delay) {
        if (state.over) return;
        state.over = true;
        fx.shake(16);
        fx.flash("#ff2b5e", 0.7);
        if (audio) audio.explosion();
        setTimeout(function () {
          if (!state.dead) env.onGameOver(state.score);
        }, delay === undefined ? 700 : delay);
      },
      win: function (bonus) {
        if (state.over) return;
        state.over = true;
        if (bonus) api.addScore(bonus, view.w / 2, view.h / 2, "+" + bonus + " CLEAR");
        if (audio) audio.arpUp();
        setTimeout(function () {
          if (!state.dead) env.onGameOver(state.score, "WON");
        }, 900);
      },
      sfx: function (f, d, t, v) { if (audio) audio.blip(f, d || 0.07, t || "square", v || 0.06); },
    };

    if (cfg.setup) cfg.setup(api);

    var rafId = 0;
    var last = performance.now();

    function frame(now) {
      if (state.dead) return;
      // Clamp to [0, 0.1]: guards against tab-restore spikes AND any
      // non-monotonic timestamp, which would otherwise poison the physics.
      var dt = state.paused ? 0 : Math.min(Math.max((now - last) / 1000, 0), 0.1);
      last = now;
      state.elapsed += dt;

      if (!state.paused && state.comboTimer > 0) {
        state.comboTimer -= dt;
        if (state.comboTimer <= 0) state.combo = 0;
      }

      if (!state.paused && !state.over && cfg.update) cfg.update(dt, state.elapsed, api);
      if (!state.paused) fx.update(dt);

      ctx.save();
      ctx.clearRect(0, 0, view.w, view.h);
      var s = fx.shakeOffset();
      ctx.translate(s.x, s.y);
      if (cfg.draw) cfg.draw(ctx, state.elapsed, api);
      fx.draw(ctx);
      fx.drawFlash(ctx, view.w, view.h);
      ctx.restore();

      input.clearEdges();
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    var onResize = function () {
      measure();
      if (cfg.resize) cfg.resize(api);
    };
    window.addEventListener("resize", onResize);

    api.destroy = function () {
      state.dead = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      input.destroy();
      if (cfg.teardown) { try { cfg.teardown(api); } catch (e) { /* noop */ } }
      fx.clear();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    return api;
  }

  /* ------------------------------------------------------------------ */
  /* SMALL MATH UTILITIES shared by the game modules                    */
  /* ------------------------------------------------------------------ */
  var Util = {
    clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    dist: function (x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
    rand: function (a, b) { return a + Math.random() * (b - a); },
    randInt: function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
    pick: function (arr) { return arr[(Math.random() * arr.length) | 0]; },
    circleHit: function (ax, ay, ar, bx, by, br) {
      var dx = ax - bx, dy = ay - by, r = ar + br;
      return dx * dx + dy * dy < r * r;
    },
    rectHit: function (ax, ay, aw, ah, bx, by, bw, bh) {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    },
    /** Approach target with frame-rate independent smoothing. */
    damp: function (cur, target, lambda, dt) {
      return Util.lerp(cur, target, 1 - Math.exp(-lambda * dt));
    },
  };

  /** Registry helper so every game module declares itself identically. */
  function register(def) {
    window.VortexGames = window.VortexGames || {};
    window.VortexGames[def.key] = {
      key: def.key,
      title: def.title,
      hint: def.hint,
      pad: def.pad !== false,
      init: function (env) {
        var api = boot(env, def);
        return {
          destroy: function () { api.destroy(); },
          getScore: function () { return api.state.score; },
          /** Debug/telemetry accessor — used by scripts/game-harness.js. */
          getState: function () { return api.data; },
          getHarnessState: function () { return api.state; },
        };
      },
    };
  }

  window.VortexFX = {
    boot: boot,
    register: register,
    Scene: Scene,
    Input: Input,
    Draw: Draw,
    Util: Util,
    palette: palette,
    rgba: rgba,
    tier: TIER,
    glow: GLOW,
  };
})();

