// Texture recipes owned by the site module. Same contract as recipes-base.js:
// (params) => { w, h, albedo, normal?, orm?, alpha?, emissive? } as RGBA8 Uint8ClampedArray, tiling, 1 UV unit per image.
import { makeNoise, img, put, heightToNormal, packORM, rgb, clamp01, smooth } from './noise.js';

const toSrgb = (l) => Math.pow(clamp01(l), 1 / 2.2);   // encode a LINEAR multiplier so the sRGB decode returns it

/**
 * Ground grime / tonal detail: a neutral multiplier (linear ~0.72..1.06 after decode) of soft blotches, fine
 * speckle and a few dark drip/oil marks. Sampled twice by the ground shader (two scales, second rotated 37 deg)
 * through a 40 m macro mask, so neither this tile nor the paver tile reads as repeating.
 */
function siteGrime({ size = 1024, seed = 41, strength = 1 } = {}) {
  const w = size, h = size, n = makeNoise(seed), n2 = makeNoise(seed + 7);
  const al = img(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const blot = n.fbm(u, v, { period: 4, octaves: 4 }) - 0.5;          // soft weathering
    const mid = n2.fbm(u, v, { period: 16, octaves: 3 }) - 0.5;
    const spk = n.noise(u, v, 256);
    const stain = smooth(0.66, 0.8, n2.fbm(u + 0.31, v + 0.17, { period: 6, octaves: 3 }));   // sparse dark patches
    let k = 1 + (blot * 0.22 + mid * 0.10 + (spk - 0.5) * 0.05) * strength - stain * 0.16 * strength;
    k = Math.min(1.06, Math.max(0.6, k));
    const s = toSrgb(k);
    put(al, w, x, y, s, s, s);
  }
  return { w, h, albedo: al };
}

/**
 * Context-building facade: 4 bays x 4 floors (bay 3 m, floor 3 m => 12 m tile). White wall (tinted per building by
 * vertex colour), dark glazed windows with light frames, sills, slab drip bands, a few with grilles or balconies.
 * Emissive: a random subset of windows lit warm (driven by night in the material).
 */
function contextFacade({ size = 1024, seed = 53 } = {}) {
  const w = size, h = size, n = makeNoise(seed), r = n.rand;
  const al = img(w, h), em = img(w, h), hgt = new Float32Array(w * h), rough = new Float32Array(w * h);
  const bays = 4, floors = 4, px = w / bays, py = h / floors;     // pixels per bay / floor (row 0 = v 0 = bottom)
  const lit = [], kind = [], warm = [];
  for (let i = 0; i < bays * floors; i++) { lit.push(r() < 0.45); kind.push(r() < 0.25 ? 1 : 0); warm.push(0.75 + r() * 0.25); }
  const glass = rgb('#2B3036'), frame = [0.93, 0.93, 0.92], wall = [0.97, 0.97, 0.96];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const bx = Math.floor(x / px), fy = Math.floor(y / py), fx = (x % px) / px, fv = (y % py) / py, id = fy * bays + bx;
    const g = n.fbm(x / w, y / h, { period: 16, octaves: 3 }) - 0.5;
    let c = wall, height = 0.5 + g * 0.2, ro = 0.9, e = 0;
    // window opening: x 0.25..0.75 of the bay, v 0.30..0.72 of the floor (0.9..2.15 m)
    const wx0 = kind[id] ? 0.15 : 0.27, wx1 = kind[id] ? 0.85 : 0.73, wy0 = kind[id] ? 0.05 : 0.30, wy1 = 0.74;
    const inWin = fx > wx0 && fx < wx1 && fv > wy0 && fv < wy1;
    const fr = 0.012;
    if (inWin) {
      const onFrame = fx < wx0 + fr || fx > wx1 - fr || fv < wy0 + fr * 1.4 || fv > wy1 - fr * 1.4 || Math.abs(fx - (wx0 + wx1) / 2) < fr * 0.6;
      if (onFrame) { c = frame; height = 0.2; ro = 0.6; }
      else {
        const grill = kind[id] === 0 && (Math.abs(((fx - wx0) / (wx1 - wx0) * 6) % 1 - 0.5) > 0.46);
        c = grill ? [0.25, 0.25, 0.26] : glass.map((q) => q * (0.85 + g * 0.5 + (1 - fv) * 0.1));
        height = 0; ro = grill ? 0.6 : 0.15;
        if (lit[id] && !grill) { const k = warm[id]; e = 1; put(em, w, x, y, 1.0 * k, 0.72 * k, 0.42 * k); }
      }
    } else {
      const band = fv > 0.955 || fv < 0.012;                 // slab drip band
      const sill = fv > wy0 - 0.03 && fv < wy0 && fx > wx0 - 0.03 && fx < wx1 + 0.03;
      const rail = kind[id] && fv > 0.05 && fv < 0.38 && fx > 0.12 && fx < 0.88;   // balcony parapet
      if (band) { c = [0.9, 0.9, 0.89]; height = 0.8; }
      else if (sill || rail) { c = [0.95, 0.95, 0.94]; height = 0.9; }
      // rain streaks under windows
      const streak = fx > wx0 && fx < wx1 && fv < wy0 && fv > 0.0 ? smooth(0.3, 0.9, n.noise(x / w * 4, y / h * 0.5, 64)) * 0.08 : 0;
      c = c.map((q) => q * (1 + g * 0.08 - streak));
    }
    put(al, w, x, y, clamp01(c[0]), clamp01(c[1]), clamp01(c[2]));
    if (!e) put(em, w, x, y, 0, 0, 0);
    hgt[y * w + x] = height;
    rough[y * w + x] = ro;
  }
  return { w, h, albedo: al, emissive: em, normal: heightToNormal(hgt, w, h, 3), orm: packORM(w, h, 1, rough, 0) };
}

/**
 * Large-format floor tiles (gym; tile metres per image, tileW x tileH units) with a visible dark grout of `grout`
 * metres (anti-aliased coverage so a 3 mm joint survives mip filtering), slight per-tile tone and a soft cloud.
 */
function gymTiles({ size = 1024, tile = 2.4, tileW = 1.2, tileH = 0.6, grout = 0.003, color = '#ABAAA5', seed = 41 } = {}) {
  const w = size, h = size, base = rgb(color), n = makeNoise(seed);
  const cols = Math.round(tile / tileW), rows = Math.round(tile / tileH), mpp = tile / w;   // metres per pixel
  const al = img(w, h), hgt = new Float32Array(w * h), rough = new Float32Array(w * h);
  const half = grout / 2 + mpp * 0.5;                                // half joint incl. half a pixel of AA
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / w, v = (y + 0.5) / h;
    const cx = Math.floor(u * cols), cy = Math.floor(v * rows);
    const dx = Math.min(u * cols - cx, cx + 1 - u * cols) * tileW, dy = Math.min(v * rows - cy, cy + 1 - v * rows) * tileH;
    const dm = Math.min(dx, dy);                                       // metres to the nearest joint centre
    const cover = clamp01((half + mpp * 0.5 - dm) / mpp);              // 1 in the joint, AA edge
    const lip = clamp01(1 - (dm - half) / 0.006) * (1 - cover);        // tiny dark arris beside the joint
    const tone = ((Math.sin((cx * 37 + cy * 101 + seed) * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const g = n.fbm(u, v, { period: 16, octaves: 4 }) - 0.5;
    const kt = 1 + (tone - 0.5) * 0.06 + g * 0.1 - lip * 0.08;
    const k = kt * (1 - cover) + 0.42 * cover;
    put(al, w, x, y, clamp01(base[0] * k), clamp01(base[1] * k), clamp01(base[2] * k * 0.98));
    hgt[y * w + x] = -cover - lip * 0.3;
    rough[y * w + x] = cover > 0.5 ? 0.92 : 0.55 + g * 0.1;
  }
  return { w, h, albedo: al, normal: heightToNormal(hgt, w, h, 1.5), orm: packORM(w, h, 1, rough, 0) };
}

export const recipes = { siteGrime, contextFacade, gymTiles };
