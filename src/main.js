// Boot: UI shell first (loader/poster), then the 3D app. Embed mode may defer the 3D start until activated.
import { createApp } from './core.js';
import { mountUI } from './ui.js';
import SPEC from './spec/index.js';
import { parseParams } from './params.js';

const params = parseParams(location.search, SPEC);
const canvas = document.getElementById('c');
const poster = document.getElementById('poster');
if (poster && !params.shot) poster.src = poster.dataset.src;   // poster-first (skipped in shot mode)
const ui = mountUI({ root: document.getElementById('ui'), SPEC, params });

async function start() {
  ui.loading(true);
  try {
    const app = await createApp({ canvas, container: document.getElementById('stage') });
    if (app.fallback) { ui.fallback(); return; }
    ui.attach(app);
  } catch (err) {
    console.error(err);
    ui.fallback(err);
  }
}

if (location.protocol !== 'file:') {
  if (params.embed && !params.autostart) ui.onStartRequested(start); else start();
}
