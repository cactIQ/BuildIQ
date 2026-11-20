// Sample 2 BHK flat (v1.15): a furnished luxury apartment in its own interior scene, lazy-loaded by core when the
// 'flat' (dollhouse) or 'flatWalk' (first-person) view is requested. Must also build under node (no document/window;
// canvases via ctx.tex.canvas).
// Plan data: FLAT in src/materials/flat.js (shared with the walk controller's collision).
// Geometry is merged per (visibility group, material). Groups:
//   base             always visible (floor, slab, furniture, railing)
//   walk             walk mode only (ceiling, coves, downlights, pendants, door leaves, curtains, outside backdrop)
//   ext{N,S,W,E}{F,C} exterior walls, full height (F) or cut to FLAT.cut (C). In dollhouse mode the sides facing the
//                    camera show C, the others F; walk mode shows F.
//   intF / intC      interior partitions, full (walk) or cut (dollhouse)
import { FLAT, downlights } from './materials/flat.js';

const MATS = ['marble', 'stone', 'wall', 'walnut', 'brass', 'fabric', 'velvet', 'rug', 'glass', 'black', 'chrome', 'lacquer',
  'light', 'backdrop', 'leaf', 'art', 'curtain', 'shadow'];
const SIDES = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };

export async function build(ctx) {
  const { THREE, util, registry } = ctx;
  const group = new THREE.Group(); group.name = 'Interior_flat';
  const rng = ctx.rng('flat');
  const mats = {};
  for (const n of MATS) mats[n] = await ctx.M.use('flat.' + n);
  const { H, cut } = FLAT;

  /* ---------------- helpers ---------------- */
  const buckets = new Map();                                 // `${grp}|${mat}` -> { grp, mat, parts }
  const add = (grp, mat, geometry, matrix = null) => {
    const k = grp + '|' + mat; let b = buckets.get(k);
    if (!b) buckets.set(k, (b = { grp, mat, parts: [] }));
    b.parts.push({ geometry, matrix }); return geometry;
  };
  const C = (c) => (c && c.isColor ? c : new THREE.Color(c));
  const tint = (g, col) => {
    const c = C(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
  };
  const box = (x0, y0, z0, x1, y1, z1) => util.boxMinMax(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1));
  /** Axis-aligned box into (grp, mat), optional vertex tint. */
  const B = (grp, mat, x0, y0, z0, x1, y1, z1, col) => { const g = box(x0, y0, z0, x1, y1, z1); if (col) tint(g, col); return add(grp, mat, g); };
  /** Chamfered box: centre (cx, cz), from y0 up h, size w (x) x d (z) before rotation rot (Y). */
  const CB = (grp, mat, cx, y0, cz, w, h, d, c, col, rot = 0) => {
    const g = util.chamferBox(w, h, d, c); g.translate(0, y0 + h / 2, 0); if (rot) g.rotateY(rot); g.translate(cx, 0, cz);
    if (col) tint(g, col); return add(grp, mat, g);
  };
  const CY = (grp, mat, x, y0, z, rt, rb, h, seg = 16, col) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(x, y0 + h / 2, z); if (col) tint(g, col); return add(grp, mat, g);
  };
  const colliders = [];
  const solid = (x0, z0, x1, z1) => colliders.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
  const place = (kind, id, x0, y0, z0, x1, y1, z1, supportY = 0) => registry.place({ kind, id: 'Flat/' + id,
    bbox: new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)), supportY, module: 'flat' });
  /** Soft contact shadow decal under a floor object (footprint x0..x1, z0..z1). */
  const shadow = (x0, z0, x1, z1, y = 0.003) => {
    const w = (x1 - x0) * 1.15 + 0.12, d = (z1 - z0) * 1.15 + 0.12;
    const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    add('base', 'shadow', g);
  };
  const leafGeo = (L, Wd) => {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(Wd, L * 0.45, 0, L); s.quadraticCurveTo(-Wd, L * 0.45, 0, 0);
    return new THREE.ShapeGeometry(s, 5);
  };
  const greens = ['#3E6B3A', '#4F7D45', '#356035', '#5C8A4E'];
  /** Potted plant: tapered black pot + a rosette of arching leaves. */
  function plant(id, x, z, h, potR = 0.2, potH = 0.45, grp = 'base') {
    CY(grp, 'black', x, 0, z, potR, potR * 0.78, potH, 18);
    CY(grp, 'leaf', x, potH - 0.02, z, potR * 0.92, potR * 0.92, 0.02, 12, '#3B2F25');
    const n = 11;
    for (let i = 0; i < n; i++) {
      const yaw = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3), L = h * rng.range(0.55, 0.95);
      const g = tint(leafGeo(L, L * 0.2), greens[i % greens.length]);
      g.rotateX(-rng.range(0.25, 0.75)); g.rotateY(yaw); g.translate(x, potH, z);
      add(grp, 'leaf', g);
    }
    place('plant', id, x - potR, 0, z - potR, x + potR, potH + h * 0.9, z + potR);
    solid(x - potR, z - potR, x + potR, z + potR);
  }
  /** Framed art on a wall. face: '+x' | '-x' | '+z' | '-z' (direction the picture faces). uv: [u0, v0, u1, v1]. */
  function art(id, face, at, c0, c1, y0, y1, uv) {
    const w = c1 - c0, h = y1 - y0, g = new THREE.PlaneGeometry(w, h);
    const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * (uv[2] - uv[0]), uv[1] + a.getY(i) * (uv[3] - uv[1]));
    const rot = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[face];
    const s = face[0] === '+' ? 1 : -1, d = 0.035;
    g.rotateY(rot);
    const cx = (c0 + c1) / 2, cy = (y0 + y1) / 2;
    if (face[1] === 'x') { g.translate(at + s * (d + 0.002), cy, cx); B('base', 'black', at, y0 - 0.03, c0 - 0.03, at + s * d, y1 + 0.03, c1 + 0.03); }
    else { g.translate(cx, cy, at + s * (d + 0.002)); B('base', 'black', c0 - 0.03, y0 - 0.03, at, c1 + 0.03, y1 + 0.03, at + s * d); }
    add('base', 'art', g);
    place('art', id, ...(face[1] === 'x' ? [Math.min(at, at + s * d), y0, c0, Math.max(at, at + s * d), y1, c1] : [c0, y0, Math.min(at, at + s * d), c1, y1, Math.max(at, at + s * d)]), null);
  }

  /* ---------------- floor, slab, ceiling, outside ---------------- */
  const [X0, X1] = FLAT.outer.x, [Z0, Z1] = FLAT.outer.z;
  {
    const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0); g.rotateX(-Math.PI / 2); g.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 1.2, -p.getZ(i) / 1.2);
    add('base', 'marble', g);
    B('doll', 'wall', X0, -0.32, Z0, X1, -0.004, Z1, '#4A4540');                     // slab edge (dollhouse model base)
    const c = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0); c.rotateX(Math.PI / 2); c.translate((X0 + X1) / 2, H, (Z0 + Z1) / 2);
    add('walk', 'wall', tint(c, '#FBF8F3'));
    const bd = new THREE.CylinderGeometry(48, 48, 64, 40, 1, true); bd.translate(0, FLAT.eye, 0);
    add('walk', 'backdrop', bd);
  }

  /* ---------------- walls ---------------- */
  const CAP = new THREE.Color(0.16, 0.15, 0.14);
  const shadeWall = (g) => {                               // dark caps (the "cut" reads like a section), soft floor shading
    const p = g.attributes.position, n = g.attributes.normal, a = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      let r = 1, gg = 1, b = 1;
      if (n.getY(i) > 0.5) { r = CAP.r; gg = CAP.g; b = CAP.b; }
      else { const y = p.getY(i); const k = y < 0.05 ? 0.82 : 1; r = k; gg = k; b = k * 0.99; }
      a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
  };
  /** Solid pieces [s0, s1, y0, y1] of a wall run, clipped to hTop. */
  function pieces(w, hTop) {
    const out = []; let a = w.from;
    for (const o of [...w.open].sort((p, q) => p.a - q.a)) {
      if (o.a > a) out.push([a, o.a, 0, hTop]);
      if (o.y0 > 0) out.push([o.a, o.b, 0, Math.min(o.y0, hTop)]);
      if (o.y1 < hTop) out.push([o.a, o.b, o.y1, hTop]);
      a = o.b;
    }
    if (w.to > a) out.push([a, w.to, 0, hTop]);
    return out.filter((p) => p[3] - p[2] > 0.005 && p[1] - p[0] > 0.005);
  }
  const runBox = (w, s0, s1, y0, y1, d0 = -w.t / 2, d1 = w.t / 2) => (w.axis === 'x' ? box(s0, y0, w.at + d0, s1, y1, w.at + d1) : box(w.at + d0, y0, s0, w.at + d1, y1, s1));
  const runB = (grp, mat, w, s0, s1, y0, y1, d0, d1, col) => { const g = runBox(w, s0, s1, y0, y1, d0, d1); if (col) tint(g, col); return add(grp, mat, g); };

  for (const w of FLAT.walls) {
    const gF = w.side ? `ext${w.side}F` : 'intF', gC = w.side ? `ext${w.side}C` : 'intC';
    for (const [s0, s1, y0, y1] of pieces(w, H)) {
      add(gF, 'wall', shadeWall(runBox(w, s0, s1, y0, y1)));
      if (y0 < 1.0) solid(...(w.axis === 'x' ? [s0, w.at - w.t / 2, s1, w.at + w.t / 2] : [w.at - w.t / 2, s0, w.at + w.t / 2, s1]));
    }
    for (const [s0, s1, y0, y1] of pieces(w, cut)) add(gC, 'wall', shadeWall(runBox(w, s0, s1, y0, y1)));
    // skirting: a slim walnut-free stone skirting reads cleaner with marble; 80 mm, both faces, not across openings
    for (const [s0, s1, y0] of pieces(w, H)) if (y0 === 0) for (const sd of [-1, 1]) {
      const e = w.t / 2, d0 = sd > 0 ? e : -e - 0.012, d1 = sd > 0 ? e + 0.012 : -e;
      if (w.side && sd === SIDES[w.side][w.axis === 'x' ? 1 : 0]) continue;            // not on the outside face
      runB('base', 'stone', w, s0, s1, 0, 0.08, d0, d1);
    }
    for (const o of w.open) {
      const width = o.b - o.a;
      if (o.win) {                                                                        // glazed window + slim black frame
        runB(gF, 'glass', w, o.a, o.b, o.y0, o.y1, -0.006, 0.006);
        const f = 0.045, fd = 0.03;
        runB(gF, 'black', w, o.a, o.b, o.y0, o.y0 + f, -fd, fd); runB(gF, 'black', w, o.a, o.b, o.y1 - f, o.y1, -fd, fd);
        runB(gF, 'black', w, o.a, o.a + f, o.y0, o.y1, -fd, fd); runB(gF, 'black', w, o.b - f, o.b, o.y0, o.y1, -fd, fd);
        if (width > 1.0) { const m = (o.a + o.b) / 2; runB(gF, 'black', w, m - f / 2, m + f / 2, o.y0, o.y1, -fd, fd); }
        // marble sill inside
        const inS = w.side ? -SIDES[w.side][w.axis === 'x' ? 1 : 0] : 1;
        runB('base', 'stone', w, o.a - 0.04, o.b + 0.04, o.y0 - 0.03, o.y0, inS > 0 ? 0 : -w.t / 2 - 0.05, inS > 0 ? w.t / 2 + 0.05 : 0);
      } else if (o.slide) {                                                               // sliding glass doors, half open
        const half = width / 2 + 0.05, sA = o.stack === 'a' ? o.a : o.b - half, sB = sA + half;
        for (const [d0, d1] of [[-0.05, -0.03], [0.0, 0.02]]) {
          runB(gF, 'glass', w, sA + 0.03, sB - 0.03, 0.04, o.y1 - 0.04, d0, d1);
          const f = 0.04;
          runB(gF, 'black', w, sA, sB, 0.0, 0.05, d0 - 0.005, d1 + 0.005); runB(gF, 'black', w, sA, sB, o.y1 - 0.05, o.y1, d0 - 0.005, d1 + 0.005);
          runB(gF, 'black', w, sA, sA + f, 0, o.y1, d0 - 0.005, d1 + 0.005); runB(gF, 'black', w, sB - f, sB, 0, o.y1, d0 - 0.005, d1 + 0.005);
        }
        runB(gF, 'black', w, o.a, o.b, o.y1 - 0.02, o.y1, -0.07, 0.04);                    // head track
        runB('base', 'black', w, o.a, o.b, 0, 0.012, -0.07, 0.04);                           // floor track
        solid(...(w.axis === 'x' ? [sA, w.at - 0.07, sB, w.at + 0.04] : [w.at - 0.07, sA, w.at + 0.04, sB]));
      } else {
        // door casing (walnut architrave, both faces) + open leaf (walk mode only)
        const cw = 0.07, cd = 0.015, e = w.t / 2;
        for (const [d0, d1] of [[e, e + cd], [-e - cd, -e]]) {
          runB(gF, 'walnut', w, o.a - cw, o.a, 0, o.y1 + cw, d0, d1); runB(gF, 'walnut', w, o.b, o.b + cw, 0, o.y1 + cw, d0, d1);
          if (o.y1 < H - cw) runB(gF, 'walnut', w, o.a - cw, o.b + cw, o.y1, o.y1 + cw, d0, d1);
        }
        if (o.door) {
          const lw = width - 0.02, hx = o.door.hinge === 'a' ? o.a + 0.01 : o.b - 0.05, s = o.door.swing;
          const n0 = s > 0 ? e : -e - lw, n1 = s > 0 ? e + lw : -e;
          let x0, z0, x1, z1;
          if (w.axis === 'x') { x0 = hx; x1 = hx + 0.04; z0 = w.at + n0; z1 = w.at + n1; } else { z0 = hx; z1 = hx + 0.04; x0 = w.at + n0; x1 = w.at + n1; }
          B('walk', 'walnut', x0, 0.005, z0, x1, 2.08, z1);
          // brass pull bar on the free edge
          const fe = s > 0 ? n1 - 0.08 : n0 + 0.08;
          if (w.axis === 'x') { B('walk', 'brass', x0 - 0.03, 0.75, w.at + fe - 0.01, x1 + 0.03, 1.25, w.at + fe + 0.01); }
          else { B('walk', 'brass', w.at + fe - 0.01, 0.75, z0 - 0.03, w.at + fe + 0.01, 1.25, z1 + 0.03); }
          place('door', `${w.id}/Door`, x0, 0.005, z0, x1, 2.08, z1, null);
          solid(x0 - 0.01, z0, x1 + 0.01, z1);
        }
      }
    }
  }

  /* ---------------- ceiling: coves + downlights (walk mode) ---------------- */
  const shadeDim = '#9C9282';                               // lamp shade glow = light colour x this tint (warm, ~1.5)
  for (const zn of FLAT.zones) {
    if (!['bath', 'mbath', 'passage', 'foyer', 'balcony'].includes(zn.id)) {
      const ins = 0.45, y0 = H - 0.03, y1 = H - 0.008, s = 0.035;
      const x0 = zn.x[0] + ins, x1 = zn.x[1] - ins, z0 = zn.z[0] + ins, z1 = zn.z[1] - ins;
      B('walk', 'light', x0, y0, z0, x1, y1, z0 + s, '#ffffff'); B('walk', 'light', x0, y0, z1 - s, x1, y1, z1, '#ffffff');
      B('walk', 'light', x0, y0, z0, x0 + s, y1, z1, '#ffffff'); B('walk', 'light', x1 - s, y0, z0, x1, y1, z1, '#ffffff');
      // the gypsum drop around the cove (a shallow box frame below the ceiling)
      const dw = 0.3, dy = H - 0.12;
      for (const [a0, a1, b0, b1] of [[zn.x[0], zn.x[1], zn.z[0], zn.z[0] + ins - 0.05], [zn.x[0], zn.x[1], zn.z[1] - ins + 0.05, zn.z[1]],
        [zn.x[0], zn.x[0] + ins - 0.05, zn.z[0], zn.z[1]], [zn.x[1] - ins + 0.05, zn.x[1], zn.z[0], zn.z[1]]]) {
        if (a1 - a0 > 0.01 && b1 - b0 > 0.01) B('walk', 'wall', a0, dy, b0, a1, H, b1, '#F6F2EC');
      }
      void dw;
    }
    for (const [x, z] of downlights(zn)) {
      const g = new THREE.CircleGeometry(0.05, 16); g.rotateX(Math.PI / 2);
      const yy = H - 0.004;                                   // flush in the recessed centre of each zone
      g.translate(x, yy, z); add('walk', 'light', tint(g, '#ffffff'));
      const r = new THREE.RingGeometry(0.05, 0.068, 16); r.rotateX(Math.PI / 2); r.translate(x, yy - 0.001, z); add('walk', 'brass', r);
    }
  }

  /* ---------------- living ---------------- */
  const CREAM = '#E9E1D3', IVORY = '#F3EEE6', TAUPE = '#B7A893', EMERALD = '#2C5A4C', RUST = '#9A5636', TEAL = '#2E5058', CAMEL = '#A9794A', SAGE = '#9FB09A';
  {
    // TV wall: fluted walnut slats on a dark backing, floating walnut console, black TV
    B('base', 'black', -6.0, 0, 1.4, -5.985, 2.75, 4.2);
    for (let z = 1.42; z < 4.18; z += 0.06) B('base', 'walnut', -5.985, 0, z, -5.95, 2.75, z + 0.045);
    B('base', 'black', -5.95, 1.15, 2.0, -5.91, 2.05, 3.6);
    B('base', 'walnut', -5.95, 0.25, 1.65, -5.5, 0.6, 3.95); B('base', 'brass', -5.51, 0.6, 1.65, -5.5, 0.615, 3.95);
    CY('base', 'brass', -5.72, 0.6, 3.6, 0.06, 0.05, 0.28, 16); CB('base', 'lacquer', -5.72, 0.6, 2.2, 0.22, 0.05, 0.3, 0.01, '#DCD3C5');
    place('furniture', 'Living/TVWall', -6.0, 0, 1.4, -5.5, 2.75, 4.2); solid(-6.0, 1.4, -5.5, 4.2);
    // rug
    B('base', 'rug', -5.0, 0, 1.3, -1.8, 0.012, 3.95); place('rug', 'Living/Rug', -5.0, 0, 1.3, -1.8, 0.012, 3.95);
    // L sofa (boucle), facing the TV (-x)
    const sy = 0.012;
    B('base', 'black', -2.25, sy, 1.3, -1.55, sy + 0.08, 3.9); B('base', 'black', -3.45, sy, 3.4, -2.25, sy + 0.08, 3.9);
    CB('base', 'fabric', -1.9, sy + 0.08, 2.6, 0.9, 0.3, 2.8, 0.05, CREAM);
    CB('base', 'fabric', -2.95, sy + 0.08, 3.65, 1.2, 0.3, 0.7, 0.05, CREAM);
    for (const [cz, len] of [[1.78, 0.9], [2.7, 0.9], [3.62, 0.8]]) CB('base', 'fabric', -2.0, sy + 0.38, cz, 0.68, 0.13, len - 0.04, 0.05, CREAM);
    CB('base', 'fabric', -2.95, sy + 0.38, 3.6, 1.14, 0.13, 0.62, 0.05, CREAM);
    CB('base', 'fabric', -1.56, sy + 0.38, 2.6, 0.2, 0.44, 2.8, 0.06, CREAM);                 // back
    CB('base', 'fabric', -2.9, sy + 0.38, 3.92, 1.3, 0.44, 0.2, 0.06, CREAM);                 // chaise back (south)
    CB('base', 'fabric', -1.9, sy + 0.38, 1.3, 0.9, 0.24, 0.2, 0.06, CREAM);                  // arm (north)
    for (const [cx, cz, col, r] of [[-1.72, 1.65, RUST, 0.25], [-1.72, 2.2, EMERALD, -0.15], [-1.72, 3.25, TAUPE, 0.2], [-2.5, 3.78, EMERALD, 1.4], [-3.2, 3.78, RUST, 1.7]]) {
      CB('base', 'velvet', cx, sy + 0.5, cz, 0.12, 0.36, 0.36, 0.055, col, r);
    }
    place('furniture', 'Living/Sofa', -3.45, sy, 1.2, -1.45, 0.83, 4.02); solid(-2.36, 1.2, -1.45, 4.02); solid(-3.55, 3.3, -2.36, 4.02);
    shadow(-2.36, 1.2, -1.45, 4.0, 0.014); shadow(-3.55, 3.3, -2.36, 4.0, 0.014);
    // round marble coffee table on a walnut drum + brass tray
    CY('base', 'walnut', -3.35, sy, 2.45, 0.36, 0.36, 0.34, 28); CY('base', 'stone', -3.35, sy + 0.34, 2.45, 0.52, 0.52, 0.035, 36);
    CY('base', 'brass', -3.2, sy + 0.375, 2.35, 0.17, 0.17, 0.012, 24); CY('base', 'lacquer', -3.52, sy + 0.375, 2.6, 0.06, 0.05, 0.16, 16, '#2B2B2B');
    place('furniture', 'Living/CoffeeTable', -3.87, sy, 1.93, -2.83, 0.53, 2.97, sy); solid(-3.87, 1.93, -2.83, 2.97); shadow(-3.8, 2.0, -2.9, 2.9, 0.014);
    // floor lamp
    CY('base', 'brass', -1.62, 0, 0.98, 0.16, 0.16, 0.02, 24); CY('base', 'brass', -1.62, 0.02, 0.98, 0.012, 0.012, 1.42, 8);
    CY('base', 'light', -1.62, 1.44, 0.98, 0.17, 0.21, 0.3, 24, shadeDim);
    place('furniture', 'Living/FloorLamp', -1.78, 0, 0.82, -1.46, 1.74, 1.14); solid(-1.78, 0.82, -1.46, 1.14);
    plant('Living/Plant', -5.55, 4.12, 1.3, 0.22, 0.5);
    // console + art behind the sofa (east wall)
    B('base', 'walnut', 0.14, 0.18, 1.75, 0.54, 0.82, 3.45); B('base', 'brass', 0.13, 0.82, 1.74, 0.54, 0.83, 3.46);
    for (const z of [1.8, 3.4]) B('base', 'brass', 0.2, 0, z - 0.02, 0.24, 0.18, z + 0.02);
    CY('base', 'lacquer', 0.34, 0.83, 2.0, 0.08, 0.1, 0.32, 18, '#E6DFD3'); CY('base', 'brass', 0.34, 0.83, 3.1, 0.12, 0.12, 0.05, 20);
    place('furniture', 'Living/Console', 0.14, 0, 1.75, 0.54, 0.83, 3.45); solid(0.12, 1.75, 0.55, 3.45);
    art('Living/Art', '-x', 0.5425, 1.95, 3.25, 1.25, 2.2, [0, 0, 0.62, 0.48]);
  }

  /* ---------------- dining ---------------- */
  {
    const tx = -3.3, tz = 0.2;
    B('base', 'stone', tx - 1.0, 0.72, tz - 0.5, tx + 1.0, 0.76, tz + 0.5);
    B('base', 'walnut', tx - 0.92, 0.66, tz - 0.42, tx + 0.92, 0.72, tz + 0.42);
    for (const sx of [-1, 1]) {                                  // brass sled legs
      B('base', 'brass', tx + sx * 0.75 - 0.02, 0, tz - 0.38, tx + sx * 0.75 + 0.02, 0.66, tz - 0.34);
      B('base', 'brass', tx + sx * 0.75 - 0.02, 0, tz + 0.34, tx + sx * 0.75 + 0.02, 0.66, tz + 0.38);
      B('base', 'brass', tx + sx * 0.75 - 0.02, 0, tz - 0.38, tx + sx * 0.75 + 0.02, 0.03, tz + 0.38);
    }
    const chair = (cx, cz, face) => {                            // face: +1 faces +z, -1 faces -z
      CB('base', 'velvet', cx, 0.44, cz, 0.48, 0.08, 0.48, 0.03, EMERALD);
      CB('base', 'velvet', cx, 0.5, cz - face * 0.23, 0.48, 0.44, 0.07, 0.03, EMERALD);
      for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) CY('base', 'brass', cx + lx, 0, cz + lz, 0.012, 0.012, 0.44, 8);
    };
    for (const dx of [-0.65, 0, 0.65]) { chair(tx + dx, tz - 0.72, 1); chair(tx + dx, tz + 0.72, -1); }
    place('furniture', 'Dining/Set', tx - 1.0, 0, tz - 0.98, tx + 1.0, 0.94, tz + 0.98);
    solid(tx - 1.02, tz - 0.98, tx + 1.02, tz + 0.98); shadow(tx - 1.0, tz - 0.95, tx + 1.0, tz + 0.95);
    // pendant cluster (walk mode only: it hangs from the ceiling)
    for (const dx of [-0.6, 0, 0.6]) {
      const g = new THREE.SphereGeometry(0.13, 20, 14); g.translate(tx + dx, 1.95 + (dx === 0 ? 0.1 : 0), tz); add('walk', 'light', tint(g, '#8A8070'));
      CY('walk', 'brass', tx + dx, 2.08 + (dx === 0 ? 0.1 : 0), tz, 0.006, 0.006, H - 2.08 - (dx === 0 ? 0.1 : 0), 6);
      CY('walk', 'brass', tx + dx, 2.06 + (dx === 0 ? 0.1 : 0), tz, 0.04, 0.03, 0.03, 12);
    }
    CY('walk', 'brass', tx, H - 0.015, tz, 0.4, 0.4, 0.015, 32);
  }

  /* ---------------- kitchen ---------------- */
  {
    const GREIGE = '#B3A898', top = 0.9;
    const run = (x0, z0, x1, z1, front) => {                     // base cabinets + marble top + brass pulls
      B('base', 'black', x0 + (front === 'z' ? 0 : 0), 0, z0, x1, 0.1, z1);
      B('base', 'lacquer', x0, 0.1, z0, x1, top - 0.04, z1, GREIGE);
      B('base', 'stone', x0, top - 0.04, z0, x1 + (front === 'x' ? 0.02 : 0), top, z1 + (front === 'z' ? 0.02 : 0));
    };
    run(-6.0, -4.5, -2.86, -3.9, 'z');
    run(-6.0, -3.9, -5.4, -2.45, 'x');
    for (let x = -5.7; x < -2.9; x += 0.6) B('base', 'brass', x - 0.12, top - 0.1, -3.9, x + 0.12, top - 0.08, -3.88);
    for (let z = -3.6; z < -2.5; z += 0.6) B('base', 'brass', -5.4, top - 0.1, z - 0.12, -5.38, top - 0.08, z + 0.12);
    // tall unit (fridge / oven column)
    B('base', 'lacquer', -6.0, 0, -2.45, -5.4, 2.4, -1.65, GREIGE);
    B('base', 'brass', -5.4, 0.9, -2.08, -5.38, 1.7, -2.06);
    B('base', 'black', -5.395, 1.05, -2.4, -5.39, 1.6, -2.1);
    // backsplash in marble and upper cabinets either side of the window, with an LED strip under them
    B('base', 'stone', -6.0, top, -4.5, -2.86, 1.05, -4.48);
    for (const [x0, x1] of [[-6.0, -5.3], [-3.7, -2.86]]) {
      B('base', 'lacquer', x0, 1.5, -4.5, x1, 2.4, -4.15, GREIGE);
      B('base', 'light', x0 + 0.03, 1.488, -4.2, x1 - 0.03, 1.5, -4.18, '#ffffff');
    }
    B('base', 'black', -4.8, top - 0.004, -4.42, -4.2, top + 0.002, -4.02);              // sink
    CY('base', 'chrome', -4.5, top, -4.4, 0.016, 0.02, 0.32, 10); B('base', 'chrome', -4.515, top + 0.3, -4.4, -4.485, top + 0.32, -4.2);
    B('base', 'black', -3.7, top, -4.42, -3.1, top + 0.006, -3.98);                      // induction hob
    place('furniture', 'Kitchen/Counters', -6.0, 0, -4.5, -2.86, 2.4, -1.65);
    solid(-6.0, -4.5, -2.86, -3.88); solid(-6.0, -3.9, -5.38, -1.65);
    // island with a waterfall marble top
    B('base', 'black', -4.8, 0, -2.6, -3.2, 0.1, -1.8);
    B('base', 'lacquer', -4.89, 0.1, -2.65, -3.11, 0.86, -1.75, GREIGE);
    B('base', 'stone', -4.95, 0.86, -2.7, -3.05, 0.92, -1.68);
    B('base', 'stone', -4.95, 0, -2.7, -4.89, 0.86, -1.68); B('base', 'stone', -3.11, 0, -2.7, -3.05, 0.86, -1.68);
    place('furniture', 'Kitchen/Island', -4.95, 0, -2.7, -3.05, 0.92, -1.68); solid(-4.95, -2.7, -3.05, -1.68); shadow(-4.95, -2.7, -3.05, -1.68);
    for (const x of [-4.5, -4.0, -3.5]) {                        // bar stools
      CY('base', 'brass', x, 0, -1.4, 0.19, 0.19, 0.015, 24); CY('base', 'brass', x, 0.015, -1.4, 0.025, 0.025, 0.62, 10);
      CY('base', 'brass', x, 0.3, -1.4, 0.17, 0.17, 0.012, 24);
      CB('base', 'velvet', x, 0.63, -1.4, 0.38, 0.08, 0.38, 0.03, CAMEL);
    }
    place('furniture', 'Kitchen/Stools', -4.7, 0, -1.6, -3.3, 0.71, -1.2); solid(-4.72, -1.62, -3.28, -1.18);
    for (const x of [-4.4, -3.6]) {                              // island pendants (walk mode)
      CY('walk', 'black', x, 1.72, -2.2, 0.08, 0.16, 0.22, 24); CY('walk', 'light', x, 1.715, -2.2, 0.15, 0.15, 0.006, 24, '#ffffff');
      CY('walk', 'black', x, 1.94, -2.2, 0.005, 0.005, H - 1.94, 6);
    }
  }

  /* ---------------- foyer ---------------- */
  {
    B('base', 'walnut', 0.17, 0.16, -4.25, 0.54, 1.0, -3.0); B('base', 'brass', 0.16, 1.0, -4.26, 0.54, 1.012, -2.99);
    place('furniture', 'Foyer/ShoeCabinet', 0.17, 0.16, -4.25, 0.54, 1.01, -3.0, null); solid(0.15, -4.25, 0.55, -3.0);
    const m = new THREE.CylinderGeometry(0.4, 0.4, 0.02, 40); m.rotateZ(Math.PI / 2); m.translate(0.52, 1.62, -3.62); add('base', 'chrome', m);
    const r = new THREE.CylinderGeometry(0.43, 0.43, 0.015, 40); r.rotateZ(Math.PI / 2); r.translate(0.535, 1.62, -3.62); add('base', 'brass', r);
    CY('base', 'lacquer', 0.35, 1.012, -3.3, 0.07, 0.09, 0.26, 16, '#2B2B2B');
    plant('Foyer/Plant', -0.68, -4.25, 0.95, 0.16, 0.38);
  }

  /* ---------------- common bath ---------------- */
  const vanity = (id, x0, z0, x1, z1, basins, face) => {         // floating walnut vanity, marble top, vessel basins
    B('base', 'walnut', x0, 0.45, z0, x1, 0.85, z1); B('base', 'stone', x0 - 0.01, 0.85, z0 - 0.01, x1 + 0.01, 0.88, z1 + 0.01);
    for (const [bx, bz] of basins) {
      CY('base', 'lacquer', bx, 0.88, bz, 0.2, 0.15, 0.13, 28, '#F7F5F1');
      const fx = bx + (face === 'x' ? -0.22 : 0) * (x0 < -1 ? -1 : 1);
      CY('base', 'chrome', face === 'x' ? (x0 < -1 ? x0 + 0.05 : x1 - 0.05) : fx, 0.88, face === 'x' ? bz : z0 + 0.05, 0.014, 0.016, 0.3, 10);
    }
    place('furniture', id, x0, 0.45, z0, x1, 1.02, z1, null); solid(x0, z0, x1, z1);
  };
  const mirror = (wallX, z0, z1, y0, y1, dir) => {                // backlit mirror on an x wall; dir = +1 faces +x
    B('base', 'light', wallX, y0 - 0.025, z0 - 0.025, wallX + dir * 0.006, y1 + 0.025, z1 + 0.025, '#ffffff');
    B('base', 'chrome', wallX + dir * 0.006, y0, z0, wallX + dir * 0.022, y1, z1);
  };
  const wc = (id, cx, cz, rot) => {
    const g1 = util.chamferBox(0.38, 0.38, 0.56, 0.06); g1.translate(0, 0.19, 0.0); g1.rotateY(rot); g1.translate(cx, 0, cz); add('base', 'lacquer', tint(g1, '#F7F5F1'));
    const g2 = util.chamferBox(0.4, 0.04, 0.58, 0.02); g2.translate(0, 0.4, 0.0); g2.rotateY(rot); g2.translate(cx, 0, cz); add('base', 'lacquer', tint(g2, '#F2F0EC'));
    place('furniture', id, cx - 0.3, 0, cz - 0.3, cx + 0.3, 0.42, cz + 0.3); solid(cx - 0.29, cz - 0.29, cx + 0.29, cz + 0.29);
  };
  const shower = (id, x0, z0, x1, z1, hx, hz) => {
    B('base', 'glass', x0, 0.01, z0, x1, 2.1, z1); B('base', 'brass', x0, 2.08, z0, x1, 2.1, z1);
    CY('base', 'chrome', hx, 2.18, hz, 0.12, 0.12, 0.012, 28);
    place('furniture', id, x0, 0, z0, x1, 2.1, z1); solid(x0 - 0.02, z0 - 0.02, x1 + 0.02, z1 + 0.02);
  };
  vanity('Bath/Vanity', -2.74, -3.55, -2.24, -2.75, [[-2.47, -3.15]], 'x');
  mirror(-2.7425, -3.45, -2.85, 1.2, 1.95, 1);
  wc('Bath/WC', -2.45, -4.18, Math.PI / 2);
  shower('Bath/Shower', -1.93, -4.5, -1.91, -3.55, -1.4, -4.1);

  /* ---------------- master bath ---------------- */
  vanity('MasterBath/Vanity', 5.5, -0.2, 6.0, 1.0, [[5.74, 0.1], [5.74, 0.7]], 'x');
  mirror(6.0, -0.15, 0.95, 1.2, 1.95, -1);
  wc('MasterBath/WC', 5.2, -0.65, 0);
  shower('MasterBath/Shower', 4.06, -0.02, 4.8, 0.0, 4.45, -0.5);

  /* ---------------- master bedroom ---------------- */
  {
    B('base', 'walnut', 0.66, 0, 1.5, 0.72, 1.45, 4.3);                                    // headboard wall panel
    CB('base', 'velvet', 0.77, 0.42, 2.9, 0.1, 0.92, 2.2, 0.03, TEAL);
    for (let z = 1.95; z < 3.9; z += 0.37) B('base', 'velvet', 0.815, 0.45, z, 0.825, 1.31, z + 0.012, '#24424A');   // channel tufting
    B('base', 'black', 0.9, 0, 2.05, 2.75, 0.1, 3.75);
    B('base', 'walnut', 0.8, 0.1, 1.95, 2.95, 0.33, 3.85);
    CB('base', 'fabric', 1.86, 0.33, 2.9, 2.1, 0.26, 1.86, 0.06, IVORY);
    CB('base', 'fabric', 2.12, 0.56, 2.9, 1.62, 0.07, 1.96, 0.03, '#EFE9DE');               // duvet
    CB('base', 'velvet', 2.55, 0.6, 2.9, 0.45, 0.04, 2.0, 0.02, TEAL);                       // throw
    for (const z of [2.35, 3.45]) { CB('base', 'fabric', 1.08, 0.59, z, 0.32, 0.2, 0.72, 0.07, IVORY, 0); CB('base', 'velvet', 1.26, 0.62, z + (z < 3 ? 0.27 : -0.27), 0.11, 0.28, 0.28, 0.05, RUST, 0); }
    for (const [z0, z1] of [[1.38, 1.85], [3.95, 4.42]]) {
      B('base', 'walnut', 0.74, 0, z0, 1.24, 0.5, z1); B('base', 'brass', 0.74, 0.5, z0, 1.24, 0.512, z1);
      const cz = (z0 + z1) / 2;
      CY('base', 'brass', 0.98, 0.512, cz, 0.07, 0.08, 0.03, 18); CY('base', 'brass', 0.98, 0.54, cz, 0.01, 0.01, 0.3, 8);
      CY('base', 'light', 0.98, 0.78, cz, 0.12, 0.15, 0.2, 24, shadeDim);
    }
    place('furniture', 'Master/Bed', 0.66, 0, 1.38, 2.95, 1.45, 4.42); solid(0.66, 1.38, 2.97, 4.44); shadow(0.8, 1.38, 2.95, 4.42);
    B('base', 'rug', 1.6, 0, 1.55, 3.85, 0.012, 4.25); place('rug', 'Master/Rug', 1.6, 0, 1.55, 3.85, 0.012, 4.25);
    // bench at the foot
    CB('base', 'velvet', 3.25, 0.28, 2.9, 0.42, 0.16, 1.3, 0.03, CAMEL);
    for (const [lx, lz] of [[3.08, 2.3], [3.42, 2.3], [3.08, 3.5], [3.42, 3.5]]) CY('base', 'brass', lx, 0.012, lz, 0.012, 0.012, 0.27, 8);
    place('furniture', 'Master/Bench', 3.04, 0, 2.25, 3.46, 0.44, 3.55); solid(3.04, 2.25, 3.46, 3.55);
    // wardrobe run on the north wall (walnut, brass pulls)
    B('base', 'walnut', 2.3, 0, 0.26, 3.94, 2.4, 0.86);
    for (let x = 2.3 + 0.41; x < 3.94; x += 0.41) B('base', 'black', x - 0.003, 0.02, 0.86, x + 0.003, 2.38, 0.862);
    for (let x = 2.3 + 0.41; x < 3.94; x += 0.82) { B('base', 'brass', x - 0.05, 0.85, 0.862, x - 0.03, 1.45, 0.88); B('base', 'brass', x + 0.03, 0.85, 0.862, x + 0.05, 1.45, 0.88); }
    place('furniture', 'Master/Wardrobe', 2.3, 0, 0.26, 3.94, 2.4, 0.86); solid(2.3, 0.26, 3.94, 0.88);
    // lounge chair by the window + side table + plant
    CB('base', 'velvet', 5.25, 0.18, 3.25, 0.72, 0.22, 0.72, 0.06, CAMEL, 0);
    CB('base', 'velvet', 5.55, 0.38, 3.25, 0.14, 0.45, 0.72, 0.06, CAMEL, 0);
    CB('base', 'velvet', 5.25, 0.38, 2.94, 0.72, 0.2, 0.12, 0.05, CAMEL, 0); CB('base', 'velvet', 5.25, 0.38, 3.56, 0.72, 0.2, 0.12, 0.05, CAMEL, 0);
    for (const [lx, lz] of [[4.95, 2.95], [5.55, 2.95], [4.95, 3.55], [5.55, 3.55]]) CY('base', 'walnut', lx, 0, lz, 0.02, 0.016, 0.18, 8);
    CY('base', 'brass', 5.25, 0, 2.45, 0.2, 0.2, 0.5, 24); CY('base', 'stone', 5.25, 0.5, 2.45, 0.22, 0.22, 0.02, 24);
    place('furniture', 'Master/LoungeChair', 4.88, 0, 2.88, 5.62, 0.83, 3.62); solid(4.88, 2.2, 5.62, 3.62); shadow(4.9, 2.9, 5.6, 3.6);
    plant('Master/Plant', 5.6, 4.15, 1.0, 0.17, 0.4);
    art('Master/Art', '+x', 0.6575, 2.3, 3.5, 1.68, 2.38, [0.38, 0.5, 1, 1]);
  }

  /* ---------------- bedroom 2 ---------------- */
  {
    CB('base', 'fabric', 5.93, 0, -2.75, 0.12, 1.2, 1.9, 0.04, '#C8BAA6');                 // upholstered headboard
    B('base', 'black', 4.0, 0, -3.4, 5.7, 0.1, -2.1);
    B('base', 'walnut', 3.9, 0.1, -3.55, 5.86, 0.33, -1.95);
    CB('base', 'fabric', 4.88, 0.33, -2.75, 1.96, 0.25, 1.56, 0.06, IVORY);
    CB('base', 'fabric', 4.6, 0.55, -2.75, 1.45, 0.07, 1.66, 0.03, SAGE);
    for (const z of [-3.15, -2.35]) CB('base', 'fabric', 5.6, 0.58, z, 0.3, 0.18, 0.66, 0.06, IVORY);
    for (const [z0, z1] of [[-4.05, -3.65], [-1.85, -1.45]]) {
      B('base', 'walnut', 5.5, 0, z0, 5.98, 0.48, z1); const cz = (z0 + z1) / 2;
      CY('base', 'brass', 5.74, 0.48, cz, 0.05, 0.06, 0.25, 12); CY('base', 'light', 5.74, 0.72, cz, 0.1, 0.12, 0.16, 20, shadeDim);
    }
    place('furniture', 'Bed2/Bed', 3.9, 0, -4.05, 6.0, 1.2, -1.45); solid(3.88, -4.06, 6.0, -1.44); shadow(3.9, -3.55, 5.9, -1.95);
    B('base', 'rug', 3.2, 0, -3.95, 5.3, 0.012, -1.55); place('rug', 'Bed2/Rug', 3.2, 0, -3.95, 5.3, 0.012, -1.55);
    // desk under the window + chair
    B('base', 'walnut', 2.4, 0.72, -4.5, 3.6, 0.76, -3.95);
    for (const x of [2.45, 3.55]) B('base', 'brass', x - 0.015, 0, -4.45, x + 0.015, 0.72, -4.0);
    CY('base', 'brass', 3.35, 0.76, -4.3, 0.06, 0.06, 0.02, 16); CY('base', 'light', 3.35, 0.78, -4.3, 0.05, 0.05, 0.25, 12, shadeDim);
    CB('base', 'velvet', 3.0, 0.44, -3.62, 0.46, 0.08, 0.46, 0.03, TEAL); CB('base', 'velvet', 3.0, 0.5, -3.4, 0.46, 0.36, 0.07, 0.03, TEAL);
    for (const [lx, lz] of [[2.8, -3.8], [3.2, -3.8], [2.8, -3.44], [3.2, -3.44]]) CY('base', 'brass', lx, 0, lz, 0.012, 0.012, 0.44, 8);
    place('furniture', 'Bed2/Desk', 2.4, 0, -4.5, 3.6, 0.86, -3.35); solid(2.4, -4.5, 3.6, -3.35);
    // wardrobe (light lacquer) on the west wall
    B('base', 'lacquer', 0.66, 0, -4.45, 1.26, 2.4, -2.55, '#E5DED3');
    for (let z = -4.45 + 0.475; z < -2.56; z += 0.475) B('base', 'black', 1.26, 0.02, z - 0.003, 1.262, 2.38, z + 0.003);
    for (const z of [-3.97, -3.03]) B('base', 'brass', 1.262, 0.85, z - 0.04, 1.28, 1.45, z + 0.04);
    place('furniture', 'Bed2/Wardrobe', 0.66, 0, -4.45, 1.26, 2.4, -2.55); solid(0.66, -4.45, 1.28, -2.55);
    art('Bed2/Art', '-x', 6.0, -3.25, -2.25, 1.45, 2.15, [0, 0.52, 0.42, 1]);
    plant('Bed2/Plant', 1.6, -4.15, 0.8, 0.15, 0.36);
  }

  /* ---------------- passage ---------------- */
  art('Passage/Art', '-x', 3.9425, -0.75, -0.05, 1.25, 2.05, [0.6, 0.0, 1, 0.45]);

  /* ---------------- balcony: glass railing, loungers, planters ---------------- */
  {
    const rz = FLAT.balcony.z[1];
    B('base', 'wall', X0, 0, rz - 0.08, X1, 0.08, rz, '#E2DCD2');
    B('base', 'glass', X0 + 0.02, 0.08, rz - 0.05, X1 - 0.02, 1.05, rz - 0.03);
    B('base', 'brass', X0, 1.05, rz - 0.07, X1, 1.1, rz - 0.01);
    for (const sx of [X0, X1]) {
      const a = sx < 0 ? sx : sx - 0.06, b = sx < 0 ? sx + 0.06 : sx;
      B('base', 'wall', a, 0, FLAT.balcony.z[0], b, 0.08, rz, '#E2DCD2');
      B('base', 'glass', a + 0.02, 0.08, FLAT.balcony.z[0], b - 0.02, 1.05, rz - 0.07);
      B('base', 'brass', a, 1.05, FLAT.balcony.z[0], b, 1.1, rz);
    }
    solid(X0, rz - 0.1, X1, rz); solid(X0, FLAT.balcony.z[0], X0 + 0.06, rz); solid(X1 - 0.06, FLAT.balcony.z[0], X1, rz);
    for (const x of [-3.9, -2.4]) {
      CB('base', 'fabric', x, 0.12, 5.45, 0.66, 0.2, 0.7, 0.05, '#DCD3C4');
      CB('base', 'fabric', x, 0.32, 5.75, 0.66, 0.4, 0.14, 0.05, '#DCD3C4');
      B('base', 'walnut', x - 0.33, 0, 5.1, x + 0.33, 0.12, 5.82);
      place('furniture', `Balcony/Lounger${x}`, x - 0.33, 0, 5.1, x + 0.33, 0.72, 5.82); solid(x - 0.34, 5.1, x + 0.34, 5.83);
    }
    CY('base', 'walnut', -3.15, 0, 5.35, 0.18, 0.18, 0.42, 20); place('furniture', 'Balcony/SideTable', -3.33, 0, 5.17, -2.97, 0.42, 5.53);
    plant('Balcony/PlantW', -5.55, 5.6, 1.2, 0.24, 0.5); plant('Balcony/PlantE', 5.55, 5.6, 1.2, 0.24, 0.5); plant('Balcony/PlantM', 1.2, 5.65, 0.9, 0.2, 0.42);
  }

  /* ---------------- curtains (sheer, walk mode) beside the sliding doors ---------------- */
  for (const [a, b] of [[-5.65, -5.02], [-0.98, -0.35], [1.75, 2.38], [4.42, 5.05]]) {
    const n = 6, w = (b - a) / n;
    for (let i = 0; i < n; i++) B('walk', 'curtain', a + i * w, 0.02, 4.33 + (i % 2) * 0.05, a + (i + 1) * w + 0.01, H - 0.05, 4.36 + (i % 2) * 0.05);
    B('walk', 'black', a - 0.05, H - 0.05, 4.32, b + 0.05, H - 0.03, 4.42);
  }

  /* ---------------- merge per (group, material) ---------------- */
  const groups = {};
  const grp = (name) => groups[name] || (groups[name] = (() => { const g = new THREE.Group(); g.name = 'Flat_' + name; group.add(g); return g; })());
  for (const name of ['base', 'walk', 'doll', 'intF', 'intC', ...Object.keys(SIDES).flatMap((s) => [`ext${s}F`, `ext${s}C`])]) grp(name);
  for (const { grp: gname, mat, parts } of buckets.values()) {
    const opts = mat === 'stone' ? { uvTile: 1.2 } : mat === 'walnut' ? { uvTile: 0.9 } : {};
    const g = util.mergeParts(parts, opts);
    if (mat === 'marble') {                                   // lightMap UVs (channel 1): plan position
      const p = g.attributes.position, a = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) { a[i * 2] = (p.getX(i) - X0) / (X1 - X0); a[i * 2 + 1] = (p.getZ(i) - Z0) / (Z1 - Z0); }
      g.setAttribute('uv1', new THREE.BufferAttribute(a, 2));
    }
    const m = util.mesh(g, mats[mat], { name: `Flat_${gname}_${mat}`, castShadow: false, receiveShadow: false });
    if (mat === 'shadow') m.renderOrder = 1;
    if (mat === 'glass' || mat === 'curtain') m.renderOrder = 2;
    if (mat === 'backdrop') { m.renderOrder = -1; m.frustumCulled = false; }
    grp(gname).add(m);
  }

  /* ---------------- polished floor: mirrored room under a slightly transparent marble floor ---------------- */
  // The classic showroom trick: every visible mesh is drawn again mirrored in y (same geometry and materials, so no
  // new programs; three flips the face winding for the negative scale). Through the floor at 80 % opacity it reads as
  // the soft reflection of a polished slab: coves, downlights, windows and furniture all show in it. Walk mode only.
  const refl = new THREE.Group(); refl.name = 'Flat_reflection'; refl.scale.y = -1; group.add(refl);
  const mirrorOf = {};
  for (const [name, g] of Object.entries(groups)) {
    if (name === 'doll') continue;
    const mg = new THREE.Group(); mg.name = 'FlatRefl_' + name; refl.add(mg); mirrorOf[name] = mg;
    for (const m of g.children) {
      if (m.material === mats.marble || m.material === mats.shadow) continue;
      const c = new THREE.Mesh(m.geometry, m.material); c.name = 'Refl_' + m.name; c.renderOrder = m.renderOrder; c.frustumCulled = m.frustumCulled;
      mg.add(c);
    }
  }
  mats.marble.transparent = true;

  /* ---------------- modes ---------------- */
  let mode = 'dollhouse';
  const [cx, cz] = FLAT.centre;
  function sync() {
    for (const [n, mg] of Object.entries(mirrorOf)) mg.visible = groups[n].visible;
    refl.visible = mode === 'walk' || mode === 'all';
    mats.marble.opacity = mode === 'dollhouse' ? 1 : 0.8;
  }
  function setMode(m) {
    mode = m;
    const all = m === 'all', walk = m === 'walk';
    groups.walk.visible = walk || all; groups.doll.visible = !walk || all;
    groups.intF.visible = walk || all; groups.intC.visible = !walk || all;
    for (const s of Object.keys(SIDES)) { groups[`ext${s}F`].visible = true; groups[`ext${s}C`].visible = all; }
    sync();
  }
  /** Dollhouse cutaway: exterior sides facing the camera drop to the cut height. */
  function update(f) {
    if (mode !== 'dollhouse' || !f.camera) return;
    const dx = f.camera.position.x - cx, dz = f.camera.position.z - cz, l = Math.hypot(dx, dz) || 1;
    for (const [s, [nx, nz]] of Object.entries(SIDES)) {
      const facing = (nx * dx + nz * dz) / l > 0.2;
      groups[`ext${s}F`].visible = !facing; groups[`ext${s}C`].visible = facing;
    }
  }
  setMode('dollhouse');
  update({ camera: { position: { x: 9, z: 13 } } });
  return {
    group, update, setMode, colliders,
    bounds: { x: [FLAT.inner.x[0], FLAT.inner.x[1]], z: [FLAT.inner.z[0], FLAT.balcony.z[1] - 0.08] },
    eye: FLAT.eye, radius: FLAT.radius,
  };
}
