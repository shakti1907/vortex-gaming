/* ==========================================================================
   VORTEX GAMING — games-action.js
   ACTION 02  Cyber Invaders    — destructible shields, weapon tiers, boss
   ACTION 03  Asteroid Vector   — inertial drift, black hole, weapon swap
   ACTION 04  Bullet Hell Rush  — procedural patterns, slow-mo phase shift
   ========================================================================== */
(function () {
  "use strict";

  var FX = window.VortexFX;
  var Draw = FX.Draw, U = FX.Util;

  /* ==================================================================
     02 — CYBER INVADERS
     ================================================================== */
  FX.register({
    key: "cyber-invaders",
    title: "Cyber Invaders",
    hint: "← → / A D · SPACE / ◆ fire · drag on the pad to steer + auto-fire (touch) · survive escalating waves + the SENTINEL",
    pad: true,

    setup: function (api) {
      var d = api.data, v = api.view;
      d.ship = { x: v.w / 2, y: v.h - 38, w: 34, r: 14, cool: 0 };
      d.bullets = [];
      d.bombs = [];
      d.drops = [];
      d.weapon = 0;          // 0 single · 1 double · 2 spread
      d.lives = 3;
      d.wave = 1;
      d.boss = null;
      d.marchT = 0;
      d.dir = 1;
      d.fireT = 1.2;
      d.waveQueued = false;  // wave transitions are deferred to a safe point
      buildWave(api);
      buildShields(api);
    },

    resize: function (api) {
      var d = api.data, v = api.view;
      d.ship.y = v.h - 38;
      d.ship.x = U.clamp(d.ship.x, 24, v.w - 24);
    },

    update: function (dt, t, api) {
      var d = api.data, v = api.view, I = api.input;

      /* ---- wave transition (safe point: start of frame, never mid-iteration).
             Resets the enemy array, collision state and spawn timers together
             so nothing from the previous wave can poison the next one. ---- */
      if (d.waveQueued) {
        d.waveQueued = false;
        d.wave++;
        startWave(api);
      }

      /* ---- ship ---- */
      var ax = I.axisX();
      if (I.pointer.down) ax = U.clamp((I.pointer.x - d.ship.x) / 60, -1, 1);
      d.ship.x = U.clamp(d.ship.x + ax * 400 * dt, 20, v.w - 20);
      if (Math.abs(ax) > 0.1) api.fx.trail(d.ship.x - ax * 10, d.ship.y + 12, api.colors[1], 5, 0.25);

      /* ---- firing ---- */
      d.ship.cool -= dt;
      if ((I.held("action") || I.held("dash") || I.pointer.down) && d.ship.cool <= 0) {
        d.ship.cool = d.weapon === 2 ? 0.26 : 0.2;
        var shots = d.weapon === 0 ? [0] : d.weapon === 1 ? [-7, 7] : [-0.3, 0, 0.3];
        for (var s = 0; s < shots.length; s++) {
          if (d.weapon === 2) {
            d.bullets.push({ x: d.ship.x, y: d.ship.y - 16, vx: Math.sin(shots[s]) * 300, vy: -560 });
          } else {
            d.bullets.push({ x: d.ship.x + shots[s], y: d.ship.y - 16, vx: 0, vy: -600 });
          }
        }
        api.sfx(1200, 0.05, "square", 0.05);
        api.fx.spark(d.ship.x, d.ship.y - 18, -Math.PI / 2, { count: 4, color: api.colors[1] });
      }

      /* ---- player bullets ---- */
      for (var b = d.bullets.length - 1; b >= 0; b--) {
        var bl = d.bullets[b];
        bl.x += bl.vx * dt; bl.y += bl.vy * dt;
        api.fx.trail(bl.x, bl.y, api.colors[1], 3, 0.16);
        if (bl.y < -12) { d.bullets.splice(b, 1); continue; }
        if (hitShield(api, bl.x, bl.y, true)) { d.bullets.splice(b, 1); continue; }

        var consumed = false;
        for (var i = 0; i < d.invaders.length && !consumed; i++) {
          var iv = d.invaders[i];
          if (!iv.alive) continue;
          if (Math.abs(bl.x - iv.x) < iv.r && Math.abs(bl.y - iv.y) < iv.r) {
            iv.alive = false;
            consumed = true;
            api.hit(iv.tier * 50, iv.x, iv.y);
            api.xp(1);
            api.fx.burst(iv.x, iv.y, { count: 18, colors: [api.colors[iv.tier % 4], "#ffffff"], speed: 220 });
            api.fx.shake(2);
            api.sfx(420 + iv.tier * 120, 0.07, "sawtooth", 0.06);
            if (Math.random() < 0.12) d.drops.push({ x: iv.x, y: iv.y, vy: 90, kind: Math.random() < 0.5 ? "w" : "l" });
          }
        }
        if (!consumed && d.boss && bl.y < d.boss.y + 26 && Math.abs(bl.x - d.boss.x) < d.boss.w / 2 && bl.y > d.boss.y - 26) {
          d.boss.hp--;
          consumed = true;
          api.hit(30, bl.x, bl.y);
          api.fx.spark(bl.x, bl.y, Math.PI / 2, { color: api.colors[0] });
          api.fx.shake(1.5);
          if (d.boss.hp <= 0) {
            api.fx.burst(d.boss.x, d.boss.y, { count: 90, colors: api.colors, speed: 420, life: 1 });
            api.fx.shake(20); api.fx.flash(api.colors[2], 0.6);
            api.addScore(2500, d.boss.x, d.boss.y, "+2500 BOSS");
            api.xp(12);
            if (api.audio) api.audio.explosion();
            d.boss = null;
            d.waveQueued = true;   // rebuild the field at the next safe point — never mid-bullet-loop
          }
        }
        if (consumed) d.bullets.splice(b, 1);
      }

      /* ---- invader march ---- */
      var alive = 0, lowest = 0;
      for (var m = 0; m < d.invaders.length; m++) if (d.invaders[m].alive) { alive++; lowest = Math.max(lowest, d.invaders[m].y); }
      if (alive === 0 && !d.boss && !d.waveQueued) {
        d.waveQueued = true;   // field cleared — queue the next wave (handled at the start of the next frame)
      }

      /* ---- wave escalation: the grid marches faster as waves progress ---- */
      var speed = (26 + (d.invaders.length - alive) * 1.6 + d.wave * 8);
      d.marchT += dt;
      var shiftX = d.dir * speed * dt;
      var bounce = false;
      for (var q = 0; q < d.invaders.length; q++) {
        var inv = d.invaders[q];
        if (!inv.alive) continue;
        inv.x += shiftX;
        if (inv.x < 22 || inv.x > v.w - 22) bounce = true;
      }
      if (bounce) {
        d.dir *= -1;
        for (var w2 = 0; w2 < d.invaders.length; w2++) {
          if (d.invaders[w2].alive) { d.invaders[w2].x += d.dir * 4; d.invaders[w2].y += 16; }
        }
      }
      if (lowest > d.ship.y - 40 && alive > 0) damage(api, true);

      /* ---- invader fire: cadence tightens and volley density grows per wave ---- */
      d.fireT = (d.fireT || 0) - dt;
      if (d.fireT <= 0 && alive > 0) {
        d.fireT = Math.max(0.24, 1.4 - d.wave * 0.12);
        var shooters = d.invaders.filter(function (x) { return x.alive; });
        var volleys = Math.min(3, shooters.length, 1 + Math.floor(d.wave / 3));
        var used = {};
        for (var vv = 0; vv < volleys; vv++) {
          var pi = (Math.random() * shooters.length) | 0;
          var spins = 0;
          while (used[pi] && spins < shooters.length) { pi = (pi + 1) % shooters.length; spins++; }
          if (used[pi]) break;
          used[pi] = true;
          var pick = shooters[pi];
          d.bombs.push({ x: pick.x, y: pick.y + 12, vx: (Math.random() - 0.5) * 26, vy: Math.min(340, 170 + d.wave * 14) });
        }
      }

      /* ---- boss behaviour ---- */
      if (d.boss) {
        var bo = d.boss;
        bo.x += Math.cos(t * 0.9) * 150 * dt;
        bo.x = U.clamp(bo.x, bo.w / 2 + 10, v.w - bo.w / 2 - 10);
        bo.fire -= dt;
        if (bo.fire <= 0) {
          bo.phase = (bo.phase + 1) % 3;
          bo.fire = bo.phase === 2 ? 1.5 : 0.75;
          if (bo.phase === 0) {
            for (var f = -2; f <= 2; f++) d.bombs.push({ x: bo.x, y: bo.y + 22, vx: f * 70, vy: 210 });
          } else if (bo.phase === 1) {
            var ang = Math.atan2(d.ship.y - bo.y, d.ship.x - bo.x);
            d.bombs.push({ x: bo.x, y: bo.y + 22, vx: Math.cos(ang) * 280, vy: Math.sin(ang) * 280 });
          } else {
            for (var r = 0; r < 10; r++) {
              var a2 = (r / 10) * Math.PI + 0.1;
              d.bombs.push({ x: bo.x, y: bo.y + 18, vx: Math.cos(a2) * 170, vy: Math.abs(Math.sin(a2)) * 210 });
            }
          }
          api.sfx(180, 0.14, "sawtooth", 0.06);
        }
      }

      /* ---- bombs ----
         NOTE: damage() wipes the bombs array, so this loop must tolerate a
         shrunk/emptied array mid-iteration (the old code dereferenced a hole
         and killed the RAF loop — the classic "frozen screen" bug). */
      for (var k = d.bombs.length - 1; k >= 0; k--) {
        var bm = d.bombs[k];
        if (!bm) continue;
        bm.x += bm.vx * dt; bm.y += bm.vy * dt;
        api.fx.trail(bm.x, bm.y, api.colors[0], 3.5, 0.2);
        if (bm.y > v.h + 14 || bm.x < -14 || bm.x > v.w + 14) { d.bombs.splice(k, 1); continue; }
        if (hitShield(api, bm.x, bm.y, false)) { d.bombs.splice(k, 1); continue; }
        if (U.circleHit(bm.x, bm.y, 5, d.ship.x, d.ship.y, 12)) {
          d.bombs.splice(k, 1);
          damage(api, false);
          break;   // damage() cleared the rest of the swarm — exit cleanly
        }
      }

      /* ---- drops ---- */
      for (var p = d.drops.length - 1; p >= 0; p--) {
        var dp = d.drops[p];
        dp.y += dp.vy * dt;
        if (dp.y > v.h + 14) { d.drops.splice(p, 1); continue; }
        if (U.circleHit(dp.x, dp.y, 10, d.ship.x, d.ship.y, 15)) {
          if (dp.kind === "w") {
            d.weapon = Math.min(2, d.weapon + 1);
            api.fx.popup(d.ship.x, d.ship.y - 30, ["SINGLE", "DOUBLE", "SPREAD"][d.weapon], api.colors[1], 15);
          } else {
            d.lives = Math.min(5, d.lives + 1);
            api.fx.popup(d.ship.x, d.ship.y - 30, "+1 LIFE", api.colors[2], 15);
          }
          api.addScore(120);
          if (api.audio) api.audio.arpUp();
          d.drops.splice(p, 1);
        }
      }
    },

    draw: function (ctx, t, api) {
      var d = api.data, v = api.view, c = api.colors;
      Draw.grid(ctx, v.w, v.h, 46, c[1], 0, 0.045);

      /* shields */
      for (var s = 0; s < d.shields.length; s++) {
        var sh = d.shields[s];
        if (sh.hp <= 0) continue;
        ctx.globalAlpha = 0.35 + (sh.hp / 3) * 0.65;
        ctx.fillStyle = sh.hp > 2 ? c[1] : sh.hp > 1 ? c[2] : c[0];
        ctx.fillRect(sh.x, sh.y, sh.s, sh.s);
        ctx.globalAlpha = 1;
      }

      /* invaders */
      for (var i = 0; i < d.invaders.length; i++) {
        var iv = d.invaders[i];
        if (!iv.alive) continue;
        var wob = Math.sin(t * 3 + iv.col * 0.4) * 2;
        Draw.poly(ctx, INV_SHAPES[iv.tier % 3], iv.x, iv.y + wob, 0, c[iv.tier % 4], false, 2);
      }

      /* boss */
      if (d.boss) {
        var bo = d.boss;
        Draw.poly(ctx, [[-bo.w / 2, 0], [-bo.w / 3, -24], [bo.w / 3, -24], [bo.w / 2, 0], [bo.w / 4, 22], [-bo.w / 4, 22]],
          bo.x, bo.y, 0, c[0], false, 3);
        Draw.circle(ctx, bo.x, bo.y, 9 + Math.sin(t * 8) * 3, c[2], true);
        var pct = bo.hp / bo.max;
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(v.w * 0.2, 14, v.w * 0.6, 7);
        ctx.fillStyle = pct > 0.4 ? c[0] : "#ff2b5e";
        Draw.glow(ctx, c[0], 12);
        ctx.fillRect(v.w * 0.2, 14, v.w * 0.6 * pct, 7);
        ctx.shadowBlur = 0;
        Draw.hud(ctx, "SENTINEL CORE", v.w / 2, 32, c[0], "center", 10);
      }

      /* bullets + bombs */
      for (var b = 0; b < d.bullets.length; b++) {
        Draw.line(ctx, d.bullets[b].x, d.bullets[b].y, d.bullets[b].x, d.bullets[b].y + 12, c[1], 3, 10);
      }
      for (var k = 0; k < d.bombs.length; k++) {
        Draw.circle(ctx, d.bombs[k].x, d.bombs[k].y, 4.5, c[0], true);
      }

      /* drops */
      for (var p = 0; p < d.drops.length; p++) {
        var dp = d.drops[p];
        Draw.rect(ctx, dp.x - 9, dp.y - 9, 18, 18, dp.kind === "w" ? c[1] : c[2], false, 4);
        Draw.text(ctx, dp.kind === "w" ? "W" : "+", dp.x, dp.y, 11, dp.kind === "w" ? c[1] : c[2], "center", 900);
      }

      /* ship */
      Draw.poly(ctx, [[-17, 10], [0, -16], [17, 10], [0, 3]], d.ship.x, d.ship.y, 0, c[1], false, 2.4);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      Draw.circle(ctx, d.ship.x, d.ship.y + 12, 4 + Math.random() * 3, c[2], true);
      ctx.restore();

      /* HUD */
      for (var l = 0; l < d.lives; l++) Draw.poly(ctx, [[-6, 4], [0, -6], [6, 4]], 18 + l * 18, v.h - 14, 0, c[1], true);
      Draw.hud(ctx, "WAVE " + d.wave + " · " + ["SINGLE", "DOUBLE", "SPREAD"][d.weapon], v.w - 10, v.h - 14, c[2], "right", 11);
    },
  });

  var INV_SHAPES = [
    [[-11, -6], [-5, -11], [5, -11], [11, -6], [11, 6], [5, 2], [-5, 2], [-11, 6]],
    [[0, -12], [11, 0], [6, 11], [-6, 11], [-11, 0]],
    [[-12, -4], [-4, -10], [4, -10], [12, -4], [6, 10], [-6, 10]],
  ];

  /* ---- clean wave transition: runs ONLY at the start-of-frame safe point ---- */
  function startWave(api) {
    var d = api.data, v = api.view;

    // reset collision state left over from the previous wave
    d.bullets.length = 0;
    d.bombs.length = 0;
    d.drops.length = 0;
    d.fireT = Math.max(0.6, 1.4 - d.wave * 0.12);
    d.marchT = 0;
    d.dir = 1;

    if (d.wave % 3 === 0) {
      spawnBoss(api);          // every 3rd wave: SENTINEL boss
    } else {
      buildWave(api);
      buildShields(api);       // shields are rebuilt between assault waves
      api.fx.popup(v.w / 2, v.h * 0.44, "WAVE " + d.wave, api.colors[1], 20);
      api.sfx(520 + Math.min(8, d.wave) * 40, 0.08, "triangle", 0.05);
    }
  }

  /* ---- progressive spawn: waves 1..N grow in rank & file every 2 waves ---- */
  function buildWave(api) {
    var d = api.data, v = api.view;
    d.invaders = [];
    var cols = U.clamp(6 + Math.floor((d.wave - 1) / 2), 6, 9);
    var rows = U.clamp(3 + Math.floor((d.wave - 1) / 2), 3, 6);
    var gapX = Math.max(28, Math.min(64, (v.w - 60) / cols));
    var gapY = rows >= 6 ? 32 : 38;
    var startX = (v.w - (cols - 1) * gapX) / 2;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        d.invaders.push({
          x: startX + c * gapX, y: 58 + r * gapY, r: 13,
          tier: ((rows - r) + d.wave - 1) % 4 + 1, col: c, alive: true,
        });
      }
    }
  }

  function spawnBoss(api) {
    var d = api.data, v = api.view;
    d.invaders = [];
    d.boss = { x: v.w / 2, y: 80, w: 130, hp: 40 + d.wave * 6, max: 40 + d.wave * 6, fire: 1, phase: 0 };
    api.fx.flash(api.colors[0], 0.5);
    api.fx.shake(12);
    api.fx.popup(v.w / 2, v.h * 0.4, "WAVE " + d.wave, api.colors[1], 20);
    api.fx.popup(v.w / 2, v.h / 2, "SENTINEL INBOUND", api.colors[0], 22);
    if (api.audio) api.audio.explosion();
  }

  function buildShields(api) {
    var d = api.data, v = api.view;
    d.shields = [];
    var count = 4, block = 8;
    for (var s = 0; s < count; s++) {
      var bx = (v.w / (count + 1)) * (s + 1) - 28;
      var by = v.h - 118;
      for (var gx = 0; gx < 7; gx++) {
        for (var gy = 0; gy < 4; gy++) {
          if (gy === 3 && gx > 1 && gx < 5) continue;   // arch doorway
          d.shields.push({ x: bx + gx * block, y: by + gy * block, s: block, hp: 3 });
        }
      }
    }
  }

  function hitShield(api, x, y, fromPlayer) {
    var d = api.data;
    for (var i = 0; i < d.shields.length; i++) {
      var sh = d.shields[i];
      if (sh.hp <= 0) continue;
      if (x >= sh.x && x <= sh.x + sh.s && y >= sh.y && y <= sh.y + sh.s) {
        sh.hp--;
        api.fx.spark(x, y, fromPlayer ? -Math.PI / 2 : Math.PI / 2, { count: 5, color: api.colors[2] });
        return true;
      }
    }
    return false;
  }

  function damage(api, fatal) {
    var d = api.data;
    d.lives--;
    d.weapon = Math.max(0, d.weapon - 1);
    d.bombs.length = 0;   // safe: the bombs loop breaks as soon as damage() runs
    api.breakCombo();
    api.fx.burst(d.ship.x, d.ship.y, { count: 40, colors: ["#ff2b5e", api.colors[2]], speed: 300 });
    api.fx.shake(14);
    api.fx.flash("#ff2b5e", 0.55);
    if (api.audio) api.audio.explosion();
    if (d.lives <= 0 || fatal) api.gameOver();
  }

  /* ==================================================================
     03 — ASTEROID VECTOR
     ================================================================== */
  FX.register({
    key: "asteroid-vector",
    title: "Asteroid Vector",
    hint: "← → rotate · ↑ thrust (inertia!) · SPACE fire · Q/E or ◆ swap weapon · beware the singularity",
    pad: true,

    setup: function (api) {
      var d = api.data, v = api.view;
      d.ship = { x: v.w / 2, y: v.h / 2, vx: 0, vy: 0, a: -Math.PI / 2, cool: 0, inv: 2 };
      d.rocks = [];
      d.shots = [];
      d.lives = 3;
      d.wave = 1;
      d.weapon = 0;   // 0 pulse · 1 spread · 2 rail
      d.hole = { x: v.w * 0.5, y: v.h * 0.5, r: 16, pull: 2600 };
      spawnRocks(api, 4);
    },

    resize: function (api) {
      api.data.hole.x = api.view.w / 2;
      api.data.hole.y = api.view.h / 2;
    },

    update: function (dt, t, api) {
      var d = api.data, v = api.view, I = api.input;
      var sh = d.ship;

      if (sh.inv > 0) sh.inv -= dt;

      /* ---- rotation & thrust (true inertia) ---- */
      sh.a += I.axisX() * 3.6 * dt;
      var thrusting = I.held("up");
      if (thrusting) {
        sh.vx += Math.cos(sh.a) * 330 * dt;
        sh.vy += Math.sin(sh.a) * 330 * dt;
        api.fx.trail(sh.x - Math.cos(sh.a) * 14, sh.y - Math.sin(sh.a) * 14, api.colors[2], 5, 0.3);
      }
      /* gravity well */
      var gdx = d.hole.x - sh.x, gdy = d.hole.y - sh.y;
      var gd = Math.max(40, Math.hypot(gdx, gdy));
      sh.vx += (gdx / gd) * (d.hole.pull / (gd * 0.9)) * dt;
      sh.vy += (gdy / gd) * (d.hole.pull / (gd * 0.9)) * dt;

      var drag = Math.pow(0.55, dt);
      sh.vx *= drag; sh.vy *= drag;
      var sp = Math.hypot(sh.vx, sh.vy);
      if (sp > 460) { sh.vx = sh.vx / sp * 460; sh.vy = sh.vy / sp * 460; }
      sh.x = wrap(sh.x + sh.vx * dt, v.w);
      sh.y = wrap(sh.y + sh.vy * dt, v.h);

      if (gd < d.hole.r + 12 && sh.inv <= 0) shipDown(api);

      /* ---- weapon swap ---- */
      if (I.pressed("swap") || I.pressed("dash")) {
        d.weapon = (d.weapon + 1) % 3;
        api.fx.popup(sh.x, sh.y - 26, ["PULSE", "SPREAD", "RAIL"][d.weapon], api.colors[1], 15);
        api.sfx(700 + d.weapon * 200, 0.08, "triangle", 0.06);
      }

      /* ---- fire ---- */
      sh.cool -= dt;
      if ((I.held("action") || I.pointer.down) && sh.cool <= 0) {
        var cfg = [{ n: 1, sp: 520, cd: 0.22, dmg: 1 }, { n: 3, sp: 460, cd: 0.34, dmg: 1 }, { n: 1, sp: 860, cd: 0.42, dmg: 3 }][d.weapon];
        for (var i = 0; i < cfg.n; i++) {
          var off = (i - (cfg.n - 1) / 2) * 0.24;
          d.shots.push({
            x: sh.x + Math.cos(sh.a) * 16, y: sh.y + Math.sin(sh.a) * 16,
            vx: sh.vx * 0.3 + Math.cos(sh.a + off) * cfg.sp,
            vy: sh.vy * 0.3 + Math.sin(sh.a + off) * cfg.sp,
            life: d.weapon === 2 ? 1.1 : 0.85, dmg: cfg.dmg, rail: d.weapon === 2,
          });
        }
        sh.cool = cfg.cd;
        sh.vx -= Math.cos(sh.a) * 26; sh.vy -= Math.sin(sh.a) * 26;  // recoil
        api.sfx(d.weapon === 2 ? 320 : 1000, 0.06, d.weapon === 2 ? "sawtooth" : "square", 0.05);
      }

      /* ---- shots ---- */
      for (var s = d.shots.length - 1; s >= 0; s--) {
        var b = d.shots[s];
        b.life -= dt;
        b.x = wrap(b.x + b.vx * dt, v.w);
        b.y = wrap(b.y + b.vy * dt, v.h);
        api.fx.trail(b.x, b.y, b.rail ? api.colors[0] : api.colors[1], b.rail ? 4 : 2.5, 0.2);
        if (b.life <= 0) { d.shots.splice(s, 1); continue; }
        for (var r = d.rocks.length - 1; r >= 0; r--) {
          var rk = d.rocks[r];
          if (!U.circleHit(b.x, b.y, 3, rk.x, rk.y, rk.r)) continue;
          rk.hp -= b.dmg;
          api.fx.spark(b.x, b.y, Math.atan2(b.vy, b.vx), { count: 7, color: api.colors[2] });
          if (!b.rail) d.shots.splice(s, 1);
          if (rk.hp <= 0) splitRock(api, r);
          break;
        }
      }

      /* ---- rocks ---- */
      for (var k = 0; k < d.rocks.length; k++) {
        var rock = d.rocks[k];
        var hx = d.hole.x - rock.x, hy = d.hole.y - rock.y;
        var hd = Math.max(50, Math.hypot(hx, hy));
        rock.vx += (hx / hd) * (d.hole.pull * 0.55 / hd) * dt;
        rock.vy += (hy / hd) * (d.hole.pull * 0.55 / hd) * dt;
        rock.x = wrap(rock.x + rock.vx * dt, v.w);
        rock.y = wrap(rock.y + rock.vy * dt, v.h);
        rock.a += rock.spin * dt;
        if (hd < d.hole.r + rock.r * 0.4) { d.rocks.splice(k, 1); k--; api.fx.burst(d.hole.x, d.hole.y, { count: 12, color: api.colors[3], speed: 90 }); continue; }
        if (sh.inv <= 0 && U.circleHit(sh.x, sh.y, 10, rock.x, rock.y, rock.r)) { shipDown(api); break; }
      }

      if (d.rocks.length === 0) {
        d.wave++;
        api.addScore(400 + d.wave * 100, v.w / 2, v.h / 2, "WAVE " + d.wave);
        api.xp(5);
        spawnRocks(api, Math.min(9, 3 + d.wave));
      }
    },

    draw: function (ctx, t, api) {
      var d = api.data, v = api.view, c = api.colors;
      var sh = d.ship;

      /* singularity */
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var g = 4; g > 0; g--) {
        ctx.globalAlpha = 0.07 * g;
        Draw.circle(ctx, d.hole.x, d.hole.y, d.hole.r * (1 + g * 0.9), c[3], true);
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(d.hole.x, d.hole.y, d.hole.r, 0, 6.3);
      ctx.fillStyle = "#05010c"; ctx.fill();
      for (var ring = 0; ring < 2; ring++) {
        ctx.beginPath();
        ctx.arc(d.hole.x, d.hole.y, d.hole.r + 8 + ring * 9, t * (1.6 + ring) % 6.3, t * (1.6 + ring) % 6.3 + 2.4);
        Draw.neonStroke(ctx, c[3], 2, 12);
      }

      /* rocks */
      for (var i = 0; i < d.rocks.length; i++) {
        var rk = d.rocks[i];
        Draw.poly(ctx, rk.shape, rk.x, rk.y, rk.a, c[rk.tier % 4], false, 2);
      }
      /* shots */
      for (var s = 0; s < d.shots.length; s++) {
        var b = d.shots[s];
        if (b.rail) Draw.line(ctx, b.x, b.y, b.x - b.vx * 0.02, b.y - b.vy * 0.02, c[0], 3.5, 14);
        else Draw.circle(ctx, b.x, b.y, 2.6, c[1], true);
      }
      /* ship */
      if (sh.inv <= 0 || Math.floor(t * 12) % 2 === 0) {
        Draw.poly(ctx, [[16, 0], [-11, -10], [-6, 0], [-11, 10]], sh.x, sh.y, sh.a, c[1], false, 2.2);
        if (api.input.held("up")) {
          Draw.poly(ctx, [[-8, -5], [-20 - Math.random() * 8, 0], [-8, 5]], sh.x, sh.y, sh.a, c[2], true);
        }
      }
      for (var l = 0; l < d.lives; l++) Draw.poly(ctx, [[7, 0], [-5, -5], [-5, 5]], 18 + l * 18, v.h - 14, 0, c[1], true);
      Draw.hud(ctx, ["PULSE", "SPREAD", "RAIL"][d.weapon] + " · FIELD " + d.wave, v.w - 10, v.h - 14, c[2], "right", 11);
    },
  });

  function wrap(v2, max) { return v2 < 0 ? v2 + max : v2 > max ? v2 - max : v2; }

  function rockShape(r) {
    var pts = [], n = 9;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var rr = r * (0.68 + Math.random() * 0.5);
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    return pts;
  }

  function spawnRocks(api, n) {
    var d = api.data, v = api.view;
    for (var i = 0; i < n; i++) {
      var edge = Math.random() < 0.5;
      var x = edge ? U.rand(0, v.w) : (Math.random() < 0.5 ? 10 : v.w - 10);
      var y = edge ? (Math.random() < 0.5 ? 10 : v.h - 10) : U.rand(0, v.h);
      var r = U.rand(26, 38);
      d.rocks.push({
        x: x, y: y, vx: U.rand(-70, 70), vy: U.rand(-70, 70),
        r: r, tier: 3, hp: 3, a: 0, spin: U.rand(-1.4, 1.4), shape: rockShape(r),
      });
    }
  }

  function splitRock(api, index) {
    var d = api.data;
    var rk = d.rocks[index];
    d.rocks.splice(index, 1);
    api.hit(rk.tier * 40, rk.x, rk.y);
    api.xp(1);
    api.fx.burst(rk.x, rk.y, { count: 22, colors: [api.colors[rk.tier % 4], "#ffffff"], speed: 240 });
    api.fx.shake(rk.tier * 1.6);
    api.sfx(240 + rk.tier * 90, 0.1, "sawtooth", 0.06);
    if (rk.tier <= 1) return;
    for (var i = 0; i < 2; i++) {
      var nr = rk.r * 0.58;
      d.rocks.push({
        x: rk.x + U.rand(-8, 8), y: rk.y + U.rand(-8, 8),
        vx: rk.vx + U.rand(-90, 90), vy: rk.vy + U.rand(-90, 90),
        r: nr, tier: rk.tier - 1, hp: rk.tier - 1, a: 0,
        spin: U.rand(-2.2, 2.2), shape: rockShape(nr),
      });
    }
  }

  function shipDown(api) {
    var d = api.data, v = api.view;
    d.lives--;
    api.breakCombo();
    api.fx.burst(d.ship.x, d.ship.y, { count: 50, colors: ["#ff2b5e", api.colors[2]], speed: 330 });
    api.fx.shake(16);
    api.fx.flash("#ff2b5e", 0.6);
    if (api.audio) api.audio.explosion();
    if (d.lives <= 0) { api.gameOver(); return; }
    d.ship.x = v.w * 0.25; d.ship.y = v.h * 0.25;
    d.ship.vx = 0; d.ship.vy = 0; d.ship.inv = 2.4;
  }

  /* ==================================================================
     04 — BULLET HELL RUSH
     ================================================================== */
  FX.register({
    key: "bullet-hell-rush",
    title: "Bullet Hell Rush",
    hint: "WASD / ARROWS dodge · hold SHIFT or ◆ = PHASE SHIFT slow-mo · graze bullets for bonus score",
    pad: true,

    setup: function (api) {
      var d = api.data, v = api.view;
      d.p = { x: v.w / 2, y: v.h * 0.72, r: 4.5 };
      d.bullets = [];
      d.emitters = [
        { x: v.w * 0.5, y: v.h * 0.16, mode: 0, t: 0, ang: 0 },
      ];
      d.energy = 1;        // phase meter 0..1
      d.phasing = false;
      d.survive = 0;
      d.grazes = 0;
      d.nextWave = 8;
      d.lives = 3;
      d.inv = 1.5;
    },

    resize: function (api) {
      var d = api.data, v = api.view;
      d.p.x = U.clamp(d.p.x, 10, v.w - 10);
      d.p.y = U.clamp(d.p.y, 10, v.h - 10);
    },

    update: function (dt, t, api) {
      var d = api.data, v = api.view, I = api.input;

      /* ---- phase shift (slow-mo) ---- */
      d.phasing = (I.held("dash") || I.held("action")) && d.energy > 0.02;
      if (d.phasing) {
        d.energy = Math.max(0, d.energy - dt * 0.45);
        if (d.energy === 0) api.fx.popup(d.p.x, d.p.y - 26, "DEPLETED", "#ff2b5e", 13);
      } else {
        d.energy = Math.min(1, d.energy + dt * 0.22);
      }
      var scale = d.phasing ? 0.34 : 1;    // world time scale
      var wdt = dt * scale;

      if (d.inv > 0) d.inv -= dt;

      /* ---- movement (player keeps full speed during phase = the payoff) ---- */
      var ax = I.axisX(), ay = I.axisY();
      if (I.pointer.down) {
        ax = U.clamp((I.pointer.x - d.p.x) / 40, -1, 1);
        ay = U.clamp((I.pointer.y - d.p.y) / 40, -1, 1);
      }
      var mag = Math.hypot(ax, ay) || 1;
      var spd = d.phasing ? 210 : 290;
      d.p.x = U.clamp(d.p.x + (ax / mag) * spd * dt, 8, v.w - 8);
      d.p.y = U.clamp(d.p.y + (ay / mag) * spd * dt, 8, v.h - 8);
      if (Math.abs(ax) + Math.abs(ay) > 0.1) api.fx.trail(d.p.x, d.p.y, d.phasing ? api.colors[3] : api.colors[1], 6, 0.28);

      /* ---- survival score ---- */
      d.survive += dt;
      api.state.score = Math.floor(d.survive * 100) + d.grazes * 25;
      api.env.onScore(api.state.score);
      if (Math.floor(d.survive) > 0 && Math.floor(d.survive) % 5 === 0 && !d.xpMark) {
        d.xpMark = true; api.xp(2);
      } else if (Math.floor(d.survive) % 5 !== 0) d.xpMark = false;

      /* ---- escalation: more emitters over time ---- */
      if (d.survive > d.nextWave && d.emitters.length < 5) {
        d.nextWave += 12;
        var spots = [[0.18, 0.2], [0.82, 0.2], [0.14, 0.55], [0.86, 0.55]];
        var sp = spots[(d.emitters.length - 1) % spots.length];
        d.emitters.push({ x: v.w * sp[0], y: v.h * sp[1], mode: d.emitters.length % 4, t: 0, ang: Math.random() * 6.3 });
        api.fx.flash(api.colors[0], 0.4);
        api.fx.popup(v.w / 2, v.h * 0.3, "EMITTER ONLINE", api.colors[0], 18);
        api.fx.shake(9);
      }

      /* ---- emitters: procedural patterns ---- */
      for (var e = 0; e < d.emitters.length; e++) {
        var em = d.emitters[e];
        em.t -= wdt;
        em.ang += wdt * 1.4;
        if (em.t > 0) continue;
        var diff = 1 + d.survive / 45;
        if (em.mode === 0) {            /* rotating spiral */
          em.t = 0.085 / diff;
          for (var a = 0; a < 3; a++) {
            var ang = em.ang * 2.3 + (a / 3) * Math.PI * 2;
            pushBullet(d, em.x, em.y, Math.cos(ang) * 140, Math.sin(ang) * 140, api.colors[0]);
          }
        } else if (em.mode === 1) {     /* expanding rings */
          em.t = 1.5 / diff;
          var n = 16;
          for (var i = 0; i < n; i++) {
            var a2 = (i / n) * Math.PI * 2 + em.ang;
            pushBullet(d, em.x, em.y, Math.cos(a2) * 125, Math.sin(a2) * 125, api.colors[1]);
          }
          api.sfx(260, 0.09, "sine", 0.04);
        } else if (em.mode === 2) {     /* aimed bursts */
          em.t = 1.05 / diff;
          var base = Math.atan2(d.p.y - em.y, d.p.x - em.x);
          for (var k = -2; k <= 2; k++) {
            pushBullet(d, em.x, em.y, Math.cos(base + k * 0.13) * 215, Math.sin(base + k * 0.13) * 215, api.colors[2]);
          }
        } else {                        /* sine wall */
          em.t = 0.18 / diff;
          var ang3 = Math.PI / 2 + Math.sin(em.ang * 1.7) * 0.9;
          pushBullet(d, em.x, em.y, Math.cos(ang3) * 175, Math.sin(ang3) * 175, api.colors[3]);
        }
      }

      /* ---- bullets, graze detection ---- */
      for (var b = d.bullets.length - 1; b >= 0; b--) {
        var bl = d.bullets[b];
        bl.x += bl.vx * wdt; bl.y += bl.vy * wdt;
        bl.life -= wdt;
        if (bl.life <= 0 || bl.x < -20 || bl.x > v.w + 20 || bl.y < -20 || bl.y > v.h + 20) {
          d.bullets.splice(b, 1); continue;
        }
        var dd = U.dist(bl.x, bl.y, d.p.x, d.p.y);
        if (dd < d.p.r + 4 && d.inv <= 0) {
          hitPlayer(api);
          break;
        } else if (dd < 26 && !bl.grazed) {
          bl.grazed = true;
          d.grazes++;
          api.fx.spark(bl.x, bl.y, Math.atan2(bl.vy, bl.vx), { count: 3, color: api.colors[2], speed: 90 });
          if (d.grazes % 10 === 0) {
            api.fx.popup(d.p.x, d.p.y - 26, "GRAZE x" + d.grazes, api.colors[2], 14);
            d.energy = Math.min(1, d.energy + 0.12);
          }
        }
      }
    },

    draw: function (ctx, t, api) {
      var d = api.data, v = api.view, c = api.colors;

      if (d.phasing) {
        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = c[3];
        ctx.fillRect(0, 0, v.w, v.h);
        ctx.restore();
      }
      Draw.grid(ctx, v.w, v.h, 40, c[1], 0, d.phasing ? 0.1 : 0.04);

      for (var e = 0; e < d.emitters.length; e++) {
        var em = d.emitters[e];
        Draw.poly(ctx, [[0, -13], [12, 0], [0, 13], [-12, 0]], em.x, em.y, em.ang, c[em.mode % 4], false, 2);
        Draw.circle(ctx, em.x, em.y, 4, c[em.mode % 4], true);
      }

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var b = 0; b < d.bullets.length; b++) {
        var bl = d.bullets[b];
        ctx.fillStyle = bl.color;
        ctx.beginPath();
        ctx.arc(bl.x, bl.y, 4, 0, 6.3);
        ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(bl.x, bl.y, 7.5, 0, 6.3);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      /* player: outer shell + tiny true hitbox */
      if (d.inv <= 0 || Math.floor(t * 14) % 2 === 0) {
        Draw.circle(ctx, d.p.x, d.p.y, 13, d.phasing ? c[3] : c[1], false, 1.6);
        Draw.circle(ctx, d.p.x, d.p.y, d.p.r, "#ffffff", true);
      }

      /* phase meter */
      var mw = 120;
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(12, v.h - 20, mw, 7);
      ctx.fillStyle = d.energy > 0.25 ? c[3] : "#ff2b5e";
      Draw.glow(ctx, c[3], 10);
      ctx.fillRect(12, v.h - 20, mw * d.energy, 7);
      ctx.shadowBlur = 0;
      Draw.hud(ctx, "PHASE", 12, v.h - 30, c[3], "left", 10);
      Draw.hud(ctx, d.survive.toFixed(1) + "s · GRAZE " + d.grazes, v.w - 10, v.h - 16, c[2], "right", 11);
      for (var l = 0; l < d.lives; l++) Draw.circle(ctx, v.w - 16 - l * 16, 18, 5, c[0], true);
    },
  });

  function pushBullet(d, x, y, vx, vy, color) {
    if (d.bullets.length > 420) return;
    d.bullets.push({ x: x, y: y, vx: vx, vy: vy, color: color, life: 9, grazed: false });
  }

  function hitPlayer(api) {
    var d = api.data;
    d.lives--;
    d.inv = 2;
    d.bullets.length = 0;
    api.fx.burst(d.p.x, d.p.y, { count: 46, colors: ["#ff2b5e", api.colors[1]], speed: 320 });
    api.fx.shake(18);
    api.fx.flash("#ff2b5e", 0.65);
    if (api.audio) api.audio.explosion();
    if (d.lives <= 0) api.gameOver();
  }
})();
