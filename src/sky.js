// Art-directed sky (replaces the Preetham Sky + night dome): clean-air gradient, thin horizon haze, sun glow + disc,
// procedural stars. One program for every time of day (keyframes only change uniforms -> no recompile after ready).
// Colours are authored as display sRGB (the shader skips tone mapping), so a keyframe hex is what the viewer sees.
import * as THREE from 'three';

const VERT = /* glsl */`
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */`
uniform vec3 uZenith, uMid, uHorizon, uHaze, uGround, uSunCol, uSunDir, uOrigin, uMoonDir;
uniform float uHazeAmt, uGlow, uDisc, uStars, uMoon;
varying vec3 vWorld;
float h3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 d = normalize(vWorld - uOrigin);
  float y = d.y;
  float hy = clamp(y, 0.0, 1.0);
  // gradient: fast fall-off above the horizon keeps the upper sky a saturated clean blue
  // 3-stop gradient horizon -> mid -> zenith (mid defaults to the halfway colour = the old 2-stop look)
  float tg = 1.0 - exp(-hy * 4.0);
  vec3 c = tg < 0.5 ? mix(uHorizon, uMid, smoothstep(0.0, 0.5, tg)) : mix(uMid, uZenith, smoothstep(0.5, 1.0, tg));
  // thin horizon haze band (aerial perspective without smog)
  c = mix(c, uHaze, uHazeAmt * exp(-max(y, 0.0) * 22.0));
  // below the horizon: blend into the far-ground tone (hides the ground-plane edge)
  c = mix(c, uGround, smoothstep(0.0, -0.05, y));
  // sun: broad glow + tight aureole + disc (glow stays near the horizon band for low suns)
  float cs = max(dot(d, uSunDir), 0.0);
  c += uSunCol * uGlow * (0.55 * pow(cs, 6.0) + 0.6 * pow(cs, 48.0));
  c += uSunCol * uDisc * smoothstep(0.99955, 0.9998, cs);
  // stars (fade near the horizon); cell size scales with the dome radius
  if (uStars > 0.001) {
    vec3 q = floor(d * 900.0);
    float s = step(0.9988, h3(q)) * smoothstep(0.06, 0.4, y);
    c += vec3(0.85, 0.9, 1.0) * s * (0.25 + 0.6 * h3(q + 1.7)) * uStars;
  }
  // moon: soft-edged disc + halo (art-directed size ~1 deg so it reads on a laptop screen)
  if (uMoon > 0.001) {
    float cm = max(dot(d, uMoonDir), 0.0);
    c += vec3(0.75, 0.82, 1.0) * uMoon * (0.10 * pow(cm, 900.0) + 0.05 * pow(cm, 60.0));
    c = mix(c, vec3(1.0, 0.97, 0.9), uMoon * smoothstep(0.99982, 0.99988, cm));
  }
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

export function createSkyMaterial() {
  const C = () => new THREE.Color();
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: {
      uZenith: { value: C() }, uMid: { value: C() }, uHorizon: { value: C() }, uHaze: { value: C() }, uGround: { value: C() },
      uSunCol: { value: C() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uOrigin: { value: new THREE.Vector3() },
      uMoonDir: { value: new THREE.Vector3(0, 1, 0) }, uMoon: { value: 0 },
      uHazeAmt: { value: 0.5 }, uGlow: { value: 0.3 }, uDisc: { value: 4 }, uStars: { value: 0 },
    },
    vertexShader: VERT, fragmentShader: FRAG,
  });
}

/** Blend two keyframes' sky colours (hex strings) into the material uniforms. */
export function applySky(mat, a, b, t, sunDir, { discScale = 1 } = {}) {
  const u = mat.uniforms, lc = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), t);
  const L = (x, y) => x + (y - x) * t;
  u.uZenith.value.copy(lc(a.sky.zenith, b.sky.zenith));
  const midOf = (s) => s.mid || '#' + new THREE.Color(s.horizon).lerp(new THREE.Color(s.zenith), 0.5).getHexString();
  u.uMid.value.copy(lc(midOf(a.sky), midOf(b.sky)));
  u.uHorizon.value.copy(lc(a.sky.horizon, b.sky.horizon));
  u.uHaze.value.copy(lc(a.sky.haze, b.sky.haze));
  u.uGround.value.copy(lc(a.sky.ground, b.sky.ground));
  u.uSunCol.value.copy(lc(a.sky.glowColor, b.sky.glowColor));
  u.uHazeAmt.value = L(a.sky.hazeAmt, b.sky.hazeAmt);
  u.uGlow.value = L(a.sky.glow, b.sky.glow);
  u.uDisc.value = L(a.sky.disc, b.sky.disc) * discScale;
  u.uStars.value = L(a.sky.stars, b.sky.stars);
  u.uMoon.value = L(a.sky.moon || 0, b.sky.moon || 0);
  u.uSunDir.value.copy(sunDir);
}
