// Vegetation module: palms (2 prototypes, 2 InstancedMeshes each), leaf-card shrubs + bougainvillea, clipped hedges
// with leafy edge cards, broadleaf trees (3 belt variants + plaza tree) built as instanced clusters of alpha-cut leaf
// cards around small opaque cores, plus palm contact-shadow decals. No wind in v1. All placement uses ctx.rng streams.
import * as THREE from 'three';
import { amenityLayout } from './amenities.js';

/* ------------------------------ deterministic value noise (geometry displacement) ------------------------------ */
function hash3(i, j, k) {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(k | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi, s = (t) => t * t * (3 - 2 * t), u = s(fx), v = s(fy), w = s(fz);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

export async function build(ctx) {
  const { SPEC, util, registry, M, rng, tier } = ctx;
  const low = tier.name === 'low';
  const L = amenityLayout(SPEC);
  const group = new THREE.Group();
  group.name = 'Module_vegetation';
  const MOD = 'vegetation';
  const V3 = THREE.Vector3;

  const [mBark, mFrond, mFoliage, mShadow] = await Promise.all(['vegetation.bark', 'vegetation.frond', 'vegetation.foliage', 'contactShadow'].map((n) => M.use(n)));

  /* =============================== obstacles =============================== */
  const pad = (r, m) => ({ x: [r.x[0] - m, r.x[1] + m], z: [r.z[0] - m, r.z[1] + m] });
  const blocked = [];
  for (const t of SPEC.towers) blocked.push(pad(util.rectOf(t.c, t.w, t.d), 1.3));
  for (const g of SPEC.site.gates) blocked.push(pad(util.rectOf(g.c, g.w, g.d), 1.5));
  blocked.push(pad(L.deck, 0.4), pad(L.plinth, 0.8), ...L.planters.map((p) => pad(p, 0.5)));
  for (const p of SPEC.site.parking) blocked.push(pad(p, 0.5));
  blocked.push(pad(util.rectOf(L.lawn.c, L.lawn.w, L.lawn.d), 1.0));
  const circles = [{ c: L.play.c, r: L.play.r + 1.0 }, { c: L.ring.c, r: L.ring.r + 1.0 }];
  const plot = SPEC.site.plot;
  const isBlocked = (x, z) => blocked.some((r) => util.inRect(x, z, r)) || circles.some((c) => util.inCircle(x, z, c))
    || x < plot.x[0] + 0.6 || x > plot.x[1] - 0.6 || z < plot.z[0] + 0.6 || z > plot.z[1] - 0.6;

  /* =============================== palms =============================== */
  function trunkGeo({ H, r0, rTop, bend, radial, rings }) {
    const pos = [], uv = [], idx = [];
    const centre = (t) => [bend * t * t, H * t];
    for (let j = 0; j <= rings; j++) {
      const t = j / rings, [cx, cy] = centre(t);
      let r = (r0 + (rTop - r0) * t) * (1 + 0.5 * Math.exp(-t * H * 2.2));
      if (t > 0.93) r *= 1.3;                               // crown-shaft knob
      for (let i = 0; i <= radial; i++) {
        const a = (i / radial) * Math.PI * 2;
        pos.push(cx + Math.cos(a) * r, cy, Math.sin(a) * r);
        uv.push(i / radial, cy);
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < radial; i++) {
      const a = j * (radial + 1) + i, b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const [tx, ty] = centre(1);
    return { geometry: g, top: new V3(tx, ty, 0) };
  }

  function frondGeo({ len, wid, segs, pitch0, droop, fold, foldGain, sweep }) {
    const pos = [], uv = [], idx = [], nrm = [];
    const p = new V3();
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, pitch = pitch0 - droop * Math.pow(t, 1.5);
      const T = new V3(Math.cos(pitch), Math.sin(pitch), 0), S = new V3(0, 0, 1), N = new V3().crossVectors(T, S);
      if (s > 0) p.addScaledVector(T, len / segs);
      const env = t < 0.1 ? 0 : Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * t)), 0.7) * Math.min(1, (t - 0.1) / 0.12);
      const w = wid * env, f = fold + foldGain * t;
      const side = (sg) => p.clone().addScaledVector(S, sg * Math.cos(f) * w).addScaledVector(N, Math.sin(f) * w).addScaledVector(T, w * sweep);
      const up = new V3().copy(N).negate().multiplyScalar(0.55).add(new V3(0, 0.8, 0)).normalize();
      for (const [q, u] of [[side(1), 0], [p, 0.5], [side(-1), 1]]) { pos.push(q.x, q.y, q.z); uv.push(u, t); nrm.push(up.x, up.y, up.z); }
    }
    for (let s = 0; s < segs; s++) {
      const a = s * 3, b = a + 3;  // a: L0 P0 R0 ; b: L1 P1 R1
      idx.push(a + 1, a, b, a + 1, b, b + 1, a + 1, b + 1, b + 2, a + 1, b + 2, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  function palmProto(name, o, r) {
    const tr = trunkGeo(o.trunk);
    const fronds = [];
    const n = o.fronds;
    for (let i = 0; i < n; i++) {
      const layer = i % 3, az = i * 2.39996 + r.range(-0.2, 0.2);
      const g = frondGeo({
        len: o.len * (layer === 0 ? 0.82 : 1) * r.range(0.9, 1.08), wid: o.wid * r.range(0.9, 1.1), segs: o.segs,
        pitch0: o.pitch[layer] + r.range(-0.12, 0.12), droop: o.droop * r.range(0.85, 1.15),
        fold: o.fold, foldGain: o.foldGain, sweep: 0.25,
      });
      const m = new THREE.Matrix4().makeRotationY(az);
      m.setPosition(tr.top.x + Math.cos(-az) * 0.1, tr.top.y - 0.12 * layer, tr.top.z + Math.sin(-az) * 0.1);
      fronds.push({ geometry: g, matrix: m });
    }
    const crown = util.mergeParts(fronds);
    const box = new THREE.Box3().union((tr.geometry.computeBoundingBox(), tr.geometry.boundingBox)).union(crown.boundingBox);
    return { name, trunk: tr.geometry, crown, box };
  }

  const frondCount = tier.palmFronds || 14;
  const pr = rng('palm-protos');
  const PROTO = {
    A: palmProto('PalmA', { // tall coconut palm, curved trunk, long drooping fronds
      trunk: { H: 7.0, r0: 0.19, rTop: 0.15, bend: 0.85, radial: 7, rings: 10 },
      fronds: frondCount, len: 4.0, wid: 0.8, segs: low ? 6 : 7, pitch: [1.0, 0.5, 0.08], droop: 1.35, fold: 0.45, foldGain: 0.45,
    }, pr),
    B: palmProto('PalmB', { // shorter, bushier ornamental palm with arching feathery fronds
      trunk: { H: 3.9, r0: 0.23, rTop: 0.19, bend: 0.3, radial: 7, rings: 8 },
      fronds: frondCount + 2, len: 2.9, wid: 0.62, segs: low ? 5 : 6, pitch: [1.2, 0.8, 0.4], droop: 1.45, fold: -0.15, foldGain: 0.55,
    }, pr),
  };

  const palms = [];   // {proto, x, z, y}
  const palmTaken = [];
  const rp = rng('palms');
  function addPalm(proto, x, z, y = 0, force = false) {
    if (!force && isBlocked(x, z)) return false;
    if (palmTaken.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < 3.4 * 3.4)) return false;
    palmTaken.push([x, z]); palms.push({ proto, x, z, y }); return true;
  }
  const row = (proto, a, b, spacing, jitter = 0.35, keep = 1) => {
    for (const [x, z] of util.along(a, b, spacing, rp, jitter)) if (!low || rp() < keep) addPalm(proto, x, z);
  };
  // deliberate spots first (deck, clubhouse) so the rows avoid them
  addPalm('B', -23.05, 29.0, L.deckY, true);
  addPalm('B', -23.05, 39.7, L.deckY, true);
  addPalm('A', -39.8, 16.0, 0, true);
  addPalm('B', -22.6, 27.0, 0, true);
  addPalm('A', -42.3, 30.8); addPalm('A', -42.6, 35.6);
  row('A', [-7.6, 38.6], [12.6, 38.6], 6.7, 0.25);           // front, between the gates (ref A)
  row('A', [-55.6, 38.9], [-43.5, 38.9], 6.0, 0.3);          // front-left corner
  row('A', [-56.2, -37], [-56.2, 33], 7.5, 0.4, 0.7);        // west boundary
  row('A', [-50, -38.4], [52, -38.4], 8.5, 0.5, 0.7);        // north boundary
  row('A', [56.2, -36], [56.2, 36], 7.0, 0.4, 0.7);          // east boundary
  row('B', [25.6, -37], [25.6, 33], 7.0, 0.35, 0.7);         // plaza west edge
  row('B', [-43, -5.6], [-14, -5.6], 7.5, 0.3, 0.7);         // drive edge in front of the rear tower
  for (const a of [15, 75, 140, 215, 290]) { const t = (a * Math.PI) / 180; addPalm('B', L.play.c[0] + Math.cos(t) * 6.7, L.play.c[1] + Math.sin(t) * 6.7); }
  row('B', [30, -18.5], [50, -18.5], 10, 0.3);               // lawn north edge
  row('B', [30, -35.6], [50, -35.6], 10, 0.3);               // lawn south edge

  const shadowMats = [], shadowIds = [];
  for (const key of ['A', 'B']) {
    const P = PROTO[key], list = palms.filter((p) => p.proto === key);
    const mats = [], ids = [], tintT = [], tintF = [];
    for (const p of list) {
      const s = key === 'A' ? rp.range(0.86, 1.14) : rp.range(0.9, 1.12), rot = rp.range(0, Math.PI * 2);
      const m = util.mat([p.x, p.y, p.z], rot, s);
      mats.push(m);
      const id = `Palm_${String(registry.ofKind('palm').length + 1).padStart(3, '0')}`;
      ids.push(id);
      const t = 1 + rp.range(-0.08, 0.08), y = rp.range(-0.05, 0.05);
      tintF.push(new THREE.Color(t * (1 + y), t, t * (1 - y)));
      const tb = 1 + rp.range(-0.06, 0.06); tintT.push(new THREE.Color(tb, tb, tb));
      registry.place({ kind: 'palm', id, bbox: P.box.clone().applyMatrix4(m), supportY: p.y, module: MOD });
      shadowMats.push(util.mat([p.x, p.y + 0.012, p.z], rot, key === 'A' ? 2.6 * s : 2.2 * s)); shadowIds.push(id);
    }
    if (!mats.length) continue;
    group.add(util.instanced(P.trunk, mBark, mats, { ids, colors: tintT, name: `Palms/${P.name}/Trunks`, castShadow: true, receiveShadow: true }));
    group.add(util.instanced(P.crown, mFrond, mats, { ids, colors: tintF, name: `Palms/${P.name}/Fronds`, castShadow: false, receiveShadow: true }));
  }

  /* =============================== leaf-card foliage (shrubs, hedges, trees) =============================== */
  // Every canopy = instanced clusters of alpha-cut leaf cards (leafAtlas quadrants A/B/C) around a small opaque core
  // (quadrant D) that stops see-through. One material for all foliage. Card normals are bent outward from the canopy
  // centre so the cluster shades as a volume; vertex colours carry interior AO and a lighter yellow-green sun side.
  const REG = { A: [0, 0], B: [0.5, 0], C: [0, 0.5], D: [0.5, 0.5] };
  const SUN = new V3(0.62, 0.5, 0.6).normalize();               // between the day (SSE) and golden (E) sun azimuths
  const UP = new V3(0, 1, 0);
  const cardK = low ? 0.6 : 1;
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /** Card cluster. blobs: [[x,y,z,r]]; layers: [{ n, size:[a,b], reg, shell:[f0,f1], up, yMin }]; core: { detail, scale }. */
  function cardCluster(blobs, layers, { seed, core = { detail: 0, scale: 0.72 }, squashY = 1, aoMin = 0.42, ground = false }) {
    const r = rng('cards-' + seed);
    const pos = [], nor = [], uv = [], colr = [], idx = [];
    const C = new V3(), bbMin = new V3(1e9, 1e9, 1e9), bbMax = new V3(-1e9, -1e9, -1e9);
    let wsum = 0;
    for (const [x, y, z, br] of blobs) { const w = br ** 3; C.add(new V3(x, y, z).multiplyScalar(w)); wsum += w; bbMin.min(new V3(x - br, y - br * squashY, z - br)); bbMax.max(new V3(x + br, y + br * squashY, z + br)); }
    C.multiplyScalar(1 / wsum);
    const spanY = Math.max(0.2, bbMax.y - bbMin.y);
    const bent = (p, n, k) => {                                  // canopy-volume normal blended with the card normal
      const d = p.clone().sub(C); d.y /= Math.max(0.5, squashY); d.normalize().addScaledVector(UP, 0.35).normalize();
      return d.multiplyScalar(1 - k).addScaledVector(n, k).normalize();
    };
    const shade = (p, depth) => {                                // AO (interior + low) and sun-side warmth -> [r,g,b]
      const h = (p.y - bbMin.y) / spanY;
      const ao = aoMin + (1 - aoMin) * sm(0.15, 1.0, depth) * (0.55 + 0.45 * Math.min(1, Math.max(0, h)));
      const s = Math.max(0, p.clone().sub(C).normalize().dot(SUN));
      return [ao * (1 + 0.16 * s), ao * (1 + 0.13 * s), ao * (1 - 0.08 * s)];
    };
    const nearest = (p) => {                                     // normalised depth inside the closest blob
      let best = 9;
      for (const [x, y, z, br] of blobs) { const d = Math.hypot(p.x - x, (p.y - y) / squashY, p.z - z) / br; if (d < best) best = d; }
      return best;
    };
    const pickBlob = () => {
      let t = r() * wsum;
      for (const b of blobs) { t -= b[3] ** 3; if (t <= 0) return b; }
      return blobs[blobs.length - 1];
    };
    const randDir = () => { const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); return new V3(s * Math.cos(a), u, s * Math.sin(a)); };
    // cards
    for (const L of layers) {
      const n = Math.max(3, Math.round(L.n * cardK)), [u0, v0] = REG[L.reg], e = 0.006;
      for (let i = 0; i < n; i++) {
        const [bx, by, bz, br] = pickBlob();
        let d = randDir();
        if (L.yMin !== undefined && d.y < L.yMin) d.y = L.yMin + r() * (1 - L.yMin) * 0.5;
        d.normalize();
        const f = L.shell[0] + (L.shell[1] - L.shell[0]) * Math.sqrt(r());
        const p = new V3(bx + d.x * br * f, by + d.y * br * f * squashY, bz + d.z * br * f);
        const nC = d.clone().multiplyScalar(0.65).add(randDir().multiplyScalar(0.75)).addScaledVector(UP, L.up ?? 0.3).normalize();
        const t0 = Math.abs(nC.y) < 0.95 ? new V3().crossVectors(UP, nC).normalize() : new V3(1, 0, 0);
        const b0 = new V3().crossVectors(nC, t0), a = r() * Math.PI * 2;
        const T1 = t0.clone().multiplyScalar(Math.cos(a)).addScaledVector(b0, Math.sin(a)), B1 = new V3().crossVectors(nC, T1);
        const s = (L.size[0] + (L.size[1] - L.size[0]) * r()) / 2;
        const base = pos.length / 3;
        for (const [cu, cv] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
          const q = p.clone().addScaledVector(T1, (cu * 2 - 1) * s).addScaledVector(B1, (cv * 2 - 1) * s);
          const nn = bent(q, nC, 0.3), c = shade(q, nearest(q));
          pos.push(q.x, q.y, q.z); nor.push(nn.x, nn.y, nn.z); colr.push(...c);
          uv.push(u0 + e + cu * (0.5 - 2 * e), v0 + e + cv * (0.5 - 2 * e));
        }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const parts = [];
    { const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
      g.setIndex(idx); parts.push({ geometry: g }); }
    // opaque cores (quadrant D), darker: they are the shadowed inside of the crown
    if (core) for (const [bx, by, bz, br] of blobs) {
      const g = new THREE.IcosahedronGeometry(1, core.detail), p = g.attributes.position, n = p.count;
      const nn = new Float32Array(n * 3), uu = new Float32Array(n * 2), cc = new Float32Array(n * 3);
      const fa = new V3(), fb = new V3(), fc = new V3(), fn = new V3();
      for (let i = 0; i < n; i++) {
        if (i % 3 === 0) {                                     // per-face dominant-axis projection (no stretching)
          fa.fromBufferAttribute(p, i); fb.fromBufferAttribute(p, i + 1); fc.fromBufferAttribute(p, i + 2);
          fn.crossVectors(fb.sub(fa), fc.sub(fa)); fn.set(Math.abs(fn.x), Math.abs(fn.y), Math.abs(fn.z));
        }
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = br * core.scale * (0.85 + 0.3 * vnoise(x * 1.7 + seed, y * 1.7 + bx, z * 1.7 + bz));
        const q = new V3(bx + x * k, by + y * k * squashY, bz + z * k);
        p.setXYZ(i, q.x, q.y, q.z);
        const o = bent(q, new V3(x, y, z), 0.5); nn.set([o.x, o.y, o.z], i * 3);
        const [pu, pv] = fn.y >= fn.x && fn.y >= fn.z ? [x, z] : fn.x >= fn.z ? [z, y] : [x, y];
        uu.set([0.51 + 0.48 * (0.5 + 0.5 * pu), 0.51 + 0.48 * (0.5 + 0.5 * pv)], i * 2);
        const c = shade(q, 0.5); cc.set([c[0] * 0.68, c[1] * 0.68, c[2] * 0.68], i * 3);
      }
      g.setAttribute('normal', new THREE.BufferAttribute(nn, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uu, 2)); g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      parts.push({ geometry: g });
    }
    const merged = util.mergeParts(parts);
    if (ground) { merged.translate(0, -merged.boundingBox.min.y, 0); merged.computeBoundingBox(); merged.computeBoundingSphere(); }
    return merged;
  }

  /** Per-plant tint as a multiplier on the textured albedo: hue +-dh, value +-dv around a reference leaf green. */
  const REF_GREEN = new THREE.Color('#6A8C4E');
  const tintOf = (r, dh = 0.028, dv = 0.15, warm = 0) => {
    const c = REF_GREEN.clone().offsetHSL(r.range(-dh, dh) + warm, r.range(-0.06, 0.04), 0).multiplyScalar(1 + r.range(-dv, dv));
    return new THREE.Color(c.r / REF_GREEN.r, c.g / REF_GREEN.g, c.b / REF_GREEN.b);
  };

  // prototypes: round leafy shrub, bougainvillea (leaf cards + magenta bract cards on the sunny outside)
  const shrubBlobs = [[0, 0.5, 0, 0.52], [0.36, 0.38, 0.12, 0.4], [-0.3, 0.38, -0.14, 0.42], [0.05, 0.4, -0.36, 0.36], [-0.08, 0.72, 0.12, 0.34]];
  const shrubGeo = cardCluster(shrubBlobs, [{ n: 40, size: [0.38, 0.6], reg: 'B', shell: [0.6, 1.08], up: 0.35 }], { seed: 3, ground: true, aoMin: 0.5, core: { detail: 0, scale: 0.8 } });
  const flowerGeo = cardCluster([[0, 0.55, 0, 0.56], [0.42, 0.42, 0.15, 0.42], [-0.36, 0.42, -0.1, 0.44], [0.1, 0.85, -0.1, 0.38]], [
    { n: 20, size: [0.42, 0.65], reg: 'B', shell: [0.55, 1.0], up: 0.3 },
    { n: 26, size: [0.45, 0.7], reg: 'C', shell: [0.8, 1.12], up: 0.5, yMin: -0.25 },
  ], { seed: 9, ground: true, aoMin: 0.5, core: { detail: 0, scale: 0.8 } });
  // hedge segment: 2 m long, 1 m tall, 0.7 m wide clipped box (leaf-mass texture) + leafy cards breaking the edges
  const hedgeGeo = (() => {
    const g0 = new THREE.BoxGeometry(2, 1, 0.7, low ? 3 : 6, 3, 2), p = g0.attributes.position, uvA = g0.attributes.uv;
    const n = p.count, cc = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let x = p.getX(i), y = p.getY(i) + 0.5, z = p.getZ(i);
      const nz = (vnoise(x * 4.1, y * 4.1, z * 4.1) - 0.5) * 0.1;
      if (y > 0.75) z *= 1 - 0.16 * ((y - 0.75) / 0.25);              // rounded top shoulders
      if (y > 0.04) { z += Math.sign(z) * nz; y += nz * 0.5; }
      p.setXYZ(i, x, Math.max(0, y), z);
      uvA.setXY(i, 0.51 + 0.48 * uvA.getX(i), 0.51 + 0.48 * uvA.getY(i));
      const ao = 0.55 + 0.45 * sm(0, 1, y);
      cc.set([ao * 1.02, ao, ao * 0.96], i * 3);
    }
    g0.setAttribute('color', new THREE.BufferAttribute(cc, 3)); g0.computeVertexNormals();
    const r = rng('hedge-cards'), pos = [], nor = [], uv = [], colr = [], idx = [];
    const nc = low ? 8 : 14;
    for (let i = 0; i < nc; i++) {
      const top = r() < 0.45, side = r() < 0.5 ? 1 : -1;
      const x = r.range(-0.95, 0.95), y = top ? r.range(0.92, 1.02) : r.range(0.35, 0.95), z = top ? r.range(-0.28, 0.28) : side * r.range(0.33, 0.4);
      const sn = top ? new V3(r.range(-0.3, 0.3), 1, z * 1.5).normalize() : new V3(r.range(-0.3, 0.3), r.range(0, 0.6), side).normalize();
      const nC = sn.clone().add(new V3(r.range(-0.6, 0.6), r.range(-0.4, 0.6), r.range(-0.6, 0.6))).normalize();
      const t0 = Math.abs(nC.y) < 0.95 ? new V3().crossVectors(UP, nC).normalize() : new V3(1, 0, 0), b0 = new V3().crossVectors(nC, t0);
      const s = r.range(0.2, 0.3), base = pos.length / 3, ao = 0.75 + 0.25 * y;
      for (const [cu, cv] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const q = new V3(x, y, z).addScaledVector(t0, (cu * 2 - 1) * s).addScaledVector(b0, (cv * 2 - 1) * s);
        q.y = Math.max(0.02, q.y);
        pos.push(q.x, q.y, q.z); nor.push(sn.x, sn.y, sn.z); colr.push(ao * 1.04, ao, ao * 0.94);
        uv.push(0.506 + cu * 0.488, 0.006 + cv * 0.488);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    cg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); cg.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); cg.setIndex(idx);
    return util.mergeParts([{ geometry: g0 }, { geometry: cg }]);
  })();
  // broadleaf tree canopies: three belt variants (round, tall oval, spreading) + a fuller plaza tree; trunk
  const beltLayers = (n) => [{ n, size: [0.95, 1.5], reg: 'A', shell: [0.55, 1.05], up: 0.3 }];
  const treeProtos = [
    cardCluster([[0, 3.9, 0, 2.3], [1.6, 3.4, 0.7, 1.8], [-1.4, 3.5, -0.9, 1.9]], beltLayers(76), { seed: 21, core: { detail: 0, scale: 0.8 } }),
    cardCluster([[0, 4.3, 0, 1.8], [0.3, 5.5, 0.2, 1.45], [-0.5, 3.4, 0.3, 1.55], [0.6, 3.6, -0.5, 1.4]], beltLayers(72), { seed: 22, core: { detail: 0, scale: 0.8 } }),
    cardCluster([[0, 3.9, 0, 2.0], [2.0, 3.6, 0.4, 1.6], [-1.9, 3.7, -0.3, 1.7], [0.3, 3.5, 1.9, 1.5], [-0.2, 3.8, -1.9, 1.5]], beltLayers(84), { seed: 23, squashY: 0.72, core: { detail: 0, scale: 0.8 } }),
  ];
  const nearGeo = cardCluster([[0, 4.6, 0, 2.0], [1.5, 4.0, 0.7, 1.6], [-1.3, 4.1, -0.8, 1.7], [0.2, 5.6, -0.4, 1.5], [-0.3, 3.9, 1.3, 1.4]],
    [{ n: 150, size: [0.8, 1.25], reg: 'A', shell: [0.5, 1.05], up: 0.3 }], { seed: 33, core: { detail: low ? 0 : 1, scale: 0.78 } });
  const trunkG = (() => { const g = new THREE.CylinderGeometry(0.11, 0.2, 3.4, 6, 1, true); g.translate(0, 1.7, 0); return g; })();

  const shrubs = { s: [], f: [] };   // {m, c, id, y}
  const rs = rng('shrubs');
  const pushShrub = (kind, x, z, y, scale, tint = null) => {
    const sc = typeof scale === 'number' ? [scale, scale * rs.range(0.85, 1.05), scale] : scale;
    const m = util.mat([x, y, z], rs.range(0, Math.PI * 2), sc);
    const base = tint || (kind === 'f' ? tintOf(rs, 0.01, 0.1) : tintOf(rs));
    const id = `Shrub_${String(shrubs.s.length + shrubs.f.length + 1).padStart(3, '0')}`;
    shrubs[kind].push({ m, c: base, id });
    const g = kind === 's' ? shrubGeo : flowerGeo; g.computeBoundingBox();
    registry.place({ kind: 'shrub', id, bbox: g.boundingBox.clone().applyMatrix4(m), supportY: y, module: MOD });
  };
  const hueTint = () => tintOf(rs, 0.035, 0.15);

  // clubhouse planters: alternating topiary balls and bougainvillea
  for (const p of L.planters) {
    const alongX = (p.x[1] - p.x[0]) > (p.z[1] - p.z[0]);
    const a0 = alongX ? p.x[0] : p.z[0], a1 = alongX ? p.x[1] : p.z[1], mid = alongX ? (p.z[0] + p.z[1]) / 2 : (p.x[0] + p.x[1]) / 2;
    const n = Math.floor((a1 - a0) / 1.25);
    for (let i = 0; i < n; i++) {
      const a = a0 + 0.6 + (i * (a1 - a0 - 1.2)) / Math.max(1, n - 1);
      const [x, z] = alongX ? [a, mid] : [mid, a];
      if (i % 3 === 1) pushShrub('f', x, z, p.soil, 0.75);
      else pushShrub('s', x, z, p.soil, i % 3 === 0 ? 0.62 : 0.5, tintOf(rs, 0.015, 0.06, -0.01));
    }
  }
  // round shrubs on the ground around the clubhouse forecourt (ref E) and at the pool deck corners
  for (const [x, z, s] of [[-26.0, 16.2, 0.8], [-37.0, 15.8, 0.7], [-25.6, 18.6, 0.6], [-39.0, 26.5, 0.7]]) pushShrub('s', x, z, 0, s, hueTint());
  pushShrub('f', -22.9, 33.5, L.deckY, 0.7);
  // front lawn strip + between gates: flowering bushes in front of the hedge
  for (const [x0, x1] of [[-7, 12.5], [28.5, 55.5]]) {
    for (const [x, z] of util.along([x0, 39.9], [x1, 39.9], 4.2, rs, 0.4)) pushShrub(rs.chance(0.5) ? 'f' : 's', x, z, x0 > 20 ? 0.03 : 0, rs.range(0.55, 0.8), hueTint());
  }
  // shrubs ringing the play circle and around palm bases on the plaza
  for (let a = 0; a < 360; a += 24) {
    if (a > 150 && a < 215) continue;                       // opening toward the plaza
    const t = (a * Math.PI) / 180, x = L.play.c[0] + Math.cos(t) * (L.play.r + 0.75), z = L.play.c[1] + Math.sin(t) * (L.play.r + 0.75);
    if (palmTaken.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < 1.4)) continue;
    pushShrub(a % 48 === 0 ? 'f' : 's', x, z, 0, rs.range(0.5, 0.7), hueTint());
  }
  for (const p of palms) if (p.proto === 'B' && p.y === 0 && rs.chance(0.6)) {
    const a = rs.range(0, 6.28); const x = p.x + Math.cos(a) * 1.0, z = p.z + Math.sin(a) * 1.0;
    if (!isBlocked(x, z)) pushShrub(rs.chance(0.4) ? 'f' : 's', x, z, 0, rs.range(0.45, 0.65), hueTint());
  }
  // a natural scatter of shrubs along the boundary verges (non-grid)
  for (const [rect, cnt] of [[{ x: [-56.8, -55.4], z: [-36, 30] }, 12], [{ x: [55.4, 56.8], z: [-36, 36] }, 12], [{ x: [-48, 48], z: [-39.2, -38.0] }, 14]]) {
    const pts = util.scatter(rs, rect, { count: low ? Math.ceil(cnt / 2) : cnt, minDist: 2.5, reject: (x, z) => isBlocked(x, z) || palmTaken.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < 1.2) });
    for (const [x, z] of pts) pushShrub(rs.chance(0.25) ? 'f' : 's', x, z, 0, rs.range(0.5, 0.85), hueTint());
  }
  for (const k of ['s', 'f']) {
    const list = shrubs[k]; if (!list.length) continue;
    group.add(util.instanced(k === 's' ? shrubGeo : flowerGeo, mFoliage, list.map((s) => s.m), { ids: list.map((s) => s.id), colors: list.map((s) => s.c), name: k === 's' ? 'Shrubs/Round' : 'Shrubs/Flowering', castShadow: false }));
  }

  /* ------------------------------ hedges ------------------------------ */
  const hedge = { m: [], c: [], ids: [] };
  let hedgeRun = 0;
  function hedgeLine(pts, { h = 0.9, w = 0.6, y = 0, closed = false } = {}) {
    const id = `Hedge_${String(++hedgeRun).padStart(2, '0')}`, bb = new THREE.Box3();
    const segs = closed ? pts.length : pts.length - 1;
    hedgeGeo.computeBoundingBox();
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
      const n = Math.max(1, Math.round(len / 2));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n, x = a[0] + dx * t, z = a[1] + dz * t;
        const m = util.mat([x, y, z], -Math.atan2(dz, dx), [(len / n / 2) * 1.08, h * rs.range(0.95, 1.05), w / 0.7]);
        hedge.m.push(m); hedge.ids.push(id);
        hedge.c.push(tintOf(rs, 0.012, 0.06));
        bb.union(hedgeGeo.boundingBox.clone().applyMatrix4(m));
      }
    }
    registry.place({ kind: 'hedge', id, bbox: bb, supportY: y, module: MOD });
  }
  const HZ = 40.95;
  for (const [x0, x1, y] of [[-56.5, -41.0, 0], [-39.6, -22.4, 0], [-8.3, 13.3, 0], [27.6, 56.5, 0.03]]) hedgeLine([[x0, HZ], [x1, HZ]], { h: 0.85, y });
  hedgeLine([[-56.95, -36.5], [-56.95, 40.4]], { h: 1.0 });
  hedgeLine([[56.95, -36.5], [56.95, 38.6]], { h: 1.0 });
  hedgeLine([[-22.42, 28.35], [-22.42, 40.2]], { h: 0.75, w: 0.55, y: L.deckY });        // pool east side
  { const WP = L.westPlanter; hedgeLine([[(WP.x[0] + WP.x[1] - 0.08) / 2, WP.z[0] + 0.15], [(WP.x[0] + WP.x[1] - 0.08) / 2, WP.z[1] - 0.15]], { h: 0.6, w: 0.6, y: WP.soil }); }
  { const ringPts = []; for (let i = 0; i < 14; i++) { const t = (i / 14) * Math.PI * 2; ringPts.push([L.ring.c[0] + Math.cos(t) * 3.2, L.ring.c[1] + Math.sin(t) * 3.2]); }
    hedgeLine(ringPts, { h: 0.65, w: 0.55, y: L.ring.soil, closed: true }); }
  { // low hedge border around the striped lawn (stadium, 0.7 m outside the kerb)
    const { c, w, d } = L.lawn, Rr = d / 2 + 0.75, a = (w - d) / 2, pts = [];
    for (let i = 0; i <= 4; i++) pts.push([c[0] - a + (2 * a * i) / 4, c[1] - Rr]);
    for (let i = 1; i <= 10; i++) { const t = -Math.PI / 2 + (Math.PI * i) / 10; pts.push([c[0] + a + Math.cos(t) * Rr, c[1] + Math.sin(t) * Rr]); }
    for (let i = 1; i <= 3; i++) pts.push([c[0] + a - (2 * a * i) / 4, c[1] + Rr]);
    // leave an opening on the north-west; continue round the west end
    for (let i = 0; i <= 10; i++) { const t = Math.PI / 2 + (Math.PI * i) / 10; pts.push([c[0] - a + Math.cos(t) * Rr, c[1] + Math.sin(t) * Rr]); }
    hedgeLine(pts, { h: 0.5, w: 0.45, y: 0 });
  }
  group.add(util.instanced(hedgeGeo, mFoliage, hedge.m, { ids: hedge.ids, colors: hedge.c, name: 'Hedges', castShadow: false }));

  /* ------------------------------ trees: plaza + context belts ------------------------------ */
  const rt = rng('trees');
  const near = { m: [], c: [], ids: [] }, belts = treeProtos.map(() => ({ m: [], c: [], ids: [] })), trunks = { m: [], c: [] };
  const addTree = (bucket, geo, x, z, y, s, id) => {
    const rot = rt.range(0, Math.PI * 2), sc = [s * rt.range(0.92, 1.08), s * rt.range(0.88, 1.12), s * rt.range(0.92, 1.08)];
    const m = util.mat([x, y, z], rot, sc);
    bucket.m.push(m); bucket.ids.push(id);
    bucket.c.push(tintOf(rt, 0.028, 0.15));
    trunks.m.push(util.mat([x, y, z], rot, [s, sc[1], s])); trunks.c.push(new THREE.Color(0.8, 0.75, 0.7));
    geo.computeBoundingBox();
    const bb = geo.boundingBox.clone().union(trunkG.boundingBox || (trunkG.computeBoundingBox(), trunkG.boundingBox)).applyMatrix4(m);
    registry.place({ kind: 'tree', id, bbox: bb, supportY: y, module: MOD });
  };
  let treeN = 0;
  const tid = () => `Tree_${String(++treeN).padStart(3, '0')}`;
  addTree(near, nearGeo, L.ring.c[0], L.ring.c[1], L.ring.soil, 1.0, tid());
  for (const [x, z] of [[28.5, -12], [53.5, -12], [53.5, 15], [28.8, 17.5], [-50.5, 26]]) if (!isBlocked(x, z)) addTree(near, nearGeo, x, z, 0, rt.range(0.8, 1.1), tid());

  const roads = [[39.5, 57.5], [-55.5, -37.5]];
  const ctxBlocks = SPEC.site.context.buildings.map(([x, z, w, d]) => pad(util.rectOf([x, z], w, d), 3));
  const beltReject = (x, z) => roads.some(([a, b]) => z > a && z < b) || ctxBlocks.some((r) => util.inRect(x, z, r))
    || (Math.abs(x) < 60 && Math.abs(z) < 44);
  for (const [bi, b] of SPEC.site.context.treeBelts.entries()) {
    const area = (b.x[1] - b.x[0]) * (b.z[1] - b.z[0]);
    const count = Math.round(area * b.density * (low ? 0.55 : 0.95));
    const pts = util.scatter(rng('belt-' + bi), b, { count, minDist: 3.6, reject: beltReject, maxTries: 12 });
    for (const [x, z] of pts) { const v = rt.int(0, treeProtos.length - 1); addTree(belts[v], treeProtos[v], x, z, 0, 1.25 * rt.range(0.75, 1.25), tid()); }
  }
  if (near.m.length) group.add(util.instanced(nearGeo, mFoliage, near.m, { ids: near.ids, colors: near.c, name: 'Trees/Plaza', castShadow: true }));
  belts.forEach((b, i) => { if (b.m.length) group.add(util.instanced(treeProtos[i], mFoliage, b.m, { ids: b.ids, colors: b.c, name: `Trees/Belts_${'ABC'[i]}`, castShadow: false })); });
  group.add(util.instanced(trunkG, mBark, trunks.m, { colors: trunks.c, name: 'Trees/Trunks', castShadow: false }));

  /* ------------------------------ palm contact shadows ------------------------------ */
  const blob = new THREE.PlaneGeometry(1, 1); blob.rotateX(-Math.PI / 2);
  const sh = util.instanced(blob, mShadow, shadowMats, { ids: shadowIds, name: 'Palms/ContactShadows', castShadow: false, receiveShadow: false });
  sh.renderOrder = 1;
  group.add(sh);

  return { group, dispose() { group.traverse((o) => o.geometry?.dispose?.()); } };
}
