// Texture recipes owned by the tower module. Same contract as recipes-base.js:
// (params) => { w, h, albedo, normal?, orm?, alpha?, emissive? } as RGBA8 Uint8ClampedArray, 1 UV unit per image.
// Row 0 of every image is v = 0 (flipY = false), so "up" in an image is +row.
import { makeNoise, img, put, heightToNormal, packORM, rgb, mix, clamp01, smooth } from './noise.js';

const hash = (i) => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const inBox = (u, v, u0, u1, v0, v1) => u >= u0 && u <= u1 && v >= v0 && v <= v1;
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const lerp3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/* ------------------------------------------------------------------------------------------------
 * Interior-mapping room atlas (2048 x 1024): 8 room variants in a 4 x 2 grid of 512 px tiles.
 * Each tile holds 4 quadrants of 256 px: back wall (0,0), side wall (0.5,0), floor (0,0.5), ceiling (0.5,0.5).
 *   back wall: u = across the room (left -> right from outside), v = floor -> ceiling
 *   side wall: u = depth (0 at the window wall -> 1 at the back wall), v = floor -> ceiling
 *   floor / ceiling: u = across, v = depth (0 at the window -> 1 at the back)
 * AO is painted into the corners; daylight falloff away from the window is painted into the side walls.
 * The shader (src/materials/tower.js) uses the same layout.
 * ---------------------------------------------------------------------------------------------- */
const ROOMS = [
  { wall: '#E6D7BD', side: '#E9DCC6', floor: '#8A6243', ft: 'wood', rug: '#9A7A5C', furn: 'sofa', fab: '#6F6052', art: '#5E7C8A', wood: '#5A4030', ceil: '#F1ECE3' },
  { wall: '#EEE9DF', side: '#EEE9E0', floor: '#CFC5B5', ft: 'tile', rug: '#B49A86', furn: 'bed', fab: '#E3DBCF', art: '#8C6F5A', wood: '#6B4D36', ceil: '#F4F1EB' },
  { wall: '#C3C9B0', side: '#D9D9C6', floor: '#7B573A', ft: 'wood', rug: '#C9BBA0', furn: 'sofa', fab: '#DCD2BF', art: '#B5643E', wood: '#4E3828', ceil: '#EFEDE6' },
  { wall: '#C98E66', side: '#E7D9C4', floor: '#B7A48A', ft: 'tile', rug: '#7C6A5A', furn: 'tv', fab: '#77787C', art: '#3E5B6E', wood: '#5A4030', ceil: '#F3EEE6' },
  { wall: '#CFCECA', side: '#D8D6D0', floor: '#9D978C', ft: 'tile', rug: '#4E5562', furn: 'sofa', fab: '#404857', art: '#C9A15A', wood: '#3D3530', ceil: '#F1F1EE' },
  { wall: '#F0E9DC', side: '#EFE8DB', floor: '#D6CFC1', ft: 'tile', rug: null, furn: 'kitchen', fab: '#DCD6CC', art: '#7D8F6A', wood: '#8A6A4C', ceil: '#F6F3EE' },
  { wall: '#CBB596', side: '#D7C4A6', floor: '#6A4931', ft: 'wood', rug: '#8E3F2E', furn: 'shelves', fab: '#7A5C44', art: '#6F7F5C', wood: '#5C4230', ceil: '#EEE8DD' },
  { wall: '#B9C6CE', side: '#D3D9DB', floor: '#A98C6B', ft: 'wood', rug: '#D8CBB4', furn: 'bed', fab: '#E9E5DD', art: '#C08F5E', wood: '#7D5B40', ceil: '#F2F2EF' },
].map((r) => {
  const o = {};
  for (const [k, v] of Object.entries(r)) o[k] = typeof v === 'string' && v[0] === '#' ? rgb(v) : v;
  return o;
});
const LAMP = rgb('#FFF1D2'), DARK = rgb('#2B231D'), SCREEN = rgb('#121314'), PLANT = rgb('#4C6B3A');

function cornerAO(u, v, a = 0.06) {
  return (0.55 + 0.45 * smooth(0, a, u)) * (0.55 + 0.45 * smooth(0, a, 1 - u)) *
    (0.62 + 0.38 * smooth(0, a, v)) * (0.66 + 0.34 * smooth(0, a, 1 - v));
}

function backWall(R, vi, u, v) {
  let c = R.wall;
  if (v < 0.035) c = mul(R.wall, 0.72);                                   // skirting
  const f = R.furn;
  if (f === 'sofa') {
    if (inBox(u, v, 0.36, 0.64, 0.46, 0.68)) {                               // framed picture
      c = inBox(u, v, 0.37, 0.63, 0.475, 0.665) ? lerp3(R.art, [0.92, 0.88, 0.8], smooth(0.47, 0.67, v) * 0.6) : DARK;
    }
    if (inBox(u, v, 0.875, 0.888, 0.035, 0.56)) c = DARK;                    // floor lamp pole
    if (inBox(u, v, 0.845, 0.92, 0.56, 0.67)) c = LAMP;                      // lamp shade
    if (inBox(u, v, 0.2, 0.8, 0.05, 0.27)) c = R.fab;                        // sofa body
    if (inBox(u, v, 0.22, 0.78, 0.27, 0.35)) c = mul(R.fab, 1.1);            // back cushions
    if (inBox(u, v, 0.18, 0.22, 0.05, 0.3) || inBox(u, v, 0.78, 0.82, 0.05, 0.3)) c = mul(R.fab, 0.85);
    if (inBox(u, v, 0.2, 0.8, 0.035, 0.05)) c = mul(R.fab, 0.4);             // shadow under sofa
  } else if (f === 'bed') {
    if (inBox(u, v, 0.4, 0.6, 0.55, 0.7)) c = inBox(u, v, 0.41, 0.59, 0.56, 0.69) ? R.art : DARK;
    if (inBox(u, v, 0.22, 0.78, 0.035, 0.45)) c = R.wood;                    // headboard
    if (inBox(u, v, 0.2, 0.8, 0.035, 0.2)) c = R.fab;                        // linen
    if (inBox(u, v, 0.26, 0.47, 0.2, 0.27) || inBox(u, v, 0.53, 0.74, 0.2, 0.27)) c = mul(R.fab, 1.06);
    if (inBox(u, v, 0.08, 0.18, 0.035, 0.17) || inBox(u, v, 0.82, 0.92, 0.035, 0.17)) c = mul(R.wood, 0.9);
    if (inBox(u, v, 0.1, 0.16, 0.17, 0.27) || inBox(u, v, 0.84, 0.9, 0.17, 0.27)) c = LAMP;
  } else if (f === 'tv') {
    if (inBox(u, v, 0.28, 0.72, 0.3, 0.56)) c = inBox(u, v, 0.29, 0.71, 0.31, 0.55) ? SCREEN : DARK;
    if (inBox(u, v, 0.15, 0.85, 0.035, 0.17)) c = inBox(u, v, 0.15, 0.85, 0.16, 0.17) ? mul(R.wood, 1.2) : R.wood;
    const dx = (u - 0.92) / 0.06, dy = (v - 0.3) / 0.16;
    if (dx * dx + dy * dy < 1) c = mul(PLANT, 0.8 + 0.4 * hash(Math.floor(u * 90) + Math.floor(v * 60) * 7));
    if (inBox(u, v, 0.89, 0.95, 0.035, 0.15)) c = rgb('#B9A48C');
  } else if (f === 'kitchen') {
    if (inBox(u, v, 0, 1, 0.035, 0.31)) { c = R.wood; if ((u * 8) % 1 < 0.02) c = mul(R.wood, 0.6); }
    if (inBox(u, v, 0, 1, 0.31, 0.34)) c = R.fab;
    if (inBox(u, v, 0, 1, 0.34, 0.52)) { c = rgb('#E7E2D8'); if ((u * 28) % 1 < 0.06 || (v * 50) % 1 < 0.08) c = rgb('#CFC8BB'); }
    if (inBox(u, v, 0, 1, 0.56, 0.84)) { c = mul(R.wood, 1.25); if ((u * 6) % 1 < 0.02) c = mul(R.wood, 0.7); }
    if (inBox(u, v, 0.3, 0.36, 0.84, 0.92) || inBox(u, v, 0.64, 0.7, 0.84, 0.92)) c = LAMP;
  } else if (f === 'shelves') {
    if (inBox(u, v, 0.08, 0.92, 0.035, 0.88)) {
      c = R.wood;
      const row = Math.floor((v - 0.035) / 0.13), fv = ((v - 0.035) / 0.13) % 1;
      if (fv > 0.1) {
        const bi = Math.floor(u * 70), hb = hash(bi * 13 + row * 101 + vi * 7);
        if (hb > 0.18 && fv < 0.62 + 0.3 * hash(bi + row * 3)) c = lerp3(rgb('#8C3B2E'), rgb('#3E5A6E'), hash(bi * 3 + row)), c = mul(c, 0.7 + 0.5 * hb);
        else c = mul(R.wood, 0.55);
      }
    }
  }
  return mul(c, cornerAO(u, v) * (0.97 + 0.06 * v));
}

function sideWall(R, vi, u, v) {
  let c = R.side;
  if (v < 0.035) c = mul(R.side, 0.72);
  const f = R.furn;
  if (f === 'bed' && inBox(u, v, 0.45, 0.95, 0.035, 0.8)) { c = mul(R.wood, 1.25); if (Math.abs(u - 0.7) < 0.004) c = mul(R.wood, 0.6); }
  else if (f === 'kitchen') {
    if (inBox(u, v, 0.3, 1, 0.035, 0.31)) c = R.wood;
    if (inBox(u, v, 0.3, 1, 0.31, 0.34)) c = R.fab;
    if (inBox(u, v, 0.3, 1, 0.56, 0.84)) c = mul(R.wood, 1.25);
  } else if (f === 'shelves' && inBox(u, v, 0.5, 0.98, 0.035, 0.88)) {
    c = mul(R.wood, 0.9);
  } else {
    if (inBox(u, v, 0.55, 0.78, 0.035, 0.74)) c = inBox(u, v, 0.565, 0.765, 0.035, 0.725) ? rgb('#7A5A40') : mul(R.side, 0.85);  // door
    if (inBox(u, v, 0.22, 0.4, 0.45, 0.63)) c = inBox(u, v, 0.23, 0.39, 0.46, 0.62) ? R.art : DARK;
  }
  const ao = (0.6 + 0.4 * smooth(0, 0.07, 1 - u)) * (0.8 + 0.2 * smooth(0, 0.04, u)) * (0.62 + 0.38 * smooth(0, 0.05, v)) * (0.68 + 0.32 * smooth(0, 0.05, 1 - v));
  return mul(c, ao * (1.06 - 0.28 * u));
}

function floorQ(R, vi, u, v) {
  let c;
  if (R.ft === 'wood') {
    const b = Math.floor(u * 14), fu = (u * 14) % 1, seg = Math.floor(v * 2 + hash(b) * 2);
    c = mul(R.floor, 0.86 + 0.26 * hash(b * 7 + seg * 31 + vi));
    if (fu < 0.05) c = mul(R.floor, 0.6);
  } else {
    const fu = (u * 6) % 1, fv = (v * 6) % 1;
    c = mul(R.floor, 0.95 + 0.08 * hash(Math.floor(u * 6) + Math.floor(v * 6) * 9 + vi));
    if (fu < 0.02 || fv < 0.02) c = mul(R.floor, 0.78);
  }
  if (R.rug && inBox(u, v, 0.18, 0.82, 0.25, 0.78)) c = inBox(u, v, 0.21, 0.79, 0.28, 0.75) ? R.rug : mul(R.rug, 0.75);
  let k = 1;
  if (v > 0.82 && u > 0.18 && u < 0.82 && R.furn !== 'kitchen') k *= 0.6;          // furniture contact shadow
  if (R.furn === 'kitchen' && (v > 0.85 || u > 0.88)) k *= 0.55;
  k *= (0.62 + 0.38 * smooth(0, 0.06, u)) * (0.62 + 0.38 * smooth(0, 0.06, 1 - u)) * (0.55 + 0.45 * smooth(0, 0.08, 1 - v));
  return mul(c, k * (1.05 - 0.25 * v));
}

function ceilQ(R, vi, u, v) {
  let c = R.ceil;
  const dx = u - 0.5, dy = v - 0.5, r = Math.hypot(dx, dy * 1.1);
  if (r < 0.05) c = LAMP;
  else if (r < 0.065) c = mul(R.ceil, 0.8);
  if (Math.min(u, 1 - u, v, 1 - v) < 0.035) c = mul(R.ceil, 0.88);                // cove
  const ao = (0.6 + 0.4 * smooth(0, 0.08, u)) * (0.6 + 0.4 * smooth(0, 0.08, 1 - u)) * (0.6 + 0.4 * smooth(0, 0.1, 1 - v));
  return r < 0.05 ? c : mul(c, ao * (1.0 - 0.2 * v));
}

function rooms({ w = 2048, h = 1024, seed = 61 } = {}) {
  const n = makeNoise(seed), al = img(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const U = (x + 0.5) / w, V = (y + 0.5) / h;
    const col = Math.min(3, Math.floor(U * 4)), row = Math.min(1, Math.floor(V * 2));
    const tu = U * 4 - col, tv = V * 2 - row, vi = row * 4 + col, R = ROOMS[vi];
    const qx = tu >= 0.5 ? 1 : 0, qy = tv >= 0.5 ? 1 : 0;
    const lu = (tu - qx * 0.5) * 2, lv = (tv - qy * 0.5) * 2;
    let c;
    if (!qx && !qy) c = backWall(R, vi, lu, lv);
    else if (qx && !qy) c = sideWall(R, vi, lu, lv);
    else if (!qx && qy) c = floorQ(R, vi, lu, lv);
    else c = ceilQ(R, vi, lu, lv);
    const g = 1 + (n.noise(U, V, 256) - 0.5) * 0.05;
    put(al, w, x, y, clamp01(c[0] * g), clamp01(c[1] * g), clamp01(c[2] * g));
  }
  return { w, h, albedo: al };
}

/* ------------------------------------------------------------------------------------------------
 * Ornament atlas (1024 x 1024): plaster relief work, normal + ORM + albedo.
 *   R  u[0,1]   v[0.5,1]   relief panel (C-scroll pair + medallion), metric 4 x 1 (panel ~1.6 x 0.4 m)
 *   C  u[0,.5]  v[0,.5]    pediment cartouche (oval shield + side volutes + shell crest), metric 1.6 x 1
 *   K  u[.5,1]  v[.25,.5]  scroll capital (abacus, egg band, two volutes), metric 2.4 x 1
 *   P  u[.5,1]  v[0,.25]   plain moulded field (box sides)
 * ---------------------------------------------------------------------------------------------- */
function ornament({ size = 1024, color = '#D1BF9A', seed = 41 } = {}) {
  const w = size, h = size, n = makeNoise(seed), base = rgb(color);
  const H = new Float32Array(w * h);
  const regions = {
    R: { x0: 0, y0: h / 2, pw: w, ph: h / 2, MX: 4, MY: 1 },
    C: { x0: 0, y0: 0, pw: w / 2, ph: h / 2, MX: 1.6, MY: 1 },
    K: { x0: w / 2, y0: h / 4, pw: w / 2, ph: h / 4, MX: 2.4, MY: 1 },
    P: { x0: w / 2, y0: 0, pw: w / 2, ph: h / 4, MX: 2, MY: 1 },
  };
  const each = (r, fn) => {
    for (let py = r.y0; py < r.y0 + r.ph; py++) for (let px = r.x0; px < r.x0 + r.pw; px++) {
      const X = ((px - r.x0 + 0.5) / r.pw) * r.MX, Yy = ((py - r.y0 + 0.5) / r.ph) * r.MY;
      const i = py * w + px; H[i] = fn(X, Yy, H[i]);
    }
  };
  // max-blend a rounded bead (radius rad, metric) centred on (cx, cy) in region r
  const stamp = (r, cx, cy, rad, top, floor = 0) => {
    const rx = Math.ceil((rad / r.MX) * r.pw) + 1, ry = Math.ceil((rad / r.MY) * r.ph) + 1;
    const pcx = r.x0 + (cx / r.MX) * r.pw, pcy = r.y0 + (cy / r.MY) * r.ph;
    for (let py = Math.max(r.y0, Math.floor(pcy - ry)); py < Math.min(r.y0 + r.ph, pcy + ry); py++) {
      for (let px = Math.max(r.x0, Math.floor(pcx - rx)); px < Math.min(r.x0 + r.pw, pcx + rx); px++) {
        const X = ((px - r.x0 + 0.5) / r.pw) * r.MX, Yy = ((py - r.y0 + 0.5) / r.ph) * r.MY;
        const d = Math.hypot(X - cx, Yy - cy) / rad;
        if (d < 1) { const i = py * w + px; const v = floor + (top - floor) * Math.sqrt(1 - d * d); if (v > H[i]) H[i] = v; }
      }
    }
  };
  const stroke = (r, pts, rad0, rad1, top, floor) => {
    for (let k = 0; k < pts.length; k++) { const t = k / Math.max(1, pts.length - 1); stamp(r, pts[k][0], pts[k][1], mix(rad0, rad1, t), top, floor); }
  };
  // spiral volute: centre, start radius, end radius, start angle, turns, direction
  const volute = (cx, cy, r0, r1, a0, turns, dir, step = 0.008) => {
    const pts = [], L = Math.PI * 2 * turns * r0, nS = Math.max(12, Math.ceil(L / step));
    for (let k = 0; k <= nS; k++) { const t = k / nS, a = a0 + dir * t * Math.PI * 2 * turns, rr = mix(r0, r1, t); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    return pts;
  };
  const arc = (cx, cy, rad, a0, a1, step = 0.008) => {
    const pts = [], nS = Math.max(8, Math.ceil((Math.abs(a1 - a0) * rad) / step));
    for (let k = 0; k <= nS; k++) { const a = mix(a0, a1, k / nS); pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); }
    return pts;
  };
  const quadB = (p0, p1, p2, nS = 60) => { const out = []; for (let k = 0; k <= nS; k++) { const t = k / nS, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t; out.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]]); } return out; };

  /* --- R: relief panel --- */
  const R = regions.R, FIELD = 0.22;
  each(R, (X, Yy) => {
    const e = Math.min(X, R.MX - X, Yy, R.MY - Yy);
    if (e < 0.035) return 0.45 + 0.55 * (e / 0.035);
    if (e < 0.09) return 1 - 0.08 * ((e - 0.062) / 0.028) ** 2;
    if (e < 0.13) return mix(0.92, FIELD, (e - 0.09) / 0.04);
    if (e > 0.16 && e < 0.185) return FIELD + 0.18 * Math.sin(((e - 0.16) / 0.025) * Math.PI);
    return FIELD + (n.fbm(X / 4, Yy, { period: 16, octaves: 2 }) - 0.5) * 0.03;
  });
  const cx = R.MX / 2, cy = 0.5;
  for (const s of [-1, 1]) {
    const bx = cx + s * 0.95;
    // C-scroll: arc opening toward the medallion, with volutes curling in at both ends
    const a0 = s < 0 ? Math.PI * 0.32 : Math.PI * 0.68, a1 = s < 0 ? Math.PI * 1.68 : -Math.PI * 0.68;
    stroke(R, arc(bx, cy, 0.27, a0, a1), 0.045, 0.045, 0.85, FIELD);
    const top = [bx + Math.cos(a0) * 0.27, cy + Math.sin(a0) * 0.27], bot = [bx + Math.cos(a1) * 0.27, cy + Math.sin(a1) * 0.27];
    stroke(R, volute(top[0] + s * 0.0, top[1] - 0.1, 0.1, 0.02, Math.PI / 2, 1.1, s), 0.04, 0.022, 0.8, FIELD);
    stroke(R, volute(bot[0], bot[1] + 0.1, 0.1, 0.02, -Math.PI / 2, 1.1, -s), 0.04, 0.022, 0.8, FIELD);
    // acanthus tails sweeping to the panel ends
    stroke(R, quadB([bx - s * 0.2, cy + 0.2], [bx - s * 0.55, cy + 0.36], [bx - s * 0.9, cy + 0.12]), 0.04, 0.012, 0.7, FIELD);
    stroke(R, quadB([bx - s * 0.2, cy - 0.2], [bx - s * 0.55, cy - 0.36], [bx - s * 0.9, cy - 0.12]), 0.04, 0.012, 0.7, FIELD);
    stroke(R, quadB([bx - s * 0.25, cy], [bx - s * 0.6, cy + 0.05], [bx - s * 1.0, cy]), 0.028, 0.01, 0.6, FIELD);
    // stem to the medallion
    stroke(R, quadB([bx + s * 0.27, cy], [bx + s * 0.45, cy + 0.06], [cx - s * 0.36, cy]), 0.022, 0.02, 0.6, FIELD);
  }
  each(R, (X, Yy, cur) => {                                            // medallion: rim + dome + rosette
    const dx = (X - cx) / 0.32, dy = (Yy - cy) / 0.36, rr = Math.hypot(dx, dy);
    if (rr >= 1) return cur;
    if (rr > 0.8) return Math.max(cur, 0.3 + 0.62 * (1 - Math.abs(rr - 0.9) / 0.1));
    const th = Math.atan2(dy, dx);
    return 0.35 + 0.4 * Math.sqrt(1 - rr * rr) + (rr < 0.62 ? 0.1 * Math.max(0, Math.cos(8 * th)) * (1 - rr / 0.62) : 0);
  });

  /* --- C: cartouche --- */
  const C = regions.C, ccx = C.MX / 2, ccy = 0.5;
  each(C, () => 0.15);
  each(C, (X, Yy, cur) => {
    const dx = (X - ccx) / 0.42, dy = (Yy - ccy) / 0.33, rr = Math.hypot(dx, dy);
    if (rr >= 1) return cur;
    if (rr > 0.78) return 0.35 + 0.6 * Math.sqrt(1 - ((rr - 0.89) / 0.11) ** 2);
    return 0.5 + 0.15 * Math.sqrt(1 - rr * rr);
  });
  for (const s of [-1, 1]) {
    stroke(C, volute(ccx + s * 0.55, ccy + 0.12, 0.13, 0.02, -Math.PI / 2, 1.2, s), 0.045, 0.02, 0.85, 0.15);
    stroke(C, volute(ccx + s * 0.55, ccy - 0.14, 0.11, 0.02, Math.PI / 2, 1.1, -s), 0.04, 0.02, 0.8, 0.15);
    stroke(C, quadB([ccx + s * 0.4, ccy - 0.25], [ccx + s * 0.25, ccy - 0.42], [ccx + s * 0.05, ccy - 0.44]), 0.035, 0.012, 0.7, 0.15);
  }
  for (let k = 0; k < 7; k++) {                                        // shell crest
    const a = Math.PI * (0.2 + 0.6 * (k / 6));
    stroke(C, [[ccx, ccy + 0.3], [ccx + Math.cos(a) * 0.1, ccy + 0.3 + Math.sin(a) * 0.1], [ccx + Math.cos(a) * 0.17, ccy + 0.3 + Math.sin(a) * 0.15]], 0.025, 0.015, 0.75, 0.15);
  }

  /* --- K: scroll capital --- */
  const Kr = regions.K;
  each(Kr, (X, Yy) => {
    if (Yy > 0.8) return 0.85 - (Yy > 0.95 ? (Yy - 0.95) * 4 : 0);               // abacus
    if (Yy < 0.14) return 0.45 + 0.4 * Math.sin(((Yy - 0.02) / 0.12) * Math.PI) * (Yy > 0.02 ? 1 : 0); // astragal bead
    if (Yy > 0.42) {                                                            // egg band
      const f = ((X * 5) % 1), egg = Math.max(0, 1 - ((f - 0.5) / 0.36) ** 2 - ((Yy - 0.61) / 0.17) ** 2);
      return 0.3 + 0.5 * Math.sqrt(egg);
    }
    return 0.3;
  });
  for (const s of [-1, 1]) {
    const vx = Kr.MX / 2 + s * 0.85;
    stroke(Kr, volute(vx, 0.48, 0.3, 0.03, Math.PI / 2, 1.6, -s, 0.006), 0.06, 0.035, 0.95, 0.3);
    stamp(Kr, vx, 0.48, 0.07, 1.0, 0.3);
  }

  /* --- P: plain field --- */
  each(regions.P, (X, Yy) => 0.5 + (n.fbm(X / 2, Yy, { period: 8, octaves: 3 }) - 0.5) * 0.06);

  // cavity AO: blurred height minus height (concave areas darken)
  const B = new Float32Array(w * h), T = new Float32Array(w * h), rad = 5;
  for (let y = 0; y < h; y++) { let acc = 0; for (let x = -rad; x <= rad; x++) acc += H[y * w + ((x + w) % w)]; for (let x = 0; x < w; x++) { T[y * w + x] = acc / (2 * rad + 1); acc += H[y * w + ((x + rad + 1) % w)] - H[y * w + ((x - rad + w) % w)]; } }
  for (let x = 0; x < w; x++) { let acc = 0; for (let y = -rad; y <= rad; y++) acc += T[((y + h) % h) * w + x]; for (let y = 0; y < h; y++) { B[y * w + x] = acc / (2 * rad + 1); acc += T[((y + rad + 1) % h) * w + x] - T[((y - rad + h) % h) * w + x]; } }
  const al = img(w, h), ao = new Float32Array(w * h), rough = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, a = clamp01(1 - Math.max(0, B[i] - H[i]) * 5.5);   // strong cavity AO so motifs read at elevation distance
    ao[i] = a; rough[i] = 0.86;
    const g = 1 + (n.noise(x / w, y / h, 128) - 0.5) * 0.05;
    const k = (0.7 + 0.32 * H[i]) * (0.4 + 0.6 * a) * g;                     // raised parts light, field/cavities darker
    put(al, w, x, y, clamp01(base[0] * k), clamp01(base[1] * k), clamp01(base[2] * k * 0.99));
  }
  return { w, h, albedo: al, normal: heightToNormal(H, w, h, 9), orm: packORM(w, h, ao, rough, 0) };
}

/** Clipped hedge / planter greenery: leafy clumps, strong normal, high roughness. Tiles. */
function leaves({ size = 512, color = '#3F6B2A', seed = 53 } = {}) {
  const w = size, h = size, n = makeNoise(seed), base = rgb(color);
  const al = img(w, h), hgt = new Float32Array(w * h), ao = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const big = n.fbm(u, v, { period: 6, octaves: 3 }), leaf = n.noise(u, v, 96), fine = n.noise(u + 0.3, v + 0.7, 192);
    const hh = big * 0.45 + leaf * 0.4 + fine * 0.15;
    hgt[y * w + x] = hh; ao[y * w + x] = clamp01(0.45 + hh * 0.75);
    const k = 0.55 + 0.75 * hh, yel = smooth(0.6, 0.9, leaf) * 0.12;
    put(al, w, x, y, clamp01(base[0] * k + yel), clamp01(base[1] * k + yel * 0.6), clamp01(base[2] * k * 0.9));
  }
  return { w, h, albedo: al, normal: heightToNormal(hgt, w, h, 3), orm: packORM(w, h, ao, 0.9, 0) };
}

export const recipes = { 'tower.rooms': rooms, 'tower.ornament': ornament, 'tower.leaves': leaves };
