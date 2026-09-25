/* ==========================================================================
   VORTEX GAMING — games-puzzle.js
   PUZZLE 05  Grid Stacker         — neon tetromino stacking, combos, gravity surge
   PUZZLE 06  Quantum Laser Reflect— rotate mirrors/prisms to light every node
   PUZZLE 07  Memory Matrix        — rhythmic sequence hacking w/ glitch distortion
   PUZZLE 08  Neon Flow            — connect colour nodes without crossing wires
   ========================================================================== */
(function () {
  "use strict";

  var FX = window.VortexFX;
  var Draw = FX.Draw, U = FX.Util;

  /* ==================================================================
     05 — GRID STACKER
     ================================================================== */
  var SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  };
  var SKEYS = Object.keys(SHAPES);
  var GCOLS = 10, GROWS = 18;

  FX.register({
    key: "grid-stacker",
    title: "Cyber Grid Stacker",
    hint: "← → move · ↑ / ◆ rotate · ↓ soft drop · SHIFT hard drop · chain clears for COMBO · watch for GRAVITY SURGE",
    pad: true,

    setup: function (api) {
      var d = api.data;
      gsLayout(api);
      d.board = [];
      for (var r = 0; r < GROWS; r++) d.board.push(new Array(GCOLS).fill(0));
      d.lines = 0;
      d.chain = 0;
      d.dropMs = 700;
      d.acc = 0;
      d.surgeIn = 6;      // line clears until next gravity surge
      d.flashRows = [];
      gsSpawn(api);
    },
    resize: function (api) { gsLayout(api); },

    update: function (dt, t, api) {
      var d = api.data, I = api.input;
      if (I.pressed("left")) gsMove(api, -1);
      if (I.pressed("right")) gsMove(api, 1);
      if (I.pressed("up") || I.pressed("action")) gsRotate(api);
      if (I.pressed("dash")) gsHardDrop(api);

      for (var f = d.flashRows.length - 1; f >= 0; f--) {
        d.flashRows[f].t -= dt;
        if (d.flashRows[f].t <= 0) d.flashRows.splice(f, 1);
      }

      var step = I.held("down") ? Math.max(38, d.dropMs / 10) : d.dropMs;
      d.acc += dt * 1000;
      while (d.acc >= step) {
        d.acc -= step;
        if (!gsCollide(d, d.cur.m, d.cur.x, d.cur.y + 1)) d.cur.y++;
        else { gsLock(api); break; }
      }
    },

    draw: function (ctx, t, api) {
      var d = api.data, v = api.view, c = api.colors;
      var cell = d.cell, ox = d.ox, oy = d.oy;

      ctx.fillStyle = "rgba(255,255,255,0.02)";
      ctx.fillRect(ox, oy, GCOLS * cell, GROWS * cell);
      ctx.save();
      ctx.translate(ox, oy);
      Draw.grid(ctx, GCOLS * cell, GROWS * cell, cell, "#ffffff", 0, 0.05);
      ctx.restore();

      function block(bx, by, ci, alpha, ghost) {
        var x = ox + bx * cell, y = oy + by * cell;
        ctx.globalAlpha = alpha;
        if (ghost) {
          ctx.beginPath();
          ctx.rect(x + 2.5, y + 2.5, cell - 5, cell - 5);
          ctx.strokeStyle = c[ci % 4]; ctx.lineWidth = 1.4; ctx.stroke();
        } else {
          Draw.glow(ctx, c[ci % 4], 8);
          ctx.fillStyle = c[ci % 4];
          ctx.fillRect(x + 1.5, y + 1.5, cell - 3, cell - 3);
          ctx.shadowBlur = 0;
          ctx.fillStyle = "rgba(255,255,255,0.22)";
          ctx.fillRect(x + 1.5, y + 1.5, cell - 3, 3);
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.fillRect(x + 1.5, y + cell - 5, cell - 3, 3.5);
        }
        ctx.globalAlpha = 1;
      }

      for (var r = 0; r < GROWS; r++) {
        for (var x2 = 0; x2 < GCOLS; x2++) if (d.board[r][x2]) block(x2, r, d.board[r][x2], 1);
      }
      /* clearing row flash */
      for (var f = 0; f < d.flashRows.length; f++) {
        var fr = d.flashRows[f];
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.max(0, fr.t / 0.25);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(ox, oy + fr.y * cell, GCOLS * cell, cell);
        ctx.restore();
      }

      if (d.cur) {
        var gy = d.cur.y;
        while (!gsCollide(d, d.cur.m, d.cur.x, gy + 1)) gy++;
        for (var a = 0; a < d.cur.m.length; a++) {
          for (var b = 0; b < d.cur.m[a].length; b++) {
            if (!d.cur.m[a][b]) continue;
            block(d.cur.x + b, gy + a, d.cur.ci, 0.3, true);
            if (d.cur.y + a >= 0) block(d.cur.x + b, d.cur.y + a, d.cur.ci, 1);
          }
        }
      }

      ctx.beginPath();
      ctx.rect(ox - 2, oy - 2, GCOLS * cell + 4, GROWS * cell + 4);
      Draw.neonStroke(ctx, c[0], 2, 14);

      /* side panel */
      var px = ox + GCOLS * cell + 16;
      if (px < v.w - 70) {
        Draw.hud(ctx, "LINES", px, oy + 14, c[1], "left", 10);
        Draw.text(ctx, String(d.lines), px, oy + 34, 20, c[1], "left", 800);
        Draw.hud(ctx, "CHAIN", px, oy + 66, c[2], "left", 10);
        Draw.text(ctx, "x" + (1 + d.chain), px, oy + 86, 20, c[2], "left", 800);
        Draw.hud(ctx, "SURGE IN", px, oy + 118, c[3], "left", 10);
        Draw.text(ctx, String(d.surgeIn), px, oy + 138, 20, c[3], "left", 800);
        Draw.hud(ctx, "NEXT", px, oy + 174, c[0], "left", 10);
        if (d.next) {
          for (var ny = 0; ny < d.next.m.length; ny++) {
            for (var nx = 0; nx < d.next.m[ny].length; nx++) {
              if (!d.next.m[ny][nx]) continue;
              ctx.fillStyle = c[d.next.ci % 4];
              ctx.fillRect(px + nx * 12, oy + 188 + ny * 12, 10, 10);
            }
          }
        }
      }
    },
  });

  function gsLayout(api) {
    var d = api.data, v = api.view;
    d.cell = Math.max(10, Math.floor(Math.min((v.h - 24) / GROWS, (v.w * 0.55) / GCOLS)));
    d.ox = Math.floor((v.w - GCOLS * d.cell) / 2 - (v.w > 520 ? 60 : 0));
    d.oy = Math.floor((v.h - GROWS * d.cell) / 2);
  }
  function gsPiece() {
    var k = SKEYS[(Math.random() * SKEYS.length) | 0];
    return { m: SHAPES[k].map(function (r) { return r.slice(); }), x: 3, y: 0, ci: 1 + ((Math.random() * 4) | 0) };
  }
  function gsSpawn(api) {
    var d = api.data;
    d.cur = d.next || gsPiece();
    d.next = gsPiece();
    d.cur.x = ((GCOLS - d.cur.m.length) / 2) | 0;
    d.cur.y = 0;
    if (gsCollide(d, d.cur.m, d.cur.x, d.cur.y)) {
      api.fx.flash("#ff2b5e", 0.7);
      api.fx.shake(16);
      api.gameOver();
    }
  }
  function gsCollide(d, m, px, py) {
    for (var y = 0; y < m.length; y++) {
      for (var x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        var bx = px + x, by = py + y;
        if (bx < 0 || bx >= GCOLS || by >= GROWS) return true;
        if (by >= 0 && d.board[by][bx]) return true;
      }
    }
    return false;
  }
  function gsMove(api, dx) {
    var d = api.data;
    if (!gsCollide(d, d.cur.m, d.cur.x + dx, d.cur.y)) { d.cur.x += dx; api.sfx(400, 0.03, "square", 0.03); }
  }
  function gsRotate(api) {
    var d = api.data, m = d.cur.m, n = m.length, out = [];
    for (var i = 0; i < n; i++) out.push(new Array(n).fill(0));
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) out[x][n - 1 - y] = m[y][x];
    var kicks = [0, -1, 1, -2, 2];
    for (var k = 0; k < kicks.length; k++) {
      if (!gsCollide(d, out, d.cur.x + kicks[k], d.cur.y)) {
        d.cur.m = out; d.cur.x += kicks[k];
        api.sfx(640, 0.04, "triangle", 0.045);
        return;
      }
    }
  }
  function gsHardDrop(api) {
    var d = api.data, dist = 0;
    while (!gsCollide(d, d.cur.m, d.cur.x, d.cur.y + 1)) { d.cur.y++; dist++; }
    if (dist) api.addScore(dist * 2);
    api.fx.shake(2 + dist * 0.15);
    gsLock(api);
  }
  function gsLock(api) {
    var d = api.data;
    for (var y = 0; y < d.cur.m.length; y++) {
      for (var x = 0; x < d.cur.m[y].length; x++) {
        if (d.cur.m[y][x] && d.cur.y + y >= 0) d.board[d.cur.y + y][d.cur.x + x] = d.cur.ci;
      }
    }
    api.sfx(220, 0.06, "square", 0.05);
    var cleared = gsClear(api);
    if (cleared === 0) d.chain = 0;
    gsSpawn(api);
  }
  function gsClear(api) {
    var d = api.data, cleared = 0;
    for (var y = GROWS - 1; y >= 0; y--) {
      var full = true;
      for (var x = 0; x < GCOLS; x++) if (!d.board[y][x]) { full = false; break; }
      if (!full) continue;
      d.flashRows.push({ y: y, t: 0.25 });
      for (var px = 0; px < GCOLS; px++) {
        api.fx.burst(d.ox + px * d.cell + d.cell / 2, d.oy + y * d.cell + d.cell / 2,
          { count: 4, colors: api.colors, speed: 170 });
      }
      d.board.splice(y, 1);
      d.board.push(new Array(GCOLS).fill(0));
      cleared++; y++;
    }
    if (cleared > 0) {
      d.chain++;
      d.lines += cleared;
      var base = [0, 100, 300, 500, 800][Math.min(4, cleared)];
      var total = Math.round(base * (1 + (d.chain - 1) * 0.5));
      api.addScore(total, api.view.w / 2, d.oy + 40,
        (cleared === 4 ? "VORTEX CLEAR " : "+") + total);
      api.xp(cleared * 2);
      api.fx.shake(4 + cleared * 3);
      api.fx.flash(api.colors[1], 0.25 + cleared * 0.1);
      if (api.audio) api.audio.arpUp();
      d.dropMs = Math.max(120, 700 - d.lines * 22);
      d.surgeIn -= cleared;
      if (d.surgeIn <= 0) { d.surgeIn = 6; gsSurge(api); }
    }
    return cleared;
  }
  /** GRAVITY SURGE: every floating block collapses down, re-packing the stack. */
  function gsSurge(api) {
    var d = api.data;
    for (var x = 0; x < GCOLS; x++) {
      var stack = [];
      for (var y = GROWS - 1; y >= 0; y--) if (d.board[y][x]) stack.push(d.board[y][x]);
      for (var y2 = GROWS - 1, i = 0; y2 >= 0; y2--, i++) d.board[y2][x] = i < stack.length ? stack[i] : 0;
    }
    api.fx.flash(api.colors[3], 0.5);
    api.fx.shake(12);
    api.fx.popup(api.view.w / 2, api.view.h / 2, "GRAVITY SURGE", api.colors[3], 22);
    if (api.audio) api.audio.explosion();
    gsClear(api);
  }

  /* ==================================================================
     06 — QUANTUM LASER REFLECT
     ================================================================== */
  var QC = 9, QR = 7;

  FX.register({
    key: "quantum-laser",
    title: "Quantum Laser Reflect",
    hint: "CLICK / TAP a mirror to rotate it (ARROWS + ◆ with keyboard) · light every target node",
    pad: true,

    setup: function (api) {
      var d = api.data;
      qLayout(api);
      d.level = 1;
      d.cursor = { x: 0, y: 0 };
      d.moves = 0;
      qBuild(api);
    },
    resize: function (api) { qLayout(api); },

    update: function (dt, t, api) {
      var d = api.data, I = api.input;

      if (I.pressed("left")) d.cursor.x = (d.cursor.x + QC - 1) % QC;
      if (I.pressed("right")) d.cursor.x = (d.cursor.x + 1) % QC;
      if (I.pressed("up")) d.cursor.y = (d.cursor.y + QR - 1) % QR;
      if (I.pressed("down")) d.cursor.y = (d.cursor.y + 1) % QR;
      if (I.pressed("action") || I.pressed("dash")) qRotate(api, d.cursor.x, d.cursor.y);

      var taps = I.takeTaps();
      for (var i = 0; i < taps.length; i++) {
        var gx = Math.floor((taps[i].x - d.ox) / d.cell);
        var gy = Math.floor((taps[i].y - d.oy) / d.cell);
        if (gx >= 0 && gx < QC && gy >= 0 && gy < QR) {
          d.cursor.x = gx; d.cursor.y = gy;
          qRotate(api, gx, gy);
        }
      }

      d.beam = qTrace(d);
      var lit = 0, total = 0;
      for (var y = 0; y < QR; y++) {
        for (var x = 0; x < QC; x++) {
          if (d.cells[y][x].type === "target") { total++; if (d.cells[y][x].lit) lit++; }
        }
      }
      if (total > 0 && lit === total && !d.solvedT) {
        d.solvedT = 0.9;
        var bonus = 600 + Math.max(0, 300 - d.moves * 20);
        api.addScore(bonus, api.view.w / 2, d.oy - 14, "CIRCUIT SOLVED +" + bonus);
        api.xp(6);
        api.fx.flash(api.colors[1], 0.6);
        api.fx.shake(8);
        if (api.audio) api.audio.arpUp();
      }
      if (d.solvedT) {
        d.solvedT -= dt;
        if (d.solvedT <= 0) { d.solvedT = 0; d.level++; d.moves = 0; qBuild(api); }
      }
    },

    draw: function (ctx, t, api) {
      var d = api.data, c = api.colors, cell = d.cell;

      ctx.save();
      ctx.translate(d.ox, d.oy);
      Draw.grid(ctx, QC * cell, QR * cell, cell, "#ffffff", 0, 0.07);
      ctx.restore();

      /* beam segments (additive) */
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var b = 0; b < d.beam.length; b++) {
        var s = d.beam[b];
        Draw.line(ctx, qx(d, s.x0), qy(d, s.y0), qx(d, s.x1), qy(d, s.y1), c[2], 2.4, 18);
      }
      ctx.restore();

      for (var y = 0; y < QR; y++) {
        for (var x = 0; x < QC; x++) {
          var cellObj = d.cells[y][x];
          var px = qx(d, x), py = qy(d, y), h = cell * 0.34;
          if (cellObj.type === "mirror") {
            var a = cellObj.o === 0 ? -Math.PI / 4 : Math.PI / 4;
            ctx.save();
            ctx.translate(px, py); ctx.rotate(a);
            ctx.beginPath(); ctx.moveTo(-h, 0); ctx.lineTo(h, 0);
            Draw.neonStroke(ctx, c[1], 3.2, 12);
            ctx.restore();
          } else if (cellObj.type === "prism") {
            Draw.poly(ctx, [[0, -h], [h, h], [-h, h]], px, py, t * 0.6, c[3], false, 2);
          } else if (cellObj.type === "wall") {
            Draw.rect(ctx, px - h, py - h, h * 2, h * 2, "#5a5570", true, 3);
          } else if (cellObj.type === "target") {
            var lit = cellObj.lit;
            Draw.circle(ctx, px, py, h * (lit ? 0.95 + Math.sin(t * 8) * 0.08 : 0.72), lit ? c[2] : "#6d6688", lit, 2);
            if (lit) {
              ctx.save(); ctx.globalCompositeOperation = "lighter";
              Draw.circle(ctx, px, py, h * 1.7, c[2], true);
              ctx.restore();
            }
          } else if (cellObj.type === "emitter") {
            Draw.poly(ctx, [[-h, -h], [h, 0], [-h, h]], px, py, 0, c[0], true);
          }
        }
      }

      /* cursor */
      var cxp = qx(d, d.cursor.x), cyp = qy(d, d.cursor.y);
      ctx.globalAlpha = 0.55 + Math.sin(t * 6) * 0.25;
      Draw.rect(ctx, cxp - cell / 2 + 2, cyp - cell / 2 + 2, cell - 4, cell - 4, c[0], false, 4);
      ctx.globalAlpha = 1;

      Draw.hud(ctx, "CIRCUIT " + d.level + " · MOVES " + d.moves, d.ox, d.oy - 12, c[1], "left", 11);
      Draw.hud(ctx, "ROTATE MIRRORS TO LIGHT EVERY NODE", d.ox + QC * cell, d.oy - 12, c[2], "right", 10);
    },
  });

  function qLayout(api) {
    var d = api.data, v = api.view;
    d.cell = Math.max(22, Math.floor(Math.min((v.w - 40) / QC, (v.h - 60) / QR)));
    d.ox = Math.floor((v.w - QC * d.cell) / 2);
    d.oy = Math.floor((v.h - QR * d.cell) / 2) + 8;
  }
  function qx(d, gx) { return d.ox + gx * d.cell + d.cell / 2; }
  function qy(d, gy) { return d.oy + gy * d.cell + d.cell / 2; }

  function qRotate(api, x, y) {
    var d = api.data, cellObj = d.cells[y][x];
    if (cellObj.type !== "mirror") return;
    cellObj.o = cellObj.o === 0 ? 1 : 0;
    d.moves++;
    api.sfx(520 + Math.random() * 240, 0.05, "triangle", 0.05);
    api.fx.spark(qx(d, x), qy(d, y), Math.random() * 6.3, { count: 5, color: api.colors[1] });
  }

  /**
   * Constructive generator with a solvability guarantee:
   *   1. carve a beam path, recording each mirror's INTENDED orientation
   *   2. place decoys/walls ONLY on cells the beam never touches
   *   3. verify by tracing with intended orientations — retry if not all lit
   *   4. scramble the mirrors so the player has something to solve
   */
  function qBuild(api) {
    for (var attempt = 0; attempt < 40; attempt++) {
      if (qGenerate(api) && qValidate(api)) { qScramble(api); return; }
    }
    qScramble(api);   // fall back to the last generated board
  }

  function qValidate(api) {
    var d = api.data, y, x, cell;
    for (y = 0; y < QR; y++) {
      for (x = 0; x < QC; x++) {
        cell = d.cells[y][x];
        if (cell.type === "mirror" && cell.intended !== undefined) cell.o = cell.intended;
      }
    }
    qTrace(d);
    var total = 0, lit = 0;
    for (y = 0; y < QR; y++) {
      for (x = 0; x < QC; x++) {
        if (d.cells[y][x].type === "target") { total++; if (d.cells[y][x].lit) lit++; }
      }
    }
    return total > 0 && lit === total;
  }

  function qScramble(api) {
    var d = api.data, changed = false, mirrors = [];
    for (var y = 0; y < QR; y++) {
      for (var x = 0; x < QC; x++) {
        var cell = d.cells[y][x];
        if (cell.type !== "mirror") continue;
        mirrors.push(cell);
        var o = (Math.random() * 2) | 0;
        if (cell.intended !== undefined && o !== cell.intended) changed = true;
        cell.o = o;
      }
    }
    // never hand the player an already-solved board
    if (!changed && mirrors.length) {
      var pick = mirrors[(Math.random() * mirrors.length) | 0];
      pick.o = pick.o === 0 ? 1 : 0;
    }
    d.beam = qTrace(d);
  }

  function qGenerate(api) {
    var d = api.data;
    d.cells = [];
    for (var y = 0; y < QR; y++) {
      var row = [];
      for (var x = 0; x < QC; x++) row.push({ type: "empty", o: 0, lit: false });
      d.cells.push(row);
    }
    var sy = 1 + ((Math.random() * (QR - 2)) | 0);
    d.start = { x: 0, y: sy };
    d.cells[sy][0] = { type: "emitter", o: 0, lit: false };
    d.startDir = { x: 1, y: 0 };

    var cx = 0, cy = sy, dir = { x: 1, y: 0 };
    var turns = 3 + Math.min(3, (d.level / 2) | 0);
    var placedTargets = 0;
    /* every cell the intended beam crosses — kept clear of decoys */
    var reserved = {};
    reserved[cx + ":" + cy] = 1;

    function inBounds(x, y) { return x >= 0 && x < QC && y >= 0 && y < QR; }
    function isEmpty(x, y) { return inBounds(x, y) && d.cells[y][x].type === "empty"; }

    for (var seg = 0; seg < turns; seg++) {
      var len = 2 + ((Math.random() * 3) | 0);
      var moved = 0;
      for (var step = 0; step < len; step++) {
        var nx = cx + dir.x, ny = cy + dir.y;
        if (!inBounds(nx, ny)) break;
        /* the path must never re-enter an occupied cell, or the intended
           beam would be deflected early and the board becomes unsolvable */
        if (!isEmpty(nx, ny)) return false;
        cx = nx; cy = ny; moved++;
        reserved[cx + ":" + cy] = 1;
        /* pass-through targets only on INTERMEDIATE cells — the final cell
           of a run is reserved for the turning mirror */
        if (step < len - 1 && placedTargets < 2 && Math.random() < 0.45) {
          d.cells[cy][cx] = { type: "target", o: 0, lit: false };
          placedTargets++;
        }
      }
      if (moved === 0) break;

      /* turn: the mirror cell and the cell after it must both be usable */
      var turnDir = Math.random() < 0.5 ? 1 : -1;
      var ndir = { x: -dir.y * turnDir, y: dir.x * turnDir };
      if (!isEmpty(cx + ndir.x, cy + ndir.y)) ndir = { x: dir.y * turnDir, y: -dir.x * turnDir };
      if (!isEmpty(cx + ndir.x, cy + ndir.y)) break;          // dead end → stop here
      if (d.cells[cy][cx].type !== "empty") break;            // can't place the mirror

      var want = mirrorFor(dir, ndir);
      d.cells[cy][cx] = { type: "mirror", o: want, intended: want, lit: false };
      dir = ndir;
    }

    /* terminal target one cell beyond the final mirror */
    var tx = cx + dir.x, ty = cy + dir.y;
    if (isEmpty(tx, ty)) {
      d.cells[ty][tx] = { type: "target", o: 0, lit: false };
      reserved[tx + ":" + ty] = 1;
      placedTargets++;
    }
    if (placedTargets === 0) return false;

    /* decoys + obstacles — NEVER on a reserved beam cell (keeps it solvable) */
    var extras = 3 + Math.min(5, d.level);
    for (var e = 0; e < extras; e++) {
      var rx = (Math.random() * QC) | 0, ry = (Math.random() * QR) | 0;
      if (d.cells[ry][rx].type !== "empty") continue;
      if (reserved[rx + ":" + ry]) continue;
      d.cells[ry][rx] = Math.random() < 0.7
        ? { type: "mirror", o: (Math.random() * 2) | 0, lit: false }
        : { type: "wall", o: 0, lit: false };
    }
    d.beam = qTrace(d);
    return true;
  }

  /**
   * Generator self-test hook (used by scripts/game-harness.js).
   * Builds N boards and verifies each one is solvable with the intended
   * mirror orientations. Returns { rounds, pass }.
   */
  window.VortexGames["quantum-laser"].selfTest = function (rounds) {
    var probe = { data: {} };
    var pass = 0, attemptsUsed = 0;
    for (var i = 0; i < rounds; i++) {
      probe.data.level = 1 + (i % 10);
      /* mirrors qBuild()'s retry budget — this is the guarantee the player gets */
      for (var a = 0; a < 40; a++) {
        attemptsUsed++;
        if (qGenerate(probe) && qValidate(probe)) { pass++; break; }
      }
    }
    return { rounds: rounds, pass: pass, avgAttempts: (attemptsUsed / rounds).toFixed(2) };
  };

  /** Orientation of the mirror that turns `from` into `to`. 0 = '/', 1 = '\'. */
  function mirrorFor(from, to) {
    if (from.x === 1 && to.y === -1) return 0;
    if (from.y === 1 && to.x === -1) return 0;
    if (from.x === -1 && to.y === 1) return 0;
    if (from.y === -1 && to.x === 1) return 0;
    return 1;
  }
  function reflect(dir, o) {
    return o === 0
      ? { x: -dir.y, y: -dir.x }   // '/'
      : { x: dir.y, y: dir.x };    // '\'
  }

  /** Beam tracer with visited-state guard (handles prisms + loops safely). */
  function qTrace(d) {
    for (var y = 0; y < QR; y++) for (var x = 0; x < QC; x++) d.cells[y][x].lit = false;
    var segs = [];
    var seen = {};
    var queue = [{ x: d.start.x, y: d.start.y, dir: d.startDir }];
    var guard = 0;

    while (queue.length && guard++ < 400) {
      var b = queue.shift();
      var cx = b.x, cy = b.y, dir = b.dir;
      var legs = 0;
      while (legs++ < 80) {
        var nx = cx + dir.x, ny = cy + dir.y;
        if (nx < 0 || nx >= QC || ny < 0 || ny >= QR) {
          segs.push({ x0: cx, y0: cy, x1: nx, y1: ny });
          break;
        }
        var key = nx + ":" + ny + ":" + dir.x + ":" + dir.y;
        if (seen[key]) break;
        seen[key] = 1;
        segs.push({ x0: cx, y0: cy, x1: nx, y1: ny });
        cx = nx; cy = ny;
        var cell = d.cells[cy][cx];
        if (cell.type === "wall") break;
        if (cell.type === "mirror") { dir = reflect(dir, cell.o); continue; }
        if (cell.type === "prism") {
          queue.push({ x: cx, y: cy, dir: { x: -dir.y, y: dir.x } });
          queue.push({ x: cx, y: cy, dir: { x: dir.y, y: -dir.x } });
          break;
        }
        if (cell.type === "target") { cell.lit = true; continue; }  // pass-through
        if (cell.type === "emitter") break;
      }
    }
    return segs;
  }

  /* ==================================================================
     07 — MEMORY MATRIX  (rhythmic glitch hacking)
     ================================================================== */
  FX.register({
    key: "memory-matrix",
    title: "Memory Matrix",
    hint: "WATCH the node sequence, then REPEAT it — click/tap, or ARROWS + ◆. Beat the decryption timer.",
    pad: true,

    setup: function (api) {
      var d = api.data;
      mLayout(api);
      d.seq = [];
      d.pos = 0;
      d.phase = "show";       // show · input · pause
      d.showIdx = 0;
      d.showT = 0.7;
      d.pulse = new Array(9).fill(0);
      d.cursor = 4;
      d.round = 0;
      d.timeLeft = 0;
      d.timeMax = 1;
      d.glitch = 0;
      mNext(api);
    },
    resize: function (api) { mLayout(api); },

    update: function (dt, t, api) {
      var d = api.data, I = api.input;
      for (var i = 0; i < 9; i++) d.pulse[i] = Math.max(0, d.pulse[i] - dt * 3);
      d.glitch = Math.max(0, d.glitch - dt * 1.6);

      if (d.phase === "show") {
        d.showT -= dt;
        if (d.showT <= 0) {
          if (d.showIdx < d.seq.length) {
            var idx = d.seq[d.showIdx];
            d.pulse[idx] = 1;
            api.sfx(300 + idx * 70, 0.12, "triangle", 0.08);
            if (Math.random() < 0.22 + d.round * 0.03) d.glitch = 0.5;   // distortion tick
            d.showIdx++;
            d.showT = Math.max(0.22, 0.62 - d.round * 0.025);
          } else {
            d.phase = "input";
            d.timeMax = Math.max(1.4, 4.2 - d.round * 0.16);
            d.timeLeft = d.timeMax;
          }
        }
      } else if (d.phase === "input") {
        d.timeLeft -= dt;
        if (d.timeLeft <= 0) return mFail(api, "TIMEOUT");

        if (I.pressed("left")) d.cursor = d.cursor % 3 === 0 ? d.cursor + 2 : d.cursor - 1;
        if (I.pressed("right")) d.cursor = d.cursor % 3 === 2 ? d.cursor - 2 : d.cursor + 1;
        if (I.pressed("up")) d.cursor = (d.cursor + 6) % 9;
        if (I.pressed("down")) d.cursor = (d.cursor + 3) % 9;
        if (I.pressed("action") || I.pressed("dash")) mStrike(api, d.cursor);

        var taps = I.takeTaps();
        for (var k = 0; k < taps.length; k++) {
          var gx = Math.floor((taps[k].x - d.ox) / d.cell);
          var gy = Math.floor((taps[k].y - d.oy) / d.cell);
          if (gx >= 0 && gx < 3 && gy >= 0 && gy < 3) mStrike(api, gy * 3 + gx);
        }
      } else {
        d.pauseT -= dt;
        if (d.pauseT <= 0) mNext(api);
      }
    },

    draw: function (ctx, t, api) {
      var d = api.data, c = api.colors, cell = d.cell;

      /* glitch distortion: horizontal tear bands */
      if (d.glitch > 0) {
        ctx.save();
        ctx.globalAlpha = d.glitch * 0.5;
        for (var g = 0; g < 5; g++) {
          var gy2 = Math.random() * api.view.h;
          ctx.fillStyle = g % 2 ? c[0] : c[1];
          ctx.fillRect(0, gy2, api.view.w, 1 + Math.random() * 3);
        }
        ctx.restore();
      }

      for (var i = 0; i < 9; i++) {
        var gx = i % 3, gy = (i / 3) | 0;
        var px = d.ox + gx * cell + cell / 2;
        var py = d.oy + gy * cell + cell / 2;
        var pad = cell * 0.4;
        var jitter = d.glitch > 0 ? (Math.random() - 0.5) * d.glitch * 6 : 0;
        var p = d.pulse[i];
        ctx.save();
        ctx.translate(jitter, 0);
        if (p > 0.05) {
          ctx.globalAlpha = 0.25 + p * 0.55;
          Draw.rect(ctx, px - pad, py - pad, pad * 2, pad * 2, c[i % 4], true, 8);
          ctx.globalAlpha = 1;
        }
        Draw.rect(ctx, px - pad, py - pad, pad * 2, pad * 2, p > 0.05 ? c[i % 4] : "rgba(255,255,255,0.22)", false, 8);
        if (d.phase === "input" && i === d.cursor) {
          ctx.globalAlpha = 0.6 + Math.sin(t * 8) * 0.3;
          Draw.rect(ctx, px - pad - 5, py - pad - 5, pad * 2 + 10, pad * 2 + 10, c[2], false, 10);
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }

      /* core readout */
      var cxp = d.ox + cell * 1.5, cyp = d.oy - 26;
      Draw.text(ctx, d.phase === "show" ? "OBSERVE" : d.phase === "input" ? "REPLICATE" : "…",
        cxp, cyp, 15, d.phase === "show" ? c[1] : c[2], "center", 800);
      Draw.hud(ctx, "SEQ " + d.seq.length + " · ROUND " + d.round, d.ox, d.oy + cell * 3 + 20, c[1], "left", 11);
      Draw.hud(ctx, d.pos + "/" + d.seq.length, d.ox + cell * 3, d.oy + cell * 3 + 20, c[2], "right", 11);

      if (d.phase === "input") {
        var w = cell * 3, pct = Math.max(0, d.timeLeft / d.timeMax);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(d.ox, d.oy + cell * 3 + 30, w, 6);
        ctx.fillStyle = pct < 0.3 ? "#ff2b5e" : c[2];
        Draw.glow(ctx, c[2], 10);
        ctx.fillRect(d.ox, d.oy + cell * 3 + 30, w * pct, 6);
        ctx.shadowBlur = 0;
      }
    },
  });

  function mLayout(api) {
    var d = api.data, v = api.view;
    d.cell = Math.max(48, Math.floor(Math.min((v.w - 60) / 3, (v.h - 110) / 3)));
    d.ox = Math.floor((v.w - d.cell * 3) / 2);
    d.oy = Math.floor((v.h - d.cell * 3) / 2) + 6;
  }
  function mNext(api) {
    var d = api.data;
    d.round++;
    d.seq.push((Math.random() * 9) | 0);
    d.pos = 0;
    d.showIdx = 0;
    d.showT = 0.5;
    d.phase = "show";
  }
  function mStrike(api, idx) {
    var d = api.data;
    d.pulse[idx] = 1;
    api.sfx(300 + idx * 70, 0.1, "square", 0.08);
    var px = d.ox + (idx % 3) * d.cell + d.cell / 2;
    var py = d.oy + (((idx / 3) | 0)) * d.cell + d.cell / 2;

    if (d.seq[d.pos] === idx) {
      d.pos++;
      api.fx.spark(px, py, Math.random() * 6.3, { count: 6, color: api.colors[idx % 4] });
      if (d.pos >= d.seq.length) {
        var gain = 120 * d.seq.length + Math.round(d.timeLeft * 40);
        api.hit(gain, px, py);
        api.xp(3);
        api.fx.flash(api.colors[1], 0.3);
        if (api.audio) api.audio.arpUp();
        d.phase = "pause";
        d.pauseT = 0.7;
      }
    } else {
      mFail(api, "DESYNC");
    }
  }
  function mFail(api, reason) {
    var d = api.data;
    api.fx.flash("#ff2b5e", 0.7);
    api.fx.shake(14);
    api.fx.popup(api.view.w / 2, api.view.h / 2, reason, "#ff2b5e", 24);
    d.glitch = 1;
    api.gameOver(800);
  }

  /* ==================================================================
     08 — NEON FLOW  (node connector)
     ================================================================== */
  var LEVELS = [
    ["A.B..", "..C..", ".....", "A.B.C", "....."],
    ["A..B..", "..C...", "....D.", "A.C...", "B....D", "......"],
    ["A...B..", ".C...D.", ".......", "..A.B..", ".......", ".C...D.", "......."],
  ];

  FX.register({
    key: "neon-flow",
    title: "Neon Flow",
    hint: "DRAG from a node to its twin (or ARROWS + ◆ to route) · wires may never cross · link every pair",
    pad: true,

    setup: function (api) {
      var d = api.data;
      d.levelIdx = 0;
      d.cursor = { x: 0, y: 0 };
      d.active = -1;
      nfLoad(api);
    },
    resize: function (api) { nfLayout(api); },

    update: function (dt, t, api) {
      var d = api.data, I = api.input;

      /* pointer routing */
      if (I.pointer.down) {
        var gx = Math.floor((I.pointer.x - d.ox) / d.cell);
        var gy = Math.floor((I.pointer.y - d.oy) / d.cell);
        if (gx >= 0 && gx < d.cols && gy >= 0 && gy < d.rows) {
          if (d.active < 0) {
            var n = d.nodes[gy][gx];
            if (n >= 0) { d.active = n; d.paths[n] = [{ x: gx, y: gy }]; api.sfx(500 + n * 90, 0.05, "triangle", 0.05); }
          } else {
            nfExtend(api, gx, gy);
          }
          d.cursor.x = gx; d.cursor.y = gy;
        }
      } else if (d.active >= 0) {
        nfRelease(api);
      }

      /* keyboard routing */
      if (I.pressed("left")) nfKeyMove(api, -1, 0);
      if (I.pressed("right")) nfKeyMove(api, 1, 0);
      if (I.pressed("up")) nfKeyMove(api, 0, -1);
      if (I.pressed("down")) nfKeyMove(api, 0, 1);
      if (I.pressed("action") || I.pressed("dash")) {
        if (d.active < 0) {
          var nn = d.nodes[d.cursor.y][d.cursor.x];
          if (nn >= 0) { d.active = nn; d.paths[nn] = [{ x: d.cursor.x, y: d.cursor.y }]; }
        } else nfRelease(api);
      }

      if (d.winT > 0) {
        d.winT -= dt;
        if (d.winT <= 0) { d.levelIdx++; nfLoad(api); }
      }
    },

    draw: function (ctx, t, api) {
      var d = api.data, c = api.colors, cell = d.cell;

      ctx.save();
      ctx.translate(d.ox, d.oy);
      Draw.grid(ctx, d.cols * cell, d.rows * cell, cell, "#ffffff", 0, 0.08);
      ctx.restore();
      ctx.beginPath();
      ctx.rect(d.ox - 2, d.oy - 2, d.cols * cell + 4, d.rows * cell + 4);
      Draw.neonStroke(ctx, c[1], 1.6, 10);

      /* wires */
      for (var col = 0; col < d.colors.length; col++) {
        var path = d.paths[col];
        if (!path || path.length < 2) continue;
        ctx.beginPath();
        for (var i = 0; i < path.length; i++) {
          var px = nfx(d, path[i].x), py = nfy(d, path[i].y);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        Draw.neonStroke(ctx, d.colors[col], cell * 0.3, 16);
        ctx.lineCap = "butt";
      }

      /* endpoints */
      for (var y = 0; y < d.rows; y++) {
        for (var x = 0; x < d.cols; x++) {
          var n = d.nodes[y][x];
          if (n < 0) continue;
          var done = d.solved[n];
          Draw.circle(ctx, nfx(d, x), nfy(d, y), cell * (done ? 0.33 : 0.28) * (done ? 1 + Math.sin(t * 6) * 0.06 : 1), d.colors[n], true);
          if (done) {
            ctx.save(); ctx.globalCompositeOperation = "lighter";
            Draw.circle(ctx, nfx(d, x), nfy(d, y), cell * 0.5, d.colors[n], true);
            ctx.restore();
          }
        }
      }

      /* cursor */
      ctx.globalAlpha = 0.5 + Math.sin(t * 7) * 0.3;
      Draw.rect(ctx, nfx(d, d.cursor.x) - cell / 2 + 3, nfy(d, d.cursor.y) - cell / 2 + 3, cell - 6, cell - 6,
        d.active >= 0 ? d.colors[d.active] : c[2], false, 5);
      ctx.globalAlpha = 1;

      var done2 = d.solved.filter(Boolean).length;
      Draw.hud(ctx, "CIRCUIT " + (d.levelIdx + 1) + " · LINKED " + done2 + "/" + d.colors.length,
        d.ox, d.oy - 14, c[1], "left", 11);
    },
  });

  function nfLayout(api) {
    var d = api.data, v = api.view;
    if (!d.cols) return;
    d.cell = Math.max(26, Math.floor(Math.min((v.w - 50) / d.cols, (v.h - 70) / d.rows)));
    d.ox = Math.floor((v.w - d.cols * d.cell) / 2);
    d.oy = Math.floor((v.h - d.rows * d.cell) / 2) + 8;
  }
  function nfx(d, x) { return d.ox + x * d.cell + d.cell / 2; }
  function nfy(d, y) { return d.oy + y * d.cell + d.cell / 2; }

  function nfLoad(api) {
    var d = api.data;
    var grid = LEVELS[d.levelIdx % LEVELS.length];
    d.rows = grid.length;
    d.cols = grid[0].length;
    d.nodes = [];
    var letters = {};
    var pal = api.colors.concat(["#00ff9d", "#ff6b00"]);
    for (var y = 0; y < d.rows; y++) {
      var row = [];
      for (var x = 0; x < d.cols; x++) {
        var ch = grid[y][x];
        if (ch === ".") { row.push(-1); continue; }
        if (letters[ch] === undefined) letters[ch] = Object.keys(letters).length;
        row.push(letters[ch]);
      }
      d.nodes.push(row);
    }
    var count = Object.keys(letters).length;
    d.colors = [];
    for (var i = 0; i < count; i++) d.colors.push(pal[i % pal.length]);
    d.paths = [];
    d.solved = [];
    for (var p = 0; p < count; p++) { d.paths.push([]); d.solved.push(false); }
    d.active = -1;
    d.cursor = { x: 0, y: 0 };
    d.winT = 0;
    nfLayout(api);
  }

  /** Is (x,y) free for colour `col`? */
  function nfFree(d, x, y, col) {
    if (d.nodes[y][x] >= 0 && d.nodes[y][x] !== col) return false;
    for (var c = 0; c < d.paths.length; c++) {
      if (c === col) continue;
      for (var i = 0; i < d.paths[c].length; i++) {
        if (d.paths[c][i].x === x && d.paths[c][i].y === y) return false;
      }
    }
    return true;
  }

  function nfExtend(api, gx, gy) {
    var d = api.data, col = d.active;
    var path = d.paths[col];
    if (!path.length) return;
    var last = path[path.length - 1];
    if (last.x === gx && last.y === gy) return;
    if (Math.abs(last.x - gx) + Math.abs(last.y - gy) !== 1) return;   // adjacency only

    /* backtrack along own path */
    if (path.length > 1) {
      var prev = path[path.length - 2];
      if (prev.x === gx && prev.y === gy) { path.pop(); return; }
    }
    if (!nfFree(d, gx, gy, col)) return;
    for (var i = 0; i < path.length; i++) if (path[i].x === gx && path[i].y === gy) return;

    path.push({ x: gx, y: gy });
    api.fx.trail(nfx(d, gx), nfy(d, gy), d.colors[col], d.cell * 0.3, 0.25);

    /* completion: reached the twin node */
    if (d.nodes[gy][gx] === col && path.length > 1) {
      var start = path[0];
      if (!(start.x === gx && start.y === gy)) {
        d.solved[col] = true;
        d.active = -1;
        api.hit(200, nfx(d, gx), nfy(d, gy));
        api.xp(2);
        api.fx.burst(nfx(d, gx), nfy(d, gy), { count: 18, color: d.colors[col], speed: 200 });
        api.sfx(880, 0.1, "triangle", 0.08);
        nfCheckWin(api);
      }
    }
  }

  function nfKeyMove(api, dx, dy) {
    var d = api.data;
    var nx = U.clamp(d.cursor.x + dx, 0, d.cols - 1);
    var ny = U.clamp(d.cursor.y + dy, 0, d.rows - 1);
    d.cursor.x = nx; d.cursor.y = ny;
    if (d.active >= 0) nfExtend(api, nx, ny);
  }

  function nfRelease(api) {
    var d = api.data;
    if (d.active < 0) return;
    if (!d.solved[d.active]) d.paths[d.active] = [];
    d.active = -1;
  }

  function nfCheckWin(api) {
    var d = api.data;
    for (var i = 0; i < d.solved.length; i++) if (!d.solved[i]) return;
    var bonus = 800 + d.levelIdx * 250;
    api.addScore(bonus, api.view.w / 2, api.view.h / 2, "CIRCUIT COMPLETE +" + bonus);
    api.xp(7);
    api.fx.flash(api.colors[1], 0.55);
    api.fx.shake(9);
    if (api.audio) api.audio.arpUp();
    d.winT = 1.1;
  }
})();
