// First-person walk controller for interiors (v1.15). Browser only; core creates it and calls update(dt) every frame
// while a view with `mode: 'walk'` is active (OrbitControls are skipped then).
// Look: drag (mouse, pen or touch; "grab the scene" like a street-level photo viewer), no pointer lock.
// Move: WASD / arrow keys (left/right arrows turn), Shift to walk faster, the on-screen joystick (setStick), or a
// short tap/click on the floor to walk there. Collision: a circle (radius r) against axis-aligned rectangles
// [x0, z0, x1, z1] in plan, resolved with sub-steps so it never tunnels through a 115 mm partition.
const LOOK = (0.24 * Math.PI) / 180;                        // radians per CSS pixel of drag
const PITCH = (60 * Math.PI) / 180;

export function createWalk({ THREE, camera, dom, onExit = () => {}, onMove = () => {} }) {
  let enabled = false, yaw = 0, pitch = 0, colliders = [], bounds = null, eye = 1.6, r = 0.25;
  const pos = { x: 0, z: 0 }, vel = { x: 0, z: 0 };
  const keys = new Set(), stick = { x: 0, y: 0 };
  let auto = null, drag = null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();

  function apply() {
    camera.position.set(pos.x, eye, pos.z);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    camera.updateMatrixWorld();
  }
  function resolve() {
    for (let it = 0; it < 3; it++) {
      for (const [x0, z0, x1, z1] of colliders) {
        const cx = Math.min(Math.max(pos.x, x0), x1), cz = Math.min(Math.max(pos.z, z0), z1);
        const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; pos.x += dx * k; pos.z += dz * k; }
        else {                                                // centre inside the box: leave by the shortest side
          const L = pos.x - x0, R = x1 - pos.x, T = pos.z - z0, Bm = z1 - pos.z, m = Math.min(L, R, T, Bm);
          if (m === L) pos.x = x0 - r; else if (m === R) pos.x = x1 + r; else if (m === T) pos.z = z0 - r; else pos.z = z1 + r;
        }
      }
      if (bounds) { pos.x = Math.min(Math.max(pos.x, bounds.x[0] + r), bounds.x[1] - r); pos.z = Math.min(Math.max(pos.z, bounds.z[0] + r), bounds.z[1] - r); }
    }
  }

  /* ---------------- input ---------------- */
  const typing = (e) => /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable);
  const KEY = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', d: 'r', arrowleft: 'tl', arrowright: 'tr', shift: 'run', q: 'tl', e: 'tr' };
  function onKeyDown(e) {
    if (!enabled || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { onExit(); return; }
    const a = KEY[k]; if (!a) return;
    keys.add(a); auto = null; e.preventDefault();
  }
  function onKeyUp(e) { const a = KEY[(e.key || '').toLowerCase()]; if (a) keys.delete(a); }
  function onBlur() { keys.clear(); }
  function onDown(e) {
    if (!enabled || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false };
    dom.setPointerCapture?.(e.pointerId);
  }
  function onMoveP(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) { drag.moved = true; auto = null; }
    if (!drag.moved) return;
    yaw += dx * LOOK; pitch = Math.min(PITCH, Math.max(-PITCH, pitch + dy * LOOK));
    onMove();
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const tap = !drag.moved && performance.now() - drag.t < 350;
    drag = null;
    if (tap && enabled) walkTo(e.clientX, e.clientY);
  }
  function walkTo(clientX, clientY) {
    const rect = dom.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    camera.updateMatrixWorld();
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    if (d.y > -0.05) return;                                 // tapped at or above the horizon
    const t = -o.y / d.y; if (t > 14) return;
    auto = { x: o.x + d.x * t, z: o.z + d.z * t, best: Infinity, since: performance.now() };
    onMove();
  }
  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointermove', onMoveP);
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointercancel', onUp);
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', onBlur);

  return {
    /** Start walking from a preset pose: { pos: [x, y, z], target: [x, y, z] }. */
    enable({ pos: p, target: tg }, world) {
      colliders = world.colliders || []; bounds = world.bounds || null; eye = world.eye || 1.6; r = world.radius || 0.25;
      pos.x = p[0]; pos.z = p[2];
      const dx = tg[0] - p[0], dy = tg[1] - p[1], dz = tg[2] - p[2];
      yaw = Math.atan2(-dx, -dz); pitch = Math.atan2(dy, Math.hypot(dx, dz));
      vel.x = vel.z = 0; auto = null; keys.clear(); stick.x = stick.y = 0;
      resolve(); enabled = true;
    },
    disable() { enabled = false; keys.clear(); auto = null; drag = null; stick.x = stick.y = 0; },
    enabled: () => enabled,
    /** Joystick input, x right / y down, each -1..1. */
    setStick(x, y) { stick.x = x; stick.y = y; if (x || y) { auto = null; onMove(); } },
    /** A point in front of the eye (for handing the camera back to orbit controls). */
    lookTarget(dist = 2) { return [pos.x - Math.sin(yaw) * Math.cos(pitch) * dist, eye + Math.sin(pitch) * dist, pos.z - Math.cos(yaw) * Math.cos(pitch) * dist]; },
    update(dt) {
      if (!enabled) return;
      let fwd = 0, right = 0;
      if (keys.has('f')) fwd += 1; if (keys.has('b')) fwd -= 1; if (keys.has('r')) right += 1; if (keys.has('l')) right -= 1;
      if (keys.has('tl')) yaw += 1.7 * dt; if (keys.has('tr')) yaw -= 1.7 * dt;
      fwd -= stick.y; right += stick.x;
      const m = Math.hypot(fwd, right); if (m > 1) { fwd /= m; right /= m; }
      const speed = keys.has('run') ? 2.2 : 1.4, sin = Math.sin(yaw), cos = Math.cos(yaw);
      let vx = (-sin * fwd + cos * right) * speed, vz = (-cos * fwd - sin * right) * speed;
      if (m > 0.01 || keys.has('tl') || keys.has('tr')) onMove();
      if (auto) {
        const ax = auto.x - pos.x, az = auto.z - pos.z, d = Math.hypot(ax, az);
        if (d < 0.12 || performance.now() - auto.since > 900 && d > auto.best - 0.05) auto = null;   // arrived, or stuck
        else {
          if (d < auto.best - 0.05) { auto.best = d; auto.since = performance.now(); }
          const sp = Math.min(1.4, d * 2.2); vx = (ax / d) * sp; vz = (az / d) * sp;
          let want = Math.atan2(-ax, -az) - yaw; want = Math.atan2(Math.sin(want), Math.cos(want));   // turn toward travel
          yaw += want * (1 - Math.exp(-2.5 * dt));
        }
      }
      const k = 1 - Math.exp(-(reduce ? 20 : 8) * dt);
      vel.x += (vx - vel.x) * k; vel.z += (vz - vel.z) * k;
      const step = Math.hypot(vel.x, vel.z) * dt, n = Math.max(1, Math.ceil(step / 0.05));
      for (let i = 0; i < n; i++) { pos.x += (vel.x * dt) / n; pos.z += (vel.z * dt) / n; resolve(); }
      apply();
    },
    dispose() {
      dom.removeEventListener('pointerdown', onDown); dom.removeEventListener('pointermove', onMoveP);
      dom.removeEventListener('pointerup', onUp); dom.removeEventListener('pointercancel', onUp);
      removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur);
    },
  };
}
