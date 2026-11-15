// Shared utilities + contracts. Pure THREE (no DOM) so modules can be built under node --test.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------------- Seeded randomness (Math.random is banned in src/) ---------------- */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
/** Named, independent random streams: rng('palms') always yields the same sequence for a given seed. */
export function makeRng(seed) {
  const streams = new Map();
  const rng = (name = 'default') => {
    if (!streams.has(name)) {
      const r = mulberry32(seed ^ hashStr(name));
      const api = () => r();
      api.range = (a, b) => a + (b - a) * r();
      api.int = (a, b) => Math.floor(a + (b - a + 1) * r());
      api.pick = (arr) => arr[Math.floor(r() * arr.length)];
      api.chance = (p) => r() < p;
      streams.set(name, api);
    }
    return streams.get(name);
  };
  return rng;
}

/* ---------------- Placement registry (grounding / scale / ids) ---------------- */
/**
 * Every placed thing is recorded here. bbox is WORLD space (THREE.Box3 or {min:[x,y,z],max:[x,y,z]}).
 * supportY: height of the surface it must rest on (ground 0, road -0.15, deck, roof...). Use null for things that
 * intentionally do not rest on anything (e.g. wall-mounted, cornices); they are skipped by the grounding check.
 * kind: semantic category used by the scale check (e.g. 'car', 'palm', 'door').
 */
export class Registry {
  constructor() { this.items = []; this.byId = new Map(); }
  place({ kind, id, bbox, supportY = null, module = '?', meta = null }) {
    const b = bbox.isBox3 ? { min: bbox.min.toArray(), max: bbox.max.toArray() } : bbox;
    const rec = { kind, id, bbox: b, supportY, module, meta };
    this.items.push(rec);
    if (id) this.byId.set(id, rec);
    return rec;
  }
  ofKind(kind) { return this.items.filter((r) => r.kind === kind); }
  clear() { this.items.length = 0; this.byId.clear(); }
}

/** bbox of a geometry after a matrix is applied (world space when matrix is the world matrix). */
export function bboxOf(geometry, matrix) {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const b = geometry.boundingBox.clone();
  if (matrix) b.applyMatrix4(matrix);
  return b;
}

/* ---------------- Geometry helpers ---------------- */
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
/** Compose a matrix from position [x,y,z], rotation Y (radians) or Euler [x,y,z], scale number|[x,y,z]. */
export function mat(pos = [0, 0, 0], rot = 0, scale = 1) {
  _p.set(pos[0], pos[1], pos[2]);
  if (typeof rot === 'number') _e.set(0, rot, 0); else _e.set(rot[0], rot[1], rot[2]);
  _q.setFromEuler(_e);
  if (typeof scale === 'number') _s.set(scale, scale, scale); else _s.set(scale[0], scale[1], scale[2]);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

/** Box-projected world UVs: u,v = world coords / tile on the dominant normal axis. Bake transforms BEFORE calling. */
export function worldUV(geometry, tile = 2.0) {
  const pos = geometry.attributes.position, nor = geometry.attributes.normal;
  if (!nor) geometry.computeVertexNormals();
  const n = geometry.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; }
    else if (ax >= az) { u = z; v = y; }
    else { u = x; v = y; }
    uv[i * 2] = u / tile; uv[i * 2 + 1] = v / tile;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

/** Merge [{geometry, matrix}] into one geometry (non-indexed-safe). Attributes must match (position/normal/uv). */
export function mergeParts(parts, { uvTile = null } = {}) {
  const geos = parts.map(({ geometry, matrix }) => {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (uvTile) worldUV(g, uvTile);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    return g;
  });
  const hasColor = geos.some((g) => g.attributes.color);
  if (hasColor) for (const g of geos) if (!g.attributes.color) {
    const c = new Float32Array(g.attributes.position.count * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  if (!merged) throw new Error('mergeParts: attribute mismatch');
  merged.computeBoundingBox(); merged.computeBoundingSphere();
  return merged;
}

/** Build an InstancedMesh from matrices; keeps ids in userData.ids for picking/highlighting. */
export function instanced(geometry, material, matrices, { ids = null, colors = null, name = '', castShadow = true, receiveShadow = true } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, matrices.length));
  mesh.name = name;
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.count = matrices.length;
  if (colors) { colors.forEach((c, i) => mesh.setColorAt(i, c)); }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow;
  mesh.userData.ids = ids || [];
  mesh.computeBoundingBox?.(); mesh.computeBoundingSphere?.();
  return mesh;
}

/** Simple named mesh helper with shadow flags. */
export function mesh(geometry, material, { name = '', castShadow = true, receiveShadow = true } = {}) {
  const m = new THREE.Mesh(geometry, material); m.name = name; m.castShadow = castShadow; m.receiveShadow = receiveShadow; return m;
}

/** Axis-aligned box geometry from min/max corners (handy for architecture). */
export function boxMinMax(x0, y0, z0, x1, y1, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

/** Chamfered box (8 corners cut by c) - catches light on edges. Cheap: 26 faces. */
export function chamferBox(w, h, d, c = 0.02) {
  c = Math.min(c, w / 3, h / 3, d / 3);
  // Built as a convex hull of 24 points via ExtrudeGeometry of a chamfered rectangle with bevel.
  const shape = new THREE.Shape();
  const x = w / 2 - c, y = h / 2 - c;
  shape.moveTo(-x, -h / 2); shape.lineTo(x, -h / 2); shape.lineTo(w / 2, -y); shape.lineTo(w / 2, y);
  shape.lineTo(x, h / 2); shape.lineTo(-x, h / 2); shape.lineTo(-w / 2, y); shape.lineTo(-w / 2, -y); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * c, bevelEnabled: true, bevelThickness: c, bevelSize: 0, bevelSegments: 1, steps: 1 });
  g.translate(0, 0, -(d - 2 * c) / 2);
  g.computeVertexNormals();
  return g;
}

/** Extrude a 2D profile (array of [x,y] in metres: x = outward projection, y = height) along a straight run of
 * length L on the local X axis, facing +z. Use for cornices/mouldings. Ends are capped. */
export function profileRun(profile, L) {
  const shape = new THREE.Shape(profile.map(([px, py]) => new THREE.Vector2(px, py)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false, steps: 1 });
  // shape is in XY with depth along +Z; rotate so the run is along X and projection along +Z
  // rotateY(-90deg): x' = -z, z' = x  => run spans x' in [-L,0], profile projection maps to +Z.
  g.rotateY(-Math.PI / 2);
  g.translate(L / 2, 0, 0);    // centre the run on the origin: x in [-L/2, L/2]
  g.computeVertexNormals();
  return g;
}

/** Polygon-in / rect helpers for scatter masks. */
export const inRect = (x, z, r) => x >= r.x[0] && x <= r.x[1] && z >= r.z[0] && z <= r.z[1];
export const inCircle = (x, z, c) => (x - c.c[0]) ** 2 + (z - c.c[1]) ** 2 <= c.r * c.r;
export const rectOf = (c, w, d) => ({ x: [c[0] - w / 2, c[0] + w / 2], z: [c[1] - d / 2, c[1] + d / 2] });

/** Poisson-ish scatter in a rect with min spacing + reject predicate. Deterministic via rng stream. */
export function scatter(rng, rect, { count = 10, minDist = 2, reject = null, maxTries = 30 } = {}) {
  const pts = [];
  let tries = 0;
  while (pts.length < count && tries < count * maxTries) {
    tries++;
    const x = rng.range(rect.x[0], rect.x[1]), z = rng.range(rect.z[0], rect.z[1]);
    if (reject && reject(x, z)) continue;
    if (pts.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < minDist * minDist)) continue;
    pts.push([x, z]);
  }
  return pts;
}

/** Points along a polyline at a spacing with jitter (for palms along a drive, wall piers...). */
export function along(a, b, spacing, rng = null, jitter = 0) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), n = Math.max(1, Math.floor(L / spacing));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n; let x = a[0] + dx * t, z = a[1] + dz * t;
    if (rng && jitter) { x += rng.range(-jitter, jitter); z += rng.range(-jitter, jitter); }
    out.push([x, z]);
  }
  return out;
}

export const hex = (h) => new THREE.Color(h);   // sRGB hex -> linear working colour (ColorManagement on)
export { THREE };
