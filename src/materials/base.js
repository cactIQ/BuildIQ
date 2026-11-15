// Material library (ctx.M). Modules NEVER call `new THREE.Mesh*Material` directly in builders; they define
// materials in their own src/materials/<module>.js via M.define(name, async factory) and get them with
// `await M.use(name)`. Unknown names return a magenta material and log an error.
// All materials must be created (awaited) before warm-up: creating/changing materials after `ready` recompiles.
import * as THREE from 'three';

export function createMaterialLib(ctx) {
  const defs = new Map(), made = new Map();   // made: name -> { promise, value }
  const magenta = new THREE.MeshStandardMaterial({ color: 0xff00ff, name: 'MISSING' });
  const M = {
    define(name, factory) { if (defs.has(name)) console.warn('[M] redefine ' + name); defs.set(name, factory); },
    /** Create (once) and return a material. Always await this inside async build(). */
    use(name) {
      if (made.has(name)) return made.get(name).promise;
      const f = defs.get(name);
      if (!f) { console.error('[M] unknown material ' + name); return Promise.resolve(magenta); }
      const rec = { promise: null, value: null };
      rec.promise = Promise.resolve(f(ctx)).then((m) => { m.name = m.name || name; rec.value = m; return m; });
      made.set(name, rec);
      return rec.promise;
    },
    /** Sync access to an already-created material (after await M.use). */
    get(name) { const r = made.get(name); if (!r || !r.value) { console.error('[M] not ready ' + name); return magenta; } return r.value; },
    names: () => [...defs.keys()],
    created: () => [...made.values()].map((r) => r.value).filter(Boolean),
  };
  return M;
}

/** Helper: standard PBR material from a tex.get() result with world-UV tiling handled by geometry. */
export function pbr(t, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, ...opts });
  if (t) {
    if (t.albedo) m.map = t.albedo;
    if (t.normal) { m.normalMap = t.normal; m.normalScale = new THREE.Vector2(opts.normalStrength ?? 1, opts.normalStrength ?? 1); }
    if (t.orm) { m.aoMap = t.orm; m.roughnessMap = t.orm; m.metalnessMap = opts.useMetalMap ? t.orm : null; }
  }
  delete m.normalStrength; delete m.useMetalMap;
  return m;
}

/** Core-owned shared materials. */
export function defineBaseMaterials(M, SPEC) {
  const P = SPEC.global.palette;
  const T = (ctx, recipe, params) => ctx.tex.get(recipe, params);

  M.define('plaster', async (ctx) => pbr(await T(ctx, 'plaster', { color: P.body, seed: 7 }), { roughness: 1 }));
  M.define('trim', async (ctx) => pbr(await T(ctx, 'plaster', { color: P.trim, seed: 8, variation: 0.03, streaks: 0.02 }), { roughness: 1 }));
  // Recess variant: same look, reduced IBL so stilt ceilings / soffits / balcony recesses don't glow (fake AO).
  M.define('plasterRecess', async (ctx) => { const m = pbr(await T(ctx, 'plaster', { color: P.body, seed: 7 })); m.envMapIntensity = 0.3; return m; });
  M.define('slabWhite', async (ctx) => pbr(await T(ctx, 'plaster', { color: P.slabWhite, seed: 9, variation: 0.03 })));
  M.define('roofDeck', async (ctx) => pbr(await T(ctx, 'concrete', { color: P.roofDeck, seed: 5 })));
  M.define('concrete', async (ctx) => pbr(await T(ctx, 'concrete', { color: '#B8B5AE', seed: 6 })));
  M.define('kerb', async (ctx) => pbr(await T(ctx, 'concrete', { color: P.kerb, seed: 4 })));
  M.define('pavers', async (ctx) => pbr(await T(ctx, 'pavers', { color: P.pavers, tile: 2 }), { normalStrength: 1 }));
  M.define('asphalt', async (ctx) => pbr(await T(ctx, 'asphalt', { color: P.asphalt })));
  M.define('lawn', async (ctx) => pbr(await T(ctx, 'lawn', { color: P.lawn })));
  M.define('lawnStriped', async (ctx) => pbr(await T(ctx, 'lawn', { color: P.lawn, stripes: 1.5, tile: 8 })));
  M.define('deck', async (ctx) => pbr(await T(ctx, 'deck', { color: P.deck, tile: 2 })));
  M.define('mosaic', async (ctx) => pbr(await T(ctx, 'mosaic', { color: P.mosaic, tile: 1 })));
  M.define('coping', async (ctx) => pbr(await T(ctx, 'concrete', { color: P.coping, seed: 3, rough: 0.6 })));
  M.define('frame', async () => new THREE.MeshStandardMaterial({ color: P.frame, roughness: 0.45, metalness: 0.3 }));
  M.define('iron', async () => new THREE.MeshStandardMaterial({ color: P.iron, roughness: 0.5, metalness: 0.6 }));
  M.define('steel', async () => new THREE.MeshStandardMaterial({ color: '#C8CCCF', roughness: 0.25, metalness: 1 }));
  M.define('gold', async () => new THREE.MeshStandardMaterial({ color: P.gold, roughness: 0.3, metalness: 1 }));
  M.define('walnut', async () => new THREE.MeshStandardMaterial({ color: P.walnut, roughness: 0.55 }));
  M.define('rail', async () => new THREE.MeshStandardMaterial({ color: P.rail, roughness: 0.35, metalness: 0.5 }));
  M.define('balconyGlass', async () => new THREE.MeshStandardMaterial({
    color: P.balconyGlass, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.35, depthWrite: false,
  }));
  // Contact-shadow decal: dark radial gradient, multiplied visually via low opacity black.
  M.define('contactShadow', async (ctx) => {
    const t = ctx.tex.canvas('contactShadow', 128, 128, (g, w, h) => {
      const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, 'rgba(0,0,0,0.85)'); r.addColorStop(0.55, 'rgba(0,0,0,0.35)'); r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    });
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, color: 0x000000, opacity: 0.6 });
  });
  M.define('emissiveWarm', async () => new THREE.MeshStandardMaterial({ color: '#2A2015', emissive: '#FFC27A', emissiveIntensity: 0, roughness: 0.6 }));
}
