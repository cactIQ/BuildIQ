// Amenities module: pool zone (deck, basin, water, kids' feature, jacuzzi, ladders, west wall + planter), clubhouse
// (stepped attic per ref E), plaza contents (tree-ring planter, striped stadium lawn, EPDM play circle + equipment,
// south lawn strip). Contract: export async function build(ctx) -> { group, update, onTimeOfDay, dispose }.
// Static parts are merged per material (one draw each); world-scale UVs via util.worldUV / mergeParts({uvTile}).
import * as THREE from 'three';

/** Shared layout numbers (vegetation imports this so planters/hedges line up). All derived from SPEC.site. */
export function amenityLayout(SPEC) {
  const S = SPEC.site, P = S.pool, C = S.clubhouse;
  const deckY = 0.15;
  const b = P.basin;
  const basin = { x: [b.c[0] - b.w / 2, b.c[0] + b.w / 2], z: [b.c[1] - b.d / 2, b.c[1] + b.d / 2] };
  const club = { x: [C.c[0] - C.w / 2, C.c[0] + C.w / 2], z: [C.c[1] - C.d / 2, C.c[1] + C.d / 2] };
  const plinth = { x: [club.x[0] - 0.6, club.x[1] + 0.6], z: [club.z[0] - 0.6, P.deck.z[0]] };
  const planters = [   // grey concrete raised planters around the clubhouse (ref E): rect, wall top, soil top
    { id: 'E', x: [club.x[1] + 0.9, club.x[1] + 2.0], z: [club.z[0] - 0.9, club.z[1] - 0.4], h: 0.5, soil: 0.44 },
    { id: 'N', x: [club.x[0] + 0.4, club.x[1] - 0.2], z: [club.z[0] - 2.0, club.z[0] - 0.9], h: 0.5, soil: 0.44 },
  ];
  const wx = P.westWall.x;
  const westPlanter = { x: [wx + 0.15, wx + 0.95], z: [P.deck.z[0] + 0.3, P.deck.z[1] - 0.3], h: deckY + 0.4, soil: deckY + 0.36 };
  const ring = { ...S.plaza.treeRing, soil: 0.4, wallH: 0.45 };
  return {
    deckY, deck: P.deck, basin, waterY: 0.07, floorY: deckY - b.depth, kids: P.kids, jacuzzi: P.jacuzzi,
    club, plinth, planters, westPlanter, ring, lawn: S.plaza.lawn, play: S.plaza.play,
    lawnStrip: { x: [27.5, S.plaza.lawnStripSouth.x[1]], z: [S.plaza.lawnStripSouth.z[0], 41.15] },
  };
}

export async function build(ctx) {
  const { SPEC, util, registry, M } = ctx;
  const L = amenityLayout(SPEC);
  const group = new THREE.Group();
  group.name = 'Module_amenities';
  const MOD = 'amenities';

  /* ------------------------------ helpers ------------------------------ */
  const parts = {};                                         // materialKey -> [{geometry}]
  const add = (key, geometry) => { (parts[key] ||= []).push({ geometry }); return geometry; };
  const box = (key, x0, y0, z0, x1, y1, z1) => add(key, util.boxMinMax(Math.min(x0, x1), y0, Math.min(z0, z1), Math.max(x0, x1), y1, Math.max(z0, z1)));
  const cyl = (key, r0, r1, y0, y1, x, z, seg = 16) => { const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, seg); g.translate(x, (y0 + y1) / 2, z); return add(key, g); };
  function ringGeo(rOut, rIn, y0, y1, x, z, seg = 48) {
    const s = new THREE.Shape(); s.absarc(0, 0, rOut, 0, Math.PI * 2, false);
    const h = new THREE.Path(); h.absarc(0, 0, rIn, 0, Math.PI * 2, true); s.holes.push(h);
    const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: seg });
    g.rotateX(-Math.PI / 2); g.translate(x, y0, z); return g;
  }
  function stadiumShape(w, d, off = 0) {
    const R = d / 2 + off, a = (w - d) / 2, s = new THREE.Shape();
    s.moveTo(-a, -R); s.lineTo(a, -R); s.absarc(a, 0, R, -Math.PI / 2, Math.PI / 2, false);
    s.lineTo(-a, R); s.absarc(-a, 0, R, Math.PI / 2, Math.PI * 1.5, false);
    return s;
  }
  function extrudeY(shape, y0, y1, x, z, seg = 24) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: seg });
    g.rotateX(-Math.PI / 2); g.translate(x, y0, z); return g;
  }
  const swapUV = (g) => { const uv = g.attributes.uv.array; for (let i = 0; i < uv.length; i += 2) { const t = uv[i]; uv[i] = uv[i + 1]; uv[i + 1] = t; } return g; };
  const finish = (name, geometry, material, { cast = false, receive = true } = {}) => {
    const m = util.mesh(geometry, material, { name, castShadow: cast, receiveShadow: receive });
    group.add(m); return m;
  };
  const bboxOfParts = (list) => { const b = new THREE.Box3(); for (const p of list) { p.geometry.computeBoundingBox(); b.union(p.geometry.boundingBox); } return b; };
  const place = (kind, id, bbox, supportY) => registry.place({ kind, id, bbox, supportY, module: MOD });

  /* ------------------------------ materials ------------------------------ */
  const names = ['deck', 'coping', 'mosaic', 'steel', 'plaster', 'trim', 'concrete', 'frame', 'walnut', 'lawn', 'lawnStriped', 'kerb',
    'amenities.poolTile', 'amenities.water', 'amenities.grating', 'amenities.glazing', 'amenities.letters', 'amenities.soil',
    'amenities.epdm', 'amenities.play'];
  const mats = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await M.use(n)])));

  /* =============================== POOL ZONE =============================== */
  const { deckY, deck, basin: bs, waterY, floorY } = L;
  // Deck (light ash timber), four slabs around the basin hole; boards run N-S like ref D.
  const deckParts = [];
  const dbox = (x0, z0, x1, z1) => deckParts.push({ geometry: util.boxMinMax(x0, 0, z0, x1, deckY, z1) });
  dbox(deck.x[0], deck.z[0], deck.x[1], bs.z[0]);
  dbox(deck.x[0], bs.z[1], deck.x[1], deck.z[1]);
  dbox(deck.x[0], bs.z[0], bs.x[0], bs.z[1]);
  dbox(bs.x[1], bs.z[0], deck.x[1], bs.z[1]);
  const deckGeo = swapUV(util.mergeParts(deckParts, { uvTile: 2 }));
  finish('Pool/Deck', deckGeo, mats.deck);
  place('deck', 'Pool/Deck', deckGeo.boundingBox, 0);

  // Basin: floor + four walls (inner faces visible), mosaic with caustics.
  const T = 0.2;
  box('amenities.poolTile', bs.x[0], floorY - T, bs.z[0], bs.x[1], floorY, bs.z[1]);
  box('amenities.poolTile', bs.x[0] - T, floorY - T, bs.z[0] - T, bs.x[1] + T, deckY, bs.z[0]);
  box('amenities.poolTile', bs.x[0] - T, floorY - T, bs.z[1], bs.x[1] + T, deckY, bs.z[1] + T);
  box('amenities.poolTile', bs.x[0] - T, floorY - T, bs.z[0], bs.x[0], deckY, bs.z[1]);
  box('amenities.poolTile', bs.x[1], floorY - T, bs.z[0], bs.x[1] + T, deckY, bs.z[1]);
  place('poolBasin', 'Pool/Basin', new THREE.Box3(new THREE.Vector3(bs.x[0] - T, floorY - T, bs.z[0] - T), new THREE.Vector3(bs.x[1] + T, deckY, bs.z[1] + T)), null);

  // White coping ring (bullnose overhang 5 cm into the pool) + linear grating just outside it.
  const cw = 0.4, ov = 0.05, cy0 = deckY - 0.03, cy1 = deckY + 0.04;
  box('coping', bs.x[0] - cw, cy0, bs.z[0] - cw, bs.x[1] + cw, cy1, bs.z[0] + ov);
  box('coping', bs.x[0] - cw, cy0, bs.z[1] - ov, bs.x[1] + cw, cy1, bs.z[1] + cw);
  box('coping', bs.x[0] - cw, cy0, bs.z[0] + ov, bs.x[0] + ov, cy1, bs.z[1] - ov);
  box('coping', bs.x[1] - ov, cy0, bs.z[0] + ov, bs.x[1] + cw, cy1, bs.z[1] - ov);
  const gw = 0.14, gy1 = deckY + 0.008, grParts = [];
  const gstrip = (x0, z0, x1, z1, alongZ) => {
    const g = util.boxMinMax(x0, deckY - 0.02, z0, x1, gy1, z1);
    util.worldUV(g, 0.5); if (alongZ) swapUV(g);
    grParts.push({ geometry: g });
  };
  const go = bs.x[0] - cw, gE = bs.x[1] + cw, gn = bs.z[0] - cw, gs = bs.z[1] + cw;
  gstrip(go - gw, gn - gw, gE + gw, gn, false);
  gstrip(go - gw, gs, gE + gw, gs + gw, false);
  gstrip(go - gw, gn, go, gs, true);
  gstrip(gE, gn, gE + gw, gs, true);
  finish('Pool/Grating', util.mergeParts(grParts), mats['amenities.grating']);

  // Kids' raised square feature on the south long edge: mosaic sides, shallow inner pool, broad coping.
  const K = L.kids, kx0 = K.c[0] - K.w / 2, kx1 = K.c[0] + K.w / 2, kz0 = K.c[1] - K.d / 2, kz1 = K.c[1] + K.d / 2;
  const kTop = deckY + K.raise, kFloor = deckY + 0.08, kw = 0.32;
  box('mosaic', kx0, floorY, kz0, kx1, kFloor, kz1);
  box('mosaic', kx0, kFloor, kz0, kx1, kTop - 0.06, kz0 + kw);
  box('mosaic', kx0, kFloor, kz1 - kw, kx1, kTop - 0.06, kz1);
  box('mosaic', kx0, kFloor, kz0 + kw, kx0 + kw, kTop - 0.06, kz1 - kw);
  box('mosaic', kx1 - kw, kFloor, kz0 + kw, kx1, kTop - 0.06, kz1 - kw);
  const kc = 0.08;   // coping overhang outward
  box('concrete', kx0 - kc, kTop - 0.06, kz0 - kc, kx1 + kc, kTop, kz0 + kw + 0.03);
  box('concrete', kx0 - kc, kTop - 0.06, kz1 - kw - 0.03, kx1 + kc, kTop, kz1 + kc);
  box('concrete', kx0 - kc, kTop - 0.06, kz0 + kw + 0.03, kx0 + kw + 0.03, kTop, kz1 - kw - 0.03);
  box('concrete', kx1 - kw - 0.03, kTop - 0.06, kz0 + kw + 0.03, kx1 + kc, kTop, kz1 - kw - 0.03);
  place('poolKids', 'Pool/Kids', new THREE.Box3(new THREE.Vector3(kx0 - kc, floorY, kz0 - kc), new THREE.Vector3(kx1 + kc, kTop, kz1 + kc)), null);

  // Round jacuzzi (raised), NW corner.
  const J = L.jacuzzi, jTop = deckY + J.raise, jFloor = deckY + 0.05, jIn = J.r - 0.22;
  cyl('mosaic', J.r, J.r, floorY, jFloor, J.c[0], J.c[1], 40);
  add('mosaic', ringGeo(J.r, jIn, jFloor, jTop - 0.05, J.c[0], J.c[1], 40));
  add('coping', ringGeo(J.r + 0.07, jIn - 0.03, jTop - 0.05, jTop, J.c[0], J.c[1], 40));
  place('poolJacuzzi', 'Pool/Jacuzzi', new THREE.Box3(new THREE.Vector3(J.c[0] - J.r - 0.07, floorY, J.c[1] - J.r - 0.07), new THREE.Vector3(J.c[0] + J.r + 0.07, jTop, J.c[1] + J.r + 0.07)), null);

  // Water: basin sheet + kids' inner pool + jacuzzi disc, one transparent mesh.
  const wParts = [];
  { const g = new THREE.PlaneGeometry(bs.x[1] - bs.x[0], bs.z[1] - bs.z[0], 1, 1); g.rotateX(-Math.PI / 2); g.translate((bs.x[0] + bs.x[1]) / 2, waterY, (bs.z[0] + bs.z[1]) / 2); wParts.push({ geometry: g }); }
  { const s = K.w - 2 * kw + 0.02, g = new THREE.PlaneGeometry(s, s); g.rotateX(-Math.PI / 2); g.translate(K.c[0], kTop - 0.1, K.c[1]); wParts.push({ geometry: g }); }
  { const g = new THREE.CircleGeometry(jIn + 0.01, 32); g.rotateX(-Math.PI / 2); g.translate(J.c[0], jTop - 0.1, J.c[1]); wParts.push({ geometry: g }); }
  const water = finish('Pool/Water', util.mergeParts(wParts, { uvTile: 4 }), mats['amenities.water'], { receive: false });
  water.renderOrder = 2;

  // Two steel ladders (hand rails arcing over the coping, three treads).
  const ladderParts = [];
  for (const ld of SPEC.site.pool.ladders) {
    const north = ld.edge === 'north', ez = north ? bs.z[0] : bs.z[1], s = north ? 1 : -1;   // s: +1 = pool lies toward +z
    for (const dx of [-0.26, 0.26]) {
      const x = ld.x + dx;
      const pts = [[ez - s * 0.42, deckY], [ez - s * 0.42, deckY + 0.55], [ez - s * 0.3, deckY + 0.9], [ez - s * 0.02, deckY + 0.95],
        [ez + s * 0.14, deckY + 0.7], [ez + s * 0.16, deckY + 0.2], [ez + s * 0.16, -0.95]].map(([z, y]) => new THREE.Vector3(x, y, z));
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2);
      ladderParts.push({ geometry: new THREE.TubeGeometry(curve, 28, 0.022, 6, false) });
    }
    for (const y of [-0.15, -0.45, -0.75]) ladderParts.push({ geometry: util.boxMinMax(ld.x - 0.26, y - 0.02, Math.min(ez + s * 0.1, ez + s * 0.24), ld.x + 0.26, y + 0.02, Math.max(ez + s * 0.1, ez + s * 0.24)) });
    place('ladder', 'Pool/Ladder_' + (north ? 'N' : 'S'), new THREE.Box3(new THREE.Vector3(ld.x - 0.3, -0.97, Math.min(ez - 0.45, ez + s * 0.2)), new THREE.Vector3(ld.x + 0.3, deckY + 0.97, Math.max(ez - s * 0.45, ez + s * 0.2))), null);
  }
  for (const p of ladderParts) add('steel', p.geometry);

  // Low cream west wall (with trim cap) and a raised planter on the deck side.
  const wx = SPEC.site.pool.westWall.x, wH = SPEC.site.pool.westWall.h;
  box('plaster', wx - 0.1, 0, deck.z[0], wx + 0.15, wH, deck.z[1]);
  box('trim', wx - 0.14, wH, deck.z[0] - 0.04, wx + 0.19, wH + 0.06, deck.z[1] + 0.04);
  const WP = L.westPlanter, pt = 0.08;
  box('plaster', WP.x[0], deckY, WP.z[0], WP.x[1], WP.h, WP.z[0] + pt);
  box('plaster', WP.x[0], deckY, WP.z[1] - pt, WP.x[1], WP.h, WP.z[1]);
  box('plaster', WP.x[1] - pt, deckY, WP.z[0], WP.x[1], WP.h, WP.z[1]);
  box('trim', WP.x[1] - pt - 0.02, WP.h, WP.z[0] - 0.02, WP.x[1] + 0.02, WP.h + 0.03, WP.z[1] + 0.02);
  box('amenities.soil', WP.x[0], deckY, WP.z[0] + pt, WP.x[1] - pt, WP.soil, WP.z[1] - pt);
  place('wall', 'Pool/WestWall', new THREE.Box3(new THREE.Vector3(wx - 0.14, 0, deck.z[0] - 0.04), new THREE.Vector3(wx + 0.19, wH + 0.06, deck.z[1] + 0.04)), 0);
  place('planter', 'Pool/WestPlanter', new THREE.Box3(new THREE.Vector3(WP.x[0], deckY, WP.z[0]), new THREE.Vector3(WP.x[1] + 0.02, WP.h + 0.03, WP.z[1])), deckY);

  /* =============================== CLUBHOUSE =============================== */
  const C = L.club, X0 = C.x[0], X1 = C.x[1], Z0 = C.z[0], Z1 = C.z[1], cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const F = deckY, wallTop = SPEC.site.clubhouse.wallH, W = X1 - X0;
  const ring = (key, p, y0, y1, w = W) => box(key, cx - w / 2 - p, y0, cz - w / 2 - p, cx + w / 2 + p, y1, cz + w / 2 + p);

  box('concrete', L.plinth.x[0], 0, L.plinth.z[0], L.plinth.x[1], F, L.plinth.z[1]);

  // Corner piers (plaster) + solid west wall + south wall (west half, with doors).
  const pier = 0.6;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const xc = sx < 0 ? X0 : X1, zc = sz < 0 ? Z0 : Z1;
    box('plaster', xc, F, zc, xc - sx * pier, wallTop, zc - sz * pier);
  }
  box('plaster', X0, F, Z0 + pier, X0 + 0.25, wallTop, Z1 - pier);
  const sGlass = [-32.6, X1 - pier];
  box('plaster', X0 + pier, F, Z1 - 0.25, sGlass[0], wallTop, Z1);
  // inner core behind the glazing (keeps the volume closed for shadows)
  box('plaster', X0 + 0.3, F, Z0 + 0.3, X1 - 0.3, wallTop, Z1 - 0.3);

  // Clustered round corner columns (3 per corner) with square bases and capitals.
  const colR = 0.16, off = 0.12, sep = 0.42;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const xc = (sx < 0 ? X0 : X1) + sx * off, zc = (sz < 0 ? Z0 : Z1) + sz * off;
    for (const [px, pz] of [[xc, zc], [xc - sx * sep, zc], [xc, zc - sz * sep]]) {
      box('trim', px - 0.22, F, pz - 0.22, px + 0.22, F + 0.24, pz + 0.22);
      box('trim', px - 0.2, F + 0.24, pz - 0.2, px + 0.2, F + 0.3, pz + 0.2);
      cyl('trim', colR + 0.02, colR, F + 0.3, wallTop - 0.2, px, pz, 16);
      box('trim', px - 0.2, wallTop - 0.2, pz - 0.2, px + 0.2, wallTop - 0.12, pz + 0.2);
      box('trim', px - 0.23, wallTop - 0.12, pz - 0.23, px + 0.23, wallTop, pz + 0.23);
    }
  }

  // Glazed runs: opaque reflective glass with curtains (one material) + dark frames (4 panels + transom on E/N; 3 on S).
  const glazeParts = [], transomY = 2.6, gInset = 0.06;
  function glazeRun(face, a0, a1, panels) {
    const len = a1 - a0, hgt = wallTop - F, g = new THREE.PlaneGeometry(len, hgt, 1, 1);
    const uv = g.attributes.uv.array; for (let i = 0; i < uv.length; i += 2) uv[i] *= len / 1.2;
    const mid = (a0 + a1) / 2, ym = (F + wallTop) / 2;
    if (face === 'E') { g.rotateY(Math.PI / 2); g.translate(X1 - gInset, ym, mid); }
    if (face === 'N') { g.rotateY(Math.PI); g.translate(mid, ym, Z0 + gInset); }
    if (face === 'S') { g.translate(mid, ym, Z1 - gInset); }
    glazeParts.push({ geometry: g });
    const fb = (b0, b1, y0, y1) => {           // frame bar along the face between b0..b1 (run coordinate)
      const d0 = -gInset - 0.04, d1 = -gInset + 0.05;
      if (face === 'E') box('frame', X1 + d0, y0, b0, X1 + d1, y1, b1);
      if (face === 'N') box('frame', b0, y0, Z0 - d1, b1, y1, Z0 - d0);
      if (face === 'S') box('frame', b0, y0, Z1 + d0, b1, y1, Z1 + d1);
    };
    for (let i = 0; i <= panels; i++) { const a = a0 + (len * i) / panels; fb(a - 0.035, a + 0.035, F, wallTop); }
    fb(a0, a1, F, F + 0.09); fb(a0, a1, transomY - 0.04, transomY + 0.04); fb(a0, a1, wallTop - 0.07, wallTop);
  }
  glazeRun('E', Z0 + pier, Z1 - pier, 4);
  glazeRun('N', X0 + pier, X1 - pier, 4);
  glazeRun('S', sGlass[0], sGlass[1], 3);
  finish('Clubhouse/Glazing', util.mergeParts(glazeParts), mats['amenities.glazing'], { cast: false });

  // Two walnut doors (south face, west half) with trim architraves and steel pulls.
  const doorH = 2.3, doorW = 0.92;
  for (const [i, x0] of [[0, -36.35], [1, -35.15]]) {
    const x1 = x0 + doorW;
    box('walnut', x0, F, Z1, x1, F + doorH, Z1 + 0.04);
    for (let k = 0; k < 7; k++) { const y = F + 0.25 + k * 0.28; box('walnut', x0 + 0.1, y, Z1 + 0.04, x1 - 0.1, y + 0.03, Z1 + 0.055); }
    box('trim', x0 - 0.1, F, Z1, x0, F + doorH + 0.1, Z1 + 0.07);
    box('trim', x1, F, Z1, x1 + 0.1, F + doorH + 0.1, Z1 + 0.07);
    box('trim', x0 - 0.1, F + doorH, Z1, x1 + 0.1, F + doorH + 0.12, Z1 + 0.07);
    const hx = i === 0 ? x1 - 0.12 : x0 + 0.12;
    box('steel', hx - 0.015, F + 0.85, Z1 + 0.06, hx + 0.015, F + 1.35, Z1 + 0.09);
    place('door', `Clubhouse/Door_${i + 1}`, new THREE.Box3(new THREE.Vector3(x0, F, Z1), new THREE.Vector3(x1, F + doorH, Z1 + 0.055)), F);
  }

  // Entablature to 4.7 (stepped mouldings), fluted band + cap to 5.6, then the 2-tier stepped attic (ref E).
  ring('trim', 0.30, wallTop, wallTop + 0.1);
  ring('trim', 0.38, wallTop + 0.1, 3.85);
  ring('trim', 0.45, 3.85, 3.95);
  ring('trim', 0.40, 3.95, 4.40);
  ring('trim', 0.55, 4.40, 4.52);
  ring('trim', 0.75, 4.52, 4.70);
  ring('plaster', 0.10, 4.70, 5.40);
  const fluteFace = W / 2 + 0.10, fp = 0.24;
  for (let a = -W / 2 + 0.05; a <= W / 2 - 0.05 + 1e-6; a += fp) {
    box('trim', cx + a - 0.045, 4.78, cz + fluteFace, cx + a + 0.045, 5.32, cz + fluteFace + 0.05);
    box('trim', cx + a - 0.045, 4.78, cz - fluteFace - 0.05, cx + a + 0.045, 5.32, cz - fluteFace);
    box('trim', cx + fluteFace, 4.78, cz + a - 0.045, cx + fluteFace + 0.05, 5.32, cz + a + 0.045);
    box('trim', cx - fluteFace - 0.05, 4.78, cz + a - 0.045, cx - fluteFace, 5.32, cz + a + 0.045);
  }
  ring('trim', 0.18, 5.40, 5.48);
  ring('trim', 0.30, 5.48, 5.60);
  // stepped attic (ref E): a low wide tier with a moulded cap, then a taller narrower tier with a strong cornice
  ring('trim', 0.08, 5.60, 5.68, 4.4);
  ring('plaster', 0, 5.68, 6.25, 4.4);
  ring('trim', 0.12, 6.25, 6.35, 4.4);
  ring('trim', 0.25, 6.35, 6.47, 4.4);
  ring('plaster', 0, 6.47, 7.15, 3.1);
  ring('trim', 0.10, 7.15, 7.25, 3.1);
  ring('trim', 0.22, 7.25, 7.33, 3.1);
  ring('trim', 0.34, 7.33, 7.45, 3.1);

  // "CLUB HOUSE" gold letters on a raised plate on the east entablature frieze.
  const plateX = X1 + 0.40;
  box('trim', plateX, 3.98, cz - 2.95, plateX + 0.03, 4.38, cz + 2.95);
  { const g = new THREE.PlaneGeometry(5.6, 0.52); g.rotateY(Math.PI / 2); g.translate(plateX + 0.036, 4.175, cz);
    finish('Clubhouse/Letters', g, mats['amenities.letters'], { cast: false, receive: false }); }

  // Grey concrete raised planters (thin walls + soil).
  for (const p of L.planters) {
    const t = 0.1;
    box('concrete', p.x[0], 0, p.z[0], p.x[1], p.h, p.z[0] + t);
    box('concrete', p.x[0], 0, p.z[1] - t, p.x[1], p.h, p.z[1]);
    box('concrete', p.x[0], 0, p.z[0] + t, p.x[0] + t, p.h, p.z[1] - t);
    box('concrete', p.x[1] - t, 0, p.z[0] + t, p.x[1], p.h, p.z[1] - t);
    box('amenities.soil', p.x[0] + t, 0, p.z[0] + t, p.x[1] - t, p.soil, p.z[1] - t);
    place('planter', 'Clubhouse/Planter_' + p.id, new THREE.Box3(new THREE.Vector3(p.x[0], 0, p.z[0]), new THREE.Vector3(p.x[1], p.h, p.z[1])), 0);
  }
  place('building', 'Clubhouse', new THREE.Box3(new THREE.Vector3(L.plinth.x[0], 0, L.plinth.z[0]), new THREE.Vector3(L.plinth.x[1], 7.45, L.plinth.z[1])), 0);

  /* =============================== PLAZA =============================== */
  // Tree-ring planter (concrete ring wall, lawn disc inside; hedge ring + tree come from vegetation).
  const R = L.ring;
  add('concrete', ringGeo(R.r, R.r - 0.25, 0, R.wallH, R.c[0], R.c[1], 56));
  add('trim', ringGeo(R.r + 0.04, R.r - 0.29, R.wallH, R.wallH + 0.05, R.c[0], R.c[1], 56));
  cyl('lawn', R.r - 0.25, R.r - 0.25, 0, R.soil, R.c[0], R.c[1], 48);
  place('planter', 'Plaza/TreeRing', new THREE.Box3(new THREE.Vector3(R.c[0] - R.r - 0.04, 0, R.c[1] - R.r - 0.04), new THREE.Vector3(R.c[0] + R.r + 0.04, R.wallH + 0.05, R.c[1] + R.r + 0.04)), 0);

  // Striped lawn with rounded ends (top +0.03) and kerb edging.
  const LW = L.lawn;
  add('lawnStriped', extrudeY(stadiumShape(LW.w, LW.d), 0, 0.03, LW.c[0], LW.c[1], 32));
  { const s = stadiumShape(LW.w, LW.d, 0.15), hole = stadiumShape(LW.w, LW.d, 0); s.holes.push(new THREE.Path(hole.getPoints(32).reverse()));
    add('kerb', extrudeY(s, 0, 0.08, LW.c[0], LW.c[1], 32)); }
  place('lawn', 'Plaza/Lawn', new THREE.Box3(new THREE.Vector3(LW.c[0] - LW.w / 2 - 0.15, 0, LW.c[1] - LW.d / 2 - 0.15), new THREE.Vector3(LW.c[0] + LW.w / 2 + 0.15, 0.08, LW.c[1] + LW.d / 2 + 0.15)), 0);

  // South lawn strip.
  box('lawn', L.lawnStrip.x[0], 0, L.lawnStrip.z[0], L.lawnStrip.x[1], 0.03, L.lawnStrip.z[1]);
  place('lawn', 'Plaza/LawnStrip', new THREE.Box3(new THREE.Vector3(L.lawnStrip.x[0], 0, L.lawnStrip.z[0]), new THREE.Vector3(L.lawnStrip.x[1], 0.03, L.lawnStrip.z[1])), 0);

  // Play circle: EPDM disc (one image covers the circle) + kerb ring.
  const PL = L.play;
  { const g = new THREE.CylinderGeometry(PL.r, PL.r, 0.03, 64); g.translate(PL.c[0], 0.015, PL.c[1]);
    const ng = g.toNonIndexed(), pos = ng.attributes.position, uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) { uv[i * 2] = (pos.getX(i) - PL.c[0]) / (2 * PL.r) + 0.5; uv[i * 2 + 1] = (pos.getZ(i) - PL.c[1]) / (2 * PL.r) + 0.5; }
    ng.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    finish('Plaza/PlaySurface', ng, mats['amenities.epdm']); }
  add('kerb', ringGeo(PL.r + 0.15, PL.r, 0, 0.08, PL.c[0], PL.c[1], 64));
  place('play', 'Plaza/PlaySurface', new THREE.Box3(new THREE.Vector3(PL.c[0] - PL.r - 0.15, 0, PL.c[1] - PL.r - 0.15), new THREE.Vector3(PL.c[0] + PL.r + 0.15, 0.08, PL.c[1] + PL.r + 0.15)), 0);

  // Play equipment: vertex-coloured, merged (one draw). Slide tower, swing, see-saw, two spring riders.
  const playParts = [], col = (h) => new THREE.Color(h);
  const tint = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const pbox = (c, x0, y0, z0, x1, y1, z1) => playParts.push({ geometry: tint(util.boxMinMax(x0, y0, z0, x1, y1, z1), col(c)) });
  const pcyl = (c, r, a, b, seg = 8) => { // cylinder between points a,b
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), g = new THREE.CylinderGeometry(r, r, d.length(), seg);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
    g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); playParts.push({ geometry: tint(g, col(c)) });
  };
  const gY = 0.03, RED = '#D8432E', YEL = '#F2C230', BLU = '#2F6FC0', GRN = '#4CAF50', ORG = '#F08A24';
  { // slide tower
    const x = PL.c[0] - 1.6, z = PL.c[1] - 0.9, h = 1.3;
    for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]]) pbox(BLU, x + dx - 0.05, gY, z + dz - 0.05, x + dx + 0.05, gY + 2.4, z + dz + 0.05);
    pbox(YEL, x - 0.62, gY + h, z - 0.62, x + 0.62, gY + h + 0.08, z + 0.62);
    for (const s of [-1, 1]) pbox(RED, x - 0.6, gY + h + 0.08, z + s * 0.6 - 0.03, x + 0.6, gY + h + 0.6, z + s * 0.6 + 0.03);
    const roof = new THREE.ConeGeometry(0.95, 0.75, 4); roof.rotateY(Math.PI / 4); roof.translate(x, gY + 2.4 + 0.37, z); playParts.push({ geometry: tint(roof, col(RED)) });
    // slide chute (east), sloping to the ground
    const L0 = 2.7, ang = Math.atan2(h, L0 - 0.3), sl = new THREE.BoxGeometry(L0, 0.06, 0.55);
    sl.rotateZ(-ang); sl.translate(x + 0.6 + (L0 / 2) * Math.cos(ang) - 0.05, gY + h / 2 + 0.08, z); playParts.push({ geometry: tint(sl, col(YEL)) });
    for (const s of [-1, 1]) { const rl = new THREE.BoxGeometry(L0, 0.16, 0.05); rl.rotateZ(-ang); rl.translate(x + 0.6 + (L0 / 2) * Math.cos(ang) - 0.05, gY + h / 2 + 0.16, z + s * 0.3); playParts.push({ geometry: tint(rl, col(GRN)) }); }
    // ladder (west)
    for (const s of [-1, 1]) pcyl(GRN, 0.035, [x - 0.62 - 0.9, gY, z + s * 0.25], [x - 0.62, gY + h, z + s * 0.25]);
    for (let k = 1; k <= 4; k++) { const t = k / 5; pcyl(YEL, 0.025, [x - 1.52 + 0.9 * t, gY + h * t, z - 0.25], [x - 1.52 + 0.9 * t, gY + h * t, z + 0.25]); }
    place('play', 'Plaza/SlideTower', new THREE.Box3(new THREE.Vector3(x - 1.55, gY, z - 0.95), new THREE.Vector3(x + 3.2, gY + 3.15, z + 0.95)), gY);
  }
  { // swing frame (2 seats)
    const x = PL.c[0] + 1.9, z = PL.c[1] + 2.1, hw = 1.3, H = 2.3;
    for (const s of [-1, 1]) { pcyl(GRN, 0.05, [x + s * hw, gY, z - 0.8], [x + s * hw, gY + H, z]); pcyl(GRN, 0.05, [x + s * hw, gY, z + 0.8], [x + s * hw, gY + H, z]); }
    pcyl(YEL, 0.055, [x - hw, gY + H, z], [x + hw, gY + H, z]);
    for (const sx of [-0.55, 0.55]) {
      for (const d of [-0.2, 0.2]) pcyl('#555555', 0.012, [x + sx + d, gY + H, z], [x + sx + d, gY + 0.5, z], 4);
      pbox(sx < 0 ? RED : BLU, x + sx - 0.25, gY + 0.44, z - 0.12, x + sx + 0.25, gY + 0.5, z + 0.12);
    }
    place('play', 'Plaza/Swing', new THREE.Box3(new THREE.Vector3(x - hw - 0.06, gY, z - 0.85), new THREE.Vector3(x + hw + 0.06, gY + H + 0.06, z + 0.85)), gY);
  }
  { // see-saw
    const x = PL.c[0] - 1.8, z = PL.c[1] + 2.6;
    pbox(BLU, x - 0.12, gY, z - 0.15, x + 0.12, gY + 0.45, z + 0.15);
    const pl = new THREE.BoxGeometry(3.0, 0.07, 0.3); pl.rotateZ(0.12); pl.translate(x, gY + 0.5, z); playParts.push({ geometry: tint(pl, col(ORG)) });
    for (const s of [-1, 1]) pcyl(RED, 0.025, [x + s * 1.2, gY + 0.5 - s * 0.14, z - 0.15], [x + s * 1.2, gY + 0.5 - s * 0.14, z + 0.15]);
    place('play', 'Plaza/SeeSaw', new THREE.Box3(new THREE.Vector3(x - 1.5, gY, z - 0.15), new THREE.Vector3(x + 1.5, gY + 0.75, z + 0.15)), gY);
  }
  for (const [i, [dx, dz, c]] of [[1.9, -2.4, ORG], [3.2, -0.6, GRN]].entries()) { // spring riders
    const x = PL.c[0] + dx, z = PL.c[1] + dz;
    pcyl('#777777', 0.07, [x, gY, z], [x, gY + 0.35, z]);
    const body = new THREE.SphereGeometry(0.28, 10, 8); body.scale(1.5, 0.8, 0.7); body.translate(x, gY + 0.55, z); playParts.push({ geometry: tint(body, col(c)) });
    pcyl(YEL, 0.02, [x + 0.2, gY + 0.85, z - 0.18], [x + 0.2, gY + 0.85, z + 0.18], 4);
    place('play', 'Plaza/Rider_' + (i + 1), new THREE.Box3(new THREE.Vector3(x - 0.42, gY, z - 0.2), new THREE.Vector3(x + 0.42, gY + 0.87, z + 0.2)), gY);
  }
  finish('Plaza/PlayEquipment', util.mergeParts(playParts), mats['amenities.play'], { cast: true });

  /* =============================== merge per material =============================== */
  const spec = {   // key -> [mesh name, uvTile, cast]
    coping: ['Pool/Coping', 1, false], mosaic: ['Pool/MosaicSides', 1, false], 'amenities.poolTile': ['Pool/Basin', 1, false],
    steel: ['Steel', null, false], plaster: ['Plaster', 2, true], trim: ['Trim', 2, true], concrete: ['Concrete', 2, true],
    frame: ['Clubhouse/Frames', null, false], walnut: ['Clubhouse/Doors', 1, false], 'amenities.soil': ['Soil', 1, false],
    lawn: ['Plaza/Lawn', 8, false], lawnStriped: ['Plaza/LawnStriped', 8, false], kerb: ['Kerb', 1, false],
  };
  for (const [key, list] of Object.entries(parts)) {
    const [name, tile, cast] = spec[key] || [key, 1, false];
    const geo = util.mergeParts(list, { uvTile: tile });
    finish(name, geo, mats[key], { cast });
  }
  void bboxOfParts;

  /* =============================== runtime =============================== */
  const poolLight = ctx.lights.claim('amenities.pool', { color: 0x7FE6FF, position: [(bs.x[0] + bs.x[1]) / 2, 1.0, (bs.z[0] + bs.z[1]) / 2], distance: 16, intensity: 14 });
  void poolLight;
  const mTile = mats['amenities.poolTile'], mWater = mats['amenities.water'], mGlaze = mats['amenities.glazing'];
  const caus = mTile.emissiveMap;
  const dayCyan = new THREE.Color('#CFF4FF'), nightCyan = new THREE.Color('#5FE0FF');
  const glazeDay = new THREE.Color('#E6ECF0'), glazeNight = new THREE.Color('#FFC890');

  function update(f) {
    if (mWater.userData.uTime) mWater.userData.uTime.value = f.t;
    if (caus) caus.offset.set(f.t * 0.021, f.t * 0.013);
  }
  function onTimeOfDay(k, s) {
    const n = s.night || 0;
    mTile.emissive.copy(dayCyan).lerp(nightCyan, n);
    mTile.emissiveIntensity = 0.16 * (1 - n) + 2.4 * n;
    mWater.emissiveIntensity = 0.9 * n;
    mGlaze.emissive.copy(glazeDay).lerp(glazeNight, n);
    mGlaze.emissiveIntensity = 0.32 * (1 - n) + 1.5 * n;
  }
  update({ t: ctx.params?.t || 0 });

  return { group, update, onTimeOfDay, dispose() { group.traverse((o) => o.geometry?.dispose?.()); } };
}
