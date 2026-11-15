// UI layer. Owner: UI agent. Contract used by main.js (unchanged, plus an optional extra):
//   mountUI({root, SPEC, params}) -> { loading(on), attach(app), fallback(err?), onStartRequested(fn), progress({p,label}) }
// `progress` is optional: core/main can forward boot progress to it (see the UI report). Without it the loader
// shows an indeterminate creep (CSS transform animation only).
// House rules: no CSS filters, loader animates transform/opacity only, no cost figures anywhere, placeholder data is labelled.
import { createI18n, LANG_LABEL } from './i18n.js';
import { mountEmbed } from './embed.js';

const VIEW_ORDER = ['hero', 'aerial', 'elevation', 'pool', 'clubhouse', 'aerialN', 'gym', 'orbit'];
const TOD = [['Day', 0], ['Golden', 0.35], ['Dusk', 0.65], ['Night', 1]];
const CAPTIONS = {
  hero: 'Two residential towers set around landscaped open space.',
  aerial: 'The full site plan: towers, pool deck, clubhouse and plaza.',
  elevation: 'A classical facade with layered cornices and pediments.',
  pool: 'The pool deck with a raised kids’ pool and a jacuzzi.',
  clubhouse: 'The clubhouse opens directly onto the pool deck.',
  aerialN: 'From the north: the rear tower and its rooftop gardens.',
};
// core progress labels -> friendly stage captions (i18n keys)
const STAGES = {
  'Preparing materials': 'Preparing materials', 'Building site': 'Building the site', 'Building tower': 'Raising the towers',
  'Building amenities': 'Placing amenities', 'Building vegetation': 'Planting the gardens', 'Building props': 'Adding details',
  'Lighting': 'Setting the light', 'Warming up': 'Final touches', 'Welcome': 'Welcome', 'Preparing interior': 'Preparing interior',
};
const AMENITY_VIEWS = { pool: 'pool', clubhouse: 'clubhouse', gym: 'gym' };
const UI_SCALES = [1, 0.85, 1.15, 1.3];

const ICON = {
  play: '<path d="M7 5l12 7-12 7z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
  present: '<rect x="3" y="5" width="18" height="12" rx="1"/><path d="M8 21h8M12 17v4"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  size: '<path d="M4 18L9 6l5 12M5.8 14h6.4M15 18l3-7 3 7M15.9 16h4.2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON[name]}</svg>`;

/** Tiny DOM builder. attrs: class, text, html (trusted static only), on{Event}, plus plain attributes. */
function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children)) if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return n;
}

const safeHref = (h) => (typeof h === 'string' && /^(https?:\/\/|mailto:|tel:|#)/i.test(h.trim()) ? h.trim() : '#');
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'view';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export function mountUI({ root, SPEC, params }) {
  const poster = document.getElementById('poster');
  const noop = () => {};
  // Shot mode / ui=none: render nothing at all.
  if (params.ui === 'none') {
    poster?.remove();
    return { loading: noop, attach: noop, fallback: noop, progress: noop, onStartRequested(fn) { fn(); } };
  }

  const B = SPEC.brand;
  const t = createI18n(SPEC, params.lang);
  const html = document.documentElement;
  html.lang = t.lang;
  html.classList.toggle('deva', t.devanagari);
  html.style.setProperty('--accent', B.colors.accent);
  html.style.setProperty('--bg', B.colors.bg);
  html.style.setProperty('--text', B.colors.text);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isPhone = () => innerWidth < 700;
  const minimal = params.ui === 'min';

  // UI scale (for 720p projectors etc.)
  let scaleIdx = Math.max(0, UI_SCALES.indexOf(Number(store.get('ui-scale'))));
  if (store.get('ui-scale') === null && innerHeight <= 760 && innerWidth >= 900) scaleIdx = 1;
  const applyScale = () => html.style.setProperty('--ui-scale', String(UI_SCALES[scaleIdx]));
  applyScale();

  /* ----------------------------- loader ----------------------------- */
  const loaderFill = el('span', { class: 'loader-fill' });
  const loaderCaption = el('p', { class: 'loader-caption', 'aria-live': 'polite', text: t('Loading') });
  const loader = el('div', { class: 'loader', role: 'status', 'aria-label': t('Loading') }, [
    el('div', { class: 'loader-inner' }, [
      el('span', { class: 'diamond', 'aria-hidden': 'true' }),
      el('h1', { class: 'wordmark', text: B.name }),
      el('p', { class: 'loader-dev', text: B.developer }),
      el('div', { class: 'loader-line', 'aria-hidden': 'true' }, [loaderFill]),
      loaderCaption,
    ]),
  ]);
  let loaderShown = false, gotProgress = false;
  function showLoader(mini = false) {
    loader.classList.toggle('mini', mini);
    loader.classList.remove('done');
    if (!loader.isConnected) root.appendChild(loader);
    loaderShown = true;
  }
  function hideLoader() {
    if (!loader.isConnected) return;
    loader.classList.add('done');
    setTimeout(() => { if (loader.classList.contains('done')) loader.remove(); }, 750);
    loaderShown = false;
  }
  function welcomeText() { return t.languages.map((l) => (l === t.lang ? t('Welcome') : null)).filter(Boolean).join(' · ') || t('Welcome'); }
  function progress({ p = 0, label = '' } = {}) {
    if (!gotProgress) { gotProgress = true; loader.classList.add('determinate'); }
    loaderFill.style.transform = `scaleX(${Math.max(0, Math.min(1, p)).toFixed(3)})`;
    const key = STAGES[label] || (label.startsWith('Building ') ? 'Adding details' : null);
    if (key) loaderCaption.textContent = key === 'Welcome' ? welcomeText() : t(key);
  }

  /* ----------------------------- embed ----------------------------- */
  const embed = params.embed ? mountEmbed({ root, SPEC, params, t, el }) : null;

  /* ----------------------------- shared panel builder ----------------------------- */
  function buildPanel(app, { onClose } = {}) {
    const facts = el('div', { class: 'facts' }, B.facts.map((f) => el('div', { class: 'fact' }, [
      el('span', { class: 'fact-v', text: f.v }), el('span', { class: 'fact-k', text: t(f.k) }),
    ])));
    const cards = el('ul', { class: 'cards' }, B.amenities.map((a, i) => {
      const view = AMENITY_VIEWS[a.id];
      const body = [
        el('span', { class: 'card-n', text: String(i + 1).padStart(2, '0'), 'aria-hidden': 'true' }),
        el('span', { class: 'card-body' }, [el('span', { class: 'card-t', text: a.title }), el('span', { class: 'card-x', text: a.text })]),
      ];
      if (view && app && SPEC.cameras[view]) {
        body.push(el('span', { class: 'card-go', html: svg('arrow'), 'aria-hidden': 'true' }));
        return el('li', {}, [el('button', { class: 'card card-btn', type: 'button', 'aria-label': `${a.title}: ${t('Fly to view')}`, onClick: () => { app.tour.stop(); app.setView(view); if (isPhone()) closePanelFn?.(); } }, body)]);
      }
      return el('li', {}, [el('div', { class: 'card' }, body)]);
    }));
    const ctas = el('div', { class: 'ctas' }, B.cta.map((c, i) => el('a', {
      class: 'btn ' + (i === 0 ? 'btn-gold' : 'btn-line'), href: safeHref(c.href), target: c.target === '_blank' ? '_blank' : '_top',
      rel: 'noopener', 'data-cta': c.id, text: i === 0 ? t('Enquire now') : c.label,
      onClick: () => embed?.post('ctaClicked', { id: c.id }),
    })));
    const reg = B.regulatory && B.regulatory.show ? el('div', { class: 'reg' }, [
      el('div', { class: 'reg-qr', 'aria-hidden': 'true' }, [el('span', { text: 'QR' })]),
      el('div', {}, [
        el('span', { class: 'reg-l', text: B.regulatory.label || t('Registration') }),
        el('span', { class: 'reg-n', text: B.regulatory.number }),
        el('span', { class: 'reg-ph', text: t('QR placeholder') }),
      ]),
    ]) : null;
    const closeBtn = onClose ? el('button', { class: 'icon-btn panel-close', type: 'button', 'aria-label': t('Close'), title: t('Close'), html: svg('close'), onClick: onClose }) : null;
    return el('aside', { class: 'panel', 'aria-label': t('Details') }, [
      el('div', { class: 'panel-grip', 'aria-hidden': 'true' }),
      closeBtn,
      el('div', { class: 'panel-scroll' }, [
        el('header', { class: 'hero-band' }, [
          el('span', { class: 'ph-badge', text: t('Placeholder content') }),
          el('p', { class: 'eyebrow', text: B.developer }),
          el('h2', { class: 'panel-title', text: B.name }),
          el('p', { class: 'loc', text: B.locationText }),
          el('p', { class: 'tagline', text: B.tagline }),
        ]),
        el('section', { class: 'sec' }, [el('h3', { class: 'sec-h' }, [el('span', { class: 'sec-n', text: '01' }), t('Key facts')]), facts]),
        el('section', { class: 'sec' }, [el('h3', { class: 'sec-h' }, [el('span', { class: 'sec-n', text: '02' }), t('Amenities')]), cards]),
        el('section', { class: 'sec' }, [el('h3', { class: 'sec-h' }, [el('span', { class: 'sec-n', text: '03' }), t('Registration')]),
          el('div', { class: 'panel-foot' }, [reg, el('p', { class: 'disclaimer', text: B.disclaimer })])]),
      ]),
      ctas,                                         // pinned at the bottom of the panel: always visible
    ]);
  }
  let closePanelFn = null;

  /* ----------------------------- attach (live 3D) ----------------------------- */
  function attach(app) {
    const cams = SPEC.cameras;
    const views = VIEW_ORDER.filter((v) => cams[v]).concat(Object.keys(cams).filter((v) => !VIEW_ORDER.includes(v)));
    const canvas = document.getElementById('c');
    let presenting = false, blanked = false, busyView = null, hideTagsUntil = 0, tourEnded = false, panelOpen = false;

    // crossfade loader + poster to the live canvas
    loaderFill.style.transform = 'scaleX(1)';
    loaderCaption.textContent = welcomeText();
    setTimeout(hideLoader, 450);
    if (poster) { poster.classList.add('fade'); setTimeout(() => poster.remove(), 1000); }

    /* --- top bar --- */
    const tourBtn = el('button', { class: 'btn btn-line tour-btn', type: 'button', 'aria-pressed': 'false', onClick: () => (app.tour.playing() ? app.tour.stop() : startTour()) }, [
      el('span', { class: 'ico', html: svg('play') }), el('span', { class: 'lbl', text: t('Tour') }),
    ]);
    const chips = TOD.map(([label, k]) => el('button', { class: 'chip', type: 'button', 'data-k': k, 'aria-pressed': 'false', text: t(label), onClick: () => { app.setTime(k); } }));
    const slider = el('input', { class: 'tod-slider', type: 'range', min: 0, max: 1, step: 0.01, value: app.getTime(), 'aria-label': t('Time of day'),
      onInput: (e) => app.setTime(Number(e.target.value)) });
    const todGroup = el('div', { class: 'tod', role: 'group', 'aria-label': t('Time of day') }, [...chips, slider]);
    const presentBtn = el('button', { class: 'icon-btn present-btn', type: 'button', 'aria-label': t('Presentation') + ' (P)', title: t('Presentation') + ' (P)', html: svg('present'), onClick: () => setPresent(!presenting) });
    const snapBtn = el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('Snapshot'), title: t('Snapshot'), html: svg('camera'), onClick: snapshot });
    const fsBtn = document.fullscreenEnabled ? el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('Fullscreen'), title: t('Fullscreen'), html: svg('expand'), onClick: toggleFullscreen }) : null;
    const sizeBtn = el('button', { class: 'icon-btn size-btn', type: 'button', 'aria-label': t('UI size'), title: t('UI size'), html: svg('size'), onClick: () => { scaleIdx = (scaleIdx + 1) % UI_SCALES.length; store.set('ui-scale', UI_SCALES[scaleIdx]); applyScale(); measure(); } });
    const infoBtn = minimal ? null : el('button', { class: 'icon-btn info-btn', type: 'button', 'aria-label': t('Details'), title: t('Details'), 'aria-expanded': 'false', html: svg('info'), onClick: () => setPanel(!panelOpen) });
    const langs = t.languages.length > 1 ? el('div', { class: 'langs', role: 'group', 'aria-label': t('Language') }, t.languages.map((l) => el('a', {
      class: 'chip' + (l === t.lang ? ' on' : ''), href: '?' + new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(location.search)), lang: l }), lang: l, text: LANG_LABEL[l] || l,
    }))) : null;
    const topbar = el('header', { class: 'topbar' }, [
      el('div', { class: 'brand' }, [el('span', { class: 'diamond-sm', 'aria-hidden': 'true' }), el('div', {}, [
        el('span', { class: 'brand-name', text: B.name }), el('span', { class: 'brand-sub', text: B.developer }),
      ])]),
      el('div', { class: 'tools' }, [tourBtn, todGroup, el('span', { class: 'sep', 'aria-hidden': 'true' }), langs, minimal ? null : presentBtn, snapBtn, fsBtn, minimal ? null : sizeBtn, infoBtn]),
    ]);

    /* --- view dock --- */
    const dockBtns = {};
    const dock = el('nav', { class: 'dock', 'aria-label': t('Views') }, [el('div', { class: 'dock-in' }, views.map((id) => {
      const b = el('button', { class: 'dock-btn', type: 'button', 'data-view': id, 'aria-pressed': 'false', text: t(cams[id].label || id),
        onClick: () => { app.tour.stop(); if (app.getView() === id && id !== 'orbit') return; app.setView(id); } });
      dockBtns[id] = b; return b;
    }))]);

    /* --- panel --- */
    const panel = minimal ? null : buildPanel(app, { onClose: () => setPanel(false) });
    function setPanel(on) {
      if (!panel) return;
      panelOpen = on;
      panel.classList.toggle('open', on);
      document.body.classList.toggle('panel-open', on);
      infoBtn?.setAttribute('aria-expanded', String(on));
      if (on && isPhone()) panel.querySelector('.panel-close')?.focus({ preventScroll: true });
      measure();
    }
    closePanelFn = () => setPanel(false);
    const minCta = minimal && B.cta[0] ? el('a', { class: 'btn btn-gold min-cta', href: safeHref(B.cta[0].href), target: '_top', rel: 'noopener', text: t('Enquire now'), onClick: () => embed?.post('ctaClicked', { id: B.cta[0].id }) }) : null;

    /* --- caption / tags / overlays --- */
    const capText = el('p', { class: 'cap-text' });
    const caption = el('div', { class: 'caption', 'aria-live': 'polite' }, [el('span', { class: 'ph-badge', text: t('Placeholder caption') }), capText]);
    const tagLayer = el('div', { class: 'tags', 'aria-hidden': 'true' });
    const toast = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    const live = el('div', { class: 'sr-only', 'aria-live': 'polite' });
    const chrome = el('div', { class: 'chrome' }, [tagLayer, topbar, caption, dock, panel, minCta]);
    const letterbox = el('div', { class: 'letterbox', 'aria-hidden': 'true' }, [el('span', { class: 'lb-top' }), el('span', { class: 'lb-bot' })]);
    const presentTitle = el('div', { class: 'present-title', 'aria-live': 'polite' });
    const blank = el('div', { class: 'blank', 'aria-label': t('Blank screen') });
    root.append(chrome, letterbox, presentTitle, blank, toast, live);
    requestAnimationFrame(() => chrome.classList.add('in'));
    if (!minimal && !params.embed && !isPhone() && innerWidth >= 1100) setPanel(true);

    let toastTimer = 0;
    function say(msg) { toast.textContent = msg; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2400); }

    /* --- views --- */
    function onView({ id }) {
      for (const [v, b] of Object.entries(dockBtns)) { const on = v === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); if (on && b.scrollIntoView && isPhone()) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' }); }
      const label = t(cams[id]?.label || id);
      canvas.setAttribute('aria-label', `${t('Interactive 3D view')}: ${B.name}, ${label}`);
      live.textContent = label;
      hideTagsUntil = performance.now() + (reduceMotion ? 150 : (app.tour.playing() ? 2750 : 2050));
      document.body.classList.toggle('interior', !!cams[id]?.interior);
      if (presenting) { presentTitle.textContent = label; presentTitle.classList.remove('show'); void presentTitle.offsetWidth; presentTitle.classList.add('show'); }
      if (busyView === id) { busyView = null; hideLoader(); }
    }
    app.on('view', onView);
    onView({ id: app.getView() });

    // interior lazy-load progress reuses the loader in a compact form
    app.on('progress', ({ p, label }) => {
      if (label === 'Preparing interior' && p < 1) { busyView = 'gym'; loaderFill.style.transform = 'scaleX(0.15)'; loader.classList.remove('determinate'); loaderCaption.textContent = t('Preparing interior'); showLoader(true); }
      else if (p >= 1 && loaderShown) { loaderFill.style.transform = 'scaleX(1)'; setTimeout(hideLoader, 200); }
    });
    app.on('error', ({ code }) => { if (code === 'interior') { hideLoader(); say(t('Something went wrong loading the interior.')); } });

    /* --- time of day --- */
    function onTime({ k }) {
      slider.value = String(k);
      for (const c of chips) { const on = Math.abs(Number(c.dataset.k) - k) < 0.02; c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); }
    }
    app.on('time', onTime);
    onTime({ k: app.getTime() });

    /* --- tour --- */
    let capTimer = 0;
    function showCaption(text) { clearTimeout(capTimer); capText.textContent = t(text); caption.classList.add('show'); }
    function hideCaption(delay = 0) { clearTimeout(capTimer); capTimer = setTimeout(() => caption.classList.remove('show'), delay); }
    function startTour() { if (app.isInterior()) app.setView('hero', { instant: true }); app.tour.play(); }
    app.on('tour', ({ playing }) => {
      tourBtn.setAttribute('aria-pressed', String(playing));
      tourBtn.classList.toggle('on', playing);
      tourBtn.querySelector('.ico').innerHTML = svg(playing ? 'stop' : 'play');
      tourBtn.querySelector('.lbl').textContent = t(playing ? 'Stop tour' : 'Tour');
      if (playing) showCaption(CAPTIONS[SPEC.tour[0]] || 'Placeholder caption');
      else if (!tourEnded) hideCaption(600);
      tourEnded = false;
    });
    app.on('tourStep', ({ id }) => { if (CAPTIONS[id]) showCaption(CAPTIONS[id]); });
    app.on('tourEnd', () => {
      tourEnded = true;
      showCaption('Enquire to learn more about the project.');
      hideCaption(7000);
      if (panel && !isPhone()) setPanel(true);
      const c = panel?.querySelector('.btn-gold') || minCta; c?.classList.add('pulse'); setTimeout(() => c?.classList.remove('pulse'), 4000);
    });
    // any input pauses the tour (core also stops it on orbit start)
    const stopTour = () => { if (app.tour.playing()) app.tour.stop(); };
    canvas.addEventListener('wheel', stopTour, { passive: true });
    canvas.addEventListener('pointerdown', stopTour);
    // gentle attract mode: auto-play after a long idle (never with reduced motion, in embeds or when presenting)
    let idleTimer = 0;
    const IDLE_MS = 75000;
    const armIdle = () => {
      clearTimeout(idleTimer);
      if (reduceMotion || params.embed || params.freeze) return;
      idleTimer = setTimeout(() => { if (!presenting && !app.tour.playing() && !app.isInterior() && !document.hidden) startTour(); }, IDLE_MS);
    };
    for (const e of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(e, armIdle, { passive: true });
    armIdle();

    /* --- floating tags --- */
    const tw = SPEC.towers, st = SPEC.site;
    const roofY = (x) => x.stiltH + x.floors * x.floorH + 6;
    const gate = st.gates.find((g) => g.id === 'gateE') || st.gates[0];
    const anchors = [
      tw[0] && { label: tw[0].label || 'Tower A', pos: [tw[0].c[0], roofY(tw[0]), tw[0].c[1]] },
      tw[1] && { label: tw[1].label || 'Tower B', pos: [tw[1].c[0], roofY(tw[1]), tw[1].c[1]] },
      { label: 'Clubhouse', pos: [st.clubhouse.c[0], st.clubhouse.parapetTop + 1.5, st.clubhouse.c[1]] },
      { label: 'Pool', pos: [st.pool.basin.c[0], 1.0, st.pool.basin.c[1]] },
      { label: 'Play area', pos: [st.plaza.play.c[0], 2.5, st.plaza.play.c[1]] },
      { label: 'Plaza', pos: [st.plaza.treeRing.c[0], 6, st.plaza.treeRing.c[1]] },
      gate && { label: 'Entrance', pos: [gate.c[0], gate.apex + 1.5, gate.c[1]] },
    ].filter(Boolean).map((a) => {
      const plate = el('span', { class: 'tag-plate', text: t(a.label) });
      const node = el('div', { class: 'tag' }, [el('span', { class: 'tag-pin' }), el('span', { class: 'tag-leader' }), plate]);
      tagLayer.appendChild(node);
      return { ...a, node, plate, w: 0, h: 0, shown: false };
    });
    let blockers = [], topLimit = 0, leader = 34;
    function measure() {
      requestAnimationFrame(() => {
        for (const a of anchors) { a.w = a.plate.offsetWidth; a.h = a.plate.offsetHeight; }
        const r = (n) => (n && n.offsetParent !== null ? n.getBoundingClientRect() : null);
        topLimit = Math.max(topbar.getBoundingClientRect().bottom || 64, todGroup.getBoundingClientRect().bottom || 0) + 6;
        blockers = [r(dock), panelOpen ? r(panel) : null, r(minCta)].filter(Boolean);
        leader = isPhone() ? 22 : 34;
      });
    }
    measure();
    addEventListener('resize', measure);
    const hit = (a, b, pad = 6) => a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.y0 < b.y1 + pad && a.y1 > b.y0 - pad;
    function setShown(a, on) { if (a.shown !== on) { a.shown = on; a.node.classList.toggle('show', on); } }
    app.on('frame', () => {
      const hideAll = presenting || app.isInterior() || performance.now() < hideTagsUntil;
      if (hideAll) { for (const a of anchors) setShown(a, false); return; }
      const max = isPhone() ? 4 : anchors.length;
      const placed = [];
      const pos = anchors.map((a) => app.project(a.pos));       // read phase
      anchors.forEach((a, i) => {                               // write phase
        const p = pos[i];
        let ok = p.visible && placed.length < max;
        if (ok) {
          const rect = { x0: p.x - a.w / 2, x1: p.x + a.w / 2, y0: p.y - leader - a.h, y1: p.y + 6 };
          ok = rect.y0 > topLimit && rect.x0 > 4 && rect.x1 < innerWidth - 4 && !blockers.some((b) => hit(rect, { x0: b.left, x1: b.right, y0: b.top, y1: b.bottom }, 2)) && !placed.some((q) => hit(rect, q));
          if (ok) { placed.push(rect); a.node.style.transform = `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0)`; }
        }
        setShown(a, ok);
      });
    });

    /* --- presentation mode --- */
    function setPresent(on) {
      presenting = on;
      document.body.classList.toggle('present', on);
      presentBtn.setAttribute('aria-pressed', String(on));
      if (!on) setBlank(false);
      say(on ? t('Presentation') + ' · P / Esc' : t('Exit presentation'));
    }
    function setBlank(on) { blanked = on; blank.classList.toggle('on', on); }
    function step(dir) {
      app.tour.stop();
      const i = views.indexOf(app.getView());
      const next = views[(i + dir + views.length) % views.length];
      app.setView(next);
    }
    addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) && !presenting) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      stopTour();
      if (k === 'p' || k === 'P') { setPresent(!presenting); e.preventDefault(); return; }
      if (!presenting) return;
      if (k === 'Escape') { setPresent(false); return; }
      if (k === 'b' || k === 'B' || k === '.') { setBlank(!blanked); e.preventDefault(); return; }
      if (blanked) { setBlank(false); }
      if (['PageDown', 'ArrowRight', 'ArrowDown', ' ', 'Spacebar'].includes(k)) { step(1); e.preventDefault(); }
      else if (['PageUp', 'ArrowLeft', 'ArrowUp'].includes(k)) { step(-1); e.preventDefault(); }
    });

    /* --- snapshot / fullscreen --- */
    async function snapshot() {
      snapBtn.disabled = true;
      try {
        const blob = await app.snapshot();
        if (!blob) throw new Error('empty');
        const url = URL.createObjectURL(blob);
        const a = el('a', { href: url, download: `${slug(B.name)}-${slug(app.getView())}.png` });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        say(t('Snapshot saved'));
      } catch (err) { console.warn('[snapshot]', err); say(t('Snapshot failed')); }
      snapBtn.disabled = false;
    }
    function toggleFullscreen() {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(noop);
      else document.documentElement.requestFullscreen?.().catch(noop);
    }
    document.addEventListener('fullscreenchange', () => {
      if (!fsBtn) return;
      const on = !!document.fullscreenElement;
      fsBtn.innerHTML = svg(on ? 'shrink' : 'expand');
      fsBtn.setAttribute('aria-label', t(on ? 'Exit fullscreen' : 'Fullscreen')); fsBtn.title = t(on ? 'Exit fullscreen' : 'Fullscreen');
      measure();
    });

    /* --- fallback after context loss --- */
    app.on('fallback', () => showGallery(app));

    /* --- embed --- */
    if (embed) {
      embed.attach(app);
    }
    // Tour never autoplays with reduced motion; otherwise only via the idle attract timer above.
  }

  /* ----------------------------- gallery fallback ----------------------------- */
  let galleryShown = false;
  function showGallery() {
    if (galleryShown) return; galleryShown = true;
    hideLoader();
    poster?.remove();
    root.querySelector('.chrome')?.remove();
    const ids = VIEW_ORDER.filter((v) => SPEC.cameras[v] && v !== 'orbit');
    let i = 0;
    const img = el('img', { class: 'gal-img', alt: '' });
    const figCap = el('figcaption', { class: 'gal-cap' });
    const fig = el('figure', { class: 'gal-fig' }, [
      el('div', { class: 'gal-missing', 'aria-hidden': 'true' }, [el('span', { class: 'diamond' }), el('span', { text: t('Image coming soon') })]),
      img, figCap,
    ]);
    img.addEventListener('error', () => fig.classList.add('missing'));
    img.addEventListener('load', () => fig.classList.remove('missing'));
    const thumbs = ids.map((id, n) => {
      const ti = el('img', { alt: '', loading: 'lazy', src: `assets/views/${id}.jpg` });
      const b = el('button', { class: 'gal-thumb', type: 'button', 'aria-label': t(SPEC.cameras[id].label || id), onClick: () => show(n) }, [ti, el('span', { text: t(SPEC.cameras[id].label || id) })]);
      ti.addEventListener('error', () => { b.classList.add('missing'); ti.remove(); });
      return b;
    });
    function show(n) {
      i = (n + ids.length) % ids.length;
      const id = ids[i];
      fig.classList.remove('missing');
      img.src = `assets/views/${id}.jpg`;
      img.alt = `${B.name}: ${t(SPEC.cameras[id].label || id)}`;
      figCap.textContent = t(SPEC.cameras[id].label || id);
      thumbs.forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
    }
    const gallery = el('div', { class: 'gallery', role: 'region', 'aria-label': t('Gallery') }, [
      el('header', { class: 'topbar' }, [el('div', { class: 'brand' }, [el('span', { class: 'diamond-sm', 'aria-hidden': 'true' }), el('div', {}, [
        el('span', { class: 'brand-name', text: B.name }), el('span', { class: 'brand-sub', text: B.developer }),
      ])])]),
      el('div', { class: 'gal-main' }, [
        el('p', { class: 'gal-note', text: t('This device cannot show the live 3D view. Showing still images instead.') }),
        el('div', { class: 'gal-stage' }, [
          el('button', { class: 'icon-btn gal-prev', type: 'button', 'aria-label': t('Previous'), html: svg('left'), onClick: () => show(i - 1) }),
          fig,
          el('button', { class: 'icon-btn gal-next', type: 'button', 'aria-label': t('Next'), html: svg('right'), onClick: () => show(i + 1) }),
        ]),
        el('div', { class: 'gal-thumbs' }, thumbs),
      ]),
      buildPanel(null),
    ]);
    root.appendChild(gallery);
    show(0);
  }

  return {
    loading(on) {
      if (on) showLoader(false); else hideLoader();
    },
    progress,
    attach(app) { try { attach(app); } catch (err) { console.error('[ui]', err); } },
    fallback(err) { if (err) console.warn('[ui] fallback', err); showGallery(); },
    onStartRequested(fn) { if (embed) embed.requestStart(fn); else fn(); },
  };
}
