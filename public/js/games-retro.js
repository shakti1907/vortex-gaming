/* ==========================================================================
   VORTEX GAMING — games-retro.js
   RETRO 09  Neon Pong 2.0     — curve/spin shots, paddle powerups, live walls
   RETRO 10  Grid Pac-Runner   — maze harvesting vs patrol sentinel AI
   RETRO 11  Cyber Soar        — continuous-thrust gravity flyer
   RETRO 12  Retro Defender    — missile-command interception with chain blasts
   ========================================================================== */
(function () {
  "use strict";

  var FX = window.VortexFX;
  var Draw = FX.Draw, U = FX.Util;

  /* ==================================================================
     09 — NEON PONG 2.0
     ================================================================== */
  FX.register({
    key: "neon-pong",
    title: "Neon Pong 2.0",
    hint: "↑ ↓ / W S or MOUSE move · paddle motion adds CURVE spin · grab powerups · first to 7 wins",
    pad: true,

    setup: function (api) {
      var d = api.data, v = api.view;
      d.p = { y: v.h / 2, h: 90, vy: 0 };
      d.ai = { y: v.h / 2, h: 90 };
      d.pts = 0; d.aiPts = 0;
      d.rally = 0;
      d.powers = [];
      d.walls = { top: 0, bottom: 0 };
      pongServe(api, 1);
    },
    resize: function (api) {
      var d = api.data, v = api.view;
      d.p.y = U.clamp(d.p.y, d.p.h / 2, v.h - d.p.h / 2);
      d.ai.y = U.clamp(d.ai.y, d.ai.h / 2, v.h - d.ai.h / 2);
    },

    update: function (dt, t, api) {
      var d = api.data, v = api.view, I = api.input;
      var PADX = 26;

      /* ---- player paddle (velocity feeds the curve) ---- */
      var prevY = d.p.y;
      var ay = I.axisY();
      if (I.pointer.down || I.pointer.moved) {
        d.p.y = U.damp(d.p.y, I.pointer.y, 14, dt);
      }
      d.p.y = U.clamp(d.p.y + ay * 430 * dt, d.p.h / 2, v.h - d.p.h / 2);
      d.p.vy = (d.p.y - prevY) / Math.max(dt, 0.0001);

      /* ---- AI paddle (imperfect tracking = beatable) ---- */
      var react = 0.62 + Math.min(0.28, d.rally * 0.012);
      var targetY = d.ball.vx > 0 ? d.ball.y + d.ball.curve * 40 : v.h / 2;
      d.ai.y = U.damp(d.ai.y, targetY, react * 7, dt);
      d.ai.y = U.clamp(d.ai.y, d.ai.h / 2, v.h - d.ai.h / 2);

      /* ---- ball with Magnus curve ---- */
      var b = d.ball;
      b.vy += b.curve * 210 * dt;         // spin bends the trajectory
      b.curve *= Math.pow(0.55, dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      api.fx.trail(b.x, b.y, api.colors[1], 7, 0.3);

      if (b.y < 8) { b.y = 8; b.vy = Math.abs(b.vy); wallHit(api, "top"); }
      if (b.y > v.h - 8) { b.y = v.h - 8; b.vy = -Math.abs(b.vy); wallHit(api, "bottom"); }

      /* paddle collisions */
      if (b.vx < 0 && b.x - 7 < PADX + 7 && b.x > PADX - 14 && Math.abs(b.y - d.p.y) < d.p.h / 2 + 8) {
        paddleBounce(api, b, d.p, 1, d.p.vy);
      }
      if (b.vx > 0 && b.x + 7 > v.w - PADX - 7 && b.x < v.w - PADX + 14 && Math.abs(b.y - d.ai.y) < d.ai.h / 2 + 8) {
        paddleBounce(api, b, d.ai, -1, 0);
      }

      /* scoring */
      if (b.x < -20) { pongPoint(api, false); return; }
      if (b.x > v.w + 20) { pongPoint(api, true); return; }

      /* ---- powerups ---- */
      d.powerT = (d.powerT || 5) - dt;
      if (d.powerT <= 0) {
        d.powerT = U.rand(6, 11);
        d.powers.push({
          x: v.w / 2 + U.rand(-70, 70), y: U.rand(50, v.h - 50),
          kind: U.pick(["grow", "shrink", "fast"]), age: 0,
        });
      }
      for (var p = d.powers.length - 1; p >= 0; p--) {
        var pw = d.powers[p];
        pw.age += dt;
        if (pw.age > 9) { d.powers.splice(p, 1); continue; }
        if (U.circleHit(b.x, b.y, 7, pw.x, pw.y, 14)) {
          if (pw.kind === "grow") { d.p.h = Math.min(160, d.p.h + 26); api.fx.popup(PADX, d.p.y - 40, "PADDLE +", api.colors[1], 14); }
          else if (pw.kind === "shrink") { d.ai.h = Math.max(48, d.ai.h - 22); api.fx.popup(v.w - PADX, d.ai.y - 40, "ENEMY -", api.colors[0], 14); }
          else { b.vx *= 1.18; b.vy *= 1.18; api.fx.popup(b.x, b.y - 22, "OVERDRIVE", api.colors[2], 14); }
          api.addScore(75);
          api.fx.burst(pw.x, pw.y, { count: 18, colors: api.colors, speed: 220 });
          if (api.audio) api.audio.arpUp();
          d.powers.splice(p, 1);
        }
      }
      d.walls.top = Math.max(0, d.walls.top - dt * 2.2);
      d.walls.bottom = Math.max(0, d.walls.bottom - dt * 2.2);
    },

    draw: function (ctx, t, api) {
      var d = api.data, v = api.view, c = api.colors, PADX = 26;

      /* centre net */
      ctx.save();
      ctx.globalAlpha = 0.28;
      for (var y = 10; y < v.h; y += 26) Draw.line(ctx, v.w / 2, y, v.w / 2, y + 13, c[3], 2, 6);
      ctx.restore();

      /* reactive particle walls */
      if (d.walls.top > 0) { ctx.globalAlpha = d.walls.top; Draw.line(ctx, 0, 3, v.w, 3, c[2], 3, 16); ctx.globalAlpha = 1; }
      if (d.walls.bottom > 0) { ctx.globalAlpha = d.walls.bottom; Draw.line(ctx, 0, v.h - 3, v.w, v.h - 3, c[2], 3, 16); ctx.globalAlpha = 1; }

      /* powerups */
      for (var p = 0; p < d.powers.length; p++) {
        var pw = d.powers[p];
        var col = pw.kind === "grow" ? c[1] : pw.kind === "shrink" ? c[0] : c[2];
        Draw.poly(ctx, [[0, -13], [13, 0], [0, 13], [-13, 0]], pw.x, pw.y, t * 1.4, col, false, 2);
        Draw.text(ctx, pw.kind === "grow" ? "+" : pw.kind === "shrink" ? "-" : "»", pw.x, pw.y, 12, col, "center", 900);
      }

      /* paddles */
      Draw.rect(ctx, PADX - 6, d.p.y - d.p.h / 2, 12, d.p.h, c[1], true, 6);
      Draw.rect(ctx, v.w - PADX - 6, d.ai.y - d.ai.h / 2, 12, d.ai.h, c[0], true, 6);

      /* ball + spin ring */
      var b = d.ball;
      Draw.circle(ctx, b.x, b.y, 7, "#ffffff", true);
      if (Math.abs(b.curve) > 0.2) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 13, t * 9 * Math.sign(b.curve), t * 9 * Math.sign(b.curve) + 2.2);
        Draw.neonStroke(ctx, c[2], 2, 10);
      }

      Draw.text(ctx, String(d.pts), v.w / 2 - 40, 34, 28, c[1], "center", 800);
      Draw.text(ctx, String(d.aiPts), v.w / 2 + 40, 34, 28, c[0], "center", 800);
      Draw.hud(ctx, "RALLY " + d.rally, v.w / 2, v.h - 16, c[2], "center", 11);
    },
  });

  function pongServe(api, dir) {
    var d = api.data, v = api.view;
    d.ball = { x: v.w / 2, y: v.h / 2, vx: 330 * dir, vy: U.rand(-140, 140), curve: 0 };
    d.rally = 0;
  }
  function paddleBounce(api, b, pad, dir, padVy) {
    var d = api.data;
    var rel = (b.y - pad.y) / (pad.h / 2);
    var speed = Math.min(780, Math.hypot(b.vx, b.vy) * 1.06 + 16);
    var ang = rel * 0.9;
    b.vx = Math.cos(ang) * speed * dir;
    b.vy = Math.sin(ang) * speed;
    b.curve = U.clamp(padVy / 900, -1.6, 1.6) + rel * 0.35;
    b.x += dir * 10;
    d.rally++;
    api.hit(20 + d.rally * 5, b.x, b.y);
    api.fx.spark(b.x, b.y, dir > 0 ? 0 : Math.PI, { count: 10, color: api.colors[1] });
    api.fx.shake(2.5);
    api.sfx(420 + d.rally * 18, 0.05, "square", 0.06);
    if (d.rally % 5 === 0) api.xp(1);
  }
  function wallHit(api, side) {
    var d = api.data;
    d.walls[side] = 1;
    api.fx.spark(d.ball.x, side === "top" ? 6 : api.view.h - 6, side === "top" ? Math.PI / 2 : -Math.PI / 2,
      { count: 8, color: api.colors[2] });
    api.sfx(300, 0.04, "sine", 0.04);
  }
  function pongPoint(api, playerScored) {
    var d = api.data, v = api.view;
    if (playerScored) {
      d.pts++;
      api.addScore(500, v.w / 2, v.h / 2, "POINT +500");
      api.xp(3);
      api.fx.flash(api.colors[1], 0.4);
      if (api.audio) api.audio.arpUp();
    } else {
      d.aiPts++;
      api.breakCombo();
      api.fx.flash("#ff2b5e", 0.5);
      api.fx.shake(12);
      if (api.audio) api.audio.explosion();
    }
    d.p.h = 90; d.ai.h = 90;
    if (d.pts >= 7) { api.win(2000); return; }
    if (d.aiPts >= 7) { api.gameOver(); return; }
    pongServe(api, playerScored ? 1 : -1);
  }

  /* ==================================================================
     10 — GRID PAC-RUNNER
     ================================================================== */
  var MAZE = [
    "###################",
    "#........#........#",
    "#.##.###.#.###.##.#",
    "#.................#",
    "#.##.#.#####.#.##.#",
    "#....#...#...#....#",
    "####.###.#.###.####",
    "#........#........#",
    "#.##.###.#.###.##.#",
    "#..#...........#..#",
    "##.#.#.#####.#.#.##",
    "#....#...#...#....#",
    "###################",
  ];

  FX.register({
    key: "grid-pac-runner",
    title: "Grid Pac-Runner",
    hint: "ARROWS / WASD navigate the grid · harvest every data node · grab a SURGE core to hunt the sentinels",
    pad: true,

    setup: function (api) {
      var d = api.data;
      d.rows = MAZE.length;
      d.cols = MAZE[0].length;
      pacLayout(api);
      d.lives = 3;
      d.level = 1;
      pacReset(api, true);
    },
    resize: function (api) { pacLayout(api); },

    update: function (dt, t, api) {
      var d = api.data, I = api.input;

      if (I.held("left")) d.want = { x: -1, y: 0 };
      else if (I.held("right")) d.want = { x: 1, y: 0 };
      else if (I.held("up")) d.want = { x: 0, y: -1 };
      else if (I.held("down")) d.want = { x: 0, y: 1 };

      moveActor(api, d.p, d.p.speed * dt, true);
      api.fx.trail(pacX(d, d.p.x), pacY(d, d.p.y), d.surge > 0 ? api.colors[2] : api.colors[1], d.cell * 0.3, 0.25);

      /* dot pickup */
      var cx = Math.round(d.p.x), cy = Math.round(d.p.y);
      if (d.dots[cy] && d.dots[cy][cx] === 1) {
        d.dots[cy][cx] = 0; d.left--;
        api.hit(15, pacX(d, cx), pacY(d, cy));
        api.sfx(700 + (d.left % 8) * 40, 0.03, "square", 0.04);
        if (d.left % 12 === 0) api.xp(1);
      } else if (d.dots[cy] && d.dots[cy][cx] === 2) {
        d.dots[cy][cx] = 0; d.left--;
        d.surge = 7;
        api.hit(120, pacX(d, cx), pacY(d, cy));
        api.xp(2);
        api.fx.burst(pacX(d, cx), pacY(d, cy), { count: 26, colors: api.colors, speed: 240 });
        api.fx.popup(pacX(d, cx), pacY(d, cy) - 20, "SURGE", api.colors[2], 16);
        api.fx.flash(api.colors[2], 0.3);
        if (api.audio) api.audio.arpUp();
      }
      if (d.surge > 0) d.surge -= dt;

      /* sentinels */
      for (var i = 0; i < d.ghosts.length; i++) {
        var g = d.ghosts[i];
        if (g.dead > 0) { g.dead -= dt; continue; }
        ghostThink(d, g);
        moveActor(api, g, (d.surge > 0 ? g.speed * 0.62 : g.speed) * dt, false);
        if (U.dist(g.x, g.y, d.p.x, d.p.y) < 0.62) {
          if (d.surge > 0) {
            g.dead = 4;
            g.x = d.home.x; g.y = d.home.y;
            api.hit(400, pacX(d, g.x), pacY(d, g.y));
            api.xp(3);
            api.fx.burst(pacX(d, d.p.x), pacY(d, d.p.y), { count: 30, color: api.colors[i % 4], speed: 260 });
            api.fx.shake(7);
            if (api.audio) api.audio.explosion();
          } else {
            pacDie(api);
            return;
          }
        }
      }

      if (d.left <= 0) {
        d.level++;
        api.addScore(1200, api.view.w / 2, api.view.h / 2, "GRID CLEARED");
        api.xp(8);
        api.fx.flash(api.colors[1], 0.5);
        pacReset(api, false);
      }
    },

    draw: function (ctx, t, api) {
      var d = api.data, c = api.colors, cell = d.cell;

      for (var y = 0; y < d.rows; y++) {
        for (var x = 0; x < d.cols; x++) {
          if (MAZE[y][x] === "#") {
            var px = d.ox + x * cell, py = d.oy + y * cell;
            ctx.globalAlpha = 0.85;
            Draw.rect(ctx, px + 1, py + 1, cell - 2, cell - 2, c[3], false, 3);
            ctx.globalAlpha = 1;
          } else if (d.dots[y][x] === 1) {
            Draw.circle(ctx, pacX(d, x), pacY(d, y), Math.max(1.5, cell * 0.09), c[1], true);
          } else if (d.dots[y][x] === 2) {
            Draw.circle(ctx, pacX(d, x), pacY(d, y), cell * (0.2 + Math.sin(t * 6) * 0.04), c[2], true);
          }
        }
      }

      /* sentinels */
      for (var i = 0; i < d.ghosts.length; i++) {
        var g = d.ghosts[i];
        var gx = pacX(d, g.x), gy = pacY(d, g.y);
        var col = g.dead > 0 ? "#4a4560" : (d.surge > 0 ? c[3] : c[i % 4]);
        Draw.poly(ctx, [[-cell * 0.34, cell * 0.3], [-cell * 0.34, -cell * 0.1], [0, -cell * 0.38],
          [cell * 0.34, -cell * 0.1], [cell * 0.34, cell * 0.3], [cell * 0.14, cell * 0.14],
          [0, cell * 0.3], [-cell * 0.14, cell * 0.14]], gx, gy, 0, col, g.dead <= 0, 2);
        if (g.dead <= 0) {
          ctx.fillStyle = "#08030f";
          ctx.beginPath();
          ctx.arc(gx - cell * 0.12, gy - cell * 0.08, cell * 0.07, 0, 6.3);
          ctx.arc(gx + cell * 0.12, gy - cell * 0.08, cell * 0.07, 0, 6.3);
          ctx.fill();
        }
      }

      /* runner */
      var px2 = pacX(d, d.p.x), py2 = pacY(d, d.p.y);
      var mouth = Math.abs(Math.sin(t * 11)) * 0.7;
      var face = Math.atan2(d.p.dir.y, d.p.dir.x);
      ctx.save();
      ctx.translate(px2, py2); ctx.rotate(face);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, cell * 0.38, mouth, Math.PI * 2 - mouth);
      ctx.closePath();
      Draw.neonFill(ctx, d.surge > 0 ? api.colors[2] : api.colors[1], 14);
      ctx.restore();

      for (var l = 0; l < d.lives; l++) Draw.circle(ctx, 16 + l * 16, api.view.h - 12, 5, c[1], true);
      Draw.hud(ctx, "NODES " + d.left + (d.surge > 0 ? "  ·  SURGE " + d.surge.toFixed(1) : ""),
        api.view.w - 10, api.view.h - 12, c[2], "right", 11);
    },
  });

  function pacLayout(api) {
    var d = api.data, v = api.view;
    d.cell = Math.max(12, Math.floor(Math.min((v.w - 20) / d.cols, (v.h - 34) / d.rows)));
    d.ox = Math.floor((v.w - d.cols * d.cell) / 2);
    d.oy = Math.floor((v.h - d.rows * d.cell) / 2);
  }
  function pacX(d, gx) { return d.ox + gx * d.cell + d.cell / 2; }
  function pacY(d, gy) { return d.oy + gy * d.cell + d.cell / 2; }
  function walkable(x, y) {
    if (y < 0 || y >= MAZE.length) return false;
    if (x < 0 || x >= MAZE[0].length) return false;
    return MAZE[y][x] !== "#";
  }

  function pacReset(api, full) {
    var d = api.data;
    if (full || !d.dots) {
      d.dots = [];
      d.left = 0;
      for (var y = 0; y < d.rows; y++) {
        var row = [];
        for (var x = 0; x < d.cols; x++) {
          if (MAZE[y][x] === "#") { row.push(0); continue; }
          var power = (x === 1 || x === d.cols - 2) && (y === 1 || y === d.rows - 2);
          row.push(power ? 2 : 1);
          d.left++;
        }
        d.dots.push(row);
      }
    } else {
      d.left = 0;
      for (var y2 = 0; y2 < d.rows; y2++) {
        for (var x2 = 0; x2 < d.cols; x2++) {
          if (MAZE[y2][x2] === "#") continue;
          var pw = (x2 === 1 || x2 === d.cols - 2) && (y2 === 1 || y2 === d.rows - 2);
          d.dots[y2][x2] = pw ? 2 : 1;
          d.left++;
        }
      }
    }
    d.home = { x: 9, y: 7 };
    d.p = { x: 9, y: 11, dir: { x: 0, y: 0 }, speed: 5.4 + (d.level || 1) * 0.25 };
    d.want = { x: 0, y: 0 };
    d.surge = 0;
    d.ghosts = [];
    var spawns = [[9, 5], [8, 7], [10, 7], [9, 3]];
    for (var g = 0; g < Math.min(4, 2 + (d.level || 1)); g++) {
      d.ghosts.push({
        x: spawns[g][0], y: spawns[g][1], dir: { x: 0, y: -1 },
        speed: 4.1 + (d.level || 1) * 0.28, dead: 0,
      });
    }
  }

  /** Grid-locked movement with turn buffering. */
  function moveActor(api, a, dist, isPlayer) {
    var d = api.data;
    var atCenterX = Math.abs(a.x - Math.round(a.x)) < 0.08;
    var atCenterY = Math.abs(a.y - Math.round(a.y)) < 0.08;

    if (atCenterX && atCenterY) {
      a.x = Math.round(a.x); a.y = Math.round(a.y);
      if (isPlayer) {
        var w = d.want;
        if ((w.x || w.y) && walkable(a.x + w.x, a.y + w.y)) a.dir = { x: w.x, y: w.y };
        if (!walkable(a.x + a.dir.x, a.y + a.dir.y)) a.dir = { x: 0, y: 0 };
      } else if (!walkable(a.x + a.dir.x, a.y + a.dir.y)) {
        a.dir = { x: 0, y: 0 };
      }
    }
    a.x += a.dir.x * dist;
    a.y += a.dir.y * dist;
    /* tunnel wrap */
    if (a.x < 0) a.x = d.cols - 1;
    if (a.x > d.cols - 1) a.x = 0;
  }

  function ghostThink(d, g) {
    var atX = Math.abs(g.x - Math.round(g.x)) < 0.08;
    var atY = Math.abs(g.y - Math.round(g.y)) < 0.08;
    if (!atX || !atY) return;
    var gx = Math.round(g.x), gy = Math.round(g.y);
    var opts = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].filter(function (o) {
      if (o.x === -g.dir.x && o.y === -g.dir.y) return false;   // no U-turns
      return walkable(gx + o.x, gy + o.y);
    });
    if (!opts.length) { g.dir = { x: -g.dir.x, y: -g.dir.y }; return; }
    var flee = d.surge > 0;
    var best = opts[0], bestScore = Infinity;
    for (var i = 0; i < opts.length; i++) {
      var nx = gx + opts[i].x, ny = gy + opts[i].y;
      var dist = U.dist(nx, ny, d.p.x, d.p.y);
      var score = flee ? -dist : dist;
      score += Math.random() * 1.6;   // imperfect pursuit
      if (score < bestScore) { bestScore = score; best = opts[i]; }
    }
    g.dir = best;
  }

  function pacDie(api) {
    var d = api.data;
    d.lives--;
    api.breakCombo();
    api.fx.burst(pacX(d, d.p.x), pacY(d, d.p.y), { count: 44, colors: ["#ff2b5e", api.colors[1]], speed: 300 });
    api.fx.shake(16);
    api.fx.flash("#ff2b5e", 0.6);
    if (api.audio) api.audio.explosion();
    if (d.lives <= 0) { api.gameOver(); return; }
    d.p.x = 9; d.p.y = 11; d.p.dir = { x: 0, y: 0 };
    d.want = { x: 0, y: 0 };
    d.surge = 0;
    for (var i = 0; i < d.ghosts.length; i++) {
      d.ghosts[i].x = d.home.x + (i - 1) * 0.001 + (i % 2 ? 1 : -1);
      d.ghosts[i].y = d.home.y;
      d.ghosts[i].dir = { x: 0, y: -1 };
    }
  }

  /* ==================================================================
     11 — CYBER SOAR
     ================================================================== */
  FX.register({
    key: "cyber-soar",
    title: "Cyber Soar",
    hint: "HOLD SPACE / ↑ / ◆ or CLICK to fire the thruster · thread every energy pillar gap",
    pad: true,

    setup: function (api) {
      var d = api.data, v = api.view;
      d.bird = { x: v.w * 0.28, y: v.h / 2, vy: 0 };
      d.pillars = [];
      d.spawnX = v.w + 60;
      d.speed = 190;
      d.passed = 0;
      d.fuel = 1;
      for (var i = 0; i < 3; i++) soarSpawn(api, v.w + 120 + i * 230);
    },
    resize: function (api) { api.data.bird.x = api.view.w * 0.28; },

    update: function (dt, t, api) {
      var d = api.data, v = api.view, I = api.input;
      var thrust = I.held("action") || I.held("up") || I.held("dash") || I.pointer.down;

      // Thrust MUST out-pull gravity or the craft can never climb:
      // holding  → net −1150 px/s²  ·  released → net +1450 px/s²
      if (thrust && d.fuel > 0) {
        d.bird.vy -= 2600 * dt;
        d.fuel = Math.max(0, d.fuel - dt * 0.2);
        api.fx.trail(d.bird.x - 14, d.bird.y + 6, api.colors[2], 6, 0.3);
        if (Math.random() < 0.4) api.fx.spark(d.bird.x - 16, d.bird.y + 4, Math.PI, { count: 2, color: api.colors[2], speed: 120 });
      } else {
        d.fuel = Math.min(1, d.fuel + dt * 0.42);
      }
      d.bird.vy += 1450 * dt;                       // gravity
      d.bird.vy = U.clamp(d.bird.vy, -460, 620);
      d.bird.y += d.bird.vy * dt;

      if (d.bird.y < 10 || d.bird.y > v.h - 10) return soarCrash(api);

      d.speed = 190 + d.passed * 5;
      for (var i = d.pillars.length - 1; i >= 0; i--) {
        var p = d.pillars[i];
        p.x -= d.speed * dt;
        if (p.x < -70) { d.pillars.splice(i, 1); continue; }
        if (!p.scored && p.x + 26 < d.bird.x) {
          p.scored = true;
          d.passed++;
          api.hit(100, d.bird.x, d.bird.y - 30);
          api.xp(2);
          api.sfx(880 + d.passed * 15, 0.07, "triangle", 0.07);
          if (d.passed % 5 === 0) {
            api.fx.popup(v.w / 2, v.h * 0.25, "GATE x" + d.passed, api.colors[2], 18);
            api.fx.flash(api.colors[1], 0.2);
          }
        }
        var inX = d.bird.x + 13 > p.x && d.bird.x - 13 < p.x + 52;
        if (inX && (d.bird.y - 12 < p.gapY - p.gap / 2 || d.bird.y + 12 > p.gapY + p.gap / 2)) {
          return soarCrash(api);
        }
      }
      if (!d.pillars.length || d.pillars[d.pillars.length - 1].x < v.w - 210) soarSpawn(api, v.w + 40);
    },

    draw: function (ctx, t, api) {
      var d = api.data, v = api.view, c = api.colors;
      Draw.grid(ctx, v.w, v.h, 52, c[3], -t * 60, 0.05);

      for (var i = 0; i < d.pillars.length; i++) {
        var p = d.pillars[i];
        var topH = p.gapY - p.gap / 2;
        Draw.rect(ctx, p.x, 0, 52, topH, c[0], false, 4);
        Draw.rect(ctx, p.x, p.gapY + p.gap / 2, 52, v.h - (p.gapY + p.gap / 2), c[0], false, 4);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.25 + Math.sin(t * 4 + i) * 0.1;
        ctx.fillStyle = c[0];
        ctx.fillRect(p.x + 4, 0, 44, topH);
        ctx.fillRect(p.x + 4, p.gapY + p.gap / 2, 44, v.h);
        ctx.restore();
        Draw.line(ctx, p.x + 26, topH, p.x + 26, p.gapY + p.gap / 2, c[1], 1, 8);
      }

      /* craft */
      var tilt = U.clamp(d.bird.vy / 700, -0.5, 0.7);
      Draw.poly(ctx, [[16, 0], [-12, -10], [-6, 0], [-12, 10]], d.bird.x, d.bird.y, tilt, c[1], false, 2.2);
      if (api.input.held("action") || api.input.held("up") || api.input.pointer.down) {
        Draw.poly(ctx, [[-8, -5], [-20 - Math.random() * 9, 0], [-8, 5]], d.bird.x, d.bird.y, tilt, c[2], true);
      }

      var fw = 90;
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(12, 14, fw, 6);
      ctx.fillStyle = d.fuel > 0.25 ? c[2] : "#ff2b5e";
      ctx.fillRect(12, 14, fw * d.fuel, 6);
      Draw.hud(ctx, "THRUST", 12, 30, c[2], "left", 10);
      Draw.hud(ctx, "GATES " + d.passed, v.w - 10, 20, c[1], "right", 12);
    },
  });

  function soarSpawn(api, x) {
    var d = api.data, v = api.view;
    var gap = Math.max(112, 175 - d.passed * 2.2);
    d.pillars.push({ x: x, gapY: U.rand(gap / 2 + 34, v.h - gap / 2 - 34), gap: gap, scored: false });
  }
  function soarCrash(api) {
    var d = api.data;
    api.fx.burst(d.bird.x, d.bird.y, { count: 48, colors: ["#ff2b5e", api.colors[2]], speed: 330 });
    api.gameOver();
  }

  /* ==================================================================
     12 — RETRO DEFENDER  (missile command)
     ================================================================== */
  FX.register({
    key: "retro-defender",
    title: "Retro Defender",
    hint: "CLICK / TAP to detonate an interceptor there (ARROWS + ◆ with keyboard) · chain blasts · protect the cities",
    pad: true,

    setup: function (api) {
      var d = api.data, v = api.view;
      d.cities = [];
      for (var i = 0; i < 6; i++) {
        d.cities.push({ x: (v.w / 7) * (i + 1), y: v.h - 26, alive: true });
      }
      d.warheads = [];
      d.blasts = [];
      d.ammo = 12;
      d.reload = 0;
      d.wave = 1;
      d.waveLeft = 8;
      d.spawnT = 1.2;
      d.aim = { x: v.w / 2, y: v.h / 2 };
    },
    resize: function (api) {
      var d = api.data, v = api.view;
      for (var i = 0; i < d.cities.length; i++) { d.cities[i].x = (v.w / 7) * (i + 1); d.cities[i].y = v.h - 26; }
    },

    update: function (dt, t, api) {
      var d = api.data, v = api.view, I = api.input;

      /* ammo regen */
      d.reload -= dt;
      if (d.ammo < 12 && d.reload <= 0) { d.ammo++; d.reload = 0.55; }

      /* keyboard aiming */
      var ax = I.axisX(), ay = I.axisY();
      if (ax || ay) {
        d.aim.x = U.clamp(d.aim.x + ax * 420 * dt, 0, v.w);
        d.aim.y = U.clamp(d.aim.y + ay * 420 * dt, 0, v.h - 50);
      }
      if (I.pressed("action") || I.pressed("dash")) fire(api, d.aim.x, d.aim.y);
      var taps = I.takeTaps();
      for (var k = 0; k < taps.length; k++) fire(api, taps[k].x, taps[k].y);

      /* spawn warheads */
      d.spawnT -= dt;
      if (d.spawnT <= 0 && d.waveLeft > 0) {
        d.waveLeft--;
        d.spawnT = Math.max(0.42, 1.5 - d.wave * 0.08);
        var target = U.pick(d.cities.filter(function (c) { return c.alive; }) || d.cities);
        if (target) {
          var sx = U.rand(20, v.w - 20);
          var speed = 44 + d.wave * 7;
          var ang = Math.atan2(target.y - 0, target.x - sx);
          d.warheads.push({
            x: sx, y: -10, ox: sx, oy: -10,
            vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, split: d.wave > 2 && Math.random() < 0.25,
          });
        }
      }
      if (d.waveLeft <= 0 && d.warheads.length === 0) {
        d.wave++;
        d.waveLeft = 7 + d.wave * 2;
        d.ammo = 12;
        var alive = d.cities.filter(function (c) { return c.alive; }).length;
        api.addScore(300 + alive * 150, v.w / 2, v.h / 2, "WAVE " + d.wave);
        api.xp(5);
        api.fx.flash(api.colors[1], 0.35);
      }

      /* warheads */
      for (var w = d.warheads.length - 1; w >= 0; w--) {
        var wh = d.warheads[w];
        wh.x += wh.vx * dt; wh.y += wh.vy * dt;
        api.fx.trail(wh.x, wh.y, api.colors[0], 2.6, 0.5);

        if (wh.split && wh.y > v.h * 0.4) {
          wh.split = false;
          for (var s = -1; s <= 1; s += 2) {
            d.warheads.push({
              x: wh.x, y: wh.y, ox: wh.x, oy: wh.y,
              vx: wh.vx + s * 26, vy: wh.vy, split: false,
            });
          }
          api.fx.spark(wh.x, wh.y, Math.PI / 2, { count: 6, color: api.colors[0] });
        }

        var killed = false;
        for (var b = 0; b < d.blasts.length; b++) {
          var bl = d.blasts[b];
          if (U.dist(wh.x, wh.y, bl.x, bl.y) < bl.r) {
            d.warheads.splice(w, 1);
            api.hit(100, wh.x, wh.y);
            api.xp(1);
            spawnBlast(api, wh.x, wh.y, true);
            killed = true;
            break;
          }
        }
        if (killed) continue;

        if (wh.y > v.h - 34) {
          d.warheads.splice(w, 1);
          spawnBlast(api, wh.x, wh.y, false);
          for (var c = 0; c < d.cities.length; c++) {
            var city = d.cities[c];
            if (city.alive && Math.abs(city.x - wh.x) < 34) {
              city.alive = false;
              api.breakCombo();
              api.fx.burst(city.x, city.y, { count: 44, colors: ["#ff2b5e", api.colors[2]], speed: 300 });
              api.fx.shake(16);
              api.fx.flash("#ff2b5e", 0.6);
              if (api.audio) api.audio.explosion();
            }
          }
          if (!d.cities.some(function (x) { return x.alive; })) { api.gameOver(); return; }
        }
      }

      /* blasts */
      for (var i = d.blasts.length - 1; i >= 0; i--) {
        var blast = d.blasts[i];
        blast.age += dt;
        var k2 = blast.age / blast.life;
        blast.r = Math.sin(Math.min(1, k2) * Math.PI) * blast.max;
        if (blast.age >= blast.life) d.blasts.splice(i, 1);
      }
    },

    draw: function (ctx, t, api) {
      var d = api.data, v = api.view, c = api.colors;

      /* ground line */
      Draw.line(ctx, 0, v.h - 18, v.w, v.h - 18, c[3], 2, 10);

      for (var i = 0; i < d.cities.length; i++) {
        var city = d.cities[i];
        if (city.alive) {
          Draw.poly(ctx, [[-16, 10], [-12, -6], [-4, -6], [-4, -14], [4, -14], [4, -6], [12, -6], [16, 10]],
            city.x, city.y, 0, c[1], false, 2);
        } else {
          ctx.globalAlpha = 0.34;
          Draw.poly(ctx, [[-16, 10], [-8, 2], [0, 8], [10, 0], [16, 10]], city.x, city.y, 0, "#5d5570", true);
          ctx.globalAlpha = 1;
        }
      }

      for (var w = 0; w < d.warheads.length; w++) {
        var wh = d.warheads[w];
        Draw.line(ctx, wh.ox, wh.oy, wh.x, wh.y, c[0], 1.2, 6);
        Draw.circle(ctx, wh.x, wh.y, 4, c[0], true);
      }

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var b = 0; b < d.blasts.length; b++) {
        var bl = d.blasts[b];
        var a = 1 - bl.age / bl.life;
        ctx.globalAlpha = a * 0.8;
        ctx.fillStyle = bl.friendly ? c[1] : "#ff2b5e";
        ctx.beginPath();
        ctx.arc(bl.x, bl.y, Math.max(0, bl.r), 0, 6.3);
        ctx.fill();
      }
      ctx.restore();

      /* reticle */
      ctx.globalAlpha = 0.75;
      Draw.line(ctx, d.aim.x - 12, d.aim.y, d.aim.x + 12, d.aim.y, c[2], 1.6, 8);
      Draw.line(ctx, d.aim.x, d.aim.y - 12, d.aim.x, d.aim.y + 12, c[2], 1.6, 8);
      Draw.circle(ctx, d.aim.x, d.aim.y, 15, c[2], false, 1.2);
      ctx.globalAlpha = 1;

      /* ammo */
      for (var a2 = 0; a2 < d.ammo; a2++) {
        Draw.rect(ctx, 12 + a2 * 9, v.h - 14, 5, 10, c[2], true, 2);
      }
      Draw.hud(ctx, "WAVE " + d.wave + " · INBOUND " + (d.waveLeft + d.warheads.length), v.w - 10, 20, c[0], "right", 11);
    },
  });

  function fire(api, x, y) {
    var d = api.data;
    if (d.ammo <= 0) {
      api.fx.popup(x, y, "NO AMMO", "#ff2b5e", 13);
      api.sfx(140, 0.08, "square", 0.05);
      return;
    }
    d.ammo--;
    spawnBlast(api, x, y, true);
    api.sfx(760, 0.07, "triangle", 0.06);
  }
  function spawnBlast(api, x, y, friendly) {
    var d = api.data;
    d.blasts.push({ x: x, y: y, r: 0, max: friendly ? 46 : 34, age: 0, life: 0.65, friendly: friendly });
    api.fx.burst(x, y, {
      count: friendly ? 20 : 26,
      colors: friendly ? [api.colors[1], api.colors[2]] : ["#ff2b5e", api.colors[0]],
      speed: 220,
    });
    api.fx.shake(friendly ? 3 : 9);
  }
})();
