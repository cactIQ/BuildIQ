// v1.12 frosted-glass backdrop for the UI. No CSS blur (house rule, iGPU safety): instead, right after each render
// (same task, so no preserveDrawingBuffer is needed) the WebGL canvas is halved down to 1/S of the CSS size, blurred
// with a small down/up pyramid, and every glass target gets its own crop drawn into a tiny child
// <canvas class="frost"> that CSS stretches to fill it. Pixels are never read back (no getImageData / toDataURL),
// so all of it stays on the GPU. Throttled; a watchdog switches it off if it ever gets slow.
const S = 12;            // base buffer = CSS size / S
const LEVELS = 2;        // blur pyramid depth (each level halves): about sigma 18 CSS px
const IDLE_MS = 500;     // refresh rate when nothing moves

export function createFrost(app, { canvas, targets, enabled = true, isPaused = () => false } = {}) {
  const html = document.documentElement;
  const stub = { on: false, invalidate() {}, dispose() {} };
  if (!enabled || !canvas || !targets?.length) { window.__frost = { on: false }; return stub; }

  const prep = (b) => { b.x.imageSmoothingEnabled = true; b.x.imageSmoothingQuality = 'low'; };
  const mk = (c = document.createElement('canvas')) => { const b = { c, x: c.getContext('2d', { alpha: false }) }; prep(b); return b; };
  const size = (b, w, h) => {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    if (b.c.width !== w || b.c.height !== h) { b.c.width = w; b.c.height = h; prep(b); }   // resizing resets ctx state
  };

  const halves = [], down = [], up = [];
  const base = mk(), blur = mk();
  const list = targets.filter((t) => t && t.el).map((t) => {
    const c = document.createElement('canvas');
    c.className = 'frost'; c.setAttribute('aria-hidden', 'true');
    t.el.prepend(c);
    return { ...mk(c), el: t.el, active: t.active, r: null, ready: false };
  });
  if (!list.length || !base.x) { list.forEach((t) => t.c.remove()); window.__frost = { on: false }; return stub; }

  const minMs = app.tier === 'low' ? 1000 / 12 : 1000 / 18;
  let disposed = false, lost = false, shown = false, rectsDirty = true, pending = true;
  let hotUntil = 0, lastUpd = 0, lastRects = 0, lastSig = NaN, cssW = 1, cssH = 1, n = 0;
  const samples = [];
  const stat = { on: true, ms: 0, n: 0, targets: list.length };
  window.__frost = stat;

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { rectsDirty = true; pending = true; }) : null;
  list.forEach((t) => ro?.observe(t.el));
  const onResize = () => { rectsDirty = true; pending = true; };
  addEventListener('resize', onResize);

  function readRects(now) {
    const cr = canvas.getBoundingClientRect();
    cssW = Math.max(1, cr.width); cssH = Math.max(1, cr.height);
    for (const t of list) {
      t.r = null;
      if (t.active && !t.active()) continue;
      const r = t.c.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.right <= cr.left || r.bottom <= cr.top || r.left >= cr.right || r.top >= cr.bottom) continue;
      t.r = { x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height };
    }
    lastRects = now; rectsDirty = false;
  }

  function draw() {
    // 1) halve the WebGL canvas (2x2 box per step, no aliasing) down to the base buffer
    const bw = Math.max(8, Math.ceil(cssW / S)), bh = Math.max(8, Math.ceil(cssH / S));
    let src = canvas, sw = canvas.width, sh = canvas.height, i = 0;
    while (sw / 2 >= bw * 1.5 && sh / 2 >= bh * 1.5) {
      const b = (halves[i] ||= mk());
      size(b, sw / 2, sh / 2);
      b.x.drawImage(src, 0, 0, sw, sh, 0, 0, b.c.width, b.c.height);
      src = b.c; sw = b.c.width; sh = b.c.height; i++;
    }
    size(base, bw, bh);
    base.x.drawImage(src, 0, 0, sw, sh, 0, 0, bw, bh);
    // 2) blur: down LEVELS halvings, then bilinear back up to the base size
    let s = base.c;
    for (let l = 0; l < LEVELS; l++) { const b = (down[l] ||= mk()); size(b, s.width / 2, s.height / 2); b.x.drawImage(s, 0, 0, b.c.width, b.c.height); s = b.c; }
    for (let l = LEVELS - 1; l >= 0; l--) {
      const tgt = l === 0 ? blur : (up[l] ||= mk()), ref = l === 0 ? base.c : down[l - 1].c;
      size(tgt, ref.width, ref.height); tgt.x.drawImage(s, 0, 0, tgt.c.width, tgt.c.height); s = tgt.c;
    }
    // 3) crop each visible target's region into its own frost canvas
    const kx = blur.c.width / cssW, ky = blur.c.height / cssH;
    for (const t of list) {
      if (!t.r) continue;
      const r = t.r;
      size(t, r.w / S, r.h / S);
      t.x.drawImage(blur.c, r.x * kx, r.y * ky, r.w * kx, r.h * ky, 0, 0, t.c.width, t.c.height);
      if (!t.ready) { t.ready = true; t.c.classList.add('ready'); }
    }
  }

  function setOn(on) { html.classList.toggle('frost-on', on); shown = on; stat.on = on; }

  app.on('frame', (f) => {
    if (disposed || lost || isPaused()) return;
    const now = performance.now();
    const e = f.camera.matrixWorld.elements;
    const sig = e[0] + e[2] * 3 + e[8] * 7 + e[12] * 11 + e[13] * 13 + e[14] * 17 + f.k * 19;
    if (sig !== lastSig) { pending = true; lastSig = sig; }
    const hot = now < hotUntil;
    if (now - lastUpd < (hot ? 0 : pending || rectsDirty ? minMs : IDLE_MS)) return;
    lastUpd = now; pending = false;
    if (rectsDirty || hot || now - lastRects > 1000) readRects(now);
    if (!list.some((t) => t.r)) return;
    const t0 = performance.now();
    draw();
    const ms = performance.now() - t0;
    if (!shown) setOn(true);
    if (++n > 5) {                                       // skip warm-up (buffer allocation)
      samples.push(ms); if (samples.length > 15) samples.shift();
      const med = [...samples].sort((a, b) => a - b)[samples.length >> 1];
      stat.ms = +med.toFixed(3); stat.n = n;
      if (samples.length === 15 && med > 1) { console.info('[frost] off: median', med.toFixed(2), 'ms per update'); dispose(); }
    }
  });
  app.on('contextlost', () => { lost = true; setOn(false); list.forEach((t) => { t.ready = false; t.c.classList.remove('ready'); }); });
  app.on('contextrestored', () => { lost = false; rectsDirty = true; pending = true; });
  app.on('fallback', () => dispose());

  function dispose() {
    if (disposed) return;
    disposed = true; setOn(false);
    ro?.disconnect(); removeEventListener('resize', onResize);
    list.forEach((t) => t.c.remove());
  }

  return {
    get on() { return shown; },
    /** Track rects every frame for `ms` (use while a glass target moves with a CSS transition). */
    invalidate(ms = 600) { hotUntil = Math.max(hotUntil, performance.now() + ms); rectsDirty = true; pending = true; },
    dispose,
  };
}
