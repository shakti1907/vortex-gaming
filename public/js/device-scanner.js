/* ==========================================================================
   VORTEX GAMING — device-scanner.js  (Sub-Batch 2A)
   Hardware benchmark & auto-scaling engine.
   - 250ms canvas micro-benchmark measuring render latency
   - hardwareConcurrency / deviceMemory probing
   - Attaches .perf-low | .perf-medium | .perf-high to <html>
   ========================================================================== */
(function () {
  "use strict";

  var docEl = document.documentElement;

  function getCores() {
    return typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : 2;
  }

  function getMemory() {
    // deviceMemory is Chromium-only; treat "unknown" as 4GB (mid-tier).
    return typeof navigator.deviceMemory === "number" ? navigator.deviceMemory : 4;
  }

  function isCoarsePointer() {
    return window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  }

  /**
   * 250ms micro-benchmark: runs a tight loop of alternating canvas ops inside
   * a 128x128 scratch canvas, then measures how many full iterations we can
   * push per millisecond. GPU-accelerated contexts score dramatically higher.
   */
  function canvasBenchmark(durationMs) {
    var canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    var ctx = canvas.getContext("2d");
    if (!ctx) return 0;

    var ops = 0;
    var start = performance.now();
    var elapsed = 0;

    try {
      while (elapsed < durationMs) {
        for (var i = 0; i < 24; i++) {
          var g = ctx.createLinearGradient(0, 0, 128, 128);
          g.addColorStop(0, "hsl(" + (ops % 360) + ",90%,55%)");
          g.addColorStop(1, "rgba(0,0,0,0.2)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(64, 64, 20 + (ops % 30), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalCompositeOperation = ops % 2 ? "lighter" : "source-over";
          ops++;
        }
        elapsed = performance.now() - start;
      }
    } catch (err) {
      return 0;
    }

    // Force flush of queued GPU work, then measure.
    try {
      ctx.getImageData(0, 0, 1, 1);
    } catch (err) {
      /* some sandboxed contexts disallow reads — latency estimate still valid */
    }
    var total = performance.now() - start;
    return total > 0 ? ops / total : 0; // ops per millisecond
  }

  function probeMaxTouchPoints() {
    return typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : 0;
  }

  function classify() {
    var cores = getCores();
    var mem = getMemory();
    var dpr = window.devicePixelRatio || 1;
    var coarse = isCoarsePointer();
    var smallScreen = Math.min(window.screen.width, window.screen.height) < 760;
    var reducedMotion = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

    var bench = 0;
    try {
      bench = canvasBenchmark(250);
    } catch (err) {
      bench = 0;
    }

    var score = 0;
    if (cores >= 8) score += 2;
    else if (cores >= 4) score += 1;

    if (mem >= 8) score += 2;
    else if (mem >= 4) score += 1;

    if (bench > 90) score += 3;
    else if (bench > 40) score += 2;
    else if (bench > 12) score += 1;

    if (dpr >= 2.5) score -= 1; // very high-DPI panels cost fill-rate
    if (coarse && smallScreen) score -= 2; // budget mobile safeguard

    var tier = "medium";
    if (score <= 2) tier = "low";
    else if (score >= 6) tier = "high";

    if (reducedMotion) tier = "low"; // accessibility wins over raw power

    return {
      tier: tier,
      score: score,
      cores: cores,
      memory: mem,
      dpr: dpr,
      benchOpsPerMs: Math.round(bench * 100) / 100,
      coarsePointer: coarse,
      smallScreen: smallScreen,
      reducedMotion: reducedMotion,
      touch: coarse || probeMaxTouchPoints() > 0,
    };
  }

  var profile = classify();

  // Attach the perf profile class immediately so CSS degradation rules apply
  // before first paint.
  docEl.classList.remove("perf-low", "perf-medium", "perf-high");
  docEl.classList.add("perf-" + profile.tier);

  window.VortexDevice = profile;

  // Resolve the hardware readouts the moment the profile exists — these must
  // never be left stuck on "SCANNING", regardless of any later module state.
  (function publishProfile() {
    var label = profile.tier.toUpperCase() + " TIER";
    var perf = document.getElementById("perf-readout");
    if (perf) perf.textContent = label;
    var heroPerf = document.getElementById("stat-perf");
    if (heroPerf) heroPerf.textContent = label;
    var footerHw = document.getElementById("footer-hw");
    if (footerHw) {
      footerHw.textContent = "Hardware profile: " + label + " · " + profile.cores +
        " cores · " + profile.memory + "GB · DPR " + profile.dpr;
    }
  })();

  document.dispatchEvent(
    new CustomEvent("vortex:device", { detail: profile })
  );
})();
