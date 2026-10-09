/* ==========================================================================
   VORTEX GAMING — vortex-receipt.js  (Activity Audit · PDF / CSV export)

   Printable "VORTEX GAMING · OFFICIAL ACTIVITY AUDIT" report:
     · HEADER   — vector brand mark, title, generation timestamp (IST),
                  dynamic username / user id, status + tier badge
     · METRICS  — score totals, games played, win rate, play time,
                  telemetry health score, rank / tier cards
     · TABLE    — performance breakdown: game key, game / module, outcome,
                  high score, session duration, IST timestamp logs
     · FOOTER   — cryptographic verification signature / hash, receipt
                  number, verify URL, copyright notice
   Two PDF themes (classes on #receipt-doc):
     theme-dark  — BLACK & WHITE · neon cyberpunk HUD (default)
     theme-light — WHITE & BLACK · clean high-contrast print

   Export channels:
     [PDF DOWNLOAD]  → window.print() (vector typography via @media print)
     [CSV EXPORT]    → spreadsheet CSV of the same audit rows
     AUTO-SAVE ON EXIT → dual-layer auto-download (see below) delivered via
                         the vortex-report-bridge (web blob save / WebView
                         window.VortexApp.downloadReport / RN / Capacitor)
   ========================================================================== */
(function () {
  "use strict";

  var DB = window.VortexDB;
  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>\"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---- IST formatter: every timestamp in the audit must be IST ---- */
  function fmtIST(iso) {
    if (!iso) return "—";
    if (window.VortexTime && typeof window.VortexTime.formatToIST === "function") {
      return window.VortexTime.formatToIST(iso);
    }
    var d = iso instanceof Date ? iso : new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: true,
    }) + " IST";
  }

  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var h = (sec / 3600) | 0, m = ((sec % 3600) / 60) | 0, s = sec % 60;
    return h > 0 ? h + "h " + m + "m" : m > 0 ? m + "m " + s + "s" : s + "s";
  }

  function toast(m, t) { if (window.VortexToast) window.VortexToast(m, t); }

  function status(t) {
    var el = $("receipt-status");
    if (el) el.textContent = t || "";
  }

  /* ---- rank / tier + telemetry health (mirrors the server PDF) ---- */
  function tierFor(level) {
    level = Number(level) || 1;
    if (level >= 60) return { tier: "NEON LEGEND", grade: "S+" };
    if (level >= 45) return { tier: "DIAMOND", grade: "S" };
    if (level >= 30) return { tier: "PLATINUM", grade: "A" };
    if (level >= 20) return { tier: "GOLD", grade: "B" };
    if (level >= 10) return { tier: "SILVER", grade: "C" };
    if (level >= 5) return { tier: "BRONZE", grade: "D" };
    return { tier: "ROOKIE", grade: "E" };
  }

  function healthScore(data) {
    var pillars = [
      !!(data && data.identity && data.identity.username),
      !!((data && (data.activity || data.recent)) || []).length,
      !!(data && data.kpis && data.kpis.gamesPlayed > 0),
      !!(data && data.receipt && data.receipt.hash),
    ];
    var n = 0;
    for (var i = 0; i < pillars.length; i++) if (pillars[i]) n++;
    return n * 25;
  }

  var state = { data: null, rows: [], sessionRows: [], theme: "dark", saving: false };

  /* ================================================================== */
  /* AUDIT ROWS — shared by the table renderer and the CSV exporter     */
  /* ================================================================== */
  function buildRows(data) {
    var id = (data && data.identity) || {};
    var rows = [];

    // account-level audit entries (full user details live on every row)
    if (id.registrationDate) {
      rows.push({
        username: id.username || "—", userId: id.id || "—",
        action: "ACCOUNT REGISTERED", module: "ACCOUNT / IDENTITY",
        ts: id.registrationDate, gameKey: "account", score: "", duration: "",
        start: id.registrationDate, end: id.registrationDate, account: true,
      });
    }
    if (id.lastLoginAt) {
      rows.push({
        username: id.username || "—", userId: id.id || "—",
        action: "PLAYER LOGIN", module: "AUTH / LOGIN",
        ts: id.lastLoginAt, gameKey: "auth", score: "", duration: "",
        start: id.lastLoginAt, end: id.lastLoginAt, account: true,
      });
    }

    // full user activity history (falls back to `recent` on old payloads)
    var activity = (data && (data.activity || data.recent)) || [];
    for (var i = 0; i < activity.length; i++) {
      var a = activity[i];
      var outcome = String(a.action || a.outcome || "PLAY").toUpperCase();
      var action = "GAME SESSION · " + outcome;
      if (a.score) action += " · " + Number(a.score).toLocaleString() + " PTS";
      if (a.duration) action += " · " + fmtDur(a.duration);
      rows.push({
        username: id.username || "—", userId: id.id || "—",
        action: action, module: a.game || a.gameKey || "—",
        ts: a.endIST || a.startIST || fmtIST(a.endTime || a.startTime),
        gameKey: a.gameKey || "—",
        score: typeof a.score === "number" ? a.score : "",
        duration: typeof a.duration === "number" ? fmtDur(a.duration) : "",
        start: a.startIST || fmtIST(a.startTime), end: a.endIST || fmtIST(a.endTime),
        outcome: outcome, account: false,
      });
    }
    return rows;
  }

  /* ================================================================== */
  /* RENDER — HUD report: header · metrics grid · breakdown · footer    */
  /* ================================================================== */
  var BRAND_MARK =
    '<svg class="rd-logo" viewBox="0 0 40 40" fill="none" aria-hidden="true">' +
    '<circle cx="20" cy="20" r="15" stroke="currentColor" stroke-width="3"/>' +
    '<circle cx="20" cy="20" r="6.5" fill="currentColor"/>' +
    '<path d="M20 5 L20 12 M20 28 L20 35 M5 20 L12 20 M28 20 L35 20" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
    "</svg>";

  function fill(data) {
    var fillEl = $("receipt-fill");
    if (!fillEl) return;

    if (!data) {
      fillEl.innerHTML = '<p class="rd-loading">GENERATING AUDIT…</p>';
      return;
    }

    var rows = buildRows(data);
    var sessionRows = [];
    for (var i = 0; i < rows.length; i++) if (!rows[i].account) sessionRows.push(rows[i]);

    var id = data.identity || {};
    var k = data.kpis || {};
    var rc = data.receipt || {};
    var tg = tierFor(id.level);
    var health = healthScore(data);
    var totalScore = 0;
    for (var j = 0; j < sessionRows.length; j++) totalScore += Number(sessionRows[j].score) || 0;

    /* ---------- HEADER: logo · title · identity · status badge ------- */
    var head =
      '<header class="rd-head">' +
        '<div class="rd-head-top">' +
          '<div class="rd-brand">' + BRAND_MARK +
            '<div>' +
              '<h1 class="rd-audit-title">VORTEX GAMING · OFFICIAL ACTIVITY AUDIT</h1>' +
              '<p class="rd-audit-meta">GENERATED ' + esc(fmtIST(new Date())) +
                " · ALL TIMESTAMPS IN INDIAN STANDARD TIME (IST)</p>" +
            "</div>" +
          "</div>" +
          '<span class="rd-badge">' + esc(String(id.status || "active").toUpperCase()) +
            " · " + esc(String(id.role || "player").toUpperCase()) +
            " · " + esc(tg.tier) + " " + esc(tg.grade) + "</span>" +
        "</div>" +
        '<div class="rd-identity">' +
          "<span>USER <b>" + esc(id.username || "—") + "</b></span>" +
          '<span class="rd-idcol">ID ' + esc(id.id || "—") + "</span>" +
          "<span>REGISTERED " + esc(id.registrationDate || "—") + "</span>" +
          "<span>LOGINS " + esc(id.totalLoginCount != null ? id.totalLoginCount : "—") + "</span>" +
        "</div>" +
      "</header>";

    /* ---------- SUMMARY METRICS GRID -------------------------------- */
    function card(label, value, sub, mod) {
      return '<div class="rd-metric-card' + (mod ? " " + mod : "") + '">' +
        '<div class="rd-metric-label">' + label + "</div>" +
        '<div class="rd-metric-value">' + esc(String(value)) + "</div>" +
        '<div class="rd-metric-sub">' + esc(String(sub || "")) + "</div>" +
      "</div>";
    }
    var metrics =
      '<section class="rd-metrics">' +
        card("SCORE TOTAL", totalScore.toLocaleString("en-IN"), "BEST " + Number(k.highScore || 0).toLocaleString("en-IN")) +
        card("GAMES PLAYED", k.gamesPlayed || 0, (k.wins || 0) + "W · " + (k.losses || 0) + "L · " + (k.quits || 0) + "Q") +
        card("WIN RATE", (k.winRatePct || 0) + "%", "SESSIONS " + (k.gamesPlayed || 0)) +
        card("PLAY TIME", fmtDur(k.totalPlaySeconds), "LONGEST " + fmtDur(k.longestSessionSeconds)) +
        card("TELEMETRY HEALTH", health + "%", health >= 75 ? "NOMINAL" : "PARTIAL", "rd-metric-health") +
        card("RANK / TIER", tg.tier, "LEVEL " + (id.level || 1) + " · GRADE " + tg.grade) +
      "</section>";

    /* ---------- PERFORMANCE BREAKDOWN TABLE ------------------------- */
    var body = sessionRows.length
      ? sessionRows.map(function (r, i) {
          var oc = String(r.outcome || "").toUpperCase();
          var ocClass = oc === "WON" ? "rd-oc-won" : oc === "LOST" ? "rd-oc-lost" : "rd-oc-quit";
          return "<tr>" +
            "<td class='rd-numcol'>" + (i + 1) + "</td>" +
            "<td class='rd-idcol'>" + esc(r.gameKey) + "</td>" +
            "<td>" + esc(r.module) + "</td>" +
            "<td class='" + ocClass + "'>" + esc(oc || "—") + "</td>" +
            "<td class='rd-numcol'>" + (r.score === "" ? "—" : Number(r.score).toLocaleString("en-IN")) + "</td>" +
            "<td class='rd-tscol'>" + esc(r.duration || "—") + "</td>" +
            "<td class='rd-tscol'>" + esc(r.start) + "</td>" +
            "<td class='rd-tscol'>" + esc(r.end) + "</td>" +
          "</tr>";
        }).join("")
      : "<tr><td colspan='8' class='rd-empty'>NO ACTIVITY RECORDED</td></tr>";

    var table =
      '<section class="rd-breakdown">' +
        '<h2 class="rd-section-title">PERFORMANCE BREAKDOWN</h2>' +
        '<table class="rd-table rd-breakdown-table"><thead><tr>' +
          "<th>#</th><th>GAME KEY</th><th>GAME / MODULE</th><th>OUTCOME</th>" +
          "<th>HIGH SCORE</th><th>DURATION</th><th>START (IST)</th><th>END (IST)</th>" +
        "</tr></thead><tbody>" + body + "</tbody></table>" +
      "</section>";

    /* ---------- FOOTER: signature · hash · copyright ---------------- */
    var footer =
      '<footer class="rd-foot">' +
        '<div class="rd-foot-sig">' +
          "<span>RECEIPT " + esc(rc.number || "—") + "</span>" +
          '<span class="rd-hash">SHA-256 ' + esc(rc.hash || "—") + "</span>" +
          "<span>VERIFY " + esc(rc.verifyUrl || "—") + "</span>" +
        "</div>" +
        '<div class="rd-foot-note">CRYPTOGRAPHICALLY SIGNED ACTIVITY LEDGER · © ' +
          new Date().getFullYear() + " VORTEX GAMING · CONFIDENTIAL</div>" +
      "</footer>";

    fillEl.innerHTML = head + metrics + table + footer;

    // hand the row set to the CSV exporter
    state.rows = rows;
    state.sessionRows = sessionRows;
  }

  /* ================================================================== */
  /* THEME — BLACK & WHITE (default) / WHITE & BLACK                    */
  /* ================================================================== */
  function setTheme(t) {
    state.theme = t === "light" ? "light" : "dark";
    var doc = $("receipt-doc");
    if (doc) {
      doc.classList.toggle("theme-light", state.theme === "light");
      doc.classList.toggle("theme-dark", state.theme === "dark");
    }
    var dots = document.querySelectorAll(".receipt-toggle .tdot");
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle("active", dots[i].getAttribute("data-t") === state.theme);
    }
  }

  /* ================================================================== */
  /* PDF DOWNLOAD — window.print() with the print stylesheet rules      */
  /* ================================================================== */
  function downloadPdf() {
    if (!state.data) {
      toast("Generate the audit first", "warn");
      return;
    }
    status("OPENING PRINT DIALOG…");
    try {
      window.print(); // browser "Save as PDF" → vector typography via @media print
      status("PDF READY — USE 'SAVE AS PDF'");
    } catch (err) {
      status("");
      toast("Print dialog could not be opened", "error");
    }
  }

  /* ================================================================== */
  /* CSV EXPORT — audit rows, spreadsheet-ready                         */
  /* ================================================================== */
  function csvCell(v) {
    return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  }

  function exportCsv() {
    var rows = state.rows || [];
    if (!rows.length) {
      toast("No audit rows to export", "warn");
      return;
    }
    // superset header: the original six columns first, then the breakdown extras
    var lines = [
      "No,Username,User ID,Action Taken,Game / Module,Timestamp (IST),Game Key,High Score,Duration,Start (IST),End (IST)",
    ];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      lines.push([
        csvCell(i + 1), csvCell(r.username), csvCell(r.userId),
        csvCell(r.action), csvCell(r.module), csvCell(r.ts),
        csvCell(r.gameKey), csvCell(r.score), csvCell(r.duration),
        csvCell(r.start), csvCell(r.end),
      ].join(","));
    }
    // BOM keeps Excel happy; \r\n for Windows spreadsheet apps
    var csv = "\uFEFF" + lines.join("\r\n");
    var uname = ((state.data && state.data.identity && state.data.identity.username) || "player").replace(/[^\w-]/g, "");
    var stamp = new Date().toISOString().slice(0, 10);
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "vortex_activity_audit_" + uname + "_" + stamp + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    status("CSV EXPORTED");
    toast("Audit exported as CSV");
  }

  /* ================================================================== */
  /* DATA                                                               */
  /* ================================================================== */
  function openModal() {
    if (DB && !DB.token) {
      toast("Sign in to generate your activity audit", "warn");
      if ($("auth-modal")) $("auth-modal").classList.remove("hidden");
      return;
    }
    $("receipt-modal").classList.remove("hidden");
    load();
  }

  function load() {
    if (!DB || !DB.user) return;
    fill(null);
    status("SYNCING…");
    DB.api("/api/reports/user/" + encodeURIComponent(DB.user.id) + "?receipt=1").then(function (res) {
      if (res && res.ok) {
        state.data = res;
        fill(res);
        status("AUDIT READY");
        armPending(); // report generated — arm the auto-save-on-exit layer
      } else {
        status("");
        $("receipt-fill").innerHTML =
          '<p class="rd-error">Could not load activity. ' +
          esc((res && res.error) || "Play a few games first.") + "</p>";
      }
    });
  }

  /* ================================================================== */
  /* AUTO-DOWNLOAD ON EXIT — dual-layer mechanism                       */
  /*                                                                     */
  /* Layer 1: internal navigation capture — same-page link clicks are   */
  /*          held, the PDF is saved through the bridge, then the       */
  /*          route transition continues (no pop-up blockers: file      */
  /*          saves are downloads, not pop-ups).                        */
  /* Layer 2: exit / unload fallback — soft toast + pending flag in     */
  /*          sessionStorage; if the session ends abruptly the report   */
  /*          re-downloads automatically on the next load of the same   */
  /*          session. Native containers get the blob via               */
  /*          window.VortexApp.downloadReport (see bridge module).      */
  /* ================================================================== */
  var AUTO_KEY = "vg_autosave_report";     // localStorage  "0" = opt out
  var SEEN_KEY = "vg_report_seen";         // sessionStorage report generated
  var PENDING_KEY = "vg_report_autosave";  // sessionStorage not yet saved

  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }
  function ssGet(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }
  function ssDel(k) { try { window.sessionStorage.removeItem(k); } catch (e) { /* storage blocked */ } }

  function autoOn() { return lsGet(AUTO_KEY) !== "0"; }
  function pending() { return ssGet(PENDING_KEY) === "1"; }

  function armPending() {
    ssSet(SEEN_KEY, "1");
    if (autoOn()) ssSet(PENDING_KEY, "1");
    syncAutosaveUi();
  }

  function markSaved() {
    ssDel(PENDING_KEY);
    status("REPORT SAVED");
  }

  function syncAutosaveUi() {
    var b = $("btn-rec-autosave");
    if (b) {
      b.textContent = "AUTO-SAVE ON EXIT: " + (autoOn() ? "ON" : "OFF");
      b.classList.toggle("btn-neon", autoOn());
      b.classList.toggle("btn-ghost", !autoOn());
    }
  }

  function toggleAutosave() {
    lsSet(AUTO_KEY, autoOn() ? "0" : "1");
    if (autoOn()) {
      if (ssGet(SEEN_KEY) === "1") ssSet(PENDING_KEY, "1");
      toast("Auto-save on exit enabled");
    } else {
      ssDel(PENDING_KEY);
      toast("Auto-save on exit disabled");
    }
    syncAutosaveUi();
  }

  /* Save the report FILE through the bridge (web blob / native storage). */
  function saveReportFile() {
    if (state.saving) return Promise.resolve(false);
    if (!DB || !DB.user || !DB.token) return Promise.resolve(false);
    state.saving = true;
    status("SAVING REPORT…");

    var uname = ((state.data && state.data.identity && state.data.identity.username) || DB.user.username || "player").replace(/[^\w-]/g, "");
    var stamp = new Date().toISOString().slice(0, 10);
    var filename = "vortex_activity_audit_" + uname + "_" + stamp + ".pdf";
    var url = "/api/reports/user/" + encodeURIComponent(DB.user.id) + "/pdf?theme=" + state.theme;

    return fetch(url, {
      headers: { Authorization: "Bearer " + DB.token },
      credentials: "same-origin",
    })
      .then(function (res) {
        if (!res.ok) throw new Error("pdf " + res.status);
        return res.blob();
      })
      .then(function (blob) {
        var bridge = window.VortexReport;
        var saved = bridge
          ? bridge.download(blob, filename)
          : Promise.resolve("web").then(function () {
              var u = URL.createObjectURL(blob);
              var a = document.createElement("a");
              a.href = u; a.download = filename;
              document.body.appendChild(a); a.click(); a.remove();
              setTimeout(function () { URL.revokeObjectURL(u); }, 1500);
            });
        return saved.then(function (channel) {
          markSaved();
          toast("Activity audit saved (" + channel + ")");
          return true;
        });
      })
      .catch(function () {
        status("");
        return false;
      })
      .then(function (r) { state.saving = false; return r; });
  }

  /* Layer 1 — internal navigation capture */
  function onLinkCapture(e) {
    if (!pending() || !autoOn() || !state.data) return;
    if (e.button !== undefined && e.button !== 0) return;
    var node = e.target;
    var a = null;
    while (node && node !== document) {
      if (node.tagName === "A" && node.getAttribute) { a = node; break; }
      node = node.parentNode;
    }
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (!href || href.charAt(0) === "#") return;             // in-page anchors
    if (a.getAttribute("download") !== null) return;          // real downloads
    if ((a.getAttribute("target") || "") === "_blank") return; // new tab = no unload

    // any other href would unload the page — save first, then continue
    e.preventDefault();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    toast("Leaving page? Downloading your report…");
    var dest = a.href;
    saveReportFile().then(function (ok) {
      if (!ok) {
        // last-resort fallback: print dialog before leaving
        try { window.print(); } catch (err) { /* ignore */ }
      }
      window.location.href = dest;
    });
  }

  /* Layer 2 — exit / unload fallback (soft exit trigger) */
  function onBeforeUnload(e) {
    if (!pending() || !autoOn() || !state.data) return undefined;
    try { toast("Leaving page? Downloading your report…"); } catch (err) { /* no-op */ }
    ssSet(PENDING_KEY, "1"); // re-arm for the next load (session resume)
    e.preventDefault();
    e.returnValue = "Leaving page? Downloading your report...";
    return e.returnValue;
  }

  /* Session resume — after a hard exit the report auto-downloads on the
     next load of the same session (downloads are never pop-up blocked). */
  function resumePending() {
    if (!pending() || !autoOn()) return;
    if (!DB || !DB.user || !DB.token) return;
    toast("Welcome back — saving your pending report…");
    saveReportFile().then(function (ok) {
      if (ok) markSaved();
    });
  }

  /* ================================================================== */
  /* BINDINGS                                                           */
  /* ================================================================== */
  function boot() {
    var trg = $("btn-play-history");
    if (trg) trg.addEventListener("click", openModal);

    var close = $("receipt-close");
    if (close) close.addEventListener("click", function () { $("receipt-modal").classList.add("hidden"); });
    var backdrop = document.querySelector("#receipt-modal .modal-backdrop");
    if (backdrop) backdrop.addEventListener("click", function () { $("receipt-modal").classList.add("hidden"); });

    // theme chooser: BLACK & WHITE (default) / WHITE & BLACK
    setTheme("dark");
    var dots = document.querySelectorAll(".receipt-toggle .tdot");
    for (var i = 0; i < dots.length; i++) {
      (function (d) {
        d.addEventListener("click", function () { setTheme(d.getAttribute("data-t")); });
      })(dots[i]);
    }

    var pdfBtn = $("btn-rec-pdf");
    if (pdfBtn) pdfBtn.addEventListener("click", downloadPdf);
    var csvBtn = $("btn-rec-csv");
    if (csvBtn) csvBtn.addEventListener("click", exportCsv);
    var autoBtn = $("btn-rec-autosave");
    if (autoBtn) autoBtn.addEventListener("click", toggleAutosave);

    // ---- auto-download-on-exit wiring ----
    syncAutosaveUi();
    document.addEventListener("click", onLinkCapture, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("afterprint", markSaved);
    if (window.VortexReport && window.VortexReport.onNativeResult) {
      window.VortexReport.onNativeResult(function (res) {
        if (res && res.ok) markSaved();
      });
    }
    resumePending();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
