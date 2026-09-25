/* ==========================================================================
   VORTEX GAMING — vortex-receipt.js  (v3.0 Activity Audit receipt suite)

   Itemized activity report modal:
     · fetches live telemetry from  GET /api/reports/user/:id?receipt=1
     · dual-theme document (Cyber Dark / Eco Print Light)
     · dynamic QR code encoding the public verify URL
     · KPI grid, itemized play table, achievement badges
     · PDF export (html2canvas + jsPDF) · print stylesheet · email dispatch
   ========================================================================== */
(function () {
  "use strict";

  var DB = window.VortexDB;
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var h = (sec / 3600) | 0, m = ((sec % 3600) / 60) | 0, s = sec % 60;
    return h > 0 ? h + "h " + m + "m" : m > 0 ? m + "m " + s + "s" : s + "s";
  }
  function toast(m, t) { if (window.VortexToast) window.VortexToast(m, t); }

  /* Lucide-style inline SVG badge icons */
  var BADGE_ICONS = {
    "night-owl": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    "sharpshooter": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    "marathoner": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    "high-roller": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M17 4H7v6a5 5 0 0 0 10 0V4z"/><path d="M17 6h3a1 1 0 0 1 1 1c0 2-1.5 4-4 4M7 6H4a1 1 0 0 0-1 1c0 2 1.5 4 4 4"/></svg>',
  };

  var state = { data: null, receipt: null, theme: "dark" };

  function openModal() {
    if (DB && !DB.token) {
      toast("Sign in to generate your activity report", "warn");
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
        state.receipt = res.receipt;
        fill(res);
        status("AUDIT READY");
      } else {
        status("");
        $("receipt-fill").innerHTML = '<p style="text-align:center;padding:50px 20px;color:#ff7d9c;font-weight:600">Could not load telemetry. ' + esc((res && res.error) || "Play a few games first.") + "</p>";
      }
    });
  }

  function status(t) {
    var el = $("receipt-status");
    if (el) el.textContent = t || "";
  }

  function fill(data) {
    var fillEl = $("receipt-fill");
    if (!fillEl) return;
    if (!data) {
      fillEl.innerHTML = '<p style="text-align:center;padding:60px 20px;font-weight:600;letter-spacing:0.1em">GENERATING AUDIT…</p>';
      return;
    }

    var id = data.identity, k = data.kpis, rec = data.receipt;
    var games = (data && data.gameBreakdown) ? data.gameBreakdown : [];
    var recent = data.recent || [];
    var rows = recent.length ? recent : games.slice(0, 8).map(function (g) {
      return { game: g.game, outcome: null, score: g.bestScore, duration: g.avgDurationSec, startIST: "—", endIST: "—" };
    });

    var html =
      '<div class="rd-head">' +
        '<div>' +
          '<div class="rd-brandline">VORTEX GAMING · OFFICIAL ACTIVITY AUDIT</div>' +
          '<div class="rd-num">' + esc(rec ? rec.number : "#VTX-DRAFT") + "</div>" +
          '<div class="rd-date">Generated ' + esc(rec ? rec.generatedAtIST : "—") + "</div>" +
        "</div>" +
        '<div style="text-align:right">' +
          '<div class="rd-qrcell" id="rd-qr-slot"></div>' +
          '<div class="rd-qreencode">' + esc(rec ? rec.hash.slice(0, 20) + "…" : "") + "</div>" +
        "</div>" +
      "</div>" +

      '<div class="rd-identity">' +
        idCell("PLAYER", esc(id.username)) +
        idCell("EMAIL", esc(id.email)) +
        idCell("REGISTERED", esc(id.registrationDate)) +
        idCell("LOGIN COUNT", String(id.totalLoginCount)) +
      "</div>" +

      '<div class="rd-kpis">' +
        kpi(k.gamesPlayed, "GAMES PLAYED") +
        kpi(k.winRatePct + "%", "WIN RATE") +
        kpi(k.highScore.toLocaleString(), "HIGH SCORE") +
        kpi(fmtDur(k.totalPlaySeconds), "TOTAL TIME") +
      "</div>" +

      '<div class="rd-section-title">ITEMIZED GAME ACTIVITY</div>' +
      '<table class="rd-table"><thead><tr>' +
        "<th>GAME</th><th>START (IST)</th><th>END (IST)</th><th>DUR</th><th>OUTCOME</th><th class='rd-numcol'>SCORE</th>" +
      "</tr></thead><tbody>" +
      rows.map(function (r) {
        return "<tr>" +
          "<td>" + esc(r.game) + "</td>" +
          '<td style="font-size:0.74rem">' + esc(r.startIST) + "</td>" +
          '<td style="font-size:0.74rem">' + esc(r.endIST) + "</td>" +
          "<td>" + fmtDur(r.duration) + "</td>" +
          '<td><span class="rd-outcome ' + (r.outcome ? String(r.outcome).toLowerCase() : "quit") + '">' + esc(r.outcome || "—") + "</span></td>" +
          '<td class="rd-numcol">' + (r.score || 0).toLocaleString() + "</td>" +
        "</tr>";
      }).join("") +
      "</tbody></table>" +

      '<div class="rd-section-title no-print-sub">ACHIEVEMENT BADGES</div>' +
      '<div class="rd-badges">' +
      (data.badges || []).map(function (b) {
        return '<div class="rd-badge ' + (b.earned ? "earned" : "") + '">' +
          (BADGE_ICONS[b.id] || BADGE_ICONS["high-roller"]) +
          '<div class="rd-bn">' + esc(b.name) + "</div>" +
          '<div class="rd-bd">' + esc(b.desc) + "</div>" +
        "</div>";
      }).join("") +
      "</div>" +

      '<div class="rd-foot">Scan the QR code to verify this audit at ' + esc(rec ? rec.verifyUrl : "—").slice(0, 90) +
      (rec ? " …" : "") + "<br>Document hash <span style='color:var(--rd-accent)'>" + esc(rec ? rec.hash.slice(0, 32) + "…" : "pending") + "</span> · All times rendered in Indian Standard Time (IST)." +
      "</div>";

    fillEl.innerHTML = html;
    renderQR(rec);
  }

  function idCell(k, v) {
    return '<div class="rd-id-cell"><div class="rd-k">' + k + '</div><div class="rd-v" title="' + v + '">' + v + "</div></div>";
  }
  function kpi(n, l) {
    return '<div class="rd-kpi"><div class="rd-n">' + esc(n) + '</div><div class="rd-l">' + l + "</div></div>";
  }

  function renderQR(rec) {
    var slot = $("rd-qr-slot");
    if (!slot) return;
    slot.innerHTML = "";
    if (window.QRCode && rec) {
      new window.QRCode(slot, {
        text: rec.verifyUrl, width: 88, height: 88,
        colorDark: "#14101f", colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.M,
      });
    } else {
      slot.innerHTML = '<span style="font-size:0.6rem;color:var(--rd-dim);text-align:center;padding:6px">QR<br>unavailable</span>';
    }
  }

  /* ---- theme toggle ---- */
  function setTheme(t) {
    state.theme = t;
    var doc = $("receipt-doc");
    if (doc) doc.classList.toggle("light", t === "light");
    var dots = document.querySelectorAll(".receipt-toggle .tdot");
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle("active", dots[i].getAttribute("data-t") === t);
  }

  /* ---- PDF export ---- */
  function exportPdf() {
    var node = $("receipt-doc");
    if (!node) return;
    if (!window.html2canvas || !(window.jspdf && window.jspdf.jsPDF)) {
      status("PDF LIBS LOADING…");
      toast("PDF libraries still loading — try again in a second", "warn");
      return;
    }
    status("BUILDING PDF…");
    window.html2canvas(node, { scale: 2, backgroundColor: "#0c0620", useCORS: true }).then(function (canvas) {
      var img = canvas.toDataURL("image/jpeg", 0.93);
      var pdf = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
      var pageW = pdf.internal.pageSize.getWidth();
      var ratio = pageW / canvas.width;
      pdf.addImage(img, "JPEG", 0, 0, pageW, canvas.height * ratio);
      var uid = state.data && state.data.identity ? state.data.identity.id : "player";
      pdf.save("vortex_activity_report_" + String(uid).slice(0, 8) + ".pdf");
      status("PDF READY");
      toast("Report downloaded as PDF");
    }).catch(function () { status(""); toast("PDF build failed", "error"); });
  }

  function printDoc() { setTheme("light"); window.print(); }

  function emailMe() {
    if (!DB || !DB.user) return;
    status("QUEUING EMAIL…");
    DB.api("/api/reports/email", {
      method: "POST",
      body: { userId: DB.user.id },
    }).then(function (res) {
      if (res && res.ok) { status("✓ EMAIL QUEUED"); toast("Report is being emailed to " + DB.user.email); }
      else { status(""); toast((res && res.error) || "Email dispatch needs an SMTP relay configured", "error"); }
    });
  }

  /* ---- bindings ---- */
  function boot() {
    var trg = $("btn-play-history");
    if (trg) trg.addEventListener("click", openModal);
    var close = $("receipt-close");
    if (close) close.addEventListener("click", function () { $("receipt-modal").classList.add("hidden"); });
    var backdrop = document.querySelector("#receipt-modal .modal-backdrop");
    if (backdrop) backdrop.addEventListener("click", function () { $("receipt-modal").classList.add("hidden"); });

    var dots = document.querySelectorAll(".receipt-toggle .tdot");
    for (var i = 0; i < dots.length; i++) {
      (function (d) {
        d.addEventListener("click", function () { setTheme(d.getAttribute("data-t")); });
      })(dots[i]);
    }

    var pdf = $("btn-rec-pdf"); if (pdf) pdf.addEventListener("click", exportPdf);
    var prn = $("btn-rec-print"); if (prn) prn.addEventListener("click", printDoc);
    var eml = $("btn-rec-email"); if (eml) eml.addEventListener("click", emailMe);
    var rfr = $("btn-rec-refresh"); if (rfr) rfr.addEventListener("click", load);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { var m = $("receipt-modal"); if (m) m.classList.add("hidden"); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
