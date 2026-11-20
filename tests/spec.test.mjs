// SPEC validation: units/ranges, layout sanity, cameras. Normal, edge and failure cases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import SPEC from '../src/spec/index.js';
import { rectOf } from '../src/util.js';

const overlap = (a, b) => a.x[0] < b.x[1] && a.x[1] > b.x[0] && a.z[0] < b.z[1] && a.z[1] > b.z[0];
const inside = (a, outer) => a.x[0] >= outer.x[0] && a.x[1] <= outer.x[1] && a.z[0] >= outer.z[0] && a.z[1] <= outer.z[1];

export function checkSpec(S) {
  const errs = [];
  for (const t of S.towers) {
    if (!Number.isInteger(t.floors) || t.floors < 1 || t.floors > 60) errs.push(`${t.id}: floors`);
    if (!(t.floorH >= 2.8 && t.floorH <= 3.6)) errs.push(`${t.id}: floorH ${t.floorH}`);
    if (!(t.stiltH >= 2.8 && t.stiltH <= 5)) errs.push(`${t.id}: stiltH`);
    const sum = t.front.reduce((a, b) => a + b.w, 0);
    if (Math.abs(sum - t.w) > 0.5) errs.push(`${t.id}: front bays sum ${sum.toFixed(2)} != width ${t.w}`);
    if (t.cornices.some((f) => f < 0 || f > t.floors)) errs.push(`${t.id}: cornice floor out of range`);
    if ([...t.cornices].sort((a, b) => a - b).join() !== t.cornices.join()) errs.push(`${t.id}: cornices unsorted`);
    if (!inside(rectOf(t.c, t.w, t.d), S.site.plot)) errs.push(`${t.id}: outside plot`);
    for (const r of S.site.roads) if (overlap(rectOf(t.c, t.w, t.d), r)) errs.push(`${t.id}: overlaps road ${r.id}`);
  }
  for (let i = 0; i < S.towers.length; i++) for (let j = i + 1; j < S.towers.length; j++) {
    const a = S.towers[i], b = S.towers[j];
    if (overlap(rectOf(a.c, a.w, a.d), rectOf(b.c, b.w, b.d))) errs.push(`${a.id} overlaps ${b.id}`);
  }
  const cl = S.site.clubhouse, pool = S.site.pool;
  const fixed = [
    ['clubhouse', rectOf(cl.c, cl.w, cl.d)], ['pool', rectOf(pool.basin.c, pool.basin.w, pool.basin.d)],
    ...S.site.gates.map((g) => [g.id, rectOf(g.c, g.w, g.d)]),
  ];
  for (const [id, r] of fixed) {
    if (!inside(r, S.site.plot)) errs.push(`${id}: outside plot`);
    for (const t of S.towers) if (overlap(r, rectOf(t.c, t.w, t.d))) errs.push(`${id} overlaps ${t.id}`);
  }
  if (!inside(rectOf(pool.basin.c, pool.basin.w, pool.basin.d), pool.deck)) errs.push('pool basin outside deck');
  for (const [id, c] of Object.entries(S.cameras)) {
    if (!c.interior && c.pos[1] < 1.2) errs.push(`camera ${id} below eye height`);
    if (!(c.fov || c.hfov)) errs.push(`camera ${id} has no fov`);
    if (c.shift && Math.abs(c.pos[1] - c.target[1]) > 0.01) errs.push(`camera ${id}: shift lens requires a level camera`);
    if (c.shift && !(c.shift.horizonY > 0 && c.shift.horizonY < 1)) errs.push(`camera ${id}: horizonY range`);
  }
  for (const v of S.tour) { if (!S.cameras[v]) errs.push(`tour view ${v} missing`); else if (S.cameras[v].interior) errs.push(`tour view ${v} is interior`); }
  // v1.16 tour time-lapse: one time of day (0..1) per tour stop
  if (S.tourTime && (S.tourTime.length !== S.tour.length || S.tourTime.some((k) => !(k >= 0 && k <= 1)))) errs.push('tourTime must match tour, values 0..1');
  const kfs = S.global.timeOfDay.keyframes;
  if (kfs[0].k !== 0 || kfs[kfs.length - 1].k !== 1) errs.push('ToD keyframes must span 0..1');
  for (const kf of kfs) if (kf.sunElev < 12) errs.push(`keyframe ${kf.id}: sun below 12 deg`);
  return errs;
}

test('SPEC is valid', () => { assert.deepEqual(checkSpec(SPEC), []); });

test('SPEC is pure data (JSON round-trips)', () => {
  const s = JSON.parse(JSON.stringify(SPEC));
  assert.equal(s.towers.length, 2);
  assert.equal(s.towers[0].floors, 14);
});

test('edge: front bays exactly matching width pass', () => {
  const S = structuredClone(SPEC); S.towers[0].w = S.towers[0].front.reduce((a, b) => a + b.w, 0);
  assert.deepEqual(checkSpec(S), []);
});

test('failure: broken SPECs are caught', () => {
  const S = structuredClone(SPEC);
  S.towers[0].floorH = 5;                         // out of range
  S.towers[1].c = [2.5, 20];                      // overlaps hero
  S.cameras.pool.pos[1] = 0.5;                    // below eye height + not level
  S.tour.push('gym');                             // interior in tour
  S.towers[0].cornices = [3, 0];                  // unsorted
  const errs = checkSpec(S).join('\n');
  for (const frag of ['floorH', 'Tower_H overlaps Tower_R','below eye height', 'level camera', 'is interior', 'unsorted']) assert.match(errs, new RegExp(frag));
});
