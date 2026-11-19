// v1.13 look panel (owner tool): live brightness / contrast / vibrance / warmth sliders over the 3D view, preset chips,
// saved looks (this browser) and "Copy template" to promote a look into src/spec/looks.js for everyone.
// Opened by the Look button (shown with ?tune=1) or the L key. Plain English labels on purpose: it is an authoring
// tool, not visitor UI, so it is outside i18n. Uniform writes only (src/grade.js): no recompiles, no CSS filters.
import { LOOK_RANGE, normalizeLook } from './grade.js';

const SLIDERS = [
  { k: 'exposure', label: 'Brightness', step: 0.01, fmt: (v) => signed((v - 1) * 100) + '%' },
  { k: 'contrast', label: 'Contrast', step: 0.01, fmt: (v) => signed((v - 1) * 100) + '%' },
  { k: 'vibrance', label: 'Vibrance', step: 0.01, fmt: (v) => signed(v * 100) },
  { k: 'warmth', label: 'Warmth', step: 0.001, fmt: (v) => signed((v / 0.08) * 100) },
];
const SAVED_KEY = 'looks-saved';
function signed(x) { const r = Math.round(x); return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r); }
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'my-look';
const round = (n, d) => Number(n.toFixed(d));

export function mountLookPanel({ app, SPEC, el, store, onToggle = () => {} }) {
  const builtIn = SPEC.looks?.presets || {};
  const readSaved = () => { try { const o = JSON.parse(store.get(SAVED_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } };
  let saved = readSaved();
  let current = normalizeLook(app.getLook());
  let activeId = Object.keys(builtIn).find((id) => same(builtIn[id], current)) || null;

  function same(a, b) { const n = normalizeLook(a); return Object.keys(n).every((k) => Math.abs(n[k] - b[k]) < 1e-4); }

  /* --- DOM --- */
  const chips = el('div', { class: 'lk-chips', role: 'group', 'aria-label': 'Looks' });
  const rows = SLIDERS.map((s) => {
    const [lo, hi] = LOOK_RANGE[s.k];
    const val = el('span', { class: 'lk-val' });
    const input = el('input', { type: 'range', min: lo, max: hi, step: s.step, 'aria-label': s.label, class: 'lk-range' });
    input.addEventListener('input', () => { current = { ...current, [s.k]: Number(input.value) }; apply(null); });
    input.addEventListener('dblclick', () => { current = { ...current, [s.k]: s.k === 'exposure' || s.k === 'contrast' ? 1 : 0 }; apply(null); });
    return { s, input, val, node: el('label', { class: 'lk-row' }, [el('span', { class: 'lk-lbl', text: s.label }), val, input]) };
  });
  const nameIn = el('input', { type: 'text', class: 'lk-name', maxlength: '32', placeholder: 'Name this look', 'aria-label': 'Look name' });
  const saveRow = el('div', { class: 'lk-saverow', hidden: true }, [
    nameIn,
    el('button', { class: 'lk-btn lk-btn-gold', type: 'button', text: 'Save', onClick: commitSave }),
  ]);
  const note = el('p', { class: 'lk-note', 'aria-live': 'polite', text: 'Saved looks stay in this browser. Copy template to make one the default for everyone.' });
  const out = el('textarea', { class: 'lk-out', readonly: true, rows: '3', hidden: true, 'aria-label': 'Look template' });
  const panel = el('section', { class: 'look-panel glass', 'aria-label': 'Look', hidden: true }, [
    el('header', { class: 'lk-head' }, [
      el('span', { class: 'lk-title', text: 'Look' }),
      el('span', { class: 'lk-sub', text: 'Live grade' }),
      el('button', { class: 'lk-x', type: 'button', 'aria-label': 'Close look panel', html: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>', onClick: () => toggle(false) }),
    ]),
    chips,
    el('div', { class: 'lk-rows' }, rows.map((r) => r.node)),
    el('div', { class: 'lk-actions' }, [
      el('button', { class: 'lk-btn', type: 'button', text: 'Reset', onClick: () => pick(SPEC.looks?.default || 'natural') }),
      el('button', { class: 'lk-btn', type: 'button', text: 'Save…', onClick: () => { saveRow.hidden = !saveRow.hidden; if (!saveRow.hidden) nameIn.focus(); } }),
      el('button', { class: 'lk-btn lk-btn-gold', type: 'button', text: 'Copy template', onClick: copyTemplate }),
    ]),
    saveRow, out, note,
  ]);
  nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commitSave(); } e.stopPropagation(); });

  function renderChips() {
    chips.replaceChildren();
    const add = (id, look, mine) => {
      const b = el('button', { class: 'lk-chip' + (id === activeId ? ' on' : '') + (mine ? ' mine' : ''), type: 'button', 'aria-pressed': String(id === activeId), text: look.label || id, onClick: () => pick(id) });
      if (mine) b.append(el('span', { class: 'lk-del', role: 'button', 'aria-label': `Delete ${look.label || id}`, text: '×', onClick: (e) => { e.stopPropagation(); delete saved[id]; persist(); if (activeId === id) activeId = null; renderChips(); } }));
      chips.append(b);
    };
    for (const [id, l] of Object.entries(builtIn)) add(id, l, false);
    for (const [id, l] of Object.entries(saved)) add(id, l, true);
  }
  function syncInputs() {
    for (const r of rows) { r.input.value = String(current[r.s.k]); r.val.textContent = r.s.fmt(current[r.s.k]); }
  }
  function apply(id) {
    current = app.setLook(current);
    activeId = id;
    syncInputs(); renderChips();
  }
  function pick(id) {
    const l = builtIn[id] || saved[id]; if (!l) return;
    current = normalizeLook(l); apply(id);
  }
  function persist() { store.set(SAVED_KEY, JSON.stringify(saved)); }
  function lookLine(id, label) {
    const c = current;
    return `${/^[a-z][a-z0-9]*$/.test(id) ? id : `'${id}'`}: { label: '${label.replace(/'/g, '’')}', exposure: ${round(c.exposure, 3)}, contrast: ${round(c.contrast, 3)}, vibrance: ${round(c.vibrance, 3)}, warmth: ${round(c.warmth, 4)} },`;
  }
  function commitSave() {
    const label = nameIn.value.trim() || 'My look';
    let id = slugify(label); if (builtIn[id]) id += '-2';
    saved[id] = { label, ...current };
    persist(); nameIn.value = ''; saveRow.hidden = true; activeId = id; renderChips();
    note.textContent = `Saved “${label}” in this browser.`;
  }
  async function copyTemplate() {
    const label = (activeId && (saved[activeId]?.label || builtIn[activeId]?.label)) || 'My look';
    const text = lookLine(activeId || slugify(label), label);
    out.value = text; out.hidden = false;
    try { await navigator.clipboard.writeText(text); note.textContent = 'Copied. Paste it into src/spec/looks.js (presets) and set it as default.'; }
    catch { out.select(); note.textContent = 'Select and copy the line above into src/spec/looks.js.'; }
  }

  let open = false;
  function toggle(on = !open) {
    open = on; panel.hidden = !on;
    if (on) { current = normalizeLook(app.getLook()); syncInputs(); renderChips(); }
    onToggle(on);
  }
  syncInputs(); renderChips();
  return { el: panel, toggle, isOpen: () => open };
}
