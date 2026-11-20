// Build every geometry module under node with stub textures and check: no NaN, registry grounding/scale,
// per-module draw-call and triangle budgets. Fix these before any browser run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import SPEC from '../src/spec/index.js';
import * as util from '../src/util.js';
import { Registry, makeRng } from '../src/util.js';
import { createStubTextures } from '../src/textures.js';
import { createMaterialLib, defineBaseMaterials } from '../src/materials/base.js';
import { validateRegistry } from '../src/validate.js';
import { parseParams } from '../src/params.js';

const MODULES = [
  { name: 'site', file: '../src/site.js', mats: '../src/materials/site.js', budget: 'site' },
  { name: 'props', file: '../src/props.js', mats: '../src/materials/site.js', budget: 'site' },
  { name: 'tower', file: '../src/tower.js', mats: '../src/materials/tower.js', budget: 'towers' },
  { name: 'amenities', file: '../src/amenities.js', mats: '../src/materials/amenities.js', budget: 'amenities' },
  { name: 'vegetation', file: '../src/vegetation.js', mats: '../src/materials/amenities.js', budget: 'vegetation' },
];

export async function makeCtx() {
  const registry = new Registry();
  const ctx = {
    THREE, SPEC, util, rng: makeRng(SPEC.global.seed), registry, tex: createStubTextures(),
    tier: { name: 'high', ...SPEC.quality.high }, renderer: null, params: parseParams('', SPEC), M: null,
    lights: { claim: () => new THREE.PointLight() }, scene: new THREE.Scene(),
  };
  ctx.M = createMaterialLib(ctx); defineBaseMaterials(ctx.M, SPEC);
  return ctx;
}

export function stats(group) {
  let draws = 0, tris = 0, casters = 0, casterTris = 0, nan = 0;
  group.updateMatrixWorld(true);
  group.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3;
    const inst = o.isInstancedMesh ? o.count : 1;
    draws++; tris += n * inst;
    if (o.castShadow) { casters++; casterTris += n * inst; }
    const a = g.attributes.position.array; for (let i = 0; i < a.length; i += 97) if (!Number.isFinite(a[i])) { nan++; break; }
  });
  return { draws, tris: Math.round(tris), casters, casterTris: Math.round(casterTris), nan };
}

const built = {};
for (const m of MODULES) {
  test(`module ${m.name} builds within budget and grounded`, async () => {
    const ctx = await makeCtx();
    (await import(m.mats)).define?.(ctx.M, SPEC);
    const mod = await import(m.file);
    const out = await mod.build(ctx);
    assert.ok(out && out.group && out.group.isObject3D, 'build() must return {group}');
    const s = stats(out.group);
    built[m.name] = s;
    assert.equal(s.nan, 0, 'NaN positions');
    const b = SPEC.quality.budgets[m.budget];
    // site+props share one budget: each must stay within it; combined check below
    assert.ok(s.draws <= b.draws, `${m.name} draws ${s.draws} > ${b.draws}`);
    assert.ok(s.tris <= b.tris, `${m.name} tris ${s.tris} > ${b.tris}`);
    const v = validateRegistry(ctx.registry, SPEC);
    assert.deepEqual(v.floating, [], 'floating objects');
    assert.deepEqual(v.buried, [], 'buried objects');
    assert.deepEqual(v.scale, [], 'scale outliers');
    assert.deepEqual(v.nan, [], 'NaN bboxes');
    console.log(`  ${m.name}: draws ${s.draws}, tris ${s.tris}, casters ${s.casters}, placements ${ctx.registry.items.length}`);
  });
}

test('combined budgets', () => {
  const sum = (k) => Object.values(built).reduce((a, s) => a + s[k], 0);
  const siteDraws = (built.site?.draws || 0) + (built.props?.draws || 0);
  assert.ok(siteDraws <= SPEC.quality.budgets.site.draws, `site+props draws ${siteDraws}`);
  assert.ok(sum('draws') <= SPEC.quality.budgets.total.draws - 10, `total draws ${sum('draws')}`);   // 10 reserved for core (sky, domes)
  assert.ok(sum('tris') <= SPEC.quality.budgets.total.tris, `total tris ${sum('tris')}`);
});

// v1.15 sample flat interior: builds under node, stays within its own budget in both modes, grounded, and the walk
// start pose and every door opening are walkable (no collider covers them).
test('interior flat builds within budget, grounded, walkable', async () => {
  const ctx = await makeCtx();
  (await import('../src/materials/flat.js')).define?.(ctx.M, SPEC);
  const { FLAT } = await import('../src/materials/flat.js');
  const out = await (await import('../src/interior-flat.js')).build(ctx);
  assert.ok(out.group?.isObject3D && Array.isArray(out.colliders) && out.colliders.length > 20);
  for (const mode of ['dollhouse', 'walk']) {
    out.setMode(mode);
    const s = stats(out.group);
    assert.equal(s.nan, 0, 'NaN positions');
    // walk mode draws the room twice (mirrored floor reflection)
    assert.ok(s.draws <= (mode === 'walk' ? 90 : 45), `flat ${mode} draws ${s.draws}`);
    assert.ok(s.tris <= 150000, `flat ${mode} tris ${s.tris} > 150k`);
    console.log(`  flat ${mode}: draws ${s.draws}, tris ${s.tris}`);
  }
  const v = validateRegistry(ctx.registry, SPEC);
  assert.deepEqual(v.floating, [], 'floating objects'); assert.deepEqual(v.buried, [], 'buried objects');
  assert.deepEqual(v.scale, [], 'scale outliers'); assert.deepEqual(v.nan, [], 'NaN bboxes');
  const free = (x, z, r = FLAT.radius) => !out.colliders.some(([x0, z0, x1, z1]) => {
    const cx = Math.min(Math.max(x, x0), x1), cz = Math.min(Math.max(z, z0), z1); return (x - cx) ** 2 + (z - cz) ** 2 < r * r; });
  const start = SPEC.cameras.flatWalk.pos;
  assert.ok(free(start[0], start[2]), 'walk start pose is inside a collider');
  for (const w of FLAT.walls) for (const o of w.open) {
    if (o.win || o.y0 > 0) continue;
    const s = o.slide ? (o.stack === 'a' ? o.b - 0.35 : o.a + 0.35) : (o.a + o.b) / 2;
    const [x, z] = w.axis === 'x' ? [s, w.at] : [w.at, s];
    assert.ok(free(x, z, 0.2), `opening ${w.id} [${o.a}, ${o.b}] is blocked`);
  }
});