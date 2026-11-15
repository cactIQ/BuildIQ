// Texture recipes owned by the amenities module (also used by vegetation). Same contract as recipes-base.js:
// (params) => { w, h, albedo, normal?, orm?, alpha?, emissive? } as RGBA8 Uint8ClampedArray, tiling, 1 UV unit per image.
// Row 0 of an image = v 0 (flipY = false).
import { makeNoise, img, put, heightToNormal, packORM, rgb, mix, clamp01, smooth } from './noise.js';

const hash = (a, b = 0, c = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };

/** Periodic Voronoi: returns [F1, F2] distances (cell units) for point (u,v) in a grid of `cells` (tiles). */
function voronoi(u, v, cells, seed) {
  const x = u * cells, y = v * cells, ix = Math.floor(x), iy = Math.floor(y);
  let f1 = 9, f2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j, wx = ((cx % cells) + cells) % cells, wy = ((cy % cells) + cells) % cells;
    const px = cx + 0.15 + 0.7 * hash(wx, wy, seed), py = cy + 0.15 + 0.7 * hash(wy + 17, wx + 3, seed);
    const d = Math.hypot(px - x, py - y);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return [f1, f2];
}

/** Pool-floor caustics (emissive, greyscale). Two Voronoi-edge layers; tiles. */
function caustics({ size = 512, cells = 6, seed = 3 } = {}) {
  const w = size, h = size, em = img(w, h), n = makeNoise(seed);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const wu = u + (n.fbm(u, v, { period: 4, octaves: 2 }) - 0.5) * 0.06, wv = v + (n.fbm(u + 0.3, v, { period: 4, octaves: 2 }) - 0.5) * 0.06;
    const [a1, a2] = voronoi(wu, wv, cells, seed), [b1, b2] = voronoi(wu + 0.21, wv + 0.47, cells + 3, seed + 9);
    const c1 = Math.pow(1 - smooth(0, 0.16, a2 - a1), 2.2), c2 = Math.pow(1 - smooth(0, 0.12, b2 - b1), 2.2);
    const val = clamp01(0.08 + 0.75 * c1 + 0.45 * c2);
    put(em, w, x, y, val * 0.85, val, val);
  }
  return { w, h, emissive: em };
}

/** Small-scale tileable ripple normal map for water. */
function waterNormal({ size = 512, seed = 41 } = {}) {
  const w = size, h = size, n = makeNoise(seed), hgt = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    hgt[y * w + x] = n.fbm(u, v, { period: 6, octaves: 4, gain: 0.5 }) * 0.8 + n.noise(u, v * 0.5 + u * 0.5, 12) * 0.25;
  }
  return { w, h, normal: heightToNormal(hgt, w, h, 6) };
}

/** Multicolour EPDM play surface: one image covers the whole play circle (radial design + rubber granules). */
function epdm({ size = 1024, seed = 43 } = {}) {
  const w = size, h = size, n = makeNoise(seed);
  const C = { blue: rgb('#2F6DB5'), sky: rgb('#4FA3D9'), yellow: rgb('#F0C23A'), orange: rgb('#E8792B'), green: rgb('#4E9F48'), red: rgb('#C9452F') };
  const al = img(w, h), hgt = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h, dx = u - 0.5, dz = v - 0.5, r = Math.hypot(dx, dz) * 2, a = Math.atan2(dz, dx);
    let c = C.blue;
    if (r < 0.2) c = C.yellow;
    else if (r < 0.27) c = C.orange;
    else if (r < 0.74) {
      const petal = Math.cos(a * 6) * 0.5 + 0.5, rr = (r - 0.27) / 0.47;
      if (petal > 0.55 + rr * 0.35 && rr < 0.85) c = (Math.floor((a + Math.PI) / (Math.PI / 3)) % 2) ? C.green : C.red;
      else c = C.sky;
    } else if (r < 0.83) c = C.green;
    else if (r < 0.9) c = C.yellow;
    // rubber granules: speckle + occasional off-colour flecks
    const g = n.noise(u, v, 512), f = hash(x, y, seed);
    let k = 0.9 + g * 0.2;
    let cc = c;
    if (f > 0.93) cc = [C.yellow, C.red, C.green, C.blue][Math.floor(f * 1000) % 4];
    put(al, w, x, y, clamp01(cc[0] * k), clamp01(cc[1] * k), clamp01(cc[2] * k));
    hgt[y * w + x] = g;
  }
  return { w, h, albedo: al, normal: heightToNormal(hgt, w, h, 1.2), orm: packORM(w, h, 1, 0.9, 0) };
}

/** Linear pool grating: transverse slots along U. tile = metres per image. */
function grating({ size = 256, tile = 0.5, pitch = 0.025, color = '#B9BDBF' } = {}) {
  const w = size, h = size, base = rgb(color), bars = Math.round(tile / pitch);
  const al = img(w, h), hgt = new Float32Array(w * h), rough = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h, f = (u * bars) % 1, edge = v < 0.08 || v > 0.92;
    const slot = !edge && f > 0.62;
    const k = slot ? 0.22 : 1;
    put(al, w, x, y, base[0] * k, base[1] * k, base[2] * k);
    hgt[y * w + x] = slot ? -1 : 0;
    rough[y * w + x] = slot ? 1 : 0.45;
  }
  return { w, h, albedo: al, normal: heightToNormal(hgt, w, h, 2), orm: packORM(w, h, 1, rough, 0) };
}

/** Sheer white curtains behind glass, u across (~1.2 m per image), v = full glazed height (transom zone above 0.78). */
function curtain({ size = 512, seed = 47, transomV = 0.78 } = {}) {
  const w = size, h = size, n = makeNoise(seed), al = img(w, h), em = img(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    let r, g, b, er, eg, eb;
    if (v < transomV) {
      const wob = (n.fbm(u, v * 0.25, { period: 4, octaves: 2 }) - 0.5) * 0.3;
      const fold = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (u * 9 + wob));
      const streak = n.noise(u, v * 0.1, 64) - 0.5;
      const k = 0.86 + 0.12 * fold + streak * 0.04 - (v < 0.03 ? 0.05 : 0);
      r = 0.95 * k; g = 0.94 * k; b = 0.91 * k;
      const e = 0.55 + 0.45 * fold;                       // lit-from-inside glow (folds thinner = brighter)
      er = e; eg = e * 0.8; eb = e * 0.55;
    } else {
      // transom: dim interior ceiling with a warm cove line
      const cove = Math.exp(-Math.pow((v - (transomV + 0.08)) / 0.02, 2));
      r = 0.22 + cove * 0.3; g = 0.21 + cove * 0.27; b = 0.2 + cove * 0.22;
      er = 0.15 + cove; eg = (0.15 + cove) * 0.78; eb = (0.15 + cove) * 0.5;
    }
    put(al, w, x, y, clamp01(r), clamp01(g), clamp01(b));
    put(em, w, x, y, clamp01(er), clamp01(eg), clamp01(eb));
  }
  return { w, h, albedo: al, emissive: em };
}

/** Palm frond strip: u across (0 = left leaflet tips, 0.5 = rachis, 1 = right tips), v along the frond (0 = base).
 * Opaque colour map everywhere (no dark fringes) + separate alpha. */
function palmFrond({ w = 256, h = 1024, seed = 53, leaflets = 64, slope = 0.07, color = '#55802F', tipColor = '#9AA650' } = {}) {
  const al = img(w, h), alpha = img(w, h), n = makeNoise(seed), base = rgb(color), tip = rgb(tipColor), rach = rgb('#A7A85C');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / w, v = (y + 0.5) / h, side = u < 0.5 ? 0 : 1, d = Math.abs(u - 0.5) * 2;
    const q = (v - slope * d) * leaflets, k = Math.round(q), dist = Math.abs(q - k);
    const r0 = hash(k, side, seed), r1 = hash(k + 7, side + 3, seed);
    const len = 0.72 + 0.28 * r0, missing = r1 < 0.07;
    const hw = 0.36 * (1 - Math.pow(d / len, 1.6)) + 0.05;
    const aa = 1.2 * leaflets / h;
    let a = (!missing && d < len) ? smooth(hw + aa, hw - aa, dist) : 0;
    // leaflet colour: midrib lighter, edges darker, tips yellowing, per-leaflet tone
    const tone = 0.85 + 0.3 * hash(k + 31, side, seed), mid = 1 - dist / Math.max(hw, 1e-3) * 0.35;
    const ty = smooth(0.55, 1, d / len) * (0.4 + 0.6 * r1) + smooth(0.85, 1, v) * 0.3;
    const g = n.fbm(u, v, { period: 16, octaves: 2 }) - 0.5;
    let c = [mix(base[0], tip[0], ty), mix(base[1], tip[1], ty), mix(base[2], tip[2], ty)].map((ch) => ch * tone * mid * (1 + g * 0.2));
    if (d < 0.035) { c = rach; a = 1; }
    put(al, w, x, y, clamp01(c[0]), clamp01(c[1]), clamp01(c[2]));
    put(alpha, w, x, y, a, a, a, 1);
  }
  return { w, h, albedo: al, alpha };
}

/** Palm trunk bark: u around, v = 1 m of height with leaf-scar rings. */
function palmBark({ w = 256, h = 512, seed = 59, rings = 6, color = '#7C7266' } = {}) {
  const n = makeNoise(seed), base = rgb(color), al = img(w, h), hgt = new Float32Array(w * h), rough = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const wav = (n.fbm(u, v, { period: 4, octaves: 2 }) - 0.5) * 0.25;
    const f = ((v * rings + wav) % 1 + 1) % 1;
    const ring = smooth(0.0, 0.08, f) * (1 - smooth(0.82, 1, f));      // 0 at the scar line
    const fib = n.noise(u * 1, v * 0.25, 96) - 0.5, fine = n.noise(u, v, 128) - 0.5;
    const k = (0.72 + 0.3 * ring) * (1 + fib * 0.25 + fine * 0.1);
    put(al, w, x, y, clamp01(base[0] * k), clamp01(base[1] * k), clamp01(base[2] * k * 0.96));
    hgt[y * w + x] = ring * 0.6 + fib * 0.3;
    rough[y * w + x] = 0.9;
  }
  return { w, h, albedo: al, normal: heightToNormal(hgt, w, h, 3), orm: packORM(w, h, 1, rough, 0) };
}

/** Leafy clump texture (near-neutral luminance; the hue comes from vertex/instance colours). */
function foliage({ size = 512, seed = 61, cells = 22 } = {}) {
  const w = size, h = size, n = makeNoise(seed), al = img(w, h), hgt = new Float32Array(w * h), ao = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    let best = 0, bestTone = 0.4;
    for (const [c, s] of [[cells, 1], [Math.round(cells * 1.6), 2]]) {
      const [f1, f2] = voronoi(u, v, c, seed + s);
      const leaf = 1 - smooth(0.05, 0.45, f1) * 0.6 - (1 - smooth(0, 0.1, f2 - f1)) * 0.35;
      const tone = 0.62 + 0.38 * hash(Math.floor(u * c), Math.floor(v * c), seed + s);
      if (leaf * tone > best) { best = leaf * tone; bestTone = tone; }
    }
    const g = n.fbm(u, v, { period: 8, octaves: 3 }) - 0.5;
    const k = clamp01(0.35 + best * 0.75 + g * 0.15);
    put(al, w, x, y, k * 0.96, k, k * 0.9);
    hgt[y * w + x] = best;
    ao[y * w + x] = clamp01(0.55 + best * 0.6);
    void bestTone;
  }
  return { w, h, albedo: al, normal: heightToNormal(hgt, w, h, 3), orm: packORM(w, h, ao, 0.8, 0) };
}

export const recipes = { caustics, waterNormal, epdm, grating, curtain, palmFrond, palmBark, foliage };
