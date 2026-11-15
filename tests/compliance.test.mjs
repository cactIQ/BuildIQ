// Compliance: no third-party names in deliverables, no Math.random in src, no CSS filters over the canvas,
// reference imagery never referenced by deliverable code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP = new Set(['vendor', 'tests', 'docs', '_internal', 'shots', 'refine', '.git', '.claude', 'Reference', 'node_modules', 'tools']);
const TEXT = new Set(['.js', '.mjs', '.html', '.css', '.md', '.json', '.txt', '.svg', '.bat', '.sh', '.ps1', '.py']);

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (!SKIP.has(n)) walk(p, out); }
    else if (TEXT.has(extname(n).toLowerCase())) out.push(p);
  }
  return out;
}
const files = walk(ROOT).filter((f) => !/package(-lock)?\.json$/.test(f));
const banned = JSON.parse(readFileSync(join(ROOT, 'tests', 'banned.json'), 'utf8')).terms;

test('no banned third-party names in deliverable files', () => {
  const hits = [];
  for (const f of files) {
    const s = readFileSync(f, 'utf8').toLowerCase();
    for (const t of banned) if (s.includes(t)) hits.push(`${f.slice(ROOT.length)}: "${t}"`);
  }
  assert.deepEqual(hits, []);
});

test('no Math.random in src (use ctx.rng)', () => {
  const hits = files.filter((f) => f.includes(join('src', '')) && /Math\.random\s*\(/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(hits, []);
});

test('reference images are never referenced by deliverables', () => {
  const hits = files.filter((f) => /_internal|Reference\/|\.avif/i.test(readFileSync(f, 'utf8')));
  assert.deepEqual(hits.map((f) => f.slice(ROOT.length)), []);
});

test('no CSS filter / backdrop-filter in stylesheets (GPU safety on iGPUs)', () => {
  const css = files.filter((f) => f.endsWith('.css'));
  const hits = [];
  for (const f of css) {
    const s = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    if (/(^|[;{\s])(-webkit-)?(backdrop-)?filter\s*:/m.test(s)) hits.push(f.slice(ROOT.length));
  }
  assert.deepEqual(hits, []);
});

test('no pricing UI strings', () => {
  const hits = files.filter((f) => /(₹|\bINR\b|\bprice\b|\bpricing\b|\blakh\b|\bcrore\b)/i.test(readFileSync(f, 'utf8')));
  assert.deepEqual(hits.map((f) => f.slice(ROOT.length)), []);
});

test('licence records exist for vendored code', () => {
  assert.ok(existsSync(join(ROOT, 'vendor', 'three', 'LICENSE')));
});
