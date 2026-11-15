// Tower module: both residential towers (hero + rear) built parametrically from SPEC.towers.
// Neoclassical facade kit: plinth + stilt (columns, soffit, lobby core), 14 floors with the front bay sequence,
// pilasters, slab bands, moulded cornices with scroll capitals, relief panels, recessed balconies, open loggias,
// a two-storey order with engaged columns, interior-mapped windows, frontispiece attics with pediments, roofscape.
// Contract: export async function build(ctx) -> { group, onTimeOfDay(k, state), dispose() }. See docs/CONTRACTS.md.
// Static parts are merged per material per tower; windows are one InstancedMesh per tower.
import * as THREE from 'three';
import SPEC_DEFAULT from './spec/index.js';
import { worldUV, chamferBox } from './util.js';

/* ----------------------------------------- constants ----------------------------------------- */
const K = {
  sill: 0.9, stripSill: 0.5, glassD: 0.12, frameW: 0.055, frameD: 0.035, surround: 0.08,
  balDepth: 1.4, northBalDepth: 1.2, loggiaDepth: 2.0, recessInset: 0.25, recessV: 0.11,
  soffitDrop: 0.25, parapetT: 0.25, mumtySetback: 1.2, chamfer: 0.025,
};
// Ornament atlas regions [u0, v0, u1, v1] (see src/tex/recipes-tower.js)
const ORN = { R: [0, 0.5, 1, 1], C: [0, 0, 0.5, 0.5], K: [0.5, 0.25, 1, 0.5], P: [0.5, 0, 1, 0.25] };
// Profiles (o = outward from the wall, y = up), traversed wall-bottom -> out -> up -> back to the wall.
const CORNICE = [[0, -0.18], [0.07, -0.18], [0.07, -0.08], [0.1, -0.06], [0.14, -0.02], [0.16, 0.02], [0.36, 0.04], [0.38, 0.06],
  [0.38, 0.2], [0.4, 0.22], [0.42, 0.25], [0.44, 0.3], [0.45, 0.35], [0.45, 0.37], [0, 0.37]];
const BAND = [[0, -0.11], [0.04, -0.11], [0.06, -0.09], [0.06, 0.09], [0.04, 0.11], [0, 0.11]];
const CROWN = [[0, -0.14], [0.03, -0.14], [0.06, -0.1], [0.08, -0.04], [0.08, 0], [-0.33, 0], [-0.33, -0.04], [-0.3, -0.08], [-0.25, -0.1]];
const RAKE = [[0, -0.05], [0.16, -0.05], [0.18, -0.02], [0.18, 0.16], [0.22, 0.2], [0.24, 0.26], [0.24, 0.28], [0, 0.28]];
const Y = new THREE.Vector3(0, 1, 0);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pad = (n) => String(n).padStart(2, '0');

/* ----------------------------------------- geometry accumulator ----------------------------------------- */
const _e1 = V3(), _e2 = V3(), _cr = V3(), _n = V3();
class Acc {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.gl = []; this.g = 0; }   // g: night-wash glow tag (aGlow)
  get tris() { return this.pos.length / 9; }
  tri(a, b, c, n, ua, ub, uc) {
    _e1.subVectors(b, a); _e2.subVectors(c, a); _cr.crossVectors(_e1, _e2);
    if (_cr.lengthSq() < 1e-14) return;
    if (_cr.dot(n) < 0) { const t = b; b = c; c = t; const tu = ub; ub = uc; uc = tu; }
    _n.copy(n).normalize();
    for (const [p, uv] of [[a, ua], [b, ub], [c, uc]]) {
      this.pos.push(p.x, p.y, p.z); this.nor.push(_n.x, _n.y, _n.z);
      this.uv.push(uv ? uv[0] : 0, uv ? uv[1] : 0); this.gl.push(this.g);
    }
  }
  quad(a, b, c, d, n, uvq) {
    this.tri(a, b, c, n, uvq?.[0], uvq?.[1], uvq?.[2]);
    this.tri(a, c, d, n, uvq?.[0], uvq?.[2], uvq?.[3]);
  }
  /** Append a BufferGeometry with a matrix; uvFn(u, v) -> [u, v] remaps its uvs (else kept). */
  geo(g, m, uvFn) {
    const ng = g.index ? g.toNonIndexed() : g;
    const p = ng.attributes.position, nr = ng.attributes.normal, uv = ng.attributes.uv;
    const nm = new THREE.Matrix3().getNormalMatrix(m || new THREE.Matrix4());
    const v = V3(), nn = V3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); if (m) v.applyMatrix4(m);
      nn.fromBufferAttribute(nr, i).applyMatrix3(nm).normalize();
      this.pos.push(v.x, v.y, v.z); this.nor.push(nn.x, nn.y, nn.z); this.gl.push(this.g);
      if (uv) { const uu = uv.getX(i), vv = uv.getY(i), r = uvFn ? uvFn(uu, vv) : [uu, vv]; this.uv.push(r[0], r[1]); } else this.uv.push(0, 0);
    }
    if (ng !== g) ng.dispose();
  }
  build(uvTile) {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.gl, 1));
    if (uvTile) worldUV(g, uvTile);
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}

/** A wall plane: u along U (left -> right seen from outside), v = tower-local y, w along the outward normal N. */
class Face {
  constructor(origin, N) {
    this.O = origin.clone(); this.N = N.clone().normalize();
    this.U = V3().crossVectors(Y, this.N).normalize();
    this.m = new THREE.Matrix4().makeBasis(this.U, Y, this.N).setPosition(this.O);
  }
  P(u, v, w) { return this.O.clone().addScaledVector(this.U, u).addScaledVector(Y, v).addScaledVector(this.N, w); }
  shifted(w) { return new Face(this.O.clone().addScaledVector(this.N, w), this.N); }
}
const FRONT = (z) => new Face(V3(0, 0, z), V3(0, 0, 1));      // u = x
const BACK = (z) => new Face(V3(0, 0, z), V3(0, 0, -1));      // u = -x
const EAST = (x) => new Face(V3(x, 0, 0), V3(1, 0, 0));       // u = -z
const WEST = (x) => new Face(V3(x, 0, 0), V3(-1, 0, 0));      // u = z
const TOWER = FRONT(0);                                         // tower-local axes (u = x, v = y, w = z)

const regionUV = (r, s, t) => [r[0] + (r[2] - r[0]) * s, r[1] + (r[3] - r[1]) * t];

/** Box in face coordinates. opts: back (emit the -N face), uv (atlas region for the +N face). */
function fbox(acc, F, u0, u1, v0, v1, w0, w1, { back = true, uv = null } = {}) {
  const c = (u, v, w) => F.P(u, v, w);
  const side = uv ? [regionUV(ORN.P, 0.2, 0.2), regionUV(ORN.P, 0.8, 0.2), regionUV(ORN.P, 0.8, 0.8), regionUV(ORN.P, 0.2, 0.8)] : null;
  const front = uv ? [regionUV(uv, 0, 0), regionUV(uv, 1, 0), regionUV(uv, 1, 1), regionUV(uv, 0, 1)] : null;
  acc.quad(c(u0, v0, w1), c(u1, v0, w1), c(u1, v1, w1), c(u0, v1, w1), F.N, front);
  if (back) acc.quad(c(u0, v0, w0), c(u1, v0, w0), c(u1, v1, w0), c(u0, v1, w0), F.N.clone().negate(), side);
  acc.quad(c(u1, v0, w0), c(u1, v0, w1), c(u1, v1, w1), c(u1, v1, w0), F.U, side);
  acc.quad(c(u0, v0, w0), c(u0, v0, w1), c(u0, v1, w1), c(u0, v1, w0), F.U.clone().negate(), side);
  acc.quad(c(u0, v1, w0), c(u1, v1, w0), c(u1, v1, w1), c(u0, v1, w1), Y, side);
  acc.quad(c(u0, v0, w0), c(u1, v0, w0), c(u1, v0, w1), c(u0, v0, w1), Y.clone().negate(), side);
}
/** Chamfered box in face coordinates (exposed edges catch light). */
function cbox(acc, F, u0, u1, v0, v1, w0, w1, c = K.chamfer) {
  const g = chamferBox(u1 - u0, v1 - v0, w1 - w0, c);
  const m = F.m.clone().multiply(new THREE.Matrix4().makeTranslation((u0 + u1) / 2, (v0 + v1) / 2, (w0 + w1) / 2));
  acc.geo(g, m); g.dispose();
}
/** Vertical cylinder (engaged column) at face (u, w), from v0 to v1. */
function column(acc, F, u, w, v0, v1, r, segs = 14) {
  const g = new THREE.CylinderGeometry(r, r, v1 - v0, segs, 1, true);
  acc.geo(g, F.m.clone().multiply(new THREE.Matrix4().makeTranslation(u, (v0 + v1) / 2, w))); g.dispose();
  cbox(acc, F, u - r - 0.05, u + r + 0.05, v0, v0 + 0.12, w - r - 0.05, w + r + 0.05, 0.02);   // base block
}
const rectPts = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
function archPts(u0, v0, u1, v1, segs = 10) {
  const r = (u1 - u0) / 2, cu = (u0 + u1) / 2, vs = v1 - r, pts = [[u0, v0], [u1, v0], [u1, vs]];
  for (let i = 1; i < segs; i++) { const a = (i / segs) * Math.PI; pts.push([cu + Math.cos(a) * r, vs + Math.sin(a) * r]); }
  pts.push([u0, vs]);
  return pts;
}
/** Planar wall [u0,u1] x [v0,v1] on face F with polygon holes (each an array of [u, v]). */
function wallFace(acc, F, u0, u1, v0, v1, holes = []) {
  const shape = new THREE.Shape([new THREE.Vector2(u0, v0), new THREE.Vector2(u1, v0), new THREE.Vector2(u1, v1), new THREE.Vector2(u0, v1)]);
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([a, b]) => new THREE.Vector2(a, b))));
  shapeTris(acc, shape, (x, y) => F.P(x, y, 0), F.N);
}
function shapeTris(acc, shape, map, n) {
  const pts = shape.extractPoints(1);
  let contour = pts.shape, holes = pts.holes;
  if (THREE.ShapeUtils.isClockWise(contour)) contour = contour.slice().reverse();
  holes = holes.map((h) => (THREE.ShapeUtils.isClockWise(h) ? h : h.slice().reverse()));
  const tris = THREE.ShapeUtils.triangulateShape(contour, holes);
  const all = [...contour, ...holes.flat()];
  for (const [a, b, c] of tris) acc.tri(map(all[a].x, all[a].y), map(all[b].x, all[b].y), map(all[c].x, all[c].y), n);
}
/** Horizontal polygon (tower-local XZ points) at height y, facing up or down, with optional holes. */
function hplane(acc, poly, y, up, holes = []) {
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, z)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, z))));
  shapeTris(acc, shape, (x, z) => V3(x, y, z), up ? Y : Y.clone().negate());
}
/** Reveal (opening jambs) of polygon pts on face F, from w0 back to w0 - D, normals into the opening. */
function reveal(acc, F, pts, D, w0 = 0) {
  let cu = 0, cv = 0; for (const [u, v] of pts) { cu += u; cv += v; } cu /= pts.length; cv /= pts.length;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const eu = b[0] - a[0], ev = b[1] - a[1];
    let nu = -ev, nv = eu; const mu = (a[0] + b[0]) / 2 - cu, mv = (a[1] + b[1]) / 2 - cv;
    if (nu * mu + nv * mv > 0) { nu = -nu; nv = -nv; }
    const n = F.U.clone().multiplyScalar(nu).addScaledVector(Y, nv).normalize();
    acc.quad(F.P(a[0], a[1], w0), F.P(b[0], b[1], w0), F.P(b[0], b[1], w0 - D), F.P(a[0], a[1], w0 - D), n);
  }
}
/** Profile swept along a horizontal path ([x, z] tower-local) with mitred corners; open paths get end caps.
 * Open paths: outward is the right-hand side of travel in (x, z). Closed paths: outward is detected. */
function ring(acc, path, profile, { closed = true, y = 0, so = 1, sy = 1 } = {}) {
  const n = path.length, segs = closed ? n : n - 1;
  let area = 0; for (let i = 0; i < n; i++) { const a = path[i], b = path[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const sg = closed ? (area >= 0 ? 1 : -1) : 1;
  const en = [];
  for (let i = 0; i < segs; i++) {
    const a = path[i], b = path[(i + 1) % n]; let ex = b[0] - a[0], ez = b[1] - a[1]; const L = Math.hypot(ex, ez) || 1; ex /= L; ez /= L;
    en.push({ nx: sg * ez, nz: -sg * ex, ex, ez });
  }
  const mv = [];
  for (let i = 0; i < n; i++) {
    const e0 = closed ? en[(i - 1 + n) % n] : en[Math.max(0, i - 1)], e1 = closed ? en[i] : en[Math.min(segs - 1, i)];
    const s = 1 / Math.max(0.2, 1 + e0.nx * e1.nx + e0.nz * e1.nz);
    mv.push([(e0.nx + e1.nx) * s, (e0.nz + e1.nz) * s]);
  }
  const P = (i, j) => V3(path[i][0] + mv[i][0] * profile[j][0] * so, y + profile[j][1] * sy, path[i][1] + mv[i][1] * profile[j][0] * so);
  for (let e = 0; e < segs; e++) {
    const i0 = e, i1 = (e + 1) % n;
    for (let j = 0; j < profile.length - 1; j++) {
      const dO = (profile[j + 1][0] - profile[j][0]) * so, dY = (profile[j + 1][1] - profile[j][1]) * sy;
      const N = V3(en[e].nx * dY, -dO, en[e].nz * dY);
      if (N.lengthSq() < 1e-12) continue;
      acc.quad(P(i0, j), P(i1, j), P(i1, j + 1), P(i0, j + 1), N);
    }
  }
  if (!closed) {
    const tri = THREE.ShapeUtils.triangulateShape(profile.map(([o, yy]) => new THREE.Vector2(o, yy)), []);
    for (const [end, dir] of [[0, -1], [n - 1, 1]]) {
      const e = en[end === 0 ? 0 : segs - 1], N = V3(e.ex * dir, 0, e.ez * dir);
      for (const [a, b, c] of tri) acc.tri(P(end, a), P(end, b), P(end, c), N);
    }
  }
}
/** Lumpy box for clipped hedges (deterministic hash jitter so shared vertices stay welded). */
function hedgeBox(acc, cx, y0, cz, sx, sy, sz, rotY = 0) {
  const g = new THREE.BoxGeometry(sx, sy, sz, Math.max(1, Math.round(sx / 0.5)), 2, Math.max(1, Math.round(sz / 0.5)));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), yy = p.getY(i), z = p.getZ(i);
    const hsh = Math.sin(x * 12.99 + z * 78.23 + yy * 37.7) * 43758.55, j = (hsh - Math.floor(hsh)) - 0.5;
    if (yy > 0) p.setY(i, yy + j * 0.12);
    if (Math.abs(x) > sx / 2 - 1e-3) p.setX(i, x + Math.sign(x) * j * 0.06);
    if (Math.abs(z) > sz / 2 - 1e-3) p.setZ(i, z + Math.sign(z) * j * 0.06);
  }
  g.computeVertexNormals();
  acc.geo(g, new THREE.Matrix4().makeRotationY(rotY).setPosition(cx, y0 + sy / 2, cz));
  g.dispose();
}

/* ----------------------------------------- layout (pure, from SPEC) ----------------------------------------- */
const layoutCache = new Map();
export function towerLayout(t) {
  const fh = t.floorH, baseY = t.plinthH + t.stiltH, topY = baseY + t.floors * fh;
  const zF = t.d / 2, maxProj = Math.max(0, ...t.front.map((b) => b.project || 0)), zM = zF - maxProj;
  const sum = t.front.reduce((a, b) => a + b.w, 0), s = t.w / sum;
  let x = -t.w / 2;
  const bays = t.front.map((b, i) => {
    const w = b.w * s, o = { ...b, i, x0: x, x1: x + w, w, xc: x + w / 2, z: b.type === 'wing' ? zM + (b.project || 0) : zM };
    x += w; return o;
  });
  bays[bays.length - 1].x1 = t.w / 2;
  const floorY = (i) => (i <= 0 ? t.plinthH : baseY + (i - 1) * fh);
  const floorTop = (i) => baseY + i * fh;
  // north face: alternating window / balcony bays (inferred: "North face: balconies")
  const nb = Math.max(1, Math.round(t.w / 7)), north = [];
  for (let i = 0; i < 2 * nb + 1; i++) north.push({ type: i % 2 ? 'balcony' : 'win', w: i % 2 ? 3.4 : 2.8 });
  const ns = t.w / north.reduce((a, b) => a + b.w, 0);
  let u = -t.w / 2; for (const b of north) { b.w *= ns; b.u0 = u; b.u1 = u + b.w; u += b.w; }
  // loggia bays: inner zone between the outer wing and the stair strip on the given side
  const loggia = new Set();
  for (const lg of t.openLoggias || []) {
    const strip = bays.findIndex((b) => b.type === 'strip'); if (strip < 0) continue;
    const range = lg.side === 'L' ? [0, strip] : [strip, bays.length];
    for (let i = range[0]; i < range[1]; i++) if (bays[i].type === 'small' || bays[i].type === 'balcony') for (const f of lg.floors) loggia.add(i + ':' + f);
  }
  const L = { fh, baseY, topY, zF, zM, bays, north, floorY, floorTop, soffitY: baseY - K.soffitDrop, loggia, s };
  layoutCache.set(t.id, { t, L });
  return L;
}

function outline(t, L) {
  const raw = [[-t.w / 2, -t.d / 2]];
  for (const b of L.bays) raw.push([b.x0, b.z], [b.x1, b.z]);
  raw.push([t.w / 2, -t.d / 2]);
  const out = [];
  for (const p of raw) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) out.push(p); }
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i - 1 + out.length) % out.length], b = out[i], c = out[(i + 1) % out.length];
      if (Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-9) { out.splice(i, 1); changed = true; break; }
    }
  }
  return out;
}

/** World-space box of a front bay on a floor (bayIndex is 1-based, as in ids like Tower_H/F07/B03). */
export function getBayBox(towerId, floor, bayIndex) {
  let rec = layoutCache.get(towerId);
  if (!rec) { const t = SPEC_DEFAULT.towers.find((x) => x.id === towerId); if (!t) return null; towerLayout(t); rec = layoutCache.get(towerId); }
  const { t, L } = rec, b = L.bays[bayIndex - 1];
  if (!b || floor < 0 || floor > t.floors) return null;
  const y0 = L.floorY(floor), y1 = floor === 0 ? L.baseY : y0 + L.fh;
  const box = new THREE.Box3(V3(b.x0, y0, L.zM - t.d / 2), V3(b.x1, y1, b.z));
  return box.applyMatrix4(towerMatrix(t));
}
const towerMatrix = (t) => new THREE.Matrix4().makeRotationY(t.rotY || 0).setPosition(t.c[0], 0, t.c[1]);

/* ----------------------------------------- openings ----------------------------------------- */
function frameRing(acc, F, u0, u1, v0, v1, w, panes, transomV) {
  const fw = K.frameW, a = w - K.frameD, b = w + K.frameD, i = 0.004;
  u0 += i; u1 -= i; v0 += i; v1 -= i;
  fbox(acc, F, u0, u0 + fw, v0, v1, a, b, { back: false });
  fbox(acc, F, u1 - fw, u1, v0, v1, a, b, { back: false });
  fbox(acc, F, u0 + fw, u1 - fw, v0, v0 + fw, a, b, { back: false });
  fbox(acc, F, u0 + fw, u1 - fw, v1 - fw, v1, a, b, { back: false });
  const W = u1 - u0;
  for (let k = 1; k < panes; k++) { const uc = u0 + (W * k) / panes; fbox(acc, F, uc - 0.02, uc + 0.02, v0 + fw, v1 - fw, a + 0.01, b - 0.005, { back: false }); }
  if (transomV) fbox(acc, F, u0 + fw, u1 - fw, transomV - 0.02, transomV + 0.02, a + 0.01, b - 0.005, { back: false });
}

function buildWindow(T, F, o) {
  const { u0, u1, v0, v1 } = o, W = u1 - u0, H = v1 - v0, A = T.acc, sw = K.surround;
  reveal(A[o.revealMat || 'plaster'], F, o.pts, K.glassD + 0.05);
  T.glass.push({ F, uc: (u0 + u1) / 2, vc: (v0 + v1) / 2, W, H, sill: o.roomSill ?? K.sill, kind: o.kind, id: o.id });
  frameRing(A.frame, F, u0, u1, v0, v1, -K.glassD, o.panes || 3, H > 1.6 && o.kind === 'window' ? v1 - 0.45 : 0);
  if (o.sill) fbox(A.trim, F, u0 - 0.12, u1 + 0.12, v0 - 0.07, v0 + 0.015, -K.glassD + 0.045, 0.07);
  if (o.surround && !T.low) {
    fbox(A.trim, F, u0 - sw, u0, v0, v1 + sw, 0, 0.03, { back: false });
    fbox(A.trim, F, u1, u1 + sw, v0, v1 + sw, 0, 0.03, { back: false });
    fbox(A.trim, F, u0, u1, v1, v1 + sw, 0, 0.03, { back: false });
  }
  if (o.head) {
    fbox(A.trim, F, u0 - 0.16, u1 + 0.16, v1 + sw, v1 + sw + 0.1, 0, 0.07, { back: false });
    fbox(A.trim, F, u0 - 0.2, u1 + 0.2, v1 + sw + 0.1, v1 + sw + 0.14, 0, 0.1, { back: false });
  }
  if (o.relief) fbox(A.orn, F, u0 - 0.05, u1 + 0.05, v0 - 0.5, v0 - 0.12, 0, 0.03, { back: false, uv: ORN.R });
}

function buildRecess(T, F, o) {
  const { u0, u1, v0, v1, depth } = o, A = T.acc;
  reveal(A.recess, F, o.pts, depth);
  const Fb = F.shifted(-depth), W = u1 - u0;
  const dw = Math.min(W - 0.5, 2.6), du0 = (u0 + u1) / 2 - dw / 2, du1 = du0 + dw;
  const door = { kind: 'door', u0: du0, u1: du1, v0: v0 + 0.05, v1: v0 + 2.25, panes: dw > 1.8 ? 4 : 3, roomSill: 0.05, revealMat: 'recess', id: o.id };
  door.pts = rectPts(door.u0, door.v0, door.u1, door.v1);
  wallFace(A.recess, Fb, u0, u1, v0, v1, [door.pts]);
  buildWindow(T, Fb, door);
  if (o.rail) {
    const rw = -0.1, rh = 1.0;
    A.bglass.quad(F.P(u0, v0, rw), F.P(u1, v0, rw), F.P(u1, v0 + rh, rw), F.P(u0, v0 + rh, rw), F.N);
    fbox(A.rail, F, u0, u1, v0 + rh, v0 + rh + 0.05, rw - 0.03, rw + 0.03, { back: false });
    fbox(A.rail, F, u0, u0 + 0.04, v0, v0 + rh, rw - 0.02, rw + 0.02, { back: false });
    fbox(A.rail, F, u1 - 0.04, u1, v0, v0 + rh, rw - 0.02, rw + 0.02, { back: false });
  }
  if (o.slabBand) fbox(A.slab, F, u0 - 0.02, u1 + 0.02, v0 - 0.235, v0 + 0.015, 0, 0.07, { back: false });
  if (o.columns) for (const uc of [u0 + 0.24, u1 - 0.24]) {
    column(A.trim, F, uc, -0.22, v0, v1, 0.14, 12);
    fbox(A.orn, F, uc - 0.2, uc + 0.2, v1 - 0.16, v1, -0.42, -0.02, { uv: ORN.K });
  }
}

function buildOpening(T, F, o) { if (o.kind === 'recess') buildRecess(T, F, o); else buildWindow(T, F, o); }

function win(uc, v0, W, H, extra = {}) {
  const u0 = uc - W / 2, u1 = uc + W / 2, v1 = v0 + H;
  return { kind: 'window', u0, u1, v0, v1, pts: rectPts(u0, v0, u1, v1), sill: true, surround: true, head: true, panes: 3, ...extra };
}
function recess(u0, u1, v0, v1, depth, extra = {}) {
  return { kind: 'recess', u0, u1, v0, v1, depth, pts: rectPts(u0, v0, u1, v1), rail: true, ...extra };
}
function facadeWall(T, F, u0, u1, v0, v1, ops, mat = 'plaster') {
  wallFace(T.acc[mat], F, u0, u1, v0, v1, ops.map((o) => o.pts));
  for (const o of ops) buildOpening(T, F, o);
}

/* ----------------------------------------- one tower ----------------------------------------- */
function buildTower(ctx, t, mats, index) {
  const L = towerLayout(t), { fh, baseY, topY, zF, zM, bays, floorY, floorTop, soffitY } = L;
  const isC = (f) => t.cornices.includes(f), isBand = (f) => t.bandFloors.includes(f);
  const rng = ctx.rng('tower.' + t.id);
  const low = ctx.tier?.name === 'low';
  const A = {};
  for (const k of ['plaster', 'trim', 'recess', 'slab', 'deck', 'concrete', 'frame', 'rail', 'bglass', 'orn', 'dark', 'hedge', 'lamp']) A[k] = new Acc();
  const T = { acc: A, glass: [], low };
  const tag = (v) => { for (const k in A) A[k].g = v; };   // night-wash glow tag for the following geometry
  const hw = t.w / 2, hd = t.d / 2;
  const reg = ctx.registry, Mt = towerMatrix(t);
  const place = (kind, id, box, supportY = null) => reg.place({ kind, id, bbox: box.clone().applyMatrix4(Mt), supportY, module: 'tower' });
  const ordMin = Math.min(...(t.orderFloors || [99])), ordMax = Math.max(...(t.orderFloors || [-1]));

  /* ---------- plinth, stilt soffit, core, columns ---------- */
  cbox(A.concrete, TOWER, -hw - 0.15, hw + 0.15, 0, t.plinthH, -hd - 0.15, zF + 0.15, 0.03);
  const ol = outline(t, L);
  hplane(A.recess, ol, soffitY, false);
  const strips = bays.filter((b) => b.type === 'strip');
  const cores = strips.map((b) => ({ x0: b.x0 - 1.2, x1: b.x1 + 1.2, z0: zM - 1.5 - 7, z1: zM - 1.5 }));
  for (const c of cores) {
    const y0 = t.plinthH, y1 = soffitY, Fc = FRONT(c.z1);
    const n = 3, gw = (c.x1 - c.x0 - 0.9) / n, ops = [];
    for (let i = 0; i < n; i++) {
      const a = c.x0 + 0.45 + i * gw + 0.05;
      ops.push({ kind: 'lobby', u0: a, u1: a + gw - 0.1, v0: y0 + 0.05, v1: y1 - 0.35, pts: rectPts(a, y0 + 0.05, a + gw - 0.1, y1 - 0.35), panes: 2, roomSill: 0.05 });
    }
    facadeWall(T, Fc, c.x0, c.x1, y0, y1, ops);
    wallFace(A.plaster, BACK(c.z0), -c.x1, -c.x0, y0, y1);
    wallFace(A.plaster, WEST(c.x0), c.z0, c.z1, y0, y1);
    wallFace(A.plaster, EAST(c.x1), -c.z1, -c.z0, y0, y1);
  }
  // stilt column grid aligned with the front pilaster rhythm (inferred: ~6 m grid)
  const xs = [];
  for (const b of bays) { xs.push(b.x0); if (b.type === 'wing') xs.push(b.xc); }
  xs.push(hw);
  const colX = [];
  for (let x of xs) { x = Math.min(hw - 0.3, Math.max(-hw + 0.3, x)); if (!colX.length || x - colX[colX.length - 1] > 2.6) colX.push(x); }
  const zsN = Math.max(2, Math.round((zM + hd) / t.stiltGrid) + 1), colZ = [];
  for (let i = 0; i < zsN; i++) colZ.push(mix(zM - 0.3, -hd + 0.3, i / (zsN - 1)));
  let ci = 0;
  const lampPts = [];
  for (const x of colX) for (const z of colZ) {
    if (cores.some((c) => x > c.x0 - 0.4 && x < c.x1 + 0.4 && z > c.z0 - 0.4 && z < c.z1 + 0.4)) continue;
    const s = t.stiltCol / 2;
    cbox(A.plaster, TOWER, x - s, x + s, t.plinthH, soffitY, z - s, z + s, 0.03);
    fbox(A.trim, TOWER, x - s - 0.06, x + s + 0.06, soffitY - 0.22, soffitY, z - s - 0.06, z + s + 0.06, {});   // column head
    place('column', `${t.id}/Stilt/C${pad(++ci)}`, new THREE.Box3(V3(x - s, t.plinthH, z - s), V3(x + s, soffitY, z + s)), t.plinthH);
  }
  for (let i = 0; i < colX.length - 1; i++) for (let j = 0; j < colZ.length - 1; j++) lampPts.push([(colX[i] + colX[i + 1]) / 2, (colZ[j] + colZ[j + 1]) / 2]);
  for (const [x, z] of lampPts) {
    if (cores.some((c) => x > c.x0 - 0.5 && x < c.x1 + 0.5 && z > c.z0 - 0.5 && z < c.z1 + 0.5)) continue;
    const g = new THREE.CircleGeometry(0.22, 12); g.rotateX(Math.PI / 2);
    A.lamp.geo(g, new THREE.Matrix4().makeTranslation(x, soffitY - 0.01, z)); g.dispose();
  }

  /* ---------- front facade ---------- */
  for (const b of bays) {
    const F = FRONT(b.z), ops = [];
    for (let f = 1; f <= t.floors; f++) {
      const yb = floorY(f), id = `${t.id}/F${pad(f)}/B${pad(b.i + 1)}`;
      index[id] = { tower: t.id, floor: f, bay: b.i + 1, side: 'S', type: b.type };
      const relief = !isBand(f);
      const isLoggia = L.loggia.has(b.i + ':' + f);
      if (isLoggia) {
        ops.push(recess(b.x0 + K.recessInset, b.x1 - K.recessInset, yb + K.recessV, yb + fh - K.recessV, K.loggiaDepth, { id, columns: true, slabBand: !isC(f - 1) }));
      } else if (b.type === 'wing') {
        const n = b.windows || 2;
        for (let k = 0; k < n; k++) ops.push(win(b.x0 + (b.w * (2 * k + 1)) / (2 * n), yb + K.sill, b.winW, b.winH, { relief, id }));
      } else if (b.type === 'small') {
        ops.push(win(b.xc, yb + K.sill, b.winW, b.winH, { relief, id }));
      } else if (b.type === 'strip') {
        ops.push(win(b.xc, yb + K.stripSill, b.winW, b.winH, { id, kind: 'stair', roomSill: K.stripSill, panes: 2 }));
      } else if (b.type === 'balcony') {
        ops.push(recess(b.x0 + K.recessInset, b.x1 - K.recessInset, yb + K.recessV, yb + fh - K.recessV, K.balDepth, { id, slabBand: !isC(f - 1) }));
      }
    }
    facadeWall(T, F, b.x0, b.x1, soffitY, topY, ops);
  }
  // wing returns (steps between the projecting wing plane and the main plane)
  for (let i = 0; i < bays.length - 1; i++) {
    const a = bays[i], b = bays[i + 1];
    if (Math.abs(a.z - b.z) < 1e-6) continue;
    const x = a.x1, N = a.z > b.z ? V3(1, 0, 0) : V3(-1, 0, 0), z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z);
    A.plaster.quad(V3(x, soffitY, z0), V3(x, soffitY, z1), V3(x, topY, z1), V3(x, topY, z0), N);
  }

  /* ---------- side faces (W/E): plain with window stacks ---------- */
  const zFront0 = bays[0].z, zFront1 = bays[bays.length - 1].z;
  for (const side of ['W', 'E']) {
    const F = side === 'W' ? WEST(-hw) : EAST(hw);
    const zf = side === 'W' ? zFront0 : zFront1;
    const u0 = side === 'W' ? -hd : -zf, u1 = side === 'W' ? zf : hd, Ls = u1 - u0;
    const stacks = t.sides?.[side]?.windowStacks ?? 2, fr = stacks === 1 ? [0.5] : [0.28, 0.72];
    const ops = [];
    for (let f = 1; f <= t.floors; f++) {
      const yb = floorY(f);
      for (const q of fr.slice(0, stacks)) ops.push(win(u0 + Ls * q, yb + K.sill, 1.2, 1.5, { id: `${t.id}/F${pad(f)}/${side}` }));
    }
    facadeWall(T, F, u0, u1, soffitY, topY, ops);
    T[side] = { F, u0, u1, mid: u0 + Ls / 2 };
  }

  /* ---------- north face: balconies ---------- */
  {
    const F = BACK(-hd), ops = [];
    for (const b of L.north) for (let f = 1; f <= t.floors; f++) {
      const yb = floorY(f), id = `${t.id}/F${pad(f)}/N`;
      if (b.type === 'balcony') ops.push(recess(b.u0 + K.recessInset, b.u1 - K.recessInset, yb + K.recessV, yb + fh - K.recessV, K.northBalDepth, { id, slabBand: !isC(f - 1) }));
      else ops.push(win((b.u0 + b.u1) / 2, yb + K.sill, 1.2, 1.5, { id }));
    }
    facadeWall(T, F, -hw, hw, soffitY, topY, ops);
  }

  /* ---------- pilasters, engaged columns, capitals ---------- */
  const pw = t.pilaster.w, pp = t.pilaster.project, capLevels = t.cornices.filter((f) => f > 0).map((f) => floorTop(f));
  const capital = (F, uc, y, wFace, half = 0.31, dep = 0.22) => fbox(A.orn, F, uc - half, uc + half, y - 0.26, y, wFace, wFace + dep, { uv: ORN.K });
  const yOrd0 = floorY(ordMin) + 0.37, yOrd1 = floorTop(ordMax) - 0.18;
  const frontPil = (F, uc, z, wing) => {
    const ord = wing && ordMax > 0;
    tag(0.8);
    cbox(A.plaster, F, uc - pw / 2, uc + pw / 2, baseY, ord ? yOrd0 : topY, -0.1, pp);
    if (ord) column(A.trim, F, uc, 0.06, yOrd0, yOrd1 - 0.26, 0.26, 16);
    for (const y of capLevels) {
      if (ord && y > yOrd0) capital(F, uc, y - 0.18, 0, 0.38, 0.4);
      else capital(F, uc, y - 0.18, 0);
    }
    tag(0);
  };
  for (let i = 0; i < bays.length; i++) {
    const b = bays[i], prev = bays[i - 1];
    if (b.type === 'wing') {
      if (i > 0 && !(prev && prev.type === 'wing')) frontPil(FRONT(b.z), b.x0 + pw / 2, b.z, true);
      if (i > 0 && prev && prev.type === 'wing') frontPil(FRONT(b.z), b.x0, b.z, true);
      frontPil(FRONT(b.z), b.xc, b.z, true);
      const next = bays[i + 1];
      if (i < bays.length - 1 && !(next && next.type === 'wing')) frontPil(FRONT(b.z), b.x1 - pw / 2, b.z, true);
    } else if (i > 0 && prev.type !== 'wing') {
      frontPil(FRONT(b.z), b.x0, b.z, false);
    }
  }
  // corner pilasters (wrap both faces) with capitals on both faces
  tag(0.8);
  for (const [sx, sz, zc] of [[-1, 1, zFront0], [1, 1, zFront1], [-1, -1, -hd], [1, -1, -hd]]) {
    const x = sx * hw;
    const x0 = sx < 0 ? x - pp : x - pw, x1 = sx < 0 ? x + pw : x + pp, z0 = sz > 0 ? zc - pw : zc - pp, z1 = sz > 0 ? zc + pp : zc + pw;
    cbox(A.plaster, TOWER, x0, x1, baseY, topY, z0, z1);
    if (sz > 0) for (const y of capLevels) {
      capital(FRONT(zc), x + (sx < 0 ? pw / 2 : -pw / 2), y - 0.18, pp - 0.12);
      capital(sx < 0 ? WEST(x) : EAST(x), sx < 0 ? zc - pw / 2 : -(zc - pw / 2), y - 0.18, pp - 0.12);
    }
  }
  for (const side of ['W', 'E']) cbox(A.plaster, T[side].F, T[side].mid - pw / 2, T[side].mid + pw / 2, baseY, topY, -0.1, pp);
  for (let i = 1; i < L.north.length; i++) cbox(A.plaster, BACK(-hd), L.north[i].u0 - pw / 2, L.north[i].u0 + pw / 2, baseY, topY, -0.1, pp);
  tag(0);

  /* ---------- slab bands and heavy cornices ---------- */
  const cs = t.cornice, cso = cs.project / 0.45, csy = cs.h / 0.55, bso = t.slabBand.project / 0.06, bsy = t.slabBand.h / 0.22;
  for (let f = 0; f <= t.floors; f++) {
    tag(isC(f) ? 0.5 : 0.2);
    if (isC(f)) ring(A.trim, ol, CORNICE, { y: floorTop(f), so: cso, sy: csy });
    else if (f >= 1 && f < t.floors) ring(A.trim, ol, BAND, { y: floorTop(f), so: bso, sy: bsy });
  }

  tag(0);
  /* ---------- roof: deck, parapet, crown ---------- */
  const shaft = t.roof?.shaft ? { x0: -t.roof.shaft.w / 2, x1: t.roof.shaft.w / 2, z0: -t.roof.shaft.d / 2, z1: t.roof.shaft.d / 2 } : null;
  hplane(A.deck, ol, topY, true, shaft ? [[[shaft.x0, shaft.z0], [shaft.x1, shaft.z0], [shaft.x1, shaft.z1], [shaft.x0, shaft.z1]]] : []);
  const pH = t.parapetH;
  tag(0.7);
  ring(A.plaster, ol, [[0, 0], [0, pH], [-K.parapetT, pH], [-K.parapetT, 0]], { y: topY });
  ring(A.trim, ol, CROWN, { y: topY + pH });
  tag(0);
  if (shaft) {
    const sd = 6, sp = [[shaft.x0, shaft.z0], [shaft.x1, shaft.z0], [shaft.x1, shaft.z1], [shaft.x0, shaft.z1]];
    A.recess.quad(V3(shaft.x0, topY, shaft.z0), V3(shaft.x1, topY, shaft.z0), V3(shaft.x1, topY - sd, shaft.z0), V3(shaft.x0, topY - sd, shaft.z0), V3(0, 0, 1));
    A.recess.quad(V3(shaft.x0, topY, shaft.z1), V3(shaft.x1, topY, shaft.z1), V3(shaft.x1, topY - sd, shaft.z1), V3(shaft.x0, topY - sd, shaft.z1), V3(0, 0, -1));
    A.recess.quad(V3(shaft.x0, topY, shaft.z0), V3(shaft.x0, topY, shaft.z1), V3(shaft.x0, topY - sd, shaft.z1), V3(shaft.x0, topY - sd, shaft.z0), V3(1, 0, 0));
    A.recess.quad(V3(shaft.x1, topY, shaft.z0), V3(shaft.x1, topY, shaft.z1), V3(shaft.x1, topY - sd, shaft.z1), V3(shaft.x1, topY - sd, shaft.z0), V3(-1, 0, 0));
    hplane(A.recess, sp, topY - sd, true);
    ring(A.plaster, sp, [[0.2, 0], [0.2, 1.0], [0, 1.0], [0, 0]], { y: topY });
    ring(A.trim, sp, [[0.24, 0.94], [0.24, 1.04], [-0.04, 1.04], [-0.04, 0.94]], { y: topY });
  }

  /* ---------- frontispiece attics + pediments over each wing ---------- */
  const at = t.attic, th = 0.48, ex = 0.12, aTop = topY + at.bandH, rakeT = 0.28, aCap = aTop + 0.37 * csy * 0.85;
  const pitch = THREE.MathUtils.degToRad(at.pedimentPitchDeg);
  const fronts = [];
  tag(1.2);
  for (const b of bays.filter((q) => q.type === 'wing')) {
    const x0 = b.x0 - ex, x1 = b.x1 + ex, zf = b.z + ex, zb = zf - th, zr = b.z - at.returnDepth;
    fronts.push({ x0, x1, zr });
    cbox(A.plaster, TOWER, x0, x1, topY, aCap, zb, zf, 0.02);
    cbox(A.plaster, TOWER, x0, x0 + th, topY, aCap, zr, zb + 0.01, 0.02);
    cbox(A.plaster, TOWER, x1 - th, x1, topY, aCap, zr, zb + 0.01, 0.02);
    const Ff = FRONT(zf);
    // corner pilaster strips + 3 round-headed dark windows
    fbox(A.trim, Ff, x0, x0 + 0.4, topY + 0.2, aTop - 0.18, 0, 0.06, { back: false });
    fbox(A.trim, Ff, x1 - 0.4, x1, topY + 0.2, aTop - 0.18, 0, 0.06, { back: false });
    const nW = at.archWindows, aw = 0.72, ah = 1.4, ay = topY + 0.55, span = x1 - x0;
    for (let k = 0; k < nW; k++) {
      const uc = x0 + (span * (k + 1)) / (nW + 1), pts = archPts(uc - aw / 2, ay, uc + aw / 2, ay + ah);
      shapeTris(A.dark, new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v))), (u, v) => Ff.P(u, v, 0.004), Ff.N);
      const outer = archPts(uc - aw / 2 - 0.09, ay, uc + aw / 2 + 0.09, ay + ah + 0.09);
      const sh = new THREE.Shape(outer.map(([u, v]) => new THREE.Vector2(u, v))); sh.holes.push(new THREE.Path(pts.map(([u, v]) => new THREE.Vector2(u, v))));
      const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false, curveSegments: 1 });
      A.trim.geo(eg, Ff.m); eg.dispose();
      fbox(A.trim, Ff, uc - aw / 2 - 0.14, uc + aw / 2 + 0.14, ay - 0.08, ay, 0, 0.08, { back: false });
      fbox(A.trim, Ff, uc - 0.07, uc + 0.07, ay + ah - 0.02, ay + ah + 0.16, 0, 0.07);          // keystone
    }
    // attic cornice (open path: right return -> front -> left return)
    ring(A.trim, [[x1, zr], [x1, zf], [x0, zf], [x0, zr]], CORNICE, { closed: false, y: aTop, so: cso * 0.85, sy: csy * 0.85 });
    // pediment: tympanum + raking cornices + cartouche + acroterion
    const yb = aCap, half = (x1 - x0) / 2 - 0.1, hT = Math.min(half * Math.tan(pitch), at.pedimentH - rakeT - 0.45);
    const xc = (x0 + x1) / 2, ztf = zf - 0.1;
    const tri = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, hT)]);
    const tg = new THREE.ExtrudeGeometry(tri, { depth: 0.3, bevelEnabled: false });
    A.plaster.geo(tg, new THREE.Matrix4().makeTranslation(xc, yb, ztf - 0.3)); tg.dispose();
    const Ls = half / Math.cos(pitch) + 0.12;
    for (const s of [-1, 1]) {
      const tmp = new Acc();
      ring(tmp, [[Ls, 0], [0, 0]], RAKE, { closed: false });
      const g = tmp.build(null);
      const m = new THREE.Matrix4().makeTranslation(xc + s * (half + 0.06), yb - 0.02, ztf)
        .multiply(new THREE.Matrix4().makeRotationZ(s < 0 ? pitch : -pitch))
        .multiply(new THREE.Matrix4().makeTranslation(s < 0 ? 0 : -Ls, 0, 0));
      A.trim.geo(g, m); g.dispose();
    }
    const cg = new THREE.CircleGeometry(0.5, 28);
    A.orn.geo(cg, new THREE.Matrix4().makeTranslation(xc, yb + hT * 0.4, ztf + 0.012).multiply(new THREE.Matrix4().makeScale(Math.min(1.5, half * 0.5), Math.min(0.62, hT * 0.6), 1)),
      (u, v) => regionUV(ORN.C, u, v));
    cg.dispose();
    cbox(A.trim, TOWER, xc - 0.28, xc + 0.28, yb + hT + rakeT - 0.08, yb + hT + rakeT + 0.42, ztf - 0.3, ztf + 0.06, 0.03);
    for (const s of [-1, 1]) cbox(A.trim, TOWER, xc + s * half - 0.2, xc + s * half + 0.2, yb, yb + 0.32, ztf - 0.3, ztf + 0.06, 0.02);
    place('attic', `${t.id}/Attic/${b.i + 1}`, new THREE.Box3(V3(x0, topY, zr), V3(x1, yb + hT + rakeT + 0.42, zf)), null);
  }

  tag(0);
  /* ---------- mumties ---------- */
  const mumties = [];
  const mumtyBox = (x0, x1, z0, z1, h1, h2, tiers, id) => {
    tag(0.9);
    cbox(A.plaster, TOWER, x0, x1, topY, topY + h1, z0, z1, 0.03);
    ring(A.trim, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], CORNICE, { y: topY + h1 - 0.04, so: cso * 0.6, sy: csy * 0.6 });
    let top = topY + h1;
    if (tiers > 1) {
      const i = 0.7, y0 = topY + h1;
      cbox(A.plaster, TOWER, x0 + i, x1 - i, y0, y0 + h2, z0 + i, z1 - i, 0.03);
      ring(A.trim, [[x0 + i, z0 + i], [x1 - i, z0 + i], [x1 - i, z1 - i], [x0 + i, z1 - i]], CORNICE, { y: y0 + h2 - 0.04, so: cso * 0.5, sy: csy * 0.5 });
      top = y0 + h2;
    }
    const Fm = FRONT(z1), dw = Math.min(1.0, (x1 - x0) * 0.3);
    shapeTris(A.dark, new THREE.Shape(archPts((x0 + x1) / 2 - dw / 2, topY + 0.9, (x0 + x1) / 2 + dw / 2, topY + Math.min(h1 - 0.5, 2.6)).map(([u, v]) => new THREE.Vector2(u, v))),
      (u, v) => Fm.P(u, v, 0.004), Fm.N);
    fbox(A.frame, BACK(z0), -(x0 + x1) / 2 - 0.5, -(x0 + x1) / 2 + 0.5, topY, topY + 2.1, 0, 0.03, { back: false });   // service door
    mumties.push({ x0, x1, z0, z1 });
    tag(0);
    place('mumty', `${t.id}/Roof/${id}`, new THREE.Box3(V3(x0, topY, z0), V3(x1, top + 0.3, z1)), topY);
  };
  strips.forEach((b, i) => {
    const m = t.mumty, z1 = zM - K.mumtySetback;
    mumtyBox(b.xc - m.w / 2, b.xc + m.w / 2, z1 - m.d, z1, m.h1, m.h2, m.tiers, 'M' + (i + 1));
  });
  const nx = t.roof?.extraMumties || 0;
  for (let i = 0; i < nx; i++) {
    const xcm = -hw + ((i + 0.5) * t.w) / nx, z0 = -hd + 1.3;
    mumtyBox(xcm - 2, xcm + 2, z0, z0 + 3.6, 2.9, 0, 1, 'X' + (i + 1));
  }

  /* ---------- roof planters and hedges ---------- */
  const obst = [...mumties.map((m) => ({ x0: m.x0 - 0.8, x1: m.x1 + 0.8, z0: m.z0 - 0.8, z1: m.z1 + 0.8 }))];
  if (shaft) obst.push({ x0: shaft.x0 - 1, x1: shaft.x1 + 1, z0: shaft.z0 - 1, z1: shaft.z1 + 1 });
  for (const f of fronts) obst.push({ x0: f.x0 - 0.8, x1: f.x1 + 0.8, z0: f.zr - 0.8, z1: zF + 1 });
  const hit = (r) => r.x0 < -hw + 1.3 || r.x1 > hw - 1.3 || r.z0 < -hd + 1.3 || r.z1 > zM - 1.0 || obst.some((o) => r.x0 < o.x1 && r.x1 > o.x0 && r.z0 < o.z1 && r.z1 > o.z0);
  const nP = t.roof?.sunkenPlanters || 0, ps = 3, cand = [];
  for (const zq of [0.1, -0.1, 0.3, -0.3, 0]) for (const xq of [-0.25, 0.25, -0.375, 0.375, -0.125, 0.125, 0]) cand.push([xq * t.w, zq * t.d]);
  let pc = 0;
  for (const [x, z] of cand) {
    if (pc >= nP) break;
    const r = { x0: x - ps / 2, x1: x + ps / 2, z0: z - ps / 2, z1: z + ps / 2 };
    if (hit(r)) continue;
    obst.push({ x0: r.x0 - 1, x1: r.x1 + 1, z0: r.z0 - 1, z1: r.z1 + 1 });
    ring(A.trim, [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]], [[0.18, 0], [0.18, 0.45], [0, 0.45], [0, 0.32]], { y: topY });
    hedgeBox(A.hedge, x, topY, z, ps - 0.02, 0.38, ps - 0.02);
    place('planter', `${t.id}/Roof/P${++pc}`, new THREE.Box3(V3(r.x0 - 0.18, topY, r.z0 - 0.18), V3(r.x1 + 0.18, topY + 0.5, r.z1 + 0.18)), topY);
  }
  if (t.roof?.perimeterHedge) {
    const o = K.parapetT, wdt = 0.6, segs = [];
    segs.push({ ax: 'x', c: -hd + o + wdt / 2, a: -hw + o + wdt, b: hw - o - wdt });                       // north
    const sideEnd = Math.min(...fronts.map((f) => f.zr)) - 0.4;
    segs.push({ ax: 'z', c: -hw + o + wdt / 2, a: -hd + o, b: Math.min(sideEnd, zM - o) });                // west
    segs.push({ ax: 'z', c: hw - o - wdt / 2, a: -hd + o, b: Math.min(sideEnd, zM - o) });                 // east
    const fr = fronts.slice().sort((p, q) => p.x0 - q.x0);
    for (let i = 0; i < fr.length - 1; i++) segs.push({ ax: 'x', c: zM - o - wdt / 2, a: fr[i].x1 + 0.1, b: fr[i + 1].x0 - 0.1 });
    for (const s of segs) {
      if (s.b - s.a < 1) continue;
      const mid = (s.a + s.b) / 2, len = s.b - s.a;
      const [cx, cz, sx, sz] = s.ax === 'x' ? [mid, s.c, len, wdt] : [s.c, mid, wdt, len];
      fbox(A.trim, TOWER, cx - sx / 2, cx + sx / 2, topY, topY + 0.5, cz - sz / 2, cz + sz / 2, {});
      hedgeBox(A.hedge, cx, topY + 0.5, cz, sx - 0.1, 0.42, sz - 0.1);
    }
  }

  /* ---------- registry: tower + floors ---------- */
  const crown = topY + at.bandH + 0.4 + at.pedimentH;
  place('tower', t.id, new THREE.Box3(V3(-hw - 0.15, 0, -hd - 0.15), V3(hw + 0.15, crown, zF + 0.15)), 0);
  for (let f = 0; f <= t.floors; f++) {
    const y0 = floorY(f), y1 = f === 0 ? baseY : y0 + fh;
    place('floor', `${t.id}/F${pad(f)}`, new THREE.Box3(V3(-hw, y0, -hd), V3(hw, y1, zF)), null);
  }

  /* ---------- meshes ---------- */
  const tg = new THREE.Group(); tg.name = t.id;
  tg.position.set(t.c[0], 0, t.c[1]); tg.rotation.y = t.rotY || 0;
  const add = (key, matName, name, { tile = 2, cast = true, receive = true } = {}) => {
    const g = A[key].build(tile); if (!g) return;
    const m = new THREE.Mesh(g, mats[matName]); m.name = `${t.id}/${name}`; m.castShadow = cast; m.receiveShadow = receive;
    tg.add(m);
  };
  add('plaster', 'tower.plaster', 'Facade/Plaster');
  add('trim', 'tower.trim', 'Facade/Trim');
  add('recess', 'tower.recess', 'Facade/Recess');
  add('slab', 'slabWhite', 'Facade/SlabEdge');
  add('deck', 'roofDeck', 'Roof/Deck', { tile: 4, cast: false });
  add('concrete', 'concrete', 'Plinth', { tile: 2 });
  add('frame', 'frame', 'Facade/Frames', { tile: null, cast: false });
  add('rail', 'rail', 'Facade/Rails', { tile: null, cast: false });
  add('bglass', 'balconyGlass', 'Facade/RailGlass', { tile: null, cast: false, receive: false });
  add('orn', 'tower.ornament', 'Facade/Ornament', { tile: null, cast: false });
  add('dark', 'tower.darkGlass', 'Facade/AtticWindows', { tile: null, cast: false });
  add('hedge', 'tower.hedge', 'Roof/Hedges', { tile: 1.5, cast: false });
  add('lamp', 'tower.lamp', 'Stilt/Downlights', { tile: null, cast: false, receive: false });

  // windows: one InstancedMesh; aWin = (variant + sill/2, curtain, lit, tint)
  const gl = T.glass, plane = new THREE.PlaneGeometry(1, 1), aWin = new Float32Array(gl.length * 4), mats4 = [], ids = [];
  // lit state is per apartment unit (front bays share an id; side/north ids are split by position), ~40 % lit
  const litP = Math.min(0.4, ctx.SPEC.global.timeOfDay.litWindowFraction), unitLit = new Map();
  gl.forEach((g, i) => {
    const pos = g.F.P(g.uc, g.vc, -K.glassD);
    mats4.push(new THREE.Matrix4().makeBasis(g.F.U.clone().multiplyScalar(g.W), Y.clone().multiplyScalar(g.H), g.F.N).setPosition(pos));
    ids.push(g.id || `${t.id}/W${i}`);
    let variant = rng.int(0, 7), cur, lit, tint = rng();
    const cr = rng();
    cur = cr < 0.3 ? 0 : cr < 0.72 ? rng.range(0.25, 0.6) : rng.range(0.85, 1);
    const unit = /\/[NWE]$/.test(g.id || '') ? `${g.id}:${Math.round(g.uc / 3)}` : (g.id || `W${i}`);
    if (!unitLit.has(unit)) unitLit.set(unit, rng.chance(litP) ? 1 : 0);
    lit = unitLit.get(unit);
    if (lit && rng.chance(0.25)) cur = rng.range(0.88, 1);          // curtain-dimmed lit units
    if (g.kind === 'stair') { variant = 5; cur = 0; lit = rng.chance(0.22) ? 1 : 0; }   // no continuous stair stripe
    if (g.kind === 'lobby') { variant = 4; cur = 0; lit = 1; tint = 1; }
    aWin.set([variant + Math.min(1.5, Math.max(0, g.sill)) / 2, cur, lit, tint], i * 4);
  });
  plane.setAttribute('aWin', new THREE.InstancedBufferAttribute(aWin, 4));
  const im = new THREE.InstancedMesh(plane, mats['tower.glass'], Math.max(1, gl.length));
  mats4.forEach((m, i) => im.setMatrixAt(i, m));
  im.count = gl.length; im.instanceMatrix.needsUpdate = true;
  im.name = `${t.id}/Facade/Windows`; im.castShadow = false; im.receiveShadow = true; im.userData.ids = ids;
  im.computeBoundingBox(); im.computeBoundingSphere();
  tg.add(im);
  return tg;
}
const mix = (a, b, t) => a + (b - a) * t;
const WASH_I = 0.11;   // night facade wash strength (emissive multiplier on albedo)

/* ----------------------------------------- module entry ----------------------------------------- */
export async function build(ctx) {
  const { SPEC, M } = ctx;
  const names = ['tower.plaster', 'tower.trim', 'tower.recess', 'slabWhite', 'roofDeck', 'concrete', 'frame', 'rail', 'balconyGlass',
    'tower.glass', 'tower.ornament', 'tower.darkGlass', 'tower.hedge', 'tower.lamp'];
  const list = await Promise.all(names.map((n) => M.use(n)));
  const mats = Object.fromEntries(names.map((n, i) => [n, list[i]]));
  const group = new THREE.Group(); group.name = 'Module_tower';
  const index = {};
  for (const t of SPEC.towers) group.add(buildTower(ctx, t, mats, index));
  group.userData.index = index;
  group.userData.getBayBox = getBayBox;
  const glassU = mats['tower.glass'].userData.uniforms, lamp = mats['tower.lamp'], dark = mats['tower.darkGlass'];
  const washK = { 'tower.plaster': 1, 'tower.trim': 1, 'tower.ornament': 1, 'tower.recess': 0.6 };
  const facades = Object.entries(washK).map(([n, w]) => [mats[n].userData.facade, w]).filter(([u]) => u);
  return {
    group,
    onTimeOfDay(k, s) {
      const night = s?.night ?? 0, sunI = s?.sunI ?? 3;
      if (glassU) {
        glassU.uNight.value = night;
        glassU.uDayI.value = (0.04 + 0.11 * Math.min(1, sunI / 3.2)) * (1 - 0.6 * night);
      }
      if (lamp) lamp.emissiveIntensity = night * 2.2;
      if (dark) dark.emissiveIntensity = night * 1.4;                         // round-headed attic windows glow
      const wash = Math.max(0, (night - 0.15) / 0.85);                          // facade wash only from dusk on
      for (const [u, w] of facades) u.uWash.value = wash * w * WASH_I;
    },
    dispose() { group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); },
  };
}
