// Gym interior (v1-lite, matched loosely to internal ref F). Built into its own scene; lazy-loaded by core when the
// 'gym' view is requested. Must also build under node (no document/window; canvases via ctx.tex.canvas).
// Frame: room centred on the origin, floor y=0, back wall z=-D/2 (-4.75), camera preset at (0, 1.25, 4.6).
// Lighting: no real lights (core gives a RoomEnvironment PMREM); light pools are painted into lightMaps
// (src/materials/gym.js). Geometry is merged per material (about 20 draw calls).
import { GYM } from './materials/gym.js';

export async function build(ctx) {
  const { THREE, util, registry } = ctx;
  const { W, D, H } = GYM;
  const xL = -W / 2, xR = W / 2, zB = -D / 2, zF = D / 2;
  const group = new THREE.Group(); group.name = 'Interior_gym';
  const rng = ctx.rng('gym');
  const M = ctx.M;
  const mats = {};
  for (const n of ['gym.floor', 'gym.wallSide', 'gym.wallBack', 'gym.ceiling', 'gym.led', 'gym.outside', 'gym.door', 'gym.doorFrame',
    'gym.metalDark', 'gym.rubber', 'gym.matNavy', 'gym.matGrey', 'gym.lampShade', 'gym.leaf', 'gym.pot', 'gym.art', 'gym.yoga', 'steel', 'gym.contactShadow']) mats[n] = await M.use(n);

  /* ---------------- helpers ---------------- */
  const parts = {};                                          // material name -> [{geometry, matrix}]
  const add = (mat, geometry, matrix = null) => { (parts[mat] ||= []).push({ geometry, matrix }); return geometry; };
  const box = (x0, y0, z0, x1, y1, z1) => util.boxMinMax(x0, y0, z0, x1, y1, z1);
  const M4 = (pos, rot = 0, s = 1) => util.mat(pos, rot, s);
  const cyl = (rt, rb, h, seg = 16, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  const place = (kind, id, b, supportY = 0) => registry.place({ kind, id: 'Gym/' + id, bbox: b, supportY, module: 'gym' });
  const bbox = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
  /** Set the uv attribute (channel `name`) from world positions. */
  function uvFrom(geometry, fn, name = 'uv') {
    const p = geometry.attributes.position, a = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { const [u, v] = fn(p.getX(i), p.getY(i), p.getZ(i)); a[i * 2] = u; a[i * 2 + 1] = v; }
    geometry.setAttribute(name, new THREE.BufferAttribute(a, 2));
    return geometry;
  }
  const meshOf = (name, geometry, opts = {}) => {
    const m = util.mesh(geometry, mats[name], { name: opts.label || name.replace('gym.', 'Gym_'), castShadow: false, receiveShadow: false });
    group.add(m); return m;
  };
  /** Soft contact shadow under a floor object: footprint sx x sz (m) centred at x,z, drawn at ~1.2x + a small margin
   *  (the texture's dark core covers the inner ~60 %, fading to 0 at the decal edge). */
  const shadowDecal = (x, z, sx, sz, rot = 0) => {
    const g = new THREE.PlaneGeometry(sx * 1.2 + 0.12, sz * 1.2 + 0.12); g.rotateX(-Math.PI / 2); g.rotateY(rot); g.translate(x, 0.002, z);   // below the 6 mm mats, no polygon offset (so it never draws over them)
    add('gym.contactShadow', g);
  };

  /* ---------------- room shell ---------------- */
  // floor: tile UVs (channel 0, 2.4 m per image) + lightmap UVs (channel 1, whole room)
  {
    const g = new THREE.PlaneGeometry(W, D, 1, 1); g.rotateX(-Math.PI / 2);
    uvFrom(g, (x, y, z) => [(x + 0.6) / 2.4, (z + 0.3) / 2.4]);
    uvFrom(g, (x, y, z) => [(x - xL) / W, (z - zB) / D], 'uv1');
    meshOf('gym.floor', g, { label: 'Gym_Floor' }).receiveShadow = true;
  }
  // ceiling (faces down); the bulkhead along the left wall drops to GYM.bulkhead.bottom
  const bh = GYM.bulkhead;
  {
    const g = new THREE.PlaneGeometry(W, D); g.rotateX(Math.PI / 2); g.translate(0, H, 0);
    add('gym.ceiling', g);
    add('gym.ceiling', box(xL, bh.bottom, zB, xL + bh.w, H, zF));
  }
  // back wall (+ front wall behind the camera)
  add('gym.wallBack', (() => { const g = new THREE.PlaneGeometry(W, H); g.translate(0, H / 2, zB); return g; })());
  add('gym.wallBack', (() => { const g = new THREE.PlaneGeometry(W, H); g.rotateY(Math.PI); g.translate(0, H / 2, zF); return g; })());
  // right wall
  add('gym.wallSide', (() => { const g = new THREE.PlaneGeometry(D, H); g.rotateY(-Math.PI / 2); g.translate(xR, H / 2, 0); return g; })());
  // left wall: solid boxes (0.5 m deep) with deep window openings -> the box faces form the reveals
  {
    const t = GYM.reveal, x0 = xL - t, wins = [...GYM.windows].sort((a, b) => a[0] - b[0]);
    let z = zB;
    for (const [w0, w1] of wins) {
      if (w0 > z) add('gym.wallSide', box(x0, 0, z, xL, bh.bottom, w0));           // pier
      add('gym.wallSide', box(x0, 0, w0, xL, GYM.sill, w1));                       // under the sill
      // exterior (bright) + slim dark frame and a mullion
      const og = new THREE.PlaneGeometry(w1 - w0, bh.bottom - GYM.sill); og.rotateY(Math.PI / 2); og.translate(x0 + 0.02, (GYM.sill + bh.bottom) / 2, (w0 + w1) / 2);
      add('gym.outside', og);
      const fx0 = x0 + 0.03, fx1 = x0 + 0.08;
      add('gym.metalDark', box(fx0, GYM.sill, w0, fx1, GYM.sill + 0.05, w1));
      add('gym.metalDark', box(fx0, bh.bottom - 0.05, w0, fx1, bh.bottom, w1));
      add('gym.metalDark', box(fx0, GYM.sill, w0, fx1, bh.bottom, w0 + 0.05));
      add('gym.metalDark', box(fx0, GYM.sill, w1 - 0.05, fx1, bh.bottom, w1));
      if (w1 - w0 > 1.4) add('gym.metalDark', box(fx0, GYM.sill, (w0 + w1) / 2 - 0.025, fx1, bh.bottom, (w0 + w1) / 2 + 0.025));
      z = w1;
    }
    if (z < zF) add('gym.wallSide', box(x0, 0, z, xL, bh.bottom, zF));
    add('gym.wallSide', box(x0, bh.bottom, zB, xL, H, zF));                         // lintel behind the bulkhead
    // skirting shadow line is painted in the lightmaps; sill stone is the wall colour (simple, matches ref)
  }
  // LED rectangle (flush thin strip) + 8 downlight discs with white trims
  {
    const L = GYM.led, s = L.strip, y = H - 0.004;
    add('gym.led', box(L.x[0], y, L.z[0], L.x[1], y + 0.003, L.z[0] + s));
    add('gym.led', box(L.x[0], y, L.z[1] - s, L.x[1], y + 0.003, L.z[1]));
    add('gym.led', box(L.x[0], y, L.z[0], L.x[0] + s, y + 0.003, L.z[1]));
    add('gym.led', box(L.x[1] - s, y, L.z[0], L.x[1], y + 0.003, L.z[1]));
    for (const [x, z] of GYM.downlights) {
      const d = new THREE.CircleGeometry(0.05, 20); d.rotateX(Math.PI / 2); d.translate(x, H - 0.006, z); add('gym.led', d);
      const r = new THREE.RingGeometry(0.05, 0.07, 20); r.rotateX(Math.PI / 2); r.translate(x, H - 0.005, z); add('gym.ceiling', r);
    }
  }

  /* ---------------- doors (walnut, diagonal grooves on the handle half) ---------------- */
  for (const [i, cx] of [[1, -1.72], [2, 3.0]]) {
    const dw = 0.98, dh = 2.2, z0 = zB, fw = 0.07;
    const leaf = box(cx - dw / 2, 0, z0 + 0.005, cx + dw / 2, dh, z0 + 0.045);
    add('gym.door', leaf);
    add('gym.doorFrame', box(cx - dw / 2 - fw, 0, z0, cx - dw / 2, dh + fw, z0 + 0.06));
    add('gym.doorFrame', box(cx + dw / 2, 0, z0, cx + dw / 2 + fw, dh + fw, z0 + 0.06));
    add('gym.doorFrame', box(cx - dw / 2 - fw, dh, z0, cx + dw / 2 + fw, dh + fw, z0 + 0.06));
    // lever handle + rose
    const hx = cx + dw / 2 - 0.42;
    add('steel', cyl(0.03, 0.03, 0.02, 16), M4([hx, 1.02, z0 + 0.055], [Math.PI / 2, 0, 0]));
    add('steel', box(hx - 0.13, 1.005, z0 + 0.06, hx + 0.01, 1.035, z0 + 0.085));
    add('steel', box(hx - 0.012, 0.86, z0 + 0.045, hx + 0.012, 0.9, z0 + 0.06));
    place('door', 'Door' + i, bbox(cx - dw / 2, 0, z0, cx + dw / 2, dh, z0 + 0.05));
  }

  /* ---------------- wall graphics ---------------- */
  {
    // original abstract framed artwork on the back wall
    const ax = 0.5, ay = 1.42, aw = 0.74, ah = 1.28, z0 = zB;
    add('gym.metalDark', box(ax - aw / 2, ay - ah / 2, z0, ax + aw / 2, ay + ah / 2, z0 + 0.035));
    const a = new THREE.PlaneGeometry(aw - 0.05, ah - 0.05); a.translate(ax, ay, z0 + 0.037); add('gym.art', a);
    place('art', 'Art', bbox(ax - aw / 2, ay - ah / 2, z0, ax + aw / 2, ay + ah / 2, z0 + 0.04), null);
    // original "YOGA" graphic panel on the right wall
    const z0y = -3.9, z1y = -1.3, y0 = 0.8, y1 = 2.3;
    const y = new THREE.PlaneGeometry(z1y - z0y, y1 - y0); y.rotateY(-Math.PI / 2); y.translate(xR - 0.004, (y0 + y1) / 2, (z0y + z1y) / 2);
    add('gym.yoga', y);
    place('art', 'YogaGraphic', bbox(xR - 0.01, y0, z0y, xR, y1, z1y), null);
  }

  /* ---------------- equipment ---------------- */
  // treadmill (long axis along x, console at the -x end), against the back wall
  {
    const cx = -1.0, cz = -4.25, L = 1.75, Wd = 0.74;
    add('gym.metalDark', box(cx - L / 2, 0.03, cz - Wd / 2, cx + L / 2, 0.2, cz + Wd / 2));
    add('gym.rubber', box(cx - L / 2 + 0.25, 0.2, cz - Wd / 2 + 0.11, cx + L / 2 - 0.08, 0.212, cz + Wd / 2 - 0.11));
    for (const fx of [cx - L / 2 + 0.08, cx + L / 2 - 0.08]) for (const fz of [cz - Wd / 2 + 0.06, cz + Wd / 2 - 0.06]) add('gym.rubber', box(fx - 0.04, 0, fz - 0.04, fx + 0.04, 0.03, fz + 0.04));
    for (const sz of [-1, 1]) {                       // swept uprights
      const up = box(-0.035, 0, -0.03, 0.035, 1.12, 0.03);
      add('gym.metalDark', up, M4([cx - L / 2 + 0.2, 0.15, cz + sz * (Wd / 2 - 0.05)], [0, 0, 0.32]));
    }
    add('gym.metalDark', box(cx - L / 2 - 0.22, 1.18, cz - 0.36, cx - L / 2 + 0.08, 1.26, cz + 0.36), M4([0, 0, 0], 0));
    add('gym.rubber', box(cx - L / 2 - 0.2, 1.255, cz - 0.2, cx - L / 2 + 0.04, 1.27, cz + 0.2));
    add('steel', cyl(0.016, 0.016, 0.72, 10), M4([cx - L / 2 + 0.1, 1.05, cz], [Math.PI / 2, 0, 0]));
    place('equipment', 'Treadmill', bbox(cx - L / 2 - 0.22, 0, cz - Wd / 2, cx + L / 2, 1.27, cz + Wd / 2));
    shadowDecal(cx - 0.1, cz, L + 0.2, Wd);
  }
  // exercise bike (side-on), left of the treadmill
  {
    const cx = -3.0, cz = -3.95;
    add('gym.metalDark', box(cx - 0.5, 0, cz - 0.04, cx + 0.5, 0.06, cz + 0.04));
    add('gym.metalDark', box(cx - 0.5, 0, cz - 0.24, cx - 0.42, 0.05, cz + 0.24));
    add('gym.metalDark', box(cx + 0.42, 0, cz - 0.24, cx + 0.5, 0.05, cz + 0.24));
    add('gym.metalDark', box(-0.035, 0, -0.035, 0.035, 0.85, 0.035), M4([cx + 0.1, 0.05, cz], [0, 0, 0.42]));   // main tube
    add('gym.metalDark', box(-0.03, 0, -0.03, 0.03, 0.8, 0.03), M4([cx + 0.3, 0.05, cz], [0, 0, -0.28]));      // seat post
    add('gym.rubber', box(cx + 0.36, 0.83, cz - 0.09, cx + 0.6, 0.88, cz + 0.09));                              // seat
    add('gym.metalDark', cyl(0.24, 0.24, 0.07, 28), M4([cx - 0.28, 0.32, cz], [Math.PI / 2, 0, 0]));          // flywheel
    add('steel', cyl(0.05, 0.05, 0.09, 16), M4([cx - 0.28, 0.32, cz], [Math.PI / 2, 0, 0]));
    add('gym.metalDark', box(cx - 0.3, 1.05, cz - 0.24, cx - 0.22, 1.09, cz + 0.24));                           // bars
    add('gym.rubber', box(cx - 0.35, 1.06, cz - 0.08, cx - 0.2, 1.16, cz + 0.08));                              // console
    place('equipment', 'Bike', bbox(cx - 0.5, 0, cz - 0.24, cx + 0.6, 1.16, cz + 0.24));
    shadowDecal(cx + 0.05, cz, 1.1, 0.48);
  }
  // dumbbell tower rack
  {
    const cx = 1.25, cz = -4.45;
    add('gym.metalDark', box(cx - 0.2, 0, cz - 0.2, cx + 0.2, 0.03, cz + 0.2));
    add('gym.metalDark', box(cx - 0.04, 0.03, cz - 0.04, cx + 0.04, 1.0, cz + 0.04));
    for (let i = 0; i < 5; i++) {
      const y = 0.22 + i * 0.17, r = 0.07 - i * 0.008;
      add('gym.metalDark', box(cx - 0.17, y - 0.08, cz - 0.015, cx + 0.17, y - 0.065, cz + 0.015));
      for (const sx of [-1, 1]) {
        const hx = cx + sx * 0.11;
        add('steel', cyl(0.014, 0.014, 0.26, 8), M4([hx, y, cz], [Math.PI / 2, 0, 0]));
        for (const sz of [-1, 1]) add('gym.rubber', cyl(r, r, 0.07, 6), M4([hx, y, cz + sz * 0.13], [Math.PI / 2, 0, 0]));
      }
    }
    place('equipment', 'DumbbellRack', bbox(cx - 0.2, 0, cz - 0.2, cx + 0.2, 1.0, cz + 0.2));
    shadowDecal(cx, cz, 0.4, 0.4);
  }

  /* ---------------- mats, blocks, bottles ---------------- */
  {
    const mats4 = [[-1.75, -3.0], [0.95, -3.0], [-1.75, -0.85], [0.95, -0.85]];
    mats4.forEach(([x, z], i) => { shadowDecal(x, z, 1.83, 0.61); add('gym.matNavy', box(x - 0.915, 0, z - 0.305, x + 0.915, 0.006, z + 0.305)); place('mat', 'Mat' + (i + 1), bbox(x - 0.915, 0, z - 0.305, x + 0.915, 0.006, z + 0.305)); });
    shadowDecal(-1.145, -1.945, 1.83, 0.61);
    add('gym.matGrey', box(-2.06, 0, -2.25, -0.23, 0.006, -1.64));
    shadowDecal(1.3, -2.0, 0.6, 0.4); shadowDecal(1.85, -2.0, 0.15, 0.61); shadowDecal(0.0, -4.3, 0.6, 0.22); place('mat', 'MatGrey', bbox(-2.06, 0, -2.25, -0.23, 0.006, -1.64));
    add('gym.matNavy', box(1.0, 0, -2.2, 1.6, 0.012, -1.8));                                                   // folded mat
    add('gym.matNavy', cyl(0.075, 0.075, 0.61, 16), M4([1.85, 0.075, -2.0], [Math.PI / 2, 0, 0]));            // rolled mat
    add('gym.matNavy', cyl(0.11, 0.11, 0.6, 18), M4([0.0, 0.11, -4.3], [0, 0, Math.PI / 2]));               // bolster
    place('mat', 'Rolls', bbox(1.0, 0, -2.31, 1.93, 0.15, -1.69));
    shadowDecal(0.08, -0.2, 0.18, 0.18);
    for (const [x, z, r] of [[-0.45, -0.35, 0.3], [0.55, -0.4, -0.2]]) { shadowDecal(x, z, 0.23, 0.15, r); add('gym.rubber', box(-0.115, 0, -0.075, 0.115, 0.08, 0.075), M4([x, 0, z], r)); }
    add('gym.rubber', new THREE.TorusGeometry(0.07, 0.022, 8, 20), M4([0.08, 0.022, -0.2], [Math.PI / 2, 0, 0]));
    for (const [x, z] of [[-1.15, -3.62], [1.35, -1.78], [2.0, -2.3]]) {
      add('steel', cyl(0.035, 0.035, 0.23, 14), M4([x, 0.115, z]));
      add('gym.metalDark', cyl(0.025, 0.03, 0.04, 12), M4([x, 0.25, z]));
      shadowDecal(x, z, 0.08, 0.08);
    }
    place('prop', 'Blocks', bbox(-0.57, 0, -0.5, 0.67, 0.08, -0.2));
  }

  /* ---------------- perforated cylinder lamps ---------------- */
  {
    const lamps = [[2.3, -4.45, 0.95, 0.1, false], [2.2, -0.4, 0.62, 0.11, true], [3.35, -4.35, 0.75, 0.09, false]];
    lamps.forEach(([x, z, h, r, stand], i) => {
      const base = stand ? 0.28 : 0.04;
      if (stand) {
        add('gym.metalDark', new THREE.TorusGeometry(r * 0.9, 0.008, 6, 20), M4([x, base, z], [Math.PI / 2, 0, 0]));
        for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; add('gym.metalDark', box(-0.008, 0, -0.008, 0.008, base, 0.008), M4([x + Math.cos(a) * r * 0.9, 0, z + Math.sin(a) * r * 0.9])); }
      } else add('gym.metalDark', cyl(r * 0.85, r * 0.9, 0.04, 20), M4([x, 0.02, z]));
      const sh = cyl(r, r, h, 24, true); uvFrom(sh, (px, py, pz) => [(Math.atan2(pz, px) / (Math.PI * 2) + 0.5) * 3, py * 3]);
      add('gym.lampShade', sh, M4([x, base + h / 2, z]));
      add('gym.led', new THREE.CircleGeometry(r * 0.96, 20), (() => { const m = M4([x, base + h - 0.02, z], [-Math.PI / 2, 0, 0]); return m; })());
      place('lamp', 'Lamp' + (i + 1), bbox(x - r, 0, z - r, x + r, base + h, z + r));
      shadowDecal(x, z, r * 2, r * 2);
    });
  }

  /* ---------------- plants (pots + procedural leaves with vertex colours) ---------------- */
  {
    const leafGeo = (len, wid, droop, seg = 6) => {
      const pos = [], idx = [];
      for (let i = 0; i <= seg; i++) {
        const tt = i / seg, w = Math.sin(Math.PI * Math.min(1, tt * 1.15)) * wid * 0.5 + 0.002, y = -droop * tt * tt * len, zz = tt * len;
        pos.push(-w, y, zz, 0, y + w * 0.25, zz, w, y, zz);
        if (i) { const a = (i - 1) * 3, b = i * 3; idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
      return g;
    };
    const tint = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
    const green = (h, s, l) => new THREE.Color().setHSL(h, s, l);
    const leafParts = [];
    const potParts = (x, z, r, h, raise = 0) => {
      if (raise) { add('gym.metalDark', new THREE.TorusGeometry(r * 0.95, 0.008, 6, 20), M4([x, raise, z], [Math.PI / 2, 0, 0])); for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.4; add('gym.metalDark', box(-0.008, 0, -0.008, 0.008, raise, 0.008), M4([x + Math.cos(a) * r * 0.95, 0, z + Math.sin(a) * r * 0.95])); } }
      add('gym.pot', cyl(r, r * 0.8, h, 20), M4([x, raise + h / 2, z]));
      add('gym.rubber', cyl(r * 0.92, r * 0.92, 0.01, 16), M4([x, raise + h - 0.02, z]));
      shadowDecal(x, z, r * 2, r * 2);
      return raise + h - 0.02;
    };
    // areca-like palm: arching stalks with paired leaflets
    const palm = (x, z, height, potR, potH, raise, id) => {
      const top = potParts(x, z, potR, potH, raise);
      const stalks = 9;
      for (let s = 0; s < stalks; s++) {
        const yaw = (s / stalks) * Math.PI * 2 + rng.range(-0.3, 0.3), pitch = rng.range(0.25, 0.75), len = height * rng.range(0.55, 0.85);
        const stem = cyl(0.006, 0.01, len, 5); stem.translate(0, len / 2, 0);
        const sm = new THREE.Matrix4().makeRotationY(yaw).multiply(new THREE.Matrix4().makeRotationX(pitch * 0.35));
        leafParts.push({ geometry: tint(stem, green(0.18, 0.4, 0.35)), matrix: new THREE.Matrix4().makeTranslation(x, top, z).multiply(sm) });
        for (let k = 3; k < 12; k++) {
          const tt = k / 12, ly = len * tt;
          for (const side of [-1, 1]) {
            const g = tint(leafGeo(0.32 * (1 - tt * 0.5), 0.035, 0.35), green(0.27 + rng.range(-0.02, 0.02), 0.45, 0.22 + rng.range(0, 0.08)));
            const m = new THREE.Matrix4().makeTranslation(x, top, z).multiply(sm).multiply(new THREE.Matrix4().makeTranslation(0, ly, 0))
              .multiply(new THREE.Matrix4().makeRotationY(side * 1.25)).multiply(new THREE.Matrix4().makeRotationX(-0.5 - tt * 0.4));
            leafParts.push({ geometry: g, matrix: m });
          }
        }
      }
      place('plant', id, bbox(x - height * 0.45, 0, z - height * 0.45, x + height * 0.45, top + height, z + height * 0.45));
    };
    // broadleaf: a few large leaves on stems
    const broad = (x, z, height, potR, potH, raise, id) => {
      const top = potParts(x, z, potR, potH, raise);
      const n = 9;
      for (let s = 0; s < n; s++) {
        const yaw = (s / n) * Math.PI * 2 + rng.range(-0.25, 0.25), h = height * rng.range(0.45, 0.9);
        const g = tint(leafGeo(height * 0.42, height * 0.17, 0.25, 7), green(0.28 + rng.range(-0.02, 0.02), 0.5, 0.2 + rng.range(0, 0.07)));
        const m = new THREE.Matrix4().makeTranslation(x, top + h * 0.6, z).multiply(new THREE.Matrix4().makeRotationY(yaw)).multiply(new THREE.Matrix4().makeRotationX(-0.75 + rng.range(-0.2, 0.2)));
        leafParts.push({ geometry: g, matrix: m });
        const st = cyl(0.006, 0.008, h * 0.6, 5); st.translate(0, h * 0.3, 0);
        leafParts.push({ geometry: tint(st, green(0.2, 0.35, 0.3)), matrix: new THREE.Matrix4().makeTranslation(x, top, z).multiply(new THREE.Matrix4().makeRotationY(yaw)).multiply(new THREE.Matrix4().makeRotationX(0.25)) });
      }
      place('plant', id, bbox(x - height * 0.4, 0, z - height * 0.4, x + height * 0.4, top + height, z + height * 0.4));
    };
    palm(-2.85, 0.4, 1.45, 0.2, 0.32, 0, 'PalmFrontLeft');
    broad(-2.55, -1.05, 0.7, 0.13, 0.2, 0.32, 'FernLeft');
    broad(-2.55, -4.45, 0.95, 0.15, 0.28, 0, 'PlantBackLeft');
    broad(0.42, -4.45, 0.55, 0.1, 0.16, 0.36, 'PlantCentre');
    broad(1.85, -4.45, 0.55, 0.11, 0.24, 0, 'PlantRack');
    palm(2.95, -4.2, 1.35, 0.17, 0.3, 0, 'PalmBackRight');
    palm(3.2, 0.35, 1.25, 0.17, 0.3, 0, 'PalmFrontRight');
    const lm = util.mesh(util.mergeParts(leafParts), mats['gym.leaf'], { name: 'Gym_Leaves', castShadow: false, receiveShadow: false });
    group.add(lm);
  }

  /* ---------------- merge per material ---------------- */
  for (const [name, list] of Object.entries(parts)) {
    const g = util.mergeParts(list);
    if (name === 'gym.wallSide') uvFrom(g, (x, y, z) => [(z - zB) / D, y / H]);
    if (name === 'gym.wallBack') uvFrom(g, (x, y, z) => [(x - xL) / W, y / H]);
    if (name === 'gym.ceiling') uvFrom(g, (x, y, z) => [(x - xL) / W, (z - zB) / D]);
    const m = meshOf(name, g);
    if (name === 'gym.contactShadow') m.renderOrder = 1;
  }
  void rng;
  return { group };
}
