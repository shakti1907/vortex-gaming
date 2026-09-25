/* ==========================================================================
   VORTEX GAMING — neon-snake.js   (ACTION 01)
   Upgraded Neon Snake.

   MECHANICS
     · Strict 16px grid-vector body  ([{x,y}]) — never drifts or rotates crooked
     · DASH boost (Shift / ◆) burns an energy cell, doubles tick rate and
       lays a short-lived glowing PLASMA BARRIER behind you (risk/reward)
     · Dynamic hazard nodes spawn as the run escalates
     · Multi-stage food: CORE (+10) · MEGA (+50, grow x3) · PHASE (ghost walls)
   ========================================================================== */
(function () {
  "use strict";

  var FX = window.VortexFX;
  var Draw = FX.Draw, U = FX.Util;

  var GRID = 16;                 // base matrix unit (px)
  var COLS = 28, ROWS = 18;
  var DIRS = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
  };

  FX.register({
    key: "neon-snake",
    title: "Neon Snake",
    hint: "ARROWS / WASD steer · SHIFT or ◆ = DASH (leaves a plasma barrier) · eat CORE / MEGA / PHASE",
    pad: true,

    /* ---------------------------- setup ---------------------------- */
    setup: function (api) {
      var d = api.data;
      layout(api);

      var cx = (COLS / 2) | 0, cy = (ROWS / 2) | 0;
      d.snake = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
      d.dir = DIRS.right;
      d.queue = [];
      d.grow = 0;
      d.stepMs = 130;
      d.acc = 0;
      d.eaten = 0;
      d.energy = 3;          // dash charges
      d.energyRegen = 0;
      d.dashing = 0;         // seconds of dash remaining
      d.barriers = [];       // {x,y,life}
      d.hazards = [];        // {x,y}
      d.phase = 0;           // ghost-mode seconds
      d.food = [];
      spawnFood(d, "core");
      d.hazardTimer = 9;
    },

    resize: function (api) { layout(api); },

    /* --------------------------- update ---------------------------- */
    update: function (dt, t, api) {
      var d = api.data;
      var I = api.input;

      /* ---- steering (reverse vectors rejected) ---- */
      ["up", "down", "left", "right"].forEach(function (name) {
        if (I.pressed(name)) queueDir(d, name);
      });

      /* ---- dash ---- */
      if ((I.pressed("dash") || I.pressed("action")) && d.energy >= 1 && d.dashing <= 0) {
        d.energy--;
        d.dashing = 1.5;
        api.fx.shake(4);
        api.sfx(1240, 0.1, "sawtooth", 0.07);
        api.fx.popup(cellX(d, d.snake[0].x), cellY(d, d.snake[0].y) - 14, "DASH", api.colors[1], 14);
      }
      if (d.dashing > 0) d.dashing -= dt;

      /* ---- energy regen ---- */
      if (d.energy < 3) {
        d.energyRegen += dt;
        if (d.energyRegen >= 6) { d.energyRegen = 0; d.energy++; api.sfx(660, 0.06, "triangle", 0.05); }
      }

      if (d.phase > 0) d.phase -= dt;

      /* ---- barrier decay ---- */
      for (var b = d.barriers.length - 1; b >= 0; b--) {
        d.barriers[b].life -= dt;
        if (d.barriers[b].life <= 0) d.barriers.splice(b, 1);
      }

      /* ---- escalating hazards ---- */
      d.hazardTimer -= dt;
      if (d.hazardTimer <= 0 && d.hazards.length < 14) {
        d.hazardTimer = Math.max(5, 11 - d.eaten * 0.25);
        var spot = freeCell(d);
        if (spot) {
          d.hazards.push({ x: spot.x, y: spot.y, born: 0 });
          api.fx.burst(cellX(d, spot.x), cellY(d, spot.y), { count: 12, color: "#ff2b5e", speed: 130 });
          api.sfx(200, 0.14, "sawtooth", 0.06);
        }
      }
      for (var h = 0; h < d.hazards.length; h++) d.hazards[h].born += dt;

      /* ---- food lifecycle (mega / phase expire) ---- */
      for (var f = d.food.length - 1; f >= 0; f--) {
        var fd = d.food[f];
        if (fd.life !== undefined) {
          fd.life -= dt;
          if (fd.life <= 0) d.food.splice(f, 1);
        }
      }
      if (!d.food.some(function (x) { return x.type === "core"; })) spawnFood(d, "core");

      /* ---- fixed-step simulation ---- */
      var step = d.dashing > 0 ? d.stepMs * 0.5 : d.stepMs;
      d.acc += dt * 1000;
      while (d.acc >= step) {
        d.acc -= step;
        tick(api, d);
        if (api.state.over) return;
      }

      /* ---- head trail ---- */
      var head = d.snake[0];
      api.fx.trail(cellX(d, head.x), cellY(d, head.y), d.dashing > 0 ? api.colors[1] : api.colors[0], d.cell * 0.42, 0.3);
    },

    /* ---------------------------- draw ----------------------------- */
    draw: function (ctx, t, api) {
      var d = api.data, c = api.colors;
      var cell = d.cell;

      /* board + matrix */
      ctx.save();
      ctx.translate(d.ox, d.oy);
      ctx.fillStyle = "rgba(255,255,255,0.015)";
      ctx.fillRect(0, 0, COLS * cell, ROWS * cell);
      ctx.globalAlpha = 0.5;
      Draw.grid(ctx, COLS * cell, ROWS * cell, cell, "#ffffff", 0, 0.06);
      ctx.globalAlpha = 1;
      ctx.restore();

      /* perimeter */
      ctx.beginPath();
      ctx.rect(d.ox + 1, d.oy + 1, COLS * cell - 2, ROWS * cell - 2);
      Draw.neonStroke(ctx, d.phase > 0 ? c[3] : c[0], 2, 16);

      /* hazards */
      for (var i = 0; i < d.hazards.length; i++) {
        var hz = d.hazards[i];
        var hx = cellX(d, hz.x), hy = cellY(d, hz.y);
        var pop = Math.min(1, hz.born * 3);
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(t * 1.2);
        ctx.beginPath();
        var s = cell * 0.34 * pop;
        ctx.moveTo(-s, -s); ctx.lineTo(s, s); ctx.moveTo(s, -s); ctx.lineTo(-s, s);
        Draw.neonStroke(ctx, "#ff2b5e", 2.6, 12);
        ctx.restore();
      }

      /* plasma barriers */
      for (var b = 0; b < d.barriers.length; b++) {
        var br = d.barriers[b];
        var k = Math.min(1, br.life / 0.6);
        ctx.save();
        ctx.globalAlpha = 0.35 + k * 0.5;
        Draw.rect(ctx, cellX(d, br.x) - cell * 0.36, cellY(d, br.y) - cell * 0.36, cell * 0.72, cell * 0.72, c[1], false, 3);
        ctx.restore();
      }

      /* food */
      for (var f = 0; f < d.food.length; f++) {
        var fd = d.food[f];
        var fx2 = cellX(d, fd.x), fy2 = cellY(d, fd.y);
        var pulse = 0.72 + Math.sin(t * 6 + f) * 0.28;
        var col = fd.type === "core" ? c[2] : fd.type === "mega" ? c[0] : c[3];
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        Draw.circle(ctx, fx2, fy2, cell * (fd.type === "mega" ? 0.36 : 0.28) * pulse, col, true);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(fx2, fy2, cell * 0.46, t * 2.4, t * 2.4 + Math.PI * 1.25);
        Draw.neonStroke(ctx, col, 1.6, 8);
        if (fd.type !== "core") {
          ctx.globalAlpha = 0.85;
          Draw.text(ctx, fd.type === "mega" ? "M" : "P", fx2, fy2, Math.max(9, cell * 0.36), "#0a0416", "center", 900);
          ctx.globalAlpha = 1;
        }
      }

      /* snake — vector-aligned segments + delta-vector bridges */
      var n = d.snake.length, gap = 2;
      for (var s2 = n - 1; s2 >= 0; s2--) {
        var seg = d.snake[s2];
        var mix = n > 1 ? s2 / (n - 1) : 0;
        var col2 = d.phase > 0 ? c[3] : (mix < 0.5 ? c[0] : c[1]);
        var px = cellX(d, seg.x), py = cellY(d, seg.y);
        ctx.globalAlpha = (1 - mix * 0.4) * (d.phase > 0 ? 0.75 : 1);

        if (s2 > 0) {
          var nx = d.snake[s2 - 1];
          var dx = nx.x - seg.x, dy = nx.y - seg.y;
          if (Math.abs(dx) + Math.abs(dy) === 1) {
            var bx2 = cellX(d, nx.x), by2 = cellY(d, nx.y);
            var bw = dx !== 0 ? Math.abs(bx2 - px) + cell - gap : cell - gap;
            var bh = dy !== 0 ? Math.abs(by2 - py) + cell - gap : cell - gap;
            ctx.fillStyle = col2;
            ctx.fillRect((px + bx2) / 2 - bw / 2, (py + by2) / 2 - bh / 2, bw, bh);
          }
        }
        if (s2 === 0) Draw.glow(ctx, col2, d.dashing > 0 ? 22 : 14);
        ctx.fillStyle = col2;
        roundRect(ctx, px - (cell - gap) / 2, py - (cell - gap) / 2, cell - gap, cell - gap, cell * 0.2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (s2 === 0) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#0a0416";
          var ex = d.dir.x, ey = d.dir.y, ppx = -ey, ppy = ex;
          ctx.beginPath();
          ctx.arc(px + ex * cell * 0.16 + ppx * cell * 0.14, py + ey * cell * 0.16 + ppy * cell * 0.14, cell * 0.07, 0, 6.3);
          ctx.arc(px + ex * cell * 0.16 - ppx * cell * 0.14, py + ey * cell * 0.16 - ppy * cell * 0.14, cell * 0.07, 0, 6.3);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      /* HUD: energy cells */
      for (var e = 0; e < 3; e++) {
        var ex2 = d.ox + 4 + e * 16;
        ctx.globalAlpha = e < d.energy ? 1 : 0.22;
        Draw.rect(ctx, ex2, d.oy - 16, 12, 7, c[1], e < d.energy, 2);
        ctx.globalAlpha = 1;
      }
      Draw.hud(ctx, "DASH", d.ox + 56, d.oy - 12, c[1], "left", 10);
      Draw.hud(ctx, "LEN " + d.snake.length + (d.phase > 0 ? "  ·  PHASE" : ""),
        d.ox + COLS * cell - 4, d.oy - 12, c[2], "right", 11);
    },
  });

  /* ------------------------------------------------------------------ */
  /* helpers                                                            */
  /* ------------------------------------------------------------------ */
  function layout(api) {
    var d = api.data, v = api.view;
    var scale = Math.max(1, Math.floor(Math.min(v.w / (COLS * GRID), (v.h - 26) / (ROWS * GRID))));
    d.cell = GRID * scale;
    d.ox = Math.floor((v.w - COLS * d.cell) / 2);
    d.oy = Math.floor((v.h - ROWS * d.cell) / 2) + 10;
  }
  function cellX(d, gx) { return d.ox + gx * d.cell + d.cell / 2; }
  function cellY(d, gy) { return d.oy + gy * d.cell + d.cell / 2; }

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function queueDir(d, name) {
    var next = DIRS[name];
    if (!next) return;
    var ref = d.queue.length ? d.queue[d.queue.length - 1] : d.dir;
    if (next.x === -ref.x && next.y === -ref.y) return;   // no reversal
    if (next.x === ref.x && next.y === ref.y) return;     // no duplicates
    if (d.queue.length < 3) d.queue.push(next);
  }

  function occupied(d) {
    var set = {};
    for (var i = 0; i < d.snake.length; i++) set[d.snake[i].x + ":" + d.snake[i].y] = 1;
    for (var h = 0; h < d.hazards.length; h++) set[d.hazards[h].x + ":" + d.hazards[h].y] = 1;
    for (var f = 0; f < d.food.length; f++) set[d.food[f].x + ":" + d.food[f].y] = 1;
    return set;
  }

  function freeCell(d) {
    var set = occupied(d);
    var head = d.snake[0];
    var open = [];
    for (var x = 0; x < COLS; x++) {
      for (var y = 0; y < ROWS; y++) {
        if (set[x + ":" + y]) continue;
        // never spawn a hazard directly in front of the head
        if (Math.abs(x - head.x) + Math.abs(y - head.y) < 4) continue;
        open.push({ x: x, y: y });
      }
    }
    return open.length ? open[(Math.random() * open.length) | 0] : null;
  }

  function spawnFood(d, type) {
    var set = occupied(d);
    var open = [];
    for (var x = 0; x < COLS; x++) {
      for (var y = 0; y < ROWS; y++) if (!set[x + ":" + y]) open.push({ x: x, y: y });
    }
    if (!open.length) return;
    var spot = open[(Math.random() * open.length) | 0];
    var item = { x: spot.x, y: spot.y, type: type };
    if (type !== "core") item.life = 8;
    d.food.push(item);
  }

  function tick(api, d) {
    if (d.queue.length) d.dir = d.queue.shift();
    var head = d.snake[0];
    var next = { x: head.x + d.dir.x, y: head.y + d.dir.y };
    var ghost = d.phase > 0;

    /* walls — PHASE wraps instead of killing */
    if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
      if (!ghost) return kill(api, d, next);
      next.x = (next.x + COLS) % COLS;
      next.y = (next.y + ROWS) % ROWS;
    }

    /* self */
    var limit = d.grow > 0 ? d.snake.length : d.snake.length - 1;
    for (var i = 0; i < limit; i++) {
      if (d.snake[i].x === next.x && d.snake[i].y === next.y) {
        if (!ghost) return kill(api, d, next);
      }
    }
    /* hazards */
    for (var h = 0; h < d.hazards.length; h++) {
      if (d.hazards[h].x === next.x && d.hazards[h].y === next.y && !ghost) return kill(api, d, next);
    }
    /* own plasma barrier */
    for (var b = 0; b < d.barriers.length; b++) {
      if (d.barriers[b].x === next.x && d.barriers[b].y === next.y && !ghost) return kill(api, d, next);
    }

    d.snake.unshift(next);

    /* food */
    for (var f = d.food.length - 1; f >= 0; f--) {
      var fd = d.food[f];
      if (fd.x !== next.x || fd.y !== next.y) continue;
      var px = cellX(d, next.x), py = cellY(d, next.y);
      d.food.splice(f, 1);
      d.eaten++;

      if (fd.type === "core") {
        d.grow += 1;
        api.hit(10, px, py);
        api.xp(2);
        api.fx.burst(px, py, { count: 16, colors: [api.colors[2], api.colors[1]], speed: 200 });
        api.sfx(880 + (d.eaten % 6) * 55, 0.09, "square", 0.09);
        if (d.eaten % 5 === 0) spawnFood(d, "mega");
        if (d.eaten % 8 === 0) spawnFood(d, "phase");
        if (d.eaten % 4 === 0) d.stepMs = Math.max(70, d.stepMs - 7);
      } else if (fd.type === "mega") {
        d.grow += 3;
        api.hit(50, px, py);
        api.xp(4);
        api.energy = Math.min(3, d.energy + 1);
        api.fx.burst(px, py, { count: 34, colors: api.colors, speed: 300 });
        api.fx.shake(7);
        api.fx.popup(px, py - 22, "MEGA CORE", api.colors[0], 17);
        if (api.audio) api.audio.arpUp();
      } else {
        d.phase = 6;
        api.hit(25, px, py);
        api.xp(3);
        api.fx.burst(px, py, { count: 26, color: api.colors[3], speed: 250 });
        api.fx.popup(px, py - 22, "PHASE SHIFT", api.colors[3], 16);
        api.sfx(1320, 0.18, "sine", 0.08);
      }
    }

    /* dash lays a barrier where the tail leaves */
    if (d.grow > 0) {
      d.grow--;
    } else {
      var tail = d.snake.pop();
      if (d.dashing > 0 && d.snake.length > 4) {
        d.barriers.push({ x: tail.x, y: tail.y, life: 1.6 });
        api.fx.trail(cellX(d, tail.x), cellY(d, tail.y), api.colors[1], d.cell * 0.4, 0.5);
      }
    }
  }

  function kill(api, d, at) {
    var px = cellX(d, U.clamp(at.x, 0, COLS - 1));
    var py = cellY(d, U.clamp(at.y, 0, ROWS - 1));
    api.fx.burst(px, py, { count: 46, colors: api.colors, speed: 340, life: 0.8 });
    for (var i = 0; i < d.snake.length; i += 2) {
      api.fx.burst(cellX(d, d.snake[i].x), cellY(d, d.snake[i].y), { count: 3, color: api.colors[1], speed: 120 });
    }
    api.gameOver();
  }
})();
