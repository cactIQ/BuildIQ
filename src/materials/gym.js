// Materials owned by the gym interior (all names prefixed `gym.`). Registered with M.define and created in build().
// Lighting is mostly baked: light pools / scallops are painted into 2D-canvas lightMaps (software canvas, via
// ctx.tex.canvas, stubbed under node). No real lights; core supplies a RoomEnvironment PMREM.
// Every artwork here is ORIGINAL procedural drawing (generic shapes) - nothing is traced from any reference.
import * as THREE from 'three';
import { pbr } from './base.js';

/* --------------------------- room layout shared with interior-gym.js --------------------------- */
export const GYM = {
  W: 7.5, D: 9.5, H: 2.5,                                // room size (x, z, y); centred on the origin
  wallColor: '#BCAE8C', ceilingColor: '#DCCDB3', tileColor: '#ABAAA5',   // walls: warm tan of ref F
  // flush LED rectangle in the ceiling (x0, x1, z0, z1) and the 8 downlights [x, z]
  led: { x: [-1.35, 1.55], z: [-2.85, 0.6], strip: 0.035 },
  downlights: [[-1.97, 0.4], [-1.97, -1.5], [-1.97, -3.67], [1.97, 0.4], [1.97, -1.5], [1.97, -3.67], [0.15, -1.0], [0.1, 2.4]],
  // left wall: deep window openings [z0, z1]; sill/head heights; reveal depth; bulkhead
  windows: [[-4.45, -3.4], [-3.1, -1.8], [-1.2, 0.6]], sill: 0.95, head: 2.2, reveal: 0.5,
  bulkhead: { w: 0.75, bottom: 2.2 },
};
const LIGHTMAP_INTENSITY = Math.PI * 1.15;

/* --------------------------- canvas helpers (run only in the browser) --------------------------- */
// warm 3000K-ish light: lightmap texels are tinted so the baked light reads warm like the reference room
const gray = (v, a = 1) => { const c = (k) => Math.round(Math.max(0, Math.min(1, v * k)) * 255); return `rgba(${c(1)},${c(0.92)},${c(0.8)},${a})`; };
function glow(g, x, y, rx, ry, v) {
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const r = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  r.addColorStop(0, gray(v)); r.addColorStop(0.45, gray(v * 0.55)); r.addColorStop(1, gray(0));
  g.fillStyle = r; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
}
function edgeShade(g, w, h, size, v, sides = 'lrtb') {
  g.globalCompositeOperation = 'multiply';
  const mk = (x0, y0, x1, y1) => { const l = g.createLinearGradient(x0, y0, x1, y1); l.addColorStop(0, gray(v)); l.addColorStop(1, gray(1)); return l; };
  if (sides.includes('l')) { g.fillStyle = mk(0, 0, size, 0); g.fillRect(0, 0, size, h); }
  if (sides.includes('r')) { g.fillStyle = mk(w, 0, w - size, 0); g.fillRect(w - size, 0, size, h); }
  if (sides.includes('t')) { g.fillStyle = mk(0, 0, 0, size); g.fillRect(0, 0, w, size); }
  if (sides.includes('b')) { g.fillStyle = mk(0, h, 0, h - size); g.fillRect(0, h - size, w, size); }
  g.globalCompositeOperation = 'source-over';
}
/** Extra darkening in the four canvas corners (where two room edges meet). */
function cornerShade(g, w, h, size, v) {
  g.globalCompositeOperation = 'multiply';
  for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) {
    const r = g.createRadialGradient(x, y, 0, x, y, size);
    r.addColorStop(0, gray(v)); r.addColorStop(1, gray(1));
    g.fillStyle = r; g.fillRect(x - size, y - size, size * 2, size * 2);
  }
  g.globalCompositeOperation = 'source-over';
}
/** Soft rounded-rect contact shadow (alpha): dark core, falloff to 0 at the decal edge. */
function paintShadow(g, w, h) {
  if (!g.createImageData) return;
  const im = g.createImageData(w, h), d = im.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = Math.abs((x + 0.5) / w - 0.5), v = Math.abs((y + 0.5) / h - 0.5);
    const qx = Math.max(u - 0.18, 0), qy = Math.max(v - 0.18, 0), dist = Math.hypot(qx, qy) - 0.1;  // rounded rect SDF
    const t = Math.min(1, Math.max(0, (dist + 0.1) / 0.32)), a = (1 - t * t * (3 - 2 * t));
    const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = Math.round(255 * a);
  }
  g.putImageData(im, 0, 0);
}
// CanvasTexture flipY=true: canvas row 0 is v = 1.

/** Floor lightmap: canvas x = room x (-W/2..W/2), canvas y = room z (+D/2 at the top row... v = (z + D/2)/D). */
function paintFloor(g, w, h) {
  const { W, D } = GYM, px = (x) => ((x + W / 2) / W) * w, pz = (z) => (1 - (z + D / 2) / D) * h, s = w / W;
  g.fillStyle = gray(0.30); g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'lighter';
  const L = GYM.led; glow(g, px((L.x[0] + L.x[1]) / 2), pz((L.z[0] + L.z[1]) / 2), 3.4 * s, 3.9 * s, 0.28);
  for (const [x, z] of GYM.downlights) glow(g, px(x), pz(z), 1.15 * s, 1.15 * s, 0.30);
  for (const [z0, z1] of GYM.windows) glow(g, px(-W / 2 + 0.3), pz((z0 + z1) / 2), 1.9 * s, ((z1 - z0) / 2 + 0.7) * s, 0.4);   // daylight spill
  g.globalCompositeOperation = 'source-over';
  edgeShade(g, w, h, 0.45 * s, 0.62);
  edgeShade(g, w, h, 0.12 * s, 0.6);                 // tight contact AO at the wall/floor junction
  cornerShade(g, w, h, 0.9 * s, 0.6);
}
/** Side-wall lightmap (u = (z + D/2)/D, v = y/H): downlight scallops and window bounce. */
function paintSide(g, w, h) {
  const { D, H } = GYM, pz = (z) => ((z + D / 2) / D) * w, py = (y) => (1 - y / H) * h, s = w / D;
  const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, gray(0.36)); v.addColorStop(0.5, gray(0.42)); v.addColorStop(1, gray(0.33));
  g.fillStyle = v; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'lighter';
  for (const [x, z] of GYM.downlights) if (Math.abs(x) > 1) { glow(g, pz(z), py(1.55), 0.6 * s, 1.2 * s, 0.32); glow(g, pz(z), py(2.22), 0.24 * s, 0.34 * s, 0.18); }
  g.globalCompositeOperation = 'source-over';
  edgeShade(g, w, h, 0.35 * s, 0.7, 'lrtb');
  edgeShade(g, w, h, 0.14 * s, 0.6, 'lrb');          // corner + floor-junction AO
  cornerShade(g, w, h, 0.7 * s, 0.7);
}
/** Back/front wall lightmap (u = (x + W/2)/W, v = y/H). */
function paintBack(g, w, h) {
  const { W, H } = GYM, px = (x) => ((x + W / 2) / W) * w, py = (y) => (1 - y / H) * h, s = w / W;
  const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, gray(0.40)); v.addColorStop(0.45, gray(0.46)); v.addColorStop(1, gray(0.36));
  g.fillStyle = v; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'lighter';
  for (const [x, z] of GYM.downlights) if (z < -3) { glow(g, px(x), py(1.5), 0.55 * s, 1.15 * s, 0.34); glow(g, px(x), py(2.2), 0.22 * s, 0.34 * s, 0.2); }
  g.globalCompositeOperation = 'source-over';
  edgeShade(g, w, h, 0.4 * s, 0.7, 'lrtb');
  edgeShade(g, w, h, 0.14 * s, 0.6, 'lrb');
  cornerShade(g, w, h, 0.7 * s, 0.7);
}
/** Ceiling lightmap (u = (x + W/2)/W, v = (z + D/2)/D): bright inside the LED rectangle, darker corners. */
function paintCeiling(g, w, h) {
  const { W, D } = GYM, px = (x) => ((x + W / 2) / W) * w, pz = (z) => (1 - (z + D / 2) / D) * h, s = w / W;
  g.fillStyle = gray(0.22); g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'lighter';
  const L = GYM.led;
  glow(g, px((L.x[0] + L.x[1]) / 2), pz((L.z[0] + L.z[1]) / 2), 3.0 * s, 3.4 * s, 0.22);
  for (let i = 0; i < 6; i++) {                    // soft halo along the LED strip
    g.strokeStyle = gray(0.05); g.lineWidth = (0.1 + i * 0.16) * s;
    g.strokeRect(px(L.x[0]), pz(L.z[1]), (L.x[1] - L.x[0]) * s, (L.z[1] - L.z[0]) * s);
  }
  for (const [x, z] of GYM.downlights) glow(g, px(x), pz(z), 0.35 * s, 0.35 * s, 0.10);
  g.globalCompositeOperation = 'source-over';
  edgeShade(g, w, h, 0.6 * s, 0.6);
  edgeShade(g, w, h, 0.12 * s, 0.7);
}

/** Walnut door face: vertical grain + diagonal grooves on the handle half (original pattern). */
function paintDoor(rng) {
  return (g, w, h) => {
    g.fillStyle = '#6E4430'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {                  // grain
      const x = rng() * w, a = 0.05 + rng() * 0.08;
      g.strokeStyle = rng() < 0.5 ? `rgba(40,22,12,${a})` : `rgba(150,96,62,${a})`;
      g.lineWidth = 0.6 + rng() * 2.2; g.beginPath(); g.moveTo(x, 0);
      for (let y = 0; y <= h; y += 32) g.lineTo(x + Math.sin(y * 0.01 + i) * 3, y);
      g.stroke();
    }
    g.save(); g.beginPath(); g.rect(w * 0.5, h * 0.08, w * 0.38, h * 0.84); g.clip();
    for (let k = -8; k < 16; k++) {                  // diagonal grooves (dark cut + light lip)
      const y0 = h * 0.08 + k * h * 0.055;
      g.strokeStyle = 'rgba(28,15,8,0.85)'; g.lineWidth = 3.2;
      g.beginPath(); g.moveTo(w * 0.5, y0 + w * 0.38); g.lineTo(w * 0.88, y0); g.stroke();
      g.strokeStyle = 'rgba(170,118,80,0.55)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(w * 0.5, y0 + w * 0.38 + 3); g.lineTo(w * 0.88, y0 + 3); g.stroke();
    }
    g.restore();
  };
}
/** Original abstract artwork: warm paper, sweeping charcoal arcs and two ink discs. */
function paintArt(rng) {
  return (g, w, h) => {
    g.fillStyle = '#F4F1EA'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#FBFAF6'; g.fillRect(w * 0.08, h * 0.06, w * 0.84, h * 0.88);
    const cx = w * 0.5, cy = h * 0.5;
    for (let i = 0; i < 46; i++) {
      const r = w * (0.12 + rng() * 0.42), a0 = rng() * Math.PI * 2, a1 = a0 + 0.6 + rng() * 1.8;
      g.strokeStyle = `rgba(30,30,32,${0.12 + rng() * 0.4})`; g.lineWidth = 0.6 + rng() * 2.6;
      g.beginPath(); g.ellipse(cx + (rng() - 0.5) * w * 0.25, cy + (rng() - 0.5) * h * 0.35, r, r * (1.2 + rng() * 0.9), rng(), a0, a1); g.stroke();
    }
    g.fillStyle = 'rgba(25,25,28,0.88)'; g.beginPath(); g.arc(w * 0.62, h * 0.34, w * 0.07, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(25,25,28,0.8)'; g.lineWidth = 3; g.beginPath(); g.arc(w * 0.36, h * 0.66, w * 0.12, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(176,140,82,0.85)'; g.fillRect(w * 0.28, h * 0.8, w * 0.44, 4);
  };
}
/** Original "YOGA" wall graphic: a rising sun, three wave lines and leaf shapes above bold letters. */
function paintYoga(g, w, h) {
  g.fillStyle = '#F7F5F0'; g.fillRect(0, 0, w, h);
  const ink = '#1C1C1E';
  g.strokeStyle = ink; g.lineWidth = w * 0.012;
  g.beginPath(); g.arc(w * 0.5, h * 0.46, w * 0.2, Math.PI, 0); g.stroke();                  // half sun
  for (let i = 0; i < 9; i++) {                                                                   // rays
    const a = Math.PI + (i + 0.5) * (Math.PI / 9);
    g.beginPath(); g.moveTo(w * 0.5 + Math.cos(a) * w * 0.25, h * 0.46 + Math.sin(a) * w * 0.25);
    g.lineTo(w * 0.5 + Math.cos(a) * w * 0.31, h * 0.46 + Math.sin(a) * w * 0.31); g.stroke();
  }
  for (let j = 0; j < 3; j++) {                                                                   // waves
    g.beginPath();
    for (let x = w * 0.18; x <= w * 0.82; x += 4) { const y = h * (0.5 + j * 0.035) + Math.sin(x / w * 18 + j) * h * 0.008; if (x === w * 0.18) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
  }
  g.fillStyle = '#3F6B3A';
  for (const [x, y, r, a] of [[0.2, 0.22, 0.05, -0.6], [0.8, 0.22, 0.05, 0.6], [0.14, 0.34, 0.035, -1.0], [0.86, 0.34, 0.035, 1.0]]) {
    g.save(); g.translate(w * x, h * y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, w * r * 0.45, w * r, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `900 ${Math.round(h * 0.26)}px Inter, "Arial Black", Arial, sans-serif`;
  g.fillText('YOGA', w * 0.5, h * 0.88);
}
/** Perforated lamp shade: white with a regular grid of round holes (alpha-free: holes glow via emissiveMap). */
function paintPerf(holes) {
  return (g, w, h) => {
    g.fillStyle = holes ? '#000' : '#F2F0EA'; g.fillRect(0, 0, w, h);
    g.fillStyle = holes ? '#FFE3B8' : '#5A564F';
    const step = w / 24;
    for (let y = step; y < h; y += step) for (let x = (Math.round(y / step) % 2) * step / 2; x < w; x += step) { g.beginPath(); g.arc(x, y, step * 0.22, 0, Math.PI * 2); g.fill(); }
  };
}
/** Bright exterior seen through the windows: pale sky, distant greenery, overexposed. */
function paintOutside(g, w, h) {
  const l = g.createLinearGradient(0, 0, 0, h);
  l.addColorStop(0, '#F4F7F8'); l.addColorStop(0.55, '#E9EFEF'); l.addColorStop(0.75, '#C9D6B8'); l.addColorStop(1, '#AFC49A');
  g.fillStyle = l; g.fillRect(0, 0, w, h);
}

export function define(M, SPEC) {
  const P = SPEC.global.palette;
  const lm = (ctx, key, w, h, fn) => { const t = ctx.tex.canvas(key, w, h, fn, { srgb: false }); return t; };

  M.define('gym.floor', async (ctx) => {
    // 1200 x 600 tiles with a visible 3 mm dark grout (recipe in recipes-site.js: gymTiles)
    const t = await ctx.tex.get('gymTiles', { color: GYM.tileColor || P.gymTile, tile: 2.4, tileW: 1.2, tileH: 0.6, grout: 0.003, seed: 41 });
    const m = pbr(t, { roughness: 1 });
    if (m.normalMap) m.normalScale.set(0.6, 0.6);
    m.lightMap = lm(ctx, 'gym.floorLM', 384, 488, paintFloor); m.lightMap.channel = 1; m.lightMapIntensity = LIGHTMAP_INTENSITY;
    m.envMapIntensity = 0.55;
    return m;
  });
  const wall = (key, painter, w, h) => async (ctx) => {
    const m = new THREE.MeshStandardMaterial({ color: GYM.wallColor, roughness: 0.92, envMapIntensity: 0.4 });
    m.lightMap = lm(ctx, key, w, h, painter); m.lightMapIntensity = LIGHTMAP_INTENSITY;
    return m;
  };
  M.define('gym.wallSide', wall('gym.sideLM', paintSide, 512, 136));
  M.define('gym.wallBack', wall('gym.backLM', paintBack, 480, 160));
  M.define('gym.ceiling', async (ctx) => {
    const m = new THREE.MeshStandardMaterial({ color: GYM.ceilingColor, roughness: 0.95, envMapIntensity: 0.4 });
    m.lightMap = lm(ctx, 'gym.ceilLM', 384, 488, paintCeiling); m.lightMapIntensity = LIGHTMAP_INTENSITY;
    return m;
  });
  // emissive fixtures (tone-mapped to near white)
  M.define('gym.led', async () => new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.8, 4.4) }));
  M.define('gym.outside', async (ctx) => new THREE.MeshBasicMaterial({ map: ctx.tex.canvas('gym.outsideTex', 64, 128, paintOutside), color: new THREE.Color(1.9, 1.9, 1.9) }));
  M.define('gym.door', async (ctx) => new THREE.MeshStandardMaterial({ map: ctx.tex.canvas('gym.doorTex', 256, 512, paintDoor(ctx.rng('gym.door'))), roughness: 0.5 }));
  M.define('gym.doorFrame', async () => new THREE.MeshStandardMaterial({ color: '#5A3624', roughness: 0.55 }));
  M.define('gym.metalDark', async () => new THREE.MeshStandardMaterial({ color: '#1A1B1D', roughness: 0.38, metalness: 0.4 }));
  M.define('gym.rubber', async () => new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.85 }));
  M.define('gym.matNavy', async () => new THREE.MeshStandardMaterial({ color: '#2B3446', roughness: 0.92 }));
  M.define('gym.matGrey', async () => new THREE.MeshStandardMaterial({ color: '#BDBBB5', roughness: 0.92 }));
  M.define('gym.lampShade', async (ctx) => new THREE.MeshStandardMaterial({
    map: ctx.tex.canvas('gym.perfTex', 256, 256, paintPerf(false), { repeat: true }),
    emissiveMap: ctx.tex.canvas('gym.perfGlow', 256, 256, paintPerf(true), { repeat: true }),
    emissive: new THREE.Color(1, 0.9, 0.75), emissiveIntensity: 1.6, roughness: 0.6, side: THREE.DoubleSide,
  }));
  // contact shadows under every floor object (soft rounded rect, about 1.2x the footprint)
  M.define('gym.contactShadow', async (ctx) => new THREE.MeshBasicMaterial({
    map: ctx.tex.canvas('gym.shadowTex', 128, 128, paintShadow), color: 0x000000, transparent: true, opacity: 0.45,
    depthWrite: false,
  }));
  M.define('gym.leaf', async () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, side: THREE.DoubleSide }));
  M.define('gym.pot', async () => new THREE.MeshStandardMaterial({ color: '#1C1C1D', roughness: 0.35, metalness: 0.1 }));
  // prints: a little self-illumination keeps the white paper reading white under the soft baked light
  const print = (key, w, h, drawerFor) => async (ctx) => {
    const t = ctx.tex.canvas(key, w, h, drawerFor(ctx));
    return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: new THREE.Color(0.32, 0.31, 0.29), roughness: 0.85 });
  };
  M.define('gym.art', print('gym.artTex', 320, 560, (ctx) => paintArt(ctx.rng('gym.art'))));
  M.define('gym.yoga', print('gym.yogaTex', 512, 512, () => paintYoga));
}
