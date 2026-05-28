// bouncer.js — v8ui canvas for the Bouncer M4L device
// Milestones 1–2: source + hand-drawn walls + bouncing particles + hit events.

autowatch = 1;
inlets = 1;
outlets = 2;   // 0 = events/geometry, 1 = map (target id / disarm)

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;

// ---------- state ----------
var source = { x: 100, y: 74 };
var walls = [];               // [{id, points:[{x,y},...], color}]
var nextWallId = 1;

var particles = [];           // [{id, emitTime, path:[{from,to,t0,t1}], events, alive}]
var nextParticleId = 1;

var rateMs = 120;
var speedPxPerSec = 240;
var maxBounces = 8;
var drawMode = 0;

var emitAngleDeg = 0;     // direction the emitter is pointing (0 = right, 90 = down)
var sweepDeg = 360;       // emission cone width; 360 = omnidirectional
var sourceMode = 0;       // 0 = random auto-emission, 1 = MIDI-triggered, 2 = audio (future)

// Per-wall mode lives on each wall (wall.mode = "audio" | "midi" | "mod"), but
// the M3c UI is just a global override that stamps every wall's mode in lockstep.
// When the M4 per-wall editor lands the global tab becomes "default for new walls"
// and per-wall mode wins at dispatch time.
var globalWallMode = 0;   // 0 = audio, 1 = midi, 2 = mod
var midiDurMs = 200;      // note-off scheduled this many ms after note-on (in patcher's pipe)

// M3d parameter-modulation outputs. Walls in "mod" mode pulse one of 8
// device-parameter dials (mapped by the user in Live's Map mode). Each dial
// jumps to peakValue on a hit and decays linearly back to 0 over decayMs.
// Decay runs in tick() at the ~60 fps frame rate (good enough for Phase 1
// manual mapping; the steppiness only matters for fast filter sweeps).
var NUM_MOD_DIALS = 8;
var modDials = [];        // [{active, startMs, peak, decayMs}]
for (var _mi = 0; _mi < NUM_MOD_DIALS; _mi++) {
  modDials.push({ active: false, startMs: 0, peak: 0, decayMs: 300 });
}

var currentDraw = null;
var selectedWall = -1;
var draggingSource = false;
var lastEmit = 0;

// ---------- tick (bang from patcher metro) ----------
function bang() {
  tick();
}

function tick() {
  var now = nowMs();

  // Rescue source if it ended up outside the visible canvas (e.g. older
  // presets stored at y=200 when the canvas was taller). User can drag
  // it from wherever it lands.
  var W = box.rect[2] - box.rect[0];
  var H = box.rect[3] - box.rect[1];
  if (W > 0 && H > 0) {
    var changed = false;
    if (source.x < 8 || source.x > W - 8) { source.x = Math.max(8, Math.min(W - 8, source.x)); changed = true; }
    if (source.y < 8 || source.y > H - 8) { source.y = Math.max(8, Math.min(H - 8, source.y)); changed = true; }
    if (changed) dumpGeometry();
  }

  // Only auto-emit in random mode; MIDI / audio modes fire on demand.
  if (!drawMode && sourceMode === 0 && (now - lastEmit) >= rateMs) {
    emitParticle(now);
    lastEmit = now;
  }

  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    var elapsed = now - p.emitTime;

    // Non-MIDI particles have no note-off to wait for; expire srcAlive after 1s.
    if (p.srcAlive && p.srcType !== "midi" && elapsed > 1000) p.srcAlive = false;

    // Advance through any wall-hit events whose scheduled time has now passed.
    // Fire the audio engine + flash at this moment so the voice triggers when
    // the particle visually reaches the wall, not at emission. The voice's
    // tapout~ still reads back `delayMs` (the travel time) so it plays the
    // audio that was current when the particle was born — i.e. the particle
    // "carries" that audio across the canvas and "drops" it on the wall.
    while (p.nextEventIdx < p.events.length && elapsed >= p.events[p.nextEventIdx].hitTimeMs) {
      var ev = p.events[p.nextEventIdx];
      var wall = findWallById(ev.wallId);
      var mode = (wall && wall.mode) || "audio";
      if (mode === "midi") {
        // snapshot.pitch is -1 when source isn't MIDI; fall back to a fixed pitch
        // so random/audio sources still produce an audible MIDI placeholder.
        var pitch = (p.snapshot && p.snapshot.pitch >= 0) ? p.snapshot.pitch : 60;
        var vel   = (p.snapshot && p.snapshot.velocity > 0) ? p.snapshot.velocity : 100;
        outlet(0, "note_hit", pitch, vel, 1);
      } else if (mode === "mod") {
        var di = wall.dialIndex | 0;
        if (di < 0) di = 0;
        if (di >= NUM_MOD_DIALS) di = NUM_MOD_DIALS - 1;
        var m = modDials[di];
        m.active = true;
        m.startMs = now;
        m.peak = (wall.peakValue !== undefined) ? wall.peakValue : 1.0;
        m.decayMs = (wall.decayMs !== undefined) ? wall.decayMs : 300;
      } else {
        var gainEv = Math.pow(0.85, ev.bounce);
        var panEv  = Math.max(-1, Math.min(1, (ev.x / Math.max(1, W)) * 2 - 1));
        outlet(0, "hit", p.id, ev.wallId, Math.round(ev.delayMs),
               gainEv, panEv,
               ev.x, ev.y, ev.nx, ev.ny, ev.bounce);
      }
      p.hitFlashUntilMs = now + 150;
      p.nextEventIdx++;
    }

    var seg = null;
    for (var s = 0; s < p.path.length; s++) {
      if (elapsed <= p.path[s].t1 || !isFinite(p.path[s].t1)) {
        seg = p.path[s];
        break;
      }
    }
    if (!seg) { p.alive = false; continue; }
    var t = isFinite(seg.t1)
      ? (elapsed - seg.t0) / Math.max(1, seg.t1 - seg.t0)
      : Math.min(1, (elapsed - seg.t0) / 2000);
    p.x = seg.from.x + (seg.to.x - seg.from.x) * t;
    p.y = seg.from.y + (seg.to.y - seg.from.y) * t;

    var W = box.rect[2] - box.rect[0];
    var H = box.rect[3] - box.rect[1];
    if (p.x < -20 || p.y < -20 || p.x > W + 20 || p.y > H + 20) p.alive = false;
  }

  var alive = [];
  for (var i = 0; i < particles.length; i++) if (particles[i].alive) alive.push(particles[i]);
  particles = alive;

  updateModDials(now);

  mgraphics.redraw();
}

// Emit the current value of every decaying mod dial. Outputs once more at 0
// when a pulse finishes, then goes quiet until the next hit re-arms it.
function updateModDials(now) {
  for (var i = 0; i < NUM_MOD_DIALS; i++) {
    var m = modDials[i];
    if (!m.active) continue;
    var frac = (now - m.startMs) / Math.max(1, m.decayMs);
    if (frac >= 1) {
      outlet(0, "mod", i, 0.0);
      m.active = false;
    } else {
      outlet(0, "mod", i, m.peak * (1 - frac));
    }
  }
}

function nowMs() {
  try { return Date.now(); } catch (e) { return 0; }
}

// ---------- emission ----------
// pitch/velocity default to sentinels for non-MIDI sources; srcType identifies
// whether note-off matching applies (midi) or the particle auto-expires (random/audio).
function emitParticle(now, pitch, velocity, srcType) {
  var sweepRad = (sweepDeg / 360) * Math.PI * 2;
  var centerRad = emitAngleDeg * Math.PI / 180;
  var ang = centerRad + (Math.random() - 0.5) * sweepRad;
  var v = { x: Math.cos(ang), y: Math.sin(ang) };
  var path = computePath(source, v, walls, maxBounces, speedPxPerSec / 1000);

  var pid = nextParticleId++;
  particles.push({
    id: pid,
    emitTime: now,
    path: path.segments,
    events: path.events,
    x: source.x, y: source.y,
    alive: true,
    snapshot: {
      pitch:    (pitch    === undefined) ? -1  : pitch,
      velocity: (velocity === undefined) ? 100 : velocity,
      emittedAt: now
    },
    srcType: srcType || "random",
    srcAlive: true,
    nextEventIdx: 0,
    hitFlashUntilMs: 0
  });

  // Per-hit `hit` messages are dispatched in tick() at the moment each visual
  // collision is reached — see the event-advance loop. `particle` just reports
  // how many bounces were predicted for this emission so the patcher can log.
  outlet(0, "particle", pid, path.events.length);
}

// ---------- geometry ----------
function reflect(v, n) {
  var d = v.x * n.x + v.y * n.y;
  return { x: v.x - 2 * d * n.x, y: v.y - 2 * d * n.y };
}

function raySegmentIntersect(p, v, a, b) {
  var sx = b.x - a.x, sy = b.y - a.y;
  var denom = v.x * (-sy) - v.y * (-sx);
  if (Math.abs(denom) < 1e-9) return null;
  var dx = a.x - p.x, dy = a.y - p.y;
  var t = (dx * (-sy) - dy * (-sx)) / denom;
  var s = (v.x * dy - v.y * dx) / denom;
  if (t <= 1e-4 || s < 0 || s > 1) return null;
  var len = Math.sqrt(sx * sx + sy * sy);
  var n = { x: -sy / len, y: sx / len };
  if (n.x * v.x + n.y * v.y > 0) { n.x = -n.x; n.y = -n.y; }
  return { point: { x: p.x + v.x * t, y: p.y + v.y * t }, normal: n, dist: t };
}

function findNearestHit(p, v) {
  var nearest = null, nd = Infinity;
  for (var w = 0; w < walls.length; w++) {
    var wl = walls[w];
    for (var s = 0; s + 1 < wl.points.length; s++) {
      var hit = raySegmentIntersect(p, v, wl.points[s], wl.points[s + 1]);
      if (hit && hit.dist < nd) {
        nd = hit.dist;
        nearest = { point: hit.point, normal: hit.normal, dist: hit.dist,
                    wallId: wl.id, segIndex: s };
      }
    }
  }
  return nearest;
}

function computePath(srcPt, vel, wls, maxB, speedPxPerMs) {
  var p = { x: srcPt.x, y: srcPt.y };
  var v = { x: vel.x, y: vel.y };
  var t = 0;
  var segments = [];
  var events = [];

  for (var b = 0; b < maxB; b++) {
    var hit = findNearestHit(p, v);
    if (!hit) {
      var W = box.rect[2] - box.rect[0];
      var H = box.rect[3] - box.rect[1];
      var far = Math.max(W, H) * 2;
      var to = { x: p.x + v.x * far, y: p.y + v.y * far };
      var dt = far / speedPxPerMs;
      segments.push({ from: { x: p.x, y: p.y }, to: to, t0: t, t1: t + dt });
      return { segments: segments, events: events };
    }
    var dt = hit.dist / speedPxPerMs;
    var hitTime = t + dt;
    segments.push({ from: { x: p.x, y: p.y }, to: hit.point, t0: t, t1: hitTime });
    events.push({
      wallId: hit.wallId, hitTimeMs: hitTime, delayMs: hitTime,
      x: hit.point.x, y: hit.point.y, nx: hit.normal.x, ny: hit.normal.y, bounce: b
    });
    v = reflect(v, hit.normal);
    p = { x: hit.point.x + v.x * 0.05, y: hit.point.y + v.y * 0.05 };
    t = hitTime;
  }
  var W = box.rect[2] - box.rect[0];
  var H = box.rect[3] - box.rect[1];
  var far = Math.max(W, H) * 2;
  var to = { x: p.x + v.x * far, y: p.y + v.y * far };
  var dt = far / speedPxPerMs;
  segments.push({ from: { x: p.x, y: p.y }, to: to, t0: t, t1: t + dt });
  return { segments: segments, events: events };
}

// ---------- paint ----------
function paint() {
  var W = box.rect[2] - box.rect[0];
  var H = box.rect[3] - box.rect[1];
  var mg = mgraphics;
  var now = nowMs();

  // Background — deep blue-black gradient feel via two flat passes
  mg.set_source_rgba(0.035, 0.052, 0.085, 1);
  mg.rectangle(0, 0, W, H);
  mg.fill();
  mg.set_source_rgba(0.06, 0.09, 0.14, 0.9);
  mg.rectangle(6, 6, W - 12, H - 12);
  mg.fill();

  // Subtle dot grid
  mg.set_source_rgba(0.4, 0.65, 0.95, 0.18);
  var step = 32;
  for (var gx = step; gx < W; gx += step) {
    for (var gy = step; gy < H; gy += step) {
      mg.ellipse(gx - 0.7, gy - 0.7, 1.4, 1.4);
      mg.fill();
    }
  }

  // Walls — double-stroke for soft glow effect
  for (var i = 0; i < walls.length; i++) {
    var wl = walls[i];
    var isSel = (i === selectedWall);

    // Outer glow stroke
    if (isSel) mg.set_source_rgba(1, 0.85, 0.3, 0.18);
    else       mg.set_source_rgba(0.45, 0.78, 1, 0.18);
    mg.set_line_width(7);
    for (var j = 0; j + 1 < wl.points.length; j++) {
      mg.move_to(wl.points[j].x, wl.points[j].y);
      mg.line_to(wl.points[j + 1].x, wl.points[j + 1].y);
    }
    mg.stroke();

    // Inner solid stroke
    if (isSel) { mg.set_source_rgba(1, 0.88, 0.35, 1); mg.set_line_width(3); }
    else       { mg.set_source_rgba(0.62, 0.86, 1, 0.95); mg.set_line_width(2); }
    for (var jb = 0; jb + 1 < wl.points.length; jb++) {
      mg.move_to(wl.points[jb].x, wl.points[jb].y);
      mg.line_to(wl.points[jb + 1].x, wl.points[jb + 1].y);
    }
    mg.stroke();

    // Endpoint handles when selected
    if (isSel) {
      mg.set_source_rgba(1, 0.88, 0.35, 1);
      for (var jj = 0; jj < wl.points.length; jj++) {
        mg.ellipse(wl.points[jj].x - 3, wl.points[jj].y - 3, 6, 6);
        mg.fill();
      }
    }
  }

  // In-progress draw
  if (currentDraw && currentDraw.points.length > 1) {
    mg.set_source_rgba(1, 0.95, 0.45, 0.9);
    mg.set_line_width(2);
    for (var k = 0; k + 1 < currentDraw.points.length; k++) {
      mg.move_to(currentDraw.points[k].x, currentDraw.points[k].y);
      mg.line_to(currentDraw.points[k + 1].x, currentDraw.points[k + 1].y);
    }
    mg.stroke();
  }

  // Particles — filled while srcAlive, hollow ring once source has ended.
  // A wall hit sets hitFlashUntilMs=now+150, which decays linearly back to
  // the current state, briefly refilling unfilled particles.
  for (var pi = 0; pi < particles.length; pi++) {
    var p = particles[pi];
    var flashStr = Math.max(0, (p.hitFlashUntilMs - now) / 150);
    var fill = p.srcAlive ? 1 : flashStr;

    if (fill > 0) {
      mg.set_source_rgba(1, 1, 1, 0.18 * fill);
      mg.ellipse(p.x - 4, p.y - 4, 8, 8);
      mg.fill();
      mg.set_source_rgba(1, 1, 1, 0.98 * fill);
      mg.ellipse(p.x - 2, p.y - 2, 4, 4);
      mg.fill();
    } else {
      mg.set_source_rgba(1, 1, 1, 0.55);
      mg.set_line_width(1.2);
      mg.ellipse(p.x - 2, p.y - 2, 4, 4);
      mg.stroke();
    }
  }

  // Emission cone — drawn behind the source so the source ring sits on top
  var dirRad = emitAngleDeg * Math.PI / 180;
  var halfSweep = (sweepDeg / 360) * Math.PI;   // half of total sweep, in radians
  if (sweepDeg < 360) {
    mg.set_source_rgba(1, 0.65, 0.35, 0.13);
    mg.move_to(source.x, source.y);
    mg.arc(source.x, source.y, 26, dirRad - halfSweep, dirRad + halfSweep);
    mg.line_to(source.x, source.y);
    mg.fill();
    // Cone edge lines
    mg.set_source_rgba(1, 0.7, 0.4, 0.35);
    mg.set_line_width(1);
    mg.move_to(source.x, source.y);
    mg.line_to(source.x + Math.cos(dirRad - halfSweep) * 26, source.y + Math.sin(dirRad - halfSweep) * 26);
    mg.move_to(source.x, source.y);
    mg.line_to(source.x + Math.cos(dirRad + halfSweep) * 26, source.y + Math.sin(dirRad + halfSweep) * 26);
    mg.stroke();
  }
  // Direction tick (always shown so user can see where they're aiming)
  mg.set_source_rgba(1, 0.75, 0.4, 0.9);
  mg.set_line_width(2);
  mg.move_to(source.x + Math.cos(dirRad) * 10, source.y + Math.sin(dirRad) * 10);
  mg.line_to(source.x + Math.cos(dirRad) * 22, source.y + Math.sin(dirRad) * 22);
  mg.stroke();

  // Source — pulsing ring + core
  var pulse = 0.5 + 0.5 * Math.sin(now * 0.005);
  var ringR = 11 + 5 * pulse;
  mg.set_source_rgba(1, 0.35, 0.4, 0.22 + 0.18 * pulse);
  mg.set_line_width(2);
  mg.ellipse(source.x - ringR, source.y - ringR, 2 * ringR, 2 * ringR);
  mg.stroke();
  mg.set_source_rgba(1, 0.45, 0.5, 0.4);
  mg.ellipse(source.x - 8, source.y - 8, 16, 16);
  mg.fill();
  mg.set_source_rgba(1, 0.25, 0.32, 1);
  mg.ellipse(source.x - 4, source.y - 4, 8, 8);
  mg.fill();

  // HUD badge — top-left, semi-transparent backing.
  // Color and label reflect both edit/play state and the active source.
  var srcLabels = ["RND", "MIDI", "AUD"];
  var srcLabel = srcLabels[sourceMode] || "?";
  var badgeText = drawMode ? "DRAW" : ("PLAY • " + srcLabel);
  var badgeColor = drawMode
    ? [1, 0.85, 0.35]
    : (sourceMode === 1 ? [1, 0.5, 0.7] : (sourceMode === 2 ? [0.55, 0.7, 1] : [0.55, 0.95, 0.85]));
  mg.set_source_rgba(0, 0, 0, 0.55);
  mg.rectangle(8, 8, 90, 18);
  mg.fill();
  mg.set_source_rgba(badgeColor[0], badgeColor[1], badgeColor[2], 0.9);
  mg.ellipse(13, 13, 8, 8);
  mg.fill();
  mg.set_source_rgba(1, 1, 1, 0.85);
  mg.select_font_face("Arial Bold");
  mg.set_font_size(10);
  mg.move_to(28, 21);
  mg.show_text(badgeText);

  // HUD info — bottom-left, particle + wall counts
  mg.set_source_rgba(1, 1, 1, 0.4);
  mg.select_font_face("Arial");
  mg.set_font_size(9);
  mg.move_to(10, H - 8);
  mg.show_text(walls.length + " walls   " + particles.length + " particles");
}

// ---------- mouse ----------
function onclick(x, y, button, mod1, shift, capslock, option, ctrl) {
  if (drawMode) {
    currentDraw = { points: [{ x: x, y: y }] };
    return;
  }
  var dx = x - source.x, dy = y - source.y;
  if (dx * dx + dy * dy <= 14 * 14) { draggingSource = true; return; }
  var hit = findNearestWallIndex(x, y, 8);
  selectedWall = (hit >= 0) ? hit : -1;
  mgraphics.redraw();
}

function ondrag(x, y, button, mod1, shift, capslock, option, ctrl) {
  if (drawMode) {
    if (!currentDraw) return;
    if (button === 0) { finishDraw(); return; }
    var last = currentDraw.points[currentDraw.points.length - 1];
    var dx = x - last.x, dy = y - last.y;
    if (dx * dx + dy * dy > 16) currentDraw.points.push({ x: x, y: y });
    mgraphics.redraw();
    return;
  }
  if (draggingSource) {
    if (button === 0) { draggingSource = false; return; }
    source.x = x; source.y = y;
    mgraphics.redraw();
  }
}

function modeStrFor(n) {
  return (n === 2) ? "mod" : (n === 1) ? "midi" : "audio";
}

// M3d per-wall mod params. The M3c global-stamp model has no per-wall editor
// yet, so every mod wall defaults to dial 0; M4's wall editor will let the user
// pick dialIndex/peakValue/decayMs individually. These fields still round-trip
// through the geometry pattr so M4 inherits them for free.
function ensureModFields(w) {
  if (w.dialIndex === undefined) w.dialIndex = 0;
  if (w.peakValue === undefined) w.peakValue = 1.0;
  if (w.decayMs === undefined) w.decayMs = 300;
}

function finishDraw() {
  if (currentDraw && currentDraw.points.length > 1) {
    var w = {
      id: nextWallId++,
      points: simplify(currentDraw.points, 2.0),
      color: [0.55, 0.78, 1, 0.95],
      mode: modeStrFor(globalWallMode)
    };
    ensureModFields(w);
    walls.push(w);
    dumpGeometry();
  }
  currentDraw = null;
  mgraphics.redraw();
}

function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  function rdp(a, b) {
    var ax = pts[a].x, ay = pts[a].y;
    var bx = pts[b].x, by = pts[b].y;
    var maxD = 0, idx = -1;
    for (var i = a + 1; i < b; i++) {
      var d = perpDist(pts[i], ax, ay, bx, by);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps && idx > 0) {
      var l = rdp(a, idx), r = rdp(idx, b);
      return l.slice(0, l.length - 1).concat(r);
    }
    return [pts[a], pts[b]];
  }
  function perpDist(p, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var L2 = dx * dx + dy * dy;
    if (L2 < 1e-9) {
      var ddx = p.x - ax, ddy = p.y - ay;
      return Math.sqrt(ddx * ddx + ddy * ddy);
    }
    var t = ((p.x - ax) * dx + (p.y - ay) * dy) / L2;
    t = Math.max(0, Math.min(1, t));
    var qx = ax + t * dx, qy = ay + t * dy;
    var ddx = p.x - qx, ddy = p.y - qy;
    return Math.sqrt(ddx * ddx + ddy * ddy);
  }
  return rdp(0, pts.length - 1);
}

function findWallById(id) {
  for (var i = 0; i < walls.length; i++) if (walls[i].id === id) return walls[i];
  return null;
}

function findNearestWallIndex(x, y, threshold) {
  var best = -1, bd = threshold;
  for (var i = 0; i < walls.length; i++) {
    for (var j = 0; j + 1 < walls[i].points.length; j++) {
      var d = pointToSegmentDist(x, y, walls[i].points[j], walls[i].points[j + 1]);
      if (d < bd) { bd = d; best = i; }
    }
  }
  return best;
}

function pointToSegmentDist(x, y, a, b) {
  var dx = b.x - a.x, dy = b.y - a.y;
  var L2 = dx * dx + dy * dy;
  if (L2 < 1e-9) {
    var ex = x - a.x, ey = y - a.y;
    return Math.sqrt(ex * ex + ey * ey);
  }
  var t = ((x - a.x) * dx + (y - a.y) * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  var qx = a.x + t * dx, qy = a.y + t * dy;
  var ex = x - qx, ey = y - qy;
  return Math.sqrt(ex * ex + ey * ey);
}

// ---------- inlet handlers ----------
function drawmode(v) { drawMode = v ? 1 : 0; currentDraw = null; mgraphics.redraw(); }
function rate_ms(v) { rateMs = Math.max(10, v); }
function speed_px_s(v) { speedPxPerSec = Math.max(20, v); }
function max_bounces(v) { maxBounces = Math.max(1, Math.min(32, Math.round(v))); }
function clear_walls() { walls = []; selectedWall = -1; dumpGeometry(); mgraphics.redraw(); }
function delete_selected() {
  if (selectedWall >= 0 && selectedWall < walls.length) {
    walls.splice(selectedWall, 1);
    selectedWall = -1;
    dumpGeometry();
    mgraphics.redraw();
  }
}
function source_xy(x, y) { source.x = x; source.y = y; mgraphics.redraw(); }
function clear_particles() { particles = []; }

function emit_dir(deg) {
  emitAngleDeg = ((deg % 360) + 360) % 360;
  mgraphics.redraw();
}
function emit_spread(deg) {
  sweepDeg = Math.max(0, Math.min(360, deg));
  mgraphics.redraw();
}
function source_mode(n) {
  sourceMode = (n | 0);
  mgraphics.redraw();
}

// Global wall-mode placeholder until M4 brings a per-wall editor. Stamps the
// mode onto every existing wall and uses the new value as the default for any
// wall drawn afterward. Round-trips through the geometry pattr.
function wall_mode(n) {
  globalWallMode = (n | 0);
  var modeStr = modeStrFor(globalWallMode);
  for (var i = 0; i < walls.length; i++) {
    walls[i].mode = modeStr;
    ensureModFields(walls[i]);
  }
  dumpGeometry();
}

function midi_dur(ms) {
  midiDurMs = Math.max(10, Math.min(5000, ms | 0));
}

// ---------- M3d Map (Live API capture of the clicked parameter) ----------
// The Map button sends `map_arm 1` when armed / `map_arm 0` when off. We lazily
// create a LiveAPI observer on the Song view's selected_parameter — only on the
// first arm, when the Live API is guaranteed ready (this is why it lives here in
// JS and not in a patcher chain fired by loadbang: loadbang runs before the Live
// API exists, so the observer never armed). While armed, the next parameter the
// user clicks (whose id differs from what was selected at arm time) is captured
// and sent out outlet 1 as `map_target <id>` (the patcher prepends `id` and
// feeds live.remote~). `map_disarm` pops the Map button back off.
var mapArmed = false;
var selParamObs = null;
var armBaselineId = 0;

function map_arm(v) {
  mapArmed = (v != 0);
  if (!mapArmed) return;
  armBaselineId = currentSelParamId();
  if (selParamObs === null) {
    try {
      selParamObs = new LiveAPI(onSelParam, "live_set view");
      selParamObs.property = "selected_parameter";
    } catch (e) {
      post("bouncer.js: map observer create failed: " + e + "\n");
    }
  }
}

function currentSelParamId() {
  try {
    var view = new LiveAPI("live_set view");
    var sp = view.get("selected_parameter");
    if (sp === undefined || sp === null) return 0;
    return (sp instanceof Array) ? sp[sp.length - 1] : sp;
  } catch (e) {
    return 0;
  }
}

function onSelParam(args) {
  if (!mapArmed) return;
  var id = (args instanceof Array) ? args[args.length - 1] : args;
  if (typeof id !== "number" || id <= 0) return;
  if (id == armBaselineId) return;   // selection didn't change yet — keep waiting

  // Only DeviceParameter objects can be driven by live.remote~; a single click
  // can also fire this with non-parameter objects (e.g. a View), so verify type.
  var t = "";
  try { t = new LiveAPI("id " + id).type; } catch (e) { t = ""; }
  if (t !== "DeviceParameter") return;

  outlet(1, "map_target", id);
  mapArmed = false;
  outlet(1, "map_disarm");
}

// Called from patcher: [notein] → [pack] → prepend midi_note → v8ui inlet.
// notein emits the same pitch with velocity 0 for note-off, which we use to
// flip srcAlive on any in-flight MIDI particles whose snapshot pitch matches.
// Overlapping same-pitch note-ons aren't disambiguated — all matching live
// particles flip together. Good enough for v1.
function midi_note(pitch, vel) {
  if (vel > 0) {
    if (sourceMode === 1) emitParticle(nowMs(), pitch, vel, "midi");
    return;
  }
  for (var i = 0; i < particles.length; i++) {
    if (particles[i].snapshot && particles[i].snapshot.pitch === pitch) {
      particles[i].srcAlive = false;
    }
  }
  mgraphics.redraw();
}

// ---------- persistence ----------
// Wall layout flows out as: "geometry <safe-encoded-json>". JSON contains
// commas / quotes / braces that don't round-trip cleanly through Max's symbol
// serialization into the .als file, so encode to an alphanumeric-only form
// (digits + letters stay; everything else becomes _XX hex).
function safeEncode(s) {
  var out = "";
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122)) {
      out += s.charAt(i);
    } else {
      var hex = c.toString(16);
      if (hex.length < 2) hex = "0" + hex;
      out += "_" + hex;
    }
  }
  return out;
}

function safeDecode(s) {
  return s.replace(/_([0-9a-fA-F]{2})/g, function(m, h) {
    return String.fromCharCode(parseInt(h, 16));
  });
}

function dumpGeometry() {
  var snapshot = { source: source, nextWallId: nextWallId, walls: walls };
  outlet(0, "geometry", safeEncode(JSON.stringify(snapshot)));
}

function restore(payload) {
  try {
    if (payload === undefined || payload === null || payload === 0 || payload === "") return;
    var decoded = safeDecode(String(payload));
    var s = JSON.parse(decoded);
    if (s.source) source = s.source;
    if (typeof s.nextWallId === "number") nextWallId = s.nextWallId;
    if (s.walls && s.walls.length) {
      walls = s.walls;
      for (var i = 0; i < walls.length; i++) {
        if (!walls[i].mode) walls[i].mode = "audio";
        ensureModFields(walls[i]);
      }
    }
    mgraphics.redraw();
  } catch (e) {
    post("bouncer.js: restore failed: " + e.message + "\n");
  }
}

post("bouncer.js: loaded ok\n");
