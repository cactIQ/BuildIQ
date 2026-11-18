import { test } from 'node:test';
import assert from 'node:assert/strict';
import SPEC from '../src/spec/index.js';
import { parseParams, resolutionScale, dynResStep, shiftLens, presetTanV, todBlend } from '../src/params.js';

test('parseParams: defaults', () => {
  const p = parseParams('', SPEC);
  assert.equal(p.view, 'hero'); assert.equal(p.tod, SPEC.global.timeOfDay.default); assert.equal(p.embed, false); assert.equal(p.ui, 'full');
});
test('parseParams: valid values', () => {
  const p = parseParams('?view=pool&tod=0.65&embed=1&ui=min&q=low&only=tower,site&debug=ids', SPEC);
  assert.equal(p.view, 'pool'); assert.equal(p.tod, 0.65); assert.equal(p.embed, true); assert.equal(p.autostart, false);
  assert.equal(p.ui, 'min'); assert.equal(p.q, 'low'); assert.deepEqual(p.only, ['tower', 'site']); assert.equal(p.debug, 'ids');
});
test('parseParams: out of range / unknown / injection-like are sanitised', () => {
  const p = parseParams('?view=<script>&tod=7&ui=evil&q=ultra&only=../x,TOWER&debug=x&lang=de&t=-5', SPEC);
  assert.equal(p.view, 'hero'); assert.equal(p.tod, 1); assert.equal(p.ui, 'full'); assert.equal(p.q, null);
  assert.equal(p.only, null); assert.equal(p.debug, null); assert.equal(p.lang, 'en'); assert.equal(p.t, 0);
  assert.equal(parseParams('?tod=abc', SPEC).tod, SPEC.global.timeOfDay.default);
});
test('parseParams: shot implies freeze + no UI', () => {
  const p = parseParams('?shot=1', SPEC); assert.equal(p.freeze, true); assert.equal(p.ui, 'none');
});

test('resolutionScale caps pixel count regardless of DPR', () => {
  const s = resolutionScale(2, 1920, 1080, 2.1e6);
  assert.ok(1920 * 1080 * s * s <= 2.1e6 + 1);
  assert.equal(resolutionScale(1, 800, 600, 2.1e6), 1);           // small canvas: DPR wins
  assert.equal(resolutionScale(2, 0, 0, 2.1e6), 1);               // edge: zero size
  const s4k = resolutionScale(1.5, 3840, 2160, 2.1e6); assert.ok(3840 * 2160 * s4k * s4k <= 2.1e6 + 1);
});

test('dynResStep lowers on slow frames, raises only with headroom, respects floor', () => {
  assert.equal(dynResStep(1, 30, 22), 0.9);
  assert.equal(dynResStep(0.6, 50, 22), 0.6);
  assert.equal(dynResStep(0.8, 10, 22, undefined, false), 0.8);
  assert.equal(dynResStep(0.8, 10, 22, undefined, true), 0.9);
});

test('shiftLens: zero shift is a plain camera', () => {
  const r = shiftLens(Math.tan(Math.PI / 8), 0);
  assert.ok(Math.abs(r.fullFovDeg - 45) < 1e-9); assert.equal(r.cropFrac, 1); assert.ok(Math.abs(r.offFrac) < 1e-12);
});
test('shiftLens: horizon near bottom puts crop at the top of the full frame', () => {
  const r = shiftLens(0.5, 0.45);   // horizonY 0.95
  assert.ok(r.cropFrac < 1 && r.offFrac >= 0 && r.offFrac + r.cropFrac <= 1 + 1e-9);
  assert.ok(Math.abs(r.offFrac) < 1e-9);  // crop starts at the top
  // the horizon (tan 0) sits at 95% down the crop
  const half = 0.5 / r.cropFrac; const cropTop = half - 0; const horizonFromTop = (cropTop - 0) / (2 * 0.5);
  assert.ok(Math.abs(horizonFromTop - 0.95) < 1e-9);
});
test('presetTanV keeps the whole reference frame on narrower canvases', () => {
  const p = SPEC.cameras.elevation;
  const wide = presetTanV(p, p.aspect), narrow = presetTanV(p, 0.6);
  assert.ok(narrow > wide);
});

test('todBlend interpolates and picks nearest keyframe', () => {
  const kf = SPEC.global.timeOfDay.keyframes;
  assert.equal(todBlend(kf, 0).nearest, 'day'); assert.equal(todBlend(kf, 1).nearest, 'night');
  const mid = todBlend(kf, 0.175); const kd = kf.find((x) => x.id === 'day'), kg = kf.find((x) => x.id === 'golden');
  assert.ok(Math.abs(mid.sunI - (kd.sunI + kg.sunI) / 2) < 1e-9);
  assert.equal(todBlend(kf, -3).nearest, 'day'); assert.equal(todBlend(kf, 9).nearest, 'night');
});
