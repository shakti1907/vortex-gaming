/* ==========================================================================
   VORTEX GAMING — js/admin.js  (Sub-Batch 4C)
   Admin dashboard controller: JWT gate, live stats, signup chart, and the
   user management table with search / filter / pagination.
   ========================================================================== */
(function () {
  "use strict";

  var DB = window.VortexDB;
  var ADMIN_SESSION_KEY = "vortex_admin_session";

  function $(id) { return document.getElementById(id); }

  function getAdminSession() {
    try { return sessionStorage.getItem(ADMIN_SESSION_KEY); } catch (e) { return null; }
  }

  function setAdminSession(token) {
    try { sessionStorage.setItem(ADMIN_SESSION_KEY, token); } catch (e) { /* storage can be blocked */ }
  }

  function clearAdminSession() {
    try { sessionStorage.removeItem(ADMIN_SESSION_KEY); } catch (e) { /* noop */ }
  }

  /**
   * Single source of truth for the admin route guard. The token must exist in
   * sessionStorage and must still resolve to a live admin in PostgreSQL.
   */
  function verifyAdminToken(token) {
    if (!token) return Promise.resolve(false);
    return fetch("/api/auth/me", {
      headers: { Authorization: "Bearer " + token },
      credentials: "same-origin",
    }).then(function (res) {
      if (!res.ok) return false;
      return res.json().then(function (data) {
        if (!data || !data.ok || !data.user || data.user.role !== "admin") return false;
        DB.token = token;
        DB.user = data.user;
        return true;
      });
    }).catch(function () { return false; });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function toast(message, type) {
    var wrap = $("toasts");
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

  function fmtNum(n) {
    return Number(n || 0).toLocaleString();
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function shortId(id) {
    return String(id || "").slice(0, 8) + "…";
  }

  var state = {
    page: 1,
    pages: 1,
    search: "",
    status: "all",
    limit: 10,
    loading: false,
  };

  /* ------------------------------ views ------------------------------ */
  function showDash() {
    $("admin-login").classList.add("hidden");
    $("admin-dash").classList.remove("hidden");
    $("btn-admin-logout").classList.remove("hidden");
  }

  function showLogin() {
    $("admin-login").classList.remove("hidden");
    $("admin-dash").classList.add("hidden");
    $("btn-admin-logout").classList.add("hidden");
  }

  function banner(msg) {
    var el = $("admin-error-banner");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  }

  /* ------------------------------ stats ------------------------------ */
  function loadStats() {
    var statusEl = $("dash-live-status");
    if (statusEl) statusEl.textContent = "SYNCING…";

    return DB.api("/api/admin/stats").then(function (res) {
      if (!res || !res.ok) {
        var msg = (res && res.error) || "Could not reach the stats grid.";
        banner(msg);
        if (res && res.status === 401) { showLogin(); }
        if (statusEl) statusEl.textContent = "CONNECTION ERROR";
        return;
      }
      banner("");
      if (statusEl) statusEl.textContent = "● LIVE — POSTGRES GRID";
      var s = res.stats || {};

      $("stat-total-users").textContent = fmtNum(s.totalUsers);
      $("stat-users-delta").textContent = "+" + fmtNum(s.signups7d) + " this week";
      $("stat-signups-24h").textContent = fmtNum(s.signups24h);
      $("stat-signups-7d").textContent = fmtNum(s.signups7d);
      $("stat-sessions").textContent = fmtNum(s.activeSessions24h);
      $("stat-scores").textContent = fmtNum(s.totalScores);
      $("stat-record").textContent = fmtNum(s.globalRecord);
      $("stat-record-sub").textContent = s.globalRecordHolder ? s.globalRecordHolder.game : "";
      $("stat-avgxp").textContent = fmtNum(s.avgXp);
      $("stat-games-count").textContent = fmtNum(s.gamesCount);

      var holder = s.globalRecordHolder;
      $("rc-game").textContent = holder ? holder.game.toUpperCase() : "—";
      $("rc-score").textContent = holder ? fmtNum(holder.score) : "—";
      $("rc-user").innerHTML = holder
        ? "held by <b>" + escapeHtml(holder.username) + "</b>"
        : "No scores recorded yet";

      renderSignupBars(s.signupsByDay || []);
    });
  }

  function renderSignupBars(days) {
    var wrap = $("signup-bars");
    if (!wrap) return;
    wrap.innerHTML = "";
    var max = 1;
    for (var i = 0; i < days.length; i++) max = Math.max(max, days[i].count);
    for (var j = 0; j < days.length; j++) {
      var d = days[j];
      var col = document.createElement("div");
      col.className = "signup-bar";
      var pct = Math.max(4, Math.round((d.count / max) * 100));
      var label = d.day ? d.day.slice(5) : "";
      col.innerHTML = '<i style="height:' + pct + '%" title="' + d.count + ' signups"></i><span>' + escapeHtml(label) + '</span>';
      wrap.appendChild(col);
    }
  }

  /* ------------------------------ users ------------------------------ */
  function loadUsers(page) {
    if (state.loading) return Promise.resolve();
    state.loading = true;
    if (typeof page === "number") state.page = page;

    var params = "?page=" + state.page + "&limit=" + state.limit +
      "&status=" + encodeURIComponent(state.status) +
      "&search=" + encodeURIComponent(state.search);

    return DB.api("/api/admin/users" + params).then(function (res) {
      state.loading = false;
      if (!res || !res.ok) {
        banner((res && res.error) || "Could not load users.");
        if (res && res.status === 401) showLogin();
        return;
      }
      banner("");
      state.page = res.page;
      state.pages = res.pages;
      renderUsers(res.rows || []);
      renderPager(res.total);
    });
  }

  function renderUsers(rows) {
    var body = $("admin-users-body");
    if (!body) return;
    body.innerHTML = "";
    if (!rows.length) {
      body.innerHTML = '<tr class="lb-empty"><td colspan="9">No pilots match those filters.</td></tr>';
      return;
    }
    for (var i = 0; i < rows.length; i++) {
      var u = rows[i];
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="td-id">' + escapeHtml(shortId(u.id)) + '</td>' +
        '<td>' + escapeHtml(u.username) + '</td>' +
        '<td>' + escapeHtml(u.email) + '</td>' +
        '<td>' + fmtDate(u.joinedAt) + '</td>' +
        '<td class="td-xp">' + fmtNum(u.totalXp) + '</td>' +
        '<td class="td-xp">' + fmtNum(u.level) + '</td>' +
        '<td class="td-score">' + fmtNum(u.highScore) + '</td>' +
        '<td><span class="role-pill ' + (u.role === "admin" ? "admin" : "") + '">' + escapeHtml(u.role.toUpperCase()) + '</span></td>' +
        '<td><span class="status-pill ' + escapeHtml(u.status) + '">' + escapeHtml(u.status.toUpperCase()) + '</span></td>';
      body.appendChild(tr);
    }
  }

  function renderPager(total) {
    var info = $("pager-info");
    if (info) {
      info.textContent = fmtNum(total) + " pilots · page " + state.page + " / " + state.pages;
    }
    var prev = $("page-prev");
    var next = $("page-next");
    if (prev) prev.disabled = state.page <= 1;
    if (next) next.disabled = state.page >= state.pages;

    var nums = $("page-numbers");
    if (!nums) return;
    nums.innerHTML = "";
    var window_ = 2;
    var start = Math.max(1, state.page - window_);
    var end = Math.min(state.pages, state.page + window_);
    for (var p = start; p <= end; p++) {
      (function (pageNum) {
        var btn = document.createElement("button");
        btn.className = "page-btn" + (pageNum === state.page ? " active" : "");
        btn.type = "button";
        btn.textContent = String(pageNum);
        btn.addEventListener("click", function () { loadUsers(pageNum); });
        nums.appendChild(btn);
      })(p);
    }
  }

  /* ------------------------------ events ----------------------------- */
  function bind() {
    var form = $("admin-login-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var errEl = $("admin-error");
        if (errEl) errEl.classList.add("hidden");
        var email = $("admin-email").value.trim();
        var pass = $("admin-password").value;
        DB.login(email, pass).then(function (res) {
          if (res.ok && res.user && res.user.role === "admin") {
            setAdminSession(DB.token);
            toast("Admin access granted");
            showDash();
            refreshAll();
          } else if (res.ok) {
            DB.logout();
            if (errEl) { errEl.textContent = "This account does not have admin privileges."; errEl.classList.remove("hidden"); }
          } else {
            if (errEl) { errEl.textContent = res.error || "Authentication failed."; errEl.classList.remove("hidden"); }
          }
        });
      });
    }

    var logout = $("btn-admin-logout");
    if (logout) {
      logout.addEventListener("click", function () {
        DB.logout();
        toast("Logged out", "warn");
        showLogin();
      });
    }

    var search = $("admin-search");
    if (search) {
      var debounce = null;
      search.addEventListener("input", function () {
        clearTimeout(debounce);
        debounce = setTimeout(function () {
          state.search = search.value.trim();
          loadUsers(1);
        }, 350);
      });
    }

    var filter = $("admin-status-filter");
    if (filter) {
      filter.addEventListener("change", function () {
        state.status = filter.value;
        loadUsers(1);
      });
    }

    var refresh = $("admin-refresh");
    if (refresh) refresh.addEventListener("click", refreshAll);

    var csv = $("btn-export-csv");
    if (csv) csv.addEventListener("click", exportCsv);

    var prev = $("page-prev");
    if (prev) prev.addEventListener("click", function () { if (state.page > 1) loadUsers(state.page - 1); });
    var next = $("page-next");
    if (next) next.addEventListener("click", function () { if (state.page < state.pages) loadUsers(state.page + 1); });
  }

  function refreshAll() {
    loadStats();
    loadUsers(state.page);
    loadTelemetry();
  }

  /* ============================== TELEMETRY ============================== */
  function loadTelemetry() {
    return DB.api("/api/admin/telemetry").then(function (res) {
      if (!res || !res.ok) return;
      renderPeakBars(res.hourHistogram || []);
      renderPopularity(res.games || []);
    });
  }

  function renderPeakBars(hours) {
    var wrap = $("peak-bars");
    if (!wrap) return;
    wrap.innerHTML = "";
    var max = 1;
    for (var i = 0; i < hours.length; i++) max = Math.max(max, hours[i]);
    for (var h = 0; h < hours.length; h++) {
      var col = document.createElement("div");
      col.className = "signup-bar";
      var pct = Math.max(3, Math.round((hours[h] / max) * 100));
      col.innerHTML = '<i style="height:' + pct + '%" title="' + hours[h] + ' games"></i><span>' + String(h).padStart(2, "0") + "</span>";
      wrap.appendChild(col);
    }
  }

  function renderPopularity(games) {
    var wrap = $("popularity-list");
    if (!wrap) return;
    if (!games.length) {
      wrap.innerHTML = '<p class="pop-empty">No telemetry yet — play a game to populate the grid.</p>';
      return;
    }
    var maxPlays = 1;
    for (var i = 0; i < games.length; i++) maxPlays = Math.max(maxPlays, games[i].plays);
    wrap.innerHTML = "";
    for (var j = 0; j < games.length; j++) {
      var g = games[j];
      var row = document.createElement("div");
      row.className = "pop-row";
      row.innerHTML =
        '<span class="pop-name">' + escapeHtml(g.game) + "</span>" +
        '<span class="pop-bar-wrap"><i class="pop-bar" style="width:' + Math.round((g.plays / maxPlays) * 100) + '%"></i></span>' +
        '<span class="pop-stat">' + g.plays + " plays · " + g.winRatePct + "% W · " + g.avgScore + " avg</span>";
      wrap.appendChild(row);
    }
  }

  function exportCsv() {
    var btn = $("btn-export-csv");
    if (btn) { btn.disabled = true; btn.textContent = "EXPORTING…"; }
    var url = "/api/admin/telemetry?format=csv";
    var headers = { Authorization: "Bearer " + (DB.token || "") };
    fetch(url, { headers: headers }).then(function (r) {
      if (!r.ok) throw new Error("export failed (" + r.status + ")");
      return r.text();
    }).then(function (csvText) {
      var blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "vortex_telemetry_" + new Date().toISOString().slice(0, 10) + ".csv";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
      toast("Telemetry CSV downloaded");
    }).catch(function () {
      toast("CSV export failed — check admin auth", "error");
    }).finally(function () {
      if (btn) { btn.disabled = false; btn.textContent = "EXPORT .CSV"; }
    });
  }

  /* ------------------------------ boot ------------------------------- */
  function renderAdminDashboard() {
    showDash();
    refreshAll();
  }

  function renderPasskeyModal() {
    clearAdminSession();
    showLogin();
  }

  /** Single-point route guard — no competing auth render paths. */
  function boot() {
    if (!DB) return;
    bind();
    var token = getAdminSession();
    verifyAdminToken(token).then(function (valid) {
      if (valid) renderAdminDashboard();
      else renderPasskeyModal();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  /* Exposed read-only helpers for automated admin-auth QA. */
  window.VortexAdminAuth = {
    verifyAdminToken: verifyAdminToken,
    lock: function () { clearAdminSession(); DB.logout(); renderPasskeyModal(); },
  };
})();
