// Materials owned by the tower module. Register with M.define(name, async (ctx) => material).
//   tower.glass     instanced window glass: interior mapping (box room ray-cast from a 2048x1024 atlas of 8 rooms),
//                   curtain layer at 0.25 m, Fresnel env reflection from the standard PBR path (F0 0.04, rough 0.05).
//                   Per-instance attribute aWin = (variant + sill/2, curtain, lit, tint).
//                   Night glow via uniforms (userData.uniforms.uNight / uDayI); never swap the material.
//                   Low tier (tier.windows === 'parallax'): 2-layer parallax (back wall + curtain).
//   tower.ornament  relief panels, cartouches, scroll capitals (normal-mapped plaster atlas)
//   tower.darkGlass round-headed attic windows (dark glossy panel, polygonOffset in front of the wall)
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
  float dayL = uDayI * (1.0 - 0.45 * depthF) * (0.8 + 0.4 * vWin.w);
  vec3 warmL = uWarm * uLitI * (0.7 + 0.6 * vWin.w) * (1.0 - 0.3 * depthF);
  vec3 nightL = mix(vec3(0.01), warmL, litW);
  vec3 Lr = mix(vec3(dayL), nightL, uNight);
  vec3 icol = room * Lr;
  // curtain layer 0.25 m behind the glass
  float tc = -0.25 / rd.z;
  vec3 hc = p0 + rd * tc;
  float cx = hc.x / Wsz.x + 0.5;
  float cov = vWin.y;
  float fw = max(fwidth(cx), 1e-3) * 1.5;
  float drape = max(1.0 - smoothstep(cov * 0.5 - fw, cov * 0.5 + fw, cx), smoothstep(1.0 - cov * 0.5 - fw, 1.0 - cov * 0.5 + fw, cx));
  float sheer = smoothstep(0.78, 0.82, cov);
  float folds = 0.8 + 0.2 * sin(hc.x * 34.0 + vId * 1.7);
  vec3 cCol = mix(vec3(0.78, 0.72, 0.62), vec3(0.93, 0.91, 0.87), vWin.w) * folds;
  float inY = step(-0.5 * Wsz.y - 0.2, hc.y) * step(hc.y, 0.5 * Wsz.y + 0.4);
  float ca = max(drape * 0.94, sheer * 0.62) * inY * step(0.02, cov);
  vec3 cL = mix(vec3(uDayI * 1.15), nightL * 1.1, uNight);
  icol = mix(icol, cCol * cL, ca);
  float NdV = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
  float Fr = 0.04 + 0.96 * pow(1.0 - NdV, 5.0);
  totalEmissiveRadiance += icol * (1.0 - Fr);
}
`;

export function define(M, SPEC) {
  const P = SPEC.global.palette;

  M.define('tower.glass', async (ctx) => {
    const rooms = await ctx.tex.get('tower.rooms', { w: 2048, h: 1024 });
    if (rooms.albedo) { rooms.albedo.wrapS = rooms.albedo.wrapT = THREE.ClampToEdgeWrapping; rooms.albedo.anisotropy = 1; }
    const parallax = ctx.tier?.windows === 'parallax';
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(P.glassTint).multiplyScalar(0.12), roughness: 0.05, metalness: 0, envMapIntensity: 1,
    });
    const uniforms = {
      uRooms: { value: rooms.albedo }, uNight: { value: 0 }, uDayI: { value: 0.32 }, uLitI: { value: 2.4 },
      uWarm: { value: new THREE.Color('#FFA757') },      // ~2700 K
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
    m.customProgramCacheKey = () => 'tower.glass.v1.' + (parallax ? 'parallax' : 'interior');
    return m;
  });

  M.define('tower.ornament', async (ctx) => {
    const m = pbr(await ctx.tex.get('tower.ornament', { color: P.ornament }), { roughness: 1 });
    m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2;
    return m;
  });

  M.define('tower.darkGlass', async () => new THREE.MeshStandardMaterial({
    color: '#2A231D', roughness: 0.12, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  }));

  M.define('tower.hedge', async (ctx) => pbr(await ctx.tex.get('tower.leaves', { color: P.hedge }), { roughness: 1 }));

  M.define('tower.lamp', async () => new THREE.MeshStandardMaterial({
    color: '#D9D2C4', emissive: '#FFC98A', emissiveIntensity: 0, roughness: 0.5,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  }));
}
