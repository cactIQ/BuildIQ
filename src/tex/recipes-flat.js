// Texture recipes for the sample-flat interior (v1.15). Runs in the texture worker (no DOM, no THREE).
import { makeNoise, img, put, heightToNormal, packORM, rgb, clamp01, smooth } from './noise.js';

/** White Statuario-style marble, 600 x 1200 mm slabs in a half-offset (stagger) layout with a thin pale grout.
 *  One image = 1.2 x 1.2 m: two slab columns (u 0..0.5, 0.5..1); the second column is shifted by half a slab, so the
 *  layout is baked in and the floor needs only plain world UVs (1 UV unit = `tile` metres).
 *  Veins: domain-warped sine bands (sharp thin veins + soft wide clouds), a different phase and angle per slab, so
 *  veins break at the joints like real cut slabs. Roughness: polished slab 0.08, grout matte 0.85. */
function flatMarble({ size = 1024, tile = 1.2, grout = 0.002, seed = 77, base = '#F4F2EE', vein = '#8F9298', warm = '#E9E2D6' } = {}) {
  const w = size, h = size, n = makeNoise(seed), B = rgb(base), V = rgb(vein), Wm = rgb(warm);
  const al = img(w, h), hgt = new Float32Array(w * h), rough = new Float32Array(w * h), ao = new Float32Array(w * h);
  const gU = grout / tile;                                  // grout width in UV
  // per-slab parameters (4 slabs per image: 2 columns x 2 rows)
  const slab = [];
  for (let i = 0; i < 4; i++) {
    const a = n.noise(i * 0.137 + 0.05, 0.31, 64), b = n.noise(0.71, i * 0.193 + 0.09, 64), c = n.noise(i * 0.29 + 0.4, 0.83, 64);
    slab.push({ ang: (a - 0.5) * 1.6 + (i % 2 ? 0.5 : -0.4), phase: b * 40, freq: 1.8 + c * 1.8, warp: 2.6 + a * 1.6, tone: (c - 0.5) * 0.03 });
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const col = u < 0.5 ? 0 : 1;
    const vv = col ? (v + 0.5) % 1 : v;                     // column 2 is half a slab lower
    const row = vv < 0.5 ? 0 : 1;
    // slab-local coords (metres-ish) and distance to the slab edge (UV)
    const lu = (u - col * 0.5) / 0.5, lv = (vv - row * 0.5) / 0.5;
    const edge = Math.min(u - col * 0.5, (col + 1) * 0.5 - u, vv - row * 0.5, (row + 1) * 0.5 - vv);
    const S = slab[col * 2 + row];
    const ca = Math.cos(S.ang), sa = Math.sin(S.ang);
    const px = lu * 0.6 * ca - lv * 1.2 * sa, py = lu * 0.6 * sa + lv * 1.2 * ca;   // rotated slab coords (m)
    const wp = n.fbm(u, v, { period: 4, octaves: 5 }) - 0.5, wp2 = n.fbm(u + 0.37, v + 0.11, { period: 8, octaves: 4 }) - 0.5;
    const t = py * S.freq + S.phase + wp * S.warp * 7 + wp2 * 3;
    const s = Math.abs(Math.sin(t));
    // only some bands become veins (masked by low-frequency noise), so the slab reads as a few bold veins on a
    // calm white field instead of evenly spaced contour lines
    const mk = smooth(0.42, 0.68, n.fbm(u + 0.21, v + 0.57, { period: 3, octaves: 3 }));
    const mk2 = smooth(0.55, 0.78, n.fbm(u + 0.63, v + 0.29, { period: 5, octaves: 3 }));
    const thin = Math.pow(1 - s, 34) * (0.2 + 0.8 * mk);                                                               // main veins
    const thin2 = Math.pow(1 - Math.abs(Math.sin(t * 2.3 + px * 2 + wp2 * 6)), 70) * 0.35 * mk2;                       // sparse hairline veins
    const soft = Math.pow(1 - s, 6) * 0.2 * (0.3 + 0.7 * mk);                                                          // soft grey halo around veins
    const cloud = n.fbm(u, v, { period: 3, octaves: 4 }) - 0.5;
    const k = clamp01(thin + thin2 + soft);
    let r = B[0] + (Wm[0] - B[0]) * clamp01(cloud * 1.5 + 0.2) * 0.35, g = B[1] + (Wm[1] - B[1]) * clamp01(cloud * 1.5 + 0.2) * 0.35, bl = B[2] + (Wm[2] - B[2]) * clamp01(cloud * 1.5 + 0.2) * 0.35;
    r = r * (1 + S.tone) * (1 - k) + V[0] * k; g = g * (1 + S.tone) * (1 - k) + V[1] * k; bl = bl * (1 + S.tone) * (1 - k) + V[2] * k;
    const inGrout = edge < gU * 0.5;
    if (inGrout) { r = 0.80; g = 0.785; bl = 0.76; }
    put(al, w, x, y, clamp01(r), clamp01(g), clamp01(bl));
    hgt[y * w + x] = inGrout ? -1 : smooth(0, gU * 2, edge) * 0.05;
    rough[y * w + x] = inGrout ? 0.85 : clamp01(0.08 + k * 0.05 + Math.max(0, cloud) * 0.04);
    ao[y * w + x] = inGrout ? 0.75 : 1;
  }
  return { w, h, albedo: al, normal: heightToNormal(hgt, w, h, 1.5), orm: packORM(w, h, ao, rough, 0) };
}

export const recipes = { flatMarble };
