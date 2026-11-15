// UI (stub). Owner: UI agent. Contract used by main.js:
// mountUI({root, SPEC, params}) -> { loading(on), attach(app), fallback(err?), onStartRequested(fn) }
export function mountUI({ root, SPEC, params }) {
  const app$ = { app: null };
  const progressEl = document.createElement('div');
  progressEl.style.cssText = 'position:fixed;left:16px;bottom:16px;color:#ccc;font:12px sans-serif;z-index:10';
  root.appendChild(progressEl);
  return {
    loading(on) { progressEl.textContent = on ? 'Loading…' : ''; },
    attach(app) { app$.app = app; progressEl.textContent = ''; document.getElementById('poster')?.remove(); },
    fallback(err) { progressEl.textContent = 'This device cannot show the 3D view.' + (err ? ' ' + err.message : ''); },
    onStartRequested(fn) { fn(); },
  };
}
