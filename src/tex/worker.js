// Texture worker: runs recipes off the main thread and transfers RGBA8 buffers back.
import { recipes as base } from './recipes-base.js';
import { recipes as tower } from './recipes-tower.js';
import { recipes as site } from './recipes-site.js';
import { recipes as amenities } from './recipes-amenities.js';

const ALL = { ...base, ...tower, ...site, ...amenities };

self.onmessage = (e) => {
  const { id, recipe, params } = e.data;
  const t0 = performance.now();
  try {
    const fn = ALL[recipe];
    if (!fn) throw new Error('unknown recipe ' + recipe);
    const out = fn(params || {});
    const maps = {}, transfer = [];
    for (const k of ['albedo', 'normal', 'orm', 'alpha', 'emissive']) if (out[k]) { maps[k] = out[k]; transfer.push(out[k].buffer); }
    self.postMessage({ id, ok: true, w: out.w, h: out.h, maps, ms: performance.now() - t0 }, transfer);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.stack || err) });
  }
};
