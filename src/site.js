// Site module: ground, plot paving, roads/kerbs/footpaths (+ atlas markings), compound wall and railings, the two
// gate pavilions, context neighbours, street/drive lamps and the parking strip.
// Contract: export async function build(ctx) -> { group, update?(f), onTimeOfDay?(k, state), dispose?() }
import { GATE_LEAF } from './materials/site.js';

export async function build(ctx) {
  const { THREE, SPEC, util, registry, tier } = ctx;
  const S = SPEC.site, RL = SPEC.global.roadLevel, low = tier.name === 'low';
  const group = new THREE.Group(); group.name = 'Module_site';
  const rng = ctx.rng('site');

  const names = ['site.paving', 'site.footpath', 'site.road', 'site.lawn', 'kerb', 'plaster', 'trim', 'iron', 'site.facade',
    'roofDeck', 'site.vcol', 'site.gateIron', 'site.goldLetters', 'site.lampHead', 'site.halo', 'site.lightPool', 'site.drive', 'site.scrub'];
  const mats = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await ctx.M.use(n)])));

  /* ----------------------------- helpers ----------------------------- */
  const parts = { plaster: [], trim: [], kerb: [], vcol: [], lampHead: [], facade: [], roof: [] };
  const B = (x0, y0, z0, x1, y1, z1) => util.boxMinMax(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1));
  const plane = (x0, x1, z0, z1, y) => new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const lin = (hex) => new THREE.Color(hex);
  const paint = (geo, hex) => {
    const c = lin(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
  };
  const constUV = (geo, u, v) => { const n = geo.attributes.position.count, a = new Float32Array(n * 2); for (let i = 0; i < n; i++) { a[i * 2] = u; a[i * 2 + 1] = v; } geo.setAttribute('uv', new THREE.BufferAttribute(a, 2)); return geo; };
  const place = (kind, id, obj, supportY = 0) => {
    const b = obj.isBox3 ? obj : new THREE.Box3().setFromObject(obj);
    registry.place({ kind, id, bbox: b, supportY, module: 'site' });
  };
  const add = (geo, mat, name, { cast = true, receive = true } = {}) => { const m = util.mesh(geo, mat, { name, castShadow: cast, receiveShadow: receive }); group.add(m); return m; };
  const merged = (list, mat, name, opts, uvTile) => (list.length ? add(util.mergeParts(list, { uvTile }), mat, name, opts) : null);

  /* ----------------------------- ground ----------------------------- */
  const Wd = S.world, Pl = S.plot;
  const roadsZ = S.roads.map((r) => r.z), fps = S.footpaths;
  const southMost = Math.max(...fps.map((f) => f.z[1]), ...roadsZ.map((z) => z[1]));
  const northMost = Math.min(...fps.map((f) => f.z[0]), ...roadsZ.map((z) => z[0]));
  const frontFpN = fps.find((f) => f.id === 'frontFpN'), northRoad = S.roads.find((r) => r.id === 'northRoad');
  const bandZ0 = northRoad ? northRoad.z[1] : Pl.z[0], bandZ1 = frontFpN ? frontFpN.z[0] : Pl.z[1];
  const lawnGeos = [
    plane(Wd.x[0], Wd.x[1], Wd.z[0], northMost, 0),
    plane(Wd.x[0], Wd.x[1], southMost, Wd.z[1], 0),
    plane(Wd.x[0], Pl.x[0], bandZ0, bandZ1, 0),
    plane(Pl.x[1], Wd.x[1], bandZ0, bandZ1, 0),
  ];
  add(util.mergeParts(lawnGeos.map((g) => ({ geometry: g })), { uvTile: 8 }), mats['site.lawn'], 'Site/Ground/Lawn', { cast: false });
  // plot paving (everything inside the plot; amenities/towers sit on top)
  add(util.worldUV(plane(Pl.x[0], Pl.x[1], Pl.z[0], Pl.z[1], 0), 2), mats['site.paving'], 'Site/Ground/Paving', { cast: false });
  // vehicle drive loop (darker concrete over the pavers): both gate lanes, the cross aisle between the towers, the
  // north aisle behind Tower R and the parking aisle. Rects [x0, x1, z0, z1]; clear of the towers, pool and clubhouse.
  const driveRects = [
    [-19.0, -12.6, -4.0, 41.4], [17.6, 23.4, -38.0, 41.4],            // west / east gate lanes
    [-49.6, 23.4, -4.0, 3.5], [-49.6, 23.4, -38.0, -31.0],          // cross aisle, north aisle
    [-49.6, -46.0, -38.0, 10.0],                                        // parking aisle
  ];
  add(util.mergeParts(driveRects.map(([x0, x1, z0, z1]) => ({ geometry: plane(x0, x1, z0, z1, 0.003) })), { uvTile: 4 }), mats['site.drive'], 'Site/Ground/Drive', { cast: false });
  // roads at roadLevel
  add(util.mergeParts(S.roads.map((r) => ({ geometry: plane(r.x[0], r.x[1], r.z[0], r.z[1], RL) })), { uvTile: 4 }), mats['site.road'], 'Site/Roads/Asphalt', { cast: false });
  // footpaths (outside the plot) + kerb stones along every road edge
  const KW = 0.25;
  const fpGeos = [];
  for (const f of fps) {
    if (f.outsidePlot === false) continue;                 // inside the plot: already paved
    const touchesN = roadsZ.some((z) => Math.abs(z[1] - f.z[0]) < 0.01), touchesS = roadsZ.some((z) => Math.abs(z[0] - f.z[1]) < 0.01);
    fpGeos.push({ geometry: plane(f.x[0], f.x[1], f.z[0] + (touchesN ? KW : 0), f.z[1] - (touchesS ? KW : 0), 0) });
  }
  if (fpGeos.length) add(util.mergeParts(fpGeos, { uvTile: 1.2 }), mats['site.footpath'], 'Site/Ground/Footpaths', { cast: false });
  for (const r of S.roads) {
    // top 2 mm below 0 so the kerb never z-fights the plot paving / lawn where it runs underneath them
    parts.kerb.push({ geometry: B(r.x[0], RL, r.z[0] - KW, r.x[1], -0.002, r.z[0]) });
    parts.kerb.push({ geometry: B(r.x[0], RL, r.z[1], r.x[1], -0.002, r.z[1] + KW) });
  }

  /* ----------------------------- parking strip ----------------------------- */
  for (const pk of S.parking) {
    const sx0 = pk.x[0] + 0.3;
    for (let z = pk.z[0] + 1.25; z < pk.z[1]; z += 2.5) parts.kerb.push({ geometry: B(sx0 + 0.45, 0, z - 0.8, sx0 + 0.6, 0.12, z + 0.8) });   // wheel stops
    registry.place({ kind: 'parking', id: 'Site/Parking/' + pk.id, bbox: { min: [pk.x[0], 0, pk.z[0]], max: [pk.x[1], 0.12, pk.z[1]] }, supportY: 0, module: 'site' });
  }

  /* ----------------------------- compound wall ----------------------------- */
  const WF = S.wall.front, WS = S.wall.sides, T = 0.3;            // wall thickness
  const gateSpans = S.gates.map((g) => [g.c[0] - g.w / 2, g.c[0] + g.w / 2]);
  // segments: {a:[x,z], b:[x,z], kind:'front'|'side', out:[nx,nz]}; wall centreline is T/2 inside the boundary
  const segs = [];
  const fz = Pl.z[1] - T / 2, rz = Pl.z[0] + T / 2, wx = Pl.x[0] + T / 2, ex = Pl.x[1] - T / 2;
  { // front: split by gate openings
    let x = wx; const spans = [...gateSpans].sort((a, b) => a[0] - b[0]);
    for (const [g0, g1] of spans) { if (g0 > x) segs.push({ a: [x, fz], b: [g0, fz], kind: 'front' }); x = g1; }
    if (ex > x) segs.push({ a: [x, fz], b: [ex, fz], kind: 'front' });
  }
  segs.push({ a: [wx, rz], b: [ex, rz], kind: 'side' }, { a: [wx, rz], b: [wx, fz], kind: 'side' }, { a: [ex, rz], b: [ex, fz], kind: 'side' });

  const pierMat = { front: [], side: [] }, pierIds = { front: [], side: [] }, seen = new Set();
  const barMats = [], barStep = low ? 0.25 : 0.14;
  for (const s of segs) {
    const W = s.kind === 'front' ? WF : WS;
    const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    const n = Math.max(1, Math.round(L / W.spacing)), step = L / n;
    const along = Math.abs(ux) > 0.5;                              // runs along x
    for (let i = 0; i <= n; i++) {
      const px = s.a[0] + ux * step * i, pz = s.a[1] + uz * step * i, key = px.toFixed(2) + ',' + pz.toFixed(2);
      // the pier next to a gate pavilion is replaced by the pavilion itself
      if (s.kind === 'front' && gateSpans.some(([g0, g1]) => Math.abs(px - g0) < 0.3 || Math.abs(px - g1) < 0.3)) continue;
      if (seen.has(key)) continue; seen.add(key);
      pierMat[s.kind].push(util.mat([px, 0, pz], 0, [1, W.pierH, 1]));
      pierIds[s.kind].push(`Site/Wall/Pier_${s.kind}_${pierMat[s.kind].length - 1}`);
    }
    // plinth (whole run) + infill per bay
    const half = W.pierSize / 2;
    const x0 = along ? s.a[0] : s.a[0] - T / 2, x1 = along ? s.b[0] : s.a[0] + T / 2;
    const z0 = along ? s.a[1] - T / 2 : s.a[1], z1 = along ? s.a[1] + T / 2 : s.b[1];
    parts.plaster.push({ geometry: B(x0, 0, z0, x1, W.plinthH, z1) });
    parts.trim.push({ geometry: along ? B(x0, W.plinthH, z0 - 0.04, x1, W.plinthH + 0.06, z1 + 0.04) : B(x0 - 0.04, W.plinthH, z0, x1 + 0.04, W.plinthH + 0.06, z1) });
    for (let i = 0; i < n; i++) {
      const t0 = step * i + half, t1 = step * (i + 1) - half;
      const P0 = [s.a[0] + ux * t0, s.a[1] + uz * t0], P1 = [s.a[0] + ux * t1, s.a[1] + uz * t1];
      const rail = (y0, y1, th) => (along ? B(P0[0], y0, P0[1] - th / 2, P1[0], y1, P0[1] + th / 2) : B(P0[0] - th / 2, y0, P0[1], P0[0] + th / 2, y1, P1[1]));
      if (s.kind === 'front') {
        const yb = W.plinthH + 0.06, yt = W.pierH - 0.2;
        parts.trim.push({ geometry: rail(yt, yt + 0.08, 0.2) }, { geometry: rail(yb + 0.1, yb + 0.17, 0.12) });
        const nb = Math.max(2, Math.round((t1 - t0) / 0.24));
        for (let k = 1; k < nb; k++) {
          const t = t0 + (t1 - t0) * k / nb, bx = s.a[0] + ux * t, bz = s.a[1] + uz * t;
          parts.trim.push({ geometry: B(bx - 0.035, yb + 0.17, bz - 0.035, bx + 0.035, yt, bz + 0.035) });
        }
      } else {
        const yb = W.plinthH + 0.06, yt = W.pierH - 0.15;
        parts.vcol.push({ geometry: paint(rail(yb + 0.08, yb + 0.13, 0.04), '#1A1A1A') }, { geometry: paint(rail(yt - 0.1, yt - 0.05, 0.04), '#1A1A1A') });
        const nb = Math.max(2, Math.round((t1 - t0) / barStep));
        for (let k = 1; k < nb; k++) {
          const t = t0 + (t1 - t0) * k / nb;
          barMats.push(util.mat([s.a[0] + ux * t, yb, s.a[1] + uz * t], 0, [1, yt + 0.12 - yb, 1]));
        }
      }
    }
  }
  // pier prototype (unit height; caps scale a little with height which is fine at 1.5 vs 1.8 m)
  const pierGeo = (() => {
    const p = [
      { geometry: B(-0.3, 0, -0.3, 0.3, 0.12, 0.3) }, { geometry: B(-0.25, 0.12, -0.25, 0.25, 0.9, 0.25) },
      { geometry: B(-0.31, 0.9, -0.31, 0.31, 0.95, 0.31) }, { geometry: B(-0.27, 0.95, -0.27, 0.27, 1.0, 0.27) },
    ];
    return util.mergeParts(p, { uvTile: 2 });
  })();
  for (const k of ['front', 'side']) {
    if (!pierMat[k].length) continue;
    const im = util.instanced(pierGeo, mats.trim, pierMat[k], { ids: pierIds[k], name: `Site/Wall/Piers_${k}` });
    group.add(im);
  }
  if (barMats.length) {
    const barGeo = B(-0.011, 0, -0.011, 0.011, 1, 0.011);
    group.add(util.instanced(barGeo, mats.iron, barMats, { name: 'Site/Wall/Bars', castShadow: true }));
  }
  registry.place({ kind: 'wall', id: 'Site/Wall', bbox: { min: [Pl.x[0], 0, Pl.z[0]], max: [Pl.x[1], WS.pierH, Pl.z[1]] }, supportY: 0, module: 'site' });

  /* ----------------------------- gate pavilions ----------------------------- */
  const gateLeafGeos = [], letterGeos = [];
  const tan15 = (deg) => Math.tan((deg * Math.PI) / 180);
  for (const gt of S.gates) {
    const M4 = util.mat([gt.c[0], 0, gt.c[1]], 0);
    const L = (list, geo) => list.push({ geometry: geo, matrix: M4 });
    const hw = gt.w / 2, hc = gt.clear / 2, hd = gt.d / 2, soff = gt.soffit;
    const pierW = Math.min(1.25, (hw - hc) * 0.4);
    for (const s of [-1, 1]) {
      const xo = s * hw, xp = s * (hw - pierW), xi = s * hc;
      // square pier with base, capital band and a sunk panel line
      L(parts.trim, B(xo + s * 0.08, 0, -hd, xp - s * 0.08, 0.7, hd));
      L(parts.plaster, B(xo, 0.7, -hd + 0.1, xp, soff, hd - 0.1));
      L(parts.trim, B(xo + s * 0.06, soff - 0.45, -hd + 0.04, xp - s * 0.06, soff - 0.3, hd - 0.04));
      L(parts.trim, B(xo - s * 0.12, 2.2, hd - 0.1, xp + s * 0.12, 2.3, hd - 0.04));          // front panel mould
      L(parts.trim, B(xo - s * 0.12, 2.2, -hd + 0.04, xp + s * 0.12, 2.3, -hd + 0.1));
      // backing wall between the pier and the opening
      const bw = 1.2;
      L(parts.plaster, B(xp, 0, -bw, xi, soff, bw));
      // two round engaged columns per face (front and back), with bases and capitals
      const cr = 0.32, cxs = [xi + s * (cr + 0.06), xi + s * (3 * cr + 0.22)];
      for (const fz of [1, -1]) for (const cx of cxs) {
        const cz = fz * (bw + cr * 0.55);
        L(parts.trim, B(cx - 0.38, 0, cz - 0.38, cx + 0.38, 0.55, cz + 0.38));
        L(parts.trim, new THREE.CylinderGeometry(cr * 1.12, cr * 1.12, 0.12, 16).translate(cx, 0.61, cz));
        L(parts.plaster, new THREE.CylinderGeometry(cr * 0.92, cr, soff - 1.17, 16).translate(cx, 0.67 + (soff - 1.17) / 2, cz));
        L(parts.trim, new THREE.CylinderGeometry(cr * 1.15, cr * 0.95, 0.18, 16).translate(cx, soff - 0.41, cz));
        L(parts.trim, B(cx - 0.37, soff - 0.32, cz - 0.37, cx + 0.37, soff, cz + 0.37));
      }
    }
    // entablature: architrave, frieze, cornice (projecting in two steps)
    const yA = soff + 0.18, yF = yA + 0.16, yC = yF + 0.1, yC2 = yC + 0.08;
    L(parts.trim, B(-hw - 0.05, soff, -hd - 0.05, hw + 0.05, yA, hd + 0.05));
    L(parts.plaster, B(-hw + 0.02, yA, -hd + 0.02, hw - 0.02, yF, hd - 0.02));
    L(parts.trim, B(-hw - 0.15, yF, -hd - 0.15, hw + 0.15, yC, hd + 0.15));
    L(parts.trim, B(-hw - 0.3, yC, -hd - 0.3, hw + 0.3, yC2, hd + 0.3));
    // pediment (15 deg): tympanum prism + raking cornices running the full depth (they form the roof)
    const hs = hw - 0.45, rise = hs * tan15(gt.pedimentPitchDeg), base = yC2;
    const tri = new THREE.Shape([new THREE.Vector2(-hs, 0), new THREE.Vector2(hs, 0), new THREE.Vector2(0, rise)]);
    const tymp = new THREE.ExtrudeGeometry(tri, { depth: 2 * hd - 0.2, bevelEnabled: false }).translate(0, base, -hd + 0.1);
    L(parts.plaster, tymp);
    const rk = 0.16, ang = Math.atan2(rise, hs), slen = Math.hypot(hs, rise) + 0.36;
    for (const s of [-1, 1]) {
      const g = B(-slen / 2, 0, -hd - 0.32, slen / 2, rk, hd + 0.32).rotateZ(s * -ang).translate(s * (hs / 2 + 0.05), base + rise / 2 + 0.02, 0);
      L(parts.trim, g);
    }
    // akroteria blocks at the pediment ends
    for (const s of [-1, 1]) L(parts.trim, B(s * hs - 0.18, base, hd - 0.1, s * hs + 0.18, base + 0.24, hd + 0.3));
    // name plate + gold letters on the front tympanum
    const pw = Math.min(5.6, hs * 1.05), ph = Math.min(0.5, rise * 0.36), py = base + rise * 0.27, zf = hd - 0.1;
    L(parts.trim, B(-pw / 2, py - ph / 2, zf, pw / 2, py + ph / 2, zf + 0.04));
    const lw = pw * 1.0, lh = lw / 8;
    letterGeos.push({ geometry: new THREE.PlaneGeometry(lw, lh).translate(0, py, zf + 0.045), matrix: M4 });
    // wrought-iron double leaves (one alpha-tested panel filling the clear opening, at mid depth)
    const sc = (2 * hc) / GATE_LEAF.w;
    gateLeafGeos.push({ geometry: new THREE.PlaneGeometry(GATE_LEAF.w * sc, GATE_LEAF.h).translate(0, GATE_LEAF.h / 2 + 0.02, 0), matrix: M4 });
    const bbox = new THREE.Box3(new THREE.Vector3(gt.c[0] - hw - 0.3, 0, gt.c[1] - hd - 0.32), new THREE.Vector3(gt.c[0] + hw + 0.3, base + rise + 0.3, gt.c[1] + hd + 0.32));
    registry.place({ kind: 'gate', id: 'Site/Gate/' + gt.id, bbox, supportY: 0, module: 'site', meta: { apex: +(base + rise + rk / Math.cos(ang)).toFixed(2) } });
  }
  if (gateLeafGeos.length) add(util.mergeParts(gateLeafGeos), mats['site.gateIron'], 'Site/Gate/Leaves', { cast: true });
  if (letterGeos.length) add(util.mergeParts(letterGeos), mats['site.goldLetters'], 'Site/Gate/Letters', { cast: false });

  /* ----------------------------- context neighbours ----------------------------- */
  const crng = ctx.rng('site-context');
  const quad = (p0, p1, h, u0, u1, v1, col) => {
    // vertical wall quad from p0 to p1 (outward normal = right-hand of p0->p1 seen from above), height h.
    // Split at 2.4 m: vertex colour darkens toward the ground (splash grime / ground AO) and slightly under the parapet.
    const g = new THREE.BufferGeometry();
    const ys = [0, Math.min(2.4, h * 0.3), h - 0.6, h], vs = ys.map((y) => (v1 * y) / h), ks = [0.74, 0.97, 1.0, 0.9];
    const dx = p1[0] - p0[0], dz = p1[1] - p0[1], l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l;
    const pos = [], nor = [], uv = [], colA = [], idx = [], c = lin(col);
    ys.forEach((y, i) => {
      pos.push(p0[0], y, p0[1], p1[0], y, p1[1]); nor.push(nx, 0, nz, nx, 0, nz); uv.push(u0, vs[i], u1, vs[i]);
      for (let k = 0; k < 2; k++) colA.push(c.r * ks[i], c.g * ks[i], c.b * ks[i]);
      if (i) { const a = (i - 1) * 2, b = i * 2; idx.push(a, a + 1, b + 1, a, b + 1, b); }
    });
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3));
    g.setIndex(idx);
    return g;
  };
  // varied neighbour tints: off-whites, pale pastels, light greys (positions/footprints stay from SPEC)
  const trng = ctx.rng('site-context-tint');
  const TINTS = ['#ECE6DA', '#E2D8C6', '#D7DAD6', '#E9D8C2', '#D3DCE0', '#E6D3C6', '#CDD2CA', '#EFE4CC', '#D9CCBC', '#C9CBCB', '#E3E0EF'];
  S.context.buildings.forEach(([x, z, w, d, floors0, col0], bi) => {
    const col = trng.chance(0.25) ? col0 : trng.pick(TINTS);
    const floors = Math.max(2, floors0 + trng.int(-1, 1));
    const H = floors * 3 + 0.3, x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    const dark = '#' + lin(col).multiplyScalar(0.62).getHexString();   // parapet-inside / roof-edge AO tone
    const corners = [[x0, z1], [x1, z1], [x1, z0], [x0, z0]];     // CCW seen from above: front (+z) first
    const uOff = crng.int(0, 3) / 4, vOff = crng.int(0, 3) / 4;
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4], len = Math.hypot(b[0] - a[0], b[1] - a[1]), bays = Math.max(1, Math.round(len / 3));
      parts.facade.push({ geometry: quad(a, b, H, uOff, uOff + bays / 4, vOff + floors / 4 + 0.1 / 12, col) });
    }
    const wallC = (g) => constUV(paint(g, col), 0.02, 0.02);
    // parapet ring, roof slab edge band
    const pt = 0.18, ph = 0.9;
    parts.facade.push({ geometry: wallC(B(x0 - 0.05, H, z0 - 0.05, x1 + 0.05, H + 0.18, z1 + 0.05)) });
    for (const g of [B(x0, H + 0.18, z0, x1, H + ph, z0 + pt), B(x0, H + 0.18, z1 - pt, x1, H + ph, z1), B(x0, H + 0.18, z0 + pt, x0 + pt, H + ph, z1 - pt), B(x1 - pt, H + 0.18, z0 + pt, x1, H + ph, z1 - pt)]) parts.facade.push({ geometry: wallC(g) });
    parts.roof.push({ geometry: plane(x0 + pt, x1 - pt, z0 + pt, z1 - pt, H + 0.18) });
    // parapet AO: a dark band on the roof hugging the inside of the parapet (reads at aerial distance)
    const ao = 0.6, yA = H + 0.185, yB = H + 0.2;
    for (const g of [B(x0 + pt, yA, z0 + pt, x1 - pt, yB, z0 + pt + ao), B(x0 + pt, yA, z1 - pt - ao, x1 - pt, yB, z1 - pt),
      B(x0 + pt, yA, z0 + pt + ao, x0 + pt + ao, yB, z1 - pt - ao), B(x1 - pt - ao, yA, z0 + pt + ao, x1 - pt, yB, z1 - pt - ao)]) parts.facade.push({ geometry: constUV(paint(g, dark), 0.02, 0.02) });
    // articulation: floor chajja bands (projecting slab edges) on some, a contrasting stair-core strip on the front
    if (crng.chance(0.6)) for (let f = 1; f <= floors; f++) {
      const y = f * 3 - 0.05, o = 0.35;
      parts.facade.push({ geometry: wallC(B(x0 - o, y, z0 - o, x1 + o, y + 0.12, z1 + o)) });
    }
    const accent = crng.pick(['#B9B4AA', '#C98E6A', '#9FA6AD', '#D9C7A0']), cw = 3.2, ccx = x + crng.range(-w / 2 + 2.5, w / 2 - 2.5);
    parts.facade.push({ geometry: constUV(paint(B(ccx - cw / 2, 0, z1 - 0.2, ccx + cw / 2, H + 1.4, z1 + 0.45), accent), 0.02, 0.02) });
    // stair mumty
    const mw = 3.2, md = 4, mx = x + crng.range(-w / 2 + 3, w / 2 - 3), mz = z + crng.range(-d / 2 + 3, d / 2 - 3);
    if (crng.chance(0.75)) parts.facade.push({ geometry: wallC(B(mx - mw / 2, H + 0.18, mz - md / 2, mx + mw / 2, H + 2.8, mz + md / 2)) });
    // black water tanks (on the mumty or the roof) and solar panels on some
    const tanks = crng.int(1, 3);
    for (let t = 0; t < tanks; t++) {
      const tx = x + crng.range(-w / 2 + 1.5, w / 2 - 1.5), tz = z + crng.range(-d / 2 + 1.5, d / 2 - 1.5);
      if (Math.abs(tx - mx) < mw / 2 + 0.8 && Math.abs(tz - mz) < md / 2 + 0.8) continue;
      parts.vcol.push({ geometry: paint(new THREE.CylinderGeometry(0.6, 0.62, 1.25, 12).translate(tx, H + 0.18 + 0.625, tz), crng.chance(0.7) ? '#1B1B1B' : '#E8E4D6') });
    }
    const solar = bi === 3 || crng.chance(0.3);
    if (solar) {
      const rows = 2, cols = Math.max(2, Math.floor((w - 4) / 1.2));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const sx = x0 + 2 + c * 1.15 + 0.55, sz = z0 + 2 + r * 2.2;
        if (Math.abs(sx - mx) < mw / 2 + 0.8 && Math.abs(sz - mz) < md / 2 + 1.2) continue;
        const g = B(-0.52, -0.02, -0.85, 0.52, 0.02, 0.85).rotateX(-0.3).translate(sx, H + 0.18 + 0.55, sz);
        parts.vcol.push({ geometry: paint(g, '#1E2B47') });
        parts.vcol.push({ geometry: paint(B(sx - 0.03, H + 0.18, sz - 0.6, sx + 0.03, H + 0.6, sz + 0.6), '#9A9C9E') });
      }
    }
    registry.place({ kind: 'context', id: `Site/Context/B${String(bi).padStart(2, '0')}`, bbox: { min: [x0 - 0.05, 0, z0 - 0.05], max: [x1 + 0.05, H + 2.8, z1 + 0.05] }, supportY: 0, module: 'site' });
  });

  /* ----------------------------- lamps ----------------------------- */
  const haloPts = [], pools = [];   // pools: [x, y, z, radius]
  const nearGate = (x) => S.gates.some((g) => Math.abs(x - g.c[0]) < g.w / 2 + 2.5) || S.zebras.some((z) => Math.abs(x - z.x) < z.width / 2 + 3);
  const streetLamp = (x, z, dir, id) => {      // dir: +1 arm toward +z, -1 toward -z
    const H = 8, col = '#3B3F43';
    parts.vcol.push({ geometry: paint(B(x - 0.16, 0, z - 0.16, x + 0.16, 0.5, z + 0.16), col) });
    parts.vcol.push({ geometry: paint(new THREE.CylinderGeometry(0.06, 0.09, H - 0.5, 8).translate(x, 0.5 + (H - 0.5) / 2, z), col) });
    parts.vcol.push({ geometry: paint(B(x - 0.04, H - 0.12, z, x + 0.04, H - 0.04, z + dir * 1.7), col) });
    parts.lampHead.push({ geometry: B(x - 0.16, H - 0.2, z + dir * 1.35, x + 0.16, H - 0.05, z + dir * 2.15) });
    haloPts.push([x, H - 0.3, z + dir * 1.75]);
    pools.push([x, RL + 0.004, z + dir * 2.6, 9]);
    registry.place({ kind: 'lamp', id, bbox: { min: [x - 0.16, 0, Math.min(z - 0.16, z + dir * 2.15)], max: [x + 0.16, H, Math.max(z + 0.16, z + dir * 2.15)] }, supportY: 0, module: 'site' });
  };
  const postLamp = (x, z, id) => {
    const H = 3.4, col = '#2C2F33';
    parts.vcol.push({ geometry: paint(B(x - 0.12, 0, z - 0.12, x + 0.12, 0.4, z + 0.12), col) });
    parts.vcol.push({ geometry: paint(new THREE.CylinderGeometry(0.045, 0.06, H - 0.4, 8).translate(x, 0.4 + (H - 0.4) / 2, z), col) });
    parts.lampHead.push({ geometry: B(x - 0.14, H, z - 0.14, x + 0.14, H + 0.42, z + 0.14) });
    parts.vcol.push({ geometry: paint(B(x - 0.2, H + 0.42, z - 0.2, x + 0.2, H + 0.5, z + 0.2), col) });
    haloPts.push([x, H + 0.22, z]);
    pools.push([x, 0.004, z, 5]);
    registry.place({ kind: 'lamp', id, bbox: { min: [x - 0.2, 0, z - 0.2], max: [x + 0.2, H + 0.5, z + 0.2] }, supportY: 0, module: 'site' });
  };
  let li = 0;
  const fr = S.roads.find((r) => r.id === 'frontRoad'), nr = northRoad;
  if (fr && frontFpN) for (let x = -105; x <= 105; x += 30) if (!nearGate(x)) streetLamp(x, fr.z[0] - 0.55, 1, `Site/Lamp/S${li++}`);
  const nFp = fps.find((f) => f.id === 'northFpN');
  if (nr && nFp) for (let x = -90; x <= 90; x += 30) streetLamp(x + 15, nr.z[0] - 0.55, 1, `Site/Lamp/S${li++}`);
  // drive / court post lamps (inside the plot, on paving clear of towers and amenities)
  // kept on the paving edges of the drive loop (not in the carriageway)
  const driveLamps = [[-5, 35.6], [5, 35.6], [-24, 5.6], [-36, 5.6], [-7, 5.6], [16.9, -14], [16.9, -24], [8, -30.2], [-48.5, 14], [-44.5, -30.0]];
  const towerHit = (x, z) => SPEC.towers.some((t) => Math.abs(x - t.c[0]) < t.w / 2 + 1 && Math.abs(z - t.c[1]) < t.d / 2 + 1);
  for (const [x, z] of driveLamps) if (!towerHit(x, z)) postLamp(x, z, `Site/Lamp/P${li++}`);

  /* ----------------------------- off-site scrub ----------------------------- */
  // Low, cheap mounds (1 instanced draw, 80 tris each) in clumps on the fields near the site (refs B/C scrubland).
  {
    const srng = ctx.rng('site-scrub');
    const proto = new THREE.IcosahedronGeometry(1, 1);
    const pp = proto.attributes.position, pn = proto.attributes.normal;
    for (let i = 0; i < pp.count; i++) {        // lumpy, deterministic (shared vertices get the same offset); smooth sphere normals
      const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i), k = 1 + 0.18 * Math.sin(x * 5.1 + z * 3.7) * Math.cos(y * 4.3 + x * 2.2);
      pn.setXYZ(i, x, y, z);
      pp.setXYZ(i, x * k, y * k, z * k);
    }
    const bandsZ = [...S.roads.map((r) => r.z), ...fps.map((f) => f.z)];
    const blocked = (x, z, r) => (x > Pl.x[0] - 3 - r && x < Pl.x[1] + 3 + r && z > Pl.z[0] - 3 - r && z < Pl.z[1] + 3 + r)
      || bandsZ.some(([a, b]) => z > a - 2.5 - r && z < b + 2.5 + r)
      || S.context.buildings.some(([bx, bz, bw, bd]) => Math.abs(x - bx) < bw / 2 + 3 + r && Math.abs(z - bz) < bd / 2 + 3 + r);
    const shades = ['#4A5631', '#56603A', '#3E4A2A', '#6B6A44', '#7A6E48', '#5D6B3C'];
    const smats = [], scols = [], sids = [];
    const clumps = low ? 60 : 150;
    for (let c = 0; c < clumps; c++) {
      const cx = srng.range(-230, 230), cz = srng.range(-200, 200);
      if (blocked(cx, cz, 4)) continue;
      const n = srng.int(2, 7), base = srng.pick(shades);
      for (let k = 0; k < n; k++) {
        const r = srng.range(0.7, 2.2), x = cx + srng.range(-4, 4), z = cz + srng.range(-4, 4);
        if (blocked(x, z, r)) continue;
        const sy = r * srng.range(0.45, 0.8), y = -sy * 0.3;
        smats.push(util.mat([x, y, z], srng.range(0, Math.PI * 2), [r, sy, r * srng.range(0.7, 1.0)]));
        const cc = new THREE.Color(base).multiplyScalar(srng.range(0.8, 1.15));
        scols.push(cc);
        const id = `Site/Scrub/S${String(smats.length - 1).padStart(3, '0')}`; sids.push(id);
        registry.place({ kind: 'scrub', id, bbox: { min: [x - r * 1.2, 0, z - r * 1.2], max: [x + r * 1.2, y + sy * 1.18, z + r * 1.2] }, supportY: 0, module: 'site' });
      }
    }
    if (smats.length) group.add(util.instanced(proto, mats['site.scrub'], smats, { ids: sids, colors: scols, name: 'Site/Scrub/Mounds', castShadow: false, receiveShadow: true }));
  }

  /* ----------------------------- merge + emit ----------------------------- */
  merged(parts.plaster, mats.plaster, 'Site/Masonry/Plaster', { cast: true }, 2);
  merged(parts.trim, mats.trim, 'Site/Masonry/Trim', { cast: true }, 2);
  merged(parts.kerb, mats.kerb, 'Site/Ground/Kerbs', { cast: false }, 1);
  merged(parts.vcol, mats['site.vcol'], 'Site/Details', { cast: true });
  merged(parts.lampHead, mats['site.lampHead'], 'Site/Lamps/Heads', { cast: false });
  merged(parts.facade, mats['site.facade'], 'Site/Context/Facades', { cast: true });
  merged(parts.roof, mats.roofDeck, 'Site/Context/Roofs', { cast: false }, 4);
  let halos = null;
  if (haloPts.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(haloPts.flat(), 3));
    halos = new THREE.Points(g, mats['site.halo']); halos.name = 'Site/Lamps/Halos'; halos.frustumCulled = false; halos.renderOrder = 2;
    group.add(halos);
  }

  if (pools.length) {
    const pg = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    const pm = pools.map(([x, y, z, r]) => util.mat([x, y, z], 0, [r, 1, r]));
    const im = util.instanced(pg, mats['site.lightPool'], pm, { name: 'Site/Lamps/Pools', castShadow: false, receiveShadow: false });
    im.renderOrder = 2; group.add(im);
  }
  // pooled point lights (2) washing the gate pavilions at night
  const lights = [];
  for (const gt of S.gates.slice(0, 2)) {
    const l = ctx.lights.claim('site:' + gt.id, { color: 0xffc58a, position: [gt.c[0], 4.2, gt.c[1] + gt.d / 2 + 4.5], distance: 22, intensity: 28 });
    if (l) lights.push(l);
  }

  const facadeMat = mats['site.facade'], headMat = mats['site.lampHead'], haloMat = mats['site.halo'], poolMat = mats['site.lightPool'];
  return {
    group,
    onTimeOfDay(k, state) {
      const n = state.night || 0;
      headMat.emissiveIntensity = n * 3.2;
      haloMat.opacity = Math.min(1, n * 1.1);
      poolMat.opacity = Math.max(0, n - 0.3) * 0.75;
      facadeMat.emissiveIntensity = Math.max(0, n - 0.25) * 1.0;   // stays dark through golden hour
    },
    dispose() { group.traverse((o) => o.geometry?.dispose?.()); },
  };
}
