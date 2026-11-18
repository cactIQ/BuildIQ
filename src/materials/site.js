// Materials owned by the site module (also used by props). Register with M.define(name, async (ctx) => material).
// Ground materials share one onBeforeCompile patch (one shader program): world-space site atlas (AO, kerb/wall
// shadow, wear, paint markings) x a grime detail tile at two scales (2nd rotated 37 deg) blended by a macro mask.
import * as THREE from 'three';
import { pbr } from './base.js';

/** Site atlas window (world metres). Covers the plot, both roads, footpaths and the gate mouths. */
export const ATLAS_RECT = { x: [-80, 80], z: [-60, 60] };
export const DASH = { len: 3, gap: 4.5, width: 0.15 };   // road centreline dashes (atlas + procedural fallback)

/* ----------------------------- ground shader patch ----------------------------- */
const GROUND_PARS = /* glsl */`
varying vec3 vSiteW;
uniform sampler2D uAtlas; uniform sampler2D uGrime;
uniform vec4 uRect; uniform vec3 uDetail; uniform vec4 uEarth; uniform vec4 uPaint; uniform float uRoad; uniform vec4 uDash;
uniform float uField; uniform vec4 uStone; uniform vec3 uTint;
float sHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), f.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), f.x), f.y); }
// rotated-octave fbm (no axis-aligned lattice look at distance)
float sFbm(vec2 p){ float a = 0.5, s = 0.0; mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) { s += a * sNoise(p); p = r * p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s / 0.9375; }
`;
const GROUND_FRAG = /* glsl */`
#ifdef USE_MAP
{
  vec4 sampledDiffuseColor = texture2D(map, vMapUv);
  if (uField > 0.5) {
    // detile: a second, rotated + rescaled sample blended by a world-space mask
    vec2 ruv = mat2(0.5736, 0.8192, -0.8192, 0.5736) * vMapUv * 0.61 + vec2(0.43, 0.17);
    sampledDiffuseColor = mix(sampledDiffuseColor, texture2D(map, ruv), smoothstep(0.35, 0.65, sFbm(vSiteW.xz / 17.0 + 3.0)));
  }
  if (uStone.z > 0.0) {
    // per-stone tone, globally unique (stone grid = the running-bond grid of the pavers recipe in UV space)
    float row = floor(vMapUv.y * uStone.y), col = floor(vMapUv.x * uStone.x + mod(row, 2.0) * 0.5);
    float h1 = sHash(vec2(col, row) * 0.1373 + 0.51), h2 = sHash(vec2(row, col) * 0.0917 + 3.7);
    sampledDiffuseColor.rgb *= (1.0 + (h1 - 0.5) * 2.0 * uStone.z) * mix(vec3(1.02, 1.0, 0.97), vec3(0.985, 1.0, 1.02), h2);
  }
  diffuseColor *= sampledDiffuseColor;
}
#endif
diffuseColor.rgb *= uTint;
{
  vec2 sw = vSiteW.xz;
  float sg1 = texture2D(uGrime, sw / uDetail.x).r;
  vec2 sr = mat2(0.7986, 0.6018, -0.6018, 0.7986) * sw;              // 37 deg
  float sg2 = texture2D(uGrime, sr / uDetail.y + vec2(0.37, 0.61)).r;
  float smk = smoothstep(0.3, 0.7, sNoise(sw / uDetail.z) * 0.7 + sNoise(sw / (uDetail.z * 0.37) + 5.0) * 0.3);
  diffuseColor.rgb *= mix(sg1, sg2, smk) * (0.94 + 0.12 * sNoise(sw / (uDetail.z * 1.7) + 11.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, uEarth.rgb, uEarth.a * smoothstep(0.5, 0.8, sFbm(sw / 55.0 + 3.0) * 0.75 + sNoise(sw / 13.0) * 0.25));
  if (uField > 0.5) {
    // off-site fields (refs B/C scrubland): 40-200 m macro hue/value, dry + ochre grass, scrub, bare earth by roads
    float m1 = sFbm(sw / 190.0 + 11.0), m2 = sFbm(sw / 70.0 + 23.0), m3 = sFbm(sw / 31.0 + 37.0), m4 = sFbm(sw / 9.0 + 5.0);
    float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float tx = clamp(l / 0.17, 0.55, 1.6);                              // texture detail relative to the mean lawn
    // v1.2 vibrant: fields stay green (post-monsoon), dry/ochre patches only as accents (was -20 % sat, 85 % straw)
    vec3 col = mix(vec3(l), diffuseColor.rgb, 0.92);
    // v1.6 (owner review): no dark scrub blotches / bare-earth patches - only broad, soft hue and value drift
    float wDry = smoothstep(0.4, 0.7, m1 * 0.6 + m2 * 0.4);
    col = mix(col, vec3(0.27, 0.27, 0.11) * tx, wDry * 0.18);          // gentle sun-dried tint over large areas
    col *= 0.9 + 0.2 * smoothstep(0.3, 0.7, m1 * 0.7 + m2 * 0.3);      // soft macro brightness (no hard edges)
    diffuseColor.rgb = col;
  }
  vec2 auv = (sw - uRect.xy) / uRect.zw;
  float inA = step(0.0, auv.x) * step(auv.x, 1.0) * step(0.0, auv.y) * step(auv.y, 1.0);
  vec4 sat = mix(vec4(1.0, 0.0, 0.0, 1.0), texture2D(uAtlas, vec2(auv.x, 1.0 - auv.y)), inA);
  // procedural centreline dashes outside the atlas window (same pattern as the baked ones)
  float dz = min(abs(sw.y - uDash.x), abs(sw.y - uDash.y));
  float per = uDash.z + uDash.w;
  float dash = step(fract(sw.x / per), uDash.z / per) * (1.0 - smoothstep(0.065, 0.085, dz));
  sat.g = max(sat.g, dash * (1.0 - inA) * uRoad);
  diffuseColor.rgb = mix(diffuseColor.rgb, uPaint.rgb, clamp(sat.g, 0.0, 1.0) * uPaint.a);
  diffuseColor.rgb *= sat.r;
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.6, 0.55, 0.5), clamp(sat.b, 0.0, 1.0));
}
`;

function patchGround(mat, { atlas, grime, detail = [7.3, 19.1, 40], earth = ['#000000', 0], paint = ['#F1F0EA', 0.92], road = 0, roads = [], field = 0, stone = [0, 0, 0], tint = [1, 1, 1] }) {
  const R = ATLAS_RECT;
  const zc = roads.map((r) => (r.z[0] + r.z[1]) / 2);
  const u = {
    uAtlas: { value: atlas }, uGrime: { value: grime },
    uRect: { value: new THREE.Vector4(R.x[0], R.z[0], R.x[1] - R.x[0], R.z[1] - R.z[0]) },
    uDetail: { value: new THREE.Vector3(...detail) },
    uEarth: { value: new THREE.Vector4(...new THREE.Color(earth[0]).toArray(), earth[1]) },
    uPaint: { value: new THREE.Vector4(...new THREE.Color(paint[0]).toArray(), paint[1]) },
    uRoad: { value: road },
    uField: { value: field },
    uStone: { value: new THREE.Vector4(stone[0], stone[1], stone[2], 0) },
    uTint: { value: new THREE.Vector3(...tint) },
    uDash: { value: new THREE.Vector4(zc[0] ?? 1e5, zc[1] ?? 1e5, DASH.len, DASH.gap) },
  };
  mat.userData.siteUniforms = u;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = 'varying vec3 vSiteW;\n' + shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n  vSiteW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = GROUND_PARS + shader.fragmentShader.replace('#include <map_fragment>', GROUND_FRAG);
  };
  mat.customProgramCacheKey = () => 'siteGround2';
  return mat;
}

/* ----------------------------- site atlas (2048^2 canvas, linear data) ----------------------------- */
// Channels: R = AO / shadow multiplier (1 = none), G = paint coverage, B = stain / wear amount.
function drawSiteAtlas(g, w, h, SPEC, rng) {
  const R = ATLAS_RECT, W = R.x[1] - R.x[0], D = R.z[1] - R.z[0];
  const X = (x) => (x - R.x[0]) * w / W, Z = (z) => (z - R.z[0]) * h / D, SX = w / W, SZ = h / D;
  const rect = (x0, z0, x1, z1) => g.fillRect(X(x0), Z(z0), (x1 - x0) * SX, (z1 - z0) * SZ);
  const S = SPEC.site;
  const blur = (px) => { try { g.filter = px ? `blur(${px}px)` : 'none'; } catch { /* unsupported */ } };
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = 'rgb(255,0,0)'; g.fillRect(0, 0, w, h);

  // ---- AO / shadow darkening (black over R)
  // towers: wide soft skirt + tight contact line
  for (const t of SPEC.towers) {
    const x0 = t.c[0] - t.w / 2, x1 = t.c[0] + t.w / 2, z0 = t.c[1] - t.d / 2, z1 = t.c[1] + t.d / 2;
    blur(26); g.fillStyle = 'rgba(0,0,0,0.30)'; rect(x0 - 1.2, z0 - 1.2, x1 + 1.2, z1 + 1.2);
    blur(7); g.fillStyle = 'rgba(0,0,0,0.35)'; rect(x0 - 0.25, z0 - 0.25, x1 + 0.25, z1 + 0.25);
  }
  // clubhouse + pool deck edges (amenities' forms, but the ground is ours)
  const cl = S.clubhouse;
  blur(14); g.fillStyle = 'rgba(0,0,0,0.35)'; rect(cl.c[0] - cl.w / 2 - 0.4, cl.c[1] - cl.d / 2 - 0.4, cl.c[0] + cl.w / 2 + 0.4, cl.c[1] + cl.d / 2 + 0.4);
  // compound wall: plot boundary
  const P = S.plot;
  blur(5); g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 0.9 * SZ;
  g.strokeRect(X(P.x[0]), Z(P.z[0]), (P.x[1] - P.x[0]) * SX, (P.z[1] - P.z[0]) * SZ);
  // gate pavilions: pier footprints
  for (const gt of S.gates) {
    const side = (gt.w - gt.clear) / 2;
    for (const s of [-1, 1]) {
      const cx = gt.c[0] + s * (gt.clear / 2 + side / 2);
      blur(10); g.fillStyle = 'rgba(0,0,0,0.45)'; rect(cx - side / 2 - 0.4, gt.c[1] - gt.d / 2 - 0.4, cx + side / 2 + 0.4, gt.c[1] + gt.d / 2 + 0.4);
    }
    // soft shade under the entablature (sky occlusion in the opening)
    blur(14); g.fillStyle = 'rgba(0,0,0,0.18)'; rect(gt.c[0] - gt.clear / 2, gt.c[1] - gt.d / 2, gt.c[0] + gt.clear / 2, gt.c[1] + gt.d / 2);
  }
  // kerb shadow strips on the road side
  blur(3); g.fillStyle = 'rgba(0,0,0,0.35)';
  for (const r of S.roads) { rect(R.x[0], r.z[0], R.x[1], r.z[0] + 0.25); rect(R.x[0], r.z[1] - 0.25, R.x[1], r.z[1]); }
  // context buildings in the window
  for (const [x, z, bw, bd] of S.context.buildings) { blur(16); g.fillStyle = 'rgba(0,0,0,0.4)'; rect(x - bw / 2 - 0.8, z - bd / 2 - 0.8, x + bw / 2 + 0.8, z + bd / 2 + 0.8); }

  // ---- wear / stains (B, additive)
  g.globalCompositeOperation = 'lighter';
  const blob = (x, z, rx, rz, a) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, `rgba(0,0,${Math.round(255 * a)},1)`); gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.save(); g.translate(X(x), Z(z)); g.scale(rx * SX, rz * SZ); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill(); g.restore();
  };
  blur(0);
  for (const gt of S.gates) {
    // tyre-polished tracks through the gate and onto the road mouth, plus oil drips
    for (const lane of [-1.35, 1.35]) for (const tw of [-0.8, 0.8]) {
      blur(4); g.fillStyle = 'rgba(0,0,40,1)'; rect(gt.c[0] + lane + tw - 0.18, gt.c[1] - 9, gt.c[0] + lane + tw + 0.18, 47);
    }
    blur(0);
    for (let i = 0; i < 26; i++) blob(gt.c[0] + rng.range(-3.5, 3.5), rng.range(gt.c[1] - 6, 45.5), rng.range(0.2, 0.9), rng.range(0.15, 0.6), rng.range(0.12, 0.35));
    blob(gt.c[0], gt.c[1] + 1, 4.5, 3.5, 0.12);
  }
  // parking strip: oil drips under each stall centre
  for (const pk of S.parking) for (let z = pk.z[0] + 1.25; z < pk.z[1]; z += 2.5) {
    blob(pk.x[0] + 2.8 + rng.range(-0.4, 0.4), z + rng.range(-0.3, 0.3), rng.range(0.3, 0.7), rng.range(0.25, 0.5), rng.range(0.15, 0.35));
  }
  // general random weathering patches over the plot and roads
  for (let i = 0; i < 160; i++) blob(rng.range(R.x[0], R.x[1]), rng.range(R.z[0], R.z[1]), rng.range(0.6, 3.5), rng.range(0.5, 2.5), rng.range(0.05, 0.14));
  // road tyre bands (darker wheel paths)
  for (const r of S.roads) {
    const mid = (r.z[0] + r.z[1]) / 2, lane = (r.z[1] - r.z[0]) / 4;
    for (const lc of [mid - lane, mid + lane]) for (const o of [-0.85, 0.85]) { blur(6); g.fillStyle = 'rgba(0,0,30,1)'; rect(R.x[0], lc + o - 0.3, R.x[1], lc + o + 0.3); }
  }

  // ---- paint (G, additive)
  blur(0); g.fillStyle = 'rgba(0,255,0,1)';
  for (const r of S.roads) {
    const mid = (r.z[0] + r.z[1]) / 2, per = DASH.len + DASH.gap;
    for (let x = Math.floor(R.x[0] / per) * per; x < R.x[1]; x += per) rect(x, mid - DASH.width / 2, x + DASH.len, mid + DASH.width / 2);
    g.fillStyle = 'rgba(0,150,0,1)';                                                // faint edge lines
    rect(R.x[0], r.z[0] + 0.35, R.x[1], r.z[0] + 0.45); rect(R.x[0], r.z[1] - 0.45, R.x[1], r.z[1] - 0.35);
    g.fillStyle = 'rgba(0,255,0,1)';
  }
  for (const zb of S.zebras) {
    const r = S.roads.find((q) => q.id === zb.road); if (!r) continue;
    // clear the edge lines/dash where the crossing is (keep R and B): 'darken' with rgb(255,0,255) zeroes G only
    g.globalCompositeOperation = 'darken'; g.fillStyle = 'rgb(255,0,255)'; rect(zb.x - zb.width / 2 - 0.3, r.z[0], zb.x + zb.width / 2 + 0.3, r.z[1]);
    g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(0,255,0,1)';
    for (let z = r.z[0] + 0.6; z + 0.5 <= r.z[1] - 0.4; z += 1.0) rect(zb.x - zb.width / 2, z, zb.x + zb.width / 2, z + 0.5);
  }
  // parking stalls: perpendicular row along the west edge of each strip
  for (const pk of S.parking) {
    const sx0 = pk.x[0] + 0.3, sx1 = sx0 + 5.0;
    for (let z = pk.z[0]; z <= pk.z[1] + 1e-6; z += 2.5) rect(sx0, z - 0.06, sx1, z + 0.06);
    rect(sx1 - 0.06, pk.z[0], sx1 + 0.06, pk.z[1]);                 // aisle line
  }
  g.globalCompositeOperation = 'source-over'; blur(0);
}

/* ----------------------------- canvases: gate iron, letters, halo ----------------------------- */
export const GATE_LEAF = { w: 5.8, h: 3.4, shoulder: 2.6 };   // m: full double-leaf panel, arch peak, side height

function drawGateIron(g, w, h) {
  const L = GATE_LEAF, sx = w / L.w, sy = h / L.h;
  const Y = (y) => h - y * sy;                               // canvas y down; metres up
  g.clearRect(0, 0, w, h);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round';
  const archY = (x) => { const t = (x / L.w) * 2 - 1; return L.shoulder + (L.h - 0.12 - L.shoulder) * Math.sqrt(Math.max(0, 1 - t * t)); };
  const lw = (m) => Math.max(1.5, m * sx);
  // arched top rail (double) and bottom rails
  for (const off of [0, 0.22]) {
    g.lineWidth = lw(0.06); g.beginPath();
    for (let i = 0; i <= 64; i++) { const x = (i / 64) * L.w; const y = archY(x) - off; i ? g.lineTo(x * sx, Y(y)) : g.moveTo(x * sx, Y(y)); }
    g.stroke();
  }
  for (const y of [0.12, 0.32, 1.05]) { g.lineWidth = lw(0.05); g.beginPath(); g.moveTo(0, Y(y)); g.lineTo(w, Y(y)); g.stroke(); }
  // stiles: outer and meeting
  g.lineWidth = lw(0.08);
  for (const x of [0.04, L.w / 2 - 0.03, L.w / 2 + 0.03, L.w - 0.04]) { g.beginPath(); g.moveTo(x * sx, Y(0.05)); g.lineTo(x * sx, Y(archY(x))); g.stroke(); }
  // pickets with spear tips above the arch
  g.lineWidth = lw(0.025);
  for (let x = 0.14; x < L.w - 0.1; x += 0.13) {
    const top = archY(x);
    g.beginPath(); g.moveTo(x * sx, Y(0.12)); g.lineTo(x * sx, Y(top + 0.08)); g.stroke();
    g.beginPath(); g.moveTo(x * sx - 0.03 * sx, Y(top + 0.08)); g.lineTo(x * sx, Y(top + 0.17)); g.lineTo(x * sx + 0.03 * sx, Y(top + 0.08)); g.fill();
  }
  // concentric-circle motif centred on each leaf, plus small rosettes in the dado
  for (const cx of [L.w / 4, (3 * L.w) / 4]) {
    const cy = 1.75;
    g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(cx * sx, Y(cy), 0.62 * sx, 0, Math.PI * 2); g.fill(); g.restore();
    for (const [r, t] of [[0.6, 0.045], [0.45, 0.035], [0.3, 0.035], [0.15, 0.03]]) { g.lineWidth = lw(t); g.beginPath(); g.arc(cx * sx, Y(cy), r * sx, 0, Math.PI * 2); g.stroke(); }
    g.lineWidth = lw(0.02);
    for (let a = 0; a < 8; a++) { const ang = (a * Math.PI) / 4; g.beginPath(); g.moveTo((cx + Math.cos(ang) * 0.15) * sx, Y(cy + Math.sin(ang) * 0.15)); g.lineTo((cx + Math.cos(ang) * 0.6) * sx, Y(cy + Math.sin(ang) * 0.6)); g.stroke(); }
    g.beginPath(); g.arc(cx * sx, Y(cy), 0.05 * sx, 0, Math.PI * 2); g.fill();
    for (const dx of [-0.8, -0.4, 0, 0.4, 0.8]) { g.lineWidth = lw(0.02); g.beginPath(); g.arc((cx + dx) * sx, Y(0.68), 0.15 * sx, 0, Math.PI * 2); g.stroke(); }
  }
}

function drawLetters(text) {
  return (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const t = String(text || '').toUpperCase();
    let size = Math.round(h * 0.72);
    const font = (s) => `600 ${s}px Georgia, "Times New Roman", serif`;
    g.font = font(size);
    try { g.letterSpacing = Math.round(size * 0.14) + 'px'; } catch { /* older canvas */ }
    const mw = g.measureText(t).width;
    if (mw > w * 0.94) { size = Math.floor(size * (w * 0.94) / mw); g.font = font(size); try { g.letterSpacing = Math.round(size * 0.14) + 'px'; } catch { /* */ } }
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(t, w / 2, h * 0.54);
  };
}

function drawHalo(g, w, h) {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.12, 'rgba(255,236,200,0.75)');
  r.addColorStop(0.4, 'rgba(255,200,140,0.18)'); r.addColorStop(1, 'rgba(255,180,120,0)');
  g.clearRect(0, 0, w, h); g.fillStyle = r; g.fillRect(0, 0, w, h);
}

/* ----------------------------- definitions ----------------------------- */
export function define(M, SPEC) {
  const P = SPEC.global.palette;
  const atlasOf = (ctx) => ctx.tex.canvas('site.atlas', 2048, 2048, (g, w, h) => drawSiteAtlas(g, w, h, SPEC, ctx.rng('site-atlas')), { srgb: false });
  const grimeOf = (ctx) => ctx.tex.get('siteGrime', { seed: 41 });
  const ground = async (ctx, texP, opts) => {
    const [t, gr] = await Promise.all([texP, grimeOf(ctx)]);
    const m = pbr(t, { roughness: 1 });
    return patchGround(m, { atlas: atlasOf(ctx), grime: gr.albedo, roads: SPEC.site.roads, ...opts });
  };

  // pavers: warm grey (the sky/env pushes them blue, so the albedo leans warm of the #A8A59F target), +-8 % per stone
  // (shader, globally unique per stone: uStone = stones per UV unit), macro warm grime patches via `earth`.
  M.define('site.paving', (ctx) => ground(ctx, ctx.tex.get('pavers', { color: '#ADA79C', tile: 2, tint: 0.02 }), { detail: [7.3, 19.1, 40], stone: [10, 20, 0.08], earth: ['#857A69', 0.3], tint: [1.02, 1.0, 0.97] }));
  M.define('site.footpath', (ctx) => ground(ctx, ctx.tex.get('pavers', { color: '#B7AFA2', tile: 1.2, unitW: 0.3, unitH: 0.3, joint: 0.008, seed: 12, tint: 0.02 }), { detail: [6.7, 17.9, 40], stone: [4, 4, 0.07], earth: ['#857A69', 0.25] }));
  M.define('site.road', (ctx) => ground(ctx, ctx.tex.get('asphalt', { color: P.asphalt }), { detail: [6.1, 17.3, 40], road: 1 }));
  // vehicle drive loop inside the plot: darker concrete/asphalt, distinct from the pedestrian pavers
  M.define('site.drive', async (ctx) => {
    const m = await ground(ctx, ctx.tex.get('asphalt', { color: '#6E7178', seed: 29 }), { detail: [6.4, 18.3, 40], earth: ['#5E5A54', 0.2] });
    m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1;
    return m;
  });
  M.define('site.lawn', (ctx) => ground(ctx, ctx.tex.get('lawn', { color: '#5C8F3C' }), { detail: [9.7, 31, 60], earth: ['#8A7A58', 0], paint: ['#ffffff', 0], field: 1 }));
  // low scrub mounds in the off-site fields (instanced, per-instance colour)
  M.define('site.scrub', async () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0, envMapIntensity: 0.6 }));

  M.define('site.facade', async () => {
    // v1.6 (owner review): background buildings are clean low-poly pastel blocks (vertex colours, flat shaded) - the
    // photo-like window texture is gone, so they sit back and never compete with the project towers
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.7, emissive: new THREE.Color('#000000') });
    return m;
  });
  M.define('site.vcol', async () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 }));
  M.define('site.gateIron', async (ctx) => {
    const a = ctx.tex.canvas('site.gateIron', 1024, 600, drawGateIron, { srgb: false });
    return new THREE.MeshStandardMaterial({ color: P.iron, roughness: 0.45, metalness: 0.65, alphaMap: a, alphaTest: 0.45, side: THREE.DoubleSide, alphaToCoverage: true });
  });
  M.define('site.goldLetters', async (ctx) => {
    const a = ctx.tex.canvas('site.letters', 2048, 256, drawLetters(SPEC.brand.name), { srgb: false });
    return new THREE.MeshStandardMaterial({ color: P.gold, roughness: 0.3, metalness: 1, alphaMap: a, alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  });
  M.define('site.lampHead', async () => new THREE.MeshStandardMaterial({ color: '#E9E5DC', emissive: '#FFD39A', emissiveIntensity: 0, roughness: 0.35 }));
  M.define('site.halo', async (ctx) => {
    const t = ctx.tex.canvas('site.halo', 128, 128, drawHalo);
    return new THREE.PointsMaterial({ map: t, color: '#FFC98A', size: 5.5, sizeAttenuation: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  });
  // additive ground light pools under lamps (opacity driven by night)
  M.define('site.lightPool', async (ctx) => {
    const t = ctx.tex.canvas('site.halo', 128, 128, drawHalo);
    return new THREE.MeshBasicMaterial({ map: t, color: '#FFB46A', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  });
  // props (cars)
  M.define('site.carPaint', async () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.28, metalness: 0.35, envMapIntensity: 1.2 }));
  M.define('site.carGlass', async () => new THREE.MeshStandardMaterial({ color: '#12161a', roughness: 0.06, metalness: 0.2, envMapIntensity: 1.4 }));
}
