// Texture recipes owned by the amenities module (also used by vegetation). Same contract as recipes-base.js:
// (params) => { w, h, albedo, normal?, orm?, alpha?, emissive? } as RGBA8 Uint8ClampedArray, tiling, 1 UV unit per image.
// Row 0 of an image = v 0 (flipY = false).
import { makeNoise, mulberry32, img, put, heightToNormal, packORM, rgb, mix, clamp01, smooth } from './noise.js';

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
      const fold = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (u * 4 + wob));
      const streak = n.noise(u, v * 0.1, 64) - 0.5;
      const k = 0.9 + 0.07 * fold + streak * 0.03 - (v < 0.03 ? 0.05 : 0);
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

/** Foliage card atlas (2x2 quadrants, each 0.5 UV): opaque colour map everywhere + a separate alpha map.
 *  A (u0-.5, v0-.5): broadleaf sprig cluster (trees)   B (u.5-1, v0-.5): small-leaf cluster (shrubs, hedge edges)
 *  C (u0-.5, v.5-1): bougainvillea (leaves + magenta bracts)   D (u.5-1, v.5-1): opaque leaf mass (canopy cores, hedge faces).
 *  Leaf colours are real (desaturated mid greens); vertex/instance colours add AO, sun-side warmth and per-plant variation. */
function leafAtlas({ size = 1024, seed = 67 } = {}) {
  const w = size, h = size, Q = w / 2, R = mulberry32(seed);
  const col = new Float32Array(w * h * 3), alpha = new Float32Array(w * h);
  const greens = ['#5E8048', '#6A8C4E', '#557745', '#7A9758', '#4F703F', '#86A05C'].map(rgb);
  const young = rgb('#A4B266'), twig = rgb('#5C4E3E');
  const bg = rgb('#5A7A44');
  for (let i = 0; i < w * h; i++) { col[i * 3] = bg[0]; col[i * 3 + 1] = bg[1]; col[i * 3 + 2] = bg[2]; }
  const blend = (x, y, c, a, wrap) => {
    if (wrap) { x = wrap.x0 + (((x - wrap.x0) % Q) + Q) % Q; y = wrap.y0 + (((y - wrap.y0) % Q) + Q) % Q; }
    else if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    col[i * 3] = mix(col[i * 3], c[0], a); col[i * 3 + 1] = mix(col[i * 3 + 1], c[1], a); col[i * 3 + 2] = mix(col[i * 3 + 2], c[2], a);
    alpha[i] = Math.max(alpha[i], a);
  };
  /** Pointed elliptic leaf with a midrib and a light/shade split across it. */
  function leaf(cx, cy, ang, L, W, base, tone, wrap = null, round = 0.8) {
    const ca = Math.cos(ang), sa = Math.sin(ang), ext = Math.ceil(L / 2 + 2);
    for (let y = Math.floor(cy - ext); y <= cy + ext; y++) for (let x = Math.floor(cx - ext); x <= cx + ext; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, s = dx * ca + dy * sa, t = -dx * sa + dy * ca;
      const p = s / L + 0.5; if (p <= 0 || p >= 1) continue;
      const hw = (W / 2) * Math.pow(Math.sin(Math.PI * Math.pow(p, 0.85)), round);
      const cov = clamp01(hw - Math.abs(t) + 0.5); if (cov <= 0) continue;
      const side = t > 0 ? 1.1 : 0.88, rib = Math.abs(t) < 0.7 ? 1.18 : 1, edge = 1 - 0.18 * smooth(0.55, 1, Math.abs(t) / Math.max(hw, 0.5));
      const k = tone * side * rib * edge * (0.86 + 0.18 * p);
      blend(x, y, [base[0] * k, base[1] * k, base[2] * k], cov, wrap);
    }
  }
  function line(x0, y0, x1, y1, th, c) {
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(L);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, r = th * (1 - 0.6 * t);
      for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
        const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y); if (d < r + 0.5) blend(xx, yy, c, clamp01(r + 0.5 - d), null);
      }
    }
  }
  const pickGreen = () => { const a = greens[Math.floor(R() * greens.length)], b = greens[Math.floor(R() * greens.length)], t = R(); return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; };
  /** Radial sprig cluster inside quadrant (qx, qy): twigs from the centre, leaves along them, back-to-front. */
  function cluster(qx, qy, { n, Lmin, Lmax, aspect, twigs, rad = 0.44 }) {
    const cx = qx + Q / 2, cy = qy + Q / 2, rMax = Q * rad, arms = [];
    for (let i = 0; i < twigs; i++) {
      const a = (i / twigs) * Math.PI * 2 + (R() - 0.5) * 0.6, len = rMax * (0.7 + 0.3 * R());
      arms.push([a, len]);
      line(cx, cy, cx + Math.cos(a) * len * 0.85, cy + Math.sin(a) * len * 0.85, 2.2, twig);
    }
    for (let i = 0; i < n; i++) {
      const [a, len] = arms[Math.floor(R() * arms.length)], t = Math.pow(R(), 0.7);
      const px = cx + Math.cos(a) * len * t + (R() - 0.5) * Q * 0.08, py = cy + Math.sin(a) * len * t + (R() - 0.5) * Q * 0.08;
      const L = Lmin + (Lmax - Lmin) * R() * (0.75 + 0.25 * t), lang = a + (R() - 0.5) * 1.9;
      const off = L * 0.45, lx = px + Math.cos(lang) * off, ly = py + Math.sin(lang) * off;
      if (Math.hypot(lx - cx, ly - cy) + L / 2 > Q * 0.49) continue;               // keep a clear gutter (mip bleed)
      const depth = 0.72 + 0.28 * (i / n);                                           // later leaves are on top -> brighter
      const base = R() < 0.1 ? young : pickGreen();
      leaf(lx, ly, lang, L, L / aspect, base, depth * (0.9 + 0.2 * R()));
    }
  }
  cluster(0, 0, { n: 330, Lmin: 34, Lmax: 58, aspect: 2.1, twigs: 9 });            // A: trees
  cluster(Q, 0, { n: 850, Lmin: 20, Lmax: 32, aspect: 2.2, twigs: 15 });           // B: shrubs
  cluster(0, Q, { n: 300, Lmin: 20, Lmax: 32, aspect: 2.0, twigs: 11 });            // C: bougainvillea leaves...
  { // ...plus magenta bract clusters on top (3 papery petals each)
    const mag = ['#C8327E', '#D6488F', '#B52A70', '#DE5C9C'].map(rgb), cream = rgb('#F2E6C8');
    for (let k = 0; k < 70; k++) {
      const a = R() * Math.PI * 2, r = Q * 0.36 * Math.sqrt(R()), gx = Q / 2 + Math.cos(a) * r, gy = Q + Q / 2 + Math.sin(a) * r;
      const c = mag[Math.floor(R() * mag.length)];
      for (let b = 0; b < 7; b++) {
        const bx = gx + (R() - 0.5) * 30, by = gy + (R() - 0.5) * 30, rot = R() * 6.28, s = 9 + R() * 5;
        for (let p = 0; p < 3; p++) { const pa = rot + (p * Math.PI * 2) / 3; leaf(bx + Math.cos(pa) * s * 0.45, by + Math.sin(pa) * s * 0.45, pa, s, s * 0.85, c, 0.85 + 0.25 * R(), null, 0.55); }
        blend(Math.round(bx), Math.round(by), cream, 1, null);
      }
    }
  }
  { // D: opaque, tiling leaf mass (dark under-layer, then dense leaves wrapped within the quadrant)
    const dark = rgb('#3E5A33');
    for (let y = Q; y < h; y++) for (let x = Q; x < w; x++) { const i = y * w + x; col[i * 3] = dark[0]; col[i * 3 + 1] = dark[1]; col[i * 3 + 2] = dark[2]; }
    const wrap = { x0: Q, y0: Q };
    for (let i = 0; i < 1500; i++) {
      const L = 22 + R() * 18, depth = 0.65 + 0.35 * (i / 1500);
      leaf(Q + R() * Q, Q + R() * Q, R() * 6.28, L, L / 2.2, R() < 0.08 ? young : pickGreen(), depth * (0.9 + 0.2 * R()), wrap);
    }
    for (let y = Q; y < h; y++) for (let x = Q; x < w; x++) alpha[y * w + x] = 1;
  }
  const al = img(w, h), am = img(w, h);
  for (let i = 0; i < w * h; i++) {
    const x = i % w, y = (i / w) | 0;
    put(al, w, x, y, clamp01(col[i * 3]), clamp01(col[i * 3 + 1]), clamp01(col[i * 3 + 2]));
    put(am, w, x, y, alpha[i], alpha[i], alpha[i], 1);
  }
  return { w, h, albedo: al, alpha: am };
}

export const recipes = { caustics, waterNormal, epdm, grating, curtain, palmFrond, palmBark, leafAtlas };
