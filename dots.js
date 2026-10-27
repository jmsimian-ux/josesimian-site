/*
  Dot field. One fixed canvas behind the page, redrawn every frame.
  Four scenes crossfade as you scroll:
    Intro       two flocks of dots, one per language, that weave through each other
    Experience  a Brooklyn skyline and bridge that rebuilds itself for each project
    About       a turning globe marking Utah, Santiago and Brooklyn (drawn white on the black section)
    Writing     an audio waveform that reacts to the cursor
  Everything is drawn as small dots, batched by opacity and color. Written for this site.
*/
(() => {
  const canvas = document.getElementById('field');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = getComputedStyle(document.documentElement);
  const tok = (n, f) => css.getPropertyValue(n).trim() || f;
  const WHITE = tok('--white', '#fff'), BLACK = tok('--black', '#000'), BLUE = tok('--blue', '#0064e6');

  const intro = document.getElementById('intro');
  const exp = document.getElementById('experience');
  const about = document.getElementById('about');
  const writing = document.getElementById('writing');
  const footer = document.querySelector('footer');
  const panelCount = Math.max(2, document.querySelectorAll('#track article.panel').length);

  const TAU = Math.PI * 2;
  const R = 1.25;                                    // dot radius
  let W = 0, H = 0, DPR = 1, wide = true, STOPS = [];

  const clamp01 = x => Math.min(1, Math.max(0, x));
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const ease = f => f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const fontF = () => '500 10px ' + getComputedStyle(document.body).fontFamily;

  // ---------- cursor: dots part around it and glide back ----------
  const mouse = { x: -9999, y: -9999 }, M = { x: -9999, y: -9999, k: 0 };
  const HOVER_R = 150, HOVER_F = 40;
  let PX = 0, PY = 0;
  function push(x, y) {
    PX = x; PY = y;
    if (reduce || M.k < 0.01) return;
    const dx = x - M.x, dy = y - M.y, d2 = dx * dx + dy * dy;
    if (d2 > HOVER_R * HOVER_R || d2 < 0.01) return;
    const d = Math.sqrt(d2), p = (0.5 + 0.5 * Math.cos(Math.PI * d / HOVER_R)) * HOVER_F * M.k;
    PX = x + dx / d * p; PY = y + dy / d * p;
  }

  // ---------- batching: one path per opacity step and color ----------
  const STEPS = 10;
  let paths = [], darkTop = 0, darkBot = 0;
  const resetPaths = () => { paths = new Array((STEPS + 1) * 3).fill(null); };
  function dot(x, y, r, a, blue) {
    if (a < 0.04) return;
    push(x, y);
    const onDark = PY > darkTop && PY < darkBot;
    const idx = Math.min(STEPS, Math.round(a * STEPS)) * 3 + (blue ? 2 : onDark ? 1 : 0);
    const p = paths[idx] || (paths[idx] = new Path2D());
    p.moveTo(PX + r, PY); p.arc(PX, PY, r, 0, TAU);
  }
  function flush() {
    for (let s = 1; s <= STEPS; s++) for (let c = 0; c < 3; c++) {
      const p = paths[s * 3 + c]; if (!p) continue;
      ctx.globalAlpha = s / STEPS; ctx.fillStyle = c === 2 ? BLUE : c === 1 ? WHITE : BLACK; ctx.fill(p);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- springs: points glide to their targets and assemble themselves on entry ----------
  function spring(p, tx, ty) {
    if (reduce) { p.px = tx; p.py = ty; return; }
    p.vx = (p.vx + (tx - p.px) * p.k) * 0.82; p.vy = (p.vy + (ty - p.py) * p.k) * 0.82;
    p.px += p.vx; p.py += p.vy;
  }
  function scatter(pts, cx, cy) {
    for (const p of pts) { const a = Math.random() * TAU, d = Math.max(W, H) * (0.25 + Math.random() * 0.5); p.px = cx + Math.cos(a) * d; p.py = cy + Math.sin(a) * d; p.vx = p.vy = 0; }
  }
  const stale = (scene, now) => { const s = now - scene.last > 400; scene.last = now; return s; };

  // =========================================================
  // 1 · Intro: two flocks, English in black and Spanish in blue
  // =========================================================
  const intro_ = { last: 0, built: null, A: [], B: [] };
  function buildFlocks() {
    seed = 5;
    const mk = (n, ox) => Array.from({ length: n }, () => ({ x: W * (wide ? 0.6 + rnd() * 0.3 : 0.3 + rnd() * 0.4) + ox, y: H * (wide ? 0.2 + rnd() * 0.5 : 0.1 + rnd() * 0.3), vx: rnd() - 0.5, vy: rnd() - 0.5, sz: 0.8 + rnd() * 0.7, conf: 0.8 + rnd() * 0.19 }));
    const n = wide ? 90 : 60;
    intro_.A = mk(n, 0); intro_.B = mk(n, 0); intro_.built = wide;
  }
  function stepFlock(F, tx, ty, step) {
    const max = 1.7, n = F.length;
    let cx = 0, cy = 0, ax = 0, ay = 0;
    for (const b of F) { cx += b.x; cy += b.y; ax += b.vx; ay += b.vy; }
    cx /= n; cy /= n; ax /= n; ay /= n;
    for (const b of F) {
      let sx = 0, sy = 0;
      for (const o of F) { if (o === b) continue; const dx = b.x - o.x, dy = b.y - o.y, d2 = dx * dx + dy * dy; if (d2 < 260 && d2 > 0.01) { sx += dx / d2; sy += dy / d2; } }
      b.vx += (ax - b.vx) * 0.04 + (cx - b.x) * 0.0006 + (tx - b.x) * 0.0007 + sx * 6 + (rnd() - 0.5) * 0.07;
      b.vy += (ay - b.vy) * 0.04 + (cy - b.y) * 0.0006 + (ty - b.y) * 0.0007 + sy * 6 + (rnd() - 0.5) * 0.07;
      if (M.k > 0.05) { const dx = b.x - M.x, dy = b.y - M.y, d2 = dx * dx + dy * dy; if (d2 < HOVER_R * HOVER_R && d2 > 1) { const d = Math.sqrt(d2); b.vx += dx / d * 0.5 * (1 - d / HOVER_R); b.vy += dy / d * 0.5 * (1 - d / HOVER_R); } }
      const sp = Math.hypot(b.vx, b.vy); if (sp > max) { b.vx *= max / sp; b.vy *= max / sp; }
      b.x += b.vx * step; b.y += b.vy * step;
    }
  }
  const introMask = (x, y) => wide ? smooth(W * 0.42, W * 0.58, x) : smooth(H * 0.6, H * 0.4, y);
  function drawIntro(t, dt, w, now) {
    if (intro_.built !== wide) buildFlocks();
    const step = reduce ? 0 : Math.min(3, dt * 60);
    const cx = wide ? W * 0.76 : W * 0.5, cy = wide ? H * 0.5 : H * 0.24, ax = wide ? W * 0.12 : W * 0.28, ay = wide ? H * 0.2 : H * 0.1;
    if (step) {
      stepFlock(intro_.A, cx + Math.cos(t * 0.2) * ax, cy + Math.sin(t * 0.4) * ay, step);
      stepFlock(intro_.B, cx + Math.cos(t * 0.2 + Math.PI) * ax, cy + Math.sin(t * 0.4 + 1.6) * ay, step);
    }
    for (const b of intro_.A) dot(b.x, b.y, R * b.sz, 0.9 * w * introMask(b.x, b.y), false);
    for (const b of intro_.B) dot(b.x, b.y, R * b.sz, 0.9 * w * introMask(b.x, b.y), true);
    return () => labels([[intro_.A[4], 'EN', false], [intro_.B[9], 'ES', true]], w, t);
  }
  function labels(list, w, t) {
    if (w < 0.05) return;
    ctx.font = fontF(); ctx.lineWidth = 1;
    list.forEach(([b, tag, blue], k) => {
      if (!b) return;
      const m = introMask(b.x, b.y); if (m < 0.6) return;
      push(b.x, b.y); const s = 11;
      ctx.globalAlpha = w; ctx.strokeStyle = ctx.fillStyle = blue ? BLUE : BLACK;
      ctx.strokeRect(PX - s, PY - s, s * 2, s * 2);
      ctx.fillText(tag + ' · ' + (b.conf + 0.01 * Math.sin(t * 3 + k)).toFixed(2), PX + s + 4, PY - s + 8);
    });
    ctx.globalAlpha = 1;
  }

  // =========================================================
  // 2 · Experience: skyline and bridge, rebuilt for each project
  // =========================================================
  const sky = { last: 0, built: null, cols: [], pts: [], bridge: [], HT: [] };
  const SP = 9;                                          // dot spacing
  function buildSky() {
    seed = 21;
    const n = wide ? 46 : 26;
    sky.n = n; sky.J = 22;
    sky.HT = Array.from({ length: panelCount }, () => Array.from({ length: n }, () => 0.18 + Math.pow(rnd(), 1.6) * 0.82));
    sky.pts = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < sky.J; j++) sky.pts.push({ i, j, px: 0, py: 0, vx: 0, vy: 0, k: 0.05 + Math.random() * 0.04 });
    sky.bridge = Array.from({ length: wide ? 190 : 110 }, (_, q) => ({ q, px: 0, py: 0, vx: 0, vy: 0, k: 0.04 + Math.random() * 0.04 }));
    sky.built = wide;
  }
  function drawSky(t, dt, w, now) {
    if (sky.built !== wide) buildSky();
    if (stale(sky, now)) { scatter(sky.pts, W * 0.5, H * 0.3); scatter(sky.bridge, W * 0.5, H * 0.3); }
    const f = clamp01(window.expProgress || 0) * (panelCount - 1);
    const i0 = Math.min(panelCount - 1, Math.floor(f)), i1 = Math.min(panelCount - 1, i0 + 1), fr = smooth(0.35, 0.65, f - i0);
    const by = H * (wide ? 0.33 : 0.3), maxH = H * (wide ? 0.17 : 0.15), x0 = W * 0.04, x1 = W * 0.96;
    const colW = (x1 - x0) / (sky.n - 1);
    for (const p of sky.pts) {
      const h = (sky.HT[i0][p.i] + (sky.HT[i1][p.i] - sky.HT[i0][p.i]) * fr) * maxH;
      const a = clamp01((h - p.j * SP) / SP + 0.2);
      spring(p, x0 + p.i * colW, by - p.j * SP);
      dot(p.px, p.py, R * 0.85, a * 0.55 * w, false);
    }
    // bridge: two towers, a deck, and three cable spans, all in blue
    const t1 = W * 0.34, t2 = W * 0.66, top = by - maxH * 1.25, deck = by - maxH * 0.3, nb = sky.bridge.length;
    sky.bridge.forEach(p => {
      const u = p.q / nb; let x, y;
      if (u < 0.24) { const s = Math.min(0.9999, u / 0.24) * 4, line = Math.floor(s); x = [t1 - 7, t1 + 7, t2 - 7, t2 + 7][line]; y = by - (s - line) * (by - top); }
      else if (u < 0.34) { const s = (u - 0.24) / 0.1; x = t1 + (t2 - t1) * s; y = deck; }
      else if (u < 0.5) { const s = (u - 0.34) / 0.16; x = x0 + (t1 - x0) * s; y = by - (by - top) * Math.pow(s, 1.6); }
      else if (u < 0.75) { const s = (u - 0.5) / 0.25; x = t1 + (t2 - t1) * s; y = top + (deck - top) * 0.55 * 4 * s * (1 - s); }
      else { const s = (u - 0.75) / 0.25; x = t2 + (x1 - t2) * s; y = top + (by - top) * Math.pow(s, 0.6); }
      spring(p, x, y);
      dot(p.px, p.py, R * 1.05, 0.95 * w, true);
    });
    return () => {
      if (w < 0.05) return;
      ctx.font = fontF(); ctx.globalAlpha = 0.6 * w; ctx.fillStyle = BLACK;
      push(x0, by + 18); ctx.fillText('BROOKLYN · 40.7N 74.0W', PX, PY); ctx.globalAlpha = 1;
    };
  }

  // =========================================================
  // 3 · About: a slow globe, drawn white on the black section
  // =========================================================
  const globe = { n: 0, pts: [], t0: -1, last: 0 };
  const latlon = (la, lo) => { const A = la * Math.PI / 180, B = lo * Math.PI / 180; return { x: Math.cos(A) * Math.cos(B), y: -Math.sin(A), z: Math.cos(A) * Math.sin(B) }; };
  const SITES = [
    { p: latlon(40.8, 248), name: 'UTAH', loc: '40.8N 111.9W', dx: -70, dy: -50 },
    { p: latlon(-33.4, 289), name: 'SANTIAGO', loc: '33.4S 70.7W', dx: 60, dy: 52 },
    { p: latlon(40.7, 286), name: 'BROOKLYN', loc: '40.7N 74.0W', dx: 64, dy: -48 },
  ];
  function rot(p, ry, rx) {
    let { x, y, z } = p;
    const cy = Math.cos(ry), sy = Math.sin(ry), x1 = x * cy + z * sy; z = -x * sy + z * cy; x = x1;
    const cx = Math.cos(rx), sx = Math.sin(rx), y1 = y * cx - z * sx; z = y * sx + z * cx; y = y1;
    return { x, y, z };
  }
  function drawGlobe(t, dt, w, now) {
    const n = wide ? 2200 : 1300;
    if (globe.n !== n) {
      const ga = Math.PI * (3 - Math.sqrt(5));
      globe.pts = Array.from({ length: n }, (_, i) => { const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), a = ga * i; return { x: Math.cos(a) * r, y, z: Math.sin(a) * r }; });
      globe.n = n;
    }
    if (stale(globe, now)) globe.t0 = t;
    const yaw = 3.7 + (t - globe.t0) * 0.07, tilt = 0.25;          // starts with the Americas facing out
    const ox = wide ? W * 0.8 : W * 0.5, oy = wide ? H * 0.5 : H * 0.27;
    const Rg = wide ? Math.min(W * 0.16, H * 0.3) : Math.min(W * 0.34, H * 0.19);
    const P = v => { const k = 3 / (3 - v.z); return [ox + v.x * Rg * k, oy + v.y * Rg * k, k]; };
    const m = x => wide ? smooth(W * 0.58, W * 0.66, x) : 1;
    for (const p of globe.pts) {
      const v = rot(p, yaw, tilt), [x, y, k] = P(v);
      dot(x, y, R * 0.8 * k, (v.z > 0 ? 0.3 + 0.7 * v.z : 0.1) * m(x) * w, false);
    }
    const sites = SITES.map(s => { const v = rot(s.p, yaw, tilt), [x, y] = P(v); return { ...s, x, y, vis: smooth(0.0, 0.25, v.z) * m(x) * w }; });
    return () => {
      ctx.font = fontF(); ctx.lineWidth = 1;
      sites.forEach(s => {
        if (s.vis < 0.03) return;
        push(s.x, s.y); const b = 8, c = 4;
        ctx.globalAlpha = s.vis; ctx.strokeStyle = BLUE; ctx.beginPath();
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v]) => { ctx.moveTo(PX + u * b, PY + v * (b - c)); ctx.lineTo(PX + u * b, PY + v * b); ctx.lineTo(PX + u * (b - c), PY + v * b); });
        ctx.stroke();
        ctx.strokeStyle = WHITE; ctx.globalAlpha = s.vis * 0.7; ctx.beginPath(); ctx.moveTo(PX, PY); ctx.lineTo(PX + s.dx, PY + s.dy); ctx.lineTo(PX + s.dx + (s.dx < 0 ? -90 : 90), PY + s.dy); ctx.stroke();
        const tx = PX + s.dx + (s.dx < 0 ? -86 : 4);
        ctx.globalAlpha = s.vis; ctx.fillStyle = WHITE; ctx.fillText(s.name, tx, PY + s.dy - 6); ctx.fillStyle = BLUE; ctx.fillText(s.loc, tx, PY + s.dy + 14);
      });
      ctx.globalAlpha = 1;
    };
  }

  // =========================================================
  // 4 · Writing & Media: a waveform that rises toward the cursor
  // =========================================================
  const wave = { last: 0, built: null, pts: [] };
  function buildWave() {
    const cols = wide ? 72 : 38, K = 9;
    wave.cols = cols; wave.K = K; wave.pts = [];
    for (let i = 0; i < cols; i++) for (let j = -K; j <= K; j++) wave.pts.push({ i, j, px: 0, py: 0, vx: 0, vy: 0, k: 0.05 + Math.random() * 0.05 });
    wave.built = wide;
  }
  function drawWave(t, dt, w, now) {
    if (wave.built !== wide) buildWave();
    if (stale(wave, now)) scatter(wave.pts, W * 0.5, H * 0.9);
    const x0 = W * 0.05, x1 = W * 0.95, colW = (x1 - x0) / (wave.cols - 1), sp = 7;
    // keep the wave above the footer so it never sits on the contact copy
    const cy = Math.min(H * (wide ? 0.86 : 0.88), footer.getBoundingClientRect().top - sp * wave.K - 40);
    const amp = new Array(wave.cols);
    for (let i = 0; i < wave.cols; i++) {
      const u = i / (wave.cols - 1), env = 0.35 + 0.65 * Math.sin(u * Math.PI);
      let a = (Math.sin(u * 14 + t * 1.3) + Math.sin(u * 27 - t * 0.9) * 0.6 + Math.sin(u * 5 + t * 0.5) * 0.8) / 2.4;
      a = Math.abs(a) * env;
      if (M.k > 0.05) a += Math.exp(-Math.pow((x0 + i * colW - M.x) / 120, 2)) * 0.55 * M.k;
      amp[i] = Math.min(1, a) * sp * wave.K;
    }
    for (const p of wave.pts) {
      spring(p, x0 + p.i * colW, cy + p.j * sp);
      const a = clamp01((amp[p.i] - Math.abs(p.j) * sp) / sp + 0.3);
      dot(p.px, p.py, R * 0.9, (p.j === 0 ? 0.9 : a * 0.85) * w, false);
    }
    return () => {
      if (w < 0.05) return;
      ctx.font = fontF(); ctx.globalAlpha = 0.6 * w; ctx.fillStyle = BLACK;
      ctx.fillText('AUDIO · 44.1 KHZ', x0, cy + sp * wave.K + 22); ctx.globalAlpha = 1;
    };
  }

  const SCENES = [drawIntro, drawSky, drawGlobe, drawWave];

  // ---------- scroll position -> which two scenes, and how far between them ----------
  function buildStops() {
    const mid = el => el.offsetTop + el.offsetHeight / 2, hold = H * 0.15;
    const travel = Math.max(0, exp.offsetHeight - H);
    STOPS = [
      { a: mid(intro) - hold, b: mid(intro) + hold },
      { a: exp.offsetTop + H * 0.1, b: exp.offsetTop + travel + H * 0.6 },
      { a: mid(about) - hold, b: mid(about) + hold },
      { a: mid(writing) - hold, b: mid(writing) + hold },
    ];
    for (let i = 1; i < STOPS.length; i++) if (STOPS[i].a < STOPS[i - 1].b) STOPS[i].a = STOPS[i - 1].b + 1;
  }
  function scrollState() {
    const m = scrollY + H / 2;
    if (m <= STOPS[0].b) return [0, 0, 0];
    for (let i = 1; i < STOPS.length; i++) {
      if (m < STOPS[i].a) return [i - 1, i, (m - STOPS[i - 1].b) / (STOPS[i].a - STOPS[i - 1].b)];
      if (m <= STOPS[i].b) return [i, i, 0];
    }
    const L = STOPS.length - 1; return [L, L, 0];
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight; wide = W > 760;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildStops();
    if (reduce) frame(performance.now());
  }

  let T = 4, lastNow = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - (lastNow || now)) / 1000); lastNow = now;
    if (!reduce) T += dt;
    M.x += (mouse.x - M.x) * 0.2; M.y += (mouse.y - M.y) * 0.2; M.k += ((mouse.x > -9000 ? 1 : 0) - M.k) * 0.08;
    ctx.clearRect(0, 0, W, H);
    // the black About section is painted here so the dots stay visible over it
    const rr = about.getBoundingClientRect();
    darkTop = Math.max(0, rr.top); darkBot = Math.min(H, rr.bottom);
    if (darkBot > darkTop) { ctx.fillStyle = BLACK; ctx.fillRect(0, darkTop, W, darkBot - darkTop); }
    const [from, to, f] = scrollState(), e = ease(clamp01(f));
    const weights = [0, 0, 0, 0]; weights[from] += 1 - e; weights[to] += e;
    resetPaths();
    const overlays = [];
    weights.forEach((wgt, i) => { if (wgt > 0.01) { const o = SCENES[i](T, dt, wgt, now); if (o) overlays.push(o); } });
    flush();
    overlays.forEach(o => o());
    if (!reduce) requestAnimationFrame(frame);
  }

  addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  document.addEventListener('pointerout', e => { if (!e.relatedTarget) mouse.x = mouse.y = -9999; });
  addEventListener('resize', resize);
  if (reduce) addEventListener('scroll', () => frame(performance.now()), { passive: true });
  document.documentElement.classList.add('has-dots');
  resize();
  if (!reduce) requestAnimationFrame(frame);
  if (document.fonts) document.fonts.ready.then(resize, () => {});
})();
