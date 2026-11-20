// Sample 2 BHK flat (v1.15): plan data shared by the builder (src/interior-flat.js) and the walk controller
// (src/walk.js), plus the flat's materials (all prefixed `flat.`, created inside build via M.use).
// Lighting: no real lights. The interior scene gets a RoomEnvironment PMREM; light pools are painted into one
// plan-wide floor lightMap (uv1); coves, downlights and lamp shades are unlit emissive surfaces.
// Every artwork here is original procedural drawing.
import * as THREE from 'three';

/* ------------------------------------------------------------------------------------------------------------
   Plan. Metres, y up, +x east, +z south (balcony side). Origin = centre of the inner envelope.
   Walls: axis 'x' runs along x at z = at; axis 'z' runs along z at x = at. Openings [a, b] along the run, from y0 to
   y1. door: { hinge: 'a'|'b', swing: +1|-1 } (open leaf, perpendicular to the wall, on the swing side of the normal
   axis). win: glazed window. slide: sliding glass door (panels stacked on the `stack` half).
   side: exterior walls only (N, S, W, E), used by the dollhouse cutaway.
   ------------------------------------------------------------------------------------------------------------ */
export const FLAT = {
  H: 3.0, cut: 1.1, eye: 1.6, radius: 0.25,
  ext: 0.23, int: 0.115,
  inner: { x: [-6, 6], z: [-4.5, 4.5] },
  outer: { x: [-6.23, 6.23], z: [-4.73, 6.2] },          // incl. balcony
  balcony: { x: [-6, 6], z: [4.73, 6.2], rail: 1.1 },
  centre: [0, 0.75],
  walls: [
    { id: 'N', side: 'N', axis: 'x', at: -4.615, from: -6.23, to: 6.23, t: 0.23, open: [
      { a: -0.55, b: 0.45, y0: 0, y1: 2.1, door: { hinge: 'a', swing: 1, leaf: 'entry' } },
      { a: -5.2, b: -3.8, y0: 1.05, y1: 2.1, win: 1 },
      { a: -2.2, b: -1.6, y0: 1.6, y1: 2.1, win: 1 },
      { a: 2.8, b: 4.6, y0: 0.6, y1: 2.1, win: 1 }] },
    { id: 'S', side: 'S', axis: 'x', at: 4.615, from: -6.23, to: 6.23, t: 0.23, open: [
      { a: -5.0, b: -1.0, y0: 0, y1: 2.4, slide: 1, stack: 'a' },
      { a: 2.4, b: 4.4, y0: 0, y1: 2.4, slide: 1, stack: 'b' }] },
    { id: 'W', side: 'W', axis: 'z', at: -6.115, from: -4.5, to: 4.5, t: 0.23, open: [
      { a: -1.2, b: 0.4, y0: 0.6, y1: 2.1, win: 1 }] },
    { id: 'E', side: 'E', axis: 'z', at: 6.115, from: -4.5, to: 4.5, t: 0.23, open: [
      { a: 1.3, b: 1.9, y0: 1.7, y1: 2.1, win: 1 },
      { a: 2.6, b: 3.8, y0: 0.6, y1: 2.1, win: 1 }] },
    // interior partitions (115 mm)
    { id: 'I1', axis: 'x', at: -2.4, from: -2.8, to: 0.6, t: 0.115, open: [
      { a: -2.4, b: -1.65, y0: 0, y1: 2.1, door: { hinge: 'b', swing: -1 } },
      { a: -0.75, b: 0.45, y0: 0, y1: 2.4 }] },
    { id: 'I2', axis: 'z', at: -2.8, from: -4.5, to: -2.4, t: 0.115, open: [] },
    { id: 'I3', axis: 'z', at: -0.9, from: -4.5, to: -2.4, t: 0.115, open: [] },
    { id: 'I4', axis: 'z', at: 0.6, from: -4.5, to: 4.5, t: 0.115, open: [{ a: -0.9, b: 0.1, y0: 0, y1: 2.4 }] },
    { id: 'I5', axis: 'x', at: -1.0, from: 0.6, to: 6.0, t: 0.115, open: [{ a: 1.2, b: 2.1, y0: 0, y1: 2.1, door: { hinge: 'a', swing: -1 } }] },
    { id: 'I6', axis: 'x', at: 0.2, from: 0.6, to: 4.0, t: 0.115, open: [{ a: 1.2, b: 2.1, y0: 0, y1: 2.1, door: { hinge: 'a', swing: 1 } }] },
    { id: 'I7', axis: 'z', at: 4.0, from: -1.0, to: 2.0, t: 0.115, open: [{ a: 0.9, b: 1.65, y0: 0, y1: 2.1, door: { hinge: 'b', swing: 1 } }] },
    { id: 'I8', axis: 'x', at: 2.0, from: 4.0, to: 6.0, t: 0.115, open: [] },
  ],
  // ceiling zones: a warm cove strip inset from the edges + a grid of downlights (x0, x1, z0, z1)
  zones: [
    { id: 'living', x: [-6, 0.6], z: [1.0, 4.5] }, { id: 'dining', x: [-6, -0.5], z: [-1.6, 1.0] },
    { id: 'kitchen', x: [-6, -2.8], z: [-4.5, -1.6] }, { id: 'foyer', x: [-0.9, 0.6], z: [-4.5, -2.4] },
    { id: 'bath', x: [-2.8, -0.9], z: [-4.5, -2.4] }, { id: 'passage', x: [0.6, 4.0], z: [-1.0, 0.2] },
    { id: 'master', x: [0.6, 4.0], z: [0.2, 4.5] }, { id: 'masterE', x: [4.0, 6.0], z: [2.0, 4.5] },
    { id: 'mbath', x: [4.0, 6.0], z: [-1.0, 2.0] }, { id: 'bed2', x: [0.6, 6.0], z: [-4.5, -1.0] },
    { id: 'balcony', x: [-6, 6], z: [4.73, 6.2] },
  ],
};

/** Downlight positions for a zone (also used to paint the floor light pools). */
export function downlights(zn) {
  const out = [], w = zn.x[1] - zn.x[0], d = zn.z[1] - zn.z[0];
  if (zn.id === 'balcony') { for (let x = -5; x <= 5.01; x += 2.5) out.push([x, 5.45]); return out; }
  const nx = Math.max(1, Math.round((w - 0.9) / 1.5)), nz = Math.max(1, Math.round((d - 0.9) / 1.5));
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = zn.x[0] + 0.45 + ((i + 0.5) / nx) * (w - 0.9), z = zn.z[0] + 0.45 + ((j + 0.5) / nz) * (d - 0.9);
    out.push([x, z]);
  }
  return out;
}

const LIGHTMAP_INTENSITY = Math.PI * 1.1;

/* --------------------------- canvas painters (browser only; stubbed under node) --------------------------- */
const warm = (v, a = 1) => { const c = (k) => Math.round(Math.max(0, Math.min(1, v * k)) * 255); return `rgba(${c(1)},${c(0.94)},${c(0.84)},${a})`; };
function glow(g, x, y, rx, ry, v) {
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const r = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  r.addColorStop(0, warm(v)); r.addColorStop(0.5, warm(v * 0.45)); r.addColorStop(1, warm(0));
  g.fillStyle = r; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
}
/** Plan-wide floor lightMap: u = (x - X0)/DX, v = (z - Z0)/DZ (flipY: canvas row 0 is the balcony edge). */
function paintFloor(g, w, h) {
  const [X0, X1] = FLAT.outer.x, [Z0, Z1] = FLAT.outer.z, s = w / (X1 - X0);
  const px = (x) => (x - X0) * s, pz = (z) => (1 - (z - Z0) / (Z1 - Z0)) * h;
  g.fillStyle = warm(0.34); g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'lighter';
  for (const zn of FLAT.zones) for (const [x, z] of downlights(zn)) glow(g, px(x), pz(z), 0.95 * s, 0.95 * s, 0.2);
  // daylight spill through the balcony doors and windows
  glow(g, px(-3), pz(4.3), 3.2 * s, 2.6 * s, 0.42); glow(g, px(3.4), pz(4.3), 2.0 * s, 2.2 * s, 0.38);
  glow(g, px(0), pz(5.5), 7 * s, 1.4 * s, 0.35);
  glow(g, px(-5.6), pz(-0.4), 1.6 * s, 1.4 * s, 0.25); glow(g, px(3.7), pz(-4.1), 1.6 * s, 1.5 * s, 0.25);
  glow(g, px(5.6), pz(3.2), 1.4 * s, 1.3 * s, 0.22);
  g.globalCompositeOperation = 'multiply';
  // soft contact darkening along every wall that reaches the floor (blurred canvas shadow, no CSS involved)
  g.shadowColor = warm(0.45); g.shadowBlur = 0.32 * s; g.fillStyle = warm(0.5);
  for (const wl of FLAT.walls) {
    let a = wl.from;
    const runs = [];
    for (const o of [...wl.open].sort((p, q) => p.a - q.a)) { if (o.y0 > 0.01) continue; runs.push([a, o.a]); a = o.b; }
    runs.push([a, wl.to]);
    for (const [r0, r1] of runs) {
      if (r1 - r0 < 0.01) continue;
      if (wl.axis === 'x') g.fillRect(px(r0), pz(wl.at + wl.t / 2), (r1 - r0) * s, wl.t * s);
      else g.fillRect(px(wl.at - wl.t / 2), pz(r1), wl.t * s, (r1 - r0) * s);
    }
  }
  g.shadowBlur = 0; g.globalCompositeOperation = 'source-over';
}
/** Walnut veneer: vertical grain with soft figure (u across, v along the grain). */
function paintWalnut(rng) {
  return (g, w, h) => {
    const l = g.createLinearGradient(0, 0, w, 0);
    l.addColorStop(0, '#5B3B26'); l.addColorStop(0.5, '#6E4A30'); l.addColorStop(1, '#5B3B26');
    g.fillStyle = l; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      const x = rng() * w, a = 0.05 + rng() * 0.12, dark = rng() < 0.6;
      g.strokeStyle = dark ? `rgba(40,24,14,${a})` : `rgba(150,105,70,${a})`;
      g.lineWidth = 0.6 + rng() * 2.2; g.beginPath();
      const amp = 2 + rng() * 6, ph = rng() * 6.28, fr = 1 + rng() * 2;
      for (let y = 0; y <= h; y += 8) { const xx = x + Math.sin(y / h * fr * 6.28 + ph) * amp; if (y === 0) g.moveTo(xx, y); else g.lineTo(xx, y); }
      g.stroke();
    }
  };
}
/** Hand-knotted style rug: ivory field, taupe border, faint wool texture. */
function paintRug(rng) {
  return (g, w, h) => {
    g.fillStyle = '#D9D0C1'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${rng() < 0.5 ? '255,250,240' : '150,135,115'},${0.05 + rng() * 0.06})`; g.fillRect(rng() * w, rng() * h, 2, 2); }
    const b = w * 0.06;
    g.strokeStyle = '#8C7B66'; g.lineWidth = b * 0.55; g.strokeRect(b, b, w - 2 * b, h - 2 * b);
    g.strokeStyle = '#B8A88F'; g.lineWidth = b * 0.12; g.strokeRect(b * 1.9, b * 1.9, w - 3.8 * b, h - 3.8 * b);
    g.strokeStyle = 'rgba(140,123,102,0.35)'; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(w / 2, h / 2, w * (0.12 + i * 0.045), h * (0.08 + i * 0.03), 0, 0, Math.PI * 2); g.stroke(); }
  };
}
/** Abstract art: warm paper, overlapping arcs and blocks in terracotta, sage, ink and gold. */
function paintArt(rng) {
  return (g, w, h) => {
    g.fillStyle = '#EFE8DC'; g.fillRect(0, 0, w, h);
    const cols = ['#B5654A', '#8FA38A', '#2E3A3F', '#C9A35E', '#D9B9A0'];
    for (let i = 0; i < 7; i++) {
      g.fillStyle = cols[i % cols.length]; g.globalAlpha = 0.75 + rng() * 0.25;
      const x = rng() * w, y = rng() * h, r = (0.12 + rng() * 0.25) * Math.min(w, h);
      g.beginPath();
      if (rng() < 0.5) g.arc(x, y, r, rng() * 3, rng() * 3 + Math.PI); else g.rect(x - r / 2, y - r, r * 0.8, r * 1.6);
      g.fill();
    }
    g.globalAlpha = 1; g.strokeStyle = '#2E3A3F'; g.lineWidth = Math.max(2, w / 160);
    g.beginPath(); g.moveTo(w * 0.1, h * (0.3 + rng() * 0.4)); g.bezierCurveTo(w * 0.4, h * rng(), w * 0.6, h * rng(), w * 0.9, h * (0.3 + rng() * 0.4)); g.stroke();
  };
}
/** View outside: soft sky, distant hazy towers and a green belt; the lower half is the ground far below. */
function paintBackdrop(rng) {
  return (g, w, h) => {
    const l = g.createLinearGradient(0, 0, 0, h);
    l.addColorStop(0, '#9FC3E6'); l.addColorStop(0.42, '#D9E8F2'); l.addColorStop(0.5, '#EEF2EE');
    l.addColorStop(0.53, '#B9C9A8'); l.addColorStop(0.7, '#8FA580'); l.addColorStop(1, '#6F8565');
    g.fillStyle = l; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const bw = w * (0.006 + rng() * 0.018), bh = h * (0.015 + rng() * 0.07), x = rng() * w;
      g.fillStyle = `rgba(${170 + rng() * 30},${180 + rng() * 25},${190 + rng() * 20},${0.55 + rng() * 0.3})`;
      g.fillRect(x, h * 0.5 - bh, bw, bh);
    }
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${70 + rng() * 40},${110 + rng() * 40},${60 + rng() * 30},0.5)`; const r = w * (0.002 + rng() * 0.006); g.beginPath(); g.arc(rng() * w, h * (0.505 + rng() * 0.03), r, 0, Math.PI * 2); g.fill(); }
  };
}
function paintShadow(g, w, h) {
  if (!g.createImageData) return;
  const im = g.createImageData(w, h), d = im.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = Math.abs((x + 0.5) / w - 0.5), v = Math.abs((y + 0.5) / h - 0.5);
    const qx = Math.max(u - 0.18, 0), qy = Math.max(v - 0.18, 0), dist = Math.hypot(qx, qy) - 0.1;
    const t = Math.min(1, Math.max(0, (dist + 0.1) / 0.32)), a = (1 - t * t * (3 - 2 * t));
    const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = Math.round(255 * a);
  }
  g.putImageData(im, 0, 0);
}

export function define(M) {
  const marbleMaps = (ctx) => ctx.tex.get('flatMarble', { size: 1024, tile: 1.2, seed: 77 });
  const marble = async (ctx, { lightMap }) => {
    const t = await marbleMaps(ctx);
    const m = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 1, metalness: 0, clearcoat: lightMap ? 0.6 : 0.5, clearcoatRoughness: 0.04, envMapIntensity: 1.4,
    });
    if (t.albedo) m.map = t.albedo;
    if (t.normal) { m.normalMap = t.normal; m.normalScale = new THREE.Vector2(0.35, 0.35); }
    if (t.orm) { m.roughnessMap = t.orm; m.aoMap = t.orm; }
    if (lightMap) {
      const [X0, X1] = FLAT.outer.x, [Z0, Z1] = FLAT.outer.z, w = 512, h = Math.round(w * (Z1 - Z0) / (X1 - X0));
      m.lightMap = ctx.tex.canvas('flat.floorLM', w, h, paintFloor, { srgb: false }); m.lightMap.channel = 1; m.lightMapIntensity = LIGHTMAP_INTENSITY;
    }
    return m;
  };
  M.define('flat.marble', (ctx) => marble(ctx, { lightMap: true }));       // floor (with the light-pool map)
  M.define('flat.stone', (ctx) => marble(ctx, { lightMap: false }));       // counter, table and vanity tops
  M.define('flat.wall', async () => new THREE.MeshStandardMaterial({ color: '#F1EBE2', roughness: 0.9, envMapIntensity: 0.85, vertexColors: true }));
  M.define('flat.walnut', async (ctx) => new THREE.MeshStandardMaterial({
    map: ctx.tex.canvas('flat.walnutTex', 256, 512, paintWalnut(ctx.rng('flat.walnut')), { repeat: true }), roughness: 0.42, envMapIntensity: 0.9 }));
  M.define('flat.brass', async () => new THREE.MeshStandardMaterial({ color: '#C9A35E', metalness: 1, roughness: 0.28, envMapIntensity: 1.2 }));
  M.define('flat.fabric', async () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.92, sheen: 0.6, sheenRoughness: 0.8, sheenColor: new THREE.Color(1, 1, 1), envMapIntensity: 0.8 }));
  M.define('flat.velvet', async () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.7, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(0.75, 0.8, 0.78), envMapIntensity: 0.8 }));
  M.define('flat.rug', async (ctx) => new THREE.MeshStandardMaterial({ map: ctx.tex.canvas('flat.rugTex', 512, 384, paintRug(ctx.rng('flat.rug'))), roughness: 1, envMapIntensity: 0.6 }));
  M.define('flat.glass', async () => new THREE.MeshStandardMaterial({ color: '#E4EEEE', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 1.5, depthWrite: false }));
  M.define('flat.black', async () => new THREE.MeshStandardMaterial({ color: '#121314', roughness: 0.2, metalness: 0.3 }));
  M.define('flat.chrome', async () => new THREE.MeshStandardMaterial({ color: '#E6E6E6', roughness: 0.04, metalness: 1, envMapIntensity: 1.3 }));
  M.define('flat.lacquer', async () => new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.28, envMapIntensity: 1.0 }));
  // emissive fixtures: coves, downlights, lamp shades (vertex colour dims the shades)
  M.define('flat.light', async () => new THREE.MeshBasicMaterial({ color: new THREE.Color(5.2, 4.5, 3.6), vertexColors: true }));
  M.define('flat.backdrop', async (ctx) => new THREE.MeshBasicMaterial({ map: ctx.tex.canvas('flat.backdropTex', 1024, 512, paintBackdrop(ctx.rng('flat.backdrop'))), color: new THREE.Color(1.35, 1.35, 1.35), side: THREE.BackSide, depthWrite: false }));
  M.define('flat.leaf', async () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
  M.define('flat.art', async (ctx) => { const t = ctx.tex.canvas('flat.artTex', 512, 512, paintArt(ctx.rng('flat.art'))); return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: new THREE.Color(0.3, 0.29, 0.27), roughness: 0.85 }); });
  M.define('flat.curtain', async () => new THREE.MeshStandardMaterial({ color: '#F4EFE6', roughness: 1, transparent: true, opacity: 0.82, side: THREE.DoubleSide, envMapIntensity: 0.7 }));
  M.define('flat.shadow', async (ctx) => new THREE.MeshBasicMaterial({ map: ctx.tex.canvas('flat.shadowTex', 128, 128, paintShadow), color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }));
}
