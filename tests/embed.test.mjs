// Embed postMessage v1: schema validation (valid, disallowed origin, malformed), outbound shape, apply.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import SPEC from '../src/spec/index.js';
import { validateMessage, outboundMessage, applyMessage, normaliseOrigins, TIME_PRESETS } from '../src/embed.js';

const ORIGIN = 'https://builder.example';
const opts = { allowedOrigins: [ORIGIN], views: Object.keys(SPEC.cameras) };

test('valid: setView / setTime / tour from an allowed origin', () => {
  assert.deepEqual(validateMessage(ORIGIN, { v: 1, type: 'setView', view: 'pool' }, opts), { ok: true, msg: { type: 'setView', view: 'pool' } });
  assert.deepEqual(validateMessage(ORIGIN, { v: 1, type: 'setTime', k: 0.65 }, opts), { ok: true, msg: { type: 'setTime', k: 0.65 } });
  assert.deepEqual(validateMessage(ORIGIN, { v: 1, type: 'setTime', preset: 'night' }, opts), { ok: true, msg: { type: 'setTime', k: TIME_PRESETS.night } });
  assert.deepEqual(validateMessage(ORIGIN, { v: 1, type: 'tour', action: 'play' }, opts), { ok: true, msg: { type: 'tour', action: 'play' } });
  assert.equal(validateMessage('HTTPS://BUILDER.EXAMPLE', { v: 1, type: 'tour', action: 'stop' }, opts).ok, true);   // origin case-insensitive
});

test('edge: boundaries and extra fields', () => {
  assert.equal(validateMessage(ORIGIN, { v: 1, type: 'setTime', k: 0 }, opts).ok, true);
  assert.equal(validateMessage(ORIGIN, { v: 1, type: 'setTime', k: 1 }, opts).ok, true);
  const r = validateMessage(ORIGIN, { v: 1, type: 'setView', view: 'gym', extra: '<script>' }, opts);
  assert.deepEqual(r.msg, { type: 'setView', view: 'gym' });               // unknown fields are dropped
  assert.equal(validateMessage(ORIGIN, { v: 1, type: 'whatever' }, opts).reason, 'unknown-type');
});

test('disallowed origin: rejected, including wildcard and empty lists', () => {
  assert.equal(validateMessage('https://evil.example', { v: 1, type: 'tour', action: 'play' }, opts).reason, 'origin');
  assert.equal(validateMessage(ORIGIN, { v: 1, type: 'tour', action: 'play' }, { ...opts, allowedOrigins: [] }).reason, 'origin');
  assert.equal(validateMessage('https://evil.example', { v: 1, type: 'tour', action: 'play' }, { ...opts, allowedOrigins: ['*'] }).reason, 'origin');
  assert.equal(validateMessage('null', { v: 1, type: 'tour', action: 'play' }, { ...opts, allowedOrigins: ['null'] }).reason, 'origin');
  assert.equal(validateMessage(undefined, { v: 1, type: 'tour', action: 'play' }, opts).reason, 'origin');
  assert.equal(validateMessage(ORIGIN + '.attacker.example', { v: 1, type: 'tour', action: 'play' }, opts).reason, 'origin');
  assert.deepEqual(normaliseOrigins(['*', 'https://a.example', 'javascript:alert(1)', 42, 'http://localhost:8080']), ['https://a.example', 'http://localhost:8080']);
});

test('malformed: wrong shapes, versions and field values are rejected', () => {
  const bad = [
    [null, 'malformed'], ['setView', 'malformed'], [[1, 2], 'malformed'], [42, 'malformed'],
    [{ type: 'setView', view: 'pool' }, 'version'], [{ v: 2, type: 'setView', view: 'pool' }, 'version'], [{ v: '1', type: 'tour', action: 'play' }, 'version'],
    [{ v: 1 }, 'malformed'], [{ v: 1, type: 7 }, 'malformed'],
    [{ v: 1, type: 'setView', view: 'nowhere' }, 'bad-field'], [{ v: 1, type: 'setView', view: '../x' }, 'bad-field'], [{ v: 1, type: 'setView', view: ['pool'] }, 'bad-field'],
    [{ v: 1, type: 'setTime', k: 1.5 }, 'bad-field'], [{ v: 1, type: 'setTime', k: -0.1 }, 'bad-field'], [{ v: 1, type: 'setTime', k: NaN }, 'bad-field'],
    [{ v: 1, type: 'setTime', k: '0.5' }, 'bad-field'], [{ v: 1, type: 'setTime', preset: 'noon' }, 'bad-field'], [{ v: 1, type: 'setTime', preset: 'constructor' }, 'bad-field'],
    [{ v: 1, type: 'tour', action: 'rewind' }, 'bad-field'],
    [{ v: 1, type: 'tour', action: 'play', a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 }, 'malformed'],
    [Object.create({ v: 1, type: 'tour', action: 'play' }), 'malformed'],
  ];
  for (const [data, reason] of bad) assert.equal(validateMessage(ORIGIN, data, opts).reason, reason, JSON.stringify(data));
});

test('outbound messages have a fixed, sanitised shape', () => {
  assert.deepEqual(outboundMessage('ready', { view: 'hero' }), { source: 'property-showcase', v: 1, type: 'ready', view: 'hero' });
  assert.deepEqual(outboundMessage('viewChanged', { view: '<img>' }), { source: 'property-showcase', v: 1, type: 'viewChanged', view: null });
  assert.deepEqual(outboundMessage('ctaClicked', { id: 'enquire' }), { source: 'property-showcase', v: 1, type: 'ctaClicked', id: 'enquire' });
  assert.equal(outboundMessage('error', {}).code, 'unknown');
  assert.throws(() => outboundMessage('secrets', {}));
});

test('applyMessage drives the app API', () => {
  const calls = [];
  const app = { setView: (v) => calls.push(['view', v]), setTime: (k) => calls.push(['time', k]), tour: { play: () => calls.push(['play']), stop: () => calls.push(['stop']) } };
  applyMessage(app, { type: 'setView', view: 'pool' });
  applyMessage(app, { type: 'setTime', k: 1 });
  applyMessage(app, { type: 'tour', action: 'play' });
  assert.deepEqual(calls, [['stop'], ['view', 'pool'], ['time', 1], ['play']]);
  assert.equal(applyMessage(null, { type: 'tour', action: 'play' }), false);
});

test('SPEC.embed ships with no allowed origins (inbound disabled until configured)', () => {
  assert.deepEqual(normaliseOrigins(SPEC.embed.allowedOrigins), []);
});
