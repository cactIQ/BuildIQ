// Core runtime: renderer, sky/env keyframes, sun + fitted static shadows, time of day, views (with shift lens),
// flights, tour, module loading, warm-up, reports and the public `app` API used by the UI and embed layers.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSkyMaterial, applySky } from './sky.js';
import { installGrade, setLook, getLook, resolveLook, LOOK_U } from './grade.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import SPEC from './spec/index.js';
import { parseParams, resolutionScale, dynResStep, shiftLens, presetTanV, todBlend, easeInOutCubic } from './params.js';
import { makeRng, Registry } from './util.js';
import * as util from './util.js';
import { createTextures } from './textures.js';
import { createMaterialLib, defineBaseMaterials } from './materials/base.js';
import { validateRegistry } from './validate.js';

const EXTERIOR_MODULES = ['site', 'tower', 'amenities', 'vegetation', 'props'];
const MODULE_FILES = { site: './site.js', tower: './tower.js', amenities: './amenities.js', vegetation: './vegetation.js', props: './props.js', gym: './interior-gym.js' };
const MATERIAL_FILES = { site: './materials/site.js', tower: './materials/tower.js', amenities: './materials/amenities.js', vegetation: './materials/amenities.js', props: './materials/site.js', gym: './materials/gym.js' };

/* ----------------------------- tiny event bus ----------------------------- */
function bus() { const m = new Map(); return { on(e, f) { (m.get(e) || m.set(e, []).get(e)).push(f); return () => m.set(e, m.get(e).filter((x) => x !== f)); }, emit(e, d) { (m.get(e) || []).forEach((f) => { try { f(d); } catch (err) { console.error(err); } }); } }; }

/* ----------------------------- tier probe ----------------------------- */
function probeTier(params) {
  if (params.q) return params.q;
  try {
    const c = document.createElement('canvas'); const gl = c.getContext('webgl2');
    if (!gl) return 'none';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    if (mobile || /Mali|Adreno [1-5]|PowerVR|SwiftShader|Basic Render/i.test(r)) return 'low';
    return 'high';
  } catch { return 'low'; }
}

export async function createApp({ canvas, container = document.body, onProgress = null } = {}) {
  const ev = bus();
  if (onProgress) ev.on('progress', onProgress);
  const params = parseParams(location.search, SPEC);
  const t0 = performance.now();
  const bootMarks = {}; let lastMark = t0;
  const mark = (name) => { const n = performance.now(); bootMarks[name] = Math.round(n - lastMark); lastMark = n; };
  const tierName = probeTier(params);
  if (tierName === 'none') { ev.emit('fallback', { reason: 'no-webgl2' }); return { on: ev.on, fallback: true, SPEC, params }; }
  const tier = { name: tierName, ...SPEC.quality[tierName] };
  const progress = (p, label) => ev.emit('progress', { p, label });

  /* ----------------------------- renderer ----------------------------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  installGrade();                                  // v1.2: Neutral/ACES blend + saturation/contrast grade (src/grade.js)
  renderer.toneMapping = THREE.CustomToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;
  let dyn = 1;
  const applySize = () => {
    const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight;
    renderer.setPixelRatio(resolutionScale(devicePixelRatio || 1, w, h, tier.maxPx, dyn));
    renderer.setSize(w, h, false);
    viewAspect = w / h;
    // keep the current preset framing when the aspect changes (unless the user is orbiting freely)
    const p = SPEC.cameras[currentView]; if (p && !flight && !userMoved) lens = presetLens(p);
    applyLens();
  };

  let contextLosses = 0;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); contextLosses++; ev.emit('contextlost', { count: contextLosses }); if (contextLosses >= 2) ev.emit('fallback', { reason: 'context-lost' }); });
  canvas.addEventListener('webglcontextrestored', () => { renderer.shadowMap.needsUpdate = true; ev.emit('contextrestored', {}); });

  /* ----------------------------- scene, camera, controls ----------------------------- */
  const scene = new THREE.Scene();
  scene.name = 'Exterior';
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 2500);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = SPEC.orbitLimits.minDistance; controls.maxDistance = SPEC.orbitLimits.maxDistance;
  controls.minPolarAngle = SPEC.orbitLimits.minPolar; controls.maxPolarAngle = SPEC.orbitLimits.maxPolar;
  controls.zoomSpeed = 0.8; controls.rotateSpeed = 0.6; controls.panSpeed = 0.6;

  const rng = makeRng(SPEC.global.seed);
  const registry = new Registry();
  const tex = createTextures({ anisotropy: Math.min(tier.anisotropy, renderer.capabilities.getMaxAnisotropy()), lowTier: tier.name === 'low' });
  const ctx = { THREE, SPEC, util, rng, registry, tex, tier, renderer, params, M: null, lights: null, scene };
  const M = createMaterialLib(ctx); ctx.M = M;
  defineBaseMaterials(M, SPEC);

  /* ----------------------------- lights (fixed pool; never added/removed later) ----------------------------- */
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(tier.shadowMap, tier.shadowMap);
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xBFD4FF, 0x6B5E4A, 0);
  scene.add(hemi);
  const pointPool = [];
  // v1.5: 8 pooled lights (pool, 2 gates, 2 lobbies, clubhouse, plaza, parking); fixed at boot -> no recompiles
  for (let i = 0; i < 8; i++) { const p = new THREE.PointLight(0xffc27a, 0, 30, 2); p.castShadow = false; p.position.set(0, -50, 0); scene.add(p); pointPool.push({ light: p, owner: null }); }
  ctx.lights = {
    /** Claim a pooled point light (max 8). Set colour/position/distance; intensity is scaled by night factor * base. */
    claim(owner, { color = 0xffc27a, position = [0, 3, 0], distance = 30, intensity = 10 } = {}) {
      const slot = pointPool.find((s) => !s.owner);
      if (!slot) { console.error('[lights] pool exhausted by ' + owner); return null; }
      slot.owner = owner; slot.base = intensity; slot.light.color.set(color); slot.light.position.set(...position); slot.light.distance = distance;
      return slot.light;
    },
  };

  /* ----------------------------- sky, clouds, night dome ----------------------------- */
  // v1.1: art-directed clean-air sky (src/sky.js) replaces Preetham + the night dome; one program for all keyframes
  const skyMat = createSkyMaterial({ look: LOOK_U });   // v1.13: the visible sky follows the look (env bake sky stays neutral)
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1900, 48, 24), skyMat); sky.name = 'Sky'; sky.renderOrder = -2; sky.frustumCulled = false;
  scene.add(sky);
  const nightDome = sky;   // legacy name kept for applyDebug

  const cloudMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.BackSide, fog: false, color: 0xffffff, opacity: 0.6 });
  const cloudDome = new THREE.Mesh(new THREE.SphereGeometry(1700, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2), cloudMat);
  cloudDome.name = 'Clouds'; cloudDome.renderOrder = 0;
  scene.add(cloudDome);

  scene.fog = new THREE.FogExp2(0xC9D3DA, 0.0022);   // always on (never null -> no program change)

  /* ----------------------------- environment keyframes (PMREM) ----------------------------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSkyMat = createSkyMaterial();
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), envSkyMat); envSky.renderOrder = -2;
  envScene.add(envSky);
  const envGround = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({ color: 0x6f6a62 }));
  envGround.rotation.x = -Math.PI / 2; envGround.position.y = -1.2; envScene.add(envGround);
  const silhouette = tex.canvas('envSilhouette', 1024, 128, (g, w, h) => {
    const r = util.mulberry32(99);
    g.clearRect(0, 0, w, h); g.fillStyle = '#ffffff';
    for (let x = 0; x < w; x += 6) { const tree = r() < 0.6; const hh = tree ? 30 + r() * 40 : 40 + r() * 70; if (tree) { g.beginPath(); g.arc(x, h - hh, 10 + r() * 10, 0, Math.PI * 2); g.fill(); g.fillRect(x - 2, h - hh, 4, hh); } else g.fillRect(x, h - hh, 5 + r() * 14, hh); }
  }, { srgb: true });
  const envBandMat = new THREE.MeshBasicMaterial({ map: silhouette, transparent: true, alphaTest: 0.3, side: THREE.BackSide, color: 0x4a4a46 });
  silhouette.colorSpace = THREE.SRGBColorSpace;
  const envBand = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 4, 48, 1, true), envBandMat); envBand.position.y = 0.6; envScene.add(envBand);

  // far treeline: a fogged silhouette ring gives a believable horizon beyond the modelled context (1 draw)
  const ftl = SPEC.site.farTreeline || { radius: 900, height: 38 };
  // v1.1: trees-only canopy (two depth layers of overlapping crowns + a continuous base) - no blocky "cardboard" shapes
  const ftlTex = tex.canvas('farTrees', 2048, 128, (g, w, h) => {
    const r = util.mulberry32(4242);
    g.clearRect(0, 0, w, h); g.fillStyle = '#ffffff';
    g.fillRect(0, h - 22, w, 22);
    for (const [step, base, amp, rad] of [[9, 26, 22, 9], [6, 18, 14, 7]]) {
      for (let x = -10; x < w + 10; x += step * (0.6 + r() * 0.8)) {
        const hh = base + r() * amp, rr = rad * (0.7 + r() * 0.7);
        g.beginPath(); g.arc(x, h - hh, rr, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(x + rr * 0.7, h - hh + rr * 0.35, rr * 0.8, 0, Math.PI * 2); g.fill();
        g.fillRect(x - rr, h - hh, rr * 2, hh);
      }
    }
  }, { srgb: true });
  ftlTex.wrapS = THREE.RepeatWrapping; ftlTex.repeat.set(6, 1); ftlTex.needsUpdate = true;
  // unlit ring: its tint is driven per keyframe (aerial-perspective blue-green by day, near-black at night)
  const farTreeMat = new THREE.MeshBasicMaterial({ map: ftlTex, alphaTest: 0.35, side: THREE.BackSide, color: 0x7E9A86, fog: true });
  const farTrees = new THREE.Mesh(new THREE.CylinderGeometry(ftl.radius, ftl.radius, ftl.height, 96, 1, true), farTreeMat);
  farTrees.position.y = ftl.height / 2 - 1; farTrees.name = 'FarTreeline'; farTrees.renderOrder = 1;
  scene.add(farTrees);
  const envMaps = [], ENV_STEPS = 8;

  /* ----------------------------- time of day ----------------------------- */
  const kfs = SPEC.global.timeOfDay.keyframes;
  let k = params.tod, todState = todBlend(kfs, k);
  const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3();
  const dirFrom = (elevDeg, azimDeg, out) => { const e = THREE.MathUtils.degToRad(elevDeg), a = THREE.MathUtils.degToRad(azimDeg); return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).normalize(); };
  const lerpColor = (ca, cb, t) => new THREE.Color(ca).lerp(new THREE.Color(cb), t);
  const kfById = Object.fromEntries(kfs.map((x) => [x.id, x]));

  function setSkyFor(state, mat, a, b, opts) {
    const d = dirFrom(state.skyElev, state.sunAzim, new THREE.Vector3());
    applySky(mat, a, b, state.t ?? 0, d, opts);
  }

  const shadowBox = new THREE.Box3(new THREE.Vector3(-85, 0, -75), new THREE.Vector3(85, 56, 75));
  function fitShadow() {
    // Orthographic frustum fitted to the light-space AABB of the site box (tower height included).
    const centre = shadowBox.getCenter(new THREE.Vector3());
    sun.position.copy(centre).addScaledVector(sunDir, 300); sun.target.position.copy(centre); sun.target.updateMatrixWorld();
    sun.updateMatrixWorld();
    const view = new THREE.Matrix4().lookAt(sun.position, centre, new THREE.Vector3(0, 1, 0));
    const inv = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(view)).invert();
    const pts = []; for (let i = 0; i < 8; i++) pts.push(new THREE.Vector3(i & 1 ? shadowBox.max.x : shadowBox.min.x, i & 2 ? shadowBox.max.y : shadowBox.min.y, i & 4 ? shadowBox.max.z : shadowBox.min.z));
    const lb = new THREE.Box3(); for (const p of pts) lb.expandByPoint(p.clone().sub(sun.position).applyMatrix4(inv));
    const cam = sun.shadow.camera;
    cam.left = lb.min.x; cam.right = lb.max.x; cam.bottom = lb.min.y; cam.top = lb.max.y;
    cam.near = Math.max(0.5, -lb.max.z - 5); cam.far = -lb.min.z + 5;
    cam.updateProjectionMatrix();
  }

  let shadowTimer = 0, lastShadowAt = 0;
  function applyTime(newK, { immediateShadow = false } = {}) {
    k = Math.min(1, Math.max(0, newK));
    const s = todState = todBlend(kfs, k);
    const a = kfById[s.a], b = kfById[s.b];
    // sun: clamp elevation >= 12 deg; fade intensity below via keyframe values
    // curated views may art-direct the sun azimuth (archviz practice); free orbit uses the keyframe azimuth
    // art-directed view sun: azimuth from the view; elevation never lower than ~80 % of the keyframe's, so a
    // curated low "golden" sun does not turn midday into a long-shadow evening (v1.1)
    dirFrom(Math.max(12, viewSun ? Math.max(viewSun.elev, s.sunElev * 0.8) : s.sunElev), viewSun?.azim ?? s.sunAzim, sunDir);
    // v1.2 moonlight: after dusk the key light swings to the moon (its own direction, consistent with the visible
    // moon in the sky) instead of re-using the art-directed sun azimuth
    const mn = SPEC.global.timeOfDay.moon, mw = THREE.MathUtils.smoothstep(s.night, 0.6, 0.95);
    dirFrom(mn.elev, mn.azim, moonDir);
    if (mw > 0) sunDir.lerp(moonDir, mw).normalize();
    dirFrom(mn.disc?.elev ?? mn.elev, mn.disc?.azim ?? mn.azim, skyMat.uniforms.uMoonDir.value);
    sun.color.copy(lerpColor(a.sunColor, b.sunColor, s.t));
    sun.intensity = s.sunI;
    hemi.intensity = s.hemi;
    hemi.color.copy(lerpColor(a.hemiSky, b.hemiSky, s.t)); hemi.groundColor.copy(lerpColor(a.hemiGround, b.hemiGround, s.t));
    renderer.toneMappingExposure = s.exposure;
    scene.fog.color.copy(lerpColor(a.fogColor, b.fogColor, s.t)); scene.fog.density = s.fog;
    // the visible sky's sun glow follows an art-directed view sun (env keyframes stay generic)
    setSkyFor(viewSun ? { ...s, sunAzim: viewSun.azim } : s, skyMat, a, b);
    farTreeMat.color.copy(lerpColor(a.farTree, b.farTree, s.t));
    // fair-weather cumulus: white by day, warm-lit at golden/dusk, faint blue-grey at night
    // v1.6: per-keyframe cloud colour (white -> peach -> dusk violet -> night blue-grey)
    cloudMat.color.copy(lerpColor(a.cloud || '#ffffff', b.cloud || '#ffffff', s.t));
    cloudMat.opacity = THREE.MathUtils.lerp(a.cloudA ?? 0.6, b.cloudA ?? 0.6, s.t);
    // environment: nearest pre-baked keyframe (same size => no recompile); intensity lerped
    const envI = envMaps[Math.round(k * ENV_STEPS)]; if (envI) scene.environment = envI;
    scene.environmentIntensity = s.envI;
    for (const sl of pointPool) if (sl.owner) sl.light.intensity = (sl.base || 10) * s.night;
    fitShadow();
    // v1.7: shadows follow the sun continuously while scrubbing (throttled to ~30 Hz), plus one settle update
    clearTimeout(shadowTimer);
    const nowT = performance.now();
    if (immediateShadow || nowT - lastShadowAt > 33) { renderer.shadowMap.needsUpdate = true; lastShadowAt = nowT; }
    shadowTimer = setTimeout(() => { renderer.shadowMap.needsUpdate = true; }, 60);
    for (const m of modules) m.onTimeOfDay?.(k, s);
    ev.emit('time', { k, state: s });
  }

  /* ----------------------------- lens / views ----------------------------- */
  // viewAspect = canvas aspect. With a shift lens the camera renders a crop of a taller virtual frame:
  // camera.aspect/fov describe the FULL frame; setViewOffset selects the visible crop (three's view API).
  let lens = { tanV: Math.tan((40 * Math.PI) / 360), shift: 0 };
  let viewAspect = 16 / 9;
  function applyLens() {
    const { fullFovDeg, cropFrac, offFrac } = shiftLens(lens.tanV, lens.shift);
    camera.fov = fullFovDeg;
    if (Math.abs(lens.shift) > 1e-4) {
      const cropH = 1000, W = cropH * viewAspect, fullH = cropH / cropFrac;
      camera.aspect = W / fullH;
      camera.setViewOffset(W, fullH, 0, offFrac * fullH, W, cropH);
    } else { camera.aspect = viewAspect; camera.clearViewOffset(); }
    camera.updateProjectionMatrix();
  }
  // v1.13: on portrait screens a preset may override its framing (`portrait: { fit, horizonY, hfov }`), so wide
  // reference frames (e.g. the ground-level elevation) crop their sides instead of shrinking the towers under a huge sky
  const presetFor = (p) => (viewAspect < 1 && p.portrait
    ? { ...p, ...p.portrait, shift: p.shift && p.portrait.horizonY != null ? { horizonY: p.portrait.horizonY } : p.shift }
    : p);
  const presetLens = (p) => { const q = presetFor(p); return { tanV: presetTanV(q, viewAspect), shift: q.shift ? q.shift.horizonY - 0.5 : 0 }; };

  let currentView = params.view, flight = null, viewSun = null;
  function setView(id, { instant = false, duration = 1.9 } = {}) {
    const p = SPEC.cameras[id]; if (!p) return false;
    // level shift-lens presets have polar = PI/2; OrbitControls would otherwise clamp them to maxPolar and tilt them
    controls.maxPolarAngle = p.shift ? Math.PI / 2 : SPEC.orbitLimits.maxPolar;
    if (!!p.interior !== !!activeInterior) return switchScene(id, p);
    currentView = id; userMoved = false; relaxShift = false;
    const nextSun = p.sun || null;   // {azim, elev}: art-directed sun for curated views (free orbit: keyframe sun)
    if (JSON.stringify(nextSun) !== JSON.stringify(viewSun)) { viewSun = nextSun; applyTime(k, { immediateShadow: true }); }
    const to = { pos: new THREE.Vector3(...p.pos), target: new THREE.Vector3(...p.target), lens: presetLens(p) };
    if (instant || params.freeze || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      camera.position.copy(to.pos); controls.target.copy(to.target); lens = to.lens; applyLens(); camera.lookAt(to.target); flight = null;
    } else {
      flight = { t: 0, dur: duration, from: { pos: camera.position.clone(), target: controls.target.clone(), lens: { ...lens } }, to };
    }
    if (typeof p.tod === 'number' && params.shot && !params.todExplicit) applyTime(p.tod, { immediateShadow: true });
    ev.emit('view', { id, preset: p });
    return true;
  }
  controls.addEventListener('start', () => { flight = null; userMoved = true; if (Math.abs(lens.shift) > 0) relaxShift = true; tourStop(); ev.emit('interact', {}); });
  let relaxShift = false, userMoved = false;

  /* ----------------------------- interior scene (lazy) ----------------------------- */
  let activeInterior = null, interior = null;
  async function switchScene(id, p) {
    if (p.interior) {
      if (!interior) {
        ev.emit('progress', { p: 0, label: 'Preparing interior' });
        const iscene = new THREE.Scene(); iscene.name = 'Interior';
        const roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        iscene.environment = roomEnv; iscene.environmentIntensity = 0.6;
        const ictx = { ...ctx, scene: iscene };
        try {
          await import(MATERIAL_FILES.gym).then((mm) => mm.define?.(M, SPEC)).catch(() => {});
          const mod = await import(MODULE_FILES.gym);
          const built = await mod.build(ictx);
          iscene.add(built.group);
          interior = { scene: iscene, mod: built };
          await renderer.compileAsync(iscene, camera);
        } catch (err) { console.error('[gym]', err); ev.emit('error', { code: 'interior' }); return false; }
        ev.emit('progress', { p: 1, label: '' });
      }
      activeInterior = interior; renderer.toneMapping = THREE.CustomToneMapping;   // same graded curve inside: no recompile
      // interior: look-around from a fixed spot (exterior orbit limits would push the camera through the walls)
      controls.minDistance = 0.05; controls.maxDistance = 0.3; controls.enablePan = false; controls.enableZoom = false;
    } else {
      activeInterior = null; renderer.toneMapping = THREE.CustomToneMapping;
      controls.minDistance = SPEC.orbitLimits.minDistance; controls.maxDistance = SPEC.orbitLimits.maxDistance; controls.enablePan = true; controls.enableZoom = true;
    }
    currentView = id;
    camera.position.set(...p.pos);
    if (p.interior) controls.target.copy(new THREE.Vector3(...p.target).sub(camera.position).setLength(0.1).add(camera.position));
    else controls.target.set(...p.target);
    camera.lookAt(controls.target);
    lens = presetLens(p); applyLens(); flight = null;
    ev.emit('view', { id, preset: p });
    return true;
  }

  /* ----------------------------- tour ----------------------------- */
  // v1.6 cinematic tour: slow eased flights, a long dwell per view with a smooth eased orbit (alternating direction,
  // gentle for close/level views), optional endless loop (idle "attract" mode).
  let tour = null;
  const TOUR = { fly: 4.8, dwell: 11, orbitDeg: 26, levelOrbitDeg: 9 };
  function tourPlay({ loop = false } = {}) {
    tour = { i: 0, dwell: 0, loop, dir: 1, prevA: 0 };
    setView(SPEC.tour[0], { duration: TOUR.fly });
    ev.emit('tour', { playing: true, loop });
  }
  function tourStop() { if (tour) { tour = null; ev.emit('tour', { playing: false }); } }
  function tourTick(dt) {
    if (!tour) return;
    if (flight) { tour.prevA = 0; return; }
    tour.dwell += dt;
    // eased orbit around the target: total sweep per dwell, smoothstep so it starts and ends at rest
    const p = SPEC.cameras[SPEC.tour[tour.i]] || {};
    const sweep = THREE.MathUtils.degToRad(p.shift ? TOUR.levelOrbitDeg : TOUR.orbitDeg) * tour.dir;
    const u = Math.min(1, tour.dwell / TOUR.dwell), a = sweep * u * u * (3 - 2 * u);
    const off = camera.position.clone().sub(controls.target); off.applyAxisAngle(new THREE.Vector3(0, 1, 0), a - tour.prevA);
    camera.position.copy(controls.target).add(off); camera.lookAt(controls.target);
    tour.prevA = a;
    if (tour.dwell > TOUR.dwell) {
      tour.i++; tour.dwell = 0; tour.prevA = 0; tour.dir = -tour.dir;
      if (tour.i >= SPEC.tour.length) {
        if (!tour.loop) { tourStop(); ev.emit('tourEnd', {}); return; }
        tour.i = SPEC.tour[SPEC.tour.length - 1] === SPEC.tour[0] ? 1 : 0;   // seamless loop (tour ends on hero)
      }
      const id = SPEC.tour[tour.i];             // tour contains exterior views only (spec test enforces)
      setView(id, { duration: TOUR.fly });
      ev.emit('tourStep', { i: tour.i, id });
    }
  }

  /* ----------------------------- modules ----------------------------- */
  const modules = [];
  const moduleStats = {};
  async function loadModules() {
    const list = params.only ? EXTERIOR_MODULES.filter((m) => params.only.includes(m)) : EXTERIOR_MODULES;
    // materials first (module-owned definition files), then builds in parallel
    const matFiles = [...new Set(list.map((m) => MATERIAL_FILES[m]))];
    await Promise.all(matFiles.map((f) => import(f).then((mm) => mm.define?.(M, SPEC)).catch((e) => console.error('[materials] ' + f, e))));
    // create every defined material up front, in parallel, so the worker pool generates textures concurrently
    // (modules awaiting M.use() one by one left most workers idle: ~2x load time)
    progress(0.12, 'Preparing materials');
    await Promise.all(M.names().map((n) => M.use(n)));
    mark('materials');
    let done = 0;
    await Promise.all(list.map(async (name) => {
      const t = performance.now();
      try {
        const mod = await import(MODULE_FILES[name]);
        const before = registry.items.length;
        const built = await mod.build(ctx);
        built.group.name = built.group.name || 'Module_' + name;
        scene.add(built.group);
        modules.push({ name, ...built });
        moduleStats[name] = { ms: Math.round(performance.now() - t), placements: registry.items.length - before };
      } catch (err) { console.error('[module ' + name + ']', err); moduleStats[name] = { error: String(err) }; }
      progress(0.2 + 0.5 * (++done / list.length), 'Building ' + name);
    }));
  }

  /* ----------------------------- debug views ----------------------------- */
  function applyDebug(mode) {
    if (!mode || mode === 'stats') return;
    if (mode === 'normals') { scene.overrideMaterial = new THREE.MeshNormalMaterial(); return; }
    const hashColor = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return new THREE.Color().setHSL((h % 360) / 360, 0.65, 0.5); };
    scene.traverse((o) => {
      if (!o.isMesh || o === sky || o === nightDome || o === cloudDome) return;
      if (mode === 'ids') o.material = new THREE.MeshBasicMaterial({ color: hashColor(o.name || o.parent?.name || 'x') });
      if (mode === 'overdraw') o.material = new THREE.MeshBasicMaterial({ color: 0x0c0c0c, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
    });
  }

  /* ----------------------------- report ----------------------------- */
  const frameTimes = [];
  function report(extra = {}) {
    const v = validateRegistry(registry, SPEC);
    const r = {
      tier: tier.name, view: currentView, k,
      drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      programs: renderer.info.programs?.length ?? null,
      textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries,
      texMs: tex.stats.reduce((a, b) => a + b.ms, 0), texStats: tex.stats,
      boot: bootMarks, modules: moduleStats, ttiMs: Math.round(ttiMs), pixelRatio: renderer.getPixelRatio(), dyn,
      grounding: v, registryCount: registry.items.length, ...extra,
    };
    window.__report = r;
    return r;
  }

  /* ----------------------------- loop ----------------------------- */
  const clock = new THREE.Clock();
  let simT = params.t, ttiMs = 0, running = true, visible = true, readyPrograms = 0;
  let lastFrameStart = performance.now(), headroomSince = 0;
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!visible) return;
    const now = performance.now(); const fms = now - lastFrameStart; lastFrameStart = now;
    const dt = Math.min(0.05, clock.getDelta());
    if (!params.freeze) simT += dt;
    if (flight) {
      flight.t += dt / flight.dur; const e = easeInOutCubic(Math.min(1, flight.t));
      camera.position.lerpVectors(flight.from.pos, flight.to.pos, e);
      // arc upward mid-flight for a cinematic feel
      camera.position.y += Math.sin(Math.PI * e) * Math.min(25, flight.from.pos.distanceTo(flight.to.pos) * 0.12);
      controls.target.lerpVectors(flight.from.target, flight.to.target, e);
      lens = { tanV: THREE.MathUtils.lerp(flight.from.lens.tanV, flight.to.lens.tanV, e), shift: THREE.MathUtils.lerp(flight.from.lens.shift, flight.to.lens.shift, e) };
      applyLens();
      if (flight.t >= 1) flight = null;
      camera.lookAt(controls.target);
    } else {
      if (relaxShift) { lens.shift *= 0.85; if (Math.abs(lens.shift) < 0.002) { lens.shift = 0; relaxShift = false; } applyLens(); }
      controls.update();
      if (controls.target.y < SPEC.orbitLimits.minTargetY) controls.target.y = SPEC.orbitLimits.minTargetY;
      if (!activeInterior && camera.position.y < 1.2) camera.position.y = 1.2;
    }
    tourTick(dt);
    const f = { dt: params.freeze ? 0 : dt, t: simT, k, camera, tier: tier.name, frozen: params.freeze };
    const target = activeInterior ? activeInterior.scene : scene;
    if (activeInterior) activeInterior.mod.update?.(f); else for (const m of modules) m.update?.(f);
    renderer.info.reset();
    skyMat.uniforms.uOrigin.value.copy(camera.position);   // sky directions from the eye: horizon stays level at any height
    renderer.render(target, camera);
    ev.emit('frame', f);
    // stats + dynamic resolution (not in shot/freeze mode)
    frameTimes.push(fms); if (frameTimes.length > SPEC.quality.dynamicRes.sampleFrames) frameTimes.shift();
    if (!params.freeze && frameTimes.length === SPEC.quality.dynamicRes.sampleFrames && readyPrograms) {
      const med = [...frameTimes].sort((a, b) => a - b)[frameTimes.length >> 1];
      const targetMs = 1000 / (tier.name === 'low' ? SPEC.quality.targets.lowFps : SPEC.quality.targets.heroFps);
      if (med < targetMs * 0.75) { headroomSince ||= now; } else headroomSince = 0;
      const nd = dynResStep(dyn, med, targetMs, SPEC.quality.dynamicRes, headroomSince && now - headroomSince > SPEC.quality.dynamicRes.raiseAfterMs);
      if (nd !== dyn) { dyn = nd; applySize(); frameTimes.length = 0; headroomSince = 0; }
      if (renderer.info.programs && renderer.info.programs.length > readyPrograms) { console.warn('[perf] new shader program after ready'); readyPrograms = renderer.info.programs.length; }
    }
  }

  /* ----------------------------- boot ----------------------------- */
  progress(0.05, 'Preparing materials');
  addEventListener('resize', applySize);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting && !document.hidden; }).observe(canvas);

  mark('start');
  const cloudsTex = await tex.get('clouds', {});
  if (cloudsTex.albedo) { cloudMat.map = cloudsTex.albedo; cloudsTex.albedo.wrapT = THREE.ClampToEdgeWrapping; }
  // SphereGeometry(thetaLength = PI/2) already maps uv.y 1 (zenith) -> 0 (horizon), matching the clouds recipe.

  await loadModules();
  mark('modules');
  progress(0.75, 'Lighting');

  // bake env keyframes (same size; switching textures does not recompile)
  // v1.7 smooth time scrubbing: ENV_STEPS+1 environments baked along k from BLENDED keyframe states (was one per
  // keyframe -> visible lighting pops between phases). Same PMREM size -> switching never recompiles.
  const hx = (c) => '#' + c.getHexString();
  const envOf = (kf) => ({ ...kf, sky: { ...kf.sky,
    zenith: hx(new THREE.Color(kf.sky.zenith).lerp(new THREE.Color(kf.sky.horizon), 0.55)),
    // lighting only: a saturated mid stop (dusk magenta) would tint every wall -> pulled toward a neutral dusty tone
    ...(kf.sky.mid ? { mid: hx(new THREE.Color(kf.sky.mid).lerp(new THREE.Color('#9C9AAE'), 0.65)) } : {}) } });
  for (let i = 0; i <= ENV_STEPS; i++) {
    // env sky: zenith pulled ~55 % toward the horizon so shade gets a soft cool fill, not saturated blue pavers;
    // stronger disc in the env gives crisp sun glints on glass
    const kk = i / ENV_STEPS, st = todBlend(kfs, kk), A = kfById[st.a], Bk = kfById[st.b];
    setSkyFor(st, envSkyMat, envOf(A), envOf(Bk), { discScale: 3 });
    const nightW = THREE.MathUtils.smoothstep(st.night, 0.35, 0.75);
    envGround.material.color.set(0xA8977A).lerp(new THREE.Color(0x15171c), nightW);   // warm ground bounce by day
    envBandMat.color.set(0x66705F).lerp(new THREE.Color(0x0e0f12), nightW);
    envMaps[i] = pmrem.fromScene(envScene, 0.02).texture;
  }
  applyTime(k, { immediateShadow: true });
  applySize();
  // an interior start view is entered after the exterior warm-up (below), so __ready means the interior is shown
  const startInterior = !!SPEC.cameras[params.view]?.interior;
  setView(startInterior ? 'hero' : params.view, { instant: true });
  applyDebug(params.debug);

  // warm-up: compile, then render every exterior preset once (with shadows) behind the loader
  mark('env');
  progress(0.85, 'Warming up');
  await renderer.compileAsync(scene, camera);
  mark('compile');
  const save = { pos: camera.position.clone(), target: controls.target.clone(), lens: { ...lens } };
  for (const [id, p] of Object.entries(SPEC.cameras)) {
    if (p.interior) continue;
    camera.position.set(...p.pos); camera.lookAt(...p.target); lens = presetLens(p); applyLens();
    renderer.shadowMap.needsUpdate = true; renderer.render(scene, camera);
  }
  camera.position.copy(save.pos); controls.target.copy(save.target); lens = save.lens; applyLens(); camera.lookAt(controls.target);
  renderer.shadowMap.needsUpdate = true;
  for (let i = 0; i < 3; i++) { renderer.info.reset(); renderer.render(scene, camera); await new Promise((r) => requestAnimationFrame(r)); }
  if (startInterior) await setView(params.view, { instant: true });
  mark('warmup');
  readyPrograms = renderer.info.programs?.length || 1;
  ttiMs = performance.now() - t0;
  requestAnimationFrame(frame);
  progress(1, 'Welcome');

  /* ----------------------------- public API ----------------------------- */
  const app = {
    SPEC, params, tier: tier.name, renderer, scene, camera, controls, registry, M,
    on: ev.on,
    views: Object.keys(SPEC.cameras),
    setView, getView: () => currentView,
    setTime: (v) => applyTime(v), getTime: () => k, timeState: () => todState,
    tour: { play: tourPlay, stop: tourStop, playing: () => !!tour },
    setInteractive(on) { controls.enabled = !!on; },
    project(p) {
      const v = new THREE.Vector3(...p).project(camera);
      const rect = canvas.getBoundingClientRect();
      return { x: (v.x * 0.5 + 0.5) * rect.width, y: (-v.y * 0.5 + 0.5) * rect.height, visible: v.z < 1 && v.z > -1 && Math.abs(v.x) <= 1.05 && Math.abs(v.y) <= 1.05 };
    },
    isInterior: () => !!activeInterior,
    report, frameStats() { const s = [...frameTimes].sort((a, b) => a - b); return { median: s[s.length >> 1], p95: s[Math.floor(s.length * 0.95)], n: s.length }; },
    async snapshot({ maxWidth = 3840, scale = 2 } = {}) {
      const w = canvas.clientWidth, h = canvas.clientHeight, pr = renderer.getPixelRatio();
      const s = Math.min(scale, maxWidth / w);
      renderer.setPixelRatio(s); renderer.setSize(w, h, false); applyLens();
      renderer.render(activeInterior ? activeInterior.scene : scene, camera);
      const out = document.createElement('canvas'); out.width = canvas.width; out.height = canvas.height;
      const g = out.getContext('2d', { willReadFrequently: true });
      g.drawImage(canvas, 0, 0);
      const fs = Math.round(out.width / 110);
      g.font = `${fs}px Inter, system-ui, sans-serif`; g.fillStyle = 'rgba(255,255,255,0.85)'; g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = fs / 3;
      g.fillText(SPEC.brand.name + ' · ' + SPEC.brand.disclaimer, fs, out.height - fs);
      renderer.setPixelRatio(pr); applySize();
      return new Promise((r) => out.toBlob(r, 'image/png'));
    },
    dispose() { running = false; tex.dispose(); renderer.dispose(); },
  };
  // v1.13 looks: SPEC.looks default, or ?look=<id>. Uniform writes only (no recompile); the UI's tune panel edits it live.
  setLook(resolveLook(SPEC.looks, params.look));
  app.setLook = setLook; app.getLook = getLook;
  window.app = app;
  report();
  window.__ready = true;
  ev.emit('ready', { ttiMs });
  return app;
}
