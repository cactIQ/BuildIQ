// Main-thread texture factory. Heavy procedural work runs in a worker pool (src/tex/worker.js).
// API (ctx.tex):
//   await tex.get(recipe, params) -> { albedo, normal, orm, alpha, emissive } THREE.DataTexture|null (cached)
//   tex.canvas(key, w, h, draw(ctx2d, w, h)) -> THREE.CanvasTexture (software 2D canvas; small things only)
//   tex.stats -> [{ key, ms }]
// Colour spaces: albedo/emissive = SRGB; normal/orm/alpha = NoColorSpace. Wrap = Repeat. flipY = false everywhere
// (row 0 of a recipe image = v 0).
import * as THREE from 'three';

const SIZE_CAP = { lawn: 512, asphalt: 512, mosaic: 512, epdm: 512, siteGrime: 512, contextFacade: 512, concrete: 512 };

export function createTextures({ anisotropy = 8, workers = 0, lowTier = false } = {}) {
  const cache = new Map();
  const stats = [];
  const n = workers || Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
  const pool = [];
  let seq = 0;
  const pending = new Map();
  for (let i = 0; i < n; i++) {
    const w = new Worker(new URL('./tex/worker.js', import.meta.url), { type: 'module' });
    w.onmessage = (e) => { const p = pending.get(e.data.id); if (p) { pending.delete(e.data.id); p(e.data); } };
    w.onerror = (e) => console.error('[tex] worker error', e.message);
    pool.push({ w, busy: 0 });
  }
  const run = (recipe, params) => new Promise((resolve) => {
    const id = ++seq;
    const slot = pool.reduce((a, b) => (b.busy < a.busy ? b : a));
    slot.busy++;
    pending.set(id, (d) => { slot.busy--; resolve(d); });
    slot.w.postMessage({ id, recipe, params });
  });

  const mk = (data, w, h, srgb) => {
    const t = new THREE.DataTexture(new Uint8Array(data.buffer), w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.anisotropy = anisotropy; t.flipY = false;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  };

  async function get(recipe, params = {}) {
    // Load-time budget: secondary/background textures are generated at 512 (4x cheaper) unless a size is given;
    // the low tier caps every 1024+ texture at 512. Hero surfaces (plaster, pavers, tower atlases, deck) keep 1024.
    const cap = lowTier ? 512 : SIZE_CAP[recipe];
    if (cap && !('size' in params) && !('w' in params)) params = { ...params, size: cap };
    const key = recipe + JSON.stringify(params);
    if (cache.has(key)) return cache.get(key);
    const p = (async () => {
      const tReq = performance.now();
      const d = await run(recipe, params);
      if (!d.ok) { console.error('[tex] ' + recipe + ' failed: ' + d.error); return { albedo: null, normal: null, orm: null, alpha: null, emissive: null }; }
      stats.push({ key: recipe, ms: Math.round(d.ms), req: Math.round(tReq), done: Math.round(performance.now()) });
      const out = {};
      for (const k of ['albedo', 'normal', 'orm', 'alpha', 'emissive']) out[k] = d.maps[k] ? mk(d.maps[k], d.w, d.h, k === 'albedo' || k === 'emissive') : null;
      return out;
    })();
    cache.set(key, p);
    return p;
  }

  function canvas(key, w, h, draw, { srgb = true, repeat = false } = {}) {
    if (cache.has(key)) return cache.get(key);
    const t0 = performance.now();
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });   // software raster (house rule 3)
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = anisotropy;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    stats.push({ key, ms: Math.round(performance.now() - t0) });
    cache.set(key, t);
    return t;
  }

  function dispose() { pool.forEach((p) => p.w.terminate()); }
  return { get, canvas, stats, dispose };
}

/** Node/test stub: same API, returns 1x1 textures synchronously-resolved. */
export function createStubTextures() {
  const one = () => { const t = new THREE.DataTexture(new Uint8Array([200, 200, 200, 255]), 1, 1); t.needsUpdate = true; return t; };
  return {
    stats: [],
    async get() { return { albedo: one(), normal: one(), orm: one(), alpha: one(), emissive: one() }; },
    canvas() { return one(); },
    dispose() {},
  };
}
