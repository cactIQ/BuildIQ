// Materials owned by the tower module. Register with M.define(name, async (ctx) => material).
//   tower.glass     instanced window glass: interior mapping (box room ray-cast from a 2048x1024 atlas of 8 rooms),
//                   curtain layer at 0.25 m, Fresnel env reflection: standard PBR path (F0 0.04) + art-directed IBL term (rough 0.08, 0.04 -> 0.6 grazing).
//                   Per-instance attribute aWin = (variant + sill/2, curtain, lit, tint).
//                   Night glow via uniforms (userData.uniforms.uNight / uDayI); never swap the material.
//                   Low tier (tier.windows === 'parallax'): 2-layer parallax (back wall + curtain).
//   tower.plaster / tower.trim / tower.recess / tower.ornament: facade materials sharing one patched program
//                   (cornice AO band, recess darkening, night facade wash via uniforms; see facadePatch)
//   tower.ornament  relief panels, cartouches, scroll capitals (normal-mapped plaster atlas)
//   tower.darkGlass round-headed attic windows (dark glossy panel, warm night glow via emissiveIntensity)
//   tower.hedge     roof hedges and planter greenery
//   tower.lamp      stilt soffit downlights (emissive, driven by night)
import * as THREE from 'three';
import { pbr } from './base.js';

const VERT_HEAD = /* glsl */`
attribute vec4 aWin;
varying vec4 vWin;
varying vec3 vRayTS;
varying vec2 vWinUv;
varying vec2 vWinSize;
`;
const VERT_BODY = /* glsl */`
{
  mat4 imW = mat4(1.0);
  #ifdef USE_INSTANCING
  imW = instanceMatrix;
  #endif
  vec4 wpW = modelMatrix * imW * vec4(transformed, 1.0);
  vec3 Tw = mat3(modelMatrix) * imW[0].xyz;
  vec3 Bw = mat3(modelMatrix) * imW[1].xyz;
  vec3 Nw = mat3(modelMatrix) * imW[2].xyz;
  vWinSize = vec2(length(Tw), length(Bw));
  vec3 rayW = wpW.xyz - cameraPosition;
  vRayTS = vec3(dot(rayW, normalize(Tw)), dot(rayW, normalize(Bw)), dot(rayW, normalize(Nw)));
  vWinUv = position.xy + 0.5;
  vWin = aWin;
}
`;
const FRAG_HEAD = (parallax) => /* glsl */`
#define WIN_PARALLAX ${parallax ? 1 : 0}
uniform sampler2D uRooms;
uniform float uNight;
uniform float uDayI;
uniform float uLitI;
uniform vec3 uWarm;
uniform vec3 uCool;
uniform float uReflK;
varying vec4 vWin;
varying vec3 vRayTS;
varying vec2 vWinUv;
varying vec2 vWinSize;
vec3 winRoomTex(vec2 tileO, vec2 off, vec2 q, float lod) {
  vec2 uv = tileO + (off + clamp(q, 0.012, 0.988) * 0.5) * vec2(0.25, 0.5);
  return textureLod(uRooms, uv, lod).rgb;
}
`;
const FRAG_BODY = /* glsl */`
{
  vec2 Wsz = max(vWinSize, vec2(0.2));
  vec3 rd = normalize(vRayTS);
  rd.z = min(rd.z, -0.03);
  if (abs(rd.x) < 1e-4) rd.x = 1e-4;
  if (abs(rd.y) < 1e-4) rd.y = 1e-4;
  float vId = floor(vWin.x + 1e-3);
  float sillH = fract(vWin.x + 1e-3) * 2.0;
  vec3 p0 = vec3((vWinUv - 0.5) * Wsz, 0.0);
  float Rw = max(Wsz.x + 1.8, 3.2);
  float Dp = 3.0 + 0.9 * fract(vId * 0.618 + vWin.w * 0.37);
  float yF = -0.5 * Wsz.y - sillH;
  float Hc = 2.8;
  vec2 tileO = vec2(mod(vId, 4.0) * 0.25, floor(vId / 4.0) * 0.5);
  float lod = clamp(log2(max(length(fwidth(vWinUv * Wsz)), 1e-5) * 72.0), 0.0, 6.0);
  float depthF;
  vec3 room;
#if WIN_PARALLAX
  float tb = -Dp / rd.z;
  vec3 hb = p0 + rd * tb;
  room = winRoomTex(tileO, vec2(0.0), vec2((hb.x + 0.5 * Rw) / Rw, (hb.y - yF) / Hc), lod);
  depthF = 1.0;
#else
  vec3 rmin = vec3(-0.5 * Rw, yF, -Dp), rmax = vec3(0.5 * Rw, yF + Hc, 0.0);
  vec3 invd = 1.0 / rd;
  vec3 tA = (rmin - p0) * invd, tB = (rmax - p0) * invd;
  vec3 tf = max(tA, tB);
  float th = min(min(tf.x, tf.y), tf.z);
  vec3 hp = p0 + rd * th;
  depthF = clamp(-hp.z / Dp, 0.0, 1.0);
  vec2 qq; vec2 off;
  if (th == tf.z) { off = vec2(0.0); qq = vec2((hp.x - rmin.x) / Rw, (hp.y - yF) / Hc); }
  else if (th == tf.x) { off = vec2(0.5, 0.0); qq = vec2(depthF, (hp.y - yF) / Hc); }
  else if (rd.y < 0.0) { off = vec2(0.0, 0.5); qq = vec2((hp.x - rmin.x) / Rw, depthF); }
  else { off = vec2(0.5, 0.5); qq = vec2((hp.x - rmin.x) / Rw, depthF); }
  room = winRoomTex(tileO, off, qq, lod);
#endif
  float litW = step(0.5, vWin.z);
  float hW = fract(sin(vWin.w * 91.73 + vId * 3.17) * 437.58);
  // v1.4: no "bright room" lottery - every window reads the same by day
  float dayL = uDayI * (1.0 - 0.45 * depthF) * (0.8 + 0.4 * vWin.w) * 0.75;
  // v1.3 (refs: archviz night stills): warm-WHITE interiors (~3000 K, gentle per-home variation, no orange/white
  // lottery), soft ceiling-to-floor falloff, rooms desaturated at night so wall/sofa colours don't tint the glow
  vec3 lampC = mix(uWarm, uCool, fract(vWin.w * 7.31) * 0.6);
  float fall = 0.72 + 0.4 * smoothstep(-0.5, 0.5, vWinUv.y - 0.5);
  vec3 warmL = lampC * uLitI * (0.85 + 0.3 * vWin.w) * (1.0 - 0.25 * depthF) * fall;
  vec3 nightL = mix(vec3(0.012, 0.014, 0.02), warmL, litW);
  vec3 Lr = mix(vec3(dayL), nightL, uNight);
  float rl = dot(room, vec3(0.2126, 0.7152, 0.0722));
  vec3 icol = mix(room, vec3(rl) * 1.1, 0.6 * uNight * litW) * Lr;
  // curtain layer 0.25 m behind the glass
  float tc = -0.25 / rd.z;
  vec3 hc = p0 + rd * tc;
  float cx = hc.x / Wsz.x + 0.5;
  float cov = vWin.y;
  float fw = max(fwidth(cx), 1e-3) * 1.5;
  float drape = cov > 0.99 ? 1.0 : max(1.0 - smoothstep(cov * 0.5 - fw, cov * 0.5 + fw, cx), smoothstep(1.0 - cov * 0.5 - fw, 1.0 - cov * 0.5 + fw, cx));
  float sheer = smoothstep(0.78, 0.82, cov);
  float folds = 0.92 + 0.08 * sin(hc.x * 34.0 + vId * 1.7);          // v1.4: soft folds (no stripy rectangles)
  vec3 cCol = vec3(0.9, 0.87, 0.8) * folds;                          // one ivory sheer for every window
  float inY = step(-0.5 * Wsz.y - 0.2, hc.y) * step(hc.y, 0.5 * Wsz.y + 0.4);
  float ca = max(drape * 0.94, sheer * 0.62) * inY * step(0.02, cov);
  // v1.4 night: a soothing glow, not a hard bright rectangle - brightest in the middle of the pane, falling off
  // softly toward the frame (lamp light diffused by the sheer), at a calmer intensity
  float ex = min(vWinUv.x, 1.0 - vWinUv.x), ey = min(vWinUv.y, 1.0 - vWinUv.y);
  float soft = mix(0.42, 1.0, smoothstep(0.0, 0.38, ex) * smoothstep(0.0, 0.32, ey));
  vec3 cL = mix(vec3(uDayI * 2.1), nightL * 0.95 * soft, uNight);
  icol = mix(icol, cCol * cL, ca);
  vec3 gV = normalize(vViewPosition), gN = normalize(normal);
  float NdV = clamp(dot(gN, gV), 0.0, 1.0);
  float Fr = 0.04 + 0.96 * pow(1.0 - NdV, 5.0);                       // what the standard specular path already adds
  // v1.1 marketing glazing: 0.10 facing -> 0.7 grazing (was 0.04 -> 0.6: windows read as matte black holes head-on)
  float Fg = mix(0.1, 0.7, pow(1.0 - NdV, 2.0));
  totalEmissiveRadiance += icol * (1.0 - max(Fr, Fg) * (1.0 - 0.55 * uNight));
#ifdef USE_ENVMAP
  // art-directed: tilt the reflection normal ~15 deg upward so downward views pick up horizon/sky, not the ground;
  // per-pane gain variation (+-20 %) breaks the uniform sheet look of real glass curtain walls
  vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float paneK = 0.8 + 0.4 * fract(sin(vWin.w * 51.7 + vId * 7.13) * 917.3);
  totalEmissiveRadiance += getIBLRadiance(gV, normalize(gN + upV * 0.27), 0.06) * uReflK * paneK * max(Fg + 0.05 - Fr * 0.5, 0.0);
#endif
}
`;


/* Facade patch (tower.plaster / trim / recess / ornament share ONE program; values are per-material uniforms).
 *  - baked AO band under every heavy cornice (world-height test against uCornY), recess darkening via uTint
 *  - night facade wash (2700-3000 K) gated by uWash = f(state.night): base mid-tone, grazing gradient above each
 *    cornice, lit cornice undersides, uplight pools at the stilt base, aGlow-tagged pilasters / crown pavilions. */
const NC = 10;
const FAC_VERT_HEAD = /* glsl */`
attribute float aGlow;
varying float vGlow;
varying vec3 vFWPos;
`;
const FAC_VERT_BODY = /* glsl */`
vGlow = aGlow;
vFWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;
const FAC_FRAG_HEAD = /* glsl */`
#define TW_NC ${NC}
uniform float uCornY[TW_NC];
uniform vec2 uYR;
uniform vec3 uWashCol;
uniform float uWash;
uniform float uCornAO;
uniform vec3 uTint;
varying float vGlow;
varying vec3 vFWPos;
`;
const FAC_FRAG_BODY = /* glsl */`
{
  vec3 nW = normalize(inverseTransformDirection(nonPerturbedNormal, viewMatrix));
  float fy = vFWPos.y;
  float vert = 1.0 - smoothstep(0.35, 0.75, abs(nW.y));
  float below = 9.0, above = 9.0;
  for (int i = 0; i < TW_NC; i++) {
    float d = uCornY[i] - 0.18 - fy;
    if (d > -0.03) below = min(below, max(d, 0.0));
    float a = fy - (uCornY[i] + 0.37);
    if (a > -0.05) above = min(above, max(a, 0.0));
  }
  float band = 1.0 - smoothstep(0.0, 1.1, below);
  diffuseColor.rgb *= (1.0 - uCornAO * vert * band * sqrt(band)) * uTint;
  // v1.1 night scheme = architectural accent lighting, not a flood: dim walls, grazing pilaster uplights,
  // a lit crown (top band + attic/pediments/mumties), warm cornice soffits and wall-washes, stilt uplight pools.
  float hT = clamp((fy - uYR.x) / (uYR.y - uYR.x), 0.0, 1.0);
  float down = smoothstep(0.3, 0.85, -nW.y);
  float graze = exp(-above / 1.6);
  float up = vert * exp(-max(fy - 0.3, 0.0) / 3.0);
  // v1.3 (refs: archviz night stills): ONE even, soft floodlight wash from ground-mounted fixtures, fading gently
  // with height - no pilaster stripes or cornice bands (they read as uneven, dirty walls). A modest crown light,
  // lit soffits under projections and the stilt uplight pools stay.
  float flood = 0.5 + 0.5 * exp(-max(fy - uYR.x, 0.0) / 26.0);
  float crown = smoothstep(uYR.y - 2.5, uYR.y + 0.8, fy);
  float w = vert * flood * 0.42 + (1.0 - vert) * 0.12 + down * 0.35 + up * 0.7 + graze * vert * 0.04;
  float wc = crown * (0.22 + 0.25 * smoothstep(0.85, 1.2, vGlow));
  totalEmissiveRadiance += diffuseColor.rgb * uWash * (uWashCol * w + vec3(1.0, 0.9, 0.78) * wc);
}
`;
function facadePatch(m, shared, { cornAO = 0.32, tint = [1, 1, 1] } = {}) {
  const u = { uWash: { value: 0 }, uCornAO: { value: cornAO }, uTint: { value: new THREE.Vector3(...tint) } };
  m.userData.facade = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + FAC_VERT_HEAD)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + FAC_VERT_BODY);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FAC_FRAG_HEAD)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + FAC_FRAG_BODY);
  };
  m.customProgramCacheKey = () => 'tower.facade.v1';
  return m;
}
function facadeShared(SPEC) {
  const t = SPEC.towers[0], baseY = t.plinthH + t.stiltH, topY = baseY + t.floors * t.floorH;
  const ys = t.cornices.map((f) => baseY + f * t.floorH);
  ys.push(topY + t.attic.bandH, topY + t.mumty.h1 - 0.04, topY + t.mumty.h1 + t.mumty.h2 - 0.04);
  while (ys.length < NC) ys.push(-100);
  return {
    uCornY: { value: ys.slice(0, NC) }, uYR: { value: new THREE.Vector2(baseY, topY) },
    uWashCol: { value: new THREE.Color('#FFDDB8') },   // ~3300 K soft warm-white floodlight (was 2900 K orange)
  };
}

export function define(M, SPEC) {
  const P = SPEC.global.palette;
  const shared = facadeShared(SPEC);

  // v1.3: smoother render (variation/streaks ~ -60 %): the graded curve amplified mottling into a dirty, uneven wall
  M.define('tower.plaster', async (ctx) => facadePatch(pbr(await ctx.tex.get('plaster', { color: P.body, seed: 7, variation: 0.025, streaks: 0.012, grain: 0.025 }), { roughness: 1 }), shared));
  M.define('tower.trim', async (ctx) => facadePatch(pbr(await ctx.tex.get('plaster', { color: P.trim, seed: 8, variation: 0.03, streaks: 0.02 }), { roughness: 1 }), shared));
  // balcony / loggia recesses and the stilt soffit: same plaster, darkened ~0.6 (fake AO; envMapIntensity is
  // overridden by scene.environmentIntensity for scene-env materials, so it cannot do this job)
  M.define('tower.recess', async (ctx) => facadePatch(pbr(await ctx.tex.get('plaster', { color: P.body, seed: 7, variation: 0.025, streaks: 0.012, grain: 0.025 }), { roughness: 1 }), shared, { cornAO: 0, tint: [0.68, 0.6, 0.56] }));

  M.define('tower.glass', async (ctx) => {
    const rooms = await ctx.tex.get('tower.rooms', { w: 2048, h: 1024 });
    if (rooms.albedo) { rooms.albedo.wrapS = rooms.albedo.wrapT = THREE.ClampToEdgeWrapping; rooms.albedo.anisotropy = 1; }
    const parallax = ctx.tier?.windows === 'parallax';
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(P.glassTint).multiplyScalar(0.12), roughness: 0.05, metalness: 0, envMapIntensity: 1,
    });
    const uniforms = {
      uRooms: { value: rooms.albedo }, uNight: { value: 0 }, uDayI: { value: 0.32 }, uLitI: { value: 1.15 },   // v1.5: all windows lit -> slightly lower per-window (was 1.35)
      uWarm: { value: new THREE.Color('#FFC88C') },      // ~2900 K soft honey (owner window reference)
      uCool: { value: new THREE.Color('#FFD9AE') },      // ~3200 K
      uReflK: { value: 1.35 },
    };
    m.userData.uniforms = uniforms;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + VERT_HEAD)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + FRAG_HEAD(parallax))
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + FRAG_BODY);
    };
    m.customProgramCacheKey = () => 'tower.glass.v3.' + (parallax ? 'parallax' : 'interior');
    return m;
  });

  M.define('tower.ornament', async (ctx) => {
    const m = facadePatch(pbr(await ctx.tex.get('tower.ornament', { color: P.ornament }), { roughness: 1, normalStrength: 1.7 }), shared);
    m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2;
    return m;
  });

  M.define('tower.darkGlass', async () => new THREE.MeshStandardMaterial({
    color: '#2A231D', emissive: '#FFB066', emissiveIntensity: 0, roughness: 0.12, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  }));

  M.define('tower.hedge', async (ctx) => pbr(await ctx.tex.get('tower.leaves', { color: P.hedge }), { roughness: 1 }));

  M.define('tower.lamp', async () => new THREE.MeshStandardMaterial({
    color: '#D9D2C4', emissive: '#FFC98A', emissiveIntensity: 0, roughness: 0.5,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  }));
}
