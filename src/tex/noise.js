// Tileable noise + image helpers for texture recipes (runs in a Worker; no DOM, no THREE).
// Convention: a recipe image covers exactly 1 UV unit; recipes take `tile` (metres per image) when it matters.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Periodic value noise. period = lattice cells per image (integer) so it tiles. */
export function makeNoise(seed = 1) {
  const r = mulberry32(seed);
  const N = 256, perm = new Uint8Array(N * 2), vals = new Float32Array(N);
  for (let i = 0; i < N; i++) { perm[i] = i; vals[i] = r(); }
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < N; i++) perm[N + i] = perm[i];
  const lat = (ix, iy) => vals[perm[(perm[ix & 255] + iy) & 255]];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  /** u,v in [0,1) image space; period integer cells. Returns [0,1]. */
  function noise(u, v, period) {
    const x = u * period, y = v * period;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = fade(x - x0), fy = fade(y - y0);
    const p = period | 0;
    const X0 = ((x0 % p) + p) % p, X1 = (X0 + 1) % p, Y0 = ((y0 % p) + p) % p, Y1 = (Y0 + 1) % p;
    const a = lat(X0, Y0), b = lat(X1, Y0), c = lat(X0, Y1), d = lat(X1, Y1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(u, v, { period = 4, octaves = 5, gain = 0.5, lac = 2 } = {}) {
    let amp = 0.5, sum = 0, norm = 0, p = period;
    for (let o = 0; o < octaves; o++) { sum += amp * noise(u, v, p); norm += amp; amp *= gain; p *= lac; }
    return sum / norm;
  }
  return { noise, fbm, rand: r };
}

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const mix = (a, b, t) => a + (b - a) * t;

/** '#RRGGBB' -> [r,g,b] 0..1 (sRGB, as painted). */
export function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }

/** Allocate an RGBA8 image. */
export const img = (w, h) => new Uint8ClampedArray(w * h * 4);

/** Write pixel (0..1 floats). */
export function put(a, w, x, y, r, g, b, al = 1) { const i = (y * w + x) * 4; a[i] = r * 255; a[i + 1] = g * 255; a[i + 2] = b * 255; a[i + 3] = al * 255; }

/** Tangent-space normal map (OpenGL convention, +Y up) from a Float32 height field (wrapping). */
export function heightToNormal(hgt, w, h, strength = 2) {
  const out = img(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = hgt[y * w + ((x - 1 + w) % w)], r = hgt[y * w + ((x + 1) % w)];
    const u = hgt[((y - 1 + h) % h) * w + x], d = hgt[((y + 1) % h) * w + x];
    // image y grows downward; DataTexture flipY=false => row 0 is v=0 (bottom). Treat row index as +v.
    let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    put(out, w, x, y, nx * 0.5 + 0.5, ny * 0.5 + 0.5, nz * 0.5 + 0.5, 1);
  }
  return out;
}

/** Pack ORM: R = ao, G = roughness, B = metalness (floats arrays or constants). */
export function packORM(w, h, ao, rough, metal = 0) {
  const out = img(w, h);
  for (let i = 0; i < w * h; i++) {
    const a = typeof ao === 'number' ? ao : ao[i], r = typeof rough === 'number' ? rough : rough[i], m = typeof metal === 'number' ? metal : metal[i];
    out[i * 4] = a * 255; out[i * 4 + 1] = r * 255; out[i * 4 + 2] = m * 255; out[i * 4 + 3] = 255;
  }
  return out;
}
