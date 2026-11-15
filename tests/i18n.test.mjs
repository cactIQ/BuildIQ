// i18n: dictionaries complete, fallback to English works, only enabled languages are shown,
// and every t('...') literal used by the UI is a known key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import SPEC from '../src/spec/index.js';
import { STRINGS, DICTS, REVIEW_STATUS, translate, createI18n, enabledLanguages, resolveLang } from '../src/i18n.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('normal: hi and mr dictionaries cover every English key', () => {
  for (const lang of ['hi', 'mr']) {
    const missing = STRINGS.filter((k) => typeof DICTS[lang][k] !== 'string' || !DICTS[lang][k].trim());
    assert.deepEqual(missing, [], `${lang} missing keys`);
    const extra = Object.keys(DICTS[lang]).filter((k) => !STRINGS.includes(k));
    assert.deepEqual(extra, [], `${lang} has keys not in STRINGS`);
  }
});

test('normal: unreviewed languages are flagged and hidden unless enabled', () => {
  assert.equal(REVIEW_STATUS.hi, 'needs native review');
  assert.equal(REVIEW_STATUS.mr, 'needs native review');
  assert.deepEqual(enabledLanguages(SPEC), ['en']);           // SPEC currently enables English only
  assert.equal(resolveLang(SPEC, 'hi'), 'en');
  const t = createI18n(SPEC, 'hi');
  assert.equal(t.lang, 'en'); assert.equal(t('Tour'), 'Tour');
});

test('normal: an enabled language translates', () => {
  const S = structuredClone(SPEC); S.i18n.enabled = ['en', 'hi'];
  const t = createI18n(S, 'hi');
  assert.equal(t.lang, 'hi'); assert.equal(t.devanagari, true);
  assert.equal(t('Welcome'), 'स्वागत है');
});

test('edge: missing keys and unknown languages fall back to English', () => {
  assert.equal(translate('A key nobody defined', 'hi'), 'A key nobody defined');
  assert.equal(translate('Tour', 'xx'), 'Tour');
  assert.equal(translate('Tour', 'hi', { hi: { Tour: '' } }), 'Tour');      // empty string is not a translation
  const S = structuredClone(SPEC); S.i18n.enabled = ['hi'];               // English is always kept
  assert.deepEqual(enabledLanguages(S), ['en', 'hi']);
});

test('failure: bad SPEC.i18n and hostile keys do not break translation', () => {
  assert.deepEqual(enabledLanguages({}), ['en']);
  assert.deepEqual(enabledLanguages({ i18n: { enabled: 'hi' } }), ['en']);
  assert.deepEqual(enabledLanguages({ i18n: { enabled: ['de', '__proto__'] } }), ['en']);
  assert.equal(translate('__proto__', 'hi'), '__proto__');
  assert.equal(translate('constructor', 'mr'), 'constructor');
});

test('every t() literal in ui.js / embed.js is a known key', () => {
  const used = new Set();
  for (const f of ['src/ui.js', 'src/embed.js']) {
    const s = readFileSync(ROOT + f, 'utf8');
    for (const m of s.matchAll(/\bt\('((?:[^'\\]|\\.)+)'\)/g)) used.add(m[1]);
  }
  // captions and stage labels are passed through t() indirectly
  const ui = readFileSync(ROOT + 'src/ui.js', 'utf8');
  for (const m of ui.slice(ui.indexOf('const CAPTIONS'), ui.indexOf('const AMENITY_VIEWS')).matchAll(/:\s*'((?:[^'\\]|\\.)+)'/g)) used.add(m[1]);
  for (const v of Object.values(SPEC.cameras)) used.add(v.label);
  const unknown = [...used].filter((k) => !STRINGS.includes(k));
  assert.deepEqual(unknown, []);
  assert.ok(used.size > 30);
});
