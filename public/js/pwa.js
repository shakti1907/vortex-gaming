/* VORTEX GAMING — PWA registration + install prompt handling (v3.0). */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function toast(m, t) { if (window.VortexToast) window.VortexToast(m, t); }

  var deferredInstall = null;
  var banner = null;

  function showBanner() {
    banner = $("pwa-banner");
    if (banner) banner.classList.remove("hidden");
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredInstall = e;
    /* don't shove it in the player's face mid-game — show on the shell */
    setTimeout(showBanner, 4200);
  });

  function install() {
    if (!deferredInstall) { toast("Already installable via your browser menu", "warn"); return; }
    var p = deferredInstall;
    deferredInstall = null;
    p.prompt();
    p.userChoice.then(function (choice) {
      if (choice.outcome === "accepted") toast("Installing VORTEX GAMING…");
      var b = $("pwa-banner"); if (b) b.classList.add("hidden");
    });
  }

  function dismiss() {
    banner = $("pwa-banner");
    if (banner) banner.classList.add("hidden");
    try { sessionStorage.setItem("vortex_pwa_dismissed", "1"); } catch (e) { /* noop */ }
  }

  /* ---- register the service worker ---- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").then(function () {
        /* silently cached — no toast spam */
      }).catch(function (err) {
        console.warn("[pwa] service worker registration failed:", err);
      });
    });
  }

  /* ---- bindings ---- */
  function boot() {
    var inst = $("btn-pwa-install");
    if (inst) inst.addEventListener("click", install);
    var dis = $("btn-pwa-dismiss");
    if (dis) dis.addEventListener("click", dismiss);
    var dismissed = false;
    try { dismissed = sessionStorage.getItem("vortex_pwa_dismissed") === "1"; } catch (e) { /* noop */ }
    if (dismissed && banner) banner.classList.add("hidden");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
