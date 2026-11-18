// Core-owned texture recipes. Each recipe: (params) => { w, h, albedo, normal?, orm?, alpha? } (RGBA8 arrays).
// Images tile seamlessly and cover 1 UV unit. Modules map world metres to UV via util.worldUV(geom, tile).
import { makeNoise, img, put, heightToNormal, packORM, rgb, mix, clamp01, smooth } from './noise.js';

/** Painted plaster / render: low-frequency tonal variation + fine grain + subtle streaks (weathering). */
function plaster({ size = 1024, color = '#D6C6A4', seed = 7, variation = 0.06, grain = 0.035, streaks = 0.04 } = {}) {
  const w = size, h = size, n = makeNoise(seed), base = rgb(color);
  const al = img(w, h), hgt = new Float32Array(w * h), rough = new Float32Array(w * h), ao = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const low = n.fbm(u, v, { period: 3, octaves: 3 }) - 0.5;
    const fine = n.fbm(u, v, { period: 64, octaves: 3 }) - 0.5;
    const st = (n.fbm(u * 1, v * 0.08, { period: 24, octaves: 2 }) - 0.5);       // vertical streaks
    const k = 1 + low * variation * 2 + fine * grain + st * streaks;
    put(al, w, x, y, clamp01(base[0] * k), clamp01(base[1] * k), clamp01(base[2] * k * 0.995));
    hgt[y * w + x] = fine * 0.6 + low * 0.2;
    rough[y * w + x] = clamp01(0.86 + fine * 0.15);
    ao[y * w + x] = 1;
  }
  return { w, h, albedo: al, normal: heightToNormal(hgt, w, h, 1.2), orm: packORM(w, h, ao, rough, 0) };
}

/** Rectangular pavers in running bond. tile = metres per image; unit sizes in metres. */
function pavers({ size = 1024, tile = 2, unitW = 0.2, unitH = 0.1, joint = 0.006, color = '#A8A59F', seed = 11, tint = 0.07 } = {}) {
  const w = size, h = size, n = makeNoise(seed), base = rgb(color);
  const cols = Math.round(tile / unitW), rows = Math.round(tile / unitH);
  const al = img(w, h), hgt = new Float32Array(w * h), rough = new Float32Array(w * h), ao = new Float32Array(w * h);
  const jU = joint / tile;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const row = Math.floor(v * rows), off = (row % 2) * 0.5;
    const cu = (u * cols + off), col = Math.floor(cu), fu = cu - col, fv = v * rows - row;
    const ju = jU * cols, jv = jU * rows;
    const edge = Math.min(fu, 1 - fu) / ju, edgeV = Math.min(fv, 1 - fv) / jv, e = Math.min(edge, edgeV);
    const inJoint = e < 1;
    const id = ((col % cols + cols) % cols) * 131 + row * 17;
    const unitTone = ((Math.sin(id * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const g = n.fbm(u, v, { period: 32, octaves: 3 }) - 0.5;
    let k = 1 + (unitTone - 0.5) * tint * 2 + g * 0.12;
    if (inJoint) k *= 0.55;
    put(al, w, x, y, clamp01(base[0] * k), clamp01(base[1] * k), clamp01(base[2] * k));
    hgt[y * w + x] = inJoint ? -0.6 : smooth(0, 2.5, e) * 0.3 + g * 0.2;
    rough[y * w + x] = inJoint ? 0.95 : clamp01(0.82 + g * 0.2);
    ao[y * w + x] = inJoint ? 0.6 : mix(0.8, 1, smooth(0, 2.5, e));
  }
  return { w, h, albedo: al, normal: heightToNormal(hgt, w, h, 2.5), orm: packORM(w, h, ao, rough, 0) };
}

/** Asphalt with aggregate speckle and tyre-wear tone. */
function asphalt({ size = 1024, color = '#4A4C4F', seed = 13 } = {}) {
  const w = size, h = size, n = makeNoise(seed), base = rgb(color);
  const al = img(w, h), hgt = new Float32Array(w * h), rough = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const low = n.fbm(u, v, { period: 4, octaves: 3 }) - 0.5;
    const sp = n.noise(u, v, 256), sp2 = n.noise(u + 0.37, v + 0.11, 512);
    let k = 1 + low * 0.18 + (sp > 0.82 ? 0.35 : 0) + (sp2 < 0.1 ? -0.25 : 0);
    put(al, w, x, y, clamp01(base[0] * k), clamp01(base[1] * k), clamp01(base[2] * k));
    hgt[y * w + x] = sp * 0.5 + sp2 * 0.3;
    rough[y * w + x] = clamp01(0.9 - (sp > 0.82 ? 0.15 : 0));
  }
  return { w, h, albedo: al, normal: heightToNormal(hgt, w, h, 1.5), orm: packORM(w, h, 1, rough, 0) };
}

/** Lawn: multi-scale green variation; optional mowing stripes (stripe width metres). */
function lawn({ size = 1024, tile = 8, color = '#5E8A3A', seed = 17, stripes = 0 } = {}) {
  const w = size, h = size, n = makeNoise(seed), base = rgb(color);
  const al = img(w, h), hgt = new Float32Array(w * h), rough = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const low = n.fbm(u, v, { period: 3, octaves: 3 }) - 0.5;
    const blade = n.noise(u, v, 384), mid = n.fbm(u, v, { period: 24, octaves: 2 }) - 0.5;
    let k = 1 + low * 0.25 + mid * 0.18 + (blade - 0.5) * 0.25;
    if (stripes) k *= (Math.floor(u * tile / stripes) % 2) ? 1.07 : 0.94;
    const yel = clamp01(low * 0.6);
    put(al, w, x, y, clamp01(base[0] * k + yel * 0.08), clamp01(base[1] * k), clamp01(base[2] * k * 0.95));
    hgt[y * w + x] = blade;
    rough[y * w + x] = 0.95;
  }
  return { w, h, albedo: al, normal: heightToNormal(hgt, w, h, 1.0), orm: packORM(w, h, 1, rough, 0) };
}

/** Generic noise-based concrete / stone. */
function concrete({ size = 512, color = '#C9C6BE', seed = 19, rough = 0.85 } = {}) {
  const w = size, h = size, n = makeNoise(seed), base = rgb(color);
  const al = img(w, h), hgt = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h, g = n.fbm(u, v, { period: 8, octaves: 4 }) - 0.5, f = n.noise(u, v, 128) - 0.5;
    const k = 1 + g * 0.12 + f * 0.05;
    put(al, w, x, y, clamp01(base[0] * k), clamp01(base[1] * k), clamp01(base[2] * k));
    hgt[y * w + x] = f;
  }
  return { w, h, albedo: al, normal: heightToNormal(hgt, w, h, 0.8), orm: packORM(w, h, 1, rough, 0) };
}

/** Timber deck boards along U. tile metres per image, board width metres. */
function deck({ size = 1024, tile = 2, board = 0.14, gap = 0.006, color = '#D8C0A4', seed = 23 } = {}) {
  const w = size, h = size, n = makeNoise(seed), base = rgb(color), boards = Math.round(tile / board);
  const al = img(w, h), hgt = new Float32Array(w * h), rough = new Float32Array(w * h), ao = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h, bi = Math.floor(v * boards), fv = v * boards - bi;
    const seg = Math.floor(u * 2 + ((bi * 0.37) % 1)), id = bi * 7 + seg * 13;
    const tone = ((Math.sin(id * 78.233) * 43758.5453) % 1 + 1) % 1;
    const grain = n.fbm(u * 0.5, v * 8, { period: 16, octaves: 3 }) - 0.5;
    const g = gap / board, inGap = fv < g || fv > 1 - g;
    let k = 1 + (tone - 0.5) * 0.16 + grain * 0.22;
    if (inGap) k *= 0.35;
    put(al, w, x, y, clamp01(base[0] * k), clamp01(base[1] * k * 0.98), clamp01(base[2] * k * 0.95));
    hgt[y * w + x] = inGap ? -1 : grain * 0.4;
    rough[y * w + x] = inGap ? 1 : 0.7 + grain * 0.2;
    ao[y * w + x] = inGap ? 0.5 : 1;
  }
  return { w, h, albedo: al, normal: heightToNormal(hgt, w, h, 2), orm: packORM(w, h, ao, rough, 0) };
}

/** Square mosaic tiles with grout. */
function mosaic({ size = 1024, tile = 1, unit = 0.025, color = '#A8CAD9', seed = 29, tint = 0.12 } = {}) {
  const w = size, h = size, base = rgb(color), cells = Math.round(tile / unit), n = makeNoise(seed);
  const al = img(w, h), hgt = new Float32Array(w * h), rough = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x * cells / w, v = y * cells / h, cx = Math.floor(u), cy = Math.floor(v), fx = u - cx, fy = v - cy;
    const grout = fx < 0.07 || fy < 0.07;
    const t = ((Math.sin((cx * 31 + cy * 57 + seed) * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const k = grout ? 1.15 : 1 + (t - 0.5) * tint * 2;
    const bl = grout ? 0 : (t > 0.85 ? 0.08 : 0);
    put(al, w, x, y, clamp01(base[0] * k - bl), clamp01(base[1] * k), clamp01(base[2] * k + bl));
    hgt[y * w + x] = grout ? -0.5 : 0.2 + n.noise(x / w, y / h, 64) * 0.05;
    rough[y * w + x] = grout ? 0.9 : 0.15;
  }
  return { w, h, albedo: al, normal: heightToNormal(hgt, w, h, 2), orm: packORM(w, h, 1, rough, 0) };
}

/** Large-format floor tiles (gym etc.). tileW/H metres; image covers tile metres. */
function floorTiles({ size = 1024, tile = 2.4, tileW = 1.2, tileH = 0.6, color = '#A5A5A0', seed = 31 } = {}) {
  const w = size, h = size, base = rgb(color), n = makeNoise(seed);
  const cols = Math.round(tile / tileW), rows = Math.round(tile / tileH);
  const al = img(w, h), hgt = new Float32Array(w * h), rough = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h, fu = (u * cols) % 1, fv = (v * rows) % 1;
    const j = 0.002 / tileW, jv = 0.002 / tileH, grout = fu < j || fu > 1 - j || fv < jv || fv > 1 - jv;
    const g = n.fbm(u, v, { period: 16, octaves: 4 }) - 0.5;
    const k = grout ? 0.75 : 1 + g * 0.1;
    put(al, w, x, y, clamp01(base[0] * k), clamp01(base[1] * k), clamp01(base[2] * k));
    hgt[y * w + x] = grout ? -1 : 0;
    rough[y * w + x] = grout ? 0.9 : 0.55 + g * 0.1;
  }
  return { w, h, albedo: al, normal: heightToNormal(hgt, w, h, 1.5), orm: packORM(w, h, 1, rough, 0) };
}

/** Plain solid with subtle noise (fallback / tests). */
function solid({ size = 64, color = '#808080', rough = 0.8 } = {}) {
  const w = size, h = size, c = rgb(color), al = img(w, h);
  for (let i = 0; i < w * h; i++) { al[i * 4] = c[0] * 255; al[i * 4 + 1] = c[1] * 255; al[i * 4 + 2] = c[2] * 255; al[i * 4 + 3] = 255; }
  return { w, h, albedo: al, orm: packORM(w, h, 1, rough, 0) };
}

/** Cloud dome (equirect upper hemisphere): white RGB, soft cumulus alpha thinning toward the zenith/horizon. */
function clouds({ w = 1024, h = 256, seed = 37, cover = 0.55, softness = 0.2 } = {}) {
  const n = makeNoise(seed), al = img(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;                 // v=0 horizon .. v=1 zenith
    const stretch = 1 + (1 - v) * 3;             // flatter near the horizon (perspective)
    const f = n.fbm(u, v / stretch * 0.5, { period: 8, octaves: 5, gain: 0.55 });
    // v1.1 clean air: scattered fair-weather cumulus, clear low sky (no smog band at the horizon)
    const a = smooth(cover, cover + softness, f) * smooth(0.06, 0.32, v) * (1 - smooth(0.7, 1, v) * 0.6);
    const shade = 0.82 + 0.18 * smooth(cover, cover + softness * 2, f);   // darker bases
    put(al, w, x, y, shade, shade, shade * 1.0, a);
  }
  return { w, h, albedo: al };
}

export const recipes = { plaster, pavers, asphalt, lawn, concrete, deck, mosaic, floorTiles, solid, clouds };
