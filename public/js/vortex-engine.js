/* ==========================================================================
   VORTEX GAMING — vortex-engine.js  (Sub-Batch 2B)
   120 FPS rendering core, ambient canvas stage, theme engine, and the
   generative Web Audio player driving the equalizer HUD rail.
   ========================================================================== */
(function () {
  "use strict";

  var DEVICE = window.VortexDevice || { tier: "medium", touch: false };
  var TIER = DEVICE.tier || "medium";

  /* ------------------------------------------------------------------ */
  /* THEME REGISTRY — mirrors the CSS custom properties 1:1             */
  /* ------------------------------------------------------------------ */
  var THEMES = {
    synthwave: { label: "SYNTHWAVE SUNSET", colors: ["#ff2e88", "#2ee6ff", "#ffb42e", "#8a5cff"], bg: "#0b0621" },
    matrix: { label: "MATRIX GLITCH", colors: ["#00ff6a", "#0affc4", "#e8ff47", "#118a4a"], bg: "#020a04" },
    cyberpunk: { label: "CYBERPUNK NEON", colors: ["#00e5ff", "#ffe600", "#ff355e", "#3f7bff"], bg: "#05070f" },
    hyperacid: { label: "HYPER-ACID", colors: ["#b6ff00", "#ff00e5", "#00ffcc", "#ff7b00"], bg: "#0d0214" },
  };

  function hexToRgba(hex, alpha) {
    var h = hex.replace("#", "");
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  /* ================================================================== */
  /* 1. AMBIENT STAGE — high-DPI delta-time particle field              */
  /* ================================================================== */
  var Stage = {
    canvas: null,
    ctx: null,
    dpr: 1,
    w: 0,
    h: 0,
    particles: [],
    themeName: "synthwave",
    running: false,
    lastTime: 0,
    fps: 0,
    fpsFrames: 0,
    fpsLast: 0,
    mouseX: 0.5,
    mouseY: 0.5,
    lineBudget: false,

    particleCount: function () {
      if (TIER === "high") return 130;
      if (TIER === "medium") return 64;
      return 0; // perf-low: static gradient, zero canvas cost
    },

    init: function () {
      this.canvas = document.getElementById("vortex-stage");
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext("2d");
      if (!this.ctx) return;
      this.lineBudget = TIER === "high";

      var savedTheme = null;
      try { savedTheme = localStorage.getItem("vg_theme"); } catch (e) { /* ignore */ }
      this.setTheme(savedTheme && THEMES[savedTheme] ? savedTheme : "synthwave", true);

      window.addEventListener("resize", this.resize.bind(this), { passive: true });
      window.addEventListener("pointermove", this.onPointer.bind(this), { passive: true });
      document.addEventListener("visibilitychange", this.onVisibility.bind(this));

      this.resize();
      this.spawn();
      this.running = true;
      this.lastTime = performance.now();
      this.fpsLast = this.lastTime;
      requestAnimationFrame(this.frame.bind(this));
    },

    onVisibility: function () {
      if (document.hidden) {
        this.running = false;
      } else if (!this.running) {
        this.running = true;
        this.lastTime = performance.now();
        requestAnimationFrame(this.frame.bind(this));
      }
    },

    onPointer: function (e) {
      this.mouseX = e.clientX / Math.max(1, window.innerWidth);
      this.mouseY = e.clientY / Math.max(1, window.innerHeight);
    },

    resize: function () {
      if (!this.canvas) return;
      this.dpr = Math.min(window.devicePixelRatio || 1, TIER === "high" ? 2.5 : 2);
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.canvas.width = Math.floor(this.w * this.dpr);
      this.canvas.height = Math.floor(this.h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    },

    spawn: function () {
      var n = this.particleCount();
      this.particles = [];
      var colors = THEMES[this.themeName].colors;
      for (var i = 0; i < n; i++) {
        this.particles.push({
          x: Math.random() * this.w,
          y: Math.random() * this.h,
          vx: (Math.random() - 0.5) * 14,
          vy: (Math.random() - 0.5) * 14 - 6,
          r: 0.7 + Math.random() * 2.1,
          color: colors[i % colors.length],
          depth: 0.35 + Math.random() * 0.65,
          tw: Math.random() * Math.PI * 2,
        });
      }
    },

    frame: function (currentTime) {
      if (!this.running) return;
      var dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
      this.lastTime = currentTime;

      // FPS meter (EMA over 500ms windows)
      this.fpsFrames++;
      if (currentTime - this.fpsLast >= 500) {
        this.fps = Math.round((this.fpsFrames * 1000) / (currentTime - this.fpsLast));
        this.fpsFrames = 0;
        this.fpsLast = currentTime;
        this.publishStats();
      }

      this.render(dt, currentTime / 1000);
      requestAnimationFrame(this.frame.bind(this));
    },

    render: function (dt, t) {
      var ctx = this.ctx;
      var theme = THEMES[this.themeName];
      ctx.clearRect(0, 0, this.w, this.h);

      // deep-space nebula haze
      var haze = ctx.createRadialGradient(
        this.w * (0.3 + this.mouseX * 0.4), this.h * (0.35 + this.mouseY * 0.3), 60,
        this.w * 0.5, this.h * 0.5, Math.max(this.w, this.h) * 0.85
      );
      haze.addColorStop(0, hexToRgba(theme.colors[3], TIER === "low" ? 0.10 : 0.14));
      haze.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, this.w, this.h);

      var parallaxX = (this.mouseX - 0.5) * 18;
      var parallaxY = (this.mouseY - 0.5) * 12;

      // particles
      for (var i = 0; i < this.particles.length; i++) {
        var p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.tw += dt * 2;

        if (p.x < -20) p.x = this.w + 20;
        if (p.x > this.w + 20) p.x = -20;
        if (p.y < -20) p.y = this.h + 20;
        if (p.y > this.h + 20) p.y = -20;

        var alpha = 0.35 + Math.sin(p.tw) * 0.25;
        var px = p.x + parallaxX * p.depth;
        var py = p.y + parallaxY * p.depth;

        ctx.globalAlpha = Math.max(0.08, alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // connective mesh (high tier only — O(n²) is a luxury)
      if (this.lineBudget) {
        ctx.globalAlpha = 1;
        var limit = 110;
        for (var a = 0; a < this.particles.length; a++) {
          var pa = this.particles[a];
          for (var b = a + 1; b < this.particles.length; b++) {
            var pb = this.particles[b];
            var dx = pa.x - pb.x;
            if (dx > limit || dx < -limit) continue;
            var dy = pa.y - pb.y;
            if (dy > limit || dy < -limit) continue;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < limit) {
              ctx.globalAlpha = (1 - dist / limit) * 0.16;
              ctx.strokeStyle = theme.colors[1];
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(pa.x + parallaxX * pa.depth, pa.y + parallaxY * pa.depth);
              ctx.lineTo(pb.x + parallaxX * pb.depth, pb.y + parallaxY * pb.depth);
              ctx.stroke();
            }
          }
        }
      }
      ctx.globalAlpha = 1;
    },

    publishStats: function () {
      if (!this.fps) return;   // wait for a real sample — never show "0 FPS"
      var el = document.getElementById("fps-readout");
      if (el) el.textContent = this.fps + " FPS";
      var hero = document.getElementById("stat-fps");
      if (hero) hero.textContent = this.fps + " FPS";
      var footer = document.getElementById("footer-render");
      if (footer) footer.textContent = "Render core: " + this.fps + " FPS @ " + this.dpr + "x DPR";
    },

    setTheme: function (name, silent) {
      if (!THEMES[name]) return;
      this.themeName = name;
      document.documentElement.setAttribute("data-theme", name);
      try { localStorage.setItem("vg_theme", name); } catch (e) { /* ignore */ }
      var label = document.getElementById("theme-name");
      if (label) label.textContent = THEMES[name].label;
      var dots = document.querySelectorAll(".theme-dot");
      for (var i = 0; i < dots.length; i++) {
        dots[i].classList.toggle("active", dots[i].getAttribute("data-theme") === name);
      }
      // recolor existing particles gradually
      var colors = THEMES[name].colors;
      for (var j = 0; j < this.particles.length; j++) {
        this.particles[j].color = colors[(j + (silent ? 0 : Math.floor(Math.random() * colors.length))) % colors.length];
      }
    },
  };

  /* ================================================================== */
  /* 2. VORTEX AUDIO — generative synthwave loop + analyser equalizer   */
  /* ================================================================== */
  var AudioEngine = {
    ctx: null,
    master: null,
    analyser: null,
    playing: false,
    tempo: 104,
    step: 0,
    nextStepTime: 0,
    schedulerTimer: null,
    eqCanvas: null,
    eqCtx: null,
    eqRunning: false,
    noiseBuffer: null,

    // A-minor progression: Am, F, C, G (root freqs)
    bassline: [55.0, 55.0, 43.65, 43.65, 65.41, 65.41, 49.0, 49.0],
    arpScale: [220.0, 261.63, 329.63, 392.0, 440.0, 523.25],

    ensureCtx: function () {
      if (this.ctx) return true;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.8;
      this.master.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // shared white-noise buffer for hats / explosions
      var len = this.ctx.sampleRate * 1;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var data = this.noiseBuffer.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      return true;
    },

    toggle: function () {
      if (!this.ensureCtx()) return;
      if (this.ctx.state === "suspended") this.ctx.resume();
      if (this.playing) this.stop();
      else this.start();
    },

    start: function () {
      if (!this.ensureCtx()) return;
      if (this.ctx.state === "suspended") this.ctx.resume();
      this.playing = true;
      this.step = 0;
      this.nextStepTime = this.ctx.currentTime + 0.06;
      var self = this;
      this.schedulerTimer = setInterval(function () { self.scheduler(); }, 25);
      this.updateButtons();
      this.startEq();
    },

    stop: function () {
      this.playing = false;
      if (this.schedulerTimer) {
        clearInterval(this.schedulerTimer);
        this.schedulerTimer = null;
      }
      this.updateButtons();
    },

    updateButtons: function () {
      var hudBtn = document.getElementById("btn-hud-audio");
      if (hudBtn) {
        hudBtn.classList.toggle("playing", this.playing);
        var play = hudBtn.querySelector(".ic-play");
        var pause = hudBtn.querySelector(".ic-pause");
        if (play) play.classList.toggle("hidden", this.playing);
        if (pause) pause.classList.toggle("hidden", !this.playing);
      }
      var navBtn = document.getElementById("btn-audio");
      if (navBtn) navBtn.classList.toggle("muted", !this.playing);
    },

    scheduler: function () {
      if (!this.playing || !this.ctx) return;
      var stepDur = 60 / this.tempo / 4; // 16th notes
      while (this.nextStepTime < this.ctx.currentTime + 0.12) {
        this.scheduleStep(this.step, this.nextStepTime, stepDur);
        this.step = (this.step + 1) % 64;
        this.nextStepTime += stepDur;
      }
    },

    scheduleStep: function (step, time, stepDur) {
      var bar = Math.floor(step / 16) % 4;
      var sixteenth = step % 16;

      // bass — driving 8ths
      if (sixteenth % 2 === 0) {
        var bassFreq = this.bassline[bar * 2];
        this.tone({ freq: bassFreq, type: "sawtooth", time: time, dur: stepDur * 1.9, gain: 0.24, filterFreq: 420, filterQ: 6 });
      }
      // arp — 16th neon arpeggio
      var arpIdx = (step * 3 + bar) % this.arpScale.length;
      this.tone({ freq: this.arpScale[arpIdx] * (bar >= 2 ? 2 : 1), type: "square", time: time, dur: stepDur * 0.9, gain: 0.055, filterFreq: 2600, filterQ: 2 });
      // hats — offbeat ticks
      if (sixteenth % 4 === 2) this.hat(time, 0.05);
      // kick — four on the floor
      if (sixteenth % 4 === 0) this.kick(time);
      // pad — bar-length chord swell
      if (sixteenth === 0) {
        var root = this.bassline[bar * 2] * 4;
        this.pad(root, time, stepDur * 16);
        this.pad(root * Math.pow(2, 3 / 12), time, stepDur * 16); // minor 3rd
        this.pad(root * Math.pow(2, 7 / 12), time, stepDur * 16); // perfect 5th
      }
    },

    tone: function (opts) {
      if (!this.ctx || !this.master) return;
      var osc = this.ctx.createOscillator();
      var gain = this.ctx.createGain();
      var filter = this.ctx.createBiquadFilter();
      osc.type = opts.type || "sine";
      osc.frequency.value = opts.freq;
      filter.type = "lowpass";
      filter.frequency.value = opts.filterFreq || 4000;
      filter.Q.value = opts.filterQ || 1;
      gain.gain.setValueAtTime(0.0001, opts.time);
      gain.gain.linearRampToValueAtTime(opts.gain, opts.time + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, opts.time + opts.dur);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      osc.start(opts.time);
      osc.stop(opts.time + opts.dur + 0.05);
    },

    pad: function (freq, time, dur) {
      if (!this.ctx || !this.master) return;
      var osc = this.ctx.createOscillator();
      var gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 14;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(0.035, time + dur * 0.35);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(time);
      osc.stop(time + dur + 0.05);
    },

    hat: function (time, vol) {
      if (!this.ctx || !this.master || !this.noiseBuffer) return;
      var src = this.ctx.createBufferSource();
      var gain = this.ctx.createGain();
      var filter = this.ctx.createBiquadFilter();
      src.buffer = this.noiseBuffer;
      filter.type = "highpass";
      filter.frequency.value = 7500;
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(time);
      src.stop(time + 0.06);
    },

    kick: function (time) {
      if (!this.ctx || !this.master) return;
      var osc = this.ctx.createOscillator();
      var gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(130, time);
      osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);
      gain.gain.setValueAtTime(0.32, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(time);
      osc.stop(time + 0.26);
    },

    /* -------- shared game SFX (used by all VortexFX game modules) -------- */
    blip: function (freq, dur, type, vol) {
      if (!this.ctx || !this.master) return;
      if (this.ctx.state === "suspended") this.ctx.resume();
      var now = this.ctx.currentTime;
      this.tone({ freq: freq || 880, type: type || "square", time: now, dur: dur || 0.08, gain: vol || 0.08, filterFreq: 6000 });
    },

    arpUp: function () {
      if (!this.ctx) return;
      var now = this.ctx.currentTime;
      var notes = [440, 554.37, 659.25, 880];
      for (var i = 0; i < notes.length; i++) {
        this.tone({ freq: notes[i], type: "triangle", time: now + i * 0.07, dur: 0.16, gain: 0.1, filterFreq: 5000 });
      }
    },

    explosion: function () {
      if (!this.ctx || !this.master || !this.noiseBuffer) return;
      if (this.ctx.state === "suspended") this.ctx.resume();
      var now = this.ctx.currentTime;
      var src = this.ctx.createBufferSource();
      var gain = this.ctx.createGain();
      var filter = this.ctx.createBiquadFilter();
      src.buffer = this.noiseBuffer;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2600, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.4);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(now);
      src.stop(now + 0.5);
    },

    /* ------------------ equalizer HUD renderer ------------------- */
    startEq: function () {
      this.eqCanvas = document.getElementById("eq-canvas");
      if (!this.eqCanvas) return;
      this.eqCtx = this.eqCanvas.getContext("2d");
      if (!this.eqCtx) return;
      if (!this.eqRunning) {
        this.eqRunning = true;
        requestAnimationFrame(this.eqFrame.bind(this));
      }
    },

    eqFrame: function () {
      var self = AudioEngine;
      if (!self.eqCanvas || !self.eqCtx) return;
      var ctx = self.eqCtx;
      var w = self.eqCanvas.width;
      var h = self.eqCanvas.height;
      ctx.clearRect(0, 0, w, h);

      var bars = 26;
      var gap = 2;
      var barW = (w - gap * (bars - 1)) / bars;
      var t = performance.now() / 1000;

      var theme = THEMES[Stage.themeName] || THEMES.synthwave;
      var freqData = null;
      if (self.playing && self.analyser) {
        freqData = new Uint8Array(self.analyser.frequencyBinCount);
        self.analyser.getByteFrequencyData(freqData);
      }

      for (var i = 0; i < bars; i++) {
        var value;
        if (freqData) {
          var bin = Math.floor((i / bars) * freqData.length * 0.72);
          value = freqData[bin] / 255;
        } else {
          // idle bounce so the rail always feels alive
          value = 0.14 + Math.abs(Math.sin(t * 2.2 + i * 0.44)) * 0.14 * (0.5 + 0.5 * Math.sin(t * 0.7 + i));
        }
        var barH = Math.max(2, value * h);
        var x = i * (barW + gap);
        var grad = ctx.createLinearGradient(0, h - barH, 0, h);
        grad.addColorStop(0, theme.colors[0]);
        grad.addColorStop(1, theme.colors[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(x, h - barH, barW, barH);
      }
      if (self.eqRunning) requestAnimationFrame(self.eqFrame.bind(self));
    },

    getThemeColors: function () {
      return THEMES[Stage.themeName].colors;
    },
  };

  /* ------------------------------------------------------------------ */
  /* FALLBACK FPS METER — the render-core readouts must resolve into     */
  /* live numbers even when the ambient stage canvas is unavailable.     */
  /* ------------------------------------------------------------------ */
  function startFallbackFpsMeter() {
    var frames = 0;
    var last = performance.now();
    var published = false;

    function tick(now) {
      frames++;
      if (now - last >= 500) {
        Stage.fps = Math.round((frames * 1000) / (now - last));
        frames = 0;
        last = now;
        Stage.publishStats();
        published = true;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // last-resort stable value if rAF is heavily throttled
    setTimeout(function () {
      if (!published) {
        Stage.fps = Stage.fps || 0;
        Stage.publishStats();
      }
    }, 2200);
  }

  /* ------------------------------------------------------------------ */
  /* BOOT                                                               */
  /* ------------------------------------------------------------------ */
  function boot() {
    Stage.init();
    if (!Stage.running) startFallbackFpsMeter();

    // theme switcher
    var dots = document.querySelectorAll(".theme-dot");
    for (var i = 0; i < dots.length; i++) {
      (function (dot) {
        dot.addEventListener("click", function () {
          Stage.setTheme(dot.getAttribute("data-theme"));
          AudioEngine.blip(660, 0.06, "triangle", 0.06);
        });
      })(dots[i]);
    }

    // audio toggles
    var hudBtn = document.getElementById("btn-hud-audio");
    if (hudBtn) {
      hudBtn.addEventListener("click", function () { AudioEngine.toggle(); });
    }
    var navBtn = document.getElementById("btn-audio");
    if (navBtn) {
      navBtn.addEventListener("click", function () { AudioEngine.toggle(); });
    }
    AudioEngine.updateButtons();
    AudioEngine.startEq(); // idle bounce immediately

    // first user gesture anywhere unlocks/resumes audio context
    document.addEventListener("pointerdown", function unlock() {
      if (AudioEngine.ctx && AudioEngine.ctx.state === "suspended") AudioEngine.ctx.resume();
      document.removeEventListener("pointerdown", unlock);
    }, { once: true });
  }

  window.VortexStage = Stage;
  window.VortexAudio = AudioEngine;
  window.VortexThemes = THEMES;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
