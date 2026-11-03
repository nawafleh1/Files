/* Setter dot engine. No photographs: every dog on the site is built from dots.
   Hero: a field of floating dots assembles into the setter as you scroll.
   Figures (inner heroes, the head orb): dots gather into the dog when it comes into view.
   Footer: the wordmark assembles from dots. CTA: a slow drifting dot field. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  var DPR = Math.min(2, window.devicePixelRatio || 1);
  var ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  var BONE = [232, 229, 221], JADE = [163, 209, 184], POINTER = [233, 215, 108];
  var TAU = Math.PI * 2;
  var CODE = {};
  for (var z = 0; z < ALPHA.length; z++) CODE[ALPHA.charCodeAt(z)] = z;

  function sat(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(v) { v = sat(v); return v * v * (3 - 2 * v); }
  function inOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function outExpo(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function fmtInt(n) { return Math.round(n).toLocaleString('en-US'); }
  function onVisible(el, cb, margin) {
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    new IntersectionObserver(function (es) { es.forEach(function (e) { cb(e.isIntersecting); }); }, { rootMargin: margin || '120px' }).observe(el);
  }
  function pointerOver(el, pad) {
    var state = { m: null };
    window.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      state.m = x > -pad && y > -pad && x < r.width + pad && y < r.height + pad ? { x: x, y: y } : null;
    }, { passive: true });
    document.addEventListener('pointerleave', function () { state.m = null; });
    return state;
  }

  /* ---------- batched drawing: colour slots bone (0), jade (1), pointer (2) x 11 alpha steps ---------- */
  var BASES = [BONE, JADE, POINTER], AL = 11, styles = [];
  function key(ci, a) { return ci * AL + Math.round(sat(a) * 10); }
  function style(k) {
    if (!styles[k]) { var ai = k % AL, c = BASES[(k - ai) / AL]; styles[k] = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + ai / 10 + ')'; }
    return styles[k];
  }
  function Batch() { this.used = []; this.buf = []; }
  Batch.prototype.add = function (k, x, y, r) {
    var b = this.buf[k] || (this.buf[k] = []);
    if (!b.length) this.used.push(k);
    b.push(x, y, r);
  };
  Batch.prototype.flush = function (ctx) {
    for (var i = 0; i < this.used.length; i++) {
      var k = this.used[i], arr = this.buf[k];
      if (k % AL) {
        ctx.fillStyle = style(k);
        ctx.beginPath();
        for (var j = 0; j < arr.length; j += 3) {
          var x = arr[j], y = arr[j + 1], r = arr[j + 2];
          if (r < 1.1) ctx.rect(x - r, y - r, r * 2, r * 2);
          else { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
        }
        ctx.fill();
      }
      arr.length = 0;
    }
    this.used.length = 0;
  };

  /* ---------- dot figures sampled from the photos (shape and shading only) ---------- */
  function Fig(F) {
    this.F = F;
    var lum = F.pal.map(function (c) { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; });
    this.alpha = lum.map(function (L) { var t = smooth((L - F.lo) / (F.hi - F.lo)); return 0.16 + 0.84 * t; });
  }
  // Points at step k, in image pixels: [x, y, alpha, ...]
  Fig.prototype.sample = function (k) {
    var F = this.F, out = [], h = Math.floor(k / 2), P = F.p;
    var gr0 = Math.floor(F.r0 / k), gr1 = Math.ceil((F.r0 + F.rows) / k);
    var gc0 = Math.floor(F.c0 / k), gc1 = Math.ceil((F.c0 + F.cols) / k);
    for (var GR = gr0; GR < gr1; GR++) {
      for (var GC = gc0; GC < gc1; GC++) {
        var r = GR * k + h - F.r0, c = GC * k + h - F.c0;
        if (r < 0 || c < 0 || r >= F.rows || c >= F.cols) continue;
        var code = F.d.charCodeAt(r * F.cols + c);
        if (code === 46) continue;
        out.push((GC * k + k / 2) * P, (GR * k + k / 2) * P, this.alpha[CODE[code]]);
      }
    }
    return out;
  };
  Fig.prototype.bbox = function () { var F = this.F; return { x: F.c0 * F.p, y: F.r0 * F.p, w: F.cols * F.p, h: F.rows * F.p }; };

  /* ---------- hero: floating dots assemble into the setter on scroll ---------- */
  var PHASES = [[0, 'Raw market'], [0.08, 'Enriching'], [0.32, 'Mapping'], [0.52, 'Scoring'], [0.66, 'Live']];

  function HeroDog(stage, fig) {
    var box = stage.querySelector('.stage-photo');
    var scroller = stage.closest('.dog-scroll');
    if (!box || !scroller) return;
    var cv = document.createElement('canvas');
    cv.className = 'dog-canvas';
    cv.setAttribute('aria-hidden', 'true');
    box.appendChild(cv);
    var ctx = cv.getContext('2d'), batch = new Batch();
    var hudNum = stage.querySelector('[data-hud-num]'), hudPhase = stage.querySelector('[data-hud-phase]'), hudBar = stage.querySelector('[data-hud-bar]');
    var caps = [].slice.call(stage.querySelectorAll('.stage-caps .left .br'));
    var scrubs = [].slice.call(stage.querySelectorAll('[data-scrub]'));
    var gauge = stage.querySelector('.stage-cards .gauge');
    var cardWrap = stage.querySelector('.stage-cards');
    var cardEls = [].slice.call(stage.querySelectorAll('.stage-cards > *'));

    var W = 0, H = 0, mobile = false, pitch = 10, N = 0, M = 0;
    var tx, ty, sx, sy, sz, dl, la, ph, bend, ox, oy, px, py, dust;
    var nose = { x: 0, y: 0 }, beam = null, stTop = 0, stH = 0;
    var pT = 0, p = 0, mouse = null, running = false, started = false, t0 = performance.now(), lastHud = -1, lastPhase = '';

    function layout() {
      mobile = window.innerWidth <= 1024;
      W = box.clientWidth; H = box.clientHeight;
      if (!W || !H) return;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      // the region the dog fits into: left of the readouts on desktop, the whole frame on phones
      var rx0 = W * 0.05, rx1 = W * 0.95, ry0 = H * (mobile ? 0.2 : 0.15), ry1 = H * (mobile ? 0.9 : 0.86);
      if (!mobile && cardWrap) {
        var br0 = box.getBoundingClientRect(), cr0 = cardWrap.getBoundingClientRect();
        rx1 = cr0.left - br0.left - W * 0.05;
      }
      var bb = fig.bbox();
      var s = Math.min((rx1 - rx0) / bb.w, (ry1 - ry0) / bb.h);
      var ox0 = rx1 - bb.w * s - bb.x * s, oy0 = (ry0 + ry1) / 2 - (bb.h * s) / 2 - bb.y * s;
      var want = mobile ? 5.6 : clamp(W / 140, 7.5, 10.5);
      var k = Math.max(1, Math.round(want / (fig.F.p * s)));
      pitch = fig.F.p * k * s;
      var pts = fig.sample(k), R = rng(11);
      N = pts.length / 3;
      M = Math.round(N * 0.35); // free-floating dust that never lands
      var T = N + M;
      tx = new Float32Array(T); ty = new Float32Array(T); sx = new Float32Array(T); sy = new Float32Array(T);
      sz = new Float32Array(T); dl = new Float32Array(T); la = new Float32Array(T); ph = new Float32Array(T);
      bend = new Float32Array(T); ox = new Float32Array(T); oy = new Float32Array(T); px = new Float32Array(T); py = new Float32Array(T);
      var minX = 1e9, maxX = -1e9, cx = 0, cy = 0, ni = 0, i;
      for (i = 0; i < N; i++) {
        tx[i] = ox0 + pts[i * 3] * s; ty[i] = oy0 + pts[i * 3 + 1] * s; la[i] = pts[i * 3 + 2];
        if (tx[i] < minX) minX = tx[i];
        if (tx[i] > maxX) { maxX = tx[i]; ni = i; }
        cx += tx[i]; cy += ty[i];
      }
      cx /= N; cy /= N;
      nose.x = tx[ni]; nose.y = ty[ni];
      for (i = 0; i < T; i++) {
        if (i < N) {
          var nx = (tx[i] - minX) / Math.max(1, maxX - minX);
          dl[i] = 0.3 * (0.7 * (1 - nx) + 0.3 * R());
        }
        if (i >= N || R() < 0.62) {
          sx[i] = (R() * 1.08 - 0.04) * W;
          sy[i] = (R() * 1.08 - 0.04) * H;
        } else {
          var ang = R() * TAU, rad = (0.35 + R() * 0.7) * Math.max(W, H) * 0.5;
          sx[i] = cx + Math.cos(ang) * rad; sy[i] = cy + Math.sin(ang) * rad * 0.7;
        }
        if (i >= N) { tx[i] = sx[i]; ty[i] = sy[i]; la[i] = 0.25 + R() * 0.4; }
        sz[i] = 0.4 + R() * R() * 2.4;
        ph[i] = R() * TAU;
        bend[i] = (R() - 0.5) * 2 * (40 + R() * 160);
        px[i] = -1e4; py[i] = -1e4;
      }
      beam = null;
      if (!mobile && cardWrap) {
        var br = box.getBoundingClientRect(), cr = cardWrap.getBoundingClientRect();
        var bx = cr.left - br.left - 14;
        if (bx > nose.x + 30) beam = { x: bx, y: clamp(nose.y, cr.top - br.top + 30, cr.bottom - br.top - 30) };
      }
    }

    function size() {
      var vh = window.innerHeight, hdr = document.querySelector('.site-header'), hh = hdr ? hdr.offsetHeight : 70;
      stH = stage.offsetHeight;
      stTop = Math.max(hh + 4, (vh - stH) / 2 + hh / 2);
      stage.style.top = Math.round(stTop) + 'px';
      scroller.style.height = Math.round(stH + vh * (mobile ? 1.2 : 1.35)) + 'px';
    }
    function readScroll() {
      var rect = scroller.getBoundingClientRect(), vh = window.innerHeight, y = window.scrollY, docTop = rect.top + y;
      var a = Math.max(0, docTop - vh * 0.72), b = docTop - stTop + (rect.height - stH);
      pT = sat((y - a) / Math.max(1, b - a));
    }

    function frame(now) {
      if (!running) { started = false; return; }
      requestAnimationFrame(frame);
      var t = now - t0;
      p += (pT - p) * 0.09;
      if (Math.abs(pT - p) < 0.0004) p = pT;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var live = smooth((p - 0.62) / 0.12), dustFade = 1 - smooth((p - 0.3) / 0.35) * 0.75;
      var rb = pitch * 0.36, landed = 0, T = N + M;
      var scanX = live > 0 ? ((t * 0.00021) % 1.5 - 0.25) * W : -1e5;
      var mx = mouse ? mouse.x : -1e5, my = mouse ? mouse.y : -1e5, MR = mobile ? 64 : 120, MR2 = MR * MR;
      ctx.beginPath();
      var trails = 0;
      for (var i = 0; i < T; i++) {
        var x, y, r, c = 0, a;
        var isDog = i < N, e0 = isDog ? sat((p - 0.04 - dl[i]) / 0.32) : 0, e = inOut(e0);
        if (e0 >= 1) { x = tx[i]; y = ty[i]; landed++; }
        else {
          var ddx = tx[i] - sx[i], ddy = ty[i] - sy[i], len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
          var bb = Math.sin(Math.PI * e) * bend[i];
          x = sx[i] + ddx * e - (ddy / len) * bb;
          y = sy[i] + ddy * e + (ddx / len) * bb;
          var amp = (1 - e) * 10 * sz[i];
          x += Math.sin(t * 0.0004 + ph[i]) * amp;
          y += Math.cos(t * 0.00033 + ph[i] * 1.7) * amp;
        }
        var gx = 0, gy = 0, qx = x - mx, qy = y - my, d2 = qx * qx + qy * qy;
        if (d2 < MR2) { var d = Math.sqrt(d2) || 1, f = 1 - d / MR; f = f * f * 30; gx = (qx / d) * f; gy = (qy / d) * f; }
        ox[i] += (gx - ox[i]) * 0.13; oy[i] += (gy - oy[i]) * 0.13;
        x += ox[i]; y += oy[i];
        if (!isDog) {
          r = rb * sz[i] * 0.8;
          a = la[i] * dustFade * (0.6 + 0.4 * Math.sin(t * 0.0012 + ph[i] * 9));
        } else if (e0 < 1) {
          r = rb * (sz[i] + (1 - sz[i]) * e);
          a = (0.3 + 0.55 * e) * (sz[i] > 1.7 ? 0.55 : 1);
          if (e > 0.8) a = a + (la[i] - a) * ((e - 0.8) / 0.2);
          var vx = x - px[i], vy = y - py[i], v2 = vx * vx + vy * vy;
          if (px[i] > -1e3 && v2 > 4 && v2 < 9000) { ctx.moveTo(x, y); ctx.lineTo(x - vx * 2.4, y - vy * 2.4); trails++; }
        } else {
          r = rb; a = la[i];
          if (live > 0) {
            var sd = Math.abs(x - scanX);
            if (sd < 50) { var g = 1 - sd / 50; if (g > 0.6) c = 1; a = Math.min(1, a + g * 0.7 * live); }
            if (Math.sin(t * 0.0019 * (0.6 + ph[i] * 0.07) + ph[i] * 37) > 0.9965) { c = i % 3 ? 1 : 2; a = live; r = rb * 1.3; }
          }
        }
        if (Math.abs(ox[i]) + Math.abs(oy[i]) > 2.5) { c = 1; a = Math.max(a, 0.9); }
        px[i] = x; py[i] = y;
        batch.add(key(c, a), x, y, r);
      }
      if (trails) { ctx.strokeStyle = 'rgba(232,229,221,0.16)'; ctx.lineWidth = Math.max(1, rb * 0.8); ctx.lineCap = 'round'; ctx.stroke(); }
      batch.flush(ctx);

      if (live > 0.01) {
        var pulse = 1 + Math.sin(t * 0.004) * 0.25, gr = pitch * 4 * pulse;
        var grad = ctx.createRadialGradient(nose.x, nose.y, 0, nose.x, nose.y, gr);
        grad.addColorStop(0, 'rgba(233,215,108,' + 0.55 * live + ')');
        grad.addColorStop(1, 'rgba(233,215,108,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(nose.x, nose.y, gr, 0, TAU); ctx.fill();
        if (beam) {
          var gap = pitch * 1.3, n = Math.max(2, Math.floor((beam.x - nose.x) / gap)), flow = (t * 0.0007) % 1;
          for (var j = 0; j < n; j++) {
            var u = (j + flow) / n;
            batch.add(key(j % 4 === 0 ? 2 : 1, live * (0.25 + 0.75 * Math.sin(Math.PI * u))), nose.x + (beam.x - nose.x) * u, nose.y + (beam.y - nose.y) * u, rb * 0.7);
          }
          batch.flush(ctx);
        }
      }

      if (landed !== lastHud) {
        lastHud = landed;
        if (hudNum) hudNum.textContent = fmtInt(landed);
        if (hudBar) hudBar.style.setProperty('--w', (landed / Math.max(1, N) * 100).toFixed(1) + '%');
      }
      var phase = PHASES[0][1];
      for (var q = 0; q < PHASES.length; q++) if (p >= PHASES[q][0]) phase = PHASES[q][1];
      if (phase !== lastPhase) { lastPhase = phase; if (hudPhase) hudPhase.textContent = phase; }
      for (q = 0; q < caps.length; q++) caps[q].classList.toggle('is-on', p >= 0.05 + q * 0.14);
      for (q = 0; q < scrubs.length; q++) {
        var el = scrubs[q], from = +(el.getAttribute('data-from') || 0), to = +el.getAttribute('data-to');
        var v = from + (to - from) * smooth((p - 0.42 - q * 0.04) / 0.28);
        var txt = el.getAttribute('data-fmt') === 'time' ? Math.floor(v / 60) + ':' + ('0' + Math.floor(v % 60)).slice(-2) : fmtInt(v);
        if (el.textContent !== txt) el.textContent = txt;
      }
      if (gauge) gauge.style.setProperty('--g', (8 + 62 * smooth((p - 0.42) / 0.3)).toFixed(1) + '%');
      if (!mobile) {
        for (q = 0; q < cardEls.length; q++) {
          var cq = smooth((p - 0.36 - q * 0.05) / 0.16);
          cardEls[q].style.opacity = cq.toFixed(3);
          cardEls[q].style.transform = 'translate3d(' + ((1 - cq) * 40).toFixed(1) + 'px,0,0) scale(' + (0.94 + 0.06 * cq).toFixed(3) + ')';
        }
      } else if (cardEls.length && cardEls[0].style.opacity) {
        cardEls.forEach(function (c2) { c2.style.opacity = ''; c2.style.transform = ''; });
      }
    }

    function start() { if (!started && running) { started = true; requestAnimationFrame(frame); } }
    layout(); size(); readScroll();
    p = pT;
    stage.classList.add('is-digital');
    onVisible(scroller, function (v) { running = v; start(); });
    running = true; start();
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { layout(); size(); readScroll(); }, 120); });
    window.addEventListener('scroll', readScroll, { passive: true });
    stage.addEventListener('pointermove', function (e) { var r = box.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
    stage.addEventListener('pointerleave', function () { mouse = null; });
  }

  /* ---------- figures: dots gather into a dog when it comes into view ---------- */
  // opts.fit: 'contain' fits the figure's bounds; 'image' maps the source photo's frame onto the box.
  function Figure(host, fig, opts) {
    var cv = document.createElement('canvas');
    cv.className = opts.cls || 'fig-canvas';
    cv.setAttribute('aria-hidden', 'true');
    host.appendChild(cv);
    host.classList.add('has-dots');
    var ctx = cv.getContext('2d'), batch = new Batch(), ptr = pointerOver(cv, 100);
    var W, H, N, tx, ty, sx, sy, dl, la, ph, ox, oy, rb, nose = { x: 0, y: 0 }, running = false, started = false, t0 = 0;
    function layout() {
      W = cv.clientWidth; H = cv.clientHeight;
      if (!W || !H) return;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      var s, offX, offY, bb = fig.bbox();
      if (opts.fit === 'image') { s = Math.max(W / fig.F.iw, H / fig.F.ih); offX = (W - fig.F.iw * s) / 2; offY = (H - fig.F.ih * s) / 2; }
      else { s = Math.min(W / bb.w, H / bb.h); offX = (W - bb.w * s) / 2 - bb.x * s; offY = (H - bb.h * s) / 2 - bb.y * s; }
      var k = Math.max(1, Math.round((opts.pitch || 7) / (fig.F.p * s)));
      var pts = fig.sample(k), R = rng(opts.seed || 5);
      N = pts.length / 3;
      rb = fig.F.p * k * s * 0.36;
      tx = new Float32Array(N); ty = new Float32Array(N); sx = new Float32Array(N); sy = new Float32Array(N);
      dl = new Float32Array(N); la = new Float32Array(N); ph = new Float32Array(N); ox = new Float32Array(N); oy = new Float32Array(N);
      var maxX = -1e9;
      for (var i = 0; i < N; i++) {
        tx[i] = offX + pts[i * 3] * s; ty[i] = offY + pts[i * 3 + 1] * s; la[i] = pts[i * 3 + 2];
        if (tx[i] > maxX) { maxX = tx[i]; nose.x = tx[i]; nose.y = ty[i]; }
      }
      for (i = 0; i < N; i++) {
        var ang = R() * TAU, dist = 0.35 + R() * 0.9;
        sx[i] = W / 2 + Math.cos(ang) * W * dist; sy[i] = H / 2 + Math.sin(ang) * H * dist;
        dl[i] = (1 - tx[i] / W) * 0.55 + R() * 0.35;
        ph[i] = R() * TAU;
      }
    }
    function frame(now) {
      if (!running) { started = false; return; }
      requestAnimationFrame(frame);
      if (!t0) t0 = now;
      var t = (now - t0) / 1000, MR = 80, MR2 = MR * MR, m = ptr.m;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var scanX = ((t * 0.22) % 1.6 - 0.3) * W;
      for (var i = 0; i < N; i++) {
        var e = outExpo(sat((t - 0.1 - dl[i]) / 1.3));
        var x = sx[i] + (tx[i] - sx[i]) * e, y = sy[i] + (ty[i] - sy[i]) * e;
        var amp = (1 - e) * 6;
        x += Math.sin(t * 0.5 + ph[i]) * amp; y += Math.cos(t * 0.4 + ph[i]) * amp;
        var gx = 0, gy = 0;
        if (m) {
          var qx = x - m.x, qy = y - m.y, d2 = qx * qx + qy * qy;
          if (d2 < MR2) { var d = Math.sqrt(d2) || 1, f = 1 - d / MR; f = f * f * 22; gx = (qx / d) * f; gy = (qy / d) * f; }
        }
        ox[i] += (gx - ox[i]) * 0.14; oy[i] += (gy - oy[i]) * 0.14;
        x += ox[i]; y += oy[i];
        var c = 0, a = la[i] * (0.25 + 0.75 * e);
        if (e > 0.98) {
          var sd = Math.abs(x - scanX);
          if (sd < 34) { var g = 1 - sd / 34; if (g > 0.6) c = 1; a = Math.min(1, a + g * 0.6); }
          if (Math.sin(t * 1.9 * (0.6 + ph[i] * 0.07) + ph[i] * 37) > 0.996) { c = i % 3 ? 1 : 2; a = 1; }
        }
        if (Math.abs(ox[i]) + Math.abs(oy[i]) > 2) { c = 1; a = Math.max(a, 0.95); }
        batch.add(key(c, a), x, y, rb);
      }
      batch.flush(ctx);
      var glow = sat((t - 1.6) / 0.6);
      if (glow > 0 && opts.nose !== false) {
        var pr = rb * 9 * (1 + Math.sin(t * 4) * 0.2);
        var gr = ctx.createRadialGradient(nose.x, nose.y, 0, nose.x, nose.y, pr);
        gr.addColorStop(0, 'rgba(233,215,108,' + 0.5 * glow + ')'); gr.addColorStop(1, 'rgba(233,215,108,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(nose.x, nose.y, pr, 0, TAU); ctx.fill();
      }
    }
    function start() { if (!started && running) { started = true; requestAnimationFrame(frame); } }
    layout();
    onVisible(cv, function (v) { running = v; start(); }, '-8% 0px');
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(layout, 150); });
  }

  /* ---------- footer: the wordmark assembles from dots ---------- */
  function DotWord(el) {
    var text = (el.textContent || '').trim();
    var cv = document.createElement('canvas');
    cv.className = 'giant-canvas';
    cv.setAttribute('aria-hidden', 'true');
    el.appendChild(cv);
    var ctx = cv.getContext('2d'), batch = new Batch(), ptr = pointerOver(cv, 120);
    var W, H, N = 0, tx, ty, sx, sy, dl, ph, ox, oy, rb, running = false, started = false, t0 = 0;
    function layout() {
      var fs = parseFloat(getComputedStyle(el).fontSize), ls = -0.07 * fs;
      W = el.clientWidth; H = Math.round(el.clientHeight + fs * 0.32);
      cv.style.height = H + 'px';
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      var off = document.createElement('canvas');
      off.width = Math.ceil(W); off.height = Math.ceil(H);
      var o = off.getContext('2d'), font = function (f) { return '300 ' + f + 'px Geist, "Helvetica Neue", Arial, sans-serif'; };
      o.font = font(fs);
      var total = 0, widths = [], i;
      for (i = 0; i < text.length; i++) { widths[i] = o.measureText(text[i]).width; total += widths[i] + (i < text.length - 1 ? ls : 0); }
      var mt = o.measureText(text), asc = mt.actualBoundingBoxAscent || fs * 0.72, desc = mt.actualBoundingBoxDescent || 0;
      if (total > W) { var sc = W / total; fs *= sc; ls *= sc; asc *= sc; desc *= sc; o.font = font(fs); for (i = 0; i < widths.length; i++) widths[i] *= sc; }
      var x = 0, base = (H - (asc + desc)) / 2 + asc;
      o.fillStyle = '#fff';
      for (i = 0; i < text.length; i++) { o.fillText(text[i], x, base); x += widths[i] + ls; }
      var q = Math.max(3.6, fs / 68), data = o.getImageData(0, 0, off.width, off.height).data, pts = [];
      for (var yy = q / 2; yy < off.height; yy += q) for (var xx = q / 2; xx < off.width; xx += q) if (data[((yy | 0) * off.width + (xx | 0)) * 4 + 3] > 140) pts.push(xx, yy);
      rb = q * 0.38; N = pts.length / 2;
      var R = rng(3);
      tx = new Float32Array(N); ty = new Float32Array(N); sx = new Float32Array(N); sy = new Float32Array(N);
      dl = new Float32Array(N); ph = new Float32Array(N); ox = new Float32Array(N); oy = new Float32Array(N);
      for (i = 0; i < N; i++) {
        tx[i] = pts[i * 2]; ty[i] = pts[i * 2 + 1];
        sx[i] = tx[i] + (R() - 0.5) * W * 0.5; sy[i] = ty[i] + H * (0.6 + R() * 1.2);
        dl[i] = (tx[i] / W) * 0.7 + R() * 0.35; ph[i] = R() * TAU;
      }
      el.classList.add('is-dots');
    }
    function frame(now) {
      if (!running) { started = false; return; }
      requestAnimationFrame(frame);
      if (!t0) t0 = now;
      var t = (now - t0) / 1000, MR = 90, MR2 = MR * MR, m = ptr.m;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var scanX = ((t * 0.16) % 1.8 - 0.4) * W;
      for (var i = 0; i < N; i++) {
        var e = outExpo(sat((t - dl[i]) / 1.4));
        var x = sx[i] + (tx[i] - sx[i]) * e, y = sy[i] + (ty[i] - sy[i]) * e, gx = 0, gy = 0;
        if (m) {
          var qx = x - m.x, qy = y - m.y, d2 = qx * qx + qy * qy;
          if (d2 < MR2) { var d = Math.sqrt(d2) || 1, f = 1 - d / MR; f = f * f * 26; gx = (qx / d) * f; gy = (qy / d) * f; }
        }
        ox[i] += (gx - ox[i]) * 0.12; oy[i] += (gy - oy[i]) * 0.12;
        x += ox[i]; y += oy[i];
        var c = 0, a = 0.2 + 0.8 * e;
        if (e > 0.98) {
          a = 0.86 + Math.sin(t * 1.3 + ph[i] * 3) * 0.1;
          var sd = Math.abs(x - scanX);
          if (sd < 60) { var g = 1 - sd / 60; if (g > 0.7) c = 1; a = Math.min(1, a + g * 0.3); }
          if (Math.sin(t * 1.7 * (0.6 + ph[i] * 0.07) + ph[i] * 41) > 0.997) { c = 1; a = 1; }
        }
        if (Math.abs(ox[i]) + Math.abs(oy[i]) > 2) { c = 1; a = 1; }
        batch.add(key(c, a), x, y, rb);
      }
      batch.flush(ctx);
    }
    function start() { if (!started && running) { started = true; requestAnimationFrame(frame); } }
    function go() { layout(); onVisible(el, function (v) { running = v; start(); }, '-10% 0px'); }
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(layout, 150); });
    if (document.fonts && document.fonts.load) document.fonts.load('300 100px Geist').then(go, go); else go();
  }

  /* ---------- a slow drifting dot field (CTA background) ---------- */
  function DotField(host) {
    var cv = document.createElement('canvas');
    cv.className = 'field-canvas';
    cv.setAttribute('aria-hidden', 'true');
    host.insertBefore(cv, host.firstChild);
    var ctx = cv.getContext('2d'), batch = new Batch(), ptr = pointerOver(cv, 0);
    var W, H, N, x0, y0, sp, sz, ph, ox, oy, running = false, started = false;
    function layout() {
      W = cv.clientWidth; H = cv.clientHeight;
      if (!W) return;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      var R = rng(9);
      N = Math.round(W * H / 2600);
      x0 = new Float32Array(N); y0 = new Float32Array(N); sp = new Float32Array(N); sz = new Float32Array(N); ph = new Float32Array(N); ox = new Float32Array(N); oy = new Float32Array(N);
      for (var i = 0; i < N; i++) { x0[i] = R() * W; y0[i] = R() * H; sp[i] = 4 + R() * 14; sz[i] = 0.6 + R() * R() * 2.2; ph[i] = R() * TAU; }
    }
    function frame(now) {
      if (!running) { started = false; return; }
      requestAnimationFrame(frame);
      var t = now / 1000, m = ptr.m, MR = 120, MR2 = MR * MR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < N; i++) {
        var x = x0[i] + Math.sin(t * 0.2 + ph[i]) * 18, y = ((y0[i] - t * sp[i]) % H + H) % H, gx = 0, gy = 0;
        if (m) {
          var qx = x - m.x, qy = y - m.y, d2 = qx * qx + qy * qy;
          if (d2 < MR2) { var d = Math.sqrt(d2) || 1, f = 1 - d / MR; f = f * f * 34; gx = (qx / d) * f; gy = (qy / d) * f; }
        }
        ox[i] += (gx - ox[i]) * 0.1; oy[i] += (gy - oy[i]) * 0.1;
        var near = Math.abs(ox[i]) + Math.abs(oy[i]) > 2;
        var edge = Math.min(1, y / (H * 0.2), (H - y) / (H * 0.2));
        batch.add(key(near ? 1 : 0, (0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.9 + ph[i] * 5))) * edge * (near ? 2.4 : 1)), x + ox[i], y + oy[i], sz[i]);
      }
      batch.flush(ctx);
    }
    function start() { if (!started && running) { started = true; requestAnimationFrame(frame); } }
    layout();
    onVisible(cv, function (v) { running = v; start(); }, '0px');
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(layout, 150); });
  }

  function boot() {
    var dog = window.SETTER_DOG ? new Fig(window.SETTER_DOG) : null;
    var head = window.SETTER_HEAD ? new Fig(window.SETTER_HEAD) : null;
    if (dog) {
      var stage = document.querySelector('.dog-scroll .stage');
      if (stage) HeroDog(stage, dog);
      var heroTop = document.querySelector('[data-hero-dog]');
      if (heroTop && window.innerWidth > 900) {
        var holder = document.createElement('div');
        holder.className = 'hero-dog';
        heroTop.appendChild(holder);
        heroTop.classList.add('has-dog');
        Figure(holder, dog, { pitch: 6.4, cls: 'fig-canvas' });
      }
    }
    if (head) {
      [].slice.call(document.querySelectorAll('[data-dot-head]')).forEach(function (orb, n) { Figure(orb, head, { fit: 'image', pitch: 6.2, seed: 21 + n }); });
    }
    [].slice.call(document.querySelectorAll('[data-dot-field]')).forEach(DotField);
    var giant = document.querySelector('.giant');
    if (giant) DotWord(giant);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
