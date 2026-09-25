/* ==========================================================================
   VORTEX GAMING — games-racing.js
   RACING 13  Outrun 2D Drive    — pseudo-3D curved highway, traffic, nitro
   RACING 14  Cyber Drift        — top-down momentum/grip drift scoring
   RACING 15  Hyper Speed Dodge  — first-person wireframe tunnel runner
   RACING 16  Grid Dash          — beat-locked jump/slide rhythm runner
   ========================================================================== */
(function () {
  "use strict";

  var FX = window.VortexFX;
  var Draw = FX.Draw, U = FX.Util;

  /* ==================================================================
     13 — OUTRUN 2D DRIVE
     ================================================================== */
  var CAM_DEPTH = 190;

  FX.register({
    key: "outrun-drive",
    title: "Outrun 2D Drive",
    hint: "← → / A D steer · hold SHIFT or ◆ for NITRO · overtake traffic · never leave the asphalt",
    pad: true,

    setup: function (api) {
      var d = api.data;
      d.pos = 0;           // metres travelled
      d.playerX = 0;       // −1 .. 1 across the road
      d.speed = 320;
      d.maxSpeed = 780;
      d.nitro = 1;
      d.boosting = false;
      d.traffic = [];
      d.overtakes = 0;
      d.offroad = 0;
      d.hp = 3;
      for (var i = 0; i < 6; i++) spawnCar(d, 700 + i * 420);
    },

    update: function (dt, t, api) {
      var d = api.data, I = api.input;

      /* nitro */
      d.boosting = (I.held("dash") || I.held("action")) && d.nitro > 0.02;
      if (d.boosting) { d.nitro = Math.max(0, d.nitro - dt * 0.34); }
      else d.nitro = Math.min(1, d.nitro + dt * 0.13);

      var target = d.boosting ? d.maxSpeed * 1.32 : d.maxSpeed;
      d.speed = U.damp(d.speed, target, d.boosting ? 2.4 : 1.1, dt);

      /* steering — grip scales inversely with speed */
      var steer = I.axisX();
      if (I.pointer.down) steer = U.clamp((I.pointer.x - api.view.w / 2) / (api.view.w * 0.28), -1, 1);
      var grip = 1.5 - (d.speed / d.maxSpeed) * 0.45;
      d.playerX += steer * grip * dt * 1.9;

      /* centrifugal pull on curves */
      var curve = curveAt(d.pos + 180);
      d.playerX -= curve * (d.speed / d.maxSpeed) * dt * 1.5;
      d.playerX = U.clamp(d.playerX, -2.1, 2.1);

      /* off-road penalty */
      if (Math.abs(d.playerX) > 1) {
        d.speed = Math.max(170, d.speed - 420 * dt);
        d.offroad += dt;
        api.fx.shake(2.4);
        if (Math.random() < 0.5) {
          api.fx.spark(api.view.w / 2 + d.playerX * 60, api.view.h - 60, -Math.PI / 2,
            { count: 3, color: api.colors[2], speed: 130 });
        }
        api.breakCombo();
      } else d.offroad = 0;

      d.pos += d.speed * dt;
      api.state.score = Math.floor(d.pos / 10) + d.overtakes * 150;
      api.env.onScore(api.state.score);
      if (Math.floor(d.pos) % 1000 < d.speed * dt) api.xp(2);

      /* traffic */
      for (var i = d.traffic.length - 1; i >= 0; i--) {
        var car = d.traffic[i];
        car.z += car.speed * dt;
        var rel = car.z - d.pos;
        if (rel < -60) {
          d.traffic.splice(i, 1);
          d.overtakes++;
          api.hit(150, api.view.w / 2, api.view.h * 0.6);
          spawnCar(d, d.pos + U.rand(1400, 2400));
          continue;
        }
        if (rel < 34 && rel > -14 && Math.abs(car.lane - d.playerX) < 0.42) {
          d.traffic.splice(i, 1);
          crash(api);
          spawnCar(d, d.pos + U.rand(1200, 2000));
        }
      }
      if (d.traffic.length < 6) spawnCar(d, d.pos + U.rand(1400, 2600));
    },

    draw: function (ctx, t, api) {
      var d = api.data, v = api.view, c = api.colors;
      var horizon = v.h * 0.36;

      /* sky + sun */
      var sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, FX.rgba(c[3], 0.35));
      sky.addColorStop(1, FX.rgba(c[0], 0.18));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, v.w, horizon);
      var sunY = horizon - 44;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      Draw.circle(ctx, v.w / 2 - curveAt(d.pos + 400) * 140, sunY, 52, c[0], true);
      ctx.restore();
      ctx.fillStyle = FX.rgba("#000000", 0.55);
      for (var b = 0; b < 6; b++) ctx.fillRect(0, sunY - 30 + b * 13, v.w, 4);

      /* road — per-row perspective projection */
      var step = v.tier === "low" ? 3 : v.dpr > 1.5 ? 2 : 1;
      var x = 0, dx = 0;
      var rows = [];
      for (var y = v.h - 1; y >= horizon; y -= step) {
        var persp = (y - horizon) / (v.h - horizon);
        if (persp <= 0.001) continue;
        var rel = CAM_DEPTH / persp - CAM_DEPTH;
        var cv = curveAt(d.pos + rel);
        x += dx; dx += cv * 0.0022 * step;
        rows.push({ y: y, persp: persp, x: x, rel: rel });
      }
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        var roadW = v.w * 0.92 * row.persp;
        var cxp = v.w / 2 + row.x - d.playerX * roadW * 0.5;
        var worldZ = d.pos + row.rel;
        var stripe = Math.floor(worldZ / 26) % 2 === 0;

        /* verge */
        ctx.fillStyle = stripe ? FX.rgba(c[0], 0.5) : FX.rgba(c[3], 0.28);
        ctx.fillRect(cxp - roadW / 2 - 14 * row.persp - 8, row.y, roadW + 28 * row.persp + 16, step);
        /* tarmac */
        ctx.fillStyle = stripe ? "#150d28" : "#110a20";
        ctx.fillRect(cxp - roadW / 2, row.y, roadW, step);
        /* lane dashes */
        if (Math.floor(worldZ / 14) % 2 === 0 && row.persp > 0.08) {
          ctx.fillStyle = FX.rgba("#ffffff", 0.5);
          ctx.fillRect(cxp - roadW * 0.012, row.y, roadW * 0.024, step);
        }
      }

      /* project world objects through the same row table */
      function project(relZ) {
        if (relZ < 1) return null;
        var persp = CAM_DEPTH / (CAM_DEPTH + relZ);
        var y = horizon + (v.h - horizon) * persp;
        var acc = 0, dacc = 0;
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].rel >= relZ) { acc = rows[i].x; break; }
          acc = rows[i].x;
        }
        void dacc;
        return { y: y, persp: persp, xoff: acc };
      }

      /* traffic (far → near) */
      var sorted = d.traffic.slice().sort(function (a2, b2) { return (b2.z - d.pos) - (a2.z - d.pos); });
      for (var i2 = 0; i2 < sorted.length; i2++) {
        var car = sorted[i2];
        var p = project(car.z - d.pos);
        if (!p || p.persp < 0.03) continue;
        var roadW2 = v.w * 0.92 * p.persp;
        var cx2 = v.w / 2 + p.xoff - d.playerX * roadW2 * 0.5 + car.lane * roadW2 * 0.5;
        var cw = 78 * p.persp, ch = 46 * p.persp;
        ctx.globalAlpha = Math.min(1, p.persp * 6);
        Draw.rect(ctx, cx2 - cw / 2, p.y - ch, cw, ch, car.color, false, 3);
        ctx.fillStyle = FX.rgba(car.color, 0.22);
        ctx.fillRect(cx2 - cw / 2, p.y - ch, cw, ch);
        Draw.circle(ctx, cx2 - cw * 0.3, p.y - ch * 0.15, Math.max(1, cw * 0.07), c[0], true);
        Draw.circle(ctx, cx2 + cw * 0.3, p.y - ch * 0.15, Math.max(1, cw * 0.07), c[0], true);
        ctx.globalAlpha = 1;
      }

      /* player car */
      var pcx = v.w / 2, pcy = v.h - 54;
      var lean = U.clamp(api.input.axisX(), -1, 1) * 8;
      ctx.save();
      ctx.translate(pcx, pcy);
      ctx.rotate(lean * 0.012);
      Draw.poly(ctx, [[-34, 18], [-26, -12], [-11, -22], [11, -22], [26, -12], [34, 18]], 0, 0, 0, c[1], false, 2.4);
      ctx.fillStyle = FX.rgba(c[1], 0.2);
      ctx.fill();
      Draw.rect(ctx, -16, -16, 32, 13, c[3], true, 3);
      ctx.restore();

      /* exhaust / nitro flare */
      if (d.boosting) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (var f = 0; f < 3; f++) {
          Draw.circle(ctx, pcx - 16 + f * 16, pcy + 22 + Math.random() * 6, 7 + Math.random() * 7, c[2], true);
        }
        ctx.restore();
        api.fx.trail(pcx + U.rand(-18, 18), pcy + 24, c[2], 8, 0.25);
      }

      /* HUD */
      var kph = Math.round(d.speed * 0.42);
      Draw.text(ctx, kph + " KM/H", 16, 26, 17, d.boosting ? c[2] : c[1], "left", 800);
      Draw.hud(ctx, "OVERTAKES " + d.overtakes, 16, 46, c[1], "left", 11);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(16, 56, 110, 6);
      ctx.fillStyle = d.nitro > 0.25 ? c[2] : "#ff2b5e";
      Draw.glow(ctx, c[2], 10);
      ctx.fillRect(16, 56, 110 * d.nitro, 6);
      ctx.shadowBlur = 0;
      Draw.hud(ctx, "NITRO", 16, 72, c[2], "left", 10);
      for (var l = 0; l < d.hp; l++) Draw.rect(ctx, v.w - 20 - l * 16, 18, 10, 10, c[0], true, 2);
      if (Math.abs(d.playerX) > 1) Draw.text(ctx, "OFF ROAD", v.w / 2, v.h * 0.3, 20, "#ff2b5e", "center", 900);
    },
  });

  function curveAt(z) {
    return Math.sin(z * 0.00085) * 1.15 + Math.sin(z * 0.00031) * 0.8 + Math.sin(z * 0.0021) * 0.35;
  }
  function spawnCar(d, z) {
    var pal = (window.VortexFX.palette());
    d.traffic.push({
      z: z, lane: U.pick([-0.62, -0.22, 0.22, 0.62]),
      speed: U.rand(150, 300), color: U.pick(pal),
    });
  }
  function crash(api) {
    var d = api.data, v = api.view;
    d.hp--;
    d.speed *= 0.34;
    api.breakCombo();
    api.fx.burst(v.w / 2, v.h - 60, { count: 46, colors: ["#ff2b5e", api.colors[2]], speed: 330 });
    api.fx.shake(20);
    api.fx.flash("#ff2b5e", 0.6);
    if (api.audio) api.audio.explosion();
    if (d.hp <= 0) api.gameOver();
  }

  /* ==================================================================
     14 — CYBER DRIFT
     ================================================================== */
  FX.register({
    key: "cyber-drift",
    title: "Cyber Drift",
    hint: "↑ throttle · ← → steer · HOLD SHIFT / ◆ to break traction and DRIFT · slide through the gates",
    pad: true,

    setup: function (api) {
      var d = api.data, v = api.view;
      d.car = { x: v.w / 2, y: v.h / 2, vx: 0, vy: 0, a: -Math.PI / 2, drift: 0 };
      d.gates = [];
      d.pads = [];
      d.time = 70;
      d.driftScore = 0;
      d.driftChain = 0;
      for (var i = 0; i < 4; i++) addGate(api);
      for (var p = 0; p < 4; p++) {
        d.pads.push({ x: U.rand(60, v.w - 60), y: U.rand(60, v.h - 60), a: Math.random() * Math.PI });
      }
    },

    update: function (dt, t, api) {
      var d = api.data, v = api.view, I = api.input;
      var car = d.car;

      d.time -= dt;
      if (d.time <= 0) { api.win(Math.round(d.driftScore)); return; }

      var throttle = (I.held("up") || I.pointer.down) ? 1 : (I.held("down") ? -0.55 : 0);
      var steer = I.axisX();
      var handbrake = I.held("dash") || I.held("action");

      var speed = Math.hypot(car.vx, car.vy);
      /* steering authority grows with speed, then tapers */
      car.a += steer * dt * (1.6 + Math.min(1.4, speed / 260)) * (handbrake ? 1.5 : 1);

      var fx2 = Math.cos(car.a), fy2 = Math.sin(car.a);
      car.vx += fx2 * throttle * 560 * dt;
      car.vy += fy2 * throttle * 560 * dt;

      /* split velocity into forward + lateral, then apply grip */
      var fwd = car.vx * fx2 + car.vy * fy2;
      var latx = car.vx - fx2 * fwd, laty = car.vy - fy2 * fwd;
      var grip = handbrake ? 0.965 : 0.82;      // higher = slides longer
      var gf = Math.pow(grip, dt * 60);
      latx *= gf; laty *= gf;
      fwd *= Math.pow(0.995, dt * 60);
      car.vx = fx2 * fwd + latx;
      car.vy = fy2 * fwd + laty;

      car.x += car.vx * dt;
      car.y += car.vy * dt;

      /* arena walls */
      var bounced = false;
      if (car.x < 18) { car.x = 18; car.vx = Math.abs(car.vx) * 0.45; bounced = true; }
      if (car.x > v.w - 18) { car.x = v.w - 18; car.vx = -Math.abs(car.vx) * 0.45; bounced = true; }
      if (car.y < 18) { car.y = 18; car.vy = Math.abs(car.vy) * 0.45; bounced = true; }
      if (car.y > v.h - 18) { car.y = v.h - 18; car.vy = -Math.abs(car.vy) * 0.45; bounced = true; }
      if (bounced) {
        api.fx.spark(car.x, car.y, car.a + Math.PI, { count: 10, color: "#ff2b5e" });
        api.fx.shake(7);
        api.breakCombo();
        d.driftChain = 0;
        api.sfx(180, 0.1, "sawtooth", 0.07);
      }

      /* drift measurement: angle between heading and velocity */
      var latSpeed = Math.hypot(latx, laty);
      car.drift = speed > 60 ? U.clamp(latSpeed / Math.max(speed, 1), 0, 1) : 0;
      if (car.drift > 0.22 && speed > 120) {
        var gain = car.drift * speed * dt * 0.6;
        d.driftScore += gain;
        d.driftChain += dt;
        api.state.score = Math.floor(d.driftScore);
        api.env.onScore(api.state.score);
        api.fx.trail(car.x - fx2 * 14, car.y - fy2 * 14, api.colors[0], 7, 0.5);
        api.fx.trail(car.x - fx2 * 14 + fy2 * 8, car.y - fy2 * 14 - fx2 * 8, api.colors[2], 5, 0.45);
        if (d.driftChain > 1.2) {
          d.driftChain = 0;
          api.fx.popup(car.x, car.y - 28, "DRIFT +" + Math.round(gain * 30), api.colors[2], 14);
          api.xp(1);
          api.sfx(420 + Math.random() * 200, 0.06, "sawtooth", 0.04);
        }
      } else d.driftChain = 0;

      /* speed pads */
      for (var p = 0; p < d.pads.length; p++) {
        var pad = d.pads[p];
        if (U.dist(car.x, car.y, pad.x, pad.y) < 30) {
          car.vx += fx2 * 620 * dt;
          car.vy += fy2 * 620 * dt;
          api.fx.trail(pad.x, pad.y, api.colors[1], 16, 0.3);
        }
      }

      /* gates */
      for (var g = d.gates.length - 1; g >= 0; g--) {
        var gate = d.gates[g];
        if (U.dist(car.x, car.y, gate.x, gate.y) < 34) {
          d.gates.splice(g, 1);
          var bonus = Math.round(180 + car.drift * 420);
          api.hit(bonus, gate.x, gate.y);
          api.xp(2);
          d.time = Math.min(90, d.time + 4);
          api.fx.burst(gate.x, gate.y, { count: 26, colors: api.colors, speed: 260 });
          api.fx.popup(gate.x, gate.y - 28, car.drift > 0.4 ? "STYLE!" : "+4s", api.colors[1], 15);
          if (api.audio) api.audio.arpUp();
          addGate(api);
        }
      }
    },

    draw: function (ctx, t, api) {
      var d = api.data, v = api.view, c = api.colors;
      var car = d.car;
      Draw.grid(ctx, v.w, v.h, 44, c[3], 0, 0.07);
      ctx.beginPath();
      ctx.rect(8, 8, v.w - 16, v.h - 16);
      Draw.neonStroke(ctx, c[0], 2, 14);

      for (var p = 0; p < d.pads.length; p++) {
        var pad = d.pads[p];
        ctx.save();
        ctx.translate(pad.x, pad.y);
        ctx.rotate(pad.a);
        for (var s = -1; s <= 1; s++) {
          Draw.poly(ctx, [[-12, 0], [0, -10], [12, 0], [0, 10]], s * 16, 0, 0, c[1], false, 1.8);
        }
        ctx.restore();
      }

      for (var g = 0; g < d.gates.length; g++) {
        var gate = d.gates[g];
        var pulse = 1 + Math.sin(t * 5 + g) * 0.08;
        Draw.circle(ctx, gate.x, gate.y, 30 * pulse, c[2], false, 2.6);
        Draw.circle(ctx, gate.x, gate.y, 6, c[2], true);
      }

      /* car */
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.a);
      Draw.poly(ctx, [[18, 0], [6, -11], [-16, -9], [-16, 9], [6, 11]], 0, 0, 0, car.drift > 0.25 ? c[2] : c[1], false, 2.2);
      ctx.fillStyle = FX.rgba(car.drift > 0.25 ? c[2] : c[1], 0.2);
      ctx.fill();
      Draw.rect(ctx, -4, -7, 11, 14, c[3], true, 2);
      ctx.restore();

      Draw.hud(ctx, "TIME " + d.time.toFixed(1), 14, 20, d.time < 10 ? "#ff2b5e" : c[1], "left", 13);
      Draw.hud(ctx, "DRIFT " + Math.round(car.drift * 100) + "%", 14, 38, c[2], "left", 11);
      Draw.hud(ctx, "GATES OPEN " + d.gates.length, v.w - 12, 20, c[2], "right", 11);
    },
  });

  function addGate(api) {
    var d = api.data, v = api.view;
    d.gates.push({ x: U.rand(50, v.w - 50), y: U.rand(50, v.h - 50) });
  }

  /* ==================================================================
     15 — HYPER SPEED DODGE  (wireframe tunnel)
     ================================================================== */
  FX.register({
    key: "hyper-speed-dodge",
    title: "Hyper Speed Dodge",
    hint: "← → / A D rotate around the tunnel · SHIFT or ◆ = burst speed · slip through every barrier gap",
    pad: true,

    setup: function (api) {
      var d = api.data;
      d.angle = 0;          // player position around the tunnel
      d.speed = 230;
      d.z = 0;
      d.rings = [];
      d.cleared = 0;
      d.hp = 3;
      d.inv = 0;
      d.roll = 0;
      for (var i = 0; i < 7; i++) addRing(d, 280 + i * 190);
    },

    update: function (dt, t, api) {
      var d = api.data, I = api.input;

      var boost = (I.held("dash") || I.held("action") || I.pointer.down) ? 1.7 : 1;
      d.speed = U.damp(d.speed, (240 + d.cleared * 9) * boost, 3, dt);
      d.z += d.speed * dt;
      if (d.inv > 0) d.inv -= dt;

      var steer = I.axisX();
      if (I.pointer.down && Math.abs(I.pointer.x - api.view.w / 2) > 30) {
        steer = I.pointer.x > api.view.w / 2 ? 1 : -1;
      }
      d.angle += steer * 3.3 * dt;
      d.roll = U.damp(d.roll, steer * 0.22, 6, dt);

      api.state.score = Math.floor(d.z / 6) + d.cleared * 120;
      api.env.onScore(api.state.score);

      for (var i = d.rings.length - 1; i >= 0; i--) {
        var ring = d.rings[i];
        var rel = ring.z - d.z;
        if (rel < -40) {
          d.rings.splice(i, 1);
          d.cleared++;
          api.xp(1);
          if (d.cleared % 5 === 0) {
            api.fx.popup(api.view.w / 2, api.view.h * 0.28, "BARRIER x" + d.cleared, api.colors[2], 18);
            api.xp(2);
          }
          addRing(d, d.z + 190 * 7);
          continue;
        }
        /* collision as the barrier plane sweeps past the camera */
        if (!ring.checked && rel < 14) {
          ring.checked = true;
          var rel2 = angDiff(d.angle, ring.gapAngle);
          if (Math.abs(rel2) > ring.gapHalf) tunnelHit(api);
          else {
            api.hit(60, api.view.w / 2, api.view.h * 0.62);
            api.fx.flash(api.colors[1], 0.14);
            api.sfx(900 + Math.random() * 200, 0.05, "square", 0.05);
          }
        }
      }
    },

    draw: function (ctx, t, api) {
      var d = api.data, v = api.view, c = api.colors;
      var cx = v.w / 2, cy = v.h / 2;
      var SEG = 12;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(d.roll);
      ctx.translate(-cx, -cy);

      /* tunnel skeleton rings */
      for (var k = 0; k < 16; k++) {
        var zz = (Math.floor(d.z / 90) + k) * 90 - d.z + 60;
        if (zz <= 10) continue;
        var rr = (v.h * 3.1) / zz;
        if (rr < 6 || rr > v.h * 2.4) continue;
        ctx.globalAlpha = U.clamp(1 - zz / 1500, 0.05, 0.4);
        ctx.beginPath();
        for (var s = 0; s <= SEG; s++) {
          var a = (s / SEG) * Math.PI * 2 - d.angle;
          var px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
          if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = c[3];
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      /* radial spokes */
      ctx.globalAlpha = 0.14;
      for (var sp = 0; sp < SEG; sp++) {
        var ang = (sp / SEG) * Math.PI * 2 - d.angle;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * 12, cy + Math.sin(ang) * 12);
        ctx.lineTo(cx + Math.cos(ang) * v.h * 1.4, cy + Math.sin(ang) * v.h * 1.4);
        ctx.strokeStyle = c[1];
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      /* barriers (far → near) */
      var sorted = d.rings.slice().sort(function (a2, b2) { return b2.z - a2.z; });
      for (var i = 0; i < sorted.length; i++) {
        var ring = sorted[i];
        var rel = ring.z - d.z;
        if (rel < 6 || rel > 1500) continue;
        var rad = (v.h * 3.1) / rel;
        if (rad > v.h * 3) continue;
        var alpha = U.clamp(1 - rel / 1400, 0.1, 1);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        var start = ring.gapAngle + ring.gapHalf - d.angle;
        var end = ring.gapAngle - ring.gapHalf + Math.PI * 2 - d.angle;
        ctx.arc(cx, cy, rad, start, end);
        ctx.lineWidth = Math.max(3, rad * 0.16);
        if (v.glow) { ctx.shadowColor = ring.color; ctx.shadowBlur = 16; }
        ctx.strokeStyle = ring.color;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      /* player marker locked to the near ring */
      var pr = v.h * 0.33;
      var pax = cx + Math.cos(0) * pr, pay = cy + Math.sin(0) * pr;
      if (d.inv <= 0 || Math.floor(t * 14) % 2 === 0) {
        Draw.poly(ctx, [[12, 0], [-8, -9], [-8, 9]], pax, pay, 0, c[1], true);
        api.fx.trail(pax, pay, c[1], 7, 0.25);
      }
      ctx.restore();

      /* speed streaks */
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.25;
      for (var st = 0; st < 12; st++) {
        var sa = Math.random() * Math.PI * 2;
        var sr = U.rand(v.h * 0.4, v.h * 1.1);
        ctx.strokeStyle = c[2];
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(sa) * sr, cy + Math.sin(sa) * sr);
        ctx.lineTo(cx + Math.cos(sa) * (sr + 26 + d.speed * 0.06), cy + Math.sin(sa) * (sr + 26 + d.speed * 0.06));
        ctx.stroke();
      }
      ctx.restore();

      Draw.text(ctx, Math.round(d.speed * 1.4) + " U/S", 16, 24, 16, c[2], "left", 800);
      Draw.hud(ctx, "BARRIERS " + d.cleared, 16, 44, c[1], "left", 11);
      for (var l = 0; l < d.hp; l++) Draw.circle(ctx, v.w - 18 - l * 16, 20, 5, c[0], true);
    },
  });

  function addRing(d, z) {
    var pal = window.VortexFX.palette();
    d.rings.push({
      z: z,
      gapAngle: Math.random() * Math.PI * 2,
      gapHalf: U.rand(0.5, 0.85),
      color: U.pick(pal),
      checked: false,
    });
  }
  function angDiff(a, b) {
    var diff = (a - b) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }
  function tunnelHit(api) {
    var d = api.data, v = api.view;
    if (d.inv > 0) return;
    d.hp--;
    d.inv = 1.6;
    d.speed *= 0.5;
    api.breakCombo();
    api.fx.burst(v.w / 2, v.h * 0.62, { count: 44, colors: ["#ff2b5e", api.colors[2]], speed: 320 });
    api.fx.shake(18);
    api.fx.flash("#ff2b5e", 0.6);
    if (api.audio) api.audio.explosion();
    if (d.hp <= 0) api.gameOver();
  }

  /* ==================================================================
     16 — GRID DASH  (rhythm runner)
     ================================================================== */
  var BEAT = 0.46;   // seconds per beat

  FX.register({
    key: "grid-dash",
    title: "Grid Dash",
    hint: "SPACE / ↑ / ◆ = JUMP over lasers · ↓ = SLIDE under beams · land your jumps ON the beat for PERFECT",
    pad: true,

    setup: function (api) {
      var d = api.data, v = api.view;
      d.groundY = v.h - 64;
      d.p = { x: v.w * 0.24, y: d.groundY, vy: 0, onGround: true, slide: 0, jumps: 0 };
      d.obstacles = [];
      d.speed = 330;
      d.beat = 0;
      d.beatIdx = 0;
      d.spawnBeat = 4;
      d.cleared = 0;
      d.hp = 3;
      d.inv = 0;
      d.pulse = 0;
    },
    resize: function (api) {
      var d = api.data, v = api.view;
      d.groundY = v.h - 64;
      d.p.x = v.w * 0.24;
      if (d.p.onGround) d.p.y = d.groundY;
    },

    update: function (dt, t, api) {
      var d = api.data, v = api.view, I = api.input;

      /* ---- beat clock ---- */
      d.beat += dt;
      if (d.beat >= BEAT) {
        d.beat -= BEAT;
        d.beatIdx++;
        d.pulse = 1;
        api.sfx(d.beatIdx % 4 === 0 ? 180 : 120, 0.05, "sine", d.beatIdx % 4 === 0 ? 0.07 : 0.04);
        /* spawn on a musical grid */
        if (d.beatIdx >= d.spawnBeat) {
          d.spawnBeat = d.beatIdx + U.randInt(2, 4);
          var high = Math.random() < 0.35;
          d.obstacles.push({
            x: v.w + 40,
            kind: high ? "beam" : "laser",
            w: high ? 54 : 22,
            h: high ? 20 : U.rand(34, 62),
            hit: false,
            beat: d.beatIdx,
          });
        }
      }
      d.pulse = Math.max(0, d.pulse - dt * 3.4);
      d.speed = 330 + d.cleared * 6;
      if (d.inv > 0) d.inv -= dt;

      /* ---- player ---- */
      var p = d.p;
      if ((I.pressed("action") || I.pressed("up") || (I.pointer.down && !d.tapLatch)) && p.jumps < 2) {
        d.tapLatch = true;
        p.vy = -640;
        p.onGround = false;
        p.jumps++;
        api.fx.burst(p.x, p.y + 12, { count: 10, color: api.colors[1], speed: 150, angle: Math.PI / 2, spread: 1.6 });
        api.sfx(p.jumps === 1 ? 660 : 880, 0.07, "triangle", 0.07);
      }
      if (!I.pointer.down) d.tapLatch = false;

      p.slide = I.held("down") ? Math.min(1, p.slide + dt * 8) : Math.max(0, p.slide - dt * 8);

      p.vy += 1850 * dt;
      p.y += p.vy * dt;
      if (p.y >= d.groundY) {
        if (!p.onGround) {
          /* rhythm accuracy: how close the landing is to a beat */
          var off = Math.min(d.beat, BEAT - d.beat);
          var perfect = off < 0.08;
          api.hit(perfect ? 120 : 40, p.x, p.y - 40);
          if (perfect) {
            api.fx.popup(p.x, p.y - 64, "PERFECT", api.colors[2], 16);
            api.fx.flash(api.colors[2], 0.16);
            api.xp(1);
          }
          api.fx.burst(p.x, d.groundY + 8, { count: 8, color: api.colors[3], speed: 140, angle: -Math.PI / 2, spread: 2 });
        }
        p.y = d.groundY; p.vy = 0; p.onGround = true; p.jumps = 0;
      }
      if (!p.onGround) api.fx.trail(p.x - 8, p.y - 14, api.colors[1], 6, 0.26);

      /* ---- obstacles ---- */
      var headY = p.y - (p.slide > 0.5 ? 14 : 30);
      for (var i = d.obstacles.length - 1; i >= 0; i--) {
        var o = d.obstacles[i];
        o.x -= d.speed * dt;
        if (o.x < -70) {
          d.obstacles.splice(i, 1);
          d.cleared++;
          continue;
        }
        var oy = o.kind === "laser" ? d.groundY + 10 - o.h : d.groundY - 66;
        var px0 = p.x - 12, px1 = p.x + 12;
        if (!o.hit && px1 > o.x && px0 < o.x + o.w) {
          var overlap = o.kind === "laser"
            ? (p.y + 4 > oy)                       // feet below the laser top
            : (headY < oy + o.h && p.y > oy);      // head clipping the beam
          if (overlap) {
            o.hit = true;
            dashHit(api);
          } else if (!o.scored) {
            o.scored = true;
            api.hit(70, p.x, p.y - 50);
          }
        }
      }

      api.state.score = Math.max(api.state.score, api.state.score);
    },

    draw: function (ctx, t, api) {
      var d = api.data, v = api.view, c = api.colors;
      var p = d.p;

      /* beat-reactive backdrop */
      var pulse = d.pulse;
      ctx.save();
      ctx.globalAlpha = 0.06 + pulse * 0.12;
      ctx.fillStyle = c[3];
      ctx.fillRect(0, 0, v.w, v.h);
      ctx.restore();
      Draw.grid(ctx, v.w, v.h, 46, c[3], -(t * d.speed) % 46, 0.06 + pulse * 0.05);

      /* beat pillars */
      for (var b = 0; b < 8; b++) {
        var bx = ((b * 160) - (t * d.speed * 0.4) % 160 + v.w) % (v.w + 160) - 80;
        ctx.globalAlpha = 0.1 + (b % 4 === 0 ? pulse * 0.25 : 0);
        ctx.fillStyle = c[1];
        ctx.fillRect(bx, 0, 3, v.h);
        ctx.globalAlpha = 1;
      }

      /* ground */
      Draw.line(ctx, 0, d.groundY + 14, v.w, d.groundY + 14, c[0], 2.4 + pulse * 2, 16);
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = c[0];
      ctx.fillRect(0, d.groundY + 16, v.w, v.h - d.groundY);
      ctx.restore();

      /* obstacles */
      for (var i = 0; i < d.obstacles.length; i++) {
        var o = d.obstacles[i];
        var oy = o.kind === "laser" ? d.groundY + 10 - o.h : d.groundY - 66;
        var col = o.kind === "laser" ? "#ff2b5e" : c[2];
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = col;
        ctx.fillRect(o.x - 3, oy - 3, o.w + 6, o.h + 6);
        ctx.restore();
        Draw.rect(ctx, o.x, oy, o.w, o.h, col, true, 3);
        if (o.kind === "laser") {
          for (var s = 0; s < 3; s++) {
            ctx.globalAlpha = 0.35;
            Draw.line(ctx, o.x + o.w / 2, oy, o.x + o.w / 2, oy + o.h, "#ffffff", 1, 6);
            ctx.globalAlpha = 1;
          }
        }
      }

      /* runner */
      if (d.inv <= 0 || Math.floor(t * 14) % 2 === 0) {
        var bodyH = p.slide > 0.5 ? 16 : 30;
        var bodyW = p.slide > 0.5 ? 34 : 20;
        ctx.save();
        ctx.translate(p.x, p.y - bodyH / 2);
        Draw.rect(ctx, -bodyW / 2, -bodyH / 2, bodyW, bodyH, c[1], false, 4);
        ctx.fillStyle = FX.rgba(c[1], 0.25);
        ctx.fill();
        Draw.circle(ctx, 0, -bodyH / 2 - 7, 6, c[1], true);
        ctx.restore();
      }

      /* beat indicator */
      var bw = 90;
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(v.w / 2 - bw / 2, 16, bw, 5);
      ctx.fillStyle = c[2];
      ctx.fillRect(v.w / 2 - bw / 2, 16, bw * (d.beat / BEAT), 5);
      ctx.globalAlpha = pulse;
      Draw.circle(ctx, v.w / 2, 34, 6 + pulse * 4, c[2], true);
      ctx.globalAlpha = 1;

      Draw.hud(ctx, "CLEARED " + d.cleared, 14, 22, c[1], "left", 11);
      for (var l = 0; l < d.hp; l++) Draw.circle(ctx, v.w - 16 - l * 15, 22, 5, c[0], true);
    },
  });

  function dashHit(api) {
    var d = api.data;
    if (d.inv > 0) return;
    d.hp--;
    d.inv = 1.4;
    api.breakCombo();
    api.fx.burst(d.p.x, d.p.y - 20, { count: 40, colors: ["#ff2b5e", api.colors[2]], speed: 300 });
    api.fx.shake(16);
    api.fx.flash("#ff2b5e", 0.6);
    if (api.audio) api.audio.explosion();
    if (d.hp <= 0) api.gameOver();
  }
})();
