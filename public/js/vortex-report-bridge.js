/* ==========================================================================
   VORTEX GAMING — vortex-report-bridge.js  (Web · WebView · Capacitor · RN)

   Window-level download bridge for the activity-audit PDF.

   · Detects the runtime container: plain browser, Capacitor, React Native
     WebView, or a custom native shell that injects `window.VortexApp`.
   · Native containers receive the PDF through
     `window.VortexApp.downloadReport({ filename, mime, base64 })`
     (the native side writes it to device storage).
   · React Native containers receive
     `window.ReactNativeWebView.postMessage(JSON.stringify({type:"downloadReport",…}))`.
   · Capacitor shells can pass through `Capacitor.Plugins.Filesystem`.
   · Plain browsers fall back to a standard `<a download>` blob save.

   Native implementors: inject before the page scripts run —

     window.VortexApp = {
       downloadReport(payload) {
         // payload = { filename, mime:"application/pdf", base64 }
         // save base64 to Documents/Downloads, then optionally call:
         // window.VortexAppReportResult({ ok:true, filename: payload.filename })
       }
     };
   ========================================================================== */
(function () {
  "use strict";

  function detectContainer() {
    if (window.VortexApp && typeof window.VortexApp.downloadReport === "function") return "vortex-app";
    if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === "function") return "react-native";
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) return "capacitor";
    return "web";
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        var s = String(fr.result || "");
        resolve(s.slice(s.indexOf(",") + 1));
      };
      fr.onerror = function () { reject(fr.error || new Error("read failed")); };
      fr.readAsDataURL(blob);
    });
  }

  function webSave(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    return Promise.resolve("web");
  }

  /* Result hook — native may call window.VortexAppReportResult({ok, filename}). */
  var resultListeners = [];
  window.VortexAppReportResult = function (payload) {
    for (var i = 0; i < resultListeners.length; i++) {
      try { resultListeners[i](payload); } catch (e) { /* listener error is non-fatal */ }
    }
  };

  var VortexReport = {
    /** "vortex-app" | "react-native" | "capacitor" | "web" */
    container: detectContainer(),

    isNative: function () {
      return this.container !== "web";
    },

    onNativeResult: function (fn) {
      resultListeners.push(fn);
    },

    /**
     * Save a PDF (or any) blob through the best available channel.
     * Resolves with the channel name that handled the save.
     */
    download: function (blob, filename) {
      var self = this;
      self.container = detectContainer();

      if (self.container === "vortex-app") {
        return blobToBase64(blob).then(function (b64) {
          window.VortexApp.downloadReport({
            filename: filename,
            mime: blob.type || "application/pdf",
            base64: b64,
          });
          return "vortex-app";
        });
      }

      if (self.container === "react-native") {
        return blobToBase64(blob).then(function (b64) {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({
              type: "downloadReport",
              filename: filename,
              mime: blob.type || "application/pdf",
              base64: b64,
            }),
          );
          return "react-native";
        });
      }

      if (self.container === "capacitor") {
        return blobToBase64(blob).then(function (b64) {
          return window.Capacitor.Plugins.Filesystem.writeFile({
            path: filename,
            data: b64,
            directory: "DOCUMENTS",
            encoding: "base64",
          }).then(function () { return "capacitor"; })
            .catch(function () { return webSave(blob, filename); });
        });
      }

      return webSave(blob, filename);
    },
  };

  window.VortexReport = VortexReport;
})();
