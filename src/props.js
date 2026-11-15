// Props module: generic modern cars (no badges / no recognisable models) in the stilt parking of both towers,
// the west parking strip, on the roads and the drive. Instanced: body (per-instance colour), glass, details
// (wheels + lights, vertex colours) and contact-shadow decals = 4 draw calls.
// Contract: export async function build(ctx) -> { group, update?(f), onTimeOfDay?(k, state), dispose?() }

/** Car prototype in local space: length along z (nose +z), width x, wheels resting on y = 0. */
function carPrototype(THREE, util) {
  const ext = (shape, width, bevel) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: width - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, steps: 1, curveSegments: 8 });
    g.translate(0, 0, -(width - 2 * bevel) / 2);
    g.rotateY(-Math.PI / 2);        // shape X (length) -> world +z; extrusion -> x
    return g;
  };
  // lower body side profile (x = length, y = height) with wheel arches
  const s = new THREE.Shape();
  s.moveTo(-2.28, 0.36);
  s.lineTo(-2.3, 0.72); s.quadraticCurveTo(-2.32, 0.96, -2.05, 0.98);
  s.lineTo(1.1, 0.98); s.lineTo(1.95, 0.86); s.quadraticCurveTo(2.33, 0.82, 2.32, 0.58);
  s.lineTo(2.24, 0.36); s.lineTo(1.84, 0.36);
  s.quadraticCurveTo(1.4, 1.12, 0.96, 0.36);
  s.lineTo(-0.96, 0.36);
  s.quadraticCurveTo(-1.4, 1.12, -1.84, 0.36);
  s.lineTo(-2.28, 0.36);
  const lower = ext(s, 1.8, 0.06);
  // glass greenhouse (narrower; tumblehome) and roof panel + B pillar in body colour
  const gs = new THREE.Shape([new THREE.Vector2(-1.35, 0.96), new THREE.Vector2(1.08, 0.96), new THREE.Vector2(0.38, 1.4), new THREE.Vector2(-0.82, 1.42)]);
  const glass = ext(gs, 1.52, 0.04);
  const rs = new THREE.Shape([new THREE.Vector2(-0.86, 1.38), new THREE.Vector2(0.4, 1.37), new THREE.Vector2(0.3, 1.45), new THREE.Vector2(-0.74, 1.47)]);
  const roof = ext(rs, 1.48, 0.03);
  const pillar = util.boxMinMax(-0.775, 0.96, -0.22, 0.775, 1.42, -0.12);
  const body = util.mergeParts([{ geometry: lower }, { geometry: roof }, { geometry: pillar }]);
  // details: tyres, rims, lights, grille (vertex colours)
  const col = (geo, hex) => {
    const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
  };
  const det = [];
  for (const wz of [1.4, -1.4]) for (const wx of [0.78, -0.78]) {
    det.push({ geometry: col(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 14).rotateZ(Math.PI / 2).translate(wx, 0.33, wz), '#141414') });
    det.push({ geometry: col(new THREE.CylinderGeometry(0.2, 0.2, 0.235, 10).rotateZ(Math.PI / 2).translate(wx, 0.33, wz), '#A9ADB2') });
  }
  for (const sx of [-1, 1]) {
    det.push({ geometry: col(util.boxMinMax(sx * 0.55 - 0.2, 0.68, 2.2, sx * 0.55 + 0.2, 0.78, 2.33), '#E9EDF2') });   // headlights
    det.push({ geometry: col(util.boxMinMax(sx * 0.6 - 0.22, 0.74, -2.34, sx * 0.6 + 0.22, 0.84, -2.25), '#7E0C0C') }); // tail lights
    det.push({ geometry: col(util.boxMinMax(sx * 0.93 - 0.04, 0.9, 0.85, sx * 0.93 + 0.06 * sx, 1.0, 1.0), '#202224') }); // mirrors
  }
  det.push({ geometry: col(util.boxMinMax(-0.45, 0.42, 2.24, 0.45, 0.6, 2.32), '#1B1C1E') });     // grille / intake
  det.push({ geometry: col(util.boxMinMax(-0.85, 0.36, -2.31, 0.85, 0.5, -2.2), '#2A2B2D') });      // rear valance
  const detail = util.mergeParts(det);
  const shadow = new THREE.PlaneGeometry(2.2, 5.0).rotateX(-Math.PI / 2).translate(0, 0.012, 0);
  const bb = util.bboxOf(body).union(util.bboxOf(detail)).union(util.bboxOf(glass));
  return { body, glass, detail, shadow, bbox: bb };
}

export async function build(ctx) {
  const { THREE, SPEC, util, registry, tier } = ctx;
  const S = SPEC.site, RL = SPEC.global.roadLevel, low = tier.name === 'low';
  const group = new THREE.Group(); group.name = 'Module_props';
  const rng = ctx.rng('props-cars');
  const [paint, glassM, vcol, shadowM] = await Promise.all(['site.carPaint', 'site.carGlass', 'site.vcol', 'contactShadow'].map((n) => ctx.M.use(n)));
  const proto = carPrototype(THREE, util);

  // body colours (sRGB) with rough market weights: white, silver, grey, black, red, dark blue
  const colours = [['#E8E8E6', 0.28], ['#B4B8BC', 0.18], ['#6B6F73', 0.14], ['#151618', 0.16], ['#A3161A', 0.13], ['#1C2A4A', 0.11]];
  const pickColour = () => { let r = rng(), acc = 0; for (const [c, w] of colours) { acc += w; if (r <= acc) return c; } return colours[0][0]; };

  const cars = [];   // {x, y, z, rot, colour}
  const add = (x, y, z, rot, colour = null) => cars.push({ x, y, z, rot, colour: colour || pickColour() });
  const fill = low ? 0.55 : 0.8;

  // 1) stilt parking under both towers: bays midway between stilt grid lines (columns at c + k*grid)
  for (const t of SPEC.towers) {
    const g = t.stiltGrid, y = t.plinthH, hw = t.w / 2, hd = t.d / 2;
    const rows = [t.c[1] + hd - 2.75, t.c[1] - hd + 2.75];
    for (let off = -Math.floor(hw / g) * g + g / 2; off <= hw - 1.6; off += g) {
      if (Math.abs(off) > hw - 1.6) continue;
      rows.forEach((z, ri) => {
        if (!rng.chance(fill)) return;
        add(t.c[0] + off + rng.range(-0.15, 0.15), y, z + rng.range(-0.15, 0.15), ri === 0 ? 0 : Math.PI);
      });
    }
  }
  // 2) west parking strip: perpendicular stalls (2.5 m) along the west edge, nose to the wall
  for (const pk of S.parking) {
    const cx = pk.x[0] + 0.3 + 2.5;
    for (let z = pk.z[0] + 1.25; z < pk.z[1]; z += 2.5) if (rng.chance(low ? 0.5 : 0.72)) add(cx + rng.range(-0.1, 0.25), 0, z + rng.range(-0.1, 0.1), -Math.PI / 2 + rng.range(-0.03, 0.03));
  }
  // 3) roads: drive on the left (eastbound on the north lane)
  const lane = (r, side) => (r.z[0] + r.z[1]) / 2 + side * (r.z[1] - r.z[0]) / 4;
  const clearOfZebra = (x) => !S.zebras.some((zb) => Math.abs(x - zb.x) < zb.width / 2 + 2.6);
  const fr = S.roads.find((r) => r.id === 'frontRoad'), nr = S.roads.find((r) => r.id === 'northRoad');
  if (fr) {
    for (const [x, side, c] of [[-19.5, -1, '#151618'], [7, -1, '#A3161A'], [28, 1, '#E8E8E6'], [-72, 1, null], [92, -1, null]]) if (clearOfZebra(x)) add(x, RL, lane(fr, side), side < 0 ? Math.PI / 2 : -Math.PI / 2, c);
  }
  if (nr) for (const [x, side] of [[-60, -1], [-8, 1], [38, -1], [110, 1]]) add(x, RL, lane(nr, side), side < 0 ? Math.PI / 2 : -Math.PI / 2);
  // 4) drive: one car entering through each gate, one parked by the hero tower
  for (const gt of S.gates) add(gt.c[0] - 1.4, 0, gt.c[1] - gt.d / 2 - 4.2, Math.PI);
  add(12, 0, 35.2, Math.PI / 2 + 0.02);

  // instance buffers + registry
  const mats = [], shadowMats = [], ids = [], cols = [];
  const box = new THREE.Box3();
  cars.forEach((c, i) => {
    const m = util.mat([c.x, c.y, c.z], c.rot);
    const id = 'Car_' + String(i).padStart(3, '0');
    mats.push(m); shadowMats.push(m); ids.push(id); cols.push(util.hex(c.colour));
    box.copy(proto.bbox).applyMatrix4(m);
    registry.place({ kind: 'car', id, bbox: box, supportY: c.y, module: 'props' });
  });
  const opts = (name) => ({ ids, name, castShadow: false, receiveShadow: true });
  group.add(util.instanced(proto.body, paint, mats, { ...opts('Props/Cars/Body'), colors: cols }));
  group.add(util.instanced(proto.glass, glassM, mats, opts('Props/Cars/Glass')));
  group.add(util.instanced(proto.detail, vcol, mats, opts('Props/Cars/Detail')));
  const sh = util.instanced(proto.shadow, shadowM, shadowMats, { ...opts('Props/Cars/ContactShadow'), receiveShadow: false });
  sh.renderOrder = 1;
  group.add(sh);

  return { group, dispose() { for (const g of [proto.body, proto.glass, proto.detail, proto.shadow]) g.dispose(); } };
}
