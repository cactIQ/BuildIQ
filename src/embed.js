// Embed layer: poster + "View in 3D", inert gestures until activated, postMessage API v1.
// The validator (validateMessage) and message builder (outboundMessage) are pure and node-testable.
// DOM work only happens inside mountEmbed(), never at import time.
//
// postMessage v1 (inbound, accepted only from SPEC.embed.allowedOrigins, exact match, '*' is never honoured):
//   { v: 1, type: 'setView', view: 'pool' }
//   { v: 1, type: 'setTime', k: 0.35 }            or { v: 1, type: 'setTime', preset: 'dusk' }
//   { v: 1, type: 'tour', action: 'play'|'stop' }
// Outbound (posted to each allowed origin only): { source: 'property-showcase', v: 1, type, ...payload }
//   ready {view}, viewChanged {view}, ctaClicked {id}, error {code}
// Unknown types are ignored (ok:false, reason:'unknown-type').

export const PROTOCOL_VERSION = 1;
export const SOURCE = 'property-showcase';
export const INBOUND_TYPES = ['setView', 'setTime', 'tour'];
export const OUTBOUND_TYPES = ['ready', 'viewChanged', 'ctaClicked', 'error'];
export const TIME_PRESETS = { day: 0, golden: 0.35, dusk: 0.65, night: 1 };
const VIEW_RE = /^[a-zA-Z]{1,24}$/;
const ID_RE = /^[a-zA-Z0-9_-]{1,32}$/;
const MAX_KEYS = 8;

const isPlainObject = (d) => d !== null && typeof d === 'object' && !Array.isArray(d) && Object.getPrototypeOf(d) === Object.prototype;

/** Normalise an origin list: only exact `scheme://host[:port]` strings; wildcards are dropped. */
export function normaliseOrigins(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((o) => typeof o === 'string' && /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/i.test(o)).map((o) => o.toLowerCase());
}

/**
 * Validate an inbound message. Pure.
 * @param {string} origin  event.origin
 * @param {*} data         event.data
 * @param {{allowedOrigins:string[], views:string[]}} opts
 * @returns {{ok:true, msg:object} | {ok:false, reason:string}}
 */
export function validateMessage(origin, data, { allowedOrigins = [], views = [] } = {}) {
  const allowed = normaliseOrigins(allowedOrigins);
  if (typeof origin !== 'string' || !allowed.includes(origin.toLowerCase())) return { ok: false, reason: 'origin' };
  if (!isPlainObject(data)) return { ok: false, reason: 'malformed' };
  if (Object.keys(data).length > MAX_KEYS) return { ok: false, reason: 'malformed' };
  if (data.v !== PROTOCOL_VERSION) return { ok: false, reason: 'version' };
  if (typeof data.type !== 'string') return { ok: false, reason: 'malformed' };
  if (!INBOUND_TYPES.includes(data.type)) return { ok: false, reason: 'unknown-type' };
  switch (data.type) {
    case 'setView':
      if (typeof data.view !== 'string' || !VIEW_RE.test(data.view) || !views.includes(data.view)) return { ok: false, reason: 'bad-field' };
      return { ok: true, msg: { type: 'setView', view: data.view } };
    case 'setTime': {
      if (typeof data.preset === 'string') {
        if (!Object.prototype.hasOwnProperty.call(TIME_PRESETS, data.preset)) return { ok: false, reason: 'bad-field' };
        return { ok: true, msg: { type: 'setTime', k: TIME_PRESETS[data.preset] } };
      }
      if (typeof data.k !== 'number' || !Number.isFinite(data.k) || data.k < 0 || data.k > 1) return { ok: false, reason: 'bad-field' };
      return { ok: true, msg: { type: 'setTime', k: data.k } };
    }
    case 'tour':
      if (data.action !== 'play' && data.action !== 'stop') return { ok: false, reason: 'bad-field' };
      return { ok: true, msg: { type: 'tour', action: data.action } };
    default:
      return { ok: false, reason: 'unknown-type' };
  }
}

/** Build an outbound message (pure). Throws on unknown types so mistakes surface in tests. */
export function outboundMessage(type, payload = {}) {
  if (!OUTBOUND_TYPES.includes(type)) throw new Error('unknown outbound type ' + type);
  const out = { source: SOURCE, v: PROTOCOL_VERSION, type };
  if (type === 'ready' || type === 'viewChanged') out.view = VIEW_RE.test(String(payload.view)) ? String(payload.view) : null;
  if (type === 'ctaClicked') out.id = typeof payload.id === 'string' && ID_RE.test(payload.id) ? payload.id : null;
  if (type === 'error') out.code = typeof payload.code === 'string' && ID_RE.test(payload.code) ? payload.code : 'unknown';
  return out;
}

/** Apply a validated message to the app. */
export function applyMessage(app, msg) {
  if (!app || !msg) return false;
  if (msg.type === 'setView') { app.tour?.stop?.(); return app.setView(msg.view) !== false; }
  if (msg.type === 'setTime') { app.setTime(msg.k); return true; }
  if (msg.type === 'tour') { if (msg.action === 'play') app.tour.play(); else app.tour.stop(); return true; }
  return false;
}

/**
 * DOM part. Called from ui.js when params.embed.
 * @returns {{ requestStart(fn), attach(app), post(type,payload), destroy() }}
 */
export function mountEmbed({ root, SPEC, params, t, el }) {
  const allowed = normaliseOrigins(SPEC.embed && SPEC.embed.allowedOrigins);
  const inFrame = (() => { try { return window.parent && window.parent !== window; } catch { return true; } })();
  let app = null, active = false, startFn = null;
  const touch = matchMedia('(pointer: coarse)').matches;

  function post(type, payload) {
    if (!inFrame || !allowed.length) return;
    const m = outboundMessage(type, payload);
    for (const o of allowed) { try { window.parent.postMessage(m, o); } catch { /* origin mismatch is dropped by the browser */ } }
  }

  // Start gate: poster stays visible; one large "View in 3D" button.
  const gate = el('div', { class: 'embed-gate' }, [el('div', { class: 'embed-gate-in' }, [
    el('span', { class: 'diamond', 'aria-hidden': 'true' }),
    el('p', { class: 'wordmark', text: SPEC.brand.name }),
    el('p', { class: 'loader-dev', text: SPEC.brand.developer }),
    el('button', { class: 'btn btn-gold embed-start', type: 'button', 'aria-label': t('View in 3D') }, [
      el('span', { class: 'diamond-sm', 'aria-hidden': 'true' }), el('span', { text: t('View in 3D') }),
    ]),
  ])]);
  // Inert shield: covers the canvas until the visitor clicks, so page scrolling is never hijacked.
  const shield = el('button', { class: 'embed-shield', type: 'button', 'aria-label': t(touch ? 'Tap to explore' : 'Click to explore') }, [
    el('span', { class: 'embed-hint' }, [el('span', { class: 'diamond-sm', 'aria-hidden': 'true' }), el('span', { text: t(touch ? 'Tap to explore' : 'Click to explore') })]),
  ]);
  const release = el('div', { class: 'embed-release', 'aria-live': 'polite' });

  function requestStart(fn) {
    startFn = fn;
    root.appendChild(gate);
    gate.querySelector('button').addEventListener('click', () => { gate.remove(); const f = startFn; startFn = null; f && f(); }, { once: true });
  }

  function setActive(on) {
    active = on;
    app?.setInteractive(on);
    shield.hidden = on;
    document.body.classList.toggle('embed-active', on);
    release.textContent = on ? t('Press Esc to release') : '';
    if (on) { release.classList.add('show'); setTimeout(() => release.classList.remove('show'), 2600); }
  }

  function onMessage(e) {
    const r = validateMessage(e.origin, e.data, { allowedOrigins: allowed, views: Object.keys(SPEC.cameras) });
    if (r.ok) applyMessage(app, r.msg);
  }

  function attach(a) {
    app = a;
    const stage = document.getElementById('stage');
    stage.appendChild(shield);
    root.appendChild(release);
    shield.addEventListener('click', () => setActive(true));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && active) setActive(false); });
    setActive(false);
    addEventListener('message', onMessage);
    app.on('view', ({ id }) => post('viewChanged', { view: id }));
    app.on('error', ({ code }) => post('error', { code: code || 'unknown' }));
    app.on('fallback', ({ reason }) => post('error', { code: reason || 'fallback' }));
    post('ready', { view: app.getView() });
  }

  return { requestStart, attach, post, isActive: () => active, destroy() { removeEventListener('message', onMessage); gate.remove(); shield.remove(); release.remove(); } };
}
