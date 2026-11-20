// Pure helpers (no DOM/THREE) for URL params, resolution and lens maths. Unit-tested under node.

const VIEW_RE = /^[a-zA-Z]{1,24}$/;
const MODULE_RE = /^[a-z-]{1,24}$/;

/** Parse URL search params into a safe, validated config. Unknown/invalid values fall back to defaults. */
export function parseParams(search, SPEC) {
  const p = new URLSearchParams(typeof search === 'string' ? search : '');
  const views = Object.keys(SPEC.cameras);
  const num = (k, def, lo, hi) => { const v = Number(p.get(k)); return p.has(k) && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def; };
  const bool = (k, def = false) => (p.has(k) ? ['1', 'true', 'yes', ''].includes(p.get(k).toLowerCase()) : def);
  const view = p.get('view');
  const only = (p.get('only') || '').split(',').filter((m) => MODULE_RE.test(m));
  const debug = p.get('debug');
  const q = p.get('q');
  const lang = p.get('lang');
  return {
    view: view && VIEW_RE.test(view) && views.includes(view) ? view : 'hero',
    tod: num('tod', SPEC.global.timeOfDay.default, 0, 1),
    todExplicit: p.has('tod') && Number.isFinite(Number(p.get('tod'))),
    shot: bool('shot'),
    freeze: bool('freeze') || bool('shot'),
    t: num('t', 0, 0, 1e6),
    embed: bool('embed'),
    ui: ['full', 'min', 'none'].includes(p.get('ui')) ? p.get('ui') : (bool('shot') ? 'none' : 'full'),
    autostart: bool('autostart', !bool('embed')),
    frost: p.has('frost') ? bool('frost') : null,              // v1.12 glass UI blur: null = auto
    look: /^[a-z0-9-]{1,24}$/.test(p.get('look') || '') ? p.get('look') : null,   // v1.13 look preset id (SPEC.looks)
    tune: bool('tune'),                                         // v1.13 show the look (grade) panel button
    mblur: p.has('mblur') ? bool('mblur') : null,              // v1.16 camera motion blur: null = auto (on for the high tier)
    q: ['high', 'low'].includes(q) ? q : null,
    only: only.length ? only : null,
    debug: ['ids', 'normals', 'overdraw', 'stats'].includes(debug) ? debug : null,
    lang: SPEC.i18n.available.includes(lang) ? lang : 'en',
  };
}

/** Pixel ratio that caps the drawing buffer at maxPx regardless of DPR, times a dynamic scale. */
export function resolutionScale(dpr, cssW, cssH, maxPx, dyn = 1) {
  if (!(cssW > 0 && cssH > 0)) return 1;
  const cap = Math.sqrt(maxPx / (cssW * cssH));
  return Math.max(0.25, Math.min(dpr, cap) * dyn);
}

/** Dynamic resolution controller step: returns new dyn scale given median frame ms and target ms. */
export function dynResStep(dyn, medianMs, targetMs, { step = 0.1, floor = 0.6 } = {}, headroomOk = false) {
  if (medianMs > targetMs * 1.08) return Math.max(floor, +(dyn - step).toFixed(2));
  if (headroomOk && medianMs < targetMs * 0.75) return Math.min(1, +(dyn + step).toFixed(2));
  return dyn;
}

/**
 * Lens model: a level camera with vertical lens shift (architectural "shift lens") or a plain camera.
 * Inputs: tanV = half-height of the visible crop in tan units, shift = horizonY - 0.5 (fraction of crop height,
 * positive = horizon below centre). Returns full-frame fov (deg) and crop offset as fractions for setViewOffset.
 */
export function shiftLens(tanV, shift) {
  const c = shift * 2 * tanV;               // crop centre above the horizon (tan units)
  const half = Math.abs(c) + tanV;          // full symmetric frame half-height
  const fullFovDeg = (2 * Math.atan(half) * 180) / Math.PI;
  const cropFrac = tanV / half;             // crop height / full height
  const offFrac = (half - (c + tanV)) / (2 * half);   // crop top offset / full height
  return { fullFovDeg, cropFrac, offFrac };
}

/** Visible-crop half-height (tan units) for a preset on a canvas of aspect `a`, keeping the whole ref frame. */
export function presetTanV(preset, a) {
  const refA = preset.aspect || 16 / 9;
  let tanH, tanV;
  if (preset.hfov) { tanH = Math.tan((preset.hfov * Math.PI) / 360); tanV = tanH / refA; }
  else { tanV = Math.tan(((preset.fov || 40) * Math.PI) / 360); tanH = tanV * refA; }
  // `fit` (0..1, optional): on canvases narrower than the reference keep at least this fraction of its width
  // (crop the sides) rather than all of it. Without `fit` the whole reference frame is kept.
  const keepH = preset.fit > 0 && preset.fit < 1 ? tanH * preset.fit : tanH;
  return Math.max(tanV, keepH / a);
}

/** Time-of-day interpolation across keyframes. Returns blended numeric fields + nearest keyframe id. */
export function todBlend(keyframes, k) {
  const ks = [...keyframes].sort((a, b) => a.k - b.k);
  k = Math.min(1, Math.max(0, k));
  let i = 0; while (i < ks.length - 2 && k > ks[i + 1].k) i++;
  const a = ks[i], b = ks[i + 1], t = b.k === a.k ? 0 : (k - a.k) / (b.k - a.k);
  const out = { nearest: (t < 0.5 ? a : b).id, t, a: a.id, b: b.id };
  for (const key of Object.keys(a)) if (typeof a[key] === 'number') out[key] = a[key] + (b[key] - a[key]) * t;
  return out;
}

export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
